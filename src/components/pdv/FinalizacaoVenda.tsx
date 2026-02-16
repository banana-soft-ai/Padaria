'use client'

import { useState, useEffect } from 'react'
import type { FormaPagamentoPDV, DadosConfirmacaoVenda } from '@/types/pdv'

export interface FinalizacaoVendaProps {
  aberto: boolean
  onFechar: () => void
  valorTotal: number
  formaPagamento: FormaPagamentoPDV
  onConfirmar: (dados: DadosConfirmacaoVenda) => void
}

export default function FinalizacaoVenda({
  aberto,
  onFechar,
  valorTotal,
  formaPagamento,
  onConfirmar,
}: FinalizacaoVendaProps) {
  const [valorPago, setValorPago] = useState('')
  const [troco, setTroco] = useState('')

  useEffect(() => {
    if (aberto) {
      setValorPago(valorTotal.toFixed(2))
      setTroco('0.00')
    }
  }, [aberto, valorTotal])

  const valorPagoNum = parseFloat(valorPago) || 0
  const trocoCalculado = Math.max(0, valorPagoNum - valorTotal)

  const handleConfirmar = () => {
    if (formaPagamento === 'dinheiro') {
      onConfirmar({
        forma_pagamento: 'dinheiro',
        valor_pago: valorPagoNum,
        troco: trocoCalculado,
      })
    } else {
      onConfirmar({
        forma_pagamento: formaPagamento,
        valor_pago: valorTotal,
      })
    }
    onFechar()
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 w-full max-w-md mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finalizacao-venda-titulo"
      >
        <h2 id="finalizacao-venda-titulo" className="text-xl font-black text-gray-800 mb-4">
          Finalizar - {formaPagamento.toUpperCase()}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Total: <strong className="text-lg text-blue-600">R$ {valorTotal.toFixed(2)}</strong>
        </p>

        {formaPagamento === 'dinheiro' && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Valor recebido (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value)}
                className="w-full p-3 border border-blue-100 rounded-xl text-lg font-bold"
              />
            </div>
            <div>
              <span className="text-sm font-bold text-gray-700">Troco: </span>
              <span className="text-xl font-black text-green-600">
                R$ {trocoCalculado.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
