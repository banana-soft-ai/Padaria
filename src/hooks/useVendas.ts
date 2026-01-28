import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Venda, Receita, Insumo, ClienteCaderneta } from '@/lib/supabase'
import { toReceita, toInsumo, toClienteCaderneta, toVenda, toItemVenda } from '@/lib/converters'
import { useOnlineStatus } from './useOnlineStatus'
import { offlineStorage } from '@/lib/offlineStorage'

interface ItemComPreco {
  id: number
  nome: string
  tipo: 'receita' | 'varejo'
  preco_venda: number
}

interface VendaFormData {
  forma_pagamento: string
  cliente_caderneta_id?: number
  observacoes: string
  itens: Array<{
    item_id: number
    tipo: 'receita' | 'varejo'
    quantidade: number
    preco_unitario: number
  }>
}

export function useVendas() {
  const [loading, setLoading] = useState(true)
  const [vendasHoje, setVendasHoje] = useState<Venda[]>([])
  const [produtosVarejo, setProdutosVarejo] = useState<Insumo[]>([])
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [clientesCaderneta, setClientesCaderneta] = useState<ClienteCaderneta[]>([])
  const [precosVenda, setPrecosVenda] = useState<{ [key: number]: number }>({})
  const [itensComPreco, setItensComPreco] = useState<ItemComPreco[]>([])
  const { isOnline } = useOnlineStatus()

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true)
      const [receitasData, produtosVarejoData] = await Promise.all([
        carregarReceitas(),
        carregarProdutosVarejo()
      ])

      await carregarClientesCaderneta()
      await carregarVendasHoje()
      await carregarPrecosVenda(receitasData, produtosVarejoData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarReceitas = async (): Promise<Receita[]> => {
    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from('receitas')
          .select('*')
          .eq('ativo', true)
          .order('nome')

        if (error) throw error
        const mapped = (data || []).map(toReceita)
        setReceitas(mapped)

        // Salvar no cache offline
        if (data) {
          await offlineStorage.saveOfflineData('receitas', data)
        }
        return mapped || []
      } else {
        // Offline: usar dados do cache
        const offlineData = await offlineStorage.getOfflineData('receitas')
        const mapped = (offlineData || []).map(toReceita)
        setReceitas(mapped as Receita[])
        return mapped as Receita[]
      }
    } catch (error) {
      console.error('Erro ao carregar receitas:', error)

      // Em caso de erro, tentar usar dados offline
      try {
        const offlineData = await offlineStorage.getOfflineData('receitas')
        const mapped = (offlineData || []).map(toReceita)
        setReceitas(mapped as Receita[])
        return mapped as Receita[]
      } catch (offlineError) {
        console.error('Erro ao carregar receitas offline:', offlineError)
        return []
      }
    }
  }

  const carregarProdutosVarejo = async (): Promise<Insumo[]> => {
    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from('insumos')
          .select('*')
          .eq('categoria', 'varejo')
          .order('nome')

        if (error) throw error
        const mapped = (data || []).map(toInsumo)
        setProdutosVarejo(mapped)

        // Salvar no cache offline
        if (data) {
          await offlineStorage.saveOfflineData('insumos_varejo', data)
        }
        return mapped || []
      } else {
        // Offline: usar dados do cache
        const offlineData = await offlineStorage.getOfflineData('insumos_varejo')
        const mapped = (offlineData || []).map(toInsumo)
        setProdutosVarejo(mapped as Insumo[])
        return mapped as Insumo[]
      }
    } catch (error) {
      console.error('Erro ao carregar produtos varejo:', error)

      // Em caso de erro, tentar usar dados offline
      try {
        const offlineData = await offlineStorage.getOfflineData('insumos_varejo')
        const mapped = (offlineData || []).map(toInsumo)
        setProdutosVarejo(mapped as Insumo[])
        return mapped as Insumo[]
      } catch (offlineError) {
        console.error('Erro ao carregar produtos varejo offline:', offlineError)
        return []
      }
    }
  }

  const carregarClientesCaderneta = async () => {
    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from('clientes_caderneta')
          .select('*')
          .eq('ativo', true)
          .order('nome')

        if (error) throw error
        if (data) {
          const mapped = (data || []).map(toClienteCaderneta)
          setClientesCaderneta(mapped)
          // Salvar no cache offline
          await offlineStorage.saveOfflineData('clientes_caderneta', data)
        }
      } else {
        // Offline: usar dados do cache
        const offlineData = await offlineStorage.getOfflineData('clientes_caderneta')
        const mapped = (offlineData || []).map(toClienteCaderneta)
        setClientesCaderneta(mapped as ClienteCaderneta[])
      }
    } catch (error) {
      console.error('Erro ao carregar clientes caderneta:', error)

      // Em caso de erro, tentar usar dados offline
      try {
        const offlineData = await offlineStorage.getOfflineData('clientes_caderneta')
        const mapped = (offlineData || []).map(toClienteCaderneta)
        setClientesCaderneta(mapped as ClienteCaderneta[])
      } catch (offlineError) {
        console.error('Erro ao carregar clientes caderneta offline:', offlineError)
      }
    }
  }

  const carregarVendasHoje = useCallback(async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0]

      if (isOnline) {
        // Online: buscar do Supabase
        const { data: vendas, error: vendasError } = await supabase
          .from('vendas')
          .select('*')
          .eq('data', hoje)
          .order('created_at', { ascending: false })

        if (vendasError) {
          console.error('Erro ao buscar vendas:', vendasError)
          throw vendasError
        }

        if (!vendas || vendas.length === 0) {
          setVendasHoje([])
          return
        }

        // Para cada venda, carregar itens e cliente se necessário
        const vendasCompletas = await Promise.all(
          vendas.map(async (venda) => {
            // Carregar itens da venda
            const { data: itens } = await supabase
              .from('venda_itens')
              .select('*')
              .eq('venda_id', venda.id)

            // Carregar cliente se houver
            let cliente = null
            if (venda.cliente_caderneta_id) {
              const { data: clienteData } = await supabase
                .from('clientes_caderneta')
                .select('id, nome, saldo_devedor')
                .eq('id', venda.cliente_caderneta_id)
                .single()

              cliente = clienteData
            }

            return {
              ...venda,
              venda_itens: itens || [],
              clientes_caderneta: cliente
            }
          })
        )

        setVendasHoje(vendasCompletas)

        // Salvar no cache offline
        await offlineStorage.saveOfflineData('vendas_hoje', vendasCompletas)
      } else {
        // Offline: usar dados do cache
        const offlineData = await offlineStorage.getOfflineData('vendas_hoje')
        const mapped = (offlineData || []).map(toVenda)
        setVendasHoje(mapped as Venda[])
      }
    } catch (error) {
      console.error('Erro ao carregar vendas do dia:', error)

      // Em caso de erro, tentar usar dados offline
      try {
        const offlineData = await offlineStorage.getOfflineData('vendas_hoje')
        const mapped = (offlineData || []).map(toVenda)
        setVendasHoje(mapped as Venda[])
      } catch (offlineError) {
        console.error('Erro ao carregar vendas offline:', offlineError)
        setVendasHoje([])
      }
    }
  }, [isOnline])

  const carregarPrecosVenda = async (receitasData: Receita[], produtosVarejoData: Insumo[]) => {
    try {
      let precosMap: { [key: number]: number } = {}

      if (isOnline) {
        // Online: tentar carregar da tabela precos_venda se existir
        const { data: todosPrecos, error } = await supabase
          .from('precos_venda')
          .select('*')
          .eq('ativo', true)

        if (!error && todosPrecos) {
          // Se a tabela existe e tem dados, usar ela
          todosPrecos.forEach(preco => {
            precosMap[preco.item_id] = preco.preco_venda
          })
        } else {
          // Se não existe ou deu erro, usar preços diretos das receitas e insumos
          console.log('Tabela precos_venda não encontrada, usando preços diretos')
        }

        // Salvar no cache offline
        const precosArray = Object.entries(precosMap).map(([itemId, preco]) => ({
          item_id: Number(itemId),
          preco_venda: preco
        }))
        await offlineStorage.saveOfflineData('precos_venda', precosArray)
      } else {
        // Offline: usar dados do cache
        const offlineData = await offlineStorage.getOfflineData('precos_venda')
        if (Array.isArray(offlineData)) {
          precosMap = offlineData.reduce((acc, item) => {
            if (item && typeof item === 'object') {
              const itemId = 'item_id' in item ? Number(item.item_id) : 'id' in item ? Number(item.id) : undefined
              const preco = 'preco_venda' in item ? Number(item.preco_venda) : 'preco' in item ? Number(item.preco) : undefined
              if (Number.isFinite(itemId) && Number.isFinite(preco)) {
                acc[itemId as number] = preco as number
              }
            }
            return acc
          }, {} as { [key: number]: number })
        } else {
          precosMap = {}
        }
      }

      setPrecosVenda(precosMap)

      // Criar lista de itens com preço para o dropdown
      const itensComPrecoList: ItemComPreco[] = []

      // Adicionar receitas com preço
      receitasData.forEach(receita => {
        // Primeiro tentar pegar da tabela precos_venda, senão usar preco_venda da receita
        const preco = precosMap[receita.id] || receita.preco_venda
        if (preco && preco > 0) {
          itensComPrecoList.push({
            id: receita.id,
            nome: receita.nome,
            tipo: 'receita',
            preco_venda: preco
          })
        }
      })

      // Adicionar produtos de varejo com preço
      produtosVarejoData.forEach(produto => {
        // Primeiro tentar pegar da tabela precos_venda, senão usar preco_venda do insumo
        const preco = precosMap[produto.id] || produto.preco_venda
        if (preco && preco > 0) {
          itensComPrecoList.push({
            id: produto.id,
            nome: produto.nome,
            tipo: 'varejo',
            preco_venda: preco
          })
        }
      })

      console.log('Itens com preço carregados:', itensComPrecoList.length)
      setItensComPreco(itensComPrecoList)
    } catch (error) {
      console.error('Erro ao carregar preços de venda:', error)

      // Em caso de erro, tentar usar dados offline
      try {
        const offlineData = await offlineStorage.getOfflineData('precos_venda')
        const precosMap = offlineData || {}

        // Montar lista com dados offline
        const itensComPrecoList: ItemComPreco[] = []

        receitasData.forEach(receita => {
          const preco = precosMap[receita.id] || receita.preco_venda
          if (preco && preco > 0) {
            itensComPrecoList.push({
              id: receita.id,
              nome: receita.nome,
              tipo: 'receita',
              preco_venda: preco
            })
          }
        })

        produtosVarejoData.forEach(produto => {
          const preco = precosMap[produto.id] || produto.preco_venda
          if (preco && preco > 0) {
            itensComPrecoList.push({
              id: produto.id,
              nome: produto.nome,
              tipo: 'varejo',
              preco_venda: preco
            })
          }
        })

        setItensComPreco(itensComPrecoList)
      } catch (offlineError) {
        console.error('Erro ao carregar preços offline:', offlineError)
        setItensComPreco([])
      }
    }
  }

  const registrarVenda = useCallback(async (dadosVenda: VendaFormData) => {
    try {
      const valorTotal = dadosVenda.itens.reduce((sum, item) => sum + (item.quantidade * item.preco_unitario), 0)
      const valorPago = dadosVenda.forma_pagamento === 'caderneta' ? 0 : valorTotal
      const valorDebito = dadosVenda.forma_pagamento === 'caderneta' ? valorTotal : 0

      const dadosVendaInsert = {
        data: new Date().toISOString().split('T')[0],
        forma_pagamento: dadosVenda.forma_pagamento,
        cliente_caderneta_id: dadosVenda.cliente_caderneta_id || null,
        valor_total: valorTotal,
        valor_pago: valorPago,
        valor_debito: valorDebito,
        observacoes: dadosVenda.observacoes || null
      }

      if (isOnline) {
        const { data: inserted, error: insertErr } = await supabase
          .from('vendas')
          .insert(dadosVendaInsert)
          .select('id')
          .limit(1)
          .single()

        if (insertErr) {
          console.error('Erro ao inserir venda:', insertErr)
          throw insertErr
        }

        const vendaId = inserted?.id
        if (vendaId && Array.isArray(dadosVenda.itens) && dadosVenda.itens.length > 0) {
          for (const item of dadosVenda.itens) {
            const dadosItem: any = {
              venda_id: vendaId,
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario,
              subtotal: item.quantidade * item.preco_unitario
            }
            
            if (item.tipo === 'varejo') {
              dadosItem.varejo_id = item.item_id
            } else {
              dadosItem.produto_id = item.item_id
            }

            const { error: itemError } = await supabase
              .from('venda_itens')
              .insert(dadosItem)

            if (itemError) {
              console.error('Erro ao inserir item da venda:', itemError)
              throw itemError
            }
          }
        }
      } else {
        await offlineStorage.addPendingOperation({ type: 'INSERT', table: 'vendas', data: dadosVendaInsert })
        for (const item of dadosVenda.itens) {
          const dadosItem: any = { 
            quantidade: item.quantidade, 
            preco_unitario: item.preco_unitario, 
            subtotal: item.quantidade * item.preco_unitario 
          }
          if (item.tipo === 'varejo') {
            dadosItem.varejo_id = item.item_id
          } else {
            dadosItem.produto_id = item.item_id
          }
          await offlineStorage.addPendingOperation({ type: 'INSERT', table: 'venda_itens', data: dadosItem })
        }
      }

      await carregarVendasHoje()
      return true
    } catch (error) {
      console.error('Erro ao registrar venda:', error)
      throw error
    }
  }, [carregarVendasHoje, isOnline])

  return {
    loading,
    vendasHoje,
    produtosVarejo,
    receitas,
    clientesCaderneta,
    precosVenda,
    itensComPreco,
    carregarDados,
    registrarVenda
  }
}
