/* EscribAI — Service Worker v3 (red primero para el HTML, caché para el resto) */
const CACHE = "escribai-v9";
const ASSETS = ["./", "./index.html", "./manifest.json", "./auth.js", "./analitica.js", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  // cache:"reload" obliga a traerlos de la red. Sin esto, la instalación
  // puede guardar una copia vieja que el navegador tuviera en su propia
  // caché, y el usuario se queda con la versión anterior de la app.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (/deepgram\.com|openai\.com/.test(e.request.url)) return;
  // El HTML y nuestro propio JavaScript van siempre a la red primero: son
  // los que cambian con cada mejora. Iconos y librerías, desde la caché.
  const esHTML = e.request.mode === "navigate" || /\.html$|\/$|auth\.js$|analitica\.js$/.test(new URL(e.request.url).pathname);
  if (esHTML) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request).then(h => h || caches.match("./index.html")))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }))
    );
  }
});
