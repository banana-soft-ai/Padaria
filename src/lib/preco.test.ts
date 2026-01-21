import { calcularCustos } from './preco'

describe('calcularCustos', () => {
  const insumos = [
    { id: 1, preco_pacote: 10, peso_pacote: 2, categoria: 'insumo' },
    { id: 2, preco_pacote: 5, peso_pacote: 1, categoria: 'embalagem' }
  ]

  it('calcula custos básicos sem embalagem', () => {
    const ingredientes = [
      { insumo_id: 1, quantidade: 2, categoria: 'massa' }
    ]
    const resultado = calcularCustos({ ingredientes, insumos, rendimento: 4, custosInvisiveisDecimal: 0.2 })
    expect(resultado.custoIngredientes).toBeCloseTo(10)
    expect(resultado.custoInvisivel).toBeCloseTo(2)
    expect(resultado.custoBase).toBeCloseTo(12)
    expect(resultado.unitarioBase).toBeCloseTo(3)
    expect(resultado.totalEmbalagem).toBe(0)
    expect(resultado.unitarioTotal).toBeCloseTo(3)
    expect(resultado.totalComEmbalagem).toBeCloseTo(12)
  })

  it('inclui embalagem no cálculo', () => {
    const ingredientes = [
      { insumo_id: 1, quantidade: 2, categoria: 'massa' },
      { insumo_id: 2, quantidade: 1, categoria: 'embalagem' }
    ]
    const resultado = calcularCustos({ ingredientes, insumos, rendimento: 4, custosInvisiveisDecimal: 0.2 })
    expect(resultado.totalEmbalagem).toBeCloseTo(5)
    expect(resultado.unitarioTotal).toBeCloseTo(4.25)
    expect(resultado.totalComEmbalagem).toBeCloseTo(17)
  })

  it('retorna zero se rendimento for zero', () => {
    const ingredientes = [
      { insumo_id: 1, quantidade: 2, categoria: 'massa' }
    ]
    const resultado = calcularCustos({ ingredientes, insumos, rendimento: 0, custosInvisiveisDecimal: 0.2 })
    expect(resultado.unitarioBase).toBe(0)
    expect(resultado.unitarioTotal).toBe(0)
  })
})
