/**
 * Cache de autenticação para suporte offline
 * Armazena sessão e hash de validação (nunca a senha em texto puro)
 */

import { offlineStorage } from './offlineStorage'

const AUTH_CACHE_KEY = 'authCache'
const SALT_PREFIX = 'rey-dos-paes-auth-'

export interface AuthCacheData {
  session: {
    user: any
    access_token: string
    refresh_token: string
    expires_at?: number
  }
  userData: {
    id: string
    email: string
    nome: string
    role: string
    ativo: boolean
  }
  passwordHash: string
}

export function getAuthCacheKey(): string {
  return AUTH_CACHE_KEY
}

export async function derivePasswordHash(password: string, email: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = encoder.encode(SALT_PREFIX + email.toLowerCase())
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  )
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
}

export async function verifyPasswordOffline(password: string, email: string, storedHash: string): Promise<boolean> {
  const hash = await derivePasswordHash(password, email)
  return hash === storedHash
}

export async function saveAuthCache(data: AuthCacheData): Promise<void> {
  await offlineStorage.setOfflineConfig(AUTH_CACHE_KEY, data)
}

export async function getAuthCache(): Promise<AuthCacheData | null> {
  return offlineStorage.getOfflineConfig(AUTH_CACHE_KEY)
}

export async function clearAuthCache(): Promise<void> {
  await offlineStorage.setOfflineConfig(AUTH_CACHE_KEY, null)
}

/** Cache do desbloqueio admin - salvo quando desbloqueia online (permite desbloquear offline depois) */
const ADMIN_UNLOCK_CACHE_KEY = 'adminUnlockCache'

export interface AdminUnlockCacheData {
  email: string
  passwordHash: string
  role: string
  timestamp: number
}

export async function saveAdminUnlockCache(data: AdminUnlockCacheData): Promise<void> {
  await offlineStorage.setOfflineConfig(ADMIN_UNLOCK_CACHE_KEY, {
    ...data,
    timestamp: Date.now()
  })
}

export async function getAdminUnlockCache(): Promise<AdminUnlockCacheData | null> {
  const data = await offlineStorage.getOfflineConfig(ADMIN_UNLOCK_CACHE_KEY)
  return data && typeof data === 'object' ? data : null
}

export async function clearAdminUnlockCache(): Promise<void> {
  await offlineStorage.setOfflineConfig(ADMIN_UNLOCK_CACHE_KEY, null)
}
