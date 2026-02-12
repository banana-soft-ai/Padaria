export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import { createSupabaseCookies } from '@/lib/supabase/supabaseCookies'
import { clientEnv } from '@/env/client-env'
import { serverEnv } from '@/env/server-env'
import { obterDataLocal, obterInicioMes } from '@/lib/dateUtils'
import { buscarMetricasPeriodo } from '@/services/vendasMetricas.service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dataInicioParam = searchParams.get('dataInicio')
  const dataFimParam = searchParams.get('dataFim')

  const hoje = obterDataLocal()
  const inicioMes = obterInicioMes()
  const dataInicio = dataInicioParam || inicioMes
  const dataFim = dataFimParam || hoje

  const cookieStore = await nextCookies()
  const supabaseUrl = serverEnv.SUPABASE_URL || clientEnv.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = serverEnv.SUPABASE_ANON_KEY || clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    { cookies: createSupabaseCookies(cookieStore) }
  )

  try {
    const metricas = await buscarMetricasPeriodo(supabase, dataInicio, dataFim)

    return NextResponse.json({
      unidadesVendidas: metricas.unidadesVendidas,
      receitaTotal: metricas.receitaTotal,
      ticketMedio: metricas.ticketMedio,
      totalPix: metricas.porFormaPagamento.pix,
      totalDinheiro: metricas.porFormaPagamento.dinheiro,
      totalDebito: metricas.porFormaPagamento.debito,
      totalCredito: metricas.porFormaPagamento.credito,
      totalCaderneta: metricas.porFormaPagamento.caderneta,
      valorReceber: metricas.valorReceber
    })
  } catch (error) {
    console.error('Erro no endpoint /api/gestao/vendas/metricas:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
