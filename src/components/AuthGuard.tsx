'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLogger } from '@/lib/logger'
import { supabase } from '@/lib/supabase/client'

interface AuthGuardProps {
    children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<unknown>(null)
    const router = useRouter()
    const logger = useLogger('AuthGuard')

    useEffect(() => {
        // Verificar se há uma sessão ativa
        const checkUser = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()

                if (error) {
                    logger.error('Erro ao verificar sessão no getSession', { error: error.message })
                    // Se for erro de token inválido, limpar cookies e redirecionar
                    if (error.message.includes('Invalid Refresh Token') || error.message.includes('Refresh Token Not Found')) {
                        await supabase.auth.signOut()
                        // Limpar cookies manualmente
                        document.cookie.split(";").forEach(function (c) {
                            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                        });
                        router.push('/login?error=refresh')
                        return
                    }
                    router.push('/login')
                    return
                }

                if (!session) {
                    logger.info('Sessão não encontrada, redirecionando para login', { path: window.location.pathname });
                    router.push('/login')
                    return
                }

                setUser(session.user)
                setLoading(false)
            } catch (error) {
                logger.critical('Erro catastrófico ao verificar sessão', { error })
                // Em caso de erro, tentar limpar a sessão
                try {
                    await supabase.auth.signOut()
                } catch (signOutError) {
                    logger.error('Erro ao tentar forçar logout após falha na verificação de sessão', { signOutError })
                }
                router.push('/login')
            }
        }

        checkUser()

        // Escutar mudanças na autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                logger.debug('Auth state change detectado', { event, hasSession: !!session })

                if (event === 'SIGNED_OUT') {
                    logger.info('Usuário deslogado (SIGNED_OUT)', { path: window.location.pathname })
                    setUser(null)
                    router.push('/login')
                } else if (event === 'TOKEN_REFRESHED') {
                    if (session) {
                        setUser(session.user)
                        setLoading(false)
                    }
                } else if (session) {
                    setUser(session.user)
                    setLoading(false)
                } else {
                    setUser(null)
                    setLoading(false)
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [router, logger])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    return <>{children}</>
}