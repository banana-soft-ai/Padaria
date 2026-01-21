'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedLayout from '@/components/ProtectedLayout'

export default function HomeRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/caixa')
  }, [router])

  return (
    <ProtectedLayout>
      <div />
    </ProtectedLayout>
  )
}