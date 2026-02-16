'use client'

import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react'
import type { ItemCarrinhoPDV } from '@/types/pdv'

export interface CarrinhoProps {
  itens: ItemCarrinhoPDV[]
  onAlterarQuantidade: (itemId: number, delta: number) => void
  onRemoverItem: (itemId: number) => void
  lastAddedItem?: ItemCarrinhoPDV | null
  onLimpar?: () => void
  onFinalizar?: () => void
  totalVenda: number
  /** Botão "Limpar venda" visível */
  showLimpar?: boolean
}

export default function Carrinho({
  itens,
  onAlterarQuantidade,
  onRemoverItem,
  lastAddedItem,
  totalVenda,
  showLimpar = true,
  onLimpar,
  onFinalizar,
}: CarrinhoProps) {
  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden flex flex-col">
      {lastAddedItem && (
        <div className="p-4 border-b border-blue-100 bg-gradient-to-r from-white to-blue-50 flex items-center gap-4">
          <div className="w-16 h-16 flex items-center justify-center bg-blue-600 text-white rounded-xl text-3xl font-black">
            {String(lastAddedItem.nome || '').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold text-gray-500 uppercase">
              Último adicionado
            </div>
            <div className="text-lg font-black text-gray-900 truncate">
              {lastAddedItem.nome}
            </div>
          </div>
          <div className="text-blue-600 font-black">
            R$ {Number(lastAddedItem.preco).toFixed(2)}
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center font-black text-blue-800 uppercase text-[10px] tracking-widest shrink-0">
        <span className="w-12 flex justify-center">
          <ShoppingCart className="h-4 w-4" />
        </span>
        <span className="flex-1">PRODUTO</span>
        <span className="w-24 text-center">Unit</span>
        <span className="w-32 text-center">Qtd</span>
        <span className="w-24 text-right">Total</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {itens.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 italic">
            <ShoppingCart className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-xl opacity-20 font-black uppercase">
              Carrinho Vazio
            </p>
          </div>
        ) : (
          itens.map((item, idx) => {
            const isPeso = item.unidade === 'kg' || item.unidade === 'g'
            const delta = isPeso ? 0.1 : 1
            return (
              <div
                key={item.id}
                className="flex items-center p-3 bg-white rounded-2xl border border-blue-50 shadow-sm"
              >
                <span className="w-12 text-[10px] font-black text-blue-200">
                  #{idx + 1}
                </span>
                <div className="flex-1">
                  <span className="font-black block text-gray-800 text-sm leading-tight">
                    {item.nome}
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold uppercase">
                    REF: {item.id}
                  </span>
                </div>
                <div className="w-24 text-center text-xs font-bold text-gray-400">
                  {isPeso ? 'R$/kg' : 'R$'} {item.preco.toFixed(2)}
                </div>
                <div className="w-32 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAlterarQuantidade(item.id, -delta)}
                    className="w-8 h-8 bg-blue-50 rounded-xl text-blue-600 flex items-center justify-center hover:bg-blue-100"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-black text-sm text-gray-700 w-12 text-center">
                    {isPeso
                      ? `${Number(item.qtdCarrinho).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
                      : item.qtdCarrinho}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAlterarQuantidade(item.id, delta)}
                    className="w-8 h-8 bg-blue-50 rounded-xl text-blue-600 flex items-center justify-center hover:bg-blue-100"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="w-24 text-right font-black text-blue-600 text-sm">
                  R$ {(item.preco * item.qtdCarrinho).toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoverItem(item.id)}
                  className="ml-2 text-red-400 hover:text-red-600"
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {showLimpar && onLimpar && itens.length > 0 && (
        <div className="p-4 border-t border-blue-100 shrink-0">
          <button
            type="button"
            onClick={onLimpar}
            className="w-full py-2 bg-black text-white font-bold text-[10px] uppercase hover:bg-gray-800 transition rounded-lg"
          >
            limpar venda atual
          </button>
        </div>
      )}
    </div>
  )
}
