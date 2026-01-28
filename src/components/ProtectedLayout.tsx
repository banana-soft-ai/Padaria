'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { clientEnv } from '@/env/client-env'
import Sidebar from './Sidebar'
// import { GlobalOfflineStatus } from './GlobalOfflineStatus'

interface ProtectedLayoutProps {
  children: React.ReactNode
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<unknown>(null)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    const checkUser = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/f0795a39-7835-4189-9c83-d26f1bd3912d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProtectedLayout.tsx:21',message:'ProtectedLayout checkUser',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
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

        const { data: { session }, error } = await supabase!.auth.getSession()
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/f0795a39-7835-4189-9c83-d26f1bd3912d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProtectedLayout.tsx:33',message:'ProtectedLayout got session',data:{hasSession:!!session,hasError:!!error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        if (!isMounted) return

        if (error) {
          console.error('Erro ao verificar sessão:', error)
          router.push('/login')
          return
        }

        if (!session) {
          router.push('/login')
          return
        }

        setUser(session.user)
        setLoading(false)
      } catch (error) {
        if (isMounted) {
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
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/f0795a39-7835-4189-9c83-d26f1bd3912d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProtectedLayout.tsx:66',message:'ProtectedLayout auth change',data:{event,hasSession:!!session},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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
