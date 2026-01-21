import { clientEnv } from '@/env/client-env'

export default function TestPage() {
  return (
    <div>
      <h1>Teste - Rey dos Pães</h1>
      <p>Supabase URL: {clientEnv.NEXT_PUBLIC_SUPABASE_URL}</p>
      <p>Anon Key: {clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configurado' : 'Não configurado'}</p>
    </div>
  )
}
