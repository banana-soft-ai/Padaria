'use client'

import { CaixaDiario } from '@/types/gestao'
import { Venda } from '@/lib/supabase'

interface CaixaResumoProps {
  caixaHoje: CaixaDiario | null
  vendasHoje: Venda[]
}

export default function CaixaResumo({ caixaHoje, vendasHoje }: CaixaResumoProps) {
  const formatarMoeda = (valor: number | undefined) => {
    if (valor === undefined || valor === null) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  if (!caixaHoje) return null

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Resumo do Dia</h3>
      
      {/* Resumo Consolidado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-800">Total de Vendas:</span>
            <span className="text-2xl font-bold text-gray-900">
              {formatarMoeda(caixaHoje.total_vendas || 0)}
            </span>
          </div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-800">Quantidade de Vendas:</span>
            <span className="text-2xl font-bold text-gray-900">
              {vendasHoje.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
