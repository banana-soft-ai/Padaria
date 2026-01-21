 'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Insumo } from '@/lib/supabase'
import ProtectedLayout from '@/components/ProtectedLayout'
import { Package, AlertTriangle, X, Eye, Search, FileSpreadsheet, Printer, MessageCircle } from 'lucide-react'
import Toast from '@/app/gestao/caderneta/Toast'

// Desabilitar static generation - página dinâmica que precisa de auth
export const dynamic = 'force-dynamic'

export default function EstoqueDashboardPage() {
  const [itens, setItens] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [itemSelecionado, setItemSelecionado] = useState<Insumo | null>(null)
  const [pesquisa, setPesquisa] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_estoque' | 'estoque_baixo' | 'sem_estoque'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'insumo' | 'varejo'>('todos')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ message, type })
  }

  useEffect(() => {
    carregarItens()
  }, [])

  const carregarItens = async () => {
    try {
      const [insumosRes, varejoRes] = await Promise.all([
        supabase!.from('insumos').select('*').order('nome'),
        supabase!.from('varejo').select('*').order('nome')
      ])

      if (insumosRes.error) throw insumosRes.error
      if (varejoRes.error) throw varejoRes.error

      const insumos = (insumosRes.data || []).map((i: any) => ({
        ...i,
        tipo_estoque: 'insumo'
      })) as Insumo[]

      const varejo = (varejoRes.data || []).map((v: any) => ({
        ...v,
        tipo_estoque: 'varejo',
        estoque_atual: Number(v?.estoque_atual) || 0,
        estoque_minimo: Number(v?.estoque_minimo) || 0,
        unidade: v?.unidade || 'un',
        fornecedor: null
      })) as Insumo[]

      setItens([...(insumos || []), ...(varejo || [])])
    } catch (error) {
      console.error('Erro ao carregar estoque:', error)
    } finally {
      setLoading(false)
    }
  }

  const obterStatusEstoque = (item: Insumo) => {
    const atual = Number(item.estoque_atual) || 0
    const minimo = Number(item.estoque_minimo) || 0

    if (atual <= 0) {
      return { status: 'Sem estoque', color: 'text-red-600', icon: <AlertTriangle className="h-4 w-4 text-red-600" /> }
    }
    if (minimo > 0 && atual <= minimo) {
      return { status: 'Estoque baixo', color: 'text-yellow-600', icon: <AlertTriangle className="h-4 w-4 text-yellow-600" /> }
    }
    return { status: 'Em estoque', color: 'text-green-600', icon: <Package className="h-4 w-4 text-green-600" /> }
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="page-container">
          <p className="text-sm text-gray-500">Carregando estoque...</p>
        </div>
      </ProtectedLayout>
    )
  }

  const itensFiltrados = itens.filter(item => {
    const nomeMatch = item.nome.toLowerCase().includes(pesquisa.toLowerCase())
    const status = obterStatusEstoque(item).status

    // Filtro status
    let statusMatch = true
    if (filtroStatus === 'em_estoque') statusMatch = status === 'Em estoque'
    if (filtroStatus === 'estoque_baixo') statusMatch = status === 'Estoque baixo'
    if (filtroStatus === 'sem_estoque') statusMatch = status === 'Sem estoque'

    // Filtro tipo
    let tipoMatch = filtroTipo === 'todos' ? true : item.tipo_estoque === filtroTipo

    return nomeMatch && statusMatch && tipoMatch
  })

  const semEstoque = itensFiltrados.filter(i => (Number(i.estoque_atual) || 0) <= 0)
  const estoqueBaixo = itensFiltrados.filter(i => {
    const atual = Number(i.estoque_atual) || 0
    const minimo = Number(i.estoque_minimo) || 0
    return atual > 0 && minimo > 0 && atual <= minimo
  })
  const emEstoque = itensFiltrados.filter(i => (Number(i.estoque_atual) || 0) > 0)

  const handleExportarCSV = () => {
    if (itensFiltrados.length === 0) {
      showToast('Não há itens para exportar.', 'warning')
      return
    }

    const headers = ['Nome', 'Categoria', 'Tipo', 'Estoque Atual', 'Estoque Mínimo', 'Status']
    const csvContent = [
      headers.join(';'),
      ...itensFiltrados.map(item => {
        const { status } = obterStatusEstoque(item)
        return [
          `"${item.nome}"`,
          `"${item.categoria}"`,
          `"${item.tipo_estoque}"`,
          (item.estoque_atual || 0).toString().replace('.', ','),
          (item.estoque_minimo || 0).toString().replace('.', ','),
          `"${status}"`
        ].join(';')
      })
    ].join('\n')

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `estoque_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleImprimir = () => {
    window.print()
  }

  const handleWhatsApp = () => {
    if (itensFiltrados.length === 0) {
      showToast('Não há itens para enviar.', 'warning')
      return
    }

    let texto = `*RELATÓRIO DE ESTOQUE - REY DOS PÃES*\\n`
    texto += `Data: ${new Date().toLocaleDateString()}\\n`
    texto += `--------------------------------\\n`

    itensFiltrados.forEach(item => {
      const { status } = obterStatusEstoque(item)
      texto += `*${item.nome}*\\n`
      texto += `Estoque: ${item.estoque_atual} ${item.unidade} (${status})\\n\\n`
    })

    navigator.clipboard.writeText(texto)
      .then(() => showToast('Relatório copiado! Cole no WhatsApp.', 'success'))
      .catch(() => showToast('Erro ao copiar texto.', 'error'))
  }

  return (
    <ProtectedLayout>
      <div className="page-container">
        {/* Estilos para impressão */}
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #area-impressao, #area-impressao * {
              visibility: visible;
            }
            #area-impressao {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
              padding: 20px;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard – Estoque</h1>
            <p className="text-sm text-gray-600 mt-1">Visão geral do estoque (somente leitura)</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportarCSV}
              className="flex items-center gap-2 px-2 py-1 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors text-sm"
              title="Exportar CSV"
            >
              <FileSpreadsheet size={16} />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handleImprimir}
              className="flex items-center gap-2 px-2 py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
              title="Imprimir"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-2 px-2 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
              title="Copiar para WhatsApp"
            >
              <MessageCircle size={16} />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          </div>
        </div>

        {/* 🔹 Cards resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 no-print">
          <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm text-gray-500">Total de itens</p>
            <p className="text-2xl font-bold text-gray-900">{itensFiltrados.length}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm text-gray-500">Sem estoque</p>
            <p className="text-2xl font-bold text-red-600">{semEstoque.length}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm text-gray-500">Estoque baixo</p>
            <p className="text-2xl font-bold text-yellow-600">{estoqueBaixo.length}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <p className="text-sm text-gray-500">Em estoque</p>
            <p className="text-2xl font-bold text-green-600">{emEstoque.length}</p>
          </div>
        </div>

        {/* 🔹 Filtros Organizados */}
        <div className="bg-white p-4 rounded-lg border mb-6 space-y-4 no-print">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Pesquisar por nome..."
              value={pesquisa}
              onChange={e => setPesquisa(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setFiltroTipo('todos'); setFiltroStatus('todos'); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroTipo === 'todos' && filtroStatus === 'todos' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroTipo('insumo')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroTipo === 'insumo' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Insumos
            </button>
            <button
              onClick={() => setFiltroTipo('varejo')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroTipo === 'varejo' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Varejo
            </button>

            <div className="h-6 w-px bg-gray-300 mx-2 hidden sm:block"></div>

            <button
              onClick={() => setFiltroStatus(filtroStatus === 'em_estoque' ? 'todos' : 'em_estoque')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroStatus === 'em_estoque' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Em estoque
            </button>
            <button
              onClick={() => setFiltroStatus(filtroStatus === 'estoque_baixo' ? 'todos' : 'estoque_baixo')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroStatus === 'estoque_baixo' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Estoque baixo
            </button>
            <button
              onClick={() => setFiltroStatus(filtroStatus === 'sem_estoque' ? 'todos' : 'sem_estoque')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroStatus === 'sem_estoque' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Sem estoque
            </button>
          </div>
        </div>

        {/* 🔹 Lista detalhada com scroll */}
        <div id="area-impressao" className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-800">Situação dos itens</h2>
          </div>

          <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto print:max-h-none print:overflow-visible">
            {itensFiltrados.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum item encontrado</p>
            ) : (
              itensFiltrados.map(item => {
                const status = obterStatusEstoque(item)

                return (
                  <div key={`${item.tipo_estoque}-${item.id}`} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.nome}</p>
                      <p className="text-xs text-gray-500">Estoque: {Number(item.estoque_atual)}</p>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        {status.icon}
                        <span className={`text-xs font-medium ${status.color}`}>{status.status}</span>
                      </div>

                      <button
                        onClick={() => setItemSelecionado(item)}
                        className="text-gray-500 hover:text-gray-800 no-print"
                        title="Ver detalhes"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 🔹 Modal */}
        {itemSelecionado && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md p-6 relative">
              <button
                onClick={() => setItemSelecionado(null)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              >
                <X size={18} />
              </button>

              <h3 className="text-lg font-bold mb-4">{itemSelecionado.nome}</h3>

              <div className="space-y-2 text-sm text-gray-700">
                <p><strong>Categoria:</strong> {itemSelecionado.categoria}</p>
                <p><strong>Tipo Estoque:</strong> {itemSelecionado.tipo_estoque}</p>
                <p><strong>Estoque atual:</strong> {itemSelecionado.estoque_atual}</p>
                <p><strong>Estoque mínimo:</strong> {itemSelecionado.estoque_minimo}</p>
                <p><strong>Unidade:</strong> {itemSelecionado.unidade}</p>
                {itemSelecionado.fornecedor && <p><strong>Fornecedor:</strong> {itemSelecionado.fornecedor}</p>}
                {itemSelecionado.codigo_barras && <p><strong>Código de Barras:</strong> {itemSelecionado.codigo_barras}</p>}
                {/* Exibir Preço do Pacote e Peso do Pacote para itens de varejo */}
                {itemSelecionado.tipo_estoque === 'varejo' && (
                  <>
                    <p><strong>Preço do Pacote:</strong> {itemSelecionado.preco_pacote !== undefined && itemSelecionado.preco_pacote !== null ? `R$ ${Number(itemSelecionado.preco_pacote).toFixed(2)}` : '-'}</p>
                    <p><strong>Peso do Pacote:</strong> {itemSelecionado.peso_pacote !== undefined && itemSelecionado.peso_pacote !== null ? `${Number(itemSelecionado.peso_pacote)} ${itemSelecionado.unidade}` : '-'}</p>
                  </>
                )}
                {/* Exibir também para insumo se existir */}
                {itemSelecionado.tipo_estoque === 'insumo' && (
                  <>
                    {'preco_pacote' in itemSelecionado && itemSelecionado.preco_pacote !== undefined && (
                      <p><strong>Preço do Pacote:</strong> R$ {Number(itemSelecionado.preco_pacote).toFixed(2)}</p>
                    )}
                    {'peso_pacote' in itemSelecionado && itemSelecionado.peso_pacote !== undefined && (
                      <p><strong>Peso do Pacote:</strong> {Number(itemSelecionado.peso_pacote)} {itemSelecionado.unidade}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    </ProtectedLayout>
  )
}
