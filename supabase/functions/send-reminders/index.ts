// Sends web push for reminders that have come due, then marks them fired.
// Runs on a schedule (see supabase/functions/send-reminders/README.md).
//
// Secrets it needs, set with `supabase secrets set`:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

interface DueReminder {
  reminder_id: string
  user_id: string
  task_id: string
  title: string
  channel: 'push' | 'email'
  fire_at: string
}

interface Subscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:nobody@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async () => {
  const { data: due, error } = await supabase.rpc('due_reminders')
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const reminders = (due ?? []) as DueReminder[]
  const pushable = reminders.filter((r) => r.channel === 'push')
  if (pushable.length === 0) {
    return Response.json({ due: reminders.length, sent: 0 })
  }

  const userIds = [...new Set(pushable.map((r) => r.user_id))]
  const { data: subscriptionRows } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)
    .is('deleted_at', null)

  const byUser = new Map<string, Subscription[]>()
  for (const row of (subscriptionRows ?? []) as Subscription[]) {
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row])
  }

  const fired: string[] = []
  const stale: string[] = []
  let sent = 0

  for (const reminder of pushable) {
    const subscriptions = byUser.get(reminder.user_id) ?? []
    if (subscriptions.length === 0) continue

    const payload = JSON.stringify({
      title: reminder.title,
      taskId: reminder.task_id,
      firedAt: reminder.fire_at,
    })

    let delivered = false
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        )
        delivered = true
        sent += 1
      } catch (cause) {
        // 404/410 mean the browser threw the subscription away.
        const status = (cause as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) stale.push(subscription.id)
      }
    }
    // Only mark it done once something actually took it, so a transient
    // failure retries on the next run instead of silently swallowing it.
    if (delivered) fired.push(reminder.reminder_id)
  }

  const firedAt = new Date().toISOString()
  if (fired.length > 0) {
    await supabase
      .from('reminders')
      .update({ fired_at: firedAt, updated_at: firedAt })
      .in('id', fired)
  }
  if (stale.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ deleted_at: firedAt, updated_at: firedAt })
      .in('id', stale)
  }

  return Response.json({
    due: reminders.length,
    sent,
    fired: fired.length,
    pruned: stale.length,
  })
})
