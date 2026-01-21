/**
 * Script para testar conexão com Supabase
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente não encontradas!')
  console.error('Certifique-se de que .env.local existe com as credenciais do Supabase')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testarConexao() {
  try {
    console.log('🔍 Testando conexão com Supabase...')

    // Testar conexão básica
    const { data, error } = await supabase
      .from('usuarios')
    const { serverEnv } = require('../../src/env/server-env.cjs')
    const supabaseUrl = serverEnv.SUPABASE_URL
    const supabaseAnonKey = serverEnv.SUPABASE_ANON_KEY

    if (error) {
      console.error('❌ Erro na conexão:', error.message)
      return false
    }

    console.log('✅ Conexão com Supabase estabelecida com sucesso!')

    // Verificar se as tabelas existem
    console.log('\n📊 Verificando tabelas...')

    const tabelas = ['usuarios', 'insumos', 'receitas', 'produtos', 'clientes', 'caixas', 'vendas']

    for (const tabela of tabelas) {
      try {
        const { data, error } = await supabase
          .from(tabela)
          .select('count')
          .limit(1)

        if (error) {
          console.log(`❌ Tabela ${tabela}: ${error.message}`)
        } else {
          console.log(`✅ Tabela ${tabela}: OK`)
        }
      } catch (err) {
        console.log(`❌ Tabela ${tabela}: Erro inesperado`)
      }
    }

    return true

  } catch (error) {
    console.error('❌ Erro geral:', error.message)
    return false
  }
}

// Executar teste
testarConexao().then(sucesso => {
  if (sucesso) {
    console.log('\n🎉 Sistema pronto para uso!')
    console.log('🌐 Acesse: http://localhost:3000/login')
    console.log('📧 Email: liliannoguei001@gmail.com')
  } else {
    console.log('\n❌ Sistema não está pronto. Verifique a configuração.')
  }
})
