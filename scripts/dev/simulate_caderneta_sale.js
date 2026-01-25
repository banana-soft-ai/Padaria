// Simula a lógica de atualização de caixa para venda PDV (caderneta e não-caderneta)
// Uso: node scripts/dev/simulate_caderneta_sale.js

function simulate({ formaPagamento, curValues, valorTotal, valorPago, valorDebito, vendaId }) {
  const curTotalVendas = Number(curValues.total_vendas || 0)
  const curTotalEntradas = Number(curValues.total_entradas || 0)
  const curDinheiro = Number(curValues.total_dinheiro || 0)
  const curPix = Number(curValues.total_pix || 0)
  const curDebito = Number(curValues.total_debito || 0)
  const curCredito = Number(curValues.total_credito || 0)
  const curCaderneta = Number(curValues.total_caderneta || 0)

  const atualizar = {
    total_vendas: Number((curTotalVendas + valorTotal).toFixed(2)),
    total_entradas: curTotalEntradas,
    total_dinheiro: curDinheiro,
    total_pix: curPix,
    total_debito: curDebito,
    total_credito: curCredito,
    total_caderneta: curCaderneta
  }

  const formaRaw = String(formaPagamento || '').toLowerCase()
  const forma = formaRaw.replace(/[_\s-]/g, '')
  if (forma.includes('dinheiro')) {
    atualizar.total_entradas = Number((curTotalEntradas + valorPago).toFixed(2))
    atualizar.total_dinheiro = Number((curDinheiro + valorPago).toFixed(2))
  } else if (forma.includes('pix')) {
    atualizar.total_entradas = Number((curTotalEntradas + valorPago).toFixed(2))
    atualizar.total_pix = Number((curPix + valorPago).toFixed(2))
  } else if (forma.includes('debito')) {
    atualizar.total_entradas = Number((curTotalEntradas + valorPago).toFixed(2))
    atualizar.total_debito = Number((curDebito + valorPago).toFixed(2))
  } else if (forma.includes('credito')) {
    atualizar.total_entradas = Number((curTotalEntradas + valorPago).toFixed(2))
    atualizar.total_credito = Number((curCredito + valorPago).toFixed(2))
  } else if (forma.includes('caderneta')) {
    // Venda por caderneta: apenas incrementar total_caderneta (mantém total_entradas inalterado)
    atualizar.total_caderneta = Number((curCaderneta + valorDebito).toFixed(2))
  } else {
    atualizar.total_entradas = Number((curTotalEntradas + valorPago).toFixed(2))
  }

  const hojeStr = new Date().toISOString().slice(0, 10)
  const categoriaFluxo = forma.includes('caderneta') ? 'caderneta' : 'caixa'
  const dadosFluxo = {
    data: hojeStr,
    tipo: 'entrada',
    categoria: categoriaFluxo,
    descricao: forma.includes('caderneta') ? `Venda PDV (caderneta #${vendaId})` : `Venda PDV (#${vendaId})`,
    valor: forma.includes('caderneta') ? valorDebito : valorPago || valorTotal,
    observacoes: null,
    created_at: new Date().toISOString()
  }

  return { atualizar, dadosFluxo }
}

function pretty(obj) { return JSON.stringify(obj, null, 2) }

// Cenário inicial
const cur = {
  total_vendas: 100,
  total_entradas: 80,
  total_dinheiro: 50,
  total_pix: 20,
  total_debito: 5,
  total_credito: 5,
  total_caderneta: 30
}

console.log('--- Simulação: venda por caderneta ---')
const sim1 = simulate({
  formaPagamento: 'caderneta',
  curValues: cur,
  valorTotal: 20,
  valorPago: 0,
  valorDebito: 20,
  vendaId: 999
})
console.log('atualizar:\n', pretty(sim1.atualizar))
console.log('\ndadosFluxo:\n', pretty(sim1.dadosFluxo))

console.log('\n--- Simulação: venda em dinheiro ---')
const sim2 = simulate({
  formaPagamento: 'dinheiro',
  curValues: cur,
  valorTotal: 15,
  valorPago: 15,
  valorDebito: 0,
  vendaId: 1000
})
console.log('atualizar:\n', pretty(sim2.atualizar))
console.log('\ndadosFluxo:\n', pretty(sim2.dadosFluxo))
