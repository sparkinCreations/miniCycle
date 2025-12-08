// Restored original service worker logic from backup.
// NOTE: Ensure this matches the previous behavior you relied on.

importScripts('./version.js');

var APP_VERSION = self.APP_VERSION;
var CACHE_VERSION = 'v230';
var CACHE_NAME = 'miniCycle-' + CACHE_VERSION + '-v' + APP_VERSION;

var CORE_ASSETS = [
  '/',
  '/miniCycle.html',
  '/miniCycle-styles.css',
  '/miniCycle-scripts.js?v=' + APP_VERSION,
  '/version.js?v=' + APP_VERSION
];

self.addEventListener('install', function(event) {
  console.log('[SW] Installing miniCycle service worker', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activating miniCycle service worker', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        if (key.indexOf('miniCycle-') === 0 && key !== CACHE_NAME) {
          console.log('[SW] Deleting old cache', key);
          return caches.delete(key);
        }
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then(function(response) {
      if (response) {
        return response;
      }

      return fetch(request).then(function(networkResponse) {
        var copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, copy);
        });
        return networkResponse;
      });
    })
  );
});

self.addEventListener('message', function(event) {
  var data = event.data || {};
  if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      version: CACHE_VERSION,
      appVersion: APP_VERSION,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('[SW] miniCycle Service Worker loaded', CACHE_NAME);