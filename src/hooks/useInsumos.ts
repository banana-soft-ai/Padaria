import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Insumo } from '@/lib/supabase'

export function useInsumos() {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(false)

  const fetchInsumos = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('insumos').select('*').order('nome')
      if (error) {
        console.error('useInsumos: erro ao buscar insumos', error)
        return { data: null, error }
      }
      setInsumos(data || [])
      return { data, error: null }
    } catch (err) {
      console.error('useInsumos: exceção ao buscar insumos', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsumos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    insumos,
    loading,
    fetchInsumos
  }
}