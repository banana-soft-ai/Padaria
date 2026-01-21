'use client'

import { WifiOff, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function OfflinePage() {
  const handleRefresh = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Ícone */}
        <div className="mb-6">
          <WifiOff className="w-16 h-16 text-orange-500 mx-auto" />
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Você está offline
        </h1>

        {/* Descrição */}
        <p className="text-gray-600 mb-6">
          Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.
        </p>

        {/* Status da Conexão */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-orange-700">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <span className="text-sm font-medium">Sem conexão</span>
          </div>
        </div>

        {/* Ações */}
        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </button>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            Ir para o Início
          </Link>
        </div>

        {/* Informações Adicionais */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            Funcionalidades Offline
          </h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Visualizar dados em cache</li>
            <li>• Adicionar novos registros</li>
            <li>• Editar dados existentes</li>
            <li>• Sincronização automática quando online</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
