'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { canUnlockAdmin as checkCanUnlock } from '@/lib/permissions'

export type UserRole = 'admin' | 'gerente' | 'funcionario' | 'caixa'

export interface UserData {
  id: string
  email: string
  nome: string
  role: UserRole
  ativo: boolean
}

export interface UseUserReturn {
  user: User | null
  userData: UserData | null
  role: UserRole | null
  loading: boolean
  error: string | null
  isAdmin: boolean
  isGerente: boolean
  isColaborador: boolean
  canUnlockAdmin: boolean
  refresh: () => Promise<void>
}

// Cache global para evitar múltiplas chamadas simultâneas
let globalUserData: { user: User | null; userData: UserData | null } | null = null
let globalLoadingPromise: Promise<void> | null = null

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(globalUserData?.user || null)
  const [userData, setUserData] = useState<UserData | null>(globalUserData?.userData || null)
  // Inicializar loading como false se já temos dados em cache
  const [loading, setLoading] = useState(!globalUserData)
  const [error, setError] = useState<string | null>(null)
  const isMountedRef = useRef(true)
  const hasInitializedRef = useRef(false)

  const updateState = useCallback((newUser: User | null, newUserData: UserData | null, newLoading: boolean, newError: string | null = null) => {
    if (!isMountedRef.current) return
    
    globalUserData = { user: newUser, userData: newUserData }
    setUser(newUser)
    setUserData(newUserData)
    setLoading(newLoading)
    setError(newError)
  }, [])

  const fetchUserData = useCallback(async (forceRefresh = false) => {
    // Se já está carregando e não é refresh forçado, aguardar a promise existente
    if (globalLoadingPromise && !forceRefresh) {
      try {
        await globalLoadingPromise
        // Após aguardar, atualizar estado com cache se disponível
        if (globalUserData && isMountedRef.current) {
          setUser(globalUserData.user)
          setUserData(globalUserData.userData)
          setLoading(false)
        }
      } catch {
        // Ignorar erros da promise anterior
      }
      return
    }

    // Se já temos dados em cache e não é refresh forçado, usar cache
    if (globalUserData && !forceRefresh) {
      if (isMountedRef.current) {
        setUser(globalUserData.user)
        setUserData(globalUserData.userData)
        setLoading(false)
      }
      return
    }

    globalLoadingPromise = (async () => {
      try {
        if (isMountedRef.current) {
          updateState(null, null, true, null)
        }

        // Buscar usuário do Supabase Auth
        const { data: { user: authUser }, error: authError } = await supabase!.auth.getUser()

        if (authError) {
          throw authError
        }

        if (!authUser) {
          if (isMountedRef.current) {
            updateState(null, null, false)
          }
          return
        }

        // Buscar dados do usuário na tabela usuarios usando email
        const { data: dbUser, error: dbError } = await supabase!
          .from('usuarios')
          .select('*')
          .eq('email', authUser.email)
          .eq('ativo', true)
          .single()

        let finalUserData: UserData | null = null

        if (dbError) {
          // Se não encontrar na tabela, usar role padrão 'funcionario'
          console.warn('Usuário não encontrado na tabela usuarios, usando role padrão:', dbError)
          finalUserData = {
            id: authUser.id,
            email: authUser.email || '',
            nome: authUser.user_metadata?.nome || authUser.email?.split('@')[0] || 'Usuário',
            role: 'funcionario',
            ativo: true
          }
        } else if (dbUser) {
          finalUserData = {
            id: dbUser.id,
            email: dbUser.email,
            nome: dbUser.nome,
            role: dbUser.role as UserRole,
            ativo: dbUser.ativo
          }
        }

        // Sempre atualizar o cache global, mesmo se o componente estiver desmontado
        globalUserData = { user: authUser, userData: finalUserData }
        
        // Atualizar estado apenas se o componente estiver montado
        if (isMountedRef.current) {
          updateState(authUser, finalUserData, false)
        } else {
          // Se o componente foi desmontado, ainda atualizar o cache para que quando remontar, use os dados corretos
          // Mas também tentar atualizar o estado diretamente para componentes que podem estar esperando
          setUser(authUser)
          setUserData(finalUserData)
          setLoading(false)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar dados do usuário'
        console.error('Erro ao buscar dados do usuário:', err)
        if (isMountedRef.current) {
          updateState(null, null, false, errorMessage)
        }
      } finally {
        globalLoadingPromise = null
      }
    })()

    await globalLoadingPromise
  }, [updateState])

  useEffect(() => {
    // Prevenir múltiplas inicializações
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    isMountedRef.current = true

    // Se já temos cache, usar os dados do cache
    if (globalUserData) {
      setUser(globalUserData.user)
      setUserData(globalUserData.userData)
      setLoading(false)
    } else {
      // Carregar dados iniciais apenas se não houver cache
      fetchUserData()
    }

    // Escutar mudanças na autenticação - apenas uma vez globalmente
    let subscription: { unsubscribe: () => void } | null = null
    
    if (typeof window !== 'undefined') {
      // Criar subscription apenas uma vez (singleton pattern)
      if (!(window as any).__supabaseAuthSubscription) {
        const { data: { subscription: sub } } = supabase!.auth.onAuthStateChange(
          async (event) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              globalUserData = null // Limpar cache para forçar recarregamento
              // Notificar todas as instâncias do hook para recarregar
              window.dispatchEvent(new CustomEvent('user-data-refresh'))
            } else if (event === 'SIGNED_OUT') {
              globalUserData = null
              window.dispatchEvent(new CustomEvent('user-data-clear'))
            }
          }
        )
        subscription = sub
        ;(window as any).__supabaseAuthSubscription = subscription
      } else {
        subscription = (window as any).__supabaseAuthSubscription
      }

      // Escutar eventos customizados para atualizar estado
      const handleRefresh = () => {
        if (isMountedRef.current) {
          fetchUserData(true)
        }
      }
      const handleClear = () => {
        if (isMountedRef.current) {
          updateState(null, null, false)
        }
      }

      window.addEventListener('user-data-refresh', handleRefresh)
      window.addEventListener('user-data-clear', handleClear)

      return () => {
        isMountedRef.current = false
        window.removeEventListener('user-data-refresh', handleRefresh)
        window.removeEventListener('user-data-clear', handleClear)
        // Não fazer unsubscribe da subscription global aqui
      }
    } else {
      // Fallback para SSR
      const { data: { subscription: sub } } = supabase!.auth.onAuthStateChange(
        async (event) => {
          if (!isMountedRef.current) return

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            globalUserData = null
            await fetchUserData(true)
          } else if (event === 'SIGNED_OUT') {
            globalUserData = null
            updateState(null, null, false)
          }
        }
      )
      subscription = sub

      return () => {
        isMountedRef.current = false
        subscription?.unsubscribe()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Executar apenas uma vez na montagem

  const role = userData?.role || null
  const isAdmin = role === 'admin'
  const isGerente = role === 'gerente'
  const isColaborador = role === 'funcionario' || role === 'caixa'
  const canUnlockAdmin = checkCanUnlock(role)

  // Memoizar o objeto de retorno para evitar re-renderizações desnecessárias
  return useMemo(() => ({
    user,
    userData,
    role,
    loading,
    error,
    isAdmin,
    isGerente,
    isColaborador,
    canUnlockAdmin,
    refresh: () => fetchUserData(true)
  }), [user, userData, role, loading, error, isAdmin, isGerente, isColaborador, canUnlockAdmin, fetchUserData])
}
