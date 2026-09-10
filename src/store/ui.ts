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
  | 'conflicts'
  | 'settings'

export interface View {
  kind: ViewKind
  listId?: string
  clientId?: string
}

export type Theme = 'light' | 'dark' | 'system'

interface UiStore {
  view: View
  theme: Theme
  showQuickAdd: boolean
  focusedTaskId: string | null
  openTaskId: string | null
  sidebarOpen: boolean
  shortcutsOpen: boolean
  searchQuery: string
  setView: (view: View) => void
  setTheme: (theme: Theme) => void
  setShowQuickAdd: (open: boolean) => void
  setFocusedTask: (id: string | null) => void
  setOpenTask: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
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
      setView: (view) =>
        set({ view, openTaskId: null, focusedTaskId: null, sidebarOpen: false }),
      setTheme: (theme) => set({ theme }),
      setShowQuickAdd: (showQuickAdd) => set({ showQuickAdd }),
      setFocusedTask: (focusedTaskId) => set({ focusedTaskId }),
      setOpenTask: (openTaskId) => set({ openTaskId }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
    }),
    {
      name: 'tasks-ui',
      partialize: (state) => ({ view: state.view, theme: state.theme }),
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
    case 'client':
      return listName ?? 'Client'
    case 'list':
      return listName ?? 'List'
  }
}
