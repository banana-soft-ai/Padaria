'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { useAdminUnlock } from '@/hooks/useAdminUnlock'
import { canAccessRoute, isAdminRoute } from '@/lib/permissions'
import ProtectedLayout from './ProtectedLayout'

interface RouteGuardProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'gerente' | 'colaborador' | null
}

export default function RouteGuard({ children, requiredRole = null }: RouteGuardProps) {
  const { user, role, loading } = useUser()
  const { isUnlocked } = useAdminUnlock()
  const router = useRouter()
  const pathname = usePathname()
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    if (loading) return

    // Se não estiver autenticado, redirecionar para login
    if (!user) {
      router.push('/login')
      return
    }

    // Verificar acesso à rota (considerando se o menu está desbloqueado)
    const hasAccess = canAccessRoute(role, pathname, isUnlocked)

    if (!hasAccess) {
      setAccessDenied(true)
      return
    }

    // Se a rota requer role específica, verificar
    if (requiredRole) {
      // Se estiver desbloqueado como admin, ignorar restrição de role
      if (isUnlocked && (requiredRole === 'admin' || requiredRole === 'gerente')) {
        setAccessDenied(false)
        return
      }

      if (requiredRole === 'admin' && role !== 'admin' && role !== 'gerente') {
        setAccessDenied(true)
        return
      }
      if (requiredRole === 'gerente' && role !== 'gerente' && role !== 'admin') {
        setAccessDenied(true)
        return
      }
      if (requiredRole === 'colaborador' && (role === 'admin' || role === 'gerente')) {
        // Admin e gerente podem acessar rotas de colaborador
        setAccessDenied(false)
        return
      }
    }

    setAccessDenied(false)
  }, [user, role, loading, pathname, requiredRole, router, isUnlocked])

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verificando permissões...</p>
          </div>
        </div>
      </ProtectedLayout>
    )
  }

  if (accessDenied) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600 mb-6">
              Você não tem permissão para acessar esta página.
            </p>
            {isAdminRoute(pathname) && (
              <p className="text-sm text-gray-500 mb-4">
                Esta é uma área administrativa. Entre em contato com um administrador se precisar de acesso.
              </p>
            )}
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      </ProtectedLayout>
    )
  }

  return <>{children}</>
}
