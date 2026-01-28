'use client'

import { useEffect } from 'react'
import { Receita, Insumo, ItemPrecoVenda } from '@/types/gestao'
import { AutocompleteItem } from '@/types/selects'

interface PrecoModalProps {
  isOpen: boolean
  onClose: () => void
  editingPreco: ItemPrecoVenda | null
  formData: {
    item_id: string
    tipo: 'receita' | 'varejo'
    preco_venda: string
    margem_lucro: string
    preco_custo_unitario: string
    nome_item?: string
    custo_origem?: string
  }
  onFormChange: (field: string, value: string) => void
  onSubmit: (e: React.FormEvent) => void
  termoPesquisa: string
  onTermoChange: (termo: string) => void
  itensFiltrados: AutocompleteItem[]
  onSelecionarItem: (item: AutocompleteItem, tipo?: 'receita' | 'varejo') => void
  onMostrarTodos: () => void
  loadingDetalhes?: boolean
  loadingPesquisa?: boolean
  showSugestoes?: boolean
}

export default function PrecoModal({
  isOpen,
  onClose,
  editingPreco,
  formData,
  onFormChange,
  onSubmit,
  termoPesquisa,
  onTermoChange,
  itensFiltrados,
  onSelecionarItem,
  onMostrarTodos,
  loadingDetalhes = false,
  loadingPesquisa = false,
  showSugestoes = true
}: PrecoModalProps) {

  // Função para calcular margem de lucro baseada no preço de venda
  const calcularMargemLucro = (precoVenda: number, custoUnitario: number): number => {
    if (custoUnitario <= 0) return 0
    const lucro = precoVenda - custoUnitario
    return (lucro / precoVenda) * 100
  }

  // Função para calcular preço de venda baseado na margem de lucro
  const calcularPrecoVenda = (margemLucro: number, custoUnitario: number): number => {
    if (margemLucro <= 0) return custoUnitario
    return custoUnitario / (1 - (margemLucro / 100))
  }

  // Função para lidar com mudança no preço de venda
  const handlePrecoVendaChange = (value: string) => {
    onFormChange('preco_venda', value)
    // Calcular margem automaticamente se tivermos custo unitário
    if (value && formData.preco_custo_unitario) {
      const precoVenda = parseFloat(value)
      const custoUnitario = parseFloat(formData.preco_custo_unitario)
      if (precoVenda > 0 && custoUnitario > 0 && precoVenda > custoUnitario) {
        const margemCalculada = calcularMargemLucro(precoVenda, custoUnitario)
        onFormChange('margem_lucro', margemCalculada.toFixed(5))
      } else if (precoVenda <= custoUnitario) {
        // Limpar margem se o preço for menor ou igual ao custo
        onFormChange('margem_lucro', '')
      }
    }
  }

  // Ao selecionar um item na lista, delega ao parent a busca/preenchimento
  const handleSelecionarItemInterno = (item: AutocompleteItem) => {
    // passa o tipo atual para garantir que o parent busque na tabela correta
    onSelecionarItem(item, formData.tipo)
  }

  // Função para lidar com mudança na margem de lucro
  const handleMargemLucroChange = (value: string) => {
    onFormChange('margem_lucro', value)

    // Calcular preço automaticamente se tivermos custo unitário
    if (value && formData.preco_custo_unitario) {
      const margemLucro = parseFloat(value)
      const custoUnitario = parseFloat(formData.preco_custo_unitario)

      if (margemLucro >= 0 && custoUnitario > 0 && margemLucro < 100) {
        const precoCalculado = calcularPrecoVenda(margemLucro, custoUnitario)
        onFormChange('preco_venda', precoCalculado.toFixed(6))
      } else if (margemLucro >= 100) {
        // Limpar preço se a margem for 100% ou mais
        onFormChange('preco_venda', '')
      }
    }
  }

  // Função para lidar com mudança no custo unitário
  const handleCustoUnitarioChange = (value: string) => {
    onFormChange('preco_custo_unitario', value)

    // Recalcular margem se tivermos preço de venda
    if (formData.preco_venda && value) {
      const precoVenda = parseFloat(formData.preco_venda)
      const custoUnitario = parseFloat(value)

      if (precoVenda > 0 && custoUnitario > 0) {
        const margemCalculada = calcularMargemLucro(precoVenda, custoUnitario)
        onFormChange('margem_lucro', margemCalculada.toFixed(5))
      }
    }
  }

  // Recalcular automaticamente quando o custo unitário mudar (vindo do parent)
  useEffect(() => {
    if (formData.preco_custo_unitario && formData.preco_venda) {
      const precoVenda = parseFloat(formData.preco_venda)
      const custoUnitario = parseFloat(formData.preco_custo_unitario)
      
      if (precoVenda > 0 && custoUnitario > 0) {
        const margemCalculada = calcularMargemLucro(precoVenda, custoUnitario)
        // Só atualiza se for significativamente diferente para evitar loops ou sobrescrever digitação
        if (Math.abs(parseFloat(formData.margem_lucro || '0') - margemCalculada) > 0.01) {
          onFormChange('margem_lucro', margemCalculada.toFixed(5))
        }
      }
    }
  }, [formData.preco_custo_unitario])

  if (!isOpen) return null

  return (
    <div className="modal-container">
      <div className="modal-content modal-md bg-white rounded-2xl shadow-xl w-full flex flex-col">
        <div className="p-6 flex-1 overflow-y-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            {editingPreco ? 'Editar Preço de Venda' : 'Novo Preço de Venda'}
          </h2>

          <form id="preco-form" onSubmit={onSubmit} className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-900 mb-2">Tipo de Item</label>
              <select
                value={formData.tipo}
                onChange={(e) => onFormChange('tipo', e.target.value)}
                className="mt-1 block w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
              >
                <option value="varejo">Varejo</option>
                <option value="receita">Receita</option>
              </select>
            </div>

            <div>
              <label className="block text-lg font-medium text-gray-900 mb-2">Selecionar Item</label>
              {/* Só mostra o campo de busca/lista se tipo estiver selecionado */}
              {formData.tipo && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder={formData.tipo === 'varejo' ? 'Buscar produto do varejo...' : 'Buscar receita...'}
                    value={termoPesquisa}
                    onChange={(e) => onTermoChange(e.target.value)}
                    onFocus={onMostrarTodos}
                    className="mt-1 block w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
                    disabled={!formData.tipo}
                  />
                  {loadingPesquisa && (
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  {termoPesquisa && (
                    <button
                      type="button"
                      onClick={() => onTermoChange('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
              {/* Lista de itens filtrados, só mostra se tipo selecionado */}
              {/* Lista de sugestões só aparece se showSugestoes for true */}
              {formData.tipo && itensFiltrados.length > 0 && showSugestoes && (
                <div className="mt-3 max-h-40 overflow-y-auto border-2 border-gray-200 rounded-xl">
                  {itensFiltrados.map((item) => (
                    <div
                      key={`${item.table ?? 'item'}_${item.id}`}
                      onClick={() => handleSelecionarItemInterno(item)}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                    >
                      <div className="font-medium text-gray-900 text-base">{item.nome}</div>
                      {/* metadata condicional: mostrada somente se disponível nos dados de sugestão */}
                      <div className="text-sm text-gray-500 mt-1">
                        {('rendimento' in item) && (`Rendimento: ${(item as Receita).rendimento} ${(item as Receita).unidade_rendimento ?? ''}`)}
                        {('unidade' in item) && (`Unidade: ${(item as Insumo).unidade}`)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Campo oculto para o ID do item selecionado */}
              <input
                type="hidden"
                required
                value={formData.item_id}
                onChange={(e) => onFormChange('item_id', e.target.value)}
              />
              {/* Indicador de item selecionado */}
              {formData.item_id && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm text-green-800">
                    <strong>Item selecionado:</strong> {formData.nome_item || termoPesquisa}
                  </div>
                  {formData.tipo === 'varejo' && (() => {
                    const item = itensFiltrados.find(i => i.id.toString() === formData.item_id);
                    // Só mostra campos extras se o item for realmente do tipo produto do varejo
                    if (item && 'unidade' in item && 'categoria' in item) {
                      return <>
                        <div className="text-xs text-blue-700 mt-1">
                          Preço de custo: R$ {formData.preco_custo_unitario || '-'}
                        </div>
                        <div className="text-xs text-blue-700 mt-1">
                          Preço atual: R$ {formData.preco_venda || '-'}
                        </div>
                        <div className="text-xs text-blue-700 mt-1">
                          Categoria: {item.categoria ?? '-'}
                        </div>
                        <div className="text-xs text-blue-700 mt-1">
                          Unidade: {item.unidade ?? '-'}
                        </div>
                      </>;
                    }
                    return null;
                  })()}
                  {formData.tipo === 'receita' && (
                    <div className="text-xs text-green-600 mt-1">
                      Custo unitário: R$ {formData.preco_custo_unitario || '0.0000'}
                    </div>
                  )}
                </div>
              )}
              {/* Resumo dos cálculos */}
              {formData.item_id && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-700">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-xs text-blue-600 uppercase tracking-wide">Custo unitário</div>
                    <div className="mt-1 font-semibold text-xl text-blue-800">R$ {formData.preco_custo_unitario || '0.0000'}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs text-green-600 uppercase tracking-wide">Preço de venda</div>
                    <div className="mt-1 font-semibold text-xl text-green-800">
                      R$ {formData.preco_venda || '0.0000'}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Margem & lucro</div>
                    <div className="mt-1 font-semibold text-xl text-gray-800">
                      {formData.margem_lucro ? `${formData.margem_lucro}%` : '0.00%'}
                    </div>
                    {formData.preco_venda && formData.preco_custo_unitario && (
                      <div className={`mt-1 text-xs font-medium ${parseFloat(formData.preco_venda) >= parseFloat(formData.preco_custo_unitario) ? 'text-emerald-600' : 'text-red-600'}`}>
                        Lucro: R$ {(parseFloat(formData.preco_venda || '0') - parseFloat(formData.preco_custo_unitario || '0')).toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-lg font-medium text-gray-900 mb-2">Preço de Custo Unitário</label>
              <div className="relative">
                <div className="mt-1 block w-full px-4 py-3 bg-gray-100 border-2 border-gray-300 rounded-xl text-gray-900 text-base flex justify-between items-center">
                  {loadingDetalhes ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span>Calculando custo...</span>
                    </div>
                  ) : (
                    <>
                      <span>R$ {formData.preco_custo_unitario || '0.0000'}</span>
                      {formData.custo_origem && (
                        <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-md uppercase tracking-wider">
                          {formData.custo_origem}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {formData.tipo === 'receita'
                  ? 'Custo unitário calculado automaticamente (custo total ÷ rendimento)'
                  : 'Custo unitário determinado automaticamente pelo sistema'
                }
              </p>
            </div>

            <div>
              <label className="block text-lg font-medium text-gray-900 mb-2">
                Preço de Venda
                <span className="text-sm text-blue-600 ml-2">(calcula margem automaticamente)</span>
              </label>
              <input
                type="number"
                step="0.00001"
                min="0.00001"
                required
                value={formData.preco_venda}
                onChange={(e) => handlePrecoVendaChange(e.target.value)}
                placeholder="0.000000"
                className="mt-1 block w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
              />
              <p className="text-sm text-gray-500 mt-1">
                Digite o preço de venda (até 6 casas decimais) e a margem será calculada automaticamente
              </p>
            </div>

            <div>
              <label className="block text-lg font-medium text-gray-900 mb-2">
                Margem de Lucro (%)
                <span className="text-sm text-blue-600 ml-2">(calcula preço automaticamente)</span>
              </label>
              <input
                type="number"
                step="0.00001"
                min="0"
                max="100"
                value={formData.margem_lucro}
                onChange={(e) => handleMargemLucroChange(e.target.value)}
                placeholder="0.00000"
                className="mt-1 block w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base"
              />
              <p className="text-sm text-gray-500 mt-1">
                Digite a margem desejada (até 5 casas decimais) e o preço será calculado automaticamente
              </p>
            </div>
          </form>
        </div>

        {/* Botões fixos na parte inferior */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-b-2xl">
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="preco-form"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl text-base font-medium hover:bg-blue-700 transition-colors duration-200"
            >
              {editingPreco ? 'Atualizar' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
