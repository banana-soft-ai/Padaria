'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Receita, Insumo } from '@/lib/supabase'
import { supabase } from '@/lib/supabase/client'
import ProtectedLayout from '@/components/ProtectedLayout'
import Toast from '@/app/gestao/caderneta/Toast' // Componente de notificação
import { Plus, ChefHat, Search, Edit, Trash2, Eye, Package, X, RefreshCw } from 'lucide-react'
import { useReceitasOffline } from '@/hooks/useReceitasOffline'

/*
  Alterações principais:
  - computeCosts: calcula os valores conforme especificação do chefe.
  - Correção de deduplicação ao salvar composições: agora inclui categoria no key para permitir mesmo insumo em categorias diferentes.
  - Tratamento de rendimento = 0 para evitar Infinity/NaN.
  - Formatações seguras e regras por unidade.
*/

interface ComposicaoReceita {
  id: number
  receita_id: number
  insumo_id: number
  quantidade: number
  categoria: string
  insumo?: Insumo
}

export default function ReceitasPage() {
  const {
    receitas,
    composicoesComInsumo: composicoes,
    insumos,
    fetchReceitas,
    fetchInsumos,
    createReceita,
    updateReceita,
    removerReceita,
    deleteByReceitaId,
    insertMany,
    refreshComposicoes
  } = useReceitasOffline()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Estados locais para UI
  const [showModal, setShowModal] = useState(false)
  const [showDetalhesModal, setShowDetalhesModal] = useState(false)
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null)
  const [receitaSelecionada, setReceitaSelecionada] = useState<Receita | null>(null)
  const [termoPesquisa, setTermoPesquisa] = useState('')
  const [receitasFiltradas, setReceitasFiltradas] = useState<Receita[]>([])
  const [pesquisasIngredientes, setPesquisasIngredientes] = useState<{ [key: number]: string }>({})
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  // Estados para notificações (toasts) e modais de confirmação
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmTitle, setConfirmTitle] = useState('')
  const [activeTab, setActiveTab] = useState<'detalhes' | 'ingredientes' | 'preparo'>('detalhes')
  const [isMounted, setIsMounted] = useState(false)
  const ingredientesListRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    nome: '',
    rendimento: '',
    unidade_rendimento: 'un',
    categoria: 'outro',
    instrucoes: '',
    custosInvisiveis: '0', // Valor em porcentagem para o input (ex: 20)
  })

  const [ingredientes, setIngredientes] = useState<Array<{
    insumo_id: number;
    quantidade: number;
    categoria: string;
    insumo?: Insumo;
  }>>([]);

  // Utilitário: verifica número finito
  const isFiniteNumber = (v: any): v is number => typeof v === 'number' && isFinite(v)

  // ------- FUNÇÃO CENTRAL DE CÁLCULO (segue checklist do chefe) -------
  // Recebe:
  // - composicoes: array com { quantidade, categoria, insumo? }
  // - rendimento: número (ex: 10)
  // - custosInvisiveis: decimal 0..1 (ex: 0.2 para 20%)
  const computeCosts = ({
    composicoes,
    rendimento,
    custosInvisiveis
  }: {
    composicoes: Array<{ quantidade: number; categoria: string; insumo?: Insumo }>,
    rendimento: number,
    custosInvisiveis: number
  }) => {
    // Segurança nos argumentos
    const rend = Number(rendimento) || 0
    const invis = Number(custosInvisiveis) || 0

    // Função que calcula custo total de um item: quantidade * (preco_pacote / peso_pacote)
    const itemCost = (comp: { quantidade: number; categoria: string; insumo?: Insumo }) => {
      const ins = comp.insumo as Insumo | undefined
      const precoPacote = Number(ins?.preco_pacote ?? ins?.preco ?? 0) || 0
      const pesoPacote = Number(ins?.peso_pacote ?? 1) || 1
      const custoUnitarioDoInsumo = pesoPacote === 0 ? 0 : precoPacote / pesoPacote
      const qtd = Number(comp.quantidade) || 0
      return custoUnitarioDoInsumo * qtd
    }

    // 1) Custo ingredientes = soma de itens com categoria massa + cobertura
    const custoIngredientes = composicoes
      .filter(c => c.categoria === 'massa' || c.categoria === 'cobertura')
      .reduce((s, c) => s + itemCost(c), 0)

    // 2) Custo invisível = custoIngredientes * porcentagem definida
    const custoInvisivel = custoIngredientes * invis

    // 3) Custo base = custoIngredientes + custoInvisivel
    const custoBase = custoIngredientes + custoInvisivel

    // 4) Custo unitário base = custoBase / rendimento (tratamento)
    const custoUnitarioBase = rend > 0 ? custoBase / rend : NaN

    // 5) Embalagem: soma dos itens categoria 'embalagem'
    const totalEmbalagem = composicoes
      .filter(c => c.categoria === 'embalagem')
      .reduce((s, c) => s + itemCost(c), 0)

    // custo unitário de embalagem por unidade = totalEmbalagem / rendimento
    const embalagemUnitario = rend > 0 ? totalEmbalagem / rend : NaN

    // 6) Custo unitário total = custo unitário base + embalagem unitária
    const custoUnitarioTotal = (isFiniteNumber(custoUnitarioBase) ? custoUnitarioBase : NaN) + (isFiniteNumber(embalagemUnitario) ? embalagemUnitario : 0)

    // custo total da receita = custoBase + totalEmbalagem
    const custoTotal = custoBase + totalEmbalagem

    return {
      custoIngredientes,
      custoInvisivel,
      custoBase,
      totalEmbalagem,
      custoUnitarioBase,
      embalagemUnitario,
      custoUnitarioTotal,
      custoTotal
    }
  }

  // ---------- FORMATAÇÃO SEGURA ----------
  const formatCurrency = (value: number | null | undefined, minDecimals = 2, maxDecimals = 6) => {
    if (value === null || value === undefined || !isFiniteNumber(Number(value))) return '-'
    const n = Number(value)
    const abs = Math.abs(n)

    if (n === 0) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(0)
    }

    let minimum = minDecimals
    let maximum = maxDecimals

    if (abs >= 1) {
      minimum = 2
      maximum = 2
    } else if (abs >= 0.01) {
      minimum = Math.max(minimum, 4)
      maximum = 4
    } else {
      minimum = Math.max(minimum, 2)
      maximum = maxDecimals
    }

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: minimum,
      maximumFractionDigits: maximum
    }).format(n)
  }

  const formatUnitPriceWithUnit = (valor: number | null | undefined, unidade?: string) => {
    if (valor === null || valor === undefined || !isFiniteNumber(Number(valor))) return '-'
    const v = Number(valor)
    if (v === 0) {
      const zero = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(0)
      return unidade && unidade.toLowerCase() === 'g' ? `${zero} por grama` : `${zero}/un`
    }

    const u = (unidade || 'un').toLowerCase()
    const longLabels: Record<string, string> = {
      g: 'grama',
      kg: 'quilograma',
      ml: 'mililitro',
      l: 'litro',
      'xícara': 'xícara',
      colher: 'colher'
    }

    if (['un', 'unidade', 'unit', 'units'].includes(u)) {
      return `${formatCurrency(v, 2, 2)}/un`
    }

    if (u === 'g') {
      return `${formatCurrency(v, 2, 6)} por ${longLabels[u]}`
    }

    if (u === 'kg' || u === 'ml' || u === 'l') {
      return `${formatCurrency(v, 2, 4)} por ${longLabels[u] || unidade}`
    }

    return `${formatCurrency(v, 2, 6)} por ${longLabels[u] || unidade}`
  }

  // ---------- PREVIEW (usando computeCosts) ----------
  const calcularPrecoPreview = () => {
    const composicoesPreview = ingredientes.map(ing => ({
      quantidade: ing.quantidade,
      categoria: ing.categoria,
      insumo: ing.insumo || (insumos ? insumos.find(i => i.id === ing.insumo_id) : undefined)
    }))

    const rendimento = Number(formData.rendimento) || 0
    const custosInvisiveisDecimalPreview = Math.min(Math.max(Number(String(formData.custosInvisiveis).replace(',', '.')) / 100, 0), 1)

    const custos = computeCosts({ composicoes: composicoesPreview, rendimento, custosInvisiveis: custosInvisiveisDecimalPreview })

    return { total: custos.custoTotal, unitario: custos.custoUnitarioTotal, detalhes: custos }
  }

  // Versão usada no header das cartas e na visão de detalhes: converte composicoes do hook em formato aceito
  const computeCostsForReceita = (receita: Receita | null) => {
    if (!receita) {
      return { custoIngredientes: 0, custoInvisivel: 0, custoBase: 0, totalEmbalagem: 0, custoUnitarioBase: 0, embalagemUnitario: 0, custoUnitarioTotal: 0, custoTotal: 0 }
    }
    const comps = composicoes
      .filter(c => c.receita_id === receita.id)
      .map(c => ({ quantidade: c.quantidade, categoria: c.categoria, insumo: c.insumo }))

    const custosInvis = Number(receita.custosInvisiveis ?? 0) // assume decimal no DB (ex: 0.2)
    const custos = computeCosts({ composicoes: comps, rendimento: Number(receita.rendimento) || 0, custosInvisiveis: custosInvis })

    return custos
  }

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ message, type })
  }

  useEffect(() => {
    carregarDados()
    setIsMounted(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await carregarDados()
      showToast('Dados atualizados', 'success')
    } catch (err) {
      console.error('Erro ao atualizar dados:', err)
      showToast('Erro ao atualizar dados', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    filtrarReceitas()
  }, [termoPesquisa, receitas])

  const carregarDados = async () => {
    try {
      await Promise.all([
        fetchReceitas(),
        fetchInsumos(),
        refreshComposicoes()
      ])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtrarReceitas = () => {
    if (!receitas || receitas.length === 0) {
      setReceitasFiltradas([])
      return
    }

    if (!termoPesquisa.trim()) {
      setReceitasFiltradas(receitas)
      return
    }

    const termo = termoPesquisa.toLowerCase()
    const filtradas = receitas.filter(receita =>
      receita.nome.toLowerCase().includes(termo)
    )
    setReceitasFiltradas(filtradas)
  }

  const adicionarIngrediente = () => {
    const novoIndex = ingredientes.length
    setIngredientes([...ingredientes, { insumo_id: 0, quantidade: 0, categoria: 'massa' }])

    setTimeout(() => {
      if (ingredientesListRef.current) {
        ingredientesListRef.current.scrollTo({
          top: ingredientesListRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }

      const novoCampo = document.getElementById(`ingrediente-${novoIndex}`)
      if (novoCampo) {
        novoCampo.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        const campoPesquisa = novoCampo.querySelector('input[type="text"]') as HTMLInputElement
        if (campoPesquisa) {
          campoPesquisa.focus({ preventScroll: true })
        }
      }
    }, 100)
  }

  const removerIngrediente = (index: number) => {
    setIngredientes(ingredientes.filter((_, i) => i !== index))
  }

  const atualizarIngrediente = (index: number, campo: 'insumo_id' | 'quantidade' | 'categoria', valor: number | string) => {
    const novosIngredientes = [...ingredientes]
    if (campo === 'categoria' && String(valor) === 'embalagem') {
      novosIngredientes[index] = { ...novosIngredientes[index], categoria: String(valor), quantidade: 1 }
      setIngredientes(novosIngredientes)
      return
    }

    if (campo === 'quantidade' && novosIngredientes[index] && novosIngredientes[index].categoria === 'embalagem') {
      return
    }

    novosIngredientes[index] = { ...novosIngredientes[index], [campo]: valor }
    setIngredientes(novosIngredientes)
  }

  // calcular previewCustos usado no modal sticky
  const preview = calcularPrecoPreview()

  // DETALHE CUSTOS para modal de detalhes (usa composicoes do hook)
  const detalheCustos = receitaSelecionada ? computeCostsForReceita(receitaSelecionada) : { custoIngredientes: 0, custoInvisivel: 0, custoBase: 0, totalEmbalagem: 0, custoUnitarioBase: 0, embalagemUnitario: 0, custoUnitarioTotal: 0, custoTotal: 0 }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const rendimentoNum = parseFloat(String(formData.rendimento)) || 0
    if (rendimentoNum <= 0) {
      showToast('Informe um rendimento válido (> 0).', 'error')
      return
    }

    const custosInvisiveisPercent = Number(String(formData.custosInvisiveis).replace(',', '.'))
    if (isNaN(custosInvisiveisPercent) || custosInvisiveisPercent < 0 || custosInvisiveisPercent > 100) {
      showToast('Custos invisíveis deve estar entre 0 e 100.', 'error')
      return
    }

    const invalidQty = ingredientes.some(ing => Number(ing.quantidade) < 0)
    if (invalidQty) {
      showToast('Quantidades dos ingredientes devem ser >= 0.', 'error')
      return
    }

    try {
      const dadosReceitaBase: any = {
        nome: (formData.nome || '').trim(),
        rendimento: Math.round(parseFloat(formData.rendimento)) || 1,
        unidade_rendimento: formData.unidade_rendimento,
        instrucoes: formData.instrucoes || null,
        categoria: formData.categoria,
        ativo: true
      }

      const custosInvisiveisDecimalToSave = Number(String(formData.custosInvisiveis).replace(',', '.')) / 100 || 0
      const dadosReceitaComCustos = { ...dadosReceitaBase, custosInvisiveis: custosInvisiveisDecimalToSave }

      let receitaId: number

      if (editingReceita) {
        // Ao editar: verificar se outro receita (não a atual) já usa esse nome
        const nomeTrim = (formData.nome || '').trim()
        if (nomeTrim) {
          const { data: duplicadas, error: dupErr } = await supabase
            .from('receitas')
            .select('id')
            .eq('nome', nomeTrim)
          if (dupErr) throw dupErr
          const conflito = (duplicadas || []).find((r: { id: number }) => r.id !== editingReceita.id)
          if (conflito) {
            showToast('Já existe uma receita com esse nome. Escolha outro nome.', 'error')
            return
          }
        }

        let updateResult: any
        try {
          updateResult = await updateReceita(editingReceita.id, dadosReceitaBase)
        } catch (err) {
          updateResult = { error: err }
        }

        if (updateResult && updateResult.error) {
          const errStr = JSON.stringify(updateResult.error)
          const code = (updateResult.error && (updateResult.error as any).code) || ''
          const msg = (updateResult.error && (updateResult.error as any).message) || ''
          if (code === '23505' || msg.includes('receitas_nome_unique') || errStr.includes('receitas_nome_unique')) {
            showToast('Já existe uma receita com esse nome. Escolha outro nome.', 'error')
            return
          }
          if (errStr && (errStr.includes('PGRST204') || errStr.includes("Could not find the 'custosInvisiveis'"))) {
            const retry = await updateReceita(editingReceita.id, dadosReceitaBase)
            if (retry.error) throw retry.error
            updateResult = retry
          } else {
            throw updateResult.error
          }
        }

        receitaId = editingReceita.id
      } else {
        let insertResult: any
        try {
          insertResult = await createReceita(dadosReceitaBase)
        } catch (err) {
          insertResult = { error: err }
        }

        if (insertResult && insertResult.error) {
          const errStr = JSON.stringify(insertResult.error)
          if (errStr && errStr.includes('PGRST204') || errStr.includes("Could not find the 'custosInvisiveis'")) {
            const retry = await createReceita(dadosReceitaBase)
            if (retry.error) throw retry.error
            insertResult = retry
          } else {
            const fullErr = JSON.stringify(insertResult.error, null, 2)
            const code = (insertResult.error && (insertResult.error as any).code) || ''
            const msg = (insertResult.error && (insertResult.error as any).message) || ''
            if (code === '23505' || msg.includes('receitas_nome_unique') || fullErr.includes('receitas_nome_unique')) {
              showToast('Já existe uma receita com esse nome. Escolha outro nome.', 'error')
              return
            }
            throw insertResult.error
          }
        }

        receitaId = insertResult.data.id
      }

      // SALVAR INGREDIENTES (com dedupe que considera categoria)
      if (ingredientes.length > 0) {
        const { error: deleteError } = await deleteByReceitaId(receitaId)
        if (deleteError) throw deleteError

        const { error: directDeleteErr } = await supabase
          .from('composicao_receitas')
          .delete()
          .eq('receita_id', receitaId)
        if (directDeleteErr) throw directDeleteErr

        const composicoesParaSalvar = ingredientes
          .filter(ing => ing.insumo_id > 0 && (ing.categoria === 'embalagem' || Number(ing.quantidade) > 0))
          .map(ing => ({
            receita_id: receitaId,
            insumo_id: ing.insumo_id,
            quantidade: ing.categoria === 'embalagem' ? 1 : ing.quantidade,
            categoria: ing.categoria
          }))

        if (composicoesParaSalvar.length > 0) {
          // Deduplicar apenas quando insumo_id + categoria forem iguais.
          const composicoesMap: Record<string, any> = {}
          for (const c of composicoesParaSalvar) {
            const key = `${c.receita_id}_${c.insumo_id}_${c.categoria}` // inclui categoria para permitir mesmo insumo em categorias diferentes
            if (!composicoesMap[key]) {
              composicoesMap[key] = { ...c, quantidade: Number(c.quantidade) }
            } else {
              composicoesMap[key].quantidade = Number(composicoesMap[key].quantidade) + Number(c.quantidade)
            }
          }
          const composicoesUnicas = Object.values(composicoesMap)

          try {
            const { error } = await insertMany(composicoesUnicas)
            if (error) throw error
          } catch (composicaoError) {
            // tentativa por item para debug com logs mais detalhados
            console.error('Erro ao salvar lotes de composições (insertMany) — resposta original:',
              composicaoError && typeof composicaoError === 'object' ? JSON.stringify(composicaoError, null, 2) : composicaoError)

            for (let i = 0; i < composicoesUnicas.length; i++) {
              try {
                const payload = composicoesUnicas[i]
                const { error: singleError, data: singleData } = await insertMany([payload])
                if (singleError) {
                  // Tenta serializar o erro; quando vazio, imprime o objeto inteiro e o payload
                  let serialized = null
                  try { serialized = JSON.stringify(singleError, Object.getOwnPropertyNames(singleError), 2) } catch (e) { serialized = String(singleError) }
                  console.error(`Erro ao salvar composição ${i + 1}:`, serialized || singleError, 'payload:', payload)
                } else {
                  // Log de sucesso parcial para diagnóstico
                  console.info(`Composição ${i + 1} inserida com sucesso (debug):`, singleData)
                }
              } catch (singleComposicaoError) {
                console.error(`Erro inesperado ao salvar composição ${i + 1}:`, singleComposicaoError, 'payload:', composicoesUnicas[i])
              }
            }

            // relança o erro original para a rotina superior tratar
            throw composicaoError
          }
        }
      }

      setShowModal(false)
      resetForm()
      carregarDados()
      showToast(editingReceita ? 'Receita atualizada com sucesso!' : 'Receita cadastrada com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao salvar receita:', error)
      const errStr = error && typeof error === 'object' ? JSON.stringify(error) : String(error)
      const code = (error && typeof error === 'object' && (error as any).code) || ''
      const msg = (error && typeof error === 'object' && (error as any).message) || ''
      if (code === '23505' || msg.includes('receitas_nome_unique') || errStr.includes('receitas_nome_unique')) {
        showToast('Já existe uma receita com esse nome. Escolha outro nome.', 'error')
        return
      }
      let errorMessage = 'Erro desconhecido'
      if (error && typeof error === 'object') {
        const err = error as any
        errorMessage = err.message || err.details || err.hint || err.code || JSON.stringify(error)
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      showToast(`Erro ao salvar receita: ${errorMessage}`, 'error')
    }
  }

  const handleEdit = (receita: Receita) => {
    setEditingReceita(receita)
    setFormData({
      nome: receita.nome,
      rendimento: receita.rendimento.toString(),
      unidade_rendimento: receita.unidade_rendimento || 'un',
      categoria: receita.categoria || 'outro',
      instrucoes: receita.instrucoes || '',
      custosInvisiveis: receita.custosInvisiveis != null ? (Number(receita.custosInvisiveis) * 100).toString() : '0'
    })

    const ingredientesReceita = composicoes
      .filter(c => c.receita_id === receita.id)
      .map(c => ({
        insumo_id: c.insumo_id,
        quantidade: c.categoria === 'embalagem' ? 1 : c.quantidade,
        categoria: c.categoria,
        insumo: c.insumo
      }))
    setIngredientes(ingredientesReceita)
    setShowModal(true)
  }

  const handleDelete = async (receita: Receita) => {
    setConfirmTitle('Excluir Receita')
    setConfirmMessage(`Tem certeza que deseja excluir permanentemente a receita "${receita.nome}"? Esta ação não pode ser desfeita.`)
    setConfirmAction(() => async () => {
      try {
        const result = await removerReceita(receita.id)
        if (!result.success) throw new Error(result.message)
        await carregarDados()
        showToast('Receita excluída com sucesso!', 'success')
      } catch (error) {
        let message = 'Erro desconhecido ao excluir'
        if (error instanceof Error) message = error.message
        else if (error && typeof error === 'object') {
          const err = error as any
          message = err.message || err.details || err.hint || JSON.stringify(error)
        }
        showToast(`Erro ao excluir receita: ${message}`, 'error')
      } finally {
        setShowConfirmModal(false)
      }
    })
    setShowConfirmModal(true)
  }

  const handleVerDetalhes = (receita: Receita) => {
    setReceitaSelecionada(receita)
    setActiveTab('detalhes')
    setShowDetalhesModal(true)
  }

  const resetForm = () => {
    setFormData({
      nome: '',
      rendimento: '',
      unidade_rendimento: 'un',
      categoria: 'outro',
      instrucoes: '',
      custosInvisiveis: '0'
    })
    setIngredientes([])
    setEditingReceita(null)
    setPesquisasIngredientes({})
    setActiveDropdown(null)
  }

  const obterCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case 'massa': return 'bg-blue-100 text-blue-800'
      case 'cobertura': return 'bg-purple-100 text-purple-800'
      case 'embalagem': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const normalizarTexto = (texto: string): string => {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim()
  }

  const obterInsumosFiltrados = (index: number) => {
    const pesquisa = pesquisasIngredientes[index] || ''
    if (!insumos || insumos.length === 0) {
      return []
    }

    let insumosFiltrados = insumos.filter(insumo =>
      insumo.categoria === 'insumo' || insumo.categoria === 'embalagem'
    )

    if (pesquisa.trim()) {
      const pesquisaNormalizada = normalizarTexto(pesquisa)

      insumosFiltrados = insumosFiltrados.filter(insumo => {
        const nomeNormalizado = normalizarTexto(insumo.nome)
        const marcaNormalizada = insumo.marca ? normalizarTexto(insumo.marca) : ''
        const fornecedorNormalizado = insumo.fornecedor ? normalizarTexto(insumo.fornecedor) : ''

        return nomeNormalizado.includes(pesquisaNormalizada) ||
          marcaNormalizada.includes(pesquisaNormalizada) ||
          fornecedorNormalizado.includes(pesquisaNormalizada)
      })

      insumosFiltrados.sort((a, b) => {
        const pesquisaLower = normalizarTexto(pesquisa)
        const aNome = normalizarTexto(a.nome).includes(pesquisaLower)
        const bNome = normalizarTexto(b.nome).includes(pesquisaLower)
        const aMarca = a.marca ? normalizarTexto(a.marca).includes(pesquisaLower) : false
        const bMarca = b.marca ? normalizarTexto(b.marca).includes(pesquisaLower) : false

        if (aNome && !bNome) return -1
        if (!aNome && bNome) return 1
        if (aNome && bNome) {
          if (aMarca && !bMarca) return -1
          if (!aMarca && bMarca) return 1
        }
        return a.nome.localeCompare(b.nome)
      })
    } else {
      insumosFiltrados.sort((a, b) => a.nome.localeCompare(b.nome))
    }

    return insumosFiltrados
  }

  const selecionarInsumo = (index: number, insumo: Insumo) => {
    const isEmbalagem = (insumo as any)?.categoria === 'embalagem'
    const novosIngredientes = [...ingredientes]
    novosIngredientes[index] = {
      ...novosIngredientes[index],
      insumo_id: insumo.id,
      categoria: isEmbalagem ? 'embalagem' : novosIngredientes[index].categoria,
      quantidade: isEmbalagem ? 1 : novosIngredientes[index].quantidade
    }
    setIngredientes(novosIngredientes)
    setPesquisasIngredientes({ ...pesquisasIngredientes, [index]: insumo.nome })
    setActiveDropdown(null)
  }

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement> | React.ChangeEvent<HTMLInputElement>, index: number) => {
    const rect = e.target.getBoundingClientRect()
    setDropdownPosition({
      top: rect.bottom,
      left: rect.left,
      width: rect.width
    })
    setActiveDropdown(index)
  }

  const destacarTexto = (texto: string, pesquisa: string) => {
    if (!pesquisa.trim()) return texto

    const textoNormalizado = normalizarTexto(texto)
    const pesquisaNormalizada = normalizarTexto(pesquisa)

    if (!textoNormalizado.includes(pesquisaNormalizada)) return texto

    const index = textoNormalizado.indexOf(pesquisaNormalizada)
    const matchLength = pesquisaNormalizada.length

    const antes = texto.substring(0, index)
    const match = texto.substring(index, index + matchLength)
    const depois = texto.substring(index + matchLength)

    return (
      <>
        {antes}
        <span className="bg-yellow-200 font-semibold">{match}</span>
        {depois}
      </>
    )
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="page-container">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white p-4 rounded-lg shadow">
                  <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ProtectedLayout>
    )
  }

  return (
    <ProtectedLayout>
      <div className="page-container">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Receitas</h1>
            <p className="text-sm text-gray-600 mt-1">Gerencie suas receitas e ingredientes</p>
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button
              onClick={handleRefresh}
              title="Atualizar dados"
              className="bg-white text-gray-700 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2 w-full lg:w-auto text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Receita</span>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar receitas..."
              value={termoPesquisa}
              onChange={(e) => setTermoPesquisa(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {receitasFiltradas.map((receita) => {
            const custosReceita = computeCostsForReceita(receita)
            return (
              <div key={receita.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${receita.categoria === 'doce' || receita.categoria === 'bolo' || receita.categoria === 'torta' ? 'bg-pink-50 text-pink-600' :
                        receita.categoria === 'salgado' ? 'bg-orange-50 text-orange-600' :
                          receita.categoria === 'pao' ? 'bg-amber-50 text-amber-600' :
                            'bg-gray-50 text-gray-600'
                        }`}>
                        <ChefHat className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-green-700 transition-colors">
                          {receita.nome}
                        </h3>
                        <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                          {receita.categoria || 'Geral'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50/50 border-b border-gray-100">
                  <div className="p-3 text-center">
                    <span className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Rendimento</span>
                    <span className="block font-bold text-gray-900 text-sm">
                      {receita.rendimento} <span className="text-xs font-normal text-gray-500">{receita.unidade_rendimento}</span>
                    </span>
                  </div>
                  <div className="p-3 text-center">
                    <span className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Custo Total</span>
                    <span className="block font-bold text-gray-900 text-sm">{formatCurrency(custosReceita.custoTotal)}</span>
                  </div>
                  <div className="p-3 text-center">
                    <span className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">Unitário</span>
                    <span className="block font-bold text-green-600 text-sm">{
                      receita.rendimento > 0
                        ? formatUnitPriceWithUnit(custosReceita.custoUnitarioTotal, receita.unidade_rendimento)
                        : '-'
                    }</span>
                  </div>
                </div>

                <div className="p-5 flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-gray-100 rounded-md">
                      <Package className="h-4 w-4 text-gray-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      {composicoes.filter(c => c.receita_id === receita.id).length} itens na receita
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {['massa', 'cobertura', 'embalagem'].map(cat => {
                      const count = composicoes.filter(c => c.receita_id === receita.id && c.categoria === cat).length;

                      const styles = {
                        massa: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', label: 'Massa' },
                        cobertura: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', label: 'Cob.' },
                        embalagem: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', label: 'Emb.' }
                      }[cat] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100', label: cat };

                      return (
                        <div key={cat} className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${styles.bg} ${styles.border} ${count === 0 ? 'opacity-40' : 'hover:shadow-sm'}`}>
                          <span className="text-[10px] uppercase font-bold tracking-wider mb-1 text-gray-500">{styles.label}</span>
                          <span className={`text-xl font-bold ${styles.text}`}>{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleVerDetalhes(receita)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </button>
                  <button
                    onClick={() => handleEdit(receita)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition-colors shadow-sm"
                  >
                    <Edit className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(receita)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Modal de Receita */}
        {showModal && (
          <div className="modal-container">
            <div className="modal-content modal-md bg-white rounded-lg shadow-xl w-full max-h-[85vh] flex flex-col">
              <div className="p-6 flex-1 overflow-y-auto">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {editingReceita ? 'Editar Receita' : 'Nova Receita'}
                </h2>

                <form id="receita-form" onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900">Definir custos invisíveis (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.custosInvisiveis}
                        onChange={e => {
                          let val = e.target.value;
                          if (val === '') val = '0';
                          if (Number(val) > 100) val = '100';
                          if (Number(val) < 0) val = '0';
                          setFormData({ ...formData, custosInvisiveis: val });
                        }}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-500"
                        placeholder="Ex: 15"
                      />
                      <span className="text-xs text-gray-500">Defina sua taxa de custos invisíveis (gás, energia, água, detergente, desgaste de equipamentos). Recomendamos usar entre 10% e 20%.</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Custo Ingredientes</div>
                        <div className="font-bold">{formatCurrency(preview.detalhes?.custoIngredientes ?? 0)}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Custo Invisível ({( (Math.min(Math.max(Number(String(formData.custosInvisiveis).replace(',', '.')) / 100, 0), 1)) * 100 ).toFixed(2)}%)</div>
                        <div className="font-bold">{formatCurrency(preview.detalhes?.custoInvisivel ?? 0)}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Custo Base</div>
                        <div className="font-bold">{formatCurrency(preview.detalhes?.custoBase ?? 0)}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Custo Unitário</div>
                        <div className="font-bold">{isFiniteNumber(preview.detalhes?.custoUnitarioTotal) ? formatUnitPriceWithUnit(preview.detalhes!.custoUnitarioTotal, formData.unidade_rendimento) : '-'}</div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">Nome *</label>
                      <input
                        type="text"
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">Categoria *</label>
                      <select
                        required
                        value={formData.categoria}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                      >
                        <option value="pao">Pão</option>
                        <option value="doce">Doce</option>
                        <option value="salgado">Salgado</option>
                        <option value="torta">Torta</option>
                        <option value="bolo">Bolo</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900">Rendimento *</label>
                      <input
                        type="number"
                        step="0.00001"
                        min="0"
                        required
                        value={formData.rendimento}
                        onChange={(e) => setFormData({ ...formData, rendimento: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-500"
                        placeholder="Ex: 10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">Unidade *</label>
                      <select
                        required
                        value={formData.unidade_rendimento}
                        onChange={(e) => setFormData({ ...formData, unidade_rendimento: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                      >
                        <option value="un">Unidade</option>
                        <option value="kg">Quilograma</option>
                        <option value="g">Grama</option>
                        <option value="l">Litro</option>
                        <option value="ml">Mililitro</option>
                        <option value="xícara">Xícara</option>
                        <option value="colher">Colher</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900">Instruções</label>
                    <textarea
                      value={formData.instrucoes}
                      onChange={(e) => setFormData({ ...formData, instrucoes: e.target.value })}
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  {/* Seção de Ingredientes */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                        Ingredientes
                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
                          {ingredientes.length}
                        </span>
                      </h3>
                      {ingredientes.length > 0 && (
                        <span className="text-xs text-gray-400 italic">
                          Role para ver todos
                        </span>
                      )}
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        <div className="col-span-6">Insumo / Embalagem</div>
                        <div className="col-span-3">Categoria</div>
                        <div className="col-span-2">Qtd</div>
                        <div className="col-span-1 text-center">Ação</div>
                      </div>

                      <div
                        ref={ingredientesListRef}
                        className="max-h-[350px] overflow-y-auto p-2 space-y-2 custom-scrollbar"
                        onScroll={() => setActiveDropdown(null)}
                      >
                        {ingredientes.length === 0 && (
                          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg bg-white mx-2">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium">Nenhum ingrediente</p>
                            <p className="text-xs mt-1">Clique em "Adicionar Ingrediente" abaixo</p>
                          </div>
                        )}

                        {ingredientes.map((ingrediente, index) => {
                          const insumoObj = ingrediente.insumo || insumos?.find(i => i.id === ingrediente.insumo_id)
                          const precoPacoteItem = Number(insumoObj?.preco_pacote ?? insumoObj?.preco ?? 0) || 0
                          const pesoPacoteItem = Number(insumoObj?.peso_pacote ?? 1) || 1
                          const custoUnitarioItem = pesoPacoteItem === 0 ? 0 : precoPacoteItem / pesoPacoteItem
                          let quantidadeItem = Number(ingrediente.quantidade)
                          if (isNaN(quantidadeItem)) quantidadeItem = 0
                          if ((ingrediente.categoria === 'cobertura' || ingrediente.categoria === 'embalagem') && quantidadeItem <= 0) quantidadeItem = 1
                          const itemTotal = custoUnitarioItem * quantidadeItem

                          return (
                          <div
                            key={index}
                            id={`ingrediente-${index}`}
                            className="grid grid-cols-12 gap-3 items-start bg-white p-2 rounded-md border border-gray-200 shadow-sm hover:border-green-400 transition-colors"
                          >
                            <div className="col-span-6 relative">
                              <div className="mb-2 relative">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder="Buscar item..."
                                    value={pesquisasIngredientes[index] || ''}
                                    onChange={(e) => {
                                      setPesquisasIngredientes({ ...pesquisasIngredientes, [index]: e.target.value })
                                      handleInputFocus(e, index)
                                    }}
                                    onFocus={(e) => handleInputFocus(e, index)}
                                    onBlur={() => {
                                      setTimeout(() => setActiveDropdown(null), 200)
                                    }}
                                    className="w-full border border-gray-300 rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 text-sm"
                                  />
                                </div>
                              </div>

                              {ingrediente.insumo_id > 0 && (
                                <div className="mb-2">
                                  <div className="flex items-center justify-between text-xs font-medium text-gray-900 bg-green-50 border border-green-200 rounded-md px-2 py-1.5 mt-1">
                                    <div>
                                      {insumoObj?.nome || 'Insumo não encontrado'}
                                      <span className="text-gray-500 ml-2">({insumoObj?.unidade || 'N/A'})</span>
                                      <div className="text-xs text-gray-600 mt-1">Custo do item: <span className="font-bold">{formatCurrency(itemTotal)}</span></div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        atualizarIngrediente(index, 'insumo_id', 0)
                                        setPesquisasIngredientes({ ...pesquisasIngredientes, [index]: '' })
                                      }}
                                      className="text-red-600 hover:text-red-800 ml-2"
                                      title="Limpar seleção"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="col-span-3">
                              <select
                                value={ingrediente.categoria}
                                onChange={(e) => atualizarIngrediente(index, 'categoria', e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs text-gray-900"
                              >
                                <option value="massa">Massa</option>
                                <option value="cobertura">Cobertura</option>
                                <option value="embalagem">Embalagem</option>
                              </select>
                            </div>

                            <div className="col-span-2">
                              <input
                                type="number"
                                step="0.00001"
                                min="0"
                                placeholder="0"
                                value={ingrediente.categoria === 'embalagem' ? 1 : ingrediente.quantidade}
                                onChange={(e) => atualizarIngrediente(index, 'quantidade', parseFloat(e.target.value) || 0)}
                                readOnly={ingrediente.categoria === 'embalagem'}
                                disabled={ingrediente.categoria === 'embalagem'}
                                tabIndex={ingrediente.categoria === 'embalagem' ? -1 : 0}
                                title={ingrediente.categoria === 'embalagem' ? 'Embalagem sempre é 1 unidade' : undefined}
                                className={`w-full border rounded-md px-2 py-1.5 text-sm text-center ${
                                  ingrediente.categoria === 'embalagem'
                                    ? 'border-gray-200 bg-gray-100 text-gray-600 cursor-not-allowed'
                                    : 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400'
                                }`}
                              />
                            </div>

                            <div className="col-span-1 flex justify-center pt-1">
                              <button
                                type="button"
                                onClick={() => removerIngrediente(index)}
                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                title="Remover item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          )
                        })}
                      </div>

                      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500 flex justify-between rounded-b-lg">
                        <span>Total de itens: {ingredientes.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Preço total e unitário na parte inferior */}
                  {(() => {
                    const previewLocal = calcularPrecoPreview()
                    return (
                      <div className="py-3 px-4 bg-gray-50 border border-gray-200 rounded-md">
                        <div className="max-w-full mx-0 flex items-center justify-between gap-4">
                          <div className="text-sm text-gray-600">Preço total da receita</div>
                          <div className="text-sm font-semibold text-gray-900">{formatCurrency(previewLocal.total)}</div>
                          <div className="text-sm text-gray-600">Preço unitário</div>
                          <div className="text-sm font-semibold text-green-600">{
                            isFiniteNumber(previewLocal.unitario) && previewLocal.unitario > 0
                              ? formatUnitPriceWithUnit(previewLocal.unitario, formData.unidade_rendimento)
                              : '-'
                          }</div>
                        </div>
                      </div>
                    )
                  })()}

                </form>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={adicionarIngrediente}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Adicionar Ingrediente</span>
                  </button>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      form="receita-form"
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      {editingReceita ? 'Atualizar' : 'Cadastrar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Detalhes */}
        {showDetalhesModal && receitaSelecionada && (
          <div className="modal-container">
            <div className="modal-content modal-lg bg-white rounded-lg shadow-xl w-full max-h-[90vh] flex flex-col">
              <div className="px-6 pt-6 pb-0 border-b border-gray-200">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{receitaSelecionada.nome}</h2>
                    <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                      {receitaSelecionada.categoria || 'Geral'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowDetalhesModal(false)}
                    className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="flex space-x-6">
                  <button
                    onClick={() => setActiveTab('detalhes')}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'detalhes'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Visão Geral
                  </button>
                  <button
                    onClick={() => setActiveTab('ingredientes')}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ingredientes'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Ingredientes
                  </button>
                  <button
                    onClick={() => setActiveTab('preparo')}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'preparo'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Modo de Preparo
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {activeTab === 'detalhes' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Rendimento</h3>
                        <p className="text-2xl font-bold text-gray-900">
                          {receitaSelecionada.rendimento} <span className="text-sm font-medium text-gray-500">{receitaSelecionada.unidade_rendimento || 'un'}</span>
                        </p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Custo Total</h3>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(detalheCustos.custoTotal)}
                        </p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                        <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Custo Unitário</h3>
                        <p className="text-2xl font-bold text-gray-900">
                          {
                            receitaSelecionada.rendimento > 0 && isFiniteNumber(detalheCustos.custoUnitarioTotal)
                              ? formatUnitPriceWithUnit(detalheCustos.custoUnitarioTotal, receitaSelecionada.unidade_rendimento)
                              : '-'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ingredientes' && (
                  <div className="space-y-6">
                    {['massa', 'cobertura', 'embalagem'].map(cat => {
                      const items = composicoes.filter(c => c.receita_id === receitaSelecionada.id && c.categoria === cat).map(c => c)
                      if (!items.length) return null;

                      const styles = {
                        massa: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
                        cobertura: { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
                        embalagem: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', dot: 'bg-green-500' }
                      }[cat] || { bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' };

                      return (
                        <div key={cat} className="rounded-xl border border-gray-200 overflow-hidden">
                          <div className={`px-4 py-3 ${styles.bg} border-b ${styles.border} flex items-center gap-2`}>
                            <span className={`w-2 h-2 rounded-full ${styles.dot}`}></span>
                            <h4 className={`text-sm font-bold uppercase tracking-wide ${styles.text}`}>{cat}</h4>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {items.map((comp, index) => {
                              const ins = comp.insumo || {}
                              const precoPacote = Number(ins.preco_pacote ?? ins.preco ?? 0) || 0
                              const pesoPacote = Number(ins.peso_pacote ?? 1) || 1
                              const custoUnit = pesoPacote === 0 ? 0 : precoPacote / pesoPacote
                              let qtd = Number(comp.quantidade)
                              if (isNaN(qtd)) qtd = 0
                              if ((comp.categoria === 'cobertura' || comp.categoria === 'embalagem') && qtd <= 0) qtd = 1
                              const custoItem = custoUnit * qtd

                              return (
                              <div key={index} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors">
                                <div>
                                  <div className="font-medium text-gray-700">{ins.nome}</div>
                                  <div className="text-xs text-gray-500">Custo do item: <span className="font-semibold">{formatCurrency(custoItem)}</span></div>
                                </div>
                                <div className="font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                  {comp.quantidade} {ins.unidade}
                                </div>
                              </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}

                    {composicoes.filter(c => c.receita_id === receitaSelecionada.id).length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <p>Nenhum ingrediente cadastrado para esta receita.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'preparo' && (
                  <div className="bg-white">
                    {receitaSelecionada.instrucoes ? (
                      <div className="prose prose-sm max-w-none text-gray-700">
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-6">
                          <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
                            <ChefHat className="h-5 w-5" /> Instruções de Preparo
                          </h3>
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {receitaSelecionada.instrucoes}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <ChefHat className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">Sem instruções</h3>
                        <p className="text-gray-500 mt-1">Nenhum modo de preparo foi adicionado a esta receita.</p>
                        <button
                          onClick={() => {
                            setShowDetalhesModal(false);
                            handleEdit(receitaSelecionada);
                          }}
                          className="mt-4 text-green-600 font-medium hover:text-green-700 text-sm"
                        >
                          Adicionar agora
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setShowDetalhesModal(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm modal, toast e dropdown (mantidos) */}
        {showConfirmModal && (
          <div className="modal-container">
            <div className="modal-content modal-sm bg-white rounded-lg shadow-xl w-full">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{confirmTitle}</h2>
                <p className="text-sm text-gray-600 mb-6">{confirmMessage}</p>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmModal(false)
                      setConfirmAction(null)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmAction) {
                        confirmAction()
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>

      {isMounted && activeDropdown !== null && createPortal(
        <div
          className="fixed z-[9999] bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-y-auto flex flex-col"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
        >
          {obterInsumosFiltrados(activeDropdown).length > 0 ? (
            <>
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-600 sticky top-0 z-10">
                {pesquisasIngredientes[activeDropdown] && pesquisasIngredientes[activeDropdown].trim()
                  ? `${obterInsumosFiltrados(activeDropdown).length} resultado(s)`
                  : 'Sugestões'
                }
              </div>
              {obterInsumosFiltrados(activeDropdown).map((insumo) => (
                <button
                  key={insumo.id}
                  type="button"
                  onClick={() => selecionarInsumo(activeDropdown, insumo)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none text-sm border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {destacarTexto(insumo.nome, pesquisasIngredientes[activeDropdown] || '')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {insumo.marca && `${insumo.marca} • `}{insumo.unidade}
                      </div>
                    </div>
                    <div className={`ml-2 px-2 py-0.5 text-[10px] font-medium rounded-full ${insumo.categoria === 'insumo'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                      }`}>
                      {insumo.categoria === 'insumo' ? 'Insumo' : 'Emb.'}
                    </div>
                  </div>
                </button>
              ))}
            </>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              {pesquisasIngredientes[activeDropdown]?.trim()
                ? 'Nenhum insumo encontrado'
                : 'Digite para buscar...'
              }
            </div>
          )}
        </div>,
        document.body
      )}
    </ProtectedLayout>
  )
}