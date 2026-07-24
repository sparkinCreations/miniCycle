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
  } catch(e){}

  window.__FeatureGateNeedsLite = needsLite;
  window.__FeatureGateReasons = reasons;

  if (needsLite && !forcedFull && location.pathname.indexOf('miniCycle-lite.html') === -1) {
    console.warn('[miniCycle-ext] lite fallback suppressed (full extension build)');
  }
})();
