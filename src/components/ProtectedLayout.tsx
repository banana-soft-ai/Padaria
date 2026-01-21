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
    const checkUser = async () => {
      try {
        // Se variáveis do Supabase não estão configuradas, liberar acesso em modo offline
        const hasSupabaseEnv = !!clientEnv.NEXT_PUBLIC_SUPABASE_URL && !!clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!hasSupabaseEnv) {
          setUser({} as any)
          setLoading(false)
          return
        }

        const { data: { session }, error } = await supabase!.auth.getSession()

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
        console.error('Erro ao verificar sessão:', error)
        router.push('/login')
      }
    }

    checkUser()

    if (!supabase) {
      return
    }

    const { data: { subscription } } = supabase!.auth.onAuthStateChange(
      async (event, session) => {


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

    return () => subscription.unsubscribe()
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
