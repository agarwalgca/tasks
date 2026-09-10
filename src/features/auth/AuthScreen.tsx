import { useState, type FormEvent } from 'react'
import { appUrl, supabase } from '@/lib/supabase'
import { CheckIcon } from '@/components/icons'

type Mode = 'sign-in' | 'sign-up' | 'forgot'

const SUBTITLE: Record<Mode, string> = {
  'sign-in': 'Sign in to sync',
  'sign-up': 'Create your account',
  forgot: 'Reset your password',
}

const ACTION: Record<Mode, string> = {
  'sign-in': 'Sign in',
  'sign-up': 'Create account',
  forgot: 'Send reset link',
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function switchTo(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setNotice('Check your email to confirm the address, then sign in.')
          setMode('sign-in')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: appUrl,
        })
        if (error) throw error
        setNotice(
          'If that address has an account, a reset link is on its way. Open it on this device.',
        )
      }
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
            <p className="text-xs text-muted">{SUBTITLE[mode]}</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Email</span>
            <input
              className="field"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          {mode !== 'forgot' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Password</span>
              <input
                className="field"
                type="password"
                autoComplete={
                  mode === 'sign-in' ? 'current-password' : 'new-password'
                }
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          {error && (
            <p className="rounded-md bg-p1/10 px-3 py-2 text-xs text-p1">{error}</p>
          )}
          {notice && (
            <p className="rounded-md bg-accent/10 px-3 py-2 text-xs text-accent">
              {notice}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-2" disabled={busy}>
            {busy ? 'Working…' : ACTION[mode]}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-start gap-2 text-xs">
          {mode === 'sign-in' && (
            <>
              <button
                type="button"
                className="text-muted underline underline-offset-2 hover:text-ink"
                onClick={() => switchTo('forgot')}
              >
                Forgot password?
              </button>
              <button
                type="button"
                className="text-muted underline underline-offset-2 hover:text-ink"
                onClick={() => switchTo('sign-up')}
              >
                Need an account? Create one
              </button>
            </>
          )}
          {mode !== 'sign-in' && (
            <button
              type="button"
              className="text-muted underline underline-offset-2 hover:text-ink"
              onClick={() => switchTo('sign-in')}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
