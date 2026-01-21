'use client'

import { TrendingUp, TrendingDown, DollarSign, Calculator, Brain } from 'lucide-react'
import { MargemLucro, InsightAI } from '@/types/gestao'

interface DashboardTabProps {
  fluxoCaixa: Array<{ tipo: string; valor: number }>
  margensLucro: MargemLucro[]
  insightsAI: InsightAI[]
  loadingAI: boolean
  onGerarInsights: () => void
}

export default function DashboardTab({ 
  fluxoCaixa, 
  margensLucro, 
  insightsAI, 
  loadingAI, 
  onGerarInsights 
}: DashboardTabProps) {
  const totalEntradas = fluxoCaixa
    .filter(f => f.tipo === 'entrada')
    .reduce((sum, f) => sum + f.valor, 0)

  const totalSaidas = fluxoCaixa
    .filter(f => f.tipo === 'saida')
    .reduce((sum, f) => sum + f.valor, 0)

  const saldoAtual = totalEntradas - totalSaidas

  return (
    <>
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-medium text-gray-600">Total Entradas</p>
              <p className="text-3xl font-bold text-green-600 mt-3">
                R$ {totalEntradas.toFixed(2)}
              </p>
            </div>
            <div className="p-6 rounded-full bg-green-500 bg-opacity-10">
              <TrendingUp className="h-12 w-12 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-medium text-gray-600">Total Saídas</p>
              <p className="text-3xl font-bold text-red-600 mt-3">
                R$ {totalSaidas.toFixed(2)}
              </p>
            </div>
            <div className="p-6 rounded-full bg-red-500 bg-opacity-10">
              <TrendingDown className="h-12 w-12 text-red-500" />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-medium text-gray-600">Saldo Atual</p>
              <p className={`text-3xl font-bold mt-3 ${saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {saldoAtual.toFixed(2)}
              </p>
            </div>
            <div className="p-6 rounded-full bg-blue-500 bg-opacity-10">
              <DollarSign className="h-12 w-12 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-medium text-gray-600">Margem Média</p>
              <p className="text-3xl font-bold text-purple-600 mt-3">
                {margensLucro.length > 0 ? (margensLucro.reduce((sum, item) => sum + item.margem, 0) / margensLucro.length).toFixed(1) : 0}%
              </p>
            </div>
            <div className="p-6 rounded-full bg-purple-500 bg-opacity-10">
              <Calculator className="h-12 w-12 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Insights da IA */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Insights da IA</h2>
          <button
            onClick={onGerarInsights}
            disabled={loadingAI}
            className="flex items-center space-x-3 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:bg-gray-400 transition-colors duration-200 text-base"
          >
            <Brain className="h-5 w-5" />
            <span>{loadingAI ? 'Analisando...' : 'Gerar Insights'}</span>
          </button>
        </div>
        
        {insightsAI.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {insightsAI.map((insight, index) => (
              <div key={index} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 text-lg">{insight.titulo}</h3>
                  <span className={`text-sm px-3 py-2 rounded-full font-medium ${
                    insight.prioridade === 'alta' ? 'bg-red-100 text-red-800' :
                    insight.prioridade === 'media' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {insight.prioridade}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-4">{insight.descricao}</p>
                <p className="text-sm font-medium text-blue-600">{insight.recomendacao}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 text-center">
            <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600 text-lg">Clique em &quot;Gerar Insights&quot; para obter recomendações da IA</p>
          </div>
        )}
      </div>

      {/* Margens de Lucro */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Margens de Lucro</h2>
        <div className="table-wrapper">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                  Custo
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                  Receita
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                  Lucro
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                  Margem
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {margensLucro.map((margem, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {margem.item}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-2 text-sm font-semibold rounded-full ${
                      margem.tipo === 'receita' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {margem.tipo === 'receita' ? 'Receita' : 'Varejo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    R$ {margem.custo.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    R$ {margem.receita.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    R$ {margem.lucro.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-2 text-sm font-semibold rounded-full ${
                      margem.margem >= 30 ? 'bg-green-100 text-green-800' :
                      margem.margem >= 15 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {margem.margem.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
