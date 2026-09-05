import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarIcon, PlusIcon, TagIcon } from '@/components/icons'
import { createTaskFromQuickAdd } from '@/lib/mutations'
import { formatDateLabel, formatTime } from '@/lib/time'
import { parseQuickAdd } from './parse'

const PRIORITY_LABEL = ['', 'P1', 'P2', 'P3']
const PRIORITY_TONE = [
  '',
  'border-p1/40 bg-p1/10 text-p1',
  'border-p2/40 bg-p2/10 text-p2',
  'border-p3/40 bg-p3/10 text-p3',
]

interface QuickAddProps {
  listId: string | null
  autoFocus?: boolean
  onCreated?: () => void
}

/**
 * The parse preview updates as you type, so what the task will become is
 * visible before Enter commits it.
 */
export function QuickAdd({ listId, autoFocus, onCreated }: QuickAddProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => parseQuickAdd(text), [text])
  const active = text.trim().length > 0

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  async function submit() {
    if (!active || busy) return
    setBusy(true)
    try {
      await createTaskFromQuickAdd(parsed, listId)
      setText('')
      onCreated?.()
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex items-center gap-2 px-2.5">
        <PlusIcon className="shrink-0 text-faint" size={16} />
        <input
          ref={inputRef}
          data-quick-add
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            }
            if (e.key === 'Escape') {
              e.currentTarget.blur()
              setText('')
            }
          }}
          placeholder="call the bank tomorrow 5pm !p1 #work"
          className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-faint"
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="sentences"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!active || busy}
          className="btn-primary shrink-0 py-1 text-xs"
        >
          Add
        </button>
      </div>

      {active && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2 animate-slide-up">
          <span className="mr-0.5 truncate text-xs font-medium">
            {parsed.title || <span className="text-faint">no title</span>}
          </span>
          {parsed.due_date && (
            <span className="chip border-accent/40 bg-accent/10 text-accent">
              <CalendarIcon size={11} />
              {formatDateLabel(parsed.due_date)}
              {parsed.due_time ? ` ${formatTime(parsed.due_time)}` : ''}
            </span>
          )}
          {parsed.priority > 0 && (
            <span className={`chip ${PRIORITY_TONE[parsed.priority]}`}>
              {PRIORITY_LABEL[parsed.priority]}
            </span>
          )}
          {parsed.tags.map((tag) => (
            <span key={tag} className="chip">
              <TagIcon size={11} />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
