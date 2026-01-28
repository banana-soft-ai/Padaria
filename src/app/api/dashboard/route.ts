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
        
        // Calcular 30 dias atrás em fuso local
        const dataHoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
        const trintaDiasAtras = new Date(dataHoje)
        trintaDiasAtras.setDate(dataHoje.getDate() - 30)
        const trintaDiasAtrasStr = `${trintaDiasAtras.getFullYear()}-${String(trintaDiasAtras.getMonth() + 1).padStart(2, '0')}-${String(trintaDiasAtras.getDate()).padStart(2, '0')}`

        // 1) Vendas do dia
        const { data: vendasHojeArr, error: vendasHojeErr } = await supabase
            .from('vendas')
            .select('id, valor_total, forma_pagamento')
            .eq('data', hoje)

        if (vendasHojeErr) console.error('Erro ao carregar vendas hoje:', vendasHojeErr)
        
        const vendasHojeTotal = (vendasHojeArr || []).reduce((s, v) => s + Number(v.valor_total || 0), 0)
        const vendasHojeCount = (vendasHojeArr || []).length

        // 2) Vendas do mês
        const { data: vendasMesArr, error: vendasMesErr } = await supabase
            .from('vendas')
            .select('id, valor_total, forma_pagamento, data')
            .gte('data', inicioMes)
            .lte('data', hoje)

        if (vendasMesErr) console.error('Erro ao carregar vendas do mês:', vendasMesErr)

        const totalMesGestao = (vendasMesArr || []).reduce((s, v) => s + Number(v.valor_total || 0), 0)
        const vendasMesCount = (vendasMesArr || []).length

        // 3) Vendas por dia (últimos 30 dias)
        const { data: vendasTrintaDias, error: v30Err } = await supabase
            .from('vendas')
            .select('data, valor_total')
            .gte('data', trintaDiasAtrasStr)
            .lte('data', hoje)
            .order('data', { ascending: true })

        if (v30Err) console.error('Erro ao carregar vendas 30 dias:', v30Err)

        const vendasPorDiaMap: Record<string, number> = {};
        // Inicializar os últimos 30 dias com zero (fuso local)
        for (let i = 0; i < 30; i++) {
            const d = new Date(dataHoje);
            d.setDate(dataHoje.getDate() - i);
            const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            vendasPorDiaMap[dStr] = 0;
        }

        ;(vendasTrintaDias || []).forEach(v => {
            vendasPorDiaMap[v.data] = (vendasPorDiaMap[v.data] || 0) + Number(v.valor_total || 0)
        })

        const vendasPorDia = Object.entries(vendasPorDiaMap)
            .map(([data, total]) => ({ data, total }))
            .sort((a, b) => a.data.localeCompare(b.data))

        // 4) Top Produtos (Mês)
        const vendaIdsMes = (vendasMesArr || []).map(v => v.id)
        let topProdutos: any[] = []
        
        if (vendaIdsMes.length > 0) {
            const { data: itensMes, error: itemsErr } = await supabase
                .from('venda_itens')
                .select('quantidade, subtotal, produto_id, varejo_id, produtos(nome), varejo(nome)')
                .in('venda_id', vendaIdsMes)

            if (itemsErr) console.error('Erro ao carregar itens do mês:', itemsErr)

            const produtosAgrupados: Record<string, { nome: string, quantidade: number, total: number }> = {};
            
            ;(itensMes || []).forEach((item: any) => {
                const nome = item.produtos?.nome || item.varejo?.nome || 'Desconhecido'
                if (!produtosAgrupados[nome]) {
                    produtosAgrupados[nome] = { nome, quantidade: 0, total: 0 }
                }
                produtosAgrupados[nome].quantidade += Number(item.quantidade || 0)
                produtosAgrupados[nome].total += Number(item.subtotal || 0)
            })

            topProdutos = Object.values(produtosAgrupados)
                .sort((a, b) => b.total - a.total)
                .slice(0, 5)
        }

        // 5) Vendas por forma de pagamento (Mês)
        const pagamentosAgrupados: Record<string, number> = {};
        const formatarForma = (forma: string) => {
            const nomes: Record<string, string> = {
                'dinheiro': 'Dinheiro',
                'cartao_debito': 'Débito',
                'cartao_credito': 'Crédito',
                'pix': 'PIX',
                'caderneta': 'Caderneta'
            };
            return nomes[forma] || forma;
        };

        ;(vendasMesArr || []).forEach(v => {
            const forma = formatarForma(v.forma_pagamento)
            pagamentosAgrupados[forma] = (pagamentosAgrupados[forma] || 0) + Number(v.valor_total || 0)
        })

        const vendasPorPagamento = Object.entries(pagamentosAgrupados)
            .map(([forma, total]) => ({ forma, total }))
            .sort((a, b) => b.total - a.total)

        // 6) Últimas Vendas (Hoje)
        const { data: ultimasVendas, error: ultimasErr } = await supabase
            .from('vendas')
            .select('id, numero_venda, created_at, valor_total, forma_pagamento, status')
            .eq('data', hoje)
            .order('created_at', { ascending: false })
            .limit(5);

        if (ultimasErr) console.error('Erro ao carregar últimas vendas:', ultimasErr);

        // Formatar vendas recentes com fuso horário local
        const vendasRecentesFormatadas = (ultimasVendas || []).map(v => {
            const dataVenda = new Date(v.created_at);
            const horaLocal = dataVenda.toLocaleTimeString('pt-BR', { 
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            return {
                ...v,
                hora: horaLocal,
                forma_pagamento: formatarForma(v.forma_pagamento)
            };
        });

        // 7) Itens vendidos hoje
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

        // 8) Ticket médio hoje
        const ticketMedioHoje = vendasHojeCount > 0 ? vendasHojeTotal / vendasHojeCount : 0

        return NextResponse.json({
            vendasHoje: {
                total: vendasHojeTotal,
                count: vendasHojeCount
            },
            vendasMes: {
                total: totalMesGestao,
                count: vendasMesCount
            },
            itensVendidosHoje,
            ticketMedioHoje,
            vendasPorDia,
            topProdutos,
            vendasPorPagamento,
            vendasRecentes: vendasRecentesFormatadas
        })
    } catch (error) {
        console.error('Erro no endpoint /api/dashboard:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}