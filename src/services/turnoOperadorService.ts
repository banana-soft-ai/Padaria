import { TurnoOperador } from '@/lib/supabase'
import {
  getTurnoOperadorAtual,
  finalizarTurnoOperador,
  criarTurnoOperador,
  listarTurnosOperador,
} from '@/repositories/turnoOperadorRepository'

// Serviço para lógica de troca de operador/turno
export async function trocarOperador({
  caixa_diario_id,
  novo_operador_id,
  novo_operador_nome,
  observacoes,
}: {
  caixa_diario_id: number
  novo_operador_id: number
  novo_operador_nome: string
  observacoes?: string
}): Promise<{ ok: boolean; turno?: TurnoOperador; erro?: string }> {
  // 1. Busca turno atual aberto
  const turnoAtual = await getTurnoOperadorAtual(caixa_diario_id)
  if (turnoAtual) {
    // 2. Finaliza turno atual
    const finalizado = await finalizarTurnoOperador(turnoAtual.id)
    if (!finalizado) return { ok: false, erro: 'Erro ao finalizar turno atual' }
  }
  // 3. Cria novo turno
  const novoTurno = await criarTurnoOperador({
    caixa_diario_id,
    operador_id: novo_operador_id,
    operador_nome: novo_operador_nome,
    observacoes,
  })
  if (!novoTurno) return { ok: false, erro: 'Erro ao criar novo turno' }
  return { ok: true, turno: novoTurno }
}

// Lista turnos do caixa
export async function listarTurnos(caixa_diario_id: number) {
  return listarTurnosOperador(caixa_diario_id)
}
