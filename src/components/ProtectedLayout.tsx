'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { clientEnv } from '@/env/client-env'
import { offlineStorage } from '@/lib/offlineStorage'
import Sidebar from './Sidebar'
// import { GlobalOfflineStatus } from './GlobalOfflineStatus'

interface ProtectedLayoutProps {
  children: React.ReactNode
}

const AUTH_CACHE_KEY = 'authCache'

function isSessionExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false
  // Considerar expirado 60s antes para margem de segurança
  return Date.now() / 1000 >= expiresAt - 60
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<unknown>(null)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    const checkUser = async () => {
      try {
        // Se variáveis do Supabase não estão configuradas, liberar acesso em modo offline
        const hasSupabaseEnv = !!clientEnv.NEXT_PUBLIC_SUPABASE_URL && !!clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!hasSupabaseEnv) {
          if (isMounted) {
            setUser({} as any)
            setLoading(false)
          }
          return
        }

        let session = null
        let error = null

        try {
          const result = await supabase!.auth.getSession()
          session = result.data?.session ?? null
          error = result.error ?? null
        } catch (e) {
          error = e
        }

        if (!isMounted) return

        if (session?.user && !isSessionExpired(session.expires_at)) {
          setUser(session.user)
          setLoading(false)
          return
        }

        // Fallback offline: tentar cache quando getSession falhou ou sessão ausente
        if (error || !session) {
          const cached = await offlineStorage.getOfflineConfig(AUTH_CACHE_KEY)
          if (cached?.session?.user && !isSessionExpired(cached.session.expires_at)) {
            if (isMounted) {
              setUser(cached.session.user)
              setLoading(false)
            }
            return
          }
        }

        if (error) {
          console.error('Erro ao verificar sessão:', error)
        }
        router.push('/login')
      } catch (error) {
        if (isMounted) {
          // Última tentativa: cache offline
          try {
            const cached = await offlineStorage.getOfflineConfig(AUTH_CACHE_KEY)
            if (cached?.session?.user && !isSessionExpired(cached.session.expires_at)) {
              setUser(cached.session.user)
              setLoading(false)
              return
            }
          } catch {
            // ignorar
          }
          console.error('Erro ao verificar sessão:', error)
          router.push('/login')
        }
      }
    }

    checkUser()

    if (!supabase) {
      return () => {
        isMounted = false
      }
    }

    const { data: { subscription } } = supabase!.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          router.push('/login')
        } else if (session) {
          setUser(session.user)
          setLoading(false)
        } else {
          setUser(null)
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <main className="main-content overflow-x-auto">
        {children}
        {/* <GlobalOfflineStatus /> */}
      </main>
    </div>
  )
}
