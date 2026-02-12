'use client'

import React, { useState } from 'react'
import { Eye, Calendar } from 'lucide-react'
import { RelatorioVendas, RankingVendas } from '@/types/gestao'

export type FiltroPeriodoVendas = 'hoje' | 'mes' | '7dias' | '30dias' | 'personalizado'

interface VendasTabProps {
  filtro: FiltroPeriodoVendas
  dataInicio: string
  dataFim: string
  dataInicioCustom: string
  dataFimCustom: string
  onFiltroChange: (filtro: FiltroPeriodoVendas) => void
  onDataInicioCustomChange: (value: string) => void
  onDataFimCustomChange: (value: string) => void
  relatorioVendas: RelatorioVendas[]
  rankingVendas: RankingVendas[]
  metricasResumo: {
    unidadesVendidas: number
    receitaTotal: number
    ticketMedio: number
    totalPix: number
    totalDinheiro: number
    totalDebito: number
    totalCredito: number
    totalCaderneta: number
    valorReceber: number
  }
}

function formatarDataBR(ymd: string): string {
  const [ano, mes, dia] = ymd.split('-')
  return `${dia}/${mes}/${ano}`
}

const VendasTab: React.FC<VendasTabProps> = ({
  filtro,
  dataInicio,
  dataFim,
  dataInicioCustom,
  dataFimCustom,
  onFiltroChange,
  onDataInicioCustomChange,
  onDataFimCustomChange,
  relatorioVendas,
  rankingVendas,
  metricasResumo
}) => {
  const [ordenacao, setOrdenacao] = useState<{ coluna: string; direcao: 'asc' | 'desc' }>({ coluna: 'item', direcao: 'asc' });
  const [modalDetalhe, setModalDetalhe] = useState<{ open: boolean; produto: any | null }>({ open: false, produto: null });

  const alternarOrdenacao = (coluna: string) => {
    setOrdenacao(prev => ({
      coluna,
      direcao: prev.coluna === coluna && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
  };

  const ordenarDados = (dados: any[]) => {
    return [...dados].sort((a, b) => {
      let valorA, valorB;
      switch (ordenacao.coluna) {
        case 'item':
          valorA = a.item.toLowerCase();
          valorB = b.item.toLowerCase();
          break;
        case 'tipo':
          valorA = a.tipo;
          valorB = b.tipo;
          break;
        case 'preco':
          valorA = a.mediaVendas;
          valorB = b.mediaVendas;
          break;
        case 'quantidade':
          valorA = a.quantidadeTotal;
          valorB = b.quantidadeTotal;
          break;
        case 'faturamento':
          valorA = a.receitaTotal;
          valorB = b.receitaTotal;
          break;
        default:
          valorA = a.item;
          valorB = b.item;
      }
      if (typeof valorA === 'string' && typeof valorB === 'string') {
        if (ordenacao.direcao === 'asc') {
          return valorA.localeCompare(valorB, 'pt-BR');
        } else {
          return valorB.localeCompare(valorA, 'pt-BR');
        }
      } else if (typeof valorA === 'number' && typeof valorB === 'number') {
        if (ordenacao.direcao === 'asc') {
          return valorA - valorB;
        } else {
          return valorB - valorA;
        }
      }
      return 0;
    });
  };

  const descricaoPeriodo =
    filtro === 'personalizado'
      ? `${formatarDataBR(dataInicio)} até ${formatarDataBR(dataFim)}`
      : filtro === 'hoje'
        ? 'Hoje'
        : filtro === 'mes'
          ? 'Este mês'
          : filtro === '7dias'
            ? '7 dias'
            : filtro === '30dias'
              ? '30 dias'
              : 'Período'

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-gray-900">Relatórios de Vendas</h2>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Resumo de Vendas</h3>
              <p className="text-sm text-gray-600 mt-1">
                Período: {descricaoPeriodo}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                {(['hoje', 'mes', '7dias', '30dias'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => onFiltroChange(f)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filtro === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    {f === 'hoje' && 'Hoje'}
                    {f === 'mes' && 'Este mês'}
                    {f === '7dias' && '7 dias'}
                    {f === '30dias' && '30 dias'}
                  </button>
                ))}
              </div>
              {filtro === 'personalizado' ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={dataInicioCustom}
                    onChange={(e) => onDataInicioCustomChange(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="text-gray-500 text-sm">até</span>
                  <input
                    type="date"
                    value={dataFimCustom}
                    onChange={(e) => onDataFimCustomChange(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              ) : (
                <button
                  onClick={() => onFiltroChange('personalizado')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Calendar className="h-4 w-4" />
                  Personalizado
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-800 text-base">Unidades Vendidas:</span>
                <span className="font-semibold text-blue-600">
                  {Number(metricasResumo.unidadesVendidas).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-800 text-base">Receita Total:</span>
                <span className="font-semibold text-green-600">
                  R$ {metricasResumo.receitaTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-800 text-base">Ticket Médio:</span>
                <span className="font-semibold text-purple-600">
                  R$ {metricasResumo.ticketMedio.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-800 text-base">PIX:</span>
                <span className="font-semibold text-green-600">
                  R$ {metricasResumo.totalPix.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-800 text-base">Dinheiro:</span>
                <span className="font-semibold text-green-600">
                  R$ {metricasResumo.totalDinheiro.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-800 text-base">Débito:</span>
                <span className="font-semibold text-green-600">
                  R$ {metricasResumo.totalDebito.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-800 text-base">Crédito:</span>
                <span className="font-semibold text-green-600">
                  R$ {metricasResumo.totalCredito.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-800 text-base">Caderneta:</span>
                <span className="font-semibold text-orange-600">
                  R$ {metricasResumo.totalCaderneta.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-800 text-base">Valor a Receber:</span>
                <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                  R$ {metricasResumo.valorReceber.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 bg-white p-6 rounded-xl shadow border border-gray-200">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Análise Financeira por Produto</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[600px] w-full divide-y divide-gray-200 border border-gray-200 rounded-xl shadow-sm bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap" onClick={() => alternarOrdenacao('item')}>
                  <div className="flex items-center space-x-1">
                    <span>Produto</span>
                    {ordenacao.coluna === 'item' && (<span className="text-blue-600">{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap" onClick={() => alternarOrdenacao('tipo')}>
                  <div className="flex items-center space-x-1">
                    <span>Tipo</span>
                    {ordenacao.coluna === 'tipo' && (<span className="text-blue-600">{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap" onClick={() => alternarOrdenacao('preco')}>
                  <div className="flex items-center space-x-1">
                    <span>Preço Unitário</span>
                    {ordenacao.coluna === 'preco' && (<span className="text-blue-600">{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>
                {/* QTD. VENDIDA centralizada */}
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap" onClick={() => alternarOrdenacao('quantidade')}>
                  <div className="flex items-center justify-center space-x-1">
                    <span>Qtd. Vendida</span>
                    {ordenacao.coluna === 'quantidade' && (<span className="text-blue-600">{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap" onClick={() => alternarOrdenacao('faturamento')}>
                  <div className="flex items-center space-x-1">
                    <span>Faturamento</span>
                    {ordenacao.coluna === 'faturamento' && (<span className="text-blue-600">{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase whitespace-nowrap">Ver</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {ordenarDados(relatorioVendas).map((produto, index) => (
                <tr key={index} className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-2 align-middle text-sm font-medium text-gray-900 whitespace-nowrap">{produto.item}</td>
                  <td className="px-4 py-2 align-middle whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${produto.tipo === 'receita' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{produto.tipo === 'receita' ? 'Receita' : 'Produto'}</span>
                  </td>
                  <td className="px-4 py-2 align-middle text-sm text-gray-900 whitespace-nowrap"><span className="font-medium">R$ {produto.mediaVendas.toFixed(2)}</span></td>
                  {/* Alinhamento central na QTD */}
                  <td className="px-4 py-2 align-middle text-center text-sm text-gray-900 whitespace-nowrap">
                    <span className="font-medium">{produto.quantidadeTotal}</span>
                  </td>
                  <td className="px-4 py-2 align-middle text-right text-sm font-medium text-green-600 whitespace-nowrap">R$ {produto.receitaTotal.toFixed(2)}</td>
                  <td className="px-4 py-2 align-middle text-center whitespace-nowrap">
                    <button title="Ver detalhes" className="p-2 rounded bg-gray-100 hover:bg-blue-100 text-blue-700 transition" onClick={() => setModalDetalhe({ open: true, produto })}>
                      <Eye className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr className="font-semibold">
                <td className="px-4 py-2 text-sm text-gray-900">TOTAL GERAL</td>
                <td className="px-4 py-2 text-sm text-gray-900"></td>
                <td className="px-4 py-2 text-sm text-gray-900"></td>
                {/* Alinhamento central na QTD total */}
                <td className="px-4 py-2 text-center text-sm text-gray-900">
                  {ordenarDados(relatorioVendas).reduce((sum, produto) => sum + produto.quantidadeTotal, 0)}
                </td>
                <td className="px-4 py-2 text-right text-sm text-green-600">
                  R$ {ordenarDados(relatorioVendas).reduce((sum, produto) => sum + produto.receitaTotal, 0).toFixed(2)}
                </td>
                <td className="px-4 py-2 text-center"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        {/* Modal de Detalhes */}
        {modalDetalhe.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full relative">
              <button className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xl font-bold"
                onClick={() => setModalDetalhe({ open: false, produto: null })} title="Fechar">×</button>
              <h3 className="text-xl font-bold mb-4 text-blue-800 flex items-center gap-2">
                <Eye className="h-5 w-5" /> Detalhes do Produto Vendido
              </h3>
              <div className="space-y-2">
                <div><span className="font-semibold">Produto:</span> {modalDetalhe.produto?.item}</div>
                <div><span className="font-semibold">Tipo:</span> {modalDetalhe.produto?.tipo === 'receita' ? 'Receita' : 'Produto'}</div>
                <div><span className="font-semibold">Preço Unitário:</span> R$ {modalDetalhe.produto?.mediaVendas?.toFixed(2)}</div>
                <div><span className="font-semibold">Quantidade Vendida:</span> {modalDetalhe.produto?.quantidadeTotal}</div>
                <div><span className="font-semibold">Faturamento:</span> R$ {modalDetalhe.produto?.receitaTotal?.toFixed(2)}</div>
              </div>
              <div className="mt-4 text-right">
                <button className="px-3 py-2 rounded bg-blue-600 text-white font-bold hover:bg-blue-800 transition"
                  onClick={() => setModalDetalhe({ open: false, produto: null })}>Fechar</button>
              </div>
            </div>
          </div>
        )}
        {relatorioVendas.length === 0 && (
          <div className="text-center py-4">
            <div className="text-gray-400 text-sm">Nenhum produto com vendas encontrado para o período selecionado</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VendasTab;