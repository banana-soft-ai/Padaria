import { renderHook, waitFor } from '@testing-library/react'
import { useCaixa } from '../useCaixa'
import { supabase } from '@/lib/supabase/client'

const createChain = (listData: unknown[] = [], error: unknown = null) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      order: jest.fn(() => Promise.resolve({ data: listData, error })),
      limit: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: listData[0] ?? null, error })),
      })),
    })),
    order: jest.fn(() => Promise.resolve({ data: listData, error })),
  })),
  insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
  update: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: null, error: null })), in: jest.fn(() => Promise.resolve({ data: null, error: null })) })),
})

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'fluxo_caixa') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
      }
      return createChain([], null)
    }),
  },
}))

jest.mock('@/lib/offlineStorage', () => ({
  offlineStorage: {
    init: jest.fn(() => Promise.resolve()),
    getCaixaHoje: jest.fn(() => Promise.resolve(null)),
    getOfflineData: jest.fn(() => Promise.resolve(null)),
    saveCaixa: jest.fn(() => Promise.resolve()),
    saveOfflineData: jest.fn(() => Promise.resolve()),
  },
}))

jest.mock('react-hot-toast', () => {
  const fn = () => {}
  return {
    __esModule: true,
    default: Object.assign(fn, { dismiss: () => {}, success: () => {}, error: () => {} }),
  }
})

describe('useCaixa', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should expose loading and caixaHoje (loading becomes false after carregarCaixaHoje)', async () => {
    const { result } = renderHook(() => useCaixa())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.caixaHoje).toBe(null)
  })

  it('should have all required functions', () => {
    const { result } = renderHook(() => useCaixa())

    expect(typeof result.current.carregarCaixaHoje).toBe('function')
    expect(typeof result.current.abrirCaixa).toBe('function')
    expect(typeof result.current.fecharCaixa).toBe('function')
    expect(typeof result.current.registrarSaida).toBe('function')
  })

  it('should call supabase.from with caixa_diario after carregarCaixaHoje', async () => {
    const { result } = renderHook(() => useCaixa())

    await result.current.carregarCaixaHoje()

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('caixa_diario')
    })
  })

  it('should handle abrirCaixa with valid data', async () => {
    const { result } = renderHook(() => useCaixa())

    ;(supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })

    await expect(result.current.abrirCaixa(100, 'Teste')).resolves.toBe(true)
  })

  it('should handle fecharCaixa when caixaHoje is set', async () => {
    const mockCaixa = { id: 1, status: 'aberto', data_abertura: '2025-01-01' }
    const fromMock = (supabase.from as jest.Mock)
    fromMock.mockImplementation((table: string) => {
      if (table === 'fluxo_caixa') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
      }
      const chain = {
        select: () => ({
          eq: () => ({ order: () => Promise.resolve({ data: [mockCaixa], error: null }) }),
        }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      }
      return chain
    })

    const { result } = renderHook(() => useCaixa())

    await waitFor(() => {
      expect(result.current.caixaHoje).not.toBe(null)
    })

    const dadosFechamento = {
      valor_final: '100',
      valor_saidas: '10',
      valor_dinheiro_informado: '90',
      valor_pix_informado: '0',
      valor_debito_informado: '0',
      valor_credito_informado: '0',
      observacoes_fechamento: 'Teste',
    }

    await expect(result.current.fecharCaixa(dadosFechamento)).resolves.toBe(true)
  })

  it('should handle registrarSaida with valid data', async () => {
    const { result } = renderHook(() => useCaixa())

    ;(supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })

    await expect(result.current.registrarSaida(50, 'Teste saída')).resolves.toBe(true)
  })

  it('should keep caixaHoje null when load fails', async () => {
    const { result } = renderHook(() => useCaixa())

    ;(supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: new Error('Test error') })),
          })),
        })),
      })),
    })

    await result.current.carregarCaixaHoje()

    expect(result.current.caixaHoje).toBe(null)
  })
})
