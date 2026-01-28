'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import ProtectedLayout from '@/components/ProtectedLayout'
import RouteGuard from '@/components/RouteGuard'
import CaixasTab from '@/components/gestao/CaixasTab'
import { CaixaDiario } from '@/types/gestao'
import { TrendingUp, TrendingDown, DollarSign, Calculator, CreditCard } from 'lucide-react'
import { obterInicioMes, obterInicioSemana, calcularTotaisPeriodo } from '@/lib/dateUtils'

export default function CaixasPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [caixasDiarios, setCaixasDiarios] = useState<CaixaDiario[]>([])
  const [dataInicio, setDataInicio] = useState<string>('')
  const [dataFim, setDataFim] = useState<string>('')
  const [filtroRapido, setFiltroRapido] = useState<string>('')

  useEffect(() => {
    carregarDados()
  }, [])

  // Função para aplicar filtros rápidos usando funções centralizadas
  const aplicarFiltroRapido = (filtro: string) => {
    const hoje = new Date()
    const hojeStr = hoje.toISOString().split('T')[0]

    switch (filtro) {
      case 'ultima-semana':
        // Usar função centralizada para semana (última segunda até hoje)
        setDataInicio(obterInicioSemana())
        setDataFim(hojeStr)
        break

      case 'ultimo-mes':
        // Usar função centralizada para mês (dia 1 até hoje)
        setDataInicio(obterInicioMes())
        setDataFim(hojeStr)
        break

      case 'limpar':
        setDataInicio('')
        setDataFim('')
        break
    }
    setFiltroRapido(filtro)
  }

  // Calcular totais dos caixas filtrados
  const totais = useMemo(() => {
    const totalEntradas = caixasDiarios.reduce((sum, c) => sum + (c.total_entradas || 0), 0)
    const totalSaidas = caixasDiarios.reduce((sum, c) => sum + (c.valor_saidas || 0), 0)
    const totalDiferenca = caixasDiarios.reduce((sum, c) => sum + (c.diferenca || 0), 0)
    const totalReal = totalEntradas + totalDiferenca

    const totalPix = caixasDiarios.reduce((sum, c) => sum + (c.total_pix || 0), 0)
    const totalDebito = caixasDiarios.reduce((sum, c) => sum + (c.total_debito || 0), 0)
    const totalCredito = caixasDiarios.reduce((sum, c) => sum + (c.total_credito || 0), 0)
    const totalDinheiro = caixasDiarios.reduce((sum, c) => sum + (c.total_dinheiro || 0), 0)
    const totalCartao = totalDebito + totalCredito

    return {
      totalEntradas,
      totalSaidas,
      totalDiferenca,
      totalReal,
      totalPix,
      totalDebito,
      totalCredito,
      totalDinheiro,
      totalCartao
    }
  }, [caixasDiarios])

  const carregarDados = async () => {
    try {
      setError(null)
      setLoading(true)
      await carregarCaixasDiarios()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log('Informação ao carregar dados de caixas:', errorMessage)
      setError('Erro ao carregar dados de caixas')
    } finally {
      setLoading(false)
    }
  }

  const carregarCaixasDiarios = async () => {
    try {
      let query = supabase!
        .from('caixa_diario')
        .select('*')
        .order('created_at', { ascending: false })

      if (dataInicio) {
        query = query.gte('data', dataInicio)
      }
      if (dataFim) {
        query = query.lte('data', dataFim)
      }

      const { data, error } = await query

      if (error) {
        const errorMessage = error.message || 'Tabela pode não existir ainda'
        console.log('Informação ao buscar caixas diários:', errorMessage)
        setCaixasDiarios([])
        return
      }
      const caixas = (data || []) as CaixaDiario[]

      try {
        // Buscar saídas vinculadas ao caixa_diario para popular `valor_saidas` quando não estiver preenchido corretamente
        let saidasQuery = supabase!.from('fluxo_caixa').select('caixa_diario_id, valor').eq('tipo', 'saida').eq('categoria', 'caixa')

        if (dataInicio) saidasQuery = saidasQuery.gte('data', dataInicio)
        if (dataFim) saidasQuery = saidasQuery.lte('data', dataFim)

        const { data: saidasData, error: saidasError } = await saidasQuery

        if (!saidasError) {
          const mapaSaidas: Record<number, number> = {}
          ;(saidasData || []).forEach((r: any) => {
            const caixaId = r.caixa_diario_id
            if (!caixaId) return
            const v = Number(r.valor) || 0
            mapaSaidas[caixaId] = (mapaSaidas[caixaId] || 0) + v
          })

          const caixasComSaidas = caixas.map(c => {
            const valorSaidasFluxo = mapaSaidas[c.id] || 0
            // Prioriza o valor do fluxo_caixa se o valor_saidas do banco estiver zerado ou menor (para garantir que sangrias apareçam)
            const valorFinal = Math.max(c.valor_saidas || 0, valorSaidasFluxo)
            return { ...c, valor_saidas: valorFinal }
          })
          setCaixasDiarios(caixasComSaidas)
        } else {
          console.warn('Erro ao buscar saídas para caixas:', saidasError)
          setCaixasDiarios(caixas)
        }
      } catch (e) {
        console.warn('Erro ao agregar saídas por ID do caixa:', e)
        setCaixasDiarios(caixas)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log('Informação ao carregar caixas diários:', errorMessage)
      setCaixasDiarios([])
    }
  }



  const dadosCSV = useMemo(() => {
    const header = ['data', 'status', 'valor_abertura', 'valor_fechamento', 'total_entradas', 'total_caderneta', 'valor_saidas', 'diferenca', 'total_pix', 'total_debito', 'total_credito', 'total_dinheiro']
    const rows = caixasDiarios.map(c => [
      c.data,
      c.status,
      (c.valor_abertura ?? 0).toFixed(2),
      (c.valor_fechamento ?? 0).toFixed(2),
      (c.total_entradas ?? 0).toFixed(2),
      (c.total_caderneta ?? 0).toFixed(2),
      (c.valor_saidas ?? 0).toFixed(2),
      (c.diferenca ?? 0).toFixed(2),
      (c.total_pix ?? 0).toFixed(2),
      (c.total_debito ?? 0).toFixed(2),
      (c.total_credito ?? 0).toFixed(2),
      (c.total_dinheiro ?? 0).toFixed(2)
    ])

    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`

    const caixasCsv = [header, ...rows].map(r => r.map(escape).join(',')).join('\n')

    return ['"CAIXAS"', caixasCsv].join('\n')
  }, [caixasDiarios])

  const baixarCSV = () => {
    const blob = new Blob([dadosCSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const inicio = dataInicio || 'inicio'
    const fim = dataFim || 'fim'
    a.download = `relatorio-caixas-${inicio}_a_${fim}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <RouteGuard>
      <ProtectedLayout>
        <div className="page-container">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Gestão - Caixas</h1>
            <p className="text-sm text-gray-600 mt-1">Histórico e controle de caixas diários</p>
          </div>

          {loading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white p-4 rounded-lg shadow">
                    <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Erro se houver */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Erro ao carregar dados</h3>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                  <button
                    onClick={carregarDados}
                    className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Total Entradas</p>
                      <p className="text-lg font-semibold text-gray-900">R$ {totais.totalEntradas.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Total Saídas</p>
                      <p className="text-lg font-semibold text-gray-900">R$ {totais.totalSaidas.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${totais.totalDiferenca >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                      <DollarSign className={`h-5 w-5 ${totais.totalDiferenca >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Total Diferença</p>
                      <p className={`text-lg font-semibold ${totais.totalDiferenca >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totais.totalDiferenca >= 0 ? '+' : '-'}R$ {Math.abs(totais.totalDiferenca).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calculator className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Total Real</p>
                      <p className="text-lg font-semibold text-gray-900">R$ {totais.totalReal.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards por Forma de Pagamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Vendas - Pix</p>
                      <p className="text-lg font-semibold text-gray-900">R$ {totais.totalPix.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Vendas - Débito</p>
                      <p className="text-lg font-semibold text-gray-900">R$ {totais.totalDebito.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <CreditCard className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Vendas - Crédito</p>
                      <p className="text-lg font-semibold text-gray-900">R$ {totais.totalCredito.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Vendas - Dinheiro</p>
                      <p className="text-lg font-semibold text-gray-900">R$ {totais.totalDinheiro.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
                <div className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-end lg:space-x-4 space-y-3 lg:space-y-0">
                    <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                        <input
                          type="date"
                          value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                        <input
                          type="date"
                          value={dataFim}
                          onChange={(e) => setDataFim(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Filtros Rápidos</label>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => aplicarFiltroRapido('ultima-semana')}
                          className={`px-3 py-2 text-sm rounded-md border ${filtroRapido === 'ultima-semana'
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          Última Semana
                        </button>
                        <button
                          onClick={() => aplicarFiltroRapido('ultimo-mes')}
                          className={`px-3 py-2 text-sm rounded-md border ${filtroRapido === 'ultimo-mes'
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          Último Mês
                        </button>
                        <button
                          onClick={() => aplicarFiltroRapido('limpar')}
                          className="px-3 py-2 text-sm rounded-md border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <div className="flex-1" />
                    <div className="flex space-x-2">
                      <button
                        onClick={carregarDados}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Aplicar Filtros
                      </button>
                      <button
                        onClick={baixarCSV}
                        className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800"
                      >
                        Exportar CSV
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                  <CaixasTab
                    caixasDiarios={caixasDiarios}
                    onCaixaReaberto={carregarDados}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </ProtectedLayout>
    </RouteGuard>
  )
}
