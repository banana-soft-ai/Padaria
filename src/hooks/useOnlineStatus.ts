import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [isReconnecting, setIsReconnecting] = useState(false)

  useEffect(() => {
    // Função para verificar se está online
    const checkOnlineStatus = () => {
      const online = navigator.onLine
      setIsOnline(online)
      
      if (!online) {
        setIsReconnecting(true)
      }
    }

    // Função para quando voltar online
    const handleOnline = () => {
      setIsOnline(true)
      setIsReconnecting(false)
      // Disparar evento customizado para sincronização
      window.dispatchEvent(new CustomEvent('network-online'))
    }

    // Função para quando ficar offline
    const handleOffline = () => {
      setIsOnline(false)
      setIsReconnecting(false)
      // Disparar evento customizado
      window.dispatchEvent(new CustomEvent('network-offline'))
    }

    // Verificar status inicial
    checkOnlineStatus()

    // Adicionar listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, isReconnecting }
}
