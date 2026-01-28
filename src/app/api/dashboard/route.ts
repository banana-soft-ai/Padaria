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
        const inicioMes = obterInicioMes()

        // 1) Vendas do dia
        const { data: vendasHojeArr, error: vendasHojeErr } = await supabase
            .from('vendas')
            .select('id, valor_pago, valor_debito, forma_pagamento')
            .eq('data', hoje)

        if (vendasHojeErr) console.error('Erro ao carregar vendas hoje:', vendasHojeErr)
        
        const vendasHojeTotal = (vendasHojeArr || []).reduce((s, v) => {
            const valor = v.forma_pagamento === 'caderneta' ? (Number(v.valor_debito) || 0) : (Number(v.valor_pago) || 0)
            return s + valor
        }, 0)
        const vendasHojeCount = (vendasHojeArr || []).length

        // 2) Vendas do mês
        const { data: vendasMesArr, error: vendasMesErr } = await supabase
            .from('vendas')
            .select('id, valor_pago, valor_debito, forma_pagamento')
            .gte('data', inicioMes)
            .lte('data', hoje)

        if (vendasMesErr) console.error('Erro ao carregar vendas do mês:', vendasMesErr)

        const totalMesGestao = (vendasMesArr || []).reduce((s, v) => {
            const valor = v.forma_pagamento === 'caderneta' ? (Number(v.valor_debito) || 0) : (Number(v.valor_pago) || 0)
            return s + valor
        }, 0)
        const vendasMesCount = (vendasMesArr || []).length

        // 3) Itens vendidos hoje
        let itensVendidosHoje = 0
        if (vendasHojeCount > 0) {
            const vendaIds = (vendasHojeArr || []).map((r: any) => r.id).filter(Boolean)
            if (vendaIds.length > 0) {
                const { data: itensData, error: itensErr } = await supabase
                    .from('venda_itens')
                    .select('quantidade')
                    .in('venda_id', vendaIds)

                if (itensErr) console.error('Erro ao buscar itens vendidos hoje:', itensErr)
                itensVendidosHoje = (itensData || []).reduce((sum, it) => sum + (Number(it.quantidade) || 0), 0)
            }
        }

        // 4) Ticket médio hoje
        const ticketMedioHoje = vendasHojeCount > 0 ? vendasHojeTotal / vendasHojeCount : 0

        return NextResponse.json({
            vendasHoje: {
                total: vendasHojeTotal,
                count: vendasHojeCount,
                fonte: 'vendas'
            },
            vendasMes: {
                total: totalMesGestao,
                count: vendasMesCount,
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