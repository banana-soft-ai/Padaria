'use client'

import { useState, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Venda } from '@/lib/supabase'

type VendaComRelacionamentos = Venda & {
  clientes_caderneta?: { nome?: string }
  venda_itens?: Array<{
    id?: number
    item_id?: number
    tipo?: string
    item_nome?: string
    quantidade?: number
    preco_unitario?: number
    subtotal?: number
    preco_total?: number
  }>
}

interface ListaVendasProps {
  vendas: VendaComRelacionamentos[]
  loading?: boolean
}

export default function ListaVendas({ vendas, loading = false }: ListaVendasProps) {
  const [vendasExpandidas, setVendasExpandidas] = useState<Set<number>>(new Set())

  const toggleExpansao = useCallback((vendaId: number) => {
    const novasExpandidas = new Set(vendasExpandidas)
    if (novasExpandidas.has(vendaId)) {
      novasExpandidas.delete(vendaId)
    } else {
      novasExpandidas.add(vendaId)
    }
    setVendasExpandidas(novasExpandidas)
  }, [vendasExpandidas])

  const formatarMoeda = useCallback((valor: number | undefined) => {
    if (valor === undefined || valor === null) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }, [])

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR')
  }

  const formatarHora = (hora: string) => {
    return new Date(hora).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getFormaPagamentoLabel = (forma: string) => {
    const formas = {
      dinheiro: 'Dinheiro',
      pix: 'PIX',
      debito: 'Débito',
      credito: 'Crédito',
      caderneta: 'Caderneta'
    }
    return formas[forma as keyof typeof formas] || forma
  }

  const getStatusBadge = (venda: VendaComRelacionamentos) => {
    if (venda.forma_pagamento === 'caderneta') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Caderneta
        </span>
      )
    }
    
    if (venda.valor_pago && venda.valor_pago > 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Pago
        </span>
      )
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Pendente
      </span>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-lg border p-4">
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (vendas.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 text-lg">Nenhuma venda registrada hoje</div>
        <div className="text-gray-400 text-sm mt-1">
          As vendas aparecerão aqui conforme forem registradas
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {vendas.map((venda) => (
        <div key={venda.id} className="bg-white rounded-lg border shadow-sm">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleExpansao(venda.id)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {vendasExpandidas.has(venda.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  
                  <div>
                    <div className="font-medium text-gray-900">
                      Venda #{venda.id}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatarData(venda.data)} às {formatarHora(venda.created_at)}
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    {getFormaPagamentoLabel(venda.forma_pagamento)}
                  </span>
                  {getStatusBadge(venda)}
                  {venda.clientes_caderneta && (
                    <span className="text-sm text-blue-600">
                      Cliente: {venda.clientes_caderneta.nome}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {formatarMoeda(venda.valor_total)}
                </div>
                {venda.valor_pago && venda.valor_pago > 0 && (
                  <div className="text-sm text-green-600">
                    Pago: {formatarMoeda(venda.valor_pago)}
                  </div>
                )}
                {venda.valor_debito && venda.valor_debito > 0 && (
                  <div className="text-sm text-yellow-600">
                    Débito: {formatarMoeda(venda.valor_debito)}
                  </div>
                )}
              </div>
            </div>

            {/* Observações */}
            {venda.observacoes && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <div className="text-sm text-gray-600">
                  <strong>Observações:</strong> {venda.observacoes}
                </div>
              </div>
            )}
          </div>

          {/* Detalhes dos Itens */}
          {vendasExpandidas.has(venda.id) && venda.venda_itens && (
            <div className="border-t bg-gray-50">
              <div className="p-4">
                <h4 className="font-medium text-gray-900 mb-3">Itens da Venda</h4>
                <div className="space-y-2">
                  {venda.venda_itens.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 px-3 bg-white rounded border">
                      <div>
                        <div className="font-medium text-gray-900">
                          Item #{item.item_id} ({item.tipo})
                        </div>
                        <div className="text-sm text-gray-500">
                          Quantidade: {item.quantidade}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatarMoeda(item.preco_unitario)} cada
                        </div>
                        <div className="text-sm text-gray-500">
                          Total: {formatarMoeda(item.preco_total)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
