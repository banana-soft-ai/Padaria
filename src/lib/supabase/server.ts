// /supabase/server.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clientEnv } from '@/env/client-env'
import type { Database } from './types'
import { serverEnv, NODE_ENV } from '@/env/server-env'
import { createSupabaseCookies } from './supabaseCookies'

/**
 * Client server-side do Supabase
 * Usado em Server Components ou API Routes.
 * NÃO importar em componentes client-side ("use client").
 */

// Pega a URL do Supabase (validação centralizada via serverEnv/clientEnv)
const serverUrl = serverEnv.SUPABASE_URL || clientEnv.NEXT_PUBLIC_SUPABASE_URL || ''

// Server-side user-aware client: usar ANON key + cookies (NÃO usar Service Role Key aqui)
const serverKey = serverEnv.SUPABASE_ANON_KEY || clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Aviso em desenvolvimento se variáveis estiverem ausentes ou se a Service Role Key estiver sendo (incorretamente) utilizada aqui
if (!serverUrl || !serverKey) {
  if (NODE_ENV === 'development') {
    console.warn(
      `[Supabase] Variáveis de ambiente do Supabase ausentes: ` +
      `${!serverUrl ? 'SUPABASE_URL ' : ''}${!serverKey ? 'SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY' : ''}. ` +
      `Chamadas ao Supabase que dependem do usuário podem falhar em runtime.`
    )
  }
}

if (serverEnv.SUPABASE_SERVICE_ROLE_KEY && NODE_ENV === 'development') {
  console.warn('[Supabase] Atenção: SUPABASE_SERVICE_ROLE_KEY está definida. Não use a Service Role Key em `/supabase/server.ts` — ela é para scripts/admin apenas.')
}

/**
 * Cria um client do Supabase para server-side
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient<any> /* server-side supabase client */> {
  // Pega o cookie store para autenticação de usuários
  const cookieStore = await cookies()

  const supabaseCookies = createSupabaseCookies(cookieStore)

  return createServerClient(
    serverUrl,
    serverKey,
    { cookies: supabaseCookies }
  ) as unknown as SupabaseClient<any>
}
