/**
 * Script para inserir dados iniciais no Supabase (Refatorado)
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const { serverEnv } = require('../../src/env/server-env.cjs')

// ===============================
// 🔐 Validar variáveis de ambiente
// ===============================
const supabaseUrl = serverEnv.SUPABASE_URL
const supabaseServiceKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ===============================
// 🔧 Função reutilizável para upsert
// ===============================
async function inserirOuAvisar(tabela, item, chave) {
  const { error } = await supabase
    .from(tabela)
    .upsert(item, { onConflict: chave })

  if (error) {
    console.log(`⚠️  ${tabela.slice(0, 1).toUpperCase() + tabela.slice(1)} ${item.nome}: ${error.message}`)
  } else {
    console.log(`✅ ${item.nome} inserido`)
  }
}

// ===============================
// 🚀 Execução principal
// ===============================
async function inserirDadosIniciais() {
  try {
    console.log('🚀 Inserindo dados iniciais...\n')

    // ===============================
    // 📦 INSUMOS
    // ===============================
    console.log('📦 Inserindo insumos...')

    const insumos = [
      { nome: 'Farinha de Trigo', categoria: 'insumo', unidade: 'kg', preco_pacote: 4.50, estoque_atual: 50, estoque_minimo: 10 },
      { nome: 'Açúcar', categoria: 'insumo', unidade: 'kg', preco_pacote: 3.20, estoque_atual: 30, estoque_minimo: 5 },
      { nome: 'Sal', categoria: 'insumo', unidade: 'kg', preco_pacote: 2.80, estoque_atual: 20, estoque_minimo: 2 },
      { nome: 'Fermento Biológico', categoria: 'insumo', unidade: 'g', preco_pacote: 8.90, estoque_atual: 500, estoque_minimo: 100 },
      { nome: 'Manteiga', categoria: 'insumo', unidade: 'kg', preco_pacote: 25.00, estoque_atual: 15, estoque_minimo: 3 },
      { nome: 'Leite', categoria: 'insumo', unidade: 'L', preco_pacote: 4.50, estoque_atual: 40, estoque_minimo: 10 },
      { nome: 'Ovos', categoria: 'insumo', unidade: 'unidade', preco_pacote: 0.50, estoque_atual: 200, estoque_minimo: 50 },
      { nome: 'Fermento', categoria: 'insumo', unidade: 'unidade', preco_pacote: 0.50, estoque_atual: 200, estoque_minimo: 50 },

    ]

    for (const insumo of insumos) {
      await inserirOuAvisar('insumos', insumo, 'nome')
    }

    // ===============================
    // 👨‍🍳 RECEITAS
    // ===============================
    console.log('\n👨‍🍳 Inserindo receitas...')

    const receitas = [
      { nome: 'Pão Francês', categoria: 'pao', rendimento: 50, tempo_preparo: 180, instrucoes: 'Misturar ingredientes, sovar, fermentar e assar' },
      { nome: 'Pão de Açúcar', categoria: 'pao', rendimento: 30, tempo_preparo: 120, instrucoes: 'Misturar ingredientes com açúcar, sovar e assar' },
      { nome: 'Croissant', categoria: 'salgado', rendimento: 20, tempo_preparo: 240, instrucoes: 'Preparar massa folhada, enrolar e assar' },
      { nome: 'Bolo de Chocolate', categoria: 'bolo', rendimento: 1, tempo_preparo: 60, instrucoes: 'Misturar ingredientes e assar em forma untada' }
    ]

    for (const receita of receitas) {
      await inserirOuAvisar('receitas', receita, 'nome')
    }

    // ===============================
    // 🛍️ PRODUTOS
    // ===============================
    console.log('\n🛍️ Inserindo produtos...')

    const { data: receitasData } = await supabase
      .from('receitas')
      .select('id, nome')

    const receitasMap = {}
    receitasData?.forEach(r => receitasMap[r.nome] = r.id)

    const produtos = [
      { nome: 'Pão Francês', categoria: 'pao', receita_id: receitasMap['Pão Francês'], preco_venda: 0.80, peso_unitario: 0.05, ativo: true },
      { nome: 'Pão de Açúcar', categoria: 'pao', receita_id: receitasMap['Pão de Açúcar'], preco_venda: 1.20, peso_unitario: 0.08, ativo: true },
      { nome: 'Croissant', categoria: 'salgado', receita_id: receitasMap['Croissant'], preco_venda: 3.50, peso_unitario: 0.06, ativo: true },
      { nome: 'Bolo de Chocolate', categoria: 'bolo', receita_id: receitasMap['Bolo de Chocolate'], preco_venda: 25.00, peso_unitario: 1.0, ativo: true }
    ]

    for (const produto of produtos) {
      if (produto.receita_id) {
        await inserirOuAvisar('produtos', produto, 'nome')
      }
    }

    // ===============================
    // 💰 CUSTOS FIXOS
    // ===============================
    console.log('\n💰 Inserindo custos fixos...')

    const custosFixos = [
      { nome: 'Aluguel', categoria: 'aluguel', valor_mensal: 2000, data_vencimento: 5 },
      { nome: 'Energia Elétrica', categoria: 'energia', valor_mensal: 800, data_vencimento: 15 },
      { nome: 'Água', categoria: 'agua', valor_mensal: 150, data_vencimento: 10 },
      { nome: 'Telefone/Internet', categoria: 'telefone', valor_mensal: 200, data_vencimento: 20 },
      { nome: 'IPTU', categoria: 'impostos', valor_mensal: 300, data_vencimento: 25 }
    ]

    for (const custo of custosFixos) {
      await inserirOuAvisar('custos_fixos', custo, 'nome')
    }

    // ===============================
    // 📊 Resumo final
    // ===============================
    console.log('\n📊 Verificando dados inseridos...')

    const [insC, recC, prodC, cusC] = await Promise.all([
      supabase.from('insumos').select('*'),
      supabase.from('receitas').select('*'),
      supabase.from('produtos').select('*'),
      supabase.from('custos_fixos').select('*')
    ])

    console.log(`📦 Insumos: ${insC.data?.length || 0}`)
    console.log(`👨‍🍳 Receitas: ${recC.data?.length || 0}`)
    console.log(`🛍️ Produtos: ${prodC.data?.length || 0}`)
    console.log(`💰 Custos fixos: ${cusC.data?.length || 0}`)

    console.log('\n🎉 Dados iniciais inseridos com sucesso!')

  } catch (err) {
    console.error('❌ Erro ao inserir dados:', err.message)
  }
}

inserirDadosIniciais()
