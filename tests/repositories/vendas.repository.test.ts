/**
 * Testes para vendas.repository (insertVenda, insertVendaItens)
 */

import { insertVenda, insertVendaItens } from '@/repositories/vendas.repository'
import createSupabaseMock from '../fixtures/supabase.mock'
import { VENDA_DINHEIRO_MOCK } from '../fixtures/venda.fixtures'

describe('vendas.repository', () => {
  describe('insertVenda', () => {
    it('deve inserir venda e retornar registro com id', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.single.mockResolvedValueOnce({
        data: { ...VENDA_DINHEIRO_MOCK, id: 1 },
        error: null,
      })

      const resultado = await insertVenda(supabase, {
        data: '2026-02-13',
        forma_pagamento: 'dinheiro',
        valor_total: 50,
        valor_pago: 50,
        valor_debito: 0,
        status: 'finalizada',
        caixa_diario_id: 1,
      })

      expect(resultado.id).toBe(1)
      expect(mocks.from).toHaveBeenCalledWith('vendas')
      expect(mocks.insert).toHaveBeenCalled()
    })

    it('deve lançar erro quando insert falha', async () => {
      const { supabase, mocks } = createSupabaseMock()

      const supabaseError = { message: 'Constraint violation', code: '23505' }
      mocks.single.mockResolvedValueOnce({
        data: null,
        error: supabaseError,
      })

      await expect(
        insertVenda(supabase, {
          data: '2026-02-13',
          forma_pagamento: 'dinheiro',
          valor_total: 50,
          valor_pago: 50,
          valor_debito: 0,
        })
      ).rejects.toEqual(supabaseError)
    })
  })

  describe('insertVendaItens', () => {
    it('deve inserir itens e retornar quantidade', async () => {
      const { supabase, mocks } = createSupabaseMock()

      mocks.select.mockResolvedValueOnce({
        data: [{ id: 1 }, { id: 2 }],
        error: null,
      })

      const count = await insertVendaItens(supabase, 1, [
        {
          tipo: 'receita',
          item_id: 100,
          quantidade: 1,
          preco_unitario: 10,
        },
        {
          tipo: 'varejo',
          varejo_id: 200,
          quantidade: 2,
          preco_unitario: 5,
        },
      ])

      expect(count).toBe(2)
      expect(mocks.from).toHaveBeenCalledWith('venda_itens')
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            venda_id: 1,
            tipo: 'receita',
            item_id: 100,
            quantidade: 1,
            preco_unitario: 10,
          }),
          expect.objectContaining({
            venda_id: 1,
            tipo: 'varejo',
            varejo_id: 200,
            quantidade: 2,
            preco_unitario: 5,
          }),
        ])
      )
    })

    it('deve retornar 0 quando array de itens é vazio', async () => {
      const { supabase } = createSupabaseMock()

      const count = await insertVendaItens(supabase, 1, [])

      expect(count).toBe(0)
    })
  })
})
