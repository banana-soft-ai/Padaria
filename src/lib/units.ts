export type BaseUnit = 'g' | 'ml' | 'un'

export function convertToBaseQuantity(unit: string, quantity: number): { baseUnit: BaseUnit; quantityInBase: number } {
  if (!quantity || isNaN(quantity)) return { baseUnit: 'un', quantityInBase: 0 }

  const u = unit?.toLowerCase()
  if (u === 'kg') {
    return { baseUnit: 'g', quantityInBase: quantity * 1000 }
  }
  if (u === 'g') {
    return { baseUnit: 'g', quantityInBase: quantity }
  }
  if (u === 'l') {
    return { baseUnit: 'ml', quantityInBase: quantity * 1000 }
  }
  if (u === 'ml') {
    return { baseUnit: 'ml', quantityInBase: quantity }
  }
  // units/countable
  return { baseUnit: 'un', quantityInBase: quantity }
}

export function calculatePrecoUnitario(precoPacote: number | null, unit: string, quantidadePacote: number | null): number | null {
  if (!precoPacote || !quantidadePacote) return null
  if (quantidadePacote === 0) return null
  return precoPacote / quantidadePacote
}
