/**
 * Testes para caixa.service
 */

import {
  carregarCaixaHoje,
  abrirNovoCaixa,
  fecharCaixaDoDia,
  registrarSaidaCaixa,
  recalcularTotaisCaixa,
} from '@/services/caixa.service'
import * as caixaRepo from '@/repositories/caixaDiario.repository'
import createSupabaseMock from '../fixtures/supabase.mock'
import {
  CAIXA_ABERTO_MOCK,
  CAIXA_FECHADO_MOCK,
} from '../fixtures/caixa.fixtures'

// Mock do repository
jest.mock('@/repositories/caixaDiario.repository')

// Mock do dateUtils
jest.mock('@/lib/dateUtils', () => ({
  obterDataLocal: jest.fn(() => '2026-02-13'),
}))

const mockedRepo = caixaRepo as jest.Mocked<typeof caixaRepo>

describe('caixa.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('carregarCaixaHoje', () => {
    it('deve retornar null quando não há caixa aberto', async () => {
      const { supabase } = createSupabaseMock()

      mockedRepo.fetchCaixasAbertos.mockResolvedValue([])

      const resultado = await carregarCaixaHoje(supabase)

      expect(resultado.caixa).toBeNull()
      expect(resultado.multiplosAbertos).toBe(false)
      expect(resultado.caixasFechadosAutomaticamente).toBe(0)
    })

    it('deve retornar caixa quando há apenas 1 aberto', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mockedRepo.fetchCaixasAbertos.mockResolvedValue([CAIXA_ABERTO_MOCK])

      // calcularSaidasCaixa: 1º await select fluxo_caixa, 2º await update caixa_diario
      mocks.then.mockResolvedValueOnce({ data: [], error: null })
      mocks.then.mockResolvedValueOnce({ data: null, error: null })

      const resultado = await carregarCaixaHoje(supabase)

      expect(resultado.caixa).toBeDefined()
      expect(resultado.caixa!.id).toBe(CAIXA_ABERTO_MOCK.id)
      expect(resultado.multiplosAbertos).toBe(false)
    }, 8000)

    it('deve corrigir múltiplos caixas abertos automaticamente', async () => {
      const { supabase, mocks } = createSupabaseMock()

      const caixa1 = { ...CAIXA_ABERTO_MOCK, id: 10 }
      const caixa2 = { ...CAIXA_ABERTO_MOCK, id: 9 }
      const caixa3 = { ...CAIXA_ABERTO_MOCK, id: 8 }

      mockedRepo.fetchCaixasAbertos.mockResolvedValue([caixa1, caixa2, caixa3])

      // 1º update (fechar 2 duplicados), 2º select fluxo_caixa, 3º update caixa_diario (calcularSaidasCaixa)
      mocks.then.mockResolvedValueOnce({ data: null, error: null })
      mocks.then.mockResolvedValueOnce({ data: null, error: null })
      mocks.then.mockResolvedValueOnce({ data: [], error: null })
      mocks.then.mockResolvedValueOnce({ data: null, error: null })

      const resultado = await carregarCaixaHoje(supabase)

      expect(resultado.multiplosAbertos).toBe(true)
      expect(resultado.caixasFechadosAutomaticamente).toBe(2)
      expect(resultado.caixa!.id).toBe(10) // Mantém o mais recente
    }, 8000)
  })

  describe('abrirNovoCaixa', () => {
    it('deve abrir caixa com valor válido', async () => {
      const { supabase } = createSupabaseMock()

      mockedRepo.fetchUltimoCaixaAberto.mockResolvedValue(null)
      mockedRepo.abrirCaixa.mockResolvedValue(CAIXA_ABERTO_MOCK)

      const resultado = await abrirNovoCaixa(supabase, 100, 'Abertura teste')

      expect(resultado).toEqual(CAIXA_ABERTO_MOCK)
      expect(mockedRepo.abrirCaixa).toHaveBeenCalledWith(
        supabase,
        expect.objectContaining({
          valor_abertura: 100,
          status: 'aberto',
          observacoes_abertura: 'Abertura teste',
        })
      )
    })

    it('deve rejeitar valor negativo', async () => {
      const { supabase } = createSupabaseMock()

      await expect(abrirNovoCaixa(supabase, -100)).rejects.toThrow(
        'Valor de abertura não pode ser negativo'
      )
    })

    it('deve rejeitar se já existe caixa aberto', async () => {
      const { supabase } = createSupabaseMock()

      mockedRepo.fetchUltimoCaixaAberto.mockResolvedValue(CAIXA_ABERTO_MOCK)

      await expect(abrirNovoCaixa(supabase, 100)).rejects.toThrow(
        'Já existe um caixa aberto no sistema'
      )
    })

    it('deve aceitar valor de abertura = 0', async () => {
      const { supabase } = createSupabaseMock()

      mockedRepo.fetchUltimoCaixaAberto.mockResolvedValue(null)
      mockedRepo.abrirCaixa.mockResolvedValue({ ...CAIXA_ABERTO_MOCK, valor_abertura: 0 })

      const resultado = await abrirNovoCaixa(supabase, 0)

      expect(resultado.valor_abertura).toBe(0)
    })
  })

  describe('fecharCaixaDoDia', () => {
    it('deve fechar caixa com diferenças calculadas', async () => {
      const { supabase } = createSupabaseMock()

      const caixaAtual = {
        ...CAIXA_ABERTO_MOCK,
        total_dinheiro: 300,
        total_pix: 200,
        total_debito: 100,
        total_credito: 50,
      }

      mockedRepo.fecharCaixa.mockResolvedValue(CAIXA_FECHADO_MOCK)

      const resultado = await fecharCaixaDoDia(supabase, caixaAtual.id, caixaAtual, {
        valor_final: 750,
        valor_saidas: 0,
        valor_dinheiro_informado: 310, // +10
        valor_pix_informado: 205,      // +5
        valor_debito_informado: 100,   // 0
        valor_credito_informado: 48,   // -2
        observacoes_fechamento: 'Teste',
      })

      expect(resultado.diferencaPorForma.dinheiro).toBe(10)
      expect(resultado.diferencaPorForma.pix).toBe(5)
      expect(resultado.diferencaPorForma.debito).toBe(0)
      expect(resultado.diferencaPorForma.credito).toBe(-2)
      expect(resultado.diferencaFinal).toBe(13) // 10 + 5 + 0 + (-2)
    })

    it('deve rejeitar fechamento de caixa já fechado', async () => {
      const { supabase } = createSupabaseMock()

      await expect(
        fecharCaixaDoDia(supabase, CAIXA_FECHADO_MOCK.id, CAIXA_FECHADO_MOCK, {
          valor_final: 0,
          valor_saidas: 0,
          valor_dinheiro_informado: 0,
          valor_pix_informado: 0,
          valor_debito_informado: 0,
          valor_credito_informado: 0,
        })
      ).rejects.toThrow('Este caixa já foi fechado')
    })

    it('deve calcular diferença zero quando valores batem', async () => {
      const { supabase } = createSupabaseMock()

      const caixaAtual = {
        ...CAIXA_ABERTO_MOCK,
        total_dinheiro: 100,
        total_pix: 200,
        total_debito: 0,
        total_credito: 0,
      }

      mockedRepo.fecharCaixa.mockResolvedValue(CAIXA_FECHADO_MOCK)

      const resultado = await fecharCaixaDoDia(supabase, caixaAtual.id, caixaAtual, {
        valor_final: 400,
        valor_saidas: 0,
        valor_dinheiro_informado: 100, // exato
        valor_pix_informado: 200,      // exato
        valor_debito_informado: 0,
        valor_credito_informado: 0,
      })

      expect(resultado.diferencaFinal).toBe(0)
      expect(resultado.diferencaPorForma.dinheiro).toBe(0)
      expect(resultado.diferencaPorForma.pix).toBe(0)
    })
  })

  describe('registrarSaidaCaixa', () => {
    it('deve registrar saída com sucesso', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.then.mockResolvedValue({ data: null, error: null })

      await registrarSaidaCaixa(supabase, 1, 50, 'Pagamento de conta')

      expect(mocks.from).toHaveBeenCalledWith('fluxo_caixa')
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'saida',
          valor: 50,
          descricao: 'Pagamento de conta',
        })
      )
    }, 8000)

    it('deve rejeitar valor zero ou negativo', async () => {
      const { supabase } = createSupabaseMock()

      await expect(
        registrarSaidaCaixa(supabase, 1, 0, 'Teste')
      ).rejects.toThrow('Valor da saída deve ser maior que zero')

      await expect(
        registrarSaidaCaixa(supabase, 1, -10, 'Teste')
      ).rejects.toThrow('Valor da saída deve ser maior que zero')
    })
  })

  describe('recalcularTotaisCaixa', () => {
    it('deve recalcular totais por forma de pagamento', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.then.mockResolvedValue({
        data: [
          { valor_total: 100, forma_pagamento: 'dinheiro' },
          { valor_total: 200, forma_pagamento: 'pix' },
          { valor_total: 50, forma_pagamento: 'cartao_debito' },
          { valor_total: 75, forma_pagamento: 'caderneta' },
        ],
        error: null,
      })

      mockedRepo.atualizarTotaisCaixa.mockResolvedValue(undefined)

      await recalcularTotaisCaixa(supabase, 1)

      expect(mockedRepo.atualizarTotaisCaixa).toHaveBeenCalledWith(
        supabase,
        1,
        expect.objectContaining({
          total_vendas: 425,
          total_dinheiro: 100,
          total_pix: 200,
          total_debito: 50,
          total_caderneta: 75,
          total_credito: 0,
        })
      )
    })

    it('deve lidar com caixa sem vendas', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.then.mockResolvedValue({
        data: [],
        error: null,
      })

      mockedRepo.atualizarTotaisCaixa.mockResolvedValue(undefined)

      await recalcularTotaisCaixa(supabase, 1)

      expect(mockedRepo.atualizarTotaisCaixa).toHaveBeenCalledWith(
        supabase,
        1,
        expect.objectContaining({
          total_vendas: 0,
          total_dinheiro: 0,
          total_pix: 0,
        })
      )
    })
  })
})
