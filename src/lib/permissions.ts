import type { UserRole } from '@/hooks/useUser'

/**
 * Verifica se o usuário tem uma role específica
 */
export function hasRole(userRole: UserRole | null, requiredRole: UserRole | UserRole[]): boolean {
  if (!userRole) return false
  
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(userRole)
  }
  
  return userRole === requiredRole
}

/**
 * Verifica se o usuário pode ver o botão de desbloqueio do menu administrativo
 * (Qualquer usuário logado pode ver para que um admin possa desbloquear no terminal dele)
 */
export function canUnlockAdmin(userRole: UserRole | null): boolean {
  return !!userRole
}

/**
 * Verifica se o usuário pode acessar uma rota específica
 */
export function canAccessRoute(userRole: UserRole | null, route: string, adminUnlocked: boolean = false): boolean {
  if (!userRole) return false

  // Rotas bloqueadas (Em breve) - ninguém acessa
  const blockedRoutes = [
    '/gestao/fiscal',
    '/sistema/pagamentos'
  ]

  if (blockedRoutes.some(r => route.startsWith(r))) {
    return false
  }

  // Rotas operacionais - acessíveis por todos os usuários logados
  const operationalRoutes = [
    '/caixa',
    '/receitas',
    '/estoque',
    '/gestao/estoque',
    '/configuracoes'
  ]

  if (operationalRoutes.some(r => route.startsWith(r))) {
    return true
  }

  // Rotas administrativas - acessíveis por admin/gerente OU se o menu estiver desbloqueado
  const adminRoutes = [
    '/gestao',
    '/sistema'
  ]

  if (adminRoutes.some(r => route.startsWith(r))) {
    return hasRole(userRole, ['admin', 'gerente']) || adminUnlocked
  }

  // Rotas públicas (login, logout, etc)
  const publicRoutes = [
    '/login',
    '/logout',
    '/offline'
  ]

  if (publicRoutes.some(r => route.startsWith(r))) {
    return true
  }

  // Por padrão, permitir acesso se autenticado
  return true
}

/**
 * Verifica se uma rota requer permissões administrativas
 */
export function isAdminRoute(route: string): boolean {
  const adminRoutes = [
    '/gestao',
    '/sistema'
  ]

  return adminRoutes.some(r => route.startsWith(r))
}

/**
 * Verifica se uma rota é operacional (acessível por colaboradores)
 */
export function isOperationalRoute(route: string): boolean {
  const operationalRoutes = [
    '/caixa',
    '/receitas',
    '/estoque',
    '/gestao/estoque',
    '/configuracoes'
  ]

  return operationalRoutes.some(r => route.startsWith(r))
}

/**
 * Retorna o nome amigável da role
 */
export function getRoleName(role: UserRole | null): string {
  switch (role) {
    case 'admin':
      return 'Administrador'
    case 'gerente':
      return 'Gerente'
    case 'funcionario':
      return 'Colaborador'
    case 'caixa':
      return 'Colaborador'
    default:
      return 'Usuário'
  }
}
