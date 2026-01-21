'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Plus, Minus, Trash2 } from 'lucide-react'

interface ItemComPreco {
  id: number
  nome: string
  tipo: 'receita' | 'varejo'
  preco_venda: number
}

interface ClienteCaderneta {
  id: number
  nome: string
  saldo_devedor: number
}

interface VendaFormData {
  forma_pagamento: string
  cliente_caderneta_id?: number
  observacoes: string
  itens: Array<{
    item_id: number
    tipo: 'receita' | 'varejo'
    quantidade: number
    preco_unitario: number
  }>
}

interface ModalVendaProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: VendaFormData) => Promise<void>
  itensComPreco: ItemComPreco[]
  clientesCaderneta: ClienteCaderneta[]
  loading?: boolean
}

export default function ModalVenda({
  isOpen,
  onClose,
  onSubmit,
  itensComPreco,
  clientesCaderneta,
  loading = false
}: ModalVendaProps) {
  const [formData, setFormData] = useState<VendaFormData>({
    forma_pagamento: 'dinheiro',
    observacoes: '',
    itens: []
  })
  const [termoPesquisa, setTermoPesquisa] = useState('')
  const [mostrarListaItens, setMostrarListaItens] = useState(false)
  const [mostrarCampoCliente, setMostrarCampoCliente] = useState(false)

  const itensFiltrados = useMemo(() => 
    itensComPreco.filter(item =>
      item.nome.toLowerCase().includes(termoPesquisa.toLowerCase())
    ), [itensComPreco, termoPesquisa]
  )

  const adicionarItem = useCallback((item: ItemComPreco) => {
    const itemExistente = formData.itens.find(i => i.item_id === item.id)
    
    if (itemExistente) {
      setFormData(prev => ({
        ...prev,
        itens: prev.itens.map(i =>
          i.item_id === item.id
            ? { ...i, quantidade: i.quantidade + 1 }
            : i
        )
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        itens: [
          ...prev.itens,
          {
            item_id: item.id,
            tipo: item.tipo,
            quantidade: 1,
            preco_unitario: item.preco_venda
          }
        ]
      }))
    }
    
    setMostrarListaItens(false)
    setTermoPesquisa('')
  }, [formData.itens])

  const removerItem = useCallback((itemId: number) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens.filter(item => item.item_id !== itemId)
    }))
  }, [])

  const alterarQuantidade = useCallback((itemId: number, quantidade: number) => {
    if (quantidade <= 0) {
      removerItem(itemId)
      return
    }

    setFormData(prev => ({
      ...prev,
      itens: prev.itens.map(item =>
        item.item_id === itemId
          ? { ...item, quantidade }
          : item
      )
    }))
  }, [removerItem])

  const calcularTotal = useMemo(() => {
    return formData.itens.reduce((total, item) => 
      total + (item.quantidade * item.preco_unitario), 0
    )
  }, [formData.itens])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.itens.length === 0) {
      alert('Adicione pelo menos um item à venda')
      return
    }

    if (formData.forma_pagamento === 'caderneta' && !formData.cliente_caderneta_id) {
      alert('Selecione um cliente para vendas na caderneta')
      return
    }

    try {
      await onSubmit(formData)
      setFormData({
        forma_pagamento: 'dinheiro',
        observacoes: '',
        itens: []
      })
      setMostrarCampoCliente(false)
      onClose()
    } catch (error) {
      console.error('Erro ao registrar venda:', error)
    }
  }

  useEffect(() => {
    setMostrarCampoCliente(formData.forma_pagamento === 'caderneta')
  }, [formData.forma_pagamento])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Nova Venda</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Forma de Pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forma de Pagamento
            </label>
            <select
              value={formData.forma_pagamento}
              onChange={(e) => setFormData(prev => ({ ...prev, forma_pagamento: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="caderneta">Caderneta</option>
            </select>
          </div>

          {/* Cliente Caderneta */}
          {mostrarCampoCliente && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cliente
              </label>
              <select
                value={formData.cliente_caderneta_id || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  cliente_caderneta_id: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                required={mostrarCampoCliente}
              >
                <option value="">Selecione um cliente</option>
                {clientesCaderneta.map(cliente => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome} - Saldo: R$ {cliente.saldo_devedor.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Busca de Itens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adicionar Item
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Digite o nome do item..."
                value={termoPesquisa}
                onChange={(e) => {
                  setTermoPesquisa(e.target.value)
                  setMostrarListaItens(true)
                }}
                onFocus={() => setMostrarListaItens(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              
              {mostrarListaItens && termoPesquisa && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {itensFiltrados.length > 0 ? (
                    itensFiltrados.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => adicionarItem(item)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                      >
                        <div className="flex justify-between items-center">
                          <span>{item.nome}</span>
                          <span className="text-sm text-gray-500">
                            R$ {item.preco_venda.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-gray-500">
                      Nenhum item encontrado
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lista de Itens */}
          {formData.itens.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Itens da Venda</h3>
              <div className="space-y-2">
                {formData.itens.map(item => {
                  const itemInfo = itensComPreco.find(i => i.id === item.item_id)
                  return (
                    <div key={item.item_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{itemInfo?.nome}</div>
                        <div className="text-sm text-gray-500">
                          R$ {item.preco_unitario.toFixed(2)} cada
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => alterarQuantidade(item.item_id, item.quantidade - 1)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        
                        <span className="w-8 text-center">{item.quantidade}</span>
                        
                        <button
                          type="button"
                          onClick={() => alterarQuantidade(item.item_id, item.quantidade + 1)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => removerItem(item.item_id)}
                          className="p-1 text-red-500 hover:text-red-700 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="ml-4 font-medium">
                        R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                      </div>
                    </div>
                  )
                })}
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total:</span>
                  <span>R$ {calcularTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações
            </label>
            <textarea
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Observações adicionais (opcional)"
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || formData.itens.length === 0}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Registrando...' : 'Registrar Venda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
