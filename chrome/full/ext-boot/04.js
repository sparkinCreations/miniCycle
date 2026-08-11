(function() {
  // Guarded like the block at ~line 168 (see version-check block note):
  // forced-full users on pre-es2020 browsers bypass the feature gate.
  var g = typeof globalThis !== 'undefined' ? globalThis : {};
  var v = g.APP_VERSION || 'dev-local';
  // Bundled dist: version.js also sets __MC_MODULE_MAP (source path → hashed
  // URL). Preload the hashed URL BARE so it matches the exact URL the boot
  // chain imports; dev has no map and keeps the ?v= form.
  var map = g.__MC_MODULE_MAP || null;
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
  var head = document.head;
  for (var i = 0; i < modules.length; i++) {
    var hashed = map && map[modules[i].slice(1)]; // './x' → '/x' (map keys are root-absolute)
    var link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = hashed || (modules[i] + '?v=' + v);
    head.appendChild(link);
  }
})();
