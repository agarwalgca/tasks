import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewKind =
  | 'inbox'
  | 'today'
  | 'next7'
  | 'all'
  | 'completed'
  | 'list'
  | 'client'
  | 'calendar'
  | 'search'
  | 'filter'
  | 'conflicts'
  | 'settings'

export interface View {
  kind: ViewKind
  listId?: string
  clientId?: string
  filterId?: string
}

export type Theme = 'light' | 'dark' | 'system'

/** The drag payload for a task row; lists in the sidebar accept it. */
export const TASK_DRAG_TYPE = 'application/x-task-id'

export const SIDEBAR_MIN = 200
export const SIDEBAR_MAX = 480
export const SIDEBAR_DEFAULT = 288

interface UiStore {
  view: View
  theme: Theme
  showQuickAdd: boolean
  focusedTaskId: string | null
  openTaskId: string | null
  sidebarOpen: boolean
  shortcutsOpen: boolean
  searchQuery: string
  /** The task the "move to list" picker is open for. */
  movingTaskId: string | null
  /** Set while a task row is being dragged, so drop targets can show. */
  draggingTaskId: string | null
  sidebarWidth: number
  /** Sidebar sections the user has folded away. */
  collapsed: Record<string, boolean>
  setView: (view: View) => void
  setTheme: (theme: Theme) => void
  setShowQuickAdd: (open: boolean) => void
  setFocusedTask: (id: string | null) => void
  setOpenTask: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  setMovingTask: (id: string | null) => void
  setDraggingTask: (id: string | null) => void
  setSidebarWidth: (width: number) => void
  toggleCollapsed: (section: string) => void
}

export const useUi = create<UiStore>()(
  persist(
    (set) => ({
      view: { kind: 'today' },
      theme: 'system',
      showQuickAdd: false,
      focusedTaskId: null,
      openTaskId: null,
      sidebarOpen: false,
      shortcutsOpen: false,
      searchQuery: '',
      movingTaskId: null,
      draggingTaskId: null,
      sidebarWidth: SIDEBAR_DEFAULT,
      // Filters and clients start folded so lists get the room.
      collapsed: { filters: true, clients: true },
      setView: (view) =>
        set({ view, openTaskId: null, focusedTaskId: null, sidebarOpen: false }),
      setTheme: (theme) => set({ theme }),
      setShowQuickAdd: (showQuickAdd) => set({ showQuickAdd }),
      setFocusedTask: (focusedTaskId) => set({ focusedTaskId }),
      setOpenTask: (openTaskId) => set({ openTaskId }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setMovingTask: (movingTaskId) => set({ movingTaskId }),
      setDraggingTask: (draggingTaskId) => set({ draggingTaskId }),
      setSidebarWidth: (width) =>
        set({ sidebarWidth: Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width))) }),
      toggleCollapsed: (section) =>
        set((state) => ({
          collapsed: { ...state.collapsed, [section]: !state.collapsed[section] },
        })),
    }),
    {
      name: 'tasks-ui',
      partialize: (state) => ({
        view: state.view,
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        collapsed: state.collapsed,
      }),
    },
  ),
)

export function viewTitle(view: View, listName?: string): string {
  switch (view.kind) {
    case 'inbox':
      return 'Inbox'
    case 'today':
      return 'Today'
    case 'next7':
      return 'Next 7 Days'
    case 'all':
      return 'All'
    case 'completed':
      return 'Completed'
    case 'conflicts':
      return 'Sync conflicts'
    case 'settings':
      return 'Settings'
    case 'calendar':
      return 'Calendar'
    case 'search':
      return 'Search'
    case 'filter':
      return listName ?? 'Filter'
    case 'client':
      return listName ?? 'Client'
    case 'list':
      return listName ?? 'List'
  }
}
