/**
 * Tipos usados pela área de gestão (preços, receitas, varejo).
 *
 * Atualizado para incluir campos opcionais (categoria, unidade, estoque, itemNome, etc.)
 * que são usados pela UI e por operações locais (normalização / fallback).
 */

/** Tipos utilitários */
export interface ReceitaSelect { id: number; nome: string }
export interface InsumoSelect { id: number; nome: string }

export interface PrecoVendaPayload {
  tipo: 'receita' | 'varejo'
  item_id: number
  preco_venda: number
  ativo?: boolean
  created_at?: string
  updated_at?: string
}

/** Métricas / insights */
export interface MargemLucro {
  item: string
  tipo: 'receita' | 'varejo'
  custo: number
  receita: number
  lucro: number
  margem: number
}

export interface InsightAI {
  titulo: string
  descricao: string
  recomendacao: string
  prioridade: 'alta' | 'media' | 'baixa'
  categoria: 'lucratividade' | 'custo' | 'vendas' | 'estoque'
}

/** Item de preço usado na UI (normalizado) */
export interface ItemPrecoVenda {
  id: number
  item_id: number
  tipo: 'receita' | 'varejo'

  // Valores principais
  preco_venda: number
  margem_lucro?: number
  preco_custo_unitario?: number

  // Metadados / flags
  ativo?: boolean
  created_at?: string
  updated_at?: string

  // Referência ao item original (quando carregado)
  item?: Receita | Insumo

  // Campos adicionais/normalizados utilizados pela UI
  itemNome?: string
  categoria?: string
  unidade?: string
  estoque?: number
}

/** Relatórios / ranking */
export interface RelatorioVendas {
  item: string
  tipo: 'receita' | 'varejo'
  quantidadeTotal: number
  receitaTotal: number
  mediaVendas: number
  vendasPorDia: { [data: string]: number }
}

export interface RankingVendas {
  item: string
  tipo: 'receita' | 'varejo'
  quantidadeTotal: number
  receitaTotal: number
  posicao: number
}

/** Receita (modelo do banco) */
export interface Receita {
  id: number
  nome: string
  descricao?: string
  // Tornamos categoria opcional para evitar que builds falhem quando não presente
  categoria?: 'massa' | 'cobertura' | 'embalagem'
  rendimento?: number
  unidade_rendimento?: string
  custosInvisiveis?: number | string
  tempo_preparo?: number
  instrucoes?: string
  preco_venda?: number
  created_at?: string
  updated_at?: string
}

/** Insumo / produto de varejo (modelo do banco) */
export interface Insumo {
  id: number
  nome: string
  marca?: string
  fornecedor?: string
  unidade?: string
  peso_pacote?: number
  preco_pacote?: number
  preco?: number
  categoria?: 'insumo' | 'varejo' | 'embalagem'
  preco_venda?: number
  estoque_atual?: number
  preco_custo_unitario?: number
  created_at?: string
  updated_at?: string
}

/** Caixa diário */
export interface CaixaDiario {
  id: number
  data: string
  status: 'aberto' | 'fechado'
  valor_abertura: number
  valor_fechamento?: number
  total_vendas?: number
  total_entradas?: number
  valor_saidas?: number
  total_pix?: number
  total_debito?: number
  total_credito?: number
  total_dinheiro?: number
  total_caderneta?: number
  diferenca?: number
  observacoes_abertura?: string
  observacoes_fechamento?: string
  usuario_abertura?: string
  usuario_fechamento?: string
  data_abertura?: string
  data_fechamento?: string
  created_at?: string
}

/** Sistema de caderneta (clientes) */
export interface ClienteCaderneta {
  id: number
  nome: string
  telefone?: string
  endereco?: string
  limite_credito?: number
  saldo_devedor?: number
  ativo?: boolean
  observacoes?: string
  created_at?: string
  updated_at?: string
}

export interface MovimentacaoCaderneta {
  id: number
  cliente_id: number
  tipo: 'compra' | 'pagamento'
  valor: number
  saldo_anterior: number
  saldo_atual: number
  venda_id?: number
  observacoes?: string
  created_at?: string
  cliente?: ClienteCaderneta
}

/** Vendas e itens de venda */
export interface ItemVenda {
  id: number
  venda_id: number
  tipo: 'receita' | 'varejo'
  item_id: number
  quantidade: number
  preco_unitario: number
  created_at?: string
  item?: Receita | Insumo
}

export interface Venda {
  id: number
  data: string
  hora?: string
  forma_pagamento: 'pix' | 'debito' | 'credito' | 'dinheiro' | 'caderneta'
  cliente_caderneta_id?: number
  valor_total: number
  valor_pago: number
  valor_debito?: number
  observacoes?: string
  caixa_diario_id?: number
  created_at?: string
  updated_at?: string
  cliente?: ClienteCaderneta
  itens?: ItemVenda[]
}

export interface VendaComDetalhes extends Venda {
  itens: (ItemVenda & { item: Receita | Insumo })[]
}

/** Tipos de formulário */
export interface ItemVendaForm {
  item_id: string
  tipo: 'receita' | 'varejo'
  quantidade: string
  preco_unitario: string
  produto_nome: string
}

export interface VendaFormData {
  data: string
  forma_pagamento: 'pix' | 'debito' | 'credito' | 'dinheiro' | 'caderneta'
  cliente_caderneta_id?: string
  valor_pago: string
  observacoes?: string
}

/** Formulários cliente / caixa / fechamento / pagamento caderneta */
export interface ClienteFormData {
  nome: string
  telefone?: string
  endereco?: string
  limite_credito?: string
  observacoes?: string
}

export interface CaixaFormData {
  data: string
  valor_abertura: string
  observacoes_abertura?: string
}

export interface FechamentoCaixaFormData {
  valor_fechamento: string
  observacoes_fechamento?: string
}

export interface PagamentoCadernetaFormData {
  cliente_id: string
  valor: string
  observacoes?: string
}

/** Lucratividade */
export interface CustoFixo {
  id: number
  descricao: string
  valor: number
  categoria: 'aluguel' | 'energia' | 'agua' | 'salarios' | 'outros'
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export interface ItemLucratividade {
  item: string
  tipo: 'receita' | 'varejo'
  quantidadeVendida: number
  precoVenda: number
  custoUnitario: number
  receitaTotal: number
  custoTotal: number
  lucroBruto: number
  margemLucro: number
}

export interface ResumoLucratividade {
  receitaTotal: number
  custoTotalProdutos: number
  lucroBrutoTotal: number
  custosFixosTotal: number
  lucroLiquido: number
  margemLucroBruta: number
  margemLucroLiquida: number
  roi: number
}

export interface CustoFixoFormData {
  descricao: string
  valor: string
  categoria: 'aluguel' | 'energia' | 'agua' | 'salarios' | 'outros'
}