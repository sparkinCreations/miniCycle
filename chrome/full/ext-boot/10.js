// KEPT INLINE deliberately (Aug 2026 boot-sw.js extraction): a load-failure
// safety net must not depend on an external file loading. ES5 on purpose.
// ✅ Loading timeout failsafe - redirect to lite if app doesn't load in 60 seconds
(function() {
  var LOAD_TIMEOUT_MS = 60000; // 60 seconds
  setTimeout(function() {
    // Check if app actually loaded (app-loader hidden means success)
    var loader = document.getElementById('app-loader');
    var isStillLoading = loader && loader.style.display !== 'none';

    // Check if app loaded successfully via dataset (set by uiBoot.js)
    if (document.documentElement.dataset.appLoaded === 'true') {
      return; // App loaded successfully
    }
    if (isStillLoading && location.pathname.indexOf('miniCycle-lite.html') === -1) {
      console.warn('⚠️ App load timeout - redirecting to lite version');
      console.warn('[miniCycle-ext] lite fallback suppressed (full extension build)');
    }
  }, LOAD_TIMEOUT_MS);
})();
