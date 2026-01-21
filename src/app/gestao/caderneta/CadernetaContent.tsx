"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ClienteCaderneta, MovimentacaoCaderneta } from '@/lib/supabase'
import Toast from '@/app/gestao/caderneta/Toast'
import { Plus, Users, DollarSign, CreditCard, Search, Edit, Trash2, Calculator, WifiOff, RefreshCw, X, Download, FileText, MessageCircle, FileSpreadsheet, Printer } from 'lucide-react'
import { useCadernetaOffline } from '@/hooks/useCadernetaOffline'

export default function CadernetaContent() {
  const {
    clientes,
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

  const [caixaAberto, setCaixaAberto] = useState(false)

  const getSupabase = () => {
    if (!supabase) throw new Error('Supabase não inicializado')
    return supabase
  }

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
      console.error('Erro ao verificar caixa aberto:', err)
      setCaixaAberto(false)
      return false
    }
  }

  const [showModalCliente, setShowModalCliente] = useState(false)
  const [showModalPagamento, setShowModalPagamento] = useState(false)
  const [showModalSaldo, setShowModalSaldo] = useState(false)

  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteCaderneta | null>(null)
  const [termoPesquisa, setTermoPesquisa] = useState('')
  const [clientesFiltrados, setClientesFiltrados] = useState<ClienteCaderneta[]>([])
  const [aba, setAba] = useState<'clientes' | 'funcionarios'>('clientes')
  const [tipoFormAtual, setTipoFormAtual] = useState<'cliente' | 'colaborador'>('cliente')

  const [termoPesquisaHistorico, setTermoPesquisaHistorico] = useState('')
  const [dataPesquisaHistorico, setDataPesquisaHistorico] = useState('')
  const [tipoPesquisaHistorico, setTipoPesquisaHistorico] = useState('todos')
  const [filtroPessoaHistorico, setFiltroPessoaHistorico] = useState<'todos' | 'cliente' | 'colaborador'>('todos')

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ message, type });
  };

  const [formCliente, setFormCliente] = useState({
    id: '',
    nome: '',
    telefone: '',
    endereco: '',
    limite_credito: '',
    saldo_devedor: '0',
    observacoes: ''
  })

  const [formPagamento, setFormPagamento] = useState({
    cliente_id: '',
    valor: '',
    data_pagamento: new Date().toISOString().split('T')[0],
    forma_pagamento: 'dinheiro',
    observacoes: ''
  })

  const [formSaldo, setFormSaldo] = useState({
    cliente_id: '',
    saldo_atual: '',
    novo_saldo: '',
    observacoes: '',
    data_ajuste: new Date().toISOString().split('T')[0]
  })

  const [previewLimiteCredito, setPreviewLimiteCredito] = useState<number | undefined>(undefined)

  useEffect(() => {
    carregarDados()
    verificarCaixaAberto()
  }, [])

  useEffect(() => {
    filtrarClientes()
  }, [termoPesquisa, clientes, aba])

  useEffect(() => {
    if (aba === 'funcionarios') {
      setFiltroPessoaHistorico('colaborador')
    } else {
      setFiltroPessoaHistorico(prev => (prev === 'colaborador' ? 'todos' : prev))
    }
  }, [aba])

  const carregarDados = async () => { console.log('Dados de caderneta gerenciados pelo hook offline') }

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

  const handleRefreshData = async () => {
    showToast('Atualizando dados...', 'info')
    await Promise.all([refreshClientes(), refreshMovimentacoes()])
    showToast('Clientes atualizados com sucesso!', 'success')
  }

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const dadosCliente = {
        nome: formCliente.nome,
        telefone: formCliente.telefone || undefined,
        endereco: formCliente.endereco || undefined,
        limite_credito: parseFloat(formCliente.limite_credito) || 0,
        saldo_devedor: formCliente.saldo_devedor ? parseFloat(formCliente.saldo_devedor) : 0,
        observacoes: formCliente.observacoes || undefined
      }
      let result;
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

  const handleSubmitPagamento = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const valorPagamento = parseFloat(formPagamento.valor)
      if (valorPagamento <= 0) { showToast('O valor do pagamento deve ser maior que zero.', 'warning'); return }
      const cliente = clientes.find(c => c.id.toString() === formPagamento.cliente_id)
      if (!cliente) { showToast('Cliente não encontrado.', 'error'); return }
      if (valorPagamento > cliente.saldo_devedor) { showToast('O valor do pagamento não pode ser maior que o saldo devedor.', 'warning'); return }
      const { data: caixa, error: caixaError } = await getSupabase()
        .from('caixa_diario')
        .select('id, status, total_entradas, valor_saidas, total_caderneta, data')
        .eq('data', formPagamento.data_pagamento)
        .maybeSingle()
      if (caixaError && caixaError.code !== 'PGRST116' && caixaError.code !== '22P02') throw caixaError
      if (!caixa || (caixa as any).status !== 'aberto') {
        try {
          const { data: abertoAny, error: abertoErr } = await getSupabase()
            .from('caixa_diario')
            .select('id, status, data')
            .eq('status', 'aberto')
            .limit(1)
            .maybeSingle()
          if (!abertoErr && abertoAny && (abertoAny as any).status === 'aberto') {
            showToast(`ATENÇÃO: existe um caixa aberto para ${abertoAny.data}. Registrando pagamento usando esse caixa.`, 'warning')
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
      const result = await registrarPagamento(
        cliente.id,
        valorPagamento,
        formPagamento.observacoes || 'Pagamento registrado',
        { data_pagamento: formPagamento.data_pagamento, forma_pagamento: formPagamento.forma_pagamento }
      )
      if (!result.success) throw new Error(result.message || 'Erro ao registrar pagamento.')
      setShowModalPagamento(false)
      resetPagamentoForm()
      showToast(result.message || 'Pagamento registrado com sucesso!', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log('Erro ao registrar pagamento:', errorMessage)
      showToast('Erro ao registrar pagamento. Verifique o console para mais detalhes.', 'error');
    }
  }

  const handleEditCliente = (cliente: ClienteCaderneta) => {
    setFormCliente({
      id: cliente.id.toString(),
      nome: cliente.nome,
      telefone: cliente.telefone || '',
      endereco: cliente.endereco || '',
      limite_credito: cliente.limite_credito.toString(),
      saldo_devedor: cliente.saldo_devedor.toString(),
      observacoes: cliente.observacoes || ''
    })
    setTipoFormAtual(cliente.tipo)
    setShowModalCliente(true)
  }

  const handleDeleteCliente = (cliente: ClienteCaderneta) => {
    const rotulo = cliente.tipo === 'colaborador' ? 'Funcionário' : 'Cliente'
    setConfirmTitle(`Desativar ${rotulo}`);
    setConfirmMessage(`Tem certeza que deseja DESATIVAR o ${rotulo.toLowerCase()} "${cliente.nome}"? O registro será removido da lista, mas o histórico será preservado.`);
    setConfirmAction(() => async () => {
      try {
        if (cliente.saldo_devedor > 0) { showToast(`Não é possível desativar ${rotulo.toLowerCase()} "${cliente.nome}" pois possui saldo devedor de R$ ${cliente.saldo_devedor.toFixed(2)}. Primeiro, ajuste o saldo para zero.`, 'warning'); return }
        const result = await toggleClienteAtivo(cliente.id);
        if (!result.success) throw new Error(result.message || 'Erro ao desativar cliente.');
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

  const handlePagamento = (cliente: ClienteCaderneta) => {
    ; (async () => {
      const aberto = await verificarCaixaAberto()
      if (!aberto) { showToast('CAIXA FECHADO: Abra o caixa no PDV antes de registrar pagamentos.', 'error'); return }
      setClienteSelecionado(cliente)
      setFormPagamento({ cliente_id: cliente.id.toString(), valor: '', data_pagamento: new Date().toISOString().split('T')[0], forma_pagamento: 'dinheiro', observacoes: '' })
      setShowModalPagamento(true)
    })()
  }

  const handleEditarSaldo = (cliente: ClienteCaderneta) => {
    setClienteSelecionado(cliente)
    setFormSaldo({ cliente_id: cliente.id.toString(), saldo_atual: cliente.saldo_devedor.toFixed(2), novo_saldo: '', observacoes: '', data_ajuste: new Date().toISOString().split('T')[0] })
    setShowModalSaldo(true)
  }

  const handleSubmitSaldo = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const novoSaldoNum = parseFloat(formSaldo.novo_saldo)
      if (isNaN(novoSaldoNum) || novoSaldoNum < 0) { showToast('O novo saldo devedor deve ser um número positivo ou zero.', 'warning'); return }
      const clienteIdNum = Number(formSaldo.cliente_id)
      const cliente = clientes.find(c => c.id === clienteIdNum)
      if (!cliente) { showToast('Cliente não encontrado.', 'error'); return }
      const saldoAtual = cliente.saldo_devedor
      const diferenca = novoSaldoNum - saldoAtual
      if (diferenca === 0) { showToast('O novo saldo é igual ao saldo atual. Nenhuma alteração necessária.', 'info'); setShowModalSaldo(false); return }
      const result = await adicionarMovimentacao({ cliente_id: clienteIdNum, tipo: diferenca < 0 ? 'pagamento' : 'compra', valor: Math.abs(diferenca), observacoes: formSaldo.observacoes || `Ajuste de saldo para R$ ${novoSaldoNum.toFixed(2)}` })
      if (!result.success) throw new Error(result.message || 'Erro ao ajustar saldo.')
      setShowModalSaldo(false)
      resetSaldoForm()
      showToast(result.message || 'Saldo devedor ajustado com sucesso!', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.log('Erro ao registrar ajuste de saldo:', errorMessage)
      showToast('Erro ao registrar ajuste de saldo. Verifique o console para mais detalhes.', 'error');
    }
  }

  const resetClienteForm = () => { setFormCliente({ id: '', nome: '', telefone: '', endereco: '', limite_credito: '', saldo_devedor: '0', observacoes: '' }) }
  const resetPagamentoForm = () => { setFormPagamento({ cliente_id: '', valor: '', data_pagamento: new Date().toISOString().split('T')[0], forma_pagamento: 'dinheiro', observacoes: '' }); setClienteSelecionado(null) }
  const resetSaldoForm = () => { setFormSaldo({ cliente_id: '', saldo_atual: '', novo_saldo: '', observacoes: '', data_ajuste: new Date().toISOString().split('T')[0] }); setClienteSelecionado(null) }

  const obterDataLocal = (dataISO: string): string => { const data = new Date(dataISO); return data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) }
  const obterHoraLocal = (dataISO: string): string => { const data = new Date(dataISO); return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) }

  const movimentacoesFiltradas = movimentacoes.filter(mov => {
    const cliente = clientes.find(c => c.id === mov.cliente_id)
    const nomeCliente = cliente?.nome.toLowerCase() || ''
    const termo = termoPesquisaHistorico.toLowerCase()
    const matchNome = nomeCliente.includes(termo)
    let matchData = true
    if (dataPesquisaHistorico) {
      const dataMovStr = obterDataLocal(mov.created_at)
      const [ano, mes, dia] = dataPesquisaHistorico.split('-')
      const dataPesquisaStr = `${dia}/${mes}/${ano}`
      matchData = dataMovStr === dataPesquisaStr
    }
    const matchTipo = tipoPesquisaHistorico === 'todos' ? true : mov.tipo === tipoPesquisaHistorico
    const matchPessoa = filtroPessoaHistorico === 'todos' ? true : cliente?.tipo === filtroPessoaHistorico
    return matchNome && matchData && matchTipo && matchPessoa
  })

  const handleExportarExcel = () => {
    if (movimentacoesFiltradas.length === 0) { showToast('Não há dados para exportar com os filtros atuais.', 'warning'); return }
    const csvHeader = 'Data;Hora;Cliente;Tipo;Valor;Saldo Anterior;Saldo Atual;Observações\n'
    const csvRows = movimentacoesFiltradas.map(mov => {
      const cliente = clientes.find(c => c.id === mov.cliente_id)
      const data = obterDataLocal(mov.created_at)
      const hora = obterHoraLocal(mov.created_at)
      const tipo = mov.tipo === 'compra' ? 'Compra' : (mov.observacoes?.includes('Ajuste de saldo') ? 'Ajuste' : 'Pagamento')
      const valor = mov.valor.toFixed(2).replace('.', ',')
      const saldoAnt = mov.saldo_anterior.toFixed(2).replace('.', ',')
      const saldoAtu = mov.saldo_atual.toFixed(2).replace('.', ',')
      const obs = (mov.observacoes || '').replace(/;/g, ' ').replace(/\n/g, ' ')
      return `${data};${hora};${cliente?.nome || 'N/A'};${tipo};${valor};${saldoAnt};${saldoAtu};${obs}`
    }).join('\n')
    const csvContent = `\uFEFF${csvHeader}${csvRows}`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `historico_caderneta_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopiarWhatsApp = () => {
    if (movimentacoesFiltradas.length === 0) { showToast('Não há dados para copiar.', 'warning'); return }
    let texto = `*EXTRATO CADERNETA - REY DOS PÃES*\n`
    texto += `Data: ${new Date().toLocaleDateString('pt-BR')}\n`
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
    const totalCompras = movimentacoesFiltradas.filter(m => m.tipo === 'compra').reduce((acc, curr) => acc + curr.valor, 0)
    const totalPagos = movimentacoesFiltradas.filter(m => m.tipo === 'pagamento').reduce((acc, curr) => acc + curr.valor, 0)
    texto += `*RESUMO DO PERÍODO*\n`
    texto += `Total Compras: R$ ${totalCompras.toFixed(2).replace('.', ',')}\n`
    texto += `Total Pagos: R$ ${totalPagos.toFixed(2).replace('.', ',')}\n`
    navigator.clipboard.writeText(texto).then(() => showToast('Relatório copiado! Cole no WhatsApp.', 'success')).catch(() => showToast('Erro ao copiar texto.', 'error'))
  }

  const handleExportarPDF = () => { window.print() }

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
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #area-impressao, #area-impressao * { visibility: visible; }
          #area-impressao { position: absolute; left: 0; top: 0; width: 100%; background: white; padding: 20px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-6 gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caderneta</h1>
          <p className="text-sm text-gray-600 mt-1">Gerencie clientes e colaboradores com crédito</p>
          <div className="mt-3 inline-flex rounded-md border border-gray-200 overflow-hidden">
            <button onClick={() => setAba('clientes')} className={`px-3 py-1.5 text-sm ${aba === 'clientes' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Clientes</button>
            <button onClick={() => setAba('funcionarios')} className={`px-3 py-1.5 text-sm border-l border-gray-200 ${aba === 'funcionarios' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Funcionários</button>
          </div>
        </div>
        <button onClick={() => { setTipoFormAtual(aba === 'clientes' ? 'cliente' : 'colaborador'); setShowModalCliente(true) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2 w-full lg:w-auto text-sm">
          <Plus className="h-4 w-4" />
          <span>{aba === 'clientes' ? 'Novo Cliente' : 'Novo Funcionário'}</span>
        </button>
      </div>

      <div className="mb-6 no-print">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
          <input type="text" placeholder={aba === 'clientes' ? 'Pesquisar clientes por nome, telefone ou endereço...' : 'Pesquisar funcionários por nome, telefone ou endereço...'} value={termoPesquisa} onChange={(e) => setTermoPesquisa(e.target.value)} className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 no-print">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">{aba === 'clientes' ? 'Clientes' : 'Funcionários'} ({clientesFiltrados.length})</h2>
            <button onClick={handleRefreshData} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Atualizar lista de clientes"><RefreshCw className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="p-4 max-h-[340px] overflow-y-auto custom-scrollbar">
          {clientesFiltrados.length === 0 ? (
            <div className="text-center py-6"><Users className="h-10 w-10 text-gray-400 mx-auto mb-2" /><p className="text-sm text-gray-500">Nenhum {aba === 'clientes' ? 'cliente' : 'funcionário'} encontrado</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {clientesFiltrados.map((cliente) => (
                <div key={cliente.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1"><h3 className="text-xs font-semibold text-gray-900">{cliente.nome}</h3>{cliente.telefone && (<p className="text-xs text-gray-600">{cliente.telefone}</p>)}</div>
                    <div className="flex space-x-1">
                      <button onClick={() => handleEditCliente(cliente)} className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors" title="Editar cliente"><Edit className="h-3 w-3" /></button>
                      <button onClick={() => handleDeleteCliente(cliente)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title="Desativar cliente"><Trash2 className="h-3 w-3" /></button>
                      <button onClick={() => handleEditarSaldo(cliente)} className="p-1 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors" title="Editar saldo devedor"><Calculator className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-600">Saldo devedor:</span><span className={`font-medium ${cliente.saldo_devedor > 0 ? 'text-red-600' : 'text-green-600'}`}>R$ {cliente.saldo_devedor.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Limite disponível:</span><span className="font-medium text-gray-900">R$ {(Math.max(0, cliente.limite_credito - cliente.saldo_devedor)).toFixed(2)}</span></div>
                    {cliente.endereco && (<div className="text-gray-600 text-xs">{cliente.endereco}</div>)}
                  </div>
                  <div className="mt-2 flex space-x-2">
                    <button onClick={() => handlePagamento(cliente)} disabled={cliente.saldo_devedor <= 0} className="flex-1 bg-green-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"><DollarSign className="h-3 w-3 inline mr-1" />Pagamento</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div id="area-impressao" className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Histórico de Movimentações</h2>
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                <input type="text" placeholder="Buscar por cliente..." value={termoPesquisaHistorico} onChange={(e) => setTermoPesquisaHistorico(e.target.value)} className="w-full md:w-48 pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 no-print" />
              </div>
              <div className="flex items-center gap-1 w-full md:w-auto">
                <input type="date" value={dataPesquisaHistorico} onChange={(e) => setDataPesquisaHistorico(e.target.value)} className="flex-1 md:w-auto px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 no-print" />
                {dataPesquisaHistorico && (<button onClick={() => setDataPesquisaHistorico('')} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors no-print" title="Limpar data"><X className="h-4 w-4" /></button>)}
              </div>
              <select value={tipoPesquisaHistorico} onChange={(e) => setTipoPesquisaHistorico(e.target.value)} className="w-full md:w-auto px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 no-print">
                <option value="todos">Todos</option>
                <option value="compra">Compra</option>
                <option value="pagamento">Pagamento</option>
              </select>
              {aba === 'funcionarios' ? (
                <select value={'colaborador'} disabled className="w-full md:w-auto px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-700 no-print" title="Filtro fixo na aba Funcionários"><option value="colaborador">Somente Funcionários</option></select>
              ) : (
                <select value={filtroPessoaHistorico} onChange={(e) => setFiltroPessoaHistorico(e.target.value as 'todos' | 'cliente' | 'colaborador')} className="w-full md:w-auto px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 no-print" title="Filtrar por tipo de pessoa">
                  <option value="todos">Todos (Cliente e Funcionário)</option>
                  <option value="cliente">Somente Clientes</option>
                  <option value="colaborador">Somente Funcionários</option>
                </select>
              )}
              <button onClick={handleExportarPDF} className="flex items-center justify-center p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors no-print" title="Imprimir / Salvar como PDF"><Printer className="h-4 w-4" /></button>
              <button onClick={handleCopiarWhatsApp} className="flex items-center justify-center p-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors no-print" title="Copiar para WhatsApp"><MessageCircle className="h-4 w-4" /></button>
              <button onClick={handleExportarExcel} className="flex items-center justify-center p-2 bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors no-print" title="Exportar para Excel"><FileSpreadsheet className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[450px] print:max-h-none print:overflow-visible">
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Data/Hora</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Cliente</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tipo</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Valor</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Saldo Anterior</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Saldo Atual</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Observações</th></tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movimentacoesFiltradas.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center"><div className="text-gray-500"><p className="text-sm font-medium mb-1">Nenhuma movimentação encontrada</p><p className="text-xs">Tente ajustar os filtros de pesquisa</p></div></td></tr>
              ) : (
                movimentacoesFiltradas.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50"><td className="px-3 py-2 whitespace-nowrap"><div className="text-xs text-gray-900">{obterDataLocal(mov.created_at)}</div><div className="text-xs text-gray-500">{obterHoraLocal(mov.created_at)}</div></td><td className="px-3 py-2 whitespace-nowrap"><div className="text-xs font-medium text-gray-900">{clientes.find(c => c.id === mov.cliente_id)?.nome || 'Cliente não encontrado'}</div><div className="text-xs text-gray-500">{clientes.find(c => c.id === mov.cliente_id)?.telefone || ''}</div></td><td className="px-3 py-2 whitespace-nowrap"><span className={`inline-flex px-1 py-0.5 text-xs font-semibold rounded-full ${mov.tipo === 'compra' ? 'bg-red-100 text-red-800' : (mov.observacoes?.includes('Ajuste de saldo') ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800')}`}>{mov.tipo === 'compra' ? 'Compra' : (mov.observacoes?.includes('Ajuste de saldo') ? 'Ajuste' : 'Pagamento')}</span></td><td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">R$ {mov.valor.toFixed(2)}</td><td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">R$ {mov.saldo_anterior.toFixed(2)}</td><td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">R$ {mov.saldo_atual.toFixed(2)}</td><td className="px-3 py-2 text-xs text-gray-900">{mov.observacoes || '-'}</td></tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais e Toasts – mantidos por simplicidade; lógica ligada ao hook offline */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
