import { useRef, useState } from 'react'
import {
  AlertIcon,
  ArchiveIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChevronIcon,
  FilterIcon,
  InboxIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  StackIcon,
  SunIcon,
  TrashIcon,
} from '@/components/icons'
import { describeCriteria } from '@/features/filters/filters'
import {
  createClient,
  createList,
  createSavedFilter,
  deleteClient,
  deleteList,
  moveTask,
  updateClient,
  updateList,
} from '@/lib/mutations'
import {
  useClients,
  useLists,
  useOpenCounts,
  useSavedFilters,
  useUnreviewedConflictCount,
} from '@/lib/queries'
import type { List } from '@/lib/types'
import { TASK_DRAG_TYPE, useUi, type View, type ViewKind } from '@/store/ui'

const VIEWS: { view: View; label: string; icon: typeof SunIcon; countKey?: string }[] = [
  { view: { kind: 'today' }, label: 'Today', icon: SunIcon, countKey: 'today' },
  { view: { kind: 'next7' }, label: 'Next 7 Days', icon: CalendarIcon, countKey: 'next7' },
  { view: { kind: 'inbox' }, label: 'Inbox', icon: InboxIcon, countKey: 'inbox' },
  { view: { kind: 'all' }, label: 'All', icon: StackIcon, countKey: 'all' },
  { view: { kind: 'completed' }, label: 'Completed', icon: ArchiveIcon },
]

/** Less-used destinations, kept to one row so lists get the height. */
const TOOLS: { kind: ViewKind; label: string; icon: typeof SunIcon }[] = [
  { kind: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { kind: 'search', label: 'Search', icon: SearchIcon },
  { kind: 'conflicts', label: 'Conflicts', icon: AlertIcon },
  { kind: 'settings', label: 'Settings', icon: SettingsIcon },
]

function NavItem({
  active,
  label,
  count,
  icon,
  onClick,
  onDropTask,
  title,
  indent = 0,
  children,
}: {
  active: boolean
  label: string
  count?: number
  icon: React.ReactNode
  onClick: () => void
  /** Makes the row a drop target for a dragged task. */
  onDropTask?: (taskId: string) => void
  title?: string
  indent?: number
  children?: React.ReactNode
}) {
  const [over, setOver] = useState(false)

  const drop = onDropTask
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes(TASK_DRAG_TYPE)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setOver(true)
        },
        onDragLeave: (e: React.DragEvent) => {
          // Moving between the row's own children fires leave; ignore that.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault()
          setOver(false)
          const taskId = e.dataTransfer.getData(TASK_DRAG_TYPE)
          if (taskId) onDropTask(taskId)
        },
      }
    : {}

  return (
    <div
      {...drop}
      title={title}
      className={`group flex items-center gap-1 rounded-md pr-1 transition-colors ${
        over
          ? 'bg-accent/15 text-ink ring-1 ring-inset ring-accent'
          : active
            ? 'bg-surface2 text-ink'
            : 'text-muted hover:bg-surface2/60 hover:text-ink'
      }`}
      style={{ paddingLeft: `${indent * 14}px` }}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left"
      >
        <span className={`shrink-0 ${active || over ? 'text-accent' : ''}`}>{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="shrink-0 font-mono text-2xs text-faint">{count}</span>
        )}
      </button>
      {children}
    </div>
  )
}

function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      {children}
    </span>
  )
}

function SectionHeader({
  title,
  hint,
  count,
  collapsed,
  onToggle,
  onAdd,
  addLabel,
}: {
  title: string
  hint?: string
  count?: number
  /** Omitted for a section that cannot fold. */
  collapsed?: boolean
  onToggle?: () => void
  onAdd: () => void
  addLabel: string
}) {
  const label = (
    <>
      {onToggle && (
        <ChevronIcon
          size={11}
          className={`shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
        />
      )}
      <span>{title}</span>
      {collapsed && count !== undefined && count > 0 && (
        <span className="font-mono font-normal normal-case tracking-normal">{count}</span>
      )}
      {hint && (
        <span className="truncate font-normal normal-case tracking-normal text-accent">
          {hint}
        </span>
      )}
    </>
  )

  return (
    <div className="flex items-center justify-between px-2 pb-1 pt-3">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-faint hover:text-ink"
        >
          {label}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-faint">
          {label}
        </span>
      )}
      <button
        type="button"
        aria-label={addLabel}
        title={addLabel}
        className="rounded p-0.5 text-faint hover:bg-surface2 hover:text-ink"
        onClick={onAdd}
      >
        <PlusIcon size={14} />
      </button>
    </div>
  )
}

function NameInput({
  onCommit,
  onCancel,
  placeholder,
  indent = 0,
}: {
  onCommit: (name: string) => void
  onCancel: () => void
  placeholder: string
  indent?: number
}) {
  const [draft, setDraft] = useState('')
  // Enter commits and unmounts the input, which can also fire blur; without a
  // guard that survives the re-render, one name would create two rows.
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    onCommit(draft.trim())
  }
  return (
    <div style={{ paddingLeft: `${indent * 14 + 8}px` }} className="py-0.5 pr-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish()
          if (e.key === 'Escape') {
            done.current = true
            onCancel()
          }
        }}
        placeholder={placeholder}
        className="field px-2 py-1 text-xs"
      />
    </div>
  )
}

export function ListNav() {
  const view = useUi((s) => s.view)
  const setView = useUi((s) => s.setView)
  const collapsed = useUi((s) => s.collapsed)
  const toggleCollapsed = useUi((s) => s.toggleCollapsed)
  const dragging = useUi((s) => s.draggingTaskId !== null)
  const lists = useLists()
  const clients = useClients()
  const savedFilters = useSavedFilters()
  const counts = useOpenCounts(new Date())
  const unreviewed = useUnreviewedConflictCount()
  const [adding, setAdding] = useState<string | null>(null)

  const roots = lists.filter((l) => !l.parent_list_id)
  const childrenOfList = (id: string) => lists.filter((l) => l.parent_list_id === id)

  /** "+" on a folded section opens it, so the new row is visible. */
  function startAdding(key: string) {
    if (collapsed[key]) toggleCollapsed(key)
    setAdding(key)
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
          onDropTask={(taskId) => void moveTask(taskId, list.id)}
        >
          <RowActions>
            {indent === 0 && (
              <button
                type="button"
                aria-label={`Add a list inside ${list.name}`}
                title="Add a list inside"
                className="p-1 text-faint hover:text-ink"
                onClick={() => setAdding(`list:${list.id}`)}
              >
                <PlusIcon size={13} />
              </button>
            )}
            <button
              type="button"
              aria-label={`Rename ${list.name}`}
              title="Rename"
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
              title="Delete"
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
          </RowActions>
        </NavItem>
        {childrenOfList(list.id).map((child) => renderList(child, indent + 1))}
        {adding === `list:${list.id}` && (
          <NameInput
            placeholder="List name"
            indent={indent + 1}
            onCancel={() => setAdding(null)}
            onCommit={async (name) => {
              setAdding(null)
              if (!name) return
              const created = await createList(name, list.id)
              setView({ kind: 'list', listId: created.id })
            }}
          />
        )}
      </div>
    )
  }

  return (
    <nav className="flex h-full flex-col text-sm">
      <div className="space-y-0.5 p-2 pb-0">
        {VIEWS.map((item) => (
          <NavItem
            key={item.label}
            active={view.kind === item.view.kind}
            label={item.label}
            count={item.countKey ? counts[item.countKey] : undefined}
            icon={<item.icon size={15} />}
            onClick={() => setView(item.view)}
            onDropTask={
              item.view.kind === 'inbox' ? (taskId) => void moveTask(taskId, null) : undefined
            }
          />
        ))}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <SectionHeader
          title="Lists"
          hint={dragging ? 'drop on one to move' : undefined}
          onAdd={() => setAdding('list:root')}
          addLabel="New list"
        />
        {roots.map((list) => renderList(list, 0))}
        {adding === 'list:root' && (
          <NameInput
            placeholder="List name"
            onCancel={() => setAdding(null)}
            onCommit={async (name) => {
              setAdding(null)
              if (!name) return
              const created = await createList(name)
              setView({ kind: 'list', listId: created.id })
            }}
          />
        )}
        {roots.length === 0 && adding !== 'list:root' && (
          <p className="px-2 py-1 text-xs text-faint">No lists yet.</p>
        )}

        <SectionHeader
          title="Filters"
          count={savedFilters.length}
          collapsed={collapsed.filters}
          onToggle={() => toggleCollapsed('filters')}
          onAdd={() => startAdding('filters')}
          addLabel="New filter"
        />
        {!collapsed.filters && (
          <>
            {savedFilters.map((filter) => (
              <NavItem
                key={filter.id}
                active={view.kind === 'filter' && view.filterId === filter.id}
                label={filter.name}
                title={describeCriteria(filter.criteria ?? {})}
                icon={<FilterIcon size={15} />}
                onClick={() => setView({ kind: 'filter', filterId: filter.id })}
              />
            ))}
            {adding === 'filters' && (
              <NameInput
                placeholder="Filter name"
                onCancel={() => setAdding(null)}
                onCommit={async (name) => {
                  setAdding(null)
                  if (!name) return
                  const created = await createSavedFilter(name)
                  setView({ kind: 'filter', filterId: created.id })
                }}
              />
            )}
            {savedFilters.length === 0 && adding !== 'filters' && (
              <p className="px-2 py-1 text-xs text-faint">None yet.</p>
            )}
          </>
        )}

        <SectionHeader
          title="Clients"
          count={clients.length}
          collapsed={collapsed.clients}
          onToggle={() => toggleCollapsed('clients')}
          onAdd={() => startAdding('clients')}
          addLabel="New client"
        />
        {!collapsed.clients && (
          <>
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
                  <RowActions>
                    <button
                      type="button"
                      aria-label={`Rename ${client.name}`}
                      title="Rename"
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
                      title="Delete"
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
                  </RowActions>
                </NavItem>
              )
            })}
            {adding === 'clients' && (
              <NameInput
                placeholder="Client name"
                onCancel={() => setAdding(null)}
                onCommit={async (name) => {
                  setAdding(null)
                  if (!name) return
                  const created = await createClient(name)
                  setView({ kind: 'client', clientId: created.id })
                }}
              />
            )}
            {clients.length === 0 && adding !== 'clients' && (
              <p className="px-2 py-1 text-xs text-faint">None yet.</p>
            )}
          </>
        )}
      </div>

      <div className="grid shrink-0 grid-cols-4 border-t border-line px-1 py-1">
        {TOOLS.map((tool) => {
          const active = view.kind === tool.kind
          const badge = tool.kind === 'conflicts' ? unreviewed : 0
          return (
            <button
              key={tool.kind}
              type="button"
              title={tool.label}
              aria-label={badge > 0 ? `${tool.label} (${badge} unreviewed)` : tool.label}
              onClick={() => setView({ kind: tool.kind })}
              className={`relative flex flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px] leading-none transition-colors ${
                active ? 'bg-surface2 text-accent' : 'text-faint hover:bg-surface2/60 hover:text-ink'
              }`}
            >
              <tool.icon size={16} />
              {tool.label}
              {badge > 0 && (
                <span className="absolute right-2 top-0.5 min-w-[14px] rounded-full bg-p2 px-1 font-mono text-[9px] leading-[14px] text-white">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
