/* ===================================================================
   BoxBoss — Service Worker  v7
   Caches EVERYTHING: game HTML, CDN libraries, and all MP3 music files.
   After the first successful online load, the game and all its music
   play fully offline — forever, until you update.
=================================================================== */

const CACHE = 'boxboss-v7';

/* ── Audio extensions that need special range-request handling ───────
   Browsers stream audio using HTTP Range requests (e.g. bytes=0-65536).
   We intercept those, fetch the FULL file once, cache it, then slice
   the right bytes and return a proper 206 Partial Content response so
   the browser's audio engine is satisfied both online and offline.    */
const AUDIO_EXT = /\.(mp3|ogg|wav|m4a|aac|flac|opus)$/i;

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

  /* ── Audio files get special range-request handling ───────────────── */
  if (AUDIO_EXT.test(url.pathname)) {
    event.respondWith(handleAudioRequest(event.request, url));
    return;
  }

  /* ── Everything else: original cache-first logic (unchanged) ─────── */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached;
      }

      /* Not cached — fetch from network and cache the response */
      return fetch(event.request)
        .then(response => {
          if (!response || !response.ok) return response;

          /* Cache all successful responses (HTML, JS, images…) */
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

/* ── Audio handler: fetch full file once, serve ranges from cache ────── */
async function handleAudioRequest(request, url) {
  const cache = await caches.open(CACHE);

  /* Always look up the full file (stored without a Range header) */
  const fullKey = new Request(url.href);
  const cached  = await cache.match(fullKey);

  if (cached) {
    /* Already cached — serve from cache, respecting any Range header */
    /* Also revalidate in background so updated tracks replace themselves */
    fetch(new Request(url.href, { mode: 'cors', credentials: 'omit' }))
      .then(res => { if (res && res.ok) cache.put(fullKey, res).catch(() => {}); })
      .catch(() => {});
    return buildRangeResponse(cached, request.headers.get('Range'));
  }

  /* First time this track is requested — fetch the COMPLETE file */
  try {
    const full = await fetch(new Request(url.href, {
      mode:        'cors',
      credentials: 'omit',
      /* No Range header — we want the whole file so we can cache it */
    }));

    if (full.ok) {
      /* Save the full file so every future visit is offline-capable */
      cache.put(fullKey, full.clone()).catch(() => {});
      return buildRangeResponse(full, request.headers.get('Range'));
    }
    return full; /* pass through non-200 as-is */
  } catch {
    /* Offline and not cached yet */
    return new Response('', {
      status:     503,
      statusText: 'Audio not cached yet — play once while online to save it offline',
    });
  }
}

/* Slice a full cached response into a proper 206 Partial Content reply */
async function buildRangeResponse(fullResponse, rangeHeader) {
  if (!rangeHeader) return fullResponse; /* no range needed — return as-is */

  const buf   = await fullResponse.arrayBuffer();
  const total = buf.byteLength;
  const type  = fullResponse.headers.get('Content-Type') || 'audio/mpeg';

  /* Parse "bytes=start-end" */
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return new Response(buf, { status: 200, headers: { 'Content-Type': type } });
  }

  const start = parseInt(match[1], 10);
  const end   = match[2] !== '' ? parseInt(match[2], 10) : total - 1;
  const slice = new Uint8Array(buf, start, end - start + 1);

  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Type':   type,
      'Content-Range':  `bytes ${start}-${end}/${total}`,
      'Content-Length': String(slice.byteLength),
      'Accept-Ranges':  'bytes',
    },
  });
}

/* ── Message: force update on demand ─────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
