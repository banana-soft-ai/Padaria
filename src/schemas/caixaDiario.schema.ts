import { z } from 'zod'

/**
 * Schema Zod para validação de CaixaDiario
 * Baseado em Database['public']['Tables']['caixa_diario']['Row']
 */
export const CaixaDiarioSchema = z.object({
  id: z.number().int().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  status: z.enum(['aberto', 'fechado'], {
    message: 'Status deve ser "aberto" ou "fechado"',
  }),
  valor_abertura: z.number().min(0, 'Valor de abertura não pode ser negativo'),
  valor_fechamento: z.number().min(0).nullable().optional(),

  // Totais de vendas
  total_vendas: z.number().min(0).nullable().optional(),
  total_entradas: z.number().min(0).nullable().optional(),
  valor_saidas: z.number().min(0).nullable().optional(),
  total_saidas: z.number().min(0).nullable().optional(),

  // Totais por forma de pagamento
  total_pix: z.number().min(0).nullable().optional(),
  total_debito: z.number().min(0).nullable().optional(),
  total_credito: z.number().min(0).nullable().optional(),
  total_dinheiro: z.number().min(0).nullable().optional(),
  total_caderneta: z.number().min(0).nullable().optional(),

  // Diferenças (fechamento)
  diferenca: z.number().nullable().optional(),
  diferenca_dinheiro: z.number().nullable().optional(),
  diferenca_pix: z.number().nullable().optional(),
  diferenca_debito: z.number().nullable().optional(),
  diferenca_credito: z.number().nullable().optional(),

  // Valores informados (fechamento)
  valor_dinheiro_informado: z.number().min(0).nullable().optional(),
  valor_pix_informado: z.number().min(0).nullable().optional(),
  valor_debito_informado: z.number().min(0).nullable().optional(),
  valor_credito_informado: z.number().min(0).nullable().optional(),

  // Metadados
  observacoes_abertura: z.string().nullable().optional(),
  observacoes_fechamento: z.string().nullable().optional(),
  usuario_abertura: z.string().nullable().optional(),
  usuario_fechamento: z.string().nullable().optional(),
  data_abertura: z.string().datetime({ message: 'Data de abertura deve ser ISO 8601' }).nullable().optional(),
  data_fechamento: z.string().datetime({ message: 'Data de fechamento deve ser ISO 8601' }).nullable().optional(),
  created_at: z.string().datetime().nullable().optional(),
  updated_at: z.string().datetime().nullable().optional(),
})

/**
 * Schema para criação de novo caixa (Insert)
 */
export const CaixaDiarioInsertSchema = CaixaDiarioSchema.partial().required({
  data: true,
  status: true,
  valor_abertura: true,
})

/**
 * Schema para atualização de caixa (Update)
 */
export const CaixaDiarioUpdateSchema = CaixaDiarioSchema.partial()

/**
 * Tipo inferido do schema
 */
export type CaixaDiarioValidado = z.infer<typeof CaixaDiarioSchema>
export type CaixaDiarioInsertValidado = z.infer<typeof CaixaDiarioInsertSchema>
export type CaixaDiarioUpdateValidado = z.infer<typeof CaixaDiarioUpdateSchema>

/**
 * Função helper para validar dados de CaixaDiario
 * @throws ZodError se dados inválidos
 */
export function validarCaixaDiario(data: unknown): CaixaDiarioValidado {
  return CaixaDiarioSchema.parse(data)
}

/**
 * Função helper para validar dados de Insert
 * @throws ZodError se dados inválidos
 */
export function validarCaixaDiarioInsert(data: unknown): CaixaDiarioInsertValidado {
  return CaixaDiarioInsertSchema.parse(data)
}

/**
 * Função helper para validar dados de Update
 * @throws ZodError se dados inválidos
 */
export function validarCaixaDiarioUpdate(data: unknown): CaixaDiarioUpdateValidado {
  return CaixaDiarioUpdateSchema.parse(data)
}

/**
 * Função safe para validar sem throw (retorna result type)
 */
export function validarCaixaDiarioSafe(data: unknown) {
  return CaixaDiarioSchema.safeParse(data)
}
