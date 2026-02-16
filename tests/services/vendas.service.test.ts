/**
 * Testes para vendas.service
 */

import { registrarVenda } from '@/services/vendas.service'
import * as vendasRepo from '@/repositories/vendas.repository'
import createSupabaseMock from '../fixtures/supabase.mock'
import { VENDA_DINHEIRO_MOCK } from '../fixtures/venda.fixtures'

jest.mock('@/repositories/vendas.repository')
jest.mock('@/lib/dateUtils', () => ({
  obterDataLocal: jest.fn(() => '2026-02-13'),
}))

const mockedRepo = vendasRepo as jest.Mocked<typeof vendasRepo>

describe('vendas.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('registrarVenda', () => {
    it('deve registrar venda e itens com sucesso', async () => {
      const { supabase } = createSupabaseMock()

      mockedRepo.insertVenda.mockResolvedValue({
        ...VENDA_DINHEIRO_MOCK,
        id: 1,
      } as vendasRepo.VendaRow)
      mockedRepo.insertVendaItens.mockResolvedValue(2)

      const resultado = await registrarVenda(supabase, {
        itens: [
          { item_id: 100, tipo: 'receita', quantidade: 1, preco_unitario: 10 },
          { item_id: 200, tipo: 'varejo', quantidade: 2, preco_unitario: 5 },
        ],
        forma_pagamento: 'dinheiro',
        valor_total: 20,
        valor_pago: 20,
        valor_debito: 0,
        caixa_diario_id: 1,
      })

      expect(resultado.vendaId).toBe(1)
      expect(resultado.itensRegistrados).toBe(2)
      expect(mockedRepo.insertVenda).toHaveBeenCalledWith(
        supabase,
        expect.objectContaining({
          data: '2026-02-13',
          forma_pagamento: 'dinheiro',
          valor_total: 20,
          valor_pago: 20,
          valor_debito: 0,
          status: 'finalizada',
          caixa_diario_id: 1,
        })
      )
      expect(mockedRepo.insertVendaItens).toHaveBeenCalledWith(
        supabase,
        1,
        expect.arrayContaining([
          expect.objectContaining({
            tipo: 'receita',
            item_id: 100,
            quantidade: 1,
            preco_unitario: 10,
          }),
          expect.objectContaining({
            tipo: 'varejo',
            varejo_id: 200,
            quantidade: 2,
            preco_unitario: 5,
          }),
        ])
      )
    })

    it('deve rejeitar venda sem itens', async () => {
      const { supabase } = createSupabaseMock()

      await expect(
        registrarVenda(supabase, {
          itens: [],
          forma_pagamento: 'dinheiro',
          valor_total: 50,
          valor_pago: 50,
          valor_debito: 0,
        })
      ).rejects.toThrow('Venda deve ter pelo menos um item')

      expect(mockedRepo.insertVenda).not.toHaveBeenCalled()
    })

    it('deve rejeitar valor_total <= 0', async () => {
      const { supabase } = createSupabaseMock()

      await expect(
        registrarVenda(supabase, {
          itens: [
            { item_id: 1, tipo: 'receita', quantidade: 1, preco_unitario: 10 },
          ],
          forma_pagamento: 'dinheiro',
          valor_total: 0,
          valor_pago: 0,
          valor_debito: 0,
        })
      ).rejects.toThrow('Valor total deve ser maior que zero')

      expect(mockedRepo.insertVenda).not.toHaveBeenCalled()
    })

    it('deve rejeitar caderneta sem cliente_caderneta_id', async () => {
      const { supabase } = createSupabaseMock()

      await expect(
        registrarVenda(supabase, {
          itens: [
            { item_id: 1, tipo: 'receita', quantidade: 1, preco_unitario: 10 },
          ],
          forma_pagamento: 'caderneta',
          valor_total: 50,
          valor_pago: 0,
          valor_debito: 50,
          cliente_caderneta_id: undefined,
        })
      ).rejects.toThrow('Venda na caderneta requer cliente_caderneta_id')

      await expect(
        registrarVenda(supabase, {
          itens: [
            { item_id: 1, tipo: 'receita', quantidade: 1, preco_unitario: 10 },
          ],
          forma_pagamento: 'caderneta',
          valor_total: 50,
          valor_pago: 0,
          valor_debito: 50,
          cliente_caderneta_id: 0,
        })
      ).rejects.toThrow('Venda na caderneta requer cliente_caderneta_id')

      expect(mockedRepo.insertVenda).not.toHaveBeenCalled()
    })

    it('deve aceitar caderneta com cliente_caderneta_id', async () => {
      const { supabase } = createSupabaseMock()

      mockedRepo.insertVenda.mockResolvedValue({
        ...VENDA_DINHEIRO_MOCK,
        id: 2,
      } as vendasRepo.VendaRow)
      mockedRepo.insertVendaItens.mockResolvedValue(1)

      const resultado = await registrarVenda(supabase, {
        itens: [
          { item_id: 1, tipo: 'receita', quantidade: 1, preco_unitario: 50 },
        ],
        forma_pagamento: 'caderneta',
        valor_total: 50,
        valor_pago: 0,
        valor_debito: 50,
        cliente_caderneta_id: 10,
      })

      expect(resultado.vendaId).toBe(2)
      expect(mockedRepo.insertVenda).toHaveBeenCalledWith(
        supabase,
        expect.objectContaining({
          forma_pagamento: 'caderneta',
          cliente_caderneta_id: 10,
          valor_debito: 50,
        })
      )
    })
  })
})
