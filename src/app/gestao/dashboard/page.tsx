'use client'

import dynamic from 'next/dynamic'
import ProtectedLayout from '@/components/ProtectedLayout'
import RouteGuard from '@/components/RouteGuard'

const DashboardContent = dynamic(() => import('./DashboardContent'), {
  loading: () => (
    <div className="page-container flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
    </div>
  ),
  ssr: false
})

export default function DashboardPage() {
  return (
    <RouteGuard>
      <ProtectedLayout>
        <DashboardContent />
      </ProtectedLayout>
    </RouteGuard>
  )
}
