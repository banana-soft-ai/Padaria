require('@testing-library/jest-dom')

// Polyfill Response para testes de API routes (Node/jest jsdom não tem global Response)
if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this._body = body
      this.status = init.status ?? 200
      this._headers = init.headers && typeof init.headers === 'object' ? { ...init.headers } : {}
    }
    get headers() {
      return {
        get: (name) => this._headers[name] ?? null
      }
    }
    async text() {
      if (this._body == null) return ''
      if (typeof this._body === 'string') return this._body
      return String(this._body)
    }
  }
}

// Mock do Supabase será feito individualmente nos testes

// Mock do Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
}))

// Mock do Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }) => {
    return { type: 'a', props: { href, children } }
  }
})

// Configurações globais para testes
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock do window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})
