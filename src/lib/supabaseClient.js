import { createClient } from '@supabase/supabase-js';
import { clientEnv } from '@/env/client-env'

const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
const key = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase;

if (!url || !key) {
    console.warn('Supabase not configured: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing.');
    // minimal stub to avoid runtime crashes; methods throw explicit errors when used
    supabase = {
        from: () => { throw new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'); },
        auth: {
            onAuthStateChange: () => ({ data: null }),
        },
    };
} else {
    supabase = createClient(url, key);
}

export { supabase };
