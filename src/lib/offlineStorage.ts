/**
 * Sistema de armazenamento offline usando IndexedDB
 * Armazena dados localmente quando offline e sincroniza quando online
 */

interface OfflineOperation {
  id: string
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  data: any
  timestamp: number
  synced: boolean
}

interface OfflineData {
  table: string
  data: any[]
  lastSync: number
}

class OfflineStorage {
  private dbName = 'ReyDosPaesOffline'
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Store para operações pendentes de sincronização
        if (!db.objectStoreNames.contains('pendingOperations')) {
          const pendingStore = db.createObjectStore('pendingOperations', { keyPath: 'id' })
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false })
          pendingStore.createIndex('synced', 'synced', { unique: false })
        }

        // Store para dados offline (cache local)
        if (!db.objectStoreNames.contains('offlineData')) {
          const dataStore = db.createObjectStore('offlineData', { keyPath: 'table' })
        }

        // Store para configurações offline
        if (!db.objectStoreNames.contains('offlineConfig')) {
          db.createObjectStore('offlineConfig', { keyPath: 'key' })
        }
      }
    })
  }

  // Salvar dados offline
  async saveOfflineData(table: string, data: any[]): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readwrite')
      const store = transaction.objectStore('offlineData')

      const offlineData: OfflineData = {
        table,
        data,
        lastSync: Date.now()
      }

      const request = store.put(offlineData)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Carregar dados offline
  async getOfflineData(table: string): Promise<any[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readonly')
      const store = transaction.objectStore('offlineData')
      const request = store.get(table)

      request.onsuccess = () => {
        const result = request.result as OfflineData
        resolve(result ? result.data : [])
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Adicionar operação pendente de sincronização
  async addPendingOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'synced'>): Promise<void> {
    if (!this.db) await this.init()

    const pendingOp: OfflineOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      synced: false
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingOperations'], 'readwrite')
      const store = transaction.objectStore('pendingOperations')
      const request = store.add(pendingOp)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Obter operações pendentes
  async getPendingOperations(): Promise<OfflineOperation[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingOperations'], 'readonly')
      const store = transaction.objectStore('pendingOperations')
      const request = store.getAll()

      request.onsuccess = () => {
        const operations = request.result as OfflineOperation[]
        resolve(operations.filter(op => !op.synced))
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Marcar operação como sincronizada
  async markOperationAsSynced(operationId: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingOperations'], 'readwrite')
      const store = transaction.objectStore('pendingOperations')
      const getRequest = store.get(operationId)

      getRequest.onsuccess = () => {
        const operation = getRequest.result as OfflineOperation
        if (operation) {
          operation.synced = true
          const putRequest = store.put(operation)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  // Limpar operações sincronizadas antigas
  async cleanupSyncedOperations(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingOperations'], 'readwrite')
      const store = transaction.objectStore('pendingOperations')
      const request = store.getAll()

      request.onsuccess = () => {
        const operations = request.result as OfflineOperation[]
        const oldSyncedOps = operations.filter(op =>
          op.synced && (Date.now() - op.timestamp) > 7 * 24 * 60 * 60 * 1000 // 7 dias
        )

        if (oldSyncedOps.length === 0) {
          resolve()
          return
        }

        let completed = 0
        oldSyncedOps.forEach(op => {
          const deleteRequest = store.delete(op.id)
          deleteRequest.onsuccess = () => {
            completed++
            if (completed === oldSyncedOps.length) resolve()
          }
          deleteRequest.onerror = () => reject(deleteRequest.error)
        })
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Salvar configuração offline
  async setOfflineConfig(key: string, value: any): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineConfig'], 'readwrite')
      const store = transaction.objectStore('offlineConfig')
      const request = store.put({ key, value })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Obter configuração offline
  async getOfflineConfig(key: string): Promise<any> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineConfig'], 'readonly')
      const store = transaction.objectStore('offlineConfig')
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.value : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Verificar se há dados offline
  async hasOfflineData(): Promise<boolean> {
    const pendingOps = await this.getPendingOperations()
    return pendingOps.length > 0
  }

  // Obter estatísticas do armazenamento offline
  async getOfflineStats(): Promise<{
    pendingOperations: number
    tablesWithData: string[]
    lastSync: number | null
  }> {
    const pendingOps = await this.getPendingOperations()
    const tables = ['insumos', 'receitas', 'vendas', 'clientes', 'caixas']
    const tablesWithData: string[] = []

    for (const table of tables) {
      const data = await this.getOfflineData(table)
      if (data.length > 0) {
        tablesWithData.push(table)
      }
    }

    let lastSync: number | null = null
    if (tablesWithData.length > 0) {
      // Obter o último sync das tabelas com dados
      for (const table of tablesWithData) {
        if (!this.db) await this.init()
        const transaction = this.db!.transaction(['offlineData'], 'readonly')
        const store = transaction.objectStore('offlineData')
        const request = store.get(table)

        request.onsuccess = () => {
          const result = request.result as OfflineData
          if (result && (!lastSync || result.lastSync > lastSync)) {
            lastSync = result.lastSync
          }
        }
      }
    }

    return {
      pendingOperations: pendingOps.length,
      tablesWithData,
      lastSync
    }
  }
}

// Instância singleton
export const offlineStorage = new OfflineStorage()

// Inicializar quando o módulo for carregado
if (typeof window !== 'undefined') {
  offlineStorage.init().catch(console.error)
}
