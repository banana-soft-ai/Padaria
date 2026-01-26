
import React, { useState } from 'react';

interface TurnoOperadorModalProps {
  operadores: { id: number; nome: string }[];
  operadorAtual: { id: number; nome: string };
  onCancelar: () => void;
  onConfirmar: (novoOperadorId: number, nomeDigitado: string) => void;
}

export default function TurnoOperadorModal({ operadores, operadorAtual, onCancelar, onConfirmar }: TurnoOperadorModalProps) {
  const [operadorSelecionado, setOperadorSelecionado] = useState<number | null>(null);
  const horaTroca = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md relative">
        <h2 className="text-xl font-black flex items-center gap-2 mb-4">
          <span role="img" aria-label="troca">🔄</span> Troca de Turno
        </h2>
        <div className="mb-4 relative">
          <label className="block text-xs font-bold text-blue-700 mb-1">Novo Operador</label>
          <select
            className="w-full border rounded-lg p-2 text-base"
            value={operadorSelecionado ?? ''}
            onChange={e => setOperadorSelecionado(Number(e.target.value))}
            required
          >
            <option value="" disabled>Selecione o operador</option>
            {operadores.map(op => (
              <option key={op.id} value={op.id}>{op.nome}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-bold text-blue-700 mb-1">Hora da troca</label>
          <input
            className="w-full border rounded-lg p-2 text-base bg-gray-100"
            value={horaTroca}
            readOnly
          />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={operadorSelecionado === null}
            onClick={() => {
              const op = operadores.find(o => o.id === operadorSelecionado);
              if (op) onConfirmar(op.id, op.nome);
            }}
          >
            Confirmar Troca
          </button>
        </div>
      </div>
    </div>
  );
}
