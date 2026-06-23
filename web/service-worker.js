// ES5-compatible (no const/let, no arrow funcs, no async/await, no optional chaining)
// ✅ Version constants inlined directly (updated by update-version.sh)
// This ensures the SW always has correct version info without HTTP cache issues
var APP_VERSION = '2.249';
var CACHE_VERSION = 'v1092';
var CACHE_VERSION_NUMBER = 1092; // Numeric version matching version.js (for synthetic fallback)
var STATIC_CACHE = 'miniCycle-static-' + CACHE_VERSION;
var DYNAMIC_CACHE = 'miniCycle-dynamic-' + CACHE_VERSION;

// ✅ Service worker caching for offline support and faster loading
// Version mismatch issues resolved via boot failsafe + forced cache clear on version change
var DISABLE_CACHING = false;

// ✅ Cache expiration configuration
var MAX_DYNAMIC_ENTRIES = 300;  // Maximum entries in dynamic cache (app has 100+ modules)
var MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// ✅ iOS OPTIMIZATION: Minimal network-first patterns for faster offline startup
// ============================================================================
// NETWORK-FIRST STRATEGY — History & Current Approach
// ============================================================================
// Previously, a NETWORK_FIRST_PATTERNS array listed path prefixes (version.js,
// modules/boot/, modules/core/, modules/utils/, modules/recurring/, styles/)
// that should always use network-first fetching. An isNetworkFirstFile() helper
// checked URLs against those patterns.
//
// This was replaced by the HYBRID STRATEGY in the fetch handler (see line ~660):
//   var needsNetworkFirst = versionMismatch;
//
// Now, network-first is triggered ONLY when a request's ?v= param doesn't match
// APP_VERSION — an actual version mismatch. All other requests (including CSS,
// boot files, and static imports with no ?v=) use stale-while-revalidate for
// instant cache serving. This change was critical for offline boot on iOS:
//
// - iOS kills the PWA's service worker when backgrounded. When the user reopens
//   offline, navigator.onLine can lie (return true). Pattern-based network-first
//   would send 100+ files through 3-10s network timeouts before falling back to
//   cache, exceeding the 20s boot timeout.
//
// - With the hybrid approach, files only hit the network when there's a genuine
//   version mismatch. Same-version and unversioned requests serve instantly from
//   cache. Precaching ensures all files are current after each SW activation,
//   so stale content during normal operation is not a concern.
//
// The old pattern-based approach and isNetworkFirstFile() were removed in v2.057
// because they were dead code — never called by the fetch handler.
// ============================================================================

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
  // Loading tips (shown during boot splash)
  './modules/labels/loading-tips.json',
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
  './modules/boot/modalTemplates.js',
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
  './modules/utils/keyboardNav.js',
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
  './modules/ui/modalRegistry.js',
  './modules/ui/menuManager.js',
  './modules/ui/settingsManager.js',
  './modules/ui/settingsUIManager.js',
  './modules/ui/titleManager.js',
  './modules/ui/taskUI.js',
  './modules/ui/gesturePanelManager.js',
  './modules/ui/completedTasksManager.js',
  './modules/ui/uiEffects.js',
  './modules/ui/focusMode.js',
  './modules/ui/quickActionsManager.js',
  './modules/ui/preferencesBgImage.js',
  './modules/ui/preferencesPresets.js',
  // Features
  './modules/features/themeManager.js',
  './modules/features/statsPanel.js',
  './modules/features/achievementsManager.js',
  './modules/features/dueDates.js',
  './modules/features/reminders.js',
  // Progress
  './modules/progress/cycleCompletion.js',
  // Recurring - ALL modules (required for offline)
  './modules/recurring/recurringBoot.js',
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
  './modules/ui/panelVisibilityHelpers.js',
  './modules/ui/notificationDialogHost.js',
  // Features - remaining
  './modules/features/clearedTasksManager.js',
  './modules/features/historyManager.js',
  // Storage
  './modules/storage/backupManager.js',
  // Labels - statically imported by boot modules, required for offline
  './modules/labels/labelResolver.js',
  './modules/labels/defaultLabels.js',
  './modules/labels/themes.js'
];

// CSS files - all @imports from main.css (required for offline styling)
// ✅ Versioned with APP_VERSION for cache busting (matches main.css ?v= params)
var CSS_FILES = [
  './styles/base/critical.css?v=' + APP_VERSION,
  './styles/base/variables.css?v=' + APP_VERSION,
  './styles/themes/themes.css?v=' + APP_VERSION,
  './styles/base/reset.css?v=' + APP_VERSION,
  './styles/base/background.css?v=' + APP_VERSION,
  './styles/base/typography.css?v=' + APP_VERSION,
  './styles/base/animations.css?v=' + APP_VERSION,
  './styles/base/accessibility.css?v=' + APP_VERSION,
  './styles/layout/app-container.css?v=' + APP_VERSION,
  './styles/layout/header.css?v=' + APP_VERSION,
  './styles/layout/safe-areas.css?v=' + APP_VERSION,
  './styles/components/task-input.css?v=' + APP_VERSION,
  './styles/components/task-list.css?v=' + APP_VERSION,
  './styles/components/task-options.css?v=' + APP_VERSION,
  './styles/components/buttons.css?v=' + APP_VERSION,
  './styles/components/icons.css?v=' + APP_VERSION,
  './styles/components/modals.css?v=' + APP_VERSION,
  './styles/components/themes-modal.css?v=' + APP_VERSION,
  './styles/components/notifications.css?v=' + APP_VERSION,
  './styles/components/stats-panel.css?v=' + APP_VERSION,
  './styles/components/progress-bar.css?v=' + APP_VERSION,
  './styles/components/forms.css?v=' + APP_VERSION,
  './styles/components/settings.css?v=' + APP_VERSION,
  './styles/components/mode-selector.css?v=' + APP_VERSION,
  './styles/components/routine-switcher.css?v=' + APP_VERSION,
  './styles/components/games.css?v=' + APP_VERSION,
  './styles/components/onboarding.css?v=' + APP_VERSION,
  './styles/components/focus-mode.css?v=' + APP_VERSION,
  './styles/components/recurring.css?v=' + APP_VERSION,
  './styles/components/storage.css?v=' + APP_VERSION,
  './styles/components/testing.css?v=' + APP_VERSION,
  './styles/components/footer.css?v=' + APP_VERSION,
  './styles/components/menu.css?v=' + APP_VERSION,
  './styles/components/quick-actions.css?v=' + APP_VERSION,
  './styles/utilities/helpers.css?v=' + APP_VERSION,
  './styles/utilities/responsive.css?v=' + APP_VERSION,
  './styles/utilities/dark-mode.css?v=' + APP_VERSION
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
  // ✅ Strip ?v= from CSS files so cache keys match the fetch handler's
  // normalized lookups (fetch handler strips ?v= via cacheUrl.searchParams.delete('v'))
  var normalizedCSS = CSS_FILES.map(function(url) {
    var idx = url.indexOf('?');
    return idx !== -1 ? url.substring(0, idx) : url;
  });
  var precacheList = CORE.concat(BOOT_CRITICAL, normalizedCSS, LITE_SHELL);

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
        console.warn('⚠️ Precache had ' + result.fail + ' failures:', result.failed.join(', '));
      }

      // Verify boot-critical files are cached — if these are missing, offline boot fails
      var criticalFiles = [
        './version.js', './miniCycle-main.js',
        './modules/boot/orchestrator.js', './modules/boot/coreBoot.js',
        './modules/boot/featureBoot.js', './modules/boot/uiBoot.js',
        './modules/boot/moduleLoader.js', './modules/core/appInit.js'
      ];
      return caches.open(STATIC_CACHE).then(function(verifyCache) {
        return Promise.all(criticalFiles.map(function(file) {
          return verifyCache.match(file).then(function(found) {
            return found ? null : file;
          });
        }));
      }).then(function(results) {
        var missing = results.filter(function(f) { return f !== null; });
        if (missing.length > 0) {
          console.error('⚠️ CRITICAL: Failed to precache boot files:', missing);
        }
        return self.skipWaiting();
      });
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

      // Clean old caches — but keep the previous static cache as offline fallback.
      // On iOS, the SW process can be killed during install, causing incomplete precache.
      // If old caches are deleted, offline boot fails because neither old nor new cache
      // has all the files. caches.match() searches ALL caches, so old entries are found.
      caches.keys().then(function (keys) {
        if (DISABLE_CACHING) {
          return Promise.all(keys.map(function (k) {
            console.log('🗑️ Deleting cache (online-only):', k);
            return caches.delete(k);
          }));
        }

        // Find old caches and keep the most recent pair (static + dynamic) as fallback.
        // The old dynamic cache has modules cached during previous online sessions.
        // When the new SW activates, its precache may be incomplete (iOS kills SW
        // processes during long installs). The old caches fill those gaps.
        var oldStaticCaches = keys.filter(function(k) {
          return k.indexOf('miniCycle-static-') === 0 && k !== STATIC_CACHE;
        }).sort();
        var oldDynamicCaches = keys.filter(function(k) {
          return k.indexOf('miniCycle-dynamic-') === 0 && k !== DYNAMIC_CACHE;
        }).sort();
        var keepStatic = oldStaticCaches.length > 0
          ? oldStaticCaches[oldStaticCaches.length - 1]
          : null;
        var keepDynamic = oldDynamicCaches.length > 0
          ? oldDynamicCaches[oldDynamicCaches.length - 1]
          : null;

        return Promise.all(keys.map(function (k) {
          if (k === STATIC_CACHE || k === DYNAMIC_CACHE) return;
          if (k === keepStatic || k === keepDynamic) {
            console.log('📦 Keeping previous cache as offline fallback:', k);
            return; // Don't delete — caches.match() will find entries here
          }
          if (k.indexOf('miniCycle-') === 0) {
            console.log('🗑️ Deleting old cache:', k);
            return caches.delete(k);
          }
        }));
      })
    ]).then(function () {
      console.log('✅ Old caches cleaned');
      // ✅ Clean expired entries and trim cache on activation
      // These are best-effort — failures must not block clients.claim()
      if (!DISABLE_CACHING) {
        cleanExpiredEntries().catch(function(e) { console.warn('⚠️ cleanExpiredEntries failed:', e); });
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

// isNetworkFirstFile() was removed in v2.057 — see comment block at top of file.
// Network-first is now determined solely by version mismatch detection in the
// fetch handler: var needsNetworkFirst = versionMismatch;

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
  return caches.open(DYNAMIC_CACHE).then(function(cache) {
    return cache.keys().then(function(requests) {
      return Promise.all(requests.map(function(request) {
        return cache.match(request).then(function(response) {
          if (response) {
            var dateHeader = response.headers.get('date');
            if (dateHeader) {
              var cacheTime = new Date(dateHeader).getTime();
              if (now - cacheTime > MAX_CACHE_AGE_MS) {
                return cache.delete(request).then(function() {
                  console.log('🗑️ Expired cache entry removed:', request.url);
                });
              }
            }
          }
        });
      }));
    });
  });
}

/**
 * Quota-aware cache put: attempts cache.put(), and on quota error
 * aggressively trims the cache and retries once.
 * @param {Cache} cache - The cache object
 * @param {Request} key - The cache key
 * @param {Response} response - The response to cache
 * @returns {Promise} - Resolves when cached (or fails silently after retry)
 */
function safeCachePut(cache, key, response) {
  return cache.put(key, response).catch(function(err) {
    var isQuota = err && (err.name === 'QuotaExceededError' ||
                          (err.message && err.message.indexOf('quota') !== -1));
    if (!isQuota) {
      console.warn('⚠️ Cache put failed:', key.url || key, err);
      return;
    }
    console.warn('⚠️ Quota exceeded — trimming cache and retrying:', key.url || key);
    // Aggressive immediate trim (bypass debounce)
    return cache.keys().then(function(keys) {
      // Delete oldest 20% of entries
      var deleteCount = Math.max(10, Math.floor(keys.length * 0.2));
      var toDelete = keys.slice(0, deleteCount);
      return Promise.all(toDelete.map(function(k) { return cache.delete(k); }));
    }).then(function() {
      // Retry the put once
      return cache.put(key, response).catch(function(retryErr) {
        console.warn('⚠️ Cache put retry failed:', key.url || key, retryErr);
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

  // ✅ BYPASS: version.js with cache-buster (from verifyVersionFresh)
  // must hit the network to detect version mismatches after deployment.
  if (url.pathname.endsWith('version.js') && url.search.indexOf('_cb=') !== -1) {
    event.respondWith(fetch(request));
    return;
  }

  var accept = (request.headers && request.headers.get('accept')) || '';
  var isNavigate = request.mode === 'navigate' ||
                   (request.destination === '' && accept.indexOf('text/html') !== -1);

  if (isNavigate) {
    // ═══════════════════════════════════════════════════════════════════════
    // NAVIGATION: Cache-first with background revalidation
    // ═══════════════════════════════════════════════════════════════════════
    // Serves cached HTML instantly (same speed as offline), then updates
    // the cache in the background. Version mismatches are caught by
    // verifyVersionFresh() in the inline script (~200ms after load),
    // which clears caches and reloads while the app-loader is still visible.
    //
    // Safari/iOS quirk: cached responses with `redirected: true` (from
    // Netlify _redirects) are rejected for navigation requests. Fix:
    // store and serve a clean Response copy (strips the redirected flag).
    // ═══════════════════════════════════════════════════════════════════════

    // Helper: create a clean Response copy that Safari accepts for navigation.
    // new Response() always has redirected=false, avoiding the Safari rejection.
    function cleanResponse(response) {
      if (!response.redirected) return response;
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }

    // Helper: store a clean copy in cache (strips redirected flag at write time)
    function cacheNavResponse(response) {
      var toCache = cleanResponse(response.clone());
      return caches.open(DYNAMIC_CACHE).then(function (cache) {
        return safeCachePut(cache, request, toCache).then(function () {
          trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
        });
      });
    }

    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) {
          // ✅ Cache hit — serve instantly, revalidate in background
          console.log('⚡ Navigation cache-first:', url.pathname);

          // Background revalidation: use navigation preload or fetch.
          // Wrapped in waitUntil() so the SW isn't terminated before the
          // revalidation completes — otherwise preloadResponse gets cancelled
          // and the cache never gets the new content (Chrome warns about this).
          event.waitUntil(
            (event.preloadResponse || Promise.resolve(null))
              .then(function (preloaded) {
                return preloaded || fetchWithTimeout(request, FETCH_TIMEOUT_MS);
              })
              .then(function (fresh) {
                if (fresh && fresh.status === 200) {
                  return cacheNavResponse(fresh);
                }
              })
              .catch(function () {
                // Background update failed (offline/timeout) — cache stays as-is
              })
          );

          // Return the cached response immediately (clean copy for Safari)
          return cleanResponse(cached);
        }

        // ✅ Cache miss — fall back to network-first
        return (event.preloadResponse || Promise.resolve(null))
          .then(function (preloaded) {
            return preloaded || fetchWithTimeout(request, FETCH_TIMEOUT_MS);
          })
          .then(function (fresh) {
            // Store clean copy for future cache-first serves
            cacheNavResponse(fresh);
            return fresh;
          })
          .catch(function () {
            // ✅ Offline fallback with smart shell selection
            var shell = pickShell(url);
            var shellPath = shell === 'lite' ? fromScope('lite/miniCycle-lite.html')
                                             : fromScope('miniCycle.html');

            return caches.match(shellPath).then(function (fallback) {
              if (fallback) {
                console.log('📱 Offline fallback: serving ' + shell + ' shell');
                return cleanResponse(fallback);
              }

              // ✅ Last resort: try any available shell
              return caches.open(STATIC_CACHE).then(function (cache) {
                return cache.match(fromScope('lite/miniCycle-lite.html'));
              }).then(function (anyLite) {
                if (anyLite) {
                  console.log('📱 Emergency fallback: serving lite shell');
                  return cleanResponse(anyLite);
                }
                return caches.open(STATIC_CACHE).then(function (cache) {
                  return cache.match(fromScope('miniCycle.html'));
                }).then(function (anyFull) {
                  if (anyFull) {
                    console.log('💻 Emergency fallback: serving full shell');
                    return cleanResponse(anyFull);
                  }
                  console.log('❌ No offline fallback available');
                  return new Response('Offline - No cached version available', {
                    status: 503,
                    statusText: 'Offline'
                  });
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
    var isTestFile = url.pathname.indexOf('/tests/') !== -1;
    // Test cache busters use Date.now() (13-digit timestamps) or "test"/"dev-local"/etc.
    // These are NOT real version mismatches — skip network-first to avoid 3s timeouts per file.
    // Real app versions match pattern like "2.154" (short numeric with dot).
    var isTestCacheBuster = requestVersion && (requestVersion.length > 10 || requestVersion === 'test' || requestVersion === 'dev-local' || requestVersion === 'undefined');
    var versionMismatch = requestVersion && requestVersion !== APP_VERSION && !isTestFile && !isTestCacheBuster;
    var isModuleFile = url.pathname.indexOf('/modules/') !== -1;
    var staticImportWithoutVersion = isModuleFile && !requestVersion;

    if (versionMismatch) {
      console.log('⚠️ Version mismatch detected:', requestVersion, '→', APP_VERSION, url.pathname);
    }
    if (staticImportWithoutVersion) {
      console.log('📦 Static import (no version):', url.pathname);
    }

    // ✅ HYBRID STRATEGY: Network-first ONLY for actual version mismatches
    // Static imports (no ?v=) and version-matching imports use stale-while-revalidate
    // for instant cache serving. This is CRITICAL for offline boot on iOS:
    //
    // Problem: moduleLoader loads 40+ modules SEQUENTIALLY. Each module's static
    // imports (constants.js, diBase.js, etc.) have no ?v= param. If these go through
    // network-first, and iOS navigator.onLine lies (returns true when offline),
    // each file waits 3s for network timeout before falling back to cache.
    // Even with browser module deduplication, the cumulative timeout exceeds
    // the Phase 2 boot timeout (20s) and the app fails to boot offline.
    //
    // Fix: Only use network-first when there's an ACTUAL version mismatch (?v=X
    // where X ≠ APP_VERSION). All other files use stale-while-revalidate:
    // - Cache hit → instant serve + background update
    // - Cache miss → wait for network (same as before)
    var needsNetworkFirst = versionMismatch;

    if (needsNetworkFirst) {
      // ═══════════════════════════════════════════════════════════════════
      // OFFLINE FAST-PATH: Serve from cache immediately without trying network.
      // Avoids 10-second timeout per file when offline (40+ files × 3s = 120s).
      //
      // TRADEOFF: No background revalidation happens. If the user goes offline,
      // then reconnects without closing the tab, they stay on the stale cached
      // version until verifyVersionFresh() in the HTML catches the mismatch
      // (runs on focus/visibility change). This is an accepted tradeoff to
      // prevent the iOS "navigator.onLine lies" death spiral.
      // ═══════════════════════════════════════════════════════════════════
      if (!self.navigator.onLine) {
        event.respondWith(
          caches.match(cacheRequest).then(function(cached) {
            if (cached) {
              console.log('📴 Offline fast-path:', url.pathname);
              return cached;
            }
            return caches.open(STATIC_CACHE).then(function(staticCache) {
              return staticCache.match(cacheRequest);
            }).then(function(staticCached) {
              if (staticCached) return staticCached;
              // Not cached at all — try to synthesize critical files, otherwise error
              // Use status 200 so the browser's module loader accepts and parses it
              // (non-200 responses cause silent "Importing a module script failed" errors)
              console.error('📴 NOT CACHED (offline):', url.pathname);

              // ✅ SYNTHETIC version.js: The SW always has the version values (via importScripts),
              // so we can generate version.js on the fly if the precache missed it.
              // version.js is the #1 boot blocker — without it, APP_VERSION is undefined and
              // no module URLs resolve correctly.
              if (url.pathname.endsWith('version.js')) {
                console.log('📴 Generating synthetic version.js (APP_VERSION=' + APP_VERSION + ', CACHE_VERSION=' + CACHE_VERSION + ')');
                return new Response(
                  'globalThis.APP_VERSION = "' + APP_VERSION + '";\nglobalThis.CACHE_VERSION = ' + CACHE_VERSION_NUMBER + ';',
                  { status: 200, headers: { 'Content-Type': 'application/javascript' } }
                );
              }

              var safePath = url.pathname.replace(/[^a-zA-Z0-9._\-\/]/g, '');
              return new Response(
                url.pathname.endsWith('.css')
                  ? '/* offline: not cached */'
                  : 'throw new Error("Module not available offline: ' + safePath + '");',
                { status: 200,
                  headers: { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' } }
              );
            });
          })
        );
        return;
      }

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
      // Use shorter timeout (3s) so cache fallback fires well before
      // the orchestrator's 10s MODULE_IMPORT timeout. On slow connections,
      // serving a slightly stale cached file is better than timing out.
      var NETWORK_FIRST_TIMEOUT = 3000;
      event.respondWith(
        fetchWithTimeout(freshRequest, NETWORK_FIRST_TIMEOUT)
          .then(function (res) {
            if (res && res.status === 200) {
              return caches.open(DYNAMIC_CACHE).then(function (cache) {
                return safeCachePut(cache, cacheRequest, res.clone()).then(function() {
                  trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
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
              // ✅ Last resort: try STATIC_CACHE explicitly (precached files)
              return caches.open(STATIC_CACHE).then(function (staticCache) {
                return staticCache.match(cacheRequest);
              }).then(function (staticCached) {
                if (staticCached) {
                  console.log('📦 Found in static cache:', request.url);
                  return staticCached;
                }
                console.error('❌ Module not in cache and network failed:', request.url);

                // ✅ SYNTHETIC version.js fallback (same as offline fast-path)
                if (url.pathname.endsWith('version.js')) {
                  console.log('🔧 Generating synthetic version.js (APP_VERSION=' + APP_VERSION + ', CACHE_VERSION=' + CACHE_VERSION + ')');
                  return new Response(
                    'globalThis.APP_VERSION = "' + APP_VERSION + '";\nglobalThis.CACHE_VERSION = ' + CACHE_VERSION_NUMBER + ';',
                    { status: 200, headers: { 'Content-Type': 'application/javascript' } }
                  );
                }

                var safePath = url.pathname.replace(/[^a-zA-Z0-9._\-\/]/g, '');
                return new Response(
                  url.pathname.endsWith('.css') ? '/* offline: not cached */' : 'throw new Error("Module not available offline: ' + safePath + '");',
                  {
                    status: 200,
                    headers: { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' }
                  }
                );
              });
            });
          })
      );
    } else {
      // ═══════════════════════════════════════════════════════════════════
      // STALE-WHILE-REVALIDATE: Non-critical files for faster repeat loads
      // Serves cached version instantly, updates in background
      //
      // ⚠️ STATIC IMPORT FRESHNESS GUARD:
      // Activate keeps the previous static cache as an offline fallback, so a
      // broad `caches.match()` may return the OLD cached copy of an unversioned
      // file (e.g. `constants.js`) even when the NEW STATIC_CACHE has the
      // updated version. That breaks static imports the moment a deploy adds
      // a new export to a file other modules statically import (e.g. adding
      // `EVENTS` to constants.js → "Importing binding name 'EVENTS' is not
      // found" because consumers got the stale copy).
      //
      // Fix: for module/CSS requests, look in the CURRENT STATIC_CACHE /
      // DYNAMIC_CACHE first; fall back to the broad search only if neither has
      // the file (e.g. a brand-new module the precache missed).
      // NOTE: this now covers VERSIONED (?v=) requests too. The earlier
      // assumption that "?v= requests are safe to broad-search because the URL
      // carries the version" was WRONG — the ?v= is stripped from the cache key
      // (see ~line 730), so a versioned request can still match a stale entry in
      // a kept old cache. That was the themeManager/recurringPanel stale-serve bug.
      // ═══════════════════════════════════════════════════════════════════
      // Prefer the CURRENT version's cache for ALL app-code files — versioned
      // (?v=) imports included. The cache key has the ?v= stripped (see ~line 730),
      // so the broad "search all caches" path below can return a STALE copy from a
      // kept old cache even for a versioned request. That is exactly what served the
      // old themeManager.js / recurringPanel.js to stale machines (Frankenstein
      // cache). Looking in the current STATIC_CACHE / DYNAMIC_CACHE first prevents
      // it; on a current-cache miss while online, isModuleFile returns null below so
      // the file is fetched fresh from the network instead of an old-version copy.
      var preferCurrentCaches = (isModuleFile || url.pathname.endsWith('.css'));
      var matchPromise = preferCurrentCaches
        ? caches.open(STATIC_CACHE).then(function (sc) {
            return sc.match(cacheRequest);
          }).then(function (staticHit) {
            if (staticHit) return staticHit;
            return caches.open(DYNAMIC_CACHE).then(function (dc) {
              return dc.match(cacheRequest);
            });
          }).then(function (currentHit) {
            if (currentHit) return currentHit;
            // Current caches missed this unversioned file. A broad caches.match()
            // here can return a STALE copy from a PREVIOUS version's cache (kept as
            // an offline fallback) — the "Frankenstein cache" that breaks static
            // imports after a PARTIAL precache on slow/old devices (a consumer gets
            // the stale module and a newly-added export is "not found", killing boot).
            // ONLINE: return null so the downstream path fetches fresh from the
            // network (then STATIC_CACHE / synthetic), never an old-version module.
            // OFFLINE: a stale copy still beats a dead boot, so allow the broad match.
            if (isModuleFile && self.navigator.onLine) return null;
            return caches.match(cacheRequest);
          })
        : caches.match(cacheRequest);

      event.respondWith(
        matchPromise.then(function (cached) {
          // ✅ OFFLINE: Skip background fetch entirely when offline.
          // On iOS, firing 80+ fetch() calls with cache:'no-cache' when offline:
          // - Generates 80+ "Failed to load resource" errors in Safari console
          // - Wastes resources and may trigger iOS Safari's aggressive offline behavior
          // - The cache:'no-cache' directive can cause Safari to invalidate HTTP cache
          //   entries, which may interfere with cache persistence across PWA sessions
          if (!self.navigator.onLine) {
            if (cached) {
              return cached;
            }
            // Not in any cache and offline — try STATIC_CACHE, then all caches with ignoreSearch
            return caches.open(STATIC_CACHE).then(function (staticCache) {
              return staticCache.match(cacheRequest);
            }).then(function (staticCached) {
              if (staticCached) return staticCached;
              // ✅ Last resort: try matching ignoring search params (catches URL mismatches)
              return caches.match(cacheRequest, { ignoreSearch: true });
            }).then(function (anyMatch) {
              if (anyMatch) {
                console.log('📦 Found via ignoreSearch fallback:', url.pathname);
                return anyMatch;
              }
              console.error('📴 NOT CACHED (offline):', url.pathname,
                '| CacheKey:', cacheRequest.url,
                '| StaticCache:', STATIC_CACHE);
              // Log what IS in static cache for this path (diagnostic)
              caches.open(STATIC_CACHE).then(function(sc) {
                sc.keys().then(function(reqs) {
                  var related = reqs.filter(function(r) {
                    return r.url.indexOf(url.pathname.split('/').pop()) !== -1;
                  });
                  console.log('📴 Related entries in static cache:', related.length,
                    related.map(function(r) { return r.url; }));
                });
              });
              // Synthetic version.js
              if (url.pathname.endsWith('version.js')) {
                console.log('📴 Generating synthetic version.js');
                return new Response(
                  'globalThis.APP_VERSION = "' + APP_VERSION + '";\nglobalThis.CACHE_VERSION = ' + CACHE_VERSION_NUMBER + ';',
                  { status: 200, headers: { 'Content-Type': 'application/javascript' } }
                );
              }
              var safePath = url.pathname.replace(/[^a-zA-Z0-9._\-\/]/g, '');
              return new Response(
                url.pathname.endsWith('.css') ? '/* offline: not cached */' : 'throw new Error("Module not available offline: ' + safePath + '");',
                { status: 200, headers: { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' } }
              );
            });
          }

          // Return cached immediately if available
          if (cached) {
            // ✅ Skip background revalidation for test requests — test files are ephemeral
            // and production modules are already precached. Avoids hundreds of background
            // fetches that saturate connections and slow down test execution on production.
            if (!isTestFile && !isTestCacheBuster) {
              var freshRequest = new Request(fetchUrl.href, {
                method: 'GET',
                headers: request.headers,
                mode: request.mode,
                credentials: request.credentials,
                cache: 'no-cache'
              });
              // Background fetch to update cache (only when online)
              fetch(freshRequest).then(function (res) {
                if (res && res.status === 200) {
                  return caches.open(DYNAMIC_CACHE).then(function (cache) {
                    return safeCachePut(cache, cacheRequest, res.clone()).then(function() {
                      trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
                    });
                  });
                }
              }).catch(function () {});
            }
            return cached;
          }

          // No cache - fetch from network
          var freshRequest = new Request(fetchUrl.href, {
            method: 'GET',
            headers: request.headers,
            mode: request.mode,
            credentials: request.credentials,
            cache: 'no-cache'
          });
          var fetchPromise = fetch(freshRequest).then(function (res) {
            if (res && res.status === 200) {
              return caches.open(DYNAMIC_CACHE).then(function (cache) {
                return safeCachePut(cache, cacheRequest, res.clone()).then(function() {
                  trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
                  return res;
                });
              });
            }
            return res;
          }).catch(function () { return null; });

          return fetchPromise.then(function (res) {
            if (res) return res;
            // ✅ Last resort: try STATIC_CACHE explicitly (precached CSS files)
            return caches.open(STATIC_CACHE).then(function (staticCache) {
              return staticCache.match(cacheRequest);
            }).then(function (staticCached) {
              if (staticCached) {
                console.log('📦 Found in static cache:', request.url);
                return staticCached;
              }
              console.error('❌ Module not in cache and network failed:', request.url);

              // ✅ SYNTHETIC version.js fallback (same as other paths)
              if (url.pathname.endsWith('version.js')) {
                console.log('🔧 Generating synthetic version.js (stale-while-revalidate fallback)');
                return new Response(
                  'globalThis.APP_VERSION = "' + APP_VERSION + '";\nglobalThis.CACHE_VERSION = ' + CACHE_VERSION_NUMBER + ';',
                  { status: 200, headers: { 'Content-Type': 'application/javascript' } }
                );
              }

              // Use status 200 so browser's module loader accepts and parses it
              // (non-200 responses cause silent "Importing a module script failed")
              var safePath = url.pathname.replace(/[^a-zA-Z0-9._\-\/]/g, '');
              return new Response(
                url.pathname.endsWith('.css') ? '/* offline: not cached */' : 'throw new Error("Module not available offline: ' + safePath + '");',
                {
                  status: 200,
                  headers: { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' }
                }
              );
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
              return safeCachePut(cache, request, res.clone()).then(function() {
                console.log('📦 Cached new asset:', request.url);
                trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
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

  // ✅ WARM_CACHE: Verify all boot-critical files are cached after successful online boot.
  // iOS can fail to precache files during install (partial cache.addAll failure).
  // This runs after the app boots online to fill any gaps, guaranteeing the next
  // offline boot has all required files.
  if (data.type === 'WARM_CACHE') {
    console.log('🔥 Warm cache: verifying boot-critical files...');
    var filesToWarm = BOOT_CRITICAL.concat(
      CSS_FILES.map(function(url) { var idx = url.indexOf('?'); return idx !== -1 ? url.substring(0, idx) : url; })
    );
    // Store in BOTH static and dynamic cache for redundancy.
    // iOS can evict individual cache entries between PWA sessions.
    // caches.match() searches ALL caches, so having files in two places
    // doubles the chance of surviving iOS cache eviction.
    Promise.all([
      caches.open(STATIC_CACHE),
      caches.open(DYNAMIC_CACHE)
    ]).then(function(cachesPair) {
      var staticCache = cachesPair[0];
      var dynamicCache = cachesPair[1];
      var warmed = 0;
      return Promise.all(filesToWarm.map(function(file) {
        return staticCache.match(file).then(function(found) {
          if (found) {
            // Already in static cache — also ensure it's in dynamic cache
            return dynamicCache.match(file).then(function(dynFound) {
              if (!dynFound) {
                return safeCachePut(dynamicCache, file, found.clone());
              }
            });
          }
          // Missing from static cache — fetch and store in BOTH
          console.log('🔥 Warm cache: fetching missing file:', file);
          warmed++;
          return fetch(file).then(function(res) {
            if (res && res.status === 200) {
              return Promise.all([
                safeCachePut(staticCache, file, res.clone()),
                safeCachePut(dynamicCache, file, res.clone())
              ]);
            }
          }).catch(function(err) {
            console.warn('🔥 Warm cache: failed to fetch:', file, err);
          });
        });
      })).then(function() {
        console.log('✅ Warm cache complete. Fetched:', warmed, 'files. Total:', filesToWarm.length);
      });
    }).catch(function(err) {
      console.warn('⚠️ Warm cache failed:', err);
    });
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

// ✅ DIAGNOSTIC: Log cache inventory on SW startup.
// iOS can evict cache entries between PWA sessions. This shows exactly
// what's in each cache when the SW starts, helping debug offline boot failures.
caches.keys().then(function(names) {
  var miniCycleCaches = names.filter(function(n) { return n.indexOf('miniCycle-') === 0; });
  if (miniCycleCaches.length === 0) {
    console.warn('📋 Cache inventory: NO miniCycle caches found!');
    return;
  }
  miniCycleCaches.forEach(function(name) {
    caches.open(name).then(function(cache) {
      cache.keys().then(function(requests) {
        // Check for critical boot file
        var hasAppInit = requests.some(function(r) { return r.url.indexOf('appInit') !== -1; });
        var hasConstants = requests.some(function(r) { return r.url.indexOf('constants') !== -1; });
        var hasOrchestrator = requests.some(function(r) { return r.url.indexOf('orchestrator') !== -1; });
        console.log('📋 Cache [' + name + ']: ' + requests.length + ' entries'
          + ' | appInit:' + hasAppInit + ' constants:' + hasConstants + ' orch:' + hasOrchestrator);
      });
    });
  });
});
