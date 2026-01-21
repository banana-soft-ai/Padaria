import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export function useComposicoesFull() {
  const [composicoes, setComposicoes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchComposicoes = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('composicao_receitas')
        .select(`*, insumo:insumos(*)`)
      if (error) {
        console.error('useComposicoesFull: erro ao buscar composicoes', error)
        return { data: null, error }
      }
      setComposicoes(data || [])
      return { data, error: null }
    } catch (err) {
      console.error('useComposicoesFull: exceção ao buscar composicoes', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComposicoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    composicoes,
    loading,
    fetchComposicoes
  }
}