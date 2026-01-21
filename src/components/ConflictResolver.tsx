'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, Database } from 'lucide-react'
import { syncService } from '@/lib/syncService'

interface Conflict {
  id: number
  table: string
  local: any
  remote: any
}

interface ConflictResolverProps {
  conflicts: Conflict[]
  onResolve: (conflictId: number, strategy: 'local' | 'remote' | 'merge') => void
  onClose: () => void
}

export function ConflictResolver({ conflicts, onResolve, onClose }: ConflictResolverProps) {
  const [resolvedConflicts, setResolvedConflicts] = useState<Set<number>>(new Set())
  const [resolving, setResolving] = useState(false)

  const handleResolve = async (conflictId: number, strategy: 'local' | 'remote' | 'merge') => {
    try {
      setResolving(true)
      await syncService.resolveConflict(
        conflicts.find(c => c.id === conflictId)!,
        strategy
      )
      
      setResolvedConflicts(prev => new Set([...prev, conflictId]))
      onResolve(conflictId, strategy)
      
    } catch (error) {
      console.error('Erro ao resolver conflito:', error)
    } finally {
      setResolving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const getFieldChanges = (local: any, remote: any) => {
    const changes: Array<{ field: string; local: any; remote: any }> = []
    
    Object.keys(local).forEach(key => {
      if (local[key] !== remote[key] && key !== 'updated_at') {
        changes.push({
          field: key,
          local: local[key],
          remote: remote[key]
        })
      }
    })
    
    return changes
  }

  const remainingConflicts = conflicts.filter(c => !resolvedConflicts.has(c.id))

  if (remainingConflicts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Conflitos Resolvidos
            </h3>
            <p className="text-gray-600 mb-4">
              Todos os conflitos foram resolvidos com sucesso.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Resolver Conflitos de Sincronização
              </h2>
              <p className="text-gray-600">
                {remainingConflicts.length} conflito(s) encontrado(s). 
                Escolha qual versão usar para cada item.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {remainingConflicts.map((conflict, index) => {
              const changes = getFieldChanges(conflict.local, conflict.remote)
              
              return (
                <div key={conflict.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {conflict.table} - ID {conflict.id}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Item modificado localmente e remotamente
                      </p>
                    </div>
                    <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                      Conflito #{index + 1}
                    </span>
                  </div>

                  {/* Timestamps */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-900">
                          Versão Local
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-blue-700">
                        <Clock className="w-3 h-3" />
                        {formatDate(conflict.local.updated_at)}
                      </div>
                    </div>
                    
                    <div className="bg-green-50 p-3 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-green-900">
                          Versão Remota
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-green-700">
                        <Clock className="w-3 h-3" />
                        {formatDate(conflict.remote.updated_at)}
                      </div>
                    </div>
                  </div>

                  {/* Changes */}
                  {changes.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        Campos Alterados:
                      </h4>
                      <div className="space-y-2">
                        {changes.map((change, changeIndex) => (
                          <div key={changeIndex} className="bg-gray-50 p-2 rounded text-sm">
                            <div className="font-medium text-gray-700 mb-1">
                              {change.field}:
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="text-blue-700">
                                <span className="text-xs text-blue-500">Local:</span> 
                                {JSON.stringify(change.local)}
                              </div>
                              <div className="text-green-700">
                                <span className="text-xs text-green-500">Remoto:</span> 
                                {JSON.stringify(change.remote)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolve(conflict.id, 'local')}
                      disabled={resolving}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Usar Versão Local
                    </button>
                    
                    <button
                      onClick={() => handleResolve(conflict.id, 'remote')}
                      disabled={resolving}
                      className="flex-1 px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Usar Versão Remota
                    </button>
                    
                    <button
                      onClick={() => handleResolve(conflict.id, 'merge')}
                      disabled={resolving}
                      className="flex-1 px-3 py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Mesclar (Automático)
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {remainingConflicts.length} conflito(s) restante(s)
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              
              <button
                onClick={() => {
                  // Resolver todos automaticamente usando versão remota
                  remainingConflicts.forEach(conflict => {
                    handleResolve(conflict.id, 'remote')
                  })
                }}
                disabled={resolving}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                Resolver Todos (Remoto)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConflictResolver
