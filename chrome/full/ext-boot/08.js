// Minimal, ES3-safe feature gate: if the browser can't run the es2020 build, go Lite.
(function () {
  var needsLite = false;
  var reasons = [];
  var w = window;

  // Check for arrow function support without using new Function (CSP-friendly)
  // Simple heuristic: arrow functions appeared around when Promise & fetch did.
  if (!w.Promise || !w.fetch) {
    needsLite = true;
    if (!w.Promise) reasons.push('no-promise');
    if (!w.fetch)   reasons.push('no-fetch');
  }

  // The gate's floor must match the BUILD TARGET (es2020), not just ES2015.
  // Two es2020 floors, because they arrive in different releases:
  //
  //  SYNTAX — optional chaining / nullish coalescing: Chrome 80, Firefox 74,
  //  Safari 13.1. esbuild leaves both verbatim at target es2020, so the
  //  shipped module graph is a SyntaxError on anything older. The canary
  //  block just above sets the flag only if the engine parsed `?.` and `??`.
  //
  //  BUILT-IN — globalThis: Chrome 71, Firefox 65, Safari 12.1 (later than
  //  ES modules in all three, so this also covers the no-module band).
  //  Without it, browsers with Promise+fetch but no globalThis passed the
  //  gate, then version.js and the pre-gate version-check/modulepreload
  //  blocks threw ReferenceError and white-screened (drift-review Lite-path
  //  finding, Aug 2026).
  //
  // The built-in floor is the EARLIER one, so on its own it admitted the
  // band in between — Chrome 71-79, Firefox 65-73, Safari 12.1-13.0, which
  // is iOS 12, the last OS for the iPhone 5s / 6 / 6 Plus. Those devices
  // passed the gate, hit a SyntaxError loading the modules, sat on the splash
  // for 16 s and reached Lite via the no-boot net instead of here (Sep 2026).
  if (!w.__ES2020SyntaxOk) {
    needsLite = true;
    reasons.push('no-es2020-syntax');
  }
  if (typeof globalThis === 'undefined') {
    needsLite = true;
    reasons.push('no-globalthis');
  }

  // localStorage test
  try {
    localStorage.setItem('__t','1'); 
    localStorage.removeItem('__t');
  } catch (e) {
    window.__LocalStorageBlocked = true;
    reasons.push('localStorage-blocked'); // not fatal
  }

  var forcedFull = (location.search.indexOf('mode=full') !== -1);
  try {
    forcedFull = forcedFull || localStorage.getItem('miniCycleForceFullVersion') === 'true';
  } catch(e){ /* storage unavailable — keep the URL-derived value */ }

  window.__FeatureGateNeedsLite = needsLite;
  window.__FeatureGateReasons = reasons;

  if (needsLite && !forcedFull && location.pathname.indexOf('miniCycle-lite.html') === -1) {
    console.warn('[miniCycle-ext] lite fallback suppressed (full extension build)');
  }
})();
