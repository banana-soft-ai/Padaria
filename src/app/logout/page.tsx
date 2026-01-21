'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react'

type LogoutStatus = 'loading' | 'success' | 'error'

export default function LogoutPage() {
  const router = useRouter()
  const [status, setStatus] = useState<LogoutStatus>('loading')

  useEffect(() => {
    const handleLogout = async () => {
      try {
        // Logout Supabase
        await supabase!.auth.signOut()

        // Limpar cookies
        document.cookie.split(";").forEach(c => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`)
        })

        // Limpar localStorage/sessionStorage
        localStorage.removeItem('sb:token')
        sessionStorage.removeItem('sb:token')

        // Atualizar status para sucesso
        setStatus('success')

        // Redirecionar após 1,5s
        setTimeout(() => {
          router.replace('/login')
        }, 1500)
      } catch (error) {
        console.error('Erro ao fazer logout:', error)
        setStatus('error')

        setTimeout(() => {
          router.replace('/login')
        }, 1500)
      }
    }

    if (status === 'loading') {
      handleLogout()
    }
  }, [router, status])

  const renderMessage = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex items-center gap-2 text-yellow-500">
            <Loader2 className="animate-spin h-6 w-6" />
            Saindo do sistema...
          </div>
        )
      case 'success':
        return (
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle className="h-6 w-6" />
            Logout realizado com sucesso!
          </div>
        )
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-500">
            <XCircle className="h-6 w-6" />
            Erro ao sair. Redirecionando...
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">{renderMessage()}</div>
    </div>
  )
}
