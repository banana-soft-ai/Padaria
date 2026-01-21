'use client'

import { useState } from 'react'
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { syncService } from '@/lib/syncService'

interface GlobalOfflineStatusProps {
  showDetails?: boolean
  className?: string
}

export function GlobalOfflineStatus({ showDetails = false, className = '' }: GlobalOfflineStatusProps) {
  const { isOnline, isReconnecting } = useOnlineStatus()
  const [showFullStatus, setShowFullStatus] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    synced: number
    failed: number
    errors: string[]
  } | null>(null)

  const handleSyncNow = async () => {
    try {
      const result = await syncService.forceSync()
      setSyncResult(result)
      setTimeout(() => setSyncResult(null), 5000)
    } catch (error) {
      console.error('Erro ao sincronizar:', error)
    }
  }

  if (isOnline && !showDetails) {
    return null // Não mostrar quando online e não for detalhado
  }

  return (
    <div className={`fixed top-4 right-4 z-40 ${className}`}>
      {/* Status Principal */}
      <div 
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg cursor-pointer transition-all duration-300 ${
          isOnline 
            ? 'bg-green-500 text-white' 
            : 'bg-orange-500 text-white'
        }`}
        onClick={() => setShowFullStatus(!showFullStatus)}
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
      </div>

      {/* Status Expandido */}
      {showFullStatus && (
        <div className="absolute top-12 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Status da Conexão</h3>
            <button
              onClick={() => setShowFullStatus(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

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
              
              {!isOnline && (
                <button
                  onClick={handleSyncNow}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  <RefreshCw className="w-3 h-3" />
                  Sincronizar
                </button>
              )}
            </div>

            {/* Informações Offline */}
            {!isOnline && (
              <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-700">
                <div className="font-medium mb-1">Modo Offline Ativo</div>
                <div>
                  Seus dados estão sendo salvos localmente. 
                  Quando a conexão for restabelecida, eles serão sincronizados automaticamente.
                </div>
              </div>
            )}

            {/* Informações Online */}
            {isOnline && (
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
                <div className="font-medium mb-1">Conexão Estável</div>
                <div>
                  Todos os dados estão sendo sincronizados em tempo real com o servidor.
                </div>
              </div>
            )}

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

            {/* Dicas */}
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
              <div className="font-medium mb-1">💡 Dicas:</div>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>O sistema funciona offline automaticamente</li>
                <li>Dados são sincronizados quando online</li>
                <li>Nenhuma informação é perdida</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Notificação de Sincronização */}
      {syncResult && (
        <div className={`absolute top-12 right-0 px-3 py-2 rounded shadow-lg text-sm ${
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
