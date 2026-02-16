'use client'

import type { ClienteCadernetaPDV } from '@/types/pdv'

export interface SelecionarClienteProps {
  aberto: boolean
  onFechar: () => void
  clientes: ClienteCadernetaPDV[]
  onSelecionar: (cliente: ClienteCadernetaPDV) => void
  carregando?: boolean
}

export default function SelecionarCliente({
  aberto,
  onFechar,
  clientes,
  onSelecionar,
  carregando = false,
}: SelecionarClienteProps) {
  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="selecionar-cliente-titulo"
      >
        <h2 id="selecionar-cliente-titulo" className="text-xl font-black text-gray-800 mb-4 shrink-0">
          Selecionar cliente (Caderneta)
        </h2>

        {carregando ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Carregando...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {clientes.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum cliente cadastrado.</p>
            ) : (
              clientes.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => {
                    onSelecionar(cliente)
                    onFechar()
                  }}
                  className="w-full p-4 text-left border border-blue-50 rounded-xl hover:bg-blue-50 transition flex justify-between items-center"
                >
                  <div>
                    <span className="font-black text-gray-800 block">{cliente.nome}</span>
                    {cliente.telefone && (
                      <span className="text-xs text-gray-500">{cliente.telefone}</span>
                    )}
                    {cliente.saldo_devedor != null && (
                      <span className="text-xs text-blue-600 font-bold block mt-1">
                        Saldo: R$ {cliente.saldo_devedor.toFixed(2)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        <div className="mt-4 shrink-0">
          <button
            type="button"
            onClick={onFechar}
            className="w-full py-2 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
