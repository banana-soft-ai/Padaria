/**
 * Testes para caixaDiario.repository
 */

import {
  fetchCaixasAbertos,
  fetchCaixaPorData,
  abrirCaixa,
  fecharCaixa,
  atualizarTotaisCaixa,
  corrigirCaixasDuplicados,
  fetchCaixasPorPeriodo,
  fetchUltimoCaixaAberto,
} from '@/repositories/caixaDiario.repository'
import createSupabaseMock, { createSupabaseError } from '../fixtures/supabase.mock'
import {
  CAIXA_ABERTO_MOCK,
  CAIXA_FECHADO_MOCK,
  CAIXAS_LISTA_MOCK,
  criarCaixaInsertMock,
  criarCaixaUpdateFechamentoMock,
} from '../fixtures/caixa.fixtures'

describe('caixaDiario.repository', () => {
  describe('fetchCaixasAbertos', () => {
    it('deve retornar todos os caixas com status aberto', async () => {
      const { supabase, mocks } = createSupabaseMock()

      // ✅ Mockar o 'then' para queries que não terminam com single/maybeSingle
      mocks.then.mockResolvedValueOnce({
        data: [CAIXA_ABERTO_MOCK, { ...CAIXA_ABERTO_MOCK, id: 99 }],
        error: null,
      })

      const resultado = await fetchCaixasAbertos(supabase)

      expect(resultado).toHaveLength(2)
      expect(resultado[0].status).toBe('aberto')
      expect(mocks.from).toHaveBeenCalledWith('caixa_diario')
      expect(mocks.eq).toHaveBeenCalledWith('status', 'aberto')
    })

    it('deve retornar array vazio quando não há caixas abertos', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.then.mockResolvedValueOnce({ data: [], error: null })

      const resultado = await fetchCaixasAbertos(supabase)

      expect(resultado).toEqual([])
    })

    it('deve lançar erro quando query falha', async () => {
      const { supabase, mocks } = createSupabaseMock()

      const erro = createSupabaseError('Erro de conexão')
      mocks.then.mockResolvedValueOnce({ data: null, error: erro })

      await expect(fetchCaixasAbertos(supabase)).rejects.toEqual(erro)
    })
  })

  describe('fetchCaixaPorData', () => {
    it('deve retornar caixa da data especificada', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.maybeSingle.mockResolvedValueOnce({
        data: CAIXA_ABERTO_MOCK,
        error: null,
      })

      const resultado = await fetchCaixaPorData(supabase, '2026-02-13')

      expect(resultado).toEqual(CAIXA_ABERTO_MOCK)
      expect(mocks.eq).toHaveBeenCalledWith('data', '2026-02-13')
    })

    it('deve retornar null quando não há caixa na data', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

      const resultado = await fetchCaixaPorData(supabase, '2026-12-31')

      expect(resultado).toBeNull()
    })
  })

  describe('abrirCaixa', () => {
    it('deve abrir novo caixa com sucesso', async () => {
      const { supabase, mocks } = createSupabaseMock()

      // Mock: verificar se já existe caixa (não existe)
      mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

      // Mock: inserir novo caixa
      mocks.single.mockResolvedValueOnce({
        data: CAIXA_ABERTO_MOCK,
        error: null,
      })

      const dados = criarCaixaInsertMock()
      const resultado = await abrirCaixa(supabase, dados)

      expect(resultado).toEqual(CAIXA_ABERTO_MOCK)
      expect(mocks.insert).toHaveBeenCalled()
    })

    it('deve rejeitar abertura quando já existe caixa aberto na data', async () => {
      const { supabase, mocks } = createSupabaseMock()

      // Mock: já existe caixa aberto
      mocks.maybeSingle.mockResolvedValueOnce({
        data: CAIXA_ABERTO_MOCK,
        error: null,
      })

      const dados = criarCaixaInsertMock({ data: '2026-02-13' })

      await expect(abrirCaixa(supabase, dados)).rejects.toThrow(
        'Já existe um caixa aberto para a data 2026-02-13'
      )
    })

    it('deve permitir abertura se caixa existente está fechado', async () => {
      const { supabase, mocks } = createSupabaseMock()

      // Mock: existe caixa mas está fechado
      mocks.maybeSingle.mockResolvedValueOnce({
        data: CAIXA_FECHADO_MOCK,
        error: null,
      })

      // Mock: inserir novo caixa
      mocks.single.mockResolvedValueOnce({
        data: CAIXA_ABERTO_MOCK,
        error: null,
      })

      const dados = criarCaixaInsertMock()
      const resultado = await abrirCaixa(supabase, dados)

      expect(resultado.status).toBe('aberto')
    })
  })

  describe('fecharCaixa', () => {
    it('deve fechar caixa com totais corretos', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.single.mockResolvedValueOnce({
        data: CAIXA_FECHADO_MOCK,
        error: null,
      })

      const dadosFechamento = criarCaixaUpdateFechamentoMock()
      const resultado = await fecharCaixa(supabase, 1, dadosFechamento)

      expect(resultado.status).toBe('fechado')
      expect(mocks.update).toHaveBeenCalled()
      expect(mocks.eq).toHaveBeenCalledWith('id', 1)
    })

    it('deve adicionar data_fechamento automaticamente', async () => {
      const { supabase, mocks } = createSupabaseMock()

      let dadosAtualizados: any
      mocks.update.mockImplementationOnce((dados?: any) => {
        dadosAtualizados = dados
        return mocks.queryBuilder
      })

      mocks.single.mockResolvedValueOnce({
        data: CAIXA_FECHADO_MOCK,
        error: null,
      })

      await fecharCaixa(supabase, 1, {})

      expect(dadosAtualizados.status).toBe('fechado')
      expect(dadosAtualizados.data_fechamento).toBeDefined()
    })
  })

  describe('atualizarTotaisCaixa', () => {
    it('deve atualizar totais do caixa', async () => {
      const { supabase, mocks } = createSupabaseMock()

      // ✅ Atualizar não termina com single, usa 'then'
      mocks.then.mockResolvedValueOnce({ data: null, error: null })

      await atualizarTotaisCaixa(supabase, 1, {
        total_vendas: 500,
        total_dinheiro: 300,
        total_pix: 200,
      })

      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          total_vendas: 500,
          total_dinheiro: 300,
          total_pix: 200,
        })
      )
      expect(mocks.eq).toHaveBeenCalledWith('id', 1)
    })
  })

  describe('corrigirCaixasDuplicados', () => {
    it('deve retornar caixa ativo quando há apenas 1 aberto', async () => {
      const { supabase, mocks } = createSupabaseMock()

      // ✅ Mock fetchCaixasAbertos: 1 caixa aberto (usa 'then')
      mocks.then.mockResolvedValueOnce({
        data: [CAIXA_ABERTO_MOCK],
        error: null,
      })

      const resultado = await corrigirCaixasDuplicados(supabase)

      expect(resultado.caixaAtivo).toEqual(CAIXA_ABERTO_MOCK)
      expect(resultado.caixasFechados).toBe(0)
    })

    it('deve fechar caixas duplicados, mantendo o mais recente', async () => {
      const { supabase, mocks } = createSupabaseMock()

      const caixaRecente = { ...CAIXA_ABERTO_MOCK, id: 100, data: '2026-02-13' }
      const caixaAntigo1 = { ...CAIXA_ABERTO_MOCK, id: 99, data: '2026-02-12' }
      const caixaAntigo2 = { ...CAIXA_ABERTO_MOCK, id: 98, data: '2026-02-11' }

      // ✅ Mock fetchCaixasAbertos: 3 caixas abertos (usa 'then')
      mocks.then.mockResolvedValueOnce({
        data: [caixaRecente, caixaAntigo1, caixaAntigo2],
        error: null,
      })

      // ✅ Mock fecharCaixa (será chamado 2x, usa 'single')
      mocks.single.mockResolvedValue({
        data: CAIXA_FECHADO_MOCK,
        error: null,
      })

      const resultado = await corrigirCaixasDuplicados(supabase)

      expect(resultado.caixaAtivo.id).toBe(100) // Mais recente
      expect(resultado.caixasFechados).toBe(2)
      expect(mocks.update).toHaveBeenCalledTimes(2) // Fechou 2 caixas
    })
  })

  describe('fetchCaixasPorPeriodo', () => {
    it('deve retornar caixas do período especificado', async () => {
      const { supabase, mocks } = createSupabaseMock()

      // ✅ Query termina com 'order', usa 'then'
      mocks.then.mockResolvedValueOnce({
        data: CAIXAS_LISTA_MOCK.slice(1, 3), // 2 caixas
        error: null,
      })

      const resultado = await fetchCaixasPorPeriodo(
        supabase,
        '2026-02-10',
        '2026-02-12'
      )

      expect(resultado).toHaveLength(2)
      expect(mocks.gte).toHaveBeenCalledWith('data', '2026-02-10')
      expect(mocks.lte).toHaveBeenCalledWith('data', '2026-02-12')
    })
  })

  describe('fetchUltimoCaixaAberto', () => {
    it('deve retornar último caixa aberto', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.maybeSingle.mockResolvedValueOnce({
        data: CAIXA_ABERTO_MOCK,
        error: null,
      })

      const resultado = await fetchUltimoCaixaAberto(supabase)

      expect(resultado).toEqual(CAIXA_ABERTO_MOCK)
      expect(mocks.eq).toHaveBeenCalledWith('status', 'aberto')
      expect(mocks.limit).toHaveBeenCalledWith(1)
    })

    it('deve retornar null quando não há caixas abertos', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

      const resultado = await fetchUltimoCaixaAberto(supabase)

      expect(resultado).toBeNull()
    })
  })
})
