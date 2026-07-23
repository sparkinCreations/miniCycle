// ═══════════════════════════════════════════════════════════════════════════
// miniCycle Service Worker
// ═══════════════════════════════════════════════════════════════════════════
// ONE FILE, TWO WORLDS — read this before judging any branch "dead":
//
//   DEV  (npm start, raw source):  ?v= query params ARE the cache identity.
//        The mismatch/network-first machinery below is the daily driver that
//        picks up edits on reload and keeps module graphs consistent.
//
//   PROD (Netlify dist build):     app code lives at content-hashed /build/…
//        URLs (immutable; the filename IS the version — see §7a). The ?v=
//        machinery still runs but is nearly inert day-to-day; its remaining
//        job is DORMANT-CLIENT RECOVERY — a device that last opened the app
//        months ago wakes up requesting old-?v= stable paths, and network-
//        first is what serves it fresh code so the page-side heal
//        (verifyVersionFresh) can converge it. Rarely needed ≠ removable.
//
// The build (scripts/build-web.cjs) injects three things into the DIST copy
// between marker comments — never remove the markers:
//   __BUILD_JS_PRECACHE_*__   generated hashed entry+chunk list (§3)
//   __BUILD_CSS_PRECACHE_*__  generated hashed CSS bundle list  (§3)
//   __BUILD_MODULE_MAP_*__    source-path → hashed-URL map      (§1)
//
// Style contract: ES5 only (no const/let, arrows, async/await, optional
// chaining) — this file must parse on the oldest supported WebViews.
// Operational guide: docs/deployment/BUILD_PROCESS.md
// Update strategy:   docs/deployment/SERVICE_WORKER_UPDATE_STRATEGY.md
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// §1 VERSION IDENTITY (update-version.sh rewrites the three vars below — keep
//    their exact `var NAME = …` shapes) + the build-injected module map.
// ═══════════════════════════════════════════════════════════════════════════
var APP_VERSION = '2.323';
var CACHE_VERSION = 'v1166';
var CACHE_VERSION_NUMBER = 1166; // Numeric version matching version.js (for synthetic fallback)
var STATIC_CACHE = 'miniCycle-static-' + CACHE_VERSION;
var DYNAMIC_CACHE = 'miniCycle-dynamic-' + CACHE_VERSION;

// __BUILD_MODULE_MAP_START__  (scripts/build-web.cjs replaces this in the dist
// copy with the source-path → hashed-URL map so the synthetic version.js
// fallback can carry it. Stays null in dev — do not remove the markers.)
var MODULE_MAP = null;
// __BUILD_MODULE_MAP_END__

// Body of a synthetic version.js — used by every fallback path when the real
// file is unreachable. The SW always has the version constants (inlined above),
// and in the bundled build it also carries MODULE_MAP, without which no hashed
// module URL can resolve.
function versionJsBody() {
  return 'globalThis.APP_VERSION = "' + APP_VERSION + '";\n' +
    'globalThis.CACHE_VERSION = ' + CACHE_VERSION_NUMBER + ';' +
    (MODULE_MAP ? '\nglobalThis.__MC_MODULE_MAP = ' + JSON.stringify(MODULE_MAP) + ';' : '');
}

// ═══════════════════════════════════════════════════════════════════════════
// §2 CONFIG
// ═══════════════════════════════════════════════════════════════════════════

// Kill switch: serve everything network-only and delete caches on activate.
// (Version-mismatch recovery itself is layered in the page: boot failsafe +
// forced cache clear on version change + verifyVersionFresh.)
var DISABLE_CACHING = false;

var MAX_DYNAMIC_ENTRIES = 300;  // dynamic-cache cap (app has 130+ modules)
var MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // dynamic entries expire after 7 days

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST ROUTING MAP — the fetch handler (§7) walks these branches in order:
//
//   bypass   non-GET · non-http(s) · /tests/ · version.js?_cb= (heal probes)
//   §7-nav   navigations → CACHE-FIRST + background revalidation
//            (instant open; staleness is healed page-side by verifyVersionFresh)
//   §7a      /build/… (dist only) → CACHE-FIRST, immutable, no revalidation
//            (content-hashed: a changed file always has a new NAME)
//   §7b      script/style with ?v= ≠ APP_VERSION, or un-versioned /modules/ JS
//            → NETWORK-FIRST (3s timeout, cache fallback). Dev's freshness
//            path + prod's dormant-client recovery. Guarded offline by the
//            _appCodeNetworkDown circuit breaker (§6) because iOS reopens
//            backgrounded PWAs "online" while the radio is actually dead.
//   §7c      remaining script/style (?v= matches, test busters, lite, CSS)
//            → STALE-WHILE-REVALIDATE, current-caches-first (Frankenstein
//            guard: never serve a kept OLD cache's copy while online).
//   §7d      everything else (images/fonts/json) → cache-first.
//
// History worth keeping: a NETWORK_FIRST_PATTERNS list + isNetworkFirstFile()
// existed before v2.057 (dead code, removed); network-first became
// mismatch-driven instead of path-driven at that point.
// ═══════════════════════════════════════════════════════════════════════════

// ============================================================================
// §3 PRECACHE LISTS — optimized for iOS PWA install (source lists = DEV;
//    the dist build regenerates the marked blocks). Files NOT listed here are
//    lazy-cached on first use by §7c/§7d (e.g. legal/user-manual pages).
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
// __BUILD_JS_PRECACHE_START__  (scripts/build-web.cjs replaces this whole array
// in the dist copy with the generated bundled entry+chunk list — the hand list
// below is the DEV/source list; do not remove the marker comments.)
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
  './modules/utils/featureAvailability.js',
  './modules/utils/dataRecovery.js',
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
  './modules/labels/themes.js',
  // Boot-graph modules that were drifting out of precache — they are statically
  // imported during boot, so without precache they only live in the DYNAMIC
  // cache, which iOS evicts; once evicted, offline boot dies with "Importing
  // binding name '…' is not found" (e.g. goToLiteVersion). Keep these here.
  './modules/utils/liteVersion.js',
  './modules/utils/dialogClose.js',
  './modules/utils/popoverUtils.js',
  './modules/platform/capacitorBridge.js',
  './modules/ui/headerLayoutManager.js',
  './modules/ui/taskViewLayoutManager.js',
  './modules/ui/shareManager.js',
  './modules/ui/modalUtils.js',
  './modules/ui/actionUsage.js',
  './modules/ui/guidedTourManager.js',
  './modules/task/dailyResetManager.js',
  './modules/features/backupReminder.js',
  './modules/other/basicPluginSystem.js',
  // July 2026 drift fix (test:sw caught these missing):
  './modules/features/uxRatings.js',
  './modules/ui/focusTaskPanel.js',
  './modules/ui/panelCarousel.js'
];
// __BUILD_JS_PRECACHE_END__

// CSS files - all @imports from main.css (required for offline styling)
// ✅ Versioned with APP_VERSION for cache busting (matches main.css ?v= params)
// __BUILD_CSS_PRECACHE_START__  (scripts/build-web.cjs replaces this array in
// the dist copy with the bundled hashed stylesheet — the hand list below is the
// DEV/source list; do not remove the marker comments.)
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
  './styles/utilities/dark-mode.css?v=' + APP_VERSION,
  // Stylesheets that drifted out of precache — main.css @imports them, so when
  // iOS evicts the dynamic cache they vanish offline and the @import resolves to
  // an empty stub → flash of unstyled content (task-view-layout.css is STRUCTURAL
  // — it makes #task-card-group a flex column — so losing it collapses the layout).
  './styles/components/task-view-layout.css?v=' + APP_VERSION,
  './styles/components/first-run-welcome.css?v=' + APP_VERSION,
  './styles/components/guided-tour.css?v=' + APP_VERSION,
  './styles/components/history.css?v=' + APP_VERSION,
  './styles/components/achievements.css?v=' + APP_VERSION,
  './styles/components/focus-task-panel.css?v=' + APP_VERSION
];
// __BUILD_CSS_PRECACHE_END__

// Lite version shell (smaller precache)
var LITE_SHELL = [
  './lite/miniCycle-lite.html',
  './lite/miniCycle-lite-styles.css',
  './lite/miniCycle-lite-scripts.js'
];

// (A LAZY_CACHE_ON_USE list lived here until v2.312 — it was documentation
// masquerading as config: never read by any code. Its truth survives in the
// §3 banner: unlisted files simply lazy-cache on first use.)

// ============================================================================
// §4 INSTALL — precache the shell + boot-critical files, then skipWaiting.
//    addAllSafe: one bad URL must not kill the whole install (iOS especially).
// ============================================================================

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

// ============================================================================
// §5 ACTIVATE — enable navigation preload, clean old caches (KEEPING the most
//    recent previous static+dynamic pair: iOS can kill the SW mid-install,
//    leaving the new precache incomplete — the kept pair fills those gaps via
//    broad caches.match(). With hashed /build/ files this is pure upside:
//    old hashed names can never collide with new ones, and the un-hashed
//    shell (HTML, version.js) still benefits from the fallback.
// ============================================================================

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

// ============================================================================
// §6 FETCH HELPERS — timeout wrapper, cache hygiene, quota-safe writes,
//    offline shell picker, and the app-code network circuit breaker.
// ============================================================================

function fromScope(path) {
  return new URL(path, self.registration.scope).href;
}

// ✅ Network circuit breaker for app-code fetches (used by §7b).
// iOS can reopen a backgrounded PWA OFFLINE while navigator.onLine still
// returns true ("the lie"). Without protection, every network-first module
// would wait out its timeout — the documented boot death spiral. Instead the
// FIRST failed app-code fetch trips this flag and subsequent un-versioned
// module requests serve straight from cache: at most ONE file pays the
// timeout. Re-armed on any successful network response and at the start of
// every navigation (a fresh page load is a fresh chance to reach the network).
var _appCodeNetworkDown = false;

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

// ============================================================================
// §7 FETCH ROUTING — see the REQUEST ROUTING MAP in §2 for the branch overview.
// ============================================================================

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

  // ✅ BYPASS: Always fetch fresh for test files (network-only, no cache) —
  // stale tests asserting against current code produce meaningless results.
  // Offline, say WHY instead of surfacing a raw fetch failure (Oct 2025 design,
  // messaged July 2026): navigations get a friendly page, scripts a clear throw.
  if (url.pathname.indexOf('/tests/') !== -1) {
    event.respondWith(fetch(request).catch(function () {
      var accept = (request.headers && request.headers.get('accept')) || '';
      var wantsHtml = accept.indexOf('text/html') !== -1 || url.pathname.endsWith('.html');
      if (wantsHtml) {
        return new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
          '<title>Tests require network</title>' +
          '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1e293b;color:#fff">' +
          '<div style="max-width:420px;padding:24px"><div style="font-size:48px">📡</div>' +
          '<h2 style="margin:12px 0 8px">Tests require a network connection</h2>' +
          '<p style="color:#cbd5e1;line-height:1.5">Test files are always fetched fresh so results match the deployed code — they are never cached. ' +
          'Reconnect and try again.<br><br>Diagnostics (Boot Timing, cache status) work offline from Settings → Testing.</p></div></body>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }
      return new Response(
        'throw new Error("Tests require a network connection — test files are never cached (results must match the deployed code).");',
        { status: 200, headers: { 'Content-Type': 'application/javascript' } }
      );
    }));
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
    // A fresh page load is a fresh chance to reach the network — re-arm the
    // app-code circuit breaker so this load isn't biased to cache by a prior
    // offline session.
    _appCodeNetworkDown = false;

    // ═══════════════════════════════════════════════════════════════════════
    // §7-nav NAVIGATION: Cache-first with background revalidation
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
    // ✅ AUTO-VERSION: append ?v= to un-versioned .js NETWORK fetches so the
    // HTTP-cache key stays consistent with versioned requests (dev-era
    // mechanism; harmless for the few un-hashed prod fetches it still touches).
    var fetchUrl = new URL(request.url);
    if (!fetchUrl.searchParams.has('v') && fetchUrl.pathname.endsWith('.js')) {
      fetchUrl.searchParams.set('v', APP_VERSION);
    }

    // ✅ Normalized CACHE key: the ?v= is stripped, so every version of a URL
    // shares one cache slot. This is why "current caches first" matters in §7c.
    var cacheUrl = new URL(request.url);
    cacheUrl.searchParams.delete('v');
    var cacheRequest = new Request(cacheUrl.href);

    // ═══════════════════════════════════════════════════════════════════════
    // §7a CONTENT-HASHED BUILD OUTPUT (/build/ tree, bundled dist only):
    // the filename IS the version, so these are immutable — cache-first with a
    // plain network fallback. No mismatch logic, no revalidation, no network-
    // first: a changed file always has a NEW name, so a cached copy can never
    // be stale, and a mixed old/new module graph is unrepresentable. Query
    // params (retry ?v= suffixes) are ignored via the normalized cacheRequest.
    // Dev never serves /build/ paths, so this branch is inert on source.
    // ═══════════════════════════════════════════════════════════════════════
    if (url.pathname.indexOf('/build/') === 0) {
      event.respondWith(
        caches.open(STATIC_CACHE).then(function (sc) {
          return sc.match(cacheRequest);
        }).then(function (staticHit) {
          if (staticHit) return staticHit;
          return caches.open(DYNAMIC_CACHE).then(function (dc) {
            return dc.match(cacheRequest);
          });
        }).then(function (cached) {
          if (cached) return cached;
          return fetchWithTimeout(new Request(cacheUrl.href), FETCH_TIMEOUT_MS).then(function (res) {
            if (res && res.status === 200) {
              return caches.open(DYNAMIC_CACHE).then(function (cache) {
                return safeCachePut(cache, cacheRequest, res.clone()).then(function () {
                  trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
                  return res;
                });
              });
            }
            return res;
          }).catch(function () {
            // Offline + not cached — a hashed file we never precached. Broad
            // match is SAFE here (hash = identity; an old cache can only hold
            // this exact content or nothing).
            return caches.match(cacheRequest).then(function (anyHit) {
              if (anyHit) return anyHit;
              var safePath = url.pathname.replace(/[^a-zA-Z0-9._\-\/]/g, '');
              return new Response(
                url.pathname.endsWith('.css')
                  ? '/* offline: not cached */'
                  : 'throw new Error("Module not available offline: ' + safePath + '");',
                { status: 200,
                  headers: { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' } }
              );
            });
          });
        })
      );
      return;
    }

    // ✅ VERSION MISMATCH DETECTION (feeds §7b vs §7c):
    var requestVersion = url.searchParams.get('v');
    var isTestFile = url.pathname.indexOf('/tests/') !== -1;
    // Test cache busters use Date.now() (13-digit timestamps) or "test"/"dev-local"/etc.
    // These are NOT real version mismatches — skip network-first to avoid 3s timeouts per file.
    // Real app versions match pattern like "2.154" (short numeric with dot).
    var isTestCacheBuster = requestVersion && (requestVersion.length > 10 || requestVersion === 'test' || requestVersion === 'dev-local' || requestVersion === 'undefined');
    // Lite is versioned INDEPENDENTLY (e.g. ?v=2.092 vs APP_VERSION 2.3xx), so
    // its ?v= would mismatch forever — an accident, not a freshness signal.
    // Exempt it so lite's 3 files get §7c stale-while-revalidate instead of
    // paying a permanent network-first round trip (v2.312).
    var isLiteFile = url.pathname.indexOf('/lite/') !== -1;
    var versionMismatch = requestVersion && requestVersion !== APP_VERSION && !isTestFile && !isTestCacheBuster && !isLiteFile;
    var isModuleFile = url.pathname.indexOf('/modules/') !== -1;
    var staticImportWithoutVersion = isModuleFile && !requestVersion;

    if (versionMismatch) {
      console.log('⚠️ Version mismatch detected:', requestVersion, '→', APP_VERSION, url.pathname);
    }
    if (staticImportWithoutVersion) {
      console.log('📦 Static import (no version):', url.pathname);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // §7b NETWORK-FIRST — the freshness/recovery path.
    // Fires for genuine ?v= mismatches and un-versioned /modules/ JS.
    //   DEV:  this is the daily driver — edits are picked up on reload, and
    //         mixed module graphs can't form (the stale-build bug class).
    //   PROD (hashed dist): app code never lands here (§7a catches /build/);
    //         what remains is version.js and DORMANT CLIENTS — devices waking
    //         up with months-old ?v= requests get served fresh code here so
    //         the page-side heal can converge them. Low traffic, high value.
    // iOS guard: un-versioned module fetches ride the _appCodeNetworkDown
    // breaker (§6) so an offline "online" device pays ONE timeout, not 100.
    // CSS @imports carry ?v= in dev, so a deploy bumps them into this path too.
    // ═══════════════════════════════════════════════════════════════════════
    var needsNetworkFirst = versionMismatch || staticImportWithoutVersion;

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
      // Serve from cache with no network attempt when the device is honestly
      // offline, OR when the app-code circuit breaker has tripped (network is
      // down even though navigator.onLine may be lying) — either way the network
      // would only burn the timeout.
      if (!self.navigator.onLine || (_appCodeNetworkDown && staticImportWithoutVersion)) {
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
                  versionJsBody(),
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
            _appCodeNetworkDown = false; // network reachable — re-arm the breaker
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
            // Trip the breaker so the remaining un-versioned modules skip the
            // network attempt and serve straight from cache (one file pays the
            // timeout, not all of them).
            _appCodeNetworkDown = true;
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
                    versionJsBody(),
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
      // §7c STALE-WHILE-REVALIDATE — matching-?v= files, test-buster fetches,
      // lite, CSS: serve cached instantly, refresh in the background.
      //
      // ⚠️ FRANKENSTEIN GUARD — current caches FIRST, broad match only offline.
      // §5 keeps the previous cache pair as an offline fallback, cache keys are
      // ?v=-stripped, and caches.match() searches caches OLDEST-FIRST — so a
      // broad match can hand back the PREVIOUS version's copy of a file even
      // for a versioned request. That mixed old/new module graph is the
      // "Frankenstein cache": one stale file with a missing export kills boot
      // ("Importing binding name 'X' is not found" — the themeManager/
      // recurringPanel incident), and one stale stylesheet un-styles new
      // markup (the v2.282 star-rating regression). Scope must be ALL
      // script/style — including root-level version.js/miniCycle-main.js
      // (v2.300: an old kept version.js won the broad match and dragged every
      // dynamic import onto the old ?v=).
      //
      // Rule: look in the CURRENT static/dynamic caches first. On a miss —
      // ONLINE: return null so the code below fetches fresh (never an
      // old-version copy). OFFLINE: allow the broad match — a stale copy
      // beats a dead boot.
      // ═══════════════════════════════════════════════════════════════════
      var matchPromise = caches.open(STATIC_CACHE).then(function (sc) {
            return sc.match(cacheRequest);
          }).then(function (staticHit) {
            if (staticHit) return staticHit;
            return caches.open(DYNAMIC_CACHE).then(function (dc) {
              return dc.match(cacheRequest);
            });
          }).then(function (currentHit) {
            if (currentHit) return currentHit;
            // Current-cache miss — see the Frankenstein guard banner above:
            // online → null (fetch fresh below); offline → broad match allowed.
            if (self.navigator.onLine) return null;
            return caches.match(cacheRequest);
          });

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
                  versionJsBody(),
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
              }).catch(function () { /* cache write is best-effort */ });
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
                  versionJsBody(),
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
    // ═══════════════════════════════════════════════════════════════════════
    // §7d EVERYTHING ELSE (images, fonts, JSON, …) — plain cache-first.
    // ═══════════════════════════════════════════════════════════════════════
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

// ============================================================================
// §8 MESSAGES & DIAGNOSTICS — page ↔ SW contracts:
//   SKIP_WAITING      update flow (page's "Prepare Update" confirmation)
//   GET_VERSION       ensureControllingWorkerFresh + testing modal
//   WARM_CACHE        post-boot gap-fill (orchestrator, after online boot)
//   GET_CACHE_STATUS  testing modal cache inventory
// ============================================================================

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
