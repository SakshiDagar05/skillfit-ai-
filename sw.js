// SkillFit AI — Service Worker
// Enables offline access and faster loading

const CACHE_NAME = 'skillfit-ai-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// External resources to cache (fonts etc.)
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap'
];

// ── Install: cache all static assets ──────────────────────────────────────
self.addEventListener('install', function(event) {
  console.log('[SW] Installing SkillFit AI Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Caching static assets');
      // Cache local assets (must succeed)
      return cache.addAll(STATIC_ASSETS).then(function() {
        // Cache external assets best-effort
        return Promise.allSettled(
          EXTERNAL_ASSETS.map(url => cache.add(url).catch(() => {}))
        );
      });
    }).then(function() {
      console.log('[SW] Install complete');
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch: serve from cache, fallback to network ──────────────────────────
self.addEventListener('fetch', function(event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For navigation requests (HTML pages) — network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Update cache with fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(function() {
          // Offline fallback
          return caches.match('./index.html');
        })
    );
    return;
  }

  // For all other assets — cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        // Only cache valid responses
        if (!response || response.status !== 200) return response;

        const clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        // For image requests offline, return a transparent pixel
        if (event.request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      });
    })
  );
});

// ── Background Sync (for future use) ──────────────────────────────────────
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-assessments') {
    console.log('[SW] Background sync triggered');
  }
});
