'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import ProtectedLayout from '@/components/ProtectedLayout'
import PrecosTab from '@/components/gestao/PrecosTab'
import PrecoModal from '@/components/gestao/PrecoModal'
import { toast, Toaster } from 'react-hot-toast'
import { ItemPrecoVenda } from '@/types/gestao'
import { ReceitaSelect, InsumoSelect } from '@/types/selects'
import { calcularCustoSeguroFromComposicoes } from '@/lib/preco'

// tipo simples para itens de autocomplete (id + nome)
type SelectItem = { id: number; nome: string }

export default function PrecosPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [precosVenda, setPrecosVenda] = useState<ItemPrecoVenda[]>([])
  const [showPrecoModal, setShowPrecoModal] = useState(false)
  const [editingPreco, setEditingPreco] = useState<ItemPrecoVenda | null>(null)

  // Pesquisa/filtragem
  const [search, setSearch] = useState('')
  const [tabActive, setTabActive] = useState<'todos' | 'receita' | 'varejo'>('todos')

  // Estados para pesquisa dinâmica no modal
  const [termoPesquisa, setTermoPesquisa] = useState('')
  // Estado para controlar exibição das sugestões
  const [showSugestoes, setShowSugestoes] = useState(true)

  // <-- Ajuste: usamos um tipo genérico SelectItem[] aqui (compatível com ReceitaSelect/InsumoSelect)
  const [itensFiltrados, setItensFiltrados] = useState<SelectItem[]>([])
  const [receitas, setReceitas] = useState<ReceitaSelect[]>([])
  const [insumos, setInsumos] = useState<InsumoSelect[]>([])
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [loadingPesquisa, setLoadingPesquisa] = useState(false)

  // Estado para confirmação de remoção
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleteCandidateId, setDeleteCandidateId] = useState<number | null>(null)

  // Expandimos a forma do formData para incluir categoria, unidade e estoque
  const [formData, setFormData] = useState<{
    item_id: string
    tipo: 'receita' | 'varejo'
    preco_venda: string
    margem_lucro: string
    preco_custo_unitario: string
    nome_item: string
    categoria?: string
    unidade?: string
    estoque?: number
  }>({
    item_id: '',
    tipo: 'varejo',
    preco_venda: '',
    margem_lucro: '',
    preco_custo_unitario: '0.0000',
    nome_item: '', // armazena nome do item selecionado
    categoria: '',
    unidade: '',
    estoque: 0
  })

  // Normaliza um objeto de preço para o formato usado no estado
  function normalizePrecoForState(raw: any) {
    return {
      id: Number(raw?.id ?? Date.now()),
      tipo: raw?.tipo ?? (formData.tipo || 'varejo'),
      item_id: Number(raw?.item_id ?? raw?.itemId ?? 0),
      itemNome: raw?.item_nome ?? raw?.itemNome ?? raw?.nome_item ?? formData.nome_item ?? '',
      preco_venda: Number(raw?.preco_venda ?? raw?.precoVenda ?? 0) || 0,
      preco_custo_unitario: Number(raw?.preco_custo_unitario ?? raw?.precoCustoUnitario ?? raw?.preco_custo ?? 0) || 0,
      margem_lucro: Number(raw?.margem_lucro ?? raw?.margem ?? 0) || 0,
      categoria: raw?.categoria ?? '',
      unidade: raw?.unidade ?? '',
      estoque: Number(raw?.estoque ?? raw?.estoque_atual ?? 0) || 0,
      ativo: raw?.ativo ?? true,
      created_at: raw?.created_at ?? new Date().toISOString(),
      updated_at: raw?.updated_at ?? new Date().toISOString()
    } as ItemPrecoVenda
  }


  useEffect(() => {
    carregarDados()
  }, [])
  // Atualiza itensFiltrados ao mudar tipo do form
  useEffect(() => {
    if (formData.tipo === 'receita') {
      // receitas tem formato compatível com SelectItem (id, nome)
      setItensFiltrados(receitas.map(r => ({ id: r.id, nome: r.nome })))
    } else if (formData.tipo === 'varejo') {
      setItensFiltrados(insumos.map(i => ({ id: i.id, nome: i.nome })))
    } else {
      setItensFiltrados([])
    }
  }, [formData.tipo, receitas, insumos])

  // --- STUBS para handlers e funções ausentes ---
  function carregarDados() {
    // Busca os preços salvos no banco Supabase e enriquece com o nome do item
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        if (!supabase) throw new Error('Supabase não configurado')
        const { data, error } = await supabase
          .from('precos_venda')
          .select('*')
          .eq('ativo', true)
          .order('updated_at', { ascending: false })
        if (error) throw error

        const enriched = await Promise.all((data || []).map(async (row: any) => {
          let nome = row.item_nome || ''
          if (!nome) {
            try {
              if (row.tipo === 'receita') {
                const { data: r } = await supabase.from('receitas').select('nome').eq('id', row.item_id).single()
                nome = r?.nome ?? nome
              } else if (row.tipo === 'varejo') {
                const { data: v } = await supabase.from('varejo').select('nome').eq('id', row.item_id).single()
                nome = v?.nome ?? nome
              }
            } catch (e) {
              // falha ao buscar nome do item — ignorar e usar fallback
            }
          }
          return normalizePrecoForState({ ...row, item_nome: nome })
        }))

        setPrecosVenda(enriched)
      } catch (err) {
        setError('Erro ao carregar preços do banco.')
        setPrecosVenda([])
      } finally {
        setLoading(false)
      }
    })()
  }

  function handleShowPrecoModal() {
    setEditingPreco(null)
    setShowPrecoModal(true)
  }

  function handleEditPreco(preco: ItemPrecoVenda) {
    // Preenche o formData com os dados do item selecionado para edição
    setEditingPreco(preco)
    setFormData({
      item_id: String(preco.item_id),
      tipo: preco.tipo,
      preco_venda: preco.preco_venda ? String(preco.preco_venda) : '',
      margem_lucro: preco.margem_lucro ? String(preco.margem_lucro) : '',
      preco_custo_unitario: preco.preco_custo_unitario ? String(preco.preco_custo_unitario) : '0.0000',
      nome_item: preco.itemNome || '',
      categoria: preco.categoria || '',
      unidade: preco.unidade || '',
      estoque: preco.estoque || 0
    })
    setShowPrecoModal(true)
  }

  function handleDeletePreco(id: number) {
    // Soft delete: marca como inativo no banco
    // Abre modal de confirmação
    setDeleteCandidateId(id)
    setShowConfirmDelete(true)
  }

  async function confirmDeletePreco() {
    const id = deleteCandidateId
    setShowConfirmDelete(false)
    setDeleteCandidateId(null)
    if (!id) return
    try {
      if (!supabase) throw new Error('Supabase não configurado')
      const { error } = await supabase
        .from('precos_venda')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      // Remove localmente
      setPrecosVenda(prev => prev.filter(p => p.id !== id))
      toast.success('Item removido com sucesso')
    } catch (err) {
      console.error('Erro ao remover preço:', err)
      toast.error('Não foi possível remover o item')
      }
    }

  function handleFormChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmitPreco() {
    // Validação mínima
    if (!formData.item_id) {
      setError('Selecione um item antes de salvar.')
      return
    }
    // preparar dados para persistir
    const precoVendaNum = parseFloat(formData.preco_venda || '0')
    const custoNum = parseFloat(formData.preco_custo_unitario || '0')
    const margemNum = (!isNaN(precoVendaNum) && precoVendaNum > 0) ? ((precoVendaNum - custoNum) / precoVendaNum) * 100 : (parseFloat(formData.margem_lucro || '0') || 0)

    // Adiciona preco_custo_unitario ao payload para persistir o custo unitário
    const payload = {
      tipo: formData.tipo,
      item_id: Number(formData.item_id),
      preco_venda: isNaN(precoVendaNum) ? 0 : precoVendaNum,
      preco_custo_unitario: isNaN(custoNum) ? 0 : custoNum,
      ativo: true,
      updated_at: new Date().toISOString()
    }

    // Se estiver editando, faz UPDATE, senão faz INSERT
    try {
      if (!supabase) {
        throw new Error('Supabase não está configurado. Verifique as variáveis de ambiente.')
      }
      let salvo: ItemPrecoVenda
      if (editingPreco && editingPreco.id) {
        // UPDATE no registro existente
        const { data, error } = await supabase
          .from('precos_venda')
          .update(payload)
          .eq('id', editingPreco.id)
          .select('*')
          .single()
        if (error) throw error
        salvo = normalizePrecoForState(data)
        // Atualiza o item no estado local
        setPrecosVenda(prev => prev.map(p => p.id === salvo.id ? salvo : p))
      } else {
        // INSERT novo registro
        const payloadInsert = {
          ...payload,
          created_at: new Date().toISOString()
        }
        const { data, error } = await supabase
          .from('precos_venda')
          .insert([payloadInsert])
          .select('*')
          .single()
        if (error) throw error
        salvo = normalizePrecoForState(data)
        setPrecosVenda(prev => [salvo, ...prev])
      }
      setShowPrecoModal(false)
      setEditingPreco(null)
      setFormData({
        item_id: '',
        tipo: 'varejo',
        preco_venda: '',
        margem_lucro: '',
        preco_custo_unitario: '0.0000',
        nome_item: '',
        categoria: '',
        unidade: '',
        estoque: 0
      })
      setError(null)
    } catch (err: any) {
      // Log mais detalhado e defensivo do erro para facilitar debug (RLS/auth/validation)
      try {
        const asJson = typeof err === 'object' ? JSON.stringify(err) : String(err)
        console.error('Erro ao salvar no Supabase, adicionando localmente:', asJson)
      } catch (logErr) {
        console.error('Erro ao salvar no Supabase (não serializável):', err)
      }

      const errMsg = err?.message || err?.msg || err?.error || (typeof err === 'string' ? err : 'Erro desconhecido no servidor')
      setError(`Não foi possível salvar no servidor — salvando localmente. (${errMsg})`)

      const novo = normalizePrecoForState({
        id: editingPreco?.id || Date.now(),
        tipo: formData.tipo,
        item_id: Number(formData.item_id),
        item_nome: formData.nome_item || '',
        preco_venda: formData.preco_venda || '0',
        preco_custo_unitario: formData.preco_custo_unitario || '0',
        margem_lucro: formData.margem_lucro || '',
        categoria: formData.categoria ?? '',
        unidade: formData.unidade ?? '',
        estoque: formData.estoque ?? 0
      })
      // Atualiza localmente se for edição
      if (editingPreco && editingPreco.id) {
        setPrecosVenda(prev => prev.map(p => p.id === novo.id ? novo : p))
      } else {
        setPrecosVenda(prev => [novo, ...prev])
      }
      setShowPrecoModal(false)
      setEditingPreco(null)
      setFormData({
        item_id: '',
        tipo: 'varejo',
        preco_venda: '',
        margem_lucro: '',
        preco_custo_unitario: '0.0000',
        nome_item: '',
        categoria: '',
        unidade: '',
        estoque: 0
      })
    }
  }

  function handleTermoChange(termo: string) {
    // atualiza termo localmente
    setTermoPesquisa(termo)
    setShowSugestoes(true)

    // se termo vazio, limpa/mostra lista atual conforme tipo
    if (!termo || termo.trim() === '') {
      if (formData.tipo === 'receita') {
        setItensFiltrados(receitas.map(r => ({ id: r.id, nome: r.nome })))
      } else if (formData.tipo === 'varejo') {
        setItensFiltrados(insumos.map(i => ({ id: i.id, nome: i.nome })))
      }
      return
    }

    // busca dinâmica no Supabase conforme tipo
    ; (async () => {
      if (!supabase) {
        setError('Supabase não configurado')
        return
      }

      setLoadingPesquisa(true)
      try {
        // Para autocomplete buscamos apenas `id` e `nome` (limite 50)
        if (formData.tipo === 'receita') {
          const { data, error } = await supabase
            .from('receitas')
            .select('id, nome')
            .eq('ativo', true)
            .ilike('nome', `%${termo}%`)
            .order('nome', { ascending: true })
            .limit(50)

          if (error) throw error
          const receitas: ReceitaSelect[] = (data || []).map((r: any) => ({
            id: r.id,
            nome: r.nome
          }))
          setReceitas(receitas)
          setItensFiltrados(receitas.map(r => ({ id: r.id, nome: r.nome })))
        } else {
          const { data, error } = await supabase
            .from('varejo')
            .select('id, nome')
            .ilike('nome', `%${termo}%`)
            .order('nome', { ascending: true })
            .limit(50)

          if (error) throw error
          const insumos: InsumoSelect[] = (data || []).map((r: any) => ({
            id: r.id,
            nome: r.nome
          }))
          setInsumos(insumos)
          setItensFiltrados(insumos.map(i => ({ id: i.id, nome: i.nome })))
        }
      } catch (err) {
        console.error('Erro na busca por termo:', err)
        setError('Erro ao buscar itens. Tente novamente.')
      } finally {
        setLoadingPesquisa(false)
      }
    })()
  }

  // Seleciona um item vindo do modal/lista e busca detalhes conforme o tipo
  // aceita `tipo` opcional; se não informado usa `formData.tipo`
  async function handleSelecionarItem(_item: ReceitaSelect | InsumoSelect, tipoArg?: 'receita' | 'varejo') {
    const tipo = tipoArg || formData.tipo;
    const itemId = _item.id;
    const itemNome = _item.nome;


    // atualiza item_id e nome imediatamente para feedback UX
    setFormData(prev => ({ ...prev, item_id: String(itemId), nome_item: itemNome }));

    // Corrige: mantém o termo de busca igual ao nome do item selecionado
    setTermoPesquisa(itemNome);

    // Corrige: garante que o item selecionado está presente em itensFiltrados
    setItensFiltrados(prev => {
      // Se já existe, mantém; senão, adiciona
      if (prev.some(i => i.id === itemId)) return prev;
      return [{ id: itemId, nome: itemNome }, ...prev];
    });

    // FECHA sugestões após selecionar
    setShowSugestoes(false);

    // buscar e preencher demais campos (nome, custo, preco_venda)
    try {
      setLoadingDetalhes(true);
      await buscarDetalhesItem(itemId, tipo);
      setError(null);
    } catch (err) {
      console.error('Erro ao selecionar item:', err);
      setError('Erro ao carregar detalhes do item selecionado.');
    } finally {
      setLoadingDetalhes(false);
    }
  }

  // Função antiga `calcularCustoReceita` removida. Usamos `calcularCustoSeguroFromComposicoes` diretamente em `buscarDetalhesItem`.
  async function buscarDetalhesItem(itemId: number, tipo: 'receita' | 'varejo') {
    if (!supabase) {
      setError('Configuração do Supabase ausente. Verifique as variáveis de ambiente.')
      return
    }

    setLoadingDetalhes(true)
    setError(null) // Limpar erros anteriores

    try {
      let dadosItem: any = null

      if (tipo === 'receita') {
        // Buscar dados essenciais da receita
        const { data, error } = await supabase
          .from('receitas')
          .select('id, nome, preco_venda, rendimento, unidade_rendimento, categoria')
          .eq('id', itemId)
          .eq('ativo', true)
          .single()

        if (error) throw error
        dadosItem = data

        // Para receitas: buscar composição e calcular custos de forma segura
        const { data: composicaoData, error: compError } = await supabase
          .from('composicao_receitas')
          .select('quantidade, categoria, insumo:insumos(id, nome, preco_pacote, peso_pacote, estoque_atual)')
          .eq('receita_id', itemId)

        if (compError) throw compError

        const composicoesMapped = (composicaoData || []).map((it: any) => ({
          quantidade: Number(it.quantidade ?? 0),
          categoria: it.categoria,
          insumo: it.insumo || it.insumos || null
        }))

        const { custoTotal, custoUnitario } = calcularCustoSeguroFromComposicoes({
          composicoes: composicoesMapped,
          rendimento: Number(dadosItem?.rendimento)
        })

        setFormData(prev => ({
          ...prev,
          item_id: String(itemId),
          nome_item: dadosItem?.nome ?? prev.nome_item ?? '',
          preco_custo_unitario: custoUnitario > 0 ? custoUnitario.toFixed(4) : '0.0000',
          preco_venda: dadosItem?.preco_venda != null ? String(dadosItem?.preco_venda) : prev.preco_venda,
          categoria: dadosItem?.categoria ?? prev.categoria ?? '',
          unidade: dadosItem?.unidade_rendimento ?? prev.unidade ?? ''
        }))

      } else if (tipo === 'varejo') {
        // Buscar dados essenciais do produto de varejo
        const { data, error } = await supabase
          .from('varejo')
          .select('id, nome, preco_venda, unidade, categoria, estoque_atual, codigo_barras')
          .eq('id', itemId)
          .single()

        if (error) throw error
        dadosItem = data

        let custoUnitario = 0
        try {
          // 1. Tentar localizar receita vinculada via produtos (por código de barras ou nome do produto)
          let receitaId: number | null = null
          let produtoLink: any = null
          if (dadosItem?.codigo_barras) {
            const { data: prodData } = await supabase
              .from('produtos')
              .select('id, receita_id, peso_unitario, rendimento')
              .eq('codigo_barras', dadosItem.codigo_barras)
              .limit(1)
              .maybeSingle()
            produtoLink = prodData
          }
          if (!produtoLink) {
            const { data: prodByName } = await supabase
              .from('produtos')
              .select('id, receita_id, peso_unitario, rendimento')
              .ilike('nome', dadosItem?.nome ?? '')
              .limit(1)
              .maybeSingle()
            produtoLink = prodByName
          }
          if (produtoLink && produtoLink?.receita_id) {
            receitaId = Number(produtoLink.receita_id)
          }

          // 2. Se encontrou receita vinculada (via produtos) ou por nome, buscar dados e composição da receita
          let composicoesMapped: any[] = []
          let receitaData: any = null

          if (!receitaId) {
            const { data: foundReceita } = await supabase
              .from('receitas')
              .select('id')
              .ilike('nome', dadosItem?.nome ?? '')
              .limit(1)
              .maybeSingle()
            if (foundReceita && foundReceita.id) receitaId = Number(foundReceita.id)
          }

          if (receitaId) {
            const { data: rData, error: rErr } = await supabase
              .from('receitas')
              .select('id, nome, rendimento, unidade_rendimento, categoria')
              .eq('id', receitaId)
              .maybeSingle()
            if (rErr) throw rErr
            receitaData = rData

            const { data: compData, error: compErr } = await supabase
              .from('composicao_receitas')
              .select('quantidade, categoria, insumo:insumos(id, nome, preco_pacote, peso_pacote)')
              .eq('receita_id', receitaId)
            if (compErr) throw compErr
            composicoesMapped = (compData || []).map((it: any) => ({
              quantidade: Number(it.quantidade ?? 0),
              categoria: it.categoria,
              insumo: it.insumo || it.insumos || null
            }))

            // 3a. Se temos composição da receita, usar mesmo fluxo de `receita` para calcular custo unitário
            if (composicoesMapped.length > 0) {
              const { custoTotal, custoUnitario: custoUnitarioReceita } = calcularCustoSeguroFromComposicoes({ composicoes: composicoesMapped, rendimento: Number(receitaData?.rendimento) })
              custoUnitario = Number(custoUnitarioReceita) || 0
            }
          }

          // 3b. Se não obteve custo via receita, tentar fallback para cálculo direto (pode usar peso/pacote)
          if (!custoUnitario || custoUnitario === 0) {
            // Fallback: usar preco_custo_unitario do próprio registro `varejo` quando disponível
            custoUnitario = Number((dadosItem as any)?.preco_custo_unitario ?? 0) || 0
          }
        } catch (e) {
          console.warn('Não foi possível determinar custo automático para varejo:', e)
        }

        setFormData(prev => ({
          ...prev,
          item_id: String(itemId),
          nome_item: dadosItem?.nome ?? '',
          preco_custo_unitario: custoUnitario > 0 ? custoUnitario.toFixed(4) : (prev.preco_custo_unitario || '0.0000'),
          preco_venda: dadosItem?.preco_venda != null ? String(dadosItem?.preco_venda) : prev.preco_venda,
          categoria: dadosItem?.categoria ?? prev.categoria ?? '',
          unidade: dadosItem?.unidade ?? prev.unidade ?? '',
          estoque: (dadosItem?.estoque_atual ?? prev.estoque ?? 0)
        }))
      }

      // Feedback visual de sucesso
      console.log('✅ Item selecionado:', dadosItem?.nome || 'Nome não encontrado')

    } catch (error) {
      console.error('Erro ao buscar detalhes do item:', error)
      setError('Erro ao carregar detalhes do item selecionado.')
    } finally {
      setLoadingDetalhes(false)
    }
  }

  function handleMostrarTodos() {
    // Busca as primeiras 50 sugestões do tipo selecionado para autocomplete
    setTermoPesquisa('')
      ; (async () => {
        if (!supabase) return
        setLoadingPesquisa(true)
        try {
          if (formData.tipo === 'receita') {
            const { data, error } = await supabase
              .from('receitas')
              .select('id, nome')
              .eq('ativo', true)
              .order('nome', { ascending: true })
              .limit(50)
            if (!error) {
              setReceitas(data || [])
              setItensFiltrados((data || []).map((r: any) => ({ id: r.id, nome: r.nome })))
            }
          } else if (formData.tipo === 'varejo') {
            const { data, error } = await supabase
              .from('varejo')
              .select('id, nome')
              .order('nome', { ascending: true })
              .limit(50)
            if (!error) {
              setInsumos(data || [])
              setItensFiltrados((data || []).map((r: any) => ({ id: r.id, nome: r.nome })))
            }
          }
        } catch (e) {
          console.error('Erro ao buscar sugestões:', e)
        } finally {
          setLoadingPesquisa(false)
        }
      })()
  }

  // Funções utilitárias para métricas
  function calcularMargemMedia(precosVenda: ItemPrecoVenda[]) {
    const valid = precosVenda.filter(i => Number(i.preco_venda) > 0)
    if (!valid.length) return '0%'
    const soma = valid.reduce(
      (acc, item) => acc + (((Number(item.preco_venda) - Number(item.preco_custo_unitario)) / Number(item.preco_venda)) || 0), 0)
    return (soma / valid.length * 100).toFixed(1) + '%'
  }

  function calcularItensComAlerta(precosVenda: ItemPrecoVenda[]) {
    // Exemplo: itens com margem abaixo de 10%
    return precosVenda.filter(item => {
      const venda = Number(item.preco_venda)
      const custo = Number(item.preco_custo_unitario)
      return venda > 0 && (venda - custo) / venda < 0.10
    }).length
  }

  function getFilteredPrecos() {
    let filtered = [...precosVenda]
    if (tabActive !== 'todos') {
      filtered = filtered.filter(i => i.tipo === tabActive)
    }
    if (search.trim() !== '') {
      filtered = filtered.filter(item =>
        (item.itemNome || '').toLowerCase().includes(search.toLowerCase())
      )
    }
    return filtered
  }

  // Aplica preços no estoque: atualiza tabelas `varejo` e `receitas` conforme tipo
  async function aplicarPrecosNoEstoque(precos: ItemPrecoVenda[]) {
    if (!supabase) {
      setError('Supabase não configurado')
      return
    }

    let successCount = 0
    let failCount = 0

    for (const p of precos) {
      const precoNum = parseFloat(String(p.preco_venda || '0'))
      if (isNaN(precoNum)) {
        failCount++
        continue
      }

      try {
        if (p.tipo === 'varejo') {
          await supabase.from('varejo').update({ preco_venda: precoNum, updated_at: new Date().toISOString() }).eq('id', p.item_id)
        } else if (p.tipo === 'receita') {
          await supabase.from('receitas').update({ preco_venda: precoNum, updated_at: new Date().toISOString() }).eq('id', p.item_id)
        }
        successCount++
      } catch (err) {
        console.error('Erro ao aplicar preço para item', p.item_id, err)
        failCount++
      }
    }

    if (failCount === 0) {
      // atualiza UI local (opcional) e feedback
      setError(null)
      console.log(`Aplicados ${successCount} preços no estoque`)
    } else {
      setError(`${successCount} aplicados com sucesso, ${failCount} falharam`)
    }
  }

  // ...coloque suas funções handlers e Supabase...

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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              {/* Ícone do Figma (exemplo: Chart) */}
              <svg className="h-5 w-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17v3h3M21 7V4h-3M4 4l16 16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12V7A2 2 0 017 5h10a2 2 0 012 2v10a2 2 0 01-2 2H12" />
              </svg>
              <h1 className="text-lg font-bold text-gray-900">Gestão de Preços</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">Controle suas margens e lucratividade</p>
          </div>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold shadow hover:bg-violet-700 transition"
            onClick={handleShowPrecoModal}
          >
            + Novo Preço
          </button>
        </div>

        {/* Cards Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Total */}
          <div className="bg-white p-4 rounded-lg flex items-center gap-4 shadow border">
            <div className="bg-sky-100 p-2 rounded-lg">
              <svg className="h-6 w-6 text-sky-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth={2} />
              </svg>
            </div>
            <div>
              <div className="text-xs text-gray-600">Total de Itens</div>
              <div className="font-bold text-lg">{precosVenda.length}</div>
            </div>
          </div>
          {/* Margem Média */}
          <div className="bg-white p-4 rounded-lg flex items-center gap-4 shadow border">
            <div className="bg-green-100 p-2 rounded-lg">
              <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 17l7-7 5 5 4-4" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-gray-600">Margem Média</div>
              <div className="font-bold text-lg">{calcularMargemMedia(precosVenda)}</div>
            </div>
          </div>
          {/* Alerta */}
          <div className="bg-white p-4 rounded-lg flex items-center gap-4 shadow border">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <svg className="h-6 w-6 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-gray-600">Itens com Alerta</div>
              <div className="font-bold text-lg">{calcularItensComAlerta(precosVenda)}</div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            placeholder="Pesquisar itens configurados..."
            className="flex-1 px-3 py-2 rounded border border-gray-200 bg-gray-50"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-1 mt-2 sm:mt-0">
            <button
              className={`px-3 py-1 rounded text-xs font-semibold ${tabActive === 'todos' ? 'bg-violet-100 text-violet-700' : 'bg-gray-50 text-gray-600'}`}
              onClick={() => setTabActive('todos')}
            >
              Todos
            </button>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold ${tabActive === 'receita' ? 'bg-violet-100 text-violet-700' : 'bg-gray-50 text-gray-600'}`}
              onClick={() => setTabActive('receita')}
            >
              Receitas
            </button>
            <button
              className={`px-3 py-1 rounded text-xs font-semibold ${tabActive === 'varejo' ? 'bg-violet-100 text-violet-700' : 'bg-gray-50 text-gray-600'}`}
              onClick={() => setTabActive('varejo')}
            >
              Varejo
            </button>
          </div>
        </div>

        {/* Erro se houver */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Erro ao carregar dados</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={carregarDados}
              className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Conteúdo */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-0 sm:p-6">
            <PrecosTab
              precosVenda={getFilteredPrecos()}
              onShowModal={handleShowPrecoModal}
              onEditPreco={handleEditPreco}
              onDeletePreco={handleDeletePreco}
              onAplicarPrecos={aplicarPrecosNoEstoque}
            />
          </div>
        </div>

        {/* Modal */}
        {showPrecoModal && (
          <PrecoModal
            isOpen={showPrecoModal}
            onClose={() => setShowPrecoModal(false)}
            editingPreco={editingPreco}
            formData={formData}
            onFormChange={handleFormChange}
            onSubmit={async (e) => {
              e.preventDefault()
              await handleSubmitPreco()
            }}
            termoPesquisa={termoPesquisa}
            onTermoChange={handleTermoChange}
            // <-- Cast para qualquer para evitar incompatibilidade de tipos entre Select vs full models
            itensFiltrados={itensFiltrados as any}
            onSelecionarItem={handleSelecionarItem}
            onMostrarTodos={handleMostrarTodos}
            loadingDetalhes={loadingDetalhes}
            loadingPesquisa={loadingPesquisa}
            showSugestoes={showSugestoes}
          />
        )}

        {/* Modal de confirmação de remoção */}
        {showConfirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Confirmar remoção</h3>
              <p className="text-sm text-gray-600 mb-6">Tem certeza que deseja remover este item? Esta ação pode ser revertida apenas reativando o registro.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowConfirmDelete(false); setDeleteCandidateId(null) }}
                  className="px-4 py-2 rounded border border-gray-300 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeletePreco}
                  className="px-4 py-2 rounded bg-red-600 text-white text-sm"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toaster para toasts de feedback */}
        <Toaster />
      </div>
    </ProtectedLayout>
  )
}