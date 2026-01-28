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

  // Mapa de receitas por nome para facilitar o vínculo com o varejo
  const receitasPorNomeMap = new Map(receitas.map(r => [r.nome.toLowerCase().trim(), r]))
  // Mapa de receitas por código de barras (se houver essa relação no precos_venda)
  const receitasPorCodigoMap = new Map()
  precosVenda.forEach(p => {
    if (p.tipo === 'receita') {
      const rec = receitasMap.get(p.item_id)
      if (rec && p.codigo_barras) receitasPorCodigoMap.set(p.codigo_barras, rec)
    }
  })

  // 2. Processar cada item vendido
  itensVenda.forEach(item => {
    // Tenta pegar o ID de qualquer uma das colunas possíveis (normalização)
    const idReal = item.varejo_id || item.item_id || item.produto_id
    if (!idReal) return

    // Se tiver varejo_id, é varejo. Se tiver item_id/produto_id e for tipo receita, é receita.
    let tipoFinal = item.tipo
    if (item.varejo_id && !tipoFinal) tipoFinal = 'varejo'
    if ((item.item_id || item.produto_id) && !tipoFinal) tipoFinal = 'receita'
    
    // Fallback final para o tipo
    tipoFinal = (tipoFinal === 'insumo' || !tipoFinal) ? 'varejo' : tipoFinal
    
    const itemKey = `${tipoFinal}_${idReal}`
    
    const precoVendaReal = item.preco_unitario || 0
    const quantidade = item.quantidade || 0
    const receitaItem = precoVendaReal * quantidade

    // Busca precoConfigurado no início para evitar ReferenceError
    const precoConfigurado = precosMap.get(itemKey)

    // --- FILTRO DE ITENS EXCLUÍDOS E INSUMOS ---
    const v = varejoMap.get(idReal)
    const rec = receitasMap.get(idReal)
    
    // Regra: Só mostramos o que estiver ativo e existir nas tabelas de produtos
    // Se for varejo mas não está no mapa de ativos, ignoramos
    if (tipoFinal === 'varejo' && (!v || v.ativo === false)) return
    
    // Se for receita mas não está no mapa de ativos, ignoramos
    if (tipoFinal === 'receita' && (!rec || rec.ativo === false)) return
    
    // Se não é nem varejo nem receita ativa, ignoramos (isso remove insumos puros e lixo de teste)
    if (!v && !rec) return

    // --- LÓGICA DE CUSTO INTELIGENTE (Ponte Varejo -> Receita) ---
    let custoUnitario = 0
    let receitaVinculada = null

    // Se for varejo, verifica se existe uma receita com o mesmo nome (Aba Receitas)
    if (tipoFinal === 'varejo') {
      if (v) {
        // Tenta achar por nome exato (mais comum)
        receitaVinculada = receitasPorNomeMap.get(v.nome.toLowerCase().trim())
        
        // Tenta achar pelo código de barras no mapa de preços
        if (!receitaVinculada && v.codigo_barras) {
          receitaVinculada = receitasPorCodigoMap.get(v.codigo_barras)
        }
      }
    } else if (tipoFinal === 'receita') {
      receitaVinculada = rec
    }

    // Prioridade 1: Se achamos uma receita (vinculada ou direta), calcula pela Ficha Técnica
    if (receitaVinculada) {
      const compReceita = composicoes.filter(c => c.receita_id === receitaVinculada.id).map(c => ({
        ...c,
        insumo: insumosMap.get(c.insumo_id)
      }))
      
      if (compReceita.length > 0) {
        const calculo = calcularCustosCompletos({
          composicoes: compReceita,
          rendimento: receitaVinculada.rendimento || 1,
          custosInvisiveis: Number(receitaVinculada.custosInvisiveis || 0)
        })
        custoUnitario = calculo.custoUnitarioTotal
      }
    }

    // Prioridade 2: Se não é receita ou ficha técnica está vazia, tenta Tabela de Preços
    if (custoUnitario === 0) {
      const precoConfigurado = precosMap.get(itemKey)
      if (precoConfigurado && Number(precoConfigurado.preco_custo_unitario) > 0) {
        custoUnitario = Number(precoConfigurado.preco_custo_unitario)
      }
    }

    // Prioridade 3: Estoque/Varejo (varejo) - Fallback para produtos comprados prontos
    if (custoUnitario === 0 && tipoFinal === 'varejo') {
      const v = varejoMap.get(idReal)
      if (v) {
        if (Number(v.preco_unitario) > 0) {
          custoUnitario = Number(v.preco_unitario)
        } else if (Number(v.preco_pacote) > 0 && Number(v.peso_pacote) > 0) {
          custoUnitario = Number(v.preco_pacote) / Number(v.peso_pacote)
        }
      }
    }

    // Prioridade 4: Fallback Insumos
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

    // Nome do produto (Prioridade para tabelas base: receitas e varejo)
    let nomeProduto = ''
    if (receitaVinculada) {
      nomeProduto = receitaVinculada.nome
    } else if (tipoFinal === 'receita') {
      nomeProduto = receitasMap.get(idReal)?.nome || `Receita ${idReal}`
    } else {
      const varItem = varejoMap.get(idReal)
      const insItem = insumosMap.get(idReal)
      nomeProduto = varItem?.nome || insItem?.nome || `Produto ${idReal}`
    }

    // Se o nome ainda estiver vazio ou for apenas ID, tenta o cache do preço configurado
    if (!nomeProduto || nomeProduto.includes(String(idReal))) {
       const cacheNome = precoConfigurado?.item_nome || precoConfigurado?.nome_item
       if (cacheNome) nomeProduto = cacheNome
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
        tipo: tipoFinal as 'receita' | 'varejo',
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
