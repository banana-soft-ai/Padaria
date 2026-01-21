/**
 * Script para verificar se as tabelas existem no Supabase
 * Refatorado com cores usando chalk
 */

require('dotenv').config({ path: 'C:/Users/plugify/Documents/reydospaes/.env.local' })
const { createClient } = require('@supabase/supabase-js')
const chalk = require('chalk').default


// === Verifica se as variáveis de ambiente estão definidas ===
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(chalk.red('❌ Variáveis de ambiente do Supabase não encontradas!'))
}

// === Cria cliente Supabase ===
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Verifica se uma tabela existe no Supabase
 */
async function verificarTabela(nomeTabela) {
  process.stdout.write(chalk.cyan(`🔍 Verificando tabela: ${nomeTabela}... `))

  const { error } = await supabase
    .from(nomeTabela)
    .select('*')
    .limit(1)

  // Erro PGRST116 significa: tabela NÃO existe
  if (error?.code === 'PGRST116') {
    console.log(chalk.red('❌ NÃO existe'))
    return false
  }

  if (error) {
    console.log(chalk.yellow(`⚠️ Erro essa tabela nao existe: ${error.message}`))
    return false
  }

  console.log(chalk.green('✅ Existe'))
  return true
}

/**
 * Lista de tabelas esperadas
 */
const tabelas = [
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
  'lancamentos_fiscais',
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

/**
 * Função principal: verifica todas as tabelas
 */
async function verificarEstrutura() {
  console.log(chalk.magenta.bold('\n🚀 Iniciando verificação das tabelas no Supabase...\n'))

  for (const tabela of tabelas) {
    await verificarTabela(tabela)
  }

  console.log(chalk.magenta.bold('\n🎉 Verificação concluída!\n'))

  console.log(chalk.blue('📌 Próximos passos:'))
  console.log('1. Acesse o painel do Supabase: https://supabase.com/dashboard')
  console.log('2. Vá em SQL Editor')
  console.log('3. Execute o script de criação de tabelas se alguma estiver faltando.\n')
}

// === Execução direta ===
if (require.main === module) {
  verificarEstrutura()
}

module.exports = { verificarEstrutura }
