/**
 * 🔊 Sound Effects (DI-Pure)
 *
 * Short sounds for two moments: a cycle completing and resetting (SOUNDS.RESET)
 * and To-Do mode clearing its completed tasks (SOUNDS.CLEAR — the Clear button,
 * or checking the last task, which completes the cycle in To-Do mode). cycleCompletion
 * plays them from the same two functions that draw those moments
 * (showCompletionAnimation / showClearAnimation), so sound and picture stay
 * together, and both only ever follow something the user did.
 *
 * Off unless `settings.soundEffects` is true. New users get it on
 * (migrationManager.createInitialSchemaData); data from before Nov 2026 has no
 * value and reads as off, so nobody starts hearing sounds they never chose.
 * Settings → Behavior → Sound effects turns it on and off.
 *
 * Playback is best-effort and silent on failure: a browser that blocks audio
 * (no gesture yet, no audio device) just skips the sound.
 *
 * On iPhone and iPad the page's audio session is set to "ambient" where the
 * browser supports it (navigator.audioSession, Safari 16.4+): the sounds then
 * mix with music the user is playing instead of pausing it, and obey the
 * silent switch, like a game's sound effects.
 *
 * Pattern: Simple Instance ✨ — required deps via diBase.js.
 *
 * @module features/soundEffects
 */

import { createDIModule, required } from '../core/diBase.js';
import { SOUND_FILES } from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('SoundEffects', {
    AppState: required()
});

/**
 * Set dependencies for SoundEffects.
 * @param {Object} dependencies - { AppState }
 * @returns {void}
 */
export function setSoundEffectsDependencies(dependencies) {
    di.setDependencies(dependencies);
}

export class SoundEffects {
    constructor() {
        /** @type {Map<string, HTMLAudioElement>} one element per sound, made on first use */
        this._audio = new Map();
        this._sessionSet = false;
    }

    get deps() {
        return di.resolve();
    }

    /**
     * Whether the user has sound effects on. Before state exists (first run,
     * a factory reset in progress) there is nothing to read, which means off.
     * @returns {boolean}
     */
    isEnabled() {
        const AppState = this.deps.AppState;
        if (typeof AppState.isReady === 'function' && !AppState.isReady()) return false;
        return AppState.get()?.settings?.soundEffects === true;
    }

    /**
     * Play one of SOUNDS when sound effects are on. Never throws.
     * @param {string} name - SOUNDS.CLEAR | SOUNDS.RESET
     * @returns {void}
     */
    play(name) {
        try {
            if (!this.isEnabled()) return;
            const audio = this._element(name);
            if (!audio) return;
            this._useAmbientSession();
            // Restart rather than queue: a second clear right after the first
            // plays from the top instead of being dropped.
            audio.currentTime = 0;
            const playing = audio.play();
            if (playing && typeof playing.catch === 'function') {
                playing.catch(() => { /* blocked or no audio device — skip this sound */ });
            }
        } catch (error) {
            console.warn('🔊 Sound effect not played (non-critical):', error?.message || error);
        }
    }

    /**
     * The audio element for a sound, created (and preloading) on first use.
     * @param {string} name
     * @returns {HTMLAudioElement|null}
     * @private
     */
    _element(name) {
        if (this._audio.has(name)) return this._audio.get(name);
        const src = SOUND_FILES[name];
        if (!src || typeof Audio !== 'function') return null;
        const audio = new Audio(src);
        audio.preload = 'auto';
        this._audio.set(name, audio);
        return audio;
    }

    /**
     * Ask for an audio session that mixes with other audio and respects the
     * silent switch (iPhone / iPad; a no-op where unsupported). Once per page.
     * @private
     */
    _useAmbientSession() {
        if (this._sessionSet) return;
        this._sessionSet = true;
        try {
            const session = typeof navigator !== 'undefined' ? navigator.audioSession : null;
            if (session && 'type' in session) session.type = 'ambient';
        } catch { /* unsupported — the default session plays the sound */ }
    }

    /** Drop the audio elements (boot-retry teardown). */
    destroy() {
        for (const audio of this._audio.values()) {
            try { audio.pause(); } catch { /* already gone */ }
        }
        this._audio.clear();
        this._sessionSet = false;
    }
}

// ==========================================
// 🌐 EXPORT
// ==========================================

export const soundEffects = new SoundEffects();

/**
 * Play a sound effect (the manifest's `playSound`). See SoundEffects.play.
 * @param {string} name - SOUNDS.CLEAR | SOUNDS.RESET
 * @returns {void}
 */
export function playSound(name) {
    soundEffects.play(name);
}

/**
 * Boot entry point — discovered by moduleLoader.findInitFunction.
 * @param {Object} dependencies - { AppState }
 * @returns {SoundEffects}
 */
export function initSoundEffects(dependencies) {
    setSoundEffectsDependencies(dependencies);
    return soundEffects;
}
