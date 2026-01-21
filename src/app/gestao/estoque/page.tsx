'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import ProtectedLayout from '@/components/ProtectedLayout'
import { Plus, Search, Edit, Trash2 } from 'lucide-react'
import { convertToBaseQuantity, calculatePrecoUnitario } from '@/lib/units'

interface Insumo {
  id: number
  nome: string
  categoria: 'insumo' | 'embalagem' | 'varejo' | 'outro'
  tipo_estoque: 'insumo' | 'varejo'
  marca?: string
  fornecedor?: string
  unidade: string
  peso_pacote?: number | null
  preco_pacote?: number | null
  estoque_atual?: number | null
  estoque_minimo?: number | null
  quantidade_minima?: number | null
  unidade_medida_base?: string | null
  quantidade_pacote?: number | null
  preco_unitario?: number | null
  codigo_barras: string
  created_at?: string
  updated_at?: string
}

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

const Toast = ({ message, type, onClose }: ToastProps) => (
  <div
    className={`fixed top-5 right-5 p-4 rounded-md shadow-lg text-white z-50 ${type === 'success'
      ? 'bg-green-500'
      : type === 'error'
        ? 'bg-red-500'
        : 'bg-blue-500'
      }`}
  >
    <span>{message}</span>
    <button onClick={onClose} className="ml-4 font-bold">
      X
    </button>
  </div>
)

export default function EstoquePage() {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [activeModal, setActiveModal] = useState<'none' | 'insumo' | 'varejo'>('none')
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null)
  const [termoPesquisa, setTermoPesquisa] = useState('')
  const [filtroEstoque, setFiltroEstoque] = useState<'todos' | 'insumo' | 'varejo'>('todos')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; nome: string; tipo_estoque: 'insumo' | 'varejo' } | null>(null)

  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'insumo',
    tipo_estoque: 'insumo',
    marca: '',
    fornecedor: '',
    unidade: 'kg',
    quantidade_pacote: '',
    quantidade_minima: '',
    unidade_medida_base: 'g',
    peso_pacote: '',
    preco_pacote: '',
    estoque_atual: '',
    estoque_minimo: '',
    codigo_barras: ''
  })

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Prevent number inputs from changing value on mouse wheel.
  // While a numeric input is focused we add a non-passive wheel listener
  // to the window so the wheel event can be prevented instead of
  // letting the browser change the input value.
  const preventWheel = (e: WheelEvent) => {
    e.preventDefault()
  }
  const handleNumberFocus = () => {
    window.addEventListener('wheel', preventWheel, { passive: false })
  }
  const handleNumberBlur = () => {
    window.removeEventListener('wheel', preventWheel)
  }

  const formatPreco = (value?: number | null) => {
    if (value == null) return '-'
    const s = Number(value).toPrecision(6)
    if (s.includes('e')) return s
    let out = s
    if (out.includes('.')) {
      out = out.replace(/0+$/, '').replace(/\.$/, '')
    }
    return out
  }

  const precoUnitarioCalculado = (() => {
    const preco = formData.preco_pacote ? parseFloat(formData.preco_pacote) : null
    const quantidadeRaw = formData.quantidade_pacote ? parseFloat(formData.quantidade_pacote) : (formData.peso_pacote ? parseFloat(formData.peso_pacote) : null)
    const unidadeRaw = formData.unidade_medida_base || formData.unidade || 'un'
    if (!preco || !quantidadeRaw) return null
    const { baseUnit, quantityInBase } = convertToBaseQuantity(unidadeRaw, quantidadeRaw)
    if (!quantityInBase) return null
    return calculatePrecoUnitario(preco, baseUnit, quantityInBase)
  })()


  useEffect(() => {
    carregarItens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstoque])

  const carregarItens = async () => {
    try {
      setLoading(true)
      let itens: Insumo[] = []

      if (filtroEstoque === 'todos' || filtroEstoque === 'insumo') {
        const { data: insumosData, error: insumosError } = await supabase!
          .from('insumos')
          .select('*')
          .order('nome', { ascending: true })
        if (insumosError) throw insumosError
        const insumosMapped: Insumo[] = (insumosData || []).map((i: any) => {
          // Determinar unidade base e quantidade em base (g, ml, un)
          const originalUnit = i.unidade ?? 'kg'
          const baseUnit = i.unidade_medida_base ?? (originalUnit === 'kg' ? 'g' : originalUnit === 'l' ? 'ml' : originalUnit)
          const quantidadeFromQuantidadePacote = i.quantidade_pacote != null ? Number(i.quantidade_pacote) : null
          const quantidadeFromPeso = i.peso_pacote != null ? convertToBaseQuantity(originalUnit, Number(i.peso_pacote)).quantityInBase : null
          const quantidadeInBase = quantidadeFromQuantidadePacote ?? quantidadeFromPeso ?? null

          const precoPacoteNum = i.preco_pacote != null ? Number(i.preco_pacote) : null
          const precoUnit = precoPacoteNum != null && quantidadeInBase ? calculatePrecoUnitario(precoPacoteNum, baseUnit, quantidadeInBase) : (i.preco_unitario ?? null)

          return {
            id: i.id,
            nome: i.nome,
            categoria: (i.categoria as 'insumo' | 'embalagem' | 'outro') ?? 'insumo',
            tipo_estoque: 'insumo',
            marca: i.marca ?? undefined,
            fornecedor: i.fornecedor ?? undefined,
            unidade: originalUnit,
            peso_pacote: i.peso_pacote ?? null,
            preco_pacote: i.preco_pacote ?? null,
            estoque_atual: i.estoque_atual ?? 0,
            estoque_minimo: i.estoque_minimo ?? 0,
            unidade_medida_base: baseUnit ?? null,
            quantidade_pacote: quantidadeInBase,
            quantidade_minima: i.quantidade_minima ?? null,
            preco_unitario: precoUnit,
            codigo_barras: i.codigo_barras ?? '',
            created_at: i.created_at,
            updated_at: i.updated_at,
          }
        })
        itens = [...itens, ...insumosMapped]
      }

      if (filtroEstoque === 'todos' || filtroEstoque === 'varejo') {
        const { data: varejoData, error: varejoError } = await supabase!
          .from('varejo')
          .select('id, nome, categoria, preco_venda, codigo_barras, unidade, estoque_atual, estoque_minimo, ativo, created_at, updated_at')
          .order('nome', { ascending: true })
        if (varejoError) throw varejoError
        const varejoMapped: Insumo[] = (varejoData || []).map((v: any) => {
          const originalUnit = v.unidade ?? 'un'
          const baseUnit = v.unidade_medida_base ?? (originalUnit === 'kg' ? 'g' : originalUnit === 'l' ? 'ml' : originalUnit)
          const quantidadeInBase = v.quantidade_pacote != null ? Number(v.quantidade_pacote) : null
          const precoPacoteNum = v.preco_venda != null ? Number(v.preco_venda) : null
          const precoUnit = precoPacoteNum != null && quantidadeInBase ? calculatePrecoUnitario(precoPacoteNum, baseUnit, quantidadeInBase) : (v.preco_unitario ?? null)

          return {
            id: v.id,
            nome: v.nome,
            categoria: v.categoria ?? 'varejo',
            tipo_estoque: 'varejo',
            unidade: originalUnit,
            peso_pacote: null,
            preco_pacote: v.preco_venda ?? null,
            estoque_atual: v.estoque_atual ?? 0,
            estoque_minimo: v.estoque_minimo ?? 0,
            unidade_medida_base: baseUnit ?? null,
            quantidade_pacote: quantidadeInBase,
            quantidade_minima: v.quantidade_minima ?? null,
            preco_unitario: precoUnit,
            codigo_barras: v.codigo_barras ?? '',
            created_at: v.created_at,
            updated_at: v.updated_at,
          }
        })
        itens = [...itens, ...varejoMapped]
      }

      setInsumos(itens)
    } catch {
      showToast('Erro ao carregar itens', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Validações mínimas
      if (!formData.nome || !formData.nome.trim()) {
        showToast('Nome é obrigatório', 'error')
        return
      }
      if (formData.preco_pacote && parseFloat(formData.preco_pacote) <= 0) {
        showToast('Preço do pacote deve ser maior que zero', 'error')
        return
      }
      if (formData.quantidade_pacote && parseFloat(formData.quantidade_pacote) <= 0) {
        showToast('Quantidade do pacote deve ser maior que zero', 'error')
        return
      }
      // Construir payload específico por tipo
      const isVarejo = formData.tipo_estoque === 'varejo'

      // calcular quantidade em unidade base e preco unitario
      const quantidadeRaw = formData.quantidade_pacote ? parseFloat(formData.quantidade_pacote) : (formData.peso_pacote ? parseFloat(formData.peso_pacote) : null)
      const unidadeRaw = formData.unidade_medida_base || formData.unidade || 'un'
      const { baseUnit, quantityInBase } = quantidadeRaw ? convertToBaseQuantity(unidadeRaw, quantidadeRaw) : { baseUnit: unidadeRaw as any, quantityInBase: null }
      const precoPacoteNum = formData.preco_pacote ? parseFloat(formData.preco_pacote) : null
      const precoUnit = (precoPacoteNum !== null && quantityInBase) ? calculatePrecoUnitario(precoPacoteNum, baseUnit, quantityInBase) : null

      if (isVarejo) {
        // Validação e verificação de código de barras em varejo
        if (formData.codigo_barras) {
          const { data: produtoExist, error: produtoExistError } = await supabase!
            .from('varejo')
            .select('id')
            .eq('codigo_barras', formData.codigo_barras)
            .maybeSingle()
          if (produtoExistError) throw produtoExistError
          if (produtoExist && !editingInsumo) {
            showToast('Código de barras já cadastrado em varejo!', 'error')
            return
          }
        }

        const produtoPayload = {
          nome: formData.nome,
          categoria: 'varejo',
          preco_venda: formData.preco_pacote ? parseFloat(formData.preco_pacote) : 0,
          codigo_barras: (formData.codigo_barras || '').trim() || null,
          unidade: formData.unidade || 'un',
          unidade_medida_base: baseUnit,
          quantidade_pacote: quantityInBase,
          quantidade_minima: formData.quantidade_minima ? parseFloat(formData.quantidade_minima) : null,
          preco_unitario: precoUnit,
          estoque_atual: formData.estoque_atual ? parseFloat(formData.estoque_atual) : 0,
          estoque_minimo: formData.estoque_minimo ? parseFloat(formData.estoque_minimo) : 0,
          ativo: true,
        }

        if (editingInsumo && editingInsumo.tipo_estoque === 'varejo') {
          const { data, error } = await supabase!
            .from('varejo')
            .update(produtoPayload)
            .eq('id', editingInsumo.id)
            .select('id, codigo_barras')
            .single()
          if (error) throw error
          showToast('Item de Varejo atualizado com sucesso!', 'success')
        } else {
          const { data, error } = await supabase!
            .from('varejo')
            .insert(produtoPayload)
            .select('id, codigo_barras')
            .single()
          if (error) throw error
          showToast('Item de Varejo adicionado com sucesso!', 'success')
        }
      } else {
        // Insumo: payload conforme schema da tabela insumos
        // Verifica duplicidade de nome antes de salvar
        if (!editingInsumo) {
          const { data: existente, error: existError } = await supabase!
            .from('insumos')
            .select('id')
            .eq('nome', formData.nome)
            .maybeSingle()
          if (existError) throw existError
          if (existente) {
            showToast('Já existe um insumo com este nome.', 'error')
            return
          }
        } else {
          const { data: duplicado, error: dupError } = await supabase!
            .from('insumos')
            .select('id')
            .eq('nome', formData.nome)
          if (dupError) throw dupError
          const conflito = (duplicado || []).find((row: any) => row.id !== editingInsumo!.id)
          if (conflito) {
            showToast('Nome em uso por outro insumo.', 'error')
            return
          }
        }

        // Validar duplicidade de código de barras (se informado)
        const codigoBarrasSan = (formData.codigo_barras || '').replace(/\D/g, '').trim()
        if (codigoBarrasSan) {
          if (!editingInsumo) {
            const { data: cbExist, error: cbError } = await supabase!
              .from('insumos')
              .select('id')
              .eq('codigo_barras', codigoBarrasSan)
              .maybeSingle()
            if (cbError) throw cbError
            if (cbExist) {
              showToast('Código de barras já cadastrado em insumos.', 'error')
              return
            }
          } else {
            const { data: cbDup, error: cbDupError } = await supabase!
              .from('insumos')
              .select('id')
              .eq('codigo_barras', codigoBarrasSan)
            if (cbDupError) throw cbDupError
            const cbConflito = (cbDup || []).find((row: any) => row.id !== editingInsumo!.id)
            if (cbConflito) {
              showToast('Código de barras em uso por outro insumo.', 'error')
              return
            }
          }
        }

        const insumoPayload = {
          nome: formData.nome,
          categoria: formData.categoria === 'varejo' ? 'outro' : formData.categoria, // garantir valor permitido
          unidade: formData.unidade,
          marca: formData.marca || null,
          fornecedor: formData.fornecedor || null,
          peso_pacote: formData.peso_pacote ? parseFloat(formData.peso_pacote) : null,
          preco_pacote: formData.preco_pacote ? parseFloat(formData.preco_pacote) : null,
          unidade_medida_base: baseUnit,
          quantidade_pacote: quantityInBase,
          quantidade_minima: formData.quantidade_minima ? parseFloat(formData.quantidade_minima) : null,
          preco_unitario: precoUnit,
          estoque_atual: formData.estoque_atual ? parseFloat(formData.estoque_atual) : 0,
          estoque_minimo: formData.estoque_minimo ? parseFloat(formData.estoque_minimo) : 0,
          codigo_barras: codigoBarrasSan || null,
        }

        if (editingInsumo && editingInsumo.tipo_estoque === 'insumo') {
          const { error } = await supabase!
            .from('insumos')
            .update(insumoPayload)
            .eq('id', editingInsumo.id)
          if (error) throw error
          showToast('Insumo atualizado com sucesso!', 'success')
        } else {
          const { error } = await supabase!
            .from('insumos')
            .insert(insumoPayload)
          if (error) throw error
          showToast('Insumo adicionado com sucesso!', 'success')
        }
      }

      setActiveModal('none')
      setEditingInsumo(null)
      setFormData({
        nome: '',
        categoria: 'insumo',
        tipo_estoque: 'insumo',
        marca: '',
        fornecedor: '',
        unidade: 'kg',
        quantidade_pacote: '',
        quantidade_minima: '',
        unidade_medida_base: 'g',
        peso_pacote: '',
        preco_pacote: '',
        estoque_atual: '',
        estoque_minimo: '',
        codigo_barras: ''
      })

      carregarItens()
    } catch (err: any) {
      console.error('Erro ao salvar item:', err)
      const msg = err?.message || 'Erro ao salvar item'
      showToast(msg, 'error')
    }
  }

  const handleEdit = (insumo: Insumo) => {
    setEditingInsumo(insumo)
    setFormData({
      nome: insumo.nome || '',
      categoria: insumo.categoria || 'insumo',
      tipo_estoque: insumo.tipo_estoque || 'insumo',
      marca: insumo.marca || '',
      fornecedor: insumo.fornecedor || '',
      unidade: insumo.unidade || 'kg',
      quantidade_pacote: insumo.quantidade_pacote ? insumo.quantidade_pacote.toString() : (insumo.peso_pacote ? insumo.peso_pacote.toString() : ''),
      quantidade_minima: insumo.quantidade_minima?.toString() || '',
      unidade_medida_base: insumo.unidade_medida_base || insumo.unidade || 'g',
      peso_pacote: insumo.peso_pacote?.toString() || '',
      preco_pacote: insumo.preco_pacote?.toString() || '',
      estoque_atual: insumo.estoque_atual?.toString() || '',
      estoque_minimo: insumo.estoque_minimo?.toString() || '',
      codigo_barras: insumo.codigo_barras || ''
    })
    setActiveModal(insumo.tipo_estoque === 'varejo' ? 'varejo' : 'insumo')
  }

  const handleDeleteClick = (insumo: Insumo) => {
    setConfirmDelete({ id: insumo.id, nome: insumo.nome, tipo_estoque: insumo.tipo_estoque })
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    try {
      const { error } = confirmDelete.tipo_estoque === 'varejo'
        ? await supabase!.from('varejo').delete().eq('id', confirmDelete.id)
        : await supabase!.from('insumos').delete().eq('id', confirmDelete.id)
      if (error) throw error
      showToast(`${confirmDelete.tipo_estoque === 'insumo' ? 'Insumo' : 'Item de Varejo'} excluído com sucesso!`, 'success')
      carregarItens()
    } catch {
      showToast('Erro ao deletar item', 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  const insumosFiltrados = insumos
    .filter((insumo) =>
      filtroEstoque === 'todos' ? true : insumo.tipo_estoque === filtroEstoque
    )
    .filter((insumo) =>
      insumo.nome.toLowerCase().includes(termoPesquisa.toLowerCase()) ||
      insumo.marca?.toLowerCase().includes(termoPesquisa.toLowerCase()) ||
      insumo.fornecedor?.toLowerCase().includes(termoPesquisa.toLowerCase()) ||
      insumo.codigo_barras.includes(termoPesquisa)
    )

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="page-container">Carregando...</div>
      </ProtectedLayout>
    )
  }

  return (
    <ProtectedLayout>
      <div className="page-container">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Estoque</h1>

          <div className="flex space-x-2">
            <button
              onClick={() => {
                setEditingInsumo(null)
                setFormData({
                  nome: '',
                  categoria: 'insumo',
                  tipo_estoque: 'insumo',
                  marca: '',
                  fornecedor: '',
                  unidade: 'kg',
                  quantidade_pacote: '',
                  quantidade_minima: '',
                  unidade_medida_base: 'g',
                  peso_pacote: '',
                  preco_pacote: '',
                  estoque_atual: '',
                  estoque_minimo: '',
                  codigo_barras: ''
                })
                setActiveModal('insumo')
              }}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Novo Insumo
            </button>
            <button
              onClick={() => {
                setEditingInsumo(null)
                setFormData({
                  nome: '',
                  categoria: 'varejo',
                  tipo_estoque: 'varejo',
                  marca: '',
                  fornecedor: '',
                  unidade: 'un',
                  quantidade_pacote: '',
                  quantidade_minima: '',
                  unidade_medida_base: 'un',
                  peso_pacote: '',
                  preco_pacote: '',
                  estoque_atual: '',
                  estoque_minimo: '',
                  codigo_barras: ''
                })
                setActiveModal('varejo')
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Novo Varejo
            </button>
          </div>
        </div>

        {/* Filtro Todos / Insumos / Varejo */}
        <div className="flex space-x-2 mb-4">
          <button
            className={`px-4 py-2 rounded-md ${filtroEstoque === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setFiltroEstoque('todos')}
          >
            Todos
          </button>
          <button
            className={`px-4 py-2 rounded-md ${filtroEstoque === 'insumo' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setFiltroEstoque('insumo')}
          >
            Insumos
          </button>
          <button
            className={`px-4 py-2 rounded-md ${filtroEstoque === 'varejo' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setFiltroEstoque('varejo')}
          >
            Varejo
          </button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, marca, fornecedor ou código de barras..."
              value={termoPesquisa}
              onChange={(e) => setTermoPesquisa(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-medium">
              Estoque ({insumosFiltrados.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <div className="max-h-[20rem] overflow-y-auto">
              <table className="w-full table-fixed divide-y text-xs">
                <thead>
                  <tr className="bg-white">
                    <th className="px-2 py-2 text-left w-48 sticky top-0 bg-white z-10 border-b">Nome</th>
                    <th className="px-2 py-2 text-left w-20 sticky top-0 bg-white z-10 border-b">Tipo</th>
                    <th className="px-2 py-2 text-left w-12 sticky top-0 bg-white z-10 border-b">Unid.</th>
                    <th className="px-2 py-2 text-right w-14 sticky top-0 bg-white z-10 border-b">Qtd.</th>
                    {/* Reduzi largura do CB de w-32 para w-16 e adicionei sticky/top e z para manter consistência */}
                    <th className="px-2 py-2 text-left w-16 sticky top-0 bg-white z-10 border-b">CB</th>
                    <th className="px-2 py-2 text-right w-20 sticky top-0 bg-white z-10 border-b">Preço</th>
                    <th className="px-2 py-2 text-right w-20 sticky top-0 bg-white z-10 border-b">P/unit</th>
                    <th className="px-2 py-2 text-right w-12 sticky top-0 bg-white z-10 border-b">Estq.</th>
                    <th className="px-2 py-2 text-right w-20 sticky top-0 bg-white z-10 border-b">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {insumosFiltrados.map((insumo) => (
                    <tr key={`${insumo.tipo_estoque}-${insumo.id}`} className="hover:bg-gray-50 odd:bg-white even:bg-gray-50">
                      <td className="px-2 py-2 max-w-[220px] truncate" title={insumo.nome}>{insumo.nome}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${insumo.tipo_estoque === 'insumo' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                          {insumo.tipo_estoque === 'insumo' ? 'Insumo' : 'Varejo'}
                        </span>
                      </td>
                      <td className="px-2 py-2">{insumo.unidade_medida_base ?? insumo.unidade}</td>
                      <td className="px-2 py-2 text-right">{insumo.quantidade_pacote != null ? Number(insumo.quantidade_pacote).toLocaleString() : '-'}</td>
                      {/* Coluna CB menor e com truncamento e centralizada */}
                      <td className="px-2 py-2 truncate max-w-[80px] text-center" title={insumo.codigo_barras}>{insumo.codigo_barras ? insumo.codigo_barras : '-'}</td>
                      <td className="px-2 py-2 text-right">{insumo.preco_pacote ? `R$ ${Number(insumo.preco_pacote).toFixed(2)}` : '-'}</td>
                      <td className="px-2 py-2 text-right">{insumo.preco_unitario != null ? `R$ ${formatPreco(insumo.preco_unitario)}` : '-'}</td>
                      <td className="px-2 py-2 text-right">{insumo.estoque_atual ?? 0}</td>
                      <td className="px-2 py-2 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(insumo)}
                          title={insumo.tipo_estoque === 'insumo' ? 'Editar Insumo' : 'Editar Varejo'}
                          aria-label={insumo.tipo_estoque === 'insumo' ? 'Editar Insumo' : 'Editar Varejo'}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-transparent hover:bg-gray-100 text-orange-600 focus:outline-none"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(insumo)}
                          title={insumo.tipo_estoque === 'insumo' ? 'Remover Insumo' : 'Remover Varejo'}
                          aria-label={insumo.tipo_estoque === 'insumo' ? 'Remover Insumo' : 'Remover Varejo'}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-transparent hover:bg-gray-100 text-red-600 focus:outline-none"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Insumo */}
        {activeModal === 'insumo' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                {editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm">Nome</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Categoria</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="insumo">Insumo</option>
                    <option value="embalagem">Embalagem</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm">Unidade</label>
                  <select
                    value={formData.unidade}
                    onChange={(e) => {
                      const unit = e.target.value
                      const newBase = unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit
                      setFormData({ ...formData, unidade: unit, unidade_medida_base: newBase })
                    }}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="un">un</option>
                    <option value="cx">cx</option>
                    <option value="pct">pct</option>
                  </select>
                </div>


                <div>
                  <label className="text-sm">Fornecedor</label>
                  <input
                    type="text"
                    value={formData.fornecedor}
                    onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Código de Barras</label>
                  <input
                    type="text"
                    value={formData.codigo_barras}
                    onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Estoque Atual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estoque_atual}
                    onChange={(e) => setFormData({ ...formData, estoque_atual: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Estoque Mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estoque_minimo}
                    onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Preço do Pacote</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.preco_pacote}
                    onChange={(e) => setFormData({ ...formData, preco_pacote: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Quantidade total do pacote</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.quantidade_pacote}
                    onChange={(e) => setFormData({ ...formData, quantidade_pacote: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Quantidade mínima (opcional)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.quantidade_minima}
                    onChange={(e) => setFormData({ ...formData, quantidade_minima: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Unidade do pacote</label>
                  <select
                    value={formData.unidade_medida_base}
                    onChange={(e) => setFormData({ ...formData, unidade_medida_base: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="un">un</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm">Preço unitário (real de uso)</label>
                  <input type="text" readOnly value={precoUnitarioCalculado ? `R$ ${formatPreco(precoUnitarioCalculado)}` : '-'} className="w-full px-3 py-2 border rounded-md bg-gray-50" />
                </div>

                <div>
                  <label className="text-sm">Peso do Pacote</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.peso_pacote}
                    onChange={(e) => setFormData({ ...formData, peso_pacote: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button type="submit" className="flex-1 bg-orange-600 text-white py-2 rounded-md">
                    {editingInsumo ? 'Atualizar' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal('none')}
                    className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-md"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Varejo */}
        {activeModal === 'varejo' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                {editingInsumo ? 'Editar Varejo' : 'Novo Varejo'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm">Nome</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Categoria</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="varejo">Varejo</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm">Unidade</label>
                  <select
                    value={formData.unidade}
                    onChange={(e) => {
                      const unit = e.target.value
                      const newBase = unit === 'kg' ? 'g' : unit === 'l' ? 'ml' : unit
                      setFormData({ ...formData, unidade: unit, unidade_medida_base: newBase })
                    }}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="un">un</option>
                    <option value="cx">cx</option>
                    <option value="pct">pct</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm">Fornecedor</label>
                  <input
                    type="text"
                    value={formData.fornecedor}
                    onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Código de Barras</label>
                  <input
                    type="text"
                    value={formData.codigo_barras}
                    onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Estoque Atual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estoque_atual}
                    onChange={(e) => setFormData({ ...formData, estoque_atual: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Estoque Mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estoque_minimo}
                    onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>


                <div>
                  <label className="text-sm">Preço do Pacote</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.preco_pacote}
                    onChange={(e) => setFormData({ ...formData, preco_pacote: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm">Quantidade total do pacote</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.quantidade_pacote}
                    onChange={(e) => setFormData({ ...formData, quantidade_pacote: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Quantidade mínima (opcional)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.quantidade_minima}
                    onChange={(e) => setFormData({ ...formData, quantidade_minima: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm">Unidade do pacote</label>
                  <select
                    value={formData.unidade_medida_base}
                    onChange={(e) => setFormData({ ...formData, unidade_medida_base: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="un">un</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm">Preço unitário (real de uso)</label>
                  <input type="text" readOnly value={precoUnitarioCalculado ? `R$ ${formatPreco(precoUnitarioCalculado)}` : '-'} className="w-full px-3 py-2 border rounded-md bg-gray-50" />
                </div>

                <div>
                  <label className="text-sm">Peso do Pacote</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.peso_pacote}
                    onChange={(e) => setFormData({ ...formData, peso_pacote: e.target.value })}
                    onFocus={handleNumberFocus}
                    onBlur={handleNumberBlur}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-md">
                    {editingInsumo ? 'Atualizar' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal('none')}
                    className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-md"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Confirm Delete */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-sm">
              <h2 className="text-lg font-bold mb-4">Confirmação</h2>
              <p className="mb-6">
                Tem certeza que deseja excluir o {confirmDelete.tipo_estoque === 'insumo' ? 'Insumo' : 'Item de Varejo'} <strong>{confirmDelete.nome}</strong>?
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 bg-red-600 text-white py-2 rounded-md"
                >
                  Excluir
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-md"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </ProtectedLayout>
  )
}