/**
 * Configurações da aplicação (server-side)
 * Todas as configurações vêm de variáveis de ambiente.
 *
 * Observações:
 * - Este arquivo contém dados sensíveis (ex.: chaves). NÃO o importe em componentes client-side.
 * - Use-o apenas em código server (route handlers, server components, scripts, etc).
 */

import { clientEnv } from '@/env/client-env'

export type EnvBool = 'true' | 'false' | undefined

// Config segura para o client — só usa variáveis NEXT_PUBLIC_ e defaults.
export const clientConfig = {
  database: {
    url: undefined as string | undefined,
    supabase: {
      url: clientEnv.NEXT_PUBLIC_SUPABASE_URL || '',
      anonKey: clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      serviceRoleKey: undefined as string | undefined
    }
  },
  sefaz: {
    ambiente: 'homologacao' as 'producao' | 'homologacao',
    certificado: { path: '', password: '' },
    simulate: false,
    allowNoCertificate: false,
    csc: { codigo: '', id: '1' }
  },
  empresa: {
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    endereco: { rua: '', numero: '', complemento: '', bairro: '', municipio: '', uf: '', cep: '' },
    contato: { telefone: '', email: '' }
  },
  apis: {
    sintegra: { url: 'https://api.sintegra.com.br/v1', key: '' },
    receitaFederal: { url: 'https://receitaws.com.br/v1' },
    codigoBarras: { url: '', key: '' }
  },
  impressao: { impressoraTermica: { url: '', modelo: '' } },
  logs: { level: 'info', filePath: './logs/app.log' },
  security: { jwtSecret: '', encryptionKey: '' },
  backup: { s3: { bucket: '', accessKeyId: '', secretAccessKey: '', region: 'us-east-1' } }
}

// Função para obter a configuração completa no server (import dinâmica para evitar bundling no client)
export async function getServerConfig() {
  const { serverEnv, serverEnvOptional, NODE_ENV } = await import('@/env/server-env')
  const cfg = {
    database: {
      url: serverEnv.DATABASE_URL,
      supabase: {
        url: serverEnv.SUPABASE_URL || clientEnv.NEXT_PUBLIC_SUPABASE_URL || '',
        anonKey: serverEnv.SUPABASE_ANON_KEY || clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY
      }
    },
    sefaz: {
      ambiente: (serverEnvOptional.SEFAZ_AMBIENTE as 'producao' | 'homologacao') || 'homologacao',
      certificado: {
        path: serverEnvOptional.SEFAZ_CERTIFICADO_PATH || '',
        password: serverEnvOptional.SEFAZ_CERTIFICADO_PASSWORD || ''
      },
      simulate: (serverEnvOptional.SEFAZ_SIMULATE === 'true') || false,
      allowNoCertificate: (serverEnvOptional.SEFAZ_ALLOW_NO_CERT === 'true') || (NODE_ENV === 'development'),
      csc: { codigo: serverEnvOptional.SEFAZ_CSC || '', id: serverEnvOptional.SEFAZ_CSC_ID || '1' }
    },
    empresa: {
      cnpj: serverEnvOptional.EMPRESA_CNPJ || '',
      razaoSocial: serverEnvOptional.EMPRESA_RAZAO_SOCIAL || '',
      nomeFantasia: serverEnvOptional.EMPRESA_NOME_FANTASIA || '',
      endereco: {
        rua: serverEnvOptional.EMPRESA_ENDERECO_RUA || '',
        numero: serverEnvOptional.EMPRESA_ENDERECO_NUMERO || '',
        complemento: serverEnvOptional.EMPRESA_ENDERECO_COMPLEMENTO || '',
        bairro: serverEnvOptional.EMPRESA_ENDERECO_BAIRRO || '',
        municipio: serverEnvOptional.EMPRESA_ENDERECO_MUNICIPIO || '',
        uf: serverEnvOptional.EMPRESA_ENDERECO_UF || '',
        cep: serverEnvOptional.EMPRESA_ENDERECO_CEP || ''
      },
      contato: { telefone: serverEnvOptional.EMPRESA_TELEFONE || '', email: serverEnvOptional.EMPRESA_EMAIL || '' }
    },
    apis: {
      sintegra: { url: serverEnvOptional.SINTEGRA_API_URL || 'https://api.sintegra.com.br/v1', key: serverEnvOptional.SINTEGRA_API_KEY || '' },
      receitaFederal: { url: serverEnvOptional.RECEITA_FEDERAL_API_URL || 'https://receitaws.com.br/v1' },
      codigoBarras: { url: serverEnvOptional.CODIGO_BARRAS_API_URL || '', key: serverEnvOptional.CODIGO_BARRAS_API_KEY || '' }
    },
    impressao: { impressoraTermica: { url: serverEnvOptional.IMPRESSORA_TERMICA_URL || '', modelo: serverEnvOptional.IMPRESSORA_TERMICA_MODELO || '' } },
    logs: { level: serverEnvOptional.LOG_LEVEL || 'info', filePath: serverEnvOptional.LOG_FILE_PATH || './logs/app.log' },
    security: { jwtSecret: serverEnv.JWT_SECRET || '', encryptionKey: serverEnvOptional.ENCRYPTION_KEY || '' },
    backup: { s3: { bucket: serverEnvOptional.BACKUP_S3_BUCKET || '', accessKeyId: serverEnvOptional.AWS_ACCESS_KEY_ID || '', secretAccessKey: serverEnvOptional.AWS_SECRET_ACCESS_KEY || '', region: serverEnvOptional.AWS_REGION || 'us-east-1' } }
  }

  return cfg
}

export function validateConfig(cfg: any) {
  const required = [
    'database.url',
    'empresa.cnpj',
    'empresa.razaoSocial',
    'sefaz.certificado.path',
    'sefaz.certificado.password',
    'sefaz.csc.codigo'
  ]

  const missing: string[] = []

  for (const path of required) {
    const keys = path.split('.')
    let value: any = cfg

    for (const key of keys) {
      if (value == null) break
      value = value?.[key]
    }

    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      missing.push(path)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Configurações obrigatórias não encontradas: ${missing.join(', ')}`)
  }

  return true
}