/**
 * tipArchive.js — a browsable archive of the loading tips.
 *
 * WHY THIS EXISTS
 * The boot tip strip shows one tip at a time, rotating every few seconds from a
 * random start index, and stops the moment boot completes. A user sees two or
 * three per session, in random order, and has no way back to one they half-read.
 * Those tips are the app's only lightweight feature-discovery channel, delivered
 * by a slot machine. This renders the whole pool, at the reader's pace.
 *
 * SINGLE SOURCE
 * Tips live in modules/labels/loading-tips.json and are NOT routed through
 * getLabel(). That is deliberate: the pre-boot rotator in miniCycle.html runs
 * before the label system exists, so the JSON is the only place both readers can
 * reach. Duplicating the strings into defaultLabels.js would create exactly the
 * drift validate:labels cannot see. Chrome around the card (title, kicker,
 * nav, close) DOES go through getLabel().
 *
 * The JSON carries two audiences — `firstRun` (true for someone with no routine,
 * no tasks and no UI to point at) and `inApp` (free to reference UI). Both render
 * here; the boot rotator picks one by whether it is on the first-run screen.
 *
 * @module features/tipArchive
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { createIconElement } from '../utils/icons.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TipArchive', {
    showNotification: optional(null),
    hideMainMenu: optional(null)
});

/**
 * Set dependencies for TipArchive.
 * @param {Object} dependencies - Injected dependencies
 * @returns {void}
 */
export function setTipArchiveDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// Same file the pre-boot rotator fetches, and precached by the service worker.
// ROOT-ABSOLUTE on purpose: a page-relative './modules/...' resolves against the
// DOCUMENT, so it only works from a page at the site root. miniCycle.html is, but
// tests/module-test-suite.html is not, and the 404 there surfaces as "no modal"
// rather than an error. Matches routineManager.js's '/examples/...' fetch.
const TIPS_URL = '/modules/labels/loading-tips.json';

class TipArchive {
    constructor() {
        this.initialized = false;
        this.modalOverlay = null;
        this._tips = null;
        this._button = null;
        this._openHandler = null;
        this._closeHandler = null;
        this._overlayClickHandler = null;
        this._cancelHandler = null;
        // Carousel state
        this._deck = [];        // shuffled {text, kicker} for THIS open
        this._index = 0;
        this._timer = null;
        this._paused = false;
        this._navHandlers = [];
        this._keyHandler = null;
    }

    get deps() {
        return di.resolve();
    }

    /**
     * Bind the Help-menu entry. Called automatically by moduleLoader.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;

        this._button = document.getElementById(DOM_IDS.OPEN_TIP_ARCHIVE);
        if (this._button) {
            // Own the button's copy here rather than in the HTML. Its siblings in
            // the Help menu hardcode their text (menu.userManual and menu.feedback
            // exist in defaultLabels.js but are read by nothing) — this one does
            // not, and the markup keeps matching text purely as a no-JS fallback.
            // Target the LABEL span by class. iconInit.js swaps the <i> for its own
            // <span class="icon" aria-hidden="true"><svg/></span>, which comes first
            // in the button — a bare querySelector('span') hits that wrapper and
            // replaces the icon with text (observed: the button read "TipsTips" and
            // lost its glyph).
            const labelSpan = this._button.querySelector(`.${DOM_CLASSES.MENU_ITEM_LABEL}`);
            if (labelSpan) labelSpan.textContent = getLabel('tipArchive.menuItem');
            this._button.title = getLabel('tipArchive.menuItemTitle');

            this._openHandler = () => { this.openModal(); };
            this._button.addEventListener('click', this._openHandler);
        }

        this.initialized = true;
    }

    /**
     * Fetch and normalise the tip pools. Cached after the first read.
     * @returns {Promise<{firstRun: string[], inApp: string[]}>}
     */
    async _loadTips() {
        if (this._tips) return this._tips;

        const response = await fetch(TIPS_URL);
        const data = await response.json();

        const firstRun = Array.isArray(data?.firstRun) ? data.firstRun : [];
        const inApp = Array.isArray(data?.inApp) ? data.inApp : [];

        // A shape mismatch must be LOUD. Normalising it to empty pools renders a
        // modal containing a heading and nothing else — no error, no
        // console warning, no way for anyone to tell what went wrong. That is
        // exactly what a stale service-worker cache produces: the file used to be
        // a bare array, so `data.firstRun` is undefined and both pools go empty.
        // Observed for real (Sep 2026) against a cache from before the split.
        if (!firstRun.length && !inApp.length) {
            throw new Error(
                Array.isArray(data)
                    ? 'loading-tips.json is a bare array — stale cache from before the firstRun/inApp split'
                    : 'loading-tips.json has no usable firstRun or inApp pool'
            );
        }

        this._tips = { firstRun, inApp };
        return this._tips;
    }

    /**
     * Build a shuffled deck from both pools.
     *
     * Randomised on every open, by request: a repeat visitor meets different
     * tips first. The position counter below is what keeps that from becoming
     * the boot rotator again — with "3 / 20" on screen, a reader can still tell
     * how much is left and that they have seen it all.
     *
     * @param {{firstRun: string[], inApp: string[]}} tips
     * @returns {Array<{text: string, kicker: string}>}
     */
    _buildDeck(tips) {
        const deck = [
            ...tips.firstRun.map((text) => ({ text, kicker: getLabel('tipArchive.firstRunHeading') })),
            ...tips.inApp.map((text) => ({ text, kicker: getLabel('tipArchive.inAppHeading') }))
        ];

        // Fisher-Yates. Math.random is right here: this is presentation order,
        // not anything that needs to be unpredictable to an attacker.
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    /**
     * Paint the current card and its position.
     * @returns {void}
     */
    _render() {
        if (!this.modalOverlay) return;
        const card = this._deck[this._index];
        if (!card) return;

        const textEl = this.modalOverlay.querySelector(`#${DOM_IDS.TIP_ARCHIVE_TEXT}`);
        const kickerEl = this.modalOverlay.querySelector(`.${DOM_CLASSES.TIP_ARCHIVE_KICKER}`);
        const posEl = this.modalOverlay.querySelector(`#${DOM_IDS.TIP_ARCHIVE_POSITION}`);

        // Restart the enter animation on every card. Removing the class, forcing a
        // reflow and re-adding it is the standard CSS-animation restart; without
        // the reflow the browser coalesces both mutations and nothing replays.
        const stage = this.modalOverlay.querySelector(`.${DOM_CLASSES.TIP_ARCHIVE_STAGE}`);
        if (stage) {
            stage.classList.remove(DOM_CLASSES.TIP_ARCHIVE_FADING);
            void stage.offsetWidth;
            stage.classList.add(DOM_CLASSES.TIP_ARCHIVE_FADING);
        }

        if (kickerEl) kickerEl.textContent = card.kicker;
        // textContent, never innerHTML: tips carry emoji and are edited as plain
        // content, so no markup should ever be honoured.
        if (textEl) textEl.textContent = card.text;
        if (posEl) {
            posEl.textContent = getLabel('tipArchive.position', {
                vars: { current: this._index + 1, total: this._deck.length }
            });
        }
    }

    /**
     * Step the carousel. Wraps in both directions.
     * @param {number} delta - +1 next, -1 previous
     * @returns {void}
     */
    _step(delta) {
        if (!this._deck.length) return;
        this._index = (this._index + delta + this._deck.length) % this._deck.length;
        this._render();
    }

    /**
     * Start auto-advance. No-op when the deck has nothing to advance through.
     * @returns {void}
     */
    _startRotation() {
        this._stopRotation();
        if (this._deck.length < 2 || this._paused) return;
        this._timer = setInterval(() => this._step(1), UI_TIMEOUTS.TIP_ARCHIVE_SLIDE_HOLD);
    }

    /**
     * Stop auto-advance. Safe to call when no timer is running.
     * @returns {void}
     */
    _stopRotation() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    /**
     * Toggle play/pause and relabel the control.
     * @returns {void}
     */
    _togglePause() {
        this._paused = !this._paused;
        const btn = this.modalOverlay?.querySelector(`#${DOM_IDS.TIP_ARCHIVE_PLAYPAUSE}`);
        if (btn) {
            btn.replaceChildren(createIconElement(this._paused ? 'play' : 'pause'));
            btn.setAttribute('aria-label', getLabel(this._paused ? 'tipArchive.playAria' : 'tipArchive.pauseAria'));
            btn.title = getLabel(this._paused ? 'tipArchive.play' : 'tipArchive.pause');
        }
        if (this._paused) this._stopRotation();
        else this._startRotation();
    }

    /**
     * Open the tip archive modal.
     * @returns {Promise<void>}
     */
    async openModal() {
        if (this.modalOverlay) this.closeModal();

        let tips;
        try {
            tips = await this._loadTips();
        } catch (error) {
            // The tips file is precached, so this is a genuinely broken install
            // rather than an offline case worth silently swallowing. Surface it
            // and open NOTHING — an empty modal reads as "there are no tips",
            // which is a different and wrong message.
            this.deps.showNotification?.(getLabel('tipArchive.loadFailed'), 'error');
            console.warn('⚠️ TipArchive: could not load tips:', error.message);
            return;
        }

        try {
            this.deps.hideMainMenu?.();
        } catch {
            // Menu API not ready — the modal still opens correctly.
        }

        this.modalOverlay = document.createElement('dialog');
        this.modalOverlay.id = DOM_IDS.TIP_ARCHIVE_MODAL;
        this.modalOverlay.className = DOM_CLASSES.MODAL;
        this.modalOverlay.setAttribute('aria-label', getLabel('tipArchive.title'));
        this.modalOverlay.setAttribute('aria-modal', 'true');

        // Same shell as every other modal: .modal-content for the shared base,
        // a bespoke class for this dialog's treatment, and has-corner-logo for
        // the miniCycle mark. Omitting the last two is what made this look like
        // it came from a different app.
        const content = document.createElement('div');
        content.className = [
            DOM_CLASSES.MODAL_CONTENT,
            DOM_CLASSES.TIP_ARCHIVE_MODAL_CONTENT,
            DOM_CLASSES.HAS_CORNER_LOGO
        ].join(' ');

        const title = document.createElement('h2');
        title.textContent = getLabel('tipArchive.title');
        content.appendChild(title);

        // The header band runs edge to edge, so everything below it lives in an
        // inset body wrapper rather than on the shell itself.
        const body = document.createElement('div');
        body.className = DOM_CLASSES.TIP_ARCHIVE_BODY;

        this._deck = this._buildDeck(tips);
        this._index = 0;
        this._paused = false;

        // One tip at a time, mirroring the loading screen. aria-live announces
        // each card to a screen reader as it changes; aria-atomic so the kicker
        // and the tip are read together rather than as two fragments.
        const stage = document.createElement('div');
        stage.className = DOM_CLASSES.TIP_ARCHIVE_STAGE;
        stage.setAttribute('aria-live', 'polite');
        stage.setAttribute('aria-atomic', 'true');

        const kicker = document.createElement('p');
        kicker.className = DOM_CLASSES.TIP_ARCHIVE_KICKER;
        stage.appendChild(kicker);

        const tipText = document.createElement('p');
        tipText.id = DOM_IDS.TIP_ARCHIVE_TEXT;
        tipText.className = DOM_CLASSES.TIP_ARCHIVE_TEXT;
        stage.appendChild(tipText);

        body.appendChild(stage);

        const nav = document.createElement('div');
        nav.className = DOM_CLASSES.TIP_ARCHIVE_NAV;

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.id = DOM_IDS.TIP_ARCHIVE_PREV;
        prevBtn.className = DOM_CLASSES.TIP_ARCHIVE_NAV_BTN;
        prevBtn.textContent = '\u2039';
        prevBtn.setAttribute('aria-label', getLabel('tipArchive.prev'));

        const position = document.createElement('p');
        position.id = DOM_IDS.TIP_ARCHIVE_POSITION;
        position.className = DOM_CLASSES.TIP_ARCHIVE_POSITION;
        body.appendChild(position);

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.id = DOM_IDS.TIP_ARCHIVE_NEXT;
        nextBtn.className = DOM_CLASSES.TIP_ARCHIVE_NAV_BTN;
        nextBtn.textContent = '\u203A';
        nextBtn.setAttribute('aria-label', getLabel('tipArchive.next'));


        // WCAG 2.2.2: auto-updating content needs a pause control. The first-run
        // welcome banner carries the same affordance for the same reason.
        const playPause = document.createElement('button');
        playPause.type = 'button';
        playPause.id = DOM_IDS.TIP_ARCHIVE_PLAYPAUSE;
        // Icon-only. The glyph is aria-hidden inside createIconElement, so the
        // accessible name comes from aria-label and the tooltip from title —
        // both still routed through getLabel.
        playPause.appendChild(createIconElement('pause'));
        playPause.setAttribute('aria-label', getLabel('tipArchive.pauseAria'));
        playPause.title = getLabel('tipArchive.pause');
        playPause.className = DOM_CLASSES.TIP_ARCHIVE_PAUSE_BTN;

        // Transport order: prev, play/pause, next.
        nav.append(prevBtn, playPause, nextBtn);
        body.appendChild(nav);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.id = DOM_IDS.TIP_ARCHIVE_CLOSE;
        closeBtn.textContent = getLabel('tipArchive.close');
        // .settings-btn is the house modal action (full-width, --color-primary) —
        // the same treatment the reminders/settings/preferences modals use. It
        // sits OUTSIDE the padded body so it spans edge to edge like theirs.
        closeBtn.className = DOM_CLASSES.SETTINGS_BTN;
        content.appendChild(body);
        content.appendChild(closeBtn);

        this.modalOverlay.appendChild(content);
        document.body.appendChild(this.modalOverlay);

        this.modalOverlay._previousFocus = document.activeElement;
        this.modalOverlay.showModal();

        this._closeHandler = () => { this.closeModal(); };
        closeBtn.addEventListener('click', this._closeHandler);

        // Backdrop click: the dialog element itself is the backdrop region, so a
        // click landing on it (rather than on .modal-content) means "outside".
        this._overlayClickHandler = (event) => {
            if (event.target === this.modalOverlay) this.closeModal();
        };
        this.modalOverlay.addEventListener('click', this._overlayClickHandler);

        // Escape fires 'cancel' on <dialog>; route it through closeModal so the
        // listener teardown below always runs. Without this the dialog closes
        // but every handler above stays attached to a detached element.
        this._cancelHandler = (event) => {
            event.preventDefault();
            this.closeModal();
        };
        this.modalOverlay.addEventListener('cancel', this._cancelHandler);

        // Manual navigation pauses the rotation: advancing under the reader's
        // finger right after they pressed "next" is the whole reason carousels
        // get a bad name.
        const bind = (el, type, fn) => {
            el.addEventListener(type, fn);
            this._navHandlers.push([el, type, fn]);
        };
        bind(prevBtn, 'click', () => { this._paused || this._togglePause(); this._step(-1); });
        bind(nextBtn, 'click', () => { this._paused || this._togglePause(); this._step(1); });
        bind(playPause, 'click', () => this._togglePause());

        // Arrow keys, since this is a carousel and people will try them.
        this._keyHandler = (event) => {
            if (event.key === 'ArrowLeft') { this._paused || this._togglePause(); this._step(-1); }
            else if (event.key === 'ArrowRight') { this._paused || this._togglePause(); this._step(1); }
        };
        this.modalOverlay.addEventListener('keydown', this._keyHandler);

        this._render();
        this._startRotation();

        closeBtn.focus({ focusVisible: false });
    }

    /**
     * Close the modal and remove every listener it added.
     * @returns {void}
     */
    closeModal() {
        if (!this.modalOverlay) return;

        const overlay = this.modalOverlay;
        const closeBtn = overlay.querySelector(`#${DOM_IDS.TIP_ARCHIVE_CLOSE}`);

        if (this._closeHandler) {
            closeBtn?.removeEventListener('click', this._closeHandler);
            this._closeHandler = null;
        }
        if (this._overlayClickHandler) {
            overlay.removeEventListener('click', this._overlayClickHandler);
            this._overlayClickHandler = null;
        }
        if (this._cancelHandler) {
            overlay.removeEventListener('cancel', this._cancelHandler);
            this._cancelHandler = null;
        }
        if (this._keyHandler) {
            overlay.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        // Every nav/pause listener, and the rotation timer. A surviving interval
        // would keep stepping a detached element forever.
        this._navHandlers.forEach(([el, type, fn]) => el.removeEventListener(type, fn));
        this._navHandlers = [];
        this._stopRotation();

        overlay._previousFocus?.focus({ focusVisible: false });

        if (overlay.open) overlay.close();
        overlay.remove();
        this.modalOverlay = null;
    }

    /**
     * Full teardown — called by destroyAllModules() on boot retry.
     * @returns {void}
     */
    destroy() {
        this.closeModal();

        if (this._button && this._openHandler) {
            this._button.removeEventListener('click', this._openHandler);
        }
        this._openHandler = null;
        this._button = null;
        this._tips = null;
        this._deck = [];
        this._index = 0;
        this._paused = false;
        this.initialized = false;
    }
}

export const tipArchive = new TipArchive();
