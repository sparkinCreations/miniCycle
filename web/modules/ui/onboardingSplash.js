/**
 * onboardingSplash.js — the first-run splash screen.
 *
 * Facade-style sub-module of onboardingManager.js (Priority 8 step 2, Aug 2026):
 * loaded via dynamic import with ?v= cache-busting from OnboardingManager.init(),
 * alongside onboardingDemo.js. Do NOT add it to moduleManifests.js — same rule as
 * the settingsManager / taskDOM / statsPanel sub-modules.
 *
 * Owns the splash's build, word-landing animation, hold-duration read and teardown.
 * Its STATE stays on the manager (`_firstRunSplash`, `_firstRunSplashDone`, the
 * three timers, the watchdog and the done-resolver) and is reached via `this.m` —
 * the same back-reference the demo sub-module uses. Nothing was migrated, so the
 * manager's destroy() still clears every timer it always cleared.
 *
 * `showWelcomeSplash()` and `_hideFirstRunSplash()` stay on the MANAGER as thin
 * delegators: appInit calls the first and two existing test files reach for both,
 * so moving them wholesale would have been an API change dressed as a refactor.
 *
 * Seam, measured before the move: ONE outbound sibling call
 * (`_scheduleFirstRunWelcomeAdvance`, a carousel method) and ONE dependency
 * (`AppState`).
 */
import { DOM_CLASSES, DOM_IDS, DOM_SELECTORS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

export class OnboardingSplash {
    constructor(manager) {
        this.m = manager;
    }

    /**
     * Show the typewriter splash for first-time users. Builds a black
     * full-screen overlay with the welcome title typed in character-by-
     * character. Positioned so the title lands at the same spot as the
     * banner title — when the splash fades out, the banner (mounted behind
     * it) is revealed continuously.
     *
     * @param {Object} [options]
     * @param {boolean} [options.standalone=false] Skip the phase-3 banner
     *   hand-off and hold the centered title longer instead. For callers with
     *   no welcome banner behind the splash.
     * @returns {Promise<void>} Resolves once the splash has faded and been
     *   removed. Resolves immediately when the splash is gated off. Callers
     *   that just want the visual can ignore it — the splash is self-managing.
     * @private
     */
    _showFirstRunSplash({ standalone = false } = {}) {
        // Same gate as the welcome banner — once the user dismisses the
        // welcome (× on the banner) OR exits focus mode (which sets
        // onboardingCompleted), neither the splash nor the banner show on
        // subsequent reloads. App close alone does NOT graduate them.
        const state = this.m.deps.AppState?.get?.();
        if (state?.settings?.firstRunWelcomeDismissed) return Promise.resolve();

        if (this.m._firstRunSplash) return this.m._firstRunSplashDone ?? Promise.resolve();

        // Completion promise — resolved by _hideFirstRunSplash once the
        // element is actually off the page.
        this.m._firstRunSplashDone = new Promise(resolve => {
            this.m._resolveFirstRunSplashDone = resolve;
        });

        const titleText = getLabel('firstRunWelcome.title');
        const splash = document.createElement('div');
        splash.id = DOM_IDS.FIRST_RUN_SPLASH;
        splash.className = DOM_CLASSES.FIRST_RUN_SPLASH;
        splash.setAttribute('aria-live', 'polite');

        const title = document.createElement('h2');
        title.id = DOM_IDS.FIRST_RUN_SPLASH_TITLE;
        title.className = DOM_CLASSES.FIRST_RUN_SPLASH_TITLE;
        // Full text exposed to AT in one go for accessibility — the per-char
        // spans below are visual-only (aria-hidden) so screen readers don't
        // hear "W. e. l. c. o. m. e."
        title.setAttribute('aria-label', titleText);

        // Two lines: all-but-last-word on line 1, last word on line 2.
        // For "Welcome to miniCycle" → line 1 = "Welcome to", line 2 =
        // "miniCycle". Letters cascade sequentially left-to-right across
        // both lines (--char-index increments globally), so phase 1
        // fade-in and phase 2 shrink walk every character one at a time.
        const allWords = titleText.split(/\s+/).filter(Boolean);
        const lineTexts = allWords.length >= 2
            ? [allWords.slice(0, -1).join(' '), allWords[allWords.length - 1]]
            : [allWords.join(' ')];

        let globalCharIndex = 0;
        let maxCharIndex = 0;

        lineTexts.forEach(lineText => {
            const line = document.createElement('div');
            line.className = DOM_CLASSES.FIRST_RUN_SPLASH_LINE;

            const lineChars = [...lineText];
            const lineCenter = (lineChars.length - 1) / 2;
            // Consecutive non-space chars get wrapped in a word group so
            // phase 3 can translate each word as a unit to its exact spot
            // in the banner. Spaces sit directly in the line.
            let currentWordGroup = null;

            lineChars.forEach((char, posInLine) => {
                const charIndex = globalCharIndex++;
                if (charIndex > maxCharIndex) maxCharIndex = charIndex;
                // letter-pos = signed offset from the line's center, used by
                // CSS to push each letter outward at peak scale (so letters
                // have breathing room while big) and pull it back to 0 as
                // the shrink animation runs.
                const letterPos = posInLine - lineCenter;
                const isSpace = char === ' ';

                const span = document.createElement('span');
                span.className = DOM_CLASSES.FIRST_RUN_SPLASH_CHAR;
                if (isSpace) {
                    span.classList.add(`${DOM_CLASSES.FIRST_RUN_SPLASH_CHAR}--space`);
                }
                span.style.setProperty('--char-index', String(charIndex));
                span.style.setProperty('--letter-pos', String(letterPos));
                span.setAttribute('aria-hidden', 'true');
                span.textContent = char;

                if (isSpace) {
                    currentWordGroup = null;
                    line.appendChild(span);
                } else {
                    if (!currentWordGroup) {
                        currentWordGroup = document.createElement('span');
                        currentWordGroup.className = DOM_CLASSES.FIRST_RUN_SPLASH_WORD;
                        line.appendChild(currentWordGroup);
                    }
                    currentWordGroup.appendChild(span);
                }
            });

            title.appendChild(line);
        });

        splash.appendChild(title);
        // CSS phase1-total calc reads --last-char-index from the splash
        // container — using the max char-index observed across all words
        // so phase 2 (shrink) starts after every letter has finished
        // fading in, regardless of word length.
        splash.style.setProperty('--last-char-index', String(maxCharIndex));
        document.body.appendChild(splash);
        this.m._firstRunSplash = splash;

        // Tap/click anywhere on the splash dismisses it early. The banner
        // is already mounted underneath (showFirstRunWelcome runs first),
        // so fading the splash reveals it. _hideFirstRunSplash is
        // idempotent and clears the hold timer, so racing with the
        // automatic finish is safe.
        const dismissOnTap = () => {
            splash.removeEventListener('pointerdown', dismissOnTap);
            this._hideFirstRunSplash();
        };
        splash.addEventListener('pointerdown', dismissOnTap);

        // Watchdog — everything below is driven by `animationend`, which never
        // fires when the char animations don't run: prefers-reduced-motion
        // sets `animation: none` on .first-run-splash__char, and an animation
        // can also be canceled mid-flight. Without this the splash would sit
        // there black until tapped. Cleared by _hideFirstRunSplash on the
        // normal path, so it only ever fires as a true last resort.
        this.m._firstRunSplashWatchdog = setTimeout(() => {
            this.m._firstRunSplashWatchdog = null;
            this._hideFirstRunSplash();
        }, UI_TIMEOUTS.FIRST_RUN_SPLASH_WATCHDOG);

        // Self-managing lifecycle: after the LAST character's SHRINK
        // animation ends (phase 2 of the cascade) + a brief hold, fade
        // the splash out automatically. We filter on animation name
        // because each char runs two chained animations — the fade-in
        // ends earlier and we don't want to fire too soon.
        const lastChar = title.lastElementChild;
        if (!lastChar) {
            this._hideFirstRunSplash();
            return this.m._firstRunSplashDone;
        }
        const startHold = () => {
            this.m._firstRunSplashHoldTimer = setTimeout(() => {
                this.m._firstRunSplashHoldTimer = null;
                this._hideFirstRunSplash();
            }, this._readSplashHoldDuration(standalone));
        };

        // Reduced motion: the cascade is disabled in CSS, so the title is
        // already sitting there fully visible. Go straight to the hold rather
        // than waiting out a watchdog on a black screen.
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
            startHold();
            return this.m._firstRunSplashDone;
        }

        const onLastCharDone = (event) => {
            if (event.animationName !== 'first-run-splash-shrink') return;
            lastChar.removeEventListener('animationend', onLastCharDone);

            // Phase 3 — animate each splash word to its exact spot in the
            // banner title. Skipped entirely in standalone mode (no banner
            // to land on). Falls back to immediate hold if the banner
            // isn't measurable (e.g., not yet mounted, mismatched word
            // count, no text node).
            const landedWords = standalone ? null : this._landSplashWordsOnBanner();
            if (!landedWords || landedWords.length === 0) {
                startHold();
                return;
            }
            const lastWord = landedWords[landedWords.length - 1];
            const onWordLanded = (e) => {
                if (e.animationName !== 'first-run-splash-word-land') return;
                lastWord.removeEventListener('animationend', onWordLanded);
                startHold();
            };
            lastWord.addEventListener('animationend', onWordLanded);
        };
        lastChar.addEventListener('animationend', onLastCharDone);

        return this.m._firstRunSplashDone;
    }

    /**
     * Phase 3 — measure each word's position in the welcome banner's title
     * and translate the corresponding splash word group to land exactly
     * there. Returns the list of splash word elements that were animated,
     * or null if measurement failed (banner not present, text node missing,
     * or word counts didn't match — caller should fall back to skipping).
     * @private
     * @returns {NodeListOf<HTMLElement>|null}
     */
    _landSplashWordsOnBanner() {
        const splash = this.m._firstRunSplash;
        if (!splash) return null;

        const banner = document.getElementById(DOM_IDS.FIRST_RUN_WELCOME);
        if (!banner) return null;

        const bannerTitle = banner.querySelector(`.${DOM_CLASSES.FIRST_RUN_WELCOME_TITLE}`);
        const bannerTextNode = bannerTitle?.firstChild;
        if (!bannerTextNode || bannerTextNode.nodeType !== Node.TEXT_NODE) return null;

        const splashWords = splash.querySelectorAll(`.${DOM_CLASSES.FIRST_RUN_SPLASH_WORD}`);
        const wordMatches = [...bannerTextNode.nodeValue.matchAll(/\S+/g)];
        if (splashWords.length === 0 || splashWords.length !== wordMatches.length) return null;

        splashWords.forEach((wordEl, i) => {
            const match = wordMatches[i];
            const range = document.createRange();
            range.setStart(bannerTextNode, match.index);
            range.setEnd(bannerTextNode, match.index + match[0].length);
            const bannerRect = range.getBoundingClientRect();
            const splashRect = wordEl.getBoundingClientRect();

            const dx = bannerRect.left - splashRect.left;
            const dy = bannerRect.top - splashRect.top;

            wordEl.style.setProperty('--phase3-dx', `${dx}px`);
            wordEl.style.setProperty('--phase3-dy', `${dy}px`);
            wordEl.classList.add(DOM_CLASSES.FIRST_RUN_SPLASH_WORD_LANDING);
        });

        return splashWords;
    }

    /**
     * Read the splash hold duration from the CSS variable
     * `--first-run-splash-hold` (or `--first-run-splash-hold-standalone` for
     * the no-banner variant) so timing stays in sync with the stylesheet.
     * Falls back to 450ms if the var isn't readable for any reason.
     * @param {boolean} [standalone=false] Read the standalone hold instead.
     * @returns {number} milliseconds
     * @private
     */
    _readSplashHoldDuration(standalone = false) {
        try {
            const raw = getComputedStyle(document.documentElement)
                .getPropertyValue(standalone
                    ? '--first-run-splash-hold-standalone'
                    : '--first-run-splash-hold')
                .trim();
            if (raw.endsWith('ms')) return parseFloat(raw);
            if (raw.endsWith('s')) return parseFloat(raw) * 1000;
        } catch { /* fall through to fallback */ }
        return 450;
    }

    /**
     * Fade out and remove the first-run splash. Idempotent — no-op if not
     * mounted. The fade duration is controlled by the CSS variable
     * `--first-run-splash-fade-duration`.
     * @private
     */
    _hideFirstRunSplash() {
        const splash = this.m._firstRunSplash;
        if (!splash) return;

        if (this.m._firstRunSplashHoldTimer) {
            clearTimeout(this.m._firstRunSplashHoldTimer);
            this.m._firstRunSplashHoldTimer = null;
        }
        if (this.m._firstRunSplashWatchdog) {
            clearTimeout(this.m._firstRunSplashWatchdog);
            this.m._firstRunSplashWatchdog = null;
        }

        // Settle the completion promise once — whichever removal path wins
        // (transitionend or the safety net). Callers gate follow-up UI on it,
        // so it must resolve exactly once and never be dropped.
        //
        // The resolver is detached HERE rather than read at removal time:
        // _firstRunSplash is cleared below, so a new splash can legitimately
        // mount during this one's fade. Binding each hide to the resolver that
        // was live when it started keeps the old fade from resolving the new
        // splash's promise early.
        const resolveThisSplash = this.m._resolveFirstRunSplashDone;
        this.m._resolveFirstRunSplashDone = null;
        this.m._firstRunSplashDone = null;
        const settleSplashDone = () => resolveThisSplash?.();

        splash.classList.add(DOM_CLASSES.FIRST_RUN_SPLASH_FADING);
        // Once the splash is gone, hand control to the welcome banner's
        // slide carousel — it deferred its first-advance timer while the
        // splash was covering it. _scheduleFirstRunWelcomeAdvance() is
        // idempotent (clears any existing timer), so calling from both
        // transitionend AND the safety-net is safe.
        const startWelcomeCarousel = () => this.m._scheduleFirstRunWelcomeAdvance();
        const removeAfterFade = () => {
            splash.removeEventListener('transitionend', removeAfterFade);
            // Cancel the safety-net so it doesn't reschedule the carousel
            // 2.4s later and reset the user's slide timer.
            if (this.m._firstRunSplashRemoveTimer) {
                clearTimeout(this.m._firstRunSplashRemoveTimer);
                this.m._firstRunSplashRemoveTimer = null;
            }
            splash.remove();
            startWelcomeCarousel();
            settleSplashDone();
        };
        splash.addEventListener('transitionend', removeAfterFade, { once: true });
        // Safety net in case the transition is interrupted / canceled.
        this.m._firstRunSplashRemoveTimer = setTimeout(() => {
            this.m._firstRunSplashRemoveTimer = null;
            if (splash.isConnected) splash.remove();
            startWelcomeCarousel();
            settleSplashDone();
        }, UI_TIMEOUTS.NOTIFICATION_LONG);

        this.m._firstRunSplash = null;
        this.m._firstRunSplashAnimationDone = null;
    }

}
