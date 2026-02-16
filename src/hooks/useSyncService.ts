/**
 * Hook para usar o serviço de sincronização com status online.
 * O syncService em si não usa hooks; este hook expõe isOnline + ações.
 */

import { syncService } from '@/lib/syncService'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function useSyncService() {
  const { isOnline } = useOnlineStatus()

  const syncAll = () => syncService.forceSync()
  const hasPendingOperations = () => syncService.hasPendingOperations()
  const getSyncStats = () => syncService.getSyncStats()

  return {
    isOnline,
    syncAll,
    hasPendingOperations,
    getSyncStats,
    isSyncing: syncService.getSyncingStatus(),
  }
}
