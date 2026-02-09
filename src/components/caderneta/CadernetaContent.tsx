'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ClienteCaderneta, MovimentacaoCaderneta } from '@/lib/supabase'
import Toast from '@/app/gestao/caderneta/Toast'
import { Plus, Users, DollarSign, CreditCard, Search, Edit, Trash2, Calculator, Eye, WifiOff, RefreshCw, X, Download, FileText, MessageCircle, FileSpreadsheet, Printer } from 'lucide-react'
import { useCadernetaOffline } from '@/hooks/useCadernetaOffline'

/**
 * Componente da página de gestão da Caderneta (Fiado).
 *
 * Esta página é o ponto central para gerenciar clientes, registrar pagamentos,
 * ajustar saldos e visualizar o histórico de movimentações.
 *
 * A principal característica é o suporte offline, garantido pelo hook `useCadernetaOffline`,
 * que permite que todas as operações sejam realizadas sem conexão com a internet e
 * sincronizadas automaticamente quando a conexão é restabelecida.
 */
export function CadernetaContent() {
  // Hook customizado que abstrai toda a lógica de dados da caderneta, incluindo
  // busca, cache, operações CRUD e sincronização online/offline.
  const {
    clientes, // Lista de todos os clientes da caderneta.
    clientesComMovimentacoes,
    clientesComSaldo,
    clientesProximosLimite,
    movimentacoes,
    totais,
    loading,
    error,
    isOffline,
    pendingSync,
    adicionarCliente,
    atualizarCliente,
    removerCliente,
    toggleClienteAtivo,
    adicionarMovimentacao,
    registrarPagamento,
    sincronizarTodos,
    getEstatisticas,
    refreshClientes,
    refreshMovimentacoes
  } = useCadernetaOffline()

  // Estado local que indica se o caixa PDV está aberto (verificado no Supabase)
  const [caixaAberto, setCaixaAberto] = useState(false)

  // Acesso seguro ao cliente Supabase (evita uso de supabase! diretamente)
  const getSupabase = () => {
    if (!supabase) throw new Error('Supabase não inicializado')
    return supabase
  }

  // Verifica se existe algum registro de caixa com status 'aberto'.
  // Se `dataStr` for fornecida, filtra por data (YYYY-MM-DD).
  const verificarCaixaAberto = async (dataStr?: string) => {
    try {
      let res
      if (dataStr) {
        res = await getSupabase()
          .from('caixa_diario')
          .select('id, status, data')
          .eq('data', dataStr)
          .eq('status', 'aberto')
          .limit(1)
          .single()
      } else {
        res = await getSupabase()
          .from('caixa_diario')
          .select('id, status, data')
          .eq('status', 'aberto')
          .limit(1)
          .single()
      }

      if (res && res.data) {
        setCaixaAberto(true)
        return true
      }
      setCaixaAberto(false)
      return false
    } catch (err: any) {
      // PGRST116 ou ausência de linhas não deve quebrar a experiência
      console.error('Erro ao verificar caixa aberto:', err)
      setCaixaAberto(false)
      return false
    }
  }

  // Estados para controlar a visibilidade dos modais da interface.
  const [showModalCliente, setShowModalCliente] = useState(false)
  const [showModalPagamento, setShowModalPagamento] = useState(false)
  const [showModalSaldo, setShowModalSaldo] = useState(false)
  const [showModalVisualizar, setShowModalVisualizar] = useState(false)
  const [clienteParaVisualizar, setClienteParaVisualizar] = useState<ClienteCaderneta | null>(null)

  // Estado para armazenar o cliente que está sendo manipulado (ex: em um modal).
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteCaderneta | null>(null)

  // Estados para a funcionalidade de pesquisa de clientes.
  const [termoPesquisa, setTermoPesquisa] = useState('')
  const [clientesFiltrados, setClientesFiltrados] = useState<ClienteCaderneta[]>([])
  const [aba, setAba] = useState<'clientes' | 'funcionarios'>('clientes')
  const [tipoFormAtual, setTipoFormAtual] = useState<'cliente' | 'colaborador'>('cliente')

  // Estados para filtros do histórico
  const [termoPesquisaHistorico, setTermoPesquisaHistorico] = useState('')
  const [dataPesquisaHistorico, setDataPesquisaHistorico] = useState('')
  const [tipoPesquisaHistorico, setTipoPesquisaHistorico] = useState('todos')
  const [filtroPessoaHistorico, setFiltroPessoaHistorico] = useState<'todos' | 'cliente' | 'colaborador'>('todos')

  // Estados para o modal de confirmação genérico, usado para ações destrutivas.
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');

  // Estado para controlar as notificações (toasts) que dão feedback ao usuário.
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  /**
   * Exibe uma notificação (toast) na tela.
   */
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ message, type });
  };

  // Estados para formulário de cliente
  const [formCliente, setFormCliente] = useState({
    id: '',
    nome: '',
    telefone: '',
    cpf_cnpj: '',
    endereco: '',
    limite_credito: '',
    saldo_devedor: '0',
    observacoes: ''
  })

  // Estados para formulário de pagamento
  const [formPagamento, setFormPagamento] = useState({
    cliente_id: '',
    valor: '',
    data_pagamento: new Date().toISOString().split('T')[0], // Data atual por padrão
    forma_pagamento: 'dinheiro', // Forma de pagamento padrão
    observacoes: '',
    taxa_percentual: '0'
  })

  // Permite pagamento acima do devido (saldo credor/haver) quando marcado
  const [permitirSaldoCredor, setPermitirSaldoCredor] = useState(false)

  // Estados para formulário de edição de saldo
  const [formSaldo, setFormSaldo] = useState({
    cliente_id: '',
    saldo_atual: '',
    novo_saldo: '',
    observacoes: '',
    data_ajuste: new Date().toISOString().split('T')[0]
  })

  // Estado para prévia do limite de crédito
  const [previewLimiteCredito, setPreviewLimiteCredito] = useState<number | undefined>(undefined)

  // Efeito que é executado uma vez na montagem do componente.
  useEffect(() => {
    carregarDados()
    // Verifica se o caixa PDV está aberto ao montar a página
    verificarCaixaAberto()
  }, [])

  // Efeito que re-executa a filtragem de clientes sempre que a lista de clientes ou o termo de pesquisa mudam.
  useEffect(() => {
    filtrarClientes()
  }, [termoPesquisa, clientes, aba])

  // Ao trocar para a aba Funcionários, fixa o filtro do histórico em "Somente Funcionários"
  useEffect(() => {
    if (aba === 'funcionarios') {
      setFiltroPessoaHistorico('colaborador')
    } else {
      // Voltando para clientes, não force manter "colaborador"
      setFiltroPessoaHistorico(prev => (prev === 'colaborador' ? 'todos' : prev))
    }
  }, [aba])



  /**
   * Função de inicialização de dados.
   * OBS: Com a implementação do hook `useCadernetaOffline`, esta função tornou-se obsoleta,
   * pois o hook gerencia o carregamento de dados automaticamente. Mantida por razões históricas.
   */
  const carregarDados = async () => {
    // Dados são carregados automaticamente pelo hook useCadernetaOffline
    console.log('Dados de caderneta gerenciados pelo hook offline')
  }

  /**
   * Filtra a lista de clientes com base no termo de pesquisa digitado pelo usuário.
   */
  const filtrarClientes = () => {
    const tipoAtual = aba === 'clientes' ? 'cliente' : 'colaborador'
    if (!termoPesquisa.trim()) {
      setClientesFiltrados(clientes.filter(c => c.tipo === tipoAtual))
      return
    }

    const termo = termoPesquisa.toLowerCase()
    const filtrados = clientes.filter(cliente =>
      cliente.tipo === tipoAtual && (
        cliente.nome.toLowerCase().includes(termo) ||
        (cliente.telefone && cliente.telefone.includes(termo)) ||
        (cliente.endereco && cliente.endereco.toLowerCase().includes(termo))
      )
    )
    setClientesFiltrados(filtrados)
  }

  /**
   * Força a atualização dos dados da página, buscando as informações mais recentes do servidor.
   * É útil para garantir que a UI reflita o estado mais atual após operações
   * que possam não ter sido atualizadas instantaneamente na tela.
   */
  const handleRefreshData = async () => {
    showToast('Atualizando dados...', 'info')
    await Promise.all([refreshClientes(), refreshMovimentacoes()])
    showToast('Clientes atualizados com sucesso!', 'success')
  }

  /**
   * Manipula o envio do formulário de criação ou edição de cliente.
   * Utiliza as funções do hook `useCadernetaOffline` para persistir os dados.
   */
  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const dadosCliente = {
        nome: formCliente.nome,
        telefone: formCliente.telefone || undefined,
        cpf_cnpj: formCliente.cpf_cnpj || undefined,
        endereco: formCliente.endereco || undefined,
        limite_credito: parseFloat(formCliente.limite_credito) || 0,
        saldo_devedor: formCliente.saldo_devedor
          ? parseFloat(formCliente.saldo_devedor)
          : 0,
        observacoes: formCliente.observacoes || undefined
      }

      let result;
      // Usar o hook offline para adicionar/atualizar (mantém cache e sincronização)
      if (formCliente.id) {
        const idNum = Number(formCliente.id)
        result = await atualizarCliente(idNum, dadosCliente)
        if (!result || !result.success) throw new Error(result?.message || 'Erro ao atualizar cliente')
      } else {
        result = await adicionarCliente(dadosCliente as any, tipoFormAtual)
        if (!result || !result.success) throw new Error(result?.message || 'Erro ao adicionar cliente')
      }

      setShowModalCliente(false)
      resetClienteForm()
      showToast(result.message || 'Cliente salvo com sucesso!', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log('Informação ao salvar cliente:', errorMessage)
      showToast('Erro ao salvar cliente. Verifique o console para mais detalhes.', 'error');
    }
  }

  /**
   * Manipula o envio do formulário de registro de pagamento.
   * Inclui uma validação crítica: verifica se o caixa do dia correspondente está aberto
   * antes de permitir o registro do pagamento.
   * Utiliza o hook `useCadernetaOffline` para garantir atomicidade e suporte offline.
   */
  const handleSubmitPagamento = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const valorDigitado = parseFloat(formPagamento.valor.replace(',', '.')) || 0
      if (valorDigitado <= 0) {
        showToast('O valor deve ser maior que zero.', 'warning');
        return
      }

      const cliente = clientes.find(c => c.id.toString() === formPagamento.cliente_id)
      if (!cliente) {
        showToast('Cliente não encontrado.', 'error');
        return
      }

      const isDinheiro = formPagamento.forma_pagamento === 'dinheiro'

      // Calcular valor efetivo a ser aplicado ao pagamento
      let valorEfetivo: number
      if (isDinheiro && !permitirSaldoCredor) {
        // Dinheiro sem checkbox: dar troco, aplicar apenas saldo_devedor
        if (valorDigitado < cliente.saldo_devedor) {
          showToast('Valor insuficiente. Informe o valor recebido (mínimo R$ ' + cliente.saldo_devedor.toFixed(2) + ').', 'warning')
          return
        }
        valorEfetivo = cliente.saldo_devedor
      } else if (isDinheiro && permitirSaldoCredor) {
        // Dinheiro com checkbox: aplicar valor completo (pode gerar crédito)
        valorEfetivo = valorDigitado
      } else if (!isDinheiro && !permitirSaldoCredor) {
        // PIX/Cartão sem checkbox: manter validação atual
        if (valorDigitado > cliente.saldo_devedor) {
          showToast('O valor do pagamento não pode ser maior que o saldo devedor.', 'warning')
          return
        }
        valorEfetivo = valorDigitado
      } else {
        // PIX/Cartão com checkbox: permitir valor > saldo (crédito)
        valorEfetivo = valorDigitado
      }

      const isCartao = formPagamento.forma_pagamento === 'debito' || formPagamento.forma_pagamento === 'credito'
      const taxaNum = parseFloat(formPagamento.taxa_percentual) || 0
      if (isCartao && (taxaNum < 0 || taxaNum > 100)) {
        showToast('A taxa deve estar entre 0 e 100%.', 'warning')
        return
      }

      // VALIDAÇÃO ANTES: Verificar se o caixa está aberto para a data
      const { data: caixa, error: caixaError } = await getSupabase()
        .from('caixa_diario')
        .select('id, status, total_entradas, valor_saidas, total_caderneta, data')
        .eq('data', formPagamento.data_pagamento)
        .maybeSingle()

      // PGRST116: "no rows found", esperado se não houver caixa.
      // 22P02: "invalid text representation", pode ocorrer com data malformada.
      if (caixaError && caixaError.code !== 'PGRST116' && caixaError.code !== '22P02') {
        throw caixaError
      }

      if (!caixa || (caixa as any).status !== 'aberto') {
        // Tenta fallback: existe algum caixa aberto (qualquer data)?
        try {
          const { data: abertoAny, error: abertoErr } = await getSupabase()
            .from('caixa_diario')
            .select('id, status, data')
            .eq('status', 'aberto')
            .limit(1)
            .maybeSingle()

          if (!abertoErr && abertoAny && (abertoAny as any).status === 'aberto') {
            // Permite usar o caixa aberto; aviso visual removido.
            // prossegue sem retornar
          } else {
            showToast(`CAIXA FECHADO: Não é possível registrar pagamento para ${formPagamento.data_pagamento}. Abra o caixa no PDV primeiro.`, 'error')
            return
          }
        } catch (err) {
          console.error('Erro ao verificar caixa aberto (fallback):', err)
          showToast(`CAIXA FECHADO: Não é possível registrar pagamento para ${formPagamento.data_pagamento}. Abra o caixa no PDV primeiro.`, 'error')
          return
        }
      }

      let observacoesFinal = formPagamento.observacoes || 'Pagamento registrado'
      const valorTotalCartao = isCartao && taxaNum > 0 ? valorDigitado * (1 + taxaNum / 100) : null
      if (isCartao && taxaNum > 0 && valorTotalCartao != null) {
        observacoesFinal += ` (Taxa cartão: ${taxaNum}% | Total cobrado: R$ ${valorTotalCartao.toFixed(2)})`
      }

      // Usar o hook offline para registrar o pagamento.
      // valorEfetivo = valor abatido na caderneta; valor_caixa = valor a lançar no caixa do dia (total com taxa quando cartão).
      const result = await registrarPagamento(
        cliente.id,
        valorEfetivo,
        observacoesFinal,
        {
          data_pagamento: formPagamento.data_pagamento,
          forma_pagamento: formPagamento.forma_pagamento,
          ...(valorTotalCartao != null ? { valor_caixa: valorTotalCartao } : {})
        }
      )

      if (!result.success) {
        throw new Error(result.message || 'Erro ao registrar pagamento.')
      }

      setShowModalPagamento(false)
      resetPagamentoForm()
      // A mensagem de sucesso agora vem do hook, informando se foi salvo offline ou sincronizado.
      showToast(result.message || 'Pagamento registrado com sucesso!', 'success');
      // Notificar PDV (quando embarcado em iframe) para atualizar dados do caixa
      try {
        if (typeof window !== 'undefined' && window.self !== window.top) {
          window.parent.postMessage({ type: 'caderneta-pagamento-registrado' }, '*')
        }
      } catch (_e) { /* ignorar se postMessage falhar */ }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log('Erro ao registrar pagamento:', errorMessage)
      showToast('Erro ao registrar pagamento. Verifique o console para mais detalhes.', 'error');
    }
  }

  /**
   * Preenche o formulário de cliente com os dados de um cliente existente e abre o modal de edição.
   * @param cliente O objeto do cliente a ser editado.
   */
  const handleEditCliente = (cliente: ClienteCaderneta) => {
    setFormCliente({
      id: cliente.id.toString(),
      nome: cliente.nome,
      telefone: cliente.telefone || '',
      cpf_cnpj: cliente.cpf_cnpj || '',
      endereco: cliente.endereco || '',
      limite_credito: cliente.limite_credito.toString(),
      saldo_devedor: cliente.saldo_devedor.toString(),
      observacoes: cliente.observacoes || ''
    })
    setTipoFormAtual(cliente.tipo)
    setShowModalCliente(true)
  }

  /**
   * Abre o modal de visualização com todos os dados cadastrados do cliente.
   * @param cliente O cliente cujos dados serão exibidos.
   */
  const handleVisualizarCliente = (cliente: ClienteCaderneta) => {
    setClienteParaVisualizar(cliente)
    setShowModalVisualizar(true)
  }

  /**
   * Inicia o fluxo para desativar um cliente.
   * Verifica se o cliente tem saldo devedor antes de prosseguir.
   * Exibe um modal de confirmação para o usuário.
   * @param cliente O cliente a ser desativado.
   */
  const handleDeleteCliente = (cliente: ClienteCaderneta) => {
    const rotulo = cliente.tipo === 'colaborador' ? 'Funcionário' : 'Cliente'
    setConfirmTitle(`Desativar ${rotulo}`);
    setConfirmMessage(`Tem certeza que deseja DESATIVAR o ${rotulo.toLowerCase()} "${cliente.nome}"? O registro será removido da lista, mas o histórico será preservado.`);
    setConfirmAction(() => async () => {
      try {
        // Verificar se o cliente tem saldo devedor
        if (cliente.saldo_devedor > 0) {
          showToast(`Não é possível desativar ${rotulo.toLowerCase()} "${cliente.nome}" pois possui saldo devedor de R$ ${cliente.saldo_devedor.toFixed(2)}. Primeiro, ajuste o saldo para zero.`, 'warning');
          return;
        }

        // Usar o hook offline para desativar/ativar o cliente.
        // Isso garante que a lista de clientes na UI seja atualizada corretamente.
        const result = await toggleClienteAtivo(cliente.id);

        if (!result.success) {
          throw new Error(result.message || 'Erro ao desativar cliente.');
        }

        // A chamada `carregarDados()` é removida pois o hook gerencia a atualização dos dados.
        showToast(result.message || `${rotulo} desativado com sucesso!`, 'success');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.log('Erro ao desativar cliente:', errorMessage);
        showToast('Erro ao desativar cliente. Verifique o console para mais detalhes.', 'error');
      } finally {
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  }

  /**
   * Abre o modal de registro de pagamento para um cliente específico.
   * @param cliente O cliente para o qual o pagamento será registrado.
   */
  const handlePagamento = (cliente: ClienteCaderneta) => {
    ; (async () => {
      console.log('[CADERNETA] handlePagamento clicked for cliente:', cliente && cliente.id)
      const aberto = await verificarCaixaAberto()
      if (!aberto) {
        showToast('CAIXA FECHADO: Abra o caixa no PDV antes de registrar pagamentos.', 'error')
        return
      }

      setClienteSelecionado(cliente)
      setFormPagamento({
        cliente_id: cliente.id.toString(),
        valor: '',
        data_pagamento: new Date().toISOString().split('T')[0],
        forma_pagamento: 'dinheiro',
        observacoes: '',
        taxa_percentual: '0'
      })
      setPermitirSaldoCredor(false)
      setShowModalPagamento(true)
    })()
  }

  /**
   * Abre o modal de ajuste de saldo para um cliente específico.
   * @param cliente O cliente cujo saldo será ajustado.
   */
  const handleEditarSaldo = (cliente: ClienteCaderneta) => {
    setClienteSelecionado(cliente)
    setFormSaldo({
      cliente_id: cliente.id.toString(),
      saldo_atual: cliente.saldo_devedor.toFixed(2),
      novo_saldo: '',
      observacoes: '',
      data_ajuste: new Date().toISOString().split('T')[0]
    })
    setShowModalSaldo(true)
  }

  /**
   * Manipula o envio do formulário de ajuste de saldo.
   * Calcula a diferença e cria uma movimentação de 'compra' ou 'pagamento'
   * para refletir o ajuste, garantindo um histórico auditável.
   */
  const handleSubmitSaldo = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const novoSaldoNum = parseFloat(formSaldo.novo_saldo)
      if (isNaN(novoSaldoNum) || novoSaldoNum < 0) {
        showToast('O novo saldo devedor deve ser um número positivo ou zero.', 'warning');
        return
      }

      const clienteIdNum = Number(formSaldo.cliente_id)
      const cliente = clientes.find(c => c.id === clienteIdNum)
      if (!cliente) {
        showToast('Cliente não encontrado.', 'error');
        return
      }

      const saldoAtual = cliente.saldo_devedor
      const diferenca = novoSaldoNum - saldoAtual

      if (diferenca === 0) {
        showToast('O novo saldo é igual ao saldo atual. Nenhuma alteração necessária.', 'info')
        setShowModalSaldo(false)
        return
      }

      // Usar o hook para registrar a movimentação e atualizar o saldo do cliente
      // Isso garante o funcionamento offline e a sincronização automática.
      const result = await adicionarMovimentacao({
        cliente_id: clienteIdNum,
        tipo: diferenca < 0 ? 'pagamento' : 'compra', // Ajusta o tipo baseado na diferença
        valor: Math.abs(diferenca),
        observacoes: formSaldo.observacoes || `Ajuste de saldo para R$ ${novoSaldoNum.toFixed(2)}`
      })

      if (!result.success) {
        throw new Error(result.message || 'Erro ao ajustar saldo.')
      }

      setShowModalSaldo(false)
      resetSaldoForm()
      showToast(result.message || 'Saldo devedor ajustado com sucesso!', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log('Erro ao registrar ajuste de saldo:', errorMessage)
      showToast('Erro ao registrar ajuste de saldo. Verifique o console para mais detalhes.', 'error');
    }
  }

  /**
   * Reseta o estado do formulário de cliente para seus valores iniciais.
   */
  const resetClienteForm = () => {
    setFormCliente({
      id: '',
      nome: '',
      telefone: '',
      cpf_cnpj: '',
      endereco: '',
      limite_credito: '',
      saldo_devedor: '0',
      observacoes: ''
    })
  }

  /**
   * Reseta o estado do formulário de pagamento.
   */
  const resetPagamentoForm = () => {
    setFormPagamento({
      cliente_id: '',
      valor: '',
      data_pagamento: new Date().toISOString().split('T')[0],
      forma_pagamento: 'dinheiro',
      observacoes: '',
      taxa_percentual: '0'
    })
    setPermitirSaldoCredor(false)
    setClienteSelecionado(null)
  }

  /**
   * Reseta o estado do formulário de ajuste de saldo.
   */
  const resetSaldoForm = () => {
    setFormSaldo({
      cliente_id: '',
      saldo_atual: '',
      novo_saldo: '',
      observacoes: '',
      data_ajuste: new Date().toISOString().split('T')[0]
    })
    setClienteSelecionado(null)
  }

  /**
   * Formata uma data ISO para o formato de data local (dd/mm/aaaa).
   */
  const obterDataLocal = (dataISO: string): string => {
    const data = new Date(dataISO)
    return data.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    })
  }

  /**
   * Formata uma data ISO para o formato de hora local (hh:mm).
   */
  const obterHoraLocal = (dataISO: string): string => {
    const data = new Date(dataISO)
    return data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    })
  }

  // Filtra as movimentações com base nos critérios selecionados
  const movimentacoesFiltradas = movimentacoes.filter(mov => {
    const cliente = clientes.find(c => c.id === mov.cliente_id)
    const nomeCliente = cliente?.nome.toLowerCase() || ''
    const termo = termoPesquisaHistorico.toLowerCase()
    const matchNome = nomeCliente.includes(termo)

    // Comparação de data considerando fuso horário local (America/Sao_Paulo)
    let matchData = true
    if (dataPesquisaHistorico) {
      const dataMovStr = obterDataLocal(mov.created_at) // dd/mm/yyyy
      const [ano, mes, dia] = dataPesquisaHistorico.split('-')
      const dataPesquisaStr = `${dia}/${mes}/${ano}`
      matchData = dataMovStr === dataPesquisaStr
    }

    const matchTipo = tipoPesquisaHistorico === 'todos' ? true : mov.tipo === tipoPesquisaHistorico
    const matchPessoa = filtroPessoaHistorico === 'todos' ? true : cliente?.tipo === filtroPessoaHistorico

    return matchNome && matchData && matchTipo && matchPessoa
  })

  /**
   * Exporta o histórico filtrado para um arquivo CSV (Excel).
   * Permite que o usuário baixe um relatório das movimentações exibidas na tela.
   */
  const handleExportarExcel = () => {
    if (movimentacoesFiltradas.length === 0) {
      showToast('Não há dados para exportar com os filtros atuais.', 'warning')
      return
    }

    // Cabeçalho do CSV
    const csvHeader = 'Data;Hora;Cliente;Tipo;Valor;Saldo Anterior;Saldo Atual;Observações\n'

    // Linhas do CSV
    const csvRows = movimentacoesFiltradas.map(mov => {
      const cliente = clientes.find(c => c.id === mov.cliente_id)
      const data = obterDataLocal(mov.created_at)
      const hora = obterHoraLocal(mov.created_at)
      const tipo = mov.tipo === 'compra' ? 'Compra' : (mov.observacoes?.includes('Ajuste de saldo') ? 'Ajuste' : 'Pagamento')
      const valor = mov.valor.toFixed(2).replace('.', ',')
      const saldoAnt = mov.saldo_anterior.toFixed(2).replace('.', ',')
      const saldoAtu = mov.saldo_atual.toFixed(2).replace('.', ',')
      const obs = (mov.observacoes || '').replace(/;/g, ' ').replace(/\n/g, ' ') // Remove caracteres que quebrariam o CSV

      return `${data};${hora};${cliente?.nome || 'N/A'};${tipo};${valor};${saldoAnt};${saldoAtu};${obs}`
    }).join('\n')

    const csvContent = `\uFEFF${csvHeader}${csvRows}` // Adiciona BOM para Excel reconhecer acentos corretamente
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `historico_caderneta_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /**
   * Formata o histórico para texto e copia para a área de transferência (WhatsApp).
   */
  const handleCopiarWhatsApp = () => {
    if (movimentacoesFiltradas.length === 0) {
      showToast('Não há dados para copiar.', 'warning')
      return
    }

    let texto = `*EXTRATO CADERNETA - REY DOS PÃES*\n`
    texto += `Data: ${new Date().toLocaleDateString('pt-BR')}\n`

    // Se houver filtro de cliente, adiciona o nome no cabeçalho
    const clienteFiltrado = termoPesquisaHistorico ? clientes.find(c => c.nome.toLowerCase().includes(termoPesquisaHistorico.toLowerCase())) : null
    if (clienteFiltrado) texto += `Cliente: ${clienteFiltrado.nome}\n`

    texto += `--------------------------------\n`

    movimentacoesFiltradas.forEach(mov => {
      const data = obterDataLocal(mov.created_at)
      const cliente = clientes.find(c => c.id === mov.cliente_id)?.nome || 'Cliente'
      const tipo = mov.tipo === 'compra' ? '🔴 Compra' : '🟢 Pagto'
      const valor = mov.valor.toFixed(2).replace('.', ',')

      texto += `${data} - ${cliente}\n`
      texto += `${tipo}: R$ ${valor}\n`
      if (mov.observacoes) texto += `Obs: ${mov.observacoes}\n`
      texto += `\n`
    })

    texto += `--------------------------------\n`

    // Calcula totais do filtro atual
    const totalCompras = movimentacoesFiltradas.filter(m => m.tipo === 'compra').reduce((acc, curr) => acc + curr.valor, 0)
    const totalPagos = movimentacoesFiltradas.filter(m => m.tipo === 'pagamento').reduce((acc, curr) => acc + curr.valor, 0)

    texto += `*RESUMO DO PERÍODO*\n`
    texto += `Total Compras: R$ ${totalCompras.toFixed(2).replace('.', ',')}\n`
    texto += `Total Pagos: R$ ${totalPagos.toFixed(2).replace('.', ',')}\n`

    navigator.clipboard.writeText(texto)
      .then(() => showToast('Relatório copiado! Cole no WhatsApp.', 'success'))
      .catch(() => showToast('Erro ao copiar texto.', 'error'))
  }

  /**
   * Aciona a impressão do navegador para gerar PDF.
   * O CSS @media print cuidará de ocultar os elementos desnecessários.
   */
  const handleExportarPDF = () => {
    window.print()
  }

  // Exibe um esqueleto de carregamento enquanto os dados iniciais são buscados pelo hook.
  if (loading) {
    return (
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
    )
  }

  return (
    <div className="page-container">
        {/* Estilos para impressão (PDF) */}
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #area-impressao, #area-impressao * {
              visibility: visible;
            }
            #area-impressao {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
              padding: 20px;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Cabeçalho da Página */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-6 gap-3 no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Caderneta</h1>
            <p className="text-sm text-gray-600 mt-1">Gerencie clientes e colaboradores com crédito</p>
            <div className="mt-3 inline-flex rounded-md border border-gray-200 overflow-hidden">
              <button
                onClick={() => setAba('clientes')}
                className={`px-3 py-1.5 text-sm ${aba === 'clientes' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                Clientes
              </button>
              <button
                onClick={() => setAba('funcionarios')}
                className={`px-3 py-1.5 text-sm border-l border-gray-200 ${aba === 'funcionarios' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                Funcionários
              </button>
            </div>
          </div>
          <button
            onClick={() => { setTipoFormAtual(aba === 'clientes' ? 'cliente' : 'colaborador'); setShowModalCliente(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2 w-full lg:w-auto text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>{aba === 'clientes' ? 'Novo Cliente' : 'Novo Funcionário'}</span>
          </button>
        </div>

        {/* Campo de Pesquisa de Clientes */}
        <div className="mb-6 no-print">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
            <input
              type="text"
              placeholder={aba === 'clientes' ? 'Pesquisar clientes por nome, telefone ou endereço...' : 'Pesquisar funcionários por nome, telefone ou endereço...'}
              value={termoPesquisa}
              onChange={(e) => setTermoPesquisa(e.target.value)}
              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Seção da Lista de Clientes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 no-print">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{aba === 'clientes' ? 'Clientes' : 'Funcionários'} ({clientesFiltrados.length})</h2>
              <button
                onClick={handleRefreshData}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Atualizar lista de clientes"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {/* Espaço para futuros botões ou filtros */}
          </div>
          <div className="p-4 max-h-[340px] overflow-y-auto custom-scrollbar">
            {clientesFiltrados.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Nenhum {aba === 'clientes' ? 'cliente' : 'funcionário'} encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Mapeia e renderiza cada cliente em um card */}
                {clientesFiltrados.map((cliente) => (
                  <div key={cliente.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="text-xs font-semibold text-gray-900">{cliente.nome}</h3>
                      </div>
                      {/* Botões de Ação Rápida */}
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleVisualizarCliente(cliente)}
                          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleEditCliente(cliente)}
                          className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          title="Editar cliente"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteCliente(cliente)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Desativar cliente"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleEditarSaldo(cliente)}
                          className="p-1 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
                          title="Editar saldo devedor"
                        >
                          <Calculator className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Informações Financeiras do Cliente */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Saldo devedor:</span>
                        <span className={`font-medium ${cliente.saldo_devedor > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          R$ {cliente.saldo_devedor.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Limite disponível:</span>
                        <span className="font-medium text-gray-900">R$ {(Math.max(0, cliente.limite_credito - cliente.saldo_devedor)).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Botão de Pagamento */}
                    <div className="mt-2 flex space-x-2">
                      <button
                        onClick={() => handlePagamento(cliente)}
                        disabled={cliente.saldo_devedor <= 0}
                        className="flex-1 bg-green-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        <DollarSign className="h-3 w-3 inline mr-1" />
                        Pagamento
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabela com o Histórico de Todas as Movimentações */}
        <div id="area-impressao" className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Histórico de Movimentações</h2>
              <div className="flex flex-col md:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente..."
                    value={termoPesquisaHistorico}
                    onChange={(e) => setTermoPesquisaHistorico(e.target.value)}
                    className="w-full md:w-48 pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 no-print"
                  />
                </div>
                <div className="flex items-center gap-1 w-full md:w-auto">
                  <input
                    type="date"
                    value={dataPesquisaHistorico}
                    onChange={(e) => setDataPesquisaHistorico(e.target.value)}
                    className="flex-1 md:w-auto px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 no-print"
                  />
                  {dataPesquisaHistorico && (
                    <button
                      onClick={() => setDataPesquisaHistorico('')}
                      className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors no-print"
                      title="Limpar data"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <select
                  value={tipoPesquisaHistorico}
                  onChange={(e) => setTipoPesquisaHistorico(e.target.value)}
                  className="w-full md:w-auto px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 no-print"
                >
                  <option value="todos">Todos</option>
                  <option value="compra">Compra</option>
                  <option value="pagamento">Pagamento</option>
                </select>
                {aba === 'funcionarios' ? (
                  <select
                    value={'colaborador'}
                    disabled
                    className="w-full md:w-auto px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-700 no-print"
                    title="Filtro fixo na aba Funcionários"
                  >
                    <option value="colaborador">Somente Funcionários</option>
                  </select>
                ) : (
                  <select
                    value={filtroPessoaHistorico}
                    onChange={(e) => setFiltroPessoaHistorico(e.target.value as 'todos' | 'cliente' | 'colaborador')}
                    className="w-full md:w-auto px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 no-print"
                    title="Filtrar por tipo de pessoa"
                  >
                    <option value="todos">Todos (Cliente e Funcionário)</option>
                    <option value="cliente">Somente Clientes</option>
                    <option value="colaborador">Somente Funcionários</option>
                  </select>
                )}

                {/* Botões de Exportação */}
                <button
                  onClick={handleExportarPDF}
                  className="flex items-center justify-center p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors no-print"
                  title="Imprimir / Salvar como PDF"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCopiarWhatsApp}
                  className="flex items-center justify-center p-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors no-print"
                  title="Copiar para WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
                <button
                  onClick={handleExportarExcel}
                  className="flex items-center justify-center p-2 bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors no-print"
                  title="Exportar para Excel"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[450px] print:max-h-none print:overflow-visible">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Data/Hora
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Saldo Anterior
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Saldo Devedor
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Limite Atual
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Observações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movimentacoesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center">
                      <div className="text-gray-500">
                        <p className="text-sm font-medium mb-1">Nenhuma movimentação encontrada</p>
                        <p className="text-xs">Tente ajustar os filtros de pesquisa</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Mapeia e renderiza cada movimentação em uma linha da tabela
                  movimentacoesFiltradas.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-900">
                          {obterDataLocal(mov.created_at)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {obterHoraLocal(mov.created_at)}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs font-medium text-gray-900">
                          {clientes.find(c => c.id === mov.cliente_id)?.nome || 'Cliente não encontrado'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {clientes.find(c => c.id === mov.cliente_id)?.telefone || ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {/* Badge colorido para identificar o tipo de movimentação */}
                        <span className={`inline-flex px-1 py-0.5 text-xs font-semibold rounded-full ${mov.tipo === 'compra'
                          ? 'bg-red-100 text-red-800'
                          : (mov.observacoes?.includes('Ajuste de saldo')
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800')
                          }`}>
                          {mov.tipo === 'compra'
                            ? 'Compra'
                            : (mov.observacoes?.includes('Ajuste de saldo')
                              ? 'Ajuste'
                              : 'Pagamento')}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        R$ {mov.valor.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                        R$ {mov.saldo_anterior.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {typeof mov.saldo_devedor !== 'undefined' ? `R$ ${Number(mov.saldo_devedor).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {(() => {
                          const cliente = clientes.find(c => c.id === mov.cliente_id)
                          if (!cliente) return '-'
                          // Calcula limite disponível após a movimentação
                          const limite = Number(cliente.limite_credito) - Number(mov.saldo_atual)
                          return `R$ ${limite.toFixed(2)}`
                        })()}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-900">
                        {mov.observacoes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal para Adicionar ou Editar Cliente */}
        {showModalCliente && (
          <div className="modal-container">
            <div className="modal-content modal-md bg-white rounded-lg shadow-xl w-full">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {formCliente.id ? (tipoFormAtual === 'colaborador' ? 'Editar Funcionário' : 'Editar Cliente') : (tipoFormAtual === 'colaborador' ? 'Novo Funcionário' : 'Novo Cliente')}
                </h2>
                <form onSubmit={handleSubmitCliente} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900">Nome *</label>
                      <input
                        type="text"
                        required
                        value={formCliente.nome}
                        onChange={(e) => setFormCliente({ ...formCliente, nome: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">Telefone</label>
                      <input
                        type="text"
                        value={formCliente.telefone}
                        onChange={(e) => setFormCliente({ ...formCliente, telefone: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">CPF/CNPJ</label>
                      <input
                        type="text"
                        value={formCliente.cpf_cnpj}
                        onChange={(e) => setFormCliente({ ...formCliente, cpf_cnpj: e.target.value })}
                        placeholder="000.000.000-00"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Endereço</label>
                    <textarea
                      value={formCliente.endereco}
                      onChange={(e) => setFormCliente({ ...formCliente, endereco: e.target.value })}
                      rows={2}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Limite de Crédito (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formCliente.limite_credito}
                      onChange={(e) => setFormCliente({ ...formCliente, limite_credito: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Observações</label>
                    <textarea
                      value={formCliente.observacoes}
                      onChange={(e) => setFormCliente({ ...formCliente, observacoes: e.target.value })}
                      rows={2}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModalCliente(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      {formCliente.id ? 'Atualizar' : 'Cadastrar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal para Visualizar Dados do Cliente */}
        {showModalVisualizar && clienteParaVisualizar && (
          <div className="modal-container">
            <div className="modal-content modal-md bg-white rounded-lg shadow-xl w-full">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Dados do {clienteParaVisualizar.tipo === 'colaborador' ? 'Funcionário' : 'Cliente'}
                </h2>
                <div className="space-y-4">
                  {/* Identificação */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Identificação</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Nome:</span>
                        <span className="ml-2 font-medium text-gray-900">{clienteParaVisualizar.nome}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Tipo:</span>
                        <span className="ml-2 text-gray-900">{clienteParaVisualizar.tipo === 'colaborador' ? 'Funcionário' : 'Cliente'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Ativo:</span>
                        <span className="ml-2 text-gray-900">{clienteParaVisualizar.ativo ? 'Sim' : 'Não'}</span>
                      </div>
                    </div>
                  </div>
                  {/* Contato */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Contato</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Telefone:</span>
                        <span className="ml-2 text-gray-900">{clienteParaVisualizar.telefone || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">CPF/CNPJ:</span>
                        <span className="ml-2 text-gray-900">{clienteParaVisualizar.cpf_cnpj || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Endereço:</span>
                        <span className="ml-2 text-gray-900">{clienteParaVisualizar.endereco || '-'}</span>
                      </div>
                    </div>
                  </div>
                  {/* Financeiro */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Financeiro</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Limite de crédito:</span>
                        <span className="ml-2 font-medium text-gray-900">R$ {clienteParaVisualizar.limite_credito.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Saldo devedor:</span>
                        <span className={`ml-2 font-medium ${clienteParaVisualizar.saldo_devedor > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          R$ {clienteParaVisualizar.saldo_devedor.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Limite disponível:</span>
                        <span className="ml-2 font-medium text-gray-900">
                          R$ {(Math.max(0, clienteParaVisualizar.limite_credito - clienteParaVisualizar.saldo_devedor)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Observações */}
                  {(clienteParaVisualizar.observacoes != null && clienteParaVisualizar.observacoes !== '') && (
                    <div className="border-b border-gray-200 pb-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Observações</h3>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{clienteParaVisualizar.observacoes}</p>
                    </div>
                  )}
                  {/* Auditoria */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Auditoria</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Criado em:</span>
                        <span className="ml-2 text-gray-900">
                          {clienteParaVisualizar.created_at ? `${obterDataLocal(clienteParaVisualizar.created_at)} às ${obterHoraLocal(clienteParaVisualizar.created_at)}` : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Atualizado em:</span>
                        <span className="ml-2 text-gray-900">
                          {clienteParaVisualizar.updated_at ? `${obterDataLocal(clienteParaVisualizar.updated_at)} às ${obterHoraLocal(clienteParaVisualizar.updated_at)}` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModalVisualizar(false); setClienteParaVisualizar(null) }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para Registrar Pagamento */}
        {showModalPagamento && (
          <div className="modal-container">
            <div className="modal-content modal-sm bg-white rounded-lg shadow-xl w-full">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Registrar Pagamento</h2>
                {clienteSelecionado && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-900">Cliente: {clienteSelecionado.nome}</p>
                    <p className="text-xs text-blue-700">Saldo devedor: R$ {clienteSelecionado.saldo_devedor.toFixed(2)}</p>
                    <p className="text-xs text-blue-700">Limite disponível: R$ {(Math.max(0, clienteSelecionado.limite_credito - clienteSelecionado.saldo_devedor)).toFixed(2)}</p>
                    {/* Preview dinâmico conforme valor digitado */}
                    {(() => {
                      const valorDigitado = parseFloat(formPagamento.valor.replace(',', '.')) || 0
                      const isDinheiro = formPagamento.forma_pagamento === 'dinheiro'
                      const isCartao = formPagamento.forma_pagamento === 'debito' || formPagamento.forma_pagamento === 'credito'
                      const saldoApos = clienteSelecionado.saldo_devedor - valorDigitado
                      const limiteDispApos = Math.max(0, clienteSelecionado.limite_credito - saldoApos)
                      const troco = isDinheiro && !permitirSaldoCredor && valorDigitado > clienteSelecionado.saldo_devedor
                        ? valorDigitado - clienteSelecionado.saldo_devedor
                        : 0
                      const taxaNum = parseFloat(formPagamento.taxa_percentual) || 0
                      const valorTotalCartao = valorDigitado * (1 + taxaNum / 100)
                      if (valorDigitado > 0) {
                        return (
                          <div className="mt-2 text-xs text-blue-800">
                            {saldoApos >= 0 ? (
                              <>
                                <div>Saldo após pagamento: R$ {saldoApos.toFixed(2)}</div>
                                <div>Limite disponível após pagamento: R$ {limiteDispApos.toFixed(2)}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-medium text-green-700">Saldo credor (haver): R$ {Math.abs(saldoApos).toFixed(2)}</div>
                                {!isDinheiro && !permitirSaldoCredor && (
                                  <div className="mt-1 text-amber-700 font-medium">
                                    Para registrar, marque &quot;Permitir saldo credor (haver)&quot;.
                                  </div>
                                )}
                              </>
                            )}
                            {troco > 0 && (
                              <div className="mt-1 font-medium text-gray-900">Troco: R$ {troco.toFixed(2)}</div>
                            )}
                            {isCartao && (
                              <div className="mt-2 pt-2 border-t border-blue-200">
                                <div>Valor a abater na caderneta: R$ {valorDigitado.toFixed(2)}</div>
                                <div>Taxa: {taxaNum}%</div>
                                <div className="font-medium">Valor total a cobrar no cartão: R$ {valorTotalCartao.toFixed(2)}</div>
                              </div>
                            )}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                )}
                <form onSubmit={handleSubmitPagamento} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Data do Pagamento *</label>
                    <input
                      type="date"
                      required
                      value={formPagamento.data_pagamento}
                      onChange={(e) => setFormPagamento({ ...formPagamento, data_pagamento: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900">
                      {formPagamento.forma_pagamento === 'dinheiro' ? 'Valor Recebido (R$)' : 'Valor do Pagamento (R$)'} *
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      min="0.00001"
                      {...(formPagamento.forma_pagamento !== 'dinheiro' && !permitirSaldoCredor
                        ? { max: clienteSelecionado?.saldo_devedor || 0 }
                        : {})}
                      required
                      value={formPagamento.valor}
                      onChange={(e) => setFormPagamento({ ...formPagamento, valor: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  {formPagamento.forma_pagamento === 'dinheiro' && !permitirSaldoCredor && (parseFloat(formPagamento.valor.replace(',', '.')) || 0) > (clienteSelecionado?.saldo_devedor || 0) && (
                    <div className="p-3 bg-gray-100 border border-gray-200 rounded-md text-center">
                      <span className="text-xs font-medium text-gray-600 uppercase block mb-1">Troco</span>
                      <span className="text-xl font-bold text-gray-900">
                        R$ {((parseFloat(formPagamento.valor.replace(',', '.')) || 0) - (clienteSelecionado?.saldo_devedor || 0)).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Forma de Pagamento *</label>
                    <select
                      required
                      value={formPagamento.forma_pagamento}
                      onChange={(e) => {
                        const forma = e.target.value
                        const isCartao = forma === 'debito' || forma === 'credito'
                        setFormPagamento({
                          ...formPagamento,
                          forma_pagamento: forma,
                          taxa_percentual: isCartao ? '3' : '0'
                        })
                      }}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    >
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="debito">Cartão Débito</option>
                      <option value="credito">Cartão Crédito</option>
                    </select>
                  </div>
                  {(formPagamento.forma_pagamento === 'debito' || formPagamento.forma_pagamento === 'credito') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-900">Taxa (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="Ex: 3"
                        value={formPagamento.taxa_percentual}
                        onChange={(e) => setFormPagamento({ ...formPagamento, taxa_percentual: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="permitir-saldo-credor"
                      checked={permitirSaldoCredor}
                      onChange={(e) => setPermitirSaldoCredor(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="permitir-saldo-credor" className="text-sm font-medium text-gray-900">
                      Permitir saldo credor (haver)
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Observações</label>
                    <textarea
                      value={formPagamento.observacoes}
                      onChange={(e) => setFormPagamento({ ...formPagamento, observacoes: e.target.value })}
                      rows={2}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModalPagamento(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                    >
                      Registrar Pagamento
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal para Ajustar Saldo Devedor */}
        {showModalSaldo && (
          <div className="modal-container">
            <div className="modal-content modal-sm bg-white rounded-lg shadow-xl w-full">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Ajustar Saldo devedor</h2>
                {clienteSelecionado && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-900">Cliente: {clienteSelecionado.nome}</p>
                    <p className="text-xs text-blue-700">Saldo devedor atual: R$ {clienteSelecionado.saldo_devedor.toFixed(2)}</p>
                    <p className="text-xs text-blue-700">Limite disponível atual: R$ {(Math.max(0, clienteSelecionado.limite_credito - clienteSelecionado.saldo_devedor)).toFixed(2)}</p>
                    {/* Preview dinâmico de ajuste de saldo */}
                    {(() => {
                      const novoSaldoNum = parseFloat(formSaldo.novo_saldo as any)
                      if (!isNaN(novoSaldoNum)) {
                        const limiteDisp = Math.max(0, clienteSelecionado.limite_credito - novoSaldoNum)
                        return (
                          <div className="mt-2 text-xs text-blue-800">
                            <div>Novo saldo: R$ {novoSaldoNum.toFixed(2)}</div>
                            <div>Limite disponível após ajuste: R$ {limiteDisp.toFixed(2)}</div>
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                )}
                <form onSubmit={handleSubmitSaldo} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Data do Ajuste *</label>
                    <input
                      type="date"
                      required
                      value={formSaldo.data_ajuste}
                      onChange={(e) => setFormSaldo({ ...formSaldo, data_ajuste: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Novo Saldo devedor (R$) *</label>
                    <input
                      type="number"
                      step="0.00001"
                      min="0"
                      required
                      value={formSaldo.novo_saldo}
                      onChange={(e) => setFormSaldo({ ...formSaldo, novo_saldo: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900">Observações</label>
                    <textarea
                      value={formSaldo.observacoes}
                      onChange={(e) => setFormSaldo({ ...formSaldo, observacoes: e.target.value })}
                      rows={2}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModalSaldo(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700"
                    >
                      Ajustar Saldo
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação Genérico para Ações Destrutivas */}
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
                      setShowConfirmModal(false);
                      setConfirmAction(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmAction) {
                        confirmAction();
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

        {/* Componente Toast para feedback ao usuário. É renderizado condicionalmente. */}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
  )
}
