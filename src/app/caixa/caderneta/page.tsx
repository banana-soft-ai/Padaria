'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedLayout from '@/components/ProtectedLayout'

export default function CadernetaPDVPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/caixa?view=caderneta')
  }, [router])

  return (
    <ProtectedLayout>
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <p className="text-gray-500">Redirecionando para o PDV...</p>
      </div>
    </ProtectedLayout>
  )
}
