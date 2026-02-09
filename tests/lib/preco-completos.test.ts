import {
  calcularCustosCompletos,
  calcularCustoSeguroFromComposicoes,
} from '@/lib/preco'

describe('lib/preco (calcularCustosCompletos e calcularCustoSeguroFromComposicoes)', () => {
  describe('calcularCustosCompletos', () => {
    it('calcula custo com composição de massa em gramas', () => {
      const composicoes = [
        {
          quantidade: 1000,
          categoria: 'massa',
          insumo: { preco_pacote: 10, peso_pacote: 1000, unidade: 'g' },
        },
      ]
      const r = calcularCustosCompletos({ composicoes, rendimento: 2, custosInvisiveis: 0 })
      expect(r.custoIngredientes).toBe(10)
      expect(r.custoBase).toBe(10)
      expect(r.custoUnitarioBase).toBe(5)
      expect(r.custoUnitarioTotal).toBe(5)
    })

    it('aplica custos invisíveis (decimal)', () => {
      const composicoes = [
        {
          quantidade: 1000,
          categoria: 'massa',
          insumo: { preco_pacote: 10, peso_pacote: 1000, unidade: 'g' },
        },
      ]
      const r = calcularCustosCompletos({ composicoes, rendimento: 1, custosInvisiveis: 0.2 })
      expect(r.custoIngredientes).toBe(10)
      expect(r.custoInvisivel).toBe(2)
      expect(r.custoBase).toBe(12)
    })

    it('inclui embalagem e distribui por rendimento', () => {
      const composicoes = [
        { quantidade: 500, categoria: 'massa', insumo: { preco_pacote: 10, peso_pacote: 1000, unidade: 'g' } },
        { quantidade: 1, categoria: 'embalagem', insumo: { preco_pacote: 2, peso_pacote: 1, unidade: 'un' } },
      ]
      const r = calcularCustosCompletos({ composicoes, rendimento: 2 })
      expect(r.totalEmbalagem).toBe(2)
      expect(r.custoUnitarioBase).toBe(2.5) // custoBase 5 / 2
      // custoUnitarioTotal = custoUnitarioBase + totalEmbalagem (embalagem por unidade)
      expect(r.custoUnitarioTotal).toBe(4.5)
    })

    it('retorna valores finitos com composicoes vazias ou rendimento zero', () => {
      const r1 = calcularCustosCompletos({ composicoes: [], rendimento: 1 })
      expect(r1.custoIngredientes).toBe(0)
      expect(r1.custoBase).toBe(0)
      expect(r1.custoUnitarioBase).toBe(0)

      // rendimento 0 é tratado como 1 na implementação
      const r2 = calcularCustosCompletos({ composicoes: [{ quantidade: 1, insumo: { preco_pacote: 10, peso_pacote: 1, unidade: 'un' } }], rendimento: 0 })
      expect(r2.custoUnitarioBase).toBe(10)
      expect(r2.custoUnitarioTotal).toBe(10)
    })
  })

  describe('calcularCustoSeguroFromComposicoes', () => {
    it('calcula custo total e unitário com composições', () => {
      const composicoes = [
        { quantidade: 1000, categoria: 'massa', insumo: { preco_pacote: 20, peso_pacote: 1000, unidade: 'g' } },
      ]
      const r = calcularCustoSeguroFromComposicoes({ composicoes, rendimento: 4 })
      expect(r.custoTotal).toBe(20)
      expect(r.custoUnitario).toBe(5)
    })

    it('retorna 0 quando resultado não é finito', () => {
      const r = calcularCustoSeguroFromComposicoes({ composicoes: [], rendimento: 0 })
      expect(r.custoTotal).toBe(0)
      expect(r.custoUnitario).toBe(0)
    })
  })
})
