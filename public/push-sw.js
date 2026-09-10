// Imported into the generated service worker (see vite.config.ts). Handles the
// push events the send-reminders function produces.

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: event.data ? event.data.text() : 'Reminder' }
  }

  const title = payload.title || 'Reminder'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: 'Tap to open',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: payload.taskId || title,
      renotify: false,
      data: { taskId: payload.taskId },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const scope = self.registration.scope

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(scope) && 'focus' in client) return client.focus()
        }
        return self.clients.openWindow(scope)
      }),
  )
})
