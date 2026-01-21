import { renderHook, waitFor } from '@testing-library/react'
import { useCaixa } from '../useCaixa'
import { supabase } from '@/lib/supabase/client'

// Mock do Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        limit: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    })),
    insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    update: jest.fn(() => Promise.resolve({ data: null, error: null })),
  })),
}

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}))

describe('useCaixa', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useCaixa())

    expect(result.current.loading).toBe(true)
    expect(result.current.caixaHoje).toBe(null)
  })

  it('should have all required functions', () => {
    const { result } = renderHook(() => useCaixa())

    expect(typeof result.current.carregarCaixaHoje).toBe('function')
    expect(typeof result.current.abrirCaixa).toBe('function')
    expect(typeof result.current.fecharCaixa).toBe('function')
    expect(typeof result.current.registrarSaida).toBe('function')
  })

  it('should call supabase.from with caixa_diario table', async () => {
    const { result } = renderHook(() => useCaixa())

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('caixa_diario')
    })
  })

  it('should handle abrirCaixa with valid data', async () => {
    const { result } = renderHook(() => useCaixa())

      // Mock successful response
      ; (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn(() => Promise.resolve({ data: null, error: null }))
      })

    await expect(result.current.abrirCaixa(100, 'Teste')).resolves.toBe(true)
  })

  it('should handle fecharCaixa with valid data', async () => {
    const { result } = renderHook(() => useCaixa())

    // Mock caixa existente
    const mockCaixa = { id: 1, status: 'aberto' }
      ; (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockCaixa, error: null }))
            }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })

    const dadosFechamento = {
      valor_final: '100',
      valor_saidas: '10',
      valor_dinheiro_informado: '90',
      valor_pix_informado: '0',
      valor_debito_informado: '0',
      valor_credito_informado: '0',
      observacoes_fechamento: 'Teste'
    }

    await expect(result.current.fecharCaixa(dadosFechamento)).resolves.toBe(true)
  })

  it('should handle registrarSaida with valid data', async () => {
    const { result } = renderHook(() => useCaixa())

      // Mock successful response
      ; (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn(() => Promise.resolve({ data: null, error: null }))
      })

    await expect(result.current.registrarSaida(50, 'Teste saída')).resolves.toBe(true)
  })

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useCaixa())

      // Mock error response
      ; (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: null, error: new Error('Test error') }))
            }))
          }))
        }))
      })

    await result.current.carregarCaixaHoje()

    expect(result.current.caixaHoje).toBe(null)
  })
})
