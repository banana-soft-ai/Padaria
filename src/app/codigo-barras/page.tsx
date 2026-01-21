'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import ProtectedLayout from '@/components/ProtectedLayout'
import {
  Camera,
  Search,
  Package,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  ShoppingCart,
  DollarSign,
  Scan,
  Trash2
} from 'lucide-react'
import Link from 'next/link'

/**
 * Define a estrutura de dados para um produto.
 */
interface Produto {
  id: string
  codigoBarras: string
  nome: string
  categoria: string
  preco: number
  custo: number
  estoque: number // Mapeado de estoque_atual no BD
  unidade: string
  ncm: string
  cfop: string
  icms: number
  descricao?: string
  imagem?: string
}

interface ItemCarrinho {
  produto: Produto
  quantidade: number
  subtotal: number
  desconto: number
}

interface Venda {
  id: string;
  data: string;
  itens: ItemCarrinho[];
  total: number;
}

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => (
  <div className={`fixed top-5 right-5 p-4 rounded-md shadow-lg text-white z-50 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
    <span>{message}</span>
    <button onClick={onClose} className="ml-4 font-bold">X</button>
  </div>
);

export default function CodigoBarrasPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [codigoDigitado, setCodigoDigitado] = useState('')
  const [produtoEncontrado, setProdutoEncontrado] = useState<Produto | null>(null)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [scannerResultado, setScannerResultado] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 🎯 NOVO ESTADO: Termo de busca para a lista de produtos
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    carregarEstoque()
  }, [])

  const carregarEstoque = async () => {
    setLoading(true)
    try {
      // ✅ LOGICA SUPABASE: BUSCA DO ESTOQUE
      const { data, error } = await supabase!
        .from('varejo')
        .select('*')

      if (error) throw error

      const estoque: Produto[] = (data || []).map((item: any) => ({
        id: String(item.id),
        codigoBarras: item.codigo_barras || '',
        nome: item.nome,
        categoria: item.categoria || 'varejo',
        preco: Number(item.preco_venda || 0),
        custo: 0,
        estoque: Number(item.estoque_atual || 0),
        unidade: item.unidade || 'un',
        ncm: item.ncm || '1905.90.00',
        cfop: item.cfop || '5102',
        icms: Number(item.icms || 18),
        descricao: item.descricao || '',
        imagem: item.imagem || ''
      }))

      setProdutos(estoque)
    } catch (error) {
      console.error('Erro ao carregar estoque:', error)
      setErro('Erro ao carregar estoque. Verifique a conexão com o Supabase.')
    } finally {
      setLoading(false)
    }
  }

  // 🎯 NOVA LÓGICA: Filtrar produtos com base no termo de busca
  const produtosFiltrados = useMemo(() => {
    if (!searchTerm) return produtos;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return produtos.filter(produto =>
      produto.nome.toLowerCase().includes(lowerCaseSearchTerm) ||
      produto.codigoBarras.includes(searchTerm) // Permite buscar por código também
    );
  }, [produtos, searchTerm]);


  /**
   * Busca um produto pelo seu código de barras.
   */
  const buscarProdutoPorCodigo = async (codigo: string) => {
    if (!codigo.trim()) {
      setProdutoEncontrado(null)
      setErro(null)
      return
    }

    setLoading(true)
    try {
      // Buscar na base local (produtos já carregados do Supabase)
      const produtoLocal = produtos.find(p => p.codigoBarras === codigo.trim())
      if (produtoLocal) {
        setProdutoEncontrado(produtoLocal)
        setErro(null)
        return
      }

      // Simulação de consulta externa (Manter esta lógica)
      const barcodeService = {
        consultarProduto: async (codigo: string) => ({
          sucesso: false,
          produto: null,
          erro: 'Produto não encontrado na base de dados e não há API externa configurada.'
        })
      };

      const resultado = await barcodeService.consultarProduto(codigo.trim())

      if (resultado.sucesso && resultado.produto) {
        setProdutoEncontrado(resultado.produto)
        setErro(null)
      } else {
        setProdutoEncontrado(null)
        setErro(resultado.erro || 'Produto não encontrado na base de dados.')
      }
    } catch (error) {
      setProdutoEncontrado(null)
      setErro('Erro ao buscar produto')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Adiciona um produto ao carrinho de compras.
   */
  const adicionarAoCarrinho = (produto: Produto, quantidade: number = 1) => {
    if (produto.estoque < quantidade) {
      showToast(`Estoque insuficiente. Restam apenas ${produto.estoque} ${produto.unidade}.`, 'error');
      return;
    }

    const itemExistente = carrinho.find(item => item.produto.id === produto.id)

    if (itemExistente) {
      const novaQuantidade = itemExistente.quantidade + quantidade;
      if (produto.estoque < novaQuantidade) {
        showToast(`O estoque de ${produto.nome} é limitado a ${produto.estoque}.`, 'error');
        return;
      }

      setCarrinho(prev => prev.map(item =>
        item.produto.id === produto.id
          ? {
            ...item,
            quantidade: novaQuantidade,
            subtotal: novaQuantidade * produto.preco - item.desconto
          }
          : item
      ))
    } else {
      const novoItem: ItemCarrinho = {
        produto,
        quantidade,
        subtotal: quantidade * produto.preco,
        desconto: 0
      }
      setCarrinho(prev => [...prev, novoItem])
    }

    setCodigoDigitado('')
    setProdutoEncontrado(null)
    showToast(`${produto.nome} adicionado ao carrinho.`, 'success');
  }

  /**
   * Atualiza a quantidade de um item específico no carrinho.
   */
  const atualizarQuantidade = (produtoId: string, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      removerDoCarrinho(produtoId)
      return
    }

    const item = carrinho.find(item => item.produto.id === produtoId);
    if (item && item.produto.estoque < novaQuantidade) {
      showToast(`O estoque de ${item.produto.nome} é limitado a ${item.produto.estoque}.`, 'error');
      return;
    }


    setCarrinho(prev => prev.map(item =>
      item.produto.id === produtoId
        ? {
          ...item,
          quantidade: novaQuantidade,
          subtotal: novaQuantidade * item.produto.preco - item.desconto
        }
        : item
    ))
  }

  /**
   * Remove um item completamente do carrinho.
   */
  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho(prev => prev.filter(item => item.produto.id !== produtoId))
  }

  /**
   * Esvazia o carrinho de compras.
   */
  const limparCarrinho = () => {
    setCarrinho([])
  }

  const totalCarrinho = carrinho.reduce((total, item) => total + item.subtotal, 0)

  /**
   * Inicia a câmera do dispositivo (código mantido)
   */
  const iniciarCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraAtiva(true)
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error)
      setErro('Erro ao acessar câmera. Verifique as permissões.')
    }
  }

  /**
   * Para o stream de vídeo da câmera (código mantido)
   */
  const pararCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraAtiva(false)
    setScannerResultado(null)
  }

  /**
   * Captura um frame do vídeo e simula a leitura (código mantido)
   */
  const capturarFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0)

        const codigoSimulado = '7891234567890' // Simular detecção (Ajuste conforme seus dados de teste)
        setScannerResultado(codigoSimulado)
        buscarProdutoPorCodigo(codigoSimulado)
      }
    }
  }

  /**
   * Exibe uma notificação (toast) (código mantido)
   */
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * 🚀 Processamento de Venda com ATUALIZAÇÃO DO SUPABASE
   */
  const processarVenda = async () => {
    if (carrinho.length === 0) {
      showToast('O carrinho está vazio.', 'error');
      return
    }

    setLoading(true);
    try {
      // 1. Preparar as operações de atualização de estoque
      const updateOperations = carrinho.map(item => {
        // Encontra o estado atual do produto antes da venda
        const produtoEstoque = produtos.find(p => p.id === item.produto.id);
        const estoqueAtual = produtoEstoque?.estoque || 0;
        const novoEstoque = estoqueAtual - item.quantidade;

        if (novoEstoque < 0) {
          throw new Error(`Estoque insuficiente para o produto: ${item.produto.nome} (Estoque: ${estoqueAtual})`);
        }

        // Retorna o objeto de atualização com o NOME DA COLUNA REAL do Supabase ('estoque_atual')
        return {
          id: item.produto.id,
          estoque_atual: novoEstoque,
        };
      });

      // 2. Realizar a baixa de estoque em massa no Supabase
      for (const item of carrinho) {
        const { error } = await supabase!
          .from('insumos')
          .update({ estoque_atual: item.produto.estoque - item.quantidade })
          .eq('id', item.produto.id);

        if (error) throw new Error(`Falha ao atualizar estoque do produto ${item.produto.nome}: ${error.message}`);
      }


      // 3. Registrar a Venda (localmente)
      const novaVenda: Venda = {
        id: `venda-${Date.now()}`,
        data: new Date().toISOString(),
        itens: carrinho,
        total: totalCarrinho,
      };

      const historicoVendas = JSON.parse(localStorage.getItem('vendas_historico') || '[]') as Venda[];
      historicoVendas.push(novaVenda);
      localStorage.setItem('vendas_historico', JSON.stringify(historicoVendas));


      // 4. Recarregar o estoque do Supabase para refletir as alterações no frontend
      await carregarEstoque();

      // 5. Limpar o carrinho e mostrar confirmação
      limparCarrinho();
      showToast('Venda finalizada e estoque atualizado com sucesso!', 'success');

    } catch (error: any) {
      showToast(error.message || 'Erro ao processar a venda.', 'error');
      console.error("Erro ao processar venda:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedLayout>
      {/* Container principal da página */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Voltar
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">Leitor de Código de Barras</h1>
            <p className="text-gray-600 mt-1">
              Sistema de leitura e venda por código de barras
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Painel de Leitura */}
            <div className="lg:col-span-2 space-y-6">
              {/* Leitor Manual */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Leitura Manual</h2>

                <div className="flex space-x-4">
                  <div className="flex-1">
                    <label htmlFor="codigo" className="block text-sm font-medium text-gray-700 mb-2">
                      Código de Barras
                    </label>
                    <input
                      type="text"
                      id="codigo"
                      value={codigoDigitado}
                      onChange={(e) => {
                        setCodigoDigitado(e.target.value)
                        if (e.target.value.length >= 8) {
                          buscarProdutoPorCodigo(e.target.value)
                        }
                      }}
                      placeholder="Digite ou escaneie o código"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-lg"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => buscarProdutoPorCodigo(codigoDigitado)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Search className="h-4 w-4 inline mr-2" />
                      Buscar
                    </button>
                  </div>
                </div>

                {erro && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex">
                      <XCircle className="h-5 w-5 text-red-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Erro</h3>
                        <div className="mt-2 text-sm text-red-700">{erro}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Câmera Scanner */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Scanner de Câmera</h2>
                  <div className="flex space-x-2">
                    {!cameraAtiva ? (
                      <button
                        onClick={iniciarCamera}
                        className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        <Camera className="h-4 w-4 inline mr-2" />
                        Iniciar Scanner
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={capturarFrame}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          <Scan className="h-4 w-4 inline mr-2" />
                          Capturar
                        </button>
                        <button
                          onClick={pararCamera}
                          className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                        >
                          Parar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-64 object-cover ${!cameraAtiva ? 'hidden' : ''}`}
                  />
                  {!cameraAtiva && (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <div className="text-center">
                        <Camera className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                        <p>Câmera não ativa</p>
                        <p className="text-sm">Clique em "Iniciar Scanner" para começar</p>
                      </div>
                    </div>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                {scannerResultado && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm text-green-700">
                        Código detectado: <strong>{scannerResultado}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card de Produto Encontrado */}
              {produtoEncontrado && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Produto Encontrado</h2>

                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{produtoEncontrado.nome}</h3>
                      <p className="text-sm text-gray-600">{produtoEncontrado.categoria}</p>
                      <p className="text-sm text-gray-600">Estoque: {produtoEncontrado.estoque} {produtoEncontrado.unidade}</p>
                      <p className="text-sm text-gray-600">Código: {produtoEncontrado.codigoBarras}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">
                        R$ {produtoEncontrado.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <button
                        onClick={() => adicionarAoCarrinho(produtoEncontrado)}
                        className="mt-2 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        <Plus className="h-4 w-4 inline mr-2" />
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Carrinho de Compras */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Carrinho</h2>
                  {carrinho.length > 0 && (
                    <button
                      onClick={limparCarrinho}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {carrinho.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Carrinho vazio</p>
                    <p className="text-sm text-gray-400">Escaneie ou digite códigos de barras</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {carrinho.map((item) => (
                      <div key={item.produto.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.produto.nome}</h4>
                          <p className="text-sm text-gray-600">
                            R$ {item.produto.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} cada
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => atualizarQuantidade(item.produto.id, item.quantidade - 1)}
                            className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantidade}</span>
                          <button
                            onClick={() => atualizarQuantidade(item.produto.id, item.quantidade + 1)}
                            className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removerDoCarrinho(item.produto.id)}
                            className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 ml-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Seção de Total e Finalização de Venda */}
                {carrinho.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold text-gray-900">Total:</span>
                      <span className="text-xl font-bold text-gray-900">
                        R$ {totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <button
                      onClick={processarVenda}
                      disabled={loading}
                      className={`w-full py-3 rounded-md font-medium transition-colors ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                    >
                      <DollarSign className="h-5 w-5 inline mr-2" />
                      {loading ? 'Processando...' : 'Finalizar Venda'}
                    </button>
                  </div>
                )}
              </div>

              {/* Lista de Produtos Cadastrados (com Busca e Scroll) */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">

                {/* 🎯 ALTERAÇÃO FEITA AQUI: Container flex para título e busca */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Produtos Cadastrados</h2>

                  {/* Input de Busca Pequeno */}
                  <div className="relative w-36">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Scroll Container */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {/* Utiliza a lista FILTRADA */}
                  {produtosFiltrados.map((produto) => (
                    <div key={produto.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{produto.nome}</p>
                        <p className="text-xs text-gray-500">{produto.codigoBarras}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          R$ {produto.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500">Est: {produto.estoque}</p>
                      </div>
                    </div>
                  ))}
                  {produtosFiltrados.length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">Nenhum produto encontrado.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Informações sobre Códigos de Barras */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-4">
              Sobre Códigos de Barras
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
              <div>
                <h4 className="font-medium mb-2">Tipos Suportados:</h4>
                <ul className="space-y-1">
                  <li>• EAN-13 (13 dígitos)</li>
                  <li>• EAN-8 (8 dígitos)</li>
                  <li>• UPC-A (12 dígitos)</li>
                  <li>• Code 128</li>
                  <li>• Code 39</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Funcionalidades:</h4>
                <ul className="space-y-1">
                  <li>• Leitura por câmera</li>
                  <li>• Digitação manual</li>
                  <li>• Integração com vendas</li>
                  <li>• Controle de estoque</li>
                  {/* NFCe removida */}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Componente Toast para feedback ao usuário. */}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    </ProtectedLayout>
  )
}