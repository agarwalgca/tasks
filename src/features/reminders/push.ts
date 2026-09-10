import { db, META_DEVICE_ID } from '@/lib/db'
import { newId } from '@/lib/ids'
import { requireUserId } from '@/lib/session'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushConfigured = !!VAPID_PUBLIC_KEY

export type PushState =
  | 'unsupported'
  | 'unconfigured'
  | 'denied'
  | 'off'
  | 'on'

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encodeKey(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  return navigator.serviceWorker.ready
}

export async function pushState(): Promise<PushState> {
  if (!('Notification' in window) || !('PushManager' in window)) return 'unsupported'
  if (!pushConfigured) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  const existing = await reg?.pushManager.getSubscription()
  return existing ? 'on' : 'off'
}

/**
 * Subscribes this browser and records it server-side. Push subscriptions belong
 * to one browser on one device, so this is deliberately not synced through the
 * outbox — each device registers itself.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushConfigured) return 'unconfigured'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const reg = await registration()
  if (!reg) return 'unsupported'

  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(VAPID_PUBLIC_KEY!),
    }))

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      id: newId(),
      user_id: requireUserId(),
      device_id: (await db.getMeta<string>(META_DEVICE_ID)) ?? null,
      label: navigator.userAgent.slice(0, 120),
      endpoint: subscription.endpoint,
      p256dh: encodeKey(subscription.getKey('p256dh')),
      auth: encodeKey(subscription.getKey('auth')),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration()
  const subscription = await reg?.pushManager.getSubscription()
  if (!subscription) return 'off'

  const at = new Date().toISOString()
  await supabase
    .from('push_subscriptions')
    .update({ deleted_at: at, updated_at: at })
    .eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
  return 'off'
}
