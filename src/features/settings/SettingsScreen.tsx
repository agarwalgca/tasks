import { useState } from 'react'
import { DownloadIcon } from '@/components/icons'
import { db, META_DEVICE_ID, META_LAST_PULLED_AT } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { APP_TZ } from '@/lib/time'
import { useSyncStore } from '@/store/sync'
import { useUi, type Theme } from '@/store/ui'
import { downloadExport } from '@/features/export/exportData'
import { changePassword } from '@/features/auth/changePassword'
import { useLiveQuery } from 'dexie-react-hooks'

const THEMES: Theme[] = ['light', 'dark', 'system']

export function SettingsScreen({ email }: { email: string | undefined }) {
  const theme = useUi((s) => s.theme)
  const setTheme = useUi((s) => s.setTheme)
  const { phase, pending, lastSyncedAt } = useSyncStore()
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState<number | null>(null)

  const deviceId = useLiveQuery(() => db.getMeta<string>(META_DEVICE_ID), [])
  const watermark = useLiveQuery(() => db.getMeta<string>(META_LAST_PULLED_AT), [])

  async function runExport() {
    setExporting(true)
    setExported(null)
    try {
      setExported(await downloadExport())
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 px-4 py-4 text-sm">
      <section>
        <h2 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-faint">
          Export
        </h2>
        <p className="mb-2 text-muted">
          One JSON dump of every table, plus a CSV per table. Your browser will ask
          before saving the batch.
        </p>
        <button
          type="button"
          className="btn-outline"
          onClick={() => void runExport()}
          disabled={exporting}
        >
          <DownloadIcon size={15} />
          {exporting ? 'Exporting…' : 'Export everything'}
        </button>
        {exported !== null && (
          <p className="mt-2 text-xs text-accent">{exported} files saved.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-faint">
          Appearance
        </h2>
        <div className="flex gap-1.5">
          {THEMES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTheme(option)}
              className={`btn border px-3 py-1 text-xs capitalize ${
                theme === option
                  ? 'border-accent text-accent'
                  : 'border-line text-muted'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-faint">
          Sync
        </h2>
        <dl className="space-y-1 font-mono text-2xs text-muted">
          <Row label="status" value={pending > 0 ? `${phase} · ${pending} pending` : phase} />
          <Row label="last sync" value={lastSyncedAt ?? '—'} />
          <Row label="watermark" value={watermark ?? '—'} />
          <Row label="device" value={deviceId ?? '—'} />
          <Row label="timezone" value={APP_TZ} />
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-faint">
          Account
        </h2>
        <p className="mb-2 font-mono text-2xs text-muted">{email ?? '—'}</p>
        <ChangePassword />

        <button
          type="button"
          className="btn-outline mt-4 text-xs"
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </button>
        <p className="mt-2 text-2xs text-faint">
          Signing out leaves the local copy in place; it syncs again on the next
          sign-in.
        </p>
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-faint">{label}</dt>
      <dd className="min-w-0 break-all">{value}</dd>
    </div>
  )
}

function ChangePassword() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await changePassword(password, confirmation)
      setPassword('')
      setConfirmation('')
      setOpen(false)
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="mb-1">
        <button
          type="button"
          className="btn-outline text-xs"
          onClick={() => {
            setOpen(true)
            setDone(false)
          }}
        >
          Change password
        </button>
        {done && <p className="mt-2 text-xs text-accent">Password updated.</p>}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mb-1 max-w-xs space-y-2">
      <input
        className="field"
        type="password"
        autoComplete="new-password"
        placeholder="New password"
        required
        minLength={8}
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        className="field"
        type="password"
        autoComplete="new-password"
        placeholder="Confirm password"
        required
        minLength={8}
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
      />
      {error && <p className="text-xs text-p1">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-xs" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="btn-quiet text-xs"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
