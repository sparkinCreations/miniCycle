(function () {
    // The DECISION (and the pending-restore hand-off it depends on) now happens
    // in the head's pre-paint reader, which records it as `mc-first-run` on
    // <html>; critical.css lays the screen out from the first frame. This
    // controller owns BEHAVIOUR only — reading the class instead of re-deriving
    // it keeps one source of truth and, critically, keeps the reveal out of the
    // post-paint phase where it used to cost ~0.2 CLS.
    if (!document.documentElement.classList.contains('mc-first-run')) return;

    var loader = document.getElementById('app-loader');
    var choice = document.getElementById('first-run-choice');
    if (!loader || !choice) return;

    // Kept for JS that inspects the loader's mode; styling no longer depends on
    // it (critical.css keys off html.mc-first-run so it applies pre-paint).
    loader.classList.add('first-run-mode');
    loader.setAttribute('data-awaiting-choice', 'true');
    try { performance.mark('mc:firstrun:choiceShown'); } catch (e) { /* Performance API unavailable — marks are diagnostics only */ }

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
    var useCaseA = document.getElementById('first-run-usecase-text');
    var useCaseB = document.getElementById('first-run-usecase-text-b');
    if (useCaseA && useCaseB) {
      var uc = 0;
      var showingA = true;
      var ucTimer = setInterval(function () {
        // Stop when the choice screen is gone (loader dismissed after a pick).
        if (getComputedStyle(loader).display === 'none') { clearInterval(ucTimer); return; }
        uc = (uc + 1) % useCases.length;
        var incoming = showingA ? useCaseB : useCaseA;
        var outgoing = showingA ? useCaseA : useCaseB;
        // True crossfade: the incoming layer fades IN at the same time the
        // outgoing fades OUT (both animate together), so a line is always on
        // screen — no blank frame between use cases.
        incoming.textContent = useCases[uc];
        incoming.classList.add('is-active');
        outgoing.classList.remove('is-active');
        showingA = !showingA;
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
      try { sessionStorage.setItem('miniCycle_firstRunChoice', value); } catch (err) { /* storage unavailable — same-tab routing degrades gracefully */ }
      // Durable flag (survives relaunch) so a reload after choosing doesn't
      // re-show the choice screen — the gate above reads it. sessionStorage
      // handles same-tab routing; localStorage handles the cross-launch gate.
      try { localStorage.setItem('miniCycle_firstRunChoiceMade', '1'); } catch (err) { /* storage unavailable — worst case the choice screen re-shows */ }
      try { performance.mark('mc:firstrun:choiceTapped'); } catch (err) { /* Performance API unavailable — marks are diagnostics only */ }

      // Button takeover: the tapped button becomes the progress surface.
      var btns = choice.querySelectorAll('.first-run-btn');
      for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; }
      btn.classList.add('is-chosen');
      btn.textContent = btn.getAttribute('data-busy') || 'Setting up…';

      loader.setAttribute('data-awaiting-choice', 'false');
      try {
        document.dispatchEvent(new CustomEvent('firstrun:choice', { detail: { choice: value } }));
      } catch (err) { /* CustomEvent constructor unsupported — boot proceeds without the signal */ }
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
          try { parsed = JSON.parse(reader.result); } catch (err) { /* invalid JSON — the null check below shows the error */ }
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
