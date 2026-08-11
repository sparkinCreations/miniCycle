// Minimal, ES3-safe feature gate: if arrow functions can't be parsed, go Lite.
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
  // globalThis is the latest-arriving es2020 feature in every engine
  // (Chrome 71, Firefox 65, Safari 12.1) — later than ES modules in all
  // three — so this one check also covers the no-module band. Without it,
  // browsers with Promise+fetch but no globalThis passed the gate, then
  // version.js and the pre-gate version-check/modulepreload blocks threw
  // ReferenceError and the es2020 modules white-screened (drift-review
  // Lite-path finding, Aug 2026).
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
