import { TurnoOperador } from '@/lib/supabase'
import { supabase } from '@/lib/supabase/client'

// Busca turno aberto do caixa atual
export async function getTurnoOperadorAtual(caixa_diario_id: number): Promise<TurnoOperador | null> {
  const { data, error } = await supabase
    .from('turno_operador')
    .select('*')
    .eq('caixa_diario_id', caixa_diario_id)
    .eq('status', 'aberto')
    .order('data_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data as TurnoOperador
}

// Finaliza turno atual (define data_fim e status)
export async function finalizarTurnoOperador(turno_id: number, dadosAudit?: any, status: string = 'finalizado'): Promise<boolean> {
  const { error } = await supabase
    .from('turno_operador')
    .update({
      status,
      data_fim: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...dadosAudit
    })
    .eq('id', turno_id)
  return !error
}

// Cria novo turno para operador
export async function criarTurnoOperador({
  caixa_diario_id,
  operador_id,
  operador_nome,
  observacoes,
}: {
  caixa_diario_id: number
  operador_id: number
  operador_nome: string
  observacoes?: string
}): Promise<TurnoOperador | null> {
  const { data, error } = await supabase
    .from('turno_operador')
    .insert({
      caixa_diario_id,
      operador_id,
      operador_nome,
      status: 'aberto',
      data_inicio: new Date().toISOString(),
      observacoes: observacoes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) return null
  return data as TurnoOperador
}

// Lista todos os turnos do caixa
export async function listarTurnosOperador(caixa_diario_id: number): Promise<TurnoOperador[]> {
  const { data, error } = await supabase
    .from('turno_operador')
    .select('*')
    .eq('caixa_diario_id', caixa_diario_id)
    .order('data_inicio', { ascending: false })
  if (error || !data) return []
  return data as TurnoOperador[]
}
