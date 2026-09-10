import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { arrivedFromRecoveryLink, supabase } from '@/lib/supabase'
import { setCurrentUserId } from '@/lib/session'

export function useSession() {
  const queryClient = useQueryClient()
  // The link itself is the first signal; the event is the second, because
  // supabase-js consumes the hash asynchronously.
  const [recovering, setRecovering] = useState(arrivedFromRecoveryLink)

  const query = useQuery({
    queryKey: ['session'],
    queryFn: async (): Promise<Session | null> => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    staleTime: Infinity,
    retry: false,
  })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      queryClient.setQueryData(['session'], session)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  useEffect(() => {
    setCurrentUserId(query.data?.user.id ?? null)
  }, [query.data?.user.id])

  const finishRecovery = useCallback(() => setRecovering(false), [])

  return {
    session: query.data ?? null,
    isLoading: query.isLoading,
    recovering,
    finishRecovery,
  }
}
