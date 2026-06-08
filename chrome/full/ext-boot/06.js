(function() {
    try {
      var data = localStorage.getItem('miniCycleData');
      if (data) {
        var parsed = JSON.parse(data);
        var customAppBg = parsed && parsed.settings && parsed.settings.customColors && parsed.settings.customColors.appBg;
        if (customAppBg) {
          // Only set CSS variable if there's a custom color (preserves gradient for default)
          document.documentElement.style.setProperty('--pref-app-bg', customAppBg);
        }
      }
    } catch (e) {
      // Silently fail - gradient will be used as default
    }
  })();
