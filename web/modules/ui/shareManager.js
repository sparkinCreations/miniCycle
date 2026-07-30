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
import { DOM_IDS, APP_URL, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { isNativeApp, shareRoutineFileNative, shareTextNative } from '../platform/capacitorBridge.js';
import { buildMcycPayload } from '../utils/mcycPayload.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('ShareManager', {
    loadMiniCycleData: required(),
    showNotification: required(),
    showConfirmationModal: optional(null),
    safeAddEventListener: required(),
    hideMainMenu: optional(null)
});

/** @type {{loadMiniCycleData: Function, showNotification: Function, safeAddEventListener: Function, hideMainMenu: Function|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Inject dependencies for the share manager module.
 * @param {Object} dependencies - Dependencies including AppState, showNotification, etc.
 * @returns {void}
 */
export function setShareManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

// ============================================================================
// IDEMPOTENCY GUARDS
// ============================================================================

let _shareRoutineInitialized = false;
let _shareAppInitialized = false;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Download a routine as an .mcyc file
 * @param {Blob} dataBlob - The routine data blob
 * @param {string} fileName - The filename to use
 * @returns {void}
 */
function _downloadRoutineFile(dataBlob, fileName) {
    try {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        _deps.showNotification?.('📥 ' + getLabel('notify.shareRoutineFallback'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
    } catch (error) {
        console.error('Routine file download failed:', error);
        _deps.showNotification?.(getLabel('notify.shareRoutineFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
    }
}

// ============================================================================
// SHARE ROUTINE
// ============================================================================

/**
 * Setup share routine button functionality
 * Uses Web Share API with file sharing, falls back to download
 */
export function setupShareRoutineButton() {
    if (_shareRoutineInitialized) {
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

        // Privacy: includeHistory false — sharing a routine sends the
        // recipient the routine's *structure*, not the sender's event log or
        // up to 500 cleared task names (drift-review C-06). Backup paths pass
        // true; that file is for the owner's own restore, not another person.
        const miniCycleData = buildMcycPayload(activeCycle, cycle, { includeHistory: false });

        const cycleName = cycle.title || activeCycle;
        const fileName = `${cycleName.replace(/[^a-z0-9]/gi, '_')}.mcyc.json`;
        const dataStr = JSON.stringify(miniCycleData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const file = new File([dataBlob], fileName, { type: 'application/json' });

        // Native (Capacitor) path — route through the Android share sheet (which
        // includes "Save to Files"). The web download fallback doesn't work in the
        // WebView, so if native takes over we never fall through.
        if (isNativeApp()) {
            _deps.hideMainMenu?.();
            const result = await shareRoutineFileNative({
                data: dataStr,
                fileName,
                title: cycleName,
                text: `Check out my "${cycleName}" routine on miniCycle!\n${APP_URL}`
            });
            if (result.handled) {
                if (!result.cancelled) {
                    _deps.showNotification?.('✅ ' + getLabel('notify.shareRoutineSuccess'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
                }
                return;
            }
        }

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
                _deps.showNotification?.('✅ ' + getLabel('notify.shareRoutineSuccess'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
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

        // Browser doesn't support sharing files — show confirmation dialog offering download
        _deps.hideMainMenu?.();
        const showConfirmationModal = _deps.showConfirmationModal;
        if (showConfirmationModal) {
            showConfirmationModal({
                title: getLabel('notify.shareRoutineUnsupportedTitle'),
                message: getLabel('notify.shareRoutineUnsupportedMessage'),
                confirmText: getLabel('routine.download'),
                cancelText: getLabel('button.cancel'),
                destructive: false,
                callback: (confirmed) => {
                    if (!confirmed) return;
                    _downloadRoutineFile(dataBlob, fileName);
                }
            });
        } else {
            // No modal available — download directly
            _downloadRoutineFile(dataBlob, fileName);
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

        // Native (Capacitor) path — use the Android share sheet.
        if (isNativeApp()) {
            _deps.hideMainMenu?.();
            const result = await shareTextNative({
                title: getLabel('share.appShareTitle'),
                text: getLabel('share.appShareText'),
                url: appUrl
            });
            if (result.handled) {
                if (!result.cancelled) {
                    _deps.showNotification?.('✅ ' + getLabel('notify.shareAppSuccess'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
                }
                return;
            }
        }

        // Try Web Share API
        // NOTE: navigator.share() must be called BEFORE hideMainMenu() —
        // the menu close consumes the user activation gesture, causing NotAllowedError.
        if (navigator.share) {
            try {
                await navigator.share({
                    title: getLabel('share.appShareTitle'),
                    text: getLabel('share.appShareText'),
                    url: appUrl
                });
                _deps.hideMainMenu?.();
                _deps.showNotification?.('✅ ' + getLabel('notify.shareAppSuccess'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
            } catch (error) {
                _deps.hideMainMenu?.();
                // User dismissed share sheet — silently ignore
                if (error.name === 'AbortError') return;
                console.error('Share app failed:', error);
                _deps.showNotification?.(getLabel('notify.shareAppFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
            }
            return;
        }

        // Fallback: copy to clipboard
        _deps.hideMainMenu?.();
        try {
            await navigator.clipboard.writeText(appUrl);
            _deps.showNotification?.('📋 ' + getLabel('notify.shareAppCopied'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
        } catch (error) {
            console.error('Share app clipboard fallback failed:', error);
            _deps.showNotification?.(getLabel('notify.shareAppFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
        }
    };

    safeAddEventListener(shareAppBtn, 'click', shareAppBtn._clickHandler);
}

