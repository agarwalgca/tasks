import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { setCurrentUserId } from '@/lib/session'

export function useSession() {
  const queryClient = useQueryClient()

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
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(['session'], session)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  useEffect(() => {
    setCurrentUserId(query.data?.user.id ?? null)
  }, [query.data?.user.id])

  return query
}
