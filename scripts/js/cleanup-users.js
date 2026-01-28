const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const { serverEnv } = require('../../src/env/server-env.cjs')

const supabaseUrl = serverEnv.SUPABASE_URL
const supabaseServiceKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
})

async function cleanupUsers() {
    const emailsToDelete = [
        'liliannoguei001@gmail.com',
        'usuario2@email.com',
        'edmilsonnoguei001@gmail.com'
    ]

    console.log('🧹 Iniciando limpeza de usuários...')

    for (const email of emailsToDelete) {
        try {
            console.log(`\n🔍 Processando: ${email}`)

            // 1. Deletar da tabela 'usuarios'
            const { error: dbError } = await supabase
                .from('usuarios')
                .delete()
                .eq('email', email)

            if (dbError) {
                console.error(`❌ Erro ao deletar da tabela usuarios:`, dbError.message)
            } else {
                console.log(`✅ Removido da tabela 'usuarios'`)
            }

            // 2. Deletar do Auth (se existir)
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
            if (listError) throw listError

            const user = users.find(u => u.email === email)
            if (user) {
                const { error: authError } = await supabase.auth.admin.deleteUser(user.id)
                if (authError) {
                    console.error(`❌ Erro ao deletar do Auth:`, authError.message)
                } else {
                    console.log(`✅ Removido do sistema de Autenticação`)
                }
            } else {
                console.log(`ℹ️ Usuário não encontrado no Auth`)
            }

        } catch (error) {
            console.error(`❌ Erro inesperado para ${email}:`, error.message)
        }
    }

    console.log('\n✨ Limpeza concluída!')
}

cleanupUsers()
