/**
 * Share Manager (DI-Pure)
 * Handles sharing routines via Web Share API and sharing app link
 *
 * NO window.* globals - all dependencies must be injected
 * NO legacy fallbacks - strict DI only
 *
 * @module ui/shareManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, APP_URL } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('ShareManager', {
    loadMiniCycleData: required(),
    showNotification: required(),
    safeAddEventListener: required(),
    hideMainMenu: optional(null)
});

/** @type {{loadMiniCycleData: Function, showNotification: Function, safeAddEventListener: Function, hideMainMenu: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

export function setShareManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// IDEMPOTENCY GUARDS
// ============================================================================

let _shareRoutineInitialized = false;
let _shareAppInitialized = false;

// ============================================================================
// SHARE ROUTINE
// ============================================================================

/**
 * Setup share routine button functionality
 * Uses Web Share API with file sharing, falls back to download
 */
export function setupShareRoutineButton() {
    if (_shareRoutineInitialized) {
        console.log('✅ Share routine button already set up');
        return;
    }
    _shareRoutineInitialized = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('ShareManager: safeAddEventListener dependency not injected');
        return;
    }

    const shareBtn = document.getElementById(DOM_IDS.SHARE_ROUTINE);
    if (!shareBtn) return;

    shareBtn._clickHandler = async () => {
        const loadMiniCycleData = _deps.loadMiniCycleData;
        const schemaData = loadMiniCycleData?.();

        if (!schemaData) {
            _deps.showNotification?.(getLabel('notify.shareRoutineNoActiveCycle'), 'error');
            return;
        }

        const { cycles, activeCycle } = schemaData;
        const cycle = cycles[activeCycle];

        if (!activeCycle || !cycle) {
            _deps.showNotification?.(getLabel('notify.shareRoutineNoActiveCycle'), 'error');
            return;
        }

        // Build .mcyc payload (same structure as cycleExportManager)
        const miniCycleData = {
            name: activeCycle,
            title: cycle.title || 'New miniCycle',
            tasks: cycle.tasks.map(task => {
                const settings = task.recurringSettings
                    ? structuredClone(task.recurringSettings)
                    : {};

                if (task.recurring && !settings.specificTime && !settings.defaultRecurTime) {
                    settings.defaultRecurTime = new Date().toISOString();
                }

                return {
                    id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    text: task.text || '',
                    completed: task.completed || false,
                    dueDate: task.dueDate || null,
                    highPriority: task.highPriority || false,
                    remindersEnabled: task.remindersEnabled || false,
                    recurring: task.recurring || false,
                    recurringSettings: settings,
                    deleteWhenComplete: task.deleteWhenComplete,
                    deleteWhenCompleteSettings: task.deleteWhenCompleteSettings || { cycle: false, todo: true },
                    schemaVersion: task.schemaVersion || 2
                };
            }),
            autoReset: cycle.autoReset || false,
            cycleCount: cycle.cycleCount || 0,
            deleteCheckedTasks: cycle.deleteCheckedTasks || false,
            taskOptionButtons: cycle.taskOptionButtons || null,
            recurringTemplates: cycle.recurringTemplates || {},
            reminders: cycle.reminders || null,
            createdAt: cycle.createdAt || null
        };

        const cycleName = cycle.title || activeCycle;
        const fileName = `${cycleName.replace(/[^a-z0-9]/gi, '_')}.mcyc`;
        const dataStr = JSON.stringify(miniCycleData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const file = new File([dataBlob], fileName, { type: 'application/json' });

        // Try Web Share API with file
        // NOTE: navigator.share() must be called BEFORE hideMainMenu() —
        // the menu close consumes the user activation gesture, causing NotAllowedError.
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: cycleName,
                    text: `Check out my "${cycleName}" routine on miniCycle!\n${APP_URL}`
                });
                _deps.hideMainMenu?.();
                _deps.showNotification?.('✅ ' + getLabel('notify.shareRoutineSuccess'), 'success', 3000);
                return; // Success — don't fall through to download
            } catch (error) {
                // User dismissed share sheet — silently ignore
                if (error.name === 'AbortError') {
                    _deps.hideMainMenu?.();
                    return;
                }
                // NotAllowedError or other failures — fall through to download
                console.warn('Web Share API unavailable, falling back to download:', error.message);
            }
        }

        // Fallback: download the file
        _deps.hideMainMenu?.();
        try {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            _deps.showNotification?.('📥 ' + getLabel('notify.shareRoutineFallback'), 'info', 3000);
        } catch (error) {
            console.error('Share routine fallback failed:', error);
            _deps.showNotification?.(getLabel('notify.shareRoutineFailed'), 'error', 3000);
        }
    };

    safeAddEventListener(shareBtn, 'click', shareBtn._clickHandler);
}

// ============================================================================
// SHARE APP
// ============================================================================

/**
 * Setup share app button functionality
 * Uses Web Share API, falls back to clipboard copy
 */
export function setupShareAppButton() {
    if (_shareAppInitialized) {
        console.log('✅ Share app button already set up');
        return;
    }
    _shareAppInitialized = true;

    const safeAddEventListener = _deps.safeAddEventListener;
    if (!safeAddEventListener) {
        console.error('ShareManager: safeAddEventListener dependency not injected');
        return;
    }

    const shareAppBtn = document.getElementById(DOM_IDS.SHARE_APP);
    if (!shareAppBtn) return;

    shareAppBtn._clickHandler = async () => {
        const appUrl = APP_URL;

        // Try Web Share API
        // NOTE: navigator.share() must be called BEFORE hideMainMenu() —
        // the menu close consumes the user activation gesture, causing NotAllowedError.
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'miniCycle',
                    text: 'Check out miniCycle — turn your routine into progress!',
                    url: appUrl
                });
                _deps.hideMainMenu?.();
                _deps.showNotification?.('✅ ' + getLabel('notify.shareAppSuccess'), 'success', 3000);
            } catch (error) {
                _deps.hideMainMenu?.();
                // User dismissed share sheet — silently ignore
                if (error.name === 'AbortError') return;
                console.error('Share app failed:', error);
                _deps.showNotification?.(getLabel('notify.shareAppFailed'), 'error', 3000);
            }
            return;
        }

        // Fallback: copy to clipboard
        _deps.hideMainMenu?.();
        try {
            await navigator.clipboard.writeText(appUrl);
            _deps.showNotification?.('📋 ' + getLabel('notify.shareAppCopied'), 'success', 3000);
        } catch (error) {
            console.error('Share app clipboard fallback failed:', error);
            _deps.showNotification?.(getLabel('notify.shareAppFailed'), 'error', 3000);
        }
    };

    safeAddEventListener(shareAppBtn, 'click', shareAppBtn._clickHandler);
}

console.log('Share Manager loaded');
