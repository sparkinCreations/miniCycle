/**
 * PreferencesPresets Tests
 * Tests for modules/ui/preferencesPresets.js
 *
 * Covers the color-preset subsystem of the preferences panel:
 *  - escapeHtml / createPresetSwatch (pure string/HTML output + XSS & CSS-injection guards)
 *  - applyQuickPreset (built-in preset orchestration of callbacks)
 *  - CRUD via injected mock AppState: savePreset, loadPreset, renamePreset, deletePreset
 *  - export/import round-trip + import validation/sanitization (strips unknown keys,
 *    rejects bad colors, Unicode-safe base64)
 *
 * All state effects go through a mock AppState (get/update over a plain object),
 * and modal/notification deps are stubbed.
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runPreferencesPresetsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/preferencesPresets.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>PreferencesPresets Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const eq = (a, b, label) => { if (a !== b) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

    // Mock AppState over a plain object.
    function makeAppState(initial = { settings: {} }) {
        let state = initial;
        return {
            get: () => state,
            update: (producer) => { producer(state); return state; },
            isReady: () => true
        };
    }
    const noopDeps = (over = {}) => ({ showNotification: () => {}, ...over });
    const noopRender = () => {};

    // ── Module loading (kept) ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => { if (!mod) throw new Error('Module is falsy'); });

    await test('key functions are exported', () => {
        ['applyQuickPreset', 'savePreset', 'loadPreset', 'renamePreset', 'deletePreset',
         'exportPreset', 'importPreset', 'createPresetSwatch', 'escapeHtml', 'renderQuickPresets']
            .forEach(fn => { if (typeof mod[fn] !== 'function') throw new Error('missing ' + fn); });
    });

    // ── escapeHtml ────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ escapeHtml</h4>';

    await test('escapeHtml escapes angle brackets', () => {
        const r = mod.escapeHtml('<script>alert("xss")</script>');
        if (r.includes('<') || r.includes('>')) throw new Error('not escaped: ' + r);
    });

    await test('escapeHtml leaves plain text unchanged', () => {
        eq(mod.escapeHtml('My Preset'), 'My Preset', 'plain text');
    });

    // ── createPresetSwatch ────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 createPresetSwatch</h4>';

    await test('createPresetSwatch uses provided colors', () => {
        const html = mod.createPresetSwatch({ appBg: '#123456', taskListBg: '#abcdef' });
        if (!html.includes('#123456')) throw new Error('missing appBg color');
        if (!html.includes('#abcdef')) throw new Error('missing taskListBg color');
    });

    await test('createPresetSwatch falls back to defaults for missing colors', () => {
        const html = mod.createPresetSwatch({});
        if (!html.includes('#4c79ff')) throw new Error('missing default appBg');
    });

    await test('createPresetSwatch replaces invalid color with safe gray (CSS-injection guard)', () => {
        const html = mod.createPresetSwatch({ appBg: 'red; background:url(evil)' });
        if (html.includes('url(evil)')) throw new Error('CSS injection not blocked');
        if (!html.includes('#cccccc')) throw new Error('invalid color not replaced with #cccccc');
    });

    await test('createPresetSwatch accepts named CSS colors', () => {
        const html = mod.createPresetSwatch({ appBg: 'rebeccapurple' });
        if (!html.includes('rebeccapurple')) throw new Error('named color rejected');
    });

    // ── applyQuickPreset ──────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ applyQuickPreset</h4>';

    await test('unknown preset key is a no-op (no callbacks fired)', () => {
        let fired = false;
        mod.applyQuickPreset('does-not-exist', {
            resetAllColors: () => { fired = true; },
            pushToUndoStack: () => { fired = true; },
            saveColor: () => { fired = true; }
        });
        if (fired) throw new Error('callbacks should not fire for unknown preset');
    });

    await test('"default" preset delegates to resetAllColors only', () => {
        const calls = [];
        mod.applyQuickPreset('default', {
            resetAllColors: () => calls.push('reset'),
            pushToUndoStack: () => calls.push('push'),
            saveColor: () => calls.push('save')
        });
        eq(calls.length, 1, 'one call');
        eq(calls[0], 'reset', 'reset called');
    });

    await test('built-in preset pushes undo, saves each color, refreshes UI', () => {
        const saved = {};
        const calls = [];
        mod.applyQuickPreset('warm', {
            pushToUndoStack: () => calls.push('push'),
            saveColor: (k, v) => { saved[k] = v; },
            loadSavedColors: () => calls.push('load'),
            updatePreview: () => calls.push('preview'),
            isDefaultTheme: () => false,
            applyCustomColors: () => calls.push('apply'),
            updateUndoButton: () => calls.push('undoBtn'),
            showNotification: () => {}
        });
        if (!calls.includes('push')) throw new Error('did not push undo');
        if (!calls.includes('load')) throw new Error('did not reload colors');
        // warm preset has an appBg color
        eq(saved.appBg, '#ff6b6b', 'warm appBg saved');
        // isDefaultTheme=false => applyCustomColors NOT called
        if (calls.includes('apply')) throw new Error('applyCustomColors should be skipped when not default theme');
    });

    await test('built-in preset applies custom colors when isDefaultTheme true', () => {
        let applied = false;
        mod.applyQuickPreset('cool', {
            pushToUndoStack: () => {},
            saveColor: () => {},
            loadSavedColors: () => {},
            updatePreview: () => {},
            isDefaultTheme: () => true,
            applyCustomColors: () => { applied = true; },
            updateUndoButton: () => {},
            showNotification: () => {}
        });
        if (!applied) throw new Error('applyCustomColors not called for default theme');
    });

    // ── savePreset ────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">💾 savePreset</h4>';

    await test('savePreset appends a preset built from current customColors', () => {
        const as = makeAppState({ settings: { customColors: { appBg: '#111111', taskBg: '#222222' } } });
        mod.savePreset('My Theme', noopDeps({ AppState: as }), noopRender);
        const presets = as.get().settings.savedColorPresets;
        eq(presets.length, 1, 'one preset saved');
        eq(presets[0].name, 'My Theme', 'preset name');
        eq(presets[0].colors.appBg, '#111111', 'preset color copied');
    });

    await test('savePreset strips null/undefined color values', () => {
        const as = makeAppState({ settings: { customColors: { appBg: '#111111', taskBg: null, taskText: undefined } } });
        mod.savePreset('Clean', noopDeps({ AppState: as }), noopRender);
        const colors = as.get().settings.savedColorPresets[0].colors;
        if ('taskBg' in colors) throw new Error('null value not stripped');
        if ('taskText' in colors) throw new Error('undefined value not stripped');
        eq(colors.appBg, '#111111', 'valid value kept');
    });

    await test('savePreset is a no-op without AppState', () => {
        // Should not throw
        mod.savePreset('X', noopDeps({ AppState: null }), noopRender);
    });

    // ── loadPreset ────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📂 loadPreset</h4>';

    await test('loadPreset merges preset colors onto customColors', () => {
        const as = makeAppState({
            settings: {
                customColors: { appBg: '#000000', existingKey: '#999999' },
                savedColorPresets: [{ id: 'p1', name: 'P1', colors: { appBg: '#ff0000' } }]
            }
        });
        const calls = [];
        mod.loadPreset('p1', noopDeps({ AppState: as }), {
            pushToUndoStack: () => calls.push('push'),
            loadSavedColors: () => calls.push('load'),
            updatePreview: () => calls.push('preview'),
            applyCustomColors: () => calls.push('apply'),
            updateUndoButton: () => calls.push('undo')
        });
        const cc = as.get().settings.customColors;
        eq(cc.appBg, '#ff0000', 'preset value overrides');
        eq(cc.existingKey, '#999999', 'non-preset key preserved');
        if (!calls.includes('apply')) throw new Error('applyCustomColors not called');
    });

    await test('loadPreset with unknown id notifies error and does not push undo', () => {
        const as = makeAppState({ settings: { savedColorPresets: [] } });
        let pushed = false, errored = false;
        mod.loadPreset('missing', noopDeps({ AppState: as, showNotification: (m, t) => { if (t === 'error') errored = true; } }), {
            pushToUndoStack: () => { pushed = true; },
            loadSavedColors: () => {}, updatePreview: () => {}, applyCustomColors: () => {}, updateUndoButton: () => {}
        });
        if (pushed) throw new Error('should not push undo for missing preset');
        if (!errored) throw new Error('expected error notification');
    });

    // ── renamePreset ──────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✏️ renamePreset</h4>';

    await test('renamePreset updates the matching preset name (trimmed)', () => {
        const as = makeAppState({ settings: { savedColorPresets: [{ id: 'p1', name: 'Old', colors: {} }] } });
        mod.renamePreset('p1', '  New Name  ', noopDeps({ AppState: as }), noopRender);
        eq(as.get().settings.savedColorPresets[0].name, 'New Name', 'renamed + trimmed');
    });

    await test('renamePreset with blank name is a no-op', () => {
        const as = makeAppState({ settings: { savedColorPresets: [{ id: 'p1', name: 'Old', colors: {} }] } });
        mod.renamePreset('p1', '   ', noopDeps({ AppState: as }), noopRender);
        eq(as.get().settings.savedColorPresets[0].name, 'Old', 'name unchanged on blank');
    });

    // ── deletePreset ──────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🗑️ deletePreset</h4>';

    await test('deletePreset removes preset after confirmation', () => {
        const as = makeAppState({ settings: { savedColorPresets: [{ id: 'p1', name: 'A', colors: {} }, { id: 'p2', name: 'B', colors: {} }] } });
        mod.deletePreset('p1', noopDeps({
            AppState: as,
            showConfirmationModal: ({ callback }) => callback(true) // user confirms
        }), noopRender);
        const ids = as.get().settings.savedColorPresets.map(p => p.id);
        if (ids.includes('p1')) throw new Error('p1 not deleted');
        if (!ids.includes('p2')) throw new Error('p2 wrongly deleted');
    });

    await test('deletePreset keeps preset when confirmation is declined', () => {
        const as = makeAppState({ settings: { savedColorPresets: [{ id: 'p1', name: 'A', colors: {} }] } });
        mod.deletePreset('p1', noopDeps({
            AppState: as,
            showConfirmationModal: ({ callback }) => callback(false) // user cancels
        }), noopRender);
        eq(as.get().settings.savedColorPresets.length, 1, 'preset kept on cancel');
    });

    await test('deletePreset with unknown id is a no-op', () => {
        const as = makeAppState({ settings: { savedColorPresets: [{ id: 'p1', name: 'A', colors: {} }] } });
        let modalShown = false;
        mod.deletePreset('nope', noopDeps({ AppState: as, showConfirmationModal: () => { modalShown = true; } }), noopRender);
        if (modalShown) throw new Error('should not prompt for unknown preset');
        eq(as.get().settings.savedColorPresets.length, 1, 'unchanged');
    });

    // ── export / import round-trip & validation ───────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Export / Import</h4>';

    // Helper: encode a preset payload the same way exportPreset does.
    const encode = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));

    await test('importPreset adds a sanitized preset and tags name "(imported)"', () => {
        const as = makeAppState({ settings: {} });
        const code = encode({ name: 'Shared', version: 2, colors: { appBg: '#abcdef', taskBg: '#fedcba' } });
        mod.importPreset(code, noopDeps({ AppState: as }), noopRender);
        const presets = as.get().settings.savedColorPresets;
        eq(presets.length, 1, 'imported one');
        eq(presets[0].name, 'Shared (imported)', 'name tagged');
        eq(presets[0].colors.appBg, '#abcdef', 'valid color imported');
    });

    await test('importPreset strips unknown keys and invalid color values', () => {
        const as = makeAppState({ settings: {} });
        const code = encode({
            name: 'Dirty', version: 2,
            colors: { appBg: '#112233', evilKey: 'x', taskBg: 'not-a-hex', showBgPattern: true }
        });
        mod.importPreset(code, noopDeps({ AppState: as }), noopRender);
        const colors = as.get().settings.savedColorPresets[0].colors;
        if ('evilKey' in colors) throw new Error('unknown key not stripped');
        if ('taskBg' in colors) throw new Error('invalid hex not stripped');
        eq(colors.appBg, '#112233', 'valid color kept');
        eq(colors.showBgPattern, true, 'valid boolean key kept');
    });

    await test('importPreset rejects payload with no valid colors (error notify, no save)', () => {
        const as = makeAppState({ settings: {} });
        let errored = false;
        const code = encode({ name: 'Empty', version: 2, colors: { evilKey: 'x' } });
        mod.importPreset(code, noopDeps({ AppState: as, showNotification: (m, t) => { if (t === 'error') errored = true; } }), noopRender);
        if (as.get().settings.savedColorPresets) throw new Error('should not save invalid preset');
        if (!errored) throw new Error('expected error notification');
    });

    await test('importPreset rejects malformed base64 / JSON gracefully', () => {
        const as = makeAppState({ settings: {} });
        let errored = false;
        mod.importPreset('!!!not-base64!!!', noopDeps({ AppState: as, showNotification: (m, t) => { if (t === 'error') errored = true; } }), noopRender);
        if (!errored) throw new Error('expected error notification on garbage input');
    });

    await test('importPreset rejects payload missing name', () => {
        const as = makeAppState({ settings: {} });
        let errored = false;
        const code = encode({ version: 2, colors: { appBg: '#112233' } });
        mod.importPreset(code, noopDeps({ AppState: as, showNotification: (m, t) => { if (t === 'error') errored = true; } }), noopRender);
        if (!errored) throw new Error('expected error notification for missing name');
        if (as.get().settings.savedColorPresets) throw new Error('should not save nameless preset');
    });

    await test('export → import round-trip preserves valid colors (Unicode-safe name)', () => {
        // Export side
        const sourceState = makeAppState({ settings: { savedColorPresets: [{ id: 's1', name: 'Café ☕', colors: { appBg: '#0a0a0a' } }] } });
        let capturedCode = null;
        // Stub clipboard so exportPreset captures the code via the resolve path or fallback prompt.
        const origClipboard = navigator.clipboard;
        try {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { writeText: (txt) => { capturedCode = txt; return Promise.resolve(); } }
            });
            mod.exportPreset('s1', noopDeps({ AppState: sourceState }));
        } finally {
            if (origClipboard) {
                Object.defineProperty(navigator, 'clipboard', { configurable: true, value: origClipboard });
            }
        }
        if (!capturedCode) throw new Error('export did not produce a code');
        // Import side
        const destState = makeAppState({ settings: {} });
        mod.importPreset(capturedCode, noopDeps({ AppState: destState }), noopRender);
        const imported = destState.get().settings.savedColorPresets[0];
        eq(imported.name, 'Café ☕ (imported)', 'unicode name round-trips');
        eq(imported.colors.appBg, '#0a0a0a', 'color round-trips');
    });

    // ── renderQuickPresets (DOM output) ───────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧱 renderQuickPresets</h4>';

    await test('renderQuickPresets populates container with one button per preset', () => {
        const container = document.createElement('div');
        mod.renderQuickPresets(container);
        const btns = container.querySelectorAll('.quick-preset-btn');
        if (btns.length === 0) throw new Error('no preset buttons rendered');
        // each has data-preset and a name span
        const first = btns[0];
        if (!first.dataset.preset) throw new Error('button missing data-preset');
        if (!first.querySelector('.quick-preset-name')) throw new Error('button missing name span');
    });

    await test('renderQuickPresets is a no-op for null container (no throw)', () => {
        mod.renderQuickPresets(null);
    });

    // ── results ──────────────────────────────────────────────────────────────
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
