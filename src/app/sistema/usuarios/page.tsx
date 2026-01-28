'use client'

import { useEffect, useState } from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import RouteGuard from '@/components/RouteGuard'
import { supabase } from '@/lib/supabase/client'
import { Users, Plus, Edit, Trash2, Shield, UserCheck, UserX } from 'lucide-react'
import type { UserRole } from '@/hooks/useUser'
import { criarUsuarioAuth } from './actions'

interface Usuario {
  id: string
  email: string
  nome: string
  role: UserRole
  ativo: boolean
  created_at: string
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [userToDelete, setUserToDelete] = useState<Usuario | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    role: 'funcionario' as UserRole,
    ativo: true
  })

  useEffect(() => {
    carregarUsuarios()
  }, [])

  const carregarUsuarios = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: dbError } = await supabase!
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: false })

      if (dbError) throw dbError

      setUsuarios(data || [])
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
      setError('Erro ao carregar lista de usuários')
    } finally {
      setLoading(false)
    }
  }

  const handleNovoUsuario = () => {
    setEditingUser(null)
    setFormData({
      nome: '',
      email: '',
      password: '',
      role: 'funcionario',
      ativo: true
    })
    setShowModal(true)
  }

  const handleEditarUsuario = (usuario: Usuario) => {
    setEditingUser(usuario)
    setFormData({
      nome: usuario.nome,
      email: usuario.email,
      password: '',
      role: usuario.role,
      ativo: usuario.ativo
    })
    setShowModal(true)
  }

  const handleSalvar = async () => {
    try {
      setError(null)

      if (!editingUser && !formData.password) {
        setError('A senha é obrigatória para novos usuários')
        return
      }

      if (editingUser) {
        // Atualizar usuário existente
        const { error: updateError } = await supabase!
          .from('usuarios')
          .update({
            nome: formData.nome,
            role: formData.role,
            ativo: formData.ativo
          })
          .eq('id', editingUser.id)

        if (updateError) throw updateError
      } else {
        // 1. Criar o acesso (Login/Senha) via Server Action
        const authResult = await criarUsuarioAuth(
          formData.email,
          formData.password,
          formData.nome,
          formData.role
        )

        if (!authResult.success) {
          setError(`Erro ao criar acesso: ${authResult.error}`)
          return
        }

        // 2. Criar o registro de permissões na tabela 'usuarios'
        const { error: insertError } = await supabase!
          .from('usuarios')
          .insert({
            nome: formData.nome,
            email: formData.email,
            role: formData.role,
            ativo: formData.ativo
          })

        if (insertError) {
          // Se falhou ao inserir na tabela, mas o Auth foi criado, avisamos
          console.error('Erro ao inserir na tabela usuarios:', insertError)
          // Opcional: deletar o authUser para manter consistência
        }
      }

      setShowModal(false)
      await carregarUsuarios()
    } catch (err) {
      console.error('Erro ao salvar usuário:', err)
      setError('Erro ao salvar usuário. Verifique os dados e tente novamente.')
      setShowModal(false)
    }
  }

  const handleToggleAtivo = async (usuario: Usuario) => {
    try {
      setError(null)
      const { error } = await supabase!
        .from('usuarios')
        .update({ ativo: !usuario.ativo })
        .eq('id', usuario.id)

      if (error) throw error

      await carregarUsuarios()
    } catch (err) {
      console.error('Erro ao alterar status do usuário:', err)
      setError('Erro ao alterar status do usuário')
    }
  }

  const handleDeletarUsuario = (usuario: Usuario) => {
    setUserToDelete(usuario)
    setShowDeleteModal(true)
  }

  const confirmarExclusao = async () => {
    if (!userToDelete) return

    try {
      setError(null)
      const { error } = await supabase!
        .from('usuarios')
        .delete()
        .eq('id', userToDelete.id)

      if (error) throw error

      setShowDeleteModal(false)
      setUserToDelete(null)
      await carregarUsuarios()
    } catch (err) {
      console.error('Erro ao excluir usuário:', err)
      setError('Erro ao excluir usuário. Verifique se ele possui registros vinculados.')
      setShowDeleteModal(false)
      setUserToDelete(null)
    }
  }

  const getRoleName = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Administrador'
      case 'gerente':
        return 'Gerente'
      case 'funcionario':
        return 'Colaborador'
      case 'caixa':
        return 'Caixa'
      default:
        return role
    }
  }

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'gerente':
        return 'bg-blue-100 text-blue-800'
      case 'funcionario':
        return 'bg-green-100 text-green-800'
      case 'caixa':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <RouteGuard>
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
      </RouteGuard>
    )
  }

  return (
    <RouteGuard>
      <ProtectedLayout>
        <div className="page-container">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestão de Usuários</h1>
              <p className="text-sm text-gray-600 mt-1">Gerencie usuários e permissões do sistema</p>
            </div>
            <button
              onClick={handleNovoUsuario}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Novo Usuário
            </button>
          </div>

          {/* Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Tabela de Usuários */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cargo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usuarios.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        Nenhum usuário cadastrado
                      </td>
                    </tr>
                  ) : (
                    usuarios.map((usuario) => (
                      <tr key={usuario.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Users className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">{usuario.nome}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{usuario.email}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(usuario.role)}`}>
                            {getRoleName(usuario.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${usuario.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {usuario.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditarUsuario(usuario)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleAtivo(usuario)}
                              className={usuario.ativo ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                              title={usuario.ativo ? 'Desativar' : 'Ativar'}
                            >
                              {usuario.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleDeletarUsuario(usuario)}
                              className="text-red-500 hover:text-red-700"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal de Edição/Criação */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome
                      </label>
                      <input
                        type="text"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                        disabled={!!editingUser}
                      />
                      {editingUser && (
                        <p className="mt-1 text-xs text-gray-500">Email não pode ser alterado</p>
                      )}
                    </div>

                    {!editingUser && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Senha Inicial
                        </label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                          required={!editingUser}
                          minLength={6}
                        />
                        <p className="mt-1 text-xs text-gray-500">Mínimo de 6 caracteres</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cargo
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="funcionario">Colaborador</option>
                        <option value="caixa">Caixa</option>
                        <option value="gerente">Gerente</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="ativo"
                        checked={formData.ativo}
                        onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                      />
                      <label htmlFor="ativo" className="ml-2 block text-sm text-gray-700">
                        Usuário ativo
                      </label>
                    </div>
                  </div>

                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSalvar}
                      className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Modal de Confirmação de Exclusão */}
          {showDeleteModal && userToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
                <div className="p-6">
                  <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                    Excluir Usuário
                  </h2>
                  <p className="text-sm text-gray-500 text-center mb-6">
                    Tem certeza que deseja excluir o usuário <span className="font-bold text-gray-900">{userToDelete.nome}</span>? Esta ação não pode ser desfeita.
                  </p>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false)
                        setUserToDelete(null)
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarExclusao}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ProtectedLayout>
    </RouteGuard>
  )
}
