'use client'

import { Search, Camera } from 'lucide-react'

export interface BarraBuscaProps {
  value: string
  onChange: (value: string) => void
  onBuscar?: (value: string) => void
  onLerCodigo?: () => void
  placeholder?: string
  disabled?: boolean
  scannerAtivo?: boolean
  onToggleScanner?: () => void
  scannerErro?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
  onFocus?: () => void
  onBlur?: () => void
  /** Conteúdo opcional (ex.: dropdown de sugestões) renderizado abaixo do input */
  children?: React.ReactNode
}

export default function BarraBusca({
  value,
  onChange,
  onBuscar,
  placeholder = 'Escaneie ou digite o nome do produto...',
  disabled = false,
  scannerAtivo = false,
  onToggleScanner,
  scannerErro,
  inputRef,
  onFocus,
  onBlur,
  children,
}: BarraBuscaProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onBuscar) {
      e.preventDefault()
      onBuscar(value)
    }
  }

  return (
    <div className="bg-white p-3 rounded-2xl shadow-sm border border-blue-100 shrink-0">
      <div className="flex gap-2 relative">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full p-4 pl-12 border-2 border-blue-50 rounded-2xl focus:border-blue-400 outline-none text-lg font-bold placeholder:font-normal"
            aria-label="Buscar ou escanear produto"
          />
          <Search
            className="absolute left-4 top-4 text-blue-300 h-6 w-6"
            aria-hidden
          />
          {children}
        </div>
        {onToggleScanner && (
          <button
            type="button"
            onClick={onToggleScanner}
            className={`px-6 rounded-2xl transition font-black text-xs uppercase border flex items-center gap-2 ${
              scannerAtivo
                ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                : 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
            }`}
            title={
              scannerAtivo
                ? 'Clique para desativar o scanner'
                : 'Clique para ativar o scanner da câmera'
            }
            aria-pressed={scannerAtivo}
          >
            <Camera className="h-4 w-4" />
            {scannerAtivo ? 'Desativar Scanner' : 'Ativar Scanner'}
          </button>
        )}
      </div>
      {scannerErro && (
        <div className="mt-2 text-red-600 text-xs font-bold">{scannerErro}</div>
      )}
    </div>
  )
}
