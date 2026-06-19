// [chrome-ext build] "Open in full tab" escape hatch. Do not edit by hand.
(function () {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.create) return;
  // Only relevant in the narrow side panel — in a full tab the app is already
  // wide, so the "open in full tab" control would just spawn a duplicate.
  if (window.innerWidth > 600) return;
  function addButton() {
    if (document.getElementById('ext-fulltab-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'ext-fulltab-btn';
    btn.type = 'button';
    btn.title = 'Open in full tab';
    btn.setAttribute('aria-label', 'Open miniCycle in a full browser tab');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>';
    btn.addEventListener('click', function () {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
      // Move, don't duplicate: close the side panel so we don't leave two live
      // instances writing to the same chrome-extension:// localStorage. No-op if
      // window.close() is blocked in this context (tab still opens regardless).
      try { window.close(); } catch (e) {}
    });
    document.body.appendChild(btn);
  }
  if (document.body) addButton();
  else document.addEventListener('DOMContentLoaded', addButton);
})();
