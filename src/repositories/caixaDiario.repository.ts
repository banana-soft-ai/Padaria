/**
 * Repository para operações de CaixaDiario
 *
 * Abstrai acesso ao Supabase, fornecendo funções puras para queries e mutations
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type CaixaDiarioRow = Database['public']['Tables']['caixa_diario']['Row']
export type CaixaDiarioInsert = Database['public']['Tables']['caixa_diario']['Insert']
export type CaixaDiarioUpdate = Database['public']['Tables']['caixa_diario']['Update']

/**
 * Busca todos os caixas com status aberto
 *
 * Útil para detectar múltiplos caixas abertos (inconsistência)
 */
export async function fetchCaixasAbertos(
  supabase: SupabaseClient<Database>
): Promise<CaixaDiarioRow[]> {
  const { data, error } = await supabase
    .from('caixa_diario')
    .select('*')
    .eq('status', 'aberto')
    .order('data', { ascending: false })

  if (error) {
    console.error('[fetchCaixasAbertos] Erro ao buscar caixas abertos:', error)
    throw error
  }

  return data || []
}

/**
 * Busca caixa de uma data específica
 */
export async function fetchCaixaPorData(
  supabase: SupabaseClient<Database>,
  data: string
): Promise<CaixaDiarioRow | null> {
  const { data: caixa, error } = await supabase
    .from('caixa_diario')
    .select('*')
    .eq('data', data)
    .maybeSingle()

  if (error) {
    console.error(`[fetchCaixaPorData] Erro ao buscar caixa da data ${data}:`, error)
    throw error
  }

  return caixa
}

/**
 * Abre novo caixa
 *
 * @throws Error se já existir caixa aberto na mesma data
 */
export async function abrirCaixa(
  supabase: SupabaseClient<Database>,
  dados: CaixaDiarioInsert
): Promise<CaixaDiarioRow> {
  const data = dados.data
  if (!data) throw new Error('Data é obrigatória para abertura de caixa')
  // Validar: não pode ter caixa aberto na mesma data
  const caixaExistente = await fetchCaixaPorData(supabase, data)
  if (caixaExistente && caixaExistente.status === 'aberto') {
    throw new Error(`Já existe um caixa aberto para a data ${dados.data}`)
  }

  const payload = {
    ...dados,
    data,
    status: 'aberto' as const,
    data_abertura: dados.data_abertura || new Date().toISOString(),
  }
  // Nota: Insert inferido como never por causa do index signature em Database['public']['Tables']; ver types.ts
  const { data: caixaAberto, error } = await supabase
    .from('caixa_diario')
    .insert(payload as never)
    .select()
    .single()

  if (error) {
    console.error('[abrirCaixa] Erro ao abrir caixa:', error)
    throw error
  }

  return caixaAberto!
}

/**
 * Fecha caixa
 */
export async function fecharCaixa(
  supabase: SupabaseClient<Database>,
  caixaId: number,
  dadosFechamento: CaixaDiarioUpdate
): Promise<CaixaDiarioRow> {
  const updatePayload = {
    ...dadosFechamento,
    status: 'fechado' as const,
    data_fechamento: dadosFechamento.data_fechamento || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { data: caixaFechado, error } = await supabase
    .from('caixa_diario')
    .update(updatePayload as never)
    .eq('id', caixaId)
    .select()
    .single()

  if (error) {
    console.error(`[fecharCaixa] Erro ao fechar caixa ID ${caixaId}:`, error)
    throw error
  }

  return caixaFechado!
}

/**
 * Atualiza totais do caixa (vendas, entradas, saídas, por forma de pagamento)
 */
export async function atualizarTotaisCaixa(
  supabase: SupabaseClient<Database>,
  caixaId: number,
  totais: Partial<CaixaDiarioUpdate>
): Promise<void> {
  const updatePayload = { ...totais, updated_at: new Date().toISOString() }
  const { error } = await supabase
    .from('caixa_diario')
    .update(updatePayload as never)
    .eq('id', caixaId)

  if (error) {
    console.error(`[atualizarTotaisCaixa] Erro ao atualizar totais do caixa ID ${caixaId}:`, error)
    throw error
  }
}

/**
 * Corrige múltiplos caixas abertos (deixa apenas o mais recente)
 *
 * @returns Caixa que permaneceu aberto e quantidade de caixas fechados
 */
export async function corrigirCaixasDuplicados(
  supabase: SupabaseClient<Database>
): Promise<{ caixaAtivo: CaixaDiarioRow; caixasFechados: number }> {
  const caixasAbertos = await fetchCaixasAbertos(supabase)

  if (caixasAbertos.length <= 1) {
    // Nenhuma duplicação
    return {
      caixaAtivo: caixasAbertos[0],
      caixasFechados: 0,
    }
  }

  // Manter o mais recente (primeiro no array após sort desc)
  const [caixaMaisRecente, ...caixasAntigos] = caixasAbertos

  // Fechar os demais
  for (const caixa of caixasAntigos) {
    await fecharCaixa(supabase, caixa.id, {
      observacoes_fechamento: `[AUTO] Caixa fechado automaticamente (duplicação detectada)`,
    })
  }

  return {
    caixaAtivo: caixaMaisRecente,
    caixasFechados: caixasAntigos.length,
  }
}

/**
 * Busca caixas em um intervalo de datas
 */
export async function fetchCaixasPorPeriodo(
  supabase: SupabaseClient<Database>,
  dataInicio: string,
  dataFim: string
): Promise<CaixaDiarioRow[]> {
  const { data, error } = await supabase
    .from('caixa_diario')
    .select('*')
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data', { ascending: false })

  if (error) {
    console.error('[fetchCaixasPorPeriodo] Erro ao buscar caixas do período:', error)
    throw error
  }

  return data || []
}

/**
 * Busca último caixa aberto (independente da data)
 */
export async function fetchUltimoCaixaAberto(
  supabase: SupabaseClient<Database>
): Promise<CaixaDiarioRow | null> {
  const { data, error } = await supabase
    .from('caixa_diario')
    .select('*')
    .eq('status', 'aberto')
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[fetchUltimoCaixaAberto] Erro ao buscar último caixa aberto:', error)
    throw error
  }

  return data
}
