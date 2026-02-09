import { obterDataLocal, obterInicioMes, obterInicioSemana } from '@/lib/dateUtils'

describe('lib/dateUtils', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  describe('obterDataLocal', () => {
    it('retorna YYYY-MM-DD no fuso America/Sao_Paulo', () => {
      jest.setSystemTime(new Date('2025-02-09T15:30:00.000Z'))
      const data = obterDataLocal('America/Sao_Paulo')
      expect(data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(data).toBe('2025-02-09')
    })

    it('formata mês e dia com zero à esquerda', () => {
      jest.setSystemTime(new Date('2025-01-05T12:00:00.000Z'))
      expect(obterDataLocal('UTC')).toBe('2025-01-05')
    })
  })

  describe('obterInicioMes', () => {
    it('retorna primeiro dia do mês atual (YYYY-MM-DD)', () => {
      jest.setSystemTime(new Date('2025-02-09T12:00:00.000Z'))
      const inicio = obterInicioMes()
      expect(inicio).toBe('2025-02-01')
    })

    it('formato correto para janeiro', () => {
      jest.setSystemTime(new Date('2025-01-15T12:00:00.000Z'))
      expect(obterInicioMes()).toBe('2025-01-01')
    })
  })

  describe('obterInicioSemana', () => {
    it('retorna segunda-feira da semana atual', () => {
      // 2025-02-09 é domingo; segunda da mesma semana é 2025-02-03
      jest.setSystemTime(new Date('2025-02-09T12:00:00.000Z'))
      const inicio = obterInicioSemana()
      expect(inicio).toBe('2025-02-03')
    })

    it('se já for segunda, retorna o próprio dia', () => {
      jest.setSystemTime(new Date('2025-02-03T12:00:00.000Z'))
      expect(obterInicioSemana()).toBe('2025-02-03')
    })
  })
})
