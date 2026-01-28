'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import ProtectedLayout from '@/components/ProtectedLayout'
import { Settings, User, Shield, Database, Info } from 'lucide-react'
import ConfiguracoesAvancadasModal from '@/components/ConfiguracoesAvancadasModal'
import SobreSistemaModal from '@/components/SobreSistemaModal'

export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true)
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [user, setUser] = useState<{
    id: string
    email?: string
    last_sign_in_at?: string
  } | null>(null)

  useEffect(() => {
    carregarUsuario()
  }, [])

  const carregarUsuario = async () => {
    try {
      const { data: { user } } = await supabase!.auth.getUser()
      setUser(user)
    } catch (error) {
      console.error('Erro ao carregar usuário:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase!.auth.signOut()
      window.location.href = '/login'
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="page-container">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white p-4 rounded-lg shadow">
                  <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ProtectedLayout>
    )
  }

  return (
    <ProtectedLayout>
      <div className="page-container">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
          <p className="text-lg text-gray-600 mt-2">Gerencie suas configurações e preferências</p>
        </div>

        {/* Seções de Configurações */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Perfil do Usuário */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center">
                <User className="h-5 w-5 text-blue-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">Perfil do Usuário</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900">Email</label>
                  <p className="text-sm text-gray-600 mt-1">{user?.email || 'Não informado'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">ID do Usuário</label>
                  <p className="text-sm text-gray-600 mt-1">{user?.id || 'Não informado'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">Último Login</label>
                  <p className="text-sm text-gray-600 mt-1">
                    {user?.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo'
                      })
                      : 'Não informado'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Segurança */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center">
                <Shield className="h-5 w-5 text-green-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">Segurança</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-green-900">Autenticação</p>
                    <p className="text-xs text-green-700">Sistema seguro ativo</p>
                  </div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Sessão</p>
                    <p className="text-xs text-blue-700">Sessão ativa</p>
                  </div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Fazer Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ações do Sistema */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Ações do Sistema</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => setIsAdvancedModalOpen(true)}
              className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="h-5 w-5 mr-3 text-primary" />
              <span className="text-sm text-gray-700 font-medium">Configurações Avançadas</span>
            </button>
            <button 
              onClick={() => setIsAboutModalOpen(true)}
              className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Info className="h-5 w-5 mr-3 text-purple-500" />
              <span className="text-sm text-gray-700 font-medium">Sobre o Sistema</span>
            </button>
          </div>
        </div>

        {/* Modais */}
        <ConfiguracoesAvancadasModal 
          isOpen={isAdvancedModalOpen} 
          onClose={() => setIsAdvancedModalOpen(false)} 
        />
        <SobreSistemaModal 
          isOpen={isAboutModalOpen} 
          onClose={() => setIsAboutModalOpen(false)} 
        />
      </div>
    </ProtectedLayout>
  )
}
