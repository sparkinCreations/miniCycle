/**
 * titleScreen.js — the Welcome Screen.
 *
 * NAMING: the identifier is `titleScreen`; the user-facing name is "Welcome
 * Screen". `welcome` is already the codebase's word for first-run onboarding
 * (20 FIRST_RUN_WELCOME_* classes, first-run-welcome.css, onboardingCarousel),
 * so reusing it in code would collide. See WELCOME_SCREEN_PLAN.md.
 *
 * WHAT IT IS
 * A full-screen overlay carrying the app's brand and its primary destinations —
 * the place a user can leave a routine FOR. Every destination already exists in
 * the main menu; this surface exposes them without three levels of drawer.
 *
 * ONE SURFACE, TWO MODULES
 * This is meant to look identical to the first-run choice screen — to a user
 * there is one branded screen, met on day one and returned to later. It is a
 * separate module because their constraints do not reconcile: the first-run
 * screen is pre-boot, ES5-only, has no getLabel(), and lives in an inline
 * <script> whose CSP hash changes on every edit. Do NOT merge them; share the
 * stylesheet instead.
 *
 * DELEGATION, NOT REIMPLEMENTATION
 * Each action clicks the menu button that already owns that behaviour, using the
 * same shape quickActionsManager uses. Reimplementing routine creation or import
 * here would be a second source of truth for the same state.
 *
 * @module ui/titleScreen
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_CLASSES, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('TitleScreen', {
    AppState: required(),
    safeAddEventListener: required(),
    showNotification: optional(null),
    hideMainMenu: optional(null),
    // Phase 7, reached only when the user clicks the rotating tip. Routed through
    // depMappings as a lazy opener (the house pattern for cross-phase modals).
    openTipArchive: optional(null)
});

/**
 * Set dependencies for TitleScreen.
 * @param {Object} dependencies - Injected dependencies
 * @returns {void}
 */
export function setTitleScreenDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Values for `state.settings.lastSurface`. Persisting which surface the user left
 * on is what makes this a place you can PARK, rather than one you visit.
 */
const SURFACE_TITLE_SCREEN = 'titleScreen';
const SURFACE_ROUTINE = 'routine';

/** Legal pages, in the order they appear in the main menu's Legal section. */
const LEGAL_LINKS = [
    { href: 'legal/privacy.html', labelKey: 'titleScreen.privacy' },
    { href: 'legal/terms.html', labelKey: 'titleScreen.terms' },
    { href: 'legal/accessibility.html', labelKey: 'titleScreen.accessibility' },
    { href: 'legal/security.html', labelKey: 'titleScreen.security' }
];

class TitleScreen {
    constructor() {
        this.initialized = false;
        this.overlay = null;
        this._button = null;
        this._openHandler = null;
        this._handlers = [];
        this._cancelHandler = null;
        this._tips = [];
        this._tipIndex = 0;
        this._tipTimer = null;
        this._useCases = [];
        this._useCaseIndex = 0;
        this._useCaseTimer = null;
        this._useCaseShowingA = true;
    }

    get deps() {
        return di.resolve();
    }

    /**
     * Bind the main-menu entry. Called automatically by moduleLoader.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;

        this._button = document.getElementById(DOM_IDS.MENU_OPEN_TITLE_SCREEN);
        if (this._button) {
            // Target the label span by class. iconInit.js swaps the <i> for its
            // own <span class="icon"><svg/></span>, so a bare querySelector('span')
            // hits the icon wrapper and replaces the glyph with text.
            const labelSpan = this._button.querySelector(`.${DOM_CLASSES.MENU_ITEM_LABEL}`);
            if (labelSpan) labelSpan.textContent = getLabel('titleScreen.menuItem');
            this._button.title = getLabel('titleScreen.menuItemTitle');
            this._button.setAttribute('aria-label', getLabel('titleScreen.openAria'));

            this._openHandler = () => { this.open(); };
            this._button.addEventListener('click', this._openHandler);
        }

        this.initialized = true;

        // Restore the parked surface. No pre-paint CSS is involved: #app-loader
        // still covers the viewport at this point (hideAppLoader runs at the END
        // of uiBoot, and waits another 500ms), and a showModal() dialog sits in
        // the TOP LAYER — above the loader's z-index — so the overlay is already
        // up before the loader fades out behind it. The user never sees the
        // routine flash past.
        if (this._parkedHere()) this.open();
    }

    /**
     * Did the user leave the app on this surface?
     *
     * Reads through isReady(): on a first run AppState.get() is null, which is
     * also exactly when there is no preference to restore.
     *
     * @returns {boolean}
     */
    _parkedHere() {
        const AppState = this.deps.AppState;
        if (!AppState.isReady()) return false;
        return AppState.get()?.settings?.lastSurface === SURFACE_TITLE_SCREEN;
    }

    /**
     * Remember which surface the user is on.
     *
     * Gated on isReady() deliberately: AppState.update() is a documented no-op
     * before state exists — it awaits its own init(), finds no data, warns and
     * returns WITHOUT running the producer. Calling it anyway would look like it
     * worked.
     *
     * @param {string} surface - SURFACE_TITLE_SCREEN or SURFACE_ROUTINE
     * @returns {void}
     */
    _rememberSurface(surface) {
        const AppState = this.deps.AppState;
        if (!AppState.isReady()) return;
        AppState.update((state) => {
            state.settings.lastSurface = surface;
        }, true);
    }

    /**
     * Track a listener so closing can remove every one of them.
     * @param {EventTarget} el
     * @param {string} type
     * @param {Function} fn
     * @returns {void}
     */
    _bind(el, type, fn) {
        el.addEventListener(type, fn);
        this._handlers.push([el, type, fn]);
    }

    /**
     * Run a destination by clicking the menu control that already owns it.
     *
     * Same shape as quickActionsManager: close this surface, defer a tick so the
     * teardown settles, then click. A missing target warns rather than failing
     * mute — the button is only ever absent if the menu markup changed.
     *
     * @param {string} targetId - DOM_IDS entry of the control to activate
     * @returns {void}
     */
    _delegate(targetId) {
        this.close();
        setTimeout(() => {
            try {
                const btn = document.getElementById(targetId);
                if (btn) {
                    btn.click();
                } else {
                    console.warn(`⚠️ TitleScreen: no control found for '${targetId}'`);
                    this.deps.showNotification?.(
                        getLabel('titleScreen.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG
                    );
                }
            } catch (err) {
                console.error('❌ TitleScreen action failed:', err);
                this.deps.showNotification?.(
                    getLabel('titleScreen.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG
                );
            }
        }, 0);
    }

    /**
     * Build one primary action button.
     * @param {string} id - DOM_IDS entry for the new button
     * @param {string} labelKey - getLabel key for its text
     * @param {string} targetId - DOM_IDS entry of the control it delegates to
     * @param {string} [className='first-run-btn'] - Visual tier for this action
     * @returns {HTMLButtonElement}
     */
    _buildAction(id, labelKey, targetId, className = 'first-run-btn') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = id;
        btn.className = className;
        btn.textContent = getLabel(labelKey);
        this._bind(btn, 'click', () => this._delegate(targetId));
        return btn;
    }

    /**
     * Load the in-app tip pool and start rotating.
     *
     * The first-run screen rotates USE CASES ("pre-flight checklists") — that is
     * positioning, aimed at a stranger deciding whether to start. This screen has
     * the same slot and the same rhythm but rotates TIPS, because its audience
     * already uses the app and needs discovery, not persuasion.
     *
     * Same loading-tips.json both readers share; failure is silent on purpose —
     * a missing tip line costs nothing, and this surface's job is the buttons.
     *
     * @param {HTMLElement} el - The element whose text rotates
     * @returns {Promise<void>}
     */
    async _startTips(el) {
        try {
            const data = await (await fetch('/modules/labels/loading-tips.json')).json();
            this._tips = Array.isArray(data?.inApp) ? data.inApp : [];
            this._useCases = Array.isArray(data?.useCases) ? data.useCases : [];
        } catch {
            this._tips = [];
            this._useCases = [];
        }
        this._startUseCases();
        if (!this._tips.length || !this.overlay) return;

        this._tipIndex = Math.floor(Math.random() * this._tips.length);
        el.textContent = this._tips[this._tipIndex];

        if (this._tips.length < 2) return;
        this._tipTimer = setInterval(() => {
            // The overlay can be gone without close() having run (boot retry), so
            // never assume the element is still attached.
            if (!this.overlay) { this._stopTips(); return; }
            this._tipIndex = (this._tipIndex + 1) % this._tips.length;
            el.textContent = this._tips[this._tipIndex];
        }, UI_TIMEOUTS.TIP_ARCHIVE_SLIDE_HOLD);
    }

    /**
     * Rotate the use-case line.
     *
     * TRUE crossfade, like the first-run screen: two stacked layers share one
     * grid cell, and the incoming layer fades in while the outgoing fades out —
     * so a line is always on screen and there is never a blank frame.
     *
     * @returns {void}
     */
    _startUseCases() {
        if (!this.overlay || this._useCases.length < 2) return;

        const a = this.overlay.querySelector(`#${DOM_IDS.TITLE_SCREEN_USECASE_A}`);
        const b = this.overlay.querySelector(`#${DOM_IDS.TITLE_SCREEN_USECASE_B}`);
        if (!a || !b) return;

        this._useCaseIndex = Math.floor(Math.random() * this._useCases.length);
        a.textContent = this._useCases[this._useCaseIndex];
        a.classList.add(DOM_CLASSES.IS_ACTIVE);
        this._useCaseShowingA = true;

        this._useCaseTimer = setInterval(() => {
            if (!this.overlay) { this._stopUseCases(); return; }
            this._useCaseIndex = (this._useCaseIndex + 1) % this._useCases.length;
            const incoming = this._useCaseShowingA ? b : a;
            const outgoing = this._useCaseShowingA ? a : b;
            incoming.textContent = this._useCases[this._useCaseIndex];
            incoming.classList.add(DOM_CLASSES.IS_ACTIVE);
            outgoing.classList.remove(DOM_CLASSES.IS_ACTIVE);
            this._useCaseShowingA = !this._useCaseShowingA;
        }, UI_TIMEOUTS.TITLE_SCREEN_USECASE_HOLD);
    }

    /**
     * Stop the use-case rotation. Safe when no timer is running.
     * @returns {void}
     */
    _stopUseCases() {
        if (this._useCaseTimer) {
            clearInterval(this._useCaseTimer);
            this._useCaseTimer = null;
        }
    }

    /**
     * Stop the tip rotation. Safe when no timer is running.
     * @returns {void}
     */
    _stopTips() {
        if (this._tipTimer) {
            clearInterval(this._tipTimer);
            this._tipTimer = null;
        }
    }

    /**
     * Open the Welcome Screen.
     * @returns {void}
     */
    open() {
        if (this.overlay) return;

        try {
            this.deps.hideMainMenu?.();
        } catch {
            // Menu API not ready — the overlay still opens correctly.
        }

        this.overlay = document.createElement('dialog');
        this.overlay.id = DOM_IDS.TITLE_SCREEN;
        this.overlay.className = DOM_CLASSES.TITLE_SCREEN;
        this.overlay.setAttribute('aria-label', getLabel('titleScreen.name'));
        this.overlay.setAttribute('aria-modal', 'true');

        const inner = document.createElement('div');
        inner.className = DOM_CLASSES.TITLE_SCREEN_INNER;

        // Logo above the wordmark, matching #app-loader's .loader-logo. Decorative
        // here: the wordmark beneath already names the app, so alt is empty and
        // a screen reader is not told "miniCycle" twice.
        const logo = document.createElement('img');
        logo.src = 'assets/images/logo/minicycle_logo_icon.png';
        logo.alt = '';
        logo.width = 96;
        logo.height = 77;
        logo.className = DOM_CLASSES.TITLE_SCREEN_LOGO;
        inner.appendChild(logo);

        // Brand block — same classes as the first-run screen so the two match.
        const brand = document.createElement('div');
        brand.className = 'first-run-brand';
        const wordmark = document.createElement('div');
        wordmark.className = 'first-run-wordmark';
        wordmark.textContent = getLabel('titleScreen.wordmark');
        const descriptor = document.createElement('div');
        descriptor.className = 'first-run-descriptor';
        descriptor.textContent = getLabel('titleScreen.descriptor');
        brand.append(wordmark, descriptor);
        inner.appendChild(brand);

        const tagline = document.createElement('p');
        tagline.className = 'first-run-tagline';
        tagline.textContent = getLabel('titleScreen.tagline');
        inner.appendChild(tagline);

        // Rotating use-case hook, same slot and same classes as the first-run
        // screen. aria-hidden: decorative reinforcement — the tagline above
        // already tells a screen reader what the app is.
        const useCase = document.createElement('p');
        useCase.className = 'first-run-usecase';
        useCase.setAttribute('aria-hidden', 'true');
        const useCaseA = document.createElement('span');
        useCaseA.id = DOM_IDS.TITLE_SCREEN_USECASE_A;
        useCaseA.className = 'first-run-usecase-text';
        const useCaseB = document.createElement('span');
        useCaseB.id = DOM_IDS.TITLE_SCREEN_USECASE_B;
        useCaseB.className = 'first-run-usecase-text';
        useCase.append(useCaseA, useCaseB);
        inner.appendChild(useCase);

        const actions = document.createElement('div');
        actions.className = DOM_CLASSES.TITLE_SCREEN_ACTIONS;
        const buttons = document.createElement('div');
        buttons.className = 'first-run-buttons';
        buttons.append(
            this._buildAction(DOM_IDS.TITLE_SCREEN_CREATE_ROUTINE, 'titleScreen.createRoutine', DOM_IDS.NEW_MINI_CYCLE),
            this._buildAction(DOM_IDS.TITLE_SCREEN_OPEN_ROUTINE, 'titleScreen.openRoutine', DOM_IDS.OPEN_MINI_CYCLE),
            this._buildAction(DOM_IDS.TITLE_SCREEN_USER_MANUAL, 'titleScreen.userManual', DOM_IDS.OPEN_USER_MANUAL)
        );
        actions.appendChild(buttons);

        // Importing a backup is a RECOVERY path, not a daily action — same tier
        // and same treatment as "Restore from a backup file" on the first-run
        // screen, which sits below the pills as a quiet link.
        actions.appendChild(this._buildAction(
            DOM_IDS.TITLE_SCREEN_IMPORT_BACKUP,
            'titleScreen.importBackup',
            DOM_IDS.IMPORT_MINI_CYCLE,
            'first-run-restore'
        ));

        inner.appendChild(actions);

        // Credit line, same shape as #copyright in the app footer:
        //   © <year> sparkinCreations • miniCycle™
        // The website lives here rather than as a primary button — it is
        // reference material, the same tier as the legal links beneath it.
        const credit = document.createElement('p');
        credit.className = DOM_CLASSES.TITLE_SCREEN_CREDIT;
        credit.append(
            `${getLabel('titleScreen.copyright', { vars: { year: new Date().getFullYear() } })} `
        );

        const company = document.createElement('a');
        company.id = DOM_IDS.TITLE_SCREEN_WEBSITE;
        company.href = 'https://sparkincreations.com';
        company.target = '_blank';
        company.rel = 'noopener noreferrer';
        company.title = getLabel('titleScreen.companyTitle');
        company.textContent = getLabel('titleScreen.company');
        credit.appendChild(company);

        credit.append(' \u2022 ');

        const product = document.createElement('a');
        product.href = 'pages/product.html';
        product.target = '_blank';
        product.rel = 'noopener noreferrer';
        product.title = getLabel('titleScreen.productTitle');
        product.textContent = getLabel('titleScreen.product');
        const tm = document.createElement('sup');
        tm.textContent = '\u2122';
        product.appendChild(tm);
        credit.appendChild(product);

        const legal = document.createElement('div');
        legal.className = DOM_CLASSES.TITLE_SCREEN_LEGAL;
        LEGAL_LINKS.forEach(({ href, labelKey }) => {
            const a = document.createElement('a');
            a.href = href;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = getLabel(labelKey);
            legal.appendChild(a);
        });
        inner.appendChild(legal);
        // Credit sits BELOW the legal row: those are the pages a user might act
        // on, the credit is attribution.
        inner.appendChild(credit);

        // The tip line doubles as the way into the full archive — this surface was
        // meant to be where a user catches tips they missed, not just a menu.
        const tipBtn = document.createElement('button');
        tipBtn.type = 'button';
        tipBtn.id = DOM_IDS.TITLE_SCREEN_TIP_BTN;
        tipBtn.className = DOM_CLASSES.TITLE_SCREEN_TIP;
        tipBtn.setAttribute('aria-label', getLabel('titleScreen.tipAria'));
        this._bind(tipBtn, 'click', () => {
            // Optional + cross-phase: if the archive never loaded, the tip line is
            // still readable, it just does not expand.
            this.close();
            setTimeout(() => this.deps.openTipArchive?.(), 0);
        });
        inner.appendChild(tipBtn);
        this._startTips(tipBtn);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.id = DOM_IDS.TITLE_SCREEN_CLOSE;
        closeBtn.textContent = getLabel('titleScreen.close');
        closeBtn.setAttribute('aria-label', getLabel('titleScreen.closeAria'));
        this._bind(closeBtn, 'click', () => this.close());
        inner.appendChild(closeBtn);

        this.overlay.appendChild(inner);
        document.body.appendChild(this.overlay);

        this.overlay._previousFocus = document.activeElement;
        this.overlay.showModal();

        this._rememberSurface(SURFACE_TITLE_SCREEN);

        // Escape fires 'cancel' on <dialog>; route it through close() so the
        // listener teardown always runs. Without this the dialog closes but every
        // handler above stays attached to a detached element.
        this._cancelHandler = (event) => {
            event.preventDefault();
            this.close();
        };
        this.overlay.addEventListener('cancel', this._cancelHandler);

        closeBtn.focus({ focusVisible: false });
    }

    /**
     * Close the Welcome Screen and remove every listener it added.
     * @returns {void}
     */
    close() {
        if (!this.overlay) return;

        const overlay = this.overlay;
        this.overlay = null;

        this._rememberSurface(SURFACE_ROUTINE);

        this._stopTips();
        this._stopUseCases();

        this._handlers.forEach(([el, type, fn]) => el.removeEventListener(type, fn));
        this._handlers = [];

        if (this._cancelHandler) {
            overlay.removeEventListener('cancel', this._cancelHandler);
            this._cancelHandler = null;
        }

        overlay._previousFocus?.focus({ focusVisible: false });

        if (overlay.open) overlay.close();
        overlay.remove();
    }

    /**
     * Full teardown — called by destroyAllModules() on boot retry.
     * @returns {void}
     */
    destroy() {
        this.close();

        if (this._button && this._openHandler) {
            this._button.removeEventListener('click', this._openHandler);
        }
        this._openHandler = null;
        this._button = null;
        this.initialized = false;
    }
}

export const titleScreen = new TitleScreen();
