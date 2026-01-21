import { NextResponse } from 'next/server'

// Middleware foi simplificado para evitar dependências do Supabase no Edge Runtime
// (supabase-js utiliza process.versions e gera warning em builds do Next Edge).
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
