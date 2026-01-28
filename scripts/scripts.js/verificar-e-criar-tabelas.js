/**
 * Script para verificar e criar tabelas faltantes no Supabase
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })
const { serverEnv } = require('../../src/env/server-env.cjs')

const supabaseUrl = serverEnv.SUPABASE_URL
const supabaseServiceKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verificarECriarTabelas() {
  try {
    console.log('🔍 Verificando tabelas existentes...')

    // Lista de tabelas necessárias
    const tabelasNecessarias = [
      'caderneta',
      'caixa_diario',
      'caixas',
      'clientes',
      'clientes_caderneta',
      'composicao_receitas',
      'custos_fixos',
      'estoque_movimentacoes',
      'fluxo_caixa',
      'insumos',
      'logs_sistema',
      'movimentacoes_caderneta',
      'precos_venda',
      'produtos',
      'produtos_estoque_baixo',
      'receita_ingredientes',
      'receitas',
      'resumo_caixa_hoje',
      'usuarios',
      'venda_itens',
      'vendas',
      'vendas_hoje',
      'tabela-que-nao-existe-para-teste',
    ]

    const tabelasExistentes = []
    const tabelasFaltantes = []

    // Verificar cada tabela
    for (const tabela of tabelasNecessarias) {
      try {
        const { data, error } = await supabase
          .from(tabela)
          .select('count')
          .limit(1)

        if (error) {
          console.log(`❌ Tabela ${tabela}: ${error.message}`)
          tabelasFaltantes.push(tabela)
        } else {
          console.log(`✅ Tabela ${tabela}: OK`)
          tabelasExistentes.push(tabela)
        }
      } catch (err) {
        console.log(`❌ Tabela ${tabela}: Erro inesperado`)
        tabelasFaltantes.push(tabela)
      }
    }

    console.log(`\n📊 Resumo:`)
    console.log(`✅ Tabelas existentes: ${tabelasExistentes.length}`)
    console.log(`❌ Tabelas faltantes: ${tabelasFaltantes.length}`)

    if (tabelasFaltantes.length > 0) {
      console.log(`\n🔧 Tabelas faltantes: ${tabelasFaltantes.join(', ')}`)
      console.log('\n📝 Execute o script SQL para criar as tabelas faltantes:')
      console.log('   scripts/criar-tabelas-faltantes.sql ou manualmente pelo Supabase.')
    } else {
      console.log('\n🎉 Todas as tabelas necessárias estão criadas!')
    }

    // Verificar dados iniciais
    console.log('\n🔍 Verificando dados iniciais...')

    const { data: usuarios } = await supabase.from('usuarios').select('count')
    const { data: insumos } = await supabase.from('insumos').select('count')
    const { data: receitas } = await supabase.from('receitas').select('count')
    const { data: ingredientes } = await supabase.from('receita_ingredientes').select('count')

    console.log(`👥 Usuários: ${usuarios?.length || 0}`)
    console.log(`📦 Insumos: ${insumos?.length || 0}`)
    console.log(`👨‍🍳 Receitas: ${receitas?.length || 0}`)
    console.log(`🥄 Ingredientes: ${ingredientes?.length || 0}`)

    // Verificar usuário admin
    const { data: adminUser } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', 'admin@gmail.com')
      .single()

    if (adminUser) {
      console.log(`✅ Usuário admin encontrado: ${adminUser.nome}`)
    } else {
      console.log(`❌ Usuário admin não encontrado`)
    }

  } catch (error) {
    console.error('❌ Erro na verificação:', error.message)
  }
}

// Executar verificação
verificarECriarTabelas()
