# send-reminders

Finds reminders that have come due, pushes them to every registered browser,
and marks them fired. Everything it needs is in `../../migrations/0005_push.sql`.

## One-time setup

**1. Generate a VAPID key pair.** These identify your server to the browser's
push service. Keep the private one secret.

```
npx web-push generate-vapid-keys
```

**2. Give the private half to the function, and the public half to the app.**

```
supabase secrets set VAPID_PRIVATE_KEY=<private> VAPID_PUBLIC_KEY=<public> VAPID_SUBJECT=mailto:you@example.com
```

The public key also goes in `.env.local` as `VITE_VAPID_PUBLIC_KEY`, and in the
GitHub repository secrets so the deployed build has it. It is safe in the
client — that is what it is for.

**3. Deploy.**

```
supabase functions deploy send-reminders
```

**4. Schedule it.** Every five minutes is enough; reminders are not to the
second. In the Supabase dashboard under Integrations → Cron, create a job that
POSTs to the function URL with the service role key as the Authorization
header. Do not put that key in this repo.

## Behaviour worth knowing

- A reminder is only marked fired once at least one browser accepted it, so a
  transient failure retries on the next run rather than vanishing.
- Subscriptions that come back 404 or 410 are soft-deleted; browsers discard
  them routinely and a stale one is not an error.
- `due_reminders()` ignores anything more than a day overdue, so a long outage
  does not produce a burst of stale notifications when it comes back.
- Only `channel = 'push'` is handled. Email reminders are in the schema but have
  no sender yet.
