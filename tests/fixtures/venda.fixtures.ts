import type { Database } from '@/lib/supabase/types'

/**
 * Fixtures para testes de Vendas
 *
 * Fornece dados de mock realistas para vendas e itens de venda
 */

export type Venda = Database['public']['Tables']['vendas']['Row']
export type VendaInsert = Database['public']['Tables']['vendas']['Insert']
export type ItemVenda = Database['public']['Tables']['venda_itens']['Row']
export type ItemVendaInsert = Database['public']['Tables']['venda_itens']['Insert']

/**
 * Venda simples em dinheiro
 */
export const VENDA_DINHEIRO_MOCK: Venda = {
  id: 1,
  data: '2026-02-13',
  hora: '10:30:00',
  numero_venda: 1001,

  forma_pagamento: 'dinheiro',
  cliente_caderneta_id: null,

  valor_total: 50.00,
  valor_pago: 60.00,
  valor_debito: 0,
  valor_troco: 10.00,
  desconto: 0,

  status: 'finalizada',
  observacoes: null,
  caixa_diario_id: 1,

  created_at: '2026-02-13T10:30:00Z',
  updated_at: null,
}

/**
 * Venda em PIX
 */
export const VENDA_PIX_MOCK: Venda = {
  id: 2,
  data: '2026-02-13',
  hora: '11:00:00',
  numero_venda: 1002,

  forma_pagamento: 'pix',
  cliente_caderneta_id: null,

  valor_total: 120.50,
  valor_pago: 120.50,
  valor_debito: 0,
  valor_troco: 0,
  desconto: 0,

  status: 'finalizada',
  observacoes: null,
  caixa_diario_id: 1,

  created_at: '2026-02-13T11:00:00Z',
  updated_at: null,
}

/**
 * Venda em cartão de débito
 */
export const VENDA_DEBITO_MOCK: Venda = {
  id: 3,
  data: '2026-02-13',
  hora: '14:15:00',
  numero_venda: 1003,

  forma_pagamento: 'debito',
  cliente_caderneta_id: null,

  valor_total: 85.00,
  valor_pago: 85.00,
  valor_debito: 0,
  valor_troco: 0,
  desconto: 5.00,

  status: 'finalizada',
  observacoes: 'Desconto de R$ 5',
  caixa_diario_id: 1,

  created_at: '2026-02-13T14:15:00Z',
  updated_at: null,
}

/**
 * Venda em cartão de crédito
 */
export const VENDA_CREDITO_MOCK: Venda = {
  id: 4,
  data: '2026-02-13',
  hora: '16:45:00',
  numero_venda: 1004,

  forma_pagamento: 'credito',
  cliente_caderneta_id: null,

  valor_total: 200.00,
  valor_pago: 200.00,
  valor_debito: 0,
  valor_troco: 0,
  desconto: 0,

  status: 'finalizada',
  observacoes: null,
  caixa_diario_id: 1,

  created_at: '2026-02-13T16:45:00Z',
  updated_at: null,
}

/**
 * Venda na caderneta (a prazo)
 */
export const VENDA_CADERNETA_MOCK: Venda = {
  id: 5,
  data: '2026-02-13',
  hora: '17:00:00',
  numero_venda: 1005,

  forma_pagamento: 'caderneta',
  cliente_caderneta_id: 10, // ID do cliente

  valor_total: 75.00,
  valor_pago: 0, // Não pago no ato
  valor_debito: 75.00, // Débito na caderneta
  valor_troco: 0,
  desconto: 0,

  status: 'finalizada',
  observacoes: 'Venda a prazo - Cliente João',
  caixa_diario_id: 1,

  created_at: '2026-02-13T17:00:00Z',
  updated_at: null,
}

/**
 * Venda pendente (não finalizada)
 */
export const VENDA_PENDENTE_MOCK: Venda = {
  id: 6,
  data: '2026-02-13',
  hora: '18:00:00',
  numero_venda: 1006,

  forma_pagamento: 'dinheiro',
  cliente_caderneta_id: null,

  valor_total: 30.00,
  valor_pago: 0,
  valor_debito: 0,
  valor_troco: 0,
  desconto: 0,

  status: 'pendente',
  observacoes: 'Cliente foi buscar dinheiro',
  caixa_diario_id: 1,

  created_at: '2026-02-13T18:00:00Z',
  updated_at: null,
}

/**
 * Item de venda - Receita (produto pesado)
 */
export const ITEM_VENDA_RECEITA_MOCK: ItemVenda = {
  id: 1,
  venda_id: 1,
  tipo: 'receita',
  item_id: 100,
  varejo_id: undefined,
  quantidade: 0.5, // 500g
  preco_unitario: 20.00, // R$ 20/kg
  subtotal: 10.00,
  preco_total: 10.00,
  created_at: '2026-02-13T10:30:00Z',
}

/**
 * Item de venda - Varejo (produto unitário)
 */
export const ITEM_VENDA_VAREJO_MOCK: ItemVenda = {
  id: 2,
  venda_id: 1,
  tipo: 'varejo',
  item_id: undefined,
  varejo_id: 200,
  quantidade: 2, // 2 unidades
  preco_unitario: 20.00,
  subtotal: 40.00,
  preco_total: 40.00,
  created_at: '2026-02-13T10:30:00Z',
}

/**
 * Helper para criar venda customizada
 */
export function criarVendaMock(overrides?: Partial<Venda>): Venda {
  return { ...VENDA_DINHEIRO_MOCK, ...overrides }
}

/**
 * Helper para criar Insert de venda
 */
export function criarVendaInsertMock(overrides?: Partial<VendaInsert>): VendaInsert {
  const base: VendaInsert = {
    numero_venda: 900001, // obrigatório no banco (BIGINT NOT NULL); valor alto para não colidir com produção
    data: '2026-02-13',
    hora: '10:00:00',
    forma_pagamento: 'dinheiro',
    valor_total: 50.00,
    valor_pago: 50.00,
    valor_debito: 0,
    valor_troco: 0,
    desconto: 0,
    status: 'finalizada',
    caixa_diario_id: 1,
  }
  return { ...base, ...overrides }
}

/**
 * Helper para criar item de venda
 */
export function criarItemVendaMock(overrides?: Partial<ItemVenda>): ItemVenda {
  return { ...ITEM_VENDA_RECEITA_MOCK, ...overrides }
}

/**
 * Helper para criar Insert de item
 */
export function criarItemVendaInsertMock(overrides?: Partial<ItemVendaInsert>): ItemVendaInsert {
  const base: ItemVendaInsert = {
    venda_id: 1,
    tipo: 'receita',
    item_id: 100,
    quantidade: 1,
    preco_unitario: 10.00,
    subtotal: 10.00,
    preco_total: 10.00,
  }
  return { ...base, ...overrides }
}

/**
 * Venda completa (venda + itens) para testes E2E
 */
export const VENDA_COMPLETA_MOCK = {
  venda: VENDA_DINHEIRO_MOCK,
  itens: [ITEM_VENDA_RECEITA_MOCK, ITEM_VENDA_VAREJO_MOCK],
}

/**
 * Array de vendas do dia para testes de listagem
 */
export const VENDAS_DO_DIA_MOCK: Venda[] = [
  VENDA_DINHEIRO_MOCK,
  VENDA_PIX_MOCK,
  VENDA_DEBITO_MOCK,
  VENDA_CREDITO_MOCK,
  VENDA_CADERNETA_MOCK,
]

/**
 * Totais esperados das vendas do dia (para validação)
 */
export const TOTAIS_ESPERADOS_MOCK = {
  total_vendas: 530.50, // soma de todas as vendas finalizadas
  total_dinheiro: 50.00,
  total_pix: 120.50,
  total_debito: 85.00,
  total_credito: 200.00,
  total_caderneta: 75.00,
  quantidade_vendas: 5,
}
