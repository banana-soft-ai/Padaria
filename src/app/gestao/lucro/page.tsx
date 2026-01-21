'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import ProtectedLayout from '@/components/ProtectedLayout'
import { TrendingUp, DollarSign, Calculator, AlertTriangle, CheckCircle } from 'lucide-react'
import { obterInicioMes } from '@/lib/dateUtils'

// Tipos para o módulo de lucratividade
interface CustoFixo {
  id: number
  descricao: string
  valor: number
  categoria: 'aluguel' | 'energia' | 'agua' | 'salarios' | 'fixo' | 'variavel' | 'administrativo' | 'comercial' | 'producao' | 'outros'
  ativo: boolean
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
    descricao: '',
    valor: '',
    categoria: 'outros' as CustoFixo['categoria']
  })

  // Estados para análise de lucratividade
  const [itensLucratividade, setItensLucratividade] = useState<ItemLucratividade[]>([])
  const [produtosSemCusto, setProdutosSemCusto] = useState<string[]>([])

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

      console.log('🔄 Iniciando carregamento de dados...')

      // Primeiro carregar custos fixos
      console.log('📋 Carregando custos fixos...')
      await carregarCustosFixos()

      // Depois carregar análise de lucratividade (que precisa dos custos fixos)
      console.log('📊 Carregando análise de lucratividade...')
      await carregarAnaliseLucratividade()

      console.log('✅ Carregamento de dados concluído!')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log('Informação ao carregar dados de lucratividade:', errorMessage)
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
        .order('descricao')

      if (error) {
        const errorMessage = error.message || 'Erro desconhecido'
        console.log('Informação ao buscar custos fixos:', errorMessage)

        // Se a tabela não existe, mostrar aviso específico
        if (error.message?.includes('relation "custos_fixos" does not exist')) {
          console.log('Tabela custos_fixos não existe. Execute o script de criação da tabela.')
        }

        setCustosFixos([])
        return
      }

      setCustosFixos(data || [])
      console.log(`Custos fixos carregados: ${data?.length || 0}`)

      if (data && data.length > 0) {
        console.log('=== CUSTOS FIXOS CARREGADOS ===')
        data.forEach((custo: any, index: number) => {
          console.log(`  ${index + 1}. ${custo.descricao}: R$ ${custo.valor} (${custo.categoria}) - Ativo: ${custo.ativo}`)
        })
        const total = data.reduce((sum: number, custo: any) => sum + custo.valor, 0)
        console.log(`Total dos custos fixos carregados: R$ ${total}`)
      } else {
        console.log('⚠️ Nenhum custo fixo encontrado ou tabela vazia')
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido'
      console.log('Informação ao carregar custos fixos:', errorMessage)

      if (error?.message?.includes('relation "custos_fixos" does not exist')) {
        console.log('Tabela custos_fixos não existe. Execute o script de criação da tabela.')
      }

      setCustosFixos([])
    }
  }

  const carregarAnaliseLucratividade = async () => {
    try {
      const dataInicio = obterDataInicioPeriodo(periodo)
      const dataFim = obterDataFimPeriodo(periodo)
      const descricaoPeriodo = obterDescricaoPeriodo(periodo)

      console.log(`📅 Período selecionado: ${descricaoPeriodo}`)
      console.log(`📊 Carregando dados de ${dataInicio} até ${dataFim}`)

      // Carregar TODAS as vendas do período (sem limite de 1000)
      let todasVendas: VendaRegistro[] = []
      let offset = 0
      const limit = 1000
      let hasMore = true

      while (hasMore) {
        const { data: vendasBatch, error: vendasError } = await supabase!
          .from('vendas')
          .select('*')
          .gte('data', dataInicio)
          .lte('data', dataFim)
          .order('data', { ascending: false })
          .range(offset, offset + limit - 1)

        if (vendasError) {
          console.log('Informação ao buscar vendas:', vendasError.message || 'Erro desconhecido')
          break
        }

        if (vendasBatch && vendasBatch.length > 0) {
          todasVendas = [...todasVendas, ...vendasBatch as VendaRegistro[]]
          offset += limit
          hasMore = vendasBatch.length === limit
        } else {
          hasMore = false
        }
      }

      console.log(`Total de vendas carregadas: ${todasVendas.length}`)

      // Salvar todas as vendas no estado
      setTodasVendas(todasVendas)

      // FILTRAR PAGAMENTOS DE CADERNETA (NÃO SÃO VENDAS REAIS)
      const vendasFiltradas = todasVendas.filter(venda => {
        const formaPagamento = typeof venda.forma_pagamento === 'string' ? venda.forma_pagamento : ''
        const observacoes = typeof venda.observacoes === 'string' ? venda.observacoes : ''

        // Excluir pagamentos de caderneta que não têm itens
        if (formaPagamento === 'caderneta' &&
          (observacoes.includes('Pagamento registrado') ||
            observacoes.includes('caderneta'))) {
          return false
        }
        return true
      })

      // Salvar vendas reais no estado
      setVendasReais(vendasFiltradas)

      console.log(`Vendas após filtrar pagamentos de caderneta: ${vendasFiltradas.length}`)
      console.log(`Pagamentos de caderneta filtrados: ${todasVendas.length - vendasFiltradas.length}`)

      // Calcular valor total das vendas para debug
      const valorTotalVendas = vendasFiltradas.reduce((total, venda) => {
        const formaPagamento = typeof venda.forma_pagamento === 'string' ? venda.forma_pagamento : ''
        const valorDebito = typeof venda.valor_debito === 'number' ? venda.valor_debito : Number(venda.valor_debito ?? 0)
        const valorPago = typeof venda.valor_pago === 'number' ? venda.valor_pago : Number(venda.valor_pago ?? 0)
        const valor = formaPagamento === 'caderneta' ? valorDebito || 0 : valorPago || 0
        return total + valor
      }, 0)

      console.log(`Valor total das vendas carregadas: R$ ${valorTotalVendas.toFixed(2)}`)
      console.log('Detalhes das primeiras 5 vendas:', todasVendas.slice(0, 5).map(v => ({
        id: v.id,
        data: v.data,
        forma_pagamento: v.forma_pagamento,
        valor_pago: v.valor_pago,
        valor_debito: v.valor_debito,
        valor_calculado: v.forma_pagamento === 'caderneta' ? v.valor_debito : v.valor_pago
      })))

      if (todasVendas.length === 0) {
        setItensLucratividade([])
        setProdutosSemCusto([])
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
        return
      }

      // Carregar TODOS os itens de venda usando os IDs das vendas carregadas
      console.log(`Carregando itens de venda para ${vendasFiltradas.length} vendas REAIS...`)

      // Primeiro, vamos verificar quantos itens deveriam existir
      let todosItensVenda: Record<string, unknown>[] = []

      // Usar uma abordagem mais direta: carregar por lotes de vendas REAIS
      const vendaIds = vendasFiltradas.map(venda => venda.id)
      console.log(`IDs das vendas REAIS: ${vendaIds.length} vendas`)

      // Dividir em lotes menores para evitar limite do Supabase
      const batchSize = 100 // Lote ainda menor

      for (let i = 0; i < vendaIds.length; i += batchSize) {
        const vendaBatch = vendaIds.slice(i, i + batchSize)
        console.log(`Processando lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(vendaIds.length / batchSize)} (${vendaBatch.length} vendas)`)

        let offsetItens = 0
        const limitItens = 1000
        let hasMoreItens = true

        while (hasMoreItens) {
          const { data: itensBatch, error: itensError } = await supabase!
            .from('venda_itens')
            .select('*')
            .in('venda_id', vendaBatch)
            .range(offsetItens, offsetItens + limitItens - 1)

          if (itensError) {
            console.log('Informação ao buscar itens de venda:', itensError.message || 'Erro desconhecido')
            break
          }

          if (itensBatch && itensBatch.length > 0) {
            todosItensVenda = [...todosItensVenda, ...itensBatch]
            console.log(`  - ${itensBatch.length} itens carregados no lote ${Math.floor(offsetItens / limitItens) + 1}`)
            offsetItens += limitItens
            hasMoreItens = itensBatch.length === limitItens
          } else {
            hasMoreItens = false
          }
        }
      }

      console.log(`Total de itens de venda carregados: ${todosItensVenda.length}`)

      // Verificar se estamos carregando todos os itens
      const itensPorVenda = new Map<string, number>()
      todosItensVenda.forEach(item => {
        const vendaId = String(item.venda_id)
        itensPorVenda.set(vendaId, (itensPorVenda.get(vendaId) || 0) + 1)
      })

      console.log(`Vendas com itens carregados: ${itensPorVenda.size} de ${todasVendas.length}`)

      // Mostrar algumas estatísticas
      const totalItensEsperados = Array.from(itensPorVenda.values()).reduce((sum, count) => sum + count, 0)
      console.log(`Total de itens esperados: ${totalItensEsperados}`)

      // Verificar vendas sem itens
      const vendasComItens = Array.from(itensPorVenda.keys())
      const vendasSemItens = todasVendas.filter(venda => {
        const vendaId = venda.id != null ? String(venda.id) : ''
        return vendaId ? !vendasComItens.includes(vendaId) : true
      })
      console.log(`Vendas sem itens carregados: ${vendasSemItens.length}`)

      if (vendasSemItens.length > 0) {
        console.log('Primeiras 5 vendas sem itens:', vendasSemItens.slice(0, 5).map(v => ({ id: v.id, data: v.data })))
      }

      // Carregar insumos para calcular custos unitários reais
      const { data: insumosData, error: insumosError } = await supabase!
        .from('insumos')
        .select('id, nome, preco_pacote, peso_pacote, categoria')

      if (insumosError) {
        console.log('Informação ao buscar insumos:', insumosError.message || 'Erro desconhecido')
        return
      }

      // Carregar receitas para calcular custos baseados na composição
      const { data: receitasData, error: receitasError } = await supabase!
        .from('receitas')
        .select('id, nome, rendimento')
        .eq('ativo', true)

      if (receitasError) {
        console.log('Informação ao buscar receitas:', receitasError.message || 'Erro desconhecido')
        return
      }

      // Carregar composição das receitas
      const { data: composicaoData, error: composicaoError } = await supabase!
        .from('receita_ingredientes')
        .select('receita_id, insumo_id, quantidade')

      if (composicaoError) {
        console.log('Informação ao buscar composição das receitas:', composicaoError.message || 'Erro desconhecido')
        return
      }

      console.log('Insumos carregados:', insumosData?.length || 0)
      console.log('Receitas carregadas:', receitasData?.length || 0)
      console.log('Composições carregadas:', composicaoData?.length || 0)
      console.log('Itens de venda:', todosItensVenda?.length || 0)

      // Processar dados de lucratividade calculando custos reais
      await processarLucratividade(todasVendas, todosItensVenda || [], insumosData || [], receitasData || [], composicaoData || [])

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log('Informação ao carregar análise de lucratividade:', errorMessage)
    }
  }

  // Função para calcular custo unitário real
  const calcularCustoUnitario = (item: any, insumos: any[], receitas: any[], composicao: any[]): number => {
    if (item.tipo === 'varejo') {
      // Para produtos de varejo: preco_pacote / peso_pacote
      const insumo = insumos.find(i => i.id === item.item_id)
      if (insumo && insumo.peso_pacote > 0) {
        return insumo.preco_pacote / insumo.peso_pacote
      }
    } else if (item.tipo === 'receita') {
      // Para receitas: calcular baseado na composição
      const receita = receitas.find(r => r.id === item.item_id)
      const composicaoReceita = composicao.filter(c => c.receita_id === item.item_id)

      if (receita && composicaoReceita.length > 0) {
        let custoTotal = 0

        for (const itemComposicao of composicaoReceita) {
          const insumo = insumos.find(i => i.id === itemComposicao.insumo_id)
          if (insumo && insumo.peso_pacote > 0) {
            const custoInsumo = insumo.preco_pacote / insumo.peso_pacote
            custoTotal += custoInsumo * itemComposicao.quantidade
          }
        }

        // Dividir pelo rendimento para obter custo unitário
        return receita.rendimento > 0 ? custoTotal / receita.rendimento : 0
      }
    }

    return 0
  }

  const processarLucratividade = async (vendas: any[], itens: any[], insumos: any[], receitas: any[], composicao: any[]) => {
    try {
      const lucratividadeMap = new Map<string, ItemLucratividade>()
      const produtosSemCustoList: string[] = []
      let receitaTotal = 0
      let custoTotalProdutos = 0

      // Calcular valores reais das vendas
      const vendasMap = new Map(vendas.map(v => [v.id, v]))

      console.log(`Total de itens de venda para processar: ${itens.length}`)
      console.log(`Total de vendas REAIS únicas: ${vendas.length}`)

      // Agrupar itens por venda para calcular proporções
      const itensPorVenda = new Map<string, unknown[]>()
      itens.forEach(item => {
        const vendaId = item.venda_id
        if (!itensPorVenda.has(String(vendaId))) {
          itensPorVenda.set(String(vendaId), [])
        }
        itensPorVenda.get(String(vendaId))!.push(item)
      })

      let itensProcessados = 0
      let itensIgnorados = 0

      for (const item of itens) {
        const itemKey = `${item.tipo}_${item.item_id}`
        const venda = vendasMap.get(item.venda_id)

        if (!venda) {
          itensIgnorados++
          continue
        }

        // Usar o preco_unitario da venda como preço de venda real
        const precoVenda = item.preco_unitario || 0
        const quantidade = item.quantidade || 0

        // Calcular receita total do item
        const receitaItem = precoVenda * quantidade

        // Debug: verificar se há itens com preço zerado
        if (precoVenda === 0) {
          console.warn(`⚠️ Item com preço zerado: ${item.tipo} ID ${item.item_id} - quantidade: ${quantidade}`)
        }

        // Calcular custo unitário real baseado nos dados de insumos/receitas
        const custoUnitario = calcularCustoUnitario(item, insumos, receitas, composicao)

        // Debug: verificar se o custo unitário não foi calculado
        if (custoUnitario === 0) {
          console.warn(`⚠️ Custo unitário zero calculado para ${item.tipo} ID ${item.item_id} - preço venda: ${precoVenda}`)

          // Adicionar à lista de produtos sem custo
          const produtoKey = `${item.tipo}_${item.item_id}`
          if (!produtosSemCustoList.includes(produtoKey)) {
            produtosSemCustoList.push(produtoKey)
          }
        } else {
          console.log(`✅ Custo calculado para ${item.tipo} ID ${item.item_id}: R$ ${custoUnitario.toFixed(4)}`)
        }

        // Calcular custo total e lucro bruto
        const custoItem = custoUnitario * quantidade
        const lucroBrutoItem = receitaItem - custoItem
        const margemLucro = receitaItem > 0 ? (lucroBrutoItem / receitaItem) * 100 : 0

        if (!lucratividadeMap.has(itemKey)) {
          // Buscar nome do item
          let nomeItem = `${item.tipo === 'receita' ? 'Receita' : 'Produto'} ${item.item_id}`

          if (item.tipo === 'receita') {
              const { data: receita } = await supabase!
                .from('receitas')
                .select('nome')
                .eq('id', item.item_id)
                .eq('ativo', true)
                .single()
            if (receita) nomeItem = receita.nome
          } else {
            const { data: insumo } = await supabase!
              .from('insumos')
              .select('nome')
              .eq('id', item.item_id)
              .single()
            if (insumo) nomeItem = insumo.nome
          }

          lucratividadeMap.set(itemKey, {
            item: nomeItem,
            tipo: item.tipo,
            quantidadeVendida: quantidade,
            precoVenda: precoVenda,
            custoUnitario: custoUnitario,
            receitaTotal: receitaItem,
            custoTotal: custoItem,
            lucroBruto: lucroBrutoItem,
            margemLucro: margemLucro
          })
        } else {
          const existing = lucratividadeMap.get(itemKey)!
          existing.quantidadeVendida += quantidade
          existing.receitaTotal += receitaItem
          existing.custoTotal += custoItem
          existing.lucroBruto += lucroBrutoItem
          existing.margemLucro = existing.receitaTotal > 0 ? (existing.lucroBruto / existing.receitaTotal) * 100 : 0
        }

        receitaTotal += receitaItem
        custoTotalProdutos += custoItem
        itensProcessados++
      }

      // Calcular custos fixos totais
      const custosFixosTotal = custosFixos.reduce((sum, custo) => sum + custo.valor, 0)

      console.log('=== CUSTOS FIXOS ===')
      console.log(`Número de custos fixos cadastrados: ${custosFixos.length}`)
      console.log(`Estado dos custos fixos:`, custosFixos)
      console.log(`Custos fixos individuais:`)
      custosFixos.forEach((custo, index) => {
        console.log(`  ${index + 1}. ${custo.descricao}: R$ ${custo.valor.toFixed(2)} (${custo.categoria})`)
      })
      console.log(`Total custos fixos: R$ ${custosFixosTotal.toFixed(2)}`)

      // Verificar se os custos fixos estão sendo aplicados corretamente
      if (custosFixosTotal > 0) {
        console.log('✅ Custos fixos serão aplicados no cálculo do lucro líquido')
      } else {
        console.log('⚠️ Nenhum custo fixo cadastrado - lucro líquido = lucro bruto')
      }

      // Calcular resumo
      const lucroBrutoTotal = receitaTotal - custoTotalProdutos
      const lucroLiquido = lucroBrutoTotal - custosFixosTotal
      const margemLucroBruta = receitaTotal > 0 ? (lucroBrutoTotal / receitaTotal) * 100 : 0
      const margemLucroLiquida = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0
      const roi = custoTotalProdutos + custosFixosTotal > 0 ? (lucroLiquido / (custoTotalProdutos + custosFixosTotal)) * 100 : 0

      console.log('=== RESUMO DO PROCESSAMENTO ===')
      console.log(`Itens de venda processados: ${itensProcessados}`)
      console.log(`Itens ignorados (sem venda): ${itensIgnorados}`)
      console.log(`Receita total processada: R$ ${receitaTotal.toFixed(2)}`)
      console.log(`Custo total produtos: R$ ${custoTotalProdutos.toFixed(2)}`)
      console.log(`Lucro bruto total: R$ ${lucroBrutoTotal.toFixed(2)}`)
      console.log(`Custos fixos total: R$ ${custosFixosTotal.toFixed(2)}`)
      console.log(`Lucro líquido: R$ ${lucroLiquido.toFixed(2)}`)
      console.log(`Itens únicos processados: ${lucratividadeMap.size}`)
      console.log(`Produtos sem custo: ${produtosSemCustoList.length}`)

      setItensLucratividade(Array.from(lucratividadeMap.values()))
      setProdutosSemCusto(produtosSemCustoList)
      setResumoLucratividade({
        receitaTotal,
        custoTotalProdutos,
        lucroBrutoTotal,
        custosFixosTotal,
        lucroLiquido,
        margemLucroBruta,
        margemLucroLiquida,
        roi
      })

    } catch (error) {
      console.error('Erro ao processar lucratividade:', error)
    }
  }

  const obterDataInicioPeriodo = (periodo: string): string => {
    const hoje = new Date()
    let dataInicio: Date

    switch (periodo) {
      case 'mes':
        // Sempre do dia 1 do mês atual até hoje
        return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
      case 'trimestre':
        // Do dia 1 do trimestre atual até hoje
        const trimestre = Math.floor(hoje.getMonth() / 3)
        dataInicio = new Date(hoje.getFullYear(), trimestre * 3, 1)
        break
      case 'semestre':
        // Do dia 1 do semestre atual até hoje
        const semestre = Math.floor(hoje.getMonth() / 6)
        dataInicio = new Date(hoje.getFullYear(), semestre * 6, 1)
        break
      case 'ano':
        // Do dia 1 de janeiro até hoje
        dataInicio = new Date(hoje.getFullYear(), 0, 1)
        break
      default:
        return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    }

    return dataInicio.toISOString().split('T')[0]
  }

  const obterDataFimPeriodo = (periodo: string): string => {
    const hoje = new Date()
    let dataFim: Date

    switch (periodo) {
      case 'mes':
        // Até o dia atual
        dataFim = hoje
        break
      case 'trimestre':
        // Até o dia atual
        dataFim = hoje
        break
      case 'semestre':
        // Até o dia atual
        dataFim = hoje
        break
      case 'ano':
        // Até o dia atual
        dataFim = hoje
        break
      default:
        dataFim = hoje
    }

    return dataFim.toISOString().split('T')[0]
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
    let dadosCusto: any = null

    try {
      if (!formCusto.descricao || !formCusto.valor) {
        alert('Por favor, preencha todos os campos obrigatórios.')
        return
      }

      const valor = parseFloat(formCusto.valor)
      if (valor <= 0) {
        alert('O valor deve ser maior que zero.')
        return
      }

      dadosCusto = {
        descricao: formCusto.descricao,
        valor: valor,
        categoria: formCusto.categoria,
        ativo: true
      }

      if (editingCusto) {
        const { error } = await supabase!
          .from('custos_fixos')
          .update(dadosCusto)
          .eq('id', editingCusto.id)

        if (error) throw error
        alert('Custo fixo atualizado com sucesso!')
      } else {
        const { error } = await supabase!
          .from('custos_fixos')
          .insert(dadosCusto)

        if (error) throw error
        alert('Custo fixo cadastrado com sucesso!')
      }

      setShowCustoModal(false)
      setFormCusto({ descricao: '', valor: '', categoria: 'outros' })
      await carregarCustosFixos()
    } catch (error: any) {
      console.error('Erro ao salvar custo fixo:', error)
      console.error('Tipo do erro:', typeof error)
      console.error('Estrutura do erro:', JSON.stringify(error, null, 2))

      // Tratar diferentes tipos de erro
      let mensagemErro = 'Erro ao salvar custo fixo.'

      if (error?.message) {
        mensagemErro += `\n\nMensagem: ${error.message}`
      }

      if (error?.code) {
        mensagemErro += `\nCódigo: ${error.code}`
      }

      if (error?.details) {
        mensagemErro += `\nDetalhes: ${error.details}`
      }

      if (error?.hint) {
        mensagemErro += `\nDica: ${error.hint}`
      }

      if (typeof error === 'string') {
        mensagemErro += `\nErro: ${error}`
      }

      if (error?.error_description) {
        mensagemErro += `\nDescrição: ${error.error_description}`
      }

      // Log adicional para debug
      console.error('Dados que estavam sendo salvos:', dadosCusto)

      alert(mensagemErro)
    }
  }

  const handleDeleteCusto = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este custo fixo?')) return

    try {
      const { error } = await supabase!
        .from('custos_fixos')
        .delete()
        .eq('id', id)

      if (error) throw error
      alert('Custo fixo excluído com sucesso!')
      await carregarCustosFixos()
    } catch (error) {
      console.error('Erro ao excluir custo fixo:', error)
      alert('Erro ao excluir custo fixo.')
    }
  }

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarPercentual = (valor: number) => {
    return `${valor.toFixed(1)}%`
  }

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      aluguel: 'Aluguel',
      energia: 'Energia',
      agua: 'Água',
      salarios: 'Salários',
      outros: 'Outros'
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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Análise de Lucratividade</h1>
          <p className="text-sm text-gray-600 mt-1">Controle de custos fixos e análise de margens de lucro</p>

          {/* Indicador de Período */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">📅</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Período de Análise</h3>
                <p className="text-sm text-blue-700 mt-1">
                  {obterDescricaoPeriodo(periodo)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Erro se houver */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-red-400" />
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

        {/* Seletor de Período */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Período:</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="mes">Mês Atual (1º até hoje)</option>
              <option value="trimestre">Trimestre Atual (1º até hoje)</option>
              <option value="semestre">Semestre Atual (1º até hoje)</option>
              <option value="ano">Ano Atual (1º Jan até hoje)</option>
            </select>
          </div>
        </div>

        {/* Aviso sobre Filtros */}
        {vendasReais && todasVendas && vendasReais.length < todasVendas.length && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">ℹ</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Filtro de Pagamentos Aplicado</h3>
                <p className="text-sm text-blue-700 mt-1">
                  <strong>{todasVendas.length - vendasReais.length} pagamentos de caderneta</strong> foram excluídos da análise de lucratividade.
                  Estes pagamentos entram no caixa mas não representam vendas reais.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Resumo de Lucratividade */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Receita Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatarMoeda(resumoLucratividade.receitaTotal)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <Calculator className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Lucro Bruto</p>
                <p className="text-2xl font-bold text-gray-900">{formatarMoeda(resumoLucratividade.lucroBrutoTotal)}</p>
                <p className="text-xs text-gray-500">{formatarPercentual(resumoLucratividade.margemLucroBruta)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-purple-100">
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Lucro Líquido</p>
                <p className={`text-2xl font-bold ${resumoLucratividade.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatarMoeda(resumoLucratividade.lucroLiquido)}
                </p>
                <p className="text-xs text-gray-500">{formatarPercentual(resumoLucratividade.margemLucroLiquida)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-orange-100">
                <CheckCircle className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">ROI</p>
                <p className={`text-2xl font-bold ${resumoLucratividade.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatarPercentual(resumoLucratividade.roi)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Detalhamento dos Custos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Custos Fixos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Custos Fixos</h2>
                <button
                  onClick={() => setShowCustoModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
                >
                  Adicionar Custo
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">Total: {formatarMoeda(resumoLucratividade.custosFixosTotal)}</p>
            </div>
            <div className="p-6">
              {custosFixos.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhum custo fixo cadastrado</p>
              ) : (
                <div className="space-y-3">
                  {custosFixos.map((custo) => (
                    <div key={custo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{custo.descricao}</p>
                        <p className="text-sm text-gray-500">{getCategoriaLabel(custo.categoria)}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900">{formatarMoeda(custo.valor)}</span>
                        <button
                          onClick={() => handleDeleteCusto(custo.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resumo Detalhado */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Resumo Detalhado</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Receita Total:</span>
                <span className="font-semibold text-gray-900">{formatarMoeda(resumoLucratividade.receitaTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Custos dos Produtos:</span>
                <span className="font-semibold text-red-600">-{formatarMoeda(resumoLucratividade.custoTotalProdutos)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Lucro Bruto:</span>
                  <span className="font-semibold text-green-600">{formatarMoeda(resumoLucratividade.lucroBrutoTotal)}</span>
                </div>
                <div className="text-right text-sm text-gray-500">
                  {formatarPercentual(resumoLucratividade.margemLucroBruta)} de margem
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Custos Fixos:</span>
                <span className="font-semibold text-red-600">-{formatarMoeda(resumoLucratividade.custosFixosTotal)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Lucro Líquido:</span>
                  <span className={`font-semibold ${resumoLucratividade.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatarMoeda(resumoLucratividade.lucroLiquido)}
                  </span>
                </div>
                <div className="text-right text-sm text-gray-500">
                  {formatarPercentual(resumoLucratividade.margemLucroLiquida)} de margem
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alertas de Produtos sem Custo */}
        {produtosSemCusto.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Produtos sem custos calculáveis
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Os seguintes produtos foram vendidos mas não têm custos calculáveis (sem composição ou dados insuficientes):
                </p>
                <div className="mt-2">
                  <ul className="list-disc list-inside text-sm text-yellow-700">
                    {produtosSemCusto.map((produto, index) => (
                      <li key={index}>{produto}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm text-yellow-700 mt-2">
                  <strong>Solução:</strong> Verifique se os insumos têm preço e peso cadastrados, ou se as receitas têm composição definida.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Análise por Produto */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Análise por Produto</h2>
            <p className="text-sm text-gray-600 mt-1">Margem de lucro de cada item vendido no período</p>
          </div>
          <div className="overflow-x-auto">
            {itensLucratividade.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhuma venda encontrada no período</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qtd Vendida
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Venda
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custo Unit.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Receita
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custo Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lucro Bruto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margem
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {itensLucratividade.map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.item}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 text-xs rounded-full ${item.tipo === 'receita'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                          }`}>
                          {item.tipo === 'receita' ? 'Receita' : 'Varejo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantidadeVendida}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatarMoeda(item.precoVenda)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatarMoeda(item.custoUnitario)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatarMoeda(item.receitaTotal)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {formatarMoeda(item.custoTotal)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {formatarMoeda(item.lucroBruto)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs rounded-full ${item.margemLucro >= 30
                          ? 'bg-green-100 text-green-800'
                          : item.margemLucro >= 15
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                          }`}>
                          {formatarPercentual(item.margemLucro)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Modal de Custo Fixo */}
        {showCustoModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingCusto ? 'Editar Custo Fixo' : 'Adicionar Custo Fixo'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={formCusto.descricao}
                    onChange={(e) => setFormCusto({ ...formCusto, descricao: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Aluguel da loja"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Mensal
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCusto.valor}
                    onChange={(e) => setFormCusto({ ...formCusto, valor: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formCusto.categoria}
                    onChange={(e) => setFormCusto({ ...formCusto, categoria: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="aluguel">Aluguel</option>
                    <option value="energia">Energia</option>
                    <option value="agua">Água</option>
                    <option value="salarios">Salários</option>
                    <option value="fixo">Fixo (Geral)</option>
                    <option value="variavel">Variável (Geral)</option>
                    <option value="administrativo">Administrativo</option>
                    <option value="comercial">Comercial</option>
                    <option value="producao">Produção</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCustoModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitCusto}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingCusto ? 'Atualizar' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  )
}
