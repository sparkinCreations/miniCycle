// ES5-compatible (no const/let, no arrow funcs, no async/await, no optional chaining)
// TEMPORARY: Minimal no-op service worker to disable caching behavior
// while we debug stubborn module caching. Original implementation is
// backed up in `backup/service-worker.js.backup-before-temporary-disable`.

importScripts('./version.js');
var APP_VERSION = self.APP_VERSION;
var CACHE_VERSION = 'v252';

// On install, immediately take control
self.addEventListener('install', function(event) {
  console.log('🔧 [TEMP SW] Installing no-op Service Worker v' + CACHE_VERSION + ' (App v' + APP_VERSION + ')');
  event.waitUntil(self.skipWaiting());
});

// On activate, clear all miniCycle caches and claim clients
self.addEventListener('activate', function(event) {
  console.log('🚀 [TEMP SW] Activating no-op Service Worker v' + CACHE_VERSION + ' (App v' + APP_VERSION + ')');
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k.indexOf('miniCycle-') === 0) {
          console.log('🗑️ [TEMP SW] Deleting cache:', k);
          return caches.delete(k);
        }
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: do nothing, let network (and browser HTTP cache) handle it directly
self.addEventListener('fetch', function(event) {
  // Intentionally no respondWith: this SW does not intercept
  return;
});

// Minimal message handler for version queries
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

console.log('🎯 [TEMP SW] No-op Service Worker script loaded - v' + CACHE_VERSION + ' (App v' + APP_VERSION + ')');