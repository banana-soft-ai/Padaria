import { useState, useEffect, useCallback } from 'react'
import { clientEnv } from '@/env/client-env'

interface PWAInstallPrompt {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAState {
  isInstallable: boolean
  isInstalled: boolean
  isOnline: boolean
  isStandalone: boolean
  installPrompt: PWAInstallPrompt | null
  swRegistration: ServiceWorkerRegistration | null
}

export function usePWA(): PWAState & {
  installApp: () => Promise<void>
  updateApp: () => Promise<void>
  requestNotificationPermission: () => Promise<boolean>
  sendNotification: (title: string, options?: NotificationOptions) => void
} {
  const [state, setState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isOnline: navigator.onLine,
    isStandalone: false,
    installPrompt: null,
    swRegistration: null
  })

  // Verificar se é PWA instalado
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://')

    setState(prev => ({ ...prev, isStandalone }))
  }, [])

  // Detectar prompt de instalação
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setState(prev => ({
        ...prev,
        isInstallable: true,
        installPrompt: e
      }))
    }

    const handleAppInstalled = () => {
      setState(prev => ({
        ...prev,
        isInstallable: false,
        isInstalled: true,
        installPrompt: null
      }))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Detectar mudanças de conectividade
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Registrar Service Worker
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (clientEnv.NEXT_PUBLIC_ENABLE_PWA !== 'true') return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          setState(prev => ({ ...prev, swRegistration: registration }))
          console.log('[PWA] Service Worker registrado:', registration)
        })
        .catch((error) => {
          console.error('[PWA] Falha ao registrar Service Worker:', error)
        })
    }
  }, [])

  const installApp = useCallback(async () => {
    if (state.installPrompt) {
      await state.installPrompt.prompt()
      const choiceResult = await state.installPrompt.userChoice

      if (choiceResult.outcome === 'accepted') {
        setState(prev => ({
          ...prev,
          isInstallable: false,
          isInstalled: true,
          installPrompt: null
        }))
      }
    }
  }, [state.installPrompt])

  const updateApp = useCallback(async () => {
    if (state.swRegistration) {
      try {
        await state.swRegistration.update()
        console.log('[PWA] App atualizado')
      } catch (error) {
        console.error('[PWA] Erro ao atualizar app:', error)
      }
    }
  }, [state.swRegistration])

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('[PWA] Este navegador não suporta notificações')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }

    return false
  }, [])

  const sendNotification = useCallback((title: string, options: NotificationOptions = {}) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        ...options
      })
    }
  }, [])

  return {
    ...state,
    installApp,
    updateApp,
    requestNotificationPermission,
    sendNotification
  }
}

// Hook para detectar atualizações do app
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg)

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true)
              }
            })
          }
        })
      })
    }
  }, [])

  const updateApp = useCallback(async () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }, [registration])

  return {
    updateAvailable,
    updateApp
  }
}

// Hook para gerenciar dados offline (versão simplificada para compatibilidade)
export function useOfflineDataLegacy() {
  const [offlineData, setOfflineData] = useState<any[]>([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const addOfflineData = useCallback((data: any) => {
    setOfflineData(prev => [...prev, { ...data, timestamp: Date.now() }])
  }, [])

  const clearOfflineData = useCallback(() => {
    setOfflineData([])
  }, [])

  const syncOfflineData = useCallback(async () => {
    if (isOnline && offlineData.length > 0) {
      try {
        console.log('[PWA] Sincronizando dados offline:', offlineData)

        // Simular sincronização
        await new Promise(resolve => setTimeout(resolve, 1000))

        setOfflineData([])
        console.log('[PWA] Dados sincronizados com sucesso')
      } catch (error) {
        console.error('[PWA] Erro ao sincronizar dados:', error)
      }
    }
  }, [isOnline, offlineData])

  return {
    offlineData,
    isOnline,
    addOfflineData,
    clearOfflineData,
    syncOfflineData
  }
}
