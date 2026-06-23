/**
 * Task View Layout Manager (DI-Pure)
 *
 * Owns the desktop drag-customize feature for the home view's "Task View"
 * region. Lets users reposition draggables — the task card group, Add-task
 * input, Quick Actions panel, status bubble (help window), and Complete
 * Cycle button — within the bounded #task-view rectangle.
 *
 * Phase 2: drag mechanic + hover-revealed handle for the two simple cases
 * (`task-card-group` and the Complete Cycle container). Architecture
 * supports more draggables — additional elements with non-trivial
 * positioning (side panels, input bar) ship in Phase 2b.
 *
 * Persistence (Phase 3), undo (Phase 4), reset (Phase 5), and the remaining
 * draggables (Phase 2b) are not yet wired — drag positions are in-memory
 * and lost on reload.
 *
 * Pattern: Simple Instance + per-element registry
 *
 * Reference: notifications.js:925-1119 (the drag implementation we're
 * generalising — pointer-capture, threshold, click-swallow, idempotency).
 *
 * See: docs/future-work/TASK_VIEW_CUSTOMIZATION_PLAN.md
 *
 * @module ui/taskViewLayoutManager
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_CLASSES, DOM_SELECTORS, Z_INDEX, LIMITS, LAYOUT_PLAY_AREA_INSETS, UI_TIMEOUTS, EVENTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { getIcon } from '../utils/icons.js';
import { isTouchDevice } from '../utils/deviceDetection.js';

const di = createDIModule('TaskViewLayoutManager', {
    AppState: optional(null),
    appInit: optional(null),
    getElementById: optional((id) => document.getElementById(id)),
    getBody: optional(() => document.body),
    // Undo wrapper silently skips snapshot capture while AppGlobalState.isInitializing
    // is true, and only taskCRUD/titleManager ever flip it. Without this, drag-saves
    // before the first task action would never produce an undo entry.
    enableUndoSystemOnFirstInteraction: optional(null),
});

export function setTaskViewLayoutManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

let taskViewLayoutManagerInstance = null;

/**
 * Per-draggable configuration. Add entries here as more elements are wired in.
 * For Phase 2 only the two simple in-flow elements are registered.
 *
 * `dock` (optional) defines a snap-back zone: when the user drops the
 * element with its center inside the zone, inline positioning is cleared
 * and the element returns to its default flex flow position. This keeps
 * elements like Complete Cycle "glued" to the task list bottom by default,
 * while still allowing free customization elsewhere.
 *
 * `handleHostSelector` (optional) — when the draggable element is much
 * larger than its visible body (e.g., a flex container that centers a
 * smaller button inside transparent space), the handle should attach to
 * the visible child instead so users can actually see and click it. The
 * draggable container is still what moves; only the handle's anchor
 * differs.
 *
 * `handlePosition` (optional) — visual placement of the handle relative
 * to its host. Defaults to `'inside-top-left'`. Use `'outside-left'`
 * when the host is a small button you don't want to overlay (the handle
 * floats just outside the host's left edge, vertically centered).
 *
 * `dock.tolerancePx` — vertical depth of the snap-back band adjacent to
 * the anchor.
 * `dock.widthFraction` — horizontal width of the snap zone, expressed as
 * a fraction of the anchor's current width (0..1, centered on anchor).
 * Defaults to 1.0 (full anchor width) if omitted.
 * `dock.side` — which edge of the anchor the snap zone hugs. `'bottom'`
 * places the band below; `'top'` above.
 *
 * @type {Array<{
 *   key: string,
 *   elementId: string,
 *   ariaLabelKey: string,
 *   handleHostSelector?: string,
 *   handlePosition?: 'inside-top-left' | 'outside-left' | 'top-center-above',
 *   dock?: { relativeToId: string, side: 'bottom' | 'top', tolerancePx: number, widthFraction?: number }
 * }>}
 */
const DRAGGABLES = [
    {
        key: 'task-card-group',
        elementId: DOM_IDS.TASK_CARD_GROUP,
        ariaLabelKey: 'accessibility.dragHandleTaskCard',
        // Anchor the handle to the inner .title-row so it sits in line
        // with the routine title vertically. .title-row spans the full
        // width of .task-card, so its left edge coincides with the card's
        // left edge — the handle ends up just outside the card's left
        // edge at title height.
        handleHostSelector: DOM_SELECTORS.TITLE_ROW,
        // Float to the left of the title row, vertically centered on it.
        handlePosition: 'outside-left'
    },
    {
        key: 'add-task-input',
        elementId: DOM_IDS.TASK_INPUT_ROW,
        ariaLabelKey: 'accessibility.dragHandleAddTask',
        // Handle floats just above the input bar, horizontally centered.
        handlePosition: 'top-center-above',
        // Default home is in #task-view's flex flow above the task card
        // group (input bar is now a true sibling of #task-card-group, no
        // re-parenting needed). Snap zone is the band directly above the
        // card where the input visually sits when docked.
        dock: {
            relativeToId: DOM_IDS.TASK_CARD_GROUP,
            side: 'top',
            tolerancePx: 80,
            widthFraction: 0.7
        }
    },
    {
        key: 'quick-actions-panel',
        elementId: DOM_IDS.QUICK_ACTIONS_WINDOW,
        ariaLabelKey: 'accessibility.dragHandleQuickActions',
        // Handle floats above the panel, horizontally centered.
        handlePosition: 'top-center-above'
        // No dock — the panel stays wherever the user puts it.
    },
    {
        key: 'status-bubble',
        elementId: DOM_IDS.HELP_WINDOW,
        ariaLabelKey: 'accessibility.dragHandleStatusBubble',
        handlePosition: 'top-center-above'
    },
    {
        key: 'complete-cycle-btn',
        elementId: DOM_IDS.COMPLETE_ALL_CONTAINER,
        ariaLabelKey: 'accessibility.dragHandleCompleteCycle',
        // Container is a wide flex column with the button centered inside
        // transparent space — anchor handle to the button itself.
        handleHostSelector: DOM_SELECTORS.COMPLETE_ALL_BTN,
        // Float handle just outside the button's left edge so it doesn't
        // overlap the icon+label and stays visible against any button color.
        handlePosition: 'outside-left',
        // Default home is below the task list; the button rides flex flow
        // when docked so it follows the task list as tasks are added/removed.
        // Snap zone is a narrow band (80px tall × 70% of card width,
        // centered) directly below the card so the user has to deliberately
        // aim near the card's bottom-center to re-dock.
        dock: {
            relativeToId: DOM_IDS.TASK_CARD_GROUP,
            side: 'bottom',
            tolerancePx: 80,
            widthFraction: 0.7
        }
    }
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export class TaskViewLayoutManager {
    constructor() {
        this.initialized = false;
        this._wrapper = null;
        /** @type {Map<string, {config: object, element: HTMLElement, handleHost: HTMLElement, customized: boolean}>} */
        this._registry = new Map();
        /** @type {Map<string, HTMLElement>} */
        this._handles = new Map();
        /** @type {Map<string, () => void>} */
        this._cleanupFns = new Map();
        /** @type {Map<string, MutationObserver>} */
        this._handleObservers = new Map();
        /** @type {Map<string, HTMLElement>} */
        this._snapIndicators = new Map();
        this._resizeHandler = null;
        this._resizeTimer = null;
        this._wasDesktop = false;
        /** @type {(() => void) | null} Abort fn for the currently-active drag. */
        this._activeDrag = null;
        this._dragInterruptHandler = null;
    }

    get deps() {
        return di.resolve();
    }

    init() {
        if (this.initialized) return;

        this._wrapper = this.deps.getElementById(DOM_IDS.TASK_VIEW);
        if (!this._wrapper) {
            console.warn('TaskViewLayoutManager: #task-view not found — skipping init');
            return;
        }

        // Register on all viewports — handles are CSS-hidden on touch /
        // tablet / mobile via the desktop-only `@media (hover: hover) and
        // (pointer: fine) and (min-width: 1024px)` rule, so listeners are
        // attached but inert. This lets a user resize from desktop down to
        // tablet/mobile and back without needing a reload to get drag back.
        for (const config of DRAGGABLES) {
            const element = this.deps.getElementById(config.elementId);
            if (!element) {
                console.warn(`TaskViewLayoutManager: draggable "${config.key}" element #${config.elementId} not found`);
                continue;
            }
            this._register(config, element);
        }

        // Watch viewport so dragged positions are scoped to desktop only.
        // Crossings:
        //   desktop → tablet/mobile: clear inline drag styles (saved data
        //     in state stays — user expects positions back when resizing
        //     up to desktop)
        //   tablet/mobile → desktop: re-apply saved positions from state
        this._wasDesktop = this._isDesktop();
        this._resizeHandler = () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                // A resize mid-drag (e.g. Stage Manager / Split View) invalidates
                // the drag geometry and iOS may not deliver pointerup — end any
                // active drag first so its chrome can't orphan.
                this._abortActiveDrag();
                const desktop = this._isDesktop();
                if (desktop && !this._wasDesktop) {
                    this._loadAndApplyPositions();
                } else if (!desktop && this._wasDesktop) {
                    this._clearAllCustomPositions();
                }
                this._wasDesktop = desktop;
            }, UI_TIMEOUTS.RESIZE_DEBOUNCE);
        };
        window.addEventListener('resize', this._resizeHandler);

        // Focus-mode awareness: customization applies to home view only.
        // On entering focus mode, clear inline drag styles so focus mode's
        // own deliberate layout takes over. On exiting, re-apply saved
        // positions so the user's home-view customization comes back.
        this._focusModeActivated = () => {
            this._clearAllCustomPositions();
        };
        this._focusModeDeactivated = () => {
            this._loadAndApplyPositions();
        };
        document.addEventListener(EVENTS.FOCUS_MODE_ACTIVATED, this._focusModeActivated);
        document.addEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, this._focusModeDeactivated);

        // iOS drops pointer capture when a PWA window is backgrounded,
        // switched, or resized via Stage Manager / Split View — WITHOUT
        // firing pointerup or pointercancel. That orphans an in-progress
        // drag's chrome (the dragging handle + the "Drop to dock" snap
        // indicator), leaving it stuck visible across orientations. Abort
        // any active drag on these signals so the chrome can't orphan.
        this._dragInterruptHandler = () => this._abortActiveDrag();
        document.addEventListener('visibilitychange', this._dragInterruptHandler);
        window.addEventListener('pagehide', this._dragInterruptHandler);

        // Initial load: apply saved positions on desktop home view, or
        // skip on tablet/mobile/focus-mode. Async so we wait for AppState
        // core ready.
        this._loadAndApplyPositions();

        this.initialized = true;
    }

    /**
     * Clear inline drag styles from every customized element so each falls
     * back to its CSS-defined responsive layout. Used when the viewport
     * crosses below desktop — keeps tablet/mobile layouts unaffected by
     * desktop-only drag customizations.
     */
    _clearAllCustomPositions() {
        for (const entry of this._registry.values()) {
            const el = entry.element;
            // Clear inline drag styles for anything that has them — both
            // user-customized AND dependent-docked elements (the latter
            // got inline styles from `_applySavedPosition` on load).
            // Skip elements with no inline drag styling for efficiency.
            if (!el.style.position && !el.style.left && !el.style.top &&
                !entry.customized) {
                continue;
            }
            el.style.position = '';
            el.style.left = '';
            el.style.top = '';
            el.style.right = '';
            el.style.bottom = '';
            el.style.transform = '';
            el.style.zIndex = '';
            el.style.width = '';
            el.classList.remove(DOM_CLASSES.TVL_CUSTOMIZED);
            el.classList.remove(DOM_CLASSES.TVL_DRAGGING);
            el.classList.remove(DOM_CLASSES.TVL_SNAP_HOVER);
            entry.customized = false;
        }
        // Hide any visible snap-target indicators too — the per-element loop
        // above clears element classes but not the indicator overlays, so a
        // resize that crosses out of desktop during/after a drag would
        // otherwise leave the "Drop to dock" indicator stuck visible.
        for (const indicator of this._snapIndicators.values()) {
            indicator.classList.remove(DOM_CLASSES.TVL_SNAP_TARGET_VISIBLE);
            indicator.classList.remove(DOM_CLASSES.TVL_SNAP_TARGET_ACTIVE);
        }
    }

    _isDesktop() {
        if (isTouchDevice()) return false;
        if (window.innerWidth < 1024) return false;
        return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    }

    _isFocusMode() {
        return this.deps.getBody().classList.contains(DOM_CLASSES.FOCUS_MODE);
    }

    /**
     * Drag-customization is desktop-only AND home-view-only. Focus view
     * has its own deliberate top-clearance layout that user customization
     * shouldn't override.
     */
    _shouldApplyLayout() {
        return this._isDesktop() && !this._isFocusMode();
    }

    // ========================================================================
    // PHASE 3 — PERSISTENCE
    // Saved positions live at `state.settings.taskViewLayout.positions`,
    // keyed by draggable key. Each entry holds `{ left, top, width }` in
    // wrapper-relative pixels. Positions are GLOBAL (not per-routine) per
    // user spec: layout is workspace ergonomics, not routine content.
    //
    // Saved positions only apply on desktop. On tablet/mobile each element
    // falls back to its CSS-defined responsive layout (the resize handler
    // clears inline drag styles when crossing below 1024px without
    // touching the saved data, so resizing back up restores the layout).
    // ========================================================================

    _readPositions() {
        try {
            const state = this.deps.AppState?.get?.();
            return state?.settings?.taskViewLayout?.positions || null;
        } catch {
            return null;
        }
    }

    /**
     * Persist an element's current position. `customized` distinguishes
     * elements the user explicitly dragged (`true`) from dependents that
     * were pulled along by an anchor drag (`false`). On load, a dependent
     * keeps its `customized=false` status so future anchor drags will
     * still pull it via the followingDeps offset capture; a customized
     * element is "free-floating" and won't follow the anchor.
     */
    _saveElementPosition(element, config, customized = true) {
        if (!this.deps.AppState?.update) return;
        const left = parseFloat(element.style.left);
        const top = parseFloat(element.style.top);
        const widthRaw = parseFloat(element.style.width);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return;
        const width = Number.isFinite(widthRaw) ? widthRaw : null;

        // Flip the undo system out of isInitializing so the wrapper captures
        // a pre-drag snapshot. Without this, the very first drag of a session
        // is silently dropped from the undo stack.
        this.deps.enableUndoSystemOnFirstInteraction?.();

        try {
            this.deps.AppState.update((state) => {
                if (!state.settings) return;
                if (!state.settings.taskViewLayout) {
                    state.settings.taskViewLayout = { positions: {} };
                }
                if (!state.settings.taskViewLayout.positions) {
                    state.settings.taskViewLayout.positions = {};
                }
                state.settings.taskViewLayout.positions[config.key] = {
                    left, top, width, customized
                };
            }, true);
        } catch (err) {
            console.warn('TaskViewLayoutManager: failed to save position', config.key, err);
        }
    }

    _clearSavedPosition(key) {
        if (!this.deps.AppState?.update) return;
        // Same first-interaction gate as _saveElementPosition — a dock-back
        // is a user action that should produce an undo entry.
        this.deps.enableUndoSystemOnFirstInteraction?.();
        try {
            this.deps.AppState.update((state) => {
                const positions = state.settings?.taskViewLayout?.positions;
                if (positions && Object.prototype.hasOwnProperty.call(positions, key)) {
                    delete positions[key];
                }
            }, true);
        } catch (err) {
            console.warn('TaskViewLayoutManager: failed to clear saved position', key, err);
        }
    }

    _applySavedPosition(key, pos) {
        const entry = this._registry.get(key);
        if (!entry || !entry.element) return;
        const el = entry.element;
        el.style.position = 'absolute';
        el.style.left = `${pos.left}px`;
        el.style.top = `${pos.top}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.transform = 'none';
        el.style.zIndex = '';
        if (Number.isFinite(pos.width)) {
            el.style.width = `${pos.width}px`;
        }
        // Default to customized=true if missing (back-compat with any
        // entries saved before the customized flag was added).
        const isCustomized = pos.customized !== false;
        if (isCustomized) {
            el.classList.add(DOM_CLASSES.TVL_CUSTOMIZED);
        }
        entry.customized = isCustomized;
    }

    /**
     * Load persisted positions from state and apply them to registered
     * draggables. Only runs on desktop (saved positions are scoped to
     * desktop per user spec). Awaits appInit.waitForCore so AppState is
     * guaranteed populated before we read it.
     */
    /**
     * Public reset entry point — clears every saved position from state
     * AND every inline drag style on registered elements, returning the
     * full task view to its default CSS-defined layout. Wired to the
     * "Reset Task View Layout" button in settings.
     *
     * @returns {boolean} true on success, false if AppState unavailable.
     */
    resetTaskViewLayout() {
        if (!this.deps.AppState?.update) return false;
        try {
            this.deps.AppState.update((state) => {
                if (state.settings?.taskViewLayout?.positions) {
                    state.settings.taskViewLayout.positions = {};
                }
            }, true);
        } catch (err) {
            console.warn('TaskViewLayoutManager: failed to clear saved positions', err);
            return false;
        }
        // Clear inline drag styles so all elements snap back to default.
        this._clearAllCustomPositions();
        return true;
    }

    /**
     * Reconcile current DOM positions to whatever's in
     * `state.settings.taskViewLayout.positions`. Called by the undo/redo
     * system after a snapshot restore so dragged elements visually follow
     * the state change.
     *
     * For each registered draggable:
     *   - Saved position present → apply it (idempotent).
     *   - Saved position absent  → clear inline drag styles so the element
     *     returns to its default flex-flow position.
     *
     * On non-desktop or in focus mode, all custom positioning is cleared
     * (the desktop-only gate normally suppresses application; undo could
     * land here directly without a viewport-resize trigger).
     *
     * @returns {boolean} true on success, false if AppState unavailable.
     */
    refreshTaskViewLayout() {
        if (!this.deps.AppState?.get) return false;
        if (!this._shouldApplyLayout()) {
            this._clearAllCustomPositions();
            return true;
        }
        const positions = this._readPositions() || {};
        for (const [key, entry] of this._registry.entries()) {
            const pos = positions[key];
            if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
                this._applySavedPosition(key, pos);
                continue;
            }
            // No saved position — strip inline drag styles so flex flow resumes.
            const el = entry.element;
            const hasInlineDrag = el.style.position || el.style.left || el.style.top;
            if (!hasInlineDrag && !entry.customized) continue;
            el.style.position = '';
            el.style.left = '';
            el.style.top = '';
            el.style.right = '';
            el.style.bottom = '';
            el.style.transform = '';
            el.style.zIndex = '';
            el.style.width = '';
            el.classList.remove(DOM_CLASSES.TVL_CUSTOMIZED);
            el.classList.remove(DOM_CLASSES.TVL_DRAGGING);
            el.classList.remove(DOM_CLASSES.TVL_SNAP_HOVER);
            entry.customized = false;
        }
        return true;
    }

    async _loadAndApplyPositions() {
        try {
            await this.deps.appInit?.waitForCore?.();
        } catch {
            // Fall through — try to read whatever state we have.
        }
        if (!this._shouldApplyLayout()) return;
        const positions = this._readPositions();
        if (!positions) return;
        for (const [key, pos] of Object.entries(positions)) {
            if (!pos || typeof pos !== 'object') continue;
            this._applySavedPosition(key, pos);
        }
    }

    _register(config, element) {
        element.classList.add(DOM_CLASSES.TVL_DRAGGABLE);

        const handle = this._createHandle(config);

        // Pick the handle's anchor host. Default = the draggable element
        // itself; opt-in via `handleHostSelector` for wide containers
        // where the visible body is a smaller child.
        let handleHost = element;
        if (config.handleHostSelector) {
            const child = element.querySelector(config.handleHostSelector);
            if (child) {
                child.classList.add(DOM_CLASSES.TVL_HANDLE_HOST);
                handleHost = child;
            } else {
                console.warn(`TaskViewLayoutManager: handleHostSelector "${config.handleHostSelector}" not found inside #${element.id} — falling back to draggable itself`);
            }
        }
        handleHost.appendChild(handle);

        this._attachDrag(handle, element, config);

        // Defensive re-injection: external code (e.g., taskUI.js setting
        // `completeAllButton.textContent = ...` on mode change) can wipe a
        // host's children, which removes our handle. Watch every host and
        // re-append the handle whenever it goes missing — applied uniformly
        // so future draggables don't silently lose their handles when some
        // unrelated module rebuilds their DOM.
        const observer = new MutationObserver(() => {
            if (!handle.isConnected && handleHost.isConnected) {
                handleHost.appendChild(handle);
            }
        });
        observer.observe(handleHost, { childList: true });
        this._handleObservers.set(config.key, observer);

        // JS-driven hover tracking (replaces CSS :hover-based reveal).
        // CSS :hover proved unreliable when the input bar is re-parented to
        // #task-view: the task card's handle sometimes wouldn't reveal even
        // when the cursor was clearly over the card. Manual mouseenter/leave
        // makes the reveal deterministic and side-steps any browser-specific
        // :hover propagation quirks across re-parented siblings.
        const onMouseEnter = () => element.classList.add(DOM_CLASSES.TVL_HOVERED);
        const onMouseLeave = () => element.classList.remove(DOM_CLASSES.TVL_HOVERED);
        element.addEventListener('mouseenter', onMouseEnter);
        element.addEventListener('mouseleave', onMouseLeave);

        // Append cleanup for the hover listeners onto the existing key cleanup.
        const existingCleanup = this._cleanupFns.get(config.key);
        this._cleanupFns.set(config.key, () => {
            if (existingCleanup) existingCleanup();
            element.removeEventListener('mouseenter', onMouseEnter);
            element.removeEventListener('mouseleave', onMouseLeave);
        });

        this._registry.set(config.key, { config, element, handleHost, customized: false });
        this._handles.set(config.key, handle);

        // If this draggable can re-dock, create a snap-target indicator —
        // a dashed-outline rectangle with a "Drop to dock" label showing
        // exactly where dropping will re-attach the element. Hidden until
        // drag starts.
        if (config.dock) {
            const indicator = document.createElement('div');
            indicator.className = DOM_CLASSES.TVL_SNAP_TARGET;
            indicator.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.className = DOM_CLASSES.TVL_SNAP_TARGET_LABEL;
            label.textContent = getLabel('accessibility.dropToDock');
            indicator.appendChild(label);
            this._wrapper.appendChild(indicator);
            this._snapIndicators.set(config.key, indicator);
        }
    }

    _createHandle(config) {
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = DOM_CLASSES.TVL_HANDLE;
        // tabindex=-1 keeps the handle out of the keyboard tab sequence in
        // Phase 2. Keyboard repositioning is a future enhancement; for now
        // the handle is a mouse-only affordance.
        handle.tabIndex = -1;
        const label = getLabel(config.ariaLabelKey);
        handle.setAttribute('aria-label', label);
        // Native browser tooltip on hover — same content as aria-label so
        // sighted users get the same "what is this?" hint that screen
        // reader users get from the aria-label.
        handle.title = label;
        handle.innerHTML = getIcon('drag-handle');
        handle.dataset.tvlKey = config.key;

        const position = config.handlePosition || 'inside-top-left';
        handle.classList.add(`tvl-handle--${position}`);

        return handle;
    }

    _attachDrag(handle, element, config) {
        let dragState = null;

        const onPointerDown = (e) => {
            // Primary mouse button only
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            // Only start drags when the layout feature is actually active
            // (desktop input + home view). Guards against starting a drag as
            // the viewport crosses the desktop boundary mid-resize.
            if (!this._shouldApplyLayout()) return;

            // Stop the pointerdown from bubbling — we don't want the host
            // element (e.g., the task card itself) to interpret this as a
            // tap/click. preventDefault avoids text selection.
            e.preventDefault();
            e.stopPropagation();

            const elementRect = element.getBoundingClientRect();
            const wrapperRect = this._wrapper.getBoundingClientRect();

            // Capture each dependent's *natural* offset relative to the
            // anchor BEFORE any drag-induced reflow. This preserves the
            // visual relationship: whatever gap the user sees between the
            // anchor and a dependent in flex flow is the gap that's kept
            // when the anchor moves. Skip:
            //   - customized dependents (user has explicitly placed them)
            //   - DOM-descendants of the anchor (they move with the anchor
            //     automatically through the DOM hierarchy, no manual
            //     repositioning needed)
            const followingDeps = [];
            const dependents = this._getDependentsOf(element.id);
            for (const depEntry of dependents) {
                if (depEntry.customized) continue;
                if (element.contains(depEntry.element)) continue;
                const depRect = depEntry.element.getBoundingClientRect();
                followingDeps.push({
                    entry: depEntry,
                    relativeOffsetLeft: depRect.left - elementRect.left,
                    relativeOffsetTop: depRect.top - elementRect.top
                });
            }

            dragState = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                offsetX: e.clientX - elementRect.left,
                offsetY: e.clientY - elementRect.top,
                elementWidth: elementRect.width,
                elementHeight: elementRect.height,
                seedLeftAbs: elementRect.left,
                seedTopAbs: elementRect.top,
                wrapperRect,
                followingDeps,
                started: false
            };

            try { handle.setPointerCapture(e.pointerId); } catch {
                /* pointer capture failures are non-fatal — drag still works
                   when pointer stays within the handle */
            }

            // Track this drag instance-wide so a global interruption handler
            // (visibilitychange / pagehide / resize) can force-end it if iOS
            // never delivers pointerup/pointercancel.
            this._activeDrag = abortDrag;
        };

        const onPointerMove = (ev) => {
            if (!dragState || ev.pointerId !== dragState.pointerId) return;

            const moveDistance = Math.abs(ev.clientX - dragState.startX) +
                                 Math.abs(ev.clientY - dragState.startY);

            if (!dragState.started && moveDistance > LIMITS.LAYOUT_DRAG_THRESHOLD) {
                this._beginDrag(element, config, dragState);
                dragState.started = true;
            }

            if (!dragState.started) return;

            ev.preventDefault();

            // Compute new viewport-absolute top-left for the element.
            const desiredAbsLeft = ev.clientX - dragState.offsetX;
            const desiredAbsTop = ev.clientY - dragState.offsetY;

            // Clamp to the play-area rect so users can't drag elements
            // off-screen or under the header/footer.
            const minAbsLeft = LAYOUT_PLAY_AREA_INSETS.left;
            const maxAbsLeft = window.innerWidth - dragState.elementWidth - LAYOUT_PLAY_AREA_INSETS.right;
            const minAbsTop = LAYOUT_PLAY_AREA_INSETS.top;
            const maxAbsTop = window.innerHeight - dragState.elementHeight - LAYOUT_PLAY_AREA_INSETS.bottom;

            const clampedAbsLeft = clamp(desiredAbsLeft, minAbsLeft, maxAbsLeft);
            const clampedAbsTop = clamp(desiredAbsTop, minAbsTop, maxAbsTop);

            // Convert to wrapper-relative coords for the inline style.
            // Re-read wrapper rect each frame in case it shifts (e.g.,
            // window resize mid-drag).
            const wrapperRect = this._wrapper.getBoundingClientRect();
            element.style.left = `${clampedAbsLeft - wrapperRect.left}px`;
            element.style.top = `${clampedAbsTop - wrapperRect.top}px`;

            // Live snap-zone hover feedback — visual cue that releasing
            // here will re-dock the element. Toggle both the dragged
            // element's outline and the snap-target indicator's active
            // state so the user sees both endpoints of the snap.
            if (config.dock) {
                const liveRect = element.getBoundingClientRect();
                const inSnap = this._isInSnapZone(liveRect, config.dock);
                element.classList.toggle(DOM_CLASSES.TVL_SNAP_HOVER, inSnap);
                const indicator = this._snapIndicators.get(config.key);
                if (indicator) {
                    indicator.classList.toggle(DOM_CLASSES.TVL_SNAP_TARGET_ACTIVE, inSnap);
                }
            }

            // Pull along non-DOM-descendant dependents using their captured
            // offsets, preserving their natural visual position relative
            // to the anchor.
            if (dragState.followingDeps.length > 0) {
                const wrapperRectMove = this._wrapper.getBoundingClientRect();
                for (const dep of dragState.followingDeps) {
                    const targetAbsLeft = clampedAbsLeft + dep.relativeOffsetLeft;
                    const targetAbsTop = clampedAbsTop + dep.relativeOffsetTop;
                    dep.entry.element.style.left = `${targetAbsLeft - wrapperRectMove.left}px`;
                    dep.entry.element.style.top = `${targetAbsTop - wrapperRectMove.top}px`;
                }
            }
        };

        const onPointerUp = (ev) => {
            if (!dragState || ev.pointerId !== dragState.pointerId) return;

            const wasDragged = dragState.started;
            try { handle.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }

            if (wasDragged) {
                // Hide the snap-target indicator regardless of drop result.
                if (config.dock) this._hideSnapTarget(config);
                // Decide on drop: snap back to dock, or hold absolute position.
                const dropRect = element.getBoundingClientRect();
                if (config.dock && this._isInSnapZone(dropRect, config.dock)) {
                    this._snapToDock(element, config);
                    // Re-dock cancels the user's customization — drop the
                    // saved position so the element falls back to its
                    // CSS-defined home on next load.
                    this._clearSavedPosition(config.key);
                } else {
                    this._endDrag(element);
                    // Save the dragged element as user-customized.
                    this._saveElementPosition(element, config, true);
                    // If this element is an anchor that pulled dependents
                    // along, save each one with customized=false so they
                    // reload still "following" — future anchor drags will
                    // continue to pull them along via offset capture.
                    if (dragState.followingDeps?.length) {
                        for (const dep of dragState.followingDeps) {
                            if (dep.entry?.customized) continue;
                            this._saveElementPosition(dep.entry.element, dep.entry.config, false);
                        }
                    }
                }
                // Swallow the synthesized click that follows pointerup so
                // that handlers on parent elements don't see a stray click.
                const swallowClick = (clickEvent) => {
                    clickEvent.preventDefault();
                    clickEvent.stopPropagation();
                    clickEvent.stopImmediatePropagation();
                };
                window.addEventListener('click', swallowClick, { capture: true, once: true });
                setTimeout(() => {
                    window.removeEventListener('click', swallowClick, { capture: true });
                }, 50);
            }

            dragState = null;
            if (this._activeDrag === abortDrag) this._activeDrag = null;
        };

        // Force-terminate this drag without a pointerup/pointercancel — used
        // when iOS drops pointer capture (window switch / Stage Manager
        // resize / backgrounding) and the normal teardown never fires.
        // Only clears transient drag state; the element keeps its current
        // inline position for the session but isn't persisted as customized.
        const abortDrag = () => {
            if (!dragState) return;
            try { handle.releasePointerCapture(dragState.pointerId); } catch { /* ignore */ }
            if (dragState.started) {
                if (config.dock) this._hideSnapTarget(config);
                this._endDrag(element);
            }
            dragState = null;
            if (this._activeDrag === abortDrag) this._activeDrag = null;
        };

        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);

        this._cleanupFns.set(config.key, () => {
            handle.removeEventListener('pointerdown', onPointerDown);
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerUp);
            handle.removeEventListener('pointercancel', onPointerUp);
        });
    }

    _beginDrag(element, config, dragState) {
        element.classList.add(DOM_CLASSES.TVL_DRAGGING);
        this.deps.getBody().style.userSelect = 'none';

        const wrapperRect = this._wrapper.getBoundingClientRect();
        // Seed the element's absolute position from its current bounding
        // rect so the visual position doesn't jump when we flip from
        // flow → absolute. The first pointermove after this point will
        // adjust based on cursor delta.
        element.style.position = 'absolute';
        element.style.left = `${dragState.seedLeftAbs - wrapperRect.left}px`;
        element.style.top = `${dragState.seedTopAbs - wrapperRect.top}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        // Clear any CSS-defined transform (e.g., the side panels use
        // `transform: translateY(-50%)` for vertical centering) so our
        // left/top math directly corresponds to the visual position.
        element.style.transform = 'none';
        element.style.zIndex = String(Z_INDEX.TASK_VIEW_DRAGGING);
        // Width must be locked at the seed-rect width — once absolute,
        // the element no longer participates in the flex flow that was
        // sizing it (e.g., the task card group was 100% of #task-view's
        // content width via flex). Without this, it would collapse to
        // its content width.
        element.style.width = `${dragState.elementWidth}px`;

        const entry = this._registry.get(config.key);
        if (entry) {
            entry.customized = true;
            element.classList.add(DOM_CLASSES.TVL_CUSTOMIZED);
        }

        // Pull along any dependents that don't already follow via the DOM
        // hierarchy. Use the natural offsets captured at pointerdown so
        // the visual relationship (e.g., the Complete button's exact gap
        // below the card) is preserved 1:1 — no synthetic gap math that
        // could push things farther than the user expects.
        const wrapperRectNow = this._wrapper.getBoundingClientRect();
        for (const dep of dragState.followingDeps) {
            this._prepDependentForFollow(dep.entry.element);
            const targetAbsLeft = dragState.seedLeftAbs + dep.relativeOffsetLeft;
            const targetAbsTop = dragState.seedTopAbs + dep.relativeOffsetTop;
            dep.entry.element.style.left = `${targetAbsLeft - wrapperRectNow.left}px`;
            dep.entry.element.style.top = `${targetAbsTop - wrapperRectNow.top}px`;
        }

        // If this element can re-dock, show its snap-target indicator so
        // the user sees exactly where to drop to re-attach.
        if (config.dock) {
            this._showSnapTarget(config);
        }
    }

    _showSnapTarget(config) {
        const indicator = this._snapIndicators.get(config.key);
        if (!indicator) return;
        const zone = this._getSnapZoneRect(config.dock);
        if (!zone) return;
        const wrapperRect = this._wrapper.getBoundingClientRect();
        indicator.style.left = `${zone.left - wrapperRect.left}px`;
        indicator.style.top = `${zone.top - wrapperRect.top}px`;
        indicator.style.width = `${zone.width}px`;
        indicator.style.height = `${zone.height}px`;
        indicator.classList.add(DOM_CLASSES.TVL_SNAP_TARGET_VISIBLE);
        indicator.classList.remove(DOM_CLASSES.TVL_SNAP_TARGET_ACTIVE);
    }

    _hideSnapTarget(config) {
        const indicator = this._snapIndicators.get(config.key);
        if (!indicator) return;
        indicator.classList.remove(DOM_CLASSES.TVL_SNAP_TARGET_VISIBLE);
        indicator.classList.remove(DOM_CLASSES.TVL_SNAP_TARGET_ACTIVE);
    }

    /**
     * Force-terminate any in-progress drag and clear all transient drag
     * chrome. Called on iOS interruption signals (visibilitychange / pagehide
     * / Stage Manager resize) where pointerup/pointercancel never fire, and as
     * a safety sweep so a previously-orphaned drag can't leave the dragging
     * handle or "Drop to dock" snap indicator stuck visible across
     * orientations. Only transient state is cleared — saved custom positions
     * (`.tvl-customized` + persisted coords) are untouched.
     */
    _abortActiveDrag() {
        if (this._activeDrag) {
            try { this._activeDrag(); } catch { /* ignore */ }
        }
        // Belt-and-suspenders sweep: a drag interrupted before this handler
        // ran (or in another draggable) may have orphaned chrome.
        for (const entry of this._registry.values()) {
            entry.element.classList.remove(DOM_CLASSES.TVL_DRAGGING);
            entry.element.classList.remove(DOM_CLASSES.TVL_SNAP_HOVER);
            entry.element.classList.remove(DOM_CLASSES.TVL_HOVERED);
        }
        for (const indicator of this._snapIndicators.values()) {
            indicator.classList.remove(DOM_CLASSES.TVL_SNAP_TARGET_VISIBLE);
            indicator.classList.remove(DOM_CLASSES.TVL_SNAP_TARGET_ACTIVE);
        }
        try { this.deps.getBody().style.userSelect = ''; } catch { /* ignore */ }
    }

    /**
     * Find every registered draggable whose dock config points at the given
     * anchor element id. These are the dependents that should ride along
     * when the anchor is dragged.
     */
    _getDependentsOf(anchorElementId) {
        const result = [];
        for (const entry of this._registry.values()) {
            if (entry.config.dock?.relativeToId === anchorElementId) {
                result.push(entry);
            }
        }
        return result;
    }

    _findEntryByElement(element) {
        if (!element) return null;
        for (const entry of this._registry.values()) {
            if (entry.element === element) return entry;
        }
        return null;
    }

    _prepDependentForFollow(dep) {
        const rect = dep.getBoundingClientRect();
        // Lock width FIRST (while still in flow gives the natural width).
        dep.style.width = `${rect.width}px`;
        dep.style.position = 'absolute';
        dep.style.right = 'auto';
        dep.style.bottom = 'auto';
    }

    /**
     * Place a dependent element horizontally centered next to an anchor,
     * on the side the dependent's dock config specifies (`'top'` puts it
     * above the anchor, `'bottom'` below). Coords come from the anchor's
     * known viewport-absolute box so we avoid a forced reflow.
     */
    _positionDependentRelativeToAnchor(dep, dockConfig, anchorAbsLeft, anchorAbsTop, anchorAbsBottom, anchorWidth) {
        const wrapperRect = this._wrapper.getBoundingClientRect();
        const depRect = dep.getBoundingClientRect();
        const depWidth = dep.offsetWidth || depRect.width;
        const depHeight = dep.offsetHeight || depRect.height;
        const targetAbsLeft = anchorAbsLeft + (anchorWidth - depWidth) / 2;
        const targetAbsTop = dockConfig.side === 'top'
            ? anchorAbsTop - LIMITS.LAYOUT_DOCK_GAP - depHeight
            : anchorAbsBottom + LIMITS.LAYOUT_DOCK_GAP;
        dep.style.left = `${targetAbsLeft - wrapperRect.left}px`;
        dep.style.top = `${targetAbsTop - wrapperRect.top}px`;
    }

    _endDrag(element) {
        element.classList.remove(DOM_CLASSES.TVL_DRAGGING);
        element.classList.remove(DOM_CLASSES.TVL_SNAP_HOVER);
        this.deps.getBody().style.userSelect = '';
        // Drop the elevated z-index — the customized class handles any
        // ongoing stacking concerns. Keep the position/coords as set.
        element.style.zIndex = '';
        // Drop any lingering focus on the handle that the click placed
        // there. Without this, the handle button keeps focus and any CSS
        // rule keyed on `:focus-within` of the parent draggable would stay
        // active across drags, causing surprising visibility states.
        const focused = document.activeElement;
        if (focused && element.contains(focused) && focused.classList.contains(DOM_CLASSES.TVL_HANDLE)) {
            focused.blur();
        }
    }

    /**
     * Test whether `elementRect` (viewport-absolute) sits inside the
     * snap-back zone for a given draggable. The zone is a band adjacent to
     * an anchor element on the configured side, with horizontal extent
     * matching the anchor's width and vertical extent given by tolerancePx.
     *
     * Only `side: 'bottom'` is supported in Phase 2.
     */
    /**
     * Compute the snap-zone rect (viewport-absolute) for a given dock config.
     * Returns null if the anchor element is missing. Used both for hit-testing
     * and for placing the visual indicator.
     */
    _getSnapZoneRect(dockConfig) {
        const anchor = this.deps.getElementById(dockConfig.relativeToId);
        if (!anchor) return null;
        const anchorRect = anchor.getBoundingClientRect();
        const widthFraction = dockConfig.widthFraction ?? 1;
        const zoneWidth = anchorRect.width * widthFraction;
        const zoneLeft = anchorRect.left + (anchorRect.width - zoneWidth) / 2;
        const tol = dockConfig.tolerancePx;
        const top = dockConfig.side === 'top'
            ? anchorRect.top - tol     // band above the anchor
            : anchorRect.bottom;       // band below the anchor (default)
        return {
            left: zoneLeft,
            top,
            width: zoneWidth,
            height: tol
        };
    }

    _isInSnapZone(elementRect, dockConfig) {
        const zone = this._getSnapZoneRect(dockConfig);
        if (!zone) return false;
        const elementCenterX = elementRect.left + elementRect.width / 2;
        const elementCenterY = elementRect.top + elementRect.height / 2;
        return (
            elementCenterX >= zone.left &&
            elementCenterX <= zone.left + zone.width &&
            elementCenterY >= zone.top &&
            elementCenterY <= zone.top + zone.height
        );
    }

    /**
     * Re-dock an element to its anchor. The user has signaled "stick to
     * the anchor again" by dropping inside the snap zone.
     *
     * If the anchor is currently in flex flow (not customized), the
     * dependent also returns to flex flow — the natural layout glues
     * them together and either one rides resizes/insertions automatically.
     *
     * If the anchor is currently absolute (customized), keep the
     * dependent absolute and position it below the anchor's current
     * location. The dependent is still considered "docked"
     * (`customized=false`) so it will follow on subsequent anchor drags.
     */
    _snapToDock(element, config) {
        element.classList.remove(DOM_CLASSES.TVL_DRAGGING);
        element.classList.remove(DOM_CLASSES.TVL_SNAP_HOVER);
        element.classList.remove(DOM_CLASSES.TVL_CUSTOMIZED);
        this.deps.getBody().style.userSelect = '';

        const entry = this._registry.get(config.key);
        if (entry) entry.customized = false;

        const anchor = this.deps.getElementById(config.dock.relativeToId);
        const anchorEntry = this._findEntryByElement(anchor);

        if (anchorEntry && anchorEntry.customized && anchor) {
            // Anchor is absolute — stay absolute, glued next to it on the
            // side this dependent's dock config specifies.
            const anchorRect = anchor.getBoundingClientRect();
            this._prepDependentForFollow(element);
            this._positionDependentRelativeToAnchor(
                element,
                config.dock,
                anchorRect.left,
                anchorRect.top,
                anchorRect.bottom,
                anchorRect.width
            );
            element.style.zIndex = '';
        } else {
            // Anchor is in flex flow — return dependent to flex flow too
            // by clearing inline styles. The element's natural CSS layout
            // (now that it's a true sibling in #task-view) places it back
            // at its default visual position.
            element.style.position = '';
            element.style.left = '';
            element.style.top = '';
            element.style.right = '';
            element.style.bottom = '';
            element.style.transform = '';
            element.style.zIndex = '';
            element.style.width = '';
        }
    }

    destroy() {
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }
        clearTimeout(this._resizeTimer);
        this._resizeTimer = null;

        if (this._focusModeActivated) {
            document.removeEventListener(EVENTS.FOCUS_MODE_ACTIVATED, this._focusModeActivated);
            this._focusModeActivated = null;
        }
        if (this._focusModeDeactivated) {
            document.removeEventListener(EVENTS.FOCUS_MODE_DEACTIVATED, this._focusModeDeactivated);
            this._focusModeDeactivated = null;
        }

        if (this._dragInterruptHandler) {
            document.removeEventListener('visibilitychange', this._dragInterruptHandler);
            window.removeEventListener('pagehide', this._dragInterruptHandler);
            this._dragInterruptHandler = null;
        }

        for (const cleanup of this._cleanupFns.values()) {
            try { cleanup(); } catch { /* ignore */ }
        }
        this._cleanupFns.clear();

        for (const observer of this._handleObservers.values()) {
            try { observer.disconnect(); } catch { /* ignore */ }
        }
        this._handleObservers.clear();

        for (const indicator of this._snapIndicators.values()) {
            indicator.remove();
        }
        this._snapIndicators.clear();

        for (const [key, handle] of this._handles) {
            const entry = this._registry.get(key);
            if (entry?.element) {
                entry.element.classList.remove(DOM_CLASSES.TVL_DRAGGABLE);
                entry.element.classList.remove(DOM_CLASSES.TVL_DRAGGING);
                entry.element.classList.remove(DOM_CLASSES.TVL_CUSTOMIZED);
                entry.element.classList.remove(DOM_CLASSES.TVL_SNAP_HOVER);
                entry.element.classList.remove(DOM_CLASSES.TVL_HOVERED);
                if (entry.handleHost && entry.handleHost !== entry.element) {
                    entry.handleHost.classList.remove(DOM_CLASSES.TVL_HANDLE_HOST);
                }
                // Reset inline positioning so subsequent reinit (boot retry)
                // starts from flow position. Persistence layer (Phase 3)
                // will re-apply saved positions on init.
                entry.element.style.position = '';
                entry.element.style.left = '';
                entry.element.style.top = '';
                entry.element.style.right = '';
                entry.element.style.bottom = '';
                entry.element.style.transform = '';
                entry.element.style.zIndex = '';
                entry.element.style.width = '';
            }
            handle.remove();
        }
        this._handles.clear();
        this._registry.clear();

        this._wrapper = null;
        this.initialized = false;
    }
}

export function getTaskViewLayoutManager() {
    if (!taskViewLayoutManagerInstance) {
        taskViewLayoutManagerInstance = new TaskViewLayoutManager();
    }
    return taskViewLayoutManagerInstance;
}

export function initTaskViewLayoutManager() {
    const instance = getTaskViewLayoutManager();
    instance.init();
    return instance;
}
