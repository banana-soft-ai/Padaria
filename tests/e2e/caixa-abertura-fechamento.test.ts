import { createE2ELabel, getSupabaseE2EClient, hasSupabaseEnv } from './helpers/supabase-e2e'

const describeIfSupabase = hasSupabaseEnv ? describe : describe.skip

describeIfSupabase('E2E caixa abertura/fechamento (Supabase real)', () => {
  it('abre e fecha um caixa de teste no mesmo dia', async () => {
    const supabase = getSupabaseE2EClient()
    let caixaId: number | undefined

    try {
      const dataHoje = new Date().toISOString().split('T')[0]
      const observacao = createE2ELabel('TESTE E2E Abertura')

      const { data: caixaAberto, error: aberturaError } = await supabase
        .from('caixa_diario')
        .insert({
          data: dataHoje,
          status: 'aberto',
          valor_abertura: 100,
          observacoes_abertura: observacao,
          usuario_abertura: 'jest-e2e',
        })
        .select('id, status, data, valor_abertura')
        .single()

      expect(aberturaError).toBeNull()
      expect(caixaAberto?.status).toBe('aberto')
      caixaId = caixaAberto?.id

      const { data: caixaFechado, error: fechamentoError } = await supabase
        .from('caixa_diario')
        .update({
          status: 'fechado',
          valor_fechamento: 125,
          observacoes_fechamento: 'TESTE E2E Fechamento',
          usuario_fechamento: 'jest-e2e',
          data_fechamento: new Date().toISOString(),
        })
        .eq('id', caixaId)
        .select('id, status, valor_fechamento')
        .single()

      expect(fechamentoError).toBeNull()
      expect(caixaFechado?.status).toBe('fechado')
      expect(Number(caixaFechado?.valor_fechamento)).toBe(125)
    } finally {
      if (caixaId) {
        await supabase.from('caixa_diario').delete().eq('id', caixaId)
      }
    }
  })
})

if (!hasSupabaseEnv) {
  describe('E2E caixa abertura/fechamento (Supabase real)', () => {
    it('requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
      expect(hasSupabaseEnv).toBe(false)
    })
  })
}
