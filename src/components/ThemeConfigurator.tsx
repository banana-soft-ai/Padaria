"use client"
import { useEffect } from 'react'

export default function ThemeConfigurator() {
  useEffect(() => {
    const savedFontSize = localStorage.getItem('font-size') || 'medium'
    const savedTheme = localStorage.getItem('theme') || 'light'
    const savedColor = localStorage.getItem('primary-color') || '#d97706'

    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    document.documentElement.setAttribute('data-font-size', savedFontSize)
    document.documentElement.style.setProperty('--primary-color', savedColor)
  }, [])

  return null
}
