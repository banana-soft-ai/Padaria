"use client"

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clientEnv } from '@/env/client-env'
import type { Database } from './types'

const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Aviso em desenvolvimento se variáveis públicas não estiverem definidas
if (typeof window !== 'undefined' && (!url || !anonKey)) {
  const missing = [
    !url ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
    !anonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
  ].filter(Boolean).join(', ')
  console.warn(`[Supabase] Variáveis ausentes: ${missing}. Defina-as em .env.local ou no provedor de deploy.`)
}

let _supabase: SupabaseClient<any> | null = null

if (typeof window !== 'undefined' && url && anonKey) {
  _supabase = createBrowserClient(url, anonKey) as unknown as SupabaseClient<any>
} else {
  const missing = [
    !url ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
    !anonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
  ].filter(Boolean).join(', ')
  const handler = {
    get() {
      throw new Error(`[Supabase] Cliente não configurado: variáveis ausentes (${missing}). Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no build do deploy.`)
    },
    apply() {
      throw new Error(`[Supabase] Cliente não configurado: variáveis ausentes (${missing}). Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no build do deploy.`)
    }
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - proxy will throw when used
  _supabase = new Proxy({}, handler) as unknown as SupabaseClient<any>
}

export const supabase = _supabase