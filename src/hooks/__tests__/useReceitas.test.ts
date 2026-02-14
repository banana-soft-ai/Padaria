import { renderHook, waitFor } from '@testing-library/react'
import { useReceitas } from '../useReceitas'

const mockOrder = jest.fn()
const mockEq = jest.fn()
const mockSelect = jest.fn()
const mockInsertSelectSingle = jest.fn()
const mockInsertSelect = jest.fn()
const mockInsert = jest.fn()
const mockUpdateEqSelectSingle = jest.fn()
const mockUpdateEqSelect = jest.fn()
const mockUpdateEq = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: (...args: unknown[]) => mockSelect(...args),
      insert: (...args: unknown[]) => mockInsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    })),
  },
}))

describe('useReceitas', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockOrder.mockResolvedValue({ data: [{ id: 1, nome: 'Pão Francês', ativo: true }], error: null })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })

    mockInsertSelectSingle.mockResolvedValue({ data: { id: 2 }, error: null })
    mockInsertSelect.mockReturnValue({ single: mockInsertSelectSingle })
    mockInsert.mockReturnValue({ select: mockInsertSelect })

    mockUpdateEqSelectSingle.mockResolvedValue({ data: { id: 1 }, error: null })
    mockUpdateEqSelect.mockReturnValue({ single: mockUpdateEqSelectSingle })
    mockUpdateEq.mockReturnValue({ select: mockUpdateEqSelect })
    mockUpdate.mockReturnValue({ eq: mockUpdateEq })
  })

  async function waitInitialLoad(result: { current: { loading: boolean } }) {
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  }

  it('carrega receitas ativas na inicialização', async () => {
    const { result } = renderHook(() => useReceitas())

    await waitInitialLoad(result)

    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('ativo', true)
    expect(mockOrder).toHaveBeenCalledWith('nome')
    expect(result.current.receitas).toEqual([{ id: 1, nome: 'Pão Francês', ativo: true }])
  })

  it('createReceita envia insert no supabase', async () => {
    const { result } = renderHook(() => useReceitas())
    await waitInitialLoad(result)

    const payload = { nome: 'Baguete', categoria: 'pao', rendimento: 10 }
    await result.current.createReceita(payload)

    expect(mockInsert).toHaveBeenCalledWith([payload])
  })

  it('updateReceita atualiza pelo id', async () => {
    const { result } = renderHook(() => useReceitas())
    await waitInitialLoad(result)

    await result.current.updateReceita(10, { nome: 'Integral' })

    expect(mockUpdate).toHaveBeenCalledWith({ nome: 'Integral' })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 10)
  })

  it('softDeleteReceita seta ativo=false no id informado', async () => {
    const { result } = renderHook(() => useReceitas())
    await waitInitialLoad(result)

    await result.current.softDeleteReceita(99)

    expect(mockUpdate).toHaveBeenCalledWith({ ativo: false })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 99)
  })
})
