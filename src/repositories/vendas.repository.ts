import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

export type VendaRow = Database['public']['Tables']['vendas']['Row']
export type VendaItemRow = Database['public']['Tables']['venda_itens']['Row']

interface FetchVendasPeriodoParams {
  dataInicio: string
  dataFim: string
}

export async function fetchVendasPorPeriodo({ dataInicio, dataFim }: FetchVendasPeriodoParams) {
  if (!supabase) throw new Error('Supabase não inicializado')

  const startOfDayIso = new Date(`${dataInicio}T00:00:00`).toISOString()
  const endOfDayIso = new Date(`${dataFim}T23:59:59.999`).toISOString()
  const dataRangeCondition = `and(data.gte.${dataInicio},data.lte.${dataFim})`
  const createdAtRangeCondition = `and(created_at.gte.${startOfDayIso},created_at.lte.${endOfDayIso})`

  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .or(`${dataRangeCondition},${createdAtRangeCondition}`)
    .order('data', { ascending: false })

  if (error) throw error
  return (data ?? []) as VendaRow[]
}

export async function fetchItensPorVendaIds(vendaIds: Array<number | string>) {
  if (!supabase) throw new Error('Supabase não inicializado')

  const idsNumericos = Array.from(
    new Set(vendaIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id)))
  )

  if (idsNumericos.length === 0) return []

  const batchSize = 100
  const todosItens: VendaItemRow[] = []

  for (let i = 0; i < idsNumericos.length; i += batchSize) {
    const lote = idsNumericos.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('venda_itens')
      .select('*')
      .in('venda_id', lote)
      .order('created_at', { ascending: true })

    if (error) throw error
    if (data) {
      todosItens.push(...(data as VendaItemRow[]))
    }
  }

  return todosItens
}
