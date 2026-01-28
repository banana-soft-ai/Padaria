import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware foi simplificado para evitar dependências do Supabase no Edge Runtime
// (supabase-js utiliza process.versions e gera warning em builds do Next Edge).
// A verificação de permissões é feita no RouteGuard component.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas que não precisam de autenticação
  const publicRoutes = ['/login', '/logout', '/offline']
  
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Todas as outras rotas serão verificadas pelo RouteGuard
  // que tem acesso ao Supabase no client-side
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
