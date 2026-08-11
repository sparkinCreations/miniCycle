// Sync About modal version with meta app-version
document.addEventListener('DOMContentLoaded', function () {
  var meta = document.querySelector('meta[name="app-version"]');
  var aboutSpan = document.getElementById('about-version');
  if (meta && aboutSpan) {
    aboutSpan.textContent = meta.getAttribute('content') || '—';
  }
  // Populate SW version in About modal
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg || !reg.active) return;
      var ch = new MessageChannel();
      ch.port1.onmessage = function (evt) {
        var swSpan = document.getElementById('about-sw-version');
        if (swSpan && evt.data) {
          swSpan.textContent = evt.data.version || 'Unknown';
        }
      };
      try { reg.active.postMessage({ type: 'GET_VERSION' }, [ch.port2]); } catch (e) { /* SW channel unavailable — version display stays 'Unknown' */ }
    }).catch(function(){ /* no active SW — this only feeds the version display */ });
  }

  // Wire "Check for Updates" buttons (settings + main menu).
  // Uses event delegation because #check-for-updates lives in the settings modal
  // which is injected by modalTemplates.js AFTER DOMContentLoaded.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#check-for-updates, #menu-check-updates');
    if (!btn) return;
    if (typeof window.forceServiceWorkerUpdate === 'function') {
      window.forceServiceWorkerUpdate();
    } else if (typeof window.checkForUpdates === 'function') {
      window.checkForUpdates();
    }
  });
});
