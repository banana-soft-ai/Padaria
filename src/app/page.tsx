'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedLayout from '@/components/ProtectedLayout'
import { useUser } from '@/hooks/useUser'

export default function HomeRedirect() {
  const { role, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (role === 'admin' || role === 'gerente') {
      router.replace('/gestao/dashboard')
    } else {
      router.replace('/caixa')
    }
  }, [role, loading, router])

  return (
    <ProtectedLayout>
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    </ProtectedLayout>
  )
}
