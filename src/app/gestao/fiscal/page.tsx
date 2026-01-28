'use client'

import { useState } from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import RouteGuard from '@/components/RouteGuard'
import { FileText, Receipt, Calculator, TrendingUp } from 'lucide-react'

export default function FiscalPage() {
  const [activeTab, setActiveTab] = useState<'fiscal' | 'contabil'>('fiscal')

  return (
    <RouteGuard>
      <ProtectedLayout>
        <div className="page-container">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Fiscal e Contábil</h1>
            <p className="text-sm text-gray-600 mt-1">Gestão fiscal e contábil do estabelecimento</p>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('fiscal')}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === 'fiscal'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center">
                    <Receipt className="h-5 w-5 mr-2" />
                    Fiscal
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('contabil')}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === 'contabil'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center">
                    <Calculator className="h-5 w-5 mr-2" />
                    Contábil
                  </div>
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="p-6">
              {activeTab === 'fiscal' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <FileText className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                      <div>
                        <h3 className="font-semibold text-blue-900 mb-1">Módulo Fiscal</h3>
                        <p className="text-sm text-blue-700">
                          Esta seção será implementada em breve. Aqui você poderá gerenciar:
                        </p>
                        <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
                          <li>Emissão de notas fiscais</li>
                          <li>Relatórios fiscais</li>
                          <li>Apuração de impostos</li>
                          <li>Integração com sistemas fiscais</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'contabil' && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <Calculator className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                      <div>
                        <h3 className="font-semibold text-green-900 mb-1">Módulo Contábil</h3>
                        <p className="text-sm text-green-700">
                          Esta seção será implementada em breve. Aqui você poderá gerenciar:
                        </p>
                        <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
                          <li>Plano de contas</li>
                          <li>Lançamentos contábeis</li>
                          <li>Balanços e demonstrações</li>
                          <li>Conciliação bancária</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <p>
                O módulo Fiscal e Contábil está em desenvolvimento e será disponibilizado em breve.
              </p>
              <p>
                Para mais informações sobre funcionalidades fiscais e contábeis, entre em contato com o suporte.
              </p>
            </div>
          </div>
        </div>
      </ProtectedLayout>
    </RouteGuard>
  )
}
