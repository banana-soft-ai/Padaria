/**
 * Utilitários de rede (online/offline) sem dependência de React.
 * Permite que libs como syncService verifiquem status sem usar hooks.
 */

/** Retorna se o ambiente está online (navegador: navigator.onLine; SSR: true). */
export function getOnlineStatus(): boolean {
  if (typeof window === 'undefined') return true
  return navigator.onLine
}

/** Tipo do callback de mudança de status online. */
export type OnlineStatusCallback = (online: boolean) => void

/** Inscreve-se em mudanças de status online. Retorna função para cancelar. */
export function subscribeToOnlineStatus(callback: OnlineStatusCallback): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
