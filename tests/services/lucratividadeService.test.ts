import { processarLucratividadePorProduto } from '@/services/lucratividadeService'

jest.mock('@/lib/preco', () => ({
  calcularCustosCompletos: jest.fn(() => ({ custoUnitarioTotal: 2 })),
}))

describe('lucratividadeService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retorna itens e resumo com estrutura correta', () => {
    const vendas: any[] = []
    const itensVenda = [
      {
        varejo_id: 1,
        tipo: 'varejo',
        quantidade: 2,
        preco_unitario: 10,
      },
    ]
    const precosVenda: any[] = []
    const varejo = [
      { id: 1, nome: 'Pão Teste', ativo: true },
    ]
    const receitas: any[] = []
    const composicoes: any[] = []
    const insumos: any[] = []

    const resultado = processarLucratividadePorProduto({
      vendas,
      itensVenda,
      precosVenda,
      varejo,
      receitas,
      composicoes,
      insumos,
      custosFixosTotal: 0,
    })

    expect(resultado).toHaveProperty('itens')
    expect(resultado).toHaveProperty('resumo')
    expect(Array.isArray(resultado.itens)).toBe(true)
    expect(resultado.resumo).toMatchObject({
      receitaTotal: expect.any(Number),
      custoTotalProdutos: expect.any(Number),
      lucroBrutoTotal: expect.any(Number),
      custosFixosTotal: 0,
      lucroLiquido: expect.any(Number),
      margemLucroBruta: expect.any(Number),
      margemLucroLiquida: expect.any(Number),
      roi: expect.any(Number),
    })
  })

  it('agrega quantidade e receita por produto', () => {
    const itensVenda = [
      { varejo_id: 1, tipo: 'varejo', quantidade: 1, preco_unitario: 10 },
      { varejo_id: 1, tipo: 'varejo', quantidade: 2, preco_unitario: 10 },
    ]
    const varejo = [{ id: 1, nome: 'Pão', ativo: true }]

    const resultado = processarLucratividadePorProduto({
      vendas: [],
      itensVenda,
      precosVenda: [],
      varejo,
      receitas: [],
      composicoes: [],
      insumos: [],
      custosFixosTotal: 0,
    })

    expect(resultado.itens).toHaveLength(1)
    expect(resultado.itens[0].quantidadeVendida).toBe(3)
    expect(resultado.itens[0].receitaTotal).toBe(30)
  })

  it('ignora itens inativos ou sem varejo/receita', () => {
    const itensVenda = [
      { varejo_id: 99, tipo: 'varejo', quantidade: 1, preco_unitario: 10 },
    ]
    const varejo: any[] = []

    const resultado = processarLucratividadePorProduto({
      vendas: [],
      itensVenda,
      precosVenda: [],
      varejo,
      receitas: [],
      composicoes: [],
      insumos: [],
      custosFixosTotal: 0,
    })

    expect(resultado.itens).toHaveLength(0)
  })
})
