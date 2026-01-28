'use client'
/* cspell:disable */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import ProtectedLayout from '@/components/ProtectedLayout'
import { TrendingUp, DollarSign, Calculator, AlertTriangle, CheckCircle } from 'lucide-react'
import { obterInicioMes } from '@/lib/dateUtils'
import { fetchItensPorVendaIds, fetchVendasPorPeriodo } from '@/repositories/vendas.repository'

import { processarLucratividadePorProduto } from '@/services/lucratividadeService'

// Tipos para o módulo de lucratividade
interface CustoFixo {
  id: number
  nome: string
  categoria: 'aluguel' | 'energia' | 'agua' | 'telefone' | 'salarios' | 'impostos' | 'outros'
  valor_mensal: number
  data_vencimento: number
  ativo: boolean
  observacoes?: string
  created_at: string
  updated_at: string
}

interface ItemLucratividade {
  item: string
  tipo: 'receita' | 'varejo'
  quantidadeVendida: number
  precoVenda: number
  custoUnitario: number
  receitaTotal: number
  custoTotal: number
  lucroBruto: number
  margemLucro: number
}

interface ResumoLucratividade {
  receitaTotal: number
  custoTotalProdutos: number
  lucroBrutoTotal: number
  custosFixosTotal: number
  lucroLiquido: number
  margemLucroBruta: number
  margemLucroLiquida: number
  roi: number
}

interface VendaRegistro {
  id?: string | number
  data?: string
  forma_pagamento?: string | null
  valor_pago?: number | null
  valor_debito?: number | null
  observacoes?: string | null
  [key: string]: unknown
}

export default function LucratividadePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'semestre' | 'ano'>('mes')

  // Estados para custos fixos
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([])
  const [showCustoModal, setShowCustoModal] = useState(false)
  const [editingCusto, setEditingCusto] = useState<CustoFixo | null>(null)
  const [formCusto, setFormCusto] = useState({
    nome: '',
    valor_mensal: '',
    categoria: 'outros' as CustoFixo['categoria'],
    data_vencimento: '1',
    observacoes: ''
  })

  // Estados para análise de lucratividade
  const [itensLucratividade, setItensLucratividade] = useState<ItemLucratividade[]>([])

  // Estados para controle de vendas
  const [vendasReais, setVendasReais] = useState<VendaRegistro[]>([])
  const [todasVendas, setTodasVendas] = useState<VendaRegistro[]>([])
  const [resumoLucratividade, setResumoLucratividade] = useState<ResumoLucratividade>({
    receitaTotal: 0,
    custoTotalProdutos: 0,
    lucroBrutoTotal: 0,
    custosFixosTotal: 0,
    lucroLiquido: 0,
    margemLucroBruta: 0,
    margemLucroLiquida: 0,
    roi: 0
  })

  useEffect(() => {
    carregarDados()
  }, [periodo])

  const carregarDados = async () => {
    try {
      setError(null)
      setLoading(true)
      await carregarCustosFixos()
      await carregarAnaliseLucratividade()
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      setError('Erro ao carregar dados de lucratividade')
    } finally {
      setLoading(false)
    }
  }

  const carregarCustosFixos = async () => {
    try {
      const { data, error } = await supabase!
        .from('custos_fixos')
        .select('*')
        .eq('ativo', true)
        .order('nome')

      if (error) {
        setCustosFixos([])
        return
      }
      setCustosFixos(data || [])
    } catch (error) {
      setCustosFixos([])
    }
  }

  const carregarAnaliseLucratividade = async () => {
    try {
      const dataInicio = obterDataInicioPeriodo(periodo)
      const dataFim = obterDataFimPeriodo(periodo)

      const vendasCarregadas = await fetchVendasPorPeriodo({ dataInicio, dataFim })
      
      const todasVendasConvertidas: VendaRegistro[] = vendasCarregadas.map((venda) => ({
        id: venda.id,
        data: venda.data ?? venda.created_at,
        forma_pagamento: venda.forma_pagamento,
        valor_pago: venda.valor_pago,
        valor_debito: venda.valor_debito,
        observacoes: venda.observacoes,
        valor_total: venda.valor_total,
        created_at: venda.created_at
      }))

      setTodasVendas(todasVendasConvertidas)

      // Filtrar vendas reais (excluir pagamentos de caderneta)
      const vendasFiltradas = todasVendasConvertidas.filter(venda => {
        const formaPagamento = typeof venda.forma_pagamento === 'string' ? venda.forma_pagamento : ''
        const observacoes = typeof venda.observacoes === 'string' ? venda.observacoes : ''
        if (formaPagamento === 'caderneta' && (observacoes.includes('Pagamento registrado') || observacoes.includes('caderneta'))) {
          return false
        }
        return true
      })

      setVendasReais(vendasFiltradas)

      const vendaIdsNumericos = vendasFiltradas
        .map(venda => venda.id)
        .filter((id): id is number => typeof id === 'number')

      if (vendaIdsNumericos.length === 0) {
        resetResumo()
        return
      }

      // 1. Carregar todos os dados necessários para o processamento
      const [
        { data: todosItensVenda },
        { data: insumosData },
        { data: receitasData },
        { data: composicaoData },
        { data: precosVendaData },
        { data: varejoData }
      ] = await Promise.all([
        supabase!.from('venda_itens').select('*').in('venda_id', vendaIdsNumericos),
        supabase!.from('insumos').select('*'),
        supabase!.from('receitas').select('*').eq('ativo', true),
        supabase!.from('composicao_receitas').select('*'),
        supabase!.from('precos_venda').select('*').eq('ativo', true),
        supabase!.from('varejo').select('*').eq('ativo', true)
      ])

      const custosFixosTotal = custosFixos.reduce((sum, custo) => sum + (custo.valor_mensal || 0), 0)

      // 2. Usar o novo serviço de lucratividade
      const { itens, resumo } = processarLucratividadePorProduto({
        vendas: vendasFiltradas,
        itensVenda: todosItensVenda || [],
        insumos: insumosData || [],
        receitas: receitasData || [],
        composicoes: composicaoData || [],
        precosVenda: precosVendaData || [],
        varejo: varejoData || [],
        custosFixosTotal
      })

      setItensLucratividade(itens)
      setResumoLucratividade(resumo)

    } catch (error) {
      console.error('Erro ao carregar análise de lucratividade:', error)
      setError('Falha ao processar análise de lucratividade')
    }
  }

  const resetResumo = () => {
    setItensLucratividade([])
    setResumoLucratividade({
      receitaTotal: 0,
      custoTotalProdutos: 0,
      lucroBrutoTotal: 0,
      custosFixosTotal: 0,
      lucroLiquido: 0,
      margemLucroBruta: 0,
      margemLucroLiquida: 0,
      roi: 0
    })
  }

  const obterDataInicioPeriodo = (periodo: string): string => {
    const hoje = new Date()
    let dataInicio: Date
    switch (periodo) {
      case 'mes':
        return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
      case 'trimestre':
        const trimestre = Math.floor(hoje.getMonth() / 3)
        dataInicio = new Date(hoje.getFullYear(), trimestre * 3, 1)
        break
      case 'semestre':
        const semestre = Math.floor(hoje.getMonth() / 6)
        dataInicio = new Date(hoje.getFullYear(), semestre * 6, 1)
        break
      case 'ano':
        dataInicio = new Date(hoje.getFullYear(), 0, 1)
        break
      default:
        return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    }
    return dataInicio.toISOString().split('T')[0]
  }

  const obterDataFimPeriodo = (periodo: string): string => {
    const hoje = new Date()
    return hoje.toISOString().split('T')[0]
  }

  const obterDescricaoPeriodo = (periodo: string): string => {
    const hoje = new Date()
    const dataInicio = obterDataInicioPeriodo(periodo)
    const dataFim = obterDataFimPeriodo(periodo)
    switch (periodo) {
      case 'mes':
        const mesAtual = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        return `${mesAtual} (${dataInicio} até ${dataFim})`
      case 'trimestre':
        const trimestre = Math.floor(hoje.getMonth() / 3) + 1
        return `${trimestre}º Trimestre de ${hoje.getFullYear()} (${dataInicio} até ${dataFim})`
      case 'semestre':
        const semestre = Math.floor(hoje.getMonth() / 6) + 1
        return `${semestre}º Semestre de ${hoje.getFullYear()} (${dataInicio} até ${dataFim})`
      case 'ano':
        return `Ano ${hoje.getFullYear()} (${dataInicio} até ${dataFim})`
      default:
        return `Período personalizado (${dataInicio} até ${dataFim})`
    }
  }

  const handleSubmitCusto = async () => {
    try {
      if (!formCusto.nome || !formCusto.valor_mensal || !formCusto.data_vencimento) {
        alert('Por favor, preencha todos os campos obrigatórios.')
        return
      }
      const valor = parseFloat(formCusto.valor_mensal)
      const diaVencimento = parseInt(formCusto.data_vencimento)
      if (valor <= 0 || isNaN(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
        alert('Dados inválidos.')
        return
      }
      const dadosCusto = {
        nome: formCusto.nome,
        valor_mensal: valor,
        categoria: formCusto.categoria,
        data_vencimento: diaVencimento,
        observacoes: formCusto.observacoes || null,
        ativo: true
      }
      if (editingCusto) {
        const { error } = await supabase!.from('custos_fixos').update(dadosCusto).eq('id', editingCusto.id)
        if (error) throw error
      } else {
        const { error } = await supabase!.from('custos_fixos').insert(dadosCusto)
        if (error) throw error
      }
      setShowCustoModal(false)
      setFormCusto({ nome: '', valor_mensal: '', categoria: 'outros', data_vencimento: '1', observacoes: '' })
      setEditingCusto(null)
      await carregarCustosFixos()
    } catch (error) {
      alert('Erro ao salvar custo fixo.')
    }
  }

  const handleDeleteCusto = async (id: number) => {
    if (!confirm('Tem certeza?')) return
    try {
      const { error } = await supabase!.from('custos_fixos').delete().eq('id', id)
      if (error) throw error
      await carregarCustosFixos()
    } catch (error) {
      alert('Erro ao excluir.')
    }
  }

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  }

  const formatarPercentual = (valor: number) => `${valor.toFixed(1)}%`

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      aluguel: 'Aluguel', energia: 'Energia', agua: 'Água', telefone: 'Telefone/Internet', salarios: 'Salários', impostos: 'Impostos', outros: 'Outros'
    }
    return labels[categoria] || categoria
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="page-container">
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
        </div>
      </ProtectedLayout>
    )
  }

  return (
    <ProtectedLayout>
      <div className="page-container">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Análise de Lucratividade</h1>
          <p className="text-sm text-gray-600 mt-1">Controle de custos fixos e análise de margens de lucro</p>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Período de Análise</h3>
                <p className="text-sm text-blue-700 mt-1">{obterDescricaoPeriodo(periodo)}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={carregarDados} className="mt-3 text-sm text-red-600 underline">Tentar novamente</button>
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Período:</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
            >
              <option value="mes">Mês Atual</option>
              <option value="trimestre">Trimestre Atual</option>
              <option value="semestre">Semestre Atual</option>
              <option value="ano">Ano Atual</option>
            </select>
          </div>
        </div>

        {vendasReais.length < todasVendas.length && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-700">
              <strong>{todasVendas.length - vendasReais.length} pagamentos de caderneta</strong> foram excluídos.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600">Receita Total</p>
            <p className="text-2xl font-bold text-gray-900">{formatarMoeda(resumoLucratividade.receitaTotal)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600">Lucro Bruto</p>
            <p className="text-2xl font-bold text-gray-900">{formatarMoeda(resumoLucratividade.lucroBrutoTotal)}</p>
            <p className="text-xs text-gray-500">{formatarPercentual(resumoLucratividade.margemLucroBruta)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600">Lucro Líquido</p>
            <p className={`text-2xl font-bold ${resumoLucratividade.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatarMoeda(resumoLucratividade.lucroLiquido)}
            </p>
            <p className="text-xs text-gray-500">{formatarPercentual(resumoLucratividade.margemLucroLiquida)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-600">ROI</p>
            <p className={`text-2xl font-bold ${resumoLucratividade.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatarPercentual(resumoLucratividade.roi)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Custos Fixos</h2>
              <button onClick={() => setShowCustoModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm">Adicionar</button>
            </div>
            <div className="p-6 space-y-3">
              {custosFixos.map(custo => (
                <div key={custo.id} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{custo.nome}</p>
                    <p className="text-xs text-gray-500">{getCategoriaLabel(custo.categoria)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{formatarMoeda(custo.valor_mensal)}</span>
                    <button onClick={() => handleDeleteCusto(custo.id)} className="text-red-600 text-xs">Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Resumo Detalhado</h2>
            <div className="space-y-4">
              <div className="flex justify-between"><span>Receita:</span><span>{formatarMoeda(resumoLucratividade.receitaTotal)}</span></div>
              <div className="flex justify-between"><span>Custos Variáveis:</span><span className="text-red-600">-{formatarMoeda(resumoLucratividade.custoTotalProdutos)}</span></div>
              <div className="flex justify-between border-t pt-2"><span>Lucro Bruto:</span><span className="font-bold text-green-600">{formatarMoeda(resumoLucratividade.lucroBrutoTotal)}</span></div>
              <div className="flex justify-between"><span>Custos Fixos:</span><span className="text-red-600">-{formatarMoeda(resumoLucratividade.custosFixosTotal)}</span></div>
              <div className="flex justify-between border-t pt-2"><span>Lucro Líquido:</span><span className={`font-bold ${resumoLucratividade.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatarMoeda(resumoLucratividade.lucroLiquido)}</span></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Análise por Produto (Mais Vendidos 🔥)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qtd</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receita</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Custo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lucro</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margem</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {itensLucratividade.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.quantidadeVendida}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatarMoeda(item.receitaTotal)}</td>
                    <td className="px-6 py-4 text-sm text-red-600">{formatarMoeda(item.custoTotal)}</td>
                    <td className="px-6 py-4 text-sm text-green-600">{formatarMoeda(item.lucroBruto)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 text-xs rounded-full ${item.margemLucro >= 30 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {formatarPercentual(item.margemLucro)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showCustoModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">{editingCusto ? 'Editar' : 'Adicionar'} Custo Fixo</h3>
              <div className="space-y-4">
                <input type="text" value={formCusto.nome} onChange={(e) => setFormCusto({ ...formCusto, nome: e.target.value })} className="w-full border p-2 rounded" placeholder="Nome" />
                <input type="number" value={formCusto.valor_mensal} onChange={(e) => setFormCusto({ ...formCusto, valor_mensal: e.target.value })} className="w-full border p-2 rounded" placeholder="Valor" />
                <input type="number" value={formCusto.data_vencimento} onChange={(e) => setFormCusto({ ...formCusto, data_vencimento: e.target.value })} className="w-full border p-2 rounded" placeholder="Dia Vencimento" />
                <select value={formCusto.categoria} onChange={(e) => setFormCusto({ ...formCusto, categoria: e.target.value as any })} className="w-full border p-2 rounded">
                  <option value="aluguel">Aluguel</option>
                  <option value="energia">Energia</option>
                  <option value="agua">Água</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={() => setShowCustoModal(false)} className="px-4 py-2 bg-gray-100 rounded">Cancelar</button>
                <button onClick={handleSubmitCusto} className="px-4 py-2 bg-blue-600 text-white rounded">Salvar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  )
}
