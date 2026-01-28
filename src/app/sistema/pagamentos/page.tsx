'use client'

import ProtectedLayout from '@/components/ProtectedLayout'
import RouteGuard from '@/components/RouteGuard'
import { CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react'

export default function PagamentosPage() {
  return (
    <RouteGuard>
      <ProtectedLayout>
        <div className="page-container">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Pagamentos e Planos</h1>
            <p className="text-sm text-gray-600 mt-1">Informações sobre planos e pagamentos do sistema</p>
          </div>

          {/* Status do Plano */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg mr-4">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Plano Atual</h2>
                  <p className="text-sm text-gray-600">Sistema em funcionamento</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">
                Ativo
              </span>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tipo de Plano</p>
                  <p className="text-lg font-semibold text-gray-900">Básico</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Próximo Vencimento</p>
                  <p className="text-lg font-semibold text-gray-900">-</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Valor Mensal</p>
                  <p className="text-lg font-semibold text-gray-900">-</p>
                </div>
              </div>
            </div>
          </div>

          {/* Informações */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Módulo de Pagamentos</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Esta seção está em desenvolvimento e será implementada em breve.
                </p>
                <p className="text-sm text-blue-700">
                  Em breve você poderá gerenciar planos, visualizar faturas, histórico de pagamentos e muito mais.
                </p>
              </div>
            </div>
          </div>

          {/* Funcionalidades Futuras */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Funcionalidades Planejadas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start p-4 border border-gray-200 rounded-lg">
                <CreditCard className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Gestão de Planos</h3>
                  <p className="text-sm text-gray-600">
                    Visualize e gerencie diferentes planos disponíveis
                  </p>
                </div>
              </div>
              <div className="flex items-start p-4 border border-gray-200 rounded-lg">
                <Clock className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Histórico de Pagamentos</h3>
                  <p className="text-sm text-gray-600">
                    Acompanhe todo o histórico de transações
                  </p>
                </div>
              </div>
              <div className="flex items-start p-4 border border-gray-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Faturas</h3>
                  <p className="text-sm text-gray-600">
                    Visualize e baixe faturas em PDF
                  </p>
                </div>
              </div>
              <div className="flex items-start p-4 border border-gray-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Notificações</h3>
                  <p className="text-sm text-gray-600">
                    Receba alertas sobre vencimentos e pagamentos
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedLayout>
    </RouteGuard>
  )
}
