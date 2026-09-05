# Personal Task Manager — Project Conventions

## What this is
A single-user task manager PWA. Used daily on an Android phone and a Windows
laptop. Cloud-synced via Supabase. Built to last years — favour boring,
portable technology over clever abstractions.

## Stack (do not substitute)
- React 18 + TypeScript + Vite
- Supabase: Postgres, Auth (email/password), Row Level Security, Realtime
- Dexie (IndexedDB) as the local working copy
- TanStack Query for server state, Zustand for UI state
- `rrule` for all recurrence maths
- vite-plugin-pwa for the service worker and manifest
- Vitest for tests
No ORM over Supabase. No CSS framework beyond Tailwind. No other dependencies
without asking me first.

## Hard rules
- Every table: client-generated UUID pk, `updated_at` maintained by a Postgres
  trigger, nullable `deleted_at` for soft delete. Nothing is ever hard-deleted
  from the client — sync depends on it.
- All money-free but date-heavy: store `timestamptz`, render in Asia/Kolkata.
- Secrets live in `.env.local`, which is gitignored. Never commit keys. Never
  print the service_role key; the client only ever uses the anon key.
- Migrations are numbered SQL files in `supabase/migrations/`. Never edit an
  applied migration — write a new one.
- Sync logic and date logic get unit tests. UI does not need tests.
- Do not remove or weaken a test to make it pass. If a test is wrong, say so.

## Working style
- Only make changes I asked for or that are clearly necessary. No speculative
  abstractions, no defensive code for impossible states, no docstrings on code
  you didn't touch.
- Run `npm run build` and `npm test` before telling me something works. Report
  only what you actually verified in this session.
- Keep `PROGRESS.md` updated: what's done, what's next, decisions made and why.
- Commit after each working feature with a short conventional-commit message.
- Clean up any temporary scripts you create.

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm test` — unit tests
