'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import ProtectedLayout from '@/components/ProtectedLayout'
import { offlineStorage } from '@/lib/offlineStorage'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import RouteGuard from '@/components/RouteGuard'
import VendasTab from '@/components/gestao/VendasTab'
import { RelatorioVendas, RankingVendas } from '@/types/gestao'
import { obterDataLocal, obterInicioMes, obterDataNDiasAtras } from '@/lib/dateUtils'

type FiltroPeriodo = 'hoje' | 'mes' | '7dias' | '30dias' | 'personalizado'

export default function VendasPage() {
  const hoje = obterDataLocal()
  const inicioMes = obterInicioMes()
  const { isOnline } = useOnlineStatus()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroPeriodo>('mes')
  const [dataInicioCustom, setDataInicioCustom] = useState(inicioMes)
  const [dataFimCustom, setDataFimCustom] = useState(hoje)
  const [relatorioVendas, setRelatorioVendas] = useState<RelatorioVendas[]>([])
  const [rankingVendas, setRankingVendas] = useState<RankingVendas[]>([])
  const [metricasResumo, setMetricasResumo] = useState({
    unidadesVendidas: 0,
    receitaTotal: 0,
    ticketMedio: 0,
    totalPix: 0,
    totalDinheiro: 0,
    totalDebito: 0,
    totalCredito: 0,
    totalCaderneta: 0,
    valorReceber: 0
  })

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

  useEffect(() => {
    carregarDados()
  }, [dataInicio, dataFim])

  const carregarDados = async () => {
    try {
      setError(null)
      setLoading(true)

      if (isOnline) {
        await Promise.all([
          carregarRelatorioVendas(),
          carregarRankingVendas(),
          carregarMetricasResumo()
        ])
      } else {
        // Offline: carregar do cache
        const [vendasCache, itensCache, varejoCache] = await Promise.all([
          offlineStorage.getOfflineData('vendas'),
          offlineStorage.getOfflineData('venda_itens'),
          offlineStorage.getOfflineData('varejo')
        ])
        const vendas = (vendasCache || []).filter((v: any) => v.data >= dataInicio && v.data <= dataFim && (v.status === 'finalizada' || !v.status))
        const vendaIds = vendas.map((v: any) => v.id).filter(Boolean)
        const itens = (itensCache || []).filter((it: any) => vendaIds.includes(it.venda_id))
        const varejoMap = new Map((varejoCache || []).map((p: any) => [p.id, p.nome]))

        const vendasPorProdutoPreco = new Map<string, RelatorioVendas>()
        itens.forEach((item: any) => {
          const nomeProduto = varejoMap.get(item.varejo_id) || 'Produto'
          const precoUnitario = item.preco_unitario || 0
          const quantidade = item.quantidade || 0
          const faturamento = precoUnitario * quantidade
          const itemKey = `${item.varejo_id}_${precoUnitario}`
          if (!vendasPorProdutoPreco.has(itemKey)) {
            vendasPorProdutoPreco.set(itemKey, {
              item: nomeProduto,
              tipo: 'varejo',
              quantidadeTotal: quantidade,
              receitaTotal: faturamento,
              mediaVendas: precoUnitario,
              vendasPorDia: {}
            })
          } else {
            const existing = vendasPorProdutoPreco.get(itemKey)!
            existing.quantidadeTotal += quantidade
            existing.receitaTotal += faturamento
          }
        })
        setRelatorioVendas(Array.from(vendasPorProdutoPreco.values()))

        const unidadesVendidas = Math.round(itens.reduce((s: number, it: any) => s + (Number(it.quantidade) || 0), 0) * 100) / 100
        const receitaTotal = vendas.reduce((s: number, v: any) => s + (Number(v.valor_total) || 0), 0)
        const ticketMedio = vendas.length > 0 ? receitaTotal / vendas.length : 0
        const totalPix = vendas.filter((v: any) => v.forma_pagamento === 'pix').reduce((s: number, v: any) => s + (Number(v.valor_total) || 0), 0)
        const totalDinheiro = vendas.filter((v: any) => v.forma_pagamento === 'dinheiro').reduce((s: number, v: any) => s + (Number(v.valor_total) || 0), 0)
        const totalDebito = vendas.filter((v: any) => v.forma_pagamento === 'cartao_debito').reduce((s: number, v: any) => s + (Number(v.valor_total) || 0), 0)
        const totalCredito = vendas.filter((v: any) => v.forma_pagamento === 'cartao_credito').reduce((s: number, v: any) => s + (Number(v.valor_total) || 0), 0)
        const totalCaderneta = vendas.filter((v: any) => v.forma_pagamento === 'caderneta').reduce((s: number, v: any) => s + (Number(v.valor_total) || 0), 0)
        const valorReceber = vendas.reduce((s: number, v: any) => s + (Number(v.valor_debito) || 0), 0)

        setMetricasResumo({
          unidadesVendidas,
          receitaTotal,
          ticketMedio,
          totalPix,
          totalDinheiro,
          totalDebito,
          totalCredito,
          totalCaderneta,
          valorReceber
        })
        setRankingVendas([])
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      setError('Erro ao carregar dados de vendas')
    } finally {
      setLoading(false)
    }
  }

  const carregarRelatorioVendas = async () => {
    try {
      const { data: vendas, error: vendasError } = await supabase!
        .from('vendas')
        .select('id, created_at, valor_total, valor_pago, valor_debito, forma_pagamento, data')
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .order('created_at', { ascending: false })

      if (vendasError) {
        setRelatorioVendas([])
        return
      }

      if (!vendas || vendas.length === 0) {
        setRelatorioVendas([])
        return
      }

      // Buscar itens das vendas
      const vendaIds = vendas.map(v => v.id)
      const { data: itensData, error: itensError } = await supabase!
        .from('venda_itens')
        .select('id, venda_id, varejo_id, quantidade, preco_unitario')
        .in('venda_id', vendaIds)

      if (itensError || !itensData || itensData.length === 0) {
        setRelatorioVendas([])
        return
      }

      // Buscar nomes dos produtos de varejo
      const varejoIds = [...new Set(itensData.map(item => item.varejo_id).filter(Boolean))]
      let produtosVarejo: { id: number; nome: string }[] = []
      if (varejoIds.length > 0) {
        const { data: produtosData } = await supabase!
          .from('varejo')
          .select('id, nome')
          .in('id', varejoIds)
        produtosVarejo = produtosData || []
      }
      const produtosVarejoMap = new Map(produtosVarejo.map(p => [p.id, p.nome]))

      // Agrupar por produto+preço unitário
      const vendasPorProdutoPreco = new Map<string, RelatorioVendas>()
      itensData.forEach(item => {
        const nomeProduto = produtosVarejoMap.get(item.varejo_id) || 'Produto null'
        const precoUnitario = item.preco_unitario || 0
        const quantidade = item.quantidade || 0
        const faturamento = precoUnitario * quantidade
        // Chave composta: produto + preço
        const itemKey = `${item.varejo_id}_${precoUnitario}`
        if (!vendasPorProdutoPreco.has(itemKey)) {
          vendasPorProdutoPreco.set(itemKey, {
            item: nomeProduto,
            tipo: 'varejo',
            quantidadeTotal: quantidade,
            receitaTotal: faturamento,
            mediaVendas: precoUnitario,
            vendasPorDia: {}
          })
        } else {
          const existing = vendasPorProdutoPreco.get(itemKey)!
          existing.quantidadeTotal += quantidade
          existing.receitaTotal += faturamento
        }
      })

      setRelatorioVendas(Array.from(vendasPorProdutoPreco.values()))
    } catch (error) {
      console.error('Erro ao carregar relatório de vendas:', error)
      setRelatorioVendas([])
    }
  }

  const carregarRankingVendas = async () => {
    try {
      const { data: vendasPeriodo } = await supabase!
        .from('vendas')
        .select('id')
        .gte('data', dataInicio)
        .lte('data', dataFim)
      const vendaIds = (vendasPeriodo || []).map(v => v.id)
      if (vendaIds.length === 0) {
        setRankingVendas([])
        return
      }
      const { data, error } = await supabase!
        .from('venda_itens')
        .select('*')
        .in('venda_id', vendaIds)

      if (error) {
        console.error('Erro ao carregar itens de venda:', error.message || error)
        setRankingVendas([])
        return
      }

      // Carregar nomes dos produtos separadamente
      if (data && data.length > 0) {
        const receitaIds = data.filter(item => item.produto_id).map(item => item.produto_id)
        const varejoIds = data.filter(item => item.varejo_id).map(item => item.varejo_id)

        let receitas: { id: number; nome: string }[] = []
        let insumos: { id: number; nome: string }[] = []

        if (receitaIds.length > 0) {
          const { data: receitasData } = await supabase!
            .from('receitas')
            .select('id, nome')
            .eq('ativo', true)
            .in('id', receitaIds)
          receitas = receitasData || []
        }

        if (varejoIds.length > 0) {
          const { data: insumosData } = await supabase!
            .from('insumos')
            .select('id, nome')
            .in('id', varejoIds)
          insumos = insumosData || []
        }

        // Criar mapas para busca rápida
        const receitasMap = new Map(receitas.map(r => [r.id, r.nome]))
        const insumosMap = new Map(insumos.map(i => [i.id, i.nome]))

        // Adicionar nomes aos itens
        data.forEach(item => {
          if (item.produto_id) {
            item.nome_produto = receitasMap.get(item.produto_id) || `Receita ${item.produto_id}`
          } else {
            item.nome_produto = insumosMap.get(item.varejo_id) || `Produto ${item.varejo_id}`
          }
        })
      }

      // Processar dados para ranking
      const ranking: RankingVendas[] = []

      if (data && data.length > 0) {
        // Agrupar itens por produto
        const itensPorTipo = new Map<string, RankingVendas>()

        // Agrupar itens por venda para calcular proporções
        const itensPorVenda = new Map<number, Record<string, unknown>[]>()
        data.forEach((item: Record<string, unknown>) => {
          const vendaId = item.venda_id as number
          if (!itensPorVenda.has(vendaId)) {
            itensPorVenda.set(vendaId, [])
          }
          itensPorVenda.get(vendaId)!.push(item)
        })

        // Buscar dados das vendas para calcular valores reais
        const vendaIds = Array.from(itensPorVenda.keys())
        const { data: vendasData } = await supabase!
          .from('vendas')
          .select('id, valor_pago, valor_debito, forma_pagamento')
          .in('id', vendaIds)

        const vendasMap = new Map(vendasData?.map(v => [v.id, v]) || [])

        data.forEach((item: Record<string, unknown>) => {
          const itemKey = `${item.produto_id ? 'receita' : 'varejo'}_${item.produto_id || item.varejo_id}`
          const vendaId = item.venda_id as number
          const venda = vendasMap.get(vendaId)

          if (!venda) return

          // Calcular proporção do valor da venda para este item
          const valorTotalVenda = venda.forma_pagamento === 'caderneta' ? (venda.valor_debito as number || 0) : (venda.valor_pago as number || 0)
          const itensVenda = itensPorVenda.get(vendaId) || []
          const valorTotalItens = itensVenda.reduce((sum: number, i: Record<string, unknown>) => sum + ((i.preco_unitario as number || 0) * (i.quantidade as number || 0)), 0)
          const proporcao = valorTotalItens > 0 ? valorTotalVenda / valorTotalItens : 0

          const valorItemOriginal = (item.preco_unitario as number || 0) * (item.quantidade as number || 0)
          const valorItemProporcional = valorItemOriginal * proporcao

          if (!itensPorTipo.has(itemKey)) {
            itensPorTipo.set(itemKey, {
              item: (item.nome_produto as string) || `${item.tipo === 'receita' ? 'Receita' : 'Produto'} ${item.item_id}`,
              tipo: item.tipo as 'receita' | 'varejo',
              quantidadeTotal: (item.quantidade as number || 0),
              receitaTotal: valorItemProporcional,
              posicao: 0
            })
          } else {
            const rankingItem = itensPorTipo.get(itemKey)!
            rankingItem.quantidadeTotal += (item.quantidade as number || 0)
            rankingItem.receitaTotal += valorItemProporcional
          }
        })

        // Ordenar por receita total e adicionar posições
        const sortedItems = Array.from(itensPorTipo.values())
          .sort((a, b) => b.receitaTotal - a.receitaTotal)
          .map((item, index) => ({
            ...item,
            posicao: index + 1
          }))

        ranking.push(...sortedItems)
      }

      // Ranking de vendas processado
      setRankingVendas(ranking)
    } catch (error) {
      console.error('Erro ao carregar ranking de vendas:', error instanceof Error ? error.message : String(error))
      setRankingVendas([])
    }
  }

  const carregarMetricasResumo = async () => {
    try {
      const params = new URLSearchParams({ dataInicio, dataFim })
      const res = await fetch(`/api/gestao/vendas/metricas?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar métricas')

      const data = await res.json()
      setMetricasResumo({
        unidadesVendidas: data.unidadesVendidas ?? 0,
        receitaTotal: data.receitaTotal ?? 0,
        ticketMedio: data.ticketMedio ?? 0,
        totalPix: data.totalPix ?? 0,
        totalDinheiro: data.totalDinheiro ?? 0,
        totalDebito: data.totalDebito ?? 0,
        totalCredito: data.totalCredito ?? 0,
        totalCaderneta: data.totalCaderneta ?? 0,
        valorReceber: data.valorReceber ?? 0
      })
    } catch (error) {
      console.error('Erro ao carregar métricas de resumo:', error instanceof Error ? error.message : String(error))
      setMetricasResumo({
        unidadesVendidas: 0,
        receitaTotal: 0,
        ticketMedio: 0,
        totalPix: 0,
        totalDinheiro: 0,
        totalDebito: 0,
        totalCredito: 0,
        totalCaderneta: 0,
        valorReceber: 0
      })
    }
  }

  return (
    <RouteGuard>
      <ProtectedLayout>
        <div className="page-container">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Gestão - Vendas</h1>
            <p className="text-sm text-gray-600 mt-1">Relatórios e análises de vendas</p>
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

              {/* Conteúdo */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                  <VendasTab
                    filtro={filtro}
                    dataInicio={dataInicio}
                    dataFim={dataFim}
                    dataInicioCustom={dataInicioCustom}
                    dataFimCustom={dataFimCustom}
                    onFiltroChange={setFiltro}
                    onDataInicioCustomChange={setDataInicioCustom}
                    onDataFimCustomChange={setDataFimCustom}
                    relatorioVendas={relatorioVendas}
                    rankingVendas={rankingVendas}
                    metricasResumo={metricasResumo}
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
