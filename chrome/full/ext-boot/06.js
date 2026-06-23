(function() {
    try {
      var data = localStorage.getItem('miniCycleData');
      if (data) {
        var s = JSON.parse(data).settings;
        if (s) {
          if (s.reducedMotion) {
            document.documentElement.classList.add('reduced-motion');
            document.addEventListener('DOMContentLoaded', function() {
              document.body.classList.add('reduced-motion');
            });
          }
          if (s.highContrast) {
            document.documentElement.classList.add('high-contrast');
            document.addEventListener('DOMContentLoaded', function() {
              document.body.classList.add('high-contrast');
            });
          }
          if (s.fontSize && s.fontSize !== '16') {
            document.documentElement.style.setProperty('--font-size-base', s.fontSize + 'px');
          }
        }
      }
    } catch (e) {
      // Silently fail - accessibility settings will be applied later by JS
    }
  })();
