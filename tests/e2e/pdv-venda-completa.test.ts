import { createE2ELabel, getSupabaseE2EClient, hasSupabaseEnv } from './helpers/supabase-e2e'

const describeIfSupabase = hasSupabaseEnv ? describe : describe.skip

describeIfSupabase('E2E PDV base (Supabase real)', () => {
  it('cria receita e produto vinculados para uso em cenários de venda', async () => {
    const supabase = getSupabaseE2EClient()
    const ids: { receitaId?: number; produtoId?: number } = {}

    try {
      const nomeReceita = createE2ELabel('TESTE E2E Receita')
      const { data: receita, error: receitaError } = await supabase
        .from('receitas')
        .insert({
          nome: nomeReceita,
          categoria: 'pao',
          rendimento: 10,
          unidade_rendimento: 'un',
          ativo: true,
        })
        .select('id, nome')
        .single()

      expect(receitaError).toBeNull()
      ids.receitaId = receita?.id

      const nomeProduto = createE2ELabel('TESTE E2E Produto')
      const { data: produto, error: produtoError } = await supabase
        .from('produtos')
        .insert({
          nome: nomeProduto,
          categoria: 'pao',
          receita_id: ids.receitaId,
          preco_venda: 9.9,
          unidade: 'un',
          estoque_atual: 30,
          estoque_minimo: 5,
          ativo: true,
        })
        .select('id, nome, receita_id')
        .single()

      expect(produtoError).toBeNull()
      expect(produto?.receita_id).toBe(ids.receitaId)
      ids.produtoId = produto?.id
    } finally {
      if (ids.produtoId) {
        await supabase.from('produtos').delete().eq('id', ids.produtoId)
      }
      if (ids.receitaId) {
        await supabase.from('receitas').delete().eq('id', ids.receitaId)
      }
    }
  })
})

if (!hasSupabaseEnv) {
  describe('E2E PDV base (Supabase real)', () => {
    it('requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
      expect(hasSupabaseEnv).toBe(false)
    })
  })
}
