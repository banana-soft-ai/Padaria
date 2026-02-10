/**
 * Hook para gerenciar caixa com suporte offline
 * Funciona online e offline, sincronizando automaticamente
 */

import { useOfflineData } from './useOfflineData'
import { CaixaDiario, FluxoCaixa, Venda } from '@/lib/supabase'
import { toCaixaDiario, toVenda } from '@/lib/converters'
import { obterDataLocal } from '@/lib/dateUtils'

interface CaixaFormData {
  valor_abertura: number
  observacoes_abertura?: string
  usuario_abertura?: string
}

interface FechamentoFormData {
  caixa_diario_id: number
  valor_dinheiro_informado?: number
  valor_pix_informado?: number
  valor_debito_informado?: number
  valor_credito_informado?: number
  observacoes_fechamento?: string
  usuario_fechamento?: string
}

interface FluxoFormData {
  tipo: 'entrada' | 'saida'
  categoria: string
  descricao: string
  valor: number
}

interface CaixaComDetalhes extends CaixaDiario {
  vendas: Venda[]
  fluxos: FluxoCaixa[]
  totaisCalculados: {
    totalVendas: number
    totalEntradas: number
    totalSaidas: number
    saldoFinal: number
  }
}

export function useCaixaOffline() {
  // Hook offline para caixas diários
  const {
    data: rawCaixas,
    loading: caixasLoading,
    error: caixasError,
    addItem: addCaixa,
    updateItem: updateCaixa,
    deleteItem: deleteCaixa,
    refresh: refreshCaixas,
    sync: syncCaixas,
    isOffline,
    pendingSync
  } = useOfflineData<CaixaDiario>({
    table: 'caixa_diario',
    // Importante: não sincronizar automaticamente operações de criação/abertura
    // de caixa em background. Abertura de caixa deve ser ação explícita do usuário.
    autoSync: false
  })

  // Hook offline para fluxo de caixa
  const {
    data: fluxos,
    loading: fluxosLoading,
    error: fluxosError,
    addItem: addFluxo,
    updateItem: updateFluxo,
    deleteItem: deleteFluxo,
    refresh: refreshFluxos,
    sync: syncFluxos
  } = useOfflineData<FluxoCaixa>({
    table: 'fluxo_caixa',
    autoSync: true
  })

  // Hook offline para vendas
  const {
    data: rawVendas,
    loading: vendasLoading
  } = useOfflineData<Venda>({
    table: 'vendas',
    autoSync: true
  })

  const caixas = (rawCaixas || []).map(toCaixaDiario)
  const vendas = (rawVendas || []).map(toVenda)

  // Abrir caixa
  const abrirCaixa = async (formData: CaixaFormData) => {
    try {
      const hoje = obterDataLocal()
      
      // Regra: só pode abrir 1 caixa por dia. Bloquear se já existir qualquer caixa para hoje.
      const caixaExistente = caixas.find(c => c.data === hoje)
      if (caixaExistente) {
        return {
          success: false,
          message: 'Já existe um caixa registrado para hoje (aberto ou fechado). Não é permitido abrir mais de uma vez por dia.'
        }
      }

      const novoCaixa: Omit<CaixaDiario, 'id'> & { created_at?: string; updated_at?: string } = {
        data: hoje,
        status: 'aberto',
        valor_abertura: formData.valor_abertura,
        observacoes_abertura: formData.observacoes_abertura || '',
        usuario_abertura: formData.usuario_abertura || '',
        data_abertura: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await addCaixa(novoCaixa)

      return { 
        success: true, 
        message: isOffline ? 'Caixa aberto offline' : 'Caixa aberto com sucesso' 
      }
    } catch (error) {
      console.error('Erro ao abrir caixa:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro ao abrir caixa' 
      }
    }
  }

  // Fechar caixa
  const fecharCaixa = async (formData: FechamentoFormData) => {
    try {
      const caixa = caixas.find(c => c.id === formData.caixa_diario_id)
      if (!caixa) {
        return { success: false, message: 'Caixa não encontrado' }
      }

      if (caixa.status === 'fechado') {
        return { success: false, message: 'Caixa já está fechado' }
      }

      // Calcular totais das vendas do dia
      const vendasDoDia = vendas.filter(v => v.data === caixa.data)
      const totalVendas = vendasDoDia.reduce((total, v) => total + v.valor_total, 0)
      
      // Calcular totais por forma de pagamento
      const totalPix = vendasDoDia
        .filter(v => v.forma_pagamento === 'pix')
        .reduce((total, v) => total + v.valor_pago, 0)
      
      const totalDebito = vendasDoDia
        .filter(v => v.forma_pagamento === 'debito')
        .reduce((total, v) => total + v.valor_pago, 0)
      
      const totalCredito = vendasDoDia
        .filter(v => v.forma_pagamento === 'credito')
        .reduce((total, v) => total + v.valor_pago, 0)
      
      const totalDinheiro = vendasDoDia
        .filter(v => v.forma_pagamento === 'dinheiro')
        .reduce((total, v) => total + v.valor_pago, 0)

      // Calcular fluxos de caixa
      const fluxosDoDia = fluxos.filter(f => f.data === caixa.data)
      const totalEntradas = fluxosDoDia
        .filter(f => f.tipo === 'entrada')
        .reduce((total, f) => total + f.valor, 0)
      
      const totalSaidas = fluxosDoDia
        .filter(f => f.tipo === 'saida')
        .reduce((total, f) => total + f.valor, 0)

      // Calcular valor total do caixa
      const valorTotalSistema = caixa.valor_abertura + totalDinheiro + totalEntradas - totalSaidas
      
      // Calcular diferenças (se valores informados)
      const diferencaDinheiro = formData.valor_dinheiro_informado 
        ? formData.valor_dinheiro_informado - totalDinheiro 
        : 0
      
      const diferencaPix = formData.valor_pix_informado 
        ? formData.valor_pix_informado - totalPix 
        : 0
      
      const diferencaDebito = formData.valor_debito_informado 
        ? formData.valor_debito_informado - totalDebito 
        : 0
      
      const diferencaCredito = formData.valor_credito_informado 
        ? formData.valor_credito_informado - totalCredito 
        : 0

      const diferencaTotal = diferencaDinheiro + diferencaPix + diferencaDebito + diferencaCredito

      const valorFechamento = valorTotalSistema + diferencaTotal

      // Atualizar caixa
      const atualizacao: Partial<CaixaDiario> & { updated_at?: string } = {
        status: 'fechado',
        valor_fechamento: valorFechamento,
        total_vendas: totalVendas,
        total_entradas: totalEntradas,
        valor_saidas: totalSaidas,
        total_pix: totalPix,
        total_debito: totalDebito,
        total_credito: totalCredito,
        total_dinheiro: totalDinheiro,
        diferenca: diferencaTotal,
        valor_dinheiro_informado: formData.valor_dinheiro_informado,
        valor_pix_informado: formData.valor_pix_informado,
        valor_debito_informado: formData.valor_debito_informado,
        valor_credito_informado: formData.valor_credito_informado,
        diferenca_dinheiro: diferencaDinheiro,
        diferenca_pix: diferencaPix,
        diferenca_debito: diferencaDebito,
        diferenca_credito: diferencaCredito,
        observacoes_fechamento: formData.observacoes_fechamento || '',
        usuario_fechamento: formData.usuario_fechamento || '',
        data_fechamento: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await updateCaixa(formData.caixa_diario_id, atualizacao)

      return { 
        success: true, 
        message: isOffline ? 'Caixa fechado offline' : 'Caixa fechado com sucesso',
        diferenca: diferencaTotal
      }
    } catch (error) {
      console.error('Erro ao fechar caixa:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro ao fechar caixa' 
      }
    }
  }

  // Adicionar fluxo de caixa
  const adicionarFluxo = async (formData: FluxoFormData) => {
    try {
      const hoje = obterDataLocal()
      
      const novoFluxo: Omit<FluxoCaixa, 'id'> = {
        data: hoje,
        tipo: formData.tipo,
        categoria: formData.categoria,
        descricao: formData.descricao,
        valor: formData.valor,
        created_at: new Date().toISOString()
      }

      await addFluxo(novoFluxo)

      return { 
        success: true, 
        message: isOffline ? 'Movimento salvo offline' : 'Movimento registrado com sucesso' 
      }
    } catch (error) {
      console.error('Erro ao adicionar fluxo:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro ao registrar movimento' 
      }
    }
  }

  // Obter caixa do dia
  const getCaixaDoDia = (data?: string): CaixaDiario | undefined => {
    const dataConsulta = data || obterDataLocal()
    return caixas.find(c => c.data === dataConsulta)
  }

  // Obter caixa aberto
  const getCaixaAberto = (): CaixaDiario | undefined => {
    const hoje = obterDataLocal()
    return caixas.find(c => c.data === hoje && c.status === 'aberto')
  }

  // Obter caixas com detalhes
  const getCaixasComDetalhes = (): CaixaComDetalhes[] => {
    return caixas.map(caixa => {
      const vendasDoDia = vendas.filter(v => v.data === caixa.data)
      const fluxosDoDia = fluxos.filter(f => f.data === caixa.data)
      
      const totalVendas = vendasDoDia.reduce((total, v) => total + v.valor_total, 0)
      const totalEntradas = fluxosDoDia
        .filter(f => f.tipo === 'entrada')
        .reduce((total, f) => total + f.valor, 0)
      
      const totalSaidas = fluxosDoDia
        .filter(f => f.tipo === 'saida')
        .reduce((total, f) => total + f.valor, 0)
      
      const saldoFinal = caixa.valor_abertura + totalVendas + totalEntradas - totalSaidas

      return {
        ...caixa,
        vendas: vendasDoDia,
        fluxos: fluxosDoDia,
        totaisCalculados: {
          totalVendas,
          totalEntradas,
          totalSaidas,
          saldoFinal
        }
      }
    })
  }

  // Obter fluxos por período
  const getFluxosPorPeriodo = (dataInicio: string, dataFim: string) => {
    return fluxos.filter(f => f.data >= dataInicio && f.data <= dataFim)
  }

  // Calcular resumo do dia
  const getResumoDia = (data?: string) => {
    const dataConsulta = data || obterDataLocal()
    const caixa = getCaixaDoDia(dataConsulta)
    const vendasDoDia = vendas.filter(v => v.data === dataConsulta)
    const fluxosDoDia = fluxos.filter(f => f.data === dataConsulta)

    const totalVendas = vendasDoDia.reduce((total, v) => total + v.valor_total, 0)
    const totalEntradas = fluxosDoDia
      .filter(f => f.tipo === 'entrada')
      .reduce((total, f) => total + f.valor, 0)
    
    const totalSaidas = fluxosDoDia
      .filter(f => f.tipo === 'saida')
      .reduce((total, f) => total + f.valor, 0)

    return {
      data: dataConsulta,
      caixa,
      totalVendas,
      totalEntradas,
      totalSaidas,
      saldoFinal: (caixa?.valor_abertura || 0) + totalVendas + totalEntradas - totalSaidas,
      status: caixa?.status || 'fechado'
    }
  }

  // Sincronizar todos os dados
  const sincronizarTodos = async () => {
    try {
      await Promise.all([
        syncCaixas(),
        syncFluxos()
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
    const caixasComDetalhes = getCaixasComDetalhes()
    const resumoHoje = getResumoDia()
    
    return {
      totalCaixas: caixas.length,
      caixasAbertos: caixas.filter(c => c.status === 'aberto').length,
      totalFluxos: fluxos.length,
      resumoHoje,
      isOffline,
      pendingSync
    }
  }

  return {
    // Dados
    caixas,
    caixasComDetalhes: getCaixasComDetalhes(),
    caixaAberto: getCaixaAberto(),
    fluxos,
    resumoHoje: getResumoDia(),
    
    // Estados
    loading: caixasLoading || fluxosLoading || vendasLoading,
    error: caixasError || fluxosError,
    isOffline,
    pendingSync,
    
    // Ações
    abrirCaixa,
    fecharCaixa,
    adicionarFluxo,
    sincronizarTodos,
    
    // Utilitários
    getCaixaDoDia,
    getFluxosPorPeriodo,
    getResumoDia,
    getEstatisticas,
    refreshCaixas,
    refreshFluxos
  }
}
