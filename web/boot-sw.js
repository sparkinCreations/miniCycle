/**
 * boot-sw.js — service-worker registration, update management, and PWA install.
 *
 * EXTRACTED from miniCycle.html's inline <head> block (Aug 2026) so the HTML
 * shrinks and edits here stop forcing CSP hash regeneration (external files
 * are covered by script-src 'self', not hashes).
 *
 * LOAD CONTRACT — the <script src="boot-sw.js" defer> tag stays at the END of
 * <head>, with `defer`:
 *  - defer keeps this OFF the parse/first-paint path entirely (the reason
 *    inline extraction was previously rejected is thereby neutralized);
 *  - defer scripts run in order AFTER parse and BEFORE DOMContentLoaded, so
 *    the internal DOMContentLoaded / load / beforeinstallprompt listeners all
 *    attach in time (beforeinstallprompt cannot fire before the SW this file
 *    registers exists);
 *  - body consumers (settings "Check for Updates" button, testing modal) call
 *    window.checkForUpdates / getServiceWorkerInfo / forceServiceWorkerUpdate /
 *    installApp only on user interaction, long after defer execution.
 *
 * DEPENDS on earlier head scripts: version.js (window.APP_VERSION /
 * CACHE_VERSION) and the getBuildVersion helper — both stay inline.
 *
 * This is POST-GATE code: old browsers are redirected to lite/ before this
 * runs, so modern syntax is fine here (unlike the pre-gate inline blocks).
 */

// Read versions from version.js (single source of truth) — it loads
// synchronously earlier in <head> and sets window.APP_VERSION/CACHE_VERSION.
// File-scope so BOTH the registration block and the self-heal/testing-modal
// sections below share one binding (inline, the outer sections silently
// resolved the bare global; now it's explicit).
const APP_VERSION = window.APP_VERSION || '1.0';
const CACHE_VERSION = window.CACHE_VERSION || 1;

// Zero-globals helpers — dispatch CustomEvents instead of calling window.*
// (one file-scope pair; the registration block and the update/install
// sections below both use these).
function showNotification(message, type, duration) {
  document.dispatchEvent(new CustomEvent('app:showNotification', {
    detail: { message, type, duration }
  }));
}
function showConfirmationModal(options) {
  document.dispatchEvent(new CustomEvent('app:showConfirmationModal', {
    detail: options
  }));
}
// ✅ Enhanced Service Worker Registration with Update Management
if ('serviceWorker' in navigator) {
  let refreshing;

  // ✅ RELOAD COOLDOWN: prevent rapid reload loops WITHIN A TAB. sessionStorage
  // is per-tab, so this does NOT coordinate across tabs (each tab has its own
  // cooldown clock) — with several tabs open, each may reload once on a new SW
  // taking control, which is the intended behavior; the cooldown only stops a
  // single tab from reloading repeatedly.
  const RELOAD_COOLDOWN_MS = 10000; // 10 seconds cooldown between reloads
  const RELOAD_COOLDOWN_KEY = 'miniCycle_lastReload';

  function canReloadSafely() {
    try {
      const lastReload = parseInt(sessionStorage.getItem(RELOAD_COOLDOWN_KEY) || '0', 10);
      const now = Date.now();
      if (now - lastReload < RELOAD_COOLDOWN_MS) {
        console.log('⏳ Reload cooldown active, skipping reload');
        return false;
      }
      sessionStorage.setItem(RELOAD_COOLDOWN_KEY, String(now));
      return true;
    } catch {
      // sessionStorage not available, allow reload
      return true;
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // POST-LOAD VERSION VERIFICATION
  // Safari's memory cache can serve stale HTML BEFORE the service worker runs.
  // This fetches version.js fresh and compares against what's currently loaded.
  // ═══════════════════════════════════════════════════════════════════════════
  let versionCheckInProgress = false;
  // eslint-disable-next-line sonarjs/cognitive-complexity -- deliberate: the build/version/cache checks and their loop guards are one atomic recovery sequence (splitting them risks re-breaking the v2.316-class boot heals); complexity was identical when this lived inline, just unlinted
  async function verifyVersionFresh() {
    if (versionCheckInProgress) return;
    versionCheckInProgress = true;

    try {
      // Fetch version.js with timestamp to bypass ALL caches
      const response = await fetch(`./version.js?_cb=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const text = await response.text();

      // Extract both versions from response
      const match = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
      const cacheMatch = text.match(/CACHE_VERSION\s*=\s*['"]?([^'"\s;]+)/);
      const serverVersion = match ? match[1] : null;
      const serverCacheVersion = cacheMatch ? cacheMatch[1] : null;

      // The ACTUAL running build = the version baked into THIS HTML (meta tag).
      // version.js (→ APP_VERSION) is served network-first on a mismatch, so it
      // can read fresh while the HTML/CSS are stale. Comparing the BUILD against
      // the server catches the "stuck on cached HTML but version.js says latest"
      // state the old APP_VERSION-only check was blind to.
      const buildVersion = (typeof window.getBuildVersion === 'function')
        ? window.getBuildVersion() : APP_VERSION;
      const buildStale = !!(serverVersion && buildVersion && buildVersion !== serverVersion);
      const versionJsStale = !!(serverVersion && (serverVersion !== APP_VERSION ||
          (serverCacheVersion && typeof CACHE_VERSION !== 'undefined' && serverCacheVersion !== String(CACHE_VERSION))));

      if (buildStale || versionJsStale) {
        const reason = buildStale
          ? `BUILD (HTML) stale: loaded=${buildVersion}, server=${serverVersion}`
          : (serverVersion !== APP_VERSION
              ? `APP_VERSION: loaded=${APP_VERSION}, server=${serverVersion}`
              : `CACHE_VERSION: loaded=${CACHE_VERSION}, server=${serverCacheVersion}`);
        console.warn(`🔄 VERSION MISMATCH: ${reason}`);

        // Loop guard: if we already healed for this server version THIS session
        // and a mismatch STILL persists, stop reloading (the cache can't refresh
        // right now — e.g. flaky network, or a CDN edge serving inconsistent
        // version.js). Covers BOTH mismatch kinds: gating on buildStale alone
        // let a versionJsStale-only mismatch re-heal (full cache delete + SW
        // unregister) on every check. sessionStorage clears on a full app
        // close, so a fresh launch retries. Keyed on server version so a newer
        // deploy still triggers a heal.
        try {
          if (sessionStorage.getItem('__miniCycle_buildHeal') === serverVersion) {
            console.warn('⚠️ Version still mismatched after a heal attempt this session — not reloading again');
            return;
          }
          sessionStorage.setItem('__miniCycle_buildHeal', serverVersion);
          // Sync localStorage so the early boot check on the reloaded page
          // sees a matching version and doesn't trigger a second reload.
          localStorage.setItem('__miniCycle_lastVersion', serverVersion);
          sessionStorage.setItem('__miniCycle_justCleared', serverVersion);
        } catch { /* storage unavailable */ }

        // Clear caches AND unregister the SW so the reload fetches HTML straight
        // from the network — a cache-first navigation handler could otherwise
        // re-serve the same stale HTML even after the caches are cleared.
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          } catch { /* ignore */ }
        }
        if ('serviceWorker' in navigator) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
          } catch { /* ignore */ }
        }
        window.location.href = window.location.pathname + '?_cb=' + Date.now();
        return;
      }
      if (!serverVersion) {
        // Same trap as checkForUpdates, but silent and automatic: with a null
        // serverVersion BOTH staleness flags above are false, so this used to
        // log "Version verified" and return. A device whose version probe keeps
        // failing therefore never detects staleness and never heals — on every
        // focus, visibilitychange and pageshow, forever. Say what actually
        // happened instead of claiming a verification that never ran.
        console.warn('⚠️ Could not read the server version — staleness UNKNOWN, not verified');
        return;
      }
      console.log(`✅ Version verified: build ${buildVersion} (app ${APP_VERSION}, cache ${CACHE_VERSION})`);
    } catch (err) {
      console.warn('Version check failed (offline?):', err);
    } finally {
      versionCheckInProgress = false;
    }
  }

  // Run version check on focus (iOS PWA) and visibility change
  window.addEventListener('focus', verifyVersionFresh);
  // Pull-to-refresh dispatches this so an explicit refresh gesture gets the
  // latest BUILD (heals a stale cached HTML/CSS), not just a data re-render.
  document.addEventListener('app:verifyVersion', verifyVersionFresh);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) verifyVersionFresh();
  });
  // iOS bfcache: Safari may restore the page from back-forward cache
  // without firing visibilitychange. pageshow with persisted=true catches this.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) verifyVersionFresh();
  });
  // Run immediately — does not depend on SW registration (fetches version.js
  // directly with cache: 'no-store'). The app-loader is still visible during
  // boot, so any mismatch reload is hidden behind the splash screen.
  verifyVersionFresh();

  // ✅ Function to register service worker with all event listeners
  async function registerServiceWorker() {
    const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${APP_VERSION}`, {
      updateViaCache: 'none'
    });
    console.log('✅ Service Worker registered successfully:', registration.scope);

    // Handle service worker updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('🔄 New service worker installing...');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // Updates are deliberately automatic: the SW calls skipWaiting()
            // unconditionally on install, so a worker never sits in `waiting`
            // and a consent prompt here would be theater — the controllerchange
            // auto-reload below fires regardless of what the user answers (with
            // the cooldown + "refresh to finish" nudge as the fallback). A
            // "Prepare Update" confirmation modal lived here until v2.350
            // promising "you'll be asked again before the page reloads", which
            // was never true. Data is safe across the reload via AppState's
            // flush trio; only uncommitted input in an open field is lost.
            console.log('🆕 New app version installed — activating');
            showNotification('🆕 Updating miniCycle — the app will refresh in a moment…', 'info', 4000);
          } else {
            console.log('📱 App cached for offline use');
            showAppCachedNotification();
          }
        }
      });
    });

    // Handle controlled page refresh - AUTO-RELOAD when new SW takes control.
    // FIRST-INSTALL EXCEPTION: when the page loaded with NO controller (very
    // first visit, or right after a heal unregistered the old worker), the new
    // worker claiming us needs no reload — this page already booted fine from
    // the network, and the SW only needs to control FUTURE loads. Skipping it
    // means first visits boot ONCE instead of twice, and it removes the
    // mid-trace reload that Lighthouse misread as a giant layout shift (the
    // reloaded document briefly painted at an un-emulated viewport width —
    // CLS 0.787 artifact; real-browser CLS is 0).
    const hadControllerAtLoad = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      if (!hadControllerAtLoad) {
        console.log('📱 First service worker install — no reload needed');
        return;
      }
      // ✅ Check cooldown to prevent perpetual reload loops
      if (!canReloadSafely()) {
        console.log('⏳ Skipping reload due to cooldown');
        // Don't leave the user silently on the old build — the new SW already
        // controls the page, so until a refresh happens they're running stale
        // code with no signal (drift-review C-21). Non-blocking nudge; any
        // refresh (pull-to-refresh, tab reopen) completes the update.
        showNotification('🆕 Update ready — refresh to finish applying it.', 'info', 8000);
        return;
      }
      refreshing = true;
      console.log('🔄 New service worker is now controlling the page - reloading...');
      window.location.reload();
    });

    // Force check for updates when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && registration) {
        console.log('👁️ Page visible again - checking for updates...');
        registration.update().catch(err => {
          console.warn('Update check failed:', err);
        });
      }
    });

    // Check for updates every 60 seconds
    setInterval(() => {
      if (!document.hidden && registration) {
        // debug, not log: this fires every 60s for the life of every session —
        // the console.warn on failure below is the line that carries signal.
        console.debug('⏰ Periodic update check...');
        registration.update().catch(err => {
          console.warn('Periodic update check failed:', err);
        });
      }
    }, 60000);

    // ═══════════════════════════════════════════════════════════════════════════
    // iOS PWA FIX: Focus event for home screen apps
    // visibilitychange doesn't always fire on iOS PWAs, but focus does
    // ═══════════════════════════════════════════════════════════════════════════
    window.addEventListener('focus', () => {
      if (registration) {
        console.log('📱 Window focused - checking for SW updates (iOS PWA fix)...');
        registration.update().catch(err => {
          console.warn('Focus update check failed:', err);
        });
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // IMMEDIATE UPDATE CHECK: Don't wait for visibility/focus events
    // Force check right after registration to catch updates on app launch
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('🚀 Immediate SW update check on registration...');
    registration.update().catch(err => {
      console.warn('Immediate update check failed:', err);
    });

    // After registering, verify the worker actually controlling us is current.
    // If an old worker is still in charge (serving stale module files), this
    // clears caches and reloads once — the automated version of the manual
    // "unregister + clear site data" step. No-op when online versions match.
    await ensureControllingWorkerFresh(registration);
  }

  window.addEventListener('load', async () => {
    try {
      // A one-time v1.327 SW-migration block used to live here (mismatched-?v=
      // unregister + old-cache sweep + reload modal). Retired: register() with a
      // new ?v= URL replaces the registration itself, ensureControllingWorkerFresh()
      // heals a stale controlling worker, and the old-cache sweep fought the SW's
      // "keep previous cache pair as offline fallback" strategy. Its completion
      // flag stays in legacyKeysToRemove (backupRestoreManager) — drop it here too.
      localStorage.removeItem('sw-migration-v1327-done');

      await registerServiceWorker();
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  });
  
  // (showUpdateAvailable / updateServiceWorker removed in v2.350: the
  // "Prepare Update" consent modal was unreachable-by-design dead code —
  // skipWaiting() means registration.waiting is null by the time a user could
  // click, so its SKIP_WAITING message no-oped and its promises were false.
  // The heal path (applyPendingUpdate) and the testing modal keep their own
  // direct SKIP_WAITING senders for the rare states where `waiting` exists.)

  // ✅ Function to show app cached notification
  function showAppCachedNotification() {
    showNotification('📱 miniCycle is now available offline!', 'success', 4000);
  }

} else {
  console.warn('⚠️ Service Workers not supported in this browser');
}

// ✅ Fetch the authoritative DEPLOYED version (bypasses every cache).
async function fetchServerVersion() {
  try {
    const res = await fetch(`./version.js?_cb=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    // res.ok matters: the SPA fallback in _redirects answers an unmatched path
    // with miniCycle.html and a 404, and .text() on that body simply fails to
    // match the APP_VERSION regex — indistinguishable from a real answer
    // unless the status is checked.
    if (!res.ok) {
      console.warn(`Version probe returned HTTP ${res.status}`);
      return null;
    }
    const txt = await res.text();
    const m = txt.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (!m) console.warn('Version probe body had no APP_VERSION');
    return m ? m[1] : null;
  } catch (err) {
    console.warn('Version probe failed:', err && err.message);
    return null;
  }
}

// ✅ Apply a pending update by evicting caches + the SW so the next load is a
// clean, current build. Used when the RUNNING BUILD is older than what's
// deployed — covers both a waiting SW and the "stale cached HTML while the SW
// is already current" case that an SW-skipWaiting alone can't fix.
async function applyUpdateAndReload() {
  showNotification('🔄 Updating…', 'info', 3000);
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (e) {
    console.warn('applyUpdateAndReload cleanup failed:', e);
  }
  window.location.href = window.location.pathname + '?_cb=' + Date.now();
}

// ✅ Expose update function globally for manual updates.
// Compares the RUNNING BUILD (the HTML's baked meta version) against the
// deployed version — NOT active-SW vs waiting-SW. The old SW-vs-SW check
// reported "up to date" whenever the SW was current, even if the rendered
// HTML/CSS were a stale cached build. Build-vs-server tells the truth.
window.checkForUpdates = async function() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported');
    showNotification('❌ Service Workers not supported', 'error', 3000);
    return;
  }

  try {
    showNotification('🔍 Checking for app updates...', 'info', 2000);

    const buildVersion = (typeof window.getBuildVersion === 'function')
      ? window.getBuildVersion() : (window.APP_VERSION || 'unknown');
    const serverVersion = await fetchServerVersion();

    // Also nudge the SW to look for a newer worker (normal update path).
    const registration = await navigator.serviceWorker.getRegistration();
    try { await registration?.update?.(); } catch { /* ignore */ }

    if (serverVersion && serverVersion !== buildVersion) {
      showConfirmationModal({
        title: "🆕 Update Available!",
        message: `A newer version of miniCycle is available!\n\n📦 You're running: ${buildVersion}\n🚀 Latest: ${serverVersion}\n\n✨ Tap "Update Now" to clear the cache and load the latest build.`,
        confirmText: "🔄 Update Now",
        cancelText: "Later",
        callback: (confirmed) => {
          if (confirmed) {
            applyUpdateAndReload();
          } else {
            showNotification('ℹ️ Update postponed - you can install it anytime', 'info', 4000);
          }
        }
      });
    } else if (!serverVersion && registration && registration.waiting) {
      // Couldn't read the server version (offline?), but a worker is waiting.
      showConfirmationModal({
        title: "🆕 Update Available!",
        message: `A new version of miniCycle is ready to install.\n\nApply it now?`,
        confirmText: "🔄 Update Now",
        cancelText: "Later",
        callback: (confirmed) => { if (confirmed) applyUpdateAndReload(); }
      });
    } else if (!serverVersion) {
      // NEVER report "up to date" from a check that did not happen. serverVersion
      // is null whenever the probe failed — offline, a non-200, or a body with no
      // APP_VERSION — and the old catch-all `else` swallowed all of those and
      // quoted the running version back as confirmation. That is the one message
      // guaranteed to be wrong here: a user on a stale build asks precisely
      // because they suspect it, and gets told it is current.
      showNotification('⚠️ Couldn\'t reach the server to check for updates. Try again when you have a connection.', 'warning', 5000);
    } else {
      showNotification(`✅ App is up to date! (v${buildVersion})`, 'success', 3000);
    }

  } catch (error) {
    console.error('Failed to check for updates:', error);
    showNotification('❌ Failed to check for updates', 'error', 3000);
  }
};

// ✅ Add service worker info to your testing modal
window.getServiceWorkerInfo = async function() {
  if (!('serviceWorker' in navigator)) {
    return { supported: false };
  }
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    return {
      supported: true,
      registered: !!registration,
      scope: registration?.scope || 'Not registered',
      state: registration?.active?.state || 'Unknown',
      updateAvailable: !!registration?.waiting,
      scriptURL: registration?.active?.scriptURL || 'Not available',
      version: await getServiceWorkerVersion(registration)
    };
  } catch (error) {
    return {
      supported: true,
      registered: false,
      error: error.message
    };
  }
};

// ✅ Detect a STALE controlling service worker (Fix 3 self-heal).
// version.js can load fresh (so verifyVersionFresh sees nothing wrong) while the
// worker actually serving our module files is an OLD version handing back stale
// cached code (the themeManager/recurringPanel "Frankenstein cache" boot failure).
// Ask the controlling worker its version; if it doesn't match the page, evict the
// stale worker and reload ONCE for this version so we come back clean.
//
// IMPORTANT (hardening): clearing caches alone is NOT enough on a wedged machine.
// The OLD worker stays registered and controlling, so after a cache clear it just
// re-serves stale content and the once-per-version guard then blocks a retry —
// the page can't fix the worker from inside the page. We therefore UNREGISTER the
// stale worker too; the next load has no controller, fetches everything fresh from
// the network, and the new worker (with the cache fix) installs and takes over.
// This is the automated equivalent of the manual DevTools "Unregister" step.
async function ensureControllingWorkerFresh(registration) {
  try {
    if (!navigator.serviceWorker.controller || !registration.active) return;

    // NEVER clear caches / unregister when offline — caches are the only source of
    // files, so doing this offline would brick the app until the user is back
    // online. Mirrors coreBoot.attemptCacheRecovery()'s offline guard.
    if (!navigator.onLine) return;

    const swInfo = await new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => resolve(e.data || null);
      registration.active.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
      setTimeout(() => resolve(null), 2000);
    });

    if (!swInfo || !swInfo.appVersion) return;        // couldn't tell — do nothing
    if (swInfo.appVersion === APP_VERSION) return;    // worker matches page — all good

    // Worker is stale. Only heal once per version, to avoid reload loops.
    const healedKey = '__miniCycle_swHealed';
    if (sessionStorage.getItem(healedKey) === APP_VERSION) return;
    sessionStorage.setItem(healedKey, APP_VERSION);

    console.warn('🔄 Stale service worker (' + swInfo.appVersion +
                 ') controlling page (' + APP_VERSION + ') — evicting worker, clearing caches, reloading');

    // 1. Nudge any already-downloaded new worker to activate.
    await registration.update().catch(() => {});
    if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // 2. Drop all caches (the stale module files live here).
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // 3. Evict the stale worker itself — the step that was missing. Without this,
    //    the old worker keeps controlling the page and re-serving stale files.
    await registration.unregister().catch(() => {});

    // 4. Reload once (cache-busted). No controller now → fresh network fetch →
    //    the new worker registers clean on the way back up.
    window.location.replace(window.location.pathname + '?_cc=' + Date.now());
  } catch (e) {
    console.warn('Stale-worker check failed:', e);
  }
}

// ✅ Helper function to get SW version
async function getServiceWorkerVersion(registration) {
  if (!registration || !registration.active) return 'Unknown';
  
  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      // Enhanced version info with both cache and app version
      const versionData = event.data;
      if (versionData && versionData.version && versionData.appVersion) {
        resolve(`SW: ${versionData.version}, App: ${versionData.appVersion}`);
      } else {
        resolve(event.data?.version || 'Unknown');
      }
    };
    
    registration.active.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
    
    // Timeout after 2 seconds
    setTimeout(() => resolve('Timeout'), 2000);
  });
}


// ✅ Manual update check (settings + main-menu "Check for Updates" button).
// Delegates to the build-accurate checkForUpdates so it compares the RUNNING
// BUILD against the deployed version, instead of the old SW-vs-SW check that
// falsely reported "up to date" while the rendered HTML/CSS were a stale build.
window.forceServiceWorkerUpdate = async function() {
  return window.checkForUpdates();
};

// ✅ ADD: Handle PWA shortcuts (add after service worker registration)
window.addEventListener('DOMContentLoaded', () => {
  const fragment = window.location.hash;

  if (fragment === '#add-task') {
    setTimeout(() => {
      const taskInput = document.getElementById('taskInput');
      if (taskInput) {
        taskInput.focus();
        taskInput.scrollIntoView({ behavior: 'smooth' });
      }
    }, 500);
    // Clear the fragment
    history.replaceState(null, '', './miniCycle.html');
  }
  else if (fragment === '#stats') {
    setTimeout(() => {
      // Show stats panel via CustomEvent
      document.dispatchEvent(new CustomEvent('app:showStatsPanel'));
    }, 500);
    // Clear the fragment
    history.replaceState(null, '', './miniCycle.html');
  }
});


// ✅ ADD: PWA Install Prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  console.log('📱 Install prompt available');
  e.preventDefault();
  deferredPrompt = e;

  // Show install suggestion for new users
  setTimeout(() => {
    showNotification(
      '📱 Install miniCycle for offline access and faster loading!',
      'info',
      6000
    );
  }, 45000); // After 45 seconds for full version
});

// Global install function
window.installApp = () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('📱 User accepted the install prompt');
        showNotification('🎉 miniCycle installed successfully!', 'success', 4000);
      }
      deferredPrompt = null;
    });
  }
};

