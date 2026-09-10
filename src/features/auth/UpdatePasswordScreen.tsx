import { useState, type FormEvent } from 'react'
import { CheckIcon } from '@/components/icons'
import { supabase } from '@/lib/supabase'
import { changePassword } from './changePassword'

/** Shown when a recovery link brought you here, before the app is usable. */
export function UpdatePasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await changePassword(password, confirmation)
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <CheckIcon size={20} />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">Tasks</h1>
            <p className="text-xs text-muted">Choose a new password</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              New password
            </span>
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Confirm password
            </span>
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>

          {error && (
            <p className="rounded-md bg-p1/10 px-3 py-2 text-xs text-p1">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full py-2" disabled={busy}>
            {busy ? 'Saving…' : 'Set password and continue'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-xs text-muted underline underline-offset-2 hover:text-ink"
          onClick={() => void supabase.auth.signOut()}
        >
          Cancel and sign out
        </button>
      </div>
    </div>
  )
}
