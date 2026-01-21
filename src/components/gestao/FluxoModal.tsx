'use client'



interface FluxoModalProps {
  isOpen: boolean
  onClose: () => void
  formData: {
    data: string
    tipo: 'entrada' | 'saida'
    categoria: string
    descricao: string
    valor: string
  }
  onFormChange: (field: string, value: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export default function FluxoModal({ 
  isOpen, 
  onClose, 
  formData, 
  onFormChange, 
  onSubmit 
}: FluxoModalProps) {
  if (!isOpen) return null

  return (
            <div className="modal-container">
          <div className="modal-content modal-sm bg-white rounded-2xl shadow-xl w-full">
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Registrar Fluxo de Caixa</h2>
            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <label className="block text-lg font-medium text-gray-900 mb-2">Data</label>
                <input
                  type="date"
                  required
                  value={formData.data}
                  onChange={(e) => onFormChange('data', e.target.value)}
                  className="mt-1 block w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
                />
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-900 mb-2">Tipo</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => onFormChange('tipo', e.target.value)}
                  className="mt-1 block w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-900 mb-2">Categoria</label>
                <input
                  type="text"
                  required
                  value={formData.categoria}
                  onChange={(e) => onFormChange('categoria', e.target.value)}
                  placeholder="Ex: Vendas, Compras, Despesas"
                  className="mt-1 block w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
                />
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-900 mb-2">Descrição</label>
                <input
                  type="text"
                  required
                  value={formData.descricao}
                  onChange={(e) => onFormChange('descricao', e.target.value)}
                  placeholder="Descrição detalhada"
                  className="mt-1 block w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
                />
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-900 mb-2">Valor</label>
                <input
                  type="number"
                  step="0.00001"
                  min="0.00001"
                  required
                  value={formData.valor}
                  onChange={(e) => onFormChange('valor', e.target.value)}
                  placeholder="0.00000"
                  className="mt-1 block w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl text-base font-medium hover:bg-blue-700 transition-colors duration-200"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
  )
}
