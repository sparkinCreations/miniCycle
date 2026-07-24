(function () {
    // Apply a pending restore FIRST — before the gate below reads localStorage
    // and before any app code runs. The restore is handed off via sessionStorage
    // because writing localStorage directly pre-reload gets CLOBBERED: the app
    // running behind the choice screen saves its in-memory state on unload,
    // overwriting the restored data (found by the rescue-loop E2E).
    try {
      var pendingRestore = sessionStorage.getItem('miniCycle_pendingRestore');
      if (pendingRestore) {
        sessionStorage.removeItem('miniCycle_pendingRestore');
        var restorePayload = JSON.parse(pendingRestore);
        if (restorePayload && restorePayload.type === 'miniCycle-backup' && restorePayload.keys && restorePayload.keys.miniCycleData) {
          var restoreNames = Object.keys(restorePayload.keys);
          for (var ri = 0; ri < restoreNames.length; ri++) {
            if (typeof restorePayload.keys[restoreNames[ri]] === 'string') {
              localStorage.setItem(restoreNames[ri], restorePayload.keys[restoreNames[ri]]);
            }
          }
        }
      }
    } catch (e) { /* invalid payload — fall through to normal first-run */ }

    // Show the choice screen until the user actually MAKES a choice. Boot creates
    // miniCycleData during startup (createInitialSchema25Data), so "data exists" is
    // NOT a reliable "returning user" signal — a user who reloads before choosing
    // would otherwise fall through to the default focus-mode flow. Gate on the
    // first-run decision instead:
    //   • no data at all           → first run → show
    //   • data exists, but onboarding not completed AND no durable choice recorded
    //                              → non-chooser → show again
    //   • onboarding done, OR a choice was recorded (learn mid-flow, create, sample)
    //                              → returning/decided → normal splash
    // ES5-safe (&&-chains, no optional chaining) to match the other inline scripts.
    var raw = null;
    try { raw = localStorage.getItem('miniCycleData'); } catch (e) { return; }
    if (raw) {
      var choiceMade = false, onboardingDone = false;
      try { choiceMade = localStorage.getItem('miniCycle_firstRunChoiceMade') === '1'; } catch (e) {}
      try {
        var parsed = JSON.parse(raw);
        onboardingDone = !!(parsed && parsed.settings && parsed.settings.onboardingCompleted);
      } catch (e) { onboardingDone = true; } // unparseable → treat as returning, don't trap
      if (choiceMade || onboardingDone) return; // decided or mid-flow → normal splash
    }

    var loader = document.getElementById('app-loader');
    var choice = document.getElementById('first-run-choice');
    var bottomBar = document.getElementById('first-run-bottom-bar');
    if (!loader || !choice) return;

    loader.classList.add('first-run-mode');
    loader.setAttribute('data-awaiting-choice', 'true');
    choice.hidden = false;
    if (bottomBar) bottomBar.hidden = false;
    try { performance.mark('mc:firstrun:choiceShown'); } catch (e) {}

    // Rotating use-case line (under the tagline) — same rhythm as the bottom
    // tips: fade out, swap, fade in. Stops once the screen is dismissed.
    var useCases = [
      '✈️ Pre-flight checklists',
      '🩺 Hourly nurse rounds',
      '🔍 QA inspections',
      '🍳 Opening & closing procedures',
      '🧹 Cleaning rounds',
      '🌅 Morning routines',
      '💪 Workout circuits',
      '📦 Packing lists you reuse'
    ];
    var useCaseEl = document.getElementById('first-run-usecase-text');
    if (useCaseEl) {
      var uc = 0;
      var ucTimer = setInterval(function () {
        // Stop when the choice screen is gone (loader dismissed after a pick).
        if (getComputedStyle(loader).display === 'none') { clearInterval(ucTimer); return; }
        // Ticker reveal: slide the old line up out of the clipped window…
        useCaseEl.classList.add('is-leaving');
        setTimeout(function () {
          uc = (uc + 1) % useCases.length;
          useCaseEl.textContent = useCases[uc];
          // …place the new line below the window (no transition)…
          useCaseEl.classList.remove('is-leaving');
          useCaseEl.classList.add('is-entering');
          void useCaseEl.offsetHeight; // force reflow so the jump isn't animated
          // …then let it rise into place.
          useCaseEl.classList.remove('is-entering');
        }, 330);
      }, 2800);
    }
    // NOTE: the Lite escape hatch reveal is CSS-driven (animation-delay), NOT a
    // JS timer. A slow boot saturates the main thread, so a setTimeout would be
    // starved until boot finishes — defeating the hint on exactly the devices
    // that need it. CSS animations run off the main thread, so the reveal fires
    // on time even mid-boot. If boot finishes first, the whole loader fades out
    // before the delay elapses, so the link is never seen. See critical.css.

    choice.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.first-run-btn') : null;
      if (!btn || btn.disabled) return;
      var value = btn.getAttribute('data-choice');
      try { sessionStorage.setItem('miniCycle_firstRunChoice', value); } catch (err) {}
      // Durable flag (survives relaunch) so a reload after choosing doesn't
      // re-show the choice screen — the gate above reads it. sessionStorage
      // handles same-tab routing; localStorage handles the cross-launch gate.
      try { localStorage.setItem('miniCycle_firstRunChoiceMade', '1'); } catch (err) {}
      try { performance.mark('mc:firstrun:choiceTapped'); } catch (err) {}

      // Button takeover: the tapped button becomes the progress surface.
      var btns = choice.querySelectorAll('.first-run-btn');
      for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; }
      btn.classList.add('is-chosen');
      btn.textContent = btn.getAttribute('data-busy') || 'Setting up…';

      loader.setAttribute('data-awaiting-choice', 'false');
      try {
        document.dispatchEvent(new CustomEvent('firstrun:choice', { detail: { choice: value } }));
      } catch (err) {}
    });

    // Restore-from-backup (pairs with the error screen's backup button).
    // Validates the file, writes the raw localStorage keys back, reloads —
    // the reload takes the returning-user path with the restored data.
    var restoreBtn = document.getElementById('first-run-restore');
    var restoreFile = document.getElementById('first-run-restore-file');
    if (restoreBtn && restoreFile) {
      restoreBtn.addEventListener('click', function () { restoreFile.click(); });
      restoreFile.addEventListener('change', function () {
        var file = restoreFile.files && restoreFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var parsed = null;
          try { parsed = JSON.parse(reader.result); } catch (err) {}
          if (!parsed || parsed.type !== 'miniCycle-backup' || !parsed.keys || !parsed.keys.miniCycleData) {
            alert('That file is not a valid miniCycle backup.');
            restoreFile.value = '';
            return;
          }
          // Hand off via sessionStorage; the NEXT load applies it before any app
          // code runs. Writing localStorage here would be clobbered by the
          // running app's save-on-unload during the reload.
          try {
            sessionStorage.setItem('miniCycle_pendingRestore', reader.result);
          } catch (err) {
            alert('Restore failed: ' + err.message);
            return;
          }
          location.reload();
        };
        reader.readAsText(file);
      });
    }
  })();
