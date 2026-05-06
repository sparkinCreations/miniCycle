// ES5 toast implementation - Single notification mode (replaces instead of stacking)
(function () {
  var wrapId = 'mc-toast-wrap';
  var currentToast = null;
  var currentTimeout = null;

  function ensureWrap() {
    var el = document.getElementById(wrapId);
    if (!el) {
      el = document.createElement('div');
      el.id = wrapId;
      el.className = 'mc-toast-wrap';
      document.body.appendChild(el);
    }
    return el;
  }
  function iconFor(type) {
    if (type === 'success') return '✅';
    if (type === 'warning') return '⚠️';
    if (type === 'error')   return '❌';
    return 'ℹ️';
  }
  function removeCurrentToast() {
    if (currentTimeout) {
      clearTimeout(currentTimeout);
      currentTimeout = null;
    }
    if (currentToast && currentToast.parentNode) {
      currentToast.parentNode.removeChild(currentToast);
    }
    currentToast = null;
  }
  // global: showNotification(messageHTML, type='info', durationMs=3000)
  // Single notification mode: new notifications replace existing ones
  window.showNotification = function (message, type, duration) {
    try {
      // Respect user preference (skip if notifications disabled)
      if (localStorage.getItem('miniCycleLiteNotifications') === 'off') return;

      type = type || 'info';
      duration = typeof duration === 'number' ? duration : 3000;

      // Remove existing notification first
      removeCurrentToast();

      var wrap = ensureWrap();
      var toast = document.createElement('div');
      toast.className = 'mc-toast ' + type;

      var icon = document.createElement('div');
      icon.className = 'mc-toast-icon';
      icon.innerHTML = iconFor(type);

      var body = document.createElement('div');
      body.className = 'mc-toast-body';
      body.textContent = message;

      var close = document.createElement('button');
      close.className = 'mc-toast-close';
      close.setAttribute('aria-label', 'Close notification');
      close.innerHTML = '×';
      close.onclick = function () {
        removeCurrentToast();
      };

      toast.appendChild(icon);
      toast.appendChild(body);
      toast.appendChild(close);
      wrap.appendChild(toast);

      // Track current toast
      currentToast = toast;

      if (duration > 0) {
        currentTimeout = setTimeout(function () {
          removeCurrentToast();
        }, duration);
      }
    } catch (e) { /* no-op on legacy */ }
  };
})();
