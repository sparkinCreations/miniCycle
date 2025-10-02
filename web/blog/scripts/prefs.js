(function() {
  var THEME_KEY = 'blogTheme';
  var SIZE_KEY = 'blogFontSizePx';
  var html = document.documentElement;
  var themeBtn = document.getElementById('themeToggle');
  var themeIcon = document.getElementById('themeIcon');
  var fontDec = document.getElementById('fontDec');
  var fontInc = document.getElementById('fontInc');
  var fontLabel = document.getElementById('fontSizeLabel');
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  var MIN_PX = 14, MAX_PX = 20, DEFAULT_PX = 16;
  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
  function getStored(key, fallback){ try { var v = localStorage.getItem(key); return v == null ? fallback : v; } catch(e) { return fallback; } }
  function setStored(key, val){ try { localStorage.setItem(key, val); } catch(e) {} }

  function systemPrefersDark(){
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function updateMetaFor(theme){
    if (!themeMeta) return;
    if (theme === 'auto') {
      themeMeta.setAttribute('content', systemPrefersDark() ? '#0b1220' : '#f5f8fc');
    } else if (theme === 'light') {
      themeMeta.setAttribute('content', '#f5f8fc');
    } else {
      themeMeta.setAttribute('content', '#0b1220');
    }
  }

  function applyTheme(theme){
    html.setAttribute('data-theme', theme);
    if (themeIcon) {
      if (theme === 'light') themeIcon.className = 'fa-regular fa-sun';
      else if (theme === 'dark') themeIcon.className = 'fa-regular fa-moon';
      else themeIcon.className = 'fa-solid fa-circle-half-stroke';
    }
    updateMetaFor(theme);
  }
  function applyFont(px){
    var size = clamp(px, MIN_PX, MAX_PX);
    html.style.fontSize = size + 'px';
    if (fontLabel) {
      var pct = Math.round((size / DEFAULT_PX) * 100);
      fontLabel.textContent = pct + '%';
    }
  }

  var storedTheme = getStored(THEME_KEY, '');
  var theme = storedTheme || 'auto';
  applyTheme(theme);

  var storedPx = parseInt(getStored(SIZE_KEY, ''), 10);
  if (!storedPx || isNaN(storedPx)) storedPx = DEFAULT_PX;
  applyFont(storedPx);

  function nextTheme(curr){
    if (curr === 'light') return 'dark';
    if (curr === 'dark') return 'auto';
    return 'light';
  }

  if (themeBtn) themeBtn.addEventListener('click', function(){
    theme = nextTheme(html.getAttribute('data-theme'));
    applyTheme(theme);
    setStored(THEME_KEY, theme);
  });

  // Update theme-color on system change when in auto mode
  if (window.matchMedia) {
    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    if (mql.addEventListener) {
      mql.addEventListener('change', function(){ if (html.getAttribute('data-theme') === 'auto') updateMetaFor('auto'); });
    } else if (mql.addListener) {
      // Safari older API
      mql.addListener(function(){ if (html.getAttribute('data-theme') === 'auto') updateMetaFor('auto'); });
    }
  }
  if (fontDec) fontDec.addEventListener('click', function(){
    var current = parseFloat(getComputedStyle(html).fontSize) || DEFAULT_PX;
    var next = clamp(Math.round(current - 1), MIN_PX, MAX_PX);
    applyFont(next);
    setStored(SIZE_KEY, String(next));
  });
  if (fontInc) fontInc.addEventListener('click', function(){
    var current = parseFloat(getComputedStyle(html).fontSize) || DEFAULT_PX;
    var next = clamp(Math.round(current + 1), MIN_PX, MAX_PX);
    applyFont(next);
    setStored(SIZE_KEY, String(next));
  });
})();
