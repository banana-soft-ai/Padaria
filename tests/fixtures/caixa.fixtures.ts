import type { Database } from '@/lib/supabase/types'

/**
 * Fixtures para testes de CaixaDiario
 *
 * Fornece dados de mock realistas para testes unitários e E2E
 */

export type CaixaDiario = Database['public']['Tables']['caixa_diario']['Row']
export type CaixaDiarioInsert = Database['public']['Tables']['caixa_diario']['Insert']
export type CaixaDiarioUpdate = Database['public']['Tables']['caixa_diario']['Update']

/**
 * Caixa aberto padrão (estado inicial do dia)
 */
export const CAIXA_ABERTO_MOCK: CaixaDiario = {
  id: 1,
  data: '2026-02-13',
  status: 'aberto',
  valor_abertura: 100,
  valor_fechamento: null,

  // Totais (null quando aberto)
  total_vendas: null,
  total_entradas: null,
  valor_saidas: null,
  total_saidas: null,

  // Totais por forma de pagamento
  total_pix: null,
  total_debito: null,
  total_credito: null,
  total_dinheiro: null,
  total_caderneta: null,

  // Diferenças (calculadas no fechamento)
  diferenca: null,
  diferenca_dinheiro: null,
  diferenca_pix: null,
  diferenca_debito: null,
  diferenca_credito: null,

  // Valores informados (preenchidos no fechamento)
  valor_dinheiro_informado: null,
  valor_pix_informado: null,
  valor_debito_informado: null,
  valor_credito_informado: null,

  // Metadados
  data_abertura: '2026-02-13T08:00:00Z',
  data_fechamento: null,
  usuario_abertura: 'Admin',
  usuario_fechamento: null,
  observacoes_abertura: 'Abertura normal',
  observacoes_fechamento: null,
  created_at: '2026-02-13T08:00:00Z',
  updated_at: null,
}

/**
 * Caixa fechado com vendas e diferenças
 */
export const CAIXA_FECHADO_MOCK: CaixaDiario = {
  id: 2,
  data: '2026-02-12',
  status: 'fechado',
  valor_abertura: 100,
  valor_fechamento: 1500,

  // Totais do dia
  total_vendas: 1200,
  total_entradas: 1200,
  valor_saidas: 50,
  total_saidas: 50,

  // Totais por forma de pagamento (soma = 1200)
  total_pix: 300,
  total_debito: 400,
  total_credito: 200,
  total_dinheiro: 300,
  total_caderneta: 0,

  // Diferenças (informado vs esperado)
  diferenca: 10, // R$ 10 a mais no caixa
  diferenca_dinheiro: 5,
  diferenca_pix: 3,
  diferenca_debito: 2,
  diferenca_credito: 0,

  // Valores informados pelo usuário
  valor_dinheiro_informado: 305, // esperado: 300, diferença: +5
  valor_pix_informado: 303,      // esperado: 300, diferença: +3
  valor_debito_informado: 402,   // esperado: 400, diferença: +2
  valor_credito_informado: 200,  // esperado: 200, diferença: 0

  // Metadados
  data_abertura: '2026-02-12T08:00:00Z',
  data_fechamento: '2026-02-12T18:00:00Z',
  usuario_abertura: 'Admin',
  usuario_fechamento: 'Admin',
  observacoes_abertura: 'Abertura normal',
  observacoes_fechamento: 'Fechamento com diferença de R$ 10',
  created_at: '2026-02-12T08:00:00Z',
  updated_at: '2026-02-12T18:00:00Z',
}

/**
 * Caixa fechado sem diferenças (valores bateram perfeitamente)
 */
export const CAIXA_FECHADO_SEM_DIFERENCAS_MOCK: CaixaDiario = {
  ...CAIXA_FECHADO_MOCK,
  id: 3,
  data: '2026-02-11',
  diferenca: 0,
  diferenca_dinheiro: 0,
  diferenca_pix: 0,
  diferenca_debito: 0,
  diferenca_credito: 0,
  valor_dinheiro_informado: 300, // exato
  valor_pix_informado: 300,      // exato
  valor_debito_informado: 400,   // exato
  valor_credito_informado: 200,  // exato
  observacoes_fechamento: 'Fechamento perfeito, sem diferenças',
}

/**
 * Caixa com diferença negativa (falta de dinheiro)
 */
export const CAIXA_COM_DIFERENCA_NEGATIVA_MOCK: CaixaDiario = {
  ...CAIXA_FECHADO_MOCK,
  id: 4,
  data: '2026-02-10',
  diferenca: -20,
  diferenca_dinheiro: -15,
  diferenca_pix: -5,
  diferenca_debito: 0,
  diferenca_credito: 0,
  valor_dinheiro_informado: 285, // esperado: 300, diferença: -15
  valor_pix_informado: 295,      // esperado: 300, diferença: -5
  valor_debito_informado: 400,
  valor_credito_informado: 200,
  observacoes_fechamento: 'ATENÇÃO: Falta R$ 20 no caixa',
}

/**
 * Helper para criar caixa customizado
 */
export function criarCaixaMock(overrides?: Partial<CaixaDiario>): CaixaDiario {
  return { ...CAIXA_ABERTO_MOCK, ...overrides }
}

/**
 * Helper para criar dados de Insert
 */
export function criarCaixaInsertMock(overrides?: Partial<CaixaDiarioInsert>): CaixaDiarioInsert {
  const base: CaixaDiarioInsert = {
    data: '2026-02-13',
    status: 'aberto',
    valor_abertura: 100,
    usuario_abertura: 'Admin',
    observacoes_abertura: 'Abertura teste',
    data_abertura: '2026-02-13T08:00:00Z',
  }
  return { ...base, ...overrides }
}

/**
 * Helper para criar dados de Update (fechamento)
 */
export function criarCaixaUpdateFechamentoMock(overrides?: Partial<CaixaDiarioUpdate>): CaixaDiarioUpdate {
  const base: CaixaDiarioUpdate = {
    status: 'fechado',
    valor_fechamento: 1500,
    total_vendas: 1200,
    total_entradas: 1200,
    valor_saidas: 50,
    total_saidas: 50,
    total_pix: 300,
    total_debito: 400,
    total_credito: 200,
    total_dinheiro: 300,
    total_caderneta: 0,
    diferenca: 0,
    diferenca_dinheiro: 0,
    diferenca_pix: 0,
    diferenca_debito: 0,
    diferenca_credito: 0,
    valor_dinheiro_informado: 300,
    valor_pix_informado: 300,
    valor_debito_informado: 400,
    valor_credito_informado: 200,
    data_fechamento: '2026-02-13T18:00:00Z',
    usuario_fechamento: 'Admin',
    observacoes_fechamento: 'Fechamento teste',
    updated_at: '2026-02-13T18:00:00Z',
  }
  return { ...base, ...overrides }
}

/**
 * Array de múltiplos caixas para testes de listagem
 */
export const CAIXAS_LISTA_MOCK: CaixaDiario[] = [
  CAIXA_ABERTO_MOCK,
  CAIXA_FECHADO_MOCK,
  CAIXA_FECHADO_SEM_DIFERENCAS_MOCK,
  CAIXA_COM_DIFERENCA_NEGATIVA_MOCK,
]
