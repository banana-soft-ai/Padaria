'use client'

import { CaixaDiario } from '@/lib/supabase'
import { DollarSign, Clock, Calendar, TrendingUp, TrendingDown } from 'lucide-react'

interface CaixaStatusProps {
  caixa: CaixaDiario
}

export default function CaixaStatus({ caixa }: CaixaStatusProps) {
  // DEBUG: Log dos dados recebidos
  console.log('🔍 CaixaStatus recebeu:', {
    id: caixa.id,
    status: caixa.status,
    total_entradas: caixa.total_entradas,
    total_caderneta: caixa.total_caderneta,
    total_vendas: caixa.total_vendas,
    valor_abertura: caixa.valor_abertura
  })

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

  // Total de vendas (entradas reais + caderneta)
  const totalVendas = caixa.total_vendas || (caixa.total_entradas || 0) + (caixa.total_caderneta || 0)

  return (
    <div className="space-y-4">
      {/* Informações básicas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-blue-900">Valor Inicial</p>
              <p className="text-lg font-bold text-blue-900">{formatarMoeda(caixa.valor_abertura)}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-green-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-green-900">Data</p>
              <p className="text-lg font-bold text-green-900">{formatarData(caixa.data)}</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center">
            <Clock className="h-5 w-5 text-purple-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-purple-900">Aberto às</p>
              <p className="text-lg font-bold text-purple-900">
                {caixa.data_abertura ? formatarHora(caixa.data_abertura) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Totais de vendas (sempre mostrar quando caixa aberto) */}
      {caixa.status === 'aberto' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Resumo do Dia</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-600">Total Entradas</p>
              <p className="text-sm font-semibold text-gray-900">{formatarMoeda(caixa.total_entradas)}</p>
              <p className="text-xs text-gray-500">DEBUG: {caixa.total_entradas}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Total Caderneta</p>
              <p className="text-sm font-semibold text-gray-900">{formatarMoeda(caixa.total_caderneta)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Total Vendas</p>
              <p className="text-sm font-semibold text-gray-900">{formatarMoeda(totalVendas)}</p>
              <p className="text-xs text-gray-500">(Entradas + Caderneta)</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Valor Esperado</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatarMoeda((caixa.valor_abertura || 0) + (caixa.total_dinheiro || 0) - (caixa.valor_saidas || 0) - (caixa.total_caderneta || 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detalhes por forma de pagamento (sempre mostrar quando caixa aberto) */}
      {caixa.status === 'aberto' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Por Forma de Pagamento</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-600">Dinheiro</p>
              <p className="text-sm font-semibold text-gray-900">{formatarMoeda(caixa.total_dinheiro)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">PIX</p>
              <p className="text-sm font-semibold text-gray-900">{formatarMoeda(caixa.total_pix)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Débito</p>
              <p className="text-sm font-semibold text-gray-900">{formatarMoeda(caixa.total_debito)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Crédito</p>
              <p className="text-sm font-semibold text-gray-900">{formatarMoeda(caixa.total_credito)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Informações de fechamento (se fechado) */}
      {caixa.status === 'fechado' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-sm font-medium text-red-900">Caixa Fechado</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600">Valor Final</p>
              <p className="text-sm font-semibold text-gray-900">{formatarMoeda(caixa.valor_fechamento)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Diferença</p>
              <p className={`text-sm font-semibold ${(caixa.diferenca || 0) === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatarMoeda(caixa.diferenca)}
              </p>
            </div>
            {caixa.data_fechamento && (
              <div>
                <p className="text-xs text-gray-600">Fechado às</p>
                <p className="text-sm font-semibold text-gray-900">{formatarHora(caixa.data_fechamento)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
