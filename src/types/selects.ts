// Tipos para selects parciais em listagens
// Regra: nunca usar Row completo, sempre usar Selects

export interface ReceitaSelect {
  id: number;
  nome: string;
}

export interface InsumoSelect {
  id: number;
  nome: string;
}

export type AutocompleteItemTable = 'receitas' | 'produtos' | 'varejo' | 'insumos';

export interface AutocompleteItem {
  id: number;
  nome: string;
  table?: AutocompleteItemTable;
  unidade?: string;
  categoria?: string;
  estoque_atual?: number;
  preco_venda?: number;
  preco_custo_unitario?: number;
  codigo_barras?: string;
  rendimento?: number;
  unidade_rendimento?: string;
}
