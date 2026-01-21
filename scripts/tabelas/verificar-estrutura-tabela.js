/**
 * Script genérico para verificar registros de qualquer tabela no Supabase
 * Uso: node scripts/verificar-estrutura-tabela.js nome_da_tabela
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const { serverEnv } = require('../../src/env/server-env.cjs')
const supabaseUrl = serverEnv.SUPABASE_URL
const supabaseServiceKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Pega o nome da tabela passado como argumento
const tabela = process.argv[2]

if (!tabela) {
  console.error('❌ Por favor, informe o nome da tabela.')
  console.log('💡 Exemplo: node scripts/verificar-estrutura-tabela.js receitas')
  process.exit(1)
}

async function verificarRegistros() {
  try {
    console.log(`🔍 Verificando registros da tabela "${tabela}"...`)

    // Buscar todos os registros e ordenar pelo id
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      console.log('❌ Erro ao buscar dados:', error.message)
      return
    }

    if (!data || data.length === 0) {
      console.log('ℹ️  Nenhum registro encontrado.')
    } else {
      console.log(`✅ ${data.length} registro(s) encontrado(s):`)
      console.log(JSON.stringify(data, null, 2))
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message)
  }
}

// Executar verificação
verificarRegistros()
