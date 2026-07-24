(function() {
    var el = document.getElementById('loader-tip');
    if (!el) return;
    var text = el.querySelector('.loader-tip-text');
    if (!text) return;
    fetch('./modules/labels/loading-tips.json')
      .then(function(r) { return r.json(); })
      .then(function(tips) {
        if (!tips || !tips.length) return;
        var i = Math.floor(Math.random() * tips.length);
        text.textContent = tips[i];
        el.classList.add('visible');
        var rotation = setInterval(function() {
          // Stop rotating once the app has booted (loader is gone) — otherwise this
          // timer runs forever, mutating a hidden/detached element. uiBoot.js sets
          // dataset.appLoaded='true' on a successful boot. Exception: while the
          // first-run choice screen is awaiting a pick, boot may be done but the
          // loader is still visible — keep the tips rotating.
          var loaderEl = document.getElementById('app-loader');
          var awaitingChoice = loaderEl && loaderEl.getAttribute('data-awaiting-choice') === 'true';
          if (document.documentElement.dataset.appLoaded === 'true' && !awaitingChoice) {
            clearInterval(rotation);
            return;
          }
          el.classList.remove('visible');
          setTimeout(function() {
            i = (i + 1) % tips.length;
            text.textContent = tips[i];
            el.classList.add('visible');
          }, 400);
        }, 4000);
      })
      .catch(function() {});
  })();
