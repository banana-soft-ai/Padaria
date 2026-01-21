// src/env/server-env.ts

// Server-side environment validation
// Lista de variáveis OBRIGATÓRIAS para o ambiente de produção/servidor.
const requiredServerEnv = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'DATABASE_URL',
    'JWT_SECRET'
] as const;

type ServerEnvKey = typeof requiredServerEnv[number];

// Lista interna preenchida por `getServerEnv` quando variáveis obrigatórias
// estiverem ausentes. Não lançar durante a inicialização para não quebrar o build.
let _serverEnvMissing: string[] = [];

function getServerEnv() {
    const missing: string[] = [];

    const env = {} as Record<ServerEnvKey, string>;

    // Ler explicitamente cada variável para garantir mensagens claras
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnon = process.env.SUPABASE_ANON_KEY
    const databaseUrl = process.env.DATABASE_URL
    const jwtSecret = process.env.JWT_SECRET

    if (!supabaseServiceRole) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    else env.SUPABASE_SERVICE_ROLE_KEY = supabaseServiceRole

    if (!supabaseUrl) missing.push('SUPABASE_URL')
    else env.SUPABASE_URL = supabaseUrl

    if (!supabaseAnon) missing.push('SUPABASE_ANON_KEY')
    else env.SUPABASE_ANON_KEY = supabaseAnon

    if (!databaseUrl) missing.push('DATABASE_URL')
    else env.DATABASE_URL = databaseUrl

    if (!jwtSecret) missing.push('JWT_SECRET')
    else env.JWT_SECRET = jwtSecret

    if (missing.length > 0) {
        console.warn('⚠️ Server ENV ausente:', missing);
        // Não lançar aqui para não quebrar o build/coleção de páginas.
        // Preencher lista interna para uso em runtime quando necessário.
        _serverEnvMissing = missing;
    }

    return env;
}

export const serverEnv = getServerEnv();

// Expor NODE_ENV centralizado para evitar leituras diretas espalhadas
export const NODE_ENV = process.env.NODE_ENV || 'development';

// Retorna a lista de variáveis server obrigatórias que estão faltando.
export function getServerEnvMissing() {
    return _serverEnvMissing;
}

// Lança se variáveis server obrigatórias estiverem ausentes. Use em pontos
// do código que realmente exigem que as variáveis existam (runtime).
export function assertServerEnv() {
    if (_serverEnvMissing.length > 0) {
        throw new Error(`Server ENV inválido. Faltando: ${_serverEnvMissing.join(', ')}`);
    }
}

// Variáveis server opcionais (não obrigatórias). Centraliza acesso no servidor.
export const serverEnvOptional = {
    // SEFAZ
    SEFAZ_AMBIENTE: process.env.SEFAZ_AMBIENTE,
    SEFAZ_CERTIFICADO_PATH: process.env.SEFAZ_CERTIFICADO_PATH,
    SEFAZ_CERTIFICADO_PASSWORD: process.env.SEFAZ_CERTIFICADO_PASSWORD,
    SEFAZ_SIMULATE: process.env.SEFAZ_SIMULATE,
    SEFAZ_ALLOW_NO_CERT: process.env.SEFAZ_ALLOW_NO_CERT,
    SEFAZ_CSC: process.env.SEFAZ_CSC,
    SEFAZ_CSC_ID: process.env.SEFAZ_CSC_ID,

    // Empresa
    EMPRESA_CNPJ: process.env.EMPRESA_CNPJ,
    EMPRESA_RAZAO_SOCIAL: process.env.EMPRESA_RAZAO_SOCIAL,
    EMPRESA_NOME_FANTASIA: process.env.EMPRESA_NOME_FANTASIA,
    EMPRESA_ENDERECO_RUA: process.env.EMPRESA_ENDERECO_RUA,
    EMPRESA_ENDERECO_NUMERO: process.env.EMPRESA_ENDERECO_NUMERO,
    EMPRESA_ENDERECO_COMPLEMENTO: process.env.EMPRESA_ENDERECO_COMPLEMENTO,
    EMPRESA_ENDERECO_BAIRRO: process.env.EMPRESA_ENDERECO_BAIRRO,
    EMPRESA_ENDERECO_MUNICIPIO: process.env.EMPRESA_ENDERECO_MUNICIPIO,
    EMPRESA_ENDERECO_UF: process.env.EMPRESA_ENDERECO_UF,
    EMPRESA_ENDERECO_CEP: process.env.EMPRESA_ENDERECO_CEP,
    EMPRESA_TELEFONE: process.env.EMPRESA_TELEFONE,
    EMPRESA_EMAIL: process.env.EMPRESA_EMAIL,

    // APIs
    SINTEGRA_API_URL: process.env.SINTEGRA_API_URL,
    SINTEGRA_API_KEY: process.env.SINTEGRA_API_KEY,
    RECEITA_FEDERAL_API_URL: process.env.RECEITA_FEDERAL_API_URL,
    CODIGO_BARRAS_API_URL: process.env.CODIGO_BARRAS_API_URL,
    CODIGO_BARRAS_API_KEY: process.env.CODIGO_BARRAS_API_KEY,

    // Impressora
    IMPRESSORA_TERMICA_URL: process.env.IMPRESSORA_TERMICA_URL,
    IMPRESSORA_TERMICA_MODELO: process.env.IMPRESSORA_TERMICA_MODELO,

    // Logs / Security
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FILE_PATH: process.env.LOG_FILEPath || process.env.LOG_FILE_PATH,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

    // Backup / AWS
    BACKUP_S3_BUCKET: process.env.BACKUP_S3_BUCKET,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION
}
