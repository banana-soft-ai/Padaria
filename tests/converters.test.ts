// Teste TypeScript convertido para CommonJS simples para evitar suite vazia
const { toReceita } = require('../src/lib/converters.cjs')

test('placeholder toReceita (TS wrapper)', () => {
	const r = toReceita({ id: '7', nome: 'Teste TS' })
	expect(r.id).toBe(7)
	expect(r.nome).toBe('Teste TS')
})

