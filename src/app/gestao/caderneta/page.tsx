'use client'

import { useEffect, useState } from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import { CadernetaContent } from '@/components/caderneta/CadernetaContent'

export default function CadernetaPage() {
  const [inEmbedded, setInEmbedded] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      setInEmbedded(false)
      return
    }

    // 1) Prefer explicit query param: ?embedded=1 or ?embedded=true
    try {
      const params = new URLSearchParams(window.location.search || '')
      const embeddedParam = params.get('embedded')
      if (embeddedParam === '1' || embeddedParam === 'true') {
        setInEmbedded(true)
        return
      }
    } catch (e) {
      // ignore and fallback to iframe detection
    }

    // 2) Fallback: iframe detection (may throw on cross-origin)
    try {
      setInEmbedded(window.self !== window.top)
    } catch (e) {
      setInEmbedded(true)
    }
  }, [])

  // Evita flicker/hydration: espera a decisão
  if (inEmbedded === null) return null

  if (inEmbedded) return <CadernetaContent />

  return (
    <ProtectedLayout>
      <CadernetaContent />
    </ProtectedLayout>
  )
}
