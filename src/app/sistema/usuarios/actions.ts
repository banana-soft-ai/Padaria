'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Chave mestra para operações de admin
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function criarUsuarioAuth(email: string, password: string, nome: string, role: string) {
  try {
    // 1. Criar o usuário no sistema de Autenticação (Auth)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, role }
    })

    if (authError) {
      console.error('Erro ao criar no Auth:', authError.message)
      return { success: false, error: authError.message }
    }

    // 2. Opcional: O trigger do banco ou a própria página cuidará da tabela 'usuarios'
    // Mas garantimos que o Auth foi criado.
    
    return { success: true, user: authUser.user }
  } catch (error) {
    console.error('Erro inesperado:', error)
    return { success: false, error: 'Erro interno ao criar usuário' }
  }
}
