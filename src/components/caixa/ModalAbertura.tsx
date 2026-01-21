'use client'

import { useState } from 'react'
import { Unlock } from 'lucide-react'

interface ModalAberturaProps {
  onSubmit: (formData: {
    data_selecionada: string
    valor_inicial: string
    observacoes: string
  }) => void
  onClose: () => void
}

export default function ModalAbertura({ onSubmit, onClose }: ModalAberturaProps) {
  const [formData, setFormData] = useState({
    data_selecionada: new Date().toISOString().split('T')[0],
    valor_inicial: '',
    observacoes: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.valor_inicial || parseFloat(formData.valor_inicial) < 0) {
      alert('Por favor, informe um valor inicial válido.')
      return
    }
    
    onSubmit(formData)
  }

  return (
    <div className="modal-container">
      <div className="modal-content modal-sm bg-white rounded-lg shadow-xl w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-green-100 rounded-full mr-3">
              <Unlock className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Abrir Caixa</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Data de Abertura *
              </label>
              <input
                type="date"
                required
                value={formData.data_selecionada}
                onChange={(e) => setFormData({...formData, data_selecionada: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Selecione a data para a qual está abrindo o caixa
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Valor Inicial no Caixa (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.valor_inicial}
                onChange={(e) => setFormData({...formData, valor_inicial: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                Valor em dinheiro disponível no caixa no início do dia
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Observações
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Observações sobre a abertura do caixa..."
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
              >
                Abrir Caixa
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
