/**
 * Testes para barcodeParser (EAN-13 balança e etiqueta 11 dígitos)
 */

import {
  parseEan13Balanca,
  parseEtiqueta11Digitos,
} from '@/lib/barcodeParser'

describe('parseEan13Balanca', () => {
  it('deve retornar null para string vazia ou inválida', () => {
    expect(parseEan13Balanca('')).toBeNull()
    expect(parseEan13Balanca('123')).toBeNull()
    expect(parseEan13Balanca('12345678901234')).toBeNull()
    expect(parseEan13Balanca('201234567890a')).toBeNull()
  })

  it('deve retornar null para prefixo fora de 20-29', () => {
    expect(parseEan13Balanca('1912345678901')).toBeNull()
    expect(parseEan13Balanca('3012345678902')).toBeNull()
  })

  it('deve retornar null quando dígito verificador EAN-13 é inválido', () => {
    // Código com dígito verificador errado
    expect(parseEan13Balanca('2012345678900')).toBeNull()
  })

  it('deve parsear EAN-13 válido com prefixo 20-29', () => {
    // EAN-13: 201234567890 + dígito verificador. sum(ímpares*1, pares*3)=87, check=(10-7)%10=3
    const result = parseEan13Balanca('2012345678903')
    expect(result).not.toBeNull()
    expect(result!.codigoProduto).toBe('12345')
    expect(result!.valorEmbutido).toBe(67890)
  })

  it('deve extrair codigoProduto (pos 2-7) e valorEmbutido (pos 7-12)', () => {
    // 22 99999 00001 + check. sum => check = 8
    const result = parseEan13Balanca('2299999000018')
    expect(result).not.toBeNull()
    expect(result!.codigoProduto).toBe('99999')
    expect(result!.valorEmbutido).toBe(1)
  })
})

describe('parseEtiqueta11Digitos', () => {
  it('deve retornar null para string vazia ou tamanho diferente de 11', () => {
    expect(parseEtiqueta11Digitos('')).toBeNull()
    expect(parseEtiqueta11Digitos('12345')).toBeNull()
    expect(parseEtiqueta11Digitos('123456789012')).toBeNull()
    expect(parseEtiqueta11Digitos('1234567890a')).toBeNull()
  })

  it('deve parsear etiqueta 11 dígitos: PLU (5) + valor centavos (5) + dígito (1)', () => {
    const result = parseEtiqueta11Digitos('00123499991')
    expect(result).not.toBeNull()
    expect(result!.plu).toBe('00123')
    expect(result!.valorCentavos).toBe(49999)
  })

  it('deve aceitar PLU e valor em centavos válidos', () => {
    const result = parseEtiqueta11Digitos('12345100000')
    expect(result!.plu).toBe('12345')
    expect(result!.valorCentavos).toBe(10000) // R$ 100,00
  })
})
