/**
 * Service de vendas: registrar venda com validações de negócio.
 * Delega inserção ao repository; não atualiza totais do caixa (trigger ou PDV).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { obterDataLocal } from '@/lib/dateUtils'
import { insertVenda, insertVendaItens } from '@/repositories/vendas.repository'
import type { VendaItemInsertParam } from '@/repositories/vendas.repository'

export interface RegistrarVendaParams {
  itens: {
    item_id: number
    tipo: 'receita' | 'varejo'
    quantidade: number
    preco_unitario: number
  }[]
  forma_pagamento: string
  valor_total: number
  valor_pago: number
  valor_debito: number
  cliente_caderneta_id?: number | null
  caixa_diario_id?: number | null
  observacoes?: string | null
}

export interface RegistrarVendaResult {
  vendaId: number
  itensRegistrados: number
}

/**
 * Valida e registra venda + itens. Em caso de erro nos itens, a venda já foi inserida
 * (sem rollback automático; o caller pode implementar compensação se necessário).
 */
export async function registrarVenda(
  supabase: SupabaseClient<Database>,
  params: RegistrarVendaParams
): Promise<RegistrarVendaResult> {
  if (!params.itens || params.itens.length === 0) {
    throw new Error('Venda deve ter pelo menos um item')
  }
  if (params.valor_total <= 0) {
    throw new Error('Valor total deve ser maior que zero')
  }
  if (
    params.forma_pagamento === 'caderneta' &&
    (params.cliente_caderneta_id == null || params.cliente_caderneta_id <= 0)
  ) {
    throw new Error('Venda na caderneta requer cliente_caderneta_id')
  }

  const data = obterDataLocal()
  const vendaInsert = {
    data,
    forma_pagamento: params.forma_pagamento,
    cliente_caderneta_id: params.cliente_caderneta_id ?? null,
    valor_total: params.valor_total,
    valor_pago: params.valor_pago,
    valor_debito: params.valor_debito,
    valor_troco: undefined,
    desconto: undefined,
    status: 'finalizada' as const,
    observacoes: params.observacoes ?? null,
    caixa_diario_id: params.caixa_diario_id ?? null,
  }

  const venda = await insertVenda(supabase, vendaInsert)
  const itensParam: VendaItemInsertParam[] = params.itens.map((item) => ({
    tipo: item.tipo,
    item_id: item.tipo === 'receita' ? item.item_id : undefined,
    varejo_id: item.tipo === 'varejo' ? item.item_id : undefined,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
  }))

  const itensRegistrados = await insertVendaItens(supabase, venda.id, itensParam)

  return { vendaId: venda.id, itensRegistrados }
}
