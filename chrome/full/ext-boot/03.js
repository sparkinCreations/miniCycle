(function() {
  var v = globalThis.APP_VERSION || 'dev-local';
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
    var link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = modules[i] + '?v=' + v;
    head.appendChild(link);
  }
})();
