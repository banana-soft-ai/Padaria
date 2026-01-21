'use client'

import { useState } from 'react'
import { useOfflineData } from '@/hooks/useOfflineData'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { syncService } from '@/lib/syncService'
import { supabase } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Wifi, WifiOff, RefreshCw, Database } from 'lucide-react'

/**
 * Componente de demonstração do sistema offline com Supabase
 * Mostra como funciona na prática
 */
export function SupabaseOfflineDemo() {
  const [testResult, setTestResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const { isOnline } = useOnlineStatus()

  // Hook offline para demonstração
  const {
    data: vendas,
    loading: vendasLoading,
    addItem: addVenda,
    sync: syncVendas,
    isOffline: vendasOffline,
    pendingSync
  } = useOfflineData({
    table: 'vendas',
    autoSync: true
  })

  // Teste 1: Venda Online
  const testVendaOnline = async () => {
    setLoading(true)
    setTestResult('')

    try {
      const vendaTeste = {
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0],
        forma_pagamento: 'pix',
        valor_total: 15.50,
        valor_pago: 15.50,
        valor_debito: 0,
        observacoes: 'Teste online - ' + new Date().toLocaleString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await addVenda(vendaTeste)

      setTestResult('✅ Teste Online: Venda registrada com sucesso no Supabase!')
    } catch (error) {
      setTestResult(`❌ Erro no teste online: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // Teste 2: Venda Offline (simulada)
  const testVendaOffline = async () => {
    setLoading(true)
    setTestResult('')

    try {
      // Simular modo offline
      const vendaOffline = {
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0],
        forma_pagamento: 'dinheiro',
        valor_total: 8.75,
        valor_pago: 8.75,
        valor_debito: 0,
        observacoes: 'Teste offline - ' + new Date().toLocaleString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Adicionar diretamente ao storage offline (simular offline)
      const { offlineStorage } = await import('@/lib/offlineStorage')
      await offlineStorage.addPendingOperation({
        type: 'INSERT',
        table: 'vendas',
        data: vendaOffline
      })

      setTestResult('✅ Teste Offline: Venda salva localmente! Será sincronizada quando online.')
    } catch (error) {
      setTestResult(`❌ Erro no teste offline: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // Teste 3: Sincronização Manual
  const testSincronizacao = async () => {
    setLoading(true)
    setTestResult('')

    try {
      const result = await syncService.forceSync()

      if (result.success) {
        setTestResult(`✅ Sincronização: ${result.synced} itens sincronizados, ${result.failed} falhas`)
      } else {
        setTestResult(`❌ Sincronização falhou: ${result.errors.join(', ')}`)
      }
    } catch (error) {
      setTestResult(`❌ Erro na sincronização: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // Teste 4: Verificar Conexão Supabase
  const testConexaoSupabase = async () => {
    setLoading(true)
    setTestResult('')

    try {
      const { data, error } = await supabase
        .from('vendas')
        .select('count')
        .limit(1)

      if (error) throw error

      setTestResult('✅ Supabase: Conexão funcionando perfeitamente!')
    } catch (error) {
      setTestResult(`❌ Supabase: Erro de conexão - ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // Obter estatísticas
  const getStats = async () => {
    try {
      const { offlineStorage } = await import('@/lib/offlineStorage')
      const stats = await offlineStorage.getOfflineStats()
      const pendingOps = await offlineStorage.getPendingOperations()

      setTestResult(`
📊 Estatísticas do Sistema:
• Operações pendentes: ${pendingOps.length}
• Tabelas com dados offline: ${stats.tablesWithData.join(', ')}
• Última sincronização: ${stats.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Nunca'}
• Status: ${isOnline ? '🟢 Online' : '🔴 Offline'}
      `)
    } catch (error) {
      setTestResult(`❌ Erro ao obter estatísticas: ${error}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🧪 Demonstração: Supabase + Sistema Offline
        </h2>
        <p className="text-gray-600">
          Teste na prática como o sistema funciona online e offline com Supabase
        </p>
      </div>

      {/* Status Atual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`p-4 rounded-lg border-2 ${isOnline ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            {isOnline ? <Wifi className="w-5 h-5 text-green-600" /> : <WifiOff className="w-5 h-5 text-orange-600" />}
            <span className="font-medium">Status da Conexão</span>
          </div>
          <p className={isOnline ? 'text-green-700' : 'text-orange-700'}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </p>
        </div>

        <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-blue-600" />
            <span className="font-medium">Vendas Locais</span>
          </div>
          <p className="text-blue-700">
            {vendas.length} vendas carregadas
          </p>
        </div>

        <div className="p-4 rounded-lg border-2 border-purple-200 bg-purple-50">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-5 h-5 text-purple-600" />
            <span className="font-medium">Sincronização</span>
          </div>
          <p className="text-purple-700">
            {pendingSync ? '⏳ Pendente' : '✅ Sincronizado'}
          </p>
        </div>
      </div>

      {/* Botões de Teste */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <button
          onClick={testVendaOnline}
          disabled={loading || !isOnline}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="w-5 h-5" />
          Teste Venda Online
        </button>

        <button
          onClick={testVendaOffline}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <WifiOff className="w-5 h-5" />
          Teste Venda Offline
        </button>

        <button
          onClick={testSincronizacao}
          disabled={loading || isOnline}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className="w-5 h-5" />
          Teste Sincronização
        </button>

        <button
          onClick={testConexaoSupabase}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Database className="w-5 h-5" />
          Teste Supabase
        </button>

        <button
          onClick={getStats}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Database className="w-5 h-5" />
          Ver Estatísticas
        </button>

        <button
          onClick={() => setTestResult('')}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <XCircle className="w-5 h-5" />
          Limpar Resultados
        </button>
      </div>

      {/* Resultado dos Testes */}
      {testResult && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Resultado dos Testes:</h3>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap">{testResult}</pre>
        </div>
      )}

      {/* Instruções */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">📋 Como Testar:</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li><strong>Teste Venda Online:</strong> Funciona apenas quando online. Vai direto para Supabase.</li>
          <li><strong>Teste Venda Offline:</strong> Simula venda offline. Salva localmente.</li>
          <li><strong>Teste Sincronização:</strong> Sincroniza dados offline com Supabase.</li>
          <li><strong>Teste Supabase:</strong> Verifica se a conexão está funcionando.</li>
          <li><strong>Ver Estatísticas:</strong> Mostra dados do sistema offline.</li>
        </ol>
      </div>

      {/* Dicas */}
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="font-medium text-green-900 mb-2">💡 Dicas para Teste Real:</h3>
        <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
          <li>Desconecte a internet do computador para testar offline real</li>
          <li>Faça vendas offline e depois reconecte para ver a sincronização</li>
          <li>Abra o DevTools → Application → IndexedDB para ver dados offline</li>
          <li>Verifique o Supabase Dashboard para confirmar sincronização</li>
        </ul>
      </div>
    </div>
  )
}
