"use client"
import React, { useState, useEffect } from 'react'
import { X, Sun, Moon, Palette } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function ConfiguracoesAvancadasModal({ isOpen, onClose }: Props) {
  const [fontSize, setFontSize] = useState('medium')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [primaryColor, setPrimaryColor] = useState('#d97706') // Amber-600 (default)

  useEffect(() => {
    // Carregar configurações do localStorage
    const savedFontSize = localStorage.getItem('font-size') || 'medium'
    const savedTheme = localStorage.getItem('theme') || 'light'
    const savedColor = localStorage.getItem('primary-color') || '#d97706'

    setFontSize(savedFontSize)
    setTheme(savedTheme as 'light' | 'dark')
    setPrimaryColor(savedColor)

    // Aplicar configurações iniciais
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    document.documentElement.setAttribute('data-font-size', savedFontSize)
    document.documentElement.style.setProperty('--primary-color', savedColor)
  }, [])

  const handleFontSizeChange = (size: string) => {
    setFontSize(size)
    localStorage.setItem('font-size', size)
    document.documentElement.setAttribute('data-font-size', size)
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const handleColorChange = (color: string) => {
    setPrimaryColor(color)
    localStorage.setItem('primary-color', color)
    document.documentElement.style.setProperty('--primary-color', color)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <Palette className="w-5 h-5 mr-2 text-primary" />
            Configurações de Aparência
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-8">
            {/* Modo Light/Dark */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center uppercase tracking-wider">
                Modo de Exibição
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`flex items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    theme === 'light'
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <Sun className={`w-5 h-5 mr-3 ${theme === 'light' ? 'text-primary' : 'text-gray-500'}`} />
                  <span className={`font-medium ${theme === 'light' ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`}>Claro</span>
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <Moon className={`w-5 h-5 mr-3 ${theme === 'dark' ? 'text-primary' : 'text-gray-500'}`} />
                  <span className={`font-medium ${theme === 'dark' ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`}>Escuro</span>
                </button>
              </div>
            </section>

            {/* Tamanho da Fonte */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center uppercase tracking-wider">
                Tamanho da Fonte
              </h3>
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl">
                <span className="text-xs text-gray-500">Pequeno</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="1"
                  value={fontSize === 'small' ? 1 : fontSize === 'medium' ? 2 : 3}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    handleFontSizeChange(val === 1 ? 'small' : val === 2 ? 'medium' : 'large')
                  }}
                  className="flex-1 mx-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-lg text-gray-900 dark:text-white">Grande</span>
              </div>
            </section>

            {/* Cores */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center uppercase tracking-wider">
                Cor do Sistema
              </h3>
              <div className="flex flex-wrap gap-4">
                {[
                  { name: 'Âmbar (Padrão)', value: '#d97706' },
                  { name: 'Azul', value: '#2563eb' },
                  { name: 'Verde', value: '#16a34a' },
                  { name: 'Vermelho', value: '#dc2626' },
                  { name: 'Roxo', value: '#9333ea' },
                  { name: 'Rosa', value: '#db2777' },
                ].map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handleColorChange(color.value)}
                    className={`group relative flex flex-col items-center gap-2 p-2 rounded-xl transition-all ${
                      primaryColor === color.value 
                        ? 'bg-primary/10' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div 
                      className="w-10 h-10 rounded-full shadow-sm border-2 border-white dark:border-gray-900 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: color.value }}
                    />
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{color.name}</span>
                    {primaryColor === color.value && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center shadow-sm">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
