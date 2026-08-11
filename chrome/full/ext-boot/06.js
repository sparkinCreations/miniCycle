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
    try { raw = localStorage.getItem('miniCycleData'); } catch (e) { return; /* storage unavailable — normal splash */ }
    if (raw) {
      var choiceMade = false, onboardingDone = false, hasRoutines = false;
      try { choiceMade = localStorage.getItem('miniCycle_firstRunChoiceMade') === '1'; } catch (e) { /* storage unavailable — treat as not chosen */ }
      try {
        var parsed = JSON.parse(raw);
        onboardingDone = !!(parsed && parsed.settings && parsed.settings.onboardingCompleted);
        // OWNING A ROUTINE is the durable "established user" signal that the
        // flags above are not. Boot's createInitialSchema25Data writes
        // data.cycles = {}, so a fresh user who reloads before choosing still
        // has ZERO cycles and correctly sees this screen — the reason the
        // comment above rejects bare "data exists" does not apply to cycles.
        // Anyone WITH a routine has used the app, and every action on this
        // screen assumes an empty one (its "restore from backup" invites
        // overwriting live data), so never trap them here because a graduation
        // flag failed to write — app close mid-flow, crash, PWA kill.
        // Aug 2026 lockout: 2 routines + 2 completed cycles, shown this screen
        // on every load with no route back to their own data.
        var mcCycles = parsed && parsed.data && parsed.data.cycles;
        hasRoutines = !!(mcCycles && Object.keys(mcCycles).length > 0);
      } catch (e) { onboardingDone = true; } // unparseable → treat as returning, don't trap
      if (choiceMade || onboardingDone || hasRoutines) return; // decided, mid-flow, or established → normal splash
    }

    document.documentElement.classList.add('mc-first-run');
  })();
