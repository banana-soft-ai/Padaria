// src/lib/supabase/supabaseCookies.ts
// Wrapper para adaptar o cookie store do Next.js às APIs esperadas por @supabase/ssr
export function createSupabaseCookies(cookieStore: any) {
    return {
        get(name: string) {
            const c = cookieStore.get(name)
            return c ? c.value : undefined
        },
        set(name: string, value: string, options?: any) {
            const opts: any = { name, value }
            if (options) {
                if (options.maxAge) opts.maxAge = options.maxAge
                if (options.path) opts.path = options.path
                if (options.httpOnly !== undefined) opts.httpOnly = options.httpOnly
                if (options.sameSite) opts.sameSite = options.sameSite
                if (options.secure !== undefined) opts.secure = options.secure
                if (options.expires) opts.expires = options.expires
            }
            cookieStore.set(opts)
        },
        remove(name: string, options?: any) {
            cookieStore.delete(name)
        },
        getAll() {
            return cookieStore.getAll().map((c: any) => ({ name: c.name, value: c.value }))
        },
        setAll(cookies: Array<{ name: string; value: string; options?: any }>) {
            for (const c of cookies) {
                const opts: any = { name: c.name, value: c.value }
                if (c.options) {
                    if (c.options.maxAge) opts.maxAge = c.options.maxAge
                    if (c.options.path) opts.path = c.options.path
                    if (c.options.httpOnly !== undefined) opts.httpOnly = c.options.httpOnly
                    if (c.options.sameSite) opts.sameSite = c.options.sameSite
                    if (c.options.secure !== undefined) opts.secure = c.options.secure
                    if (c.options.expires) opts.expires = c.options.expires
                }
                cookieStore.set(opts)
            }
        }
    }
}
