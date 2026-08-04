// Kortline · Service Worker v1.0.2
// Cache-first para los assets de la app shell, network-first para el resto.
// Bump CACHE_VERSION en cada release para invalidar caché vieja en clientes.

const CACHE_VERSION = "kortline-v3-test-dev.25";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/logos/logo-icon.svg",
  "./assets/logos/logo-full.svg"
];

// ── INSTALL: precachear app shell ───────────────────────────────────────────
// NO llamamos a self.skipWaiting() aquí. El banner "🔄 Nueva versión
// disponible" de index.html depende de que el SW nuevo se quede en estado
// "waiting" hasta que el usuario pulse "Actualizar" (que manda el mensaje
// SKIP_WAITING, ver más abajo). Si activábamos solos en el install, para
// cuando el usuario veía el botón el cambio de controlador ya había pasado
// en silencio y el botón no hacía nada por mucho que se pulsara.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll falla si cualquier recurso da error → usamos add() individual
      // para que un asset no crítico no tumbe la instalación.
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) =>
            console.warn("[SW] No se pudo cachear:", url, err)
          )
        )
      )
    )
  );
});

// ── ACTIVATE: limpiar cachés viejas ─────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("kortline-v3-test-") && k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia ───────────────────────────────────────────────────────
//  · Navegaciones (HTML): network-first con fallback a caché → siempre la última
//    versión cuando hay red, pero offline funciona.
//  · Recursos del shell: cache-first → arranque instantáneo.
//  · Resto (Google Fonts, CDN): cache-first con actualización en background.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo GET — no cachear POST/PUT/DELETE.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isNavigate = req.mode === "navigate" || (req.destination === "document");

  // Network-first para navegaciones (que el usuario vea siempre la última versión)
  if (isNavigate) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cachear la respuesta nueva
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match("./index.html"))
        )
    );
    return;
  }

  // Cache-first para todo lo demás (assets, CDN, fonts...)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Background update: refrescar caché silenciosamente
        fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(CACHE_VERSION).then((c) => c.put(req, res.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// ── MESSAGE: permitir refresco manual desde la app ──────────────────────────
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
