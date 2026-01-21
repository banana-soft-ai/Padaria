// Versão CommonJS dos conversores para testes sem transpiler
function toNumber(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
function toString(v, fallback = '') {
  return v == null ? fallback : String(v)
}
function toISODate(v, fallback = new Date().toISOString()) {
  return v ? String(v) : fallback
}

function toReceita(obj) {
  return {
    id: toNumber(obj && obj.id, 0),
    nome: toString(obj && obj.nome, ''),
    descricao: obj && obj.descricao || undefined,
    categoria: (obj && obj.categoria) || 'massa',
    rendimento: toNumber(obj && obj.rendimento, 0),
    unidade_rendimento: toString(obj && obj.unidade_rendimento, ''),
    tempo_preparo: typeof (obj && obj.tempo_preparo) === 'number' ? obj.tempo_preparo : undefined,
    instrucoes: obj && obj.instrucoes || undefined,
    preco_venda: obj && obj.preco_venda || undefined,
    created_at: toISODate(obj && obj.created_at),
    updated_at: obj && obj.updated_at || undefined,
  }
}

function toInsumo(obj) {
  return {
    id: toNumber(obj && obj.id, 0),
    nome: toString(obj && obj.nome, ''),
    marca: (obj && obj.marca) || undefined,
    fornecedor: (obj && obj.fornecedor) || undefined,
    unidade: toString(obj && obj.unidade, ''),
    peso_pacote: toNumber(obj && obj.peso_pacote, 0),
    preco_pacote: toNumber(obj && obj.preco_pacote, 0),
    categoria: (obj && obj.categoria) || 'insumo',
    preco_venda: obj && obj.preco_venda || undefined,
    created_at: toISODate(obj && obj.created_at),
    updated_at: obj && obj.updated_at || undefined,
  }
}

function toClienteCaderneta(obj) {
  return {
    id: toNumber(obj && obj.id, 0),
    nome: toString(obj && obj.nome, ''),
    telefone: obj && obj.telefone || undefined,
    endereco: obj && obj.endereco || undefined,
    limite_credito: toNumber(obj && obj.limite_credito, 0),
    saldo_devedor: toNumber(obj && obj.saldo_devedor, 0),
    ativo: typeof (obj && obj.ativo) === 'boolean' ? obj.ativo : Boolean((obj && obj.ativo) || true),
    observacoes: obj && obj.observacoes || undefined,
    created_at: toISODate(obj && obj.created_at),
    updated_at: obj && obj.updated_at || undefined,
  }
}

function toItemVenda(obj) {
  return {
    id: toNumber(obj && obj.id, 0),
    venda_id: toNumber(obj && obj.venda_id, 0),
    tipo: (obj && obj.tipo) || 'varejo',
    item_id: toNumber(obj && obj.item_id, 0),
    quantidade: toNumber(obj && obj.quantidade, 0),
    preco_unitario: toNumber((obj && obj.preco_unitario) || (obj && obj.preco) || (obj && obj.preco_total), 0),
    created_at: toISODate(obj && obj.created_at),
    preco_total: (obj && obj.preco_total) !== undefined ? toNumber(obj.preco_total, 0) : undefined,
    item: obj && obj.item ? ((obj.item && obj.item.nome) ? toReceita(obj.item) : toInsumo(obj.item)) : undefined,
  }
}

function toVenda(obj) {
  return {
    id: toNumber(obj && obj.id, 0),
    data: (obj && obj.data ? String(obj.data) : new Date().toISOString()).split('T')[0],
    hora: obj && obj.hora || undefined,
    forma_pagamento: (obj && obj.forma_pagamento) || 'dinheiro',
    cliente_caderneta_id: obj && obj.cliente_caderneta_id || undefined,
    valor_total: toNumber((obj && obj.valor_total) || (obj && obj.valor) || 0, 0),
    valor_pago: toNumber((obj && obj.valor_pago) || 0, 0),
    valor_debito: toNumber((obj && obj.valor_debito) || 0, 0),
    observacoes: obj && obj.observacoes || undefined,
    caixa_diario_id: obj && obj.caixa_diario_id || undefined,
    created_at: toISODate(obj && obj.created_at),
    updated_at: obj && obj.updated_at || undefined,
    cliente: obj && obj.cliente ? toClienteCaderneta(obj.cliente) : undefined,
    itens: Array.isArray(obj && obj.itens) ? (obj.itens.map(toItemVenda)) : undefined,
  }
}

function toCaixaDiario(obj) {
  return {
    id: toNumber(obj && obj.id, 0),
    data: (obj && obj.data ? String(obj.data) : new Date().toISOString()).split('T')[0],
    status: (obj && obj.status) || 'aberto',
    valor_abertura: toNumber(obj && obj.valor_abertura, 0),
    valor_fechamento: (obj && obj.valor_fechamento) || undefined,
    total_vendas: (obj && obj.total_vendas) || undefined,
    total_entradas: (obj && obj.total_entradas) || undefined,
    valor_saidas: (obj && obj.valor_saidas) || undefined,
    total_pix: (obj && obj.total_pix) || undefined,
    total_debito: (obj && obj.total_debito) || undefined,
    total_credito: (obj && obj.total_credito) || undefined,
    total_dinheiro: (obj && obj.total_dinheiro) || undefined,
    total_caderneta: (obj && obj.total_caderneta) || undefined,
    diferenca: (obj && obj.diferenca) || undefined,
    observacoes_abertura: (obj && obj.observacoes_abertura) || undefined,
    observacoes_fechamento: (obj && obj.observacoes_fechamento) || undefined,
    usuario_abertura: (obj && obj.usuario_abertura) || undefined,
    usuario_fechamento: (obj && obj.usuario_fechamento) || undefined,
    data_abertura: (obj && obj.data_abertura) ? String(obj.data_abertura) : toISODate(obj && obj.created_at),
    data_fechamento: (obj && obj.data_fechamento) || undefined,
    created_at: toISODate(obj && obj.created_at),
  }
}

module.exports = {
  toReceita,
  toInsumo,
  toClienteCaderneta,
  toItemVenda,
  toVenda,
  toCaixaDiario,
}
