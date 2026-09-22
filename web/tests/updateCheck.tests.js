/**
 * UpdateCheck Tests
 * Tests for modules/utils/updateCheck.js — "Check for Updates" per platform.
 * fetch and the service-worker registration are injected, so nothing here
 * touches the network or the page's own service worker.
 */

import { createProtectedTest } from './testHelpers.js';

export async function runUpdateCheckTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/updateCheck.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>UpdateCheck Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const okFetch = (version) => async () => ({ ok: true, text: async () => `globalThis.APP_VERSION = '${version}';\nglobalThis.CACHE_VERSION = 1;` });
    const failFetch = async () => { throw new Error('offline'); };
    const wire = (notes, version = '2.575') => mod.setUpdateCheckDependencies({
        showNotification: (msg, type) => notes.push({ msg: String(msg), type }),
        AppMeta: { version },
        safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn)
    });
    const noVerify = () => {};
    const noRegistration = async () => null;

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔢 Version compare</h4>';

    await test('isNewerVersion compares dotted versions numerically', () => {
        const cases = [
            ['2.576', '2.575', true], ['2.575', '2.575', false], ['2.574', '2.575', false],
            ['2.10', '2.9', true], ['3.0', '2.999', true], ['2.575.1', '2.575', true],
            ['', '2.575', false], ['abc', '2.575', false], ['2.576', '', false], [null, '2.575', false]
        ];
        for (const [candidate, current, expected] of cases) {
            const got = mod.isNewerVersion(candidate, current);
            if (got !== expected) throw new Error(`isNewerVersion(${JSON.stringify(candidate)}, ${JSON.stringify(current)}) = ${got}, expected ${expected}`);
        }
    });

    await test('fetchLiveVersion reads APP_VERSION from version.js and returns null on failure', async () => {
        if (await mod.fetchLiveVersion(okFetch('2.580')) !== '2.580') throw new Error('did not parse APP_VERSION');
        if (await mod.fetchLiveVersion(failFetch) !== null) throw new Error('a thrown fetch should yield null');
        if (await mod.fetchLiveVersion(async () => ({ ok: false })) !== null) throw new Error('a non-ok response should yield null');
        if (await mod.fetchLiveVersion(async () => ({ ok: true, text: async () => 'no version here' })) !== null) throw new Error('missing marker should yield null');
    });

    await test('detectUpdateChannel reports web in this test page', () => {
        if (mod.detectUpdateChannel() !== 'web') throw new Error('expected web, got ' + mod.detectUpdateChannel());
    });

    await test('detectUpdateChannel reports desktop when the Electron preload global is present', () => {
        const had = Object.prototype.hasOwnProperty.call(globalThis, 'miniCycleDesktop');
        const saved = globalThis.miniCycleDesktop;
        try {
            globalThis.miniCycleDesktop = { platform: 'darwin', shellVersion: '2.577' };
            if (mod.detectUpdateChannel() !== 'desktop') throw new Error('expected desktop, got ' + mod.detectUpdateChannel());
            globalThis.miniCycleDesktop = { platform: 42 };
            if (mod.detectUpdateChannel() !== 'web') throw new Error('a malformed shell global must not count as desktop');
        } finally {
            if (had) globalThis.miniCycleDesktop = saved; else delete globalThis.miniCycleDesktop;
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Packaged builds (extension / iOS / Android / desktop)</h4>';

    for (const [channel, storeWord] of [['extension', 'Chrome Web Store'], ['ios', 'App Store'], ['android', 'Google Play'], ['desktop', 'minicycleapp.com']]) {
        await test(`${channel}: a newer live version names ${storeWord}`, async () => {
            const notes = [];
            wire(notes, '2.575');
            const result = await mod.checkForUpdates({ channel, fetchImpl: okFetch('2.580') });
            if (result.status !== 'update-available' || result.latest !== '2.580') throw new Error('wrong result: ' + JSON.stringify(result));
            const last = notes[notes.length - 1];
            if (!last.msg.includes('2.580') || !last.msg.includes('2.575') || !last.msg.includes(storeWord)) {
                throw new Error('notification should name both versions and the store: ' + last.msg);
            }
        });
    }

    await test('packaged build: the same live version reports up to date and names the version', async () => {
        const notes = [];
        wire(notes, '2.575');
        const result = await mod.checkForUpdates({ channel: 'extension', fetchImpl: okFetch('2.575') });
        if (result.status !== 'up-to-date') throw new Error('wrong status: ' + result.status);
        const last = notes[notes.length - 1];
        if (last.type !== 'success' || !last.msg.includes('2.575')) throw new Error('expected a success note naming 2.575: ' + JSON.stringify(last));
    });

    await test('packaged build: an OLDER live version (store ahead of the site) is not an update', async () => {
        const notes = [];
        wire(notes, '2.576');
        const result = await mod.checkForUpdates({ channel: 'android', fetchImpl: okFetch('2.575') });
        if (result.status !== 'up-to-date') throw new Error('an older live version must not be offered: ' + result.status);
    });

    await test('packaged build: a failed fetch says so and names the running version, never "up to date"', async () => {
        const notes = [];
        wire(notes, '2.575');
        const result = await mod.checkForUpdates({ channel: 'ios', fetchImpl: failFetch });
        if (result.status !== 'unknown') throw new Error('wrong status: ' + result.status);
        const last = notes[notes.length - 1];
        if (last.type !== 'warning' || !last.msg.includes('2.575')) throw new Error('expected a warning naming 2.575: ' + JSON.stringify(last));
        if (/latest version/i.test(last.msg)) throw new Error('a failed check must not claim the build is current');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Web (service worker)</h4>';

    await test('web: no waiting worker and the live version matches → up to date', async () => {
        const notes = [];
        wire(notes, '2.575');
        let updated = false;
        const result = await mod.checkForUpdates({
            channel: 'web', verifyVersion: noVerify, fetchImpl: okFetch('2.575'),
            getRegistration: async () => ({ waiting: null, update: async () => { updated = true; } })
        });
        if (!updated) throw new Error('registration.update() was not called');
        if (result.status !== 'up-to-date') throw new Error('wrong status: ' + result.status);
    });

    await test('web: a waiting worker names the version it would install', async () => {
        const notes = [];
        wire(notes, '2.575');
        const waiting = {
            postMessage: (msg, ports) => {
                if (msg?.type !== 'GET_VERSION') throw new Error('expected GET_VERSION');
                ports[0].postMessage({ version: '2.577' });
            }
        };
        const result = await mod.checkForUpdates({
            channel: 'web', verifyVersion: noVerify, fetchImpl: okFetch('2.577'),
            getRegistration: async () => ({ waiting, update: async () => {} })
        });
        if (result.status !== 'update-available' || result.latest !== '2.577') throw new Error('wrong result: ' + JSON.stringify(result));
        const last = notes[notes.length - 1];
        if (!last.msg.includes('2.575') || !last.msg.includes('2.577')) throw new Error('expected both versions in the note: ' + last.msg);
    });

    await test('web: a waiting worker that never answers still reports an update', async () => {
        const notes = [];
        wire(notes, '2.575');
        const result = await mod.checkForUpdates({
            channel: 'web', verifyVersion: noVerify, fetchImpl: okFetch('2.575'),
            getRegistration: async () => ({ waiting: { postMessage: () => {} }, update: async () => {} })
        });
        if (result.status !== 'update-available') throw new Error('wrong status: ' + result.status);
    });

    await test('web: no registration at all falls back to the live version', async () => {
        const notes = [];
        wire(notes, '2.575');
        const result = await mod.checkForUpdates({ channel: 'web', verifyVersion: noVerify, fetchImpl: okFetch('2.580'), getRegistration: noRegistration });
        if (result.status !== 'update-available' || result.latest !== '2.580') throw new Error('wrong result: ' + JSON.stringify(result));
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔘 Buttons</h4>';

    await test('initUpdateCheck wires both buttons once', async () => {
        const settingsBtn = document.createElement('button'); settingsBtn.id = 'check-for-updates';
        const menuBtn = document.createElement('button'); menuBtn.id = 'menu-check-updates';
        document.body.append(settingsBtn, menuBtn);
        const notes = [];
        try {
            mod.resetUpdateCheckForTests();
            wire(notes, '2.575');
            mod.initUpdateCheck();
            mod.initUpdateCheck();
            settingsBtn.click();
            menuBtn.click();
            for (let i = 0; i < 40 && notes.length < 2; i++) await new Promise(r => setTimeout(r, 25));
            // Each click starts one check, whose first note is "Checking for updates…".
            const checking = notes.filter(n => /checking/i.test(n.msg)).length;
            if (checking !== 2) throw new Error(`expected 2 checks from 2 clicks (idempotent wiring), got ${checking}`);
        } finally {
            settingsBtn.remove(); menuBtn.remove();
        }
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
