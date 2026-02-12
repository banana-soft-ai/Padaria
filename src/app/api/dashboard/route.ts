export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import { createSupabaseCookies } from '@/lib/supabase/supabaseCookies'
import { clientEnv } from '@/env/client-env'
import { serverEnv } from '@/env/server-env'
import { obterDataLocal, obterInicioMes } from '@/lib/dateUtils'
import { buscarMetricasPeriodo } from '@/services/vendasMetricas.service'

const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
    pix: 'PIX',
    dinheiro: 'Dinheiro',
    debito: 'Débito',
    credito: 'Crédito',
    caderneta: 'Caderneta'
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const dataInicioParam = searchParams.get('dataInicio')
    const dataFimParam = searchParams.get('dataFim')

    const hoje = obterDataLocal()
    const inicioMes = obterInicioMes()
    const dataInicio = dataInicioParam || inicioMes
    const dataFim = dataFimParam || hoje
    const chartInicio = dataInicio
    const chartFim = dataFim

    // Next.js 15: obter cookie store com await e passar para createServerClient
    const cookieStore = await nextCookies();
    const supabaseUrl = serverEnv.SUPABASE_URL || clientEnv.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = serverEnv.SUPABASE_ANON_KEY || clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        { cookies: createSupabaseCookies(cookieStore) }
    )
    const CHUNK_SIZE = 250 // limite de IDs por .in() para evitar URI too long
    try {
        // 1) Métricas do período (serviço centralizado, filtra status=finalizada)
        const metricas = await buscarMetricasPeriodo(supabase, dataInicio, dataFim)
        const vendasHojeTotal = metricas.receitaTotal
        const vendasHojeCount = metricas.vendasCount
        const totalMesGestao = metricas.receitaTotal
        const vendasMesCount = metricas.vendasCount
        const itensVendidosHoje = metricas.unidadesVendidas
        const ticketMedioHoje = metricas.ticketMedio
        const vendasPorPagamento = Object.entries(metricas.porFormaPagamento)
            .filter(([, total]) => total > 0)
            .map(([forma, total]) => ({ forma: FORMA_PAGAMENTO_LABELS[forma] || forma, total }))
            .sort((a, b) => b.total - a.total)
        const vendaIdsMes = metricas.vendaIds

        // 2) Vendas por dia no range do filtro (RPC agrega no banco; sem limite de linhas)
        const { data: vendasPorDiaRpc, error: v30Err } = await supabase
            .rpc('get_vendas_por_dia', { inicio: chartInicio, fim: chartFim })

        if (v30Err) console.error('Erro ao carregar vendas para gráfico:', v30Err)

        const vendasPorDiaMap: Record<string, number> = {}
        const startDate = new Date(chartInicio + 'T12:00:00')
        const endDate = new Date(chartFim + 'T12:00:00')
        const current = new Date(startDate)
        let diasCount = 0
        while (current.getTime() <= endDate.getTime() && diasCount < 90) {
            const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
            vendasPorDiaMap[key] = 0
            current.setDate(current.getDate() + 1)
            diasCount++
        }

        ; (vendasPorDiaRpc || []).forEach((row: { data: string | null; total: number }) => {
            const dataKey = row.data ? String(row.data).slice(0, 10) : ''
            if (dataKey && dataKey in vendasPorDiaMap) vendasPorDiaMap[dataKey] = Number(row.total ?? 0)
        })

        const vendasPorDia = Object.entries(vendasPorDiaMap)
            .map(([data, total]) => ({ data, total }))
            .sort((a, b) => a.data.localeCompare(b.data))

        // 3) Top Produtos (período) — buscar itens em chunks para evitar URI too long
        let topProdutos: { nome: string; quantidade: number; total: number }[] = []

        if (vendaIdsMes.length > 0) {
            const itensMesAccum: unknown[] = []
            for (let i = 0; i < vendaIdsMes.length; i += CHUNK_SIZE) {
                const chunk = vendaIdsMes.slice(i, i + CHUNK_SIZE)
                const { data: itensChunk, error: itemsErr } = await supabase
                    .from('venda_itens')
                    .select('quantidade, subtotal, produto_id, varejo_id, produtos(nome), varejo(nome)')
                    .in('venda_id', chunk)

                if (itemsErr) {
                    console.error('Erro ao carregar itens do período (chunk):', itemsErr)
                } else if (itensChunk?.length) {
                    itensMesAccum.push(...itensChunk)
                }
            }

            const produtosAgrupados: Record<string, { nome: string; quantidade: number; total: number }> = {}
            ;(itensMesAccum as { quantidade?: number; subtotal?: number; produtos?: { nome?: string }; varejo?: { nome?: string } }[]).forEach((item) => {
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

        // 4) Últimas Vendas (período)
        const { data: ultimasVendas, error: ultimasErr } = await supabase
            .from('vendas')
            .select('id, numero_venda, created_at, valor_total, forma_pagamento, status, data')
            .gte('data', dataInicio)
            .lte('data', dataFim)
            .eq('status', 'finalizada')
            .order('created_at', { ascending: false })
            .limit(5);

        if (ultimasErr) console.error('Erro ao carregar últimas vendas:', ultimasErr);

        // Formatar vendas recentes com fuso horário local
        const formatarForma = (forma: string) => FORMA_PAGAMENTO_LABELS[forma === 'cartao_debito' ? 'debito' : forma === 'cartao_credito' ? 'credito' : forma] || forma
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