import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArchiveIcon,
  CalendarIcon,
  CloseIcon,
  InboxIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  StackIcon,
  SunIcon,
} from '@/components/icons'
import { Wordmark } from '@/components/Logo'
import { CalendarView } from '@/features/calendar/CalendarView'
import { FilterEditor } from '@/features/filters/FilterEditor'
import { ListNav } from '@/features/lists/ListNav'
import { QuickAdd } from '@/features/quickadd/QuickAdd'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { ConflictsScreen } from '@/features/sync/ConflictsScreen'
import { SyncBadge } from '@/features/sync/SyncBadge'
import { MovePicker } from '@/features/tasks/MovePicker'
import { TaskDetail } from '@/features/tasks/TaskDetail'
import { TaskList } from '@/features/tasks/TaskList'
import { BRAND } from '@/lib/brand'
import { useClients, useLists, useSavedFilters } from '@/lib/queries'
import { useIsDesktop } from '@/lib/useIsDesktop'
import { SIDEBAR_DEFAULT, useUi, viewTitle, type View } from '@/store/ui'
import { SHORTCUTS, useShortcuts } from './shortcuts'

const TABS: { view: View; label: string; icon: typeof SunIcon }[] = [
  { view: { kind: 'today' }, label: 'Today', icon: SunIcon },
  { view: { kind: 'next7' }, label: 'Week', icon: CalendarIcon },
  { view: { kind: 'inbox' }, label: 'Inbox', icon: InboxIcon },
  { view: { kind: 'all' }, label: 'All', icon: StackIcon },
  { view: { kind: 'completed' }, label: 'Done', icon: ArchiveIcon },
]

/** The clock only needs to be fresh enough to roll over at midnight. */
function useCoarseNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** Drag the sidebar's edge to resize; arrow keys too; double-click resets. */
function ResizeHandle() {
  const setWidth = useUi((s) => s.setSidebarWidth)
  const width = useUi((s) => s.sidebarWidth)

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = useUi.getState().sidebarWidth
    const onMove = (event: PointerEvent) => setWidth(startWidth + event.clientX - startX)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={() => setWidth(SIDEBAR_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setWidth(width - 16)
        if (e.key === 'ArrowRight') setWidth(width + 16)
      }}
      className="group/handle absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize focus:outline-none"
    >
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-accent opacity-0 transition-opacity group-hover/handle:opacity-100 group-focus/handle:opacity-100" />
    </div>
  )
}

export function Shell({ session }: { session: Session }) {
  const view = useUi((s) => s.view)
  const setView = useUi((s) => s.setView)
  const openTaskId = useUi((s) => s.openTaskId)
  const setOpenTask = useUi((s) => s.setOpenTask)
  const sidebarOpen = useUi((s) => s.sidebarOpen)
  const setSidebarOpen = useUi((s) => s.setSidebarOpen)
  const showQuickAdd = useUi((s) => s.showQuickAdd)
  const setShowQuickAdd = useUi((s) => s.setShowQuickAdd)
  const shortcutsOpen = useUi((s) => s.shortcutsOpen)
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen)
  const movingTaskId = useUi((s) => s.movingTaskId)
  const setMovingTask = useUi((s) => s.setMovingTask)
  const sidebarWidth = useUi((s) => s.sidebarWidth)

  const desktop = useIsDesktop()
  const now = useCoarseNow()
  const lists = useLists()
  const clients = useClients()
  const savedFilters = useSavedFilters()
  const [editingFilter, setEditingFilter] = useState(false)
  const searchQuery = useUi((s) => s.searchQuery)
  const setSearchQuery = useUi((s) => s.setSearchQuery)
  useShortcuts(desktop)

  const activeFilter =
    view.kind === 'filter' ? savedFilters.find((f) => f.id === view.filterId) : undefined
  const namedTarget =
    view.kind === 'client'
      ? clients.find((c) => c.id === view.clientId)?.name
      : view.kind === 'filter'
        ? activeFilter?.name
        : lists.find((l) => l.id === view.listId)?.name
  const title = viewTitle(view, namedTarget)

  useEffect(() => {
    document.title = `${title} · ${BRAND.name}`
  }, [title])
  const listId = view.kind === 'list' ? (view.listId ?? null) : null
  const showsTasks = !['conflicts', 'settings', 'calendar', 'search', 'filter'].includes(
    view.kind,
  )

  return (
    <div className="flex h-full flex-col md:flex-row">
      {desktop && (
        <aside
          className="relative hidden shrink-0 border-r border-line bg-surface md:block"
          style={{ width: sidebarWidth }}
        >
          <div className="flex h-12 items-center gap-2 border-b border-line px-3">
            <Wordmark size={22} />
            <span className="ml-auto">
              <SyncBadge />
            </span>
          </div>
          <div className="h-[calc(100%-3rem)]">
            <ListNav />
          </div>
          <ResizeHandle />
        </aside>
      )}

      {!desktop && sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="w-80 max-w-[88%] bg-surface shadow-xl">
            <div className="flex h-12 items-center justify-between border-b border-line px-3">
              <Wordmark size={22} />
              <button
                type="button"
                className="btn-quiet px-2 py-1"
                onClick={() => setSidebarOpen(false)}
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="h-[calc(100%-3rem)]">
              <ListNav />
            </div>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            className="flex-1 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-2 md:px-4">
          {!desktop && (
            <button
              type="button"
              aria-label="Menu"
              className="btn-quiet px-2 py-1.5"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon size={18} />
            </button>
          )}
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
          {activeFilter && (
            <button
              type="button"
              className="btn-quiet px-2 py-1 text-2xs"
              onClick={() => setEditingFilter((open) => !open)}
            >
              {editingFilter ? 'Done' : 'Edit'}
            </button>
          )}
          {desktop && showsTasks && (
            <button
              type="button"
              className="btn-quiet px-2 py-1 text-2xs"
              onClick={() => setShortcutsOpen(true)}
            >
              <span className="kbd">?</span>
            </button>
          )}
          {!desktop && <SyncBadge />}
        </header>

        {activeFilter && editingFilter && (
          <FilterEditor filter={activeFilter} onClose={() => setEditingFilter(false)} />
        )}

        {view.kind === 'search' && (
          <div className="border-b border-line px-3 py-2 md:px-4">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5">
              <SearchIcon className="shrink-0 text-faint" size={16} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search titles, notes and tags"
                className="min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-faint"
                autoComplete="off"
                spellCheck={false}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn-quiet px-1.5 py-0.5 text-2xs"
                  onClick={() => setSearchQuery('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {desktop && showsTasks && (
          <div className="border-b border-line px-4 py-2">
            <QuickAdd listId={listId} />
          </div>
        )}

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-24 md:pb-6">
          {view.kind === 'conflicts' ? (
            <ConflictsScreen />
          ) : view.kind === 'settings' ? (
            <SettingsScreen email={session.user.email} />
          ) : view.kind === 'calendar' ? (
            <CalendarView now={now} />
          ) : (
            <TaskList view={view} now={now} />
          )}
        </div>

        {!desktop && (
          <>
            {showQuickAdd && (
              <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40">
                <button
                  type="button"
                  aria-label="Close"
                  className="flex-1"
                  onClick={() => setShowQuickAdd(false)}
                />
                <div className="safe-bottom bg-bg p-3 animate-slide-up">
                  <QuickAdd
                    listId={listId}
                    autoFocus
                    onCreated={() => setShowQuickAdd(false)}
                  />
                </div>
              </div>
            )}

            <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-line bg-surface">
              {TABS.slice(0, 2).map((tab) => (
                <TabButton
                  key={tab.label}
                  tab={tab}
                  active={view.kind === tab.view.kind}
                  onClick={() => setView(tab.view)}
                />
              ))}
              <div className="flex w-16 shrink-0 items-center justify-center">
                <button
                  type="button"
                  aria-label="Quick add"
                  onClick={() => setShowQuickAdd(true)}
                  className="-mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg"
                >
                  <PlusIcon size={22} />
                </button>
              </div>
              {TABS.slice(2, 4).map((tab) => (
                <TabButton
                  key={tab.label}
                  tab={tab}
                  active={view.kind === tab.view.kind}
                  onClick={() => setView(tab.view)}
                />
              ))}
            </nav>
          </>
        )}
      </main>

      {openTaskId && desktop && (
        <aside className="hidden w-[22rem] shrink-0 border-l border-line md:block">
          <TaskDetail taskId={openTaskId} onClose={() => setOpenTask(null)} />
        </aside>
      )}

      {openTaskId && !desktop && (
        <div className="fixed inset-0 z-50">
          <TaskDetail taskId={openTaskId} onClose={() => setOpenTask(null)} />
        </div>
      )}

      {movingTaskId && (
        <MovePicker taskId={movingTaskId} onClose={() => setMovingTask(null)} />
      )}

      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Keyboard</h2>
              <button
                type="button"
                className="btn-quiet px-2 py-1"
                onClick={() => setShortcutsOpen(false)}
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <dl className="space-y-1.5 text-xs">
              {SHORTCUTS.map(([keys, description]) => (
                <div key={keys} className="flex items-baseline justify-between gap-3">
                  <dt className="kbd shrink-0">{keys}</dt>
                  <dd className="text-right text-muted">{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: (typeof TABS)[number]
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-2xs ${
        active ? 'text-accent' : 'text-muted'
      }`}
    >
      <tab.icon size={19} />
      {tab.label}
    </button>
  )
}
