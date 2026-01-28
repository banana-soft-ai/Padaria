/**
 * Script para configurar usuários no Supabase
 * Execute este script após criar as tabelas no banco
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const { serverEnv } = require('../../src/env/server-env.cjs')

const supabaseUrl = serverEnv.SUPABASE_URL
const supabaseServiceKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false } // importante para scripts
})

async function setupUsers() {
    try {
        console.log('🚀 Configurando usuários...')

        // Array de usuários a serem criados
        const users = [
            // Usuário Operacional (Colaborador)
            { 
                email: 'liliannogue001@gmail.com', 
                password: '@101222Tlc', 
                nome: 'Lilian', 
                role: 'funcionario'  // Role operacional - não pode desbloquear menu admin
            },
            // Usuário Administrador
            { 
                email: 'admin@gmail.com', 
                password: 'Adminrdp1234@', 
                nome: 'Administrador', 
                role: 'admin'  // Role admin - pode desbloquear menu administrativo
            }
            // Roles válidos: 'admin', 'gerente', 'funcionario', 'caixa'
        ]

        // Obter lista de usuários existentes
        const { data: existingData } = await supabase.auth.admin.listUsers()
        const existingUsers = existingData?.users || []

        for (const u of users) {
            const userExists = existingUsers.some(user => user.email === u.email)
            let userId

            if (!userExists) {
                // Criar usuário no Auth
                const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                    email: u.email,
                    password: u.password,
                    email_confirm: true,
                    user_metadata: { nome: u.nome, role: u.role }
                })
                if (authError) throw authError
                console.log(`✅ Usuário ${u.nome} criado no Auth:`, authData.user.email)
                userId = authData.user.id
            } else {
                // Atualizar senha de usuário existente
                const existing = existingUsers.find(user => user.email === u.email)
                userId = existing.id
                await supabase.auth.admin.updateUserById(userId, { password: u.password })
                console.log(`🔑 Senha do usuário ${u.nome} atualizada`)
            }

            // Inserir ou atualizar na tabela usuarios
            const { error: dbError } = await supabase.from('usuarios').upsert({
                email: u.email,
                nome: u.nome,
                role: u.role,
                ativo: true
            }, { onConflict: 'email' })

            if (dbError) throw dbError
            console.log(`✅ Usuário ${u.nome} configurado na tabela usuarios`)
        }

        // Verificar se tabelas principais existem
        console.log('\n🔍 Verificando estrutura do banco...')
        const tables = ['usuarios', 'insumos', 'receitas', 'produtos', 'clientes', 'caixas', 'vendas']
        for (const table of tables) {
            const { data, error } = await supabase.from(table).select('*').limit(1)
            if (error) console.log(`❌ Tabela ${table}: ${error.message}`)
            else console.log(`✅ Tabela ${table}: OK`)
        }

        console.log('\n🎉 Configuração concluída com sucesso!')
        console.log('\n📝 Credenciais de acesso:')
        console.log('\n👤 USUÁRIO OPERACIONAL (Colaborador):')
        console.log(`   Email: liliannogue001@gmail.com`)
        console.log(`   Senha: @101222Tlc`)
        console.log(`   Role: funcionario (acesso apenas ao bloco Colaborador)`)
        console.log('\n👨‍💼 USUÁRIO ADMINISTRADOR:')
        console.log(`   Email: admin@gmail.com`)
        console.log(`   Senha: Adminrdp1234@`)
        console.log(`   Role: admin (pode desbloquear menu administrativo)`)
        console.log('\n🌐 Acesse o sistema em: http://localhost:3000/login')

    } catch (error) {
        console.error('❌ Erro na configuração:', error.message)
        process.exit(1)
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    setupUsers()
}

module.exports = { setupUsers }
