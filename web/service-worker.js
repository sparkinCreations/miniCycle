// ES5-compatible (no const/let, no arrow funcs, no async/await, no optional chaining)
var APP_VERSION = '1.256';
var CACHE_VERSION = 'v49';
var STATIC_CACHE = 'miniCycle-static-' + CACHE_VERSION;
var DYNAMIC_CACHE = 'miniCycle-dynamic-' + CACHE_VERSION;

var CORE = [
  './',
  './assets/images/logo/taskcycle_logo_blackandwhite_transparent.png',
  './assets/images/logo/logo.png',
  './assets/images/logo/app_name.png',
  './assets/images/logo/App_Name_tp_bw.png',
  './assets/images/logo/minicycle_logo_icon.png',
  // ✅ UPDATED: Correct manifest names
  './manifest.json',      // Full version manifest
  './manifest-lite.json'  // Lite version manifest
];

var FULL_SHELL = [
  './miniCycle.html',
  './miniCycle-styles.css',
  './miniCycle-scripts.js',
  // ✅ ADDED: User manual files
  './user-manual.html',
  './user-manual-styles.css'
];

var LITE_SHELL = [
  './miniCycle-lite.html',
  './miniCycle-lite-styles.css',
  './miniCycle-lite-scripts.js'
];

self.addEventListener('install', function (event) {
  console.log('🔧 Service Worker v' + CACHE_VERSION + ' (App v' + APP_VERSION + ') installing...');

  // Build the full pre-cache list once
  var precacheList = CORE.concat(FULL_SHELL, LITE_SHELL);

  function addAllSafe(cache, urls) {
    // 1) Fast path: one shot addAll
    return cache.addAll(urls).then(function () {
      return { ok: urls.length, fail: 0, failed: [] };
    }).catch(function (err) {
      // 2) Slow path: add items one-by-one so one bad URL doesn’t kill install
      console.warn('⚠️ addAll failed, retrying individually:', err);
      var ok = 0, fail = 0, failed = [];

      // Chain sequentially to avoid creating too many requests at once
      var p = Promise.resolve();
      for (var i = 0; i < urls.length; i++) {
        (function (u) {
          p = p.then(function () {
            return cache.add(u).then(function () { ok++; }).catch(function (e) {
              fail++; failed.push({ url: u, error: String(e && e.message || e) });
              console.warn('❌ Failed to cache:', u, e);
            });
          });
        })(urls[i]);
      }
      return p.then(function () { return { ok: ok, fail: fail, failed: failed }; });
    });
  }

  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      console.log('💾 Caching assets…',
        '\n  📦 CORE:', CORE.length,
        '\n  💻 FULL shell:', FULL_SHELL.length,
        '\n  📱 LITE shell:', LITE_SHELL.length
      );
      return addAllSafe(cache, precacheList);
    }).then(function (result) {
      console.log('✅ Precache complete. Cached:', result.ok, ' | Failed:', result.fail);
      if (result.fail > 0) {
        // Optional: keep a tiny manifest in cache you can read later from the page
        try { self._lastPrecacheResult = result; } catch (e) {}
      }
      return self.skipWaiting();
    }).catch(function (error) {
      // If we got here, we couldn’t even open the cache; still don’t leave install hanging
      console.error('❌ Precache error during install:', error);
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  console.log('🚀 Service Worker v' + CACHE_VERSION + ' activated');
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('miniCycle-') === 0 && k !== STATIC_CACHE && k !== DYNAMIC_CACHE) {
          console.log('🗑️ Deleting old cache:', k);
          return caches.delete(k);
        }
      }));
    }).then(function () { 
      console.log('✅ Old caches cleaned');
      return self.clients.claim(); 
    })
  );
});

function fromScope(path) {
  return new URL(path, self.registration.scope).href;
}

function pickShell(urlObj) {
  // Check for explicit mode parameter
  var q = urlObj.searchParams ? urlObj.searchParams.get('mode') : null;
  if (q === 'lite') return 'lite';
  if (q === 'full') return 'full';

  // Check pathname for specific version
  var p = urlObj.pathname || '';
  if (p.indexOf('miniCycle-lite.html') !== -1 || p.indexOf('miniCycle-lite') !== -1) return 'lite';
  if (p.indexOf('miniCycle.html') !== -1 || /\/$|\/index\.html$/.test(p)) return 'full';
  
  // ✅ ADDED: User manual should use full shell
  if (p.indexOf('user-manual.html') !== -1) return 'full';
  
  // Default to full
  return 'full';
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  var accept = (request.headers && request.headers.get('accept')) || '';
  var isNavigate = request.mode === 'navigate' ||
                   (request.destination === '' && accept.indexOf('text/html') !== -1);

  if (isNavigate) {
    event.respondWith(
      // ✅ Network-first for navigation
      fetch(request)
        .then(function (fresh) {
          return caches.open(DYNAMIC_CACHE).then(function (cache) {
            cache.put(request, fresh.clone());
            return fresh;
          });
        })
        .catch(function () {
          // ✅ Offline fallback with smart shell selection
          var shell = pickShell(url);
          return caches.open(STATIC_CACHE).then(function (cache) {
            
            // ✅ Try the correct shell first
            var shellPath = shell === 'lite' ? fromScope('miniCycle-lite.html') 
                                            : fromScope('miniCycle.html');
            return cache.match(shellPath);
            
          }).then(function (fallback) {
            if (fallback) {
              console.log('📱 Offline fallback: serving ' + shell + ' shell');
              return fallback;
            }
            
            // ✅ Last resort: try any available shell
            return caches.open(STATIC_CACHE).then(function (cache) {
              return cache.match(fromScope('miniCycle-lite.html'));
            }).then(function (anyLite) {
              if (anyLite) {
                console.log('📱 Emergency fallback: serving lite shell');
                return anyLite;
              }
              return caches.open(STATIC_CACHE).then(function (cache) {
                return cache.match(fromScope('miniCycle.html'));
              }).then(function (anyFull) {
                if (anyFull) {
                  console.log('💻 Emergency fallback: serving full shell');
                  return anyFull;
                }
                console.log('❌ No offline fallback available');
                return new Response('Offline - No cached version available', { 
                  status: 503, 
                  statusText: 'Offline' 
                });
              });
            });
          });
        })
    );
    return;
  }

  // ✅ Static assets: cache-first
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) {
        // console.log('💾 Cache hit:', request.url);
        return cached;
      }
      
      return fetch(request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          return caches.open(DYNAMIC_CACHE).then(function (cache) {
            cache.put(request, res.clone());
            console.log('📦 Cached new asset:', request.url);
            return res;
          });
        }
        return res;
      }).catch(function (error) {
        console.warn('❌ Fetch failed for:', request.url, error);
        return caches.match(request).then(function (c) {
          return c || new Response('', { 
            status: 504, 
            statusText: 'Gateway Timeout' 
          });
        });
      });
    })
  );
});

// ✅ Message handler
self.addEventListener('message', function (event) {
  var data = event.data || {};
  console.log('📨 Service Worker received message:', data);
  
  if (data.type === 'SKIP_WAITING') {
    console.log('⏭️ Skipping waiting...');
    self.skipWaiting();
  }
  
  if (data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ 
        version: CACHE_VERSION, 
        appVersion: APP_VERSION,
        timestamp: new Date().toISOString(),
        caches: {
          static: STATIC_CACHE,
          dynamic: DYNAMIC_CACHE
        }
      });
    }
  }
  
  // ✅ ADDED: Cache status reporting
  if (data.type === 'GET_CACHE_STATUS') {
    if (event.ports && event.ports[0]) {
      caches.keys().then(function (cacheNames) {
        var miniCycleCaches = cacheNames.filter(function (name) {
          return name.indexOf('miniCycle-') === 0;
        });
        
        Promise.all(miniCycleCaches.map(function (cacheName) {
          return caches.open(cacheName).then(function (cache) {
            return cache.keys().then(function (keys) {
              return {
                name: cacheName,
                size: keys.length,
                urls: keys.map(function (req) { return req.url; })
              };
            });
          });
        })).then(function (cacheInfo) {
          event.ports[0].postMessage({
            version: CACHE_VERSION,
            appVersion: APP_VERSION,
            caches: cacheInfo,
            timestamp: new Date().toISOString()
          });
        });
      });
    }
  }
});

// ✅ ADDED: Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function (event) {
  console.error('🚨 Unhandled promise rejection in Service Worker:', event.reason);
  event.preventDefault();
});

// ✅ ADDED: Handle errors
self.addEventListener('error', function (event) {
  console.error('🚨 Service Worker error:', event.error);
});

console.log('🎯 Service Worker script loaded - v' + CACHE_VERSION + ' (App v' + APP_VERSION + ')');