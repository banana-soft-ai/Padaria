import { formatCpfDisplay } from '@/lib/formatCpf'

describe('lib/formatCpf', () => {
  describe('formatCpfDisplay', () => {
    it('retorna vazio para string vazia ou só não-dígitos', () => {
      expect(formatCpfDisplay('')).toBe('')
      expect(formatCpfDisplay('...')).toBe('')
    })

    it('formata parcialmente com 1 a 3 dígitos', () => {
      expect(formatCpfDisplay('1')).toBe('1')
      expect(formatCpfDisplay('12')).toBe('12')
      expect(formatCpfDisplay('123')).toBe('123')
    })

    it('formata parcialmente com 4 a 6 dígitos', () => {
      expect(formatCpfDisplay('1234')).toBe('123.4')
      expect(formatCpfDisplay('123456')).toBe('123.456')
    })

    it('formata parcialmente com 7 a 9 dígitos', () => {
      expect(formatCpfDisplay('1234567')).toBe('123.456.7')
      expect(formatCpfDisplay('123456789')).toBe('123.456.789')
    })

    it('formata CPF completo com 11 dígitos (000.000.000-00)', () => {
      expect(formatCpfDisplay('12345678901')).toBe('123.456.789-01')
    })

    it('limita a 11 dígitos quando há mais caracteres', () => {
      expect(formatCpfDisplay('123456789012')).toBe('123.456.789-01')
    })

    it('aceita string já formatada e normaliza', () => {
      expect(formatCpfDisplay('123.456.789-01')).toBe('123.456.789-01')
    })

    it('ignora caracteres não numéricos na entrada', () => {
      expect(formatCpfDisplay('123.456.789-01')).toBe('123.456.789-01')
    })
  })
})
