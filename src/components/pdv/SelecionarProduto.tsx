'use client'

import type { ProdutoPDV } from '@/types/pdv'

export interface SelecionarProdutoProps {
  produtos: ProdutoPDV[]
  onSelecionar: (produto: ProdutoPDV) => void
  filtro?: string
  /** Se true, mostra apenas produtos que passam no filtro (nome/código) */
  aplicarFiltro?: boolean
}

export default function SelecionarProduto({
  produtos,
  onSelecionar,
  filtro = '',
  aplicarFiltro = false,
}: SelecionarProdutoProps) {
  const lista =
    aplicarFiltro && filtro.trim()
      ? produtos.filter((p) => {
          const term = filtro.toLowerCase().trim()
          return (
            p.nome.toLowerCase().includes(term) ||
            (p.codigoBarras || '').toLowerCase().includes(term) ||
            (p.codigoBalanca || '').toLowerCase().includes(term) ||
            String(p.id).includes(term)
          )
        })
      : produtos

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto p-2">
      {lista.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelecionar(p)}
          className="p-4 border border-blue-100 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition text-left"
        >
          <div className="font-black text-gray-800 text-sm truncate">{p.nome}</div>
          <div className="text-xs text-gray-500 mt-1">
            {p.codigoBarras || p.codigoBalanca || `#${p.id}`}
            {p.estoque != null && ` • Est: ${p.estoque} ${p.unidade}`}
          </div>
          <div className="text-blue-600 font-black text-sm mt-1">
            R$ {p.preco.toFixed(2)}
          </div>
        </button>
      ))}
    </div>
  )
}
