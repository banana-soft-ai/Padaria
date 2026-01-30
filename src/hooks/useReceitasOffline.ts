/**
 * Hook para gerenciar receitas com suporte offline
 * Funciona online e offline, sincronizando automaticamente
 */

import { useMemo } from 'react'
import { useOfflineData } from './useOfflineData'
import { supabase } from '@/lib/supabase/client'
import { Receita, ComposicaoReceita, Insumo } from '@/lib/supabase'
import { toReceita, toComposicaoReceita, toInsumo } from '@/lib/converters'

interface ReceitaFormData {
  nome: string
  rendimento: number
  unidade_rendimento: string
  categoria?: Receita['categoria']
  instrucoes?: string
  custosInvisiveis?: number
  ativo?: boolean
}

interface ComposicaoFormData {
  receita_id: number
  insumo_id: number
  quantidade: number
  categoria: 'massa' | 'cobertura' | 'embalagem'
}

interface ReceitaComComposicao extends Receita {
  composicao: (ComposicaoReceita & { insumo: Insumo })[]
  custo_total: number
  custo_por_rendimento: number
}

export function useReceitasOffline() {
  // Hook offline para receitas
  const {
    data: rawReceitas,
    loading: receitasLoading,
    error: receitasError,
    addItem: addReceitaItem,
    updateItem: updateReceitaItem,
    deleteItem: deleteReceitaItem,
    refresh: refreshReceitas,
    sync: syncReceitas,
    isOffline,
    pendingSync
  } = useOfflineData<Receita>({
    table: 'receitas',
    autoSync: true
  })

  // Hook offline para composição das receitas
  const {
    data: rawComposicoes,
    loading: composicoesLoading,
    error: composicoesError,
    addItem: addComposicaoItem,
    addMany: addComposicaoMany,
    updateItem: updateComposicaoItem,
    deleteItem: deleteComposicaoItem,
    refresh: refreshComposicoes,
    sync: syncComposicoes
  } = useOfflineData<ComposicaoReceita>({
    table: 'composicao_receitas',
    autoSync: true
  })

  // Hook offline para insumos (para calcular custos)
  const {
    data: rawInsumos,
    loading: insumosLoading,
    refresh: refreshInsumos
  } = useOfflineData<Insumo>({
    table: 'insumos',
    autoSync: true
  })

  // Normalizar dados vindos do storage (garante tipos e defaults)
  // useMemo evita referências novas a cada render (previne loop em useEffect que depende de receitas)
  const receitas = useMemo(
    () => (rawReceitas || []).map(toReceita).filter(r => (r as any).ativo !== false),
    [rawReceitas]
  )
  const composicoes = useMemo(
    () => (rawComposicoes || []).map(toComposicaoReceita),
    [rawComposicoes]
  )
  const insumos = useMemo(
    () => (rawInsumos || []).map(toInsumo),
    [rawInsumos]
  )

  // Composições com insumo enriquecido (para compatibilidade com useComposicoesFull)
  const composicoesComInsumo = useMemo(
    () => composicoes.map(c => ({
      ...c,
      insumo: insumos.find(i => i.id === c.insumo_id) || {} as Insumo
    })),
    [composicoes, insumos]
  )

  // Adicionar nova receita
  const adicionarReceita = async (formData: ReceitaFormData) => {
    try {
      const novaReceita: Omit<Receita, 'id'> = {
        nome: formData.nome,
        rendimento: formData.rendimento,
        unidade_rendimento: formData.unidade_rendimento,
        categoria: formData.categoria ?? 'outro',
        instrucoes: formData.instrucoes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await addReceitaItem(novaReceita)

      return {
        success: true,
        message: isOffline ? 'Receita salva offline' : 'Receita adicionada com sucesso'
      }
    } catch (error) {
      console.error('Erro ao adicionar receita:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao adicionar receita'
      }
    }
  }

  // Atualizar receita
  const atualizarReceita = async (id: number, updates: Partial<ReceitaFormData>) => {
    try {
      await updateReceitaItem(id, {
        ...updates,
        updated_at: new Date().toISOString()
      })

      return {
        success: true,
        message: isOffline ? 'Receita atualizada offline' : 'Receita atualizada com sucesso'
      }
    } catch (error) {
      console.error('Erro ao atualizar receita:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar receita'
      }
    }
  }

  // Remover receita (hard delete)
  const removerReceita = async (id: number) => {
    try {
      // Remover composições relacionadas primeiro
      const composicoesReceita = composicoes.filter(c => c.receita_id === id)
      for (const composicao of composicoesReceita) {
        await deleteComposicaoItem(composicao.id)
      }

      // Remover produtos que referenciam esta receita (apenas online)
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await supabase.from('produtos').delete().eq('receita_id', id)
        } catch (produtosError) {
          console.error('Erro ao remover produtos:', produtosError)
        }
      }

      await deleteReceitaItem(id)

      return {
        success: true,
        message: isOffline ? 'Receita removida offline' : 'Receita removida com sucesso'
      }
    } catch (error) {
      console.error('Erro ao remover receita:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover receita'
      }
    }
  }

  // API compatível com useReceitas/useComposicoes para migração da página
  const createReceita = async (dados: any) => {
    try {
      const { id: _omit, ...rest } = dados
      const created = await addReceitaItem(rest)
      return { data: created, error: null }
    } catch (e) {
      return { data: null, error: e }
    }
  }

  const updateReceita = async (id: number, dados: any) => {
    try {
      await updateReceitaItem(id, { ...dados, updated_at: new Date().toISOString() })
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }

  const softDeleteReceita = async (id: number) => {
    try {
      await updateReceitaItem(id, { ativo: false, updated_at: new Date().toISOString() })
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }

  const deleteByReceitaId = async (receitaId: number) => {
    try {
      const composicoesReceita = composicoes.filter(c => c.receita_id === receitaId)
      for (const comp of composicoesReceita) {
        await deleteComposicaoItem(comp.id)
      }
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }

  const insertMany = async (composicoesParaInserir: Array<{ receita_id: number; insumo_id: number; quantidade: number; categoria: string }>) => {
    try {
      const items = composicoesParaInserir.map(c => ({
        receita_id: c.receita_id,
        insumo_id: c.insumo_id,
        quantidade: c.quantidade,
        categoria: c.categoria as 'massa' | 'cobertura' | 'embalagem',
        created_at: new Date().toISOString()
      }))
      await addComposicaoMany(items)
      return { data: null, error: null }
    } catch (e) {
      return { data: null, error: e }
    }
  }

  const fetchReceitas = refreshReceitas
  const fetchInsumos = refreshInsumos

  // Adicionar insumo à receita
  const adicionarInsumoReceita = async (formData: ComposicaoFormData) => {
    try {
      const novaComposicao: Omit<ComposicaoReceita, 'id'> = {
        receita_id: formData.receita_id,
        insumo_id: formData.insumo_id,
        quantidade: formData.quantidade,
        categoria: formData.categoria,
        created_at: new Date().toISOString()
      }

      await addComposicaoItem(novaComposicao)

      return {
        success: true,
        message: isOffline ? 'Ingrediente adicionado offline' : 'Ingrediente adicionado com sucesso'
      }
    } catch (error) {
      console.error('Erro ao adicionar ingrediente:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao adicionar ingrediente'
      }
    }
  }

  // Remover insumo da receita
  const removerInsumoReceita = async (id: number) => {
    try {
      await deleteComposicaoItem(id)
      return {
        success: true,
        message: isOffline ? 'Ingrediente removido offline' : 'Ingrediente removido com sucesso'
      }
    } catch (error) {
      console.error('Erro ao remover ingrediente:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover ingrediente'
      }
    }
  }

  // Obter receitas com composição completa
  const getReceitasComComposicao = (): ReceitaComComposicao[] => {
    return receitas.map(receita => {
      const composicaoReceita = composicoes
        .filter(c => c.receita_id === receita.id)
        .map(composicao => {
          const insumo = insumos.find(i => i.id === composicao.insumo_id)
          return {
            ...composicao,
            insumo: insumo || {} as Insumo
          }
        })

      // Calcular custo total
      const custo_total = composicaoReceita.reduce((total, comp) => {
        if (comp.insumo) {
          const custo_unitario = comp.insumo.peso_pacote > 0 ? comp.insumo.preco_pacote / comp.insumo.peso_pacote : 0
          return total + (custo_unitario * comp.quantidade)
        }
        return total
      }, 0)

      const custo_por_rendimento = receita.rendimento > 0 ? custo_total / receita.rendimento : 0

      return {
        ...receita,
        composicao: composicaoReceita,
        custo_total,
        custo_por_rendimento
      }
    })
  }

  // Obter receita por ID com composição
  const getReceitaPorId = (id: number): ReceitaComComposicao | undefined => {
    return getReceitasComComposicao().find(r => r.id === id)
  }

  // Calcular custo de produção
  const calcularCustoProducao = (receitaId: number, quantidade: number) => {
    const receita = getReceitaPorId(receitaId)
    if (!receita) return 0

    const custoPorUnidade = receita.custo_por_rendimento
    return custoPorUnidade * quantidade
  }

  // Obter receitas por categoria de insumo
  const getReceitasPorCategoria = (categoria: 'massa' | 'cobertura' | 'embalagem') => {
    return getReceitasComComposicao().filter(receita =>
      receita.composicao.some(comp => comp.categoria === categoria)
    )
  }

  // Sincronizar todos os dados
  const sincronizarTodos = async () => {
    try {
      await Promise.all([
        syncReceitas(),
        syncComposicoes()
      ])
      return { success: true, message: 'Dados sincronizados com sucesso' }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro na sincronização'
      }
    }
  }

  // Obter estatísticas
  const getEstatisticas = () => {
    const receitasComComposicao = getReceitasComComposicao()

    return {
      totalReceitas: receitas.length,
      totalComposicoes: composicoes.length,
      receitasPorCategoria: {
        massa: getReceitasPorCategoria('massa').length,
        cobertura: getReceitasPorCategoria('cobertura').length,
        embalagem: getReceitasPorCategoria('embalagem').length
      },
      custoMedioReceita: receitasComComposicao.length > 0
        ? receitasComComposicao.reduce((total, r) => total + r.custo_total, 0) / receitasComComposicao.length
        : 0,
      isOffline,
      pendingSync
    }
  }

  return {
    // Dados (normalizados)
    receitas,
    receitasComComposicao: getReceitasComComposicao(),
    composicoes,
    composicoesComInsumo,
    insumos,

    // Estados
    loading: receitasLoading || composicoesLoading || insumosLoading,
    error: receitasError || composicoesError,
    isOffline,
    pendingSync,

    // Ações (API compatível com useReceitas/useComposicoes)
    createReceita,
    updateReceita,
    softDeleteReceita,
    deleteByReceitaId,
    insertMany,
    fetchReceitas,
    fetchInsumos,

    // Ações (API original do hook)
    adicionarReceita,
    atualizarReceita,
    removerReceita,
    adicionarInsumoReceita,
    removerInsumoReceita,
    sincronizarTodos,

    // Utilitários
    getReceitaPorId,
    calcularCustoProducao,
    getReceitasPorCategoria,
    getEstatisticas,
    refreshReceitas,
    refreshComposicoes,
    refreshInsumos
  }
}
