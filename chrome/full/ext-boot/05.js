(function() {
  // Guarded like the block at ~line 168 (see version-check block note):
  // forced-full users on pre-es2020 browsers bypass the feature gate.
  var g = typeof globalThis !== 'undefined' ? globalThis : {};
  var v = g.APP_VERSION || 'dev-local';
  // Bundled dist: version.js also sets __MC_MODULE_MAP (source path → hashed
  // URL). Preload the hashed URL BARE so it matches the exact URL the boot
  // chain imports; dev has no map and keeps the ?v= form.
  var map = g.__MC_MODULE_MAP || null;
  var head = document.head;
  var link;
  // Bundled dist: version.js also lists every hashed file boot imports
  // (build-web.cjs computeBootPreload). Preload all of them so the phases stop
  // waiting on one download wave after another; the hand list below covers dev.
  var bootPreload = map && g.__MC_BOOT_PRELOAD;
  // Staged: the hand list below goes first so the boot chain is not starved of
  // bandwidth; the full list follows once parsing is done and boot is starting.
  if (bootPreload && bootPreload.length) {
    document.addEventListener('DOMContentLoaded', function () {
      for (var j = 0; j < bootPreload.length; j++) {
        var l = document.createElement('link');
        l.rel = 'modulepreload';
        l.href = bootPreload[j];
        head.appendChild(l);
      }
    });
  }
  var modules = [
    './miniCycle-main.js',
    './modules/boot/orchestrator.js',
    './modules/boot/coreBoot.js',
    './modules/boot/featureBoot.js',
    './modules/boot/uiBoot.js',
    './modules/boot/moduleLoader.js',
    './modules/boot/moduleManifests.js',
    './modules/core/appState.js',
    './modules/core/appGlobalState.js',
    './modules/core/appInit.js',
    './modules/utils/globalUtils.js',
    './modules/utils/debugMode.js',
    './modules/utils/storageUtils.js',
    './modules/utils/errorHandler.js',
    './modules/utils/notifications.js'
  ];
  for (var i = 0; i < modules.length; i++) {
    var hashed = map && map[modules[i].slice(1)]; // './x' → '/x' (map keys are root-absolute)
    link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = hashed || (modules[i] + '?v=' + v);
    head.appendChild(link);
  }
})();
