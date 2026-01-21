/**
 * Script para debugar dados no banco com cores e melhor visualização
 */

require('dotenv').config({ path: 'C:/Users/plugify/Documents/reydospaes/.env.local' })
const { createClient } = require('@supabase/supabase-js')
const chalk = require('chalk').default
const { serverEnv } = require('../../src/env/server-env.cjs')

// Testar se as variáveis foram carregadas
const supabaseUrl = serverEnv.SUPABASE_URL
const supabaseServiceKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY

console.log(chalk.blue.bold('🔹 Conectando ao Supabase...'))

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugDados() {
    try {
        console.log(chalk.magenta.bold('\n🔍 Debugando dados no banco...\n'))

        // Função auxiliar para exibir dados de forma padronizada
        const exibirDados = (titulo, data, formatFunc) => {
            console.log(chalk.cyan.bold(titulo))
            if (!data || data.length === 0) {
                console.log(chalk.yellow('  ⚠️ Nenhum registro encontrado'))
                return
            }
            console.log(chalk.green(`  Total: ${data.length}`))
            data.forEach(formatFunc)
        }

        // INSUMOS
        const { data: insumos, error: insumosError } = await supabase
            .from('insumos')
            .select('*')
            .order('id')

        if (insumosError) {
            console.log(chalk.red(`❌ Erro ao buscar insumos: ${insumosError.message}`))
        } else {
            exibirDados('📦 INSUMOS:', insumos, i => console.log(`  - ${chalk.blue('ID:')} ${i.id}, ${chalk.blue('Nome:')} ${i.nome}, ${chalk.blue('Categoria:')} ${i.categoria}`))
        }

        // RECEITAS
        const { data: receitas, error: receitasError } = await supabase
            .from('receitas')
            .select('*')
            .order('id')

        if (receitasError) {
            console.log(chalk.red(`❌ Erro ao buscar receitas: ${receitasError.message}`))
        } else {
            exibirDados('👨‍🍳 RECEITAS:', receitas, r => console.log(`  - ${chalk.blue('ID:')} ${r.id}, ${chalk.blue('Nome:')} ${r.nome}, ${chalk.blue('Categoria:')} ${r.categoria}`))
        }

        // INGREDIENTES
        const { data: ingredientes, error: ingredientesError } = await supabase
            .from('receita_ingredientes')
            .select(`
        *,
        receita:receitas(nome),
        insumo:insumos(nome)
      `)
            .order('receita_id')

        if (ingredientesError) {
            console.log(chalk.red(`❌ Erro ao buscar ingredientes: ${ingredientesError.message}`))
        } else {
            exibirDados('🥄 INGREDIENTES:', ingredientes, ing =>
                console.log(`  - ${chalk.blue('Receita:')} ${ing.receita?.nome}, ${chalk.blue('Insumo:')} ${ing.insumo?.nome}, ${chalk.blue('Qtd:')} ${ing.quantidade}`)
            )
        }

        // PRODUTOS
        const { data: produtos, error: produtosError } = await supabase
            .from('produtos')
            .select(`
        *,
        receita:receitas(nome)
      `)
            .order('id')

        if (produtosError) {
            console.log(chalk.red(`❌ Erro ao buscar produtos: ${produtosError.message}`))
        } else {
            exibirDados('🛍️ PRODUTOS:', produtos, p =>
                console.log(`  - ${chalk.blue('ID:')} ${p.id}, ${chalk.blue('Nome:')} ${p.nome}, ${chalk.blue('Preço:')} R$ ${p.preco_venda}`)
            )
        }

        //CLIENTES
        const { data: clientes, error: clientesError } = await supabase
            .from('clientes')
            .select('*')
            .order('id')

        if (clientesError) {
            console.log(chalk.red(`❌ Erro ao buscar clientes: ${clientesError.message}`))
        } else {
            exibirDados('👥 CLIENTES:', clientes, c =>
                console.log(`  - ${chalk.blue('ID:')} ${c.id}, ${chalk.blue('Nome:')} ${c.nome}, ${chalk.blue('Email:')} ${c.email}`)
            )
        }


        // SE QUIRER DEBUGAR UM DADOS O PADRÃO É

        // const { data: <nome_variavel>, error: <nome_variavel>Error } = await supabase
        //   .from('<nome_tabela>')
        //   .select('*')
        //   .order('id')
        // if (<nome_variavel>Error) {
        //   console.log(chalk.red(`❌ Erro ao buscar <descrição dados>: ${<nome_variavel>Error.message}`))
        // } else { 
        //   exibirDados('<TÍTULO>:', <nome_variavel>, d =>
        //     console.log(`  - ${chalk.blue('ID:')} ${d.id}, ${chalk.blue('<campo>:')} ${d.<campo>}`)
        //   )
        // }


        console.log(chalk.green.bold('\n🎉 Debug concluído!\n'))

    } catch (error) {
        console.error(chalk.red.bold('❌ Erro geral:'), error.message)
    }
}

// Executar debug
debugDados()
