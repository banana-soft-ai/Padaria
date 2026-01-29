import {
  ShoppingCart,
  ChefHat,
  Package,
  Settings,
  BarChart3,
  TrendingDown,
  TrendingUp,
  DollarSign,
  User,
  Calculator,
  FileText,
  CreditCard,
  Users,
  Lock
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserRole } from '@/hooks/useUser'

export interface MenuItem {
  name: string
  href: string
  icon: LucideIcon
  requiresAdminUnlock?: boolean
  comingSoon?: boolean
}

export interface MenuSection {
  title: string
  items: MenuItem[]
  description?: string
}

export interface MenuBlock {
  title: string
  sections: MenuSection[]
  requiresUnlock?: boolean
  unlockIcon?: LucideIcon
  description?: string
}

/**
 * Configuração completa do menu lateral
 * Baseado na estrutura visual da imagem fornecida
 */
export function getMenuConfig(role: UserRole | null, adminUnlocked: boolean): MenuBlock[] {
  const blocks: MenuBlock[] = []

  // BLOCO 1 - Colaborador (sempre visível para todos)
  const colaboradorBlock: MenuBlock = {
    title: 'Colaborador',
    sections: [
      {
        title: 'OPERACIONAL',
        items: [
          { name: 'Vendas (PDV)', href: '/caixa', icon: ShoppingCart },
          { name: 'Receitas', href: '/receitas', icon: ChefHat },
          { name: 'Estoque', href: '/estoque', icon: Package }
        ]
      },
      {
        title: 'SISTEMA',
        items: [
          { name: 'Configurações', href: '/configuracoes', icon: Settings }
        ]
      }
    ]
  }

  blocks.push(colaboradorBlock)

  // BLOCO 2 - Administrador (Sempre visível, mas requer desbloqueio)
  const adminBlock: MenuBlock = {
    title: 'Administrador',
    sections: [
      {
        title: 'Administrador',
        items: [
          { name: 'Dashboard', href: '/gestao/dashboard', icon: BarChart3, requiresAdminUnlock: true },
          { name: 'Caixas', href: '/gestao/caixas', icon: BarChart3, requiresAdminUnlock: true },
          { name: 'Saídas', href: '/gestao/saidas', icon: TrendingDown, requiresAdminUnlock: true },
          { name: 'Vendas', href: '/gestao/vendas', icon: TrendingUp, requiresAdminUnlock: true },
          { name: 'Preços', href: '/gestao/precos', icon: DollarSign, requiresAdminUnlock: true },
          { name: 'Operadores', href: '/gestao/operadores', icon: User, requiresAdminUnlock: true },
          { name: 'Estoque', href: '/gestao/estoque', icon: Package, requiresAdminUnlock: true },
          { name: 'Gestão Financeira', href: '/gestao/lucro', icon: Calculator, requiresAdminUnlock: true }
        ]
      },
      {
        title: 'SISTEMA',
        items: [
          { name: 'Usuários', href: '/sistema/usuarios', icon: Users, requiresAdminUnlock: true }
        ]
      },
      {
        title: 'EM BREVE',
        items: [
          { name: 'Fiscal e Contábil', href: '/gestao/fiscal', icon: FileText, requiresAdminUnlock: true, comingSoon: true },
          { name: 'Pagamento e Planos', href: '/sistema/pagamentos', icon: CreditCard, requiresAdminUnlock: true, comingSoon: true }
        ]
      }
    ],
    requiresUnlock: true,
    unlockIcon: Lock
  }

  blocks.push(adminBlock)

  return blocks
}

/**
 * Filtra itens do menu baseado no estado de desbloqueio
 */
export function filterMenuItems(items: MenuItem[], adminUnlocked: boolean): MenuItem[] {
  return items.filter(item => {
    // Se o item requer desbloqueio admin e o menu não está desbloqueado, ocultar
    if (item.requiresAdminUnlock && !adminUnlocked) {
      return false
    }
    return true
  })
}

/**
 * Verifica se um bloco deve ser exibido
 */
export function shouldShowBlock(block: MenuBlock, role: UserRole | null, adminUnlocked: boolean): boolean {
  // Bloco Colaborador sempre visível
  if (block.title === 'Colaborador') {
    return true
  }

  // Bloco Administrador sempre visível (mas bloqueado se não for admin/gerente ou não estiver desbloqueado)
  if (block.title === 'Administrador') {
    return true
  }

  return true
}
