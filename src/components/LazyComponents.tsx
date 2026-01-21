'use client'

import { lazy, Suspense } from 'react'
import { usePreload } from '@/hooks/usePreload'

// Lazy loading para componentes pesados
export const LazyModalVenda = lazy(() => import('./vendas/ModalVenda'))
export const LazyModalFechamento = lazy(() => import('./caixa/ModalFechamento'))
export const LazyModalAbertura = lazy(() => import('./caixa/ModalAbertura'))
export const LazyModalDetalhes = lazy(() => import('./caixa/ModalDetalhes'))
export const LazyFluxoModal = lazy(() => import('./gestao/FluxoModal'))
export const LazyPrecoModal = lazy(() => import('./gestao/PrecoModal'))

// Componente de loading para lazy components
export function LazyLoadingFallback({ message = "Carregando..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="animate-pulse flex space-x-2">
        <div className="rounded-full bg-orange-200 h-6 w-6 animate-bounce"></div>
        <div className="rounded-full bg-orange-200 h-6 w-6 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="rounded-full bg-orange-200 h-6 w-6 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
      <span className="ml-3 text-sm text-gray-500">{message}</span>
    </div>
  )
}

// HOC para wrappear componentes lazy
export function withLazyLoading<T extends object>(
  Component: React.ComponentType<T>,
  fallbackMessage?: string
) {
  return function LazyWrapper(props: T) {
    return (
      <Suspense fallback={<LazyLoadingFallback message={fallbackMessage} />}>
        <Component {...props} />
      </Suspense>
    )
  }
}

// Componentes lazy wrappados com pré-carregamento inteligente
export const ModalVenda = withLazyLoading(LazyModalVenda, "Carregando modal de venda...")
export const ModalFechamento = withLazyLoading(LazyModalFechamento, "Carregando modal de fechamento...")
export const ModalAbertura = withLazyLoading(LazyModalAbertura, "Carregando modal de abertura...")
export const ModalDetalhes = withLazyLoading(LazyModalDetalhes, "Carregando detalhes...")
export const FluxoModal = withLazyLoading(LazyFluxoModal, "Carregando modal de fluxo...")
export const PrecoModal = withLazyLoading(LazyPrecoModal, "Carregando modal de preços...")

// Hook para pré-carregar modais baseado na interação
export function useModalPreload() {
  const preloadVenda = usePreload(() => import('./vendas/ModalVenda'), {
    trigger: 'hover',
    delay: 300
  })

  const preloadCaixa = usePreload(() => import('./caixa/ModalAbertura'), {
    trigger: 'hover', 
    delay: 300
  })

  const preloadGestao = usePreload(() => import('./gestao/FluxoModal'), {
    trigger: 'hover',
    delay: 300
  })

  return {
    preloadVenda: preloadVenda.preload,
    preloadCaixa: preloadCaixa.preload,
    preloadGestao: preloadGestao.preload,
    onMouseEnterVenda: preloadVenda.onMouseEnter,
    onMouseEnterCaixa: preloadCaixa.onMouseEnter,
    onMouseEnterGestao: preloadGestao.onMouseEnter,
  }
}
