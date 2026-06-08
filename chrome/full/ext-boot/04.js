(function() {
    try {
      var data = localStorage.getItem('miniCycleData');
      if (data) {
        var parsed = JSON.parse(data);
        var isDarkMode = parsed && parsed.settings && parsed.settings.darkMode;
        if (isDarkMode) {
          // Apply to html immediately (body doesn't exist yet)
          document.documentElement.classList.add('dark-mode');
          // Also apply to body once it's ready
          document.addEventListener('DOMContentLoaded', function() {
            document.body.classList.add('dark-mode');
          });
        } else {
          // Ensure dark mode is removed (in case of stale state)
          document.documentElement.classList.remove('dark-mode');
          document.addEventListener('DOMContentLoaded', function() {
            document.body.classList.remove('dark-mode');
          });
        }
      }
    } catch (e) {
      // Silently fail - dark mode will be applied later by JS
    }
  })();
