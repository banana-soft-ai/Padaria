import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Receita } from '@/lib/supabase'

export function useReceitas() {
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [loading, setLoading] = useState(false)

  const fetchReceitas = async () => {
    setLoading(true)
    try {
      // Buscar apenas receitas ativas (campo `ativo` true). Isso evita trazer receitas soft-deleted.
      const { data, error } = await supabase.from('receitas').select('*').eq('ativo', true).order('nome')
      if (error) {
        console.error('useReceitas: erro ao buscar receitas', error)
        return { data: null, error }
      }
      setReceitas(data || [])
      return { data, error: null }
    } catch (err) {
      console.error('useReceitas: exceção ao buscar receitas', err)
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  const createReceita = async (dados: any) => {
    return await supabase.from('receitas').insert([dados]).select().single()
  }

  const updateReceita = async (id: number, dados: any) => {
    return await supabase.from('receitas').update(dados).eq('id', id).select().single()
  }

  const softDeleteReceita = async (id: number) => {
    return await supabase.from('receitas').update({ ativo: false }).eq('id', id).select().single()
  }

  useEffect(() => {
    fetchReceitas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    receitas,
    loading,
    fetchReceitas,
    createReceita,
    updateReceita,
    softDeleteReceita
  }
}
