// ZIMBANET — service worker dedicado a push notifications.
// Registrado por src/components/push-prompt.tsx. Recebe o payload JSON
// disparado pelo radar (pywebpush) e renderiza o banner do navegador.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "ZIMBANET", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "ZIMBANET";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/badge-72.png",
    image: data.image || undefined,
    data: data.data || {},
    tag: data.tag || "zimbanet",
    renotify: !!data.renotify,
    vibrate: data.data?.is_breaking ? [200, 100, 200] : [100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
