export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import { createSupabaseCookies } from '@/lib/supabase/supabaseCookies'
import { clientEnv } from '@/env/client-env'
import { serverEnv } from '@/env/server-env'
import { obterDataLocal, obterInicioMes } from '@/lib/dateUtils'

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
        // 1) Vendas no período (paginação para evitar limite 1000 do Supabase)
        type VendaPeriodoRow = { id: number; valor_total: number; forma_pagamento: string; data: string }
        const vendasPeriodoArr: VendaPeriodoRow[] = []
        const pageSize = 1000
        let offset = 0
        while (true) {
            const { data: page, error: vendasPeriodoErr } = await supabase
                .from('vendas')
                .select('id, valor_total, forma_pagamento, data')
                .gte('data', dataInicio)
                .lte('data', dataFim)
                .order('data', { ascending: true })
                .range(offset, offset + pageSize - 1)

            if (vendasPeriodoErr) {
                console.error('Erro ao carregar vendas período:', vendasPeriodoErr)
                break
            }
            if (!page?.length) break
            vendasPeriodoArr.push(...(page as VendaPeriodoRow[]))
            if (page.length < pageSize) break
            offset += pageSize
        }

        const vendasHojeTotal = vendasPeriodoArr.reduce((s, v) => s + Number(v.valor_total || 0), 0)
        const vendasHojeCount = vendasPeriodoArr.length

        // 2) Vendas do mês (mesmo que período quando filtro aplicado)
        const vendasMesArr = vendasPeriodoArr

        const totalMesGestao = vendasMesArr.reduce((s, v) => s + Number(v.valor_total || 0), 0)
        const vendasMesCount = vendasMesArr.length

        // 3) Vendas por dia no range do filtro (RPC agrega no banco; sem limite de linhas)
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

        // 4) Top Produtos (período) — buscar itens em chunks para evitar URI too long
        const vendaIdsMes = (vendasMesArr || []).map(v => v.id)
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

        ; (vendasMesArr || []).forEach(v => {
            const forma = formatarForma(v.forma_pagamento)
            pagamentosAgrupados[forma] = (pagamentosAgrupados[forma] || 0) + Number(v.valor_total || 0)
        })

        const vendasPorPagamento = Object.entries(pagamentosAgrupados)
            .map(([forma, total]) => ({ forma, total }))
            .sort((a, b) => b.total - a.total)

        // 6) Últimas Vendas (período)
        const { data: ultimasVendas, error: ultimasErr } = await supabase
            .from('vendas')
            .select('id, numero_venda, created_at, valor_total, forma_pagamento, status, data')
            .gte('data', dataInicio)
            .lte('data', dataFim)
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

        // 7) Itens vendidos no período (chunks para evitar URI too long)
        let itensVendidosHoje = 0
        if (vendasHojeCount > 0) {
            const vendaIds = vendasPeriodoArr.map((r) => r.id).filter(Boolean)
            let somaItens = 0
            for (let i = 0; i < vendaIds.length; i += CHUNK_SIZE) {
                const chunk = vendaIds.slice(i, i + CHUNK_SIZE)
                const { data: itensChunk, error: itensErr } = await supabase
                    .from('venda_itens')
                    .select('quantidade')
                    .in('venda_id', chunk)

                if (itensErr) console.error('Erro ao buscar itens vendidos (chunk):', itensErr)
                somaItens += (itensChunk || []).reduce((sum, it) => sum + (Number(it.quantidade) || 0), 0)
            }
            itensVendidosHoje = Math.round(somaItens * 100) / 100
        }

        // 8) Ticket médio no período
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