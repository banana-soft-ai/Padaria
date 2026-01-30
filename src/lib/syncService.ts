/**
 * Serviço de sincronização automática entre dados offline e online
 * Sincroniza dados quando a conexão for restabelecida
 */

import { supabase } from '@/lib/supabase/client';
import { offlineStorage } from '@/lib/offlineStorage';
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: string[]
}

/** Extrai mensagem legível de erros (Supabase, Error, etc.) */
function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message || 'Erro desconhecido')
  }
  if (error && typeof error === 'object' && 'details' in error) {
    return String((error as { details?: string }).details || (error as { message?: string }).message || 'Erro desconhecido')
  }
  return String(error ?? 'Erro desconhecido')
}

class SyncService {
  private isSyncing = false
  private syncQueue: (() => Promise<void>)[] = []
  private syncListeners: ((result: SyncResult) => void)[] = []

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Sincronizar quando voltar online
    if (typeof window !== 'undefined') {
      window.addEventListener('network-online', () => {
        this.syncAll()
      })

      // Sincronizar periodicamente quando online
      setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.syncAll()
        }
      }, 30000) // A cada 30 segundos
    }
  }

  // Adicionar listener para resultados de sincronização
  addSyncListener(callback: (result: SyncResult) => void) {
    this.syncListeners.push(callback)
  }

  // Remover listener
  removeSyncListener(callback: (result: SyncResult) => void) {
    const index = this.syncListeners.indexOf(callback)
    if (index > -1) {
      this.syncListeners.splice(index, 1)
    }
  }

  // Notificar listeners sobre resultado de sincronização
  private notifyListeners(result: SyncResult) {
    this.syncListeners.forEach(callback => callback(result))
  }

  // Sincronizar todas as operações pendentes
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, synced: 0, failed: 0, errors: ['Sync já em andamento'] }
    }

    this.isSyncing = true
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: []
    }

    try {
      const pendingOps = await offlineStorage.getPendingOperations()

      if (pendingOps.length === 0) {
        this.isSyncing = false
        this.notifyListeners(result)
        return result
      }

      console.log(`Iniciando sincronização de ${pendingOps.length} operações...`)

      // Sincronizar operações em lotes
      const batchSize = 10
      for (let i = 0; i < pendingOps.length; i += batchSize) {
        const batch = pendingOps.slice(i, i + batchSize)
        await this.syncBatch(batch, result)
      }

      // Limpar operações antigas sincronizadas
      await offlineStorage.cleanupSyncedOperations()

      console.log(`Sincronização concluída: ${result.synced} sucessos, ${result.failed} falhas`)

    } catch (error) {
      result.success = false
      result.errors.push(`Erro na sincronização: ${formatError(error)}`)
      console.error('Erro na sincronização:', error)
    } finally {
      this.isSyncing = false
      this.notifyListeners(result)
    }

    return result
  }

  // Mapa de IDs temporários para IDs reais (usado durante sincronização)
  private tempIdMap: Map<number, number> = new Map()

  // Sincronizar um lote de operações (sequencial para suportar dependências)
  private async syncBatch(operations: any[], result: SyncResult): Promise<void> {
    this.tempIdMap.clear()
    for (const operation of operations) {
      try {
        await this.syncOperation(operation)
        await offlineStorage.markOperationAsSynced(operation.id)
        result.synced++
      } catch (error) {
        result.failed++
        result.errors.push(`Erro na operação ${operation.id}: ${formatError(error)}`)
        console.error(`Erro ao sincronizar operação ${operation.id}:`, error)
      }
    }
  }

  // Sincronizar uma operação específica
  private async syncOperation(operation: any): Promise<void> {
    const { type, table, data } = operation

    switch (type) {
      case 'INSERT':
        await this.insertData(table, data)
        break
      case 'UPDATE':
        await this.updateData(table, data)
        break
      case 'DELETE':
        await this.deleteData(table, data)
        break
      default:
        throw new Error(`Tipo de operação não suportado: ${type}`)
    }
  }

  // Inserir dados no Supabase
  private async insertData(table: string, data: any): Promise<void> {
    // Proteção específica: evitar criação automática de `caixa_diario`
    // durante a sincronização automática. Se já existir um caixa
    // aberto para a mesma data, pulamos a inserção para evitar
    // reabertura indesejada.
    if (table === 'caixa_diario') {
      try {
        const caixaDate = data?.data
        if (caixaDate) {
          const { data: existing, error: selErr } = await (supabase as any)
            .from('caixa_diario')
            .select('id, status')
            .eq('data', caixaDate)
            .limit(1)
            .single()

          if (!selErr && existing) {
            // Já existe caixa para a data — não criar automaticamente
            console.log('[syncService] Pulando insert de caixa_diario (já existe) para data:', caixaDate)
            return
          }
        }
      } catch (checkErr) {
        console.warn('[syncService] Falha ao verificar caixa_diario existente:', checkErr)
        // Se a checagem falhar, deixamos o fluxo continuar e tentar inserir abaixo.
      }
    }

    let insertData = { ...data }
    const tempVendaId = insertData._tempVendaId
    if (tempVendaId !== undefined) {
      delete insertData._tempVendaId
    }

    if (table === 'vendas') {
      const { data: inserted, error } = await (supabase as any)
        .from(table)
        .insert(insertData)
        .select()
        .single()
      if (error) throw error
      if (tempVendaId !== undefined && inserted?.id) {
        this.tempIdMap.set(tempVendaId, inserted.id)
      }
      return
    }

    if (table === 'venda_itens' && insertData.venda_id < 0) {
      const realId = this.tempIdMap.get(insertData.venda_id)
      if (realId !== undefined) {
        insertData = { ...insertData, venda_id: realId }
      }
    }

    const { error } = await (supabase as any)
      .from(table)
      .insert(insertData)

    if (error) throw error
  }

  // Atualizar dados no Supabase
  private async updateData(table: string, data: any): Promise<void> {
    const { id, ...updateData } = data

    const { error } = await (supabase as any)
      .from(table)
      .update(updateData)
      .eq('id', id)

    if (error) throw error
  }

  // Deletar dados do Supabase
  private async deleteData(table: string, data: any): Promise<void> {
    const { error } = await (supabase as any)
      .from(table)
      .delete()
      .eq('id', data.id)

    if (error) throw error
  }

  // Baixar dados do servidor para cache offline
  async downloadDataForOffline(): Promise<void> {
    if (!navigator.onLine) return

    try {
      const tables = [
        'insumos',
        'receitas',
        'composicao_receitas',
        'varejo',
        'vendas',
        'clientes_caderneta',
        'movimentacoes_caderneta',
        'caixa_diario',
        'fluxo_caixa',
        'funcionario',
        'usuarios',
        'precos_venda'
      ]

      for (const table of tables) {
        const { data, error } = await (supabase as any)
          .from(table)
          .select('*')

        if (error) {
          console.error(`Erro ao baixar dados da tabela ${table}:`, error)
          continue
        }

        if (data) {
          await offlineStorage.saveOfflineData(table, data)
          console.log(`Dados da tabela ${table} baixados para cache offline`)
        }
      }
    } catch (error) {
      console.error('Erro ao baixar dados para offline:', error)
    }
  }

  // Verificar conflitos de dados
  async checkConflicts(table: string, localData: any[], remoteData: any[]): Promise<any[]> {
    const conflicts: any[] = []

    for (const localItem of localData) {
      const remoteItem = remoteData.find(item => item.id === localItem.id)

      if (remoteItem && remoteItem.updated_at !== localItem.updated_at) {
        // Conflito detectado - versões diferentes
        conflicts.push({
          id: localItem.id,
          local: localItem,
          remote: remoteItem,
          table
        })
      }
    }

    return conflicts
  }

  // Resolver conflito (usar dados mais recentes por padrão)
  async resolveConflict(conflict: any, strategy: 'local' | 'remote' | 'merge' = 'remote'): Promise<void> {
    const { table, id, local, remote } = conflict

    switch (strategy) {
      case 'local':
        await this.updateData(table, local)
        break
      case 'remote':
        await offlineStorage.saveOfflineData(table, [remote])
        break
      case 'merge':
        // Implementar lógica de merge específica para cada tabela
        const mergedData = await this.mergeData(local, remote)
        await this.updateData(table, mergedData)
        break
    }
  }

  // Merge de dados (implementação básica)
  private async mergeData(local: any, remote: any): Promise<any> {
    // Por padrão, usar dados remotos (mais recentes)
    // Pode ser customizado por tabela conforme necessário
    return {
      ...remote,
      // Manter alguns campos locais se necessário
      id: remote.id,
      updated_at: new Date().toISOString()
    }
  }

  // Forçar sincronização imediata
  async forceSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, synced: 0, failed: 0, errors: ['Sync já em andamento'] }
    }

    return await this.syncAll()
  }

  // Verificar se há operações pendentes
  async hasPendingOperations(): Promise<boolean> {
    const pendingOps = await offlineStorage.getPendingOperations()
    return pendingOps.length > 0
  }

  // Obter estatísticas de sincronização
  async getSyncStats(): Promise<{
    pendingOperations: number
    lastSync: Date | null
    isSyncing: boolean
  }> {
    const pendingOps = await offlineStorage.getPendingOperations()
    const stats = await offlineStorage.getOfflineStats()

    return {
      pendingOperations: pendingOps.length,
      lastSync: stats.lastSync ? new Date(stats.lastSync) : null,
      isSyncing: this.isSyncing
    }
  }

  getSyncingStatus(): boolean {
    return this.isSyncing
  }
}

// Instância singleton
export const syncService = new SyncService()

// Hook para usar o serviço de sincronização
export function useSyncService() {
  const { isOnline } = useOnlineStatus()

  const syncAll = () => syncService.forceSync()
  const hasPendingOperations = () => syncService.hasPendingOperations()
  const getSyncStats = () => syncService.getSyncStats()

  return {
    isOnline,
    syncAll,
    hasPendingOperations,
    getSyncStats,
    isSyncing: syncService.getSyncingStatus()
  }
}
