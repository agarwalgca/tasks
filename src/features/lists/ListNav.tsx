import { useState } from 'react'
import {
  AlertIcon,
  ArchiveIcon,
  BriefcaseIcon,
  CalendarIcon,
  InboxIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  StackIcon,
  SunIcon,
  TrashIcon,
} from '@/components/icons'
import {
  createClient,
  createList,
  deleteClient,
  deleteList,
  updateClient,
  updateList,
} from '@/lib/mutations'
import {
  useClients,
  useLists,
  useOpenCounts,
  useUnreviewedConflictCount,
} from '@/lib/queries'
import type { Client, List } from '@/lib/types'
import { useUi, type View } from '@/store/ui'

const VIEWS: { view: View; label: string; icon: typeof SunIcon; countKey?: string }[] = [
  { view: { kind: 'today' }, label: 'Today', icon: SunIcon, countKey: 'today' },
  { view: { kind: 'next7' }, label: 'Next 7 Days', icon: CalendarIcon, countKey: 'next7' },
  { view: { kind: 'inbox' }, label: 'Inbox', icon: InboxIcon, countKey: 'inbox' },
  { view: { kind: 'all' }, label: 'All', icon: StackIcon, countKey: 'all' },
  { view: { kind: 'completed' }, label: 'Completed', icon: ArchiveIcon },
]

const TOOL_VIEWS: { view: View; label: string; icon: typeof SunIcon }[] = [
  { view: { kind: 'calendar' }, label: 'Calendar', icon: CalendarIcon },
  { view: { kind: 'search' }, label: 'Search', icon: SearchIcon },
]

function NavItem({
  active,
  label,
  count,
  tone,
  icon,
  onClick,
  indent = 0,
  children,
}: {
  active: boolean
  label: string
  count?: number
  tone?: string
  icon: React.ReactNode
  onClick: () => void
  indent?: number
  children?: React.ReactNode
}) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-md pr-1 ${
        active ? 'bg-surface2 text-ink' : 'text-muted hover:bg-surface2/60 hover:text-ink'
      }`}
      style={{ paddingLeft: `${indent * 14}px` }}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left"
      >
        <span className={`shrink-0 ${tone ?? (active ? 'text-accent' : '')}`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="shrink-0 font-mono text-2xs text-faint">{count}</span>
        )}
      </button>
      {children}
    </div>
  )
}

export function ListNav() {
  const view = useUi((s) => s.view)
  const setView = useUi((s) => s.setView)
  const lists = useLists()
  const clients = useClients()
  const counts = useOpenCounts(new Date())
  const unreviewed = useUnreviewedConflictCount()
  const [adding, setAdding] = useState<{ parent: string | null } | null>(null)
  const [draft, setDraft] = useState('')

  const roots = lists.filter((l) => !l.parent_list_id)
  const childrenOfList = (id: string) => lists.filter((l) => l.parent_list_id === id)

  async function commitNewList() {
    const name = draft.trim()
    setDraft('')
    setAdding(null)
    if (!name) return
    const list = await createList(name, adding?.parent ?? null)
    setView({ kind: 'list', listId: list.id })
  }

  function renderList(list: List, indent: number) {
    const active = view.kind === 'list' && view.listId === list.id
    return (
      <div key={list.id}>
        <NavItem
          active={active}
          label={list.name}
          count={counts[list.id]}
          indent={indent}
          icon={<ListIcon size={15} />}
          onClick={() => setView({ kind: 'list', listId: list.id })}
        >
          <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {indent === 0 && (
              <button
                type="button"
                aria-label={`Add a list inside ${list.name}`}
                className="p-1 text-faint hover:text-ink"
                onClick={() => {
                  setAdding({ parent: list.id })
                  setDraft('')
                }}
              >
                <PlusIcon size={13} />
              </button>
            )}
            <button
              type="button"
              aria-label={`Rename ${list.name}`}
              className="p-1 font-mono text-2xs text-faint hover:text-ink"
              onClick={() => {
                const next = window.prompt('Rename list', list.name)
                if (next?.trim()) void updateList(list, { name: next.trim() })
              }}
            >
              Aa
            </button>
            <button
              type="button"
              aria-label={`Delete ${list.name}`}
              className="p-1 text-faint hover:text-p1"
              onClick={() => {
                if (window.confirm(`Delete "${list.name}"? Its tasks move to Inbox.`)) {
                  void deleteList(list.id)
                  if (active) setView({ kind: 'today' })
                }
              }}
            >
              <TrashIcon size={13} />
            </button>
          </span>
        </NavItem>
        {childrenOfList(list.id).map((child) => renderList(child, indent + 1))}
        {adding?.parent === list.id && (
          <NewListInput
            draft={draft}
            setDraft={setDraft}
            onCommit={commitNewList}
            onCancel={() => setAdding(null)}
            indent={indent + 1}
          />
        )}
      </div>
    )
  }

  return (
    <nav className="flex h-full flex-col gap-4 p-2 text-sm">
      <div className="space-y-0.5">
        {VIEWS.map((item) => (
          <NavItem
            key={item.label}
            active={view.kind === item.view.kind}
            label={item.label}
            count={item.countKey ? counts[item.countKey] : undefined}
            icon={<item.icon size={15} />}
            onClick={() => setView(item.view)}
          />
        ))}
        {TOOL_VIEWS.map((item) => (
          <NavItem
            key={item.label}
            active={view.kind === item.view.kind}
            label={item.label}
            icon={<item.icon size={15} />}
            onClick={() => setView(item.view)}
          />
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto scroll-thin">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-2xs font-semibold uppercase tracking-wide text-faint">
            Lists
          </span>
          <button
            type="button"
            aria-label="New list"
            className="p-0.5 text-faint hover:text-ink"
            onClick={() => {
              setAdding({ parent: null })
              setDraft('')
            }}
          >
            <PlusIcon size={14} />
          </button>
        </div>
        {roots.map((list) => renderList(list, 0))}
        {adding?.parent === null && (
          <NewListInput
            draft={draft}
            setDraft={setDraft}
            onCommit={commitNewList}
            onCancel={() => setAdding(null)}
            indent={0}
          />
        )}
        {roots.length === 0 && !adding && (
          <p className="px-2 py-1 text-xs text-faint">No lists yet.</p>
        )}
      </div>

      <ClientSection clients={clients} />

      <div className="space-y-0.5 border-t border-line pt-2">
        <NavItem
          active={view.kind === 'conflicts'}
          label="Sync conflicts"
          count={unreviewed}
          tone={unreviewed > 0 ? 'text-p2' : undefined}
          icon={<AlertIcon size={15} />}
          onClick={() => setView({ kind: 'conflicts' })}
        />
        <NavItem
          active={view.kind === 'settings'}
          label="Settings"
          icon={<SettingsIcon size={15} />}
          onClick={() => setView({ kind: 'settings' })}
        />
      </div>
    </nav>
  )
}

function NewListInput({
  draft,
  setDraft,
  onCommit,
  onCancel,
  indent,
}: {
  draft: string
  setDraft: (value: string) => void
  onCommit: () => void
  onCancel: () => void
  indent: number
}) {
  return (
    <div style={{ paddingLeft: `${indent * 14 + 8}px` }} className="py-0.5 pr-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="List name"
        className="field px-2 py-1 text-xs"
      />
    </div>
  )
}

/** Optional labels for grouping work. Hidden entirely until one is added. */
function ClientSection({ clients }: { clients: Client[] }) {
  const view = useUi((s) => s.view)
  const setView = useUi((s) => s.setView)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  async function commit() {
    const name = draft.trim()
    setDraft('')
    setAdding(false)
    if (!name) return
    const client = await createClient(name)
    setView({ kind: 'client', clientId: client.id })
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-2xs font-semibold uppercase tracking-wide text-faint">
          Clients
        </span>
        <button
          type="button"
          aria-label="New client"
          className="p-0.5 text-faint hover:text-ink"
          onClick={() => {
            setAdding(true)
            setDraft('')
          }}
        >
          <PlusIcon size={14} />
        </button>
      </div>

      {clients.map((client) => {
        const active = view.kind === 'client' && view.clientId === client.id
        return (
          <NavItem
            key={client.id}
            active={active}
            label={client.name}
            icon={<BriefcaseIcon size={15} />}
            onClick={() => setView({ kind: 'client', clientId: client.id })}
          >
            <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                aria-label={`Rename ${client.name}`}
                className="p-1 font-mono text-2xs text-faint hover:text-ink"
                onClick={() => {
                  const next = window.prompt('Rename client', client.name)
                  if (next?.trim()) void updateClient(client, { name: next.trim() })
                }}
              >
                Aa
              </button>
              <button
                type="button"
                aria-label={`Delete ${client.name}`}
                className="p-1 text-faint hover:text-p1"
                onClick={() => {
                  if (window.confirm(`Delete "${client.name}"? Its tasks stay put.`)) {
                    void deleteClient(client.id)
                    if (active) setView({ kind: 'today' })
                  }
                }}
              >
                <TrashIcon size={13} />
              </button>
            </span>
          </NavItem>
        )
      })}

      {adding && (
        <NewListInput
          draft={draft}
          setDraft={setDraft}
          onCommit={commit}
          onCancel={() => setAdding(false)}
          indent={0}
        />
      )}
      {clients.length === 0 && !adding && (
        <p className="px-2 py-1 text-xs text-faint">None yet.</p>
      )}
    </div>
  )
}
