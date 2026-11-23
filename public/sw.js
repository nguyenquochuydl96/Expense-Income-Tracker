// Heo & Mèo Service Worker for PWA
const CACHE_NAME = 'heomeo-pwa-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './pwa-192.png',
  './pwa-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignore individual failures
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

const BLOCKED_DOMAINS = [
  'script.google.com',
  'script.googleusercontent.com',
  'googleapis.com',
  'firebaseapp.com',
  'firebaseio.com',
  'firebase.google.com',
];

function isBlockedHostname(hostname) {
  const host = (hostname || '').toLowerCase();
  return BLOCKED_DOMAINS.some(
    (domain) => host === domain || host.endsWith('.' + domain)
  );
}

function createOfflineResponse() {
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // 1. NEVER cache external origins, Google Apps Script (incl. script.googleusercontent.com),
  //    Google Sheets API, Firebase, or CSV data files
  if (
    isBlockedHostname(url.hostname) ||
    url.origin !== self.location.origin ||
    url.pathname.toLowerCase().endsWith('.csv') ||
    url.pathname.includes('/assets/aistudio/')
  ) {
    return;
  }

  // 2. Navigation requests: Network-first, refresh cached index.html on success, 503 fallback on miss
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('./index.html', responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match('./index.html').then((cached) => cached || createOfflineResponse())
        )
    );
    return;
  }

  // 3. Same-origin static assets: Stale-while-revalidate with guaranteed Response fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse || createOfflineResponse());

      return cachedResponse || fetchPromise;
    })
  );
});
