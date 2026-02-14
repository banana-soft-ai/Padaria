import { listarTurnos, trocarOperador } from '@/services/turnoOperadorService'

const mockGetTurnoOperadorAtual = jest.fn()
const mockFinalizarTurnoOperador = jest.fn()
const mockCriarTurnoOperador = jest.fn()
const mockListarTurnosOperador = jest.fn()

jest.mock('@/repositories/turnoOperadorRepository', () => ({
  getTurnoOperadorAtual: (...args: unknown[]) => mockGetTurnoOperadorAtual(...args),
  finalizarTurnoOperador: (...args: unknown[]) => mockFinalizarTurnoOperador(...args),
  criarTurnoOperador: (...args: unknown[]) => mockCriarTurnoOperador(...args),
  listarTurnosOperador: (...args: unknown[]) => mockListarTurnosOperador(...args),
}))

describe('turnoOperadorService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('troca operador finalizando turno atual e criando novo turno', async () => {
    mockGetTurnoOperadorAtual.mockResolvedValue({ id: 10, caixa_diario_id: 1, status: 'aberto' })
    mockFinalizarTurnoOperador.mockResolvedValue(true)
    mockCriarTurnoOperador.mockResolvedValue({ id: 11, caixa_diario_id: 1, operador_id: 200, status: 'aberto' })

    const resultado = await trocarOperador({
      caixa_diario_id: 1,
      novo_operador_id: 200,
      novo_operador_nome: 'Maria',
      observacoes: 'troca de almoço',
    })

    expect(mockGetTurnoOperadorAtual).toHaveBeenCalledWith(1)
    expect(mockFinalizarTurnoOperador).toHaveBeenCalledWith(10, null, 'troca_turno')
    expect(mockCriarTurnoOperador).toHaveBeenCalledWith({
      caixa_diario_id: 1,
      operador_id: 200,
      operador_nome: 'Maria',
      observacoes: 'troca de almoço',
    })
    expect(resultado).toEqual({
      ok: true,
      turno: { id: 11, caixa_diario_id: 1, operador_id: 200, status: 'aberto' },
    })
  })

  it('retorna erro quando falha ao finalizar turno atual', async () => {
    mockGetTurnoOperadorAtual.mockResolvedValue({ id: 5, caixa_diario_id: 3, status: 'aberto' })
    mockFinalizarTurnoOperador.mockResolvedValue(false)

    const resultado = await trocarOperador({
      caixa_diario_id: 3,
      novo_operador_id: 400,
      novo_operador_nome: 'João',
    })

    expect(mockCriarTurnoOperador).not.toHaveBeenCalled()
    expect(resultado).toEqual({ ok: false, erro: 'Erro ao finalizar turno atual' })
  })

  it('retorna erro quando falha ao criar novo turno', async () => {
    mockGetTurnoOperadorAtual.mockResolvedValue(null)
    mockCriarTurnoOperador.mockResolvedValue(null)

    const resultado = await trocarOperador({
      caixa_diario_id: 7,
      novo_operador_id: 500,
      novo_operador_nome: 'Carlos',
    })

    expect(mockFinalizarTurnoOperador).not.toHaveBeenCalled()
    expect(resultado).toEqual({ ok: false, erro: 'Erro ao criar novo turno' })
  })

  it('delegates listarTurnos para o repository', async () => {
    const turnos = [{ id: 1, caixa_diario_id: 9 }, { id: 2, caixa_diario_id: 9 }]
    mockListarTurnosOperador.mockResolvedValue(turnos)

    const resultado = await listarTurnos(9)

    expect(mockListarTurnosOperador).toHaveBeenCalledWith(9)
    expect(resultado).toEqual(turnos)
  })
})
