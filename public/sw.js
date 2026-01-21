/**
 * Service Worker para Rey dos Pães
 * Gerencia cache offline e sincronização em background
 */

const CACHE_NAME = 'rey-dos-paes-v1'
const STATIC_CACHE_NAME = 'rey-dos-paes-static-v1'
const API_CACHE_NAME = 'rey-dos-paes-api-v1'

// Arquivos estáticos para cache
const STATIC_FILES = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
]

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker instalando...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Cache estático aberto')
        return cache.addAll(STATIC_FILES)
      })
      .then(() => {
        console.log('Arquivos estáticos em cache')
        return self.skipWaiting()
      })
  )
})

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker ativando...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('Removendo cache antigo:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('Service Worker ativo')
        return self.clients.claim()
      })
  )
})

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // Ignorar arquivos internos do Next.js (chunks em /_next) para evitar
  // cache de assets que podem conter host/port antigos (ex: localhost:3001)
  if (url.pathname.startsWith('/_next/')) {
    return
  }

  // Estratégia para arquivos estáticos
  if (isStaticFile(request)) {
    event.respondWith(cacheFirst(request))
  }
  // Estratégia para APIs
  else if (isApiRequest(request)) {
    event.respondWith(networkFirstWithFallback(request))
  }
  // Estratégia para páginas
  else if (isPageRequest(request)) {
    event.respondWith(networkFirstWithFallback(request))
  }
})

// Sincronização em background
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag)
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncPendingOperations())
  }
})

// Notificar cliente sobre sincronização
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'SYNC_NOW') {
    syncPendingOperations()
  }
})

// Verificar se é arquivo estático
function isStaticFile(request) {
  return request.destination === 'image' ||
         request.destination === 'style' ||
         request.destination === 'script' ||
         request.destination === 'font' ||
         request.url.includes('/icons/') ||
         request.url.includes('/favicon')
}

// Verificar se é requisição de API
function isApiRequest(request) {
  return request.url.includes('/api/') ||
         request.url.includes('supabase.co')
}

// Verificar se é requisição de página
function isPageRequest(request) {
  return request.destination === 'document'
}

// Estratégia Cache First
async function cacheFirst(request) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME)
    const cached = await cache.match(request)
    
    if (cached) {
      return cached
    }
    
    const response = await fetch(request)
    if (response.status === 200) {
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.error('Erro no cache first:', error)
    return new Response('Offline', { status: 503 })
  }
}

// Estratégia Network First com Fallback
async function networkFirstWithFallback(request) {
  try {
    // Tentar rede primeiro
    const response = await fetch(request)
    
    if (response.status === 200) {
      // Cache a resposta se for bem-sucedida
      const cache = await caches.open(API_CACHE_NAME)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.log('Rede indisponível, tentando cache:', request.url)
    
    // Fallback para cache
    const cache = await caches.open(API_CACHE_NAME)
    const cached = await cache.match(request)
    
    if (cached) {
      return cached
    }
    
    // Se não houver cache, retornar página offline
    if (isPageRequest(request)) {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 })
    }
    
    return new Response('Offline', { status: 503 })
  }
}

// Sincronizar operações pendentes
async function syncPendingOperations() {
  try {
    console.log('Iniciando sincronização em background...')
    
    // Notificar clientes sobre início da sincronização
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STARTED'
      })
    })
    
    // Aqui você pode implementar lógica específica de sincronização
    // Por exemplo, fazer requisições para APIs pendentes
    
    // Simular sincronização
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('Sincronização em background concluída')
    
    // Notificar clientes sobre conclusão
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETED'
      })
    })
    
  } catch (error) {
    console.error('Erro na sincronização em background:', error)
    
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ERROR',
        error: error.message
      })
    })
  }
}

// Limpar cache antigo periodicamente
setInterval(async () => {
  try {
    const cacheNames = await caches.keys()
    const oldCaches = cacheNames.filter(name => 
      name !== STATIC_CACHE_NAME && 
      name !== API_CACHE_NAME &&
      name !== CACHE_NAME
    )
    
    for (const cacheName of oldCaches) {
      await caches.delete(cacheName)
      console.log('Cache antigo removido:', cacheName)
    }
  } catch (error) {
    console.error('Erro ao limpar cache:', error)
  }
}, 24 * 60 * 60 * 1000) // A cada 24 horas
