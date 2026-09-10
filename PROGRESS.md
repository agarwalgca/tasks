# Progress

## Where this is
Phase 1 is done and verified against the live Supabase project (ap-south-1,
Mumbai). Migrations are applied, the account exists, and a full round trip has
been exercised on real infrastructure.

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
- Email + password auth, single user, with password recovery: "Forgot
  password?" sends a reset link, the link opens a "set a new password" screen,
  and Settings has a Change password form for rotating it while signed in.
  `detectSessionInUrl` is on so the link's token is consumed and the hash
  cleaned; the recovery screen is gated behind a real session, so a forged
  `#type=recovery` hash just shows the sign-in form.
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

## Verified on the live project (2026-09-08)
- Anonymous insert into `tasks` is refused with `42501` — RLS is what makes the
  anon key safe to ship.
- Tasks written in the browser land in Postgres: `profiles` 1, `tasks` 3,
  `tags` 1, `task_tags` 1, `sync_state` 1 (this device registering itself).
  The tag and its join row came from the quick-add parser, not by hand.
- A second origin (`:4173`, a different local database and session) signed in
  and pulled the whole account down — the first-sync path a new phone takes.
- Service worker registers and activates from the production build; an offline
  reload renders the shell from cache with tasks intact and the badge on
  "Offline".

## Next
Phase 2: recurrence (`rrule`), reminders and push, calendar view, saved
filters, search, client UI. The schema already holds their columns.

### Deploying
Live at **https://agarwalgca.github.io/tasks/** from
`github.com/agarwalgca/tasks`, via `.github/workflows/deploy.yml` on push to
master.

Enabling Pages through the API sets the environment's deployment branch policy
to `main`, so the first deploy was rejected on a `master` repo; `master` was
added to `github-pages` deployment-branch-policies to fix it. Worth knowing if
this is ever set up again. The build
is base-path aware: `VITE_BASE` drives Vite's `base`, the manifest's
`start_url`/`scope` and the service worker's navigation fallback, so a project
repo served from `/<repo>/` works without hand-editing anything. The workflow
derives it from the repo name and uses `/` for a `<user>.github.io` repo.
Supabase credentials come from repository secrets rather than the repo.

### Setup notes, if this ever needs redoing
- A project's region cannot be changed after creation; make a new project and
  move the data. This one was rebuilt in Mumbai after starting in Seoul.
- Supabase requires email confirmation by default, and its default Site URL is
  `http://localhost:3000` — set it to the deployed URL, and keep localhost in
  the redirect allow list so local development still works.
- The service worker only exists in production builds. `npm run dev` will never
  survive an offline reload; use `npm run build && npm run preview` to test it.

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
