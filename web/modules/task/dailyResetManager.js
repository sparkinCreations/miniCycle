/**
 * 🕛 Daily Reset Manager (DI-Pure)
 *
 * Per-routine "Auto-uncheck Daily" feature: on each cycle (routine), the user
 * may opt in to a soft daily reset that unchecks all tasks at a configurable
 * local time. This is independent of the cycle-completion auto-reset:
 *   - It does NOT increment cycleCount or fire achievement/milestone hooks.
 *   - It does NOT animate the reset (silent state mutation).
 *   - It fires globally (any cycle that's due, even if not the active one).
 *   - The user is notified the next time they VIEW the affected routine
 *     (per-routine, like reminders), not at fire time.
 *
 * Catch-up: if the app was closed when the trigger time passed, the next
 * tick (60s interval) or visibility-change event fires the reset on open.
 *
 * Schema (per-cycle):
 *   state.data.cycles[cycleId].autoUncheckDaily = {
 *       enabled: false,
 *       hour: 0,        // 0-23 (local time)
 *       minute: 0,      // 0-59
 *       lastResetDate: null,    // 'YYYY-MM-DD' (local) — null means never fired
 *       pendingNotification: false  // true after fire, cleared on view
 *   }
 *
 * @module dailyResetManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, UI_TIMEOUTS, INTERVALS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { formatLocalDate } from '../recurring/recurringDateUtils.js';
import { applyTaskStatusLabel } from './taskUtils.js';


const APPSTATE_SUBSCRIBER_KEY = 'dailyResetManager';

const di = createDIModule('DailyResetManager', {
    AppState: required(),
    showNotification: required(),
    safeAddEventListener: optional(null),
    loadMiniCycle: optional(null),
    getElementById: optional((id) => document.getElementById(id)),
    getBody: optional(() => document.body)
});

export const setDailyResetManagerDependencies = di.setDependencies;

// ============================================================================
// HELPERS — pure functions (date math + formatting), no deps
// ============================================================================

/** Local-date YYYY-MM-DD. Avoids UTC timezone bugs around midnight. */
function todayLocal(now = new Date()) {
    return formatLocalDate(now);
}

/** Returns timestamp (ms) for `today @ hour:minute` in local time. */
function localTimeToday(hour, minute, now = new Date()) {
    const t = new Date(now);
    t.setHours(hour, minute, 0, 0);
    return t.getTime();
}

/** Formats h/m as "12:00 AM" / "6:30 PM" for display.
 *  Uses U+00A0 (non-breaking space) between time and AM/PM so toast text
 *  doesn't wrap "12:00" onto one line and "AM" onto the next. */
function formatTime12(hour, minute) {
    const h = ((hour % 12) || 12);
    const m = String(minute).padStart(2, '0');
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}:${m} ${ampm}`;
}

/** Formats h/m as "HH:MM" for <input type="time"> value. */
function formatTimeInput(hour, minute) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Returns a normalized autoUncheckDaily settings object (defaults if missing). */
function readSettings(cycle) {
    const s = cycle?.autoUncheckDaily;
    return {
        enabled: !!s?.enabled,
        hour: Number.isInteger(s?.hour) ? s.hour : 0,
        minute: Number.isInteger(s?.minute) ? s.minute : 0,
        lastResetDate: s?.lastResetDate ?? null,
        pendingNotification: !!s?.pendingNotification
    };
}

// Exported for tests
export const __test__ = { todayLocal, localTimeToday, formatTime12, formatTimeInput, readSettings };

// ============================================================================
// MANAGER CLASS
// ============================================================================

export class DailyResetManager {
    constructor() {
        this._intervalId = null;
        this._visibilityHandler = null;
        this._appStateSubscribed = false;
        this._toggleHandler = null;
        this._timeBtnHandler = null;
        this._bannerHandler = null;
        this._lastSyncedCycleId = null;
        this.initialized = false;
    }

    /**
     * State write for BACKGROUND fires — same pattern as the recurring
     * watcher's commitSystemUpdate (§1.2): passes { system: true } so the undo
     * wrapper skips the snapshot for this call. Plain update() here put
     * scheduled unchecks into the undo stack — Undo after a daily fire
     * re-checked the system-cleared tasks. User-initiated settings writes
     * (setEnabled/setTime) stay on plain update() deliberately.
     * (Intent travels with the call, not via the shared isSystemMutation
     * flag — the flag guarded an await window and could mis-tag an
     * interleaving user update; review F-005.)
     * @param {Function} producer - AppState update producer
     * @param {boolean} [immediate] - Immediate-save flag
     * @returns {Promise<*>}
     */
    async _commitSystemUpdate(producer, immediate) {
        return await this.deps.AppState.update(producer, immediate, { system: true });
    }

    get deps() {
        return di.resolve();
    }

    /** Initialize: wire UI, start ticker, subscribe to state, run initial check. */
    async init() {
        if (this.initialized) return;

        this._wireMenuControls();
        this._wireBanner();
        this._startTicker();
        this._subscribeToAppState();

        // Run an initial pass so any pending resets fire on app load
        // and any pending notifications surface for the active routine.
        this.checkAllRoutines();
        this._syncForActiveCycle();

        this.initialized = true;
    }

    /** Tear down all listeners + timers (called by moduleLoader on retry/unload). */
    destroy() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
            this._visibilityHandler = null;
        }
        if (this._appStateSubscribed) {
            this.deps.AppState.unsubscribe?.(APPSTATE_SUBSCRIBER_KEY, this._onAppStateChange);
            this._appStateSubscribed = false;
        }
        const toggle = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_DAILY_TOGGLE);
        const timeBtn = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_DAILY_TIME_BTN);
        const banner = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_BANNER);
        if (toggle && this._toggleHandler) toggle.removeEventListener('change', this._toggleHandler);
        if (timeBtn && this._timeBtnHandler) timeBtn.removeEventListener('click', this._timeBtnHandler);
        if (banner && this._bannerHandler) banner.removeEventListener('click', this._bannerHandler);
        this._toggleHandler = this._timeBtnHandler = this._bannerHandler = null;
        this.initialized = false;
    }

    // ------------------------------------------------------------------------
    // CHECK / FIRE
    // ------------------------------------------------------------------------

    /**
     * Iterate every cycle in state, fire reset for any whose configured
     * trigger time has passed today and hasn't fired yet today.
     * Atomic: state mutations all happen in one AppState.update producer.
     * Async so the commit is awaited before post-update side effects run
     * (UI refresh + toasts must see committed state); callers (ticker,
     * init, wake) remain fire-and-forget.
     */
    async checkAllRoutines() {
        const state = this.deps.AppState.get?.();
        if (!state?.data?.cycles) return;

        const now = new Date();
        const today = todayLocal(now);
        const fired = []; // [{ cycleId, name, hour, minute, isActive }]

        for (const [cycleId, cycle] of Object.entries(state.data.cycles)) {
            const s = readSettings(cycle);
            if (!s.enabled) continue;
            if (s.lastResetDate === today) continue;
            if (now.getTime() < localTimeToday(s.hour, s.minute, now)) continue;
            fired.push({
                cycleId,
                name: cycle?.title || cycleId,
                hour: s.hour,
                minute: s.minute,
                isActive: cycleId === state.appState.activeCycleId
            });
        }

        if (fired.length === 0) return;

        // Atomic batch update: uncheck tasks + mark date + set/clear pending flag.
        // For the active cycle we clear pendingNotification immediately AND show
        // the toast (user is watching). For inactive cycles we set the flag and
        // defer the toast to the next view trigger.
        try {
            await this._commitSystemUpdate(s => {
                for (const { cycleId, isActive } of fired) {
                    const cycle = s.data.cycles[cycleId];
                    if (!cycle) continue;
                    if (Array.isArray(cycle.tasks)) {
                        cycle.tasks.forEach(t => { t.completed = false; });
                    }
                    cycle.autoUncheckDaily = cycle.autoUncheckDaily || {};
                    cycle.autoUncheckDaily.lastResetDate = today;
                    cycle.autoUncheckDaily.pendingNotification = !isActive;
                }
            }, true);
        } catch (e) {
            // Commit failed — nothing was unchecked, so don't refresh or toast.
            console.error('❌ Daily auto-uncheck commit failed:', e);
            return;
        }

        // Post-update side effects: refresh DOM for active cycle, notify if active.
        for (const { name, hour, minute, isActive } of fired) {
            if (isActive) {
                this._refreshActiveCycleUI();
                this.deps.showNotification(
                    getLabel('notify.autoUncheckPending', { vars: { name, time: formatTime12(hour, minute) } }),
                    'info',
                    UI_TIMEOUTS.NOTIFICATION_NORMAL
                );
            }
        }

        // Banner text doesn't change but icon could in future themes — keep in sync.
        this._syncForActiveCycle();
    }

    /**
     * Show pending-notification toast for the given cycle if one is queued.
     * Called when the user views (switches to / opens app on) a routine.
     */
    showPendingNotificationIfAny(cycleId) {
        const state = this.deps.AppState.get?.();
        const cycle = state?.data?.cycles?.[cycleId];
        const s = readSettings(cycle);
        if (!s.pendingNotification) return;

        const name = cycle?.title || cycleId;

        // Clear the flag atomically with showing the toast
        this._commitSystemUpdate(st => {
            const c = st.data.cycles[cycleId];
            if (c?.autoUncheckDaily) {
                c.autoUncheckDaily.pendingNotification = false;
            }
        }, true);

        this.deps.showNotification(
            getLabel('notify.autoUncheckPending', { vars: { name, time: formatTime12(s.hour, s.minute) } }),
            'info',
            UI_TIMEOUTS.NOTIFICATION_NORMAL
        );
    }

    // ------------------------------------------------------------------------
    // USER ACTIONS (toggle, change time)
    // ------------------------------------------------------------------------

    setEnabled(cycleId, enabled) {
        if (!cycleId) return;
        let snapshot = null;
        let name = cycleId;
        this.deps.AppState.update(s => {
            const c = s.data.cycles[cycleId];
            if (!c) return;
            c.autoUncheckDaily = c.autoUncheckDaily || { hour: 0, minute: 0, lastResetDate: null, pendingNotification: false };
            c.autoUncheckDaily.enabled = !!enabled;
            if (enabled) {
                // The first fire belongs to the NEXT occurrence of the trigger
                // time. If today's trigger has already passed at enable time
                // (always true for the 12:00 AM default), stamp today as done —
                // otherwise the next check would uncheck tasks immediately.
                const cur = readSettings(c);
                if (Date.now() >= localTimeToday(cur.hour, cur.minute)) {
                    c.autoUncheckDaily.lastResetDate = todayLocal();
                }
            }
            snapshot = readSettings(c);
            name = c.title || cycleId;
        }, true);

        this._syncForActiveCycle();

        if (snapshot?.enabled) {
            const time = formatTime12(snapshot.hour, snapshot.minute);
            this.deps.showNotification(
                getLabel('notify.autoUncheckEnabled', { vars: { name, time } }),
                'info',
                UI_TIMEOUTS.NOTIFICATION_NORMAL,
                {
                    actionButton: {
                        label: getLabel('menu.changeTime'),
                        onClick: () => this.openTimePickerModal(cycleId)
                    }
                }
            );
        } else {
            this.deps.showNotification(
                getLabel('notify.autoUncheckDisabled', { vars: { name } }),
                'info',
                UI_TIMEOUTS.NOTIFICATION_SHORT
            );
        }
    }

    setTime(cycleId, hour, minute) {
        if (!cycleId) return;
        const h = Math.max(0, Math.min(23, parseInt(hour, 10) || 0));
        const m = Math.max(0, Math.min(59, parseInt(minute, 10) || 0));
        let name = cycleId;

        this.deps.AppState.update(s => {
            const c = s.data.cycles[cycleId];
            if (!c) return;
            c.autoUncheckDaily = c.autoUncheckDaily || { enabled: false, lastResetDate: null, pendingNotification: false };
            c.autoUncheckDaily.hour = h;
            c.autoUncheckDaily.minute = m;
            // Clear lastResetDate so the user can re-trigger today by setting an
            // earlier time — otherwise an already-fired-today reset would block it.
            // Only clear if the new time is in the future, to avoid re-firing
            // immediately for "I just changed the time and it already passed".
            if (Date.now() < localTimeToday(h, m)) {
                c.autoUncheckDaily.lastResetDate = null;
            }
            name = c.title || cycleId;
        }, true);

        this._syncForActiveCycle();
        this.deps.showNotification(
            getLabel('notify.autoUncheckTimeUpdated', { vars: { name, time: formatTime12(h, m) } }),
            'success',
            UI_TIMEOUTS.NOTIFICATION_SHORT
        );
        // Re-check in case the new time is still in the past today
        this.checkAllRoutines();
    }

    /**
     * Open the time picker modal for the given cycle.
     * Native <input type="time"> for OS picker on mobile.
     */
    openTimePickerModal(cycleId) {
        const state = this.deps.AppState.get?.();
        const cycle = state?.data?.cycles?.[cycleId];
        const s = readSettings(cycle);
        const name = cycle?.title || cycleId;
        // Defensive escape so a routine titled `<script>` can't break out of HTML
        const safeName = String(name).replace(/[&<>"']/g, ch => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        ));
        const title = getLabel('modal.autoUncheckTimeTitle', { vars: { name: safeName } });
        const message = getLabel('modal.autoUncheckTimeMessage', { vars: { name: safeName } });

        const overlay = document.createElement('dialog');
        overlay.className = 'miniCycle-prompt-dialog';
        overlay.innerHTML = `
            <div class="miniCycle-prompt-box has-corner-logo">
                <h2 class="miniCycle-prompt-title">${title}</h2>
                <p class="miniCycle-prompt-message">${message}</p>
                <input type="time" class="miniCycle-prompt-input auto-uncheck-time-input"
                       value="${formatTimeInput(s.hour, s.minute)}"
                       aria-label="${title}" />
                <div class="miniCycle-prompt-buttons">
                    <button type="button" class="miniCycle-btn-cancel">${getLabel('button.cancel')}</button>
                    <button type="button" class="miniCycle-btn-confirm">${getLabel('button.save')}</button>
                </div>
            </div>
        `;

        this.deps.getBody().appendChild(overlay);
        overlay.showModal();

        const input = overlay.querySelector('.auto-uncheck-time-input');
        const cancelBtn = overlay.querySelector('.miniCycle-btn-cancel');
        const confirmBtn = overlay.querySelector('.miniCycle-btn-confirm');

        setTimeout(() => input.focus({ focusVisible: false }), UI_TIMEOUTS.FOCUS_DELAY_SHORT);

        const cleanup = () => {
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            overlay.removeEventListener('cancel', onEscape);
            overlay.removeEventListener('click', onBackdrop);
            overlay.close();
            overlay.remove();
        };
        const onCancel = () => cleanup();
        const onEscape = (e) => { e.preventDefault(); cleanup(); };
        const onBackdrop = (e) => { if (e.target === overlay) cleanup(); };
        const onConfirm = () => {
            const value = input.value || '00:00';
            const [h, m] = value.split(':').map(n => parseInt(n, 10));
            cleanup();
            this.setTime(cycleId, h, m);
        };

        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        overlay.addEventListener('cancel', onEscape);
        overlay.addEventListener('click', onBackdrop);
    }

    // ------------------------------------------------------------------------
    // UI SYNC (menu controls + banner reflect active routine's settings)
    // ------------------------------------------------------------------------

    _syncForActiveCycle() {
        const state = this.deps.AppState.get?.();
        const cycleId = state?.appState?.activeCycleId;
        if (!cycleId) return;
        const cycle = state.data.cycles?.[cycleId];
        const s = readSettings(cycle);

        const toggle = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_DAILY_TOGGLE);
        const timeBtn = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_DAILY_TIME_BTN);
        const timeLabel = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_DAILY_TIME_LABEL);
        const banner = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_BANNER);
        const bannerText = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_BANNER_TEXT);

        const time = formatTime12(s.hour, s.minute);

        if (toggle) toggle.checked = s.enabled;
        if (timeBtn) timeBtn.classList.toggle('hidden', !s.enabled);
        if (timeLabel) timeLabel.textContent = time;

        if (banner && bannerText) {
            banner.classList.toggle('hidden', !s.enabled);
            banner.setAttribute('aria-hidden', s.enabled ? 'false' : 'true');
            banner.tabIndex = s.enabled ? 0 : -1;
            banner.setAttribute('aria-label', getLabel('banner.autoUncheckDailyAria'));
            bannerText.textContent = getLabel('banner.autoUncheckDaily', { vars: { time } });
        }

        // If the active cycle changed since last sync, also surface any pending
        // notification for the newly-viewed routine.
        if (cycleId !== this._lastSyncedCycleId) {
            this._lastSyncedCycleId = cycleId;
            this.showPendingNotificationIfAny(cycleId);
        }
    }

    // ------------------------------------------------------------------------
    // INTERNALS — wiring
    // ------------------------------------------------------------------------

    _wireMenuControls() {
        const toggle = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_DAILY_TOGGLE);
        const timeBtn = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_DAILY_TIME_BTN);

        if (toggle) {
            this._toggleHandler = (e) => {
                const cycleId = this.deps.AppState.get?.()?.appState?.activeCycleId;
                if (!cycleId) return;
                this.setEnabled(cycleId, e.target.checked);
            };
            toggle.addEventListener('change', this._toggleHandler);
        }

        if (timeBtn) {
            this._timeBtnHandler = (e) => {
                // Defensive: the button now sits outside the row's <label> (it used to
                // be inside it, where a click activated the label and re-toggled the
                // checkbox). Kept so the row stays click-safe if the markup shifts again.
                e.preventDefault();
                e.stopPropagation();
                const cycleId = this.deps.AppState.get?.()?.appState?.activeCycleId;
                if (!cycleId) return;
                this.openTimePickerModal(cycleId);
            };
            timeBtn.addEventListener('click', this._timeBtnHandler);
        }
    }

    _wireBanner() {
        const banner = this.deps.getElementById(DOM_IDS.AUTO_UNCHECK_BANNER);
        if (!banner) return;
        this._bannerHandler = () => {
            const cycleId = this.deps.AppState.get?.()?.appState?.activeCycleId;
            if (!cycleId) return;
            this.openTimePickerModal(cycleId);
        };
        banner.addEventListener('click', this._bannerHandler);
    }

    _startTicker() {
        // 60s tick is plenty for a feature that fires once per day per routine.
        // Visibility-change covers the closed-app case (catch-up).
        this._intervalId = setInterval(() => this.checkAllRoutines(), INTERVALS.DAILY_RESET_TICK);

        this._visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                this.checkAllRoutines();
                this._syncForActiveCycle();
            }
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);
    }

    _subscribeToAppState() {
        if (!this.deps.AppState.subscribe) return;
        this._onAppStateChange = (newState, oldState) => {
            const newActive = newState?.appState?.activeCycleId;
            const oldActive = oldState?.appState?.activeCycleId;
            if (newActive !== oldActive) {
                this._syncForActiveCycle();
            }
        };
        this.deps.AppState.subscribe(APPSTATE_SUBSCRIBER_KEY, this._onAppStateChange);
        this._appStateSubscribed = true;
    }

    /**
     * Re-render the active cycle's UI from state. Use the canonical loadMiniCycle()
     * — it handles checkbox state, .completed class, completed-task dropdown,
     * progress bar, overdue flags, etc. Falls back to a minimal in-place uncheck
     * if loadMiniCycle isn't wired (e.g., in tests).
     */
    _refreshActiveCycleUI() {
        if (typeof this.deps.loadMiniCycle === 'function') {
            try { this.deps.loadMiniCycle(); return; } catch (e) {
                console.warn('dailyResetManager: loadMiniCycle failed, falling back to direct DOM update', e);
            }
        }
        const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
        if (!taskList) return;
        // Walk rows, not checkboxes: setting `checked` leaves the row's aria-label
        // behind, so a screen reader keeps announcing "Completed" (or "Overdue")
        // on a box that now reads unchecked — the mismatch applyTaskStatusLabel()
        // exists to prevent. loadMiniCycle() re-renders through taskDOM and gets
        // this for free; this fallback has to do it itself.
        taskList.querySelectorAll(DOM_SELECTORS.TASK).forEach(taskEl => {
            const checkbox = taskEl.querySelector(DOM_SELECTORS.TASK_CHECKBOX);
            if (checkbox) checkbox.checked = false;
            taskEl.classList.remove(DOM_CLASSES.OVERDUE_TASK);
            applyTaskStatusLabel(taskEl, false);
        });
    }
}

// Singleton — exported as `dailyResetManager` so moduleLoader can call .init()
// after dependencies are wired (matches the onboardingManager pattern).
export const dailyResetManager = new DailyResetManager();
export function getDailyResetManager() {
    return dailyResetManager;
}
