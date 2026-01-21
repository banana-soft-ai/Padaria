'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import { supabase } from '@/lib/supabase/client'
import { FluxoCaixa } from '@/lib/supabase'
import { TrendingDown, Filter } from 'lucide-react'

export default function GestaoSaidasPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saidas, setSaidas] = useState<FluxoCaixa[]>([])

  // Filtros
  const [descricaoFiltro, setDescricaoFiltro] = useState('')
  const [dataInicio, setDataInicio] = useState<string>('')
  const [dataFim, setDataFim] = useState<string>('')

  // Totais
  const [totalDia, setTotalDia] = useState(0)
  const [totalSemana, setTotalSemana] = useState(0)
  const [totalMes, setTotalMes] = useState(0)

  useEffect(() => {
    carregarSaidas()
  }, [descricaoFiltro, dataInicio, dataFim])

  useEffect(() => {
    carregarTotais()
  }, [])



  const getTodayInSaoPaulo = (): Date => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  }

  const formatDate = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const startOfWeek = (d: Date): Date => {
    const date = new Date(d)
    // Considerar semana começando na segunda-feira
    const day = date.getDay() // 0 domingo, 1 segunda, ...
    const diff = (day === 0 ? -6 : 1) - day
    date.setDate(date.getDate() + diff)
    date.setHours(0, 0, 0, 0)
    return date
  }

  const startOfMonth = (d: Date): Date => {
    return new Date(d.getFullYear(), d.getMonth(), 1)
  }

  const carregarTotais = async () => {
    try {
      if (!supabase) {
        setTotalDia(0)
        setTotalSemana(0)
        setTotalMes(0)
        return
      }
      const hoje = getTodayInSaoPaulo()
      const hojeStr = formatDate(hoje)
      const semanaInicioStr = formatDate(startOfWeek(hoje))
      const mesInicioStr = formatDate(startOfMonth(hoje))

      // Totais do dia (apenas categoria 'caixa')
      const { data: diaData } = await supabase!
        .from('fluxo_caixa')
        .select('valor')
        .eq('tipo', 'saida')
        .eq('categoria', 'caixa')
        .eq('data', hojeStr)
      const somaDia = (diaData || []).reduce((s, r: { valor: number }) => s + (Number(r.valor) || 0), 0)

      // Totais da semana (>= segunda, <= hoje)
      const { data: semanaData } = await supabase!
        .from('fluxo_caixa')
        .select('valor')
        .eq('tipo', 'saida')
        .eq('categoria', 'caixa')
        .gte('data', semanaInicioStr)
        .lte('data', hojeStr)
      const somaSemana = (semanaData || []).reduce((s, r: { valor: number }) => s + (Number(r.valor) || 0), 0)

      // Totais do mês (>= primeiro dia do mês, <= hoje)
      const { data: mesData } = await supabase!
        .from('fluxo_caixa')
        .select('valor')
        .eq('tipo', 'saida')
        .eq('categoria', 'caixa')
        .gte('data', mesInicioStr)
        .lte('data', hojeStr)
      const somaMes = (mesData || []).reduce((s, r: { valor: number }) => s + (Number(r.valor) || 0), 0)

      setTotalDia(somaDia)
      setTotalSemana(somaSemana)
      setTotalMes(somaMes)
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido'
      console.log('Informação ao carregar totais de saídas:', errorMessage)
      // Manter valores zerados em caso de erro
      setTotalDia(0)
      setTotalSemana(0)
      setTotalMes(0)
    }
  }

  const carregarSaidas = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!supabase) {
        setSaidas([])
        setLoading(false)
        return
      }

      let query = supabase!
        .from('fluxo_caixa')
        .select('*')
        .eq('tipo', 'saida')
        .eq('categoria', 'caixa')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })

      if (descricaoFiltro.trim()) {
        // Filtrar por descrição (case-insensitive)
        query = query.ilike('descricao', `%${descricaoFiltro.trim()}%`)
      }

      if (dataInicio) {
        query = query.gte('data', dataInicio)
      }
      if (dataFim) {
        query = query.lte('data', dataFim)
      }

      const { data, error } = await query
      console.log('Consulta de saídas (gestao/saidas):', { filtro: { descricaoFiltro, dataInicio, dataFim }, resultado: data, erro: error })
      if (error) {
        console.log('Erro ao buscar saídas:', error.message || 'Tabela pode não existir ainda')
        setSaidas([])
        return
      }
      setSaidas((data as FluxoCaixa[]) || [])
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido'
      console.log('Informação ao carregar saídas:', errorMessage)
      setSaidas([])
    } finally {
      setLoading(false)
    }
  }

  // Refs para manter as versões mais recentes das funções sem re-subscrever o canal
  // Inicializar como null e atribuir após declaração das funções
  const carregarSaidasRef = useRef<any>(null)
  const carregarTotaisRef = useRef<any>(null)

  useEffect(() => {
    carregarSaidasRef.current = carregarSaidas
  }, [carregarSaidas])

  useEffect(() => {
    carregarTotaisRef.current = carregarTotais
  }, [carregarTotais])

  // Subscrição em tempo real para atualizar a lista quando houver inserções/alterações em fluxo_caixa
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('realtime:fluxo_caixa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fluxo_caixa' }, (payload: any) => {
        try {
          const novo = payload.new
          const velho = payload.old
          const changedToSaida = (novo && novo.tipo === 'saida') || (velho && velho.tipo === 'saida')
          if (changedToSaida) {
            // Atualiza lista e totais
            carregarSaidasRef.current?.().catch(() => { })
            carregarTotaisRef.current?.().catch(() => { })
          }
        } catch (e) {
          console.warn('Erro no handler realtime fluxo_caixa:', e)
        }
      })
      .subscribe()

    return () => {
      try {
        channel.unsubscribe()
      } catch (e) {
        // Ignorar falhas no cleanup
      }
    }
  }, [])

  const formatarMoeda = (valor: number | undefined) => {
    if (!valor) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  }

    const formatarDataBR = (dateStr: string) => {
      if (!dateStr) return '—'
      // Se for 'YYYY-MM-DD', criar data como local para evitar shift de UTC
      const isoDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      if (isoDateMatch) {
        const [y, m, d] = dateStr.split('-').map(Number)
        const local = new Date(y, m - 1, d)
        return local.toLocaleDateString('pt-BR')
      }
      const parsed = new Date(dateStr)
      return parsed.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    }

  // Nota: a listagem será exibida em tabela com as colunas: Data, Operador, Valor, Observações.
  // Não é mais necessário agrupar por descrição para esta visão.


  return (
    <ProtectedLayout>
      <div className="page-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-full mr-3">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Saídas</h1>
              <p className="text-lg text-gray-600 mt-1">Listagem e filtros de saídas do caixa</p>
            </div>
          </div>
        </div>

        {/* Totais (Dia / Semana / Mês) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-medium text-yellow-900">Total do Dia</p>
            <p className="text-2xl font-bold text-yellow-800">{formatarMoeda(totalDia)}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-medium text-yellow-900">Total da Semana</p>
            <p className="text-2xl font-bold text-yellow-800">{formatarMoeda(totalSemana)}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-medium text-yellow-900">Total do Mês</p>
            <p className="text-2xl font-bold text-yellow-800">{formatarMoeda(totalMes)}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="h-4 w-4 text-gray-600 mr-2" />
            <h3 className="text-md font-semibold text-gray-900">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <input
                type="text"
                placeholder="Ex: Azevedo"
                value={descricaoFiltro}
                onChange={(e) => setDescricaoFiltro(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Lista Agrupada por Descrição */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          {loading ? (
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : saidas.length === 0 ? (
            <div className="text-center py-10">
              <TrendingDown className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Nenhuma saída encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Operador</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Observações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {saidas.map((item) => (
                    <tr key={item.id} className="bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatarDataBR(item.data)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{(item.usuario as string) || item.descricao || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">{formatarMoeda(item.valor)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{(item.observacoes as string) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  )
}


