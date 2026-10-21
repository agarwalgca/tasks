import { useEffect, useState } from 'react'

const QUERY = '(min-width: 768px)'

/** Desktop gets the keyboard and drag-and-drop affordances; touch does not. */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => window.matchMedia(QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return desktop
}
