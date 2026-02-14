import { createE2ELabel, getSupabaseE2EClient, hasSupabaseEnv } from './helpers/supabase-e2e'

const describeIfSupabase = hasSupabaseEnv ? describe : describe.skip

describeIfSupabase('E2E caderneta (Supabase real)', () => {
  it('cria cliente caderneta, registra movimentação e limpa dados de teste', async () => {
    const supabase = getSupabaseE2EClient()
    const ids: { clienteId?: number; movId?: number } = {}

    try {
      const nome = createE2ELabel('TESTE E2E Cliente')
      const { data: cliente, error: clienteError } = await supabase
        .from('clientes_caderneta')
        .insert({ nome, limite_credito: 200, saldo_devedor: 0, observacoes: 'TESTE E2E' })
        .select('id, nome, saldo_devedor')
        .single()

      expect(clienteError).toBeNull()
      expect(cliente?.nome).toBe(nome)
      ids.clienteId = cliente?.id

      const { data: movimentacao, error: movError } = await supabase
        .from('movimentacoes_caderneta')
        .insert({
          cliente_id: ids.clienteId,
          tipo: 'compra',
          valor: 25,
          saldo_anterior: 0,
          saldo_atual: 25,
          descricao: 'TESTE E2E movimentação',
        })
        .select('id, cliente_id, valor')
        .single()

      expect(movError).toBeNull()
      expect(movimentacao?.cliente_id).toBe(ids.clienteId)
      ids.movId = movimentacao?.id
    } finally {
      if (ids.movId) {
        await supabase.from('movimentacoes_caderneta').delete().eq('id', ids.movId)
      }
      if (ids.clienteId) {
        await supabase.from('clientes_caderneta').delete().eq('id', ids.clienteId)
      }
    }
  })
})

if (!hasSupabaseEnv) {
  describe('E2E caderneta (Supabase real)', () => {
    it('requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
      expect(hasSupabaseEnv).toBe(false)
    })
  })
}
