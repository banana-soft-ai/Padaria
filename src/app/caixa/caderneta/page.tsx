'use client'

import Link from 'next/link'
import { Package, ArrowLeft } from 'lucide-react'
import ProtectedLayout from '@/components/ProtectedLayout'
import { CadernetaContent } from '@/components/caderneta/CadernetaContent'

export default function CadernetaPDVPage() {
  return (
    <ProtectedLayout>
      <div className="min-h-screen w-full flex flex-col bg-slate-50 font-sans text-gray-800 overflow-auto">
        {/* Header no estilo do PDV */}
        <header className="bg-blue-600 text-white px-3 py-2 flex justify-between items-center shadow-md border-b-4 border-blue-800 shrink-0">
          <div className="flex items-center space-x-4">
            <div className="bg-white p-1 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none uppercase">Rey dos Pães</h1>
              <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Caderneta</span>
            </div>
          </div>

          <Link
            href="/caixa"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase bg-blue-800 hover:bg-blue-700 text-white transition-colors"
            title="Voltar ao PDV"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao PDV
          </Link>
        </header>

        {/* Área principal com CadernetaContent */}
        <main className="flex-1 overflow-y-auto p-4">
          <CadernetaContent />
        </main>
      </div>
    </ProtectedLayout>
  )
}
