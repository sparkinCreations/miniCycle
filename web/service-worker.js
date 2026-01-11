// ES5-compatible (no const/let, no arrow funcs, no async/await, no optional chaining)
// ✅ Import version from centralized version.js file
importScripts('./version.js');
var APP_VERSION = self.APP_VERSION;   // For URL cache-busting (?v=1.598)
var CACHE_VERSION = 'v' + self.CACHE_VERSION; // For cache naming (v391)
var STATIC_CACHE = 'miniCycle-static-' + CACHE_VERSION;
var DYNAMIC_CACHE = 'miniCycle-dynamic-' + CACHE_VERSION;

// ✅ Cache expiration configuration
var MAX_DYNAMIC_ENTRIES = 100;  // Maximum entries in dynamic cache
var MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// ✅ Boot-critical files that must always be network-first
// These modules have tight interdependencies - serving stale versions breaks iOS PWA
var NETWORK_FIRST_PATTERNS = [
  'miniCycle-main.js',     // Entry point
  '/modules/boot/',        // Boot chain (orchestrator, coreBoot, etc.)
  '/modules/core/',        // Core modules (diBase, constants, appState)
  '/modules/utils/',       // Utilities (globalUtils, errorHandler)
  'gesturePanelManager',   // Swipe gestures
  'statsPanel',            // Stats panel (swipe target)
  '/styles/'               // CSS files (imported via @import, need fresh versions)
];

// ============================================================================
// PRECACHE LISTS - Optimized for iOS PWA performance
// ============================================================================

// Core assets needed for basic app shell
var CORE = [
  './',
  './manifest.json',
  './manifest-lite.json',
  // Essential logos only
  './assets/images/logo/minicycle_logo_icon.png',
  './assets/images/logo/logo.png'
];

// Boot-critical files - MUST be precached for instant startup
var BOOT_CRITICAL = [
  // HTML shells
  './miniCycle.html',
  // Modular CSS (entry point + critical files for instant styling)
  './styles/main.css',
  './styles/base/variables.css',
  './styles/base/reset.css',
  './styles/layout/app-container.css',
  './styles/layout/header.css',
  './styles/components/task-list.css',
  // Entrypoint and boot chain
  './miniCycle-main.js',
  './modules/boot/orchestrator.js',
  './modules/boot/coreBoot.js',
  './modules/boot/featureBoot.js',
  './modules/boot/uiBoot.js',
  './modules/boot/moduleLoader.js',
  './modules/boot/moduleManifests.js',
  // Core foundation (Phase 1 dependencies)
  './modules/core/appState.js',
  './modules/core/appInit.js',
  './modules/core/diBase.js',
  './modules/core/constants.js',
  './modules/core/appContext.js',
  './modules/core/appGlobalState.js',
  './modules/core/migrationFacade.js',
  // Essential utils for boot
  './modules/utils/globalUtils.js',
  './modules/utils/errorHandler.js',
  './modules/utils/notifications.js'
];

// Lite version shell (smaller precache)
var LITE_SHELL = [
  './lite/miniCycle-lite.html',
  './lite/miniCycle-lite-styles.css',
  './lite/miniCycle-lite-scripts.js'
];

// Secondary files - will be lazy-cached on first use via stale-while-revalidate
// NOT precached to keep install fast on iOS
var LAZY_CACHE_ON_USE = [
  // User manual (in legal/ subdirectory)
  './legal/user-manual.html',
  './legal/user-manual-styles.css',
  // Additional logos
  './assets/images/logo/taskcycle_logo_blackandwhite_transparent.png',
  './assets/images/logo/app_name.png',
  './assets/images/logo/App_Name_tp_bw.png'
  // All other modules will be cached on first use automatically
];

self.addEventListener('install', function (event) {
  console.log('🔧 Service Worker ' + CACHE_VERSION + ' (App v' + APP_VERSION + ') installing...');

  // Build the full pre-cache list - boot-critical files only for fast iOS install
  var precacheList = CORE.concat(BOOT_CRITICAL, LITE_SHELL);

  function addAllSafe(cache, urls) {
    // 1) Fast path: one shot addAll
    return cache.addAll(urls).then(function () {
      return { ok: urls.length, fail: 0, failed: [] };
    }).catch(function (err) {
      // 2) Slow path: add items one-by-one so one bad URL doesn't kill install
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
      console.log('💾 Caching boot-critical assets…',
        '\n  📦 CORE:', CORE.length,
        '\n  🚀 BOOT_CRITICAL:', BOOT_CRITICAL.length,
        '\n  📱 LITE shell:', LITE_SHELL.length,
        '\n  📊 Total:', precacheList.length
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
      // If we got here, we couldn't even open the cache; still don't leave install hanging
      console.error('❌ Precache error during install:', error);
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  console.log('🚀 Service Worker ' + CACHE_VERSION + ' activated');
  event.waitUntil(
    Promise.all([
      // ✅ Enable navigation preload for faster page loads
      // Starts network request while SW boots, saving ~50-100ms on mobile
      (self.registration.navigationPreload ?
        self.registration.navigationPreload.enable().then(function() {
          console.log('✅ Navigation preload enabled');
        }).catch(function(err) {
          console.warn('⚠️ Navigation preload not supported:', err);
        }) : Promise.resolve()),

      // Clean old caches
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) {
          if (k.indexOf('miniCycle-') === 0 && k !== STATIC_CACHE && k !== DYNAMIC_CACHE) {
            console.log('🗑️ Deleting old cache:', k);
            return caches.delete(k);
          }
        }));
      })
    ]).then(function () {
      console.log('✅ Old caches cleaned');
      // ✅ Clean expired entries and trim cache on activation
      cleanExpiredEntries();
      trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
      return self.clients.claim();
    })
  );
});

function fromScope(path) {
  return new URL(path, self.registration.scope).href;
}

/**
 * Check if a URL should use network-first strategy
 * Boot-critical files need fresh loads to avoid version mismatches
 */
function isNetworkFirstFile(urlPath) {
  for (var i = 0; i < NETWORK_FIRST_PATTERNS.length; i++) {
    if (urlPath.indexOf(NETWORK_FIRST_PATTERNS[i]) !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * Trim cache to prevent unbounded growth (LRU-style)
 * Removes oldest entries when cache exceeds MAX_DYNAMIC_ENTRIES
 * @param {string} cacheName - Name of the cache to trim
 * @param {number} maxEntries - Maximum number of entries to keep
 */
function trimCache(cacheName, maxEntries) {
  caches.open(cacheName).then(function(cache) {
    cache.keys().then(function(keys) {
      if (keys.length > maxEntries) {
        // Delete oldest entry (first in list)
        cache.delete(keys[0]).then(function() {
          console.log('🗑️ Trimmed cache entry:', keys[0].url);
          // Recursively trim until under limit
          if (keys.length - 1 > maxEntries) {
            trimCache(cacheName, maxEntries);
          }
        });
      }
    });
  });
}

/**
 * Clean expired entries from cache (older than MAX_CACHE_AGE_MS)
 * Called periodically during activate and fetch events
 */
function cleanExpiredEntries() {
  var now = Date.now();
  caches.open(DYNAMIC_CACHE).then(function(cache) {
    cache.keys().then(function(requests) {
      requests.forEach(function(request) {
        cache.match(request).then(function(response) {
          if (response) {
            var dateHeader = response.headers.get('date');
            if (dateHeader) {
              var cacheTime = new Date(dateHeader).getTime();
              if (now - cacheTime > MAX_CACHE_AGE_MS) {
                cache.delete(request).then(function() {
                  console.log('🗑️ Expired cache entry removed:', request.url);
                });
              }
            }
          }
        });
      });
    });
  });
}

function pickShell(urlObj) {
  // Check for explicit mode parameter
  var q = urlObj.searchParams ? urlObj.searchParams.get('mode') : null;
  if (q === 'lite') return 'lite';
  if (q === 'full') return 'full';

  // Check pathname for specific version
  var p = urlObj.pathname || '';
  // Lite version (now in /lite/ subdirectory)
  if (p.indexOf('/lite/') !== -1 || p.indexOf('miniCycle-lite') !== -1) return 'lite';
  // Full version
  if (p.indexOf('miniCycle.html') !== -1 || /\/$|\/index\.html$/.test(p)) return 'full';
  // User manual (in /legal/ subdirectory) uses full shell
  if (p.indexOf('/legal/') !== -1 || p.indexOf('user-manual') !== -1) return 'full';

  // Default to full
  return 'full';
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);

  // ✅ FIXED: Skip unsupported schemes (browser extensions, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return; // Let the browser handle extension requests, data URLs, etc.
  }

  // ✅ BYPASS: Always fetch fresh for test files (network-only, no cache)
  if (url.pathname.indexOf('/tests/') !== -1) {
    event.respondWith(fetch(request));
    return;
  }

  var accept = (request.headers && request.headers.get('accept')) || '';
  var isNavigate = request.mode === 'navigate' ||
                   (request.destination === '' && accept.indexOf('text/html') !== -1);

  if (isNavigate) {
    event.respondWith(
      // ✅ Use navigation preload if available (saves ~50-100ms on mobile)
      // Falls back to regular fetch if preload not supported
      (event.preloadResponse || Promise.resolve(null))
        .then(function (preloadResponse) {
          if (preloadResponse) {
            console.log('⚡ Using navigation preload response');
            return preloadResponse;
          }
          return fetch(request);
        })
        .then(function (fresh) {
          return caches.open(DYNAMIC_CACHE).then(function (cache) {
            // ✅ ADDED: Safe cache.put for navigation requests
            return cache.put(request, fresh.clone()).then(function() {
              // ✅ Trim cache after adding new entry
              trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
              return fresh;
            }).catch(function(cacheError) {
              console.warn('⚠️ Navigation cache put failed for:', request.url, cacheError);
              return fresh; // Return response even if caching fails
            });
          });
        })
        .catch(function () {
          // ✅ Offline fallback with smart shell selection
          var shell = pickShell(url);
          return caches.open(STATIC_CACHE).then(function (cache) {

            // ✅ Try the correct shell first
            var shellPath = shell === 'lite' ? fromScope('lite/miniCycle-lite.html')
                                            : fromScope('miniCycle.html');
            return cache.match(shellPath);

          }).then(function (fallback) {
            if (fallback) {
              console.log('📱 Offline fallback: serving ' + shell + ' shell');
              return fallback;
            }

            // ✅ Last resort: try any available shell
            return caches.open(STATIC_CACHE).then(function (cache) {
              return cache.match(fromScope('lite/miniCycle-lite.html'));
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

  // ✅ Detect if this is a JS/CSS file
  var isScriptOrStyle = url.pathname.endsWith('.js') ||
                        url.pathname.endsWith('.css') ||
                        url.pathname.endsWith('.mjs');

  if (isScriptOrStyle) {
    // ✅ AUTO-VERSION: Append version parameter to JS/CSS requests for cache-busting
    var fetchUrl = new URL(request.url);
    if (!fetchUrl.searchParams.has('v') && fetchUrl.pathname.endsWith('.js')) {
      fetchUrl.searchParams.set('v', APP_VERSION);
    }

    // ✅ Create normalized cache key (strip version param for consistent caching)
    var cacheUrl = new URL(request.url);
    cacheUrl.searchParams.delete('v');
    var cacheRequest = new Request(cacheUrl.href);

    // ✅ HYBRID STRATEGY: Network-first for boot-critical, stale-while-revalidate for rest
    var needsNetworkFirst = isNetworkFirstFile(url.pathname);

    if (needsNetworkFirst) {
      // ═══════════════════════════════════════════════════════════════════
      // NETWORK-FIRST: Boot-critical files must always load fresh
      // Prevents version mismatches that break gestures, loading bar, etc.
      // ═══════════════════════════════════════════════════════════════════
      var freshRequest = new Request(fetchUrl.href, {
        method: 'GET',
        headers: request.headers,
        mode: request.mode,
        credentials: request.credentials,
        cache: 'no-cache'
      });

      event.respondWith(
        fetch(freshRequest)
          .then(function (res) {
            if (res && res.status === 200) {
              return caches.open(DYNAMIC_CACHE).then(function (cache) {
                return cache.put(cacheRequest, res.clone()).then(function() {
                  trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
                  return res;
                }).catch(function(cacheError) {
                  console.warn('⚠️ Cache put failed for:', request.url, cacheError);
                  return res;
                });
              });
            }
            return res;
          })
          .catch(function (error) {
            console.warn('❌ Network failed for boot-critical file, trying cache:', request.url);
            return caches.match(cacheRequest).then(function (cached) {
              return cached || new Response('// Offline - file not cached', {
                status: 504,
                statusText: 'Gateway Timeout',
                headers: { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' }
              });
            });
          })
      );
    } else {
      // ═══════════════════════════════════════════════════════════════════
      // STALE-WHILE-REVALIDATE: Non-critical files for faster repeat loads
      // Serves cached version instantly, updates in background
      // ═══════════════════════════════════════════════════════════════════
      event.respondWith(
        caches.match(cacheRequest).then(function (cached) {
          var freshRequest = new Request(fetchUrl.href, {
            method: 'GET',
            headers: request.headers,
            mode: request.mode,
            credentials: request.credentials,
            cache: 'no-cache'
          });

          // Background fetch to update cache
          var fetchPromise = fetch(freshRequest).then(function (res) {
            if (res && res.status === 200) {
              return caches.open(DYNAMIC_CACHE).then(function (cache) {
                return cache.put(cacheRequest, res.clone()).then(function() {
                  trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
                  return res;
                }).catch(function() { return res; });
              });
            }
            return res;
          }).catch(function () { return null; });

          // Return cached immediately if available
          if (cached) {
            return cached;
          }

          // No cache - wait for network
          return fetchPromise.then(function (res) {
            return res || new Response('// Offline - file not cached', {
              status: 504,
              statusText: 'Gateway Timeout',
              headers: { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' }
            });
          });
        })
      );
    }
  } else {
    // ✅ CACHE-FIRST for images and other static assets
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) {
          // console.log('💾 Cache hit:', request.url);
          return cached;
        }

        return fetch(request).then(function (res) {
          if (res && res.status === 200 && res.type === 'basic') {
            return caches.open(DYNAMIC_CACHE).then(function (cache) {
              return cache.put(request, res.clone()).then(function() {
                console.log('📦 Cached new asset:', request.url);
                // ✅ Trim cache after adding new entry
                trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
                return res;
              }).catch(function(cacheError) {
                console.warn('⚠️ Cache put failed for:', request.url, cacheError);
                return res;
              });
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
  }
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

console.log('🎯 Service Worker script loaded - ' + CACHE_VERSION + ' (App v' + APP_VERSION + ')');
