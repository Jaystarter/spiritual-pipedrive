/* S-Drive follow-up reminders service worker.
 * Handles Web Push delivery and notification clicks. Served from the site root
 * so its scope covers the whole app. */

const DEFAULT_ICON = "/s-drive-icon.png";

self.addEventListener("install", () => {
  // Activate this worker immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (error) {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "S-Drive";
  const url = typeof payload.url === "string" && payload.url ? payload.url : "/";
  const options = {
    body: payload.body || "",
    tag: payload.tag || "s-drive-follow-up",
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/";
  const targetPath = new URL(targetUrl, self.location.origin);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          const clientUrl = new URL(client.url);

          if (clientUrl.origin === targetPath.origin && "focus" in client) {
            client.navigate(targetPath.href).catch(() => {});
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetPath.href);
        }

        return undefined;
      })
  );
});
