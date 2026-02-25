// ES5-compatible (no const/let, no arrow funcs, no async/await, no optional chaining)
// ✅ Version constants inlined directly (updated by update-version.sh)
// This ensures the SW always has correct version info without HTTP cache issues
var APP_VERSION = '2.011';
var CACHE_VERSION = 'v850';
var STATIC_CACHE = 'miniCycle-static-' + CACHE_VERSION;
var DYNAMIC_CACHE = 'miniCycle-dynamic-' + CACHE_VERSION;

// ✅ Service worker caching for offline support and faster loading
// Version mismatch issues resolved via boot failsafe + forced cache clear on version change
var DISABLE_CACHING = false;

// ✅ Cache expiration configuration
var MAX_DYNAMIC_ENTRIES = 300;  // Maximum entries in dynamic cache (app has 100+ modules)
var MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// ✅ iOS OPTIMIZATION: Minimal network-first patterns for faster offline startup
// Boot-critical files need network-first to prevent version mismatch errors
// This prevents stale-while-revalidate from serving old cached modules
var NETWORK_FIRST_PATTERNS = [
  'version.js',                  // Version source of truth - MUST be fresh
  'miniCycle-main.js',           // Entry point
  'modules/boot/',               // All boot files - version critical
  'modules/core/',               // Core modules (diBase, appInit, appState) - statically imported
  'modules/utils/',              // Utility modules (storageUtils, etc.) - statically imported
  'modules/recurring/'           // Recurring modules - complex DI interdependencies, must be in sync
  // Note: modules/core/, modules/utils/, and modules/recurring/ use network-first because these
  // files have complex interdependencies. Without network-first, stale cached versions can cause
  // DI wiring failures like "missing required deps" errors when module interfaces change.
  // Other modules use version mismatch detection (see fetch handler) which automatically uses
  // network-first when ?v= param doesn't match SW version.
];

// ============================================================================
// PRECACHE LISTS - Optimized for iOS PWA performance
// ============================================================================

// Core assets needed for basic app shell
var CORE = [
  './',
  './manifest.json',
  './manifest-lite.json',
  // Essential images
  './assets/images/pattern.svg',
  './assets/images/logo/minicycle_logo_icon.png',
  './assets/images/logo/logo.png',
  // Self-hosted fonts
  './assets/fonts/fonts.css',
  './assets/fonts/poppins-300.woff2',
  './assets/fonts/poppins-400.woff2',
  './assets/fonts/poppins-500.woff2',
  './assets/fonts/poppins-600.woff2'
];

// Boot-critical files - MUST be precached for instant startup
var BOOT_CRITICAL = [
  // HTML shells
  './miniCycle.html',
  // Version file - required for app to boot
  './version.js',
  // Main CSS - required for app to display correctly offline
  './styles/main.css',
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
  './modules/core/dataAccess.js',
  './modules/core/types.js',
  // Utils - ALL utility modules
  './modules/utils/globalUtils.js',
  './modules/utils/errorHandler.js',
  './modules/utils/notifications.js',
  './modules/utils/deviceDetection.js',
  './modules/utils/consoleCapture.js',
  './modules/utils/dataSanitizer.js',
  './modules/utils/dataValidator.js',
  './modules/utils/debugMode.js',
  './modules/utils/iconInit.js',
  './modules/utils/icons.js',
  './modules/utils/nameUtils.js',
  './modules/utils/storageUtils.js',
  // Task modules - ALL task functionality
  './modules/task/taskCore.js',
  './modules/task/taskDOM.js',
  './modules/task/taskRenderer.js',
  './modules/task/taskEvents.js',
  './modules/task/taskUtils.js',
  './modules/task/taskValidation.js',
  './modules/task/dragDropManager.js',
  './modules/task/taskButtons.js',
  './modules/task/taskCompletion.js',
  './modules/task/taskCRUD.js',
  './modules/task/taskCycleReset.js',
  './modules/task/taskDOMPatch.js',
  // Routine modules
  './modules/routine/routineLoader.js',
  './modules/routine/routineManager.js',
  './modules/routine/routineSwitcher.js',
  './modules/routine/modeManager.js',
  './modules/routine/migrationManager.js',
  // UI modules
  './modules/ui/modalManager.js',
  './modules/ui/menuManager.js',
  './modules/ui/settingsManager.js',
  './modules/ui/settingsUIManager.js',
  './modules/ui/titleManager.js',
  './modules/ui/taskUI.js',
  './modules/ui/gesturePanelManager.js',
  './modules/ui/completedTasksManager.js',
  './modules/ui/uiEffects.js',
  // Features
  './modules/features/themeManager.js',
  './modules/features/statsPanel.js',
  './modules/features/achievementsManager.js',
  './modules/features/dueDates.js',
  './modules/features/reminders.js',
  // Progress
  './modules/progress/cycleCompletion.js',
  // Recurring - ALL modules (required for offline)
  './modules/recurring/recurringCore.js',
  './modules/recurring/recurringActivation.js',
  './modules/recurring/recurringCalculators.js',
  './modules/recurring/recurringDateUtils.js',
  './modules/recurring/recurringIntegration.js',
  './modules/recurring/recurringMatcher.js',
  './modules/recurring/recurringPanel.js',
  './modules/recurring/recurringPanelEvents.js',
  './modules/recurring/recurringPanelForm.js',
  './modules/recurring/recurringPanelGrids.js',
  './modules/recurring/recurringPanelSetup.js',
  './modules/recurring/recurringPanelSummary.js',
  './modules/recurring/recurringSettings.js',
  './modules/recurring/recurringSettingsApplicator.js',
  './modules/recurring/recurringWatcher.js',
  // UI - remaining modules
  './modules/ui/backupRestoreManager.js',
  './modules/ui/cycleExportManager.js',
  './modules/ui/cycleImportManager.js',
  './modules/ui/gamesManager.js',
  './modules/ui/helpWindowManager.js',
  './modules/ui/onboardingManager.js',
  './modules/ui/preferencesManager.js',
  './modules/ui/pullToRefresh.js',
  './modules/ui/taskInteractions.js',
  './modules/ui/taskOptionsCustomizer.js',
  './modules/ui/taskSearch.js',
  './modules/ui/uiOrchestrator.js',
  './modules/ui/undoRedoManager.js',
  // Features - remaining
  './modules/features/clearedTasksManager.js',
  './modules/features/historyManager.js',
  // Storage
  './modules/storage/backupManager.js'
];

// CSS files - all @imports from main.css (required for offline styling)
var CSS_FILES = [
  './styles/base/variables.css',
  './styles/base/reset.css',
  './styles/base/background.css',
  './styles/base/typography.css',
  './styles/base/animations.css',
  './styles/base/accessibility.css',
  './styles/layout/app-container.css',
  './styles/layout/header.css',
  './styles/layout/safe-areas.css',
  './styles/components/task-input.css',
  './styles/components/task-list.css',
  './styles/components/task-options.css',
  './styles/components/buttons.css',
  './styles/components/icons.css',
  './styles/components/modals.css',
  './styles/components/notifications.css',
  './styles/components/stats-panel.css',
  './styles/components/progress-bar.css',
  './styles/components/forms.css',
  './styles/components/settings.css',
  './styles/components/mode-selector.css',
  './styles/components/routine-switcher.css',
  './styles/components/games.css',
  './styles/components/onboarding.css',
  './styles/components/recurring.css',
  './styles/components/storage.css',
  './styles/components/footer.css',
  './styles/components/menu.css',
  './styles/utilities/helpers.css',
  './styles/utilities/responsive.css',
  './styles/utilities/dark-mode.css'
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

  if (DISABLE_CACHING) {
    console.log('🚫 Caching disabled - skipping precache');
    event.waitUntil(self.skipWaiting());
    return;
  }

  // Build the full pre-cache list - includes CSS for offline support
  var precacheList = CORE.concat(BOOT_CRITICAL, CSS_FILES, LITE_SHELL);

  function addAllSafe(cache, urls) {
    // 1) Fast path: one shot addAll
    return cache.addAll(urls).then(function () {
      return { ok: urls.length, fail: 0, failed: [] };
    }).catch(function (err) {
      // 2) Slow path: add items one-by-one so one bad URL doesn't kill install
      console.warn('⚠️ addAll failed, retrying individually:', err);
      var ok = 0, fail = 0, failed = [];

      // Cache in parallel batches for better performance
      var BATCH_SIZE = 10;
      var p = Promise.resolve();
      for (var b = 0; b < urls.length; b += BATCH_SIZE) {
        (function (batch) {
          p = p.then(function () {
            return Promise.all(batch.map(function (u) {
              return cache.add(u).then(function () { ok++; }).catch(function (e) {
                fail++; failed.push({ url: u, error: String(e && e.message || e) });
                console.warn('❌ Failed to cache:', u, e);
              });
            }));
          });
        })(urls.slice(b, b + BATCH_SIZE));
      }
      return p.then(function () { return { ok: ok, fail: fail, failed: failed }; });
    });
  }

  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      console.log('💾 Caching assets for offline support…',
        '\n  📦 CORE:', CORE.length,
        '\n  🚀 BOOT_CRITICAL:', BOOT_CRITICAL.length,
        '\n  🎨 CSS_FILES:', CSS_FILES.length,
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
          if (DISABLE_CACHING) {
            console.log('🗑️ Deleting cache (online-only):', k);
            return caches.delete(k);
          }
          if (k.indexOf('miniCycle-') === 0 && k !== STATIC_CACHE && k !== DYNAMIC_CACHE) {
            console.log('🗑️ Deleting old cache:', k);
            return caches.delete(k);
          }
        }));
      })
    ]).then(function () {
      console.log('✅ Old caches cleaned');
      // ✅ Clean expired entries and trim cache on activation
      if (!DISABLE_CACHING) {
        cleanExpiredEntries();
        trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
      }
      return self.clients.claim();
    })
  );
});

function fromScope(path) {
  return new URL(path, self.registration.scope).href;
}

/**
 * ✅ iOS FIX: Fetch with timeout to prevent hanging on slow/flaky connections
 * iOS Safari can hang indefinitely on fetch - this adds a 10s timeout
 */
var FETCH_TIMEOUT_MS = 10000; // 10 seconds

function fetchWithTimeout(request, timeoutMs) {
  timeoutMs = timeoutMs || FETCH_TIMEOUT_MS;

  return new Promise(function(resolve, reject) {
    var timeoutId = setTimeout(function() {
      reject(new Error('Fetch timeout after ' + timeoutMs + 'ms'));
    }, timeoutMs);

    fetch(request).then(function(response) {
      clearTimeout(timeoutId);
      resolve(response);
    }).catch(function(error) {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Check if a URL should use network-first strategy
 * Boot-critical files need fresh loads to avoid version mismatches
 */
function isNetworkFirstFile(urlPath) {
  for (var i = 0; i < NETWORK_FIRST_PATTERNS.length; i++) {
    var pattern = NETWORK_FIRST_PATTERNS[i];
    var idx = urlPath.indexOf(pattern);
    // Ensure match is at a path boundary (not a substring of another filename)
    if (idx !== -1 && (idx === 0 || urlPath.charAt(idx - 1) === '/')) {
      return true;
    }
  }
  return false;
}

/**
 * Trim cache to prevent unbounded growth (LRU-style)
 * Removes oldest entries when cache exceeds MAX_DYNAMIC_ENTRIES
 * ✅ iOS FIX: Uses iterative approach instead of recursion to prevent stack overflow
 * ✅ DEBOUNCED: Only runs every 10 seconds max to prevent console spam
 * @param {string} cacheName - Name of the cache to trim
 * @param {number} maxEntries - Maximum number of entries to keep
 */
var _trimCacheTimeout = null;
var _trimCachePending = false;

function trimCache(cacheName, maxEntries) {
  // Debounce: schedule trim for later if not already pending
  if (_trimCachePending) return;
  _trimCachePending = true;

  // Clear any existing timeout and set new one
  if (_trimCacheTimeout) clearTimeout(_trimCacheTimeout);
  _trimCacheTimeout = setTimeout(function() {
    _trimCachePending = false;
    _trimCacheTimeout = null;

    caches.open(cacheName).then(function(cache) {
      cache.keys().then(function(keys) {
        if (keys.length > maxEntries) {
          var deleteCount = keys.length - maxEntries;
          var toDelete = keys.slice(0, deleteCount);
          console.log('🗑️ Trimming cache: removing', deleteCount, 'entries (total:', keys.length, ')');

          // Delete all excess entries (iterative, not recursive)
          Promise.all(toDelete.map(function(key) {
            return cache.delete(key);
          })).then(function() {
            console.log('✅ Cache trimmed successfully');
          });
        }
      });
    });
  }, 10000); // Wait 10 seconds before trimming
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
                }).catch(function(e) { console.warn('Cache delete error:', e); });
              }
            }
          }
        }).catch(function(e) { console.warn('Cache match error:', e); });
      });
    }).catch(function(e) { console.warn('Cache keys error:', e); });
  }).catch(function(e) { console.warn('Cache open error:', e); });
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

  if (DISABLE_CACHING) {
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })));
    return;
  }

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
          // ✅ iOS FIX: Use timeout to prevent hanging on slow connections
          return fetchWithTimeout(request, FETCH_TIMEOUT_MS);
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

    // ✅ VERSION MISMATCH DETECTION:
    var requestVersion = url.searchParams.get('v');
    var versionMismatch = requestVersion && requestVersion !== APP_VERSION;
    var isModuleFile = url.pathname.indexOf('/modules/') !== -1;
    var staticImportWithoutVersion = isModuleFile && !requestVersion;

    if (versionMismatch) {
      console.log('⚠️ Version mismatch detected:', requestVersion, '→', APP_VERSION, url.pathname);
    }
    if (staticImportWithoutVersion) {
      console.log('📦 Static import (no version):', url.pathname, '- using network-first');
    }

    // ✅ HYBRID STRATEGY: Network-first for boot-critical, version mismatch, OR static module imports
    var needsNetworkFirst = isNetworkFirstFile(url.pathname) || versionMismatch || staticImportWithoutVersion;

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

      // ✅ iOS FIX: Use fetchWithTimeout to prevent hanging
      event.respondWith(
        fetchWithTimeout(freshRequest, FETCH_TIMEOUT_MS)
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
              if (cached) return cached;
              // Return a response that will cause the import to fail with a clear error
              // rather than silently returning an empty module
              console.error('❌ Module not in cache and network failed:', request.url);
              var safePath = url.pathname.replace(/[\\'"<>]/g, '');
              return new Response('throw new Error("Module not available offline: ' + safePath + '");', {
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
            if (res) return res;
            // Return a response that will cause the import to fail with a clear error
            console.error('❌ Module not in cache and network failed:', request.url);
            return new Response('throw new Error("Module not available offline: ' + url.pathname + '");', {
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
