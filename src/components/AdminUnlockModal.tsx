'use client'

import { useState, useEffect } from 'react'
import { X, Lock, Eye, EyeOff } from 'lucide-react'
import { useAdminUnlock } from '@/hooks/useAdminUnlock'

interface AdminUnlockModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AdminUnlockModal({ isOpen, onClose, onSuccess }: AdminUnlockModalProps) {
  const { unlock, isUnlocking, error } = useAdminUnlock()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Limpar campos ao abrir
      setEmail('')
      setPassword('')
      setLocalError(null)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!email || !password) {
      setLocalError('Por favor, preencha todos os campos')
      return
    }

    const success = await unlock(email, password)
    
    if (success) {
      onSuccess()
      onClose()
      // Limpar campos
      setEmail('')
      setPassword('')
    }
  }

  if (!isOpen) return null

  const displayError = error || localError

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 relative z-[10002]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Lock className="h-5 w-5 text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Desbloquear Menu Administrativo</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isUnlocking}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4" autoComplete="off">
          <div className="text-sm text-gray-600 mb-4">
            <p>Para acessar o menu administrativo, confirme suas credenciais de administrador ou gerente.</p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="unlock-email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="unlock-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isUnlocking}
              autoComplete="off"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="seu@email.com"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="unlock-password" className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <input
                id="unlock-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isUnlocking}
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isUnlocking}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{displayError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isUnlocking}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUnlocking}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUnlocking ? 'Verificando...' : 'Desbloquear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
