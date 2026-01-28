'use client'
import React, { useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';

type Colaborador = {
  id: number;
  nome: string;
  idade: number;
  endereco: string;
  telefone: string;
};
import { 
  Users, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  ChevronRight, 
  Calendar,
  DollarSign,
  CreditCard,
  QrCode,
  XCircle,
  FileText,
  Printer,
  CalendarDays,
  ArrowRightLeft,
  Lock,
  Package,
  ReceiptText,
  Pencil,
  Trash2
} from 'lucide-react';
// removerColaborador foi movida para dentro do componente para ter acesso a carregarColaboradores e ao estado local.

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase/client';

// Estrutura dos dados agregados para exibir na UI
type TurnoUI = {
  id: number;
  operador: string;
  caixa: string;
  inicio: string;
  fim: string | null;
  tipoEncerramento: string | null;
  saldoInicial: number;
  vendas: number;
  sangrias: number;
  saldoEsperado: number;
  saldoContado: number;
  diferenca: number;
  pagamentos: { dinheiro: number; pix: number; cartao: number };
  cancelamentos: number;
  itensVendidos: { nome: string; qtd: number; total: number }[];
};


export default function GestaoOperadores() {
  const [activeTab, setActiveTab] = useState<'turnos' | 'desempenho' | 'colaboradores'>('turnos');
  const [selectedTurno, setSelectedTurno] = useState<TurnoUI | null>(null);
  const [modalTab, setModalTab] = useState<'financeiro' | 'itens'>('financeiro');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [turnos, setTurnos] = useState<TurnoUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalNovoColab, setModalNovoColab] = useState(false);
  const [novoColab, setNovoColab] = useState<Colaborador>({ id: 0, nome: '', idade: 0, endereco: '', telefone: '' });
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  // Modal de confirmação de remoção
  const [modalRemoverColab, setModalRemoverColab] = useState<{ open: boolean, colab: Colaborador | null }>({ open: false, colab: null });
  // Função para recarregar colaboradores do banco
    const carregarColaboradores = async () => {
      const { data: colaboradoresDb, error: colabError } = await supabase
        .from('funcionario')
        .select('id, nome, idade, endereco, telefone')
        .order('nome', { ascending: true });
      if (!colabError && colaboradoresDb) setColaboradores(colaboradoresDb);
      else setColaboradores([]);
    };
  
    // Função para remover colaborador do banco (chamada após confirmação no modal)
    const removerColaborador = async (id: number) => {
      const { error } = await supabase.from('funcionario').delete().eq('id', id);
      if (!error) {
        await carregarColaboradores();
        toast.success('Colaborador removido com sucesso!');
      } else {
        toast.error('Erro ao remover colaborador: ' + (error.message || error.details || ''));
      }
      setModalRemoverColab({ open: false, colab: null });
    };
  
  
    useEffect(() => {
      async function fetchData() {
        setLoading(true);
        await carregarColaboradores();

      // Buscar todos os turnos do dia filtrado
      const { data: turnosRaw, error } = await supabase
        .from('turno_operador')
        .select('*')
        .gte('data_inicio', `${filterDate}T00:00:00`)
        .lte('data_inicio', `${filterDate}T23:59:59`)
        .order('data_inicio', { ascending: true });
      if (error || !turnosRaw) {
        setTurnos([]);
        setLoading(false);
        return;
      }

      // Buscar dados de caixa_diario para cada turno
      const caixaIds = Array.from(new Set(turnosRaw.map((t: any) => t.caixa_diario_id)));
      const validCaixaIdsForCaixas = caixaIds.filter(id => id !== null && id !== undefined);
      const { data: caixas } = await supabase
        .from('caixa_diario')
        .select('id, usuario_abertura, usuario_fechamento, valor_abertura, valor_fechamento, total_vendas, total_pix, total_dinheiro, total_debito, total_credito, total_entradas, total_caderneta')
        .in('id', validCaixaIdsForCaixas.length ? validCaixaIdsForCaixas : [0]);
      const caixaMap = new Map((caixas || []).map((c: any) => [c.id, c]));

      // Buscar vendas do dia (mais robusto que filtrar por ID de caixa no query)
      // Buscamos um range de 2 dias para garantir turnos que viram a noite
      const startDate = new Date(filterDate);
      startDate.setDate(startDate.getDate() - 1);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const vendasResp = await supabase
        .from('vendas')
        .select('id, caixa_diario_id, valor_total, forma_pagamento, created_at, operador_nome, usuario')
        .gte('data', startDateStr)
        .lte('data', filterDate);
      const vendas = vendasResp.data || [];

      // Buscar itens vendidos por venda
      const vendaIds = vendas.map((v: any) => v.id);
      const { data: itensVendidosRaw } = await supabase
        .from('venda_itens')
        .select('venda_id, quantidade, preco_unitario, varejo_id, item_id, tipo')
        .in('venda_id', vendaIds.length ? vendaIds : [0]);

      // Buscar nomes dos produtos/receitas
      const receitaIds = Array.from(new Set((itensVendidosRaw || []).filter(i => i.tipo === 'receita').map(i => i.item_id)));
      const varejoIds = Array.from(new Set((itensVendidosRaw || []).filter(i => i.tipo === 'varejo').map(i => i.varejo_id || i.item_id)));
      
      const [receitasResp, varejoResp, sangriasResp] = await Promise.all([
        receitaIds.length ? supabase.from('receitas').select('id, nome').in('id', receitaIds) : Promise.resolve({ data: [] }),
        varejoIds.length ? supabase.from('varejo').select('id, nome').in('id', varejoIds) : Promise.resolve({ data: [] }),
        supabase.from('fluxo_caixa').select('caixa_diario_id, valor, usuario, created_at')
          .gte('data', startDateStr)
          .lte('data', filterDate)
          .eq('tipo', 'saida')
      ]);
      const receitasMap = new Map((receitasResp.data || []).map((r: any) => [r.id, r.nome]));
      const varejoMap = new Map((varejoResp.data || []).map((v: any) => [v.id, v.nome]));
      const sangrias = sangriasResp.data || [];

      // Montar estrutura final dos turnos
      const turnosUI: TurnoUI[] = turnosRaw.map((t: any) => {
        const caixa = caixaMap.get(t.caixa_diario_id);
        
        // Normalização de datas para evitar problemas de fuso horário
        const parseDate = (d: string | null) => {
          if (!d) return null;
          // Se a data não terminar com Z e não tiver offset, assume que é UTC vindo do banco
          const iso = (d.includes('Z') || d.includes('+') || d.includes('-')) ? d : `${d.replace(' ', 'T')}Z`;
          return new Date(iso).getTime();
        };

        const shiftStart = parseDate(t.data_inicio) || 0;
        const shiftEnd = parseDate(t.data_fim) || new Date().getTime();

        const vendasTurno = vendas.filter((v: any) => {
          const vTime = new Date(v.created_at).getTime();
          const opNomeTurno = (t.operador_nome || '').trim().toLowerCase();
          const opNomeVenda = (v.operador_nome || v.usuario || '').trim().toLowerCase();

          // 1. Match obrigatório: horário do turno (com margem de 10s para segurança)
          const matchHorario = vTime >= (shiftStart - 10000) && vTime <= (shiftEnd + 10000);
          
          // 2. Vínculo por Caixa ou por Operador
          const matchCaixa = v.caixa_diario_id && t.caixa_diario_id ? v.caixa_diario_id === t.caixa_diario_id : true;
          const matchOperador = opNomeVenda === opNomeTurno || !opNomeVenda; 

          return matchHorario && matchCaixa && matchOperador;
        });

        // Sangrias deste operador neste turno
        const sangriasTurno = sangrias.filter((s: any) => {
          const sTime = new Date(s.created_at).getTime();
          const userSangria = (s.usuario || '').trim().toLowerCase();
          const opNomeTurno = (t.operador_nome || '').trim().toLowerCase();

          const matchHorario = sTime >= (shiftStart - 10000) && sTime <= (shiftEnd + 10000);
          const matchCaixa = s.caixa_diario_id && t.caixa_diario_id ? s.caixa_diario_id === t.caixa_diario_id : true;
          const matchOperador = userSangria === opNomeTurno || !userSangria;

          return matchHorario && matchCaixa && matchOperador;
        });
        const sangriasTotal = sangriasTurno.reduce((acc: number, s: any) => acc + (s.valor || 0), 0);

        const vendasTotal = vendasTurno.reduce((acc: number, v: any) => acc + (v.valor_total || 0), 0);
        // Itens vendidos deste operador
        const vendaIdsTurno = vendasTurno.map((v: any) => v.id);
        const itensTurno = (itensVendidosRaw || []).filter((i: any) => vendaIdsTurno.includes(i.venda_id));
        // Agrupar itens por nome
        const itensVendidos = Object.values(
          itensTurno.reduce((acc: any, item: any) => {
            const nome = item.tipo === 'receita' ? receitasMap.get(item.item_id) : varejoMap.get(item.varejo_id || item.item_id);
            if (!nome) return acc;
            if (!acc[nome]) acc[nome] = { nome, qtd: 0, total: 0 };
            acc[nome].qtd += item.quantidade;
            acc[nome].total += item.quantidade * item.preco_unitario;
            return acc;
          }, {})
        ) as { nome: string; qtd: number; total: number }[];
        // Pagamentos
        const pagamentos = { dinheiro: 0, pix: 0, cartao: 0 };
        vendasTurno.forEach((v: any) => {
          const forma = String(v.forma_pagamento || '').toLowerCase();
          const valor = Number(v.valor_total || 0);
          if (forma.includes('dinheiro')) pagamentos.dinheiro += valor;
          else if (forma.includes('pix')) pagamentos.pix += valor;
          else if (forma.includes('cartao') || forma.includes('debito') || forma.includes('credito')) pagamentos.cartao += valor;
        });

        // Tentar buscar saldo contado se for o fechamento final do caixa
        const isUltimoTurno = t.status === 'finalizado' && caixa?.usuario_fechamento === t.operador_nome;
        const saldoInformado = isUltimoTurno ? (caixa?.valor_fechamento || 0) : (t.valor_fechamento || 0);
        
        const sistemaEsperava = vendasTotal - sangriasTotal + (t.valor_abertura || (caixa?.valor_abertura || 0));

        return {
          id: t.id,
          operador: t.operador_nome,
          caixa: t.caixa_diario_id ? `Caixa #${t.caixa_diario_id}` : 'Sem Caixa',
          inicio: t.data_inicio,
          fim: t.data_fim,
          tipoEncerramento: t.status === 'finalizado' ? 'fechamento_caixa' : t.status === 'aberto' ? null : t.status,
          saldoInicial: t.valor_abertura || (caixa?.valor_abertura || 0),
          vendas: vendasTotal,
          sangrias: sangriasTotal,
          saldoEsperado: sistemaEsperava,
          saldoContado: saldoInformado,
          diferenca: t.diferenca || (saldoInformado ? (saldoInformado - sistemaEsperava) : 0),
          pagamentos,
          cancelamentos: 0, 
          itensVendidos,
        };
      });
      setTurnos(turnosUI);
      setLoading(false);
    }
    fetchData();
  }, [filterDate]);

  const turnosFiltrados = useMemo(() => {
    return turnos.filter(t => {
      const matchesSearch = t.operador.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.caixa.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = filterDate ? t.inicio.startsWith(filterDate) : true;
      return matchesSearch && matchesDate;
    });
  }, [searchTerm, filterDate, turnos]);

  const stats = useMemo(() => {
    const totalVendas = turnosFiltrados.reduce((acc, t) => acc + t.vendas, 0);
    const turnosComDiferenca = turnosFiltrados.filter(t => t.diferenca !== 0).length;
    const turnosAtivos = turnosFiltrados.filter(t => !t.fim).length;
    return [
      { label: 'Vendas no Período', value: `R$ ${totalVendas.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Quebras de Caixa', value: turnosComDiferenca.toString(), icon: AlertTriangle, color: turnosComDiferenca > 0 ? 'text-red-600' : 'text-slate-400', bg: turnosComDiferenca > 0 ? 'bg-red-50' : 'bg-slate-50' },
      { label: 'Turnos no Filtro', value: turnosFiltrados.length.toString(), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Em Operação', value: turnosAtivos.toString(), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    ];
  }, [turnosFiltrados]);

  const rankingOperadores = useMemo(() => {
    const performance: Record<string, { vendas: number, diferenca: number, turnos: number }> = {};
    turnosFiltrados.forEach(t => {
      if (!performance[t.operador]) performance[t.operador] = { vendas: 0, diferenca: 0, turnos: 0 };
      performance[t.operador].vendas += t.vendas;
      performance[t.operador].diferenca += t.diferenca;
      performance[t.operador].turnos += 1;
    });
    return Object.entries(performance)
      .map(([nome, dados]) => ({ nome, ...dados }))
      .sort((a, b) => b.vendas - a.vendas);
  }, [turnosFiltrados]);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <main className="main-content flex-1 overflow-x-auto">
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
          {/* Conteúdo real da página */}
          <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                <Users className="w-8 h-8 text-blue-600" />
                Auditoria e Gestão de Operadores
              </h1>
              <p className="text-slate-500">Módulo de controlo financeiro e conferência de itens por operador.</p>
            </div>
            <button
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-xl shadow transition-all active:scale-[0.98]"
              onClick={() => setModalNovoColab(true)}
            >
              <Users className="w-5 h-5" />
              Adicionar Colaborador
            </button>
            {/* MODAL NOVO COLABORADOR */}
            {modalNovoColab && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col animate-in fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800">Novo Colaborador</h2>
                    <button onClick={() => setModalNovoColab(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                      <XCircle className="w-6 h-6 text-slate-400" />
                    </button>
                  </div>
                  <form className="space-y-5" onSubmit={async e => {
                    e.preventDefault();
                    // Inserir colaborador no banco
                    const { error } = await supabase
                      .from('funcionario')
                      .insert({
                        nome: novoColab.nome,
                        idade: novoColab.idade,
                        endereco: novoColab.endereco,
                        telefone: novoColab.telefone
                      });
                    if (!error) {
                      setModalNovoColab(false);
                      setNovoColab({ id: 0, nome: '', idade: 0, endereco: '', telefone: '' });
                      await carregarColaboradores(); // Atualiza lista após cadastro
                    } else {
                      alert('Erro ao cadastrar colaborador: ' + (error.message || error.details || ''));
                    }
                  }}>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nome</label>
                      <input type="text" required className="w-full border border-slate-200 rounded-lg px-4 py-2" value={novoColab.nome} onChange={e => setNovoColab((v: Colaborador) => ({ ...v, nome: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Idade</label>
                      <input type="number" min="16" max="120" required className="w-full border border-slate-200 rounded-lg px-4 py-2" value={novoColab.idade} onChange={e => setNovoColab((v: Colaborador) => ({ ...v, idade: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Endereço</label>
                      <input type="text" required className="w-full border border-slate-200 rounded-lg px-4 py-2" value={novoColab.endereco} onChange={e => setNovoColab((v: Colaborador) => ({ ...v, endereco: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Telefone</label>
                      <input type="tel" required className="w-full border border-slate-200 rounded-lg px-4 py-2" value={novoColab.telefone} onChange={e => setNovoColab((v: Colaborador) => ({ ...v, telefone: e.target.value }))} />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all">Salvar Colaborador</button>
                  </form>
                </div>
              </div>
            )}
          </header>
          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, i) => (
              <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Tabs e conteúdo principal */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Separadores Principais e Filtros */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                <button onClick={() => setActiveTab('turnos')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'turnos' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                  Auditoria de Turnos
                </button>
                <button onClick={() => setActiveTab('desempenho')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'desempenho' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                  Ranking de Operadores
                </button>
                <button onClick={() => setActiveTab('colaboradores')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'colaboradores' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                  Colaboradores
                </button>
              </div>
              {activeTab === 'turnos' || activeTab === 'desempenho' ? (
                <div className="flex gap-3">
                  <input type="date" className="pl-4 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                  <input type="text" placeholder="Procurar operador..." className="pl-4 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              ) : null}
            </div>

            {activeTab === 'turnos' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest">
                      <th className="px-6 py-4 font-bold text-center">Tipo</th>
                      <th className="px-6 py-4 font-bold">Operador</th>
                      <th className="px-6 py-4 font-bold">Início/Fim</th>
                      <th className="px-6 py-4 font-bold text-right">Vendas</th>
                      <th className="px-6 py-4 font-bold text-right text-red-600">Diferença</th>
                      <th className="px-6 py-4 text-center">Acções</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {turnosFiltrados.map((turno) => (
                      <tr key={turno.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-center">
                          {turno.tipoEncerramento === 'troca_turno' ? <ArrowRightLeft className="w-4 h-4 text-blue-500 mx-auto" /> : <Lock className="w-4 h-4 text-slate-700 mx-auto" />}
                        </td>
                        <td className="px-6 py-4 font-bold">{turno.operador}</td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {/* Exibe hora real de abertura/fechamento do caixa */}
                          {(() => {
                            const inicio = turno.inicio ? new Date(turno.inicio) : null;
                            const fim = turno.fim ? new Date(turno.fim) : null;
                            const horaAbertura = inicio ? inicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
                            const horaFechamento = fim ? fim.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Aberto';
                            return `${horaAbertura} - ${horaFechamento}`;
                          })()}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">R$ {turno.vendas.toFixed(2)}</td>
                        <td className={`px-6 py-4 text-right font-bold ${turno.diferenca < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          R$ {turno.diferenca.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => { setSelectedTurno(turno); setModalTab('financeiro'); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : activeTab === 'desempenho' ? (
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {rankingOperadores.map(op => (
                  <div key={op.nome} className="bg-white border rounded-xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800">{op.nome}</h3>
                    <div className="mt-4 flex justify-between text-sm">
                      <span className="text-slate-500">Vendas</span>
                      <span className="font-bold">R$ {op.vendas.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <h2 className="text-lg font-bold mb-4 text-slate-800">Colaboradores Registrados</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest">
                        <th className="px-4 py-3 font-bold">Nome</th>
                        <th className="px-4 py-3 font-bold">Idade</th>
                        <th className="px-4 py-3 font-bold">Endereço</th>
                        <th className="px-4 py-3 font-bold">Telefone</th>
                        <th className="px-4 py-3 font-bold text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {colaboradores.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-slate-400 italic">Nenhum colaborador registrado.</td>
                        </tr>
                      ) : (
                        colaboradores.map((colab, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-bold">{colab.nome}</td>
                            <td className="px-4 py-3">{colab.idade}</td>
                            <td className="px-4 py-3">{colab.endereco}</td>
                            <td className="px-4 py-3">{colab.telefone}</td>
                            <td className="px-4 py-3 text-center flex gap-2 justify-center">
                              <button
                                className="p-2 rounded-lg hover:bg-blue-100"
                                title="Editar colaborador"
                                // onClick={() => editarColaborador(colab)}
                                disabled
                              >
                                <Pencil className="w-4 h-4 text-blue-600" />
                              </button>
                              <button
                                className="p-2 rounded-lg hover:bg-red-100"
                                title="Remover colaborador"
                                onClick={() => setModalRemoverColab({ open: true, colab })}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                              {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO DE COLABORADOR */}
                              {modalRemoverColab.open && modalRemoverColab.colab && (
                                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
                                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 flex flex-col animate-in fade-in">
                                    <div className="flex justify-between items-center mb-6">
                                      <h2 className="text-xl font-bold text-slate-800">Remover Colaborador</h2>
                                      <button onClick={() => setModalRemoverColab({ open: false, colab: null })} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                        <XCircle className="w-6 h-6 text-slate-400" />
                                      </button>
                                    </div>
                                    <div className="mb-6">
                                      <p className="text-slate-700">Tem certeza que deseja remover o colaborador <span className="font-bold">{modalRemoverColab.colab.nome}</span>?</p>
                                      <p className="text-xs text-slate-400 mt-2">Esta ação não poderá ser desfeita.</p>
                                    </div>
                                    <div className="flex gap-3">
                                      <button
                                        className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                                        onClick={() => setModalRemoverColab({ open: false, colab: null })}
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-all"
                                        onClick={() => {
                                          if (modalRemoverColab.colab) {
                                            removerColaborador(modalRemoverColab.colab.id);
                                          }
                                        }}
                                      >
                                        Remover
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* MODAL DE AUDITORIA */}
          {selectedTurno && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end z-50">
              <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
                {/* Cabeçalho do Modal */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Turno #{selectedTurno.id}</h2>
                    <p className="text-sm text-slate-500">{selectedTurno.operador} • {selectedTurno.caixa}</p>
                  </div>
                  <button onClick={() => setSelectedTurno(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                    <XCircle className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                {/* Separadores de Conteúdo do Modal */}
                <div className="flex px-6 border-b border-slate-100 gap-6">
                  <button 
                    onClick={() => setModalTab('financeiro')}
                    className={`py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${modalTab === 'financeiro' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <DollarSign className="w-4 h-4" /> Auditoria Financeira
                  </button>
                  <button 
                    onClick={() => setModalTab('itens')}
                    className={`py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${modalTab === 'itens' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <Package className="w-4 h-4" /> Itens Vendidos ({selectedTurno.itensVendidos?.length})
                  </button>
                </div>
                {/* Conteúdo com Scroll Independente */}
                <div className="flex-1 overflow-y-auto p-6">
                  {modalTab === 'financeiro' && (
                    <div className="space-y-6">
                      {/* Resultado da Auditoria */}
                      <div className="bg-slate-900 text-white p-6 rounded-2xl">
                        <div className="grid grid-cols-2 gap-8 mb-6">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Sistema Esperava</p>
                            <p className="text-2xl font-bold">R$ {selectedTurno.saldoEsperado.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Operador Declarou</p>
                            <p className="text-2xl font-bold">R$ {selectedTurno.saldoContado.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className={`pt-4 border-t border-slate-800 flex justify-between items-center ${selectedTurno.diferenca < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          <span className="font-bold">Diferença de Caixa:</span>
                          <span className="text-3xl font-black">R$ {selectedTurno.diferenca.toFixed(2)}</span>
                        </div>
                      </div>
                      {/* Meios de Pagamento */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><ReceiptText className="w-4 h-4"/> Composição de Recebimentos</h4>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-medium flex items-center gap-3"><DollarSign className="w-5 h-5 text-emerald-500"/> Dinheiro</span>
                            <span className="font-bold">R$ {selectedTurno.pagamentos.dinheiro.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-medium flex items-center gap-3"><QrCode className="w-5 h-5 text-blue-500"/> Pix</span>
                            <span className="font-bold">R$ {selectedTurno.pagamentos.pix.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-medium flex items-center gap-3"><CreditCard className="w-5 h-5 text-purple-500"/> Cartão</span>
                            <span className="font-bold">R$ {selectedTurno.pagamentos.cartao.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {modalTab === 'itens' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                        <span className="text-sm font-bold text-blue-800">Volume Total de Vendas</span>
                        <span className="text-lg font-black text-blue-800">R$ {selectedTurno.vendas.toFixed(2)}</span>
                      </div>
                      <div className="border border-slate-100 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                              <th className="px-4 py-3 text-left font-bold">Produto</th>
                              <th className="px-4 py-3 text-center font-bold">Qtd</th>
                              <th className="px-4 py-3 text-right font-bold">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedTurno.itensVendidos?.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-700">{item.nome}</td>
                                <td className="px-4 py-3 text-center text-slate-500 font-mono">{item.qtd}</td>
                                <td className="px-4 py-3 text-right font-bold">R$ {item.total.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {selectedTurno.itensVendidos?.length === 0 && (
                        <div className="text-center py-12 text-slate-400 italic">Nenhum registo de venda.</div>
                      )}
                    </div>
                  )}
                </div>
                {/* Rodapé do Modal - Focado apenas em Impressão */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
                  <button 
                    onClick={() => window.print()}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition-all active:scale-[0.98]"
                  >
                    <Printer className="w-5 h-5" />
                    Imprimir {modalTab === 'itens' ? 'Relatório de Itens' : 'Resumo da Auditoria'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}