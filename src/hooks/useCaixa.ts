import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { CaixaDiario } from '@/lib/supabase'
import type { Database } from '@/lib/supabase/types'
import { toCaixaDiario } from '@/lib/converters'
import { obterDataLocal } from '@/lib/dateUtils'
import { useOnlineStatus } from './useOnlineStatus'
import { offlineStorage } from '@/lib/offlineStorage'
import toast from 'react-hot-toast'

export function useCaixa() {
  const [caixaHoje, setCaixaHoje] = useState<CaixaDiario | null>(null)
  const [loading, setLoading] = useState(true)
  const { isOnline } = useOnlineStatus()

  const carregarCaixaHoje = useCallback(async () => {
    try {
      const hoje = obterDataLocal()
      console.log('🔍 Carregando caixa - Status online:', isOnline)
      toast.dismiss()

      if (isOnline) {
        // Busca TODOS os caixas abertos para detectar inconsistências
        const { data: openCaixas, error } = await supabase
          .from('caixa_diario')
          .select('*')
          .eq('status', 'aberto')
          .order('created_at', { ascending: false })

        if (error) throw error

        if (!openCaixas || openCaixas.length === 0) {
          setCaixaHoje(null)
          return
        }

        // Se houver múltiplos abertos, fecha os antigos (limpeza)
        let activeCaixa = openCaixas[0]
        if (openCaixas.length > 1) {
          const idsParaFechar = openCaixas.slice(1).map(c => c.id)
          await supabase
            .from('caixa_diario')
            .update({ status: 'fechado', observacoes_fechamento: 'Limpeza automática: múltiplos caixas abertos' })
            .in('id', idsParaFechar)
        }

        const data = activeCaixa;
        // ... resto da lógica original de cálculo de saídas e cache
        try {
          // Calcular saídas vinculadas a este caixa específico
          const { data: saidasData } = await supabase
            .from('fluxo_caixa')
            .select('valor')
            .eq('caixa_diario_id', data.id)
            .eq('tipo', 'saida')

          const totalSaidas = (saidasData || []).reduce((sum, r) => sum + (Number(r.valor) || 0), 0)

          const { error: updateErr } = await supabase
            .from('caixa_diario')
            .update<Database['public']['Tables']['caixa_diario']['Update']>({ valor_saidas: totalSaidas })
            .eq('id', data.id)

          if (updateErr) {
            console.warn('Erro ao atualizar valor_saidas do caixa:', updateErr)
          }

          const caixaCompleto = { ...data, valor_saidas: totalSaidas }
          const caixaCompletoCorrigido = {
            ...caixaCompleto,
            data_abertura: caixaCompleto.data_abertura ?? ''
          }
          setCaixaHoje(toCaixaDiario(caixaCompletoCorrigido))

          // Salvar no cache offline
          try {
            await offlineStorage.init()
            await offlineStorage.saveOfflineData('caixa_hoje', caixaCompleto)
          } catch (cacheError) {
            console.warn('⚠️ Erro ao salvar no cache offline:', cacheError)
          }
        } catch (e) {
          console.warn('Não foi possível calcular saídas do dia:', e)
          setCaixaHoje(toCaixaDiario(data))
        }
      } else {
        // Offline: usar dados do cache
        console.log('📱 Modo offline - carregando dados do cache')
        toast.dismiss()
        toast('Modo offline - carregando dados do cache', { icon: '📱' })
        try {
          await offlineStorage.init()
          const offlineData = await offlineStorage.getOfflineData('caixa_hoje')
          console.log('📱 Dados offline do caixa:', offlineData)
          toast.dismiss()
          toast.success('Dados offline carregados')
          const caixaFromOffline = Array.isArray(offlineData) ? offlineData[0] : offlineData
          if (caixaFromOffline && typeof caixaFromOffline === 'object') {
            setCaixaHoje(toCaixaDiario(caixaFromOffline))
          } else {
            setCaixaHoje(null)
          }
        } catch (offlineError) {
          console.error('❌ Erro ao acessar cache offline:', offlineError)
          toast.error('Erro ao acessar cache offline')
          setCaixaHoje(null)
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar caixa:', error)
      console.error('📊 Detalhes do erro:', JSON.stringify(error, null, 2))
      toast.dismiss()
      toast.error('Erro ao carregar caixa')

      // Em caso de erro, tentar usar dados offline
      try {
        console.log('🔄 Tentando carregar dados offline...')
        toast('Tentando carregar dados offline...', { icon: '🔄' })
        await offlineStorage.init()
        const offlineData = await offlineStorage.getOfflineData('caixa_hoje')
        console.log('📱 Dados offline encontrados:', offlineData)
        const caixaFromOffline = Array.isArray(offlineData) ? offlineData[0] : offlineData
        if (caixaFromOffline && typeof caixaFromOffline === 'object') {
          setCaixaHoje(toCaixaDiario(caixaFromOffline))
          toast.success('Dados offline carregados')
        } else {
          setCaixaHoje(null)
          toast('Nenhum dado offline disponível')
        }
      } catch (offlineError) {
        console.error('❌ Erro ao carregar caixa offline:', offlineError)
        toast.error('Erro ao carregar caixa offline')
        setCaixaHoje(null)
      }
    } finally {
      setLoading(false)
    }
  }, [isOnline])

  const abrirCaixa = useCallback(async (valorAbertura: number, observacoes?: string) => {
    try {
      const hoje = obterDataLocal()

      // Validação: impedir abertura se JÁ houver um caixa aberto (independente da data)
      try {
        const { data: existing, error: selErr } = await supabase
          .from('caixa_diario')
          .select('id, status')
          .eq('status', 'aberto')
          .limit(1)
          .maybeSingle()

        if (!selErr && existing && existing.status === 'aberto') {
          toast.dismiss()
          toast.error('Já existe um caixa aberto no sistema.')
          return false
        }
      } catch (checkErr) {
        console.warn('Falha ao verificar caixa existente antes de abrir:', checkErr)
      }

      const dadosCaixa = {
        data: hoje,
        status: 'aberto',
        valor_abertura: valorAbertura,
        observacoes_abertura: observacoes || '',
        usuario_abertura: 'Sistema'
      }

      if (isOnline) {
        // Online: inserir no Supabase
        const { error } = await supabase
          .from('caixa_diario')
          .insert<Database['public']['Tables']['caixa_diario']['Insert']>(dadosCaixa)

        if (error) throw error
      } else {
        // Offline: adicionar à fila de sincronização
        await offlineStorage.addPendingOperation({
          type: 'INSERT',
          table: 'caixa_diario',
          data: dadosCaixa
        })
      }

      await carregarCaixaHoje()
      toast.success('Caixa aberto com sucesso')
      return true
    } catch (error) {
      console.error('Erro ao abrir caixa:', error)
      toast.error('Erro ao abrir caixa')
      throw error
    }
  }, [carregarCaixaHoje, isOnline])

  const fecharCaixa = useCallback(async (dadosFechamento: {
    valor_final: string
    valor_saidas: string
    valor_dinheiro_informado: string
    valor_pix_informado: string
    valor_debito_informado: string
    valor_credito_informado: string
    observacoes_fechamento: string
  }) => {
    try {
      if (!caixaHoje) throw new Error('Nenhum caixa aberto encontrado')

      // Impedir fechamento múltiplo: se já estiver fechado, não permitir novo fechamento
      if ((caixaHoje as any).status === 'fechado') {
        toast.error('Este caixa já foi fechado. Fechamento permitido apenas uma vez por dia.')
        return false
      }

      const dadosUpdate = {
        status: 'fechado',
        valor_fechamento: parseFloat(dadosFechamento.valor_final),
        valor_saidas: parseFloat(dadosFechamento.valor_saidas),
        valor_dinheiro_informado: parseFloat(dadosFechamento.valor_dinheiro_informado),
        valor_pix_informado: parseFloat(dadosFechamento.valor_pix_informado),
        valor_debito_informado: parseFloat(dadosFechamento.valor_debito_informado),
        valor_credito_informado: parseFloat(dadosFechamento.valor_credito_informado),
        observacoes_fechamento: dadosFechamento.observacoes_fechamento,
        usuario_fechamento: 'Sistema',
        data_fechamento: new Date().toISOString()
      }

      if (isOnline) {
        // Online: atualizar no Supabase
        const { error } = await supabase
          .from('caixa_diario')
          .update<Database['public']['Tables']['caixa_diario']['Update']>(dadosUpdate)
          .eq('id', caixaHoje.id)

        if (error) throw error
      } else {
        // Offline: adicionar à fila de sincronização
        await offlineStorage.addPendingOperation({
          type: 'UPDATE',
          table: 'caixa_diario',
          data: { ...dadosUpdate, id: caixaHoje.id }
        })
      }

      await carregarCaixaHoje()
      toast.success('Caixa fechado com sucesso')
      return true
    } catch (error) {
      console.error('Erro ao fechar caixa:', error)
      toast.error('Erro ao fechar caixa')
      throw error
    }
  }, [caixaHoje, carregarCaixaHoje, isOnline])

  const registrarSaida = useCallback(async (valor: number, descricao: string) => {
    try {
      const hoje = obterDataLocal()
      const dadosSaida = {
        data: hoje,
        tipo: 'saida',
        categoria: 'caixa',
        descricao: descricao,
        valor: valor
      }

      if (isOnline) {
        // Online: inserir no Supabase
        const { error } = await supabase
          .from('fluxo_caixa')
          .insert(dadosSaida)

        if (error) throw error
      } else {
        // Offline: adicionar à fila de sincronização
        await offlineStorage.addPendingOperation({
          type: 'INSERT',
          table: 'fluxo_caixa',
          data: dadosSaida
        })
      }

      await carregarCaixaHoje()
      toast.success('Saída registrada com sucesso')
      return true
    } catch (error) {
      console.error('Erro ao registrar saída:', error)
      toast.error('Erro ao registrar saída')
      throw error
    }
  }, [carregarCaixaHoje, isOnline])

  useEffect(() => {
    carregarCaixaHoje().finally(() => setLoading(false))
  }, [carregarCaixaHoje])

  return {
    caixaHoje,
    loading,
    carregarCaixaHoje,
    abrirCaixa,
    fecharCaixa,
    registrarSaida
  }
}
