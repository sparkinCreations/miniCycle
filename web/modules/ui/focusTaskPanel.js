/**
 * Focus Task Panel (DI-Pure)
 *
 * One-task-at-a-time card for focus view — the routine's "current step."
 * Carousel panel at index 0 (left of the routine list). Focus-view-only and
 * gated behind onboarding; Phase 2 registers it with the panel carousel.
 * See docs/archive/FOCUS_TASK_VIEW_PLAN.md (Phase 1, decisions D2–D5).
 *
 * Behavior contract:
 *  - Shows the FIRST INCOMPLETE task in list order (D2). ‹ › browse the full
 *    task list — including completed tasks, rendered dimmed (D3/D4) — as a
 *    temporary override that resets on routine switch / cycle reset / clear.
 *  - Completing goes through THE SAME PATH as tapping a task in the list:
 *    enableUndoSystemOnFirstInteraction → checkbox.checked flip →
 *    dispatchEvent('change') → checkMiniCycle (taskEvents.js pattern), so
 *    undo, progress, achievements, and auto-cycle detection all just work.
 *  - Mode-honoring (D5): the always-visible cycle/clear control is focus
 *    view's existing floating action button — NOT duplicated here. This panel
 *    reacts: on a cycle reset (cycleCount bump) while visible it plays a
 *    short card celebration (UI_TIMEOUTS.FOCUS_TASK_CELEBRATION) and then
 *    renders task 1.
 *
 * @module ui/focusTaskPanel
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DATA_SELECTORS, DOM_CLASSES, UI_TIMEOUTS, GESTURE,
         DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { getCycleMode, getAllDoneHintKey, getDeleteSettingsMode,
         resolveDeleteWhenComplete, getTaskResetIndicator } from '../utils/cycleMode.js';

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

const di = createDIModule('FocusTaskPanel', {
    AppState: required(),
    appInit: optional(null),
    // Completion-path companions (same trio the task-list tap uses)
    checkMiniCycle: optional(null),
    enableUndoSystemOnFirstInteraction: optional(null),
    safeAddEventListener: optional(null),
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel))
});

export const setFocusTaskPanelDependencies = di.setDependencies;

const SUBSCRIBER_KEY = 'focusTaskPanel';

// ============================================================================
// PANEL CLASS
// ============================================================================

export class FocusTaskPanel {
    constructor() {
        this.elements = {};
        this._overrideTaskId = null;   // ‹ › browse override (D2) — null = auto (first incomplete)
        this._celebrationTimer = null;
        this._subscribed = false;
        this._onStateChange = this._onStateChange.bind(this);
        this._boundComplete = () => this._completeCurrent();
        this._boundPrev = () => this._step(-1);
        this._boundNext = () => this._step(1);
        // Vertical swipe-to-skip (touch): swipe up = next, down = previous
        this._touch = { startX: 0, startY: 0, tracking: false };
        this._boundTouchStart = (e) => this._onPanelTouchStart(e);
        this._boundTouchMove = (e) => this._onPanelTouchMove(e);
        this._boundTouchEnd = () => { this._touch.tracking = false; };
        this.initialized = false;
    }

    get deps() {
        return di.resolve();
    }

    async init() {
        if (this.initialized) return;
        const appInit = this.deps.appInit;
        if (appInit?.waitForCore) {
            await appInit.waitForCore();
        }

        this._cacheElements();
        if (!this.elements.panel) {
            console.warn('⚠️ FocusTaskPanel: #focus-task-panel markup missing — init skipped');
            return;
        }

        this._applyStaticLabels();
        this._attachListeners();
        this._subscribe();
        this.render();
        this.initialized = true;
    }

    /** Tear down listeners/subscription/timers (boot retry via destroyAllModules). */
    destroy() {
        if (this._celebrationTimer) {
            clearTimeout(this._celebrationTimer);
            this._celebrationTimer = null;
        }
        if (this._subscribed) {
            this.deps.AppState.unsubscribe?.(SUBSCRIBER_KEY, this._onStateChange);
            this._subscribed = false;
        }
        const { completeBtn, prevBtn, nextBtn, panel } = this.elements;
        completeBtn?.removeEventListener('click', this._boundComplete);
        prevBtn?.removeEventListener('click', this._boundPrev);
        nextBtn?.removeEventListener('click', this._boundNext);
        panel?.removeEventListener('touchstart', this._boundTouchStart);
        panel?.removeEventListener('touchmove', this._boundTouchMove);
        panel?.removeEventListener('touchend', this._boundTouchEnd);
        this.initialized = false;
    }

    /**
     * Clear the ‹ › browse override (D2). Called on routine switch, cycle
     * reset, and — in Phase 2 — when the carousel leaves this panel.
     */
    clearOverride() {
        this._overrideTaskId = null;
    }

    // ------------------------------------------------------------------
    // Data helpers
    // ------------------------------------------------------------------

    _getActiveCycle(state = null) {
        const s = state || this.deps.AppState.get?.();
        const cycleId = s?.appState?.activeCycleId;
        const cycle = cycleId ? s?.data?.cycles?.[cycleId] : null;
        return { cycleId: cycleId ?? null, cycle: cycle ?? null };
    }

    _getTasks(state = null) {
        const { cycle } = this._getActiveCycle(state);
        return Array.isArray(cycle?.tasks) ? cycle.tasks : [];
    }

    /** The task the card shows: override if valid, else first incomplete. */
    _currentTask() {
        const tasks = this._getTasks();
        if (this._overrideTaskId) {
            const overridden = tasks.find(t => t.id === this._overrideTaskId);
            if (overridden) return overridden;
            this._overrideTaskId = null; // task gone (deleted/cleared) — fall through
        }
        return tasks.find(t => !t.completed) ?? null;
    }

    /** 'auto' | 'manual' | 'todo' — same flag resolution as routineSwitcher. */
    _getMode() {
        return getCycleMode(this._getActiveCycle().cycle);
    }

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    render() {
        const { panel, card, position, text, completeBtn, prevBtn, nextBtn,
                alldone, alldoneText, alldoneHint, recurringIndicator, dueIndicator,
                resetIndicator } = this.elements;
        if (!panel) return;

        // A celebration in progress owns the card until its timer ends
        if (this._celebrationTimer) return;
        this.elements.celebration.classList.add(DOM_CLASSES.HIDDEN);

        // Re-resolve ARIA labels/titles every render so vocab-theme switches
        // (which fire a state change → render) retheme them live (Phase 3).
        this._applyStaticLabels();

        const tasks = this._getTasks();
        const task = this._currentTask();

        const taskFacing = [position, text, completeBtn, prevBtn?.parentElement].filter(Boolean);

        if (!task) {
            // All complete (or no tasks): all-done state (D5) — the floating
            // focus action button is the cycle/clear control, we just hint.
            taskFacing.forEach(el => el.classList.add(DOM_CLASSES.HIDDEN));
            alldone.classList.remove(DOM_CLASSES.HIDDEN);
            alldoneText.textContent = tasks.length ? getLabel('focusTask.allDone') : getLabel('empty.noTasks');
            // Three modes, not two. The old binary branch sent AUTO-cycle users
            // to "use the cycle button" — but the floating action button is
            // hidden by CSS in auto mode, so it named a control that is not on
            // screen. getAllDoneHintKey() owns the mapping for both this panel
            // and the home-view empty state.
            alldoneHint.textContent = tasks.length
                ? getLabel(getAllDoneHintKey(this._getActiveCycle().cycle))
                : '';
            card.classList.remove('focus-task-completed');
            card.style.removeProperty('--focus-task-priority');
            return;
        }

        alldone.classList.add(DOM_CLASSES.HIDDEN);
        taskFacing.forEach(el => el.classList.remove(DOM_CLASSES.HIDDEN));

        const index = tasks.indexOf(task);
        position.textContent = getLabel('focusTask.position', {
            vars: { current: index + 1, total: tasks.length }
        });
        text.textContent = task.text ?? task.taskText ?? '';

        // Completed task being browsed via ‹ › (D4) — dimmed, button unchecks
        const isCompleted = !!task.completed;
        card.classList.toggle('focus-task-completed', isCompleted);
        completeBtn.textContent = getLabel(isCompleted ? 'focusTask.uncompleteTask' : 'focusTask.completeTask');

        // Priority accent (border-left via CSS var; transparent when not flagged)
        if (task.highPriority) {
            card.style.setProperty('--focus-task-priority', task.priorityColor || 'var(--color-red)');
        } else {
            card.style.removeProperty('--focus-task-priority');
        }

        // Indicators
        recurringIndicator.classList.toggle(DOM_CLASSES.HIDDEN, !task.recurring);
        this._renderResetIndicator(resetIndicator, task);
        if (task.dueDate) {
            dueIndicator.textContent = getLabel('focusTask.dueLabel', { vars: { date: task.dueDate } });
            dueIndicator.classList.remove(DOM_CLASSES.HIDDEN);
        } else {
            dueIndicator.classList.add(DOM_CLASSES.HIDDEN);
        }

        // ‹ › clamp at the list ends
        prevBtn.disabled = index <= 0;
        nextBtn.disabled = index >= tasks.length - 1;
    }

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------

    /**
     * Complete (or uncheck) the current task via the SAME path as tapping the
     * task in the list (taskEvents.js pattern): flip the real checkbox and
     * dispatch 'change', then run the cycle check. The re-render falls out of
     * the AppState subscription.
     */
    _completeCurrent() {
        const task = this._currentTask();
        if (!task) return;

        const taskEl = document.querySelector(DATA_SELECTORS.taskById(task.id));
        const checkbox = taskEl?.querySelector(DOM_SELECTORS.TASK_CHECKBOX);
        if (!checkbox) {
            console.warn(`⚠️ FocusTaskPanel: task ${task.id} not in the rendered list — cannot complete`);
            return;
        }

        const wasCompleted = checkbox.checked;
        this.deps.enableUndoSystemOnFirstInteraction?.();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
        this.deps.checkMiniCycle?.({ lastToggledElement: taskEl });

        // Usage metric (plan Phase 3): count completions made THROUGH the
        // card so the feature's real-world use is measurable. Lives in
        // userProgress (stats home), NOT quickActions counts — those drive
        // the quick-actions MRU UI and must only contain action-button ids.
        if (!wasCompleted) {
            this.deps.AppState.update?.(s => {
                if (!s.userProgress) s.userProgress = {};
                s.userProgress.focusTaskCompletions = (s.userProgress.focusTaskCompletions || 0) + 1;
            });
        }

        // Auto-advance (D2): drop any browse override so the next render
        // shows the first incomplete task.
        this._overrideTaskId = null;
    }

    /** ‹ › browse (D3/D4): step through the FULL task list, clamped. */
    _step(direction) {
        const tasks = this._getTasks();
        if (!tasks.length) return;
        const current = this._currentTask();
        const currentIndex = current ? tasks.indexOf(current) : -1;
        const target = Math.max(0, Math.min(tasks.length - 1, currentIndex + direction));
        if (target === currentIndex) return;
        this._overrideTaskId = tasks[target].id;
        this.render();
    }

    // ------------------------------------------------------------------
    // State subscription (re-render + reset/celebration detection, D5)
    // ------------------------------------------------------------------

    _subscribe() {
        if (!this.deps.AppState.subscribe) return;
        this.deps.AppState.subscribe(SUBSCRIBER_KEY, this._onStateChange);
        this._subscribed = true;
    }

    _onStateChange(newState, oldState) {
        const newActive = newState?.appState?.activeCycleId;
        const oldActive = oldState?.appState?.activeCycleId;

        if (newActive !== oldActive) {
            // Routine switch: override + celebration are meaningless now
            this.clearOverride();
            this._cancelCelebration();
            this.render();
            return;
        }

        // Cycle reset detection: cycleCount bump on the active cycle (fires
        // for auto-cycle last-task completion AND the manual Complete Cycle
        // button — both land on task 1, per D5).
        const newCount = newState?.data?.cycles?.[newActive]?.cycleCount ?? 0;
        const oldCount = oldState?.data?.cycles?.[oldActive]?.cycleCount ?? 0;
        if (newCount > oldCount) {
            this.clearOverride();
            if (this._isPanelVisible()) {
                this._celebrate();
                return; // render happens when the celebration ends
            }
        }

        this.render();
    }

    _isPanelVisible() {
        return !!this.elements.panel?.classList.contains(DOM_CLASSES.SHOW);
    }

    // ------------------------------------------------------------------
    // Celebration (D5 — card-visual only; must not fight the existing
    // cycle-complete notification flow)
    // ------------------------------------------------------------------

    _celebrate(durationMs = UI_TIMEOUTS.FOCUS_TASK_CELEBRATION) {
        this._cancelCelebration();
        const { celebration, celebrationText, alldone } = this.elements;

        // Hide task-facing content + all-done; show the celebration card
        [this.elements.position, this.elements.text, this.elements.completeBtn,
         this.elements.prevBtn?.parentElement, alldone].filter(Boolean)
            .forEach(el => el.classList.add(DOM_CLASSES.HIDDEN));
        celebrationText.textContent = getLabel('notify.cycleComplete');
        celebration.classList.remove(DOM_CLASSES.HIDDEN);

        this._celebrationTimer = setTimeout(() => {
            this._celebrationTimer = null;
            celebration.classList.add(DOM_CLASSES.HIDDEN);
            this.render(); // fresh cycle → task 1
        }, durationMs);
    }

    _cancelCelebration() {
        if (this._celebrationTimer) {
            clearTimeout(this._celebrationTimer);
            this._celebrationTimer = null;
            this.elements.celebration?.classList.add(DOM_CLASSES.HIDDEN);
        }
    }

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------

    /**
     * 🧹 / 📌 — whether this task survives a reset or clear.
     *
     * The rule is NOT "show what deleteWhenComplete says": it differs per mode
     * and special-cases recurring tasks in both directions, so it is derived by
     * getTaskResetIndicator, shared with the routine list (taskDOM). Without
     * that sharing the same task could show 🧹 in the list and nothing here.
     *
     * Given a name rather than aria-hidden (as the recurring glyph is) because
     * this one carries information the card shows nowhere else.
     */
    _renderResetIndicator(el, task) {
        if (!el) return;

        const state = this.deps.AppState.get();
        const cycle = state?.data?.cycles?.[state?.appState?.activeCycleId];
        const mode = getDeleteSettingsMode(cycle);

        const indicator = getTaskResetIndicator({
            deleteWhenComplete: resolveDeleteWhenComplete({
                settings: task.deleteWhenCompleteSettings,
                legacy: task.deleteWhenComplete,
                mode,
                defaults: DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
            }),
            isRecurring: !!task.recurring,
            mode
        });

        if (!indicator) {
            el.classList.add(DOM_CLASSES.HIDDEN);
            el.textContent = '';
            el.removeAttribute('aria-label');
            el.removeAttribute('title');
            return;
        }

        const isClear = indicator === 'clear';
        const name = getLabel(isClear ? 'focusTask.indicatorClear' : 'focusTask.indicatorKeep');
        el.textContent = isClear ? '🧹' : '📌';
        el.setAttribute('aria-label', name);
        el.setAttribute('title', name);
        el.classList.remove(DOM_CLASSES.HIDDEN);
    }

    _cacheElements() {
        const byId = this.deps.getElementById;
        this.elements = {
            panel: byId(DOM_IDS.FOCUS_TASK_PANEL),
            position: byId(DOM_IDS.FOCUS_TASK_POSITION),
            text: byId(DOM_IDS.FOCUS_TASK_TEXT),
            recurringIndicator: byId(DOM_IDS.FOCUS_TASK_RECURRING_INDICATOR),
            dueIndicator: byId(DOM_IDS.FOCUS_TASK_DUE_INDICATOR),
            resetIndicator: byId(DOM_IDS.FOCUS_TASK_RESET_INDICATOR),
            completeBtn: byId(DOM_IDS.FOCUS_TASK_COMPLETE_BTN),
            prevBtn: byId(DOM_IDS.FOCUS_TASK_PREV_BTN),
            nextBtn: byId(DOM_IDS.FOCUS_TASK_NEXT_BTN),
            alldone: byId(DOM_IDS.FOCUS_TASK_ALLDONE),
            alldoneText: byId(DOM_IDS.FOCUS_TASK_ALLDONE_TEXT),
            alldoneHint: byId(DOM_IDS.FOCUS_TASK_ALLDONE_HINT),
            celebration: byId(DOM_IDS.FOCUS_TASK_CELEBRATION),
            celebrationText: byId(DOM_IDS.FOCUS_TASK_CELEBRATION_TEXT)
        };
        this.elements.card = this.elements.panel?.querySelector('.focus-task-card') ?? null;
    }

    /** ARIA labels + titles (getLabel — refreshed values on re-init only;
     *  visible text refreshes every render()). */
    _applyStaticLabels() {
        const { panel, prevBtn, nextBtn } = this.elements;
        panel.setAttribute('aria-label', getLabel('focusTask.panelAria'));
        prevBtn.setAttribute('aria-label', getLabel('focusTask.prevTask'));
        prevBtn.title = getLabel('focusTask.prevTask');
        nextBtn.setAttribute('aria-label', getLabel('focusTask.nextTask'));
        nextBtn.title = getLabel('focusTask.nextTask');
    }

    _attachListeners() {
        const add = this.deps.safeAddEventListener
            || ((el, ev, fn, opts) => el.addEventListener(ev, fn, opts));
        add(this.elements.completeBtn, 'click', this._boundComplete);
        add(this.elements.prevBtn, 'click', this._boundPrev);
        add(this.elements.nextBtn, 'click', this._boundNext);
        // Vertical swipe-to-skip — scoped to the PANEL element (not document),
        // so it can't fight gesturePanelManager's horizontal detection, and
        // pull-to-refresh is gated off while this panel is shown.
        add(this.elements.panel, 'touchstart', this._boundTouchStart, { passive: true });
        add(this.elements.panel, 'touchmove', this._boundTouchMove, { passive: true });
        add(this.elements.panel, 'touchend', this._boundTouchEnd, { passive: true });
    }

    /** Track a vertical swipe unless it starts on an interactive control. */
    _onPanelTouchStart(event) {
        if (event.target.closest('button, input, select, textarea, a[href]')) {
            this._touch.tracking = false;
            return;
        }
        const touch = event.touches?.[0];
        if (!touch) return;
        this._touch = { startX: touch.clientX, startY: touch.clientY, tracking: true };
    }

    /**
     * Swipe up = next task, swipe down = previous (D3 follow-up, plan Phase 3).
     * Requires the move to be predominantly vertical so horizontal panel
     * swipes (handled by gesturePanelManager) are never double-interpreted.
     */
    _onPanelTouchMove(event) {
        if (!this._touch.tracking) return;
        const touch = event.touches?.[0];
        if (!touch) return;
        const dx = touch.clientX - this._touch.startX;
        const dy = touch.clientY - this._touch.startY;
        if (Math.abs(dy) < GESTURE.VERTICAL_SWIPE) return;
        if (Math.abs(dy) < Math.abs(dx) * GESTURE.AXIS_DOMINANCE_RATIO) return; // not vertical enough
        this._touch.tracking = false; // consume — one step per gesture
        this._step(dy < 0 ? 1 : -1);
    }
}

// ============================================================================
// SINGLETON + INIT (dueDates pattern — moduleLoader init-fn branch)
// ============================================================================

let focusTaskPanel = null;

export async function initFocusTaskPanel() {
    if (!focusTaskPanel) focusTaskPanel = new FocusTaskPanel();
    // init() is idempotent (initialized flag) — safe to call again after a
    // destroy() (boot retry) to rebuild listeners + subscription.
    await focusTaskPanel.init();
    return focusTaskPanel;
}

export function getFocusTaskPanel() {
    return focusTaskPanel;
}
