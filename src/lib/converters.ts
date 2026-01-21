// Gerado automaticamente: funções utilitárias para normalizar objetos vindos do banco
// Observação: usamos `import type` para evitar trazer módulos em tempo de execução.
import type * as Gestao from '../types/gestao'
import type * as Supabase from './supabase'


function toNumber(v: any, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
function toString(v: any, fallback = '') {
  return v == null ? fallback : String(v)
}
function toNullableString(v: any) {
  return v == null ? null : String(v)
}
function toISODate(v: any, fallback = new Date().toISOString()) {
  return v ? String(v) : fallback
}

import type { Receita as ReceitaSupabase } from './supabase'
export function toReceita(obj: any): ReceitaSupabase {
  return {
    id: toNumber(obj?.id, 0),
    nome: toString(obj?.nome, ''),
    rendimento: toNumber(obj?.rendimento, 0),
    unidade_rendimento: toString(obj?.unidade_rendimento, ''),
    categoria: (obj?.categoria as ReceitaSupabase['categoria']) || 'outro',
    preco_venda: obj?.preco_venda ?? undefined,
    instrucoes: obj?.instrucoes ?? undefined,
    created_at: toISODate(obj?.created_at),
    updated_at: obj?.updated_at ?? '',
  }
}

import type { Insumo as InsumoSupabase } from './supabase'
export function toInsumo(obj: any): InsumoSupabase {
  return {
    id: toNumber(obj?.id, 0),
    nome: toString(obj?.nome, ''),
    marca: obj?.marca ?? undefined,
    fornecedor: obj?.fornecedor ?? undefined,
    unidade: toString(obj?.unidade, ''),
    peso_pacote: toNumber(obj?.peso_pacote, 0),
    preco_pacote: toNumber(obj?.preco_pacote, 0),
    categoria: (obj?.categoria as InsumoSupabase['categoria']) || 'insumo',
    tipo_estoque: (obj?.tipo_estoque as InsumoSupabase['tipo_estoque']) || 'insumo',
    estoque_atual: obj?.estoque_atual ?? null,
    estoque_minimo: obj?.estoque_minimo ?? null,
    preco_venda: obj?.preco_venda ?? undefined,
    codigo_barras: obj?.codigo_barras ? String(obj.codigo_barras) : '',
    created_at: toISODate(obj?.created_at),
    updated_at: obj?.updated_at ?? '',
  }
}

export function toProduto(obj: any): any {
  return {
    id: toString(obj?.id, ''),
    nome: toString(obj?.nome, ''),
    codigo: obj?.codigo ?? '',
    unidade: obj?.unidade ?? '',
    grupo: obj?.grupo ?? '',
    preco_venda: obj?.preco_venda ?? 0,
    icms: obj?.icms ?? 0,
    ncm: obj?.ncm ?? '',
    cfop: obj?.cfop ?? '',
    descricao: obj?.descricao ?? '',
    imagem: obj?.imagem ?? '',
    categoria: obj?.categoria ?? '',
    preco: obj?.preco ?? 0,
    custo: obj?.custo ?? 0,
    estoque: obj?.estoque ?? 0,
    codigoBarras: obj?.codigoBarras ?? '',
  }
}

import type { ClienteCaderneta as ClienteCadernetaSupabase } from './supabase'
export function toClienteCaderneta(obj: any): ClienteCadernetaSupabase {
  return {
    id: toNumber(obj?.id, 0),
    tipo: (obj?.tipo as ClienteCadernetaSupabase['tipo']) || 'cliente',
    nome: toString(obj?.nome, ''),
    telefone: obj?.telefone ?? undefined,
    endereco: obj?.endereco ?? undefined,
    limite_credito: toNumber(obj?.limite_credito, 0),
    saldo_devedor: toNumber(obj?.saldo_devedor, 0),
    ativo: typeof obj?.ativo === 'boolean' ? obj.ativo : Boolean(obj?.ativo ?? true),
    observacoes: obj?.observacoes ?? undefined,
    created_at: toISODate(obj?.created_at),
    updated_at: obj?.updated_at ?? '',
  }
}

export function toItemVenda(obj: any): Gestao.ItemVenda {
  const precoUnit = toNumber(obj?.preco_unitario ?? obj?.preco ?? obj?.preco_total, 0)
  const quantidade = toNumber(obj?.quantidade, 0)
  const precoTotal = obj?.preco_total !== undefined ? toNumber(obj?.preco_total, 0) : precoUnit * quantidade

  // Detecta tipo de item pela presença de campos específicos (rendimento => Receita)
  const itemNormalized = obj?.item
    ? (obj.item.rendimento !== undefined ? toReceita(obj.item) : toInsumo(obj.item))
    : undefined

  return {
    id: toNumber(obj?.id, 0),
    venda_id: toNumber(obj?.venda_id, 0),
    tipo: (obj?.tipo as Gestao.ItemVenda['tipo']) || 'varejo',
    item_id: toNumber(obj?.item_id, 0),
    quantidade,
    preco_unitario: precoUnit,
    created_at: toISODate(obj?.created_at),
    preco_total: precoTotal,
    item: itemNormalized,
  } as Gestao.ItemVenda
}

import type { Venda as VendaSupabase } from './supabase'

export function toVenda(obj: any): VendaSupabase {
  return {
    id: toNumber(obj?.id, 0),
    data: (obj?.data ? String(obj.data) : new Date().toISOString()).split('T')[0],
    hora: obj?.hora ?? undefined,
    forma_pagamento: (obj?.forma_pagamento as Gestao.Venda['forma_pagamento']) || 'dinheiro',
    cliente_caderneta_id: obj?.cliente_caderneta_id ?? undefined,
    valor_total: toNumber(obj?.valor_total ?? obj?.valor, 0),
    // corrige fallback para usar `valor` caso `valor_pago` não exista
    valor_pago: toNumber(obj?.valor_pago ?? obj?.valor, 0),
    valor_debito: toNumber(obj?.valor_debito ?? 0, 0),
    observacoes: obj?.observacoes ?? undefined,
    caixa_diario_id: obj?.caixa_diario_id ?? undefined,
    created_at: toISODate(obj?.created_at),
    updated_at: obj?.updated_at ?? undefined,
    cliente: obj?.cliente ? toClienteCaderneta(obj.cliente) : undefined,
    itens: Array.isArray(obj?.itens) ? obj.itens.map(toItemVenda) : undefined,
  }
}

import type { CaixaDiario as CaixaDiarioSupabase } from './supabase'

export function toCaixaDiario(obj: any): CaixaDiarioSupabase {
  return {
    id: toNumber(obj?.id, 0),
    data: (obj?.data ? String(obj.data) : new Date().toISOString()).split('T')[0],
    status: (obj?.status as Gestao.CaixaDiario['status']) || 'aberto',
    valor_abertura: toNumber(obj?.valor_abertura, 0),
    valor_fechamento: obj?.valor_fechamento ?? undefined,
    total_vendas: obj?.total_vendas ?? undefined,
    total_entradas: obj?.total_entradas ?? undefined,
    valor_saidas: obj?.valor_saidas ?? undefined,
    total_pix: obj?.total_pix ?? undefined,
    total_debito: obj?.total_debito ?? undefined,
    total_credito: obj?.total_credito ?? undefined,
    total_dinheiro: obj?.total_dinheiro ?? undefined,
    total_caderneta: obj?.total_caderneta ?? undefined,
    diferenca: obj?.diferenca ?? undefined,
    observacoes_abertura: obj?.observacoes_abertura ?? undefined,
    observacoes_fechamento: obj?.observacoes_fechamento ?? undefined,
    usuario_abertura: obj?.usuario_abertura ?? undefined,
    usuario_fechamento: obj?.usuario_fechamento ?? undefined,
    data_abertura: obj?.data_abertura ? String(obj.data_abertura) : toISODate(obj?.created_at),
    data_fechamento: obj?.data_fechamento ?? undefined,
    valor_dinheiro_informado: obj?.valor_dinheiro_informado ?? undefined,
    valor_pix_informado: obj?.valor_pix_informado ?? undefined,
    valor_debito_informado: obj?.valor_debito_informado ?? undefined,
    valor_credito_informado: obj?.valor_credito_informado ?? undefined,
    diferenca_dinheiro: obj?.diferenca_dinheiro ?? undefined,
    diferenca_pix: obj?.diferenca_pix ?? undefined,
    diferenca_debito: obj?.diferenca_debito ?? undefined,
    diferenca_credito: obj?.diferenca_credito ?? undefined,
  }
}

import type { PrecoVenda as PrecoVendaSupabase } from './supabase'
export function toPrecoVenda(obj: any): PrecoVendaSupabase {
  return {
    id: toNumber(obj?.id, 0),
    item_id: toNumber(obj?.item_id, 0),
    tipo: (obj?.tipo as PrecoVendaSupabase['tipo']) || 'varejo',
    preco_venda: toNumber(obj?.preco_venda, 0),
    margem_lucro: obj?.margem_lucro ?? undefined,
    ativo: typeof obj?.ativo === 'boolean' ? obj.ativo : Boolean(obj?.ativo ?? true),
    created_at: toISODate(obj?.created_at),
    updated_at: obj?.updated_at ?? undefined,
  }
}

export function toComposicaoReceita(obj: any): Supabase.ComposicaoReceita {
  return {
    id: toNumber(obj?.id, 0),
    receita_id: toNumber(obj?.receita_id, 0),
    insumo_id: toNumber(obj?.insumo_id, 0),
    quantidade: toNumber(obj?.quantidade, 0),
    categoria: (obj?.categoria as Supabase.ComposicaoReceita['categoria']) || 'massa',
    created_at: toISODate(obj?.created_at),
  }
}

/* ------------------ Conversores Fiscais ------------------ */
export function toTributo(obj: any) {
  return {
    id: toString(obj?.id, ''),
    nome: toString(obj?.nome, ''),
    descricao: obj?.descricao ?? '',
    aliquota: toString(obj?.aliquota, ''),
    baseCalculo: obj?.baseCalculo ?? '',
    valor: toNumber(obj?.valor, 0),
    status: (obj?.status as any) || 'pendente',
    vencimento: toString(obj?.vencimento, ''),
    tipo: (obj?.tipo as any) || 'federal',
  }
}

export function toSpedArquivo(obj: any) {
  return {
    id: toString(obj?.id, ''),
    nome: toString(obj?.nome, ''),
    tipo: (obj?.tipo as any) || 'EFD',
    periodo: toString(obj?.periodo, ''),
    status: (obj?.status as any) || 'pendente',
    dataGeracao: toISODate(obj?.dataGeracao),
    dataTransmissao: obj?.dataTransmissao ?? undefined,
    protocolo: obj?.protocolo ?? undefined,
    observacoes: obj?.observacoes ?? undefined,
  }
}

export function toLivroFiscal(obj: any) {
  return {
    id: toString(obj?.id, ''),
    tipo: (obj?.tipo as any) || 'Entradas',
    periodo: toString(obj?.periodo, ''),
    totalRegistros: toNumber(obj?.totalRegistros, 0),
    valorTotal: toNumber(obj?.valorTotal, 0),
    status: (obj?.status as any) || 'pendente',
    dataUltimaAtualizacao: toISODate(obj?.dataUltimaAtualizacao),
    observacoes: obj?.observacoes ?? undefined,
  }
}

export function toRegistroFiscal(obj: any) {
  return {
    id: toString(obj?.id, ''),
    data: toString(obj?.data, ''),
    documento: toString(obj?.documento, ''),
    serie: toString(obj?.serie, ''),
    numero: toString(obj?.numero, ''),
    cfop: toString(obj?.cfop, ''),
    valor: toNumber(obj?.valor, 0),
    icms: toNumber(obj?.icms, 0),
    ipi: toNumber(obj?.ipi, 0),
    tipo: (obj?.tipo as any) || 'entrada',
    fornecedorCliente: toString(obj?.fornecedorCliente, ''),
  }
}

export function toRelatorio(obj: any) {
  return {
    id: toString(obj?.id, ''),
    nome: toString(obj?.nome, ''),
    tipo: (obj?.tipo as any) || 'fiscal',
    periodo: toString(obj?.periodo, ''),
    formato: (obj?.formato as any) || 'PDF',
    tamanho: toString(obj?.tamanho, ''),
    dataGeracao: toISODate(obj?.dataGeracao),
    status: (obj?.status as any) || 'gerado',
    descricao: obj?.descricao ?? '',
  }
}

export function toMetricaFiscal(obj: any) {
  return {
    titulo: toString(obj?.titulo, ''),
    valor: toNumber(obj?.valor, 0),
    variacao: Number(obj?.variacao) || 0,
    periodo: toString(obj?.periodo, ''),
    cor: (obj?.cor as any) || 'blue',
  }
}

export function toObrigacaoAcessoria(obj: any) {
  return {
    id: toString(obj?.id, ''),
    nome: toString(obj?.nome, ''),
    tipo: (obj?.tipo as any) || 'mensal',
    prazo: toString(obj?.prazo, ''),
    status: (obj?.status as any) || 'pendente',
    valorMulta: obj?.valorMulta ?? undefined,
    descricao: obj?.descricao ?? '',
    responsavel: (obj?.responsavel as any) || 'empresa',
    observacoes: obj?.observacoes ?? undefined,
  }
}

const converters = {
  toReceita,
  toInsumo,
  toProduto,
  toClienteCaderneta,
  toItemVenda,
  toVenda,
  toCaixaDiario,
  toPrecoVenda,
  toComposicaoReceita,
  toTributo,
  toSpedArquivo,
  toLivroFiscal,
  toRegistroFiscal,
  toRelatorio,
  toMetricaFiscal,
  toObrigacaoAcessoria,
}

export default converters