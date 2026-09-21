/* ═══════════════════════════════════════════════════════════════════════
   BoxBoss — Service Worker  v7
   Caches EVERYTHING: game HTML, CDN libraries, and all MP3 music files.
   After the first successful online load, the game and all its music
   play fully offline — forever, until you update.
═══════════════════════════════════════════════════════════════════════ */

const CACHE = 'boxboss-v7';

/* Core files to pre-cache on install (always available offline) */
const PRECACHE = [
  './',
  './index.html',
  './favicon.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
  /* CDN libraries — cached so the game loads offline */
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
];

/* ── Install: pre-cache core assets ─────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      /* addAll fails silently per item so a missing icon never blocks install */
      Promise.allSettled(PRECACHE.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

/* ── Activate: clean up old cache versions ───────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first with auto-caching of new resources (MP3s etc.) ─ */
self.addEventListener('fetch', event => {
  /* Only handle GET requests */
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /* Skip non-http(s) requests */
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        /* Serve from cache immediately */
        /* For MP3/audio files also start a background update */
        const isAudio = /\.(mp3|ogg|wav|m4a|aac)$/i.test(url.pathname);
        if (isAudio) {
          /* Background revalidate so music updates when online */
          fetch(event.request)
            .then(res => {
              if (res && res.ok) {
                caches.open(CACHE).then(c => c.put(event.request, res)).catch(() => {});
              }
            })
            .catch(() => {});
        }
        return cached;
      }

      /* Not cached — fetch from network and cache the response */
      return fetch(event.request)
        .then(response => {
          if (!response || !response.ok) return response;

          /* Cache all successful responses (HTML, JS, MP3, images…) */
          const toCache = response.clone();
          caches.open(CACHE)
            .then(cache => cache.put(event.request, toCache))
            .catch(() => {});

          return response;
        })
        .catch(() => {
          /* Network failed and nothing cached — return a simple offline stub */
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 503 });
        });
    })
  );
});

/* ── Message: force update on demand ─────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
