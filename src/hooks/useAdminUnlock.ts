'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useUser } from './useUser'
import { getAuthCache, getAdminUnlockCache, saveAdminUnlockCache, verifyPasswordOffline, derivePasswordHash } from '@/lib/authCache'

const STORAGE_KEY = 'admin-menu-unlocked'
// Ref global para evitar múltiplas verificações
let globalHasChecked = false

export interface UseAdminUnlockReturn {
  isUnlocked: boolean
  isUnlocking: boolean
  error: string | null
  unlock: (email: string, password: string) => Promise<boolean>
  lock: () => void
  checkUnlockStatus: () => void
}

/**
 * Hook para gerenciar o estado de desbloqueio do menu administrativo
 * Usa sessionStorage para persistir o estado apenas durante a sessão
 */
export function useAdminUnlock(): UseAdminUnlockReturn {
  const { canUnlockAdmin, loading: userLoading } = useUser()
  const [isUnlocked, setIsUnlocked] = useState(() => {
    // Inicializar estado do sessionStorage se disponível
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      return saved === 'true'
    }
    return false
  })
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasCheckedRef = useRef(false)

  // Verificar estado salvo ao montar - apenas quando userLoading terminar
  useEffect(() => {
    if (typeof window === 'undefined' || userLoading || globalHasChecked || hasCheckedRef.current) return
    
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved === 'true' && canUnlockAdmin) {
      setIsUnlocked(true)
    } else if (saved === 'true' && !canUnlockAdmin) {
      // Se não tem permissão mas estava desbloqueado, limpar
      sessionStorage.removeItem(STORAGE_KEY)
      setIsUnlocked(false)
    }
    hasCheckedRef.current = true
    globalHasChecked = true
  }, [canUnlockAdmin, userLoading])

  // Função para desbloquear o menu administrativo
  const unlock = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!canUnlockAdmin) {
      setError('Você não tem permissão para desbloquear o menu administrativo')
      return false
    }

    setIsUnlocking(true)
    setError(null)

    try {
      // Offline: validar contra credenciais cacheadas (desbloqueou online antes OU login)
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
      if (isOffline) {
        // 1) Tentar cache do desbloqueio (salvo quando desbloqueou online)
        const adminCache = await getAdminUnlockCache()
        if (adminCache && adminCache.email?.toLowerCase() === email?.toLowerCase()) {
          const valid = await verifyPasswordOffline(password, email, adminCache.passwordHash)
          if (valid && (adminCache.role === 'admin' || adminCache.role === 'gerente')) {
            setIsUnlocked(true)
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(STORAGE_KEY, 'true')
              window.dispatchEvent(new CustomEvent('admin-menu-unlocked-change', { detail: { unlocked: true } }))
            }
            globalHasChecked = true
            setIsUnlocking(false)
            return true
          }
        }

        // 2) Fallback: cache do login (usuário logou como admin/gerente)
        const authCache = await getAuthCache()
        if (authCache && authCache.userData.email?.toLowerCase() === email?.toLowerCase()) {
          const valid = await verifyPasswordOffline(password, email, authCache.passwordHash)
          if (valid && (authCache.userData.role === 'admin' || authCache.userData.role === 'gerente')) {
            setIsUnlocked(true)
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(STORAGE_KEY, 'true')
              window.dispatchEvent(new CustomEvent('admin-menu-unlocked-change', { detail: { unlocked: true } }))
            }
            globalHasChecked = true
            setIsUnlocking(false)
            return true
          }
        }

        setError('Modo offline: desbloqueie online primeiro ou use o email do login.')
        setIsUnlocking(false)
        return false
      }

      // Online: fluxo normal com Supabase
      const { data: { session: currentSession } } = await supabase!.auth.getSession()

      const { data: authData, error: authError } = await supabase!.auth.signInWithPassword({
        email,
        password
      })

      if (authError) {
        setError('Email ou senha incorretos')
        setIsUnlocking(false)
        return false
      }

      if (!authData.user) {
        setError('Erro ao validar credenciais')
        setIsUnlocking(false)
        return false
      }

      const { data: userData, error: dbError } = await supabase!
        .from('usuarios')
        .select('role')
        .eq('email', email)
        .eq('ativo', true)
        .single()

      if (dbError || !userData) {
        setError('Usuário não encontrado ou inativo')
        setIsUnlocking(false)
        if (currentSession) {
          await supabase!.auth.setSession({
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token
          })
        }
        return false
      }

      const userRole = userData.role
      if (userRole !== 'admin' && userRole !== 'gerente') {
        setError('Apenas administradores e gerentes podem desbloquear o menu administrativo')
        setIsUnlocking(false)
        if (currentSession) {
          await supabase!.auth.setSession({
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token
          })
        }
        return false
      }

      if (currentSession) {
        await supabase!.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token
        })
      }

      // Salvar no cache para permitir desbloqueio offline depois
      const passwordHash = await derivePasswordHash(password, email)
      await saveAdminUnlockCache({
        email: email.toLowerCase(),
        passwordHash,
        role: userRole,
        timestamp: Date.now()
      })

      setIsUnlocked(true)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY, 'true')
        window.dispatchEvent(new CustomEvent('admin-menu-unlocked-change', { detail: { unlocked: true } }))
      }
      globalHasChecked = true

      setIsUnlocking(false)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao desbloquear menu'
      console.error('Erro ao desbloquear menu administrativo:', err)
      setError(errorMessage)
      setIsUnlocking(false)
      return false
    }
  }, [canUnlockAdmin])

  // Função para bloquear o menu novamente
  const lock = useCallback(() => {
    setIsUnlocked(false)
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY)
      // Notificar outras instâncias do hook na mesma janela
      window.dispatchEvent(new CustomEvent('admin-menu-unlocked-change', { detail: { unlocked: false } }))
    }
    setError(null)
    globalHasChecked = false // Permitir verificação novamente após lock
  }, [])

  // Função para verificar status de desbloqueio
  const checkUnlockStatus = useCallback(() => {
    if (typeof window === 'undefined' || userLoading) return

    const saved = sessionStorage.getItem(STORAGE_KEY)
    const shouldBeUnlocked = saved === 'true' && canUnlockAdmin
    
    setIsUnlocked(shouldBeUnlocked)
    
    if (saved === 'true' && !canUnlockAdmin) {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [canUnlockAdmin, userLoading])

  // Efeito para sincronização entre instâncias via CustomEvent
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleCustomEvent = (e: any) => {
      const isNowUnlocked = e.detail?.unlocked
      if (isNowUnlocked !== undefined) {
        setIsUnlocked(isNowUnlocked)
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        checkUnlockStatus()
      }
    }

    window.addEventListener('admin-menu-unlocked-change' as any, handleCustomEvent)
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('admin-menu-unlocked-change' as any, handleCustomEvent)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [checkUnlockStatus])

  // Memoizar o objeto de retorno para evitar re-renderizações desnecessárias
  return useMemo(() => ({
    isUnlocked,
    isUnlocking,
    error,
    unlock,
    lock,
    checkUnlockStatus
  }), [isUnlocked, isUnlocking, error, unlock, lock, checkUnlockStatus])
}
