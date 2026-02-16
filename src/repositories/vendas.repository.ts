import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type VendaRow = Database['public']['Tables']['vendas']['Row']
export type VendaItemRow = Database['public']['Tables']['venda_itens']['Row']
export type VendaInsertParam = Database['public']['Tables']['vendas']['Insert']
export type VendaItemInsertParam = Database['public']['Tables']['venda_itens']['Insert']

function getClient(client?: SupabaseClient<Database>) {
  const activeClient = client ?? supabase

  if (!activeClient) {
    throw new Error('Supabase não inicializado')
  }

  return activeClient
}

export async function insertVenda(
  client: SupabaseClient<Database>,
  payload: VendaInsertParam
): Promise<VendaRow> {
  const { data, error } = await getClient(client).from('vendas').insert(payload as any).select('*').single()

  if (error) throw error
  if (!data) throw new Error('Venda não retornada após inserção')

  return data as VendaRow
}

export async function insertVendaItens(
  client: SupabaseClient<Database>,
  vendaId: number,
  itens: VendaItemInsertParam[]
) {
  if (itens.length === 0) return 0

  const itensComVenda = itens.map((item) => ({
    ...item,
    venda_id: vendaId,
  }))

  const { data, error } = await getClient(client)
    .from('venda_itens')
    .insert(itensComVenda as any)
    .select('id')

  if (error) throw error

  return data?.length ?? 0
}

interface FetchVendasPeriodoParams {
  dataInicio: string
  dataFim: string
}

export async function fetchVendasPorPeriodo({ dataInicio, dataFim }: FetchVendasPeriodoParams) {
  const client = getClient()

  const startOfDayIso = new Date(`${dataInicio}T00:00:00`).toISOString()
  const endOfDayIso = new Date(`${dataFim}T23:59:59.999`).toISOString()
  const dataRangeCondition = `and(data.gte.${dataInicio},data.lte.${dataFim})`
  const createdAtRangeCondition = `and(created_at.gte.${startOfDayIso},created_at.lte.${endOfDayIso})`

  const { data, error } = await client
    .from('vendas')
    .select('*')
    .or(`${dataRangeCondition},${createdAtRangeCondition}`)
    .order('data', { ascending: false })

  if (error) throw error
  return (data ?? []) as VendaRow[]
}

export async function fetchItensPorVendaIds(vendaIds: Array<number | string>) {
  const client = getClient()

  const idsNumericos = Array.from(
    new Set(vendaIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id)))
  )

  if (idsNumericos.length === 0) return []

  const batchSize = 100
  const todosItens: VendaItemRow[] = []

  for (let i = 0; i < idsNumericos.length; i += batchSize) {
    const lote = idsNumericos.slice(i, i + batchSize)
    const { data, error } = await client
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
