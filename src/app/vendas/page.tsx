'use client'

import { useEffect, useState } from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import SistemaCaixa from '@/components/SistemaCaixa'
import ModalVenda from '@/components/vendas/ModalVenda'
import ListaVendas from '@/components/vendas/ListaVendas'
import { useVendas } from '@/hooks/useVendas'
import { ShoppingCart, Lock, AlertCircle } from 'lucide-react'

export default function VendasPage() {
  const [caixaAberto, setCaixaAberto] = useState(false)
  const [modalNovaVenda, setModalNovaVenda] = useState(false)
  const [vendaLoading, setVendaLoading] = useState(false)

  const {
    loading,
    vendasHoje,
    itensComPreco,
    clientesCaderneta,
    carregarDados,
    registrarVenda
  } = useVendas()

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const handleNovaVenda = () => {
    if (!caixaAberto) {
      alert('Você precisa abrir o caixa antes de registrar vendas!')
      return
    }
    setModalNovaVenda(true)
  }

  const handleRegistrarVenda = async (dadosVenda: any) => {
    try {
      setVendaLoading(true)
      await registrarVenda(dadosVenda)
      setModalNovaVenda(false)
      alert('Venda registrada com sucesso!')
    } catch (error) {
      console.error('Erro ao registrar venda:', error)
      alert('Erro ao registrar venda. Verifique o console.')
    } finally {
      setVendaLoading(false)
    }
  }

  return (
    <ProtectedLayout>
      <div className="page-container">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sistema de Vendas</h1>
        </div>

        {/* Sistema de Caixa */}
        <div className="mb-6">
          <SistemaCaixa onCaixaChange={setCaixaAberto} />
        </div>

        {/* Alerta se caixa fechado */}
        {!caixaAberto && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Caixa Fechado</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Você precisa abrir o caixa antes de registrar vendas.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botão Nova Venda */}
        <div className="mb-6">
          <button
            onClick={handleNovaVenda}
            disabled={!caixaAberto}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${caixaAberto
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            {caixaAberto ? (
              <ShoppingCart className="h-5 w-5 mr-2" />
            ) : (
              <Lock className="h-5 w-5 mr-2" />
            )}
            Nova Venda
          </button>
        </div>

        {/* Lista de Vendas do Dia */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Vendas de Hoje</h2>
            <p className="text-sm text-gray-600">
              Total de {vendasHoje.length} vendas registradas
            </p>
          </div>

          <ListaVendas vendas={vendasHoje} loading={loading} />
        </div>

        {/* Modal de Nova Venda */}
        {modalNovaVenda && (
          <ModalVenda
            isOpen={modalNovaVenda}
            onClose={() => setModalNovaVenda(false)}
            onSubmit={handleRegistrarVenda}
            itensComPreco={itensComPreco}
            clientesCaderneta={clientesCaderneta}
            loading={vendaLoading}
          />
        )}
      </div>
    </ProtectedLayout>
  )
}
