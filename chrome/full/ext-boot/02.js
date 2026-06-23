window.getBuildVersion = function () {
    var m = document.querySelector('meta[name="app-version"]');
    return (m && m.getAttribute('content')) ||
           (typeof globalThis !== 'undefined' && globalThis.APP_VERSION) || 'unknown';
  };
