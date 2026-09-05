import { useEffect } from 'react'
import { db } from '@/lib/db'
import { deleteTask, setTaskStatus, updateTask } from '@/lib/mutations'
import { useUi } from '@/store/ui'

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return (
    el.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
  )
}

/** Rows in the order they are painted, so j/k follows what is on screen. */
function visibleTaskIds(): string[] {
  return [...document.querySelectorAll('[data-task-row]')].map(
    (el) => (el as HTMLElement).dataset.taskRow!,
  )
}

function focusQuickAdd(): void {
  const input = document.querySelector<HTMLInputElement>('[data-quick-add]')
  input?.focus()
  input?.scrollIntoView({ block: 'nearest' })
}

/**
 * Keyboard control at desktop widths. Touch layouts get the same actions from
 * the row itself, so the listener stays out of the way there.
 */
export function useShortcuts(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    let pendingG = false
    let gTimer: ReturnType<typeof setTimeout> | null = null

    const withFocused = async (fn: (id: string) => Promise<void> | void) => {
      const { focusedTaskId } = useUi.getState()
      const id = focusedTaskId ?? visibleTaskIds()[0]
      if (!id) return
      await fn(id)
    }

    const move = (delta: number) => {
      const ids = visibleTaskIds()
      if (ids.length === 0) return
      const { focusedTaskId, setFocusedTask } = useUi.getState()
      const index = focusedTaskId ? ids.indexOf(focusedTaskId) : -1
      const next = Math.max(0, Math.min(ids.length - 1, index + delta))
      const id = ids[index === -1 ? 0 : next]
      setFocusedTask(id)
      document
        .querySelector(`[data-task-row="${id}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUi.getState()

      if (event.key === 'Escape') {
        if (ui.shortcutsOpen) ui.setShortcutsOpen(false)
        else if (ui.openTaskId) ui.setOpenTask(null)
        return
      }

      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (pendingG) {
        pendingG = false
        if (gTimer) clearTimeout(gTimer)
        const go: Record<string, () => void> = {
          t: () => ui.setView({ kind: 'today' }),
          w: () => ui.setView({ kind: 'next7' }),
          i: () => ui.setView({ kind: 'inbox' }),
          a: () => ui.setView({ kind: 'all' }),
          c: () => ui.setView({ kind: 'completed' }),
          s: () => ui.setView({ kind: 'settings' }),
        }
        const jump = go[event.key.toLowerCase()]
        if (jump) {
          event.preventDefault()
          jump()
        }
        return
      }

      switch (event.key) {
        case 'g':
          pendingG = true
          gTimer = setTimeout(() => {
            pendingG = false
          }, 900)
          return
        case 'n':
        case 'c':
        case '/':
          event.preventDefault()
          focusQuickAdd()
          return
        case 'j':
          event.preventDefault()
          move(1)
          return
        case 'k':
          event.preventDefault()
          move(-1)
          return
        case '?':
          event.preventDefault()
          ui.setShortcutsOpen(!ui.shortcutsOpen)
          return
      }

      if (event.key === 'x' || event.key === ' ') {
        event.preventDefault()
        void withFocused(async (id) => {
          const task = await db.tasks.get(id)
          if (task) await setTaskStatus(task, task.status !== 'done')
        })
        return
      }

      if (event.key === 'Enter' || event.key === 'e') {
        event.preventDefault()
        void withFocused((id) => ui.setOpenTask(id))
        return
      }

      if (['0', '1', '2', '3'].includes(event.key)) {
        event.preventDefault()
        void withFocused(async (id) => {
          const task = await db.tasks.get(id)
          if (task) await updateTask(task, { priority: Number(event.key) })
        })
        return
      }

      if (event.key === '#' || event.key === 'Backspace') {
        event.preventDefault()
        void withFocused(async (id) => {
          await deleteTask(id)
          ui.setFocusedTask(null)
          if (ui.openTaskId === id) ui.setOpenTask(null)
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (gTimer) clearTimeout(gTimer)
    }
  }, [enabled])
}

export const SHORTCUTS: [string, string][] = [
  ['n / c / /', 'Focus quick add'],
  ['j / k', 'Move down / up'],
  ['x or Space', 'Complete task'],
  ['Enter or e', 'Open task'],
  ['0 1 2 3', 'Set priority'],
  ['# or Backspace', 'Delete task'],
  ['g then t w i a c', 'Today, week, inbox, all, completed'],
  ['g then s', 'Settings'],
  ['?', 'This list'],
  ['Esc', 'Close'],
]
