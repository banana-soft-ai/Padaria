// src/env/client-env.ts

// Variáveis públicas esperadas no cliente. `NEXT_PUBLIC_ENABLE_PWA` é opcional.
type ClientEnv = {
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string
    NEXT_PUBLIC_ENABLE_PWA?: string
}

function getClientEnv(): Partial<ClientEnv> {
    const missing: string[] = [];

    const env = {} as Partial<ClientEnv>;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const enablePwa = process.env.NEXT_PUBLIC_ENABLE_PWA

    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    else env.NEXT_PUBLIC_SUPABASE_URL = url

    if (!anon) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    else env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon

    if (enablePwa) env.NEXT_PUBLIC_ENABLE_PWA = enablePwa

    if (missing.length > 0) {
        console.warn('⚠️ Client ENV ausente:', missing);
    }

    return env;
}

export const clientEnv = getClientEnv();
