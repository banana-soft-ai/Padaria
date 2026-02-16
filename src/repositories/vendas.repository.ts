import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultSupabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

export type VendaRow = Database['public']['Tables']['vendas']['Row']
export type VendaInsert = Database['public']['Tables']['vendas']['Insert']
export type VendaItemRow = Database['public']['Tables']['venda_itens']['Row']
export type VendaItemInsert = Database['public']['Tables']['venda_itens']['Insert']

export interface VendaItemInsertParam {
  tipo: 'receita' | 'varejo'
  item_id?: number
  varejo_id?: number
  quantidade: number
  preco_unitario: number
}

interface FetchVendasPeriodoParams {
  dataInicio: string
  dataFim: string
}

function getClient(client?: SupabaseClient<Database>): SupabaseClient<Database> {
  const resolved = client ?? defaultSupabase
  if (!resolved) {
    throw new Error('Supabase não inicializado')
  }
  return resolved
}

export async function insertVenda(
  supabase: SupabaseClient<Database>,
  payload: VendaInsert
): Promise<VendaRow> {
  const { data, error } = await supabase.from('vendas').insert(payload as never).select().single()

  if (error) throw error
  if (!data) throw new Error('Falha ao inserir venda')

  return data as VendaRow
}

export async function insertVendaItens(
  supabase: SupabaseClient<Database>,
  vendaId: number,
  itens: VendaItemInsertParam[]
): Promise<number> {
  if (!itens.length) return 0

  const payload = itens.map((item) => {
    const base = {
      venda_id: vendaId,
      tipo: item.tipo,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    }

    if (item.tipo === 'receita') {
      return {
        ...base,
        item_id: item.item_id,
        varejo_id: null,
      }
    }

    return {
      ...base,
      item_id: null,
      varejo_id: item.varejo_id,
    }
  })

  const { data, error } = await supabase.from('venda_itens').insert(payload as never).select('id')

  if (error) throw error
  return data?.length ?? 0
}

export async function fetchVendasPorPeriodo(
  { dataInicio, dataFim }: FetchVendasPeriodoParams,
  supabaseClient?: SupabaseClient<Database>
) {
  const supabase = getClient(supabaseClient)

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

export async function fetchItensPorVendaIds(
  vendaIds: Array<number | string>,
  supabaseClient?: SupabaseClient<Database>
) {
  const supabase = getClient(supabaseClient)

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
