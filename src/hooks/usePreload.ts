import { useEffect, useCallback } from 'react'

/**
 * Hook para pré-carregar componentes baseado na interação do usuário
 * Melhora a percepção de velocidade do lazy loading
 */

interface PreloadOptions {
  delay?: number
  trigger?: 'hover' | 'focus' | 'click'
}

export function usePreload(
  importFn: () => Promise<any>,
  options: PreloadOptions = {}
) {
  const { delay = 100, trigger = 'hover' } = options

  const preload = useCallback(() => {
    // Pré-carrega o componente
    importFn().catch(() => {
      // Falha silenciosa para não quebrar a UX
    })
  }, [importFn])

  const preloadWithDelay = useCallback(() => {
    if (delay > 0) {
      setTimeout(preload, delay)
    } else {
      preload()
    }
  }, [preload, delay])

  return {
    preload: preloadWithDelay,
    onMouseEnter: trigger === 'hover' ? preloadWithDelay : undefined,
    onFocus: trigger === 'focus' ? preloadWithDelay : undefined,
    onClick: trigger === 'click' ? preloadWithDelay : undefined,
  }
}

/**
 * Hook para pré-carregar componentes baseado na rota
 * Pré-carrega componentes de rotas relacionadas
 */
export function useRoutePreload() {
  const preloadVendasComponents = useCallback(() => {
    // Pré-carrega componentes da página de vendas
    import('../components/vendas/ModalVenda')
    import('../components/vendas/ListaVendas')
  }, [])

  const preloadCaixaComponents = useCallback(() => {
    // Pré-carrega componentes do caixa
    import('../components/caixa/ModalAbertura')
    import('../components/caixa/ModalFechamento')
    import('../components/caixa/ModalDetalhes')
  }, [])

  const preloadGestaoComponents = useCallback(() => {
    // Pré-carrega componentes de gestão
    import('../components/gestao/FluxoModal')
    import('../components/gestao/PrecoModal')
  }, [])

  // Pré-carrega componentes baseado na rota atual
  useEffect(() => {
    const currentPath = window.location.pathname

    // Pequeno delay para não bloquear o carregamento inicial
    const timer = setTimeout(() => {
      if (currentPath.includes('/vendas')) {
        preloadCaixaComponents()
        preloadGestaoComponents()
      } else if (currentPath.includes('/gestao')) {
        preloadVendasComponents()
        preloadCaixaComponents()
      } else if (currentPath === '/') {
        preloadVendasComponents()
        preloadGestaoComponents()
      }
    }, 1000) // 1 segundo após carregamento da página

    return () => clearTimeout(timer)
  }, [preloadVendasComponents, preloadCaixaComponents, preloadGestaoComponents])

  return {
    preloadVendasComponents,
    preloadCaixaComponents,
    preloadGestaoComponents,
  }
}

/**
 * Hook para pré-carregar baseado na conexão do usuário
 * Só pré-carrega se a conexão for boa
 */
export function useSmartPreload() {
  const isSlowConnection = useCallback(() => {
    // Detecta conexão lenta
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
    }
    return false
  }, [])

  const preloadIfGoodConnection = useCallback((importFn: () => Promise<any>) => {
    if (!isSlowConnection()) {
      importFn().catch(() => {
        // Falha silenciosa
      })
    }
  }, [isSlowConnection])

  return {
    preloadIfGoodConnection,
    isSlowConnection: isSlowConnection(),
  }
}
