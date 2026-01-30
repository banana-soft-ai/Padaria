'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useLogger } from '@/lib/logger'
import { clientEnv } from '@/env/client-env'
import { Eye, EyeOff } from 'lucide-react'
import { saveAuthCache, getAuthCache, verifyPasswordOffline } from '@/lib/authCache'
import type { UserData } from '@/hooks/useUser'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const router = useRouter()
    const logger = useLogger('LoginPage')

    // Exibir mensagem de erro se veio de refresh token inválido
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            if (params.get('error') === 'refresh') {
                setToast({
                    message: 'Sua sessão expirou ou foi invalidada. Faça login novamente para continuar.',
                    type: 'error',
                })
            }
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setToast(null)

        try {
            const hasSupabaseEnv = !!clientEnv.NEXT_PUBLIC_SUPABASE_URL && !!clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
            if (!hasSupabaseEnv) {
                const message = 'Configuração do Supabase ausente. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local.'
                logger.warn('Env Supabase ausente no login', { NEXT_PUBLIC_SUPABASE_URL: clientEnv.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: !!clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY })
                setError(message)
                setToast({ message, type: 'error' })
                return
            }

            // Modo offline: validar contra cache
            if (!navigator.onLine) {
                const cached = await getAuthCache()
                if (!cached) {
                    setError('Conecte-se à internet para fazer login pela primeira vez.')
                    setToast({ message: 'Conecte-se à internet para fazer login.', type: 'error' })
                    return
                }
                if (cached.userData.email.toLowerCase() !== email.toLowerCase()) {
                    setError('Usuário ou senha incorretos')
                    setToast({ message: 'Usuário ou senha incorretos', type: 'error' })
                    return
                }
                const valid = await verifyPasswordOffline(password, email, cached.passwordHash)
                if (!valid) {
                    setError('Usuário ou senha incorretos')
                    setToast({ message: 'Usuário ou senha incorretos', type: 'error' })
                    return
                }
                // Restaurar sessão no Supabase (localStorage)
                await supabase!.auth.setSession({
                    access_token: cached.session.access_token,
                    refresh_token: cached.session.refresh_token
                })
                setToast({ message: 'Modo offline: sessão restaurada. Reconecte para sincronizar.', type: 'success' })
                setTimeout(() => router.replace('/'), 1000)
                return
            }

            // Modo online: login normal
            const { data, error } = await supabase!.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                logger.warn('Falha na tentativa de login', {
                    email,
                    error: error.message || JSON.stringify(error)
                })

                const message =
                    error.message.includes('Invalid login credentials')
                        ? 'Usuário ou senha incorretos'
                        : 'Erro inesperado. Tente novamente!'

                setError(message)
                setToast({ message, type: 'error' })
                return
            }

            if (data.user && data.session) {
                logger.info('Login bem-sucedido', { userId: data.user.id, email: data.user.email })

                // Buscar userData da tabela usuarios
                let userData: UserData = {
                    id: data.user.id,
                    email: data.user.email || '',
                    nome: data.user.user_metadata?.nome || data.user.email?.split('@')[0] || 'Usuário',
                    role: 'funcionario',
                    ativo: true
                }
                try {
                    const { data: dbUser } = await supabase!
                        .from('usuarios')
                        .select('*')
                        .eq('email', data.user.email)
                        .eq('ativo', true)
                        .single()
                    if (dbUser) {
                        userData = {
                            id: dbUser.id,
                            email: dbUser.email,
                            nome: dbUser.nome,
                            role: dbUser.role as 'admin' | 'gerente' | 'funcionario' | 'caixa',
                            ativo: dbUser.ativo
                        }
                    }
                } catch {
                    // usar userData padrão
                }

                // Salvar cache para uso offline (session, userData, passwordHash)
                const { derivePasswordHash } = await import('@/lib/authCache')
                const passwordHash = await derivePasswordHash(password, email)
                await saveAuthCache({
                    session: {
                        user: data.user,
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token,
                        expires_at: data.session.expires_at
                    },
                    userData,
                    passwordHash
                })

                setToast({ message: 'Login feito com sucesso!', type: 'success' })
                setTimeout(() => router.replace('/'), 1500)
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            logger.error('Erro inesperado durante o login', { error: msg })
            const isNetworkFail = /Failed to fetch|NetworkError|TypeError/i.test(msg)
            const message = isNetworkFail
                ? 'Não foi possível conectar ao Supabase. Verifique sua internet, bloqueadores (VPN/Adblock) e as variáveis do .env. Tente novamente.'
                : 'Erro ao fazer login. Tente novamente.'
            setError(message)
            setToast({ message, type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="max-w-md w-full space-y-8 p-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-orange-800 mb-2">Rey dos Pães</h1>
                    <p className="text-gray-600">Sistema de Gestão</p>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-8">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
                        Acesso ao Sistema
                    </h2>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black placeholder-gray-500"
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Senha
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-black placeholder-gray-500"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Toast */}
                        {toast && (
                            <div
                                className={`px-4 py-3 rounded-md mb-4 ${toast.type === 'success'
                                    ? 'bg-green-50 border border-green-200 text-green-700'
                                    : 'bg-red-50 border border-red-200 text-red-700'
                                    }`}
                            >
                                {toast.message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>

                <div className="text-center text-sm text-gray-500">
                    <p>Sistema protegido - Acesso restrito</p>
                </div>
            </div>
        </div>
    )
}