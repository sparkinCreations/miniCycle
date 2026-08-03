/**
 * BootSW Tests
 * Tests for boot-sw.js — the deferred external SW-registration/update script
 * (extracted from miniCycle.html's inline <head> block, Aug 2026).
 *
 * boot-sw.js is a CLASSIC script (no exports): its public surface is four
 * window.* helpers plus event listeners, and importing it executes its side
 * effects. The first test asserts the safety precondition for that import:
 * the suite page loads the same version.js the server serves, so
 * verifyVersionFresh() sees matching versions and the cache-clearing
 * self-heal branch stays cold. If that precondition ever breaks, this suite
 * fails LOUDLY on test 1 instead of mysteriously reloading mid-run.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runBootSwTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();

    resultsDiv.innerHTML = '<h2>BootSW Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    await test('precondition: page and server versions match (self-heal stays cold)', async () => {
        if (!window.APP_VERSION) throw new Error('version.js not loaded in suite page');
        const text = await fetch(`/version.js?_cb=${Date.now()}`, { cache: 'no-store' }).then(r => r.text());
        const m = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (!m || m[1] !== String(window.APP_VERSION)) {
            throw new Error(`server ${m && m[1]} vs page ${window.APP_VERSION} — importing boot-sw.js would trigger the self-heal reload`);
        }
    });

    await test('importing boot-sw.js defines the four window helpers', async () => {
        await import(`../boot-sw.js?v=${cacheBuster}`);
        for (const fn of ['checkForUpdates', 'getServiceWorkerInfo', 'forceServiceWorkerUpdate', 'installApp']) {
            if (typeof window[fn] !== 'function') throw new Error(`window.${fn} missing after import`);
        }
    });

    await test('installApp without a captured install prompt is a safe no-op', () => {
        // No beforeinstallprompt has fired in the suite page — must not throw.
        window.installApp();
    });

    await test('forceServiceWorkerUpdate delegates to checkForUpdates', async () => {
        const orig = window.checkForUpdates;
        let called = false;
        window.checkForUpdates = async () => { called = true; };
        try {
            await window.forceServiceWorkerUpdate();
        } finally {
            window.checkForUpdates = orig;
        }
        if (!called) throw new Error('forceServiceWorkerUpdate did not delegate to checkForUpdates');
    });

    await test('checkForUpdates emits app:showNotification events (zero-globals bridge)', async () => {
        const events = [];
        const listener = (e) => events.push(e.detail);
        document.addEventListener('app:showNotification', listener);
        try {
            await window.checkForUpdates();
            await new Promise(r => setTimeout(r, 100)); // let queued notifications land
        } finally {
            document.removeEventListener('app:showNotification', listener);
        }
        if (!events.length) throw new Error('no app:showNotification events dispatched');
        if (!events.every(d => d && typeof d.message === 'string')) {
            throw new Error('malformed notification detail');
        }
    });

    await test('getServiceWorkerInfo reports a support/registration shape without throwing', async () => {
        const info = await window.getServiceWorkerInfo();
        if (!info || typeof info !== 'object' || typeof info.supported !== 'boolean') {
            throw new Error(`unexpected shape: ${JSON.stringify(info)}`);
        }
    });

    // Results
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
