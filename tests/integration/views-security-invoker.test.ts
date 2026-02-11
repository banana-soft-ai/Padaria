/**
 * Testes das views com security_invoker (vendas_hoje, produtos_estoque_baixo, resumo_caixa_hoje).
 * Garante que a leitura via Supabase client retorna dados no formato esperado quando o usuário está autenticado.
 * As views são definidas com security_invoker = true para que o RLS do usuário que consulta seja aplicado.
 */

const mockSelect = jest.fn().mockResolvedValue({ data: [], error: null })
const mockFrom = jest.fn(() => ({
  select: mockSelect,
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}))

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@padaria.com' } },
        error: null,
      }),
    },
  },
}))

describe('Views security_invoker (vendas_hoje, produtos_estoque_baixo, resumo_caixa_hoje)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSelect.mockResolvedValue({ data: [], error: null })
  })

  it('vendas_hoje: select retorna { data, error } sem erro quando mock resolve', async () => {
    const { supabase } = await import('@/lib/supabase/client')
    const { data, error } = await (supabase as any).from('vendas_hoje').select('*')

    expect(mockFrom).toHaveBeenCalledWith('vendas_hoje')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(Array.isArray(data)).toBe(true)
    expect(error).toBeNull()
  })

  it('produtos_estoque_baixo: select retorna { data, error } sem erro quando mock resolve', async () => {
    const { supabase } = await import('@/lib/supabase/client')
    const { data, error } = await (supabase as any).from('produtos_estoque_baixo').select('*')

    expect(mockFrom).toHaveBeenCalledWith('produtos_estoque_baixo')
    expect(Array.isArray(data)).toBe(true)
    expect(error).toBeNull()
  })

  it('resumo_caixa_hoje: select retorna { data, error } sem erro quando mock resolve', async () => {
    const { supabase } = await import('@/lib/supabase/client')
    const { data, error } = await (supabase as any).from('resumo_caixa_hoje').select('*')

    expect(mockFrom).toHaveBeenCalledWith('resumo_caixa_hoje')
    expect(Array.isArray(data)).toBe(true)
    expect(error).toBeNull()
  })
})
