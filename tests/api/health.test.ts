import { GET, HEAD } from '@/app/api/health/route'

describe('API /api/health', () => {
  describe('GET', () => {
    it('retorna 200 com body "ok"', async () => {
      const res = await GET()
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/plain')
      const text = await res.text()
      expect(text).toBe('ok')
    })
  })

  describe('HEAD', () => {
    it('retorna 200 sem body', async () => {
      const res = await HEAD()
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('')
    })
  })
})
