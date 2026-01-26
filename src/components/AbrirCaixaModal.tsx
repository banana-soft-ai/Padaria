"use client"
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ShoppingCart } from 'lucide-react'

type Props = {
  onCaixaAberto?: () => Promise<void> | void
  onClose?: () => void
}

const getLocalDateString = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}


export default function AbrirCaixaModal({ onCaixaAberto, onClose }: Props) {
  const [operador, setOperador] = useState('')
  const [funcionarios, setFuncionarios] = useState<{ id: number; nome: string }[]>([])
    // Carrega funcionários do banco ao abrir o modal
    useEffect(() => {
      const fetchFuncionarios = async () => {
        const { data, error } = await supabase
          .from('funcionario')
          .select('id, nome')
          .order('nome', { ascending: true })
        if (!error && data) setFuncionarios(data)
        else setFuncionarios([])
      }
      fetchFuncionarios()
    }, [])
  const [saldoInicial, setSaldoInicial] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Busca o saldo final do último caixa fechado
  // (Removido: lógica de troca de turno)

  const handleAbrirCaixa = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!operador) {
      setErro('Informe o operador')
      return
    }
    setLoading(true)
    try {
      const dataISO = getLocalDateString()
      const { data: existing, error: checkErr } = await supabase
        .from('caixa_diario')
        .select('id, status')
        .eq('data', dataISO)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (checkErr) throw checkErr
      if (existing && existing.status === 'aberto') {
        setErro('Já existe um caixa aberto hoje.')
        return
      }

      const payload = {
        data: dataISO,
        status: 'aberto',
        valor_abertura: Number(String(saldoInicial || '0').replace(',', '.')) || 0,
        usuario_abertura: operador || null,
        observacoes_abertura: observacoes || null
      }
      const { data: inserted, error } = await supabase
        .from('caixa_diario')
        .insert(payload)
        .select()
        .single()

      if (error || !inserted) throw error || new Error('Não foi possível abrir o caixa.')

      if (onCaixaAberto) await onCaixaAberto()
      if (onClose) onClose()
    } catch (err: any) {
      setErro(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-[9999]">
      <div className="absolute inset-0 bg-black/50" />
      <div className="w-full max-w-md shadow-2xl rounded-3xl bg-white border-b-8 border-blue-600 p-8 z-[10000]">
        <div className="flex flex-col items-center mb-6">
          <div className="inline-block p-2 bg-blue-100 rounded-full mb-2">
            <ShoppingCart className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 uppercase italic mb-0">Abrir Caixa</h2>
        </div>
        <form className="space-y-4" onSubmit={handleAbrirCaixa}>
          {/* Removido: seleção de tipo de abertura */}
          <div>
            <label className="block text-[10px] font-black text-blue-600 uppercase mb-1">Funcionário</label>
            <select
              value={operador}
              onChange={e => setOperador(e.target.value)}
              className="block w-full border-2 border-blue-100 rounded-xl p-2 focus:border-blue-400 outline-none font-bold text-gray-700 bg-blue-50/30 text-sm"
              required
              autoFocus
            >
              <option value="">Quem está no caixa?</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.nome}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-blue-600 uppercase mb-1">Fundo de Caixa (R$)</label>
            <input
              value={saldoInicial}
              onChange={e => setSaldoInicial(e.target.value)}
              placeholder="0.00"
              className="block w-full border-2 border-blue-100 rounded-xl p-2 focus:border-blue-400 outline-none font-black text-xl text-blue-600 bg-blue-50/30"
              type="number"
              min="0"
              step="0.01"
              required
            />
            {/* Removido: mensagem de valor sugerido para troca de turno */}
          </div>
          <div>
            <label className="block text-[10px] font-black text-blue-600 uppercase mb-1">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Alguma observação para o turno?"
              rows={2}
              className="block w-full border-2 border-blue-100 rounded-xl p-2 focus:border-blue-400 outline-none font-bold text-gray-700 bg-blue-50/30 resize-none text-sm"
            />
          </div>
          {erro && <div className="text-xs text-red-600">{erro}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onClose && onClose()}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-black hover:bg-gray-300 transition shadow-sm text-sm uppercase tracking-widest"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-500 text-white py-3 rounded-xl font-black hover:bg-blue-600 transition shadow-lg text-sm uppercase tracking-widest"
              disabled={loading}
            >
              {loading ? 'Abrindo...' : 'Abrir caixa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
