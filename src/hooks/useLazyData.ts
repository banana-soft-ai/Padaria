import { useState, useEffect, useCallback } from 'react'

interface LazyDataOptions {
  delay?: number
  retries?: number
  retryDelay?: number
}

interface LazyDataState<T> {
  data: T | null
  loading: boolean
  error: Error | null
  retry: () => void
}

export function useLazyData<T>(
  fetchFn: () => Promise<T>,
  options: LazyDataOptions = {}
): LazyDataState<T> {
  const { delay = 0, retries = 3, retryDelay = 1000 } = options
  
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const executeFetch = useCallback(async () => {
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      // Delay opcional para evitar requests muito frequentes
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      const result = await fetchFn()
      setData(result)
      setRetryCount(0)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro desconhecido')
      setError(error)
      
      // Retry automático
      if (retryCount < retries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1)
        }, retryDelay)
      }
    } finally {
      setLoading(false)
    }
  }, [fetchFn, delay, retries, retryDelay, loading, retryCount])

  const retry = useCallback(() => {
    setRetryCount(0)
    executeFetch()
  }, [executeFetch])

  // Auto-retry quando retryCount muda
  useEffect(() => {
    if (retryCount > 0 && retryCount <= retries) {
      executeFetch()
    }
  }, [retryCount, retries, executeFetch])

  return {
    data,
    loading,
    error,
    retry
  }
}

// Hook específico para dados que só devem ser carregados quando necessário
export function useLazyQuery<T>(
  fetchFn: () => Promise<T>,
  options: LazyDataOptions = {}
) {
  const [triggered, setTriggered] = useState(false)
  
  const lazyData = useLazyData(
    triggered ? fetchFn : async () => {
      throw new Error('Query not triggered')
    },
    options
  )

  const trigger = useCallback(() => {
    setTriggered(true)
  }, [])

  return {
    ...lazyData,
    trigger,
    triggered
  }
}
