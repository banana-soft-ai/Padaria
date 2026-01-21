'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { CaixaDiario } from '@/types/gestao'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface CaixasTabProps {
  caixasDiarios: CaixaDiario[]
  // agora aceita função opcional que pode retornar void ou Promise<void>
  onCaixaReaberto?: () => void | Promise<void>
}

export default function CaixasTab({ caixasDiarios, onCaixaReaberto }: CaixasTabProps) {
  const [reabrindoCaixa, setReabrindoCaixa] = useState<number | null>(null)
  const [showConfirmacao, setShowConfirmacao] = useState<number | null>(null)
  const [recalculando, setRecalculando] = useState(false)
  const [difCalcById, setDifCalcById] = useState<Record<number, number>>({})
  const [validado, setValidado] = useState(false)

  const computeDiferenca = (caixa: CaixaDiario) => {
    if (typeof caixa.diferenca === 'number') return caixa.diferenca
    if (
      typeof caixa.valor_fechamento === 'number' &&
      typeof caixa.valor_abertura === 'number' &&
      typeof caixa.total_entradas === 'number'
    ) {
      const saidas = typeof caixa.valor_saidas === 'number' ? caixa.valor_saidas : 0
      return caixa.valor_fechamento - (caixa.valor_abertura + caixa.total_entradas - saidas)
    }
    return undefined
  }

  const validarDiferencas = async () => {
    try {
      setRecalculando(true)
      const novos: Record<number, number> = {}
      for (const caixa of caixasDiarios) {
        // Buscar vendas do dia
        const { data: vendas } = await supabase
          .from('vendas')
          .select('forma_pagamento, valor_pago, valor_debito')
          .eq('data', caixa.data)

        const entradas = (vendas || [])
          .filter(v => v.forma_pagamento !== 'caderneta')
          .reduce((s, v) => s + (v.valor_pago || 0), 0)
        const saidas = typeof caixa.valor_saidas === 'number' ? caixa.valor_saidas : 0
        const esperado = (caixa.valor_abertura || 0) + entradas - saidas
        const informado = caixa.valor_fechamento || 0
        const diff = informado - esperado
        novos[caixa.id] = diff
      }
      setDifCalcById(novos)
      setValidado(true)
    } finally {
      setRecalculando(false)
    }
  }

  const corrigirDiferencas = async () => {
    try {
      setRecalculando(true)
      for (const caixa of caixasDiarios) {
        const { data: vendas } = await supabase
          .from('vendas')
          .select('forma_pagamento, valor_pago')
          .eq('data', caixa.data)

        const entradas = (vendas || [])
          .filter(v => v.forma_pagamento !== 'caderneta')
          .reduce((s, v) => s + (v.valor_pago || 0), 0)
        const saidas = typeof caixa.valor_saidas === 'number' ? caixa.valor_saidas : 0
        const esperado = (caixa.valor_abertura || 0) + entradas - saidas
        const informado = caixa.valor_fechamento || 0
        const diff = informado - esperado

        await supabase
          .from('caixa_diario')
          .update({ diferenca: diff, total_entradas: entradas })
          .eq('id', caixa.id)
      }
      // chamar callback se fornecida (suporta função async)
      if (onCaixaReaberto) await Promise.resolve(onCaixaReaberto())
    } finally {
      setRecalculando(false)
    }
  }

  const handleReabrirCaixa = async (caixaId: number) => {
    try {
      setReabrindoCaixa(caixaId)

      // Verificar se já existe um caixa aberto
      const { data: caixaAberto } = await supabase
        .from('caixa_diario')
        .select('*')
        .eq('status', 'aberto')
        .single()

      if (caixaAberto) {
        alert('Já existe um caixa aberto. Feche o caixa atual antes de reabrir outro.')
        return
      }

      // Reabrir o caixa
      const { error } = await supabase
        .from('caixa_diario')
        .update({
          status: 'aberto',
          data_fechamento: null,
          valor_fechamento: null,
          observacoes_fechamento: null,
          usuario_fechamento: null
        })
        .eq('id', caixaId)

      if (error) throw error

      alert('Caixa reaberto com sucesso!')
      if (onCaixaReaberto) await Promise.resolve(onCaixaReaberto()) // Recarregar dados
    } catch (error) {
      console.error('Erro ao reabrir caixa:', error)
      alert('Erro ao reabrir caixa. Tente novamente.')
    } finally {
      setReabrindoCaixa(null)
      setShowConfirmacao(null)
    }
  }

  const confirmarReabertura = (caixaId: number) => {
    setShowConfirmacao(caixaId)
  }

  const cancelarReabertura = () => {
    setShowConfirmacao(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Histórico de Caixas</h2>
        <button
          onClick={validarDiferencas}
          disabled={recalculando}
          className="px-3 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {recalculando ? 'Validando...' : 'Validar Diferença'}
        </button>
      </div>
      <div className="table-wrapper overflow-x-auto">
        <table className="min-w-[1300px] table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Data
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Abertura
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Fechamento
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Entradas
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Saídas
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Diferença
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Total Real
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Caderneta
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-xs">
            {caixasDiarios.map((caixa) => (
              <tr key={caixa.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-2 py-2 whitespace-nowrap text-gray-900">
                  {(() => {
                    const dataRaw = caixa.data_abertura ?? caixa.data ?? caixa.created_at
                    if (!dataRaw) return '-'
                    try {
                      return new Date(dataRaw).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                    } catch (e) {
                      return '-'
                    }
                  })()}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <span className={`inline-flex px-3 py-2 text-sm font-semibold rounded-full ${caixa.status === 'aberto' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {caixa.status === 'aberto' ? 'Aberto' : 'Fechado'}
                  </span>
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-gray-900">
                  {typeof caixa.valor_abertura === 'number' ? `R$ ${caixa.valor_abertura.toFixed(2)}` : '-'}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-gray-900">
                  {typeof caixa.valor_fechamento === 'number' ? `R$ ${caixa.valor_fechamento.toFixed(2)}` : '-'}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-gray-900">
                  {typeof caixa.total_entradas === 'number' ? `R$ ${caixa.total_entradas.toFixed(2)}` : '-'}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-gray-900">
                  {typeof caixa.valor_saidas === 'number'
                    ? `R$ ${caixa.valor_saidas.toFixed(2)}`
                    : (typeof (caixa as unknown as { total_saidas?: number }).total_saidas === 'number'
                      ? `R$ ${(caixa as unknown as { total_saidas: number }).total_saidas.toFixed(2)}`
                      : '-')}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {(() => {
                    const d = difCalcById[caixa.id] ?? computeDiferenca(caixa)
                    if (typeof d !== 'number') return '-'
                    const cls = d > 0 ? 'text-green-600' : d < 0 ? 'text-red-600' : 'text-gray-600'
                    const sign = d > 0 ? '+' : d < 0 ? '-' : ''
                    const hasStored = typeof caixa.diferenca === 'number'
                    const mismatch = hasStored && Math.abs((caixa.diferenca as number) - d) > 0.01
                    return (
                      <span className={`font-semibold ${cls}`} title={mismatch ? `Armazenado: R$ ${(caixa.diferenca || 0).toFixed(2)} | Recalc: R$ ${d.toFixed(2)}` : undefined}>
                        {`${sign}R$ ${Math.abs(d).toFixed(2)}`}
                        {mismatch ? ' *' : ''}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-gray-900">
                  {(() => {
                    const d = difCalcById[caixa.id] ?? computeDiferenca(caixa)
                    const entradas = typeof caixa.total_entradas === 'number' ? caixa.total_entradas : 0
                    if (typeof d !== 'number') return '-'
                    const totalReal = entradas + d
                    return `R$ ${totalReal.toFixed(2)}`
                  })()}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-gray-900">
                  {typeof caixa.total_caderneta === 'number' ? `R$ ${caixa.total_caderneta.toFixed(2)}` : '-'}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-gray-900">
                  {caixa.status === 'fechado' && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => confirmarReabertura(caixa.id)}
                        disabled={reabrindoCaixa === caixa.id}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Reabrir caixa fechado acidentalmente"
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${reabrindoCaixa === caixa.id ? 'animate-spin' : ''}`} />
                        Reabrir
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {validado && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={corrigirDiferencas}
            disabled={recalculando}
            className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {recalculando ? 'Aplicando...' : 'Corrigir Diferenças'}
          </button>
        </div>
      )}

      {/* Modal de Confirmação de Reabertura */}
      {showConfirmacao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmar Reabertura</h3>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">
                Você está prestes a reabrir um caixa que foi fechado. Esta ação irá:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li>• Alterar o status para &quot;Aberto&quot;</li>
                <li>• Remover a data de fechamento</li>
                <li>• Limpar o valor de fechamento</li>
                <li>• Permitir continuar registrando vendas</li>
              </ul>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800 font-medium">
                  ⚠️ Atenção: Certifique-se de que o caixa foi realmente fechado por engano.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelarReabertura}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleReabrirCaixa(showConfirmacao)}
                disabled={reabrindoCaixa === showConfirmacao}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {reabrindoCaixa === showConfirmacao ? 'Reabrindo...' : 'Confirmar Reabertura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}