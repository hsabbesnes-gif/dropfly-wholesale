const CACHE = "dropfly-wholesale-github-v35";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const scoped = (path) => new URL(path.replace(/^\/+/, ""), self.registration.scope).pathname;
const STATIC_ASSETS = [scoped("/"), scoped("/manifest.webmanifest"), scoped("/app-icon-maskable.svg"), scoped("/app-enhancements.js"), scoped("/app-enhancements.css")];
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || "لديك تحديث جديد" }; }
  const requested = new URL(data.url || scoped("/"), self.location.origin);
  const safeUrl = requested.origin === self.location.origin && requested.pathname.startsWith(SCOPE_PATH + "/")
    ? requested.href : new URL(scoped("/"), self.location.origin).href;
  const orderId = String(data.entity_id || "");
  const opensOrder = /^(new_order|order_status)-/.test(String(data.tag || "")) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId);
  const target = new URL(safeUrl);
  if (opensOrder) target.hash = "order=" + encodeURIComponent(orderId);
  event.waitUntil(self.registration.showNotification(data.title || "تحديث جديد", {
    body: data.body || data.message || "لديك إشعار جديد",
    icon: scoped("/app-icon-maskable.svg"), badge: scoped("/app-icon-maskable.svg"),
    lang: "ar", dir: "rtl", silent: false,
    tag: (data.tag || data.entity_id || "dropfly-notification") + "-" + Date.now(),
    data: { url: target.href }, renotify: false,
    actions: [{ action: "open", title: "فتح التطبيق" }]
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || scoped("/"), self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin + SCOPE_PATH));
    return existing ? existing.navigate(url).then((client) => client.focus()) : self.clients.openWindow(url);
  }));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }).catch(() => new Response(
      "<!doctype html><html lang='ar' dir='rtl'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>دروب فلاي</title><body style='font-family:sans-serif;text-align:center;padding:48px'><h2>لا يوجد اتصال بالإنترنت</h2><p>تأكد من الشبكة ثم حاول مرة ثانية.</p></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    )));
    return;
  }
  event.respondWith(fetch(event.request, { cache: "no-store" })
    .then((response) => {
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    })
    .catch(() => caches.match(event.request)));
});
