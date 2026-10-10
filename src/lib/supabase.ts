import { createClient } from '@supabase/supabase-js'

// Public, browser-safe values (publishable key). Row Level Security protects the data.
const FALLBACK_URL = 'https://cbhexpybdggwzyakgagd.supabase.co'
const FALLBACK_KEY = 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3'

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const MEDIA_BUCKET = 'plan-media'

export function publicMediaUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
}
