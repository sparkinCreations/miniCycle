/**
 * Backup Reminder Module (DI-Pure)
 *
 * Periodically reminds users to back up their routines via a confirmation modal.
 * Triggers on three conditions:
 *   1. Every 14 days (checked on app boot)
 *   2. Every 25 completed cycles
 *   3. Every 100 cleared tasks (To-Do mode)
 *
 * Anti-annoyance rules:
 *   - Anti-stacking: skip if reminder was shown within 3 days
 *   - Dismiss cooldown: 7-day suppression after "Not Now"
 *   - Recent backup: skip if user backed up within 3 days
 *   - New user guard: skip timer trigger if 0 cycles completed
 *
 * @module features/backupReminder
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { getLabel } from '../labels/labelResolver.js';
import { UI_TIMEOUTS, LIMITS } from '../core/constants.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('BackupReminder', {
    AppState: required(),
    showConfirmationModal: required(),
    showNotification: optional(null),
    downloadBackupFile: optional(null),
});

const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

export function setBackupReminderDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_14_DAYS = 14 * MS_PER_DAY;
const MS_7_DAYS  = 7  * MS_PER_DAY;
const MS_3_DAYS  = 3  * MS_PER_DAY;
// Reminder cadence — see LIMITS.BACKUP_REMINDER_EVERY_N_CYCLES / EVERY_N_TASKS.

/** Delay before showing reminder — see UI_TIMEOUTS.BACKUP_REMINDER_BOOT / BACKUP_REMINDER_TRIGGER. */

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Read backup reminder settings from state with safe defaults.
 * @returns {Object} Backup reminder settings
 */
function _getSettings() {
    const state = _deps.AppState.get?.();
    const settings = state?.settings || {};
    return {
        lastShown:            settings.lastBackupReminderShown || 0,
        dismissedUntil:       settings.backupReminderDismissedUntil || 0,
        lastBackup:           settings.lastFileBackupTimestamp || 0,
        cyclesAtLastReminder: settings.cyclesAtLastBackupReminder || 0,
        tasksAtLastReminder:  settings.clearedTasksAtLastBackupReminder || 0,
    };
}

/**
 * Read current user progress totals.
 * @returns {{ cycles: number, tasks: number }}
 */
function _getProgress() {
    const state = _deps.AppState.get?.();
    return {
        cycles: state?.userProgress?.cyclesCompleted || 0,
        tasks:  state?.userProgress?.totalTasksCompleted || 0,
    };
}

/**
 * Check if the reminder is in a cooldown period.
 * Returns true if any cooldown condition is active.
 */
function _isOnCooldown() {
    const now = Date.now();
    const s = _getSettings();

    // Anti-stacking: shown within last 3 days
    if (s.lastShown && (now - s.lastShown) < MS_3_DAYS) return true;

    // Dismiss cooldown: user clicked "Not Now"
    if (s.dismissedUntil && now < s.dismissedUntil) return true;

    // Recent backup: user already backed up within 3 days
    if (s.lastBackup && (now - s.lastBackup) < MS_3_DAYS) return true;

    return false;
}

/**
 * Check if a specific trigger condition is met.
 * @param {'timer' | 'cycles' | 'tasks'} trigger
 * @returns {boolean}
 */
function _shouldShow(trigger) {
    if (_isOnCooldown()) return false;

    const s = _getSettings();
    const p = _getProgress();
    const now = Date.now();

    switch (trigger) {
        case 'timer': {
            // New user guard: nothing to back up yet
            if (p.cycles < 1) return false;
            // First time (never shown) or 14 days elapsed
            if (s.lastShown === 0) return true;
            return (now - s.lastShown) >= MS_14_DAYS;
        }
        case 'cycles':
            return (p.cycles - s.cyclesAtLastReminder) >= LIMITS.BACKUP_REMINDER_EVERY_N_CYCLES;
        case 'tasks':
            return (p.tasks - s.tasksAtLastReminder) >= LIMITS.BACKUP_REMINDER_EVERY_N_TASKS;
        default:
            return false;
    }
}

/**
 * Snapshot current progress and timestamp into state after showing reminder.
 */
function _recordReminderShown() {
    const p = _getProgress();
    _deps.AppState.update?.(state => {
        if (!state.settings) state.settings = {};
        state.settings.lastBackupReminderShown = Date.now();
        state.settings.cyclesAtLastBackupReminder = p.cycles;
        state.settings.clearedTasksAtLastBackupReminder = p.tasks;
    });
}

/**
 * Show the backup reminder confirmation modal.
 */
function _showReminder() {
    if (typeof _deps.showConfirmationModal !== 'function') return;

    _recordReminderShown();

    _deps.showConfirmationModal({
        title: getLabel('notify.backupReminderTitle'),
        message: getLabel('notify.backupReminderMessage'),
        confirmText: getLabel('notify.backupReminderConfirm'),
        cancelText: getLabel('notify.backupReminderDismiss'),
        callback: (confirmed) => {
            if (confirmed) {
                // Trigger backup with no name prompt (one-click flow)
                if (typeof _deps.downloadBackupFile === 'function') {
                    _deps.downloadBackupFile({ skipNamePrompt: true });
                }
            } else {
                // Dismiss: suppress for 7 days
                _deps.AppState.update?.(state => {
                    if (!state.settings) state.settings = {};
                    state.settings.backupReminderDismissedUntil = Date.now() + MS_7_DAYS;
                });
            }
        }
    });
}

// ============================================================================
// EXPORTED CHECK FUNCTIONS (called from boot, cycle completion, task clear)
// ============================================================================

/**
 * Check if backup reminder should show on app boot (14-day timer).
 * Called from uiBoot.js already wrapped in a 3s setTimeout — no extra delay needed.
 */
export function checkBackupReminderOnBoot() {
    if (_shouldShow('timer')) {
        _showReminder();
    }
}

/**
 * Check if backup reminder should show after cycle completion (25-cycle interval).
 * Called from cycleCompletion.js after incrementCycleCount().
 */
export function checkBackupReminderOnCycleComplete() {
    if (_shouldShow('cycles')) {
        setTimeout(_showReminder, UI_TIMEOUTS.BACKUP_REMINDER_TRIGGER);
    }
}

/**
 * Check if backup reminder should show after task clearing (100-task interval).
 * Called from taskCycleReset.js after deleteCompletedTasksImpl().
 */
export function checkBackupReminderOnTaskClear() {
    if (_shouldShow('tasks')) {
        setTimeout(_showReminder, UI_TIMEOUTS.BACKUP_REMINDER_TRIGGER);
    }
}
