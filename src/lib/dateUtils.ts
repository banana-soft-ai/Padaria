/**
 * Utilitários centralizados para cálculos de datas e valores
 * Garantem consistência em todo o sistema
 */

import { supabase } from './supabase/client'

// Interface para filtros com operadores
interface FiltroComOperador {
  operator: string
  value: unknown
}

// Função utilitária para buscar TODOS os dados sem limite do Supabase
export const buscarTodosDados = async (tabela: string, filtros: Record<string, unknown> = {}, campos: string = '*') => {
  let todosDados: unknown[] = []
  let offset = 0
  const limit = 1000
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(tabela)
      .select(campos)
      .range(offset, offset + limit - 1)

    // Aplicar filtros
    Object.entries(filtros).forEach(([campo, valor]) => {
      if (Array.isArray(valor)) {
        query = query.in(campo, valor)
      } else if (typeof valor === 'object' && valor !== null && 'operator' in valor) {
        const filtro = valor as FiltroComOperador
        // Usar switch case para métodos específicos do Supabase
        switch (filtro.operator) {
          case 'gte':
            query = query.gte(campo, filtro.value)
            break
          case 'lte':
            query = query.lte(campo, filtro.value)
            break
          case 'gt':
            query = query.gt(campo, filtro.value)
            break
          case 'lt':
            query = query.lt(campo, filtro.value)
            break
          case 'neq':
            query = query.neq(campo, filtro.value)
            break
          case 'like':
            query = query.like(campo, filtro.value as string)
            break
          case 'ilike':
            query = query.ilike(campo, filtro.value as string)
            break
          default:
            query = query.eq(campo, filtro.value)
        }
      } else {
        query = query.eq(campo, valor)
      }
    })

    const { data: dadosBatch, error } = await query

    if (error) {
      console.error(`Erro ao carregar ${tabela}:`, error)
      break
    }

    if (dadosBatch && dadosBatch.length > 0) {
      todosDados = [...todosDados, ...dadosBatch]
      offset += limit
      hasMore = dadosBatch.length === limit
    } else {
      hasMore = false
    }
  }

  return todosDados as Record<string, unknown>[]
}

// Função para obter data local no formato YYYY-MM-DD (usando fuso de São Paulo)
export const obterDataLocal = (timeZone = 'America/Sao_Paulo') => {
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone }))
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// Função para obter início do mês atual (dia 1 até hoje) usando fuso de São Paulo
export const obterInicioMes = () => {
  const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const ano = primeiroDia.getFullYear()
  const mes = String(primeiroDia.getMonth() + 1).padStart(2, '0')
  const dia = String(primeiroDia.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// Função para obter data N dias atrás no formato YYYY-MM-DD (usando fuso de São Paulo)
export const obterDataNDiasAtras = (dias: number, timeZone = 'America/Sao_Paulo') => {
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone }))
  const data = new Date(agora)
  data.setDate(agora.getDate() - dias)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// Função para obter início da semana atual (última segunda até hoje) usando fuso de São Paulo
export const obterInicioSemana = () => {
  const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const ultimaSegunda = new Date(hoje)
  ultimaSegunda.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7)) // Segunda anterior
  const ano = ultimaSegunda.getFullYear()
  const mes = String(ultimaSegunda.getMonth() + 1).padStart(2, '0')
  const dia = String(ultimaSegunda.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// Interface para dados de vendas consolidados
export interface VendasConsolidadas {
  totalEntradas: number
  totalVendas: number
  totalCaderneta: number
  vendasCount: number
  vendasHoje: Record<string, unknown>[]
  vendasMes: Record<string, unknown>[]
}

// Função centralizada para carregar vendas do dia
export const carregarVendasHoje = async (): Promise<Record<string, unknown>[]> => {
  const hoje = obterDataLocal()
  const { data: vendasHoje, error } = await supabase
    .from('vendas')
    .select('id, valor_pago, valor_debito, forma_pagamento')
    .eq('data', hoje)
    .neq('forma_pagamento', 'caderneta') // Excluir vendas na caderneta

  if (error) {
    console.error('Erro ao carregar vendas de hoje:', error)
    return []
  }

  return vendasHoje || []
}

// Função centralizada para carregar vendas do mês (SEM LIMITE)
export const carregarVendasMes = async (): Promise<Record<string, unknown>[]> => {
  const inicioMes = obterInicioMes()
  const hoje = obterDataLocal()

  return await buscarTodosDados('vendas', {
    data: { operator: 'gte', value: inicioMes },
    forma_pagamento: { operator: 'neq', value: 'caderneta' }
  }, 'valor_pago, valor_debito, forma_pagamento')
}

// Função centralizada para carregar vendas da semana
export const carregarVendasSemana = async (): Promise<Record<string, unknown>[]> => {
  const inicioSemana = obterInicioSemana()
  const { data: vendasSemana, error } = await supabase
    .from('vendas')
    .select('valor_pago, valor_debito, forma_pagamento')
    .gte('data', inicioSemana)
    .neq('forma_pagamento', 'caderneta') // Excluir vendas na caderneta

  if (error) {
    console.error('Erro ao carregar vendas da semana:', error)
    return []
  }

  return vendasSemana || []
}

// Função centralizada para carregar vendas da caderneta do mês
export const carregarVendasCadernetaMes = async (): Promise<Record<string, unknown>[]> => {
  const inicioMes = obterInicioMes()
  const { data: vendasCaderneta, error } = await supabase
    .from('vendas')
    .select('valor_debito')
    .gte('data', inicioMes)
    .eq('forma_pagamento', 'caderneta')

  if (error) {
    console.error('Erro ao carregar vendas da caderneta do mês:', error)
    return []
  }

  return vendasCaderneta || []
}

// Função centralizada para calcular totais consolidados
export const calcularTotaisConsolidados = async (): Promise<VendasConsolidadas> => {
  try {
    // Carregar dados em paralelo
    const [vendasHoje, vendasMes, vendasCadernetaMes] = await Promise.all([
      carregarVendasHoje(),
      carregarVendasMes(),
      carregarVendasCadernetaMes()
    ])

    // Calcular totais do mês (usando valor_pago para alinhar com sistema de caixa)
    const totalEntradas = vendasMes.reduce((sum, venda) => sum + ((venda.valor_pago as number) || 0), 0)
    const totalCaderneta = vendasCadernetaMes.reduce((sum, venda) => sum + ((venda.valor_debito as number) || 0), 0)
    const totalVendas = totalEntradas + totalCaderneta

    return {
      totalEntradas,
      totalVendas,
      totalCaderneta,
      vendasCount: vendasMes.length,
      vendasHoje,
      vendasMes
    }
  } catch (error) {
    console.error('Erro ao calcular totais consolidados:', error)
    return {
      totalEntradas: 0,
      totalVendas: 0,
      totalCaderneta: 0,
      vendasCount: 0,
      vendasHoje: [],
      vendasMes: []
    }
  }
}

// Função para calcular totais de um período específico (SEM LIMITE)
export const calcularTotaisPeriodo = async (dataInicio: string, dataFim: string) => {
  try {
    const vendas = await buscarTodosDados('vendas', {
      data: { operator: 'gte', value: dataInicio }
    }, 'valor_pago, valor_debito, forma_pagamento')

    // Filtrar por data fim
    const vendasFiltradas = vendas.filter(v => (v.data as string) <= dataFim)

    const vendasReais = vendasFiltradas.filter(v => v.forma_pagamento !== 'caderneta')
    const vendasCaderneta = vendasFiltradas.filter(v => v.forma_pagamento === 'caderneta')

    const totalEntradas = vendasReais.reduce((sum, v) => sum + ((v.valor_pago as number) || 0), 0)
    const totalCaderneta = vendasCaderneta.reduce((sum, v) => sum + ((v.valor_debito as number) || 0), 0)
    const totalVendas = totalEntradas + totalCaderneta

    return {
      totalEntradas,
      totalCaderneta,
      totalVendas,
      vendasCount: vendasFiltradas.length
    }
  } catch (error) {
    console.error('Erro ao calcular totais do período:', error)
    return { totalEntradas: 0, totalCaderneta: 0, totalVendas: 0, vendasCount: 0 }
  }
}

// Função para calcular receita do mês baseada nos fechamentos de caixa (Total Real)
export const calcularReceitaMesCaixas = async (): Promise<{ receita: number; vendasCount: number }> => {
  try {
    const inicioMes = obterInicioMes()
    const hoje = obterDataLocal()

    // Buscar todos os caixas fechados do mês
    const { data: caixas, error } = await supabase
      .from('caixa_diario')
      .select('total_entradas, diferenca')
      .gte('data', inicioMes)
      .lte('data', hoje)
      .eq('status', 'fechado')

    if (error) {
      console.error('Erro ao carregar caixas do mês:', error)
      return { receita: 0, vendasCount: 0 }
    }

    if (!caixas || caixas.length === 0) {
      return { receita: 0, vendasCount: 0 }
    }

    // Calcular Total Real para cada caixa (Entradas + Diferença)
    const totalReal = caixas.reduce((sum, caixa) => {
      const entradas = caixa.total_entradas || 0
      const diferenca = caixa.diferenca || 0
      const totalRealCaixa = entradas + diferenca
      return sum + totalRealCaixa
    }, 0)

    // Buscar contagem real de vendas do mês (sem limite)
    const { count: vendasCount, error: vendasError } = await supabase
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .gte('data', inicioMes)
      .lte('data', hoje)
      .neq('forma_pagamento', 'caderneta')

    if (vendasError) {
      console.error('Erro ao contar vendas do mês:', vendasError)
    }


    return {
      receita: totalReal,
      vendasCount: vendasCount || 0
    }
  } catch (error) {
    console.error('Erro ao calcular receita do mês pelos caixas:', error)
    return { receita: 0, vendasCount: 0 }
  }
}
