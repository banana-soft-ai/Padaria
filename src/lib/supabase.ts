// Interface para controle de turnos de operador do PDV
export interface TurnoOperador {
  id: number;
  caixa_diario_id: number;
  operador_id: number;
  operador_nome: string;
  data_inicio: string;
  data_fim?: string | null;
  status: string;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
}
// Evite importar este agregador em componentes client.
// Use '@/lib/supabase/client' ou '@/lib/supabase/server'.
export { supabase as client } from './supabase/client'
export { createSupabaseServerClient as server } from './supabase/server'

// Tipos para o banco de dados
export interface Insumo {
  id: number
  nome: string
  marca?: string // Marca do produto
  fornecedor?: string // Fornecedor do produto
  unidade: string // Unidade de medida (kg, g, l, ml, un)
  peso_pacote: number // Peso/quantidade do pacote (ex: 5000g, 1kg, 1l)
  preco_pacote: number // Preço total do pacote
  preco?: number // Preço unitário ou fallback (opcional)
  categoria: 'insumo' | 'varejo' | 'embalagem'
  tipo_estoque: 'insumo' | 'varejo'   // <- aqui
  estoque_atual?: number | null
  estoque_minimo?: number | null
  preco_venda?: number
  codigo_barras: string
  created_at: string
  updated_at: string
}

export interface Receita {
  id: number
  nome: string
  rendimento: number
  unidade_rendimento: string
  categoria: 'pao' | 'doce' | 'salgado' | 'torta' | 'bolo' | 'outro'
  preco_venda?: number
  custosInvisiveis?: number | string
  instrucoes?: string
  created_at: string
  updated_at: string
}

export interface ComposicaoReceita {
  id: number
  receita_id: number
  insumo_id: number
  quantidade: number
  categoria: 'massa' | 'cobertura' | 'embalagem'
  created_at: string
}

// Novos tipos para o sistema de vendas atualizado
export interface ClienteCaderneta {
  id: number
  tipo: 'cliente' | 'colaborador'
  nome: string
  telefone?: string
  endereco?: string
  limite_credito: number
  saldo_devedor: number
  ativo: boolean
  observacoes?: string
  created_at: string
  updated_at: string
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
  created_at: string
  cliente?: ClienteCaderneta
}

export interface ItemVenda {
  id: number
  venda_id: number
  tipo: 'receita' | 'varejo'
  item_id: number
  quantidade: number
  preco_unitario: number
  preco_total: number
  created_at: string
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
  valor_debito: number
  observacoes?: string
  caixa_diario_id?: number
  created_at: string
  updated_at?: string
  cliente?: ClienteCaderneta
  itens?: ItemVenda[]
}

export interface VendaComDetalhes extends Venda {
  itens: (ItemVenda & { item: Receita | Insumo })[]
}

export interface FluxoCaixa {
  id: number
  data: string
  tipo: 'entrada' | 'saida'
  categoria: string
  descricao: string
  valor: number
  observacoes?: string | null
  usuario?: string | null
  created_at: string
}

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
  data_abertura: string
  data_fechamento?: string
  // Novos campos para valores informados no fechamento
  valor_dinheiro_informado?: number
  valor_pix_informado?: number
  valor_debito_informado?: number
  valor_credito_informado?: number
  // Campos para diferenças por forma de pagamento
  diferenca_dinheiro?: number
  diferenca_pix?: number
  diferenca_debito?: number
  diferenca_credito?: number
}

// Novas interfaces para o sistema de caixa robusto
export interface CaixaFormaPagamento {
  id: number
  caixa_diario_id: number
  forma_pagamento: 'pix' | 'debito' | 'credito' | 'dinheiro'
  valor_informado: number
  valor_sistema: number
  diferenca: number
  observacoes?: string
  created_at: string
}

export interface CaixaAuditoria {
  id: number
  caixa_diario_id: number
  tipo_operacao: 'abertura' | 'fechamento' | 'venda' | 'ajuste' | 'correcao'
  descricao: string
  valor_anterior?: number
  valor_novo?: number
  usuario?: string
  timestamp_operacao: string
  detalhes?: Record<string, unknown>
}

export interface CaixaFechamento {
  id: number
  caixa_diario_id: number
  data_fechamento: string
  valor_total_caixa: number
  valor_total_sistema: number
  diferenca_total: number
  status_fechamento: 'pendente' | 'confirmado' | 'corrigido'
  observacoes?: string
  usuario_fechamento?: string
  created_at: string
}

export interface PrecoVenda {
  id: number
  item_id: number
  tipo: 'receita' | 'varejo'
  preco_venda: number
  margem_lucro?: number
  ativo: boolean
  created_at: string
  updated_at: string
}
