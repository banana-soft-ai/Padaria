/**
 * Hook para gerenciar dados offline
 * Funciona tanto online quanto offline, sincronizando automaticamente
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { offlineStorage } from '@/lib/offlineStorage'
import { syncService } from '@/lib/syncService'
import { useOnlineStatus } from './useOnlineStatus'

interface UseOfflineDataOptions {
  table: string
  autoSync?: boolean
  initialData?: any[]
}

interface UseOfflineDataReturn<T> {
  data: T[]
  loading: boolean
  error: string | null
  addItem: (item: Omit<T, 'id'>) => Promise<T>
  addMany: (items: Omit<T, 'id'>[]) => Promise<T[]>
  updateItem: (id: number, updates: Partial<T>) => Promise<void>
  deleteItem: (id: number) => Promise<void>
  refresh: () => Promise<void>
  sync: () => Promise<void>
  isOffline: boolean
  pendingSync: boolean
}

export function useOfflineData<T extends { id: number }>({
  table,
  autoSync = true,
  initialData = []
}: UseOfflineDataOptions): UseOfflineDataReturn<T> {
  const [data, setData] = useState<T[]>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isOnline } = useOnlineStatus()
  const [pendingSync, setPendingSync] = useState(false)

  // Carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (isOnline) {
        // Online: buscar do Supabase
        let query = supabase
          .from(table)
          .select('*')

        // Filtrar por 'ativo = true' para tabelas que têm essa coluna
        if (table === 'clientes_caderneta' || table === 'receitas') {
          query = query.eq('ativo', true)
        }

        const { data: onlineData, error: supabaseError } = await query
          .order('created_at', { ascending: false })

        if (supabaseError) throw supabaseError

        setData(onlineData || [])

        // Salvar no cache offline
        if (onlineData) {
          await offlineStorage.saveOfflineData(table, onlineData)
        }
      } else {
        // Offline: buscar do cache local
        const offlineData = await offlineStorage.getOfflineData(table)
        setData(offlineData as T[])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      console.log(`Informação ao carregar dados da tabela ${table}:`, errorMessage)
      setError(errorMessage)

      // Em caso de erro, tentar usar dados offline
      try {
        const offlineData = await offlineStorage.getOfflineData(table)
        setData(offlineData as T[])
      } catch (offlineErr) {
        const offlineErrorMessage = offlineErr instanceof Error ? offlineErr.message : 'Erro desconhecido'
        console.log('Informação ao carregar dados offline:', offlineErrorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [table, isOnline])

  // Adicionar item - retorna o item criado (com id real quando online, temp quando offline)
  const addItem = useCallback(async (item: Omit<T, 'id'>): Promise<T> => {
    const newItem = {
      ...item,
      // ID temporário negativo (evita colisão com IDs do servidor e cabe em integer)
      id: -(Math.floor(Math.random() * 1e9) + 1),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as unknown as T

    try {
      // Adicionar localmente
      setData(prev => [newItem, ...prev])

      if (isOnline) {
        // Online: inserir no Supabase
        try {
          console.log(`[useOfflineData] Inserindo na tabela ${table}:`, newItem)

          // Remover o campo `id` do payload enviado ao Supabase para permitir que o
          // banco atribua o ID real (evita erro quando usamos IDs temporários grandes)
          const payload: any = { ...newItem }
          delete payload.id
          delete payload.updated_at

          const { data: insertedData, error: supabaseError } = await supabase
            .from(table)
            .insert(payload)
            .select()
            .single()

          if (supabaseError) {
            const errInfo = { code: (supabaseError as any).code, message: (supabaseError as any).message, details: (supabaseError as any).details, hint: (supabaseError as any).hint }
            console.error('[useOfflineData] Supabase retornou erro ao inserir:', errInfo)
            throw errInfo
          }

          // Atualizar com ID real do servidor
          setData(prev => prev.map(it =>
            it.id === newItem.id ? { ...it, ...insertedData } : it
          ))

          // Salvar no cache offline
          const updatedData = [insertedData, ...data]
          await offlineStorage.saveOfflineData(table, updatedData)

          return insertedData as T
        } catch (supErr) {
          const err = supErr as { code?: string; message?: string; details?: string; hint?: string }
          const errInfo = err ? { code: err?.code, message: err?.message, details: err?.details, hint: err?.hint } : supErr
          console.error('[useOfflineData] Erro ao inserir no Supabase:', errInfo)
          setData(prev => prev.filter(it => it.id !== newItem.id))
          throw errInfo
        }
      } else {
        // Offline: adicionar à fila de sincronização
        await offlineStorage.addPendingOperation({
          type: 'INSERT',
          table,
          data: newItem
        })
        setPendingSync(true)

        // Salvar no cache offline
        await offlineStorage.saveOfflineData(table, [newItem, ...data])

        return newItem
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao adicionar item'
      console.log(`Informação ao adicionar item na tabela ${table}:`, errorMessage)
      setError(errorMessage)

      // Reverter mudança local em caso de erro
      setData(prev => prev.filter(it => it.id !== newItem.id))
      throw err
    }
  }, [table, isOnline, data])

  // Adicionar vários itens em lote (evita problemas de cache em loops)
  const addMany = useCallback(async (items: Omit<T, 'id'>[]): Promise<T[]> => {
    if (items.length === 0) return []

    const newItems: T[] = items.map((item, idx) => ({
      ...item,
      id: -(Math.floor(Math.random() * 1e9) + 1 + idx),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })) as unknown as T[]

    try {
      const mergedData = [...newItems, ...data]
      setData(prev => [...newItems, ...prev])

      if (isOnline) {
        const insertedItems: T[] = []
        for (let i = 0; i < newItems.length; i++) {
          const payload: any = { ...newItems[i] }
          delete payload.id
          delete payload.updated_at
          const { data: insertedData, error: supabaseError } = await supabase
            .from(table)
            .insert(payload)
            .select()
            .single()
          if (supabaseError) throw supabaseError
          insertedItems.push(insertedData as T)
        }
        setData(prev => {
          const tempIds = new Set(newItems.map(n => (n as any).id))
          const without = prev.filter(it => !tempIds.has((it as any).id))
          return [...insertedItems, ...without]
        })
        const finalData = [...insertedItems, ...data]
        await offlineStorage.saveOfflineData(table, finalData)
        return insertedItems
      } else {
        for (const newItem of newItems) {
          await offlineStorage.addPendingOperation({
            type: 'INSERT',
            table,
            data: newItem
          })
        }
        setPendingSync(true)
        await offlineStorage.saveOfflineData(table, mergedData)
        return newItems
      }
    } catch (err) {
      setData(prev => {
        const tempIds = new Set(newItems.map(n => (n as any).id))
        return prev.filter(it => !tempIds.has((it as any).id))
      })
      throw err
    }
  }, [table, isOnline, data])

  // Atualizar item
  const updateItem = useCallback(async (id: number, updates: Partial<T>) => {
    try {
      // Atualizar localmente
      setData(prev => prev.map(item =>
        item.id === id
          ? { ...item, ...updates, updated_at: new Date().toISOString() }
          : item
      ))

      const updatedItem = data.find(item => item.id === id)
      if (!updatedItem) throw new Error('Item não encontrado')

      const finalItem = { ...updatedItem, ...updates }

      if (isOnline) {
        // Online: atualizar no Supabase
        const { error: supabaseError } = await supabase
          .from(table)
          .update(updates)
          .eq('id', id)

        if (supabaseError) throw supabaseError
      } else {
        // Offline: adicionar à fila de sincronização
        await offlineStorage.addPendingOperation({
          type: 'UPDATE',
          table,
          data: finalItem
        })
        setPendingSync(true)
      }

      // Atualizar cache offline
      const updatedData = data.map(item =>
        item.id === id ? finalItem : item
      )
      await offlineStorage.saveOfflineData(table, updatedData)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar item'
      console.log(`Informação ao atualizar item na tabela ${table}:`, errorMessage)
      setError(errorMessage)

      // Reverter mudança local em caso de erro
      await loadData()
    }
  }, [table, isOnline, data, loadData])

  // Deletar item
  const deleteItem = useCallback(async (id: number) => {
    try {
      const itemToDelete = data.find(item => item.id === id)
      if (!itemToDelete) throw new Error('Item não encontrado')

      // Remover localmente
      setData(prev => prev.filter(item => item.id !== id))

      if (isOnline) {
        // Online: deletar do Supabase
        const { error: supabaseError } = await supabase
          .from(table)
          .delete()
          .eq('id', id)

        if (supabaseError) throw supabaseError
      } else {
        // Offline: adicionar à fila de sincronização
        await offlineStorage.addPendingOperation({
          type: 'DELETE',
          table,
          data: { id }
        })
        setPendingSync(true)
      }

      // Atualizar cache offline
      const updatedData = data.filter(item => item.id !== id)
      await offlineStorage.saveOfflineData(table, updatedData)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar item'
      console.log(`Informação ao deletar item da tabela ${table}:`, errorMessage)
      setError(errorMessage)

      // Reverter mudança local em caso de erro
      await loadData()
    }
  }, [table, isOnline, data, loadData])

  // Sincronizar dados
  const sync = useCallback(async () => {
    try {
      setPendingSync(true)
      const result = await syncService.forceSync()

      if (result.success) {
        console.log(`Sincronização da tabela ${table} concluída`)
        await loadData() // Recarregar dados após sincronização
      }

      setPendingSync(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      console.log(`Informação na sincronização da tabela ${table}:`, errorMessage)
      setPendingSync(false)
    }
  }, [table, loadData])

  // Refresh dos dados
  const refresh = useCallback(async () => {
    await loadData()
  }, [loadData])

  // Efeitos
  useEffect(() => {
    loadData()
  }, [loadData])

  // Sincronização automática quando voltar online
  useEffect(() => {
    if (isOnline && autoSync && pendingSync) {
      sync()
    }
  }, [isOnline, autoSync, pendingSync, sync])

  // Verificar se há operações pendentes
  useEffect(() => {
    const checkPendingOperations = async () => {
      const hasPending = await syncService.hasPendingOperations()
      setPendingSync(hasPending)
    }

    checkPendingOperations()

    // Verificar periodicamente
    const interval = setInterval(checkPendingOperations, 5000)
    return () => clearInterval(interval)
  }, [])

  return {
    data,
    loading,
    error,
    addItem,
    addMany,
    updateItem,
    deleteItem,
    refresh,
    sync,
    isOffline: !isOnline,
    pendingSync
  }
}
