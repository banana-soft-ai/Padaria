/**
 * Hook para gerenciar caderneta com suporte offline
 * Funciona online e offline, sincronizando automaticamente
 */

import { useOfflineData } from './useOfflineData'
import { supabase } from '@/lib/supabase/client'
import { ClienteCaderneta, MovimentacaoCaderneta, Venda } from '@/lib/supabase'

interface ClienteFormData {
  nome: string
  telefone?: string
  endereco?: string
  limite_credito: number
  observacoes?: string
}

interface MovimentacaoFormData {
  cliente_id: number
  tipo: 'compra' | 'pagamento'
  valor: number
  observacoes?: string
  venda_id?: number
}

interface ClienteComMovimentacoes extends ClienteCaderneta {
  movimentacoes: MovimentacaoCaderneta[]
  saldo_atual: number
  ultima_compra?: string
  ultimo_pagamento?: string
}

export function useCadernetaOffline() {
  // Hook offline para clientes da caderneta
  const {
    data: clientes,
    loading: clientesLoading,
    error: clientesError,
    addItem: addCliente,
    updateItem: updateCliente,
    deleteItem: deleteCliente,
    refresh: refreshClientes,
    sync: syncClientes,
    isOffline,
    pendingSync
  } = useOfflineData<ClienteCaderneta>({
    table: 'clientes_caderneta',
    autoSync: true
  })

  // Hook offline para movimentações
  const {
    data: movimentacoes,
    loading: movimentacoesLoading,
    error: movimentacoesError,
    addItem: addMovimentacao,
    updateItem: updateMovimentacao,
    deleteItem: deleteMovimentacao,
    refresh: refreshMovimentacoes,
    sync: syncMovimentacoes
  } = useOfflineData<MovimentacaoCaderneta>({
    table: 'movimentacoes_caderneta',
    autoSync: true
  })

  // Hook offline para vendas (para relacionar com movimentações)
  const {
    data: vendas,
    loading: vendasLoading
  } = useOfflineData<Venda>({
    table: 'vendas',
    autoSync: true
  })

  // Adicionar novo cliente (pode ser 'cliente' ou 'colaborador')
  const adicionarCliente = async (formData: ClienteFormData, tipo: 'cliente' | 'colaborador' = 'cliente') => {
    try {
      const novoCliente: Omit<ClienteCaderneta, 'id'> = {
        nome: formData.nome,
        telefone: formData.telefone || '',
        endereco: formData.endereco || '',
        limite_credito: formData.limite_credito,
        saldo_devedor: 0,
        ativo: true,
        observacoes: formData.observacoes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tipo
      }

      await addCliente(novoCliente)

      return {
        success: true,
        message: isOffline ? 'Registro salvo offline' : 'Registro adicionado com sucesso'
      }
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao adicionar cliente'
      }
    }
  }

  // Atualizar cliente
  const atualizarCliente = async (id: number, updates: Partial<ClienteFormData>) => {
    try {
      await updateCliente(id, {
        ...updates,
        updated_at: new Date().toISOString()
      })

      return {
        success: true,
        message: isOffline ? 'Cliente atualizado offline' : 'Cliente atualizado com sucesso'
      }
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao atualizar cliente'
      }
    }
  }

  // Remover cliente
  const removerCliente = async (id: number) => {
    try {
      // Verificar se cliente tem movimentações
      const movimentacoesCliente = movimentacoes.filter(m => m.cliente_id === id)
      if (movimentacoesCliente.length > 0) {
        return {
          success: false,
          message: 'Não é possível remover cliente com movimentações. Desative-o em vez disso.'
        }
      }

      await deleteCliente(id)

      return {
        success: true,
        message: isOffline ? 'Cliente removido offline' : 'Cliente removido com sucesso'
      }
    } catch (error) {
      console.error('Erro ao remover cliente:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao remover cliente'
      }
    }
  }

  // Ativar/Desativar cliente
  const toggleClienteAtivo = async (id: number) => {
    try {
      const cliente = clientes.find(c => c.id === id)
      if (!cliente) {
        return { success: false, message: 'Cliente não encontrado' }
      }

      await updateCliente(id, {
        ativo: !cliente.ativo,
        updated_at: new Date().toISOString()
      })

      return {
        success: true,
        message: `Cliente ${cliente.ativo ? 'desativado' : 'ativado'} com sucesso`
      }
    } catch (error) {
      console.error('Erro ao alterar status do cliente:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao alterar status'
      }
    }
  }

  // Adicionar movimentação
  const adicionarMovimentacao = async (formData: MovimentacaoFormData) => {
    try {
      const cliente = clientes.find(c => c.id === formData.cliente_id)
      if (!cliente) {
        return { success: false, message: 'Cliente não encontrado' }
      }

      const saldoAnterior = cliente.saldo_devedor
      const novoSaldo = formData.tipo === 'compra'
        ? saldoAnterior + formData.valor
        : saldoAnterior - formData.valor

      // Verificar limite de crédito
      if (novoSaldo > cliente.limite_credito) {
        return {
          success: false,
          message: `Valor excede limite de crédito (R$ ${cliente.limite_credito})`
        }
      }

      const novaMovimentacao: Omit<MovimentacaoCaderneta, 'id'> = {
        cliente_id: formData.cliente_id,
        tipo: formData.tipo,
        valor: formData.valor,
        saldo_anterior: saldoAnterior,
        saldo_atual: novoSaldo,
        venda_id: formData.venda_id,
        created_at: new Date().toISOString()
      }

      // Adicionar movimentação
      await addMovimentacao(novaMovimentacao)

      // Atualizar saldo do cliente
      await updateCliente(formData.cliente_id, {
        saldo_devedor: novoSaldo,
        updated_at: new Date().toISOString()
      })

      return {
        success: true,
        message: isOffline ? 'Movimentação salva offline' : 'Movimentação registrada com sucesso'
      }
    } catch (error) {
      console.error('Erro ao adicionar movimentação:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao registrar movimentação'
      }
    }
  }

  // Registrar pagamento (atualiza caderneta e, quando online, registra entrada no caixa)
  const registrarPagamento = async (clienteId: number, valor: number, observacoes?: string, opts?: { data_pagamento?: string, forma_pagamento?: string }) => {
    const result = await adicionarMovimentacao({
      cliente_id: clienteId,
      tipo: 'pagamento',
      valor,
      observacoes
    })

    const hoje = opts?.data_pagamento || new Date().toISOString().split('T')[0];
    const forma = String(opts?.forma_pagamento || 'dinheiro').toLowerCase();
    const formasValidas = ['dinheiro', 'pix', 'debito', 'débito', 'cartao_debito', 'cartao-debito', 'credito', 'crédito', 'cartao_credito', 'cartao-credito'];

    if (result.success) {
      if (!isOffline) {
        // ONLINE: registrar direto no banco
        // Buscar caixa_diario aberto do dia
        const { data: caixaHoje, error: errHoje } = await supabase
          .from('caixa_diario')
          .select('id, data, total_caderneta, total_entradas, total_dinheiro, total_pix, total_debito, total_credito')
          .eq('data', hoje)
          .eq('status', 'aberto')
          .limit(1)
          .maybeSingle();
        let caixaRow = caixaHoje;
        if (!errHoje && !caixaHoje) {
          // Tenta buscar qualquer caixa aberto
          const { data: abertoAny, error: errAny } = await supabase
            .from('caixa_diario')
            .select('id, data, total_caderneta, total_entradas, total_dinheiro, total_pix, total_debito, total_credito')
            .eq('status', 'aberto')
            .limit(1)
            .maybeSingle();
          if (!errAny && abertoAny) caixaRow = abertoAny;
        }
        if (!caixaRow || !caixaRow.id) {
          // Não há caixa aberto, não registra no caixa
          return result;
        }
        // Atualizar totais do caixa_diario no banco
        let atualizar: any = {
          updated_at: new Date().toISOString()
        };
        if (formasValidas.includes(forma)) {
          atualizar.total_entradas = Number((Number(caixaRow.total_entradas || 0) + valor).toFixed(2));
          if (forma === 'dinheiro') atualizar.total_dinheiro = Number((Number(caixaRow.total_dinheiro || 0) + valor).toFixed(2));
          if (forma === 'pix') atualizar.total_pix = Number((Number(caixaRow.total_pix || 0) + valor).toFixed(2));
          if (['debito', 'débito', 'cartao_debito', 'cartao-debito'].includes(forma)) atualizar.total_debito = Number((Number(caixaRow.total_debito || 0) + valor).toFixed(2));
          if (['credito', 'crédito', 'cartao_credito', 'cartao-credito'].includes(forma)) atualizar.total_credito = Number((Number(caixaRow.total_credito || 0) + valor).toFixed(2));
        }
        await supabase
          .from('caixa_diario')
          .update(atualizar)
          .eq('id', caixaRow.id);
        // Inserir detalhamento em caixa_movimentacoes
        await supabase
          .from('caixa_movimentacoes')
          .insert({
            caixa_diario_id: caixaRow.id,
            tipo: 'entrada',
            valor: valor,
            motivo: `Pagamento caderneta (cliente ${clienteId})`,
            observacoes: observacoes || null,
            created_at: new Date().toISOString()
          });
        // Inserir entrada no fluxo_caixa
        await supabase
          .from('fluxo_caixa')
          .insert({
            data: caixaRow.data || hoje,
            tipo: 'entrada',
            categoria: 'caderneta',
            descricao: `Pagamento caderneta (cliente ${clienteId})`,
            valor: valor,
            caixa_diario_id: caixaRow.id,
            observacoes: observacoes || null,
            created_at: new Date().toISOString()
          });
      } else {
        // OFFLINE: registrar localmente (como antes)
        try {
          const { data: caixas } = useOfflineData<any>({ table: 'caixa_diario', autoSync: false });
          let caixaAberto = caixas.find((c: any) => c.data === hoje && c.status === 'aberto');
          if (!caixaAberto) return result;
          let atualizar: any = { ...caixaAberto };
          if (formasValidas.includes(forma)) {
            atualizar.total_entradas = Number((Number(atualizar.total_entradas || 0) + valor).toFixed(2));
            if (forma === 'dinheiro') atualizar.total_dinheiro = Number((Number(atualizar.total_dinheiro || 0) + valor).toFixed(2));
            if (forma === 'pix') atualizar.total_pix = Number((Number(atualizar.total_pix || 0) + valor).toFixed(2));
            if (['debito', 'débito', 'cartao_debito', 'cartao-debito'].includes(forma)) atualizar.total_debito = Number((Number(atualizar.total_debito || 0) + valor).toFixed(2));
            if (['credito', 'crédito', 'cartao_credito', 'cartao-credito'].includes(forma)) atualizar.total_credito = Number((Number(atualizar.total_credito || 0) + valor).toFixed(2));
          }
          atualizar.updated_at = new Date().toISOString();
          const { updateItem: updateCaixa } = useOfflineData<any>({ table: 'caixa_diario', autoSync: false });
          await updateCaixa(caixaAberto.id, atualizar);
          const { addItem: addMovCaixa } = useOfflineData<any>({ table: 'caixa_movimentacoes', autoSync: true });
          await addMovCaixa({
            caixa_diario_id: caixaAberto.id,
            tipo: 'entrada',
            valor: valor,
            motivo: `Pagamento caderneta (cliente ${clienteId})`,
            observacoes: observacoes || null,
            created_at: new Date().toISOString()
          });
          const { addItem: addFluxo } = useOfflineData<any>({ table: 'fluxo_caixa', autoSync: true });
          await addFluxo({
            data: caixaAberto.data || hoje,
            tipo: 'entrada',
            categoria: 'caderneta',
            descricao: `Pagamento caderneta (cliente ${clienteId})`,
            valor: valor,
            caixa_diario_id: caixaAberto.id,
            observacoes: observacoes || null,
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.warn('[registrarPagamento] Falha ao registrar movimentação de caixa offline:', e);
        }
      }
    }
    return result;
  }

  // Obter clientes com movimentações
  const getClientesComMovimentacoes = (): ClienteComMovimentacoes[] => {
    return clientes.map(cliente => {
      const movimentacoesCliente = movimentacoes
        .filter(m => m.cliente_id === cliente.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      const ultimaCompra = movimentacoesCliente.find(m => m.tipo === 'compra')?.created_at
      const ultimoPagamento = movimentacoesCliente.find(m => m.tipo === 'pagamento')?.created_at

      return {
        ...cliente,
        movimentacoes: movimentacoesCliente,
        saldo_atual: cliente.saldo_devedor,
        ultima_compra: ultimaCompra,
        ultimo_pagamento: ultimoPagamento
      }
    })
  }

  // Obter cliente por ID com movimentações
  const getClientePorId = (id: number): ClienteComMovimentacoes | undefined => {
    return getClientesComMovimentacoes().find(c => c.id === id)
  }

  // Obter clientes com saldo devedor
  const getClientesComSaldo = () => {
    return getClientesComMovimentacoes().filter(c => c.saldo_devedor > 0 && c.ativo)
  }

  // Obter clientes próximos do limite
  const getClientesProximosLimite = () => {
    return getClientesComMovimentacoes().filter(c => {
      const percentualUso = (c.saldo_devedor / c.limite_credito) * 100
      return percentualUso >= 80 && c.ativo
    })
  }

  // Calcular totais da caderneta
  const getTotaisCaderneta = () => {
    const clientesComSaldo = getClientesComSaldo()

    const totalDevedor = clientesComSaldo.reduce((total, c) => total + c.saldo_devedor, 0)
    const totalLimite = clientesComSaldo.reduce((total, c) => total + c.limite_credito, 0)
    const totalUtilizado = (totalDevedor / totalLimite) * 100

    return {
      totalDevedor,
      totalLimite,
      totalUtilizado,
      totalClientes: clientesComSaldo.length,
      clientesProximosLimite: getClientesProximosLimite().length
    }
  }

  // Sincronizar todos os dados
  const sincronizarTodos = async () => {
    try {
      await Promise.all([
        syncClientes(),
        syncMovimentacoes()
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
    const totais = getTotaisCaderneta()

    return {
      ...totais,
      totalMovimentacoes: movimentacoes.length,
      movimentacoesHoje: movimentacoes.filter(m =>
        new Date(m.created_at).toDateString() === new Date().toDateString()
      ).length,
      isOffline,
      pendingSync
    }
  }

  return {
    // Dados
    clientes,
    clientesComMovimentacoes: getClientesComMovimentacoes(),
    clientesComSaldo: getClientesComSaldo(),
    clientesProximosLimite: getClientesProximosLimite(),
    movimentacoes,
    totais: getTotaisCaderneta(),

    // Estados
    loading: clientesLoading || movimentacoesLoading || vendasLoading,
    error: clientesError || movimentacoesError,
    isOffline,
    pendingSync,

    // Ações
    adicionarCliente,
    atualizarCliente,
    removerCliente,
    toggleClienteAtivo,
    adicionarMovimentacao,
    registrarPagamento,
    sincronizarTodos,

    // Utilitários
    getClientePorId,
    getEstatisticas,
    refreshClientes,
    refreshMovimentacoes
  }
}
