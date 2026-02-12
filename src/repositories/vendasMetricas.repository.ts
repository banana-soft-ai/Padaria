import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1000
const CHUNK_SIZE = 250

export type VendaMetricaRow = {
  id: number
  valor_total: number
  forma_pagamento: string
  valor_debito?: number
}

export async function fetchVendasMetricas(
  supabase: SupabaseClient,
  dataInicio: string,
  dataFim: string
): Promise<VendaMetricaRow[]> {
  const vendas: VendaMetricaRow[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: page, error } = await supabase
      .from('vendas')
      .select('id, valor_total, forma_pagamento, valor_debito')
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .eq('status', 'finalizada')
      .order('data', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('Erro ao buscar vendas para métricas:', error)
      break
    }

    if (!page?.length) break
    vendas.push(...(page as VendaMetricaRow[]))
    hasMore = page.length === PAGE_SIZE
    offset += PAGE_SIZE
  }

  return vendas
}

export async function fetchUnidadesVendidas(
  supabase: SupabaseClient,
  vendaIds: number[]
): Promise<number> {
  if (vendaIds.length === 0) return 0

  let soma = 0
  for (let i = 0; i < vendaIds.length; i += CHUNK_SIZE) {
    const chunk = vendaIds.slice(i, i + CHUNK_SIZE)
    const { data, error } = await supabase
      .from('venda_itens')
      .select('quantidade')
      .in('venda_id', chunk)

    if (error) {
      console.error('Erro ao buscar itens para unidades vendidas:', error)
      continue
    }

    soma += (data || []).reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0)
  }

  return soma
}
