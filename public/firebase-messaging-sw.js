/* Dedicated messaging scope: never replaces the existing offline worker. */
self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  let destination = "/";
  try {
    const data = event.notification.data;
    const candidate = new URL(
      data?.target ?? data?.FCM_MSG?.data?.path ?? "/",
      self.location.origin,
    );
    if (candidate.origin === self.location.origin) destination = candidate.pathname;
  } catch {
    // Malformed and external links return to the game's home.
  }
  event.waitUntil(self.clients.openWindow(destination));
});

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));

firebase.messaging().onBackgroundMessage((payload) => {
  // Firebase displays notification payloads itself. Only render data-only pushes here.
  if (payload.notification) return;
  const data = payload.data ?? {};
  return self.registration.showNotification(String(data.title ?? "jogomanager").slice(0, 90), {
    body: String(data.body ?? "Você tem uma atualização no jogo.").slice(0, 220),
    icon: "/icon-192.png",
    tag: String(data.eventId ?? "jogomanager").slice(0, 70),
    data: { target: data.path ?? data.url ?? "/" },
  });
});
