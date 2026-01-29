'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo, memo } from 'react'
import {
  Clock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Menu,
  X
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useAdminUnlock } from '@/hooks/useAdminUnlock'
import { getMenuConfig, filterMenuItems, shouldShowBlock } from '@/lib/menuConfig'
import AdminUnlockModal from './AdminUnlockModal'

function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { role, loading: userLoading } = useUser()
  const { isUnlocked, lock } = useAdminUnlock()
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Estado persistente do sidebar (aberto/fechado)
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('sidebar-open')
    const value = saved === null ? true : saved === 'true'
    return value
  })

  useEffect(() => {
    setIsMounted(true)
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar-open', String(isOpen))
  }, [isOpen])

  // Limpar estado de desbloqueio ao fazer logout
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Não limpar aqui, deixar sessionStorage gerenciar
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    })

  const formatDate = (date: Date) =>
    date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    })

  // Obter configuração do menu baseada no role e estado de desbloqueio
  // Memoizar para evitar recálculos desnecessários
  const menuBlocks = useMemo(() => {
    if (userLoading) return []
    const blocks = getMenuConfig(role, isUnlocked)
    return blocks
  }, [role, isUnlocked, userLoading])

  const handleUnlockSuccess = () => {
    setShowUnlockModal(false)
    // O hook useAdminUnlock já atualiza o estado
  }

  const handleBlockClick = (blockTitle: string) => {
    if (blockTitle === 'Administrador' && !isUnlocked) {
      setShowUnlockModal(true)
    }
  }

  const handleLockAdmin = () => {
    lock()
  }

  if (userLoading) {
    return (
      <aside className="fixed md:static z-50 h-full bg-white shadow-lg flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </aside>
    )
  }

  return (
    <>
      {/* 📱 Botão Hamburger - Visível apenas no Mobile */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="
          fixed top-4 left-4 z-40
          flex md:hidden
          h-10 w-10
          items-center justify-center
          rounded-lg bg-white shadow-md border border-gray-200
          hover:bg-gray-50
        "
      >
        <Menu className="h-6 w-6 text-gray-600" />
      </button>

      {/* 🌑 Overlay/Backdrop - Fecha o menu ao clicar fora */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-[60] md:static md:relative md:z-30
          h-full bg-white shadow-2xl md:shadow-lg
          flex flex-col
          transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isOpen ? 'w-64' : 'md:w-20 w-64'}
        `}
      >
        {/* 🔹 HEADER */}
        <div className="relative flex h-20 items-center justify-center border-b border-gray-200">
          {/* Botão fechar (Mobile) */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute left-4 md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-md"
          >
            <X className="h-6 w-6" />
          </button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="
              absolute right-2 top-6
              hidden md:flex
              h-8 w-8
              items-center justify-center
              rounded-full
              bg-white shadow border
              hover:bg-gray-100
            "
          >
            {isOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {(isOpen || isMobileMenuOpen) && (
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900">
                Rey dos Pães
              </h1>
              {isMounted && currentTime && (
                <div className="mt-1 flex items-center justify-center space-x-1">
                  <Clock className="h-3 w-3 text-gray-500" />
                  <div className="text-xs font-mono text-gray-600">
                    <div className="font-semibold">{formatTime(currentTime)}</div>
                    <div className="text-gray-500">{formatDate(currentTime)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {!isOpen && !isMobileMenuOpen && (
            <div className="text-center hidden md:block">
              <h1 className="text-lg font-bold text-gray-900">RP</h1>
            </div>
          )}
        </div>

        {/* 🔹 MENU */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {menuBlocks.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-sm">Carregando menu...</p>
              </div>
            </div>
          ) : (
            menuBlocks.map((block) => {
            // Verificar se o bloco deve ser exibido
            const shouldShow = shouldShowBlock(block, role, isUnlocked)
            if (!shouldShow) {
              return null
            }

            const isAdminBlock = block.title === 'Administrador'
            const isBlocked = isAdminBlock && !isUnlocked

            return (
              <div key={block.title} className="space-y-2">
                {/* Título do Bloco */}
                {(isOpen || isMobileMenuOpen) && !['Colaborador', 'Administrador'].includes(block.title) && (
                  <div className="flex items-center justify-between px-2 mb-2">
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {block.title}
                    </h2>
                    {isAdminBlock && isUnlocked && (
                      <button
                        onClick={handleLockAdmin}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Bloquear menu administrativo"
                      >
                        <Lock className="h-3 w-3 text-gray-400" />
                      </button>
                    )}
                  </div>
                )}

                {/* Seções do Bloco */}
                {block.sections.map((section) => {
                  // Filtrar itens baseado no estado de desbloqueio
                  const visibleItems = filterMenuItems(section.items, isUnlocked)
                  if (visibleItems.length === 0) {
                    return null
                  }

                  return (
                    <div key={section.title} className="space-y-1">
                      {(isOpen || isMobileMenuOpen) && (
                        <div className="flex flex-col px-2 mb-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              {section.title}
                            </h3>
                            {isAdminBlock && section.title === 'Administrador' && isUnlocked && (
                              <button
                                onClick={handleLockAdmin}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                title="Bloquear menu administrativo"
                              >
                                <Lock className="h-3 w-3 text-gray-400" />
                              </button>
                            )}
                          </div>
                          {section.description && (
                            <p className="text-[10px] text-gray-400 font-medium leading-none mt-0.5">
                              {section.description}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="space-y-1">
                        {visibleItems.map((item) => {
                          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                          const isComingSoon = item.comingSoon
                          
                          const content = (
                            <>
                              <item.icon
                                className={`h-6 w-6 flex-shrink-0 ${
                                  isActive ? 'text-primary' : isComingSoon ? 'text-gray-300' : 'text-gray-400'
                                }`}
                              />
                              {isOpen || isMobileMenuOpen ? (
                                <div className="ml-3 flex flex-col min-w-0">
                                  <span className={`text-sm truncate ${isComingSoon ? 'text-gray-400' : ''}`}>
                                    {item.name}
                                  </span>
                                </div>
                              ) : (
                                <span className="sr-only">{item.name} {isComingSoon ? '(Em breve)' : ''}</span>
                              )}
                            </>
                          )

                          if (isComingSoon) {
                            return (
                              <div
                                key={item.name}
                                title={!isOpen ? `${item.name} (Em breve)` : undefined}
                                className={`
                                  flex items-center rounded-md px-3 py-3 cursor-not-allowed
                                  text-gray-400 bg-transparent
                                  ${isOpen || isMobileMenuOpen ? 'justify-start' : 'justify-center'}
                                `}
                              >
                                {content}
                              </div>
                            )
                          }

                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              title={!isOpen ? item.name : undefined}
                              className={`
                                group flex items-center rounded-md px-3 py-3 transition-colors
                                ${isActive
                                  ? 'bg-primary/20 text-primary'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                ${isOpen || isMobileMenuOpen ? 'justify-start' : 'justify-center'}
                              `}
                            >
                              {content}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* Botão de Desbloqueio para Bloco Administrador bloqueado */}
                {isAdminBlock && isBlocked && (
                  <button
                    onClick={() => handleBlockClick(block.title)}
                    className={`
                      w-full flex items-center rounded-md px-3 py-3 transition-colors
                      bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900
                      border border-gray-200 border-dashed
                      ${isOpen || isMobileMenuOpen ? 'justify-start' : 'justify-center'}
                    `}
                    title={!isOpen ? 'Desbloquear menu administrativo' : undefined}
                  >
                    <Lock className="h-6 w-6 flex-shrink-0 text-gray-400" />
                    {(isOpen || isMobileMenuOpen) && (
                      <span className="ml-3 text-sm">Clique para desbloquear</span>
                    )}
                  </button>
                )}
              </div>
            )
          })
          )}
        </nav>

        {/* 🔹 FOOTER */}
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={() => {
              setIsMobileMenuOpen(false)
              lock() // Limpar estado de desbloqueio ao fazer logout
              router.push('/logout')
            }}
            title={!isOpen ? 'Sair' : undefined}
            className={`
              flex items-center w-full px-3 py-3 rounded-md
              hover:bg-gray-50 text-gray-600
              ${isOpen || isMobileMenuOpen ? 'justify-start' : 'justify-center'}
            `}
          >
            <LogOut className="h-6 w-6 text-gray-400" />
            {(isOpen || isMobileMenuOpen) && <span className="ml-3 text-sm">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Modal de Desbloqueio */}
      <AdminUnlockModal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        onSuccess={handleUnlockSuccess}
      />
    </>
  )
}

export default memo(Sidebar)
