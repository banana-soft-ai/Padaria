/**
 * Tipos compartilhados para o PDV (Ponto de Venda)
 */

export interface ItemCarrinhoPDV {
  id: number
  nome: string
  preco: number
  qtdCarrinho: number
  unidade: string
  codigoBarras?: string
  codigoBalanca?: string
  estoque?: number
}

export interface ProdutoPDV {
  id: number
  nome: string
  preco: number
  unidade: string
  codigoBarras?: string
  codigoBalanca?: string
  estoque?: number
}

export interface ClienteCadernetaPDV {
  id: number
  nome: string
  telefone?: string
  cpf_cnpj?: string
  saldo_devedor?: number
  limite_credito?: number
}

export type FormaPagamentoPDV =
  | 'dinheiro'
  | 'pix'
  | 'debito'
  | 'credito'
  | 'caderneta'

export interface DadosConfirmacaoVenda {
  forma_pagamento: FormaPagamentoPDV
  valor_pago?: number
  troco?: number
  cliente_caderneta_id?: number
}
