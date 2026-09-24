/* ─────────────────────────────────────────────────────────────────────────
   BoxBoss — Service Worker  v8
   Full offline support including music.

   The tricky part with audio: browsers stream MP3s using HTTP Range requests
   (e.g. Range: bytes=0-65536). A standard cache.put() stores the full 200
   response, but when the browser later asks for a range it expects a 206
   Partial Content reply — a plain 200 makes most audio engines give up.

   Fix: for audio files we always fetch the COMPLETE file the first time
   (stripping the Range header), store that as one clean cache entry, then
   manually slice the bytes and return a proper 206 for any range request.
   This makes cached music work exactly like a real server.
─────────────────────────────────────────────────────────────────────────── */

const CACHE = 'boxboss-v8';
const AUDIO  = /\.(mp3|ogg|wav|m4a|aac|flac|opus)$/i;

/* Core assets pre-cached at install time */
const PRECACHE = [
  './',
  './index.html',
  './favicon.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
];

/* ── Install ─────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(PRECACHE.map(u => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: wipe old caches ───────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ───────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  if (AUDIO.test(url.pathname)) {
    /* Audio gets special handling so range requests work offline */
    event.respondWith(handleAudio(event.request, url));
  } else {
    /* Everything else: cache-first, auto-cache on first fetch */
    event.respondWith(handleNormal(event.request));
  }
});

/* ── Audio handler ───────────────────────────────────────────────────── */
async function handleAudio(request, url) {
  const cache   = await caches.open(CACHE);
  /* Look for the full file (stored under the plain URL, no Range header) */
  const fullReq = new Request(url.href);
  const cached  = await cache.match(fullReq);

  if (cached) {
    /* Already have the full file — serve range or full response */
    return serveRange(cached, request.headers.get('Range'));
  }

  /* First time: fetch the COMPLETE file regardless of what Range was asked */
  try {
    const full = await fetch(new Request(url.href, {
      mode:        'cors',
      credentials: 'omit',
      /* intentionally no Range header — we want the whole file */
    }));

    if (full.ok) {
      /* Store the full 200 response so future visits are always offline */
      cache.put(fullReq, full.clone()).catch(() => {});
      return serveRange(full, request.headers.get('Range'));
    }
    return full;
  } catch {
    /* Offline and not cached yet */
    return new Response('', {
      status:     503,
      statusText: 'Service Unavailable — play once online to cache this track',
    });
  }
}

/* Build a proper 206 Partial Content (or 200) from a cached full response */
async function serveRange(fullResponse, rangeHeader) {
  if (!rangeHeader) {
    /* No range requested — just return the full file */
    return fullResponse;
  }

  const buf   = await fullResponse.arrayBuffer();
  const total = buf.byteLength;
  const type  = fullResponse.headers.get('Content-Type') || 'audio/mpeg';

  /* Parse "bytes=start-end" */
  const m = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!m) return new Response(buf, { status: 200, headers: { 'Content-Type': type } });

  const start = parseInt(m[1], 10);
  const end   = m[2] !== '' ? parseInt(m[2], 10) : total - 1;
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

/* ── Normal cache-first handler ──────────────────────────────────────── */
async function handleNormal(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
    }
    return response;
  } catch {
    if (request.destination === 'document') {
      return caches.match('./index.html');
    }
    return new Response('', { status: 503 });
  }
}

/* ── Message: manual cache refresh ──────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
