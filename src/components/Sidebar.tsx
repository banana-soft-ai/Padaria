'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  ChefHat,
  ShoppingCart,
  BarChart3,
  Home,
  Settings,
  LogOut,
  Users,
  Clock,
  FileText,
  Barcode,
  Printer,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

/* 🔹 SEÇÕES DO SIDEBAR */
const sidebarSections = [
  {
    title: 'Início',
    items: [
      { name: 'Caixa (PDV)', href: '/caixa', icon: ShoppingCart },
      { name: 'Receitas', href: '/receitas', icon: ChefHat },
    ],
  },
  {
    title: 'Administrativo',
    items: [
      { name: 'Gestão', href: '/gestao', icon: BarChart3 },

    ],
  },
  {
    title: 'Sistema',
    items: [
      { name: 'Configurações', href: '/configuracoes', icon: Settings },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState(new Date())

  /* ✅ estado persistente correto */
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('sidebar-open')
    return saved === null ? true : saved === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebar-open', String(isOpen))
  }, [isOpen])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
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

  return (
    <aside
      className={`
        fixed md:static z-50
        h-full bg-white shadow-lg
        flex flex-col
        transition-all duration-300
        overflow-hidden
        ${isOpen ? 'w-64' : 'w-20'}
      `}
    >
      {/* 🔹 HEADER */}
      <div className="relative flex h-20 items-center justify-center border-b border-gray-200">
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

        {isOpen && (
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">
              Rey dos Pães
            </h1>

            <div className="mt-1 flex items-center justify-center space-x-1">
              <Clock className="h-3 w-3 text-gray-500" />
              <div className="text-xs font-mono text-gray-600">
                <div className="font-semibold">{formatTime(currentTime)}</div>
                <div className="text-gray-500">{formatDate(currentTime)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🔹 MENU */}
      <nav className="flex-1 px-3 py-4 space-y-4">
        {sidebarSections.map((section) => (
          <div key={section.title}>
            {isOpen && (
              <h2 className="px-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {section.title}
              </h2>
            )}

            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={!isOpen ? item.name : undefined}
                    className={`
                      group flex items-center rounded-md px-3 py-3 transition-colors
                      ${isActive
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                      ${isOpen ? 'justify-start' : 'justify-center'}
                    `}
                  >
                    <item.icon
                      className={`h-6 w-6 ${isActive ? 'text-blue-500' : 'text-gray-400'
                        }`}
                    />
                    {isOpen && (
                      <span className="ml-3 text-sm">{item.name}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 🔹 FOOTER */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={() => router.push('/logout')}
          title={!isOpen ? 'Sair' : undefined}
          className={`
            flex items-center w-full px-3 py-3 rounded-md
            hover:bg-gray-50 text-gray-600
            ${isOpen ? 'justify-start' : 'justify-center'}
          `}
        >
          <LogOut className="h-6 w-6 text-gray-400" />
          {isOpen && <span className="ml-3 text-sm">Sair</span>}
        </button>
      </div>
    </aside>
  )
}
