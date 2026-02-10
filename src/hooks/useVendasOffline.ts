/**
 * Hook para gerenciar vendas com suporte offline
 * Exemplo de como integrar o sistema offline com funcionalidades existentes
 */

import { useOfflineData } from './useOfflineData'
import { Venda, ItemVenda, ClienteCaderneta } from '@/lib/supabase'
import { toVenda, toClienteCaderneta } from '@/lib/converters'
import { obterDataLocal } from '@/lib/dateUtils'

interface VendaFormData {
  forma_pagamento: 'pix' | 'debito' | 'credito' | 'dinheiro' | 'caderneta'
  cliente_caderneta_id?: number
  observacoes?: string
  itens: Array<{
    item_id: number
    tipo: 'receita' | 'varejo'
    quantidade: number
    preco_unitario: number
  }>
}

export function useVendasOffline() {
  // Usar o hook offline para vendas
  const {
    data: rawVendas,
    loading: vendasLoading,
    error: vendasError,
    addItem: addVenda,
    updateItem: updateVenda,
    deleteItem: deleteVenda,
    refresh: refreshVendas,
    sync: syncVendas,
    isOffline,
    pendingSync
  } = useOfflineData<Venda>({
    table: 'vendas',
    autoSync: true
  })

  // Usar o hook offline para clientes da caderneta
  const {
    data: rawClientes,
    loading: clientesLoading,
    error: clientesError,
    addItem: addCliente,
    updateItem: updateCliente,
    deleteItem: deleteCliente
  } = useOfflineData<ClienteCaderneta>({
    table: 'clientes_caderneta',
    autoSync: true
  })

  const vendas = (rawVendas || []).map(toVenda)
  const clientes = (rawClientes || []).map(toClienteCaderneta)

  // Criar nova venda
  const criarVenda = async (formData: VendaFormData) => {
    try {
      // Calcular totais
      const valorTotal = formData.itens.reduce(
        (total, item) => total + (item.quantidade * item.preco_unitario), 
        0
      )

      const valorPago = formData.forma_pagamento === 'caderneta' ? 0 : valorTotal
      const valorDebito = formData.forma_pagamento === 'caderneta' ? valorTotal : 0

      // Criar venda
      const novaVenda: Omit<Venda, 'id'> = {
        data: obterDataLocal(),
        hora: new Date().toTimeString().split(' ')[0],
        forma_pagamento: formData.forma_pagamento,
        cliente_caderneta_id: formData.cliente_caderneta_id,
        valor_total: valorTotal,
        valor_pago: valorPago,
        valor_debito: valorDebito,
        observacoes: formData.observacoes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Adicionar venda
      await addVenda(novaVenda)

      // Se for caderneta, atualizar saldo do cliente
      if (formData.forma_pagamento === 'caderneta' && formData.cliente_caderneta_id) {
        const cliente = clientes.find(c => c.id === formData.cliente_caderneta_id)
        if (cliente) {
          await updateCliente(formData.cliente_caderneta_id, {
            saldo_devedor: cliente.saldo_devedor + valorTotal
          })
        }
      }

      return { success: true, message: isOffline ? 'Venda salva offline' : 'Venda registrada com sucesso' }

    } catch (error) {
      console.error('Erro ao criar venda:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro ao registrar venda' 
      }
    }
  }

  // Obter vendas do dia
  const getVendasHoje = () => {
    const hoje = obterDataLocal()
    return vendas.filter(venda => venda.data === hoje)
  }

  // Obter vendas do mês
  const getVendasMes = () => {
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    
    return vendas.filter(venda => {
      const dataVenda = new Date(venda.data)
      return dataVenda >= inicioMes && dataVenda <= agora
    })
  }

  // Calcular totais
  const calcularTotais = () => {
    const vendasHoje = getVendasHoje()
    const vendasMes = getVendasMes()

    const totalHoje = vendasHoje.reduce((total, venda) => total + venda.valor_total, 0)
    const totalMes = vendasMes.reduce((total, venda) => total + venda.valor_total, 0)

    const ticketMedioHoje = vendasHoje.length > 0 ? totalHoje / vendasHoje.length : 0

    return {
      vendasHoje: vendasHoje.length,
      vendasMes: vendasMes.length,
      totalHoje,
      totalMes,
      ticketMedioHoje,
      totalItensHoje: vendasHoje.reduce((total, venda) => total + (venda.itens?.length || 0), 0)
    }
  }

  // Obter estatísticas de sincronização
  const getSyncStatus = () => {
    return {
      isOffline,
      pendingSync,
      totalVendas: vendas.length,
      lastSync: (() => {
        const timestamps = vendas
          .map(v => (v.updated_at ? new Date(v.updated_at).getTime() : undefined))
          .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))
        return timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null
      })()
    }
  }

  return {
    // Dados
    vendas,
    clientes,
    vendasHoje: getVendasHoje(),
    vendasMes: getVendasMes(),
    totais: calcularTotais(),
    
    // Estados
    loading: vendasLoading || clientesLoading,
    error: vendasError || clientesError,
    isOffline,
    pendingSync,
    
    // Ações
    criarVenda,
    updateVenda,
    deleteVenda,
    addCliente,
    updateCliente,
    deleteCliente,
    refreshVendas,
    syncVendas,
    
    // Utilitários
    getSyncStatus
  }
}
