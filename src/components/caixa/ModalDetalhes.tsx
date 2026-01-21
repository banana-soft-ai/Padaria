'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { CaixaDiario, Venda } from '@/lib/supabase'
import { X, DollarSign, ShoppingCart, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'

interface ModalDetalhesProps {
  caixa: CaixaDiario
  onClose: () => void
}

export default function ModalDetalhes({ caixa, onClose }: ModalDetalhesProps) {
  const [vendasHoje, setVendasHoje] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [vendasExpandidas, setVendasExpandidas] = useState<Set<number>>(new Set())

  useEffect(() => {
    carregarVendasHoje()
  }, [caixa])

  const carregarVendasHoje = async () => {
    try {
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          *,
          cliente:clientes_caderneta(nome, telefone)
        `)
        .eq('data', caixa.data)
        .order('hora', { ascending: false })

      if (error) throw error
      setVendasHoje(data || [])
    } catch (error) {
      console.error('Erro ao carregar vendas:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatarMoeda = (valor: number | undefined) => {
    if (valor === undefined || valor === null) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    })
  }

  const formatarHora = (hora: string) => {
    return new Date(hora).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    })
  }

  const obterFormaPagamentoLabel = (forma: string): string => {
    switch (forma) {
      case 'pix': return 'PIX'
      case 'debito': return 'Débito'
      case 'credito': return 'Crédito'
      case 'dinheiro': return 'Dinheiro'
      case 'caderneta': return 'Caderneta'
      default: return 'Dinheiro'
    }
  }

  const obterFormaPagamentoColor = (forma: string): string => {
    switch (forma) {
      case 'pix': return 'bg-green-100 text-green-800'
      case 'debito': return 'bg-blue-100 text-blue-800'
      case 'credito': return 'bg-purple-100 text-purple-800'
      case 'dinheiro': return 'bg-yellow-100 text-yellow-800'
      case 'caderneta': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  const calcularTotalPorForma = (forma: string) => {
    return vendasHoje
      .filter(v => v.forma_pagamento === forma)
      .reduce((sum, v) => sum + v.valor_pago, 0)
  }

  const alternarExpansaoVenda = (vendaId: number) => {
    const novasExpandidas = new Set(vendasExpandidas)
    if (novasExpandidas.has(vendaId)) {
      novasExpandidas.delete(vendaId)
    } else {
      novasExpandidas.add(vendaId)
    }
    setVendasExpandidas(novasExpandidas)
  }

  const vendaTemItens = (venda: Venda) => {
    return venda.itens && venda.itens.length > 0
  }

  const obterTipoItemLabel = (tipo: string): string => {
    return tipo === 'receita' ? 'Receita' : 'Produto'
  }

  const obterTipoItemColor = (tipo: string): string => {
    return tipo === 'receita' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
  }

  return (
    <div className="modal-container">
      <div className="modal-content modal-xl bg-white rounded-lg shadow-xl w-full max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-full mr-3">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Detalhes do Caixa</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Informações do Caixa */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900">Data</p>
              <p className="text-lg font-bold text-blue-900">{formatarData(caixa.data)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-900">Valor Inicial</p>
              <p className="text-lg font-bold text-green-900">{formatarMoeda(caixa.valor_abertura)}</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-900">Total Entradas</p>
              <p className="text-lg font-bold text-purple-900">{formatarMoeda(caixa.total_entradas)}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-900">Total Saídas</p>
              <p className="text-lg font-bold text-yellow-900">{formatarMoeda(caixa.valor_saidas)}</p>
            </div>
          </div>

          {/* Informações de Fechamento (se fechado) */}
          {caixa.status === 'fechado' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-red-900 mb-4">Informações de Fechamento</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Valor Final</p>
                  <p className="text-lg font-bold text-gray-900">{formatarMoeda(caixa.valor_fechamento)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Diferença Total</p>
                  <p className={`text-lg font-bold ${(caixa.diferenca || 0) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatarMoeda(caixa.diferenca)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Caderneta</p>
                  <p className="text-lg font-bold text-gray-900">{formatarMoeda(caixa.total_caderneta)}</p>
                </div>
                {caixa.data_fechamento && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Fechado às</p>
                    <p className="text-lg font-bold text-gray-900">{formatarHora(caixa.data_fechamento)}</p>
                  </div>
                )}
              </div>

              {/* Comparação por Forma de Pagamento */}
              {(caixa.valor_dinheiro_informado !== undefined || caixa.valor_pix_informado !== undefined ||
                caixa.valor_debito_informado !== undefined || caixa.valor_credito_informado !== undefined) && (
                  <div className="border-t pt-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Comparação por Forma de Pagamento</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-600 mb-1">Dinheiro</p>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Sistema: {formatarMoeda(caixa.total_dinheiro)}</p>
                          <p className="text-sm text-gray-600">Informado: {formatarMoeda(caixa.valor_dinheiro_informado)}</p>
                          <p className={`text-sm font-semibold ${(caixa.diferenca_dinheiro || 0) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Diferença: {formatarMoeda(caixa.diferenca_dinheiro)}
                          </p>
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-600 mb-1">PIX</p>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Sistema: {formatarMoeda(caixa.total_pix)}</p>
                          <p className="text-sm text-gray-600">Informado: {formatarMoeda(caixa.valor_pix_informado)}</p>
                          <p className={`text-sm font-semibold ${(caixa.diferenca_pix || 0) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Diferença: {formatarMoeda(caixa.diferenca_pix)}
                          </p>
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-600 mb-1">Débito</p>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Sistema: {formatarMoeda(caixa.total_debito)}</p>
                          <p className="text-sm text-gray-600">Informado: {formatarMoeda(caixa.valor_debito_informado)}</p>
                          <p className={`text-sm font-semibold ${(caixa.diferenca_debito || 0) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Diferença: {formatarMoeda(caixa.diferenca_debito)}
                          </p>
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-600 mb-1">Crédito</p>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Sistema: {formatarMoeda(caixa.total_credito)}</p>
                          <p className="text-sm text-gray-600">Informado: {formatarMoeda(caixa.valor_credito_informado)}</p>
                          <p className={`text-sm font-semibold ${(caixa.diferenca_credito || 0) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Diferença: {formatarMoeda(caixa.diferenca_credito)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Resumo por Forma de Pagamento */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo por Forma de Pagamento</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">PIX</p>
                <p className="text-lg font-bold text-green-600">{formatarMoeda(calcularTotalPorForma('pix'))}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Débito</p>
                <p className="text-lg font-bold text-blue-600">{formatarMoeda(calcularTotalPorForma('debito'))}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Crédito</p>
                <p className="text-lg font-bold text-purple-600">{formatarMoeda(calcularTotalPorForma('credito'))}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Dinheiro</p>
                <p className="text-lg font-bold text-yellow-600">{formatarMoeda(calcularTotalPorForma('dinheiro'))}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Caderneta</p>
                <p className="text-lg font-bold text-red-600">{formatarMoeda(calcularTotalPorForma('caderneta'))}</p>
              </div>
            </div>
          </div>

          {/* Lista de Vendas */}
          <div>
            <div className="flex items-center mb-4">
              <ShoppingCart className="h-5 w-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Vendas do Dia ({vendasHoje.length})</h3>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">Carregando vendas...</p>
              </div>
            ) : vendasHoje.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-lg text-gray-500">Nenhuma venda registrada hoje</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                        Detalhes
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                        Hora
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                        Pago
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                        Débito
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                        Pagamento
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                        Cliente
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vendasHoje.map((venda) => (
                      <>
                        <tr key={venda.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {vendaTemItens(venda) && (
                              <button
                                onClick={() => alternarExpansaoVenda(venda.id)}
                                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                title="Ver detalhes dos itens"
                              >
                                {vendasExpandidas.has(venda.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {venda.hora ? formatarHora(venda.hora) : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatarMoeda(venda.valor_total)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatarMoeda(venda.valor_pago)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatarMoeda(venda.valor_debito)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${obterFormaPagamentoColor(venda.forma_pagamento)}`}>
                              {obterFormaPagamentoLabel(venda.forma_pagamento)}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {venda.cliente ? (
                              <div>
                                <div className="text-sm font-medium text-gray-900">{venda.cliente.nome}</div>
                                <div className="text-xs text-gray-500">{venda.cliente.telefone}</div>
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>

                        {/* Linha expandida com detalhes dos itens */}
                        {vendasExpandidas.has(venda.id) && vendaTemItens(venda) && (
                          <tr key={`${venda.id}-detalhes`} className="bg-gray-50">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="ml-6">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Itens da Venda:</h4>
                                <div className="space-y-2">
                                  {venda.itens?.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                                      <div className="flex items-center space-x-3">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${obterTipoItemColor(item.tipo)}`}>
                                          {obterTipoItemLabel(item.tipo)}
                                        </span>
                                        <span className="text-sm font-medium text-gray-900">
                                          {(item as { nome_produto?: string }).nome_produto || `${item.tipo === 'receita' ? 'Receita' : 'Produto'} ${item.item_id}`}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                                        <span>Qtd: {item.quantidade}</span>
                                        <span>Preço: {formatarMoeda(item.preco_unitario)}</span>
                                        <span className="font-medium">Total: {formatarMoeda((item as { preco_total?: number }).preco_total || item.preco_unitario * item.quantidade)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
