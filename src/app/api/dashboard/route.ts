export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import { createSupabaseCookies } from '@/lib/supabase/supabaseCookies'
import { clientEnv } from '@/env/client-env'
import { serverEnv } from '@/env/server-env'
import { obterDataLocal, obterInicioMes } from '@/lib/dateUtils'

export async function GET(request: Request) {
    // Next.js 15: obter cookie store com await e passar para createServerClient
    const cookieStore = await nextCookies();
    const supabaseUrl = serverEnv.SUPABASE_URL || clientEnv.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = serverEnv.SUPABASE_ANON_KEY || clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        { cookies: createSupabaseCookies(cookieStore) }
    )
    try {
        const hoje = obterDataLocal()

        // 1) Vendas do dia: preferir valores reportados em `caixa_diario` (PDV)
        const { data: caixaHoje, error: caixaError } = await supabase
            .from('caixa_diario')
            .select('total_entradas, total_vendas')
            .eq('data', hoje)
            .limit(1)
            .maybeSingle()

        if (caixaError) console.error('Erro ao buscar caixa do dia:', caixaError)

        // Se não houver registro de caixa, calcular a partir da tabela `vendas`
        let vendasHojeTotal = 0
        let vendasHojeCount = 0

        if (caixaHoje) {
            vendasHojeTotal = (caixaHoje.total_entradas as number) || (caixaHoje.total_vendas as number) || 0
            // contar vendas do dia para exibir contagem
            const { data: vendasHojeArr, error: vendasHojeErr } = await supabase
                .from('vendas')
                .select('id')
                .eq('data', hoje)
                .neq('forma_pagamento', 'caderneta')

            if (vendasHojeErr) console.error('Erro ao contar vendas hoje:', vendasHojeErr)
            vendasHojeCount = (vendasHojeArr && vendasHojeArr.length) || 0
        } else {
            const { data: vendasHojeArr, error: vendasHojeErr } = await supabase
                .from('vendas')
                .select('id, valor_pago')
                .eq('data', hoje)
                .neq('forma_pagamento', 'caderneta')

            if (vendasHojeErr) console.error('Erro ao carregar vendas hoje:', vendasHojeErr)
            if (vendasHojeArr && vendasHojeArr.length > 0) {
                vendasHojeTotal = vendasHojeArr.reduce((s, v) => s + ((v.valor_pago as number) || 0), 0)
                vendasHojeCount = vendasHojeArr.length
            }
        }

        // 2) Vendas do mês (somar `valor_pago` em `vendas` entre início do mês e hoje)
        const inicioMes = obterInicioMes()
        const { data: vendasMesArr, error: vendasMesErr } = await supabase
            .from('vendas')
            .select('valor_pago')
            .gte('data', inicioMes)
            .lte('data', hoje)
            .neq('forma_pagamento', 'caderneta')

        if (vendasMesErr) console.error('Erro ao carregar vendas do mês:', vendasMesErr)

        const totalMesGestao = (vendasMesArr || []).reduce((s, v) => s + ((v.valor_pago as number) || 0), 0)

        // 3) Itens vendidos hoje (somar `quantidade` em `venda_itens` para vendas de hoje)
        let itensVendidosHoje = 0
        if (vendasHojeCount > 0) {
            // buscar ids das vendas de hoje
            const { data: vendaIdsData } = await supabase
                .from('vendas')
                .select('id')
                .eq('data', hoje)
                .neq('forma_pagamento', 'caderneta')

            const vendaIds = (vendaIdsData || []).map((r: any) => r.id).filter(Boolean)
            if (vendaIds.length > 0) {
                const { data: itensData, error: itensErr } = await supabase
                    .from('venda_itens')
                    .select('quantidade')
                    .in('venda_id', vendaIds)

                if (itensErr) console.error('Erro ao buscar itens vendidos hoje:', itensErr)
                itensVendidosHoje = (itensData || []).reduce((sum, it) => sum + ((it.quantidade as number) || 0), 0)
            }
        }

        // 4) Ticket médio hoje = totalPagoHoje / vendasCountHoje
        const ticketMedioHoje = vendasHojeCount > 0 ? vendasHojeTotal / vendasHojeCount : 0

        return NextResponse.json({
            vendasHoje: {
                total: vendasHojeTotal,
                count: vendasHojeCount,
                fonte: caixaHoje ? 'caixa' : 'vendas'
            },
            vendasMes: {
                total: totalMesGestao,
                count: (vendasMesArr || []).length,
                fonte: 'vendas'
            },
            itensVendidosHoje,
            ticketMedioHoje
        })
    } catch (error) {
        console.error('Erro no endpoint /api/dashboard:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}