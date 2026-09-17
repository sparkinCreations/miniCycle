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
    // Counterpart list lives in modules/labels/loading-tips.json ("useCases"),
    // which the Welcome Screen reads. Kept inline here because this line must
    // paint before any fetch could resolve — keep the two in sync.
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

    // Pre-boot welcome splash for the create/sample picks. Mounts the SAME
    // #first-run-splash the onboarding module builds (ids, classes, per-char
    // --char-index / --letter-pos, --last-char-index on the container) the
    // moment the user taps, so the letter cascade runs while the module graph
    // is still downloading instead of after boot finishes. onboardingSplash
    // adopts this element via the --preboot marker class and settles its
    // completion promise when the already-running animation ends, so the
    // creation dialog opens at max(boot, splash) rather than boot + splash.
    // Measured before this: ~7 s from tap to dialog on wifi, ~14 s on slow 4G,
    // with ~5 s of that the splash queued behind boot. ES5 only (pre-gate).
    // The title is hardcoded: the label system is not loaded yet, and the
    // first run always speaks the default vocabulary.
    function showPrebootSplash() {
      if (document.getElementById('first-run-splash')) return;
      var titleText = 'Welcome to miniCycle';
      var splash = document.createElement('div');
      splash.id = 'first-run-splash';
      splash.className = 'first-run-splash first-run-splash--preboot';
      splash.setAttribute('aria-live', 'polite');
      var title = document.createElement('h2');
      title.id = 'first-run-splash-title';
      title.className = 'first-run-splash__title';
      title.setAttribute('aria-label', titleText);
      var words = titleText.split(' ');
      var lineTexts = [words.slice(0, words.length - 1).join(' '), words[words.length - 1]];
      var globalCharIndex = 0;
      var maxCharIndex = 0;
      for (var li = 0; li < lineTexts.length; li++) {
        var line = document.createElement('div');
        line.className = 'first-run-splash__line';
        var chars = lineTexts[li].split('');
        var lineCenter = (chars.length - 1) / 2;
        var wordGroup = null;
        for (var ci = 0; ci < chars.length; ci++) {
          var charIndex = globalCharIndex++;
          if (charIndex > maxCharIndex) maxCharIndex = charIndex;
          var ch = chars[ci];
          var isSpace = ch === ' ';
          var span = document.createElement('span');
          span.className = 'first-run-splash__char' + (isSpace ? ' first-run-splash__char--space' : '');
          span.style.setProperty('--char-index', String(charIndex));
          span.style.setProperty('--letter-pos', String(ci - lineCenter));
          span.setAttribute('aria-hidden', 'true');
          span.textContent = ch;
          if (isSpace) {
            wordGroup = null;
            line.appendChild(span);
          } else {
            if (!wordGroup) {
              wordGroup = document.createElement('span');
              wordGroup.className = 'first-run-splash__word';
              line.appendChild(wordGroup);
            }
            wordGroup.appendChild(span);
          }
        }
        title.appendChild(line);
      }
      splash.appendChild(title);
      splash.style.setProperty('--last-char-index', String(maxCharIndex));
      document.body.appendChild(splash);
      try { performance.mark('mc:firstrun:splashMounted'); } catch (err) { /* Performance API unavailable — marks are diagnostics only */ }
      // Same-session flag: if this splash is gone by the time the module runs
      // (watchdog below, or boot error cleanup), the module must NOT play a
      // second one. Consumed by onboardingSplash on adoption or skip.
      try { sessionStorage.setItem('miniCycle_prebootSplash', '1'); } catch (err) { /* storage unavailable — worst case the module plays its own splash */ }
      // Tap-to-skip works before the module is here: record the request and
      // let the module honour it the moment it adopts the element.
      splash.addEventListener('pointerdown', function () {
        splash.setAttribute('data-skip', '1');
      });
      // Safety net: if boot never adopts this element (module graph failed,
      // rescue screen, or a very slow boot), fade it out so nothing important
      // is left covered. 12 s is the same ceiling the module gives its own
      // splash and lands before the 16 s Lite fallback. Adoption clears the
      // guard; if boot arrives later, the session flag above stops the module
      // from playing a second splash, so the dialog simply opens on boot.
      setTimeout(function () {
        if (splash.getAttribute('data-adopted') === '1' || !splash.parentNode) return;
        splash.classList.add('first-run-splash--fading');
        setTimeout(function () {
          if (splash.parentNode) splash.parentNode.removeChild(splash);
        }, 700);
      }, 12000);
    }

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
      if (value === 'create' || value === 'sample') showPrebootSplash();

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

    // Restore-from-backup. THE APP WRITES TWO DIFFERENT BACKUP FORMATS and both
    // have to be accepted here:
    //   • Settings -> Create Backup : { schemaVersion, miniCycleData: "<string>", liteStorage? }
    //   • pre-boot rescue screen    : { type: 'miniCycle-backup', keys: { ...raw localStorage } }
    // Until v2.506 this accepted ONLY the second, so every backup a user actually
    // made was rejected here with "not a valid miniCycle backup" — while the same
    // file restored fine from Settings. Reported from a phone, not caught by a test.
    //
    // Normalizing to ONE internal shape here is deliberate: the sessionStorage
    // handoff stays single-format, so the pre-load applier in <head> keeps its
    // single check and cannot drift out of sync with this list of formats.
    // ES5 only — this is a pre-gate inline script (see the head banner).
    var restoreBtn = document.getElementById('first-run-restore');
    var restoreFile = document.getElementById('first-run-restore-file');

    // Only keys the exporters themselves collect are restorable, so a hand-edited
    // file cannot use this path to write arbitrary localStorage entries.
    var RESTORE_EXTRA_KEYS = ['lastUsedMiniCycle', 'milestoneUnlocks', 'darkModeEnabled', 'currentTheme'];
    function isRestorableKey(name) {
      return name.indexOf('miniCycle') === 0
          || name.indexOf('__miniCycle') === 0
          || RESTORE_EXTRA_KEYS.indexOf(name) !== -1;
    }

    function collectStringKeys(source, into) {
      var names = Object.keys(source), i, value;
      for (i = 0; i < names.length; i++) {
        value = source[names[i]];
        if (typeof value === 'string' && isRestorableKey(names[i])) {
          into[names[i]] = value;
        }
      }
      return into;
    }

    // Returns a localStorage key/value map, or null if this is not a backup we know.
    function normalizeBackupKeys(parsed) {
      if (!parsed || typeof parsed !== 'object') return null;

      // Rescue-screen export — already a raw localStorage map.
      if (parsed.type === 'miniCycle-backup' && parsed.keys
          && typeof parsed.keys.miniCycleData === 'string') {
        return collectStringKeys(parsed.keys, {});
      }

      // Settings export — one stringified payload plus an optional lite snapshot.
      if (typeof parsed.miniCycleData === 'string') {
        var keys = { miniCycleData: parsed.miniCycleData };
        if (parsed.liteStorage && typeof parsed.liteStorage === 'object') {
          collectStringKeys(parsed.liteStorage, keys);
        }
        return keys;
      }

      return null;
    }

    if (restoreBtn && restoreFile) {
      restoreBtn.addEventListener('click', function () { restoreFile.click(); });
      restoreFile.addEventListener('change', function () {
        var file = restoreFile.files && restoreFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var parsed = null;
          try { parsed = JSON.parse(reader.result); } catch (err) { /* invalid JSON — the null check below shows the error */ }
          var keys = normalizeBackupKeys(parsed);
          if (!keys) {
            alert('That file is not a valid miniCycle backup.');
            restoreFile.value = '';
            return;
          }
          // Hand off via sessionStorage; the NEXT load applies it before any app
          // code runs. Writing localStorage here would be clobbered by the
          // running app's save-on-unload during the reload.
          try {
            sessionStorage.setItem('miniCycle_pendingRestore', JSON.stringify({
              type: 'miniCycle-backup',
              keys: keys
            }));
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
