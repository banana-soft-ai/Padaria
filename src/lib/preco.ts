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
  const custoInvisivel = custoIngredientes * custosInvisiveisDecimalClamped
  const custoBase = custoIngredientes + custoInvisivel

  // Assegura que rendimento seja um número não-negativo
  const rendimentoNum = Number(rendimento) || 0

  // unitario = total dividido pelo rendimento informado (sem alterar unidade)
  const unitarioBase = rendimentoNum > 0 ? custoBase / rendimentoNum : 0
  const unitarioTotal = rendimentoNum > 0 ? unitarioBase + (totalEmbalagem / rendimentoNum) : 0

  const totalComEmbalagem = custoBase + totalEmbalagem

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
// - Se rendimento <= 0, usar 1
// - Para categoria 'cobertura' ou 'embalagem', se quantidade inválida (<=0 ou undefined) usar 1
// - Se preço do insumo não definido, usar 0
// - Retornar valores com duas casas decimais e números válidos
export function calcularCustoSeguroFromComposicoes({ composicoes, rendimento }: { composicoes: any[]; rendimento?: number }) {
  let total = 0

  for (const comp of composicoes || []) {
    const insumo = comp && comp.insumo ? comp.insumo : {}
    const precoPacote = Number(insumo.preco_pacote ?? insumo.preco ?? 0) || 0
    const pesoPacote = Number(insumo.peso_pacote ?? insumo.peso ?? 1) || 1

    const custoUnitario = pesoPacote === 0 ? 0 : precoPacote / pesoPacote

    let quantidade = Number(comp.quantidade)
    if (isNaN(quantidade)) quantidade = 0

    if ((comp.categoria === 'cobertura' || comp.categoria === 'embalagem') && quantidade <= 0) {
      quantidade = 1
    }

    total += custoUnitario * quantidade
  }

  let rendimentoNum = Number(rendimento)
  if (isNaN(rendimentoNum) || rendimentoNum <= 0) rendimentoNum = 1

  let unitario = total / rendimentoNum

  if (!isFinite(total)) total = 0
  if (!isFinite(unitario)) unitario = 0

  // Garantir duas casas decimais retornando números (não strings)
  const custoTotal = Number(total.toFixed(2))
  const custoUnitario = Number(unitario.toFixed(2))

  return { custoTotal, custoUnitario }
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

    const custoUnitario = pesoPacote === 0 ? 0 : precoPacote / pesoPacote

    let quantidade = Number(comp.quantidade)
    if (isNaN(quantidade)) quantidade = 0

    // Para cobertura e embalagem, quantidade inválida (<=0) conta como 1
    if ((comp.categoria === 'cobertura' || comp.categoria === 'embalagem') && quantidade <= 0) {
      quantidade = 1
    }

    const custoItem = custoUnitario * quantidade

    if (comp.categoria === 'embalagem') {
      totalEmbalagem += custoItem
    } else if (comp.categoria === 'massa' || comp.categoria === 'cobertura') {
      custoIngredientes += custoItem
    } else {
      // Se categoria desconhecida, tratar como ingrediente (massa)
      custoIngredientes += custoItem
    }
  }

  const custosInvisiveisDecimal = Math.min(Math.max(Number(custosInvisiveis) || 0, 0), 1)
  const custoInvisivel = custoIngredientes * custosInvisiveisDecimal
  const custoBase = custoIngredientes + custoInvisivel

  let rendimentoNum = Number(rendimento)
  if (isNaN(rendimentoNum) || rendimentoNum <= 0) rendimentoNum = 1

  let custoUnitarioBase = rendimentoNum > 0 ? custoBase / rendimentoNum : 0
  let custoUnitarioTotal = rendimentoNum > 0 ? custoUnitarioBase + (totalEmbalagem / rendimentoNum) : 0

  if (!isFinite(custoIngredientes)) custoIngredientes = 0
  if (!isFinite(custoInvisivel)) custoInvisivel = 0
  if (!isFinite(custoBase)) custoBase = 0
  if (!isFinite(totalEmbalagem)) totalEmbalagem = 0
  if (!isFinite(custoUnitarioBase)) custoUnitarioBase = 0
  if (!isFinite(custoUnitarioTotal)) custoUnitarioTotal = 0

  const custoTotal = Number((custoBase + totalEmbalagem).toFixed(2))

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
