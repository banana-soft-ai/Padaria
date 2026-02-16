import { z } from 'zod'

/**
 * Schema Zod para validação de Venda
 * Baseado em Database['public']['Tables']['vendas']['Row']
 */
export const VendaSchema = z.object({
  id: z.number().int().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  hora: z.string().nullable().optional(),
  numero_venda: z.number().int().positive().optional(),

  forma_pagamento: z.enum(['pix', 'cartao_debito', 'cartao_credito', 'dinheiro', 'caderneta', 'debito', 'credito'], {
    message: 'Forma de pagamento inválida',
  }),

  cliente_caderneta_id: z.number().int().positive().nullable().optional(),

  valor_total: z.number().min(0, 'Valor total não pode ser negativo'),
  valor_pago: z.number().min(0, 'Valor pago não pode ser negativo'),
  valor_debito: z.number().min(0, 'Valor débito não pode ser negativo').default(0),
  valor_troco: z.number().min(0, 'Valor troco não pode ser negativo').optional(),
  desconto: z.number().min(0, 'Desconto não pode ser negativo').optional(),

  status: z.enum(['finalizada', 'pendente', 'cancelada']).default('finalizada'),

  observacoes: z.string().nullable().optional(),
  caixa_diario_id: z.number().int().positive().nullable().optional(),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
})

/**
 * Schema para item de venda
 * Baseado em Database['public']['Tables']['venda_itens']['Row']
 */
export const ItemVendaSchema = z.object({
  id: z.number().int().positive(),
  venda_id: z.number().int().positive(),
  tipo: z.enum(['receita', 'varejo'], {
    message: 'Tipo deve ser "receita" ou "varejo"',
  }),
  item_id: z.number().int().positive().optional(),
  varejo_id: z.number().int().positive().optional(),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  preco_unitario: z.number().min(0, 'Preço unitário não pode ser negativo'),
  subtotal: z.number().min(0).optional(),
  preco_total: z.number().min(0).optional(),
  created_at: z.string().datetime(),
})

/**
 * Schema para criação de venda (Insert)
 */
export const VendaInsertSchema = VendaSchema.partial().required({
  data: true,
  forma_pagamento: true,
  valor_total: true,
  valor_pago: true,
  valor_debito: true,
}).refine(
  (data) => {
    // Se forma de pagamento é caderneta, cliente_caderneta_id é obrigatório
    if (data.forma_pagamento === 'caderneta' && !data.cliente_caderneta_id) {
      return false
    }
    return true
  },
  {
    message: 'Venda na caderneta requer cliente_caderneta_id',
    path: ['cliente_caderneta_id'],
  }
).refine(
  (data) => {
    // valor_pago deve ser >= valor_total (exceto caderneta)
    if (data.forma_pagamento !== 'caderneta' && data.valor_pago && data.valor_total) {
      return data.valor_pago >= data.valor_total - (data.desconto || 0)
    }
    return true
  },
  {
    message: 'Valor pago deve ser >= valor total - desconto',
    path: ['valor_pago'],
  }
)

/**
 * Schema para Item de Venda (Insert)
 */
export const ItemVendaInsertSchema = ItemVendaSchema.partial().required({
  venda_id: true,
  tipo: true,
  quantidade: true,
  preco_unitario: true,
})

/**
 * Schema para criação de venda completa (venda + itens)
 */
export const VendaCompletaSchema = z.object({
  venda: VendaInsertSchema,
  itens: z.array(ItemVendaInsertSchema.omit({ venda_id: true })).min(1, 'Venda deve ter pelo menos 1 item'),
})

/**
 * Tipos inferidos
 */
export type VendaValidada = z.infer<typeof VendaSchema>
export type ItemVendaValidado = z.infer<typeof ItemVendaSchema>
export type VendaInsertValidada = z.infer<typeof VendaInsertSchema>
export type ItemVendaInsertValidado = z.infer<typeof ItemVendaInsertSchema>
export type VendaCompletaValidada = z.infer<typeof VendaCompletaSchema>

/**
 * Funções helpers de validação
 */
export function validarVenda(data: unknown): VendaValidada {
  return VendaSchema.parse(data)
}

export function validarVendaInsert(data: unknown): VendaInsertValidada {
  return VendaInsertSchema.parse(data)
}

export function validarItemVenda(data: unknown): ItemVendaValidado {
  return ItemVendaSchema.parse(data)
}

export function validarVendaCompleta(data: unknown): VendaCompletaValidada {
  return VendaCompletaSchema.parse(data)
}

/**
 * Validação safe (não lança exceção)
 */
export function validarVendaSafe(data: unknown) {
  return VendaSchema.safeParse(data)
}
