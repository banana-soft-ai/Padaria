import {
  convertToBaseQuantity,
  calculatePrecoUnitario,
  getUnidadeMinima,
} from '@/lib/units'

describe('lib/units', () => {
  describe('convertToBaseQuantity', () => {
    it('converte kg para g', () => {
      expect(convertToBaseQuantity('kg', 2)).toEqual({ baseUnit: 'g', quantityInBase: 2000 })
      expect(convertToBaseQuantity('KG', 1)).toEqual({ baseUnit: 'g', quantityInBase: 1000 })
    })

    it('mantém g em g', () => {
      expect(convertToBaseQuantity('g', 500)).toEqual({ baseUnit: 'g', quantityInBase: 500 })
    })

    it('converte L para ml', () => {
      expect(convertToBaseQuantity('l', 1)).toEqual({ baseUnit: 'ml', quantityInBase: 1000 })
      expect(convertToBaseQuantity('L', 0.5)).toEqual({ baseUnit: 'ml', quantityInBase: 500 })
    })

    it('mantém ml em ml', () => {
      expect(convertToBaseQuantity('ml', 250)).toEqual({ baseUnit: 'ml', quantityInBase: 250 })
    })

    it('unidade contável retorna un', () => {
      expect(convertToBaseQuantity('un', 10)).toEqual({ baseUnit: 'un', quantityInBase: 10 })
      expect(convertToBaseQuantity('cx', 5)).toEqual({ baseUnit: 'un', quantityInBase: 5 })
    })

    it('retorna 0 para quantidade inválida', () => {
      expect(convertToBaseQuantity('kg', 0)).toEqual({ baseUnit: 'un', quantityInBase: 0 })
      expect(convertToBaseQuantity('g', NaN)).toEqual({ baseUnit: 'un', quantityInBase: 0 })
    })
  })

  describe('calculatePrecoUnitario', () => {
    it('calcula preço unitário corretamente', () => {
      expect(calculatePrecoUnitario(100, 'kg', 10)).toBe(10)
      expect(calculatePrecoUnitario(20, 'un', 4)).toBe(5)
    })

    it('retorna null quando preço ou quantidade são null/zero', () => {
      expect(calculatePrecoUnitario(null, 'kg', 10)).toBeNull()
      expect(calculatePrecoUnitario(100, 'kg', null)).toBeNull()
      expect(calculatePrecoUnitario(100, 'kg', 0)).toBeNull()
    })
  })

  describe('getUnidadeMinima', () => {
    it('retorna unidade mínima para kg e L', () => {
      expect(getUnidadeMinima('kg')).toBe('g')
      expect(getUnidadeMinima('KG')).toBe('g')
      expect(getUnidadeMinima('l')).toBe('ml')
      expect(getUnidadeMinima('L')).toBe('ml')
    })

    it('mantém g e ml como estão', () => {
      expect(getUnidadeMinima('g')).toBe('g')
      expect(getUnidadeMinima('ml')).toBe('ml')
    })

    it('retorna un para outras unidades ou vazio', () => {
      expect(getUnidadeMinima('un')).toBe('un')
      expect(getUnidadeMinima('')).toBe('un')
      expect(getUnidadeMinima('cx')).toBe('cx')
    })
  })
})
