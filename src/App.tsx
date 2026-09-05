import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Shell } from '@/app/Shell'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { SetupScreen } from '@/features/auth/SetupScreen'
import { useSession } from '@/features/auth/useSession'
import { db } from '@/lib/db'
import { newId } from '@/lib/ids'
import { isConfigured } from '@/lib/supabase'
import { nowISO } from '@/lib/time'
import type { Profile } from '@/lib/types'
import { useUi } from '@/store/ui'
import { startSync, stopSync } from '@/sync/runtime'
import { putLocal } from '@/sync/writes'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

/** Every account needs its profile row; the client is the only thing that can
 *  create it, since sign-up happens here. */
async function ensureProfile(userId: string): Promise<void> {
  const existing = await db.profiles.get(userId)
  if (existing) return
  const at = nowISO()
  const profile: Profile = {
    id: userId,
    display_name: null,
    timezone: 'Asia/Kolkata',
    created_at: at,
    updated_at: at,
    deleted_at: null,
  }
  await putLocal('profiles', profile)
}

function useTheme(): void {
  const theme = useUi((s) => s.theme)
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && query.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [theme])
}

function Root() {
  useTheme()
  const { data: session, isLoading } = useSession()
  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) {
      stopSync()
      return
    }
    void ensureProfile(userId).then(() => {
      void db.getMeta('device_id').then(async (id) => {
        if (!id) await db.setMeta('device_id', newId())
      })
      startSync(userId)
    })
    return () => stopSync()
  }, [userId])

  if (!isConfigured) return <SetupScreen />
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-faint">
        Loading…
      </div>
    )
  }
  if (!session) return <AuthScreen />
  return <Shell session={session} />
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  )
}
