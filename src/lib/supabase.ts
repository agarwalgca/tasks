import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False until .env.local has been filled in; the app shows setup steps then. */
export const isConfigured =
  !!url && !!anonKey && !url.includes('YOUR-PROJECT-REF') && !anonKey.startsWith('YOUR-')

export const supabase: SupabaseClient = createClient(
  url || 'https://unconfigured.supabase.co',
  anonKey || 'unconfigured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

/**
 * A recovery email lands with `type=recovery` in the URL hash. Read it at module
 * load, before supabase-js consumes the hash and cleans the address bar, so the
 * app can show the "set a new password" form instead of flashing the task list.
 */
export const arrivedFromRecoveryLink =
  new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'

/** Where auth emails send you back to; matches the deployed base path. */
export const appUrl = `${window.location.origin}${import.meta.env.BASE_URL}`
