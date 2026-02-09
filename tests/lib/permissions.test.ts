import {
  hasRole,
  canUnlockAdmin,
  canAccessRoute,
  isAdminRoute,
  isOperationalRoute,
  getRoleName,
} from '@/lib/permissions'

describe('lib/permissions', () => {
  describe('hasRole', () => {
    it('retorna false se userRole for null', () => {
      expect(hasRole(null, 'admin')).toBe(false)
    })

    it('compara role única', () => {
      expect(hasRole('admin', 'admin')).toBe(true)
      expect(hasRole('gerente', 'admin')).toBe(false)
      expect(hasRole('funcionario', 'funcionario')).toBe(true)
    })

    it('aceita array de roles', () => {
      expect(hasRole('admin', ['admin', 'gerente'])).toBe(true)
      expect(hasRole('gerente', ['admin', 'gerente'])).toBe(true)
      expect(hasRole('funcionario', ['admin', 'gerente'])).toBe(false)
    })
  })

  describe('canUnlockAdmin', () => {
    it('retorna true para qualquer usuário logado', () => {
      expect(canUnlockAdmin('admin')).toBe(true)
      expect(canUnlockAdmin('funcionario')).toBe(true)
    })
    it('retorna false para null', () => {
      expect(canUnlockAdmin(null)).toBe(false)
    })
  })

  describe('canAccessRoute', () => {
    it('retorna false se userRole for null', () => {
      expect(canAccessRoute(null, '/gestao')).toBe(false)
      expect(canAccessRoute(null, '/caixa')).toBe(false)
    })

    it('retorna false para rotas bloqueadas (fiscal, pagamentos)', () => {
      expect(canAccessRoute('admin', '/gestao/fiscal')).toBe(false)
      expect(canAccessRoute('admin', '/sistema/pagamentos')).toBe(false)
    })

    it('permite rotas operacionais para qualquer logado', () => {
      expect(canAccessRoute('funcionario', '/caixa')).toBe(true)
      expect(canAccessRoute('funcionario', '/receitas')).toBe(true)
      expect(canAccessRoute('funcionario', '/configuracoes')).toBe(true)
    })

    it('permite rotas administrativas para admin/gerente', () => {
      expect(canAccessRoute('admin', '/gestao')).toBe(true)
      expect(canAccessRoute('gerente', '/gestao')).toBe(true)
      expect(canAccessRoute('funcionario', '/gestao')).toBe(false)
    })

    it('permite rotas administrativas para funcionário se adminUnlocked', () => {
      expect(canAccessRoute('funcionario', '/gestao', true)).toBe(true)
      expect(canAccessRoute('funcionario', '/sistema', true)).toBe(true)
    })

    it('permite rotas públicas', () => {
      expect(canAccessRoute('admin', '/login')).toBe(true)
      expect(canAccessRoute(null, '/login')).toBe(false)
    })
  })

  describe('isAdminRoute', () => {
    it('identifica rotas de gestão e sistema', () => {
      expect(isAdminRoute('/gestao')).toBe(true)
      expect(isAdminRoute('/gestao/dashboard')).toBe(true)
      expect(isAdminRoute('/sistema')).toBe(true)
      expect(isAdminRoute('/caixa')).toBe(false)
    })
  })

  describe('isOperationalRoute', () => {
    it('identifica rotas operacionais', () => {
      expect(isOperationalRoute('/caixa')).toBe(true)
      expect(isOperationalRoute('/receitas')).toBe(true)
      expect(isOperationalRoute('/configuracoes')).toBe(true)
      expect(isOperationalRoute('/gestao')).toBe(false)
    })
  })

  describe('getRoleName', () => {
    it('retorna nome amigável para cada role', () => {
      expect(getRoleName('admin')).toBe('Administrador')
      expect(getRoleName('gerente')).toBe('Gerente')
      expect(getRoleName('funcionario')).toBe('Colaborador')
      expect(getRoleName('caixa')).toBe('Colaborador')
      expect(getRoleName(null)).toBe('Usuário')
    })
  })
})
