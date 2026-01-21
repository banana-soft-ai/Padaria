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
