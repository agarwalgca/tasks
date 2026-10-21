# Progress

## Where this is
Phase 1 is done, deployed and verified on the live project (ap-south-1, Mumbai).
Phase 2 is built, deployed, and its migrations are applied and verified. Push
notifications were built and then removed at your request — see the decision
below.

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

## Phase 2 (built)
- **Recurrence** — `rrule`-backed. Completing a repeating task leaves it
  completed and creates the next one, so Completed keeps a real history. Two
  anchors: from the due date (a monthly bill, however late you tick it) or from
  the completion date ("every 3 days" from when you actually did it). Tags carry
  over and subtasks come back unticked. Quick add reads "every monday",
  "every 3 days", "every month".
- **Search** — over titles, notes and tag names, client-side against Dexie, so
  it works offline. `/` opens it.
- **Calendar** — month grid, six weeks fixed so it never jumps height, priority
  dots, click through to a task. `g v`.
- **Clients** — CRUD in the sidebar, assignment from the task panel, and a
  per-client view. Hidden from the task panel until you create one.
- **Saved filters** — criteria stored as jsonb: due window, priorities, lists,
  clients, tags, free text, include-completed. Empty criteria mean "everything
  open"; entries within a criterion are "any of", and criteria combine with AND.
- **Reminders + push** — removed. See decisions.

**Tests** — 74 passing. Added: recurrence maths (19), the spawn-on-completion
behaviour against a real Dexie (9), and filter matching (9).

## Moving, sidebar and branding (2026-10-21)
- **Move a task to another list** from the task panel (Move button, or the List
  field, which is now a button), with `m` on the focused row, or by dragging a
  row onto a list or Inbox in the sidebar on desktop. The picker filters as you
  type and names how many subtasks will come along.
- **Fixed:** the old List dropdown moved a task but left its subtasks in the
  old list, which skewed that list's count. `moveTask` moves the whole family in
  one write, and running it again on a task heals any subtask an earlier move
  stranded. A subtask's own List field now reads "follows parent" instead of
  offering a move that would split the family.
- **Sidebar:** lists take the middle of the sidebar (527px of 752 at 800px tall,
  70%). Filters and Clients fold away, collapsed by default and remembered;
  Calendar, Search, Conflicts and Settings are one icon row at the bottom. The
  sidebar is resizable from 200px to 480px — drag the edge, arrow keys on it, or
  double-click to reset to 288px — and the width is remembered.
- **Branding:** the app stays **Tasks**, with **CA Gaurav Agarwal** under the
  name in the sidebar header, the phone drawer and the sign-in and password
  screens, and in the page and manifest descriptions. The mark is a slip of
  paper — the accent tile with its top corner folded and a check — drawn in
  theme tokens so it follows light and dark, and used for the favicon and all
  four PWA icons. The maskable icon (what Android puts on the home screen) keeps
  the slip silhouette inside the safe zone. (Briefly renamed "Docket" on
  2026-10-21 and reverted the same day at your request.)

**Tests** — 83 passing; `moveTask` gained 7.

## Phase 2 verified on the live project (2026-09-13)
- `0004_saved_filters.sql` and `0005_push.sql` applied. `saved_filters` and
  `push_subscriptions` exist and return nothing to an anonymous read.
- Anonymous inserts into both are refused with `42501`. (A first attempt sent
  one payload to both tables and got `PGRST204` — a column mismatch rejected
  before RLS ran, so it proved nothing. Re-run with per-table columns.)
- `reminder_fire_at` on the real database: due 2026-09-20 17:00 IST, 60 minutes
  before, returns `10:30 UTC`. 17:00 IST is 11:30 UTC, so the zone conversion is
  right.
- `due_reminders()` is callable and returns an empty set.

## Review and optimisation (2026-09-17)
- **Fixed:** a completion-anchored recurrence stepped along the series begun
  on the original due date instead of restarting from the completion day, so
  "every 3 days" only gave completion + 3 when the gap happened to be a
  multiple of three. Its test depended on the calendar date and was failing.
- Every table is read through one shared Dexie live query (`src/lib/live.ts`)
  instead of one `useLiveQuery` per component, so a write costs one table read
  and one sort rather than four to six.
- `TaskRow` is memoised and takes the shell's clock as a prop, so hovering a
  row or typing in search re-renders the rows that changed, not the list.
- Subtask lookup, the search index, filter tag maps and the calendar buckets
  are built in one pass instead of a scan per row.
- `zonedParts` caches its last answer. Filter matching and due-date formatting
  were calling `formatToParts` once per task for the same instant.
- Sync pull merges a page of rows in one IndexedDB transaction, not one each.
- New rows take `sort_order` from the index instead of scanning the table, and
  deleting a task, list or client writes its dependants in one transaction.
- Quick-add and recurrence regexes are built once rather than per keystroke.
- Vendor code is its own chunk (about 545 kB) so a deploy only re-downloads
  the app chunk (about 84 kB).

**Tests** — 76 passing. Added: the shared live query (2).

## Superseded plan
Phase 2, and what each needed when it was scoped:

| feature | schema | notes |
| --- | --- | --- |
| recurrence | ready | `rrule`, `recurrence_anchor`, `recurrence_series_id`, `source` all exist. `rrule` still needs installing. |
| calendar view | ready | pure UI over `due_date`. |
| search | ready | client-side over Dexie; single-user scale doesn't need Postgres FTS. |
| client UI | ready | `clients` table ships empty; needs CRUD and task assignment. |
| reminders + push | **partial** | `reminders` rows exist, but delivery has nothing: no table for push subscriptions, no scheduled job, no Edge Function, no VAPID keys. |
| saved filters | **missing** | no table at all. Needs a new migration. |

So two of the six need new migrations. Everything else is application code
against the schema as it stands.

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

### Keeping the project awake
Free-tier Supabase pauses a project after about a week with no database
activity, and the hostname stops resolving entirely — the app then fails at the
login screen with "failed to fetch". This happened on 2026-10-19 after five
quiet weeks; restoring from the dashboard brought everything back intact, which
took a few minutes of 521 / 502 / 404 before settling on 200.

`.github/workflows/keep-warm.yml` now runs a real PostgREST select daily so the
project never goes idle that long. It has to be a query, not a health check: an
anonymous select returns `[]` under RLS, but the connection to Postgres is what
counts as activity. GitHub disables scheduled workflows in a repo untouched for
60 days, so that is the remaining way this can lapse.

### Setup notes, if this ever needs redoing
- A project's region cannot be changed after creation; make a new project and
  move the data. This one was rebuilt in Mumbai after starting in Seoul.
- Supabase requires email confirmation by default, and its default Site URL is
  `http://localhost:3000` — set it to the deployed URL, and keep localhost in
  the redirect allow list so local development still works.
- The service worker only exists in production builds. `npm run dev` will never
  survive an offline reload; use `npm run build && npm run preview` to test it.

## Decisions, and why

- **The name and owner live in `src/lib/brand.ts`,** plus two plain strings
  that load before any code runs: the `<title>` in `index.html` and the
  manifest in `vite.config.ts`. Change those three together.

- **Drag-and-drop is desktop only.** HTML5 drag does not work on touch, and a
  long-press drag would fight scrolling on a phone. The picker covers the phone.

- **Push notifications and the reminders UI were removed (2026-09-13).** You
  didn't want push. Without it a reminder is a row that never fires, so the
  Reminders field went too rather than stay as a control that does nothing.
  Removed: the Edge Function, `public/push-sw.js`, the subscription code, the
  Settings toggle, the VAPID env wiring and `createReminder`/`deleteReminder`.
  **Left in the database on purpose:** migration 0005 is applied and must not be
  edited, so `push_subscriptions`, `reminder_fire_at()`, `due_reminders()` and
  `reminders_unfired_idx` still exist. All empty and unused. A `0006` drop
  migration would remove them if that ever matters; nothing needs it now. The
  `reminders` table itself is from 0001 and still syncs, so reminders could be
  brought back without a schema change.

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

- **TanStack Query holds the session; Dexie live queries hold the reads.**
  The local database is the read source, so wrapping it in Query would add a
  cache in front of a cache. Whole-table reads go through `sharedLiveQuery`
  (one Dexie subscription per table, `useSyncExternalStore` on the React side)
  because six components each running their own `toArray()` on every write was
  the largest runtime cost. Single-row reads still use `useLiveQuery` directly.

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
