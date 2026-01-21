const { toReceita, toInsumo, toClienteCaderneta, toVenda, toItemVenda, toCaixaDiario } = require('../src/lib/converters.cjs')

describe('converters básico', () => {
  test('toReceita preenche defaults', () => {
    const r = toReceita({ id: '5', nome: 'Pão' })
    expect(r.id).toBe(5)
    expect(r.nome).toBe('Pão')
    expect(typeof r.rendimento).toBe('number')
    expect(r.unidade_rendimento).toBe('')
  })

  test('toInsumo preenche defaults', () => {
    const i = toInsumo({ id: '2', nome: 'Farinha' })
    expect(i.id).toBe(2)
    expect(i.nome).toBe('Farinha')
    expect(typeof i.peso_pacote).toBe('number')
  })

  test('toClienteCaderneta normaliza', () => {
    const c = toClienteCaderneta({ id: 1, nome: 'João' })
    expect(c.id).toBe(1)
    expect(c.nome).toBe('João')
    expect(typeof c.limite_credito).toBe('number')
  })

  test('toVenda e toItemVenda normalizam itens', () => {
    const v = toVenda({ id: 10, data: '2026-01-13', valor_total: '100' })
    expect(v.id).toBe(10)
    expect(typeof v.valor_total).toBe('number')
    const item = toItemVenda({ id: 1, venda_id: 10, tipo: 'varejo', item_id: 2, quantidade: '3', preco_unitario: '5' })
    expect(item.quantidade).toBe(3)
    expect(item.preco_unitario).toBe(5)
  })

  test('toCaixaDiario preenche datas e valores', () => {
    const c = toCaixaDiario({ id: 1, data: '2026-01-13', valor_abertura: '50' })
    expect(c.id).toBe(1)
    expect(c.valor_abertura).toBe(50)
  })
})
