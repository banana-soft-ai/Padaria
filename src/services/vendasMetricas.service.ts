import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchVendasMetricas,
  fetchUnidadesVendidas
} from '@/repositories/vendasMetricas.repository'

export interface MetricasVendasPeriodo {
  receitaTotal: number
  vendasCount: number
  ticketMedio: number
  unidadesVendidas: number
  porFormaPagamento: {
    pix: number
    dinheiro: number
    debito: number
    credito: number
    caderneta: number
  }
  valorReceber: number
  vendaIds: number[]
}

const FORMA_PAGAMENTO_MAP: Record<string, keyof MetricasVendasPeriodo['porFormaPagamento']> = {
  pix: 'pix',
  dinheiro: 'dinheiro',
  cartao_debito: 'debito',
  cartao_credito: 'credito',
  caderneta: 'caderneta'
}

export async function buscarMetricasPeriodo(
  supabase: SupabaseClient,
  dataInicio: string,
  dataFim: string
): Promise<MetricasVendasPeriodo> {
  const vendas = await fetchVendasMetricas(supabase, dataInicio, dataFim)

  const receitaTotal = vendas.reduce((s, v) => s + Number(v.valor_total || 0), 0)
  const vendasCount = vendas.length
  const ticketMedio = vendasCount > 0 ? receitaTotal / vendasCount : 0
  const valorReceber = vendas.reduce((s, v) => s + (Number(v.valor_debito) || 0), 0)

  const porFormaPagamento = {
    pix: 0,
    dinheiro: 0,
    debito: 0,
    credito: 0,
    caderneta: 0
  }

  for (const v of vendas) {
    const key = FORMA_PAGAMENTO_MAP[v.forma_pagamento]
    if (key) {
      porFormaPagamento[key] += Number(v.valor_total || 0)
    }
  }

  const vendaIds = vendas.map((v) => v.id).filter(Boolean)
  const somaUnidades = await fetchUnidadesVendidas(supabase, vendaIds)
  const unidadesVendidas = Math.round(somaUnidades * 100) / 100

  return {
    receitaTotal,
    vendasCount,
    ticketMedio,
    unidadesVendidas,
    porFormaPagamento,
    valorReceber,
    vendaIds
  }
}
