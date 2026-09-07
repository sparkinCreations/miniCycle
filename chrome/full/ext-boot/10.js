(function() {
    var el = document.getElementById('loader-tip');
    if (!el) return;
    var text = el.querySelector('.loader-tip-text');
    if (!text) return;

    // Suppress the tip when it would sit on top of (or crowd) the first-run
    // "Restore from a backup file" link. On a short viewport the tip's
    // bottom-anchored strip and the bottom of the choice column meet, and the
    // two render over each other. Measured rather than guessed at a breakpoint:
    // whether they collide depends on the viewport, the browser's own chrome,
    // and how many lines the current tip wraps to — a media query cannot see
    // any of that. The tip is decorative, so it yields.
    //
    // Measuring is safe before showing: the tip is position:absolute and only
    // opacity-hidden, so it is laid out and has a real rect either way, which
    // is what lets this decide without a visible flash.
    var MIN_TIP_GAP = 8; // px of clear air required below the restore link

    function tipWouldCollide() {
      var restore = document.getElementById('first-run-restore');
      if (!restore) return false;              // not the first-run screen
      var rr = restore.getBoundingClientRect();
      if (rr.height <= 0) return false;        // present but not rendered
      var tr = el.getBoundingClientRect();
      if (tr.height <= 0) return false;
      return tr.top < rr.bottom + MIN_TIP_GAP;
    }

    function showTip() {
      if (tipWouldCollide()) {
        el.classList.remove('visible');
        return;
      }
      el.classList.add('visible');
    }

    // Rotation, orientation and the browser hiding its own toolbar all change
    // the answer, so re-decide rather than latching the first result.
    function onViewportChange() { showTip(); }
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);

    fetch('./modules/labels/loading-tips.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        // Shape is { firstRun: [...], inApp: [...] }, NOT a bare array.
        // Audience matters: on the first-run choice screen the user has no
        // routine, no tasks and no UI to point at, so an instructional tip
        // ("click your progress badge") is simply false there. Reuse the same
        // #first-run-restore probe tipWouldCollide() already does — that
        // element exists ONLY on the choice screen, so it is a free signal.
        // A missing pool just yields no tips; these are decorative.
        var onFirstRun = !!document.getElementById('first-run-restore');
        var tips = data && (onFirstRun ? data.firstRun : data.inApp);
        if (!tips || !tips.length) return;
        var i = Math.floor(Math.random() * tips.length);
        text.textContent = tips[i];
        showTip();
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
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('orientationchange', onViewportChange);
            return;
          }
          el.classList.remove('visible');
          setTimeout(function() {
            i = (i + 1) % tips.length;
            text.textContent = tips[i];
            // Re-measure per tip: a three-line tip collides where a one-line
            // tip does not, which is visible in the reported screenshots.
            showTip();
          }, 400);
        }, 4000);
      })
      .catch(function() { /* boot tips are decorative — a failed fetch just shows none */ });
  })();
