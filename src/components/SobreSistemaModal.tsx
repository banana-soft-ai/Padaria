"use client"
import React from 'react'
import { X, Info, ShieldCheck } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function SobreSistemaModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <Info className="w-5 h-5 mr-2 text-primary" />
            Sobre o Sistema
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="space-y-8">
            {/* Informações Gerais */}
            <section>
              <h3 className="text-sm font-bold text-primary mb-4 flex items-center uppercase tracking-wider">
                Informações Gerais
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Nome do Sistema</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Sistema de Gestão RdosPães</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Versão atual</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">v1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Ambiente</span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">Produção</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Data da última atualização</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">28/01/2026</span>
                </div>
              </div>
            </section>

            {/* Empresa / Projeto */}
            <section>
              <h3 className="text-sm font-bold text-primary mb-4 flex items-center uppercase tracking-wider">
                Empresa / Projeto
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Desenvolvido por</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">BananaSoft AI</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Responsável técnico</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">BananaSoft AI</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Contato de suporte</span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">contato@bananasoft.ai</span>
                </div>
              </div>
            </section>

            {/* Descrição */}
            <section>
              <h3 className="text-sm font-bold text-primary mb-4 flex items-center uppercase tracking-wider">
                Descrição do Sistema
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl">
                Este sistema foi desenvolvido para gerenciar vendas, caixa, usuários e operações internas, garantindo segurança, rastreabilidade e eficiência no controle do negócio.
              </p>
            </section>

            {/* Licença */}
            <section>
              <h3 className="text-sm font-bold text-primary mb-4 flex items-center uppercase tracking-wider">
                Licença
              </h3>
              <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-gray-400 mr-3" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sistema proprietário.</span>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-colors shadow-lg shadow-primary/20"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
