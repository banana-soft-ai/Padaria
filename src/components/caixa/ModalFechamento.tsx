'use client'

import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { CaixaDiario, Venda } from '@/lib/supabase'

interface ModalFechamentoProps {
  caixa: CaixaDiario
  vendasHoje?: Venda[]
  onSubmit: (formData: {
    valor_final: string
    valor_saidas: string
    valor_dinheiro: string
    valor_pix: string
    valor_debito: string
    valor_credito: string
    observacoes: string
  }) => void
  onClose: () => void
}

export default function ModalFechamento({ caixa, vendasHoje = [], onSubmit, onClose }: ModalFechamentoProps) {
  const [totalSaidas, setTotalSaidas] = useState(0)

  // Função para carregar saídas do caixa
  const carregarSaidasCaixa = async () => {
    try {
      const { data: saidasData, error } = await supabase
        .from('fluxo_caixa')
        .select('valor')
        .eq('data', caixa.data)
        .eq('tipo', 'saida')
        .eq('categoria', 'caixa')

      if (error) {
        console.error('Erro ao carregar saídas do caixa:', error)
        return 0
      }

      const total = (saidasData || []).reduce((sum: number, r: { valor: number }) => sum + (Number(r.valor) || 0), 0)
      setTotalSaidas(total)
      return total
    } catch (error) {
      console.error('Erro ao carregar saídas:', error)
      return 0
    }
  }

  // Função para calcular valores automaticamente
  const calcularValoresAutomaticos = async () => {
    const valorAbertura = caixa.valor_abertura || 0

    // Calcular totais das vendas do dia
    const totalPix = vendasHoje?.filter(v => v.forma_pagamento === 'pix').reduce((sum, v) => sum + v.valor_pago, 0) || 0
    const totalDebito = vendasHoje?.filter(v => v.forma_pagamento === 'debito').reduce((sum, v) => sum + v.valor_pago, 0) || 0
    const totalCredito = vendasHoje?.filter(v => v.forma_pagamento === 'credito').reduce((sum, v) => sum + v.valor_pago, 0) || 0
    const totalDinheiro = vendasHoje?.filter(v => v.forma_pagamento === 'dinheiro').reduce((sum, v) => sum + v.valor_pago, 0) || 0
    const totalCaderneta = vendasHoje?.filter(v => v.forma_pagamento === 'caderneta').reduce((sum, v) => sum + v.valor_debito, 0) || 0

    // Total de entradas apenas de vendas reais (excluindo caderneta/fiado)
    const vendasReais = vendasHoje?.filter(v => v.forma_pagamento !== 'caderneta') || []
    const totalEntradas = vendasReais.reduce((sum, v) => sum + v.valor_pago, 0) || 0

    // Carregar saídas do caixa
    const saidasCaixa = await carregarSaidasCaixa()

    // Calcular valor final esperado (abertura + entradas - saídas)
    const valorFinalEsperado = valorAbertura + totalEntradas - saidasCaixa


    const valores = {
      valor_final: valorFinalEsperado.toFixed(2),
      valor_saidas: saidasCaixa.toFixed(2),
      valor_dinheiro: totalDinheiro.toFixed(2),
      valor_pix: totalPix.toFixed(2),
      valor_debito: totalDebito.toFixed(2),
      valor_credito: totalCredito.toFixed(2),
      observacoes: ''
    }

    return valores
  }

  const [formData, setFormData] = useState({
    valor_final: '0.00',
    valor_saidas: '0.00',
    valor_dinheiro: '0.00',
    valor_pix: '0.00',
    valor_debito: '0.00',
    valor_credito: '0.00',
    observacoes: ''
  })

  // Recalcular quando vendasHoje mudar
  useEffect(() => {
    const carregarValores = async () => {
      const valores = await calcularValoresAutomaticos()
      setFormData(valores)
    }
    carregarValores()
  }, [vendasHoje, caixa])

  // Cálculos derivados para exibir no status do caixa
  const valorAbertura = caixa.valor_abertura || 0
  const totalEntradas = vendasHoje?.filter(v => v.forma_pagamento !== 'caderneta').reduce((sum, v) => sum + v.valor_pago, 0) || 0

  // Utilitário para parse de números com vírgula
  const parseToNumber = (value: string | number | undefined) => {
    if (value === undefined || value === null) return 0
    const str = typeof value === 'number' ? String(value) : value
    const parsed = parseFloat(str.replace(',', '.'))
    return isNaN(parsed) ? 0 : parsed
  }

  // Soma dos pagamentos informados
  const somaPagamentos =
    parseToNumber(formData.valor_dinheiro) +
    parseToNumber(formData.valor_pix) +
    parseToNumber(formData.valor_debito) +
    parseToNumber(formData.valor_credito)

  // Saídas lançadas
  const valorSaidas = parseToNumber(formData.valor_saidas)

  // Valor esperado considerando saídas
  const valorEsperado = valorAbertura + totalEntradas - totalSaidas

  // Valor final informado = abertura + soma dos pagamentos - saídas (campo somente leitura)
  const valorInformadoNumerico = valorAbertura + somaPagamentos - valorSaidas
  const valorInformado = valorInformadoNumerico
  const diferenca = valorInformado - valorEsperado
  const diferencaAbsoluta = Math.abs(diferenca)
  const isZero = diferencaAbsoluta <= 0.01
  const statusClasse = isZero ? 'text-gray-700' : (diferenca > 0 ? 'text-green-600' : 'text-red-600')
  const diffPrefix = isZero ? '' : (diferenca > 0 ? '+' : '')
  const statusMensagem = `Diferença: R$ ${diffPrefix}${diferenca.toFixed(2)}`

  // Atualiza o valor_final automaticamente quando pagamentos mudam
  useEffect(() => {
    const novoValorFinal = (valorInformadoNumerico).toFixed(2)
    if (formData.valor_final !== novoValorFinal) {
      setFormData({ ...formData, valor_final: novoValorFinal })
    }
  }, [formData.valor_dinheiro, formData.valor_pix, formData.valor_debito, formData.valor_credito, formData.valor_saidas, valorAbertura])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.valor_final || parseFloat(formData.valor_final) < 0) {
      alert('Por favor, informe um valor final válido.')
      return
    }

    // Calcular diferença entre valores preenchidos e valores esperados (considerando saídas)
    const valorEsperado = (caixa.valor_abertura || 0) + (vendasHoje?.filter(v => v.forma_pagamento !== 'caderneta').reduce((sum, v) => sum + v.valor_pago, 0) || 0) - (parseFloat(formData.valor_saidas || '0') || 0)
    const valorFinal = parseFloat(formData.valor_final)
    const diferenca = valorFinal - valorEsperado

    if (Math.abs(diferenca) > 0.01) {
      const mensagem = `Valor final informado: R$ ${valorFinal.toFixed(2)}\n` +
        `Valor esperado: R$ ${valorEsperado.toFixed(2)}\n` +
        `Diferença: R$ ${diferenca.toFixed(2)}\n\n` +
        `Deseja continuar com o fechamento?`

      if (!confirm(mensagem)) {
        return
      }
    }

    onSubmit(formData)
  }

  return (
    <div className="modal-container">
      <div className="modal-content modal-lg bg-white rounded-lg shadow-xl w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-red-100 rounded-full mr-3">
              <Lock className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Fechar Caixa</h2>
          </div>

          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-sm font-medium text-gray-800">Resumo do Caixa</h3>
              <button
                type="button"
                onClick={async () => {
                  const valores = await calcularValoresAutomaticos()
                  setFormData(valores)
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-md hover:bg-blue-200 transition-colors"
              >
                ↻ Recalcular
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Valor de Abertura:</span>
                <span className="ml-2 font-medium text-gray-900">R$ {caixa.valor_abertura?.toFixed(2) || '0.00'}</span>
              </div>
              <div>
                <span className="text-gray-600">Total de Entradas:</span>
                <span className="ml-2 font-medium text-gray-900">R$ {(vendasHoje?.filter(v => v.forma_pagamento !== 'caderneta').reduce((sum, v) => sum + v.valor_pago, 0) || 0).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Total de Vendas:</span>
                <span className="ml-2 font-medium text-gray-900">{vendasHoje?.length || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span className="ml-2 font-medium text-green-600">Aberto</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Valores por Forma de Pagamento */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Valores por Forma de Pagamento
                <span className="text-sm text-gray-500 ml-2">(Preenchimento automático baseado nas vendas do dia)</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dinheiro
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_dinheiro}
                    onChange={(e) => setFormData({ ...formData, valor_dinheiro: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-green-50"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PIX
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_pix}
                    onChange={(e) => setFormData({ ...formData, valor_pix: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-green-50"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Débito
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_debito}
                    onChange={(e) => setFormData({ ...formData, valor_debito: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-green-50"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Crédito
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_credito}
                    onChange={(e) => setFormData({ ...formData, valor_credito: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-green-50"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Valores Finais */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Final em Caixa <span className="text-green-600 text-xs">(Auto: Abertura + Pagamentos - Saídas)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_final}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-gray-100 cursor-not-allowed"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor de Saídas
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_saidas}
                  onChange={(e) => setFormData({ ...formData, valor_saidas: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                placeholder="Observações sobre o fechamento..."
              />
            </div>

            {/* Status do Caixa */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status do Caixa:</span>
                <span className={`font-bold ${statusClasse} text-xl md:text-2xl`}>{statusMensagem}</span>
              </div>
              <div className="mt-1 text-xs text-gray-600">
                Esperado (Abertura + Entradas - Saídas): R$ {valorEsperado.toFixed(2)} • Informado (Abertura + Pagamentos - Saídas): R$ {valorInformado.toFixed(2)}
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Fechar Caixa
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
