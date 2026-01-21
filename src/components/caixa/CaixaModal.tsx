'use client'

import { X } from 'lucide-react'

interface CaixaModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function CaixaModal({ isOpen, onClose, title, children }: CaixaModalProps) {
  if (!isOpen) return null

  return (
            <div className="modal-container">
          <div className="modal-content modal-md bg-white rounded-2xl shadow-xl w-full">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
  )
}
