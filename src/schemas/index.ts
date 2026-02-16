/**
 * Schemas Zod - Exports centralizados
 *
 * Este arquivo centraliza todos os schemas de validação do sistema.
 * Use os schemas para validar dados vindos do Supabase ou de inputs do usuário.
 *
 * @example
 * ```typescript
 * import { validarCaixaDiario } from '@/schemas'
 *
 * const caixa = validarCaixaDiario(data) // Throws se inválido
 * ```
 */

// CaixaDiario
export {
  CaixaDiarioSchema,
  CaixaDiarioInsertSchema,
  CaixaDiarioUpdateSchema,
  validarCaixaDiario,
  validarCaixaDiarioInsert,
  validarCaixaDiarioUpdate,
  validarCaixaDiarioSafe,
  type CaixaDiarioValidado,
  type CaixaDiarioInsertValidado,
  type CaixaDiarioUpdateValidado,
} from './caixaDiario.schema'

// Venda
export {
  VendaSchema,
  ItemVendaSchema,
  VendaInsertSchema,
  ItemVendaInsertSchema,
  VendaCompletaSchema,
  validarVenda,
  validarVendaInsert,
  validarItemVenda,
  validarVendaCompleta,
  validarVendaSafe,
  type VendaValidada,
  type ItemVendaValidado,
  type VendaInsertValidada,
  type ItemVendaInsertValidado,
  type VendaCompletaValidada,
} from './venda.schema'

// Caderneta
export {
  ClienteCadernetaSchema,
  MovimentacaoCadernetaSchema,
  ClienteCadernetaInsertSchema,
  ClienteCadernetaUpdateSchema,
  MovimentacaoCadernetaInsertSchema,
  RegistrarPagamentoCadernetaSchema,
  RegistrarCompraCadernetaSchema,
  validarClienteCaderneta,
  validarClienteCadernetaInsert,
  validarMovimentacaoCaderneta,
  validarRegistrarPagamento,
  validarClienteCadernetaSafe,
  type ClienteCadernetaValidado,
  type MovimentacaoCadernetaValidada,
  type ClienteCadernetaInsertValidado,
  type ClienteCadernetaUpdateValidado,
  type MovimentacaoCadernetaInsertValidada,
  type RegistrarPagamentoCadernetaValidado,
  type RegistrarCompraCadernetaValidada,
} from './caderneta.schema'
