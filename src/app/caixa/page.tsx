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
import { useRouter } from 'next/navigation'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { useCadernetaOffline } from '@/hooks/useCadernetaOffline'
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
    BookOpen
} from 'lucide-react'

import Toast from '@/app/gestao/caderneta/Toast'
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

// Interfaces baseadas na estrutura do seu banco de dados
interface Produto {
    id: number
    codigoBarras: string
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
            // Busca TODOS os caixas abertos para detectar inconsistências
            const { data: openCaixas, error } = await getSupabase()
                .from('caixa_diario')
                .select('*')
                .eq('status', 'aberto')
                .order('created_at', { ascending: false })

            if (error) throw error

            if (!openCaixas || openCaixas.length === 0) {
                setCaixaAberto(false)
                if (changeView && view !== 'caderneta') setView('abertura')
                return null
            }

            // Se houver mais de um caixa aberto, mantemos apenas o mais recente
            // e encerramos os outros automaticamente para limpar o banco.
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

            // Busca o operador do turno atual (status 'aberto')
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
            if (changeView && view !== 'caderneta') setView('venda')
            return activeCaixa
        } catch (err) {
            setCaixaAberto(false)
            if (changeView && view !== 'caderneta') setView('abertura')
            console.error('Falha ao restaurar caixa aberto:', err)
            return null
        }
    }

    // Recarrega produtos, vendas e estado do caixa com indicador de progresso
    // Carrega todas as sessões de caixa registradas para a data (ordem crescente)
    async function carregarCaixasDoDia(baseDateISO?: string) {
        try {
            const date = baseDateISO || getLocalDateString()
            const { data, error } = await getSupabase()
                .from('caixa_diario')
                .select('*')
                .eq('data', date)
                .order('created_at', { ascending: true })

            if (error) throw error
            setCaixasDoDia(data || [])
        } catch (e) {
            console.error('Erro ao carregar caixas do dia:', e)
            setCaixasDoDia([])
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

            // Calcula disponível em dinheiro
            const disponivel = metricasCaixa?.valorEsperadoDinheiro ?? 0
            if (valor > disponivel) {
                showToast(`Saldo insuficiente em dinheiro. Disponível: R$ ${disponivel.toFixed(2)}`, 'error')
                return
            }

            if (!caixaDiarioId) {
                showToast('Não há caixa aberto para registrar a saída. Abra o caixa primeiro.', 'error')
                return
            }

            // Atualiza valor_saidas no caixa_diario
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

            // Tenta inserir registro detalhado em 'caixa_movimentacoes' (se existir)
            try {
                const { data: movData, error: movErr } = await getSupabase()
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
                    // Se a tabela não existir ou falhar, log e seguir
                    console.warn('Não foi possível gravar detalhe da saída (caixa_movimentacoes):', movErr)
                }
            } catch (movErr) {
                console.warn('Erro inesperado ao gravar caixa_movimentacoes:', movErr)
            }

            // Também registrar a saída na tabela 'fluxo_caixa' para aparecer em Gestão -> Saídas
            try {
                // Usar a data de abertura do caixa (caixaDiaISO) para registrar a saída
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
    const [view, setView] = useState<'abertura' | 'venda' | 'historico' | 'estoque' | 'caixa' | 'saida' | 'caderneta'>('abertura')
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
    const metricasCaixa = useMemo(() => {
        const totais = {
            dinheiro: 0,
            pix: 0,
            debito: 0,
            credito: 0,
            caderneta: 0
        }


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

        // Pagamentos recebidos de caderneta devem entrar em entradas, não em caderneta
        // Aqui assumimos que todos pagamentos são em dinheiro (ajuste se houver registro da forma)
        try {
            const somaPagamentos = (pagamentosCadernetaHoje || []).reduce((acc, val) => acc + Number(val || 0), 0);
            if (somaPagamentos > 0) totais.dinheiro += somaPagamentos;
        } catch (e) { }

        const totalEntradas = totais.dinheiro + totais.pix + totais.debito + totais.credito
        const totalGeral = totalEntradas + totais.caderneta

        // Soma das saídas registradas no estado local (historico de sangrias)
        const totalSaidas = (saidasDoDia || []).reduce((acc: number, s: any) => acc + (Number(s.valor) || 0), 0)

        // Valor esperado em dinheiro = fundo inicial + entradas em dinheiro - saídas (sangrias)
        const valorEsperadoDinheiro = Number((saldoInicial || 0)) + totais.dinheiro - totalSaidas

        return { ...totais, totalEntradas, totalGeral, valorEsperadoDinheiro, totalSaidas }
    }, [vendasHoje, saldoInicial, saidasDoDia, pagamentosCadernetaHoje])

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
    const [valorRecebido, setValorRecebido] = useState('')
    const [modalDetalhes, setModalDetalhes] = useState(false)
    const [modalPosVenda, setModalPosVenda] = useState(false)
    // Confirmação quando venda em caderneta deixará cliente com saldo negativo
    const [modalConfirmCaderneta, setModalConfirmCaderneta] = useState(false)
    const [confirmCadernetaInfo, setConfirmCadernetaInfo] = useState<{
        clienteNome?: string | null
        limiteDisponivel?: number
        valorCompra?: number
        saldoApos?: number
    } | null>(null)
    const [pendingFormaPagamento, setPendingFormaPagamento] = useState<string | null>(null)
    const [lastVendaId, setLastVendaId] = useState<number | null>(null)
    const [itensVendaSelecionada, setItensVendaSelecionada] = useState<any[]>([])
    const [vendaSelecionadaId, setVendaSelecionadaId] = useState<number | null>(null)
    const [vendaClienteNome, setVendaClienteNome] = useState<string | null>(null)
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
    const [modalScanner, setModalScanner] = useState(false)
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

    // Abre o modal pós-venda com um delay (padronizado em 2000ms)
    const abrirModalPosVendaComDelay = (delay = 2000) => {
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

    // refs para evitar re-subscription e ler valores atuais
    const carregarVendasHojeRef = useRef<any>(null)
    const caixaDiarioIdRef = useRef<number | null>(null)
    const caixaDiaISORef = useRef<string | null>(null)
    // Timeout ref usado para debouncing de recarga de vendas ao receber eventos realtime
    const refreshVendasTimeoutRef = useRef<number | null>(null)

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
                // Buscar pagamentos registrados no fluxo_caixa como 'caderneta' para essa sessão de caixa
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
            console.error('Erro ao carregar vendas do caixa:', err)
            setVendasHoje([])
        }
    }

    async function carregarSaidasDoDia(caixaId?: number | null) {
        try {
            const idToUse = caixaId || caixaDiarioId
            if (!idToUse) {
                setSaidasDoDia([])
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
            console.error('Erro ao carregar saídas do dia:', e)
            setSaidasDoDia([])
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
        })()

        return () => clearInterval(timer)
    }, [])

    // Quando a aba do navegador volta a ficar visível ou a janela ganha foco,
    // recarrega produtos, vendas e restaura estado do caixa. Agora garante
    // que, ao retornar, a interface tente abrir diretamente a view de `venda`
    // (restaurarCaixaAberto respeita a view 'caderneta' para não sobrescrever).
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

    // Ao trocar a view interna para 'venda' ou 'historico', garante refresh imediato dos dados.
    useEffect(() => {
        if (view === 'venda' || view === 'historico') {
            carregarProdutos()
            carregarVendasHoje(caixaDiarioId)
        }
    }, [view, caixaDiarioId])

    // Ao abrir a view 'saida' ou 'caixa' (aba principal do caixa),
    // recarrega as saídas do dia para garantir que o total exibido
    // esteja sempre atualizado mesmo se o usuário não acessar a aba 'Saída'.
    useEffect(() => {
        if (view === 'saida' || view === 'caixa') {
            carregarSaidasDoDia(caixaDiarioId)
        }
    }, [view, caixaDiarioId])

    // --- Integração com Supabase (Dados Reais) ---

    // Carrega produtos do estoque de varejo (mesma lógica da pág. código de barras)
    async function carregarProdutos() {
        try {
            const { data, error } = await getSupabase()
                .from('varejo')
                .select('*')
                .eq('ativo', true)

            if (error) throw error

            const produtosFormatados: Produto[] = data.map((item: any) => ({
                id: item.id,
                codigoBarras: item.codigo_barras || '',
                nome: item.nome,
                preco: item.preco_venda || 0,
                estoque: item.estoque_atual || 0,
                unidade: item.unidade || 'un'
            }))

            setProdutos(produtosFormatados)
        } catch (error) {
            console.error('Erro ao carregar produtos:', error)
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
                    if (novaQtd > item.estoque) {
                        showToast('Estoque limite atingido', 'warning')
                        return item
                    }
                    return { ...item, qtdCarrinho: novaQtd }
                }
                return item
            }).filter(Boolean) as ItemCarrinho[]
        })
    }

    // Adiciona via código de barras (busca local e, se faltar, no Supabase)
    const adicionarPorCodigo = async (codigoBruto: string) => {
        const normaliza = (s: string) => s.replace(/\D/g, '')
        const code = (codigoBruto || '').trim()
        const codeNum = normaliza(code)

        // 1) Busca nos itens já carregados
        let encontrado = produtos.find(p => {
            const a = (p.codigoBarras || '').trim()
            return a === code || normaliza(a) === codeNum
        })
        if (encontrado) {
            adicionarAoCarrinho(encontrado)
            return true
        }

        // 2) Consulta Supabase para produção (dados sempre atualizados)
        try {
            const { data, error } = await getSupabase()
                .from('varejo')
                .select('*')
                .or(`codigo_barras.eq.${code},codigo_barras.eq.${codeNum}`)
                .limit(1)

            if (error) throw error
            const item = data?.[0]
            if (!item) return false

            const prod: Produto = {
                id: item.id,
                codigoBarras: item.codigo_barras || '',
                nome: item.nome,
                preco: item.preco_venda || 0,
                estoque: item.estoque_atual || 0,
                unidade: item.unidade || 'un',
            }
            // Cache local
            setProdutos(prev => (prev.some(p => p.id === prod.id) ? prev : [...prev, prod]))
            adicionarAoCarrinho(prod)
            return true
        } catch (e) {
            console.error('Erro buscando por código no Supabase:', e)
            return false
        }
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
            w.print()
            return true
        } catch (err) {
            console.error('printReceipt erro:', err)
            throw err
        }
    }

    const finalizarVenda = async (formaPagamento: string, opts?: { skipCadernetaConfirm?: boolean }) => {
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
        if (formaPagamento === 'caderneta' && clienteCadernetaSelecionado && !opts?.skipCadernetaConfirm) {
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
                    setConfirmCadernetaInfo({
                        clienteNome: clienteInfo?.nome || null,
                        limiteDisponivel: limiteDisponivel,
                        valorCompra: valorTotal,
                        saldoApos: saldoApos
                    })
                    setPendingFormaPagamento(formaPagamento)
                    setModalConfirmCaderneta(true)
                    setLoading(false)
                    return
                }
            } catch (e) {
                console.error('Erro ao validar saldo do cliente:', e)
                // Se falhar ao buscar cliente, deixa seguir para tentar registrar (modo conservador)
            }
        }

        try {
            // 1. Registrar Venda na tabela 'vendas'
            const { data: vendaData, error: vendaError } = await getSupabase()
                .from('vendas')
                .insert<any>({
                    numero_venda: Date.now(), // Gera um número único (ms). Requer coluna BIGINT no banco.
                    // Grava a data local no formato YYYY-MM-DD para compatibilidade
                    // com consultas que filtram por `data` (coluna DATE) usando hora local.
                    data: (() => {
                        const _d = new Date()
                        const y = _d.getFullYear()
                        const m = String(_d.getMonth() + 1).padStart(2, '0')
                        const day = String(_d.getDate()).padStart(2, '0')
                        return `${y}-${m}-${day}`
                    })(),
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

            // 3. Baixa no Estoque (Atualiza 'varejo')
            for (const item of carrinho) {
                const novoEstoque = item.estoque - item.qtdCarrinho
                await getSupabase()
                    .from('varejo')
                    .update<Database['public']['Tables']['varejo']['Update']>({ estoque_atual: novoEstoque })
                    .eq('id', item.id)
            }

            // Sucesso: notificar. Agendaremos o modal de impressão APENAS se todas as
            // etapas de pós-processamento (caderneta, caixa, fluxo) ocorrerem sem erros.
            showToast('Venda realizada com sucesso!', 'success')
            setLastVendaId(vendaData.id)

            // Flag que indica se houve algum problema no pós-processamento
            let postSaleIssue = false

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
                                observacoes: `Venda a prazo registrada no PDV (venda #${vendaData.id})`,
                                allowExceedLimit: !!opts?.skipCadernetaConfirm
                            })

                            if (!res.success) {
                                console.error('Falha ao registrar compra na caderneta (DB):', res)
                                postSaleIssue = true
                                alert('Erro ao registrar compra na caderneta: ' + (res.message || 'Verifique o console'))
                            } else {
                                try { refreshClientes(); refreshMovimentacoes(); } catch (e) { console.error(e) }
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

            // Atualiza dados locais (usando refreshAll para atualizar produtos, vendas e caixa)
            try {
                await refreshAll({ changeView: false })
            } catch (e) {
                console.error('Erro ao atualizar dados após venda:', e)
                postSaleIssue = true
            }

            // Somente se não houver problemas no pós-processamento, abrimos o modal de impressão
            if (!postSaleIssue) {
                abrirModalPosVendaComDelay(2000)
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
            // Primeiro, traz informações da venda para saber a forma de pagamento
            setVendaClienteNome(null)
            const { data: vendaRow, error: vendaRowErr } = await getSupabase()
                .from('vendas')
                .select('forma_pagamento, cliente_caderneta_id')
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
        if (modalCaderneta) return setModalCaderneta(false)
        if (modalDetalhes) return setModalDetalhes(false)
        if (modalFechamento) return setModalFechamento(false)
        if (modalScanner) { fecharScanner(); return }
    }

    const confirmarPagamentoAtivo = () => {
        if (modalPagamento) return handlePagamentoDinheiro()
        if (modalDebito) return finalizarVenda('debito')
        if (modalCredito) return finalizarVenda('credito')
        if (modalPix) return finalizarVenda('pix')
        if (modalCaderneta) return finalizarVenda('caderneta')
    }

    // Handlers para modal de confirmação de venda em caderneta que excede limite
    const handleConfirmarCadernetaSim = async () => {
        try {
            setModalConfirmCaderneta(false)
            const forma = pendingFormaPagamento || 'caderneta'
            setPendingFormaPagamento(null)
            // Reexecuta finalizarVenda permitindo exceder limite (skip confirm)
            await finalizarVenda(forma, { skipCadernetaConfirm: true })
        } catch (e) {
            console.error('Erro ao confirmar venda fiada:', e)
            showToast('Erro ao processar venda fiada', 'error')
        }
    }

    const handleConfirmarCadernetaNao = () => {
        setModalConfirmCaderneta(false)
        setConfirmCadernetaInfo(null)
        setPendingFormaPagamento(null)
        showToast('Venda cancelada', 'info')
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
                // Monta o payload para update do caixa_diario
                const ajusteDinheiroCents = parseCurrencyBRToCents(confDinheiro) || 0
                const ajustePixCents = parseCurrencyBRToCents(confPix) || 0
                const ajusteDebitoCents = parseCurrencyBRToCents(confDebito) || 0
                const ajusteCreditoCents = parseCurrencyBRToCents(confCredito) || 0
                const totalDinheiroCorrigidoCents = ajusteDinheiroCents
                const totalPixCorrigidoCents = ajustePixCents
                const totalDebitoCorrigidoCents = ajusteDebitoCents
                const totalCreditoCorrigidoCents = ajusteCreditoCents
                const totalCorrigidoCents = totalDinheiroCorrigidoCents + totalPixCorrigidoCents + totalDebitoCorrigidoCents + totalCreditoCorrigidoCents
                const metricasTotalEntradasCents = Math.round((metricasCaixa.totalEntradas || 0) * 100)
                const diferencaCents = totalCorrigidoCents - metricasTotalEntradasCents
                const payload = {
                    data: getLocalDateString(),
                    status: 'fechado',
                    valor_abertura: Number((saldoInicial || 0)),
                    valor_fechamento: Number((totalCorrigidoCents / 100).toFixed(2)),
                    
                    // Totais esperados pelo sistema (baseados nas vendas registradas)
                    total_entradas: Number((metricasTotalEntradasCents / 100).toFixed(2)),
                    total_vendas: Number((metricasCaixa.totalGeral || 0).toFixed(2)),
                    total_caderneta: Number((metricasCaixa.caderneta || 0).toFixed(2)),
                    total_dinheiro: Number((metricasCaixa.dinheiro || 0).toFixed(2)),
                    total_pix: Number((metricasCaixa.pix || 0).toFixed(2)),
                    total_debito: Number((metricasCaixa.debito || 0).toFixed(2)),
                    total_credito: Number((metricasCaixa.credito || 0).toFixed(2)),
                    
                    // Valores informados pelo funcionário na conferência
                    valor_dinheiro_informado: Number((totalDinheiroCorrigidoCents / 100).toFixed(2)),
                    valor_pix_informado: Number((totalPixCorrigidoCents / 100).toFixed(2)),
                    valor_debito_informado: Number((totalDebitoCorrigidoCents / 100).toFixed(2)),
                    valor_credito_informado: Number((totalCreditoCorrigidoCents / 100).toFixed(2)),
                    
                    // Diferenças calculadas
                    diferenca: Number((diferencaCents / 100).toFixed(2)),
                    diferenca_dinheiro: Number(((ajusteDinheiroCents - Math.round((metricasCaixa.dinheiro || 0) * 100)) / 100).toFixed(2)),
                    diferenca_pix: Number(((ajustePixCents - Math.round((metricasCaixa.pix || 0) * 100)) / 100).toFixed(2)),
                    diferenca_debito: Number(((ajusteDebitoCents - Math.round((metricasCaixa.debito || 0) * 100)) / 100).toFixed(2)),
                    diferenca_credito: Number(((ajusteCreditoCents - Math.round((metricasCaixa.credito || 0) * 100)) / 100).toFixed(2)),
                    
                    // Saídas e Usuário
                    valor_saidas: Number(totalSaidasDoDia || 0),
                    total_saidas: Number(totalSaidasDoDia || 0),
                    usuario_fechamento: operador || null,
                    data_fechamento: new Date().toISOString()
                }
        try {
            const dataISO = getLocalDateString()
            // Fecha a interface do PDV imediatamente (optimistic UI)
            setModalFechamentoConfirm(false)
            setModalFechamento(false)
            setCaixaAberto(false)
            setView('abertura')
            setOperador('')
            setCarrinho([])
            setVendasHoje([])
            setCaixaDiarioId(null)
            setDataHoje('')
            setHoraAbertura('')
            showToast('Processando fechamento do caixa...', 'info')

            if (!caixaDiarioId) {
                showToast('Erro: ID do caixa não encontrado.', 'error')
                return
            }

            // 1. Fecha o caixa atual no banco
            const { error: upErr } = await getSupabase()
                .from('caixa_diario')
                .update<Database['public']['Tables']['caixa_diario']['Update']>({
                    ...payload,
                    status: 'fechado'
                })
                .eq('id', caixaDiarioId)
                .eq('status', 'aberto') // Segurança extra: só atualiza se ainda estiver aberto

            if (upErr) {
                showToast('Erro ao fechar o caixa no banco.', 'error')
                console.error('Erro ao fechar caixa:', upErr)
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

                    const audit = {
                        total_vendas: vendasTurno.reduce((acc, v) => acc + v.total, 0),
                        total_dinheiro: vendasTurno.filter(v => v.forma_pagamento.toLowerCase().includes('dinheiro')).reduce((acc, v) => acc + v.total, 0),
                        total_pix: vendasTurno.filter(v => v.forma_pagamento.toLowerCase().includes('pix')).reduce((acc, v) => acc + v.total, 0),
                        total_debito: vendasTurno.filter(v => v.forma_pagamento.toLowerCase().includes('debito')).reduce((acc, v) => acc + v.total, 0),
                        total_credito: vendasTurno.filter(v => v.forma_pagamento.toLowerCase().includes('credito')).reduce((acc, v) => acc + v.total, 0),
                        total_caderneta: vendasTurno.filter(v => v.forma_pagamento.toLowerCase().includes('caderneta')).reduce((acc, v) => acc + v.total, 0),
                        valor_fechamento: totalCorrigido
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

            // Navegação entre abas (sempre disponível)
            if (key === 'F1') { e.preventDefault(); if (caixaAberto) setView('venda'); return }
            if (key === 'F2') { e.preventDefault(); if (caixaAberto) setView('historico'); return }
            if (key === 'F3') { e.preventDefault(); if (caixaAberto) setView('estoque'); return }
            if (key === 'F4') { e.preventDefault(); if (caixaAberto) setView('caixa'); return }
            // Atalho para Caderneta: usa F11 se disponível (não conflita com outros atalhos atuais)
            if (key === 'F11') { e.preventDefault(); if (caixaAberto) setView('caderneta'); return }

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

            // Atalhos numéricos 1..4 (não dentro de input)
            if (!targetIsInput) {
                if (key === '1') { if (temCarrinho) setModalPagamento(true); return }
                if (key === '2') { if (temCarrinho) setModalDebito(true); return }
                if (key === '3') { if (temCarrinho) setModalCredito(true); return }
                if (key === '4') { if (temCarrinho) setModalPix(true); return }
            }

            // Confirmar pagamento quando um modal está aberto (Enter)
            if (key === 'Enter' && (modalPagamento || modalDebito || modalCredito || modalPix || modalCaderneta)) {
                e.preventDefault()
                confirmarPagamentoAtivo()
                return
            }

            // Enter fora de modais: adiciona 1º item sugerido ou abre dinheiro
            if (key === 'Enter' && !(modalPagamento || modalDebito || modalCredito || modalPix || modalCaderneta)) {
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

            // Ajustes rápidos do carrinho quando não digitando em input
            if (!targetIsInput && !(modalPagamento || modalDebito || modalCredito || modalPix)) {
                if (key === '+' || code === 'NumpadAdd') { e.preventDefault(); ajustarUltimoItem(1); return }
                if (key === '-' || code === 'NumpadSubtract') { e.preventDefault(); ajustarUltimoItem(-1); return }
                if (key === 'Delete') { e.preventDefault(); removerUltimoItem(); return }
                if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'l') { e.preventDefault(); setCarrinho([]); return }
            }
        }

        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
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
            setScannerAtivo(false)
            if (codeReaderRef.current) {
                try { typeof codeReaderRef.current.stopContinuousDecode === 'function' && codeReaderRef.current.stopContinuousDecode() } catch { }
                try { typeof codeReaderRef.current.reset === 'function' && codeReaderRef.current.reset() } catch { }
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
                if (!scannerAtivo) return
                try {
                    // @ts-ignore
                    const bitmap = await createImageBitmap(video)
                    const det = detectorRef.current
                    if (!det) { requestAnimationFrame(loop); return }
                    const res = await det.detect(bitmap)
                    if (res && res.length > 0) {
                        const raw = res[0].rawValue || ''
                        if (raw && Date.now() - scanningLockRef.current > 800) {
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
            await reader.decodeFromVideoDevice(deviceId || undefined, videoRef.current!, async (result: any) => {
                if (result) {
                    const text = result.getText()
                    if (text && Date.now() - scanningLockRef.current > 800) {
                        scanningLockRef.current = Date.now()
                        setUltimoCodigo(text)
                        const ok = await adicionarPorCodigo(text)
                        if (ok) {
                            await tocarBeep()
                        } else {
                            setScannerErro('Código não encontrado no estoque.')
                        }
                    }
                }
            })
            return true
        } catch (e) {
            console.error('Falha ao iniciar ZXing:', e)
            return false
        }
    }

    const iniciarScanner = async (device: string | null) => {
        setScannerErro('')
        setUltimoCodigo('')
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
                await iniciarScannerZXing(device)
            }
        } catch (e: any) {
            console.error('Erro ao iniciar scanner:', e)
            setScannerErro('Não foi possível acessar a câmera. Verifique permissões e HTTPS.')
            setScannerAtivo(false)
        }
    }

    const abrirScanner = async () => {
        setModalScanner(true)
        await listarCameras()
        setTimeout(() => iniciarScanner(cameraId), 100)
    }

    const fecharScanner = () => {
        pararScanner()
        setModalScanner(false)
    }

    const abrirCaderneta = async () => {
        try {
            if (typeof refreshClientes === 'function') await refreshClientes()
            if (typeof refreshMovimentacoes === 'function') await refreshMovimentacoes()
            if (clientes && clientes.length > 0) {
                setClienteCadernetaSelecionado(String(clientes[0].id))
            } else {
                setClienteCadernetaSelecionado('')
            }
            // Abre a view de caderneta no layout do PDV (espelho da página de gestão)
            setView('caderneta')
        } catch (e) {
            console.warn('Falha ao abrir caderneta:', e)
            setView('caderneta')
        }
    }

    // Fecha scanner ao desmontar (garantia extra)
    useEffect(() => {
        return () => {
            pararScanner()
        }
    }, [])

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
            {modalConfirmCaderneta && confirmCadernetaInfo && (
                <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
                    <div className="absolute inset-0 bg-black opacity-50" onClick={handleConfirmarCadernetaNao} style={{ zIndex: 9998 }} />
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg" style={{ zIndex: 9999 }}>
                        <h3 className="text-lg font-bold mb-2">Confirmar venda fiada</h3>
                        <p className="mb-2">Cliente: <strong>{confirmCadernetaInfo.clienteNome ?? '—'}</strong></p>
                        <p className="mb-2">Limite disponível: <strong>R$ {Number(confirmCadernetaInfo.limiteDisponivel ?? 0).toFixed(2)}</strong></p>
                        <p className="mb-2">Valor da compra: <strong>R$ {Number(confirmCadernetaInfo.valorCompra ?? 0).toFixed(2)}</strong></p>
                        <p className="mb-4">Saldo após a venda: <strong>{(confirmCadernetaInfo.saldoApos ?? 0) < 0 ? `-R$ ${Math.abs(confirmCadernetaInfo.saldoApos ?? 0).toFixed(2)}` : `R$ ${Number(confirmCadernetaInfo.saldoApos ?? 0).toFixed(2)}`}</strong></p>
                        <p className="mb-4">Este cliente ficará com saldo devedor negativo. Deseja confirmar a venda?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={handleConfirmarCadernetaNao} className="px-3 py-2 bg-gray-200 rounded">Não</button>
                            <button onClick={handleConfirmarCadernetaSim} className="px-3 py-2 bg-blue-600 text-white rounded">Sim</button>
                        </div>
                    </div>
                </div>
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
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition uppercase ${view === 'venda' ? 'bg-blue-800' : 'hover:bg-blue-700'}`}
                                >
                                    Vendas (F1)
                                </button>
                                <button
                                    onClick={() => setView('historico')}
                                    title="Ir para Relatórios (F2)"
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition uppercase ${view === 'historico' ? 'bg-blue-800' : 'hover:bg-blue-700'}`}
                                >
                                    Relatórios (F2)
                                </button>
                                <button
                                    onClick={() => setView('estoque')}
                                    title="Ir para Estoque (F3)"
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition uppercase ${view === 'estoque' ? 'bg-blue-800' : 'hover:bg-blue-700'}`}
                                >
                                    Estoque (F3)
                                </button>
                                <button
                                    onClick={() => setView('caixa')}
                                    title="Ir para Caixa (F4)"
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition uppercase ${view === 'caixa' ? 'bg-blue-800' : 'hover:bg-blue-700'}`}
                                >
                                    Caixa (F4)
                                </button>
                                <button
                                    onClick={() => setView('caderneta')}
                                    title="Ir para Caderneta (F11)"
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition uppercase ${view === 'caderneta' ? 'bg-blue-800' : 'hover:bg-blue-700'}`}
                                >
                                    Caderneta (F11)
                                </button>
                                <button
                                    onClick={() => setView('saida')}
                                    title="Ir para Saída (F10)"
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition uppercase ${view === 'saida' ? 'bg-yellow-600 text-white' : 'hover:bg-yellow-500'}`}
                                >
                                    Saída (F10)
                                </button>
                            </nav>
                        )}
                        {caixaAberto && (
                            <button
                                onClick={() => setMostrarAtalhos((v) => !v)}
                                title="Mostrar/ocultar atalhos"
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-800 hover:bg-blue-700"
                            >
                                Atalhos
                            </button>
                        )}
                        <div className="flex items-center gap-3">
                            <div className="font-mono text-lg bg-blue-800 px-4 py-1 rounded-full shadow-inner">
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
                    {/* FAIXA DE ATALHOS */}
                    {caixaAberto && mostrarAtalhos && (
                        <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded-xl text-[10px] text-gray-700 font-bold flex flex-wrap gap-x-4 gap-y-1">
                            <span className="uppercase text-blue-700">Atalhos:</span>
                            <span>F1–F4: Vendas/Relatórios/Estoque/Caixa</span>
                            {/* Caderneta removida dos atalhos */}
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
                        <div className="flex-1 flex flex-col lg:flex-row gap-2 overflow-auto">
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
                                            onClick={async () => abrirScanner()}
                                            className="px-6 bg-blue-100 text-blue-700 rounded-2xl hover:bg-blue-200 transition font-black text-xs uppercase border border-blue-200 flex items-center gap-2"
                                            title="Abrir Scanner da Câmera"
                                        >
                                            <Camera className="h-4 w-4" />
                                            Scanner
                                        </button>
                                    </div>
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
                                                        R$ {item.preco.toFixed(2)}
                                                    </div>
                                                    <div className="w-32 flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => alterarQtd(item.id, -1)}
                                                            className="w-8 h-8 bg-blue-50 rounded-xl text-blue-600 flex items-center justify-center hover:bg-blue-100"
                                                        >
                                                            <Minus className="h-4 w-4" />
                                                        </button>
                                                        <span className="font-black text-sm text-gray-700 w-8 text-center">{item.qtdCarrinho}</span>
                                                        <button
                                                            onClick={() => alterarQtd(item.id, 1)}
                                                            className="w-8 h-8 bg-blue-50 rounded-xl text-blue-600 flex items-center justify-center hover:bg-blue-100"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </button>
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
                                            onClick={() => setCarrinho([])}
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
                        <div className="h-full bg-white rounded-2xl shadow-sm border border-blue-100 p-6 overflow-y-auto">
                            <h2 className="text-2xl font-black mb-6 uppercase text-gray-800 italic border-l-8 border-blue-500 pl-4">
                                Estoque Atual
                            </h2>
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
                    )}

                    {/* TELA DE CADERNETA (aba incorporada) */}
                    {caixaAberto && view === 'caderneta' && (
                        <div className="h-full bg-white rounded-2xl shadow-sm border border-blue-100 p-2 overflow-hidden">
                            <iframe
                                src="/gestao/caderneta?embedded=1"
                                title="Caderneta - Gestão (Espelho)"
                                className="w-full h-full border-0"
                                style={{ minHeight: '600px' }}
                            />
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

                </main>

                {/* --- MODAIS --- */}

                {/* Modal Scanner */}
                {modalScanner && (
                    <div className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border-4 border-blue-500 overflow-hidden">
                            <div className="p-4 flex items-center justify-between bg-blue-50 border-b border-blue-100">
                                <div>
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Scanner</span>
                                    <h3 className="text-xl font-black text-gray-800">Ler Código de Barras</h3>
                                </div>
                                <button onClick={fecharScanner} className="text-gray-400 hover:text-red-500" title="Fechar (Esc)">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="p-4 space-y-3">
                                <div className="flex gap-2 items-center">
                                    <select
                                        className="flex-1 p-2 border-2 border-blue-100 rounded-xl text-sm"
                                        value={cameraId || ''}
                                        onChange={(e) => {
                                            const id = e.target.value
                                            setCameraId(id)
                                            if (scannerAtivo) {
                                                pararScanner()
                                                setTimeout(() => iniciarScanner(id), 100)
                                            }
                                        }}
                                    >
                                        {cameras.length === 0 && <option>Sem câmeras</option>}
                                        {cameras.map((c, i) => (
                                            <option key={c.deviceId || i} value={c.deviceId}>
                                                {c.label || `Câmera ${i + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => { pararScanner(); iniciarScanner(cameraId) }}
                                        className="px-3 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs"
                                    >
                                        Reiniciar
                                    </button>
                                </div>

                                <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                                    {ultimoCodigo && (
                                        <div className="absolute bottom-2 left-2 right-2 bg-white/80 rounded-lg px-3 py-1 text-xs font-bold text-gray-800">
                                            Último código: {ultimoCodigo}
                                        </div>
                                    )}
                                </div>

                                {scannerErro && (
                                    <div className="text-red-600 text-xs font-bold">{scannerErro}</div>
                                )}

                                <div className="flex gap-2 justify-end pt-2">
                                    <button
                                        onClick={fecharScanner}
                                        className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-bold text-gray-600"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Pagamento Dinheiro */}
                {modalPagamento && (
                    <div className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
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
                    <div className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
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
                    <div className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
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
                    <div className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
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
                                        onChange={(e) => setClienteCadernetaSelecionado(e.target.value)}
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
                                            onChange={(e) => setValorAbaterCaderneta(e.target.value)}
                                            placeholder={totalComDesconto.toFixed(2)}
                                            className="w-full p-3 border-2 border-blue-50 rounded-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-300 bg-blue-50/20"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => finalizarVenda('caderneta')}
                                        disabled={loading || !clienteCadernetaSelecionado || (parseFloat(String(valorAbaterCaderneta).replace(',', '.')) || 0) <= 0}
                                        className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        {loading ? 'Processando...' : 'Confirmar'}
                                    </button>
                                    <button onClick={() => setModalCaderneta(false)} className="w-full text-blue-400 font-bold text-xs uppercase py-2">Voltar</button>
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
                                    <h2 className="text-xl font-black text-gray-800 uppercase italic">Venda realizada com sucesso!</h2>
                                </div>
                                <button onClick={() => { setModalPosVenda(false); }} className="text-gray-400 hover:text-red-500">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <p className="text-gray-600 mb-6">Deseja imprimir o recibo agora?</p>

                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        try {
                                            setModalPosVenda(false)
                                            if (!lastVendaId) {
                                                showToast('Venda não encontrada para impressão.', 'error')
                                                return
                                            }
                                            showToast('Iniciando impressão do recibo...', 'success')
                                            await printReceipt(lastVendaId, 1)
                                        } catch (e) {
                                            console.error('Erro ao imprimir recibo:', e)
                                            showToast('Falha ao iniciar impressão.', 'error')
                                        }
                                    }}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase"
                                >
                                    Sim
                                </button>
                                <button
                                    onClick={() => {
                                        setModalPosVenda(false)
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