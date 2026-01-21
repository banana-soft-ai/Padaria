import { renderHook, waitFor } from '@testing-library/react'
import { useVendas } from '../useVendas'
import { supabase } from '@/lib/supabase/client'

// Mock do Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      order: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
    insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
  })),
}

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
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

  it('should have carregarDados function', () => {
    const { result } = renderHook(() => useVendas())

    expect(typeof result.current.carregarDados).toBe('function')
  })

  it('should have registrarVenda function', () => {
    const { result } = renderHook(() => useVendas())

    expect(typeof result.current.registrarVenda).toBe('function')
  })

  it('should call supabase.from with correct tables', async () => {
    const { result } = renderHook(() => useVendas())

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('receitas')
      expect(supabase.from).toHaveBeenCalledWith('insumos')
      expect(supabase.from).toHaveBeenCalledWith('clientes_caderneta')
      expect(supabase.from).toHaveBeenCalledWith('vendas')
      expect(supabase.from).toHaveBeenCalledWith('precos_venda')
    })
  })

  it('should handle registrarVenda with valid data', async () => {
    const { result } = renderHook(() => useVendas())

    const dadosVenda = {
      forma_pagamento: 'dinheiro',
      observacoes: 'Teste',
      itens: [
        {
          item_id: 1,
          tipo: 'receita' as const,
          quantidade: 2,
          preco_unitario: 10.0
        }
      ]
    }

      // Mock successful responses
      ; (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn(() => Promise.resolve({ data: { id: 1 }, error: null })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({ data: { id: 1 }, error: null }))
                  }))
                }))
              }))
            }))
          }))
        }))
      })

    await expect(result.current.registrarVenda(dadosVenda)).resolves.toBe(true)
  })

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useVendas())

      // Mock error response
      ; (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: null, error: new Error('Test error') }))
        }))
      })

    await result.current.carregarDados()

    expect(result.current.loading).toBe(false)
  })
})
