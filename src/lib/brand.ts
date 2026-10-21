/**
 * The app's name and line, in one place. index.html and the PWA manifest in
 * vite.config.ts carry the same name as plain strings, since they are read
 * before any of this code runs — change all three together.
 *
 * Deliberately not renamed: the IndexedDB database ('tasks'), the localStorage
 * key ('tasks-ui') and the /tasks/ URL. Renaming the first two would orphan the
 * local data on every device; renaming the repo would change the URL and break
 * the installed app.
 */
export const BRAND = {
  name: 'Docket',
  tagline: 'Everything on your docket, in order.',
} as const
