/**
 * Script para testar login no Supabase
 * Execute este script para confirmar se o usuário consegue autenticar
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const { serverEnv } = require('../../src/env/server-env.cjs')

const supabaseUrl = serverEnv.SUPABASE_URL
const anonKey = serverEnv.SUPABASE_ANON_KEY
const serviceRole = serverEnv.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, anonKey)
const supabaseAdmin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })

async function testarLogin() {
  const email = 'liliannogue001@gmail.com'
  const password = '@101222Tlc'

  try {
    console.log(`🔍 Testando login do usuário: ${email}`)

    // 1. Tentativa de login normal
    let { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (!error) {
      console.log('✅ Login realizado com sucesso!')
      console.log(`👤 Usuário: ${data.user.email}`)
      return
    }

    console.log('❌ Erro no login:', error.message)

    if (error.message.includes('Invalid login credentials')) {
      console.log('\n🔧 Credenciais inválidas. Verificando se o usuário existe...\n')

      // 2. Verificar se o usuário existe no Auth
      const { data: list } = await supabaseAdmin.auth.admin.listUsers()
      const exists = list?.users?.some(u => u.email === email)

      if (!exists) {
        console.log('👤 Usuário não existe. Criando novamente...')

        const { error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        })

        if (createError) {
          console.error('❌ Erro ao criar usuário:', createError.message)
          return
        }

        console.log('✅ Usuário criado! Tentando login novamente...\n')
      } else {
        console.log('🔑 Usuário existe. Atualizando senha...\n')

        const userId = list.users.find(u => u.email === email).id

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })

        if (updateError) {
          console.error('❌ Erro ao redefinir senha:', updateError.message)
          return
        }

        console.log('🔑 Senha atualizada! Tentando login novamente...\n')
      }

      // 3. Nova tentativa de login
      const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({ email, password })

      if (retryError) {
        console.error('❌ Erro no segundo login:', retryError.message)
        return
      }

      console.log('✅ Login realizado com sucesso após correção!')
      console.log(`👤 Usuário: ${retryData.user.email}`)
    }

  } catch (err) {
    console.error('❌ Erro inesperado:', err.message)
  }
}

if (require.main === module) {
  testarLogin()
}

module.exports = { testarLogin }
