/**
 * Service Layer para operações de Caixa Diário
 *
 * Contém toda a lógica de negócio de caixa: abertura, fechamento,
 * cálculo de totais e diferenças, correção de duplicados.
 *
 * Recebe supabase como parâmetro (injeção de dependência) para
 * facilitar testes e desacoplar do hook.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { obterDataLocal } from '@/lib/dateUtils'
import {
  fetchCaixasAbertos,
  fetchCaixaPorData,
  abrirCaixa as abrirCaixaRepo,
  fecharCaixa as fecharCaixaRepo,
  atualizarTotaisCaixa,
  fetchUltimoCaixaAberto,
} from '@/repositories/caixaDiario.repository'
import type {
  CaixaDiarioRow,
  CaixaDiarioInsert,
} from '@/repositories/caixaDiario.repository'

// ─── Interfaces ──────────────────────────────────────────────────

export interface CaixaHojeResult {
  caixa: CaixaDiarioRow | null
  multiplosAbertos: boolean
  caixasFechadosAutomaticamente: number
}

export interface DadosFechamento {
  valor_final: number
  valor_saidas: number
  valor_dinheiro_informado: number
  valor_pix_informado: number
  valor_debito_informado: number
  valor_credito_informado: number
  observacoes_fechamento?: string
}

export interface ResultadoFechamento {
  diferencaFinal: number
  diferencaPorForma: {
    dinheiro: number
    pix: number
    debito: number
    credito: number
  }
}

// ─── Funções Principais ──────────────────────────────────────────

/**
 * Carrega o caixa do dia atual
 *
 * - Busca caixas abertos
 * - Corrige automaticamente múltiplos caixas abertos
 * - Calcula saídas vinculadas ao caixa
 */
export async function carregarCaixaHoje(
  supabase: SupabaseClient<Database>
): Promise<CaixaHojeResult> {
  const caixasAbertos = await fetchCaixasAbertos(supabase)

  if (!caixasAbertos || caixasAbertos.length === 0) {
    return { caixa: null, multiplosAbertos: false, caixasFechadosAutomaticamente: 0 }
  }

  let caixaAtivo = caixasAbertos[0]
  let caixasFechados = 0

  // Corrigir múltiplos caixas abertos: fechar os antigos
  if (caixasAbertos.length > 1) {
    const idsParaFechar = caixasAbertos.slice(1).map(c => c.id)
    const { error } = await supabase
      .from('caixa_diario')
      .update({
        status: 'fechado',
        observacoes_fechamento: 'Limpeza automática: múltiplos caixas abertos',
      } as never)
      .in('id', idsParaFechar)

    if (error) {
      console.error('[carregarCaixaHoje] Erro ao fechar caixas duplicados:', error)
    }

    caixasFechados = idsParaFechar.length
  }

  // Calcular saídas vinculadas ao caixa
  const caixaComSaidas = await calcularSaidasCaixa(supabase, caixaAtivo)

  return {
    caixa: caixaComSaidas,
    multiplosAbertos: caixasAbertos.length > 1,
    caixasFechadosAutomaticamente: caixasFechados,
  }
}

/**
 * Abre um novo caixa com validações de negócio
 *
 * Validações:
 * - valor_abertura >= 0
 * - Não pode haver caixa aberto no sistema
 */
export async function abrirNovoCaixa(
  supabase: SupabaseClient<Database>,
  valorAbertura: number,
  observacoes?: string
): Promise<CaixaDiarioRow> {
  // Validação de negócio
  if (valorAbertura < 0) {
    throw new Error('Valor de abertura não pode ser negativo')
  }

  // Verificar se já existe caixa aberto
  const caixaExistente = await fetchUltimoCaixaAberto(supabase)
  if (caixaExistente) {
    throw new Error('Já existe um caixa aberto no sistema')
  }

  const hoje = obterDataLocal()

  const dados: CaixaDiarioInsert = {
    data: hoje,
    status: 'aberto',
    valor_abertura: valorAbertura,
    observacoes_abertura: observacoes || '',
    usuario_abertura: 'Sistema',
    data_abertura: new Date().toISOString(),
  }

  return abrirCaixaRepo(supabase, dados)
}

/**
 * Fecha o caixa do dia com cálculo de diferenças
 *
 * Calcula diferenças: (valor informado - valor esperado) por forma de pagamento
 */
export async function fecharCaixaDoDia(
  supabase: SupabaseClient<Database>,
  caixaId: number,
  caixaAtual: CaixaDiarioRow,
  dadosFechamento: DadosFechamento
): Promise<ResultadoFechamento> {
  // Validação: caixa deve estar aberto
  if (caixaAtual.status === 'fechado') {
    throw new Error('Este caixa já foi fechado')
  }

  // Calcular diferenças por forma de pagamento
  const diferencaDinheiro = dadosFechamento.valor_dinheiro_informado - (caixaAtual.total_dinheiro || 0)
  const diferencaPix = dadosFechamento.valor_pix_informado - (caixaAtual.total_pix || 0)
  const diferencaDebito = dadosFechamento.valor_debito_informado - (caixaAtual.total_debito || 0)
  const diferencaCredito = dadosFechamento.valor_credito_informado - (caixaAtual.total_credito || 0)
  const diferencaFinal = diferencaDinheiro + diferencaPix + diferencaDebito + diferencaCredito

  const dadosUpdate = {
    status: 'fechado' as const,
    valor_fechamento: dadosFechamento.valor_final,
    valor_saidas: dadosFechamento.valor_saidas,
    valor_dinheiro_informado: dadosFechamento.valor_dinheiro_informado,
    valor_pix_informado: dadosFechamento.valor_pix_informado,
    valor_debito_informado: dadosFechamento.valor_debito_informado,
    valor_credito_informado: dadosFechamento.valor_credito_informado,
    diferenca: diferencaFinal,
    diferenca_dinheiro: diferencaDinheiro,
    diferenca_pix: diferencaPix,
    diferenca_debito: diferencaDebito,
    diferenca_credito: diferencaCredito,
    observacoes_fechamento: dadosFechamento.observacoes_fechamento || '',
    usuario_fechamento: 'Sistema',
    data_fechamento: new Date().toISOString(),
  }

  await fecharCaixaRepo(supabase, caixaId, dadosUpdate)

  return {
    diferencaFinal,
    diferencaPorForma: {
      dinheiro: diferencaDinheiro,
      pix: diferencaPix,
      debito: diferencaDebito,
      credito: diferencaCredito,
    },
  }
}

/**
 * Registra uma saída no caixa (ex: pagamento de conta, sangria)
 */
export async function registrarSaidaCaixa(
  supabase: SupabaseClient<Database>,
  caixaDiarioId: number,
  valor: number,
  descricao: string
): Promise<void> {
  if (valor <= 0) {
    throw new Error('Valor da saída deve ser maior que zero')
  }

  const hoje = obterDataLocal()

  const { error } = await supabase
    .from('fluxo_caixa')
    .insert({
      data: hoje,
      tipo: 'saida',
      categoria: 'caixa',
      descricao,
      valor,
      caixa_diario_id: caixaDiarioId,
      created_at: new Date().toISOString(),
    } as never)

  if (error) {
    console.error('[registrarSaidaCaixa] Erro ao registrar saída:', error)
    throw error
  }
}

/**
 * Recalcula totais do caixa baseado nas vendas vinculadas
 */
export async function recalcularTotaisCaixa(
  supabase: SupabaseClient<Database>,
  caixaId: number
): Promise<void> {
  // Buscar vendas vinculadas ao caixa
  const { data: vendas, error } = await supabase
    .from('vendas')
    .select('valor_total, forma_pagamento')
    .eq('caixa_diario_id', caixaId)
    .eq('status', 'finalizada')

  if (error) {
    console.error('[recalcularTotaisCaixa] Erro ao buscar vendas:', error)
    throw error
  }

  type VendaTotais = { valor_total?: number; forma_pagamento?: string }
  const vendasList = (vendas || []) as VendaTotais[]
  const totalVendas = vendasList.reduce((sum, v) => sum + (Number(v.valor_total) || 0), 0)

  const totalPorForma = {
    total_dinheiro: 0,
    total_pix: 0,
    total_debito: 0,
    total_credito: 0,
    total_caderneta: 0,
  }

  for (const v of vendasList) {
    const valor = Number(v.valor_total) || 0
    switch (v.forma_pagamento) {
      case 'dinheiro':
        totalPorForma.total_dinheiro += valor
        break
      case 'pix':
        totalPorForma.total_pix += valor
        break
      case 'cartao_debito':
      case 'debito':
        totalPorForma.total_debito += valor
        break
      case 'cartao_credito':
      case 'credito':
        totalPorForma.total_credito += valor
        break
      case 'caderneta':
        totalPorForma.total_caderneta += valor
        break
    }
  }

  await atualizarTotaisCaixa(supabase, caixaId, {
    total_vendas: totalVendas,
    total_entradas: totalVendas,
    ...totalPorForma,
  })
}

// ─── Funções Auxiliares ──────────────────────────────────────────

/**
 * Calcula e atualiza saídas vinculadas a um caixa
 */
async function calcularSaidasCaixa(
  supabase: SupabaseClient<Database>,
  caixa: CaixaDiarioRow
): Promise<CaixaDiarioRow> {
  try {
    const { data: saidasData } = await supabase
      .from('fluxo_caixa')
      .select('valor')
      .eq('caixa_diario_id', caixa.id)
      .eq('tipo', 'saida')

    const saidasList = (saidasData || []) as { valor?: number }[]
    const totalSaidas = saidasList.reduce(
      (sum, r) => sum + (Number(r.valor) || 0),
      0
    )

    // Atualizar no banco
    await supabase
      .from('caixa_diario')
      .update({ valor_saidas: totalSaidas } as never)
      .eq('id', caixa.id)

    return { ...caixa, valor_saidas: totalSaidas }
  } catch (e) {
    console.warn('[calcularSaidasCaixa] Falha ao calcular saídas:', e)
    return caixa
  }
}
