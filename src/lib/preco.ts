import { Insumo } from '@/lib/supabase'
import { convertToBaseQuantity } from './units'

/*
  Alterações aplicadas:
  - Garantia defensiva de entradas numéricas (rendimento) antes do cálculo unitário.
  - Mantém a regra: preço unitário = custo_total / rendimento (sem conversão de unidade).
  - Aplica o percentual de "custos invisíveis" como multiplicador sobre custo de ingredientes.
  Motivo: atender requisitos do gerente para cálculo consistente e evitar divisão por zero.
*/

type IngredienteInput = {
  insumo_id: number
  quantidade: number
  categoria?: string
}

export type CalculoResultado = {
  custoIngredientes: number
  totalEmbalagem: number
  custoInvisivel: number
  custoBase: number
  unitarioBase: number
  unitarioTotal: number
  totalComEmbalagem: number
}

export function calcularCustos({
  ingredientes,
  insumos,
  rendimento,
  custosInvisiveisDecimal = 0
}: {
  ingredientes: IngredienteInput[]
  insumos: Insumo[]
  rendimento: number
  custosInvisiveisDecimal?: number
}): CalculoResultado {
  const custoIngredientes = ingredientes.reduce((acc, ing) => {
    if (!ing || !ing.insumo_id || Number(ing.quantidade) <= 0) return acc
    if (ing.categoria === 'embalagem') return acc
    const ins = insumos.find(i => i.id === ing.insumo_id)
    if (!ins) return acc

    const precoPacote = Number((ins as any).preco_pacote) || 0
    const pesoPacote = Number((ins as any).peso_pacote) || 0

    // Normalize package quantity and ingredient quantity to a base unit (g, ml, un)
    const packConv = convertToBaseQuantity((ins as any).unidade, pesoPacote)
    const ingConv = convertToBaseQuantity((ins as any).unidade, Number(ing.quantidade || 0))

    if (packConv.quantityInBase === 0) return acc

    const custoUnitario = precoPacote / packConv.quantityInBase
    const custoIngrediente = custoUnitario * ingConv.quantityInBase
    return acc + custoIngrediente
  }, 0)

  const totalEmbalagem = ingredientes.reduce((acc, ing) => {
    if (!ing || !ing.insumo_id || Number(ing.quantidade) <= 0) return acc
    if (ing.categoria !== 'embalagem') return acc
    const ins = insumos.find(i => i.id === ing.insumo_id)
    if (!ins) return acc

    const precoPacote = Number((ins as any).preco_pacote) || 0
    const pesoPacote = Number((ins as any).peso_pacote) || 0

    const packConv = convertToBaseQuantity((ins as any).unidade, pesoPacote)
    const ingConv = convertToBaseQuantity((ins as any).unidade, Number(ing.quantidade || 0))

    if (packConv.quantityInBase === 0) return acc

    const custoUnitario = precoPacote / packConv.quantityInBase
    const custoIngrediente = custoUnitario * ingConv.quantityInBase
    return acc + custoIngrediente
  }, 0)

  const custosInvisiveisDecimalClamped = Math.min(Math.max(Number(custosInvisiveisDecimal) || 0, 0), 1)
  let custoInvisivel = custoIngredientes * custosInvisiveisDecimalClamped
  let custoBase = custoIngredientes + custoInvisivel

  // Assegura que rendimento seja um número não-negativo
  const rendimentoNum = Number(rendimento) || 0

  // unitario = custoBase/rendimento + embalagem (embalagem é custo por unidade, somado diretamente)
  const unitarioBase = rendimentoNum > 0 ? custoBase / rendimentoNum : 0
  const unitarioTotal = rendimentoNum > 0 ? unitarioBase + totalEmbalagem : 0

  const totalComEmbalagem = custoBase + totalEmbalagem * (rendimentoNum > 0 ? rendimentoNum : 0)

  return {
    custoIngredientes,
    totalEmbalagem,
    custoInvisivel,
    custoBase,
    unitarioBase,
    unitarioTotal,
    totalComEmbalagem
  }
}

// Calcula custo total e unitário de forma segura seguindo as regras:
// - Usa unidade mínima (g, ml) para conversão correta
// - Embalagem: custo por unidade, somado ao preço unitário (não divide por rendimento)
export function calcularCustoSeguroFromComposicoes({ composicoes, rendimento }: { composicoes: any[]; rendimento?: number }) {
  let custoIngredientes = 0
  let totalEmbalagem = 0

  for (const comp of composicoes || []) {
    const insumo = comp && comp.insumo ? comp.insumo : {}
    const precoPacote = Number(insumo.preco_pacote ?? insumo.preco ?? 0) || 0
    const pesoPacote = Number(insumo.peso_pacote ?? insumo.peso ?? 1) || 1
    const unidade = insumo.unidade || 'un'
    const packConv = convertToBaseQuantity(unidade, pesoPacote)
    const custoUnitarioBase = packConv.quantityInBase === 0 ? 0 : precoPacote / packConv.quantityInBase

    let quantidade = Number(comp.quantidade)
    if (isNaN(quantidade)) quantidade = 0
    if ((comp.categoria === 'cobertura' || comp.categoria === 'embalagem') && quantidade <= 0) {
      quantidade = 1
    }
    const qtdConv = convertToBaseQuantity(unidade, quantidade)
    const custoItem = custoUnitarioBase * qtdConv.quantityInBase

    if (comp.categoria === 'embalagem') {
      totalEmbalagem += custoItem
    } else {
      custoIngredientes += custoItem
    }
  }

  let rendimentoNum = Number(rendimento)
  if (isNaN(rendimentoNum) || rendimentoNum <= 0) rendimentoNum = 1

  const custoTotal = custoIngredientes + totalEmbalagem * rendimentoNum
  const custoUnitario = custoIngredientes / rendimentoNum + totalEmbalagem

  if (!isFinite(custoTotal)) return { custoTotal: 0, custoUnitario: 0 }
  if (!isFinite(custoUnitario)) return { custoTotal: Number(custoTotal.toFixed(2)), custoUnitario: 0 }

  return {
    custoTotal: Number(custoTotal.toFixed(2)),
    custoUnitario: Number(custoUnitario.toFixed(2))
  }
}

// Calcula todos os campos de custo conforme regras do gerente:
// - custoIngredientes: soma de massa + cobertura
// - custoInvisivel: custoIngredientes * custosInvisiveis (decimal 0..1)
// - custoBase: custoIngredientes + custoInvisivel
// - totalEmbalagem: soma dos itens de categoria 'embalagem'
// - custoUnitarioBase: custoBase / rendimento (rendimento <=0 -> 1)
// - custoUnitarioTotal: custoUnitarioBase + (totalEmbalagem / rendimento)
// - custoTotal: custoBase + totalEmbalagem
export function calcularCustosCompletos({ composicoes, rendimento, custosInvisiveis = 0 }: { composicoes: any[]; rendimento?: number; custosInvisiveis?: number }) {
  const comps = composicoes || []

  let custoIngredientes = 0
  let totalEmbalagem = 0

  for (const comp of comps) {
    const insumo = comp && comp.insumo ? comp.insumo : {}
    const precoPacote = Number(insumo.preco_pacote ?? insumo.preco ?? 0) || 0
    const pesoPacote = Number(insumo.peso_pacote ?? insumo.peso ?? 1) || 1
    const unidade = insumo.unidade || 'un'
    const packConv = convertToBaseQuantity(unidade, pesoPacote)
    const custoUnitarioBase = packConv.quantityInBase === 0 ? 0 : precoPacote / packConv.quantityInBase

    let quantidade = Number(comp.quantidade)
    if (isNaN(quantidade)) quantidade = 0
    if ((comp.categoria === 'cobertura' || comp.categoria === 'embalagem') && quantidade <= 0) {
      quantidade = 1
    }
    const qtdConv = convertToBaseQuantity(unidade, quantidade)
    const custoItem = custoUnitarioBase * qtdConv.quantityInBase

    if (comp.categoria === 'embalagem') {
      totalEmbalagem += custoItem
    } else if (comp.categoria === 'massa' || comp.categoria === 'cobertura') {
      custoIngredientes += custoItem
    } else {
      custoIngredientes += custoItem
    }
  }

  const custosInvisiveisDecimal = Math.min(Math.max(Number(custosInvisiveis) || 0, 0), 1)
  let custoInvisivel = custoIngredientes * custosInvisiveisDecimal
  let custoBase = custoIngredientes + custoInvisivel

  let rendimentoNum = Number(rendimento)
  if (isNaN(rendimentoNum) || rendimentoNum <= 0) rendimentoNum = 1

  let custoUnitarioBase = rendimentoNum > 0 ? custoBase / rendimentoNum : 0
  let custoUnitarioTotal = rendimentoNum > 0 ? custoUnitarioBase + totalEmbalagem : 0

  if (!isFinite(custoIngredientes)) custoIngredientes = 0
  if (!isFinite(custoInvisivel)) custoInvisivel = 0
  if (!isFinite(custoBase)) custoBase = 0
  if (!isFinite(totalEmbalagem)) totalEmbalagem = 0
  if (!isFinite(custoUnitarioBase)) custoUnitarioBase = 0
  if (!isFinite(custoUnitarioTotal)) custoUnitarioTotal = 0

  const custoTotal = Number((custoBase + totalEmbalagem * rendimentoNum).toFixed(2))

  return {
    custoIngredientes: Number(custoIngredientes.toFixed(2)),
    custoInvisivel: Number(custoInvisivel.toFixed(2)),
    custoBase: Number(custoBase.toFixed(2)),
    totalEmbalagem: Number(totalEmbalagem.toFixed(2)),
    custoUnitarioBase: Number(custoUnitarioBase.toFixed(2)),
    custoUnitarioTotal: Number(custoUnitarioTotal.toFixed(2)),
    custoTotal
  }
}
