/**
 * Script para testar conexão com Supabase
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const https = require('https')
const { serverEnv } = require('../../src/env/server-env.cjs')

const supabaseUrl = serverEnv.SUPABASE_URL
const supabaseAnonKey = serverEnv.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Variáveis de ambiente não encontradas!')
    console.error('Certifique-se de que .env.local existe com as credenciais do Supabase')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testarConexao() {
    try {
        console.log('🔍 Testando conexão com Supabase...')
        console.log(`🧩 Node: ${process.version} | Plataforma: ${process.platform}`)
        console.log(`🌐 URL: ${supabaseUrl}`)
        console.log(`🔑 Anon Key: ${supabaseAnonKey.slice(0, 6)}... (len=${supabaseAnonKey.length})`)

        // Validações básicas de formato
        if (supabaseUrl.startsWith('postgres://') || supabaseUrl.startsWith('postgresql://')) {
            console.error('❌ Parece que você configurou o DATABASE_URL como URL do Supabase. Use a URL HTTPS do projeto (ex.: https://xxxx.supabase.co)')
            return false
        }
        if (!supabaseUrl.startsWith('https://')) {
            console.error('❌ NEXT_PUBLIC_SUPABASE_URL deve começar com https://')
            return false
        }

        // Probe de conectividade TLS simples
        const probeOk = await new Promise((resolve) => {
            try {
                const req = https.request(supabaseUrl, { method: 'GET' }, (res) => {
                    console.log(`🛰️ Probe HTTPS status: ${res.statusCode}`)
                    resolve(true)
                })
                req.on('error', (err) => {
                    console.error('❌ Falha no handshake HTTPS:', err.code || err.message)
                    resolve(false)
                })
                req.end()
            } catch (e) {
                console.error('❌ Erro no probe HTTPS:', e.message)
                resolve(false)
            }
        })

        if (!probeOk) {
            console.error('❌ Não foi possível alcançar a URL do Supabase. Verifique internet, firewall/antivírus, VPN ou proxies.')
            return false
        }

        // Testar conexão básica
        const { data, error } = await supabase
            .from('usuarios')
            .select('count')
            .limit(1)

        if (error) {
            console.error('❌ Erro na conexão:', error.message)
            if (error instanceof Error && error.cause) {
                console.error('🔎 Causa:', error.cause)
            }
            return false
        }

        console.log('✅ Conexão com Supabase estabelecida com sucesso!')

        // Verificar se as tabelas existem
        console.log('\n📊 Verificando tabelas...')

        const tabelas = ['usuarios', 'insumos', 'receitas', 'produtos', 'clientes', 'caixas', 'vendas']

        for (const tabela of tabelas) {
            try {
                const { data, error } = await supabase
                    .from(tabela)
                    .select('count')
                    .limit(1)

                if (error) {
                    console.log(`❌ Tabela ${tabela}: ${error.message}`)
                } else {
                    console.log(`✅ Tabela ${tabela}: OK`)
                }
            } catch (err) {
                console.log(`❌ Tabela ${tabela}: Erro inesperado`)
            }
        }

        return true

    } catch (error) {
        console.error('❌ Erro geral:', error.message)
        if (error && error.code) console.error('🔎 Código:', error.code)
        return false
    }
}

// Executar teste
testarConexao().then(sucesso => {
    if (sucesso) {
        console.log('\n🎉 Sistema pronto para uso!')
        console.log('🌐 Acesse: http://localhost:3000/login')
        console.log('📧 Email: admin@gmail.com')
    } else {
        console.log('\n❌ Sistema não está pronto. Verifique a configuração.')
    }
})
