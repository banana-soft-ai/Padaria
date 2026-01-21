import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { OfflineProvider } from '@/components/OfflineProvider'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

// Root layout padrão do App Router (server component)

// Marcar todas as rotas como dinâmicas para evitar erro durante build
// quando Supabase env vars não estão disponíveis
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Rey dos Pães - Sistema de Gestão',
  description: 'Sistema de gestão completo para a padaria Rey dos Pães',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rey dos Pães'
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'Rey dos Pães',
    title: 'Rey dos Pães - Sistema de Gestão',
    description: 'Sistema de gestão completo para a padaria Rey dos Pães',
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#d97706',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <OfflineProvider>
          {children}
          <Toaster position="top-right" />
        </OfflineProvider>
      </body>
    </html>
  )
}
