'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erro global capturado:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6 text-center text-slate-800">
      <div className="max-w-lg rounded-2xl bg-white p-10 shadow-lg ring-1 ring-slate-200">
        <h1 className="text-3xl font-bold text-orange-600">Ops! Algo deu errado.</h1>
        <p className="mt-4 text-lg">
          Encontramos um erro inesperado ao processar sua solicitação. Nossa equipe já foi
          notificada automaticamente para analisar o problema.
        </p>
        {error?.digest && (
          <p className="mt-4 text-sm text-slate-500">
            Código de referência: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-orange-500 px-6 py-2 text-white shadow transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            Tentar novamente
          </button>
          <Link
            href="/"
            className="rounded-md border border-orange-500 px-6 py-2 text-orange-600 transition hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            Voltar para o início
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Se o erro persistir, entre em contato com o suporte informando a hora e a ação que você
          estava executando.
        </p>
      </div>
    </div>
  )
}

