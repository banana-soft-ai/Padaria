import { calcularCustos } from './preco'
import { Insumo } from '@/lib/supabase'

describe('calcularCustos', () => {
  const insumos: Insumo[] = [
    {
      id: 1,
      nome: 'Farinha Teste',
      preco_pacote: 10,
      peso_pacote: 2,
      unidade: 'kg',
      tipo_estoque: 'insumo',
      categoria: 'insumo',
      codigo_barras: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      nome: 'Embalagem Teste',
      preco_pacote: 5,
      peso_pacote: 1,
      unidade: 'un',
      tipo_estoque: 'insumo',
      categoria: 'embalagem',
      codigo_barras: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
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

  it('inclui embalagem no cálculo (embalagem é custo por unidade, somado ao preço unitário)', () => {
    const ingredientes = [
      { insumo_id: 1, quantidade: 2, categoria: 'massa' },
      { insumo_id: 2, quantidade: 1, categoria: 'embalagem' }
    ]
    const resultado = calcularCustos({ ingredientes, insumos, rendimento: 4, custosInvisiveisDecimal: 0.2 })
    expect(resultado.totalEmbalagem).toBeCloseTo(5)
    expect(resultado.unitarioTotal).toBeCloseTo(8) // unitarioBase 3 + embalagem 5 (somado, não dividido)
    expect(resultado.totalComEmbalagem).toBeCloseTo(32) // custoBase 12 + embalagem*rendimento 5*4=20
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
