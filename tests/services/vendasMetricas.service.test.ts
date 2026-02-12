import { buscarMetricasPeriodo } from '@/services/vendasMetricas.service'

const mockFetchVendasMetricas = jest.fn()
const mockFetchUnidadesVendidas = jest.fn()

jest.mock('@/repositories/vendasMetricas.repository', () => ({
  fetchVendasMetricas: (...args: unknown[]) => mockFetchVendasMetricas(...args),
  fetchUnidadesVendidas: (...args: unknown[]) => mockFetchUnidadesVendidas(...args)
}))

const mockSupabase = {} as any

describe('vendasMetricas.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retorna zeros quando não há vendas no período', async () => {
    mockFetchVendasMetricas.mockResolvedValue([])
    mockFetchUnidadesVendidas.mockResolvedValue(0)

    const resultado = await buscarMetricasPeriodo(mockSupabase, '2026-02-01', '2026-02-12')

    expect(resultado).toMatchObject({
      receitaTotal: 0,
      vendasCount: 0,
      ticketMedio: 0,
      unidadesVendidas: 0,
      valorReceber: 0,
      vendaIds: []
    })
    expect(resultado.porFormaPagamento).toEqual({
      pix: 0,
      dinheiro: 0,
      debito: 0,
      credito: 0,
      caderneta: 0
    })
  })

  it('calcula receitaTotal, vendasCount e ticketMedio corretamente', async () => {
    mockFetchVendasMetricas.mockResolvedValue([
      { id: 1, valor_total: 50, forma_pagamento: 'dinheiro', valor_debito: 0 },
      { id: 2, valor_total: 30, forma_pagamento: 'pix', valor_debito: 0 }
    ])
    mockFetchUnidadesVendidas.mockResolvedValue(5)

    const resultado = await buscarMetricasPeriodo(mockSupabase, '2026-02-01', '2026-02-12')

    expect(resultado.receitaTotal).toBe(80)
    expect(resultado.vendasCount).toBe(2)
    expect(resultado.ticketMedio).toBe(40)
  })

  it('arredonda unidadesVendidas para 2 decimais', async () => {
    mockFetchVendasMetricas.mockResolvedValue([{ id: 1, valor_total: 10, forma_pagamento: 'dinheiro', valor_debito: 0 }])
    mockFetchUnidadesVendidas.mockResolvedValue(293.7799999999996)

    const resultado = await buscarMetricasPeriodo(mockSupabase, '2026-02-01', '2026-02-12')

    expect(resultado.unidadesVendidas).toBe(293.78)
  })

  it('agrupa formas de pagamento corretamente', async () => {
    mockFetchVendasMetricas.mockResolvedValue([
      { id: 1, valor_total: 100, forma_pagamento: 'pix', valor_debito: 0 },
      { id: 2, valor_total: 50, forma_pagamento: 'pix', valor_debito: 0 },
      { id: 3, valor_total: 80, forma_pagamento: 'cartao_debito', valor_debito: 0 },
      { id: 4, valor_total: 20, forma_pagamento: 'caderneta', valor_debito: 20 }
    ])
    mockFetchUnidadesVendidas.mockResolvedValue(10)

    const resultado = await buscarMetricasPeriodo(mockSupabase, '2026-02-01', '2026-02-12')

    expect(resultado.porFormaPagamento.pix).toBe(150)
    expect(resultado.porFormaPagamento.debito).toBe(80)
    expect(resultado.porFormaPagamento.caderneta).toBe(20)
    expect(resultado.porFormaPagamento.dinheiro).toBe(0)
    expect(resultado.porFormaPagamento.credito).toBe(0)
  })

  it('calcula valorReceber a partir de valor_debito', async () => {
    mockFetchVendasMetricas.mockResolvedValue([
      { id: 1, valor_total: 50, forma_pagamento: 'caderneta', valor_debito: 50 },
      { id: 2, valor_total: 30, forma_pagamento: 'caderneta', valor_debito: 30 }
    ])
    mockFetchUnidadesVendidas.mockResolvedValue(2)

    const resultado = await buscarMetricasPeriodo(mockSupabase, '2026-02-01', '2026-02-12')

    expect(resultado.valorReceber).toBe(80)
  })

  it('retorna vendaIds para uso em topProdutos', async () => {
    mockFetchVendasMetricas.mockResolvedValue([
      { id: 10, valor_total: 25, forma_pagamento: 'dinheiro', valor_debito: 0 },
      { id: 20, valor_total: 35, forma_pagamento: 'pix', valor_debito: 0 }
    ])
    mockFetchUnidadesVendidas.mockResolvedValue(3)

    const resultado = await buscarMetricasPeriodo(mockSupabase, '2026-02-01', '2026-02-12')

    expect(resultado.vendaIds).toEqual([10, 20])
  })

  it('chama fetchVendasMetricas e fetchUnidadesVendidas com parâmetros corretos', async () => {
    mockFetchVendasMetricas.mockResolvedValue([])
    mockFetchUnidadesVendidas.mockResolvedValue(0)

    await buscarMetricasPeriodo(mockSupabase, '2026-01-01', '2026-01-31')

    expect(mockFetchVendasMetricas).toHaveBeenCalledWith(mockSupabase, '2026-01-01', '2026-01-31')
    expect(mockFetchUnidadesVendidas).toHaveBeenCalledWith(mockSupabase, [])
  })
})
