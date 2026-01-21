import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export function useComposicoes() {
  const [loading, setLoading] = useState(false)

  const fetchByReceitaId = async (receitaId: number) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('composicao_receitas')
        .select('*')
        .eq('receita_id', receitaId)
      if (error) {
        console.error('useComposicoes: erro ao buscar composicoes', error)
        return { data: null, error }
      }
      return { data, error: null }
    } catch (err) {
      console.error('useComposicoes: exceção ao buscar composicoes', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  const deleteByReceitaId = async (receitaId: number) => {
    return await supabase.from('composicao_receitas').delete().eq('receita_id', receitaId)
  }

  const insertMany = async (composicoes: any[]) => {
    try {
      const res = await supabase.from('composicao_receitas').insert(composicoes).select()
      return res
    } catch (err) {
      // Normaliza erro para facilitar logs/inspeção no cliente
      const e: any = err || {}
      const normalized = {
        message: e.message || e.toString?.() || 'Unknown error',
        details: e.details || null,
        hint: e.hint || null,
        code: e.code || null,
        status: e.status || null
      }
      return { data: null, error: normalized }
    }
  }

  return {
    loading,
    fetchByReceitaId,
    deleteByReceitaId,
    insertMany
  }
}
