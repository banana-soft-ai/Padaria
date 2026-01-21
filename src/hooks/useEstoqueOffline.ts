/**
 * Hook para gerenciar estoque com suporte offline
 * Funciona online e offline, sincronizando automaticamente
 */

import { useOfflineData } from './useOfflineData'
import { Insumo, PrecoVenda } from '@/lib/supabase'
import { toInsumo, toPrecoVenda } from '@/lib/converters'

interface EstoqueFormData {
  nome: string
  marca?: string
  fornecedor?: string
  unidade: string
  peso_pacote: number
  preco_pacote: number
  categoria: 'insumo' | 'varejo' | 'embalagem'
  quantidade_estoque?: number
  estoque_minimo?: number
}

interface PrecoFormData {
  item_id: number
  tipo: 'receita' | 'varejo'
  preco_venda: number
  margem_lucro?: number
}

export function useEstoqueOffline() {
  // Hook offline para insumos
  const {
    data: rawInsumos,
    loading: insumosLoading,
    error: insumosError,
    addItem: addInsumo,
    updateItem: updateInsumo,
    deleteItem: deleteInsumo,
    refresh: refreshInsumos,
    sync: syncInsumos,
    isOffline,
    pendingSync
  } = useOfflineData<Insumo>({
    table: 'insumos',
    autoSync: true
  })

  // Hook offline para preços
  const {
    data: rawPrecos,
    loading: precosLoading,
    error: precosError,
    addItem: addPreco,
    updateItem: updatePreco,
    deleteItem: deletePreco,
    refresh: refreshPrecos,
    sync: syncPrecos
  } = useOfflineData<PrecoVenda>({
    table: 'preco_venda',
    autoSync: true
  })

  const insumos = (rawInsumos || []).map(toInsumo)
  const precos = (rawPrecos || []).map(toPrecoVenda)

  // Adicionar novo insumo
  const adicionarInsumo = async (formData: EstoqueFormData) => {
    try {
      const novoInsumo: Omit<Insumo, 'id'> = {
        nome: formData.nome,
        marca: formData.marca || '',
        fornecedor: formData.fornecedor || '',
        unidade: formData.unidade,
        peso_pacote: formData.peso_pacote,
        preco_pacote: formData.preco_pacote,
        categoria: formData.categoria,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        codigo_barras: '',
        tipo_estoque: 'insumo'
      }

      await addInsumo(novoInsumo)

      return {
        success: true,
        message: isOffline ? 'Insumo salvo offline' : 'Insumo adicionado com sucesso'
      }
    } catch (error) {
      console.error('Erro ao adicionar insumo:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao adicionar insumo'
      }
    }
  }

  // Atualizar insumo
  const atualizarInsumo = async (id: number, updates: Partial<EstoqueFormData>) => {
    try {
      await updateInsumo(id, {
        ...updates,
        updated_at: new Date().toISOString()
      })

      return {
        success: true,
        message: isOffline ? 'Insumo atualizado offline' : 'Insumo atualizado com sucesso'
      }
    } catch (error) {
      console.error('Erro ao atualizar insumo:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar insumo'
      }
    }
  }

  // Remover insumo
  const removerInsumo = async (id: number) => {
    try {
      await deleteInsumo(id)
      return {
        success: true,
        message: isOffline ? 'Insumo removido offline' : 'Insumo removido com sucesso'
      }
    } catch (error) {
      console.error('Erro ao remover insumo:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover insumo'
      }
    }
  }

  // Definir preço de venda
  const definirPreco = async (formData: PrecoFormData) => {
    try {
      // Verificar se já existe preço para este item
      const precoExistente = precos.find(p => p.item_id === formData.item_id && p.tipo === formData.tipo)

      const novoPreco: Omit<PrecoVenda, 'id'> = {
        item_id: formData.item_id,
        tipo: formData.tipo,
        preco_venda: formData.preco_venda,
        margem_lucro: formData.margem_lucro,
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (precoExistente) {
        await updatePreco(precoExistente.id, {
          preco_venda: formData.preco_venda,
          margem_lucro: formData.margem_lucro,
          updated_at: new Date().toISOString()
        })
      } else {
        await addPreco(novoPreco)
      }

      return {
        success: true,
        message: isOffline ? 'Preço definido offline' : 'Preço definido com sucesso'
      }
    } catch (error) {
      console.error('Erro ao definir preço:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao definir preço'
      }
    }
  }

  // Obter insumos por categoria
  const getInsumosPorCategoria = (categoria: 'insumo' | 'varejo' | 'embalagem') => {
    return insumos.filter(insumo => insumo.categoria === categoria)
  }

  // Obter insumos com estoque baixo
  const getInsumosEstoqueBaixo = () => {
    return insumos.filter(insumo => {
      // Aqui você pode adicionar lógica para verificar estoque baixo
      // Por enquanto, retorna todos os insumos
      return true
    })
  }

  // Obter preço de venda de um item
  const getPrecoVenda = (itemId: number, tipo: 'receita' | 'varejo') => {
    const preco = precos.find(p => p.item_id === itemId && p.tipo === tipo && p.ativo)
    return preco?.preco_venda || 0
  }

  // Calcular custo unitário
  const calcularCustoUnitario = (insumo: Insumo) => {
    return insumo.preco_pacote / insumo.peso_pacote
  }

  // Sincronizar todos os dados
  const sincronizarTodos = async () => {
    try {
      await Promise.all([
        syncInsumos(),
        syncPrecos()
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
    const totalInsumos = insumos.length
    const totalPrecos = precos.length
    const insumosPorCategoria = {
      insumo: getInsumosPorCategoria('insumo').length,
      varejo: getInsumosPorCategoria('varejo').length,
      embalagem: getInsumosPorCategoria('embalagem').length
    }

    return {
      totalInsumos,
      totalPrecos,
      insumosPorCategoria,
      isOffline,
      pendingSync
    }
  }

  return {
    // Dados
    insumos,
    precos,
    insumosPorCategoria: {
      insumo: getInsumosPorCategoria('insumo'),
      varejo: getInsumosPorCategoria('varejo'),
      embalagem: getInsumosPorCategoria('embalagem')
    },
    insumosEstoqueBaixo: getInsumosEstoqueBaixo(),

    // Estados
    loading: insumosLoading || precosLoading,
    error: insumosError || precosError,
    isOffline,
    pendingSync,

    // Ações
    adicionarInsumo,
    atualizarInsumo,
    removerInsumo,
    definirPreco,
    sincronizarTodos,

    // Utilitários
    getPrecoVenda,
    calcularCustoUnitario,
    getEstatisticas,
    refreshInsumos,
    refreshPrecos
  }
}
