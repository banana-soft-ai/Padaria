import { supabase } from '@/lib/supabase/client'
import { calcularCustosCompletos } from '@/lib/preco'
import { ItemLucratividade, ResumoLucratividade } from '@/types/gestao'

export interface ProcessarLucratividadeParams {
  vendas: any[]
  itensVenda: any[]
  precosVenda: any[]
  varejo: any[]
  receitas: any[]
  composicoes: any[]
  insumos: any[]
  custosFixosTotal: number
}

export function processarLucratividadePorProduto({
  vendas,
  itensVenda,
  precosVenda,
  varejo,
  receitas,
  composicoes,
  insumos,
  custosFixosTotal
}: ProcessarLucratividadeParams) {
  const lucratividadeMap = new Map<string, ItemLucratividade>()
  let receitaTotalPeriodo = 0
  let custoTotalProdutosPeriodo = 0

  // 1. Mapas para busca rápida
  const precosMap = new Map(precosVenda.map(p => [`${p.tipo}_${p.item_id}`, p]))
  const varejoMap = new Map(varejo.map(v => [v.id, v]))
  const receitasMap = new Map(receitas.map(r => [r.id, r]))
  const insumosMap = new Map(insumos.map(i => [i.id, i]))

  // 2. Processar cada item vendido
  itensVenda.forEach(item => {
    const idReal = item.varejo_id || item.item_id
    if (!idReal) return

    const tipoNormalizado = (item.tipo === 'insumo' || !item.tipo) ? 'varejo' : item.tipo
    const itemKey = `${tipoNormalizado}_${idReal}`
    
    const precoVendaReal = item.preco_unitario || 0
    const quantidade = item.quantidade || 0
    const receitaItem = precoVendaReal * quantidade

    // --- LÓGICA DE CUSTO MULTI-NÍVEL ---
    let custoUnitario = 0

    // Nível 1: Tabela de Preços (precos_venda)
    const precoConfigurado = precosMap.get(itemKey)
    if (precoConfigurado && Number(precoConfigurado.preco_custo_unitario) > 0) {
      custoUnitario = Number(precoConfigurado.preco_custo_unitario)
    }

    // Nível 2: Estoque/Varejo (varejo) - Fallback sugerido pelo usuário
    if (custoUnitario === 0 && tipoNormalizado === 'varejo') {
      const v = varejoMap.get(idReal)
      if (v) {
        if (Number(v.preco_unitario) > 0) {
          custoUnitario = Number(v.preco_unitario)
        } else if (Number(v.preco_pacote) > 0 && Number(v.peso_pacote) > 0) {
          custoUnitario = Number(v.preco_pacote) / Number(v.peso_pacote)
        }
      }
    }

    // Nível 3: Recalcular Receita (Ficha Técnica)
    if (custoUnitario === 0 && tipoNormalizado === 'receita') {
      const receita = receitasMap.get(idReal)
      if (receita) {
        const compReceita = composicoes.filter(c => c.receita_id === idReal).map(c => ({
          ...c,
          insumo: insumosMap.get(c.insumo_id)
        }))
        
        const calculo = calcularCustosCompletos({
          composicoes: compReceita,
          rendimento: receita.rendimento,
          custosInvisiveis: Number(receita.custosInvisiveis || 0)
        })
        custoUnitario = calculo.custoUnitarioTotal
      }
    }

    // Nível 4: Fallback Insumos (Se o item_id for de um insumo direto)
    if (custoUnitario === 0) {
      const ins = insumosMap.get(idReal)
      if (ins && Number(ins.preco_pacote) > 0 && Number(ins.peso_pacote) > 0) {
        custoUnitario = Number(ins.preco_pacote) / Number(ins.peso_pacote)
      }
    }

    // --- FIM DA LÓGICA DE CUSTO ---

    const custoTotalItem = custoUnitario * quantidade
    const lucroBrutoItem = receitaItem - custoTotalItem
    const margemItem = receitaItem > 0 ? (lucroBrutoItem / receitaItem) * 100 : 0

    // Nome do produto
    let nomeProduto = 'Produto não identificado'
    if (tipoNormalizado === 'receita') {
      nomeProduto = receitasMap.get(idReal)?.nome || `Receita ${idReal}`
    } else {
      nomeProduto = varejoMap.get(idReal)?.nome || insumosMap.get(idReal)?.nome || `Produto ${idReal}`
    }

    // Agrupar produtos repetidos
    if (lucratividadeMap.has(itemKey)) {
      const existing = lucratividadeMap.get(itemKey)!
      existing.quantidadeVendida += quantidade
      existing.receitaTotal += receitaItem
      existing.custoTotal += custoTotalItem
      existing.lucroBruto += lucroBrutoItem
      // Recalcular margem média e preço médio vendido
      existing.margemLucro = existing.receitaTotal > 0 ? (existing.lucroBruto / existing.receitaTotal) * 100 : 0
      existing.precoVenda = existing.receitaTotal / existing.quantidadeVendida
    } else {
      lucratividadeMap.set(itemKey, {
        item: nomeProduto,
        tipo: tipoNormalizado as 'receita' | 'varejo',
        quantidadeVendida: quantidade,
        precoVenda: precoVendaReal,
        custoUnitario: custoUnitario,
        receitaTotal: receitaItem,
        custoTotal: custoTotalItem,
        lucroBruto: lucroBrutoItem,
        margemLucro: margemItem
      })
    }

    receitaTotalPeriodo += receitaItem
    custoTotalProdutosPeriodo += custoTotalItem
  })

  // 3. Gerar resumo final
  const itensOrdenados = Array.from(lucratividadeMap.values())
    .sort((a, b) => b.quantidadeVendida - a.quantidadeVendida)

  const lucroBrutoTotal = receitaTotalPeriodo - custoTotalProdutosPeriodo
  const lucroLiquido = lucroBrutoTotal - custosFixosTotal

  const resumo: ResumoLucratividade = {
    receitaTotal: receitaTotalPeriodo,
    custoTotalProdutos: custoTotalProdutosPeriodo,
    lucroBrutoTotal: lucroBrutoTotal,
    custosFixosTotal: custosFixosTotal,
    lucroLiquido: lucroLiquido,
    margemLucroBruta: receitaTotalPeriodo > 0 ? (lucroBrutoTotal / receitaTotalPeriodo) * 100 : 0,
    margemLucroLiquida: receitaTotalPeriodo > 0 ? (lucroLiquido / receitaTotalPeriodo) * 100 : 0,
    roi: (custoTotalProdutosPeriodo + custosFixosTotal) > 0 
      ? (lucroLiquido / (custoTotalProdutosPeriodo + custosFixosTotal)) * 100 
      : 0
  }

  return {
    itens: itensOrdenados,
    resumo
  }
}
