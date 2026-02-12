'use client'

import { useEffect, useState } from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import RouteGuard from '@/components/RouteGuard'
import { offlineStorage } from '@/lib/offlineStorage'
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  History,
  Calendar
} from 'lucide-react'
import { obterDataLocal, obterDataNDiasAtras, obterInicioMes } from '@/lib/dateUtils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts'

interface DashboardData {
  vendasHoje: {
    total: number
    count: number
  }
  vendasMes: {
    total: number
    count: number
  }
  itensVendidosHoje: number
  ticketMedioHoje: number
  vendasPorDia: { data: string, total: number }[]
  topProdutos: { nome: string, quantidade: number, total: number }[]
  vendasPorPagamento: { forma: string, total: number }[]
  vendasRecentes: {
    id: number
    numero_venda: number
    hora: string
    valor_total: number
    forma_pagamento: string
    status: string
  }[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

function formatarDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split('-')
  return `${dia}/${mes}/${ano}`
}

type FiltroPeriodo = 'hoje' | 'mes' | '7dias' | '30dias' | 'personalizado'

export default function DashboardPage() {
  const hoje = obterDataLocal()
  const inicioMes = obterInicioMes()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroPeriodo>('mes')
  const [dataInicioCustom, setDataInicioCustom] = useState(inicioMes)
  const [dataFimCustom, setDataFimCustom] = useState(hoje)

  const getDataInicioFim = (): { dataInicio: string; dataFim: string } => {
    switch (filtro) {
      case 'hoje':
        return { dataInicio: hoje, dataFim: hoje }
      case 'mes':
        return { dataInicio: inicioMes, dataFim: hoje }
      case '7dias':
        return { dataInicio: obterDataNDiasAtras(6), dataFim: hoje }
      case '30dias':
        return { dataInicio: obterDataNDiasAtras(29), dataFim: hoje }
      case 'personalizado':
        return { dataInicio: dataInicioCustom, dataFim: dataFimCustom }
      default:
        return { dataInicio: inicioMes, dataFim: hoje }
    }
  }

  const { dataInicio, dataFim } = getDataInicioFim()
  const ehHoje = filtro === 'hoje'

  useEffect(() => {
    carregarDados()
  }, [dataInicio, dataFim])

  const carregarDados = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ dataInicio, dataFim })
      const res = await fetch(`/api/dashboard?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar dados do dashboard')

      const dashboardData = await res.json()
      setData(dashboardData)
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
      // Fallback offline: agregar do cache (vendas, caixa_diario)
      try {
        const [vendasCache, itensCache] = await Promise.all([
          offlineStorage.getOfflineData('vendas'),
          offlineStorage.getOfflineData('venda_itens')
        ])

        const vendasHojeArr = (vendasCache || []).filter((v: any) => v.data >= dataInicio && v.data <= dataFim)
        const vendasMesArr = vendasHojeArr

        const vendasHojeTotal = vendasHojeArr.reduce((s: number, v: any) => s + Number(v.valor_total || 0), 0)
        const vendasHojeCount = vendasHojeArr.length
        const totalMesGestao = vendasMesArr.reduce((s: number, v: any) => s + Number(v.valor_total || 0), 0)
        const vendasMesCount = vendasMesArr.length

        const vendaIdsHoje = vendasHojeArr.map((v: any) => v.id).filter(Boolean)
        const itensVendidosHoje = (itensCache || [])
          .filter((it: any) => vendaIdsHoje.includes(it.venda_id))
          .reduce((sum: number, it: any) => sum + (Number(it.quantidade) || 0), 0)
        const ticketMedioHoje = vendasHojeCount > 0 ? vendasHojeTotal / vendasHojeCount : 0

        const vendasTrinta = (vendasCache || []).filter((v: any) => v.data >= dataInicio && v.data <= dataFim)
        const vendasPorDiaMap: Record<string, number> = {}
        const startDate = new Date(dataInicio + 'T12:00:00')
        const endDate = new Date(dataFim + 'T12:00:00')
        const current = new Date(startDate)
        let diasCount = 0
        while (current.getTime() <= endDate.getTime() && diasCount < 90) {
          const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
          vendasPorDiaMap[key] = 0
          current.setDate(current.getDate() + 1)
          diasCount++
        }
        vendasTrinta.forEach((v: any) => {
          vendasPorDiaMap[v.data] = (vendasPorDiaMap[v.data] || 0) + Number(v.valor_total || 0)
        })
        const vendasPorDia = Object.entries(vendasPorDiaMap)
          .map(([data, total]) => ({ data, total }))
          .sort((a, b) => a.data.localeCompare(b.data))

        const formatarForma = (forma: string) => {
          const nomes: Record<string, string> = { dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito', pix: 'PIX', caderneta: 'Caderneta' }
          return nomes[forma] || forma
        }
        const pagamentosAgrupados: Record<string, number> = {}
        vendasMesArr.forEach((v: any) => {
          const forma = formatarForma(v.forma_pagamento)
          pagamentosAgrupados[forma] = (pagamentosAgrupados[forma] || 0) + Number(v.valor_total || 0)
        })
        const vendasPorPagamento = Object.entries(pagamentosAgrupados)
          .map(([forma, total]) => ({ forma, total }))
          .sort((a, b) => b.total - a.total)

        const topProdutos: { nome: string; quantidade: number; total: number }[] = []
        const vendasRecentesFormatadas = vendasHojeArr
          .slice(0, 5)
          .map((v: any) => ({
            ...v,
            hora: new Date(v.created_at || v.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            forma_pagamento: formatarForma(v.forma_pagamento)
          }))

        setData({
          vendasHoje: { total: vendasHojeTotal, count: vendasHojeCount },
          vendasMes: { total: totalMesGestao, count: vendasMesCount },
          itensVendidosHoje,
          ticketMedioHoje,
          vendasPorDia,
          topProdutos,
          vendasPorPagamento,
          vendasRecentes: vendasRecentesFormatadas
        })
        setError(null)
      } catch (fallbackErr) {
        console.error('Fallback cache falhou:', fallbackErr)
        setError('Erro ao carregar dados. Verifique a conexão.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <RouteGuard>
      <ProtectedLayout>
        <div className="page-container">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard Administrativo</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {(['hoje', 'mes', '7dias', '30dias'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFiltro(f)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filtro === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                      {f === 'hoje' && 'Hoje'}
                      {f === 'mes' && 'Este mês'}
                      {f === '7dias' && '7 dias'}
                      {f === '30dias' && '30 dias'}
                    </button>
                  ))}
                </div>
                {filtro === 'personalizado' ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      value={dataInicioCustom}
                      onChange={(e) => setDataInicioCustom(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-gray-500 text-sm">até</span>
                    <input
                      type="date"
                      value={dataFimCustom}
                      onChange={(e) => setDataFimCustom(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setFiltro('personalizado')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <Calendar className="h-4 w-4" />
                    Personalizado
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white p-4 rounded-lg shadow">
                    <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Erro */}
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

              {/* Cards de Métricas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Vendas no período */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{ehHoje ? 'Vendas Hoje' : 'Vendas no período'}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        R$ {data?.vendasHoje.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center mt-1 text-xs text-green-600 font-medium">
                        <ArrowUpRight className="h-3 w-3 mr-0.5" />
                        <span>{data?.vendasHoje.count || 0} vendas realizadas</span>
                      </div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-xl">
                      <ShoppingCart className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </div>

                {/* Total ou média diária */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{ehHoje ? 'Vendas' : 'Média diária'}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        R$ {(() => {
                          const total = data?.vendasMes?.total ?? 0
                          if (ehHoje) return total
                          const dias = Math.ceil((new Date(dataFim + 'T12:00:00').getTime() - new Date(dataInicio + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1
                          return total / Math.max(1, dias)
                        })().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center mt-1 text-xs text-blue-600 font-medium">
                        <TrendingUp className="h-3 w-3 mr-0.5" />
                        <span>{data?.vendasMes.count || 0} vendas</span>
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                {/* Ticket Médio */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Ticket Médio</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        R$ {data?.ticketMedioHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Por transação no período</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-xl">
                      <DollarSign className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </div>

                {/* Itens Vendidos */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Itens Vendidos</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {(data?.itensVendidosHoje ?? 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2
                        })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Unidades totais</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-xl">
                      <Package className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráficos Principais */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Vendas por Dia */}
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Vendas por dia</h3>
                    <TrendingUp className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data?.vendasPorDia}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="data"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(val) => {
                            const s = String(val)
                            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                              const [, mes, dia] = s.split('-')
                              return `${dia}/${mes}`
                            }
                            return s
                          }}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Vendas']}
                          labelFormatter={(label) => {
                            const s = String(label)
                            return /^\d{4}-\d{2}-\d{2}$/.test(s) ? formatarDataBR(s) : s
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Formas de Pagamento */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Formas de Pagamento</h3>
                    <PieChartIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data?.vendasPorPagamento}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="total"
                          nameKey="forma"
                        >
                          {data?.vendasPorPagamento.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {data?.vendasPorPagamento.map((item, index) => (
                      <div key={item.forma} className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span className="text-gray-600">{item.forma}</span>
                        </div>
                        <span className="font-medium text-gray-900">
                          R$ {item.total.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Terceira Linha: Top Produtos e Vendas Recentes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Produtos */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Top 5 Produtos</h3>
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="space-y-4">
                    {data?.topProdutos?.length ? (
                      data.topProdutos.map((produto, index) => (
                        <div key={produto.nome} className="flex items-center justify-between">
                          <div className="flex items-center flex-1">
                            <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-bold text-gray-500 mr-3">
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{produto.nome}</p>
                              <p className="text-xs text-gray-500">{produto.quantidade} unidades vendidas</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">R$ {produto.total.toFixed(2)}</p>
                            <div className="w-24 bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
                              <div
                                className="bg-blue-500 h-full rounded-full"
                                style={{ width: `${(produto.total / (data.topProdutos[0].total || 1)) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 py-4 text-center">Nenhum produto vendido no período.</p>
                    )}
                  </div>
                </div>

                {/* Vendas Recentes */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Últimas Vendas</h3>
                    <History className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                        <tr>
                          <th className="px-3 py-2">Venda</th>
                          <th className="px-3 py-2">Hora</th>
                          <th className="px-3 py-2">Pagamento</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data?.vendasRecentes.map((venda) => (
                          <tr key={venda.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-3 font-medium text-blue-600">#{venda.numero_venda}</td>
                            <td className="px-3 py-3 text-gray-600">{venda.hora.substring(0, 5)}</td>
                            <td className="px-3 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase">
                                {venda.forma_pagamento}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-gray-900">
                              R$ {venda.valor_total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4">
                    <a href="/gestao/vendas" className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center">
                      Ver todas as vendas
                      <ArrowUpRight className="h-4 w-4 ml-1" />
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </ProtectedLayout>
    </RouteGuard>
  )
}
