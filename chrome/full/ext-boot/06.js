(function() {
    var settings = null;
    try {
      var data = localStorage.getItem('miniCycleData');
      if (!data) return;
      var parsed = JSON.parse(data);
      settings = (parsed && parsed.settings) || null;
    } catch (e) {
      return; // Unreadable/corrupt — everything gets applied later by app JS.
    }

    // Local helper; this block shares nothing with other gauntlet scripts.
    function onReady(fn) {
      document.addEventListener('DOMContentLoaded', fn);
    }
    var root = document.documentElement;

    // 1. Dark mode — prevents flash of light mode.
    try {
      if (settings && settings.darkMode) {
        // Apply to html immediately (body doesn't exist yet), body once ready.
        root.classList.add('dark-mode');
        onReady(function() { document.body.classList.add('dark-mode'); });
      } else {
        // Ensure dark mode is removed (in case of stale state).
        root.classList.remove('dark-mode');
        onReady(function() { document.body.classList.remove('dark-mode'); });
      }
    } catch (e) {
      // Silently fail - dark mode will be applied later by JS
    }

    // 2. Accessibility — prevents animation/contrast/font-size flash.
    try {
      if (settings) {
        if (settings.reducedMotion) {
          root.classList.add('reduced-motion');
          onReady(function() { document.body.classList.add('reduced-motion'); });
        }
        if (settings.highContrast) {
          root.classList.add('high-contrast');
          onReady(function() { document.body.classList.add('high-contrast'); });
        }
        if (settings.fontSize && settings.fontSize !== '16') {
          root.style.setProperty('--font-size-base', settings.fontSize + 'px');
        }
      }
    } catch (e) {
      // Silently fail - accessibility settings will be applied later by JS
    }

    // 3. Custom app background — only set when a custom color is saved, so the
    //    default gradient survives.
    try {
      var customAppBg = settings && settings.customColors && settings.customColors.appBg;
      if (customAppBg) {
        root.style.setProperty('--pref-app-bg', customAppBg);
      }
    } catch (e) {
      // Silently fail - gradient will be used as default
    }
  })();
