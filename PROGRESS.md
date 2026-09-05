# Progress

## Where this is
Phase 1 is built. The app runs, builds clean and its tests pass. It has not yet
been pointed at a live Supabase project — see **Next** for the two values needed.

## Done

**Scaffold**
- Vite + React 18 + TypeScript, Tailwind, vite-plugin-pwa (autoUpdate service
  worker, manifest, generated 192/512/maskable/apple-touch icons, offline shell).
- `npm run dev` / `npm run build` / `npm test`.

**Database**
- `supabase/migrations/0001_init.sql` — the full schema including later-phase
  columns (rrule, recurrence_anchor, recurrence_series_id, reminders, clients).
- `0002_rls.sql` — RLS on every table, rows restricted to `auth.uid()`.
- `0003_realtime.sql` — the synced tables added to the realtime publication.

**Sync engine** (`src/sync/`)
- Writes go to IndexedDB and queue in an outbox; the UI never waits on the
  network and works fully offline.
- Cycle: push queue → pull `updated_at >= watermark` → advance watermark.
- Last-write-wins on `updated_at`, enforced on both ends: the client merges by
  timestamp, and the Postgres trigger ignores a write older than the stored row.
- Any local edit that loses is written to a Sync conflicts screen with a
  field-by-field diff and a "Restore my version" button. Nothing is dropped.
- Supabase Realtime applies remote rows within seconds.
- Sync status is always in the header: synced / N pending / offline / error.

**App**
- Email + password auth, single user.
- Lists with one level of nesting; task CRUD; subtasks one level deep;
  priorities; tags; due date with optional time.
- Views: Inbox, Today, Next 7 Days, All, per-list, Completed.
- Quick add parses text with a live preview before it commits, e.g.
  `call the bank tomorrow 5pm !p1 #work`.
- Export: one button writes a JSON dump of every table plus a CSV per table.
- Keyboard shortcuts at desktop widths (`?` lists them); bottom nav and a
  thumb-reachable quick-add sheet on mobile.

**Tests** — 35 passing: date logic, the quick-add parser, and the sync engine
(offline queue surviving a reload, conflict resolution in both directions, a
stale push being ignored, soft deletes propagating, and a no-change pull being
a genuine no-op).

## Next
1. Paste your Supabase **Project URL** and **anon key** into `.env.local`
   (already created from `.env.example`, already gitignored), then restart
   `npm run dev`. Until then the app shows a setup screen.
2. Run the three migration files in order from the Supabase SQL editor.
3. Sign up once, then sign in on the phone with the same account.

Then Phase 2: recurrence (`rrule`), reminders and push, calendar view, saved
filters, search, client UI. The schema already holds their columns.

## Decisions, and why

- **`task_tags` gained a uuid pk, `user_id` and soft-delete columns**, and
  `reminders` gained `user_id`. The data model listed `task_tags(task_id,
  tag_id)`, but the hard rule that nothing is hard-deleted applies to join rows
  too — without `deleted_at` an untagged task could never propagate. `user_id`
  is what RLS filters on. `(task_id, tag_id)` is kept unique among live rows.

- **`sync_state` is the one table with no `deleted_at`.** It is per-device
  bookkeeping, not user content, and it is never synced into Dexie.

- **The `updated_at` trigger accepts a client-supplied timestamp** and ignores a
  write older than the stored row (`return old`). This is what makes
  last-write-wins hold end to end rather than degrading to last-push-wins.
  It leans on device clocks being roughly right; a badly skewed clock would win
  or lose unfairly. Revisit with a server-assigned sequence if that ever bites.

- **Push returns the stored row** (`upsert(...).select()`). A write the server
  refused as stale comes back with its own timestamp, which is how a lost edit
  becomes a visible conflict instead of vanishing. This was a real bug caught by
  the conflict test.

- **The pull watermark uses `>=`, not `>`.** A batch update inside one
  transaction stamps every row with the same `now()`, so `>` would skip rows.
  Boundary rows re-pull each cycle and merge to a no-op.

- **Tailwind v3, not v4.** Boring and heavily documented; the CSS-first v4
  config buys nothing here.

- **Vite 7 / Vitest 3.** Vite 5 pulled in an esbuild dev-server advisory;
  `npm audit` is clean at these versions. React stays on 18 as specified.

- **`fake-indexeddb` added as a devDependency.** Testing the Dexie sync engine
  in Node needs an IndexedDB shim. The alternative — an abstraction over the
  local store — would have tested a stand-in instead of the real thing.

- **`rrule` is not installed yet.** It is in the approved stack but Phase 1 has
  no recurrence code; it lands with Phase 2 rather than sitting unused.

- **TanStack Query holds the session; Dexie's `useLiveQuery` holds the reads.**
  The local database is the read source, so wrapping it in Query would add a
  cache in front of a cache.

- **Date views list matching subtasks; list views nest them.** A subtask due
  today should show up in Today. Under Inbox / All / a list, children sit
  indented under their parent.

- **Export fires one download per file** rather than a zip, which would mean a
  new dependency. Browsers ask once to allow the batch.

- **Deleting a list keeps its tasks** and moves them to the Inbox; child lists
  are promoted to top level.

- **`sort_order` is a float.** Reordering writes one row instead of renumbering.

- **"next monday" means the coming Monday**, same as bare "monday" — never
  today. Bare `at 5` reads as 5 pm (hours 1–7 are treated as afternoon).
