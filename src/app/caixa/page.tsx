'use client'
declare global {
    interface BarcodeDetector {
        detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>
    }
    var BarcodeDetector: {
        new (options?: { formats?: string[] }): BarcodeDetector
        getSupportedFormats?: () => Promise<string[]>
    }
}

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { useCadernetaOffline } from '@/hooks/useCadernetaOffline'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { offlineStorage } from '@/lib/offlineStorage'
import ProtectedLayout from '@/components/ProtectedLayout'
import {
    Search,
    Camera,
    ShoppingCart,
    Trash2,
    Plus,
    Minus,
    Package,
    Banknote,
    CreditCard,
    Smartphone,
    Eye,
    X,
    BookOpen,
    Receipt,
    Building2,
    MapPin,
    Printer,
    RotateCcw,
    Save
} from 'lucide-react'

import Toast from '@/app/gestao/caderneta/Toast'
import { CadernetaContent } from '@/components/caderneta/CadernetaContent'
import { clientConfig } from '@/lib/config'
import AbrirCaixaModal from '@/components/AbrirCaixaModal'
import TurnoOperadorModal from '@/components/TurnoOperadorModal'
import { trocarOperador } from '@/services/turnoOperadorService'
import { getTurnoOperadorAtual, finalizarTurnoOperador } from '@/repositories/turnoOperadorRepository'

// Se true, o banco (trigger) fará a atualização de caixa automaticamente.
// Quando habilitado, o cliente NÃO fará updates em `caixa_diario`, `caixa_movimentacoes` ou `fluxo_caixa`.
// Temporariamente definimos como `false` para forçar o cliente a escrever os registros
// e assim isolar se o problema está no trigger/DB ou na inserção da venda.
const USE_DB_TRIGGER = false

/** EAN-13 de balança (prefixos 20-29): PP CCCCC VVVVV D */
function parseEan13Balanca(codeNum: string): { codigoProduto: string; valorEmbutido: number } | null {
    if (!codeNum || codeNum.length !== 13 || !/^\d+$/.test(codeNum)) return null
    const prefix = parseInt(codeNum.slice(0, 2), 10)
    if (prefix < 20 || prefix > 29) return null
    // Validar dígito verificador EAN-13
    let sum = 0
    for (let i = 0; i < 12; i++) {
        sum += parseInt(codeNum[i], 10) * (i % 2 === 0 ? 1 : 3)
    }
    const check = (10 - (sum % 10)) % 10
    if (parseInt(codeNum[12], 10) !== check) return null
    const codigoProduto = codeNum.slice(2, 7)
    const valorEmbutido = parseInt(codeNum.slice(7, 12), 10)
    return { codigoProduto, valorEmbutido }
}

/** Etiqueta 11 dígitos da balança: CCCCC VVVVV D (PLU + preço em centavos + dígito verificador) */
function parseEtiqueta11Digitos(codeNum: string): { plu: string; valorCentavos: number } | null {
    if (!codeNum || codeNum.length !== 11 || !/^\d+$/.test(codeNum)) return null
    const plu = codeNum.substring(0, 5)
    const valorCentavos = parseInt(codeNum.substring(5, 10), 10)
    return { plu, valorCentavos }
}

// Interfaces baseadas na estrutura do seu banco de dados
interface Produto {
    id: number
    codigoBarras: string
    codigoBalanca?: string
    nome: string
    preco: number
    estoque: number
    unidade: string
}

interface ItemCarrinho extends Produto {
    qtdCarrinho: number
}

interface VendaRegistrada {
    id: number
    data: string
    total: number
    forma_pagamento: string
    created_at?: string | Date
    operador_nome?: string // Adicionado para refletir o uso no fechamento do caixa
}

export default function PDVPage() {
    const { isOnline } = useOnlineStatus()
    // --- Troca de Operador ---
    const [showTurnoModal, setShowTurnoModal] = useState(false)
    const [operadores, setOperadores] = useState<{ id: number; nome: string }[]>([])
    // Busca colaboradores da tabela funcionario
    const carregarOperadores = async () => {
        const { data, error } = await getSupabase()
            .from('funcionario')
            .select('id, nome')
            .order('nome', { ascending: true })
        if (!error && data) setOperadores(data)
        else setOperadores([])
    }
    useEffect(() => { if (showTurnoModal) carregarOperadores() }, [showTurnoModal])

    // Handler para abrir modal
    const abrirModalTrocaOperador = () => setShowTurnoModal(true)
    // Handler para confirmar troca
    const handleTrocaOperador = async (_: any, nomeDigitado: string) => {
        if (!caixaDiarioId) { showToast('Caixa não identificado', 'error'); return }
        if (carrinho.length > 0) { showToast('Finalize ou cancele a venda antes de trocar o operador.', 'warning'); return }
        const nomeBusca = nomeDigitado.trim();
        // Procura operador cadastrado, mas permite qualquer nome
        const novoOp = operadores.find(o => o.nome.trim().toLowerCase() === nomeBusca.toLowerCase());
        setLoading(true);
        const resp = await trocarOperador({
            caixa_diario_id: caixaDiarioId,
            novo_operador_id: novoOp ? novoOp.id : 0,
            novo_operador_nome: nomeBusca,
        });
        setLoading(false);
        if (resp.ok && resp.turno) {
            setOperador(nomeBusca);
            setShowTurnoModal(false);
            showToast('Operador trocado com sucesso!', 'success');
        } else {
            showToast(resp.erro || 'Erro ao trocar operador', 'error');
        }
    }
    // Removido: declaração duplicada de toast/setToast
    const router = useRouter()
    const searchParams = useSearchParams()
    const getSupabase = () => {
        if (!supabase) throw new Error('Supabase não inicializado')
        return supabase
    }

    // Helpers para data local (YYYY-MM-DD) e parsing robusto
    const getLocalDateString = (d: Date = new Date()) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }

    const parseBaseDateToLocal = (base?: string) => {
        if (!base) return new Date()
        // Se já for YYYY-MM-DD, crie Date em meia-noite local
        if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
            const [y, m, day] = base.split('-').map(Number)
            return new Date(y, m - 1, day)
        }
        // Caso contrário, deixa o Date interpretar (ISO ou timestamp)
        return new Date(base)
    }

    // (removido: flags de simulação de emissão fiscal)

    // Grava movimentação diretamente no banco (movimentacoes_caderneta + atualiza saldo do cliente)
    const registerMovimentacaoDb = async (params: { cliente_id: number; tipo: 'compra' | 'pagamento'; valor: number; venda_id?: number; observacoes?: string; allowExceedLimit?: boolean }) => {
        try {
            const { cliente_id, tipo, valor, venda_id, observacoes } = params
            const { data: cliente, error: clienteErr } = await getSupabase()
                .from('clientes_caderneta')
                .select('id, saldo_devedor, limite_credito')
                .eq('id', cliente_id)
                .single()

            if (clienteErr) throw clienteErr
            if (!cliente) return { success: false, message: 'Cliente não encontrado' }

            const saldoAnterior = cliente.saldo_devedor ?? 0
            const novoSaldo = tipo === 'compra' ? (saldoAnterior + valor) : (saldoAnterior - valor)

            if (!params.allowExceedLimit && novoSaldo > cliente.limite_credito) {
                return { success: false, message: `Valor excede limite de crédito (R$ ${cliente.limite_credito})` }
            }

            const { data: movData, error: movErr } = await getSupabase()
                .from('movimentacoes_caderneta')
                .insert<Database['public']['Tables']['movimentacoes_caderneta']['Insert']>({
                    cliente_id,
                    tipo,
                    valor,
                    saldo_anterior: saldoAnterior,
                    saldo_atual: novoSaldo,
                    venda_id: venda_id || null,
                    observacoes: observacoes || null,
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (movErr) throw movErr

            const { error: updErr } = await getSupabase()
                .from('clientes_caderneta')
                .update({ saldo_devedor: novoSaldo, updated_at: new Date().toISOString() })
                .eq('id', cliente_id)

            if (updErr) throw updErr

            return { success: true, data: movData, saldoAnterior, novoSaldo }
        } catch (err: any) {
            console.error('Erro ao registrar movimentação no DB:', err)
            return { success: false, message: err?.message || String(err) }
        }
    }

    // Função reutilizável para restaurar caixa aberto (pode ser chamada em mount e em focus)
    async function restaurarCaixaAberto(opts?: { changeView?: boolean }) {
        const changeView = opts?.changeView ?? true
        try {
            if (!isOnline) {
                await offlineStorage.init()
                const caixaHoje = await offlineStorage.getOfflineData('caixa_hoje')
                const activeCaixa = Array.isArray(caixaHoje) ? caixaHoje[0] : caixaHoje
                if (!activeCaixa || (activeCaixa as any).status !== 'aberto') {
                    setCaixaAberto(false)
                    if (changeView) setView('abertura')
                    return null
                }
                setCaixaAberto(true)
                setSaldoInicial(Number((activeCaixa as any).valor_abertura) || 0)
                setCaixaDiaISO((activeCaixa as any).data || getLocalDateString())
                setCaixaDiarioId((activeCaixa as any).id || null)
                setOperador((activeCaixa as any).usuario_abertura || '')
                try {
                    if ((activeCaixa as any).data) {
                        const d = new Date((activeCaixa as any).data + 'T00:00:00')
                        setDataHoje(d.toLocaleDateString('pt-BR'))
                    } else {
                        setDataHoje(new Date().toLocaleDateString('pt-BR'))
                    }
                    if ((activeCaixa as any).created_at) {
                        setHoraAbertura(new Date((activeCaixa as any).created_at).toLocaleTimeString('pt-BR'))
                    } else {
                        setHoraAbertura(new Date().toLocaleTimeString('pt-BR'))
                    }
                } catch (e) {
                    setDataHoje(new Date().toLocaleDateString('pt-BR'))
                    setHoraAbertura(new Date().toLocaleTimeString('pt-BR'))
                }
                if (changeView) setView('venda')
                return activeCaixa
            }

            const { data: openCaixas, error } = await getSupabase()
                .from('caixa_diario')
                .select('*')
                .eq('status', 'aberto')
                .order('created_at', { ascending: false })

            if (error) throw error

            if (!openCaixas || openCaixas.length === 0) {
                setCaixaAberto(false)
                if (changeView) setView('abertura')
                return null
            }

            let activeCaixa = openCaixas[0]
            if (openCaixas.length > 1) {
                console.warn(`Detectados ${openCaixas.length} caixas abertos. Corrigindo inconsistência...`)
                const idsParaFechar = openCaixas.slice(1).map(c => c.id)
                await getSupabase()
                    .from('caixa_diario')
                    .update({ 
                        status: 'fechado', 
                        observacoes_fechamento: 'Fechamento automático por detecção de múltiplos caixas abertos (limpeza de sessão)' 
                    })
                    .in('id', idsParaFechar)
            }

            setCaixaAberto(true)
            setSaldoInicial(Number(activeCaixa.valor_abertura) || 0)
            setCaixaDiaISO(activeCaixa.data || getLocalDateString())
            setCaixaDiarioId(activeCaixa.id || null)

            let operadorNome = activeCaixa.usuario_abertura || '';
            if (activeCaixa.id) {
                try {
                    const turno = await getTurnoOperadorAtual(activeCaixa.id);
                    if (turno && turno.operador_nome) {
                        operadorNome = turno.operador_nome;
                    }
                } catch (e) {
                    // fallback já está em operadorNome
                }
            }
            setOperador(operadorNome);

            try {
                if (activeCaixa.data) {
                    const d = new Date(activeCaixa.data + 'T00:00:00')
                    setDataHoje(d.toLocaleDateString('pt-BR'))
                } else {
                    setDataHoje(new Date().toLocaleDateString('pt-BR'))
                }
                if (activeCaixa.created_at) {
                    setHoraAbertura(new Date(activeCaixa.created_at).toLocaleTimeString('pt-BR'))
                } else {
                    setHoraAbertura(new Date().toLocaleTimeString('pt-BR'))
                }
            } catch (e) {
                setDataHoje(new Date().toLocaleDateString('pt-BR'))
                setHoraAbertura(new Date().toLocaleTimeString('pt-BR'))
            }
            if (changeView) setView('venda')
            return activeCaixa
        } catch (err) {
            if (!isOnline) {
                try {
                    const caixaHoje = await offlineStorage.getOfflineData('caixa_hoje')
                    const activeCaixa = Array.isArray(caixaHoje) ? caixaHoje[0] : caixaHoje
                    if (activeCaixa && (activeCaixa as any).status === 'aberto') {
                        setCaixaAberto(true)
                        setSaldoInicial(Number((activeCaixa as any).valor_abertura) || 0)
                        setCaixaDiaISO((activeCaixa as any).data || getLocalDateString())
                        setCaixaDiarioId((activeCaixa as any).id || null)
                        setOperador((activeCaixa as any).usuario_abertura || '')
                        setDataHoje(new Date().toLocaleDateString('pt-BR'))
                        setHoraAbertura(new Date().toLocaleTimeString('pt-BR'))
                        if (changeView) setView('venda')
                        return activeCaixa
                    }
                } catch {
                    // ignorar
                }
            }
            setCaixaAberto(false)
            if (changeView) setView('abertura')
            console.error('Falha ao restaurar caixa aberto:', err)
            return null
        }
    }

    // Recarrega produtos, vendas e estado do caixa com indicador de progresso
    // Carrega todas as sessões de caixa registradas para a data (ordem crescente)
    async function carregarCaixasDoDia(baseDateISO?: string) {
        try {
            const date = baseDateISO || getLocalDateString()
            if (!isOnline) {
                const caixaHoje = await offlineStorage.getOfflineData('caixa_hoje')
                const caixaDiario = await offlineStorage.getOfflineData('caixa_diario')
                const caixas = (caixaDiario || []).filter((c: any) => c.data === date)
                if (caixas.length === 0 && caixaHoje?.length) {
                    const c = Array.isArray(caixaHoje) ? caixaHoje[0] : caixaHoje
                    if ((c as any).data === date) {
                        setCaixasDoDia([c as any])
                        return
                    }
                }
                setCaixasDoDia(caixas)
                return
            }
            const { data, error } = await getSupabase()
                .from('caixa_diario')
                .select('*')
                .eq('data', date)
                .order('created_at', { ascending: true })

            if (error) throw error
            setCaixasDoDia(data || [])
        } catch (e) {
            if (!isOnline) {
                try {
                    const date = baseDateISO || getLocalDateString()
                    const caixaDiario = await offlineStorage.getOfflineData('caixa_diario')
                    const caixaHoje = await offlineStorage.getOfflineData('caixa_hoje')
                    const caixas = (caixaDiario || []).filter((c: any) => c.data === date)
                    if (caixas.length === 0 && caixaHoje?.length) {
                        const c = Array.isArray(caixaHoje) ? caixaHoje[0] : caixaHoje
                        if ((c as any).data === date) setCaixasDoDia([c as any])
                        else setCaixasDoDia([])
                    } else {
                        setCaixasDoDia(caixas)
                    }
                } catch {
                    setCaixasDoDia([])
                }
            } else {
                console.error('Erro ao carregar caixas do dia:', e)
                setCaixasDoDia([])
            }
        }
    }

    async function refreshAll(opts?: { changeView?: boolean }) {
        const changeView = opts?.changeView ?? true
        setIsRefreshing(true)
        try {
            await carregarProdutos();
            const caixa = await restaurarCaixaAberto({ changeView });
            const idToUse = caixa?.id || caixaDiarioId;
            
            await Promise.all([
                carregarVendasHoje(idToUse),
                carregarSaidasDoDia(idToUse)
            ])
            // Também atualiza a listagem de caixas do dia (para agregação/report)
            try { await carregarCaixasDoDia(caixaDiaISO || undefined) } catch (e) { console.warn('carregarCaixasDoDia falhou:', e) }
        } catch (e) {
            console.error('Erro ao atualizar dados do PDV:', e)
        } finally {
            // Pequeno delay para evitar flicker
            setTimeout(() => setIsRefreshing(false), 250)
        }
    }

    

    // Registrar saída (sangria) no caixa: atualiza caixa_diario.valor_saidas e tenta criar registro detalhado
    const handleRegistrarSaida = async () => {
        try {
            const valor = parseFloat(String(valorSaida).replace(',', '.')) || 0
            if (valor <= 0) {
                showToast('Informe um valor válido para a retirada.', 'error')
                return
            }

            const disponivel = metricasCaixa?.valorEsperadoDinheiro ?? 0
            if (valor > disponivel) {
                showToast(`Saldo insuficiente em dinheiro. Disponível: R$ ${disponivel.toFixed(2)}`, 'error')
                return
            }

            if (!caixaDiarioId) {
                showToast('Não há caixa aberto para registrar a saída. Abra o caixa primeiro.', 'error')
                return
            }

            if (!isOnline) {
                const caixaHoje = await offlineStorage.getOfflineData('caixa_hoje')
                const caixa = Array.isArray(caixaHoje) ? caixaHoje[0] : caixaHoje
                const valorSaidasAtual = (caixa && typeof (caixa as any).valor_saidas === 'number') ? (caixa as any).valor_saidas : 0
                const novoValorSaidas = Number((valorSaidasAtual + valor).toFixed(2))
                await offlineStorage.addPendingOperation({
                    type: 'UPDATE',
                    table: 'caixa_diario',
                    data: { id: caixaDiarioId, valor_saidas: novoValorSaidas }
                })
                const dataCaixa = caixaDiaISO || getLocalDateString()
                await offlineStorage.addPendingOperation({
                    type: 'INSERT',
                    table: 'fluxo_caixa',
                    data: {
                        data: dataCaixa,
                        tipo: 'saida',
                        categoria: 'caixa',
                        descricao: motivoSaida || 'Saída PDV',
                        valor,
                        observacoes: obsSaida || null,
                        usuario: operador || null,
                        created_at: new Date().toISOString(),
                        caixa_diario_id: caixaDiarioId
                    }
                })
                const fluxoCached = await offlineStorage.getOfflineData('fluxo_caixa')
                const novaSaida = {
                    id: -Date.now(),
                    data: dataCaixa,
                    tipo: 'saida',
                    categoria: 'caixa',
                    descricao: motivoSaida || 'Saída PDV',
                    valor,
                    observacoes: obsSaida || null,
                    usuario: operador || null,
                    created_at: new Date().toISOString(),
                    caixa_diario_id: caixaDiarioId,
                    displayData: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                }
                await offlineStorage.saveOfflineData('fluxo_caixa', [novaSaida, ...(fluxoCached || [])])
                const caixaAtualizado = { ...(caixa as any), valor_saidas: novoValorSaidas }
                await offlineStorage.saveOfflineData('caixa_hoje', [caixaAtualizado])
                setSaidasDoDia(prev => [novaSaida, ...prev])
                setCaixasDoDia(prev => prev.map((c: any) => c.id === caixaDiarioId ? { ...c, valor_saidas: novoValorSaidas } : c))
                setValorSaida('')
                setObsSaida('')
                showToast('Saída registrada offline. Será sincronizada quando online.', 'success')
                return
            }

            const { data: caixaRow, error: caixaErr } = await getSupabase()
                .from('caixa_diario')
                .select('id, valor_saidas')
                .eq('id', caixaDiarioId)
                .single()

            if (caixaErr && caixaErr.code !== 'PGRST116') throw caixaErr

            const valorSaidasAtual = (caixaRow && typeof caixaRow.valor_saidas === 'number') ? caixaRow.valor_saidas : 0
            const novoValorSaidas = Number((valorSaidasAtual + valor).toFixed(2))

            const { error: updErr } = await getSupabase()
                .from('caixa_diario')
                .update<Database['public']['Tables']['caixa_diario']['Update']>({ valor_saidas: novoValorSaidas })
                .eq('id', caixaDiarioId)

            if (updErr) throw updErr

            try {
                const { error: movErr } = await getSupabase()
                    .from('caixa_movimentacoes')
                    .insert<Database['public']['Tables']['caixa_movimentacoes']['Insert']>({
                        caixa_diario_id: caixaDiarioId,
                        tipo: 'saida',
                        valor,
                        motivo: motivoSaida,
                        observacoes: obsSaida || null,
                        created_at: new Date().toISOString()
                    })

                if (movErr) {
                    console.warn('Não foi possível gravar detalhe da saída (caixa_movimentacoes):', movErr)
                }
            } catch (movErr) {
                console.warn('Erro inesperado ao gravar caixa_movimentacoes:', movErr)
            }

            try {
                const dataCaixa = caixaDiaISO || getLocalDateString()
                const dadosFluxo = {
                    data: dataCaixa,
                    tipo: 'saida',
                    categoria: 'caixa',
                    descricao: motivoSaida || 'Saída PDV',
                    valor: valor,
                    observacoes: obsSaida || null,
                    usuario: operador || null,
                    created_at: new Date().toISOString(),
                    caixa_diario_id: caixaDiarioId
                }
                const { data: fluxoData, error: fluxoErr } = await getSupabase()
                    .from('fluxo_caixa')
                    .insert<Database['public']['Tables']['fluxo_caixa']['Insert']>(dadosFluxo)
                console.log('Tentando inserir em fluxo_caixa:', dadosFluxo)
                if (fluxoErr) {
                    const errorMsg = fluxoErr?.message || fluxoErr?.details || fluxoErr?.hint || fluxoErr?.code || JSON.stringify(fluxoErr)
                    console.error('Não foi possível gravar saída em fluxo_caixa:', errorMsg)
                    console.dir(fluxoErr)
                    if (fluxoErr?.code === 'PGRST116') {
                        console.warn('Possível motivo: tabela `fluxo_caixa` não existe no banco (PGRST116).')
                    }
                    showToast(`Registrado no caixa, mas falha ao enviar para Gestão/Saídas${errorMsg ? ': ' + errorMsg : ''}`, 'warning')
                } else {
                    console.log('Saída registrada em fluxo_caixa:', fluxoData)
                    showToast('Saída registrada em vendas', 'success')
                }
            } catch (fluxErr) {
                console.warn('Erro inesperado ao gravar fluxo_caixa:', fluxErr)
                showToast('Registrado no caixa, mas falha ao enviar para Gestão/Saídas', 'warning')
            }

            // showToast já chamado acima
            setValorSaida('')
            setObsSaida('')
            // Atualiza interface (não forçar mudança de view)
            await refreshAll({ changeView: false })
        } catch (err) {
            console.error('Erro ao registrar saída:', err)
            showToast('Erro ao registrar saída. Verifique o console.', 'error')
        }
    }
    // --- Estados de UI e Dados ---
    const [view, setView] = useState<'abertura' | 'venda' | 'historico' | 'estoque' | 'caixa' | 'saida' | 'caderneta' | 'cupom'>('abertura')
    const [caixaAberto, setCaixaAberto] = useState(false)
    const [operador, setOperador] = useState('')
    const [saldoInicial, setSaldoInicial] = useState(0)
    const [observacoes, setObservacoes] = useState('')
    const [dataHoje, setDataHoje] = useState('')
    const [horaAbertura, setHoraAbertura] = useState('')
    // Dia-base do caixa para filtrar relatórios ao longo do turno
    const [caixaDiaISO, setCaixaDiaISO] = useState<string | null>(null)

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
    const [vendasHoje, setVendasHoje] = useState<VendaRegistrada[]>([])

    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [relogio, setRelogio] = useState('')
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
    const [descontoPercent, setDescontoPercent] = useState('')
    const [descontoValor, setDescontoValor] = useState('')
    const [caixaDiarioId, setCaixaDiarioId] = useState<number | null>(null)
    const [caixasDoDia, setCaixasDoDia] = useState<any[]>([])
    const [saidasDoDia, setSaidasDoDia] = useState<any[]>([])
    const [pagamentosCadernetaHoje, setPagamentosCadernetaHoje] = useState<number[]>([])

    // --- Métricas do Caixa ---
    // Prioridade: usar caixa_diario da sessão atual (fonte da verdade, inclui pagamentos de caderneta com forma correta)
    const metricasCaixa = useMemo(() => {
        const totais = {
            dinheiro: 0,
            pix: 0,
            debito: 0,
            credito: 0,
            caderneta: 0
        }

        const caixaSessao = caixaDiarioId ? caixasDoDia.find((c: any) => Number(c.id) === Number(caixaDiarioId)) : null

        if (caixaSessao) {
            // Usar caixa_diario como fonte (inclui vendas + pagamentos de caderneta com forma correta)
            totais.dinheiro = Number(caixaSessao.total_dinheiro || 0)
            totais.pix = Number(caixaSessao.total_pix || 0)
            totais.debito = Number(caixaSessao.total_debito || 0)
            totais.credito = Number(caixaSessao.total_credito || 0)
            totais.caderneta = Number(caixaSessao.total_caderneta || 0)
        } else {
            // Fallback: recalcular de vendasHoje + pagamentosCadernetaHoje
            vendasHoje.forEach(v => {
                const formaRaw = String(v.forma_pagamento || '').toLowerCase();
                const forma = formaRaw.replace(/[_\s]/g, '');
                if (forma.includes('dinheiro')) totais.dinheiro += v.total;
                else if (forma.includes('pix')) totais.pix += v.total;
                else if (forma.includes('debito') || (forma.includes('cartao') && forma.includes('debito'))) totais.debito += v.total;
                else if (forma.includes('credito') || (forma.includes('cartao') && forma.includes('credito'))) totais.credito += v.total;
                else if (forma.includes('caderneta')) totais.caderneta += v.total;
                else { if (forma.includes('cartao')) totais.debito += v.total; }
            });
            try {
                const somaPagamentos = (pagamentosCadernetaHoje || []).reduce((acc, val) => acc + Number(val || 0), 0);
                if (somaPagamentos > 0) totais.dinheiro += somaPagamentos;
            } catch (e) { }
        }

        const totalEntradas = totais.dinheiro + totais.pix + totais.debito + totais.credito
        const totalGeral = totalEntradas + totais.caderneta

        const totalSaidas = caixaSessao
            ? Number(caixaSessao.valor_saidas || 0)
            : (saidasDoDia || []).reduce((acc: number, s: any) => acc + (Number(s.valor) || 0), 0)

        const valorAbertura = caixaSessao ? Number(caixaSessao.valor_abertura || 0) : (saldoInicial || 0)
        const valorEsperadoDinheiro = valorAbertura + totais.dinheiro - totalSaidas

        return { ...totais, totalEntradas, totalGeral, valorEsperadoDinheiro, totalSaidas }
    }, [caixaDiarioId, caixasDoDia, vendasHoje, saldoInicial, saidasDoDia, pagamentosCadernetaHoje])

    // Métricas agregadas do dia (somatório de todas as sessões de caixa registradas)
    const metricasDia = useMemo(() => {
        const s: any = { dinheiro:0, pix:0, debito:0, credito:0, caderneta:0, totalEntradas:0, totalGeral:0, valorEsperadoDinheiro:0, totalSaidas:0 }
        caixasDoDia.forEach((c: any) => {
            s.dinheiro += Number(c.total_dinheiro || 0)
            s.pix += Number(c.total_pix || 0)
            s.debito += Number(c.total_debito || 0)
            s.credito += Number(c.total_credito || 0)
            s.caderneta += Number(c.total_caderneta || 0)
            s.totalEntradas += Number(c.total_entradas || 0)
            s.totalSaidas += Number(c.valor_saidas || 0)
        })
        s.totalGeral = s.totalEntradas + s.caderneta
        const somaAberturas = caixasDoDia.reduce((acc: number, c: any) => acc + Number(c.valor_abertura || 0), 0)
        s.valorEsperadoDinheiro = somaAberturas + s.dinheiro
        return s
    }, [caixasDoDia])

    // Soma total de saídas do dia (usado no card de resumo)
    const totalSaidasDoDia = useMemo(() => {
        try {
            return (saidasDoDia || []).reduce((acc: number, s: any) => acc + (Number(s.valor) || 0), 0)
        } catch (e) {
            return 0
        }
    }, [saidasDoDia])

    // --- Estados de Modais ---
    const [modalPagamento, setModalPagamento] = useState(false)
    const [modalDebito, setModalDebito] = useState(false)
    const [modalCredito, setModalCredito] = useState(false)
    const [modalPix, setModalPix] = useState(false)
    const [modalCaderneta, setModalCaderneta] = useState(false)
    const [cadernetaErroLimite, setCadernetaErroLimite] = useState<string | null>(null)
    const [modalFechamento, setModalFechamento] = useState(false)
    const [modalNoConferencia, setModalNoConferencia] = useState(false)
    // Fechamento: conferências e confirmação (valores editáveis antes de gravar)
    const [confDinheiro, setConfDinheiro] = useState('')
    const [confPix, setConfPix] = useState('')
    const [confDebito, setConfDebito] = useState('')
    const [confCredito, setConfCredito] = useState('')
    const [fechamentoError, setFechamentoError] = useState('')
    const [fechamentoFieldErrors, setFechamentoFieldErrors] = useState<{[key:string]:string}>({})
    const [modalFechamentoConfirm, setModalFechamentoConfirm] = useState(false)
    // Saída (sangria)
    const [valorSaida, setValorSaida] = useState('')
    const [motivoSaida, setMotivoSaida] = useState<'deposito' | 'pagamento' | 'troca'>('deposito')
    const [obsSaida, setObsSaida] = useState('')
    // Cupom Fiscal (configuração)
    const [cupomNomeLoja, setCupomNomeLoja] = useState('REY DOS PÃES')
    const [cupomCnpj, setCupomCnpj] = useState('00.000.000/0001-00')
    const [cupomEndereco, setCupomEndereco] = useState('Endereço da Loja')
    const [cupomCidadeUf, setCupomCidadeUf] = useState('Cidade - UF')
    const [cupomMensagem, setCupomMensagem] = useState('REY DOS PÃES - CAIXA')
    const [cupomImprimidos, setCupomImprimidos] = useState(0)
    const [valorRecebido, setValorRecebido] = useState('')
    const [modalDetalhes, setModalDetalhes] = useState(false)
    const [modalPosVenda, setModalPosVenda] = useState(false)
    // Modal para digitar peso manualmente (produtos kg/g)
    const [modalPeso, setModalPeso] = useState(false)
    const [produtoPendentePeso, setProdutoPendentePeso] = useState<Produto | null>(null)
    const [pesoDigitado, setPesoDigitado] = useState('')
    const [lastVendaId, setLastVendaId] = useState<number | null>(null)
    const [lastCadernetaPrintData, setLastCadernetaPrintData] = useState<{
        vendaId: number
        clienteNome: string
        saldoDevedorAnterior: number
        valorCompra: number
        saldoDevedorAtualizado: number
    } | null>(null)
    const [itensVendaSelecionada, setItensVendaSelecionada] = useState<any[]>([])
    const [vendaSelecionadaId, setVendaSelecionadaId] = useState<number | null>(null)
    const [vendaClienteNome, setVendaClienteNome] = useState<string | null>(null)
    const [descontoVendaSelecionada, setDescontoVendaSelecionada] = useState<number>(0)
    // Controle de emissão fiscal por venda (removido/obsoleto)
    // Exibição da faixa de atalhos
    const [mostrarAtalhos, setMostrarAtalhos] = useState(true)

    // Ref para o campo de busca (atalho Ctrl+F)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const confDinheiroRef = useRef<HTMLInputElement>(null)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [lastAddedItem, setLastAddedItem] = useState<ItemCarrinho | null>(null)
    // Timer ref para abrir modal pós-venda após delay
    const postVendaTimerRef = useRef<number | null>(null)

    const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
        setToast({ message, type })
    }

    // --- Scanner (Câmera) ---
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
    const [cameraId, setCameraId] = useState<string | null>(null)
    const [scannerAtivo, setScannerAtivo] = useState(false)

    // Limpa timer pós-venda ao desmontar
    useEffect(() => {
        return () => {
            if (postVendaTimerRef.current) {
                try { window.clearTimeout(postVendaTimerRef.current) } catch (e) {}
            }
        }
    }, [])

    // Abre o modal pós-venda com um delay curto (300ms) para não bloquear a UI
    const abrirModalPosVendaComDelay = (delay = 300) => {
        try { if (postVendaTimerRef.current) window.clearTimeout(postVendaTimerRef.current) } catch (e) {}
        postVendaTimerRef.current = window.setTimeout(() => {
            setModalPosVenda(true)
        }, delay)
    }
    // Estado do modal pós-venda (impressão de recibo)
    const [ultimoCodigo, setUltimoCodigo] = useState<string>('')
    const [scannerErro, setScannerErro] = useState<string>('')
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const codeReaderRef = useRef<InstanceType<typeof BrowserMultiFormatReader> | null>(null)
    const detectorRef = useRef<BarcodeDetector | null>(null)
    const scanningLockRef = useRef<number>(0)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const scannerPausadoRef = useRef(false)
    const scannerAtivoRef = useRef(false)
    const scannerControlsRef = useRef<{ stop: () => void } | null>(null)

    // refs para evitar re-subscription e ler valores atuais
    const carregarVendasHojeRef = useRef<any>(null)
    const caixaDiarioIdRef = useRef<number | null>(null)
    const caixaDiaISORef = useRef<string | null>(null)
    // Timeout ref usado para debouncing de recarga de vendas ao receber eventos realtime
    const refreshVendasTimeoutRef = useRef<number | null>(null)
    // Buffer para código de barras (leitor USB) quando foco está fora do input
    const barcodeBufferRef = useRef<{ chars: string; lastKeyTime: number }>({ chars: '', lastKeyTime: 0 })
    const barcodeAtalhoTimeoutRef = useRef<number | null>(null)

    useEffect(() => {
        carregarVendasHojeRef.current = carregarVendasHoje
    }, [carregarVendasHoje])

    useEffect(() => {
        caixaDiarioIdRef.current = caixaDiarioId
    }, [caixaDiarioId])

    useEffect(() => {
        caixaDiaISORef.current = caixaDiaISO
    }, [caixaDiaISO])

    // Carrega histórico de vendas do dia baseado na sessão do caixa (caixa_diario_id)
    async function carregarVendasHoje(caixaId?: number | null) {
        try {
            const idToUse = caixaId || caixaDiarioId
            if (!idToUse) {
                setVendasHoje([])
                return
            }

            if (!isOnline) {
                const cached = await offlineStorage.getOfflineData('vendas')
                const vendasCaixa = (cached || []).filter((v: any) => v.caixa_diario_id === idToUse)
                setVendasHoje(vendasCaixa.map((v: any) => ({
                    id: v.id,
                    data: v.created_at ? new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---',
                    total: v.valor_total || 0,
                    forma_pagamento: (v.forma_pagamento || '').replace('_', ' '),
                    operador_nome: v.operador_nome || v.usuario,
                    created_at: v.created_at
                })))
                setPagamentosCadernetaHoje([])
                return
            }

            console.debug('carregarVendasHoje: buscando vendas para o caixa_diario_id', idToUse)
            const { data, error } = await getSupabase()
                .from('vendas')
                .select('*')
                .eq('caixa_diario_id', idToUse)
                .order('created_at', { ascending: false })

            if (error) throw error

            if (data) {
                setVendasHoje(data.map((v: any) => ({
                    id: v.id,
                    data: v.created_at ? new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---',
                    total: v.valor_total || 0,
                    forma_pagamento: (v.forma_pagamento || '').replace('_', ' '),
                    operador_nome: v.operador_nome || v.usuario,
                    created_at: v.created_at
                })))
                try {
                    const { data: pagamentosFluxo, error: errPag } = await getSupabase()
                        .from('fluxo_caixa')
                        .select('valor')
                        .eq('caixa_diario_id', idToUse)
                        .eq('tipo', 'entrada')
                        .eq('categoria', 'caderneta')
                    if (!errPag && pagamentosFluxo) {
                        setPagamentosCadernetaHoje((pagamentosFluxo as any[]).map(p => Number(p.valor || 0)))
                    } else {
                        setPagamentosCadernetaHoje([])
                    }
                } catch (e) {
                    console.warn('Erro ao carregar pagamentos de caderneta do fluxo_caixa:', e)
                    setPagamentosCadernetaHoje([])
                }
            } else {
                setVendasHoje([])
            }
        } catch (err: any) {
            if (!isOnline) {
                try {
                    const cached = await offlineStorage.getOfflineData('vendas')
                    const idToUse = caixaId || caixaDiarioId
                    const vendasCaixa = (cached || []).filter((v: any) => v.caixa_diario_id === idToUse)
                    setVendasHoje(vendasCaixa.map((v: any) => ({
                        id: v.id,
                        data: v.created_at ? new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---',
                        total: v.valor_total || 0,
                        forma_pagamento: (v.forma_pagamento || '').replace('_', ' '),
                        operador_nome: v.operador_nome || v.usuario,
                        created_at: v.created_at
                    })))
                } catch {
                    setVendasHoje([])
                }
            } else {
                console.error('Erro ao carregar vendas do caixa:', err)
                setVendasHoje([])
            }
        }
    }

    async function carregarSaidasDoDia(caixaId?: number | null) {
        try {
            const idToUse = caixaId || caixaDiarioId
            if (!idToUse) {
                setSaidasDoDia([])
                return
            }
            if (!isOnline) {
                const cached = await offlineStorage.getOfflineData('fluxo_caixa')
                const saidas = (cached || []).filter((d: any) => d.caixa_diario_id === idToUse && d.tipo === 'saida')
                const mapped = saidas.map((d: any) => {
                    let displayData = '—'
                    try {
                        if (d.created_at) {
                            displayData = new Date(d.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        } else if (d.data) {
                            const dt = parseBaseDateToLocal(d.data)
                            displayData = dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        }
                    } catch (e) { displayData = String(d.data || '—') }
                    return { ...d, displayData }
                })
                setSaidasDoDia(mapped)
                return
            }
            const { data, error } = await getSupabase()
                .from('fluxo_caixa')
                .select('id, data, usuario, valor, observacoes, created_at')
                .eq('caixa_diario_id', idToUse)
                .eq('tipo', 'saida')
                .order('created_at', { ascending: false })

            if (error) throw error

            const mapped = (data || []).map((d: any) => {
                let displayData = '—'
                try {
                    if (d.created_at) {
                        displayData = new Date(d.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    } else if (d.data) {
                        const dt = parseBaseDateToLocal(d.data)
                        displayData = dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    }
                } catch (e) { displayData = String(d.data || '—') }
                return { ...d, displayData }
            })

            setSaidasDoDia(mapped)
        } catch (e) {
            if (!isOnline) {
                try {
                    const cached = await offlineStorage.getOfflineData('fluxo_caixa')
                    const idToUse = caixaId || caixaDiarioId
                    const saidas = (cached || []).filter((d: any) => d.caixa_diario_id === idToUse && d.tipo === 'saida')
                    const mapped = saidas.map((d: any) => {
                        let displayData = '—'
                        try {
                            if (d.created_at) {
                                displayData = new Date(d.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            } else if (d.data) {
                                const dt = parseBaseDateToLocal(d.data)
                                displayData = dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            }
                        } catch (e2) { displayData = String(d.data || '—') }
                        return { ...d, displayData }
                    })
                    setSaidasDoDia(mapped)
                } catch {
                    setSaidasDoDia([])
                }
            } else {
                console.error('Erro ao carregar saídas do dia:', e)
                setSaidasDoDia([])
            }
        }
    }

    // --- Caderneta: seleção de cliente/funcionário para registrar pagamento ---
    const { clientes, adicionarMovimentacao, registrarPagamento, refreshClientes, refreshMovimentacoes } = useCadernetaOffline()
    const [clienteCadernetaSelecionado, setClienteCadernetaSelecionado] = useState<string>('')
    const [valorAbaterCaderneta, setValorAbaterCaderneta] = useState<string>('')

    // Define valor padrão para abatimento quando abrir qualquer modal de pagamento
    // (movido para abaixo da declaração de totalComDesconto para evitar TDZ)

    const tocarBeep = async () => {
        try {
            if (typeof window !== 'undefined' && localStorage.getItem('scanner-beep') === 'false') return
            // @ts-ignore
            const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
            if (!AudioCtx) return
            if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx()
            const ctx = audioCtxRef.current
            if (!ctx) return
            if (ctx.state === 'suspended') await ctx.resume()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.value = 880
            gain.gain.value = 0.08
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.start()
            setTimeout(() => {
                try {
                    osc.stop()
                    osc.disconnect()
                    gain.disconnect()
                } catch { }
            }, 120)
        } catch { }
    }

    // --- Inicialização ---
    useEffect(() => {
        setDataHoje(new Date().toLocaleDateString('pt-BR'))
        // Relógio em tempo real
        const timer = setInterval(() => {
            setRelogio(new Date().toLocaleTimeString('pt-BR'))
        }, 1000)

        // Primeiro restaura o estado do caixa (permitindo trocar para 'venda' imediatamente se estiver aberto)
        // Depois carrega produtos e vendas em background para evitar bloquear a navegação inicial.
        ;(async () => {
            const caixa = await restaurarCaixaAberto({ changeView: true })
            const idToUse = caixa?.id
            // Carrega o resto dos dados sem forçar troca de view
            carregarProdutos().catch(() => {})
            carregarVendasHoje(idToUse).catch(() => {})
            carregarSaidasDoDia(idToUse).catch(() => {})
            carregarCaixasDoDia(caixa?.data || getLocalDateString()).catch(() => {})
        })()

        return () => clearInterval(timer)
    }, [])

    // Quando a aba do navegador volta a ficar visível ou a janela ganha foco,
    // recarrega produtos, vendas e restaura estado do caixa.
    useEffect(() => {
        const onVisible = () => {
            carregarProdutos()
            const idToUse = caixaDiarioId
            carregarVendasHoje(idToUse)
            carregarSaidasDoDia(idToUse)
            carregarCaixasDoDia(caixaDiaISO || undefined)
            try {
                // Atualizar lista de clientes/movimentações caso tenham sido alteradas na aba de gestão
                if (typeof refreshClientes === 'function') refreshClientes()
                if (typeof refreshMovimentacoes === 'function') refreshMovimentacoes()
            } catch (e) {
                console.warn('Falha ao refrescar clientes/movimentacoes ao voltar ao foco:', e)
            }
        }

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') onVisible()
        }

        window.addEventListener('focus', onVisible)
        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            window.removeEventListener('focus', onVisible)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [caixaDiaISO])

    // Ao abrir o modal de caderneta, atualizar lista de clientes (ex: limite alterado na caderneta)
    useEffect(() => {
        if (modalCaderneta) {
            if (typeof refreshClientes === 'function') refreshClientes()
            if (typeof refreshMovimentacoes === 'function') refreshMovimentacoes()
        }
    }, [modalCaderneta])

    // Suporte a query param view=caderneta (ex.: redirect de /caixa/caderneta)
    useEffect(() => {
        if (searchParams.get('view') === 'caderneta' && caixaAberto) {
            setView('caderneta')
        }
    }, [searchParams, caixaAberto])

    // Ao trocar a view interna para 'venda', 'historico' ou 'cupom', garante refresh imediato dos dados.
    useEffect(() => {
        if (view === 'venda' || view === 'historico' || view === 'cupom') {
            if (view !== 'cupom') carregarProdutos()
            carregarVendasHoje(caixaDiarioId)
        }
    }, [view, caixaDiarioId])

    // Ao abrir a view 'saida' ou 'caixa' (aba principal do caixa),
    // recarrega saídas e caixas do dia para garantir que o total exibido
    // esteja sempre atualizado (inclui pagamentos de caderneta).
    useEffect(() => {
        if (view === 'saida' || view === 'caixa') {
            carregarSaidasDoDia(caixaDiarioId)
            carregarCaixasDoDia(caixaDiaISO || undefined).catch(() => {})
        }
    }, [view, caixaDiarioId, caixaDiaISO])

    // Ao abrir a view 'cupom', carrega configuração do localStorage
    useEffect(() => {
        if (view === 'cupom' && typeof window !== 'undefined') {
            setCupomNomeLoja(localStorage.getItem('cupom-nome-loja') || 'REY DOS PÃES')
            setCupomCnpj(localStorage.getItem('cupom-cnpj') || '00.000.000/0001-00')
            setCupomEndereco(localStorage.getItem('cupom-endereco') || 'Endereço da Loja')
            setCupomCidadeUf(localStorage.getItem('cupom-cidade-uf') || 'Cidade - UF')
            setCupomMensagem(localStorage.getItem('cupom-mensagem') || 'REY DOS PÃES - CAIXA')
            const count = parseInt(localStorage.getItem('cupom-imprimidos') || '0', 10)
            setCupomImprimidos(isNaN(count) ? 0 : count)
        }
    }, [view])

    const imprimirVendaPorId = async (
        vendaId: number,
        cadernetaData?: { clienteNome?: string; saldoDevedorAnterior: number; valorCompra: number; saldoDevedorAtualizado: number }
    ) => {
        const urlBase = (typeof window !== 'undefined' ? localStorage.getItem('impressao-local-url') : null) || 'https://127.0.0.1:3333'
        try {
            const linhas = await getCupomFiscalLinhas(vendaId, cadernetaData)
            const res = await fetch(`${urlBase}/imprimir-cupom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ linhas }),
            })
            if (res.ok) {
                incrementarCupomImprimido()
                showToast('Cupom enviado para impressora.', 'success')
                return
            }
            throw new Error(await res.text())
        } catch (_) {
            try {
                await printCupomFiscalNFCe(vendaId, cadernetaData)
                incrementarCupomImprimido()
                showToast('Cupom aberto para impressão no navegador.', 'success')
            } catch (e) {
                console.error('Erro ao imprimir cupom:', e)
                showToast('Falha ao imprimir cupom.', 'error')
            }
        }
    }

    const incrementarCupomImprimido = () => {
        if (typeof window === 'undefined') return
        const count = parseInt(localStorage.getItem('cupom-imprimidos') || '0', 10)
        const novo = (isNaN(count) ? 0 : count) + 1
        localStorage.setItem('cupom-imprimidos', String(novo))
        setCupomImprimidos(novo)
    }

    const salvarConfigCupom = () => {
        if (typeof window === 'undefined') return
        localStorage.setItem('cupom-nome-loja', cupomNomeLoja)
        localStorage.setItem('cupom-cnpj', cupomCnpj)
        localStorage.setItem('cupom-endereco', cupomEndereco)
        localStorage.setItem('cupom-cidade-uf', cupomCidadeUf)
        localStorage.setItem('cupom-mensagem', cupomMensagem)
        showToast('Configuração do cupom salva com sucesso.', 'success')
    }

    const restaurarPadraoCupom = () => {
        setCupomNomeLoja('REY DOS PÃES')
        setCupomCnpj('00.000.000/0001-00')
        setCupomEndereco('Endereço da Loja')
        setCupomCidadeUf('Cidade - UF')
        setCupomMensagem('REY DOS PÃES - CAIXA')
        showToast('Valores padrão restaurados. Clique em Salvar para aplicar.', 'info')
    }

    const imprimirCupomTeste = () => {
        const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        const now = new Date()
        const dataFormatada = now.toLocaleDateString('pt-BR')
        const horaFormatada = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
        const htmlItems = `
            <tr><td style="padding: 2px 0; font-size: 11px; font-weight: 600; color: #000;">1 12345 PÃO FRANCÊS</td><td style="text-align: right; font-size: 11px; font-weight: 600;">2,50</td></tr>
            <tr><td style="font-size: 10px; font-weight: 600; color: #000;">1 UN x 2,50</td><td></td></tr>
            <tr><td style="padding: 2px 0; font-size: 11px; font-weight: 600; color: #000;">2 67890 CAFÉ</td><td style="text-align: right; font-size: 11px; font-weight: 600;">5,00</td></tr>
            <tr><td style="font-size: 10px; font-weight: 600; color: #000;">1 UN x 5,00</td><td></td></tr>
        `
        const html = `
            <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cupom Teste</title>
            <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;font-weight:600;width:280px;padding:6px;background:#fff;line-height:1.2;color:#000}.center{text-align:center}.divider{border-top:1px dashed #000;margin:4px 0}table{width:100%;border-collapse:collapse}@media print{html,body{width:80mm!important;min-height:auto!important;margin:0!important;padding:2mm!important;padding-bottom:5mm!important;font-size:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:80mm auto!important;margin:0!important}}</style></head>
            <body>
                <div class="center" style="margin-bottom:4px">
                    <div style="font-size:13px;font-weight:bold">${esc(cupomNomeLoja)}</div>
                    <div style="font-size:10px;font-weight:600;color:#000">${esc(cupomEndereco)} / ${esc(cupomCidadeUf)}</div>
                    <div style="font-size:10px;font-weight:600;color:#000">CNPJ: ${esc(cupomCnpj)} | ${dataFormatada} ${horaFormatada}</div>
                </div>
                <div class="divider"></div>
                <div class="center" style="font-size:12px;font-weight:bold;margin-bottom:2px">CUPOM FISCAL</div>
                <div class="center" style="font-size:10px;font-weight:600;color:#000">Comprovante de Venda (TESTE)</div>
                <div class="divider"></div>
                <table><tbody>${htmlItems}</tbody></table>
                <div class="divider"></div>
                <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600"><span>SUBTOTAL R$</span><span>7,50</span></div>
                <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600"><span>TOTAL R$</span><span>7,50</span></div>
                <div class="divider"></div>
                <div class="center" style="font-size:10px;font-weight:600;margin:6px 0;color:#000">${esc(cupomMensagem)}</div>
            </body></html>
        `
        const w = window.open('', '_blank', 'width=320,height=500')
        if (!w) { showToast('Permita pop-ups para imprimir o cupom de teste.', 'warning'); return }
        w.document.write(html)
        w.document.close()
        w.focus()
        w.onafterprint = () => w.close()
        setTimeout(() => w.print(), 300)
        showToast('Cupom de teste aberto para impressão.', 'success')
    }

    // --- Integração com Supabase (Dados Reais) ---

    // Carrega produtos do estoque de varejo (mesma lógica da pág. código de barras)
    async function carregarProdutos() {
        try {
            if (!isOnline) {
                const cached = await offlineStorage.getOfflineData('varejo')
                const data = (cached || []).filter((item: any) => item.ativo !== false)
                const produtosFormatados: Produto[] = data.map((item: any) => ({
                    id: item.id,
                    codigoBarras: item.codigo_barras || '',
                    codigoBalanca: item.codigo_balanca || undefined,
                    nome: item.nome,
                    preco: item.preco_venda || 0,
                    estoque: item.estoque_atual || 0,
                    unidade: item.unidade || 'un'
                }))
                setProdutos(produtosFormatados)
                return
            }

            const { data, error } = await getSupabase()
                .from('varejo')
                .select('*')
                .eq('ativo', true)

            if (error) throw error

            const produtosFormatados: Produto[] = (data || []).map((item: any) => ({
                id: item.id,
                codigoBarras: item.codigo_barras || '',
                codigoBalanca: item.codigo_balanca || undefined,
                nome: item.nome,
                preco: item.preco_venda || 0,
                estoque: item.estoque_atual || 0,
                unidade: item.unidade || 'un'
            }))

            setProdutos(produtosFormatados)
            if (data?.length) {
                await offlineStorage.saveOfflineData('varejo', data)
            }
        } catch (error) {
            if (!isOnline) {
                try {
                    const cached = await offlineStorage.getOfflineData('varejo')
                    const data = (cached || []).filter((item: any) => item.ativo !== false)
                    const produtosFormatados: Produto[] = data.map((item: any) => ({
                        id: item.id,
                        codigoBarras: item.codigo_barras || '',
                        codigoBalanca: item.codigo_balanca || undefined,
                        nome: item.nome,
                        preco: item.preco_venda || 0,
                        estoque: item.estoque_atual || 0,
                        unidade: item.unidade || 'un'
                    }))
                    setProdutos(produtosFormatados)
                } catch {
                    // ignorar
                }
            } else {
                console.error('Erro ao carregar produtos:', error)
            }
        }
    }

    // Botão/handler para atualizar manualmente o relatório de vendas
    const handleRefreshRelatorio = async () => {
        setIsRefreshing(true)
        try {
            await carregarVendasHoje(caixaDiarioId)
            showToast('Relatório atualizado', 'success')
        } catch (e) {
            console.error('Erro ao atualizar relatório:', e)
            showToast('Erro ao atualizar relatório', 'error')
        } finally {
            // pequeno delay visual
            setTimeout(() => setIsRefreshing(false), 250)
        }
    }

    

    // Subscrição realtime para atualizar Relatórios (vendasHoje)
    useEffect(() => {
        if (!supabase) return

        const channel = supabase
            .channel('realtime:vendas')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'vendas' },
                (payload: any) => {
                    try {
                        // Tenta aplicar alteração incrementalmente para ser mais responsivo
                        const record = payload?.new || payload?.record || null
                        if (record && record.id) {
                            try {
                                // normalize record date
                                const recDateRaw = String(record.data || '')
                                const recDate = recDateRaw.split('T')[0] || recDateRaw
                                const base = caixaDiaISORef.current ? new Date(caixaDiaISORef.current) : new Date()
                                const y = base.getFullYear()
                                const m = String(base.getMonth() + 1).padStart(2, '0')
                                const d = String(base.getDate()).padStart(2, '0')
                                const baseStr = `${y}-${m}-${d}`

                                // Verifica se a venda pertence ao caixa atual (preferencialmente por ID, fallback por data)
                                const pertenceAoCaixa = record.caixa_diario_id 
                                    ? record.caixa_diario_id === caixaDiarioIdRef.current
                                    : (!caixaDiaISORef.current || recDate === baseStr)

                                if (pertenceAoCaixa) {
                                    const hora = record.created_at ? new Date(record.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                    const novaVenda = {
                                        id: record.id,
                                        data: hora,
                                        total: record.valor_total || 0,
                                        forma_pagamento: String(record.forma_pagamento || '').replace('_', ' ')
                                    }
                                    // Prepend only on INSERT events
                                    if (String(payload?.eventType || payload?.event || '').toLowerCase().includes('insert') || !payload?.eventType) {
                                        setVendasHoje(prev => [novaVenda, ...prev])
                                        // Não retornar aqui: sempre agendamos um refresh debounced abaixo
                                        console.debug('vendasHoje atualizada incrementalmente (realtime)')
                                    }
                                }
                            } catch (err) {
                                console.warn('Erro processando payload realtime vendas (incr):', err)
                            }
                        }

                        // Fallback: agendar recarga curta para atualizar relatório (debounce 250ms)
                        try { if (refreshVendasTimeoutRef.current) { window.clearTimeout(refreshVendasTimeoutRef.current); refreshVendasTimeoutRef.current = null } } catch {}
                        refreshVendasTimeoutRef.current = window.setTimeout(() => {
                            carregarVendasHojeRef.current?.(caixaDiarioIdRef.current).catch(() => { })
                        }, 250)
                    } catch (e) {
                        console.warn('Erro no handler realtime vendas:', e)
                    }
                }
            )
            .subscribe()

        return () => {
            try { channel.unsubscribe() } catch { /* ignore */ }
        }
    }, [])

    // --- Lógica do Carrinho ---

    const adicionarAoCarrinho = (produto: Produto) => {
        if (produto.estoque <= 0) {
            showToast('Produto sem estoque', 'warning')
            return
        }

        // Se for produto de peso (kg/g), abre modal para digitar o peso
        const isPeso = produto.unidade === 'kg' || produto.unidade === 'g'
        if (isPeso) {
            setProdutoPendentePeso(produto)
            setPesoDigitado('')
            setModalPeso(true)
            setSearchTerm('')
            return
        }

        setCarrinho(prev => {
            const existente = prev.find(p => p.id === produto.id)
            if (existente) {
                if (existente.qtdCarrinho >= produto.estoque) {
                    showToast('Estoque insuficiente', 'warning')
                    return prev
                }
                const updated = prev.map(p => p.id === produto.id ? { ...p, qtdCarrinho: p.qtdCarrinho + 1 } : p)
                setLastAddedItem({ ...produto, qtdCarrinho: existente.qtdCarrinho + 1 })
                return updated
            }
            setLastAddedItem({ ...produto, qtdCarrinho: 1 })
            return [...prev, { ...produto, qtdCarrinho: 1 }]
        })
        setSearchTerm('') // Limpa busca após adicionar
        searchInputRef.current?.blur()
    }

    // Confirma peso digitado e adiciona ao carrinho
    const confirmarPesoManual = () => {
        if (!produtoPendentePeso) return
        const peso = parseFloat(pesoDigitado.replace(',', '.'))
        if (isNaN(peso) || peso <= 0) {
            showToast('Digite um peso válido', 'warning')
            return
        }
        adicionarAoCarrinhoComPesoOuPreco(produtoPendentePeso, peso, produtoPendentePeso.preco)
        setModalPeso(false)
        setProdutoPendentePeso(null)
        setPesoDigitado('')
    }

    const removerDoCarrinho = (id: number) => {
        setCarrinho(prev => prev.filter(item => item.id !== id))
    }

    const alterarQtd = (id: number, delta: number) => {
        setCarrinho(prev => {
            return prev.map(item => {
                if (item.id === id) {
                    const novaQtd = item.qtdCarrinho + delta
                    if (novaQtd <= 0) return null
                    const isPeso = item.unidade === 'kg' || item.unidade === 'g'
                    const estoqueOk = !isPeso || item.estoque <= 0 || item.estoque == null || novaQtd <= item.estoque
                    if (!estoqueOk) {
                        showToast('Estoque limite atingido', 'warning')
                        return item
                    }
                    return { ...item, qtdCarrinho: novaQtd }
                }
                return item
            }).filter(Boolean) as ItemCarrinho[]
        })
    }

    const adicionarAoCarrinhoComPesoOuPreco = (produto: Produto, qtd: number, precoUnit: number) => {
        const isPeso = produto.unidade === 'kg' || produto.unidade === 'g'
        const estoqueOk = !isPeso || produto.estoque <= 0 || produto.estoque == null || qtd <= produto.estoque
        if (!estoqueOk) {
            showToast('Estoque insuficiente', 'warning')
            return
        }
        setCarrinho(prev => {
            const existente = prev.find(p => p.id === produto.id)
            if (existente) {
                const novaQtd = existente.qtdCarrinho + qtd
                const estoqueOkMerge = !isPeso || produto.estoque <= 0 || produto.estoque == null || novaQtd <= produto.estoque
                if (!estoqueOkMerge) {
                    showToast('Estoque insuficiente', 'warning')
                    return prev
                }
                const updated = prev.map(p =>
                    p.id === produto.id ? { ...p, qtdCarrinho: novaQtd, preco: precoUnit } : p
                )
                setLastAddedItem({ ...produto, qtdCarrinho: novaQtd, preco: precoUnit })
                return updated
            }
            setLastAddedItem({ ...produto, qtdCarrinho: qtd, preco: precoUnit })
            return [...prev, { ...produto, qtdCarrinho: qtd, preco: precoUnit }]
        })
        setSearchTerm('')
        searchInputRef.current?.blur()
    }

    // Busca produto por PLU (codigo_balanca) - local e Supabase
    const buscarPorPLU = async (plu: string): Promise<Produto | null> => {
        const pluTrim = plu.trim()
        let prod = produtos.find(p => (p.codigoBalanca || '').trim() === pluTrim)
        if (prod) return prod
        try {
            const { data, error } = await getSupabase()
                .from('varejo')
                .select('*')
                .eq('codigo_balanca', pluTrim)
                .eq('ativo', true)
                .limit(1)
            if (error) throw error
            const item = data?.[0]
            if (!item) return null
            const p: Produto = {
                id: item.id,
                codigoBarras: item.codigo_barras || '',
                codigoBalanca: item.codigo_balanca || undefined,
                nome: item.nome,
                preco: item.preco_venda || 0,
                estoque: item.estoque_atual ?? 0,
                unidade: item.unidade || 'un',
            }
            setProdutos(prev => (prev.some(x => x.id === p.id) ? prev : [...prev, p]))
            return p
        } catch (e) {
            console.error('Erro buscando por PLU:', e)
            return null
        }
    }

    // Adiciona via código de barras (EAN normal, EAN balança 13 dígitos, etiqueta 11 dígitos, PLU 5 dígitos)
    const adicionarPorCodigo = async (codigoBruto: string) => {
        const normaliza = (s: string) => s.replace(/\D/g, '')
        const code = (codigoBruto || '').trim()
        const codeNum = normaliza(code)

        // 1) EAN-13 balança (13 dígitos, prefixo 20-29)
        const parsedEan13 = parseEan13Balanca(codeNum)
        if (parsedEan13) {
            const { codigoProduto, valorEmbutido } = parsedEan13
            const prodBalança = await buscarPorPLU(codigoProduto)
            if (!prodBalança) {
                showToast(`Produto não encontrado (PLU: ${codigoProduto})`, 'warning')
                return false
            }
            const precoTotal = valorEmbutido / 100 // R$ do código (VVVVV = centavos)
            const precoPorKg = prodBalança.preco > 0 ? prodBalança.preco : 1
            const qtdKg = precoTotal / precoPorKg // peso em kg
            adicionarAoCarrinhoComPesoOuPreco(prodBalança, qtdKg, precoPorKg)
            return true
        }

        // 2) Etiqueta 11 dígitos (CCCCC-VVVVV-D): PLU + preço em centavos
        const parsed11 = parseEtiqueta11Digitos(codeNum)
        if (parsed11) {
            const { plu, valorCentavos } = parsed11
            const prod = await buscarPorPLU(plu)
            if (!prod) {
                showToast(`Produto não encontrado (PLU: ${plu})`, 'warning')
                return false
            }
            const precoFinal = valorCentavos / 100
            adicionarAoCarrinhoComPesoOuPreco(prod, 1, precoFinal)
            return true
        }

        // 3) Busca por codigo_barras (EAN normal)
        let encontrado = produtos.find(p => {
            const a = (p.codigoBarras || '').trim()
            return a === code || normaliza(a) === codeNum
        })
        if (encontrado) {
            adicionarAoCarrinho(encontrado)
            return true
        }
        try {
            const { data, error } = await getSupabase()
                .from('varejo')
                .select('*')
                .eq('ativo', true)
                .or(`codigo_barras.eq.${code},codigo_barras.eq.${codeNum}`)
                .limit(1)
            if (error) throw error
            const item = data?.[0]
            if (item) {
                const prod: Produto = {
                    id: item.id,
                    codigoBarras: item.codigo_barras || '',
                    codigoBalanca: item.codigo_balanca || undefined,
                    nome: item.nome,
                    preco: item.preco_venda || 0,
                    estoque: item.estoque_atual || 0,
                    unidade: item.unidade || 'un',
                }
                setProdutos(prev => (prev.some(p => p.id === prod.id) ? prev : [...prev, prod]))
                adicionarAoCarrinho(prod)
                return true
            }
        } catch (e) {
            console.error('Erro buscando por código no Supabase:', e)
            return false
        }

        // 4) Fallback: PLU digitado manual (5 dígitos)
        if (/^\d{5}$/.test(codeNum)) {
            const prod = await buscarPorPLU(codeNum)
            if (prod) {
                adicionarAoCarrinho(prod)
                return true
            }
        }

        showToast(`Produto não encontrado: ${code}`, 'warning')
        return false
    }

    const totalVenda = useMemo(() => {
        return carrinho.reduce((acc, item) => acc + (item.preco * item.qtdCarrinho), 0)
    }, [carrinho])

    const descontoAplicado = useMemo(() => {
        const percent = parseFloat(descontoPercent.replace(',', '.')) || 0
        const valor = parseFloat(descontoValor.replace(',', '.')) || 0
        if (valor > 0) return Math.min(valor, totalVenda)
        if (percent > 0) return Math.min((totalVenda * percent) / 100, totalVenda)
        return 0
    }, [descontoPercent, descontoValor, totalVenda])

    const totalComDesconto = useMemo(() => {
        return Math.max(0, totalVenda - descontoAplicado)
    }, [totalVenda, descontoAplicado])

    // Define valor padrão para abatimento quando abrir qualquer modal de pagamento
    useEffect(() => {
        if (modalPagamento || modalDebito || modalCredito || modalPix || modalCaderneta) {
            setValorAbaterCaderneta(totalComDesconto.toFixed(2))
        }
    }, [modalPagamento, modalDebito, modalCredito, modalPix, modalCaderneta, totalComDesconto])

    

    // --- Processamento de Venda (Escrita no Banco) ---

    // Função que gera/imprime um recibo/ cupom simplificado em nova janela.
    const printReceipt = async (vendaId: number, copyNumber = 1, opts?: { clienteNome?: string | null; saldoAnterior?: number | null; valorCompra?: number | null; saldoAtual?: number | null }) => {
        try {
            const [{ data: vendaRow }, { data: itens }] = await Promise.all([
                getSupabase().from('vendas').select('id, created_at, valor_total, forma_pagamento, cliente_caderneta_id').eq('id', vendaId).single(),
                getSupabase().from('venda_itens').select('quantidade, preco_unitario, subtotal, varejo (nome)').eq('venda_id', vendaId)
            ])

            const lojaNome = 'Recibo'
            const venda = (vendaRow as any) || {}
            const itensVenda = (itens as any) || []

            const htmlItems = itensVenda.map((it: any) => `
                <tr>
                    <td style="padding:4px">${it.varejo?.nome || 'Item'}</td>
                    <td style="padding:4px;text-align:right">${it.quantidade} x</td>
                    <td style="padding:4px;text-align:right">R$ ${Number(it.preco_unitario).toFixed(2)}</td>
                    <td style="padding:4px;text-align:right">R$ ${Number(it.subtotal ?? it.quantidade * it.preco_unitario).toFixed(2)}</td>
                </tr>
            `).join('')

            const clienteLine = opts?.clienteNome ? `<div>Cliente: <strong>${opts.clienteNome}</strong></div>` : ''
            const saldoAnteriorLine = (typeof opts?.saldoAnterior === 'number') ? `<div>Saldo anterior: R$ ${Number(opts!.saldoAnterior).toFixed(2)}</div>` : ''
            const valorCompraLine = (typeof opts?.valorCompra === 'number') ? `<div>Valor da compra: R$ ${Number(opts!.valorCompra).toFixed(2)}</div>` : ''
            const saldoAtualLine = (typeof opts?.saldoAtual === 'number') ? `<div>Saldo atualizado: R$ ${Number(opts!.saldoAtual).toFixed(2)}</div>` : ''

            const html = `
                <html>
                <head>
                    <title>${lojaNome} - Venda #${vendaId} - Via ${copyNumber}</title>
                    <style>
                        body { font-family: Arial, Helvetica, sans-serif; font-size:12px; padding:12px }
                        table { width:100%; border-collapse: collapse }
                        @media print {
                            html, body {
                                width: 80mm !important;
                                min-height: auto !important;
                                margin: 0 !important;
                                padding: 2mm !important;
                                font-size: 10px;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            @page {
                                size: 80mm auto !important;
                                margin: 0 !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    <h3>${lojaNome}</h3>
                    <div>Venda: #${vendaId}</div>
                    <div>Data: ${venda.created_at ? new Date(venda.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</div>
                    ${clienteLine}
                    <hr />
                    <table>
                        ${htmlItems}
                    </table>
                    <hr />
                    <div style="text-align:right;font-weight:bold">Total: R$ ${Number(venda.valor_total ?? 0).toFixed(2)}</div>
                    <hr />
                    ${saldoAnteriorLine}
                    ${valorCompraLine}
                    ${saldoAtualLine}
                    <div style="margin-top:10px;font-size:11px">Via: ${copyNumber}</div>
                </body>
                </html>
            `

            const w = window.open('', '_blank')
            if (!w) throw new Error('Não foi possível abrir janela de impressão')
            w.document.open()
            w.document.write(html)
            w.document.close()
            w.focus()
            await new Promise((res) => setTimeout(res, 300))
            w.onafterprint = () => w.close()
            w.print()
            return true
        } catch (err) {
            console.error('printReceipt erro:', err)
            throw err
        }
    }

    // Função para imprimir cupom fiscal (com bloco opcional de atualização do cliente para caderneta)
    const printCupomFiscalNFCe = async (
        vendaId: number,
        cadernetaData?: { clienteNome?: string; saldoDevedorAnterior: number; valorCompra: number; saldoDevedorAtualizado: number }
    ) => {
        try {
            const [{ data: vendaRow }, { data: itens }] = await Promise.all([
                getSupabase().from('vendas').select('id, created_at, valor_total, forma_pagamento, operador_nome, valor_pago, valor_troco, desconto').eq('id', vendaId).single(),
                getSupabase().from('venda_itens').select('quantidade, preco_unitario, subtotal, varejo (id, nome, codigo_barras)').eq('venda_id', vendaId)
            ])

            const venda = (vendaRow as any) || {}
            const itensVenda = (itens as any) || []
            const dataVenda = venda.created_at ? new Date(venda.created_at) : new Date()

            // Formata forma de pagamento
            const formaPagamentoMap: Record<string, string> = {
                'dinheiro': 'Dinheiro',
                'pix': 'PIX',
                'cartao_debito': 'Cartão de Débito',
                'cartao_credito': 'Cartão de Crédito',
                'caderneta': 'Caderneta'
            }
            const formaPagamentoDisplay = formaPagamentoMap[venda.forma_pagamento?.toLowerCase()] || venda.forma_pagamento || 'Não informado'

            // Dados do cupom (configuráveis)
            const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            const nomeLoja = typeof window !== 'undefined' ? (localStorage.getItem('cupom-nome-loja') || 'REY DOS PÃES') : 'REY DOS PÃES'
            const cnpjCupom = typeof window !== 'undefined' ? (localStorage.getItem('cupom-cnpj') || '00.000.000/0001-00') : '00.000.000/0001-00'
            const enderecoCupom = typeof window !== 'undefined' ? (localStorage.getItem('cupom-endereco') || 'Endereço da Loja') : 'Endereço da Loja'
            const cidadeUfCupom = typeof window !== 'undefined' ? (localStorage.getItem('cupom-cidade-uf') || 'Cidade - UF') : 'Cidade - UF'
            const mensagemCupom = typeof window !== 'undefined' ? (localStorage.getItem('cupom-mensagem') || 'REY DOS PÃES - CAIXA') : 'REY DOS PÃES - CAIXA'

            const dataFormatada = dataVenda.toLocaleDateString('pt-BR')
            const horaFormatada = `${String(dataVenda.getHours()).padStart(2, '0')}:${String(dataVenda.getMinutes()).padStart(2, '0')}:${String(dataVenda.getSeconds()).padStart(2, '0')}`

            // Itens no formato do modelo: ITEM CÓD. DESCRIÇÃO | VALOR + linha "QTD UN x unitário" (qtd como 1, 2, 3)
            const htmlItems = itensVenda.map((it: any, idx: number) => {
                const codigo = String(it.varejo?.codigo_barras || it.varejo?.id || (idx + 1))
                const nome = (it.varejo?.nome || 'Item').toUpperCase()
                const qtd = Number(it.quantidade)
                const unitario = Number(it.preco_unitario)
                const subtotal = Number(it.subtotal ?? qtd * unitario)
                const qtdExibir = Number.isInteger(qtd) ? String(qtd) : qtd.toFixed(3)
                const descLinha = `${qtdExibir} UN x ${unitario.toFixed(2)}`
                return `
                    <tr style="border-bottom: 1px dotted #000;">
                        <td style="padding: 2px 0; font-size: 11px; font-weight: 600; vertical-align: top; color: #000;">${idx + 1} ${codigo} ${nome}</td>
                        <td style="padding: 2px 0 2px 6px; font-size: 11px; font-weight: 600; text-align: right; vertical-align: top; white-space: nowrap; color: #000;">${subtotal.toFixed(2)}</td>
                    </tr>
                    <tr style="border-bottom: 1px dotted #000;">
                        <td style="padding: 0 0 3px 0; font-size: 10px; font-weight: 600; color: #000;">${descLinha}</td>
                        <td style="padding: 0 0 3px 6px; font-size: 10px;"></td>
                    </tr>
                `
            }).join('')

            const valorTotal = Number(venda.valor_total ?? 0)
            const valorDesconto = Number(venda.desconto ?? 0)
            const subtotalBruto = valorTotal + valorDesconto
            const operadorNome = (venda.operador_nome || '').trim() || '—'
            const valorPago = Number(venda.valor_pago ?? 0)
            const valorTroco = Number(venda.valor_troco ?? 0)
            const valorRecebidoExibir = valorPago > 0 ? valorPago : valorTotal
            const isDinheiro = (venda.forma_pagamento || '').toLowerCase() === 'dinheiro'

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Cupom Fiscal #${vendaId}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: 'Courier New', monospace;
                            font-size: 11px;
                            font-weight: 600;
                            width: 280px;
                            padding: 6px;
                            background: #fff;
                            line-height: 1.2;
                            color: #000;
                        }
                        .center { text-align: center; }
                        .right { text-align: right; }
                        .bold { font-weight: bold; }
                        .divider { border-top: 1px dashed #000; margin: 4px 0; }
                        .header-cupom { margin-bottom: 4px; }
                        .empresa { font-size: 13px; font-weight: bold; margin-bottom: 2px; }
                        .endereco { font-size: 10px; font-weight: 600; color: #000; margin-bottom: 2px; }
                        .cnpj-data { font-size: 10px; font-weight: 600; color: #000; display: flex; justify-content: space-between; align-items: center; }
                        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                        .col-desc { width: 70%; word-break: break-word; }
                        .col-valor { width: 30%; }
                        .total-line { font-size: 12px; font-weight: bold; }
                        @media print {
                            html, body {
                                width: 80mm !important;
                                min-height: auto !important;
                                margin: 0 !important;
                                padding: 2mm !important;
                                padding-bottom: 5mm !important;
                                font-size: 10px;
                                font-weight: 600;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            @page {
                                size: 80mm auto !important;
                                margin: 0 !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header-cupom center">
                        <div class="empresa">${esc(nomeLoja)}</div>
                        <div class="endereco">${esc(enderecoCupom)} / ${esc(cidadeUfCupom)}</div>
                        <div class="cnpj-data">
                            <span>CNPJ: ${esc(cnpjCupom)}</span>
                            <span>${dataFormatada} ${horaFormatada}</span>
                        </div>
                    </div>

                    <div class="divider"></div>

                    <div class="center bold" style="font-size: 11px; margin-bottom: 2px;">
                        CUPOM FISCAL
                    </div>
                    <div class="center" style="font-size: 10px; font-weight: 600; color: #000;">Comprovante de Venda</div>

                    <div class="divider"></div>

                    <table>
                        <thead>
                            <tr style="border-bottom: 1px solid #000;">
                                <th style="font-size: 10px; font-weight: 700; text-align: left;">ITEM CÓD. DESCRIÇÃO</th>
                                <th style="font-size: 10px; font-weight: 700; text-align: right;">VALOR</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlItems}
                        </tbody>
                    </table>

                    <div class="divider"></div>

                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
                        <span>SUBTOTAL R$</span>
                        <span>${subtotalBruto.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
                        <span>VALOR RECEBIDO (${formaPagamentoDisplay}) R$</span>
                        <span>${valorRecebidoExibir.toFixed(2)}</span>
                    </div>
                    ${isDinheiro ? `
                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
                        <span>TROCO R$</span>
                        <span>${valorTroco.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
                        <span>DESCONTO R$</span>
                        <span>${valorDesconto > 0 ? '-' : ''}${valorDesconto.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 2px;" class="total-line">
                        <span>TOTAL R$</span>
                        <span>${valorTotal.toFixed(2)}</span>
                    </div>

                    <div class="divider"></div>
                    <div style="font-size: 10px; font-weight: 600; color: #000; margin-bottom: 6px;">
                        OPERADOR: ${esc(operadorNome)}
                    </div>
                    ${cadernetaData ? `
                    <div class="divider"></div>
                    <div class="center bold" style="font-size: 10px; margin-bottom: 4px;">COMPRA NA CADERNETA</div>
                    <div class="divider"></div>
                    <div style="font-size: 11px; font-weight: 700; color: #000; margin-bottom: 4px;">
                        Cliente: ${esc(cadernetaData.clienteNome || '—')}
                    </div>
                    <div class="center bold" style="font-size: 10px; margin-bottom: 4px;">ATUALIZAÇÃO DO CLIENTE</div>
                    <div class="divider"></div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
                        <span>Saldo devedor anterior</span>
                        <span>R$ ${cadernetaData.saldoDevedorAnterior.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
                        <span>Valor da compra</span>
                        <span>R$ ${cadernetaData.valorCompra.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
                        <span>Saldo devedor atual.</span>
                        <span>R$ ${cadernetaData.saldoDevedorAtualizado.toFixed(2)}</span>
                    </div>
                    <div class="divider"></div>
                    <div style="margin-top: 12px; margin-bottom: 8px;">
                        <div style="font-size: 10px; font-weight: 600; margin-bottom: 4px;">Assinatura do cliente:</div>
                        <div style="border-bottom: 1px dashed #000; height: 28px; margin-top: 2px;"></div>
                    </div>
                    <div class="divider"></div>
                    ` : ''}
                    <div class="center bold" style="font-size: 11px; margin: 8px 0;">
                        OBRIGADO, VOLTE SEMPRE!
                    </div>
                    <div class="center" style="font-size: 10px; font-weight: 600; color: #000;">
                        ${esc(mensagemCupom)}
                    </div>
                </body>
                </html>
            `

            const w = window.open('', '_blank', 'width=320,height=600')
            if (!w) throw new Error('Não foi possível abrir janela de impressão')
            w.document.open()
            w.document.write(html)
            w.document.close()
            w.focus()
            await new Promise((res) => setTimeout(res, 300))
            w.onafterprint = () => w.close()
            w.print()
            return true
        } catch (err) {
            console.error('printCupomFiscalNFCe erro:', err)
            showToast('Erro ao imprimir comprovante', 'error')
            throw err
        }
    }

    // Gera linhas de texto do cupom para impressora térmica (serviço local Elgin i9)
    const getCupomFiscalLinhas = async (
        vendaId: number,
        cadernetaData?: { clienteNome?: string; saldoDevedorAnterior: number; valorCompra: number; saldoDevedorAtualizado: number }
    ): Promise<string[]> => {
        const [{ data: vendaRow }, { data: itens }] = await Promise.all([
            getSupabase().from('vendas').select('id, created_at, valor_total, forma_pagamento, operador_nome, valor_pago, valor_troco, desconto').eq('id', vendaId).single(),
            getSupabase().from('venda_itens').select('quantidade, preco_unitario, subtotal, varejo (id, nome, codigo_barras)').eq('venda_id', vendaId)
        ])
        const venda = (vendaRow as any) || {}
        const itensVenda = (itens as any) || []
        const dataVenda = venda.created_at ? new Date(venda.created_at) : new Date()
        const formaPagamentoMap: Record<string, string> = {
            'dinheiro': 'Dinheiro', 'pix': 'PIX', 'cartao_debito': 'Cartão Débito', 'cartao_credito': 'Cartão Crédito', 'caderneta': 'Caderneta'
        }
        const formaPagamentoDisplay = formaPagamentoMap[venda.forma_pagamento?.toLowerCase()] || venda.forma_pagamento || 'Não informado'
        const nomeLoja = typeof window !== 'undefined' ? (localStorage.getItem('cupom-nome-loja') || 'REY DOS PAES') : 'REY DOS PAES'
        const cnpjCupom = typeof window !== 'undefined' ? (localStorage.getItem('cupom-cnpj') || '00.000.000/0001-00') : '00.000.000/0001-00'
        const enderecoCupom = typeof window !== 'undefined' ? (localStorage.getItem('cupom-endereco') || 'Endereco da Loja') : 'Endereco da Loja'
        const cidadeUfCupom = typeof window !== 'undefined' ? (localStorage.getItem('cupom-cidade-uf') || 'Cidade - UF') : 'Cidade - UF'
        const mensagemCupom = typeof window !== 'undefined' ? (localStorage.getItem('cupom-mensagem') || 'REY DOS PÃES - CAIXA') : 'REY DOS PÃES - CAIXA'
        const dataFormatada = dataVenda.toLocaleDateString('pt-BR')
        const horaFormatada = `${String(dataVenda.getHours()).padStart(2, '0')}:${String(dataVenda.getMinutes()).padStart(2, '0')}:${String(dataVenda.getSeconds()).padStart(2, '0')}`
        const valorTotal = Number(venda.valor_total ?? 0)
        const valorDesconto = Number(venda.desconto ?? 0)
        const subtotalBruto = valorTotal + valorDesconto
        const operadorNome = (venda.operador_nome || '').trim() || '-'
        const valorPago = Number(venda.valor_pago ?? 0)
        const valorTroco = Number(venda.valor_troco ?? 0)
        const valorRecebidoExibir = valorPago > 0 ? valorPago : valorTotal
        const isDinheiro = (venda.forma_pagamento || '').toLowerCase() === 'dinheiro'

        const linhas: string[] = []
        const L = 48
        const center = (s: string) => s.padStart(Math.floor((L + s.length) / 2)).padEnd(L)
        const right = (s: string) => s.padStart(L)

        // ESC E 1 = ativar negrito em toda impressão (Elgin i9 / ESC/POS)
        const ESC_BOLD = '\x1b\x45\x01'
        linhas.push(ESC_BOLD)
        linhas.push('')
        linhas.push(center(nomeLoja))
        linhas.push(center(`${enderecoCupom} / ${cidadeUfCupom}`))
        linhas.push(`CNPJ: ${cnpjCupom}`)
        linhas.push(right(`${dataFormatada} ${horaFormatada}`))
        linhas.push('--------------------------------')
        linhas.push(center('CUPOM FISCAL'))
        linhas.push(center('Comprovante de Venda'))
        linhas.push('--------------------------------')
        linhas.push('ITEM COD. DESCRICAO        VALOR')
        linhas.push('--------------------------------')
        itensVenda.forEach((it: any, idx: number) => {
            const codigo = String(it.varejo?.codigo_barras ?? it.varejo?.id ?? idx + 1)
            const nome = String(it.varejo?.nome ?? 'Item').substring(0, 16)
            const qtd = Number(it.quantidade)
            const unitario = Number(it.preco_unitario)
            const subtotal = Number(it.subtotal ?? qtd * unitario)
            const qtdExibir = Number.isInteger(qtd) ? String(qtd) : qtd.toFixed(3)
            const descLinha = `${idx + 1} ${codigo} ${nome}`.substring(0, 28).padEnd(28)
            linhas.push(descLinha + subtotal.toFixed(2).padStart(8))
            linhas.push(`  ${qtdExibir} UN x ${unitario.toFixed(2)}`)
        })
        linhas.push('--------------------------------')
        linhas.push(`SUBTOTAL R$`.padEnd(L - 12) + subtotalBruto.toFixed(2))
        linhas.push(`VALOR RECEBIDO (${formaPagamentoDisplay}) R$`.padEnd(L - 12) + valorRecebidoExibir.toFixed(2))
        if (isDinheiro) linhas.push(`TROCO R$`.padEnd(L - 12) + valorTroco.toFixed(2))
        linhas.push(`DESCONTO R$`.padEnd(L - 12) + (valorDesconto > 0 ? '-' : '') + valorDesconto.toFixed(2))
        linhas.push('--------------------------------')
        linhas.push(`TOTAL R$`.padEnd(L - 12) + valorTotal.toFixed(2))
        linhas.push('--------------------------------')
        linhas.push(`OPERADOR: ${operadorNome}`)
        if (cadernetaData) {
            linhas.push('--------------------------------')
            linhas.push(center('COMPRA NA CADERNETA'))
            linhas.push('--------------------------------')
            linhas.push(`Cliente: ${(cadernetaData.clienteNome || '—').trim()}`)
            linhas.push(center('ATUALIZAÇÃO DO CLIENTE'))
            linhas.push('--------------------------------')
            linhas.push(`Saldo devedor anterior R$`.padEnd(L - 12) + cadernetaData.saldoDevedorAnterior.toFixed(2))
            linhas.push(`Valor da compra        R$`.padEnd(L - 12) + cadernetaData.valorCompra.toFixed(2))
            linhas.push(`Saldo devedor atual.   R$`.padEnd(L - 12) + cadernetaData.saldoDevedorAtualizado.toFixed(2))
            linhas.push('--------------------------------')
            linhas.push('Assinatura do cliente:')
            linhas.push('_____________________________')
            linhas.push('--------------------------------')
        }
        linhas.push('')
        linhas.push(center('OBRIGADO, VOLTE SEMPRE!'))
        linhas.push(center(mensagemCupom))
        linhas.push('')
        linhas.push('')
        return linhas
    }

    const finalizarVenda = async (formaPagamento: string) => {
        if (carrinho.length === 0) return
        setLoading(true)

        // Mapeamento para os valores aceitos no banco de dados (CHECK constraint)
        let formaPagamentoDB = formaPagamento.toLowerCase()
        if (formaPagamentoDB === 'debito' || formaPagamentoDB === 'débito') formaPagamentoDB = 'cartao_debito'
        if (formaPagamentoDB === 'credito' || formaPagamentoDB === 'crédito') formaPagamentoDB = 'cartao_credito'

        // Preparar valores monetários para o banco
        const valorTotal = totalComDesconto
        let valorPago = 0
        let valorDebito = 0
        let valorTroco = 0

        if (formaPagamento === 'caderneta') {
            valorDebito = valorTotal
        } else if (formaPagamento === 'dinheiro') {
            const recebido = parseFloat(valorRecebido.replace(',', '.')) || 0
            valorPago = recebido
            valorTroco = Math.max(0, recebido - valorTotal)
        } else {
            // Cartões e Pix consideram-se pagos integralmente
            valorPago = valorTotal
        }

        // Se pagamento por caderneta e houver cliente selecionado, verificar saldo/limite
        if (formaPagamento === 'caderneta' && clienteCadernetaSelecionado) {
            try {
                const clienteIdNum = Number(clienteCadernetaSelecionado)
                // Tenta usar cache local antes de consultar o DB
                let clienteInfo: any = clientes?.find((c: any) => Number(c.id) === clienteIdNum) || null
                if (!clienteInfo) {
                    const { data: cData, error: cErr } = await getSupabase()
                        .from('clientes_caderneta')
                        .select('id, nome, saldo_devedor, limite_credito')
                        .eq('id', clienteIdNum)
                        .single()
                    if (!cErr) clienteInfo = cData
                }

                const saldoDevedor = Number(clienteInfo?.saldo_devedor ?? 0)
                const limiteCredito = Number(clienteInfo?.limite_credito ?? 0)
                const limiteDisponivel = limiteCredito - saldoDevedor
                const saldoApos = Number((limiteDisponivel - valorTotal).toFixed(2))

                if (saldoApos < 0) {
                    setCadernetaErroLimite(`Venda bloqueada: valor (R$ ${valorTotal.toFixed(2)}) excede o limite disponível (R$ ${limiteDisponivel.toFixed(2)}) do cliente.`)
                    setLoading(false)
                    return
                }
            } catch (e) {
                console.error('Erro ao validar saldo do cliente:', e)
                // Se falhar ao buscar cliente, deixa seguir para tentar registrar (modo conservador)
            }
        }

        try {
            const dataISO = (() => {
                const _d = new Date()
                const y = _d.getFullYear()
                const m = String(_d.getMonth() + 1).padStart(2, '0')
                const day = String(_d.getDate()).padStart(2, '0')
                return `${y}-${m}-${day}`
            })()

            if (!isOnline) {
                const tempVendaId = -Date.now()
                const vendaPayload = {
                    _tempVendaId: tempVendaId,
                    numero_venda: Date.now(),
                    data: dataISO,
                    valor_total: valorTotal,
                    valor_pago: valorPago,
                    valor_debito: valorDebito,
                    valor_troco: valorTroco,
                    desconto: descontoAplicado,
                    forma_pagamento: formaPagamentoDB,
                    usuario: operador || null,
                    operador_nome: operador || null,
                    caixa_diario_id: caixaDiarioId,
                    status: 'finalizada',
                    cliente_caderneta_id: clienteCadernetaSelecionado ? Number(clienteCadernetaSelecionado) : null
                }
                await offlineStorage.addPendingOperation({ type: 'INSERT', table: 'vendas', data: vendaPayload })
                for (const item of carrinho) {
                    await offlineStorage.addPendingOperation({
                        type: 'INSERT',
                        table: 'venda_itens',
                        data: {
                            venda_id: tempVendaId,
                            varejo_id: item.id,
                            quantidade: item.qtdCarrinho,
                            preco_unitario: item.preco,
                            subtotal: item.qtdCarrinho * item.preco
                        }
                    })
                }
                const vendasCached = await offlineStorage.getOfflineData('vendas')
                const novaVendaLocal = {
                    id: tempVendaId,
                    data: dataISO,
                    valor_total: valorTotal,
                    forma_pagamento: formaPagamentoDB,
                    caixa_diario_id: caixaDiarioId,
                    created_at: new Date().toISOString()
                }
                await offlineStorage.saveOfflineData('vendas', [novaVendaLocal, ...(vendasCached || [])])
                showToast('Venda salva offline. Será sincronizada quando online.', 'success')
                setLastVendaId(tempVendaId)
                setVendasHoje(prev => [{
                    id: tempVendaId,
                    data: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    total: valorTotal,
                    forma_pagamento: formaPagamentoDB.replace('_', ' ')
                }, ...prev])
                setCarrinho([])
                setLastAddedItem(null)
                setDescontoPercent('')
                setDescontoValor('')
                setClienteCadernetaSelecionado('')
                setModalPagamento(false)
                setModalDebito(false)
                setModalCredito(false)
                setModalPix(false)
                setModalCaderneta(false)
                setLastCadernetaPrintData(null)
                abrirModalPosVendaComDelay(300)
                setLoading(false)
                return
            }

            // 1. Registrar Venda na tabela 'vendas'
            const { data: vendaData, error: vendaError } = await getSupabase()
                .from('vendas')
                .insert<any>({
                    numero_venda: Date.now(),
                    data: dataISO,
                    valor_total: valorTotal,
                    valor_pago: valorPago,
                    valor_debito: valorDebito,
                    valor_troco: valorTroco,
                    desconto: descontoAplicado,
                    forma_pagamento: formaPagamentoDB,
                    usuario: operador || null,
                    operador_nome: operador || null,
                    caixa_diario_id: caixaDiarioId,
                    status: 'finalizada',
                    cliente_caderneta_id: clienteCadernetaSelecionado ? Number(clienteCadernetaSelecionado) : null
                })
                .select()
                .single()

            if (vendaError) throw vendaError

            if (!vendaData) throw new Error('Erro: Venda criada mas sem dados de retorno.')

            // 2. Registrar Itens na tabela 'venda_itens'
            const itensVenda = carrinho.map(item => ({
                venda_id: vendaData.id,
                varejo_id: item.id,
                quantidade: item.qtdCarrinho,
                preco_unitario: item.preco,
                subtotal: item.qtdCarrinho * item.preco
            }))

            const { error: itensError } = await getSupabase()
                .from('venda_itens')
                .insert<Database['public']['Tables']['venda_itens']['Insert']>(itensVenda)

            if (itensError) throw itensError

            // 3. Baixa no Estoque (Atualiza 'varejo') — em paralelo
            await Promise.all(
                carrinho.map((item) => {
                    const novoEstoque = item.estoque - item.qtdCarrinho
                    return getSupabase()
                        .from('varejo')
                        .update<Database['public']['Tables']['varejo']['Update']>({ estoque_atual: novoEstoque })
                        .eq('id', item.id)
                })
            )

            // Sucesso: notificar. Agendaremos o modal de impressão APENAS se todas as
            // etapas de pós-processamento (caderneta, caixa, fluxo) ocorrerem sem erros.
            showToast('Venda realizada com sucesso!', 'success')
            setLastVendaId(vendaData.id)

            // Flag que indica se houve algum problema no pós-processamento
            let postSaleIssue = false
            // Dados para impressão da 1ª via caderneta (usado antes do state atualizar)
            let cadernetaDataParaPrimeiraVia: { vendaId: number; clienteNome: string; saldoDevedorAnterior: number; valorCompra: number; saldoDevedorAtualizado: number } | null = null

            // Atualiza `vendasHoje` localmente para refletir a venda em tempo real
            try {
                const hora = vendaData.created_at
                    ? new Date(vendaData.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

                const novaVenda = {
                    id: vendaData.id,
                    data: hora,
                    total: vendaData.valor_total ?? valorTotal,
                    forma_pagamento: String(vendaData.forma_pagamento || formaPagamentoDB).replace('_', ' ')
                }

                setVendasHoje(prev => [novaVenda, ...prev])
            } catch (e) {
                console.error('Falha ao atualizar vendasHoje localmente:', e)
            }

            // Se houver cliente/funcionário selecionado, registra movimentação na caderneta
            try {
                // Se houver cliente/funcionário selecionado, registra movimentação na caderneta
                // Apenas registre na caderneta quando a forma de pagamento for 'caderneta'.
                // Pagamentos por Pix/Débito/Crédito no PDV NÃO devem alterar a caderneta automaticamente.
                try {
                    if (clienteCadernetaSelecionado && vendaData?.id) {
                        const clienteIdNum = Number(clienteCadernetaSelecionado)
                        if (formaPagamento === 'caderneta') {
                            const valorCompra = valorTotal
                            const res = await registerMovimentacaoDb({
                                cliente_id: clienteIdNum,
                                tipo: 'compra',
                                valor: valorCompra,
                                venda_id: vendaData.id,
                                observacoes: `Venda a prazo registrada no PDV (venda #${vendaData.id})`
                            })

                            if (!res.success) {
                                console.error('Falha ao registrar compra na caderneta (DB):', res)
                                postSaleIssue = true
                                alert('Erro ao registrar compra na caderneta: ' + (res.message || 'Verifique o console'))
                            } else {
                                try { refreshClientes(); refreshMovimentacoes(); } catch (e) { console.error(e) }
                                const clienteNome = clientes?.find((c: any) => Number(c.id) === clienteIdNum)?.nome ?? 'Cliente'
                                const dados = {
                                    vendaId: vendaData.id,
                                    clienteNome,
                                    saldoDevedorAnterior: res.saldoAnterior ?? 0,
                                    valorCompra,
                                    saldoDevedorAtualizado: res.novoSaldo ?? 0
                                }
                                setLastCadernetaPrintData(dados)
                                cadernetaDataParaPrimeiraVia = dados
                            }
                        }
                    }
                } catch (movErr) {
                    console.error('Falha ao preparar registro na caderneta:', movErr)
                    postSaleIssue = true
                }
            } catch (movErr) {
                console.error('Falha ao preparar registro na caderneta:', movErr)
                postSaleIssue = true
            }

            // --- Registrar entrada no caixa_diario / caixa_movimentacoes / fluxo_caixa ---
            try {
                let effectiveCaixaId = caixaDiarioId
                if (!effectiveCaixaId) {
                    try {
                        const { data: openCaixa, error: openErr } = await getSupabase()
                            .from('caixa_diario')
                            .select('id')
                            .eq('status', 'aberto')
                            .limit(1)
                            .single()

                        if (!openErr && openCaixa && openCaixa.id) {
                            effectiveCaixaId = openCaixa.id
                            setCaixaDiarioId(effectiveCaixaId)
                            setCaixaAberto(true)
                        }
                    } catch (e) {
                        console.warn('PDV: falha ao buscar caixa aberto:', e)
                        postSaleIssue = true
                    }
                }

                if (effectiveCaixaId && !USE_DB_TRIGGER && formaPagamentoDB !== 'caderneta') {
                    const { data: caixaRow, error: caixaRowErr } = await getSupabase()
                        .from('caixa_diario')
                        .select('id, total_vendas, total_entradas, total_dinheiro, total_pix, total_debito, total_credito, total_caderneta')
                        .eq('id', effectiveCaixaId)
                        .single()

                    if (caixaRowErr && caixaRowErr.code !== 'PGRST116') {
                        console.error('Erro ao ler caixa_diario:', caixaRowErr)
                        postSaleIssue = true
                    } else {
                        const cur = (caixaRow || {}) as Partial<Database['public']['Tables']['caixa_diario']['Row']>
                        const curTotalVendas = Number(cur.total_vendas || 0)
                        const curTotalEntradas = Number(cur.total_entradas || 0)
                        const curDinheiro = Number(cur.total_dinheiro || 0)
                        const curPix = Number(cur.total_pix || 0)
                        const curDebito = Number(cur.total_debito || 0)
                        const curCredito = Number(cur.total_credito || 0)
                        const curCaderneta = Number(cur.total_caderneta || 0)

                        const atualizar: any = {
                            total_vendas: Number((curTotalVendas + valorTotal).toFixed(2)),
                            total_entradas: curTotalEntradas,
                            total_dinheiro: curDinheiro,
                            total_pix: curPix,
                            total_debito: curDebito,
                            total_credito: curCredito,
                            total_caderneta: curCaderneta
                        }

                        const forma = String(formaPagamento).toLowerCase()
                        if (forma === 'dinheiro') {
                            atualizar.total_entradas = Number((curTotalEntradas + valorPago).toFixed(2))
                            atualizar.total_dinheiro = Number((curDinheiro + valorPago).toFixed(2))
                        } else if (forma === 'pix') {
                            atualizar.total_entradas = Number((curTotalEntradas + valorPago).toFixed(2))
                            atualizar.total_pix = Number((curPix + valorPago).toFixed(2))
                        } else if (forma === 'debito' || forma === 'débito' || forma === 'cartao_debito' || forma === 'cartao-debito') {
                            atualizar.total_entradas = Number((curTotalEntradas + valorPago).toFixed(2))
                            atualizar.total_debito = Number((curDebito + valorPago).toFixed(2))
                        } else if (forma === 'credito' || forma === 'crédito' || forma === 'cartao_credito' || forma === 'cartao-credito') {
                            atualizar.total_entradas = Number((curTotalEntradas + valorPago).toFixed(2))
                            atualizar.total_credito = Number((curCredito + valorPago).toFixed(2))
                        } else if (forma === 'caderneta') {
                            atualizar.total_caderneta = Number((curCaderneta + valorDebito).toFixed(2))
                        } else {
                            atualizar.total_entradas = Number((curTotalEntradas + valorPago).toFixed(2))
                        }

                        try {
                            const { error: updCaixaErr } = await getSupabase()
                                .from('caixa_diario')
                                .update<Database['public']['Tables']['caixa_diario']['Update']>(atualizar)
                                .eq('id', effectiveCaixaId)

                            if (updCaixaErr) {
                                console.error('Falha ao atualizar totais do caixa:', updCaixaErr)
                                postSaleIssue = true
                                showToast('Falha ao atualizar totais do caixa. Verifique console.', 'error')
                            }
                        } catch (e) {
                            console.error('Erro atualizando caixa_diario:', e)
                            postSaleIssue = true
                            showToast('Erro ao atualizar caixa_diario. Verifique console.', 'error')
                        }

                        try {
                            const { error: movErr2 } = await getSupabase()
                                .from('caixa_movimentacoes')
                                .insert<Database['public']['Tables']['caixa_movimentacoes']['Insert']>({
                                    caixa_diario_id: effectiveCaixaId,
                                    tipo: 'entrada',
                                    valor: forma === 'caderneta' ? valorDebito : valorPago || valorTotal,
                                    motivo: `Venda PDV (#${vendaData.id})`,
                                    observacoes: null,
                                    created_at: new Date().toISOString()
                                })

                            if (movErr2) {
                                console.error('Não foi possível gravar detalhe da entrada (caixa_movimentacoes):', movErr2)
                                postSaleIssue = true
                                showToast('Erro ao gravar detalhe da entrada no caixa.', 'warning')
                            }
                        } catch (e) {
                            console.warn('Erro ao gravar caixa_movimentacoes:', e)
                            postSaleIssue = true
                        }

                        try {
                            const hojeStr = getLocalDateString()
                            const dadosFluxo = {
                                data: hojeStr,
                                tipo: 'entrada',
                                categoria: 'caixa',
                                descricao: `Venda PDV (#${vendaData.id})`,
                                valor: forma === 'caderneta' ? valorDebito : valorPago || valorTotal,
                                observacoes: null,
                                created_at: new Date().toISOString()
                            }
                            const { error: fluxoErr } = await getSupabase()
                                .from('fluxo_caixa')
                                .insert<Database['public']['Tables']['fluxo_caixa']['Insert']>(dadosFluxo)

                            if (fluxoErr) {
                                console.error('Não foi possível gravar entrada em fluxo_caixa:', fluxoErr)
                                postSaleIssue = true
                                showToast('Erro ao gravar fluxo_caixa (Gestão).', 'warning')
                            }
                        } catch (e) {
                            console.warn('Erro ao gravar fluxo_caixa:', e)
                            postSaleIssue = true
                        }

                        try {
                            const { error: updVendaErr } = await getSupabase()
                                .from('vendas')
                                .update<Database['public']['Tables']['vendas']['Update']>({ caixa_diario_id: effectiveCaixaId })
                                .eq('id', vendaData.id)

                            if (updVendaErr) {
                                console.error('Falha ao atualizar venda com caixa_diario_id:', updVendaErr)
                                postSaleIssue = true
                                showToast('Venda registrada, mas falha ao ligar ao caixa. Verifique console.', 'warning')
                            }
                        } catch (e) {
                            console.warn('Erro atualizando venda com caixa_diario_id:', e)
                            postSaleIssue = true
                        }
                    }
                }
            } catch (e) {
                console.error('Erro ao registrar entrada no caixa:', e)
                postSaleIssue = true
            }

            // Limpeza de UI/estado
            setCarrinho([])
            setLastAddedItem(null)
            setModalPagamento(false)
            setModalDebito(false)
            setModalCredito(false)
            setModalPix(false)
            setModalCaderneta(false)
            setValorRecebido('')
            setDescontoPercent('')
            setDescontoValor('')
            setClienteCadernetaSelecionado('')
            setValorAbaterCaderneta('')

            // Atualiza dados locais em background (não bloqueia o modal pós-venda)
            refreshAll({ changeView: false }).catch((e) => {
                console.error('Erro ao atualizar dados após venda:', e)
            })

            // Somente se não houver problemas no pós-processamento, abrimos o modal de impressão
            if (!postSaleIssue) {
                if (formaPagamento === 'caderneta' && cadernetaDataParaPrimeiraVia) {
                    try {
                        const urlBase = (typeof window !== 'undefined' ? localStorage.getItem('impressao-local-url') : null) || 'https://127.0.0.1:3333'
                        const linhas = await getCupomFiscalLinhas(vendaData.id, cadernetaDataParaPrimeiraVia)
                        const res = await fetch(`${urlBase}/imprimir-cupom`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ linhas }),
                        })
                        if (res.ok) {
                            incrementarCupomImprimido()
                        } else {
                            throw new Error(await res.text())
                        }
                    } catch (_) {
                        try {
                            await printCupomFiscalNFCe(vendaData.id, cadernetaDataParaPrimeiraVia)
                            incrementarCupomImprimido()
                        } catch (e) {
                            console.error('Erro ao imprimir 1ª via caderneta:', e)
                            showToast('Falha ao imprimir 1ª via.', 'warning')
                        }
                    }
                } else {
                    setLastCadernetaPrintData(null)
                }
                abrirModalPosVendaComDelay(300)
            } else {
                showToast('Venda registrada, mas ocorreram problemas no pós-processamento. Impressão desabilitada.', 'warning')
            }

        } catch (error: any) {
            // Tratamento específico para falhas de rede (fetch)
            if (error instanceof TypeError && String(error.message).toLowerCase().includes('failed to fetch')) {
                console.error('Erro de rede ao finalizar venda:', error)
                alert('Falha de rede ao finalizar a venda. Verifique sua conexão e tente novamente. A venda pode não ter sido registrada.')
            } else {
                console.error('Erro ao finalizar venda:', error.message || error)
                alert(`Erro ao processar venda: ${error.message || 'Verifique o console.'}`)
            }
        } finally {
            setLoading(false)
        }
    }

        // Registrar pagamento em caderneta a partir do PDV (abatimento) — atualiza saldo e, quando online,
        // registra a entrada no caixa (caixa_diario, caixa_movimentacoes e fluxo_caixa) via `registrarPagamento`.
        const handleConfirmarPagamentoCaderneta = async () => {
            const valor = parseFloat(String(valorAbaterCaderneta).replace(',', '.')) || 0
            if (!clienteCadernetaSelecionado) {
                showToast('Selecione um cliente', 'warning')
                return
            }
            if (valor <= 0) {
                showToast('Informe um valor maior que zero', 'warning')
                return
            }

            setLoading(true)
            try {
                const clienteIdNum = Number(clienteCadernetaSelecionado)
                const res = await registrarPagamento(
                    clienteIdNum,
                    valor,
                    `Pagamento registrado no PDV (operador ${operador || '—'})`,
                    { data_pagamento: caixaDiaISO || getLocalDateString(), forma_pagamento: 'dinheiro' }
                )

                if (!res.success) throw new Error(res.message || 'Falha ao registrar pagamento')

                // Garantir que o pagamento também seja registrado no caixa (caixa_diario, caixa_movimentacoes, fluxo_caixa).
                // Algumas vezes a função `registrarPagamento` pode não ter gravado os registros de caixa (ex: offline/sincronização),
                // então fazemos uma verificação e inserção adicional aqui, protegendo contra duplicatas.
                try {
                    const hoje = caixaDiaISO || getLocalDateString()

                    // Tenta achar caixa do dia aberto; se não houver, tenta qualquer caixa aberto
                    let caixaRow: any = null
                    const { data: caixaHoje, error: errHoje } = await getSupabase()
                        .from('caixa_diario')
                        .select('id, data, total_caderneta, total_entradas, total_dinheiro, total_pix, total_debito, total_credito')
                        .eq('data', hoje)
                        .eq('status', 'aberto')
                        .limit(1)
                        .maybeSingle()

                    if (!errHoje && caixaHoje) caixaRow = caixaHoje
                    else {
                        const { data: abertoAny, error: errAny } = await getSupabase()
                            .from('caixa_diario')
                            .select('id, data, total_caderneta, total_entradas, total_dinheiro, total_pix, total_debito, total_credito')
                            .eq('status', 'aberto')
                            .limit(1)
                            .maybeSingle()
                        if (!errAny && abertoAny) caixaRow = abertoAny
                    }

                    if (caixaRow && caixaRow.id) {
                        // Evitar duplicatas: checar se já existe entrada similar no fluxo_caixa
                        const descricao = `Pagamento caderneta (cliente ${clienteIdNum})`
                        const { data: fluxoExist } = await getSupabase()
                            .from('fluxo_caixa')
                            .select('id')
                            .eq('data', caixaRow.data || hoje)
                            .eq('categoria', 'caderneta')
                            .eq('descricao', descricao)
                            .eq('valor', valor)
                            .limit(1)
                            .maybeSingle()

                        if (!fluxoExist) {
                            const curCaderneta = Number(caixaRow.total_caderneta || 0)
                            const curTotalEntradas = Number(caixaRow.total_entradas || 0)
                            const curDinheiro = Number(caixaRow.total_dinheiro || 0)
                            const curPix = Number(caixaRow.total_pix || 0)
                            const curDebito = Number(caixaRow.total_debito || 0)
                            const curCredito = Number(caixaRow.total_credito || 0)

                            const atualizar: any = {
                                total_caderneta: Number((curCaderneta + valor).toFixed(2)),
                                total_entradas: curTotalEntradas,
                                total_dinheiro: curDinheiro,
                                total_pix: curPix,
                                total_debito: curDebito,
                                total_credito: curCredito
                            }

                            // No PDV usamos 'dinheiro' por padrão aqui
                            atualizar.total_entradas = Number((curTotalEntradas + valor).toFixed(2))
                            atualizar.total_dinheiro = Number((curDinheiro + valor).toFixed(2))

                            await getSupabase()
                                .from('caixa_diario')
                                .update(atualizar)
                                .eq('id', caixaRow.id)

                            // Inserir detalhamento em caixa_movimentacoes
                            try {
                                await getSupabase()
                                    .from('caixa_movimentacoes')
                                    .insert({
                                        caixa_diario_id: caixaRow.id,
                                        tipo: 'entrada',
                                        valor: valor,
                                        motivo: descricao,
                                        observacoes: `Pagamento registrado pelo PDV (operador ${operador || '—'})`,
                                        created_at: new Date().toISOString()
                                    })
                            } catch (e) {
                                console.warn('Falha ao gravar caixa_movimentacoes para pagamento de caderneta:', e)
                            }

                            // Inserir entrada no fluxo_caixa
                            try {
                                const dadosFluxo = {
                                    data: caixaRow.data || hoje,
                                    tipo: 'entrada',
                                    categoria: 'caderneta',
                                    descricao,
                                    valor: valor,
                                    observacoes: `Pagamento registrado pelo PDV (operador ${operador || '—'})`,
                                    created_at: new Date().toISOString()
                                }
                                await getSupabase().from('fluxo_caixa').insert(dadosFluxo)
                            } catch (e) {
                                console.warn('Falha ao gravar fluxo_caixa para pagamento de caderneta:', e)
                            }
                        }
                    }
                } catch (err) {
                    console.error('Erro ao garantir registro de pagamento no caixa:', err)
                }

                try { refreshClientes(); refreshMovimentacoes(); } catch (e) { console.error(e) }

                setModalCaderneta(false)
                setClienteCadernetaSelecionado('')
                setValorAbaterCaderneta('')
                showToast(res.message || 'Pagamento registrado com sucesso', 'success')
            } catch (err: any) {
                console.error('Erro ao registrar pagamento via PDV:', err)
                showToast(err?.message || 'Erro ao registrar pagamento', 'error')
            } finally {
                setLoading(false)
            }
        }

    // --- Visualizar Detalhes da Venda ---
    const verDetalhesVenda = async (id: number) => {
        setVendaSelecionadaId(id)
        setLoading(true)
        try {
            // Primeiro, traz informações da venda para saber a forma de pagamento e desconto
            setVendaClienteNome(null)
            setDescontoVendaSelecionada(0)
            const { data: vendaRow, error: vendaRowErr } = await getSupabase()
                .from('vendas')
                .select('forma_pagamento, cliente_caderneta_id, desconto')
                .eq('id', id)
                .single()

            if (vendaRowErr && vendaRowErr.code !== 'PGRST116') {
                throw vendaRowErr
            }

            // Se for venda por caderneta, tenta obter o nome do cliente (a partir do cache local `clientes`)
            if (vendaRow && String(vendaRow.forma_pagamento || '').toLowerCase().includes('caderneta')) {
                const clienteId = vendaRow.cliente_caderneta_id
                if (clienteId) {
                    const cliente = clientes.find((c) => Number(c.id) === Number(clienteId))
                    if (cliente) setVendaClienteNome(cliente.nome)
                    else setVendaClienteNome(null)
                }
            } else {
                setVendaClienteNome(null)
            }

            const valorDesconto = Number(vendaRow?.desconto ?? 0)
            setDescontoVendaSelecionada(valorDesconto)

            // Em seguida, carrega os itens da venda
            const { data, error } = await getSupabase()
                .from('venda_itens')
                .select(`
                    quantidade,
                    preco_unitario,
                    subtotal,
                    varejo (nome, codigo_barras)
                `)
                .eq('venda_id', id)

            if (error) throw error
            setItensVendaSelecionada(data || [])
            setModalDetalhes(true)
        } catch (error) {
            console.error('Erro ao buscar itens:', error)
            alert('Não foi possível carregar os itens desta venda.')
        } finally {
            setLoading(false)
        }
    }

    // Total dos itens (soma dos subtotais) para exibir no modal de detalhes
    const totalItensSelecionados = useMemo(() => {
        return (itensVendaSelecionada || []).reduce((acc: number, item: any) => {
            const linha = (item?.subtotal != null)
                ? Number(item.subtotal)
                : Number(item.quantidade) * Number(item.preco_unitario)
            return acc + (isNaN(linha) ? 0 : linha)
        }, 0)
    }, [itensVendaSelecionada])

    // --- Filtros e Handlers ---

    // Helpers para atalhos
    const ajustarUltimoItem = (delta: number) => {
        if (carrinho.length === 0) return
        const last = carrinho[carrinho.length - 1]
        alterarQtd(last.id, delta)
    }

    const removerUltimoItem = () => {
        if (carrinho.length === 0) return
        const last = carrinho[carrinho.length - 1]
        removerDoCarrinho(last.id)
    }

    const fecharQualquerModal = () => {
        if (modalPagamento) return setModalPagamento(false)
        if (modalDebito) return setModalDebito(false)
        if (modalCredito) return setModalCredito(false)
        if (modalPix) return setModalPix(false)
        if (modalCaderneta) { setCadernetaErroLimite(null); return setModalCaderneta(false) }
        if (modalDetalhes) return setModalDetalhes(false)
        if (modalFechamento) return setModalFechamento(false)
    }

    const confirmarPagamentoAtivo = () => {
        if (modalPagamento) return handlePagamentoDinheiro()
        if (modalDebito) return finalizarVenda('debito')
        if (modalCredito) return finalizarVenda('credito')
        if (modalPix) return finalizarVenda('pix')
        if (modalCaderneta) return finalizarVenda('caderneta')
    }

    const removeAcentos = (s: string) => {
        return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    }

    const produtosFiltrados = useMemo(() => {
        const termoRaw = String(searchTerm || '').trim()
        if (!termoRaw) return []

        const termo = removeAcentos(termoRaw).toLowerCase()

        const scored = produtos.map(p => {
            const nomeNorm = removeAcentos(String(p.nome || '')).toLowerCase()
            const codigo = String(p.codigoBarras || '')
            const idStr = String(p.id || '')

            let score = 0

            if (codigo === termo) score += 1200
            if (idStr === termo) score += 1100
            if (nomeNorm === termo) score += 1000

            if (nomeNorm.startsWith(termo)) score += 700
            if (nomeNorm.includes(termo)) score += 400
            if (codigo.includes(termo)) score += 300

            score += Math.max(0, 200 - nomeNorm.length)

            return { p, score }
        })

        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(s => s.p)
            .slice(0, 200)
    }, [produtos, searchTerm])

    const listaExibicao = searchTerm ? produtosFiltrados : produtos.slice(0, 50)

    const handleAbrirCaixa = async () => {
        // (Teste) Não verifica mais se já existe registro para o dia. Permite abrir múltiplas vezes.
        if (!operador) {
            showToast('Informe o operador', 'warning')
            return
        }
        setCaixaAberto(true)
        setHoraAbertura(new Date().toLocaleTimeString('pt-BR'))
        setDataHoje(new Date().toLocaleDateString('pt-BR'))
        // Fixa o dia do turno para relatórios (data local YYYY-MM-DD)
        const agoraLocal = getLocalDateString()
        setCaixaDiaISO(agoraLocal)
        // Recarrega relatório exclusivamente para o novo turno (inicialmente vazio)
        carregarVendasHoje(null)
        setView('venda')
            // Persiste abertura do caixa no Supabase (cria linha com status 'aberto')
            try {
                const dataISO = getLocalDateString()

                // Verifica o registro mais recente do dia; permite novos aberturas se o último estiver fechado
                const { data: existing, error: checkErr } = await getSupabase()
                    .from('caixa_diario')
                    .select('id, status')
                    .eq('data', dataISO)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (checkErr) {
                    console.warn('Falha ao checar existência de caixa antes de abrir:', checkErr)
                }

                if (existing && existing.status === 'aberto') {
                    showToast('Já existe um caixa aberto hoje.', 'warning')
                    setCaixaAberto(true)
                    setCaixaDiarioId(existing.id || null)
                    return
                }

                const payload = {
                    data: dataISO,
                    status: 'aberto',
                    valor_abertura: saldoInicial || 0,
                    usuario_abertura: operador || null
                }
                const { data: inserted, error } = await getSupabase()
                    .from('caixa_diario')
                    .insert<Database['public']['Tables']['caixa_diario']['Insert']>(payload)
                    .select()
                    .single()

                if (!error && inserted) {
                    setCaixaDiarioId(inserted.id || null)
                    setCaixaAberto(true)
                    setHoraAbertura(new Date().toLocaleTimeString('pt-BR'))
                    setDataHoje(new Date().toLocaleDateString('pt-BR'))
                    // atualiza listagem de caixas do dia imediatamente
                    try { await carregarCaixasDoDia(agoraLocal) } catch (e) { console.warn('carregarCaixasDoDia após abrir falhou:', e) }
                } else if (error) {
                    console.error('Erro ao persistir abertura do caixa:', error)
                    showToast('Erro ao persistir abertura do caixa', 'error')
                }
            } catch (err) {
                console.error('Erro ao persistir abertura do caixa:', err)
                showToast('Erro ao persistir abertura do caixa', 'error')
            }
    }

    // Abertura do modal de fechamento: preenche valores de conferência com os totais do sistema
    const openFechamento = () => {
        // Padrão: limpa as conferências para que o operador informe os valores reais
        // IMPORTANT: os campos devem iniciar vazios (nenhuma presunção do sistema)
        setConfDinheiro('')
        setConfPix('')
        setConfDebito('')
        setConfCredito('')
        setFechamentoError('')
        setFechamentoFieldErrors({})
        setModalFechamento(true)    
    }

    // Normaliza string de moeda (pt-BR) para Number (unidades) e para centavos
    // Regras:
    // - Se contém '.' e ',' => '.' são milhares, ',' é decimal (remove '.' e troca ','->'.')
    // - Se contém apenas ',' => ',' é decimal (troca ','->'.')
    // - Se contém apenas '.' => '.' é decimal (tratamos '.' como separador decimal)
    // - Remove quaisquer caracteres não numéricos exceto '.' e ','
    const parseCurrencyBR = (v: string | number | null | undefined) => {
        if (v === null || v === undefined) return NaN
        let s = String(v).trim()
        if (s === '') return NaN
        // Keep only digits, dots and commas
        s = s.replace(/[^0-9.,-]/g, '')
        const hasDot = s.indexOf('.') !== -1
        const hasComma = s.indexOf(',') !== -1

        let normalized = s
        if (hasDot && hasComma) {
            // dots são milhares
            normalized = normalized.replace(/\./g, '').replace(/,/g, '.')
        } else if (hasComma && !hasDot) {
            // vírgula é decimal
            normalized = normalized.replace(/,/g, '.')
        } else if (!hasComma && hasDot) {
            // apenas ponto: tratamos ponto como decimal
            // se houver múltiplos pontos, mantém apenas o último como decimal
            const parts = normalized.split('.')
            if (parts.length > 2) {
                const last = parts.pop()
                normalized = parts.join('') + '.' + (last ?? '')
            }
        }

        const n = Number(normalized)
        return Number.isFinite(n) ? n : NaN
    }

    const parseCurrencyBRToCents = (v: string | number | null | undefined) => {
        const n = parseCurrencyBR(v)
        if (isNaN(n)) return NaN
        return Math.round(n * 100)
    }

    const validateFechamento = () => {
        setFechamentoError('')
        const fieldErrors: {[k:string]:string} = {}

        // Aceita campos vazios (tratados como 0). Apenas valida conteúdo quando preenchido.
        const check = (key:string, val:string) => {
            if (!String(val).trim()) return // vazio -> ok (será considerado 0)
            const parsed = parseCurrencyBR(val)
            if (isNaN(parsed)) {
                fieldErrors[key] = 'Preencha com o valor real de entrada desta forma de pagamento'
            }
        }
        check('dinheiro', confDinheiro)
        check('pix', confPix)
        check('debito', confDebito)
        check('credito', confCredito)

        // Exige que o funcionário efetivamente tenha digitado pelo menos um valor
        const hasConferido = [confDinheiro, confPix, confDebito, confCredito].some(v => String(v).trim() !== '')
        if (!hasConferido) {
            // Em vez de apenas mostrar erro em texto, apresentamos um modal informativo
            setModalNoConferencia(true)
            return
        }

        if (Object.keys(fieldErrors).length) {
            setFechamentoFieldErrors(fieldErrors)
            setFechamentoError('Corrija os campos marcados')
            return
        }
        setFechamentoFieldErrors({})
        setModalFechamentoConfirm(true)
    }

    const handleConfirmFechamento = async () => {
                const ajusteDinheiroCents = parseCurrencyBRToCents(confDinheiro) || 0
                const ajustePixCents = parseCurrencyBRToCents(confPix) || 0
                const ajusteDebitoCents = parseCurrencyBRToCents(confDebito) || 0
                const ajusteCreditoCents = parseCurrencyBRToCents(confCredito) || 0
                const totalCorrigidoCents = ajusteDinheiroCents + ajustePixCents + ajusteDebitoCents + ajusteCreditoCents
                const metricasTotalEntradasCents = Math.round((metricasCaixa.totalEntradas || 0) * 100)
                const diferencaCents = totalCorrigidoCents - metricasTotalEntradasCents
                const totalCorrigido = totalCorrigidoCents / 100
                const payload = {
                    data: getLocalDateString(),
                    status: 'fechado',
                    valor_abertura: Number((saldoInicial || 0)),
                    valor_fechamento: Number((totalCorrigidoCents / 100).toFixed(2)),
                    total_entradas: Number((metricasTotalEntradasCents / 100).toFixed(2)),
                    total_vendas: Number((metricasCaixa.totalGeral || 0).toFixed(2)),
                    total_caderneta: Number((metricasCaixa.caderneta || 0).toFixed(2)),
                    total_dinheiro: Number((metricasCaixa.dinheiro || 0).toFixed(2)),
                    total_pix: Number((metricasCaixa.pix || 0).toFixed(2)),
                    total_debito: Number((metricasCaixa.debito || 0).toFixed(2)),
                    total_credito: Number((metricasCaixa.credito || 0).toFixed(2)),
                    valor_dinheiro_informado: Number((ajusteDinheiroCents / 100).toFixed(2)),
                    valor_pix_informado: Number((ajustePixCents / 100).toFixed(2)),
                    valor_debito_informado: Number((ajusteDebitoCents / 100).toFixed(2)),
                    valor_credito_informado: Number((ajusteCreditoCents / 100).toFixed(2)),
                    diferenca: Number((diferencaCents / 100).toFixed(2)),
                    diferenca_dinheiro: Number(((ajusteDinheiroCents - Math.round((metricasCaixa.dinheiro || 0) * 100)) / 100).toFixed(2)),
                    diferenca_pix: Number(((ajustePixCents - Math.round((metricasCaixa.pix || 0) * 100)) / 100).toFixed(2)),
                    diferenca_debito: Number(((ajusteDebitoCents - Math.round((metricasCaixa.debito || 0) * 100)) / 100).toFixed(2)),
                    diferenca_credito: Number(((ajusteCreditoCents - Math.round((metricasCaixa.credito || 0) * 100)) / 100).toFixed(2)),
                    valor_saidas: Number(totalSaidasDoDia || 0),
                    total_saidas: Number(totalSaidasDoDia || 0),
                    usuario_fechamento: operador || null,
                    data_fechamento: new Date().toISOString()
                }
        try {
            setModalFechamentoConfirm(false)
            setModalFechamento(false)
            setCaixaAberto(false)
            setView('abertura')
            setOperador('')
            setCarrinho([])
            setLastAddedItem(null)
            setVendasHoje([])
            setCaixaDiarioId(null)
            setDataHoje('')
            setHoraAbertura('')

            if (!caixaDiarioId) {
                showToast('Erro: ID do caixa não encontrado.', 'error')
                return
            }

            if (!isOnline) {
                await offlineStorage.addPendingOperation({
                    type: 'UPDATE',
                    table: 'caixa_diario',
                    data: { id: caixaDiarioId, ...payload }
                })
                await offlineStorage.saveOfflineData('caixa_hoje', [])
                showToast('Caixa fechado offline. Será sincronizado quando online.', 'success')
                return
            }

            showToast('Processando fechamento do caixa...', 'info')

            const { error: upErr } = await getSupabase()
                .from('caixa_diario')
                .update<Database['public']['Tables']['caixa_diario']['Update']>({
                    ...payload,
                    status: 'fechado'
                })
                .eq('id', caixaDiarioId)
                .eq('status', 'aberto') // Segurança extra: só atualiza se ainda estiver aberto

            if (upErr) {
                const msg = (upErr as { message?: string })?.message || String(upErr)
                showToast(`Erro ao fechar o caixa: ${msg}`, 'error')
                console.error('Erro ao fechar caixa:', msg, upErr)
                return
            }

            // 2. Finaliza o turno do operador atual
            try {
                const turnoAtual = await getTurnoOperadorAtual(caixaDiarioId)
                if (turnoAtual) {
                    // Calcular totais do turno para auditoria
                    const start = new Date(turnoAtual.data_inicio).getTime();
                    const end = new Date().getTime();
                    const opNome = (turnoAtual.operador_nome || '').trim().toLowerCase();

                    const vendasTurno = vendasHoje.filter(v => {
                        const vTime = v.created_at ? new Date(v.created_at).getTime() : 0;
                        const vOp = (v.operador_nome || '').trim().toLowerCase();
                        return vOp === opNome && vTime >= (start - 5000) && vTime <= (end + 5000);
                    });

                    const totalVendasTurno = vendasTurno.reduce((acc, v) => acc + v.total, 0);
                    // Usar totalEntradas (exclui caderneta) - mesma base do fechamento PDV
                    const totalEntradasTurno = vendasTurno.reduce((acc, v) => {
                      const forma = String(v.forma_pagamento || '').toLowerCase();
                      if (forma.includes('caderneta')) return acc;
                      return acc + (v.total || 0);
                    }, 0);
                    const sistemaEsperavaTurno = (saldoInicial || 0) + totalEntradasTurno - (totalSaidasDoDia || 0);
                    const diferencaTurno = Number((totalCorrigido - sistemaEsperavaTurno).toFixed(2));

                    const audit = {
                        total_vendas: totalVendasTurno,
                        total_dinheiro: vendasTurno.filter(v => v.forma_pagamento.toLowerCase().includes('dinheiro')).reduce((acc, v) => acc + v.total, 0),
                        total_pix: vendasTurno.filter(v => v.forma_pagamento.toLowerCase().includes('pix')).reduce((acc, v) => acc + v.total, 0),
                        total_debito: vendasTurno.filter(v => v.forma_pagamento.toLowerCase().includes('debito')).reduce((acc, v) => acc + v.total, 0),
                        total_credito: vendasTurno.filter(v => v.forma_pagamento.toLowerCase().includes('credito')).reduce((acc, v) => acc + v.total, 0),
                        total_caderneta: vendasTurno.filter(v => v.forma_pagamento.toLowerCase().includes('caderneta')).reduce((acc, v) => acc + v.total, 0),
                        valor_fechamento: totalCorrigido,
                        diferenca: diferencaTurno
                    };

                    await finalizarTurnoOperador(turnoAtual.id, audit);
                }
            } catch (turnoErr) {
                console.warn('Erro ao finalizar turno do operador durante fechamento de caixa:', turnoErr)
            }

            showToast('Caixa fechado com sucesso!', 'success')

            // 3. Limpa estados e garante que a interface mostre o modal de abertura
            setConfDinheiro('')
            setConfPix('')
            setConfDebito('')
            setConfCredito('')
            setFechamentoFieldErrors({})
            setFechamentoError('')
            
            // Forçamos o estado de fechado e view de abertura
            setCaixaAberto(false)
            setCaixaDiarioId(null)
            setView('abertura')
            setOperador('')
            setSaldoInicial(0)
            setVendasHoje([])
            setSaidasDoDia([])
            
            // Recarrega apenas produtos e lista de caixas (histórico)
            await Promise.all([
                carregarProdutos(),
                carregarCaixasDoDia()
            ])
            
        } catch (err) {
            showToast('Erro crítico ao fechar o caixa', 'error')
            console.error('Erro no fechamento de caixa:', err)
        }
    }

    // Valores calculados para fechamento (Total Corrigido / Diferença)
    // Seguindo a regra: Total Corrigido é a soma EXCLUSIVA dos valores conferidos pelo funcionário.
    const ajusteDinheiroCents = parseCurrencyBRToCents(confDinheiro) || 0
    const ajustePixCents = parseCurrencyBRToCents(confPix) || 0
    const ajusteDebitoCents = parseCurrencyBRToCents(confDebito) || 0
    const ajusteCreditoCents = parseCurrencyBRToCents(confCredito) || 0

    const totalCorrigidoCents = ajusteDinheiroCents + ajustePixCents + ajusteDebitoCents + ajusteCreditoCents
    const totalCorrigido = totalCorrigidoCents / 100
    const diferencaFechamento = (totalCorrigidoCents - Math.round((metricasCaixa.totalEntradas || 0) * 100)) / 100

    // Valor de saída (soma das sangrias) e saldo final esperado no caixa
    const safeTotalSaidas = Number(totalSaidasDoDia || 0)
    const valorTotalDoCaixa = Number(totalCorrigido || 0) - safeTotalSaidas

    // Indica se o funcionário já digitou ao menos um valor de conferência
    const hasConferido = [confDinheiro, confPix, confDebito, confCredito].some(v => String(v).trim() !== '')

    // Quando o dia-base do caixa mudar, atualiza o relatório
    useEffect(() => {
        if (caixaDiarioId) {
            carregarVendasHoje(caixaDiarioId)
        }
    }, [caixaDiarioId])

    const handlePagamentoDinheiro = () => {
        const valor = parseFloat(valorRecebido.replace(',', '.')) || 0
        if (valor < totalComDesconto) {
            showToast('Valor insuficiente', 'error')
            return
        }
        finalizarVenda('dinheiro')
    }

    // --- Hotkeys Globais ---
    useEffect(() => {
        const isInputElement = (el: EventTarget | null) => {
            const t = el as HTMLElement | null
            if (!t) return false
            const tag = t.tagName?.toLowerCase()
            return tag === 'input' || tag === 'textarea' || (t as HTMLElement).isContentEditable
        }

        const handler = (e: KeyboardEvent) => {
            const targetIsInput = isInputElement(e.target)
            const key = e.key
            const code = (e as any).code as string | undefined
            if (key == null) return // e.key pode ser undefined em alguns eventos (IME, composition, etc.)

            // Navegação entre abas (sempre disponível)
            if (key === 'F1') { e.preventDefault(); if (caixaAberto) setView('venda'); return }
            if (key === 'F2') { e.preventDefault(); if (caixaAberto) setView('historico'); return }
            if (key === 'F3') { e.preventDefault(); if (caixaAberto) setView('estoque'); return }
            if (key === 'F4') { e.preventDefault(); if (caixaAberto) setView('caixa'); return }
            // Atalho para Caderneta: usa F11 se disponível (não conflita com outros atalhos atuais)
            if (key === 'F11') { e.preventDefault(); if (caixaAberto) setView('caderneta'); return }
            // Atalho para Saída: F10
            if (key === 'F10') { e.preventDefault(); if (caixaAberto) setView('saida'); return }
            // Atalho para Cupom Fiscal: F12
            if (key === 'F12') { e.preventDefault(); if (caixaAberto) setView('cupom'); return }

            // Focar busca (Ctrl+F)
            if ((e.ctrlKey || e.metaKey) && (key.toLowerCase() === 'f')) {
                e.preventDefault()
                if (!caixaAberto) return
                setView('venda')
                setTimeout(() => searchInputRef.current?.focus(), 0)
                return
            }

            // Fechar qualquer modal (Esc)
            if (key === 'Escape') {
                e.preventDefault()
                fecharQualquerModal()
                return
            }

            // Abrir modal de fechamento do caixa (qualquer aba)
            // ATALHO REMOVIDO: F9 (desabilitado para evitar fechamento acidental via teclado)
            // if (key === 'F9') { e.preventDefault(); if (caixaAberto) openFechamento(); return }

            // Nova aba Saída: F10
            if (key === 'F10') { e.preventDefault(); if (caixaAberto) setView('saida'); return }

            // Confirmar fechamento do caixa com Enter: valida ou confirma conforme etapa
            if (key === 'Enter') {
                e.preventDefault()
                if (modalFechamentoConfirm) { handleConfirmFechamento(); return }
                if (modalFechamento) { validateFechamento(); return }
            }

            // Fluxo principal: somente na tela de venda
            if (!caixaAberto || view !== 'venda') return

            // Abrir modais de pagamento
            const temCarrinho = carrinho.length > 0
            if (key === 'F5') { e.preventDefault(); if (temCarrinho) setModalPagamento(true); return }
            if (key === 'F6') { e.preventDefault(); if (temCarrinho) setModalDebito(true); return }
            if (key === 'F7') { e.preventDefault(); if (temCarrinho) setModalCredito(true); return }
            if (key === 'F8') { e.preventDefault(); if (temCarrinho) setModalPix(true); return }

            // + e -: sempre ativos na tela de venda (antes do barcode para não serem capturados)
            if (!(modalPagamento || modalDebito || modalCredito || modalPix || modalCaderneta) && carrinho.length > 0) {
                if (key === '+' || code === 'NumpadAdd') {
                    e.preventDefault()
                    e.stopPropagation()
                    ajustarUltimoItem(1)
                    return
                }
                if (key === '-' || code === 'NumpadSubtract' || code === 'Minus') {
                    e.preventDefault()
                    e.stopPropagation()
                    ajustarUltimoItem(-1)
                    return
                }
            }

            // Captura de código de barras (leitor USB) quando foco está fora de input
            const isPrintableChar = key != null && key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey
            if (!targetIsInput && isPrintableChar && !(modalPagamento || modalDebito || modalCredito || modalPix || modalCaderneta)) {
                if (barcodeAtalhoTimeoutRef.current) {
                    window.clearTimeout(barcodeAtalhoTimeoutRef.current)
                    barcodeAtalhoTimeoutRef.current = null
                }
                const now = Date.now()
                const buf = barcodeBufferRef.current
                if (now - buf.lastKeyTime > 150) buf.chars = ''
                buf.chars += key
                buf.lastKeyTime = now
                e.preventDefault()
                if (key === '1' || key === '2' || key === '3' || key === '4') {
                    barcodeAtalhoTimeoutRef.current = window.setTimeout(() => {
                        barcodeAtalhoTimeoutRef.current = null
                        const b = barcodeBufferRef.current
                        if (b.chars.length === 1 && temCarrinho) {
                            if (b.chars === '1') setModalPagamento(true)
                            else if (b.chars === '2') setModalDebito(true)
                            else if (b.chars === '3') setModalCredito(true)
                            else if (b.chars === '4') setModalPix(true)
                        }
                        b.chars = ''
                    }, 250)
                }
                return
            }

            // Confirmar pagamento quando um modal está aberto (Enter)
            if (key === 'Enter' && (modalPagamento || modalDebito || modalCredito || modalPix || modalCaderneta)) {
                e.preventDefault()
                confirmarPagamentoAtivo()
                return
            }

            // Enter com buffer de código de barras (leitor USB com foco fora do input)
            if (key === 'Enter' && !targetIsInput && !(modalPagamento || modalDebito || modalCredito || modalPix || modalCaderneta)) {
                const codigo = barcodeBufferRef.current.chars.trim()
                if (codigo) {
                    barcodeBufferRef.current = { chars: '', lastKeyTime: 0 }
                    if (barcodeAtalhoTimeoutRef.current) {
                        window.clearTimeout(barcodeAtalhoTimeoutRef.current)
                        barcodeAtalhoTimeoutRef.current = null
                    }
                    e.preventDefault()
                    adicionarPorCodigo(codigo)
                    return
                }
            }

            // Enter fora de modais: adiciona 1º item sugerido ou abre dinheiro
            if (key === 'Enter' && !(modalPagamento || modalDebito || modalCredito || modalPix || modalCaderneta)) {
                // Enter: se searchTerm parece código de balança, usar adicionarPorCodigo
                const termo = (searchTerm || '').trim().replace(/\D/g, '')
                if (termo.length === 13) {
                    const prefix = parseInt(termo.slice(0, 2), 10)
                    if (prefix >= 20 && prefix <= 29) {
                        e.preventDefault()
                        adicionarPorCodigo(searchTerm!.trim())
                        setSearchTerm('')
                        return
                    }
                }
                if (termo.length === 11) {
                    e.preventDefault()
                    adicionarPorCodigo(searchTerm!.trim())
                    setSearchTerm('')
                    return
                }
                if (searchTerm && produtosFiltrados.length > 0) {
                    e.preventDefault()
                    adicionarAoCarrinho(produtosFiltrados[0])
                    setSearchTerm('')
                    return
                }
                if (temCarrinho) {
                    e.preventDefault()
                    setModalPagamento(true)
                    return
                }
            }

            // Delete e Ctrl+L: só quando foco fora de input (evitar acidentes)
            if (!targetIsInput && !(modalPagamento || modalDebito || modalCredito || modalPix)) {
                if (key === 'Delete') { e.preventDefault(); removerUltimoItem(); return }
                if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'l') { e.preventDefault(); setCarrinho([]); setLastAddedItem(null); return }
            }
        }

        window.addEventListener('keydown', handler, true)
        return () => {
            window.removeEventListener('keydown', handler, true)
            if (barcodeAtalhoTimeoutRef.current) {
                window.clearTimeout(barcodeAtalhoTimeoutRef.current)
                barcodeAtalhoTimeoutRef.current = null
            }
        }
        // Dependências que afetam o comportamento dos atalhos
    }, [caixaAberto, view, carrinho, searchTerm, produtosFiltrados, modalPagamento, modalDebito, modalCredito, modalPix, modalCaderneta])

    // Emissão fiscal: removida do sistema

    // --- Scanner: controle ---
    const listarCameras = async () => {
        try {
            const dispositivos = await navigator.mediaDevices.enumerateDevices()
            const videoInputs = dispositivos.filter(d => d.kind === 'videoinput')
            setCameras(videoInputs)
            if (videoInputs.length > 0 && !cameraId) setCameraId(videoInputs[0].deviceId)
        } catch (e: any) {
            setScannerErro('Não foi possível listar câmeras. Permita acesso à câmera.')
        }
    }

    const pararScanner = () => {
        try {
            scannerAtivoRef.current = false
            setScannerAtivo(false)
            if (scannerControlsRef.current) {
                try { scannerControlsRef.current.stop() } catch { }
                scannerControlsRef.current = null
            }
            if (codeReaderRef.current) {
                try { typeof (codeReaderRef.current as any).stopContinuousDecode === 'function' && (codeReaderRef.current as any).stopContinuousDecode() } catch { }
                try { typeof (codeReaderRef.current as any).reset === 'function' && (codeReaderRef.current as any).reset() } catch { }
                codeReaderRef.current = null
            }
            if (videoRef.current) {
                try { videoRef.current.pause() } catch { }
                try { (videoRef.current as HTMLVideoElement).srcObject = null } catch { }
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
                streamRef.current = null
            }
        } catch { /* noop */ }
    }

    const iniciarScannerNativo = async (stream: MediaStream) => {
        try {
            // @ts-ignore
            const NativeDetector = (window as any).BarcodeDetector
            if (!NativeDetector) return false
            // @ts-ignore
            detectorRef.current = new NativeDetector({
                formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e', 'itf']
            })
            const video = videoRef.current!
            const loop = async () => {
                if (!scannerAtivoRef.current) return
                try {
                    // @ts-ignore
                    const bitmap = await createImageBitmap(video)
                    const det = detectorRef.current
                    if (!det) { requestAnimationFrame(loop); return }
                    const res = await det.detect(bitmap)
                    if (res && res.length > 0) {
                        const raw = res[0].rawValue || ''
                        if (raw && Date.now() - scanningLockRef.current > 800 && !scannerPausadoRef.current) {
                            scanningLockRef.current = Date.now()
                            setUltimoCodigo(String(raw))
                            const ok = await adicionarPorCodigo(String(raw))
                            if (ok) {
                                await tocarBeep()
                            } else {
                                setScannerErro('Código não encontrado no estoque.')
                            }
                        }
                    }
                } catch { /* ignore frame errors */ }
                requestAnimationFrame(loop)
            }
            requestAnimationFrame(loop)
            return true
        } catch {
            return false
        }
    }

    const iniciarScannerZXing = async (deviceId?: string | null) => {
        try {
            const mod = await import('@zxing/browser')
            const reader = new mod.BrowserMultiFormatReader()
            codeReaderRef.current = reader
            const controls = await reader.decodeFromVideoDevice(deviceId || undefined, videoRef.current!, (result: any, _error: any) => {
                if (!scannerAtivoRef.current) return
                if (result) {
                    const text = result.getText()
                    if (text && Date.now() - scanningLockRef.current > 800 && !scannerPausadoRef.current) {
                        scanningLockRef.current = Date.now()
                        setUltimoCodigo(text)
                        adicionarPorCodigo(text).then(ok => {
                            if (ok) tocarBeep()
                            else setScannerErro('Código não encontrado no estoque.')
                        })
                    }
                }
            })
            scannerControlsRef.current = controls
            return true
        } catch (e) {
            console.error('Falha ao iniciar ZXing:', e)
            return false
        }
    }

    const iniciarScanner = async (device: string | null) => {
        setScannerErro('')
        setUltimoCodigo('')
        scannerAtivoRef.current = true
        setScannerAtivo(true)
        try {
            const constraints: MediaStreamConstraints = {
                video: device ? { deviceId: { exact: device } } : { facingMode: { ideal: 'environment' } },
                audio: false
            }
            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }

            const okNative = await iniciarScannerNativo(stream)
            if (!okNative) {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop())
                    streamRef.current = null
                }
                if (videoRef.current) (videoRef.current as HTMLVideoElement).srcObject = null
                await iniciarScannerZXing(device)
            }
        } catch (e: any) {
            console.error('Erro ao iniciar scanner:', e)
            const isNotAllowed = e?.name === 'NotAllowedError' || e?.message?.includes('Permission denied')
            setScannerErro(isNotAllowed
                ? 'Permissão negada. Clique no botão Scanner para ativar a câmera.'
                : 'Não foi possível acessar a câmera. Verifique permissões e HTTPS.')
            setScannerAtivo(false)
            if (isNotAllowed) showToast('Clique no botão Scanner para ativar a câmera.', 'warning')
        }
    }

    // Atualiza ref para pausar detecção durante modais de pagamento
    useEffect(() => {
        scannerPausadoRef.current = !!(modalPagamento || modalDebito || modalCredito || modalPix || modalCaderneta)
    }, [modalPagamento, modalDebito, modalCredito, modalPix, modalCaderneta])

    // useEffect: desliga scanner apenas ao desmontar (ex.: navegação via sidebar para outra página)
    // O scanner permanece ligado ao navegar entre as abas do header (Vendas, Relatórios, etc.)
    useEffect(() => {
        return () => pararScanner()
    }, [])

    const ativarScanner = () => {
        iniciarScanner(cameraId)
        listarCameras() // atualiza lista de câmeras em background
    }

    const desativarScanner = () => {
        pararScanner()
        setScannerErro('')
    }

    return (
        <ProtectedLayout>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                    duration={4000}
                />
            )}
            <div className="min-h-screen w-full flex flex-col bg-slate-50 font-sans text-gray-800 overflow-auto">

                {/* --- HEADER --- */}
                <header className="bg-blue-600 text-white px-3 py-2 flex justify-between items-center shadow-md border-b-4 border-blue-800 shrink-0">
                    <div className="flex items-center space-x-4">
                        <div className="bg-white p-1 rounded-lg">
                            <Package className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight leading-none uppercase">Rey dos Pães</h1>
                            <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                                {caixaAberto ? `Operador: ${operador}` : 'Caixa Fechado'}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2 items-center">
                        {caixaAberto && (
                            <nav className="flex gap-1 mr-4">
                                <button
                                    onClick={() => setView('venda')}
                                    title="Ir para Vendas (F1)"
                                    className="px-4 py-2 rounded-lg text-xs font-bold transition uppercase hover:opacity-90 text-white"
                                    style={{ backgroundColor: view === 'venda' ? 'color-mix(in srgb, var(--primary-color, #d97706) 90%, black)' : 'transparent' }}
                                >
                                    Vendas (F1)
                                </button>
                                <button
                                    onClick={() => setView('historico')}
                                    title="Ir para Relatórios (F2)"
                                    className="px-4 py-2 rounded-lg text-xs font-bold transition uppercase hover:opacity-90 text-white"
                                    style={{ backgroundColor: view === 'historico' ? 'color-mix(in srgb, var(--primary-color, #d97706) 90%, black)' : 'transparent' }}
                                >
                                    Relatórios (F2)
                                </button>
                                <button
                                    onClick={() => setView('estoque')}
                                    title="Ir para Estoque (F3)"
                                    className="px-4 py-2 rounded-lg text-xs font-bold transition uppercase hover:opacity-90 text-white"
                                    style={{ backgroundColor: view === 'estoque' ? 'color-mix(in srgb, var(--primary-color, #d97706) 90%, black)' : 'transparent' }}
                                >
                                    Estoque (F3)
                                </button>
                                <button
                                    onClick={() => setView('caixa')}
                                    title="Ir para Caixa (F4)"
                                    className="px-4 py-2 rounded-lg text-xs font-bold transition uppercase hover:opacity-90 text-white"
                                    style={{ backgroundColor: view === 'caixa' ? 'color-mix(in srgb, var(--primary-color, #d97706) 90%, black)' : 'transparent' }}
                                >
                                    Caixa (F4)
                                </button>
                                <button
                                    onClick={() => setView('saida')}
                                    title="Ir para Saída (F10)"
                                    className="px-4 py-2 rounded-lg text-xs font-bold transition uppercase hover:opacity-90 text-white"
                                    style={{ backgroundColor: view === 'saida' ? 'color-mix(in srgb, var(--primary-color, #d97706) 90%, black)' : 'transparent' }}
                                >
                                    Saída (F10)
                                </button>
                                <button
                                    onClick={() => setView('caderneta')}
                                    title="Ir para Caderneta (F11)"
                                    className="px-4 py-2 rounded-lg text-xs font-bold transition uppercase hover:opacity-90 text-white"
                                    style={{ backgroundColor: view === 'caderneta' ? 'color-mix(in srgb, var(--primary-color, #d97706) 90%, black)' : 'transparent' }}
                                >
                                    Caderneta (F11)
                                </button>
                                <button
                                    onClick={() => setView('cupom')}
                                    title="Ir para Cupom Fiscal (F12)"
                                    className="px-4 py-2 rounded-lg text-xs font-bold transition uppercase hover:opacity-90 text-white"
                                    style={{ backgroundColor: view === 'cupom' ? 'color-mix(in srgb, var(--primary-color, #d97706) 90%, black)' : 'transparent' }}
                                >
                                    Cupom (F12)
                                </button>
                            </nav>
                        )}
                        {caixaAberto && (
                            <button
                                onClick={() => setMostrarAtalhos((v) => !v)}
                                title="Mostrar/ocultar atalhos"
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-800 hover:bg-blue-700 text-white"
                            >
                                Atalhos
                            </button>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="font-mono text-lg bg-blue-800 px-4 py-1 rounded-full shadow-inner text-white">
                                {relogio}
                            </div>
                            {isRefreshing && (
                                <div className="text-xs bg-white text-blue-800 px-3 py-1 rounded-full font-semibold">Atualizando...</div>
                            )}
                        </div>
                    </div>
                </header>

                {/* --- MAIN CONTENT --- */}
                <main className="flex-1 overflow-hidden relative p-2">
                    {/* Modal obrigatório de abertura de caixa: renderizado dentro do main para não cobrir a sidebar */}
                    {!caixaAberto && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <AbrirCaixaModal
                                onCaixaAberto={async () => {
                                    await restaurarCaixaAberto()
                                }}
                            />
                        </div>
                    )}
                    {/* Video oculto para scanner — montado quando caixa aberto para permanecer ativo ao navegar entre abas */}
                    {caixaAberto && (
                        <video
                            ref={videoRef}
                            className="absolute opacity-0 pointer-events-none"
                            style={{ position: 'absolute', left: -9999, width: 320, height: 240 }}
                            muted
                            playsInline
                        />
                    )}
                    {/* FAIXA DE ATALHOS */}
                    {caixaAberto && mostrarAtalhos && (
                        <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded-xl text-[10px] text-gray-700 font-bold flex flex-wrap gap-x-4 gap-y-1">
                            <span className="uppercase text-blue-700">Atalhos:</span>
                            <span>F1–F4: Vendas/Relatórios/Estoque/Caixa</span>
                            <span>F10: Saída</span>
                            <span>F11: Caderneta</span>
                            <span>F12: Cupom Fiscal</span>
                            <span>Ctrl+F: Buscar</span>
                            <span>F5–F8 ou 1–4: Dinheiro/Débito/Crédito/Pix</span>
                            <span>Enter: Confirma no modal</span>
                            <span>Enter (na busca): Adiciona 1º sugerido</span>
                            <span>+/−/Delete: Ajusta/Remove último item</span>
                            <span>Ctrl+L: Limpar carrinho</span>
                            <span>Esc: Fechar modais</span>
                        </div>
                    )}

                    {/* View Saída (Sangria) */}
                    {view === 'saida' && (
                        <div className="p-4 bg-white rounded-lg shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold">Saída / Sangria</h2>
                                    <p className="text-sm text-gray-600">Registre retiradas em espécie da gaveta (somente dinheiro).</p>
                                </div>
                                <div className="text-sm text-gray-700">
                                    Disponível em dinheiro: <span className="font-bold">R$ {((metricasCaixa && metricasCaixa.valorEsperadoDinheiro) || 0).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Valor da Retirada (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={valorSaida}
                                        onChange={(e) => setValorSaida(e.target.value)}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Motivo</label>
                                    <select value={motivoSaida} onChange={(e) => setMotivoSaida(e.target.value as any)} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                                        <option value="deposito">Depósito</option>
                                        <option value="pagamento">Pagamento</option>
                                        <option value="troca">Troca</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Observações</label>
                                    <textarea value={obsSaida} onChange={(e) => setObsSaida(e.target.value)} rows={3} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                                </div>
                                <div className="md:col-span-2 flex gap-2 justify-end">
                                    <button onClick={() => { setView('caixa') }} className="px-4 py-2 border rounded bg-gray-100">Voltar</button>
                                    <button onClick={handleRegistrarSaida} className="px-4 py-2 bg-yellow-600 text-white rounded">Registrar Saída</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lista de Saídas do dia */}
                    {view === 'saida' && (
                        <div className="mt-6 bg-white rounded-lg shadow-sm p-4 overflow-hidden">
                            <h3 className="text-lg font-bold mb-3">Saídas do dia</h3>
                            <div className="max-h-80 overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                <thead className="bg-blue-50 border-b border-blue-100">
                                    <tr>
                                        <th className="p-3 font-black uppercase text-blue-800">DATA</th>
                                        <th className="p-3 font-black uppercase text-blue-800">OPERADOR</th>
                                        <th className="p-3 font-black uppercase text-blue-800 text-right">VALOR</th>
                                        <th className="p-3 font-black uppercase text-blue-800">OBSERVAÇÕES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {saidasDoDia.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-4 text-center text-gray-500">Nenhuma saída registrada hoje.</td>
                                        </tr>
                                    ) : (
                                        saidasDoDia.map(s => (
                                            <tr key={s.id} className="border-b border-blue-50 hover:bg-blue-50/30">
                                                <td className="p-3">{s.displayData || s.data || '—'}</td>
                                                <td className="p-3">{s.usuario || '—'}</td>
                                                <td className="p-3 text-right font-black text-blue-600">R$ {Number(s.valor || 0).toFixed(2)}</td>
                                                <td className="p-3">{s.observacoes || '—'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* View Cupom Fiscal (Configuração) */}
                    {view === 'cupom' && (
                        <div className="flex flex-col lg:flex-row gap-6 p-4 max-w-6xl mx-auto">
                            {/* Coluna esquerda: Formulário */}
                            <div className="flex-1 space-y-6">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-white/20 rounded-xl">
                                            <Receipt className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black uppercase tracking-tight">Cupom Fiscal</h2>
                                            <p className="text-amber-100 text-sm font-medium">Configure os dados exibidos no cupom impresso após cada venda</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card: Dados da Loja */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-amber-600" />
                                        <h3 className="font-bold text-gray-800 uppercase text-sm tracking-wide">Dados da Loja</h3>
                                    </div>
                                    <div className="p-5 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nome da Loja</label>
                                            <input
                                                type="text"
                                                value={cupomNomeLoja}
                                                onChange={(e) => setCupomNomeLoja(e.target.value)}
                                                placeholder="REY DOS PÃES"
                                                className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium transition-all"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">CNPJ</label>
                                                <input
                                                    type="text"
                                                    value={cupomCnpj}
                                                    onChange={(e) => setCupomCnpj(e.target.value)}
                                                    placeholder="00.000.000/0001-00"
                                                    className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-mono transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Cidade / UF</label>
                                                <input
                                                    type="text"
                                                    value={cupomCidadeUf}
                                                    onChange={(e) => setCupomCidadeUf(e.target.value)}
                                                    placeholder="Belo Horizonte - MG"
                                                    className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5" /> Endereço
                                            </label>
                                            <input
                                                type="text"
                                                value={cupomEndereco}
                                                onChange={(e) => setCupomEndereco(e.target.value)}
                                                placeholder="Rua Exemplo, 123 - Bairro"
                                                className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Mensagem de rodapé</label>
                                            <input
                                                type="text"
                                                value={cupomMensagem}
                                                onChange={(e) => setCupomMensagem(e.target.value)}
                                                placeholder="REY DOS PÃES - OBRIGADO PELA PREFERÊNCIA"
                                                className="block w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Ações */}
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={() => setView('caixa')}
                                        className="px-5 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 font-bold text-sm transition-colors flex items-center gap-2"
                                    >
                                        <X className="h-4 w-4" /> Voltar
                                    </button>
                                    <button
                                        onClick={restaurarPadraoCupom}
                                        className="px-5 py-3 border-2 border-amber-200 rounded-xl hover:bg-amber-50 text-amber-700 font-bold text-sm transition-colors flex items-center gap-2"
                                    >
                                        <RotateCcw className="h-4 w-4" /> Restaurar padrão
                                    </button>
                                    <button
                                        onClick={imprimirCupomTeste}
                                        className="px-5 py-3 border-2 border-blue-200 rounded-xl hover:bg-blue-50 text-blue-700 font-bold text-sm transition-colors flex items-center gap-2"
                                    >
                                        <Printer className="h-4 w-4" /> Imprimir teste
                                    </button>
                                    <button
                                        onClick={salvarConfigCupom}
                                        className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-500/30 transition-all flex items-center gap-2"
                                    >
                                        <Save className="h-4 w-4" /> Salvar configuração
                                    </button>
                                </div>
                            </div>

                            {/* Coluna direita: Preview */}
                            <div className="lg:w-80 shrink-0">
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-4">
                                    <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
                                        <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                            <Receipt className="h-4 w-4" /> Preview do cupom
                                        </h3>
                                    </div>
                                    <div className="p-4 bg-gray-50">
                                        <div className="bg-white rounded-lg shadow-inner border border-gray-200 p-4 font-mono text-[10px] leading-tight" style={{ maxWidth: '200px', margin: '0 auto' }}>
                                            <div className="text-center font-bold text-xs mb-2 border-b border-dashed border-gray-300 pb-2">
                                                {cupomNomeLoja || 'Nome da Loja'}
                                            </div>
                                            <div className="text-center text-[9px] text-gray-600 mb-1">
                                                {cupomEndereco || 'Endereço'} / {cupomCidadeUf || 'Cidade - UF'}
                                            </div>
                                            <div className="text-center text-[9px] text-gray-500 mb-2">
                                                CNPJ: {cupomCnpj || '00.000.000/0001-00'}
                                            </div>
                                            <div className="border-t border-dashed border-gray-300 pt-2 mt-2 text-center font-bold text-[10px]">
                                                CUPOM FISCAL
                                            </div>
                                            <div className="text-center text-[9px] text-gray-500 mb-2">
                                                Comprovante de Venda
                                            </div>
                                            <div className="border-t border-dashed border-gray-300 pt-2 mt-2 text-[9px]">
                                                1 PÃO FRANCÊS ......... R$ 2,50<br />
                                                1 CAFÉ ................ R$ 5,00
                                            </div>
                                            <div className="border-t border-dashed border-gray-300 pt-2 mt-2 text-[9px]">
                                                TOTAL ................. R$ 7,50
                                            </div>
                                            <div className="border-t border-dashed border-gray-300 pt-2 mt-2 text-center text-[9px]">
                                                {cupomMensagem || 'Mensagem de rodapé'}
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-gray-500 text-center mt-3">Atualiza em tempo real conforme você edita.</p>
                                        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-center">
                                            <div className="text-2xl font-black text-amber-600">{cupomImprimidos}</div>
                                            <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Cupons impressos</div>
                                        </div>
                                        {/* Últimas 3 vendas */}
                                        <div className="mt-4">
                                            <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-2">Últimas 3 vendas</h4>
                                            <div className="space-y-2">
                                                {[...vendasHoje]
                                                    .sort((a, b) => {
                                                        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
                                                        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
                                                        return tb - ta
                                                    })
                                                    .slice(0, 3)
                                                    .map((v) => (
                                                        <div key={v.id} className="flex items-center justify-between gap-2 p-2 bg-white border border-gray-200 rounded-lg text-[11px]">
                                                            <div className="min-w-0 flex-1">
                                                                <span className="font-bold text-gray-800">#{v.id}</span>
                                                                <span className="text-gray-600 ml-1">• {v.data}</span>
                                                                <span className="font-bold text-amber-600 ml-1">R$ {Number(v.total).toFixed(2)}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => imprimirVendaPorId(v.id)}
                                                                className="shrink-0 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase flex items-center gap-1"
                                                            >
                                                                <Printer className="h-3 w-3" /> Imprimir
                                                            </button>
                                                        </div>
                                                    ))}
                                                {vendasHoje.length === 0 && (
                                                    <p className="text-[10px] text-gray-500 text-center py-2">Nenhuma venda hoje.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal aviso: não é possível fechar sem conferência */}
                            {modalNoConferencia && (
                                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
                                    <div className="bg-white p-4 rounded-lg w-full max-w-sm shadow-lg">
                                        <h3 className="text-base font-black text-red-600 mb-2 text-center">Não é possível fechar o caixa sem a conferência</h3>
                                        <p className="text-sm text-gray-600 text-center mb-4">Por favor, informe os valores conferidos nas formas de pagamento antes de fechar o caixa.</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setModalNoConferencia(false)
                                                    // foca o primeiro campo de conferência
                                                    setTimeout(() => { try { confDinheiroRef.current?.focus() } catch {} }, 50)
                                                }}
                                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-black"
                                            >
                                                Conferir
                                            </button>
                                            <button
                                                onClick={() => { setModalNoConferencia(false); setModalFechamento(false) }}
                                                className="flex-1 py-2 bg-gray-100 rounded-lg font-bold"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                    {/* TELA DE VENDA */}
                    {caixaAberto && view === 'venda' && (
                        <div className="flex-1 flex flex-col lg:flex-row gap-2 overflow-auto relative">
                            {/* Coluna Esquerda: Busca e Carrinho */}
                            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                                {/* Busca */}
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-blue-100 shrink-0">
                                    <div className="flex gap-2 relative">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                onClick={() => setShowSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                                placeholder="Escaneie ou digite o nome do produto..."
                                                className="w-full p-4 pl-12 border-2 border-blue-50 rounded-2xl focus:border-blue-400 outline-none text-lg font-bold placeholder:font-normal"
                                                ref={searchInputRef}
                                            />
                                            <Search className="absolute left-4 top-4 text-blue-300 h-6 w-6" />

                                            {/* Dropdown de Sugestões */}
                                            {showSuggestions && (
                                                <div className="absolute w-full bg-white shadow-2xl rounded-b-2xl border-x border-b border-blue-100 z-50 max-h-80 overflow-y-auto top-full mt-1">
                                                    {listaExibicao.length === 0 && searchTerm ? (
                                                        <div className="p-4 text-sm text-red-500 font-bold">Produto não encontrado. Tente outro nome.</div>
                                                    ) : (
                                                        listaExibicao.map(p => (
                                                            <div
                                                                key={p.id}
                                                                onMouseDown={(e) => { e.preventDefault(); adicionarAoCarrinho(p); setShowSuggestions(false); }}
                                                                className="p-4 border-b border-blue-50 hover:bg-blue-50 cursor-pointer flex justify-between items-center group"
                                                            >
                                                                <div>
                                                                    <span className="font-black text-gray-800 text-sm block">{p.nome}</span>
                                                                    <span className="text-[10px] text-blue-400 font-bold uppercase">
                                                                        Cód: {p.codigoBarras || p.id} • Est: {p.estoque}
                                                                    </span>
                                                                </div>
                                                                <span className="font-black text-gray-900 bg-blue-100 px-3 py-1 rounded-xl text-xs">
                                                                    R$ {p.preco.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={scannerAtivo ? desativarScanner : ativarScanner}
                                            className={`px-6 rounded-2xl transition font-black text-xs uppercase border flex items-center gap-2 ${
                                                scannerAtivo
                                                    ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                                                    : 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                                            }`}
                                            title={scannerAtivo ? 'Clique para desativar o scanner' : 'Clique para ativar o scanner da câmera'}
                                        >
                                            <Camera className="h-4 w-4" />
                                            {scannerAtivo ? 'Desativar Scanner' : 'Ativar Scanner'}
                                        </button>
                                    </div>
                                    {scannerErro && (
                                        <div className="mt-2 text-red-600 text-xs font-bold">{scannerErro}</div>
                                    )}
                                </div>

                                {/* Carrinho */}
                                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden flex flex-col">
                                    {lastAddedItem && (
                                        <div className="p-4 border-b border-blue-100 bg-gradient-to-r from-white to-blue-50 flex items-center gap-4">
                                            <div className="w-16 h-16 flex items-center justify-center bg-blue-600 text-white rounded-xl text-3xl font-black">
                                                {String(lastAddedItem.nome || '').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[11px] font-bold text-gray-500 uppercase">Último adicionado</div>
                                                <div className="text-lg font-black text-gray-900 truncate">{lastAddedItem.nome}</div>
                                            </div>
                                            <div className="text-blue-600 font-black">R$ {Number(lastAddedItem.preco).toFixed(2)}</div>
                                        </div>
                                    )}
                                    <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center font-black text-blue-800 uppercase text-[10px] tracking-widest shrink-0">
                                        <span className="w-12 flex justify-center"><ShoppingCart className="h-4 w-4" /></span>
                                        <span className="flex-1">
                                            PRODUTO
                                        </span>
                                        <span className="w-24 text-center">Unit</span>
                                        <span className="w-32 text-center">Qtd</span>
                                        <span className="w-24 text-right">Total</span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                        {carrinho.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-300 italic">
                                                <ShoppingCart className="h-16 w-16 mb-4 opacity-20" />
                                                <p className="text-xl opacity-20 font-black uppercase">Carrinho Vazio</p>
                                            </div>
                                        ) : (
                                            carrinho.map((item, idx) => (
                                                <div key={item.id} className="flex items-center p-3 bg-white rounded-2xl border border-blue-50 shadow-sm">
                                                    <span className="w-12 text-[10px] font-black text-blue-200">#{idx + 1}</span>
                                                    <div className="flex-1">
                                                        <span className="font-black block text-gray-800 text-sm leading-tight">{item.nome}</span>
                                                        <span className="text-[9px] text-gray-400 font-bold uppercase">REF: {item.id}</span>
                                                    </div>
                                                    <div className="w-24 text-center text-xs font-bold text-gray-400">
                                                        {item.unidade === 'kg' || item.unidade === 'g' ? 'R$/kg' : 'R$'} {item.preco.toFixed(2)}
                                                    </div>
                                                    <div className="w-32 flex items-center justify-center gap-2">
                                                        {(() => {
                                                            const isPeso = item.unidade === 'kg' || item.unidade === 'g'
                                                            const delta = isPeso ? 0.1 : 1
                                                            return (
                                                                <>
                                                                    <button
                                                                        onClick={() => alterarQtd(item.id, -delta)}
                                                                        className="w-8 h-8 bg-blue-50 rounded-xl text-blue-600 flex items-center justify-center hover:bg-blue-100"
                                                                    >
                                                                        <Minus className="h-4 w-4" />
                                                                    </button>
                                                                    <span className="font-black text-sm text-gray-700 w-12 text-center">
                                                                        {isPeso
                                                                            ? `${Number(item.qtdCarrinho).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
                                                                            : item.qtdCarrinho}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => alterarQtd(item.id, delta)}
                                                                        className="w-8 h-8 bg-blue-50 rounded-xl text-blue-600 flex items-center justify-center hover:bg-blue-100"
                                                                    >
                                                                        <Plus className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            )
                                                        })()}
                                                    </div>
                                                    <span className="w-24 text-right font-black text-blue-600 text-sm">
                                                        R$ {(item.preco * item.qtdCarrinho).toFixed(2)}
                                                    </span>
                                                    <button
                                                        onClick={() => removerDoCarrinho(item.id)}
                                                        className="ml-2 text-red-400 hover:text-red-600"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Coluna Direita: Pagamento */}
                            <div className="w-full lg:w-96 flex flex-col gap-2 shrink-0 pb-24 md:pb-0">
                                <div className="bg-blue-600 text-white p-6 rounded-3xl shadow-xl border-b-8 border-blue-800">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] uppercase font-black tracking-widest opacity-70 italic">Total a Pagar</span>
                                    </div>
                                    <span className="text-5xl font-black block leading-none break-words">
                                        R$ {totalVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <div className="mt-6 pt-4 border-t border-blue-500/50 flex justify-between items-center text-[11px] font-bold">
                                        <span className="uppercase">{carrinho.reduce((acc, i) => acc + i.qtdCarrinho, 0)} ITENS</span>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-3xl shadow-sm border border-blue-100 flex-1 flex flex-col">
                                    <h3 className="font-black text-blue-400 text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
                                        Escolha o Pagamento
                                    </h3>


                                    <div className="grid grid-cols-2 gap-1">
                                        <button
                                            onClick={() => setModalPagamento(true)}
                                            title="Dinheiro — F5 ou 1"
                                            className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-50 font-black hover:border-blue-300 transition text-xs uppercase flex flex-col items-center gap-1"
                                        >
                                            <Banknote className="h-5 w-5" />
                                            Dinheiro
                                        </button>
                                        <button
                                            onClick={() => setModalDebito(true)}
                                            title="Débito — F6 ou 2"
                                            className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-50 font-black hover:border-blue-300 transition text-xs uppercase flex flex-col items-center gap-1"
                                        >
                                            <CreditCard className="h-5 w-5" />
                                            Débito
                                        </button>
                                        <button
                                            onClick={() => setModalCredito(true)}
                                            title="Crédito — F7 ou 3"
                                            className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-50 font-black hover:border-blue-300 transition text-xs uppercase flex flex-col items-center gap-1"
                                        >
                                            <CreditCard className="h-5 w-5" />
                                            Crédito
                                        </button>
                                        <button
                                            onClick={() => setModalPix(true)}
                                            title="Pix — F8 ou 4"
                                            className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-50 font-black hover:border-blue-300 transition text-xs uppercase flex flex-col items-center gap-1"
                                        >
                                            <Smartphone className="h-5 w-5" />
                                            Pix
                                        </button>
                                        <button
                                            onClick={() => setModalCaderneta(true)}
                                            title="Caderneta — F11"
                                            className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-50 font-black hover:border-blue-300 transition text-xs uppercase flex flex-col items-center gap-1 col-span-2 justify-self-center mx-auto w-3/4 md:w-2/3"
                                        >
                                            <BookOpen className="h-5 w-5" />
                                            Caderneta
                                        </button>
                                    </div>

                                    <div className="mt-auto pt-8 space-y-3 md:static fixed bottom-0 left-0 right-0 md:right-auto md:left-auto bg-white/90 md:bg-transparent p-4 md:p-0 z-40 md:backdrop-blur-sm">
                                        <button
                                            onClick={() => { setCarrinho([]); setLastAddedItem(null); }}
                                            title="Limpar carrinho — Ctrl+L"
                                            className="w-full py-2 bg-black text-white font-bold text-[10px] uppercase hover:bg-gray-800 transition rounded-lg"
                                        >
                                            limpar venda atual
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TELA DE HISTÓRICO (F2) */}
                    {caixaAberto && view === 'historico' && (
                        <div className="h-full bg-white rounded-2xl shadow-sm border border-blue-100 p-6 overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-black mb-0 uppercase text-gray-800 italic border-l-8 border-blue-500 pl-4">
                                    Vendas de Hoje
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleRefreshRelatorio}
                                        className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold border border-blue-100 hover:bg-blue-100"
                                    >
                                        {isRefreshing ? 'Atualizando...' : 'Atualizar'}
                                    </button>
                                </div>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-blue-50 border-b border-blue-100">
                                    <tr>
                                        <th className="p-4 font-black uppercase text-blue-800">ID</th>
                                        <th className="p-4 font-black uppercase text-blue-800">Hora</th>
                                        <th className="p-4 font-black uppercase text-blue-800">Forma</th>
                                        <th className="p-4 font-black uppercase text-blue-800 text-right">Valor</th>
                                        <th className="p-4 font-black uppercase text-blue-800 text-center">Ver</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vendasHoje.map(venda => (
                                        <tr key={venda.id} className="border-b border-blue-50 hover:bg-blue-50/30">
                                            <td className="p-4 font-bold text-gray-500">#{venda.id}</td>
                                            <td className="p-4 font-bold">{venda.data}</td>
                                            <td className="p-4 uppercase text-xs font-bold">
                                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                    {venda.forma_pagamento}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-black text-blue-600">
                                                R$ {venda.total.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => verDetalhesVenda(venda.id)}
                                                    className="p-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition"
                                                    title="Ver Itens Comprados"
                                                >
                                                    <Eye className="h-5 w-5" />
                                                </button>

                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* TELA DE ESTOQUE (F3) */}
                    {caixaAberto && view === 'estoque' && (
                        <div className="h-full min-h-0 flex flex-col bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
                            <div className="p-6 shrink-0">
                                <h2 className="text-2xl font-black uppercase text-gray-800 italic border-l-8 border-blue-500 pl-4">
                                    Estoque Atual
                                </h2>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {produtos.map(p => (
                                    <div key={p.id} className="p-4 border border-blue-100 rounded-xl hover:shadow-md transition bg-white">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-blue-300">#{p.id}</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${p.estoque < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                {p.estoque} {p.unidade}
                                            </span>
                                        </div>
                                        <h3 className="font-black text-gray-800 mb-1">{p.nome}</h3>
                                        <p className="text-blue-600 font-bold">R$ {p.preco.toFixed(2)}</p>
                                    </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TELA DE SISTEMA DE CAIXA (F4) */}
                    {caixaAberto && view === 'caixa' && (
                        <div className="h-full bg-white rounded-2xl shadow-sm border border-blue-100 p-6 overflow-y-auto">
                            <div className="flex items-start justify-between mb-6 gap-4">
                                <h2 className="text-2xl font-black mb-0 uppercase text-gray-800 italic border-l-8 border-blue-500 pl-4">
                                    Sistema de Caixa
                                </h2>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={abrirModalTrocaOperador}
                                        title="Troca de Operador"
                                        className="px-4 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase hover:bg-blue-800 transition shadow-lg"
                                    >
                                        Troca Operador
                                    </button>
                                    <button
                                        onClick={openFechamento}
                                        title="Fechar Caixa"
                                        className="px-4 py-3 bg-gray-800 text-white rounded-2xl font-black uppercase hover:bg-black transition shadow-lg"
                                    >
                                        Fechar Caixa
                                    </button>
                                </div>
                            </div>

                            {/* Resumo do Dia */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    <span className="text-xs font-bold text-blue-400 uppercase block mb-1">Data Abertura</span>
                                    <span className="text-lg font-black text-gray-800">{dataHoje}</span>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    <span className="text-xs font-bold text-blue-400 uppercase block mb-1">Hora Abertura</span>
                                    <span className="text-lg font-black text-gray-800">{horaAbertura}</span>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    <span className="text-xs font-bold text-blue-400 uppercase block mb-1">Fundo Inicial</span>
                                    <span className="text-lg font-black text-gray-800">R$ {saldoInicial.toFixed(2)}</span>
                                </div>
                                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                    <span className="text-xs font-bold text-green-600 uppercase block mb-1">Valor Esperado (Dinheiro)</span>
                                    <span className="text-lg font-black text-green-700">R$ {metricasCaixa.valorEsperadoDinheiro.toFixed(2)}</span>
                                </div>
                                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                                    <span className="text-xs font-bold text-red-600 uppercase block mb-1">Total Saídas (Dia)</span>
                                    <span className="text-lg font-black text-red-700">R$ {totalSaidasDoDia.toFixed(2)}</span>
                                    <div className="text-[11px] text-red-800 mt-1">Registros: {saidasDoDia.length}</div>
                                </div>
                            </div>

                            {/* Totais Gerais */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                <div className="p-6 bg-white rounded-xl border-2 border-blue-100 shadow-sm">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Entradas</span>
                                    <div className="text-3xl font-black text-blue-600 mt-2">R$ {metricasCaixa.totalEntradas.toFixed(2)}</div>
                                    
                                    <span className="text-[10px] text-gray-400 font-bold">Dinheiro + Pix + Cartões</span>
                                </div>
                                <div className="p-6 bg-white rounded-xl border-2 border-orange-100 shadow-sm">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Caderneta</span>
                                    <div className="text-3xl font-black text-orange-500 mt-2">R$ {metricasCaixa.caderneta.toFixed(2)}</div>
                                    
                                    <span className="text-[10px] text-gray-400 font-bold">Vendas a Prazo</span>
                                </div>
                                <div className="p-6 bg-blue-600 rounded-xl shadow-lg text-white">
                                    <span className="text-xs font-black text-blue-200 uppercase tracking-widest">Total Geral</span>
                                    <div className="text-3xl font-black mt-2">R$ {metricasCaixa.totalGeral.toFixed(2)}</div>
                                    
                                    <span className="text-[10px] text-blue-200 font-bold">Entradas + Caderneta</span>
                                </div>
                            </div>

                            

                            {/* Detalhamento por Forma de Pagamento */}
                            <div className="mb-4">
                                <h3 className="text-lg font-semibold text-gray-700 uppercase">Detalhamento por forma de pagamento</h3>
                                <p className="text-sm text-gray-500">Vendas do dia</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Banknote className="h-4 w-4 text-green-600" />
                                        <span className="text-xs font-bold text-gray-600 uppercase">Dinheiro</span>
                                    </div>
                                    <div>
                                        <span className="text-xl font-black text-gray-800">R$ {metricasCaixa.dinheiro.toFixed(2)}</span>
                                        
                                    </div>
                                </div>
                                <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Smartphone className="h-4 w-4 text-blue-600" />
                                        <span className="text-xs font-bold text-gray-600 uppercase">Pix</span>
                                    </div>
                                    <div>
                                        <span className="text-xl font-black text-gray-800">R$ {metricasCaixa.pix.toFixed(2)}</span>
                                        
                                    </div>
                                </div>
                                <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CreditCard className="h-4 w-4 text-orange-600" />
                                        <span className="text-xs font-bold text-gray-600 uppercase">Débito</span>
                                    </div>
                                    <div>
                                        <span className="text-xl font-black text-gray-800">R$ {metricasCaixa.debito.toFixed(2)}</span>
                                        
                                    </div>
                                </div>
                                <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CreditCard className="h-4 w-4 text-purple-600" />
                                        <span className="text-xs font-bold text-gray-600 uppercase">Crédito</span>
                                    </div>
                                    <div>
                                        <span className="text-xl font-black text-gray-800">R$ {metricasCaixa.credito.toFixed(2)}</span>
                                        
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TELA DE CADERNETA (F11) */}
                    {caixaAberto && view === 'caderneta' && (
                        <div className="h-full bg-white rounded-2xl shadow-sm border border-blue-100 p-6 overflow-y-auto">
                            <CadernetaContent />
                        </div>
                    )}

                </main>

                {/* --- MODAIS --- */}

                {/* Modal Pagamento Dinheiro */}
                {modalPagamento && (
                    <div
                        className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                if (!loading) confirmarPagamentoAtivo()
                            }
                        }}
                    >
                        <div className="bg-white p-6 rounded-[30px] w-full max-w-md shadow-2xl border-4 border-blue-500 my-auto max-h-[90vh] overflow-y-auto">
                            <div className="text-center mb-4">
                                <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Recebimento</span>
                                <h2 className="text-2xl font-black text-gray-800 uppercase italic leading-none mt-1">Dinheiro</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-blue-50 p-4 rounded-2xl flex justify-between items-center border border-blue-100">
                                    <span className="font-bold text-blue-400 text-xs">TOTAL</span>
                                    <span className="text-2xl font-black text-blue-700 font-mono">
                                        R$ {totalComDesconto.toFixed(2)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desconto (%)</label>
                                        <input
                                            type="number"
                                            value={descontoPercent}
                                            onChange={(e) => { setDescontoPercent(e.target.value); setDescontoValor('') }}
                                            placeholder="0"
                                            className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desconto (R$)</label>
                                        <input
                                            type="number"
                                            value={descontoValor}
                                            onChange={(e) => { setDescontoValor(e.target.value); setDescontoPercent('') }}
                                            placeholder="0,00"
                                            className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">
                                        Valor Recebido
                                    </label>
                                    <input
                                        type="number"
                                        value={valorRecebido}
                                        onChange={(e) => setValorRecebido(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                if (!loading) handlePagamentoDinheiro()
                                            }
                                        }}
                                        className="w-full p-4 border-2 border-blue-50 rounded-3xl text-3xl font-black text-blue-600 outline-none focus:border-blue-500 bg-blue-50/20 text-center"
                                        autoFocus
                                    />
                                </div>

                                {/* Caderneta removida deste modal - permanece apenas desconto */}

                                <div className="bg-gray-900 p-4 rounded-[24px] text-center shadow-inner">
                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">
                                        Troco
                                    </span>
                                    <span className="text-3xl font-black text-white block font-mono">
                                        R$ {Math.max(0, (parseFloat(valorRecebido) || 0) - totalComDesconto).toFixed(2)}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={handlePagamentoDinheiro}
                                        disabled={loading}
                                        className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        {loading ? 'Processando...' : 'Confirmar'}
                                    </button>
                                    <button
                                        onClick={() => setModalPagamento(false)}
                                        className="w-full text-blue-400 font-bold text-xs uppercase py-2"
                                    >
                                        Voltar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

               {/* Modal Fechamento */}
{modalFechamento && (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-100 text-center">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Fechar Caixa</h2>
                <p className="text-sm text-slate-500 font-medium">{dataHoje}</p>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
                
                {/* Banner Principal - Total de Vendas */}
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total de Vendas Registradas</span>
                    <div className="text-3xl font-black text-slate-800">
                        R$ {metricasCaixa.totalEntradas.toFixed(2)}
                    </div>
                </div>

                {/* Alerta de Caderneta */}
                <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="text-amber-500 mt-0.5">⚠️</div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                        Valores em <b>caderneta</b> não entram no fechamento. 
                        Confira-os na aba específica.
                    </p>
                </div>

                {/* Grid de Conferência */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                        { label: 'Dinheiro', valor: metricasCaixa.dinheiro, state: confDinheiro, setter: setConfDinheiro, ref: confDinheiroRef, error: fechamentoFieldErrors.dinheiro },
                        { label: 'Pix', valor: metricasCaixa.pix, state: confPix, setter: setConfPix, error: fechamentoFieldErrors.pix },
                        { label: 'Débito', valor: metricasCaixa.debito, state: confDebito, setter: setConfDebito, error: fechamentoFieldErrors.debito },
                        { label: 'Crédito', valor: metricasCaixa.credito, state: confCredito, setter: setConfCredito, error: fechamentoFieldErrors.credito }
                    ].map((item, idx) => (
                        <div key={idx} className="flex flex-col p-3 rounded-xl border border-gray-100 bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{item.label}</span>
                            <span className="text-sm font-bold text-gray-700 mb-2">R$ {item.valor.toFixed(2)}</span>
                            
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={item.state}
                                ref={item.ref}
                                onChange={(e) => {
                                    const raw = String(e.target.value).replace(/[^0-9.,]/g, '');
                                    item.setter(raw);
                                }}
                                onFocus={() => {
                                    const n = parseCurrencyBR(item.state);
                                    if (!isNaN(n)) item.setter(String(n).replace('.', ','));
                                }}
                                onBlur={() => {
                                    const n = parseCurrencyBR(item.state);
                                    if (isNaN(n)) item.setter('');
                                    else item.setter(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));
                                }}
                                className={`w-full bg-white p-2 border rounded-lg text-right font-black text-slate-800 outline-none transition-colors ${item.error ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                            />
                            {item.error && <span className="text-[10px] text-red-600 mt-1 font-bold">{item.error}</span>}
                        </div>
                    ))}
                </div>

                {/* Resumo Final */}
                <div className="space-y-2 border-t border-gray-100 pt-6 mb-4">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-blue-500" />
                            <span className="text-xs font-bold text-slate-600">Total Corrigido</span>
                        </div>
                        <span className="font-black text-slate-800">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(totalCorrigido || 0))}</span>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2">
                            <X className="h-4 w-4 text-gray-400" />
                            <span className="text-xs font-bold text-slate-600">Diferença</span>
                        </div>
                        <span className={`font-black ${diferencaFechamento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {diferencaFechamento >= 0 ? '+' : '-'} R$ {Math.abs(Number(diferencaFechamento || 0)).toFixed(2)}
                        </span>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4 text-red-400" />
                            <span className="text-xs font-bold text-slate-600">Sangrias (Saídas)</span>
                        </div>
                        <span className="font-black text-red-600">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(totalSaidasDoDia || 0))}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 rounded-xl bg-green-50 mt-4 border border-green-100">
                        <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-black text-green-700">Saldo Final</span>
                        </div>
                        <span className="text-xl font-black text-green-700">
                            R$ {Math.abs(Number(valorTotalDoCaixa || 0)).toFixed(2)}
                        </span>
                    </div>
                </div>

                <p className="text-[10px] text-center text-red-500 font-bold uppercase tracking-tight mb-4">
                    Atenção: Esta ação encerrará o expediente e não pode ser desfeita.
                </p>

                {fechamentoError && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-lg text-center italic">
                        {fechamentoError}
                    </div>
                )}
            </div>

            {/* Footer / Ações */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button
                    onClick={() => setModalFechamento(false)}
                    className="flex-1 py-3 px-4 bg-white border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={validateFechamento}
                    disabled={!hasConferido}
                    className={`flex-[2] py-3 px-4 rounded-xl font-black shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 ${
                        hasConferido 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    CONCLUIR FECHAMENTO
                </button>
            </div>
        </div>
    </div>
)}{/* Modal Fechamento */}
{modalFechamento && (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-100 text-center">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Fechar Caixa</h2>
                <p className="text-sm text-slate-500 font-medium">{dataHoje}</p>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
                
                {/* Banner Principal - Total de Vendas */}
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total de Vendas Registradas</span>
                    <div className="text-3xl font-black text-slate-800">
                        R$ {metricasCaixa.totalEntradas.toFixed(2)}
                    </div>
                </div>

                {/* Alerta de Caderneta */}
                <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="text-amber-500 mt-0.5">⚠️</div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                        Valores em <b>caderneta</b> não entram no fechamento. 
                        Confira-os na aba específica.
                    </p>
                </div>

                {/* Grid de Conferência */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                        { label: 'Dinheiro', valor: metricasCaixa.dinheiro, state: confDinheiro, setter: setConfDinheiro, ref: confDinheiroRef, error: fechamentoFieldErrors.dinheiro },
                        { label: 'Pix', valor: metricasCaixa.pix, state: confPix, setter: setConfPix, error: fechamentoFieldErrors.pix },
                        { label: 'Débito', valor: metricasCaixa.debito, state: confDebito, setter: setConfDebito, error: fechamentoFieldErrors.debito },
                        { label: 'Crédito', valor: metricasCaixa.credito, state: confCredito, setter: setConfCredito, error: fechamentoFieldErrors.credito }
                    ].map((item, idx) => (
                        <div key={idx} className="flex flex-col p-3 rounded-xl border border-gray-100 bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{item.label}</span>
                            <span className="text-sm font-bold text-gray-700 mb-2">R$ {item.valor.toFixed(2)}</span>
                            
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={item.state}
                                ref={item.ref}
                                onChange={(e) => {
                                    const raw = String(e.target.value).replace(/[^0-9.,]/g, '');
                                    item.setter(raw);
                                }}
                                onFocus={() => {
                                    const n = parseCurrencyBR(item.state);
                                    if (!isNaN(n)) item.setter(String(n).replace('.', ','));
                                }}
                                onBlur={() => {
                                    const n = parseCurrencyBR(item.state);
                                    if (isNaN(n)) item.setter('');
                                    else item.setter(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));
                                }}
                                className={`w-full bg-white p-2 border rounded-lg text-right font-black text-slate-800 outline-none transition-colors ${item.error ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                            />
                            {item.error && <span className="text-[10px] text-red-600 mt-1 font-bold">{item.error}</span>}
                        </div>
                    ))}
                </div>

                {/* Resumo Final */}
                <div className="space-y-2 border-t border-gray-100 pt-6 mb-4">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-blue-500" />
                            <span className="text-xs font-bold text-slate-600">Total Corrigido</span>
                        </div>
                        <span className="font-black text-slate-800">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(totalCorrigido || 0))}</span>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2">
                            <X className="h-4 w-4 text-gray-400" />
                            <span className="text-xs font-bold text-slate-600">Diferença</span>
                        </div>
                        <span className={`font-black ${diferencaFechamento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {diferencaFechamento >= 0 ? '+' : '-'} R$ {Math.abs(Number(diferencaFechamento || 0)).toFixed(2)}
                        </span>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4 text-red-400" />
                            <span className="text-xs font-bold text-slate-600">Sangrias (Saídas)</span>
                        </div>
                        <span className="font-black text-red-600">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(Number(totalSaidasDoDia || 0))}</span>
                    </div>

                    <div className="flex justify-between items-center p-4 rounded-xl bg-green-50 mt-4 border border-green-100">
                        <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-black text-green-700">Saldo Final</span>
                        </div>
                        <span className="text-xl font-black text-green-700">
                            R$ {Math.abs(Number(valorTotalDoCaixa || 0)).toFixed(2)}
                        </span>
                    </div>
                </div>

                <p className="text-[10px] text-center text-red-500 font-bold uppercase tracking-tight mb-4">
                    Atenção: Esta ação encerrará o expediente e não pode ser desfeita.
                </p>

                {fechamentoError && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-lg text-center italic">
                        {fechamentoError}
                    </div>
                )}
            </div>

            {/* Footer / Ações */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button
                    onClick={() => setModalFechamento(false)}
                    className="flex-1 py-3 px-4 bg-white border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={validateFechamento}
                    disabled={!hasConferido}
                    className={`flex-[2] py-3 px-4 rounded-xl font-black shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 ${
                        hasConferido 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    CONCLUIR FECHAMENTO
                </button>
            </div>
        </div>
    </div>
)}

                {/* Modal de confirmação final */}
                {modalFechamentoConfirm && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-4 rounded-lg w-full max-w-sm shadow-lg">
                            <h3 className="text-base font-black text-red-600 mb-2 text-center" role="alert">Se o caixa for fechado só poderá ser aberto no dia seguinte. Tem certeza que deseja fechar o caixa?</h3>
                            <p className="text-xs text-red-500 text-center mb-3">Ao fechar o caixa apenas um administrador pode reabrir.</p>

                            <div className="flex gap-2">
                                <button onClick={() => setModalFechamentoConfirm(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-bold">Cancelar</button>
                                <button onClick={handleConfirmFechamento} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-black">Fechar Caixa</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Débito */}
                {modalDebito && (
                    <div
                        className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                if (!loading) finalizarVenda('debito')
                            }
                        }}
                    >
                        <div className="bg-white p-6 rounded-[30px] w-full max-w-md shadow-2xl border-4 border-blue-500 my-auto max-h-[90vh] overflow-y-auto">
                            <div className="text-center mb-4">
                                <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Pagamento</span>
                                <h2 className="text-2xl font-black text-gray-800 uppercase italic leading-none mt-1">Débito</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-blue-50 p-4 rounded-2xl flex justify-between items-center border border-blue-100">
                                    <span className="font-bold text-blue-400 text-xs">TOTAL</span>
                                    <span className="text-2xl font-black text-blue-700 font-mono">R$ {totalComDesconto.toFixed(2)}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desconto (%)</label>
                                        <input type="number" value={descontoPercent} onChange={(e) => { setDescontoPercent(e.target.value); setDescontoValor('') }} className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desconto (R$)</label>
                                        <input type="number" value={descontoValor} onChange={(e) => { setDescontoValor(e.target.value); setDescontoPercent('') }} className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20" />
                                    </div>
                                </div>

                                {/* Caderneta removida deste modal - permanece apenas desconto */}

                                <div className="flex flex-col gap-2">
                                    <button onClick={() => finalizarVenda('debito')} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50">{loading ? 'Processando...' : 'Confirmar'}</button>
                                    <button onClick={() => setModalDebito(false)} className="w-full text-blue-400 font-bold text-xs uppercase py-2">Voltar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Crédito */}
                {modalCredito && (
                    <div className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white p-6 rounded-[30px] w-full max-w-md shadow-2xl border-4 border-blue-500 my-auto max-h-[90vh] overflow-y-auto">
                            <div className="text-center mb-4">
                                <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Pagamento</span>
                                <h2 className="text-2xl font-black text-gray-800 uppercase italic leading-none mt-1">Crédito</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-blue-50 p-4 rounded-2xl flex justify-between items-center border border-blue-100">
                                    <span className="font-bold text-blue-400 text-xs">TOTAL</span>
                                    <span className="text-2xl font-black text-blue-700 font-mono">R$ {totalComDesconto.toFixed(2)}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desconto (%)</label>
                                        <input type="number" value={descontoPercent} onChange={(e) => { setDescontoPercent(e.target.value); setDescontoValor('') }} className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desconto (R$)</label>
                                        <input type="number" value={descontoValor} onChange={(e) => { setDescontoValor(e.target.value); setDescontoPercent('') }} className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20" />
                                    </div>
                                </div>

                                {/* Caderneta removida deste modal - permanece apenas desconto */}

                                <div className="flex flex-col gap-2">
                                    <button onClick={() => finalizarVenda('credito')} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50">{loading ? 'Processando...' : 'Confirmar'}</button>
                                    <button onClick={() => setModalCredito(false)} className="w-full text-blue-400 font-bold text-xs uppercase py-2">Voltar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Pix */}
                {modalPix && (
                    <div
                        className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                if (!loading) confirmarPagamentoAtivo()
                            }
                        }}
                    >
                        <div className="bg-white p-6 rounded-[30px] w-full max-w-md shadow-2xl border-4 border-blue-500 my-auto max-h-[90vh] overflow-y-auto">
                            <div className="text-center mb-4">
                                <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Pagamento</span>
                                <h2 className="text-2xl font-black text-gray-800 uppercase italic leading-none mt-1">Pix</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-blue-50 p-4 rounded-2xl flex justify-between items-center border border-blue-100">
                                    <span className="font-bold text-blue-400 text-xs">TOTAL</span>
                                    <span className="text-2xl font-black text-blue-700 font-mono">R$ {totalComDesconto.toFixed(2)}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desconto (%)</label>
                                        <input type="number" value={descontoPercent} onChange={(e) => { setDescontoPercent(e.target.value); setDescontoValor('') }} className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desconto (R$)</label>
                                        <input type="number" value={descontoValor} onChange={(e) => { setDescontoValor(e.target.value); setDescontoPercent('') }} className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20" />
                                    </div>
                                </div>

                                {/* Caderneta removida deste modal - permanece apenas desconto */}

                                <div className="flex flex-col gap-2">
                                    <button onClick={() => finalizarVenda('pix')} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50">{loading ? 'Processando...' : 'Confirmar'}</button>
                                    <button onClick={() => setModalPix(false)} className="w-full text-blue-400 font-bold text-xs uppercase py-2">Voltar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Caderneta */}
                {modalCaderneta && (
                    <div
                        className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                const podeConfirmar = !loading && !!clienteCadernetaSelecionado && (parseFloat(String(valorAbaterCaderneta).replace(',', '.')) || 0) > 0
                                if (podeConfirmar) confirmarPagamentoAtivo()
                            }
                        }}
                    >
                        <div className="bg-white p-6 rounded-[30px] w-full max-w-md shadow-2xl border-4 border-blue-500 my-auto">
                            <div className="text-center mb-4">
                                <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Pagamento</span>
                                <h2 className="text-2xl font-black text-gray-800 uppercase italic leading-none mt-1">Caderneta</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-blue-50 p-4 rounded-2xl flex justify-between items-center border border-blue-100">
                                    <span className="font-bold text-blue-400 text-xs">TOTAL</span>
                                    <span className="text-2xl font-black text-blue-700 font-mono">R$ {totalComDesconto.toFixed(2)}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desconto (%)</label>
                                        <input type="number" value={descontoPercent} onChange={(e) => { setDescontoPercent(e.target.value); setDescontoValor('') }} className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desconto (R$)</label>
                                        <input type="number" value={descontoValor} onChange={(e) => { setDescontoValor(e.target.value); setDescontoPercent('') }} className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-2">Selecione o Cliente</label>
                                    <select
                                        value={clienteCadernetaSelecionado}
                                        onChange={(e) => { setClienteCadernetaSelecionado(e.target.value); setCadernetaErroLimite(null) }}
                                        className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20"
                                    >
                                        <option value="">Selecionar cliente</option>
                                        {clientes.map((c) => (
                                            <option key={c.id} value={String(c.id)}>
                                                {c.nome} — {c.tipo === 'colaborador' ? 'Funcionário' : 'Cliente'} (Limite disponível R$ {Math.max(0, Number(c.limite_credito) - Number(c.saldo_devedor)).toFixed(2)})
                                            </option>
                                        ))}
                                    </select>
                                    <div className="mt-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Valor a abater (R$)</label>
                                        <input
                                            type="number"
                                            value={valorAbaterCaderneta}
                                            onChange={(e) => { setValorAbaterCaderneta(e.target.value); setCadernetaErroLimite(null) }}
                                            placeholder={totalComDesconto.toFixed(2)}
                                            className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20"
                                        />
                                    </div>
                                </div>

                                {cadernetaErroLimite && (
                                    <div className="bg-amber-100 border-2 border-amber-400 rounded-2xl p-4 flex items-start gap-3">
                                        <span className="text-amber-600 text-xl shrink-0">⚠</span>
                                        <p className="text-amber-800 font-bold text-sm leading-snug">{cadernetaErroLimite}</p>
                                    </div>
                                )}

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => finalizarVenda('caderneta')}
                                        disabled={loading || !clienteCadernetaSelecionado || (parseFloat(String(valorAbaterCaderneta).replace(',', '.')) || 0) <= 0}
                                        className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        {loading ? 'Processando...' : 'Confirmar'}
                                    </button>
                                    <button onClick={() => { setCadernetaErroLimite(null); setModalCaderneta(false) }} className="w-full text-blue-400 font-bold text-xs uppercase py-2">Voltar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Detalhes da Venda (Olhinho) */}
                {modalDetalhes && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl border-4 border-blue-100 max-h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-4 border-b border-blue-50 pb-2">
                                <div>
                                    <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Detalhes</span>
                                    <h2 className="text-xl font-black text-gray-800 uppercase italic">Venda #{vendaSelecionadaId}</h2>
                                    {vendaClienteNome && (
                                        <div className="text-sm font-medium text-gray-600 mt-1">Cliente: {vendaClienteNome}</div>
                                    )}
                                </div>
                                <button onClick={() => setModalDetalhes(false)} className="text-gray-400 hover:text-red-500">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                {itensVendaSelecionada.length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm py-4">Nenhum item encontrado.</p>
                                ) : (
                                    itensVendaSelecionada.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-50">
                                            <div>
                                                <span className="font-bold text-gray-700 text-sm block">
                                                    {item.varejo?.nome || 'Item Desconhecido'}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase block">
                                                    {item.quantidade} x R$ {Number(item.preco_unitario).toFixed(2)}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase block">
                                                    Cód. Barras: {item.varejo?.codigo_barras ?? '---'}
                                                </span>
                                            </div>
                                            <span className="font-black text-blue-600 text-sm">
                                                R$ {(
                                                    item.subtotal != null
                                                        ? Number(item.subtotal)
                                                        : Number(item.quantidade) * Number(item.preco_unitario)
                                                ).toFixed(2)}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Total dos Itens */}
                            <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Total dos Itens</span>
                                <span className="font-black text-blue-700">R$ {totalItensSelecionados.toFixed(2)}</span>
                            </div>

                            {/* Desconto (exibe apenas quando houver) */}
                            {descontoVendaSelecionada > 0 && (
                                <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Desconto</span>
                                    <span className="font-black text-amber-700">- R$ {descontoVendaSelecionada.toFixed(2)}</span>
                                </div>
                            )}

                            {/* Valor Final (quando há desconto) */}
                            {descontoVendaSelecionada > 0 && (
                                <div className="mt-2 p-3 bg-green-50 rounded-xl border border-green-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Valor Final</span>
                                    <span className="font-black text-green-700">R$ {(totalItensSelecionados - descontoVendaSelecionada).toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Modal Peso Manual (produtos kg/g) */}
                {modalPeso && produtoPendentePeso && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl border-4 border-blue-100">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Peso</span>
                                    <h2 className="text-xl font-black text-gray-800">{produtoPendentePeso.nome}</h2>
                                </div>
                                <button onClick={() => { setModalPeso(false); setProdutoPendentePeso(null); }} className="text-gray-400 hover:text-red-500">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <p className="text-gray-500 text-sm mb-2">R$/kg {produtoPendentePeso.preco.toFixed(2)}</p>

                            <div className="mb-4">
                                <label className="text-sm font-bold text-gray-600 block mb-1">Digite o peso (kg)</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={pesoDigitado}
                                    onChange={(e) => setPesoDigitado(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') confirmarPesoManual() }}
                                    placeholder="Ex: 1,250"
                                    autoFocus
                                    className="w-full px-4 py-3 text-2xl font-black text-center border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {pesoDigitado && !isNaN(parseFloat(pesoDigitado.replace(',', '.'))) && (
                                <div className="bg-blue-50 p-3 rounded-xl mb-4 text-center">
                                    <span className="text-sm text-gray-500">Total: </span>
                                    <span className="font-black text-blue-600 text-lg">
                                        R$ {(parseFloat(pesoDigitado.replace(',', '.')) * produtoPendentePeso.preco).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setModalPeso(false); setProdutoPendentePeso(null); }}
                                    className="flex-1 py-3 rounded-xl font-black text-gray-600 bg-gray-100 hover:bg-gray-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmarPesoManual}
                                    className="flex-1 py-3 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700"
                                >
                                    Adicionar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Pós-Venda (Imprimir recibo) */}
                {modalPosVenda && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl border-4 border-blue-100 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Venda</span>
                                    <h2 className="text-xl font-black text-gray-800 uppercase italic">
                                        {lastCadernetaPrintData
                                            ? `Venda lançada para o Cliente ${lastCadernetaPrintData.clienteNome} com sucesso!`
                                            : 'Venda realizada com sucesso!'}
                                    </h2>
                                </div>
                                <button onClick={() => { setModalPosVenda(false); setLastCadernetaPrintData(null); }} className="text-gray-400 hover:text-red-500">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <p className="text-gray-600 mb-6">
                                {lastCadernetaPrintData ? 'Imprimir segunda via?' : 'Deseja imprimir o cupom fiscal?'}
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        if (!lastVendaId) {
                                            showToast('Venda não encontrada para impressão.', 'error')
                                            return
                                        }
                                        await imprimirVendaPorId(lastVendaId, lastCadernetaPrintData ?? undefined)
                                        setModalPosVenda(false)
                                        setLastCadernetaPrintData(null)
                                    }}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase"
                                >
                                    Sim
                                </button>
                                <button
                                    onClick={() => {
                                        setModalPosVenda(false)
                                        setLastCadernetaPrintData(null)
                                    }}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold uppercase"
                                >
                                    Não
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Troca de Operador */}
                {showTurnoModal && operador && (
                    <TurnoOperadorModal
                        operadores={operadores}
                        operadorAtual={{ id: operadores.find(o => o.nome === operador)?.id || 0, nome: operador }}
                        onCancelar={() => setShowTurnoModal(false)}
                        onConfirmar={handleTrocaOperador}
                    />
                )}

                {/* Toast local para PDV (exibe notificações de erro/sucesso) */}
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </ProtectedLayout>
    );
}