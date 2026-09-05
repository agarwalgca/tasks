import { useEffect, useState } from 'react'
import {
  AlertIcon,
  CheckIcon,
  CloudIcon,
  CloudOffIcon,
  SyncIcon,
} from '@/components/icons'
import { useSyncStore } from '@/store/sync'
import { requestSync } from '@/sync/runtime'

export function SyncBadge() {
  const { phase, pending, error, settledAt } = useSyncStore()
  const [justSettled, setJustSettled] = useState(false)

  useEffect(() => {
    if (!settledAt) return
    setJustSettled(true)
    const timer = setTimeout(() => setJustSettled(false), 900)
    return () => clearTimeout(timer)
  }, [settledAt])

  const { icon, label, tone } = describe(phase, pending)

  return (
    <button
      type="button"
      onClick={() => requestSync(true)}
      title={error ?? 'Sync now'}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-2xs
        font-medium transition-colors hover:bg-surface2 ${tone}`}
    >
      <span
        className={
          phase === 'syncing'
            ? 'animate-spin'
            : justSettled
              ? 'animate-sync-settle'
              : undefined
        }
      >
        {icon}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function describe(phase: string, pending: number) {
  if (phase === 'offline') {
    return {
      icon: <CloudOffIcon size={14} />,
      label: pending > 0 ? `Offline · ${pending}` : 'Offline',
      tone: 'text-muted',
    }
  }
  if (phase === 'error') {
    return {
      icon: <AlertIcon size={14} />,
      label: 'Sync error',
      tone: 'text-p1',
    }
  }
  if (phase === 'syncing') {
    return { icon: <SyncIcon size={14} />, label: 'Syncing', tone: 'text-muted' }
  }
  if (pending > 0) {
    return {
      icon: <CloudIcon size={14} />,
      label: `${pending} pending`,
      tone: 'text-muted',
    }
  }
  return { icon: <CheckIcon size={14} />, label: 'Synced', tone: 'text-muted' }
}
