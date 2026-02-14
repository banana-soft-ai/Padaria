import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey)

let cachedClient: SupabaseClient | null = null

export function getSupabaseE2EClient() {
  if (!hasSupabaseEnv) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas para E2E.')
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl as string, supabaseKey as string)
  }

  return cachedClient
}

export function createE2ELabel(prefix: string) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`
  return `${prefix} ${id}`
}
