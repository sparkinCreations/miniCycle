/**
 * SoundEffects Tests
 * Tests for modules/features/soundEffects.js and the two places that play it
 * (cycleCompletion.showCompletionAnimation / showClearAnimation).
 *
 * Audio is stubbed: window.Audio is replaced for the duration of each test, so
 * nothing actually plays and the browser's autoplay rules don't matter.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runSoundEffectsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/features/soundEffects.js?v=${cacheBuster}`);
    const { SOUNDS, SOUND_FILES } = await import('../modules/core/constants.js');

    resultsDiv.innerHTML = '<h2>🔊 SoundEffects Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // A stand-in Audio that records what was created and played.
    const withFakeAudio = async (fn, { rejectPlay = false } = {}) => {
        const created = [];
        const played = [];
        const OrigAudio = window.Audio;
        window.Audio = function FakeAudio(src) {
            const el = {
                src, preload: '', currentTime: 5,
                play() { played.push({ src: this.src, currentTime: this.currentTime }); return rejectPlay ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(); },
                pause() {}
            };
            created.push(el);
            return el;
        };
        try { await fn({ created, played }); } finally { window.Audio = OrigAudio; }
    };
    const wire = (sp, soundEffects, ready = true) => mod.setSoundEffectsDependencies({
        AppState: { isReady: () => ready, get: () => (ready ? { settings: soundEffects === undefined ? {} : { soundEffects } } : null) }
    });
    const fresh = () => new mod.SoundEffects();

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module</h4>';

    await test('exports the class, singleton, playSound and init', () => {
        if (typeof mod.SoundEffects !== 'function') throw new Error('SoundEffects class missing');
        if (!mod.soundEffects) throw new Error('singleton missing');
        if (typeof mod.playSound !== 'function') throw new Error('playSound missing');
        if (typeof mod.initSoundEffects !== 'function') throw new Error('initSoundEffects missing');
        for (const name of Object.values(SOUNDS)) {
            if (!/\.mp3$/.test(SOUND_FILES[name] || '')) throw new Error(`no MP3 for "${name}"`);
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🔈 On / off</h4>';

    await test('plays the named sound from the start when sound effects are on', async () => {
        await withFakeAudio(async ({ created, played }) => {
            wire(null, true);
            const sfx = fresh();
            sfx.play(SOUNDS.CLEAR);
            sfx.play(SOUNDS.CLEAR);
            sfx.play(SOUNDS.RESET);
            if (created.length !== 2) throw new Error(`one element per sound expected, made ${created.length}`);
            if (played.length !== 3) throw new Error(`expected 3 plays, got ${played.length}`);
            if (played[0].src !== SOUND_FILES[SOUNDS.CLEAR] || played[2].src !== SOUND_FILES[SOUNDS.RESET]) throw new Error('wrong file played');
            if (played.some(p => p.currentTime !== 0)) throw new Error('a repeat should restart from the top');
            sfx.destroy();
        });
    });

    await test('is silent when off, when never set (data from before Nov 2026), and before state exists', async () => {
        await withFakeAudio(async ({ played }) => {
            for (const [label, value, ready] of [['off', false, true], ['never set', undefined, true], ['no state yet', true, false]]) {
                wire(null, value, ready);
                const sfx = fresh();
                sfx.play(SOUNDS.RESET);
                if (played.length) throw new Error(`${label}: a sound played`);
                sfx.destroy();
            }
        });
    });

    await test('a blocked or failing play never throws, and an unknown name is ignored', async () => {
        await withFakeAudio(async ({ created }) => {
            wire(null, true);
            const sfx = fresh();
            sfx.play(SOUNDS.CLEAR);          // play() rejects — swallowed
            sfx.play('not-a-sound');
            if (created.length !== 1) throw new Error('an unknown name must not create audio');
            await new Promise(r => setTimeout(r, 0)); // let the rejection settle
            sfx.destroy();
        }, { rejectPlay: true });
    });

    await test('asks for an ambient audio session once, where the browser has one', async () => {
        const orig = Object.getOwnPropertyDescriptor(navigator, 'audioSession');
        const session = { type: 'auto' };
        Object.defineProperty(navigator, 'audioSession', { configurable: true, get: () => session });
        try {
            await withFakeAudio(async () => {
                wire(null, true);
                const sfx = fresh();
                sfx.play(SOUNDS.CLEAR);
                if (session.type !== 'ambient') throw new Error(`session type is "${session.type}"`);
                session.type = 'playback';   // the page changed it since
                sfx.play(SOUNDS.CLEAR);
                if (session.type !== 'playback') throw new Error('the session should be set once, not on every sound');
                sfx.destroy();
            });
        } finally {
            if (orig) Object.defineProperty(navigator, 'audioSession', orig);
            else delete navigator.audioSession;
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🔁 Where it plays</h4>';

    await test('a cycle reset plays "reset" and a To-Do clear plays "clear" — even with the completion toast off', async () => {
        const cc = await import(`../modules/progress/cycleCompletion.js?v=${cacheBuster}`);
        const heard = [];
        cc.setCycleCompletionDependencies({
            AppState: { get: () => ({ settings: { disableCompletionToast: true } }), update: () => {}, isReady: () => true },
            playSound: (name) => heard.push(name)
        });
        cc.showCompletionAnimation();
        cc.showClearAnimation();
        document.querySelectorAll('.clear-animation, .complete-animation, [class*="clear-anim"], [class*="complete-anim"]').forEach(el => el.remove());
        if (JSON.stringify(heard) !== JSON.stringify([SOUNDS.RESET, SOUNDS.CLEAR])) throw new Error(`heard ${JSON.stringify(heard)}`);
    });

    await test('in To-Do mode, finishing the last task plays "clear", not "reset"', async () => {
        const cc = await import(`../modules/progress/cycleCompletion.js?v=${cacheBuster}`);
        const heard = [];
        cc.setCycleCompletionDependencies({
            AppState: {
                get: () => ({ settings: { disableCompletionToast: true }, appState: { activeRoutineId: 'r1' }, data: { routine: { r1: { id: 'r1', deleteCheckedTasks: true, tasks: [] } } } }),
                update: () => {}, isReady: () => true
            },
            playSound: (name) => heard.push(name)
        });
        cc.showCompletionAnimation();
        if (JSON.stringify(heard) !== JSON.stringify([SOUNDS.CLEAR])) throw new Error(`heard ${JSON.stringify(heard)}`);
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
