import { renderHook, waitFor } from '@testing-library/react'
import { useVendas } from '../useVendas'

// Mock que retorna uma chain completa para qualquer .from().select().eq()... ou .from().insert().select()...
const createChain = (finalData: unknown = [], finalError: unknown = null) => ({
  select: jest.fn(() => createChain(finalData, finalError)),
  eq: jest.fn(() => createChain(finalData, finalError)),
  order: jest.fn(() => Promise.resolve({ data: finalData, error: finalError })),
  limit: jest.fn(() => ({
    single: jest.fn(() => Promise.resolve({ data: Array.isArray(finalData) ? finalData[0] : finalData, error: finalError })),
  })),
  insert: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: { id: 1 }, error: null })),
              })),
            })),
          })),
        })),
      })),
    })),
  })),
})

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => createChain([], null)),
  },
}))

jest.mock('@/lib/offlineStorage', () => ({
  offlineStorage: {
    getReceitas: jest.fn(() => Promise.resolve([])),
    getInsumos: jest.fn(() => Promise.resolve([])),
    getClientesCaderneta: jest.fn(() => Promise.resolve([])),
    getPrecosVenda: jest.fn(() => Promise.resolve([])),
    getVendasHoje: jest.fn(() => Promise.resolve([])),
    getOfflineData: jest.fn(() => Promise.resolve(null)),
    saveVenda: jest.fn(() => Promise.resolve()),
    saveOfflineData: jest.fn(() => Promise.resolve()),
  },
}))

describe('useVendas', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useVendas())

    expect(result.current.loading).toBe(true)
    expect(result.current.vendasHoje).toEqual([])
    expect(result.current.produtosVarejo).toEqual([])
    expect(result.current.receitas).toEqual([])
    expect(result.current.clientesCaderneta).toEqual([])
    expect(result.current.precosVenda).toEqual({})
    expect(result.current.itensComPreco).toEqual([])
  })

  it('should have carregarDados and registrarVenda functions', () => {
    const { result } = renderHook(() => useVendas())

    expect(typeof result.current.carregarDados).toBe('function')
    expect(typeof result.current.registrarVenda).toBe('function')
  })

  it('should set loading to false after carregarDados completes', async () => {
    const { result } = renderHook(() => useVendas())

    await result.current.carregarDados()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })
})
