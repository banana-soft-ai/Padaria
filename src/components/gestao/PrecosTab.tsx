'use client'

import React, { useMemo, useState } from 'react'
import type { ItemPrecoVenda } from '@/types/gestao'

interface PrecosTabProps {
  precosVenda: ItemPrecoVenda[]
  onShowModal?: () => void
  onEditPreco?: (preco: ItemPrecoVenda) => void
  onDeletePreco?: (id: number) => void
  onAplicarPrecos?: (precos: ItemPrecoVenda[]) => void
}

export default function PrecosTab({
  precosVenda,
  onShowModal,
  onEditPreco,
  onDeletePreco,
  onAplicarPrecos
}: PrecosTabProps) {
  const [showConfirmAplicar, setShowConfirmAplicar] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [ordenarPor, setOrdenarPor] = useState<'itemNome' | 'preco_venda' | 'preco_custo_unitario'>('itemNome')
  const [ordemAsc, setOrdemAsc] = useState(true)

  const dadosFiltradosOrdenados = useMemo(() => {
    const busca = filtro.trim().toLowerCase()
    let dados = precosVenda || []

    if (busca.length > 0) {
      dados = dados.filter(d =>
        (String(d.itemNome || '')).toLowerCase().includes(busca) ||
        String(d.item_id).includes(busca)
      )
    }

    const ordenados = [...dados].sort((a, b) => {
      const aKey = (a as any)[ordenarPor]
      const bKey = (b as any)[ordenarPor]
      if (aKey == null && bKey == null) return 0
      if (aKey == null) return ordemAsc ? -1 : 1
      if (bKey == null) return ordemAsc ? 1 : -1

      if (typeof aKey === 'number' && typeof bKey === 'number') {
        return ordemAsc ? aKey - bKey : bKey - aKey
      }

      return ordemAsc
        ? String(aKey).localeCompare(String(bKey))
        : String(bKey).localeCompare(String(aKey))
    })

    return ordenados
  }, [precosVenda, filtro, ordenarPor, ordemAsc])

  const linhasValidas = useMemo(
    () => dadosFiltradosOrdenados.filter(p => p !== null && p !== undefined),
    [dadosFiltradosOrdenados]
  )

  const estoqueTotal = useMemo(
    () => linhasValidas.reduce((acc, p) => acc + (Number(p.estoque || 0)), 0),
    [linhasValidas]
  )

  const margemMedia = useMemo(() => {
    const margens = linhasValidas
      .map(p => {
        const pv = Number(p.preco_venda || 0)
        const custo = Number(p.preco_custo_unitario || 0)
        if (pv <= 0) return null
        return ((pv - custo) / pv) * 100
      })
      .filter((v): v is number => v != null)
    if (!margens.length) return '0%'
    const media = margens.reduce((s, v) => s + v, 0) / margens.length
    return `${media.toFixed(1)}%`
  }, [linhasValidas])

  function alternarOrdenacao(chave: typeof ordenarPor) {
    if (chave === ordenarPor) {
      setOrdemAsc(!ordemAsc)
    } else {
      setOrdenarPor(chave)
      setOrdemAsc(true)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <input
            placeholder="Filtrar itens..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
          <button
            type="button"
            onClick={() => { setFiltro(''); setOrdenarPor('itemNome'); setOrdemAsc(true) }}
            className="px-3 py-2 bg-gray-100 rounded text-sm"
          >
            Limpar
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">
            Estoque total: <span className="font-semibold">{estoqueTotal}</span>
          </div>
          <div className="text-sm text-gray-600">
            Margem média: <span className="font-semibold">{margemMedia}</span>
          </div>
          <button
            onClick={onShowModal}
            className="px-3 py-2 bg-violet-600 text-white rounded-md text-sm"
          >
            + Novo
          </button>
          <>
            <button
              onClick={() => {
                if (!onAplicarPrecos) return
                setShowConfirmAplicar(true)
              }}
              className="px-3 py-2 bg-green-600 text-white rounded-md text-sm"
            >
              Aplicar no Estoque
            </button>

            {showConfirmAplicar && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirmAplicar(false)} />
                <div className="bg-white rounded-lg shadow-lg z-10 max-w-lg mx-4 p-6">
                  <h3 className="text-lg font-semibold mb-2">Confirmar ação</h3>
                  <p className="text-sm text-gray-700 mb-4">Deseja aplicar o preço no estoque? Isso atualizará o preço de varejo/ receitas no estoque.</p>
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-3 py-2 bg-gray-100 rounded"
                      onClick={() => setShowConfirmAplicar(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="px-3 py-2 bg-green-600 text-white rounded"
                      onClick={() => {
                        setShowConfirmAplicar(false)
                        onAplicarPrecos && onAplicarPrecos(dadosFiltradosOrdenados)
                      }}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="text-left text-xs text-gray-600 uppercase">
              <th className="px-3 py-2 cursor-pointer" onClick={() => alternarOrdenacao('itemNome')}>Item</th>
              <th className="px-3 py-2 cursor-pointer" onClick={() => alternarOrdenacao('preco_venda')}>Preço Venda</th>
              <th className="px-3 py-2 cursor-pointer" onClick={() => alternarOrdenacao('preco_custo_unitario')}>Custo Unit.</th>
              <th className="px-3 py-2">Estoque</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-800">
            {dadosFiltradosOrdenados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">Nenhum preço cadastrado</td>
              </tr>
            )}

            {dadosFiltradosOrdenados.map(p => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{p.itemNome || `#${p.item_id}`}</div>
                  <div className="text-xs text-gray-500">{p.categoria ?? ''}</div>
                </td>
                <td className="px-3 py-2">R$ {Number(p.preco_venda || 0).toFixed(2)}</td>
                <td className="px-3 py-2">R$ {Number(p.preco_custo_unitario || 0).toFixed(4)}</td>
                <td className="px-3 py-2">{Number(p.estoque ?? 0)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEditPreco && onEditPreco(p)}
                      className="px-2 py-1 text-xs bg-yellow-100 rounded"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        if (!onDeletePreco) return
                        onDeletePreco(p.id)
                      }}
                      className="px-2 py-1 text-xs bg-red-100 rounded"
                    >
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}