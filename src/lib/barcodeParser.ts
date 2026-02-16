/**
 * Parsers de código de barras para PDV
 *
 * - EAN-13 de balança (prefixos 20-29): PP CCCCC VVVVV D
 * - Etiqueta 11 dígitos: CCCCC VVVVV D (PLU + preço em centavos + dígito)
 */

/** Resultado do parse EAN-13 balança: código do produto (5 dígitos) e valor embutido em centavos */
export interface Ean13BalancaResult {
  codigoProduto: string
  valorEmbutido: number
}

/** Resultado do parse etiqueta 11 dígitos: PLU (5 dígitos) e valor em centavos */
export interface Etiqueta11Result {
  plu: string
  valorCentavos: number
}

/**
 * EAN-13 de balança (prefixos 20-29): PP CCCCC VVVVV D
 * Valida dígito verificador EAN-13.
 */
export function parseEan13Balanca(
  codeNum: string
): Ean13BalancaResult | null {
  if (!codeNum || codeNum.length !== 13 || !/^\d+$/.test(codeNum)) return null
  const prefix = parseInt(codeNum.slice(0, 2), 10)
  if (prefix < 20 || prefix > 29) return null
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(codeNum[i], 10) * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  if (parseInt(codeNum[12], 10) !== check) return null
  const codigoProduto = codeNum.slice(2, 7)
  const valorEmbutido = parseInt(codeNum.slice(7, 12), 10)
  return { codigoProduto, valorEmbutido }
}

/**
 * Etiqueta 11 dígitos da balança: CCCCC VVVVV D (PLU + preço em centavos + dígito verificador)
 */
export function parseEtiqueta11Digitos(
  codeNum: string
): Etiqueta11Result | null {
  if (!codeNum || codeNum.length !== 11 || !/^\d+$/.test(codeNum)) return null
  const plu = codeNum.substring(0, 5)
  const valorCentavos = parseInt(codeNum.substring(5, 10), 10)
  return { plu, valorCentavos }
}
