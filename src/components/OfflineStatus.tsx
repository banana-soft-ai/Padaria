'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { syncService } from '@/lib/syncService'

interface SyncStats {
  pendingOperations: number
  lastSync: Date | null
  isSyncing: boolean
}

export function OfflineStatus() {
  const { isOnline, isReconnecting } = useOnlineStatus()
  const [syncStats, setSyncStats] = useState<SyncStats>({
    pendingOperations: 0,
    lastSync: null,
    isSyncing: false
  })
  const [showDetails, setShowDetails] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    synced: number
    failed: number
    errors: string[]
  } | null>(null)

  // Atualizar estatísticas de sincronização
  useEffect(() => {
    const updateStats = async () => {
      const stats = await syncService.getSyncStats()
      setSyncStats(stats)
    }

    updateStats()
    const interval = setInterval(updateStats, 2000)
    return () => clearInterval(interval)
  }, [])

  // Listener para resultados de sincronização
  useEffect(() => {
    const handleSyncResult = (result: any) => {
      setSyncResult(result)
      setTimeout(() => setSyncResult(null), 5000) // Limpar após 5 segundos
    }

    syncService.addSyncListener(handleSyncResult)
    return () => syncService.removeSyncListener(handleSyncResult)
  }, [])

  const handleSyncNow = async () => {
    try {
      await syncService.forceSync()
    } catch (error) {
      console.error('Erro ao sincronizar:', error)
    }
  }

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Nunca'
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Agora mesmo'
    if (minutes < 60) return `${minutes} min atrás`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h atrás`
    
    const days = Math.floor(hours / 24)
    return `${days} dias atrás`
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Status Principal */}
      <div 
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg cursor-pointer transition-all duration-300 ${
          isOnline 
            ? 'bg-green-500 text-white' 
            : 'bg-orange-500 text-white'
        }`}
        onClick={() => setShowDetails(!showDetails)}
      >
        {isOnline ? (
          <Wifi className="w-4 h-4" />
        ) : (
          <WifiOff className="w-4 h-4" />
        )}
        
        <span className="text-sm font-medium">
          {isOnline ? 'Online' : 'Offline'}
        </span>
        
        {isReconnecting && (
          <RefreshCw className="w-3 h-3 animate-spin" />
        )}
        
        {syncStats.pendingOperations > 0 && (
          <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
            {syncStats.pendingOperations}
          </span>
        )}
      </div>

      {/* Detalhes Expandidos */}
      {showDetails && (
        <div className="absolute bottom-16 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80">
          <div className="space-y-3">
            {/* Status da Conexão */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                )}
                <span className="font-medium">
                  {isOnline ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              
              <button
                onClick={handleSyncNow}
                disabled={!isOnline || syncStats.isSyncing}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncStats.isSyncing ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Sincronizar
              </button>
            </div>

            {/* Estatísticas */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Última sincronização:</span>
                <span>{formatLastSync(syncStats.lastSync)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Operações pendentes:</span>
                <span className={syncStats.pendingOperations > 0 ? 'text-orange-600' : 'text-green-600'}>
                  {syncStats.pendingOperations}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={syncStats.isSyncing ? 'text-blue-600' : 'text-gray-600'}>
                  {syncStats.isSyncing ? 'Sincronizando...' : 'Aguardando'}
                </span>
              </div>
            </div>

            {/* Resultado da Sincronização */}
            {syncResult && (
              <div className={`p-2 rounded text-xs ${
                syncResult.success 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <div className="font-medium mb-1">
                  {syncResult.success ? 'Sincronização concluída' : 'Erro na sincronização'}
                </div>
                <div>
                  {syncResult.synced} sucessos, {syncResult.failed} falhas
                </div>
                {syncResult.errors.length > 0 && (
                  <div className="mt-1 text-xs opacity-75">
                    {syncResult.errors[0]}
                  </div>
                )}
              </div>
            )}

            {/* Informações Offline */}
            {!isOnline && (
              <div className="bg-orange-50 border border-orange-200 rounded p-2 text-xs text-orange-700">
                <div className="font-medium mb-1">Modo Offline</div>
                <div>
                  Seus dados estão sendo salvos localmente. 
                  Quando a conexão for restabelecida, eles serão sincronizados automaticamente.
                </div>
              </div>
            )}

            {/* Fechar */}
            <button
              onClick={() => setShowDetails(false)}
              className="w-full mt-2 px-3 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Notificação de Sincronização */}
      {syncResult && (
        <div className={`absolute bottom-16 right-0 px-3 py-2 rounded shadow-lg text-sm ${
          syncResult.success 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {syncResult.success ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Sincronizado: {syncResult.synced} itens</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>Erro: {syncResult.failed} falhas</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default OfflineStatus
