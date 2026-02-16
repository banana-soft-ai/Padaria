import { z } from 'zod'

/**
 * Schema Zod para validação de ClienteCaderneta
 * Baseado em interface ClienteCaderneta de types/gestao.ts
 */
export const ClienteCadernetaSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  endereco: z.string().optional(),
  limite_credito: z.number().min(0, 'Limite de crédito não pode ser negativo').optional(),
  saldo_devedor: z.number().min(0, 'Saldo devedor não pode ser negativo').optional(),
  ativo: z.boolean().default(true),
  observacoes: z.string().optional(),
  created_at: z.string().datetime().optional(),
})

/**
 * Schema para MovimentacaoCaderneta
 * Baseado em interface MovimentacaoCaderneta de types/gestao.ts
 */
export const MovimentacaoCadernetaSchema = z.object({
  id: z.number().int().positive(),
  cliente_id: z.number().int().positive(),
  tipo: z.enum(['compra', 'pagamento'], {
    message: 'Tipo deve ser "compra" ou "pagamento"',
  }),
  valor: z.number().positive('Valor deve ser maior que zero'),
  saldo_anterior: z.number().min(0, 'Saldo anterior não pode ser negativo'),
  saldo_atual: z.number().min(0, 'Saldo atual não pode ser negativo'),
  venda_id: z.number().int().positive().optional(),
  observacoes: z.string().optional(),
  created_at: z.string().datetime().optional(),
  cliente: ClienteCadernetaSchema.optional(),
})

/**
 * Schema para criação de Cliente (Insert)
 */
export const ClienteCadernetaInsertSchema = ClienteCadernetaSchema.partial().required({
  nome: true,
}).refine(
  (data) => {
    // Se limite_credito definido, saldo_devedor <= limite_credito
    if (data.limite_credito !== undefined && data.saldo_devedor !== undefined) {
      return data.saldo_devedor <= data.limite_credito
    }
    return true
  },
  {
    message: 'Saldo devedor não pode exceder limite de crédito',
    path: ['saldo_devedor'],
  }
)

/**
 * Schema para atualização de Cliente (Update)
 */
export const ClienteCadernetaUpdateSchema = ClienteCadernetaSchema.partial()

/**
 * Schema para criação de Movimentação (Insert)
 */
export const MovimentacaoCadernetaInsertSchema = MovimentacaoCadernetaSchema.partial().required({
  cliente_id: true,
  tipo: true,
  valor: true,
  saldo_anterior: true,
  saldo_atual: true,
}).refine(
  (data) => {
    // Validar saldo: compra aumenta, pagamento diminui
    if (data.tipo === 'compra') {
      return data.saldo_atual === data.saldo_anterior + data.valor
    } else if (data.tipo === 'pagamento') {
      return data.saldo_atual === data.saldo_anterior - data.valor
    }
    return true
  },
  {
    message: 'Saldo atual não bate com cálculo (saldo_anterior ± valor)',
    path: ['saldo_atual'],
  }
)

/**
 * Schema para registrar pagamento
 */
export const RegistrarPagamentoCadernetaSchema = z.object({
  cliente_id: z.number().int().positive(),
  valor: z.number().positive('Valor deve ser maior que zero'),
  forma_pagamento: z.enum(['pix', 'debito', 'credito', 'dinheiro'], {
    message: 'Forma de pagamento inválida para caderneta',
  }).optional(),
  observacoes: z.string().optional(),
})

/**
 * Schema para registrar compra (débito na caderneta)
 */
export const RegistrarCompraCadernetaSchema = z.object({
  cliente_id: z.number().int().positive(),
  venda_id: z.number().int().positive(),
  valor: z.number().positive('Valor deve ser maior que zero'),
  observacoes: z.string().optional(),
}).refine(
  async (data) => {
    // TODO: Validar se cliente tem limite disponível
    // Esta validação pode ser feita no service layer
    return true
  },
  {
    message: 'Cliente excedeu limite de crédito',
    path: ['valor'],
  }
)

/**
 * Tipos inferidos
 */
export type ClienteCadernetaValidado = z.infer<typeof ClienteCadernetaSchema>
export type MovimentacaoCadernetaValidada = z.infer<typeof MovimentacaoCadernetaSchema>
export type ClienteCadernetaInsertValidado = z.infer<typeof ClienteCadernetaInsertSchema>
export type ClienteCadernetaUpdateValidado = z.infer<typeof ClienteCadernetaUpdateSchema>
export type MovimentacaoCadernetaInsertValidada = z.infer<typeof MovimentacaoCadernetaInsertSchema>
export type RegistrarPagamentoCadernetaValidado = z.infer<typeof RegistrarPagamentoCadernetaSchema>
export type RegistrarCompraCadernetaValidada = z.infer<typeof RegistrarCompraCadernetaSchema>

/**
 * Funções helpers de validação
 */
export function validarClienteCaderneta(data: unknown): ClienteCadernetaValidado {
  return ClienteCadernetaSchema.parse(data)
}

export function validarClienteCadernetaInsert(data: unknown): ClienteCadernetaInsertValidado {
  return ClienteCadernetaInsertSchema.parse(data)
}

export function validarMovimentacaoCaderneta(data: unknown): MovimentacaoCadernetaValidada {
  return MovimentacaoCadernetaSchema.parse(data)
}

export function validarRegistrarPagamento(data: unknown): RegistrarPagamentoCadernetaValidado {
  return RegistrarPagamentoCadernetaSchema.parse(data)
}

/**
 * Validação safe (não lança exceção)
 */
export function validarClienteCadernetaSafe(data: unknown) {
  return ClienteCadernetaSchema.safeParse(data)
}
