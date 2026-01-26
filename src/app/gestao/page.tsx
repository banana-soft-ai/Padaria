'use client'

import { useEffect, useState } from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import { DollarSign, TrendingUp, Package, BarChart3, TrendingDown, Calculator, ShoppingCart, User } from 'lucide-react'
import Link from 'next/link'

export default function GestaoPage() {
  const [loading, setLoading] = useState(true)
  const [vendasHojeTotal, setVendasHojeTotal] = useState(0)
  const [vendasHojeCount, setVendasHojeCount] = useState(0)
  const [vendasMesTotal, setVendasMesTotal] = useState(0)
  const [vendasMesCount, setVendasMesCount] = useState(0)
  const [itensVendidosHoje, setItensVendidosHoje] = useState(0)
  const [ticketMedioHoje, setTicketMedioHoje] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Simular carregamento
    setTimeout(() => setLoading(false), 800)
  }, [])

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) return
        const data = await res.json()
        setVendasHojeTotal(data.vendasHoje?.total || 0)
        setVendasHojeCount(data.vendasHoje?.count || 0)
        setVendasMesTotal(data.vendasMes?.total || 0)
        setVendasMesCount(data.vendasMes?.count || 0)
        setItensVendidosHoje(data.itensVendidosHoje || 0)
        setTicketMedioHoje(data.ticketMedioHoje || 0)
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err)
        setError('Erro ao carregar métricas')
      }
    }

    carregar()
  }, [])

  const menuItems = [
    {
      id: 'vendas',
      name: 'Vendas',
      description: 'Relatórios e análises de vendas',
      icon: TrendingUp,
      href: '/gestao/vendas',
      color: 'bg-blue-500',
      textColor: 'text-blue-500'
    },
        {
          id: 'operadores',
          name: 'Operadores',
          description: 'Gestão de operadores do sistema',
          icon: User,
          href: '/gestao/operadores',
          color: 'bg-cyan-500',
          textColor: 'text-cyan-500'
        },
    {
      id: 'saidas',
      name: 'Saídas',
      description: 'Listagem e filtros de saídas do caixa',
      icon: TrendingDown,
      href: '/gestao/saidas',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-500'
    },
    {
      id: 'precos',
      name: 'Preços',
      description: 'Configuração de preços de venda e margens',
      icon: DollarSign,
      href: '/gestao/precos',
      color: 'bg-green-500',
      textColor: 'text-green-500'
    },
    {
      id: 'estoque',
      name: 'Estoque',
      description: 'Controle e monitoramento do estoque',
      icon: Package,
      href: '/gestao/estoque',
      color: 'bg-orange-500',
      textColor: 'text-orange-500'
    },
    {
      id: 'caixas',
      name: 'Caixas',
      description: 'Histórico e controle de caixas diários',
      icon: BarChart3,
      href: '/gestao/caixas',
      color: 'bg-purple-500',
      textColor: 'text-purple-500'
    },
    {
      id: 'caderneta',
      name: 'Caderneta',
      description: 'Controle de caderneta e créditos',
      icon: User,
      href: '/gestao/caderneta',
      color: 'bg-pink-500',
      textColor: 'text-pink-500'
    },
    {
      id: 'lucro',
      name: 'Lucratividade',
      description: 'Análise de custos fixos e margens de lucro',
      icon: Calculator,
      href: '/gestao/lucro',
      color: 'bg-emerald-500',
      textColor: 'text-emerald-500'
    },
  ]

  return (
    <ProtectedLayout>
      <div className="page-container">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestão</h1>
          <p className="text-lg text-gray-600 mt-2">Central de controle e administração do seu negócio</p>
        </div>

        {/* Cards de Estatísticas (moved from Dashboard) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Vendas Hoje</p>
                <p className="text-2xl font-bold text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vendasHojeTotal)}</p>
                <p className="text-sm text-gray-500">{vendasHojeCount} vendas</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Vendas do Mês</p>
                <p className="text-2xl font-bold text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vendasMesTotal)}</p>
                <p className="text-sm text-gray-500">{vendasMesCount} vendas</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShoppingCart className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Itens Vendidos</p>
                <p className="text-2xl font-bold text-gray-900">{itensVendidosHoje}</p>
                <p className="text-sm text-gray-500">hoje</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Ticket Médio</p>
                <p className="text-2xl font-bold text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticketMedioHoje)}</p>
                <p className="text-sm text-gray-500">por venda</p>
              </div>
            </div>
          </div>
        </div>

        {/* Erro se houver */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Erro</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Menu de Navegação */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group block bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-gray-300 transition-all duration-200"
              >
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${item.color} bg-opacity-10 group-hover:bg-opacity-20 transition-all duration-200`}>
                    <Icon className={`h-8 w-8 ${item.textColor}`} />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-gray-600 mt-1 group-hover:text-gray-500 transition-colors">
                      {item.description}
                    </p>
                  </div>
                  <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Informações Adicionais */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 border border-blue-200">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Sistema de Gestão Completo
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Acesse cada módulo para gerenciar diferentes aspectos do seu negócio. 
              Todas as funcionalidades estão organizadas de forma intuitiva para facilitar 
              o controle e a tomada de decisões.
            </p>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  )
}
