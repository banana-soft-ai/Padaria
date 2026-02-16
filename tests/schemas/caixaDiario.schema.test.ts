import {
  CaixaDiarioSchema,
  CaixaDiarioInsertSchema,
  CaixaDiarioUpdateSchema,
  validarCaixaDiario,
  validarCaixaDiarioInsert,
  validarCaixaDiarioUpdate,
  validarCaixaDiarioSafe,
} from '@/schemas/caixaDiario.schema'

describe('CaixaDiarioSchema', () => {
  describe('validação de dados válidos', () => {
    it('deve validar caixa aberto corretamente', () => {
      const caixaValido = {
        id: 1,
        data: '2026-02-13',
        status: 'aberto' as const,
        valor_abertura: 100,
        data_abertura: '2026-02-13T08:00:00Z',
        usuario_abertura: 'Admin',
        observacoes_abertura: 'Abertura normal',
        total_vendas: null,
        total_entradas: null,
        valor_saidas: null,
        total_saidas: null,
        total_pix: null,
        total_debito: null,
        total_credito: null,
        total_dinheiro: null,
        total_caderneta: null,
        created_at: '2026-02-13T08:00:00Z',
      }

      const resultado = validarCaixaDiario(caixaValido)

      expect(resultado).toEqual(caixaValido)
      expect(resultado.status).toBe('aberto')
      expect(resultado.valor_abertura).toBe(100)
    })

    it('deve validar caixa fechado com totais e diferenças', () => {
      const caixaFechado = {
        id: 2,
        data: '2026-02-12',
        status: 'fechado' as const,
        valor_abertura: 100,
        valor_fechamento: 1500,
        total_vendas: 1200,
        total_entradas: 1200,
        valor_saidas: 50,
        total_saidas: 50,
        total_pix: 300,
        total_debito: 400,
        total_credito: 200,
        total_dinheiro: 300,
        total_caderneta: 0,
        diferenca: 10,
        diferenca_dinheiro: 5,
        diferenca_pix: 3,
        diferenca_debito: 2,
        diferenca_credito: 0,
        valor_dinheiro_informado: 305,
        valor_pix_informado: 303,
        valor_debito_informado: 402,
        valor_credito_informado: 200,
        data_abertura: '2026-02-12T08:00:00Z',
        data_fechamento: '2026-02-12T18:00:00Z',
        usuario_abertura: 'Admin',
        usuario_fechamento: 'Admin',
        observacoes_abertura: 'Abertura',
        observacoes_fechamento: 'Fechamento',
        created_at: '2026-02-12T08:00:00Z',
        updated_at: '2026-02-12T18:00:00Z',
      }

      const resultado = validarCaixaDiario(caixaFechado)

      expect(resultado.status).toBe('fechado')
      expect(resultado.total_vendas).toBe(1200)
      expect(resultado.diferenca).toBe(10)
    })
  })

  describe('validação de dados inválidos', () => {
    it('deve rejeitar ID não numérico', () => {
      const caixaInvalido = {
        id: 'abc',
        data: '2026-02-13',
        status: 'aberto',
        valor_abertura: 100,
      }

      expect(() => validarCaixaDiario(caixaInvalido)).toThrow()
    })

    it('deve rejeitar ID negativo', () => {
      const caixaInvalido = {
        id: -1,
        data: '2026-02-13',
        status: 'aberto',
        valor_abertura: 100,
      }

      expect(() => validarCaixaDiario(caixaInvalido)).toThrow()
    })

    it('deve rejeitar data em formato inválido', () => {
      const caixaInvalido = {
        id: 1,
        data: '13/02/2026', // Formato errado
        status: 'aberto',
        valor_abertura: 100,
      }

      expect(() => validarCaixaDiario(caixaInvalido)).toThrow()
    })

    it('deve rejeitar status inválido', () => {
      const caixaInvalido = {
        id: 1,
        data: '2026-02-13',
        status: 'pendente', // Status não permitido
        valor_abertura: 100,
      }

      expect(() => validarCaixaDiario(caixaInvalido)).toThrow()
    })

    it('deve rejeitar valor_abertura negativo', () => {
      const caixaInvalido = {
        id: 1,
        data: '2026-02-13',
        status: 'aberto',
        valor_abertura: -100,
      }

      expect(() => validarCaixaDiario(caixaInvalido)).toThrow()
    })

    it('deve rejeitar valor_fechamento negativo', () => {
      const caixaInvalido = {
        id: 1,
        data: '2026-02-13',
        status: 'fechado',
        valor_abertura: 100,
        valor_fechamento: -500,
      }

      expect(() => validarCaixaDiario(caixaInvalido)).toThrow()
    })

    it('deve rejeitar total_vendas negativo', () => {
      const caixaInvalido = {
        id: 1,
        data: '2026-02-13',
        status: 'fechado',
        valor_abertura: 100,
        total_vendas: -100,
      }

      expect(() => validarCaixaDiario(caixaInvalido)).toThrow()
    })

    it('deve rejeitar data_abertura em formato não ISO 8601', () => {
      const caixaInvalido = {
        id: 1,
        data: '2026-02-13',
        status: 'aberto',
        valor_abertura: 100,
        data_abertura: '13/02/2026 08:00', // Não é ISO 8601
      }

      expect(() => validarCaixaDiario(caixaInvalido)).toThrow()
    })
  })

  describe('CaixaDiarioInsertSchema', () => {
    it('deve validar dados mínimos para Insert', () => {
      const insertValido = {
        data: '2026-02-13',
        status: 'aberto' as const,
        valor_abertura: 100,
      }

      const resultado = validarCaixaDiarioInsert(insertValido)

      expect(resultado.data).toBe('2026-02-13')
      expect(resultado.status).toBe('aberto')
      expect(resultado.valor_abertura).toBe(100)
    })

    it('deve rejeitar Insert sem data', () => {
      const insertInvalido = {
        status: 'aberto' as const,
        valor_abertura: 100,
      }

      expect(() => validarCaixaDiarioInsert(insertInvalido)).toThrow()
    })

    it('deve rejeitar Insert sem status', () => {
      const insertInvalido = {
        data: '2026-02-13',
        valor_abertura: 100,
      }

      expect(() => validarCaixaDiarioInsert(insertInvalido)).toThrow()
    })

    it('deve rejeitar Insert sem valor_abertura', () => {
      const insertInvalido = {
        data: '2026-02-13',
        status: 'aberto' as const,
      }

      expect(() => validarCaixaDiarioInsert(insertInvalido)).toThrow()
    })

    it('deve aceitar Insert com campos opcionais', () => {
      const insertComOpcionais = {
        data: '2026-02-13',
        status: 'aberto' as const,
        valor_abertura: 100,
        observacoes_abertura: 'Teste',
        usuario_abertura: 'Admin',
        data_abertura: '2026-02-13T08:00:00Z',
      }

      const resultado = validarCaixaDiarioInsert(insertComOpcionais)

      expect(resultado.observacoes_abertura).toBe('Teste')
      expect(resultado.usuario_abertura).toBe('Admin')
    })
  })

  describe('CaixaDiarioUpdateSchema', () => {
    it('deve validar Update parcial', () => {
      const updateValido = {
        total_vendas: 500,
        total_entradas: 450,
      }

      const resultado = validarCaixaDiarioUpdate(updateValido)

      expect(resultado.total_vendas).toBe(500)
      expect(resultado.total_entradas).toBe(450)
    })

    it('deve validar Update vazio (partial)', () => {
      const updateVazio = {}

      const resultado = validarCaixaDiarioUpdate(updateVazio)

      expect(resultado).toEqual({})
    })

    it('deve validar Update de fechamento completo', () => {
      const updateFechamento = {
        status: 'fechado' as const,
        valor_fechamento: 1500,
        total_vendas: 1200,
        diferenca: 10,
        data_fechamento: '2026-02-13T18:00:00Z',
        usuario_fechamento: 'Admin',
        observacoes_fechamento: 'Fechamento OK',
      }

      const resultado = validarCaixaDiarioUpdate(updateFechamento)

      expect(resultado.status).toBe('fechado')
      expect(resultado.valor_fechamento).toBe(1500)
    })
  })

  describe('validarCaixaDiarioSafe', () => {
    it('deve retornar success=true para dados válidos', () => {
      const caixaValido = {
        id: 1,
        data: '2026-02-13',
        status: 'aberto' as const,
        valor_abertura: 100,
      }

      const result = validarCaixaDiarioSafe(caixaValido)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(1)
      }
    })

    it('deve retornar success=false para dados inválidos', () => {
      const caixaInvalido = {
        id: -1,
        data: '13/02/2026',
        status: 'pendente',
        valor_abertura: -100,
      }

      const result = validarCaixaDiarioSafe(caixaInvalido)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })

  describe('edge cases', () => {
    it('deve aceitar valor_abertura = 0', () => {
      const caixa = {
        id: 1,
        data: '2026-02-13',
        status: 'aberto' as const,
        valor_abertura: 0, // Zero é válido (não negativo)
      }

      const resultado = validarCaixaDiario(caixa)

      expect(resultado.valor_abertura).toBe(0)
    })

    it('deve aceitar campos null/undefined opcionais', () => {
      const caixa = {
        id: 1,
        data: '2026-02-13',
        status: 'aberto' as const,
        valor_abertura: 100,
        total_vendas: null,
        observacoes_abertura: undefined,
      }

      const resultado = validarCaixaDiario(caixa)

      expect(resultado.total_vendas).toBeNull()
    })

    it('deve validar todas as formas de pagamento com totais', () => {
      const caixaComTodosTotais = {
        id: 1,
        data: '2026-02-13',
        status: 'fechado' as const,
        valor_abertura: 100,
        total_pix: 100,
        total_debito: 200,
        total_credito: 150,
        total_dinheiro: 250,
        total_caderneta: 50,
      }

      const resultado = validarCaixaDiario(caixaComTodosTotais)

      expect(resultado.total_pix).toBe(100)
      expect(resultado.total_debito).toBe(200)
      expect(resultado.total_credito).toBe(150)
      expect(resultado.total_dinheiro).toBe(250)
      expect(resultado.total_caderneta).toBe(50)
    })

    it('deve aceitar diferenças negativas (falta de dinheiro)', () => {
      const caixaComDiferencaNegativa = {
        id: 1,
        data: '2026-02-13',
        status: 'fechado' as const,
        valor_abertura: 100,
        diferenca: -20, // Diferença negativa é válida
        diferenca_dinheiro: -10,
      }

      const resultado = validarCaixaDiario(caixaComDiferencaNegativa)

      expect(resultado.diferenca).toBe(-20)
      expect(resultado.diferenca_dinheiro).toBe(-10)
    })
  })
})
