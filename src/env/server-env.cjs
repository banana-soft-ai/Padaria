// CommonJS shim para scripts Node que não carregam TypeScript
// Exporta as mesmas chaves validadas por `src/env/server-env.ts`
const required = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'DATABASE_URL',
    'JWT_SECRET'
]

const missing = required.filter((k) => !process.env[k])

if (missing.length > 0) {
    console.error('❌ Server ENV ausente (server-env.cjs):', missing)
    throw new Error(`Server ENV inválido. Faltando: ${missing.join(', ')}`)
}

const serverEnv = {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET
}

const NODE_ENV = process.env.NODE_ENV || 'development'

module.exports = { serverEnv, NODE_ENV }
