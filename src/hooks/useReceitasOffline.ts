/**
 * Hook para gerenciar receitas com suporte offline
 * Funciona online e offline, sincronizando automaticamente
 */

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
    addItem: addReceita,
    updateItem: updateReceita,
    deleteItem: deleteReceita,
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
    addItem: addComposicao,
    updateItem: updateComposicao,
    deleteItem: deleteComposicao,
    refresh: refreshComposicoes,
    sync: syncComposicoes
  } = useOfflineData<ComposicaoReceita>({
    table: 'composicao_receitas',
    autoSync: true
  })

  // Hook offline para insumos (para calcular custos)
  const {
    data: rawInsumos,
    loading: insumosLoading
  } = useOfflineData<Insumo>({
    table: 'insumos',
    autoSync: true
  })

  // Normalizar dados vindos do storage (garante tipos e defaults)
  const receitas = (rawReceitas || []).map(toReceita)
  const composicoes = (rawComposicoes || []).map(toComposicaoReceita)
  const insumos = (rawInsumos || []).map(toInsumo)

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

      await addReceita(novaReceita)

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
      await updateReceita(id, {
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

  // Remover receita
  const removerReceita = async (id: number) => {
    try {
      console.log(`🗑️ Hook: Iniciando exclusão da receita ${id}...`)

      // Remover composições relacionadas primeiro
      const composicoesReceita = composicoes.filter(c => c.receita_id === id)
      console.log(`🔄 Hook: Removendo ${composicoesReceita.length} composições...`)

      for (const composicao of composicoesReceita) {
        console.log(`🗑️ Hook: Removendo composição ${composicao.id}...`)
        await deleteComposicao(composicao.id)
      }
      console.log('✅ Hook: Composições removidas')

      // Remover produtos que referenciam esta receita
      console.log('🔄 Hook: Removendo produtos relacionados...')
      try {
        const { error: produtosError } = await supabase
          .from('produtos')
          .delete()
          .eq('receita_id', id)

        if (produtosError) {
          console.error('❌ Hook: Erro ao remover produtos:', produtosError)
        } else {
          console.log('✅ Hook: Produtos relacionados removidos')
        }
      } catch (produtosError) {
        console.error('❌ Hook: Erro ao remover produtos:', produtosError)
      }

      // Remover receita
      console.log('🔄 Hook: Removendo receita...')
      await deleteReceita(id)
      console.log('✅ Hook: Receita removida com sucesso')

      return {
        success: true,
        message: isOffline ? 'Receita removida offline' : 'Receita removida com sucesso'
      }
    } catch (error) {
      console.error('💥 Hook: Erro ao remover receita:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover receita'
      }
    }
  }

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

      await addComposicao(novaComposicao)

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
      await deleteComposicao(id)
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
    insumos,

    // Estados
    loading: receitasLoading || composicoesLoading || insumosLoading,
    error: receitasError || composicoesError,
    isOffline,
    pendingSync,

    // Ações
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
    refreshComposicoes
  }
}
