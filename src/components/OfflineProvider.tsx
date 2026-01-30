'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { clientEnv } from '@/env/client-env'
import OfflineStatus from './OfflineStatus'
import ConflictResolver from './ConflictResolver'
import { offlineStorage } from '@/lib/offlineStorage'
import { syncService } from '@/lib/syncService'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { supabase } from '@/lib/supabase/client'

/** Rotas críticas que devem funcionar offline (PDV, Receitas, Configurações, Estoque) */
const OFFLINE_CRITICAL_ROUTES = ['/receitas', '/configuracoes', '/estoque', '/caixa']

interface Conflict {
  id: number
  table: string
  local: any
  remote: any
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [showConflicts, setShowConflicts] = useState(false)
  const [serviceWorkerRegistered, setServiceWorkerRegistered] = useState(false)
  const { isOnline } = useOnlineStatus()
  const pathname = usePathname()
  const router = useRouter()

  // Registrar Service Worker para suporte offline (sempre que suportado; PWA pode ser desabilitado via env)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const pwaDisabled = clientEnv.NEXT_PUBLIC_ENABLE_PWA === 'false'
    if (pwaDisabled) return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrado com sucesso:', registration)
          setServiceWorkerRegistered(true)
        })
        .catch((error) => {
          console.error('Erro ao registrar Service Worker:', error)
        })
    }
  }, [])

  // Prefetch de rotas críticas para funcionar offline (Receitas, Configurações, Estoque, PDV)
  // Garante que os chunks JS e documentos dessas páginas sejam cacheados quando online
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (clientEnv.NEXT_PUBLIC_ENABLE_PWA === 'false') return
    if (!isOnline || !serviceWorkerRegistered) return

    // Só prefetch quando usuário está autenticado (fora de login/logout)
    const isAuthPage = pathname === '/login' || pathname === '/logout'
    if (isAuthPage) return

    const prefetchRoutes = () => {
      OFFLINE_CRITICAL_ROUTES.forEach((route) => {
        try {
          router.prefetch(route)
          // Fetch explícito para garantir que o SW cache o documento da página
          fetch(route, { credentials: 'include' }).catch(() => {})
        } catch {
          // Ignorar erros de prefetch
        }
      })
    }

    // Prefetch após carregar (dar tempo para sessão estar pronta)
    const timer = setTimeout(prefetchRoutes, 2000)
    return () => clearTimeout(timer)
  }, [isOnline, serviceWorkerRegistered, pathname, router])

  // Verificar conflitos quando voltar online
  useEffect(() => {
    if (isOnline && serviceWorkerRegistered) {
      checkConflicts()
    }
  }, [isOnline, serviceWorkerRegistered])

  // Baixar dados para cache offline quando online
  useEffect(() => {
    if (isOnline && serviceWorkerRegistered) {
      syncService.downloadDataForOffline()
    }
  }, [isOnline, serviceWorkerRegistered])

  // Listener para mensagens do Service Worker
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (clientEnv.NEXT_PUBLIC_ENABLE_PWA === 'false') return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type } = event.data

        switch (type) {
          case 'SYNC_STARTED':
            console.log('Sincronização iniciada em background')
            break
          case 'SYNC_COMPLETED':
            console.log('Sincronização concluída em background')
            break
          case 'SYNC_ERROR':
            console.error('Erro na sincronização em background:', event.data.error)
            break
        }
      })
    }
  }, [])

  const checkConflicts = async () => {
    try {
      // Verificar conflitos nas principais tabelas
      const tables = ['insumos', 'receitas', 'vendas', 'clientes_caderneta', 'caixa_diario']
      const allConflicts: Conflict[] = []

      if (!supabase) {
        return
      }

      for (const table of tables) {
        const localData = await offlineStorage.getOfflineData(table)

        if (localData.length > 0) {
          // Buscar dados remotos
          const { data: remoteData, error } = await supabase
            .from(table)
            .select('*')

          if (!error && remoteData) {
            const tableConflicts = await syncService.checkConflicts(table, localData, remoteData)
            allConflicts.push(...tableConflicts)
          }
        }
      }

      if (allConflicts.length > 0) {
        const isProduction = process.env.NODE_ENV === 'production'
        if (isProduction) {
          // Em produção: resolver automaticamente com versão remota (sem mostrar UI)
          for (const conflict of allConflicts) {
            await syncService.resolveConflict(conflict, 'remote')
          }
        } else {
          // Em desenvolvimento: mostrar diálogo para o usuário resolver
          setConflicts(allConflicts)
          setShowConflicts(true)
        }
      }
    } catch (error) {
      console.error('Erro ao verificar conflitos:', error)
    }
  }

  const handleResolveConflict = (conflictId: number, strategy: 'local' | 'remote' | 'merge') => {
    setConflicts(prev => prev.filter(conflict => conflict.id !== conflictId))

    if (conflicts.length === 1) {
      setShowConflicts(false)
    }
  }

  return (
    <>
      {children}

      {/* Status Offline */}
      <OfflineStatus />

      {/* Resolver Conflitos */}
      {showConflicts && (
        <ConflictResolver
          conflicts={conflicts}
          onResolve={handleResolveConflict}
          onClose={() => setShowConflicts(false)}
        />
      )}
    </>
  )
}

// Adicionar supabase ao syncService para verificação de conflitos
if (typeof window !== 'undefined') {
  import('@/lib/supabase/client').then(({ supabase }) => {
    ; (syncService as any).supabase = supabase
  })
}
