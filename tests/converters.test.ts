// Teste TypeScript convertido para CommonJS simples para evitar suite vazia
const { toReceita, toVenda, toCaixaDiario } = require('../src/lib/converters.cjs')

test('placeholder toReceita (TS wrapper)', () => {
	const r = toReceita({ id: '7', nome: 'Teste TS' })
	expect(r.id).toBe(7)
	expect(r.nome).toBe('Teste TS')
})

test('toVenda fallback data retorna YYYY-MM-DD quando obj.data é undefined', () => {
	const v = toVenda({ id: 1, valor_total: 100 })
	expect(v.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('toCaixaDiario fallback data retorna YYYY-MM-DD quando obj.data é undefined', () => {
	const c = toCaixaDiario({ id: 1, valor_abertura: 0 })
	expect(c.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

