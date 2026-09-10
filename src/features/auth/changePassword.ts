import { supabase } from '@/lib/supabase'

/** Shared by the recovery screen and the Settings form. */
export async function changePassword(
  password: string,
  confirmation: string,
): Promise<void> {
  if (password !== confirmation) throw new Error('The two passwords do not match.')
  if (password.length < 8) throw new Error('Use at least 8 characters.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}
