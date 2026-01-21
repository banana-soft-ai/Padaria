'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { CaixaDiario } from '@/lib/supabase'
import type { Database } from '@/lib/supabase/types'
import CaixaStatus from './caixa/CaixaStatus'
import ModalAbertura from './caixa/ModalAbertura'
import ModalFechamento from './caixa/ModalFechamento'
import { Lock, Unlock } from 'lucide-react'

interface SistemaCaixaProps {
  onCaixaChange?: (aberto: boolean) => void
}

export default function SistemaCaixa({ onCaixaChange }: SistemaCaixaProps) {
  const [caixaHoje, setCaixaHoje] = useState<CaixaDiario | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModalAbertura, setShowModalAbertura] = useState(false)
  const [showModalFechamento, setShowModalFechamento] = useState(false)

  useEffect(() => {
    carregarCaixaHoje()
  }, [])

  useEffect(() => {
    if (onCaixaChange) {
      onCaixaChange(caixaHoje?.status === 'aberto' || false)
    }
  }, [caixaHoje, onCaixaChange])

  const carregarCaixaHoje = async () => {
    try {
      setLoading(true)

      // Buscar o caixa aberto mais recente
      const { data: caixas, error } = await supabase
        .from('caixa_diario')
        .select('*')
        .eq('status', 'aberto')
        .order('id', { ascending: false })
        .limit(1)

      if (error) {
        console.error('❌ Erro ao carregar caixa:', error)
        setCaixaHoje(null)
        return
      }

      const caixaAberto = caixas && caixas.length > 0 ? caixas[0] : null

      if (!caixaAberto) {
        console.log('❌ Nenhum caixa aberto encontrado')
        setCaixaHoje(null)
        return
      }

      console.log('✅ Caixa encontrado:', caixaAberto)

      // Calcular totais das vendas do dia
      const { data: vendasHoje, error: vendasError } = await supabase
        .from('vendas')
        .select('id, valor_total, forma_pagamento, valor_pago, valor_debito')
        .eq('data', caixaAberto.data)

      if (!vendasError && vendasHoje) {
        // Vendas reais (excluindo caderneta)
        const vendasReais = vendasHoje.filter(v => v.forma_pagamento !== 'caderneta')
        const totalEntradas = vendasReais.reduce((sum, v) => sum + (v.valor_pago || 0), 0)

        // Totais por forma de pagamento
        const totalPix = vendasHoje.filter(v => v.forma_pagamento === 'pix').reduce((sum, v) => sum + (v.valor_pago || 0), 0)
        const totalDebito = vendasHoje.filter(v => v.forma_pagamento === 'debito').reduce((sum, v) => sum + (v.valor_pago || 0), 0)
        const totalCredito = vendasHoje.filter(v => v.forma_pagamento === 'credito').reduce((sum, v) => sum + (v.valor_pago || 0), 0)
        const totalDinheiro = vendasHoje.filter(v => v.forma_pagamento === 'dinheiro').reduce((sum, v) => sum + (v.valor_pago || 0), 0)

        // Caderneta separada
        const vendasCaderneta = vendasHoje.filter(v => v.forma_pagamento === 'caderneta')
        const totalCaderneta = vendasCaderneta.reduce((sum, v) => sum + (v.valor_debito || 0), 0)

        // Calcular saídas
        const { data: saidasData } = await supabase
          .from('fluxo_caixa')
          .select('valor')
          .eq('data', caixaAberto.data)
          .eq('tipo', 'saida')
          .eq('categoria', 'caixa')

        const totalSaidas = (saidasData || []).reduce((sum: number, r: { valor: number }) => sum + (Number(r.valor) || 0), 0)

        // Atualizar o caixa
        const { error: updateError } = await supabase
          .from('caixa_diario')
          .update<Database['public']['Tables']['caixa_diario']['Update']>({
            total_entradas: totalEntradas,
            total_vendas: totalEntradas + totalCaderneta,
            valor_saidas: totalSaidas,
            total_saidas: totalSaidas,
            total_pix: totalPix,
            total_debito: totalDebito,
            total_credito: totalCredito,
            total_dinheiro: totalDinheiro,
            total_caderneta: totalCaderneta
          })
          .eq('id', caixaAberto.id)

        if (!updateError) {
          setCaixaHoje({
            ...caixaAberto,
            total_entradas: totalEntradas,
            total_vendas: totalEntradas + totalCaderneta,
            valor_saidas: totalSaidas,
            total_saidas: totalSaidas,
            total_pix: totalPix,
            total_debito: totalDebito,
            total_credito: totalCredito,
            total_dinheiro: totalDinheiro,
            total_caderneta: totalCaderneta
          })
        } else {
          setCaixaHoje(caixaAberto)
        }
      } else {
        setCaixaHoje(caixaAberto)
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao carregar caixa:', error)
      setCaixaHoje(null)
    } finally {
      setLoading(false)
    }
  }

  const handleAberturaSubmit = async (formData: {
    data_selecionada: string
    valor_inicial: string
    observacoes: string
  }) => {
    try {
      const { data: existingCaixa, error: checkError } = await supabase
        .from('caixa_diario')
        .select('*')
        .eq('data', formData.data_selecionada)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      let result
      if (existingCaixa) {
        // NÃO permitir reabrir/atualizar caixa existente: regra 1x por dia
        alert('Já existe um caixa registrado para a data selecionada. Abertura permitida apenas 1 vez por dia.')
        setShowModalAbertura(false)
        return
      } else {
        // Criar novo caixa
        result = await supabase
          .from('caixa_diario')
          .insert<Database['public']['Tables']['caixa_diario']['Insert']>([{
            data: formData.data_selecionada,
            valor_abertura: parseFloat(formData.valor_inicial),
            observacoes_abertura: formData.observacoes,
            status: 'aberto',
            data_abertura: new Date().toISOString()
          }])
          .select()
          .single()
      }

      if (result.error) throw result.error

      setShowModalAbertura(false)
      await carregarCaixaHoje()
      alert('Caixa aberto com sucesso!')
    } catch (error) {
      try {
        console.error('Erro ao abrir caixa:', JSON.parse(JSON.stringify(error)))
      } catch (e) {
        console.error('Erro ao abrir caixa (não serializável):', error)
      }

      const message = error instanceof Error ? error.message : (error && (error as any).message) || JSON.stringify(error || {})
      alert(`Erro ao abrir caixa: ${message}. Verifique o console para mais detalhes.`)
    }
  }

  const handleFechamentoSubmit = async (formData: {
    valor_final: string
    valor_saidas: string
    valor_dinheiro: string
    valor_pix: string
    valor_debito: string
    valor_credito: string
    observacoes: string
  }) => {
    if (!caixaHoje) return

    try {
      // Calcular totais das vendas do dia
      const { data: vendasHoje, error: vendasError } = await supabase
        .from('vendas')
        .select('*')
        .eq('data', caixaHoje.data)

      if (vendasError) throw vendasError

      const totalPix = vendasHoje?.filter(v => v.forma_pagamento === 'pix').reduce((sum, v) => sum + (v.valor_pago || 0), 0) || 0
      const totalDebito = vendasHoje?.filter(v => v.forma_pagamento === 'debito').reduce((sum, v) => sum + (v.valor_pago || 0), 0) || 0
      const totalCredito = vendasHoje?.filter(v => v.forma_pagamento === 'credito').reduce((sum, v) => sum + (v.valor_pago || 0), 0) || 0
      const totalDinheiro = vendasHoje?.filter(v => v.forma_pagamento === 'dinheiro').reduce((sum, v) => sum + (v.valor_pago || 0), 0) || 0
      const totalCaderneta = vendasHoje?.filter(v => v.forma_pagamento === 'caderneta').reduce((sum, v) => sum + (v.valor_debito || 0), 0) || 0

      // Total de entradas apenas de vendas reais (excluindo caderneta)
      const vendasReais = vendasHoje?.filter(v => v.forma_pagamento !== 'caderneta') || []
      const totalEntradas = vendasReais.reduce((sum, v) => sum + (v.valor_pago || 0), 0)

      // Recalcular saídas
      const { data: saidasFluxo } = await supabase
        .from('fluxo_caixa')
        .select('valor')
        .eq('data', caixaHoje.data)
        .eq('tipo', 'saida')
        .eq('categoria', 'caixa')
      const totalSaidas = (saidasFluxo || []).reduce((sum: number, r: { valor: number }) => sum + (Number(r.valor) || 0), 0)

      // Calcular diferenças
      const diferencaDinheiro = (parseFloat(formData.valor_dinheiro) || 0) - totalDinheiro
      const diferencaPix = (parseFloat(formData.valor_pix) || 0) - totalPix
      const diferencaDebito = (parseFloat(formData.valor_debito) || 0) - totalDebito
      const diferencaCredito = (parseFloat(formData.valor_credito) || 0) - totalCredito

      const valorFinalEsperado = (caixaHoje.valor_abertura || 0) + totalEntradas - totalSaidas
      const diferencaFinal = (parseFloat(formData.valor_final) || 0) - valorFinalEsperado

      const { error } = await supabase
        .from('caixa_diario')
        .update<Database['public']['Tables']['caixa_diario']['Update']>({
          valor_fechamento: parseFloat(formData.valor_final),
          valor_saidas: totalSaidas,
          observacoes_fechamento: formData.observacoes,
          status: 'fechado',
          data_fechamento: new Date().toISOString(),
          total_entradas: totalEntradas,
          total_vendas: totalEntradas + totalCaderneta,
          total_saidas: totalSaidas,
          total_pix: totalPix,
          total_debito: totalDebito,
          total_credito: totalCredito,
          total_dinheiro: totalDinheiro,
          total_caderneta: totalCaderneta,
          diferenca: diferencaFinal,
          valor_dinheiro_informado: parseFloat(formData.valor_dinheiro) || 0,
          valor_pix_informado: parseFloat(formData.valor_pix) || 0,
          valor_debito_informado: parseFloat(formData.valor_debito) || 0,
          valor_credito_informado: parseFloat(formData.valor_credito) || 0,
          diferenca_dinheiro: diferencaDinheiro,
          diferenca_pix: diferencaPix,
          diferenca_debito: diferencaDebito,
          diferenca_credito: diferencaCredito
        })
        .eq('id', caixaHoje.id)

      if (error) throw error

      setShowModalFechamento(false)
      await carregarCaixaHoje()
      alert('Caixa fechado com sucesso!')
    } catch (error) {
      try {
        console.error('Erro ao fechar caixa:', JSON.parse(JSON.stringify(error)))
      } catch (e) {
        console.error('Erro ao fechar caixa (não serializável):', error)
      }

      const message = error instanceof Error ? error.message : (error && (error as any).message) || JSON.stringify(error || {})
      alert(`Erro ao fechar caixa: ${message}. Verifique o console para mais detalhes.`)
    }
  }

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${caixaHoje?.status === 'aberto' ? 'bg-green-100' : 'bg-red-100'}`}>
              {caixaHoje?.status === 'aberto' ? (
                <Unlock className="h-5 w-5 text-green-600" />
              ) : (
                <Lock className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Sistema de Caixa</h2>
              <p className="text-sm text-gray-600">
                {caixaHoje?.status === 'aberto' ? 'Caixa aberto' : 'Caixa fechado'}
                {caixaHoje && (
                  <span className="ml-2 text-gray-500">
                    - {formatarData(caixaHoje.data_abertura)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            {caixaHoje?.status !== 'aberto' && (
              <button
                onClick={() => setShowModalAbertura(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 text-sm"
              >
                <Unlock className="h-4 w-4" />
                <span>Abrir Caixa</span>
              </button>
            )}

            {caixaHoje?.status === 'aberto' && (
              <button
                onClick={() => setShowModalFechamento(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2 text-sm"
              >
                <Lock className="h-4 w-4" />
                <span>Fechar Caixa</span>
              </button>
            )}

            <button
              onClick={carregarCaixaHoje}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2 text-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {caixaHoje ? (
          <CaixaStatus caixa={caixaHoje} />
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum Caixa Aberto</h3>
            <p className="text-sm text-gray-600 mb-4">
              Não há nenhum caixa aberto no momento. Clique em &quot;Abrir Caixa&quot; para iniciar um novo dia de trabalho.
            </p>
            <button
              onClick={() => setShowModalAbertura(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 mx-auto"
            >
              <Unlock className="h-4 w-4" />
              <span>Abrir Caixa</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal de Abertura */}
      {showModalAbertura && (
        <ModalAbertura
          onSubmit={handleAberturaSubmit}
          onClose={() => setShowModalAbertura(false)}
        />
      )}

      {/* Modal de Fechamento */}
      {showModalFechamento && caixaHoje && (
        <ModalFechamento
          caixa={caixaHoje}
          onSubmit={handleFechamentoSubmit}
          onClose={() => setShowModalFechamento(false)}
        />
      )}
    </div>
  )
}
