/**
 * miniCycle Routine Switcher — Preview
 *
 * The routine preview inside the switcher modal: the mobile panel, the desktop
 * panel with its title/date/hint, the reset-to-empty state, and the
 * double-click review dialog.
 *
 * Extracted from `routine/routineSwitcher.js` (Aug 2026, splits-plan Priority 1,
 * second extraction after the theme picker).
 *
 * ── WHAT THE PLAN GOT WRONG, MEASURED BEFORE MOVING ─────────────────────────
 * LARGE_MODULE_SPLITS_PLAN.md named five methods for this cluster; two of those
 * names were already dead when this extraction started. `_updateDesktopPreview`
 * was removed at some point before Aug 2026, and `_resetDesktopPreview` was
 * renamed to `_resetPreview` (it resets mobile AND desktop).
 * The plan already warned its own names had drifted; this is what the drift was.
 *
 * The cluster is also NOT contiguous in the parent — `updatePreview` sits about
 * 95 lines from the other three, with the selection infrastructure
 * (`_getSelectedCycleKey`, `_getSelectedItem`, `_selectRoutine`) in between.
 * That infrastructure deliberately stays in the parent: it is the switcher's
 * selection state, not preview rendering.
 *
 * ── THE SELECTION BACK-DEPENDENCY ───────────────────────────────────────────
 * Unlike the theme picker, this cluster reaches BACK into the parent:
 * `openPreviewReviewModal` needs the currently-selected routine, which lives in
 * `routineSwitcher._selectedCycleKey` and is resolved by `_getSelectedItem()`.
 * Rather than duplicate that state or hand the sub-module the whole instance,
 * the two functions that need it take a `callbacks` object — the
 * `fn(deps, callbacks)` shape already used by `recurringPanelSetup.js`.
 *
 * Static import, like the theme picker: no module-level state, no DI of its own,
 * no import-time work. See routineSwitcherThemePicker.js for the full reasoning.
 *
 * KNOWN INCONSISTENCY, MOVED AS-IS: `openPreviewReviewModal` hardcodes
 * `overlay.id = 'preview-review-overlay'` while looking the same element up via
 * `DOM_IDS.PREVIEW_REVIEW_OVERLAY`. An extraction should not change behaviour,
 * so it moves unchanged; worth a follow-up.
 *
 * @module routine/routineSwitcherPreview
 * @see {@link file://docs/future-work/LARGE_MODULE_SPLITS_PLAN.md} - why this split
 */

import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

/**
 * Render the selected routine into both preview panels.
 * @param {Object} deps - The parent's live deps
 * @param {string} cycleName - Cycle storage key
 * @returns {void}
 */
export function updatePreview(deps, cycleName) {
    if (!deps.AppState?.isReady?.()) {
        console.error('❌ AppState not ready for updatePreview');
        return;
    }

    const currentState = deps.AppState.get();
    if (!currentState) {
        console.error('❌ No state data available for updatePreview');
        return;
    }

    const cycles = currentState.data?.cycles || {};
    const cycleData = cycles[cycleName];

    function escapeText(str) {
        const temp = document.createElement("div");
        temp.textContent = str;
        return temp.innerHTML;
    }

    // Build task HTML and date (shared across both panels)
    let tasksHTML = '';
    let dateLabel = '';
    let formattedDate = '';

    if (cycleData?.tasks) {
        tasksHTML = cycleData.tasks
            .map(task => `<div class="preview-task">${task.completed ? "✔️" : "___"} ${escapeText(task.text)}</div>`)
            .join("");

        const timestamp = cycleData.lastModified || cycleData.createdAt;
        if (timestamp) {
            const date = new Date(timestamp);
            formattedDate = date.toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            dateLabel = cycleData.lastModified ? getLabel('switcher.modified') : getLabel('switcher.created');
        }
    }

    const contentHTML = tasksHTML
        ? `<strong>${getLabel('switcher.tasksPreviewLabel')}:</strong><br>${tasksHTML}`
        : '';
    const dateHTML = (dateLabel && formattedDate)
        ? `<div class="desktop-preview-date">${dateLabel}: ${formattedDate}</div>`
        : '';
    const noTasksLabel = getLabel('empty.noTasksPreview');

    // --- Mobile preview panel ---
    const previewWindow = deps.getElementById(DOM_IDS.SWITCH_PREVIEW_WINDOW);
    if (previewWindow) {
        if (tasksHTML) {
            previewWindow.innerHTML = contentHTML;
        } else {
            previewWindow.innerHTML = '<br>';
            const msg = document.createElement('strong');
            msg.textContent = noTasksLabel;
            previewWindow.appendChild(msg);
        }
    }

    // Mobile date display (below preview)
    let dateDisplay = deps.getElementById(DOM_IDS.SWITCH_PREVIEW_DATE);
    if (!dateDisplay && previewWindow) {
        dateDisplay = document.createElement("div");
        dateDisplay.id = DOM_IDS.SWITCH_PREVIEW_DATE;
        dateDisplay.className = "switch-preview-date";
        previewWindow.parentNode.insertBefore(dateDisplay, previewWindow.nextSibling);
    }
    if (dateDisplay) {
        dateDisplay.textContent = (dateLabel && formattedDate) ? `${dateLabel}: ${formattedDate}` : '';
    }

    // --- Desktop preview panel ---
    const desktopPreview = deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_WINDOW);
    if (desktopPreview) {
        if (tasksHTML) {
            desktopPreview.innerHTML = contentHTML + dateHTML;
        } else {
            desktopPreview.innerHTML = '';
            const msg = document.createElement('strong');
            msg.textContent = noTasksLabel;
            desktopPreview.appendChild(msg);
        }
    }

    // Desktop preview title
    const previewTitle = deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_TITLE);
    if (previewTitle) {
        previewTitle.textContent = cycleData?.title || cycleName || getLabel('switcher.preview');
    }

    // Desktop preview hint
    const hint = deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_HINT);
    if (hint) {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        hint.textContent = getLabel(isMobile ? 'switcher.doubleTapEnlarge' : 'switcher.doubleClickEnlarge');
        hint.style.display = 'block';
    }
}

/**
 * Clear both panels back to the "select a routine" state.
 * Was `_resetPreview` on the parent class.
 * @param {Object} deps - The parent's live deps
 * @returns {void}
 */
export function resetPreview(deps) {
    // Mobile preview
    const previewWindow = deps.getElementById(DOM_IDS.SWITCH_PREVIEW_WINDOW);
    if (previewWindow) {
        previewWindow.innerHTML = '';
    }
    const dateDisplay = deps.getElementById(DOM_IDS.SWITCH_PREVIEW_DATE);
    if (dateDisplay) {
        dateDisplay.textContent = '';
    }

    // Desktop preview
    const desktopPreview = deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_WINDOW);
    if (desktopPreview) {
        desktopPreview.textContent = getLabel('switcher.selectPreview');
    }
    const previewTitle = deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_TITLE);
    if (previewTitle) {
        previewTitle.textContent = getLabel('switcher.preview');
    }
    const hint = deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_HINT);
    if (hint) {
        hint.style.display = 'none';
    }
}

/**
 * Wire double-click on either preview panel to open the review dialog, and show
 * the one-time hint if the user has not used the feature yet.
 * @param {Object} deps - The parent's live deps
 * @param {{getSelectedItem: function(): (HTMLElement|null)}} callbacks
 * @returns {void}
 */
export function setupPreviewPopout(deps, callbacks) {
    const previewWindow = deps.getElementById(DOM_IDS.SWITCH_PREVIEW_WINDOW);
    const desktopPreview = deps.getElementById(DOM_IDS.DESKTOP_PREVIEW_WINDOW);

    const safeAdd = deps.safeAddEventListener;
    if (!safeAdd) return;

    // Show subtle hint below inline preview if user hasn't used the feature yet
    if (previewWindow) {
        const _state = deps.AppState?.get();
        const _dismissed = _state?.settings?.dismissedEducationalTips?.['tip.routinePreview'];
        if (!_dismissed) {
            let hint = document.getElementById('switch-preview-hint');
            if (!hint) {
                hint = document.createElement('div');
                hint.id = 'switch-preview-hint';
                hint.className = 'switch-preview-hint';
                hint.textContent = getLabel('notify.routinePreviewTip');
                previewWindow.insertAdjacentElement('afterend', hint);
            }
        }

        safeAdd(previewWindow, "dblclick", () => openPreviewReviewModal(deps, callbacks));
    }

    // Also attach to desktop preview panel
    if (desktopPreview) {
        // Stop click propagation so clicks inside the preview don't bubble up
        // to the modal and deselect the currently selected routine
        if (!desktopPreview._clickHandler) {
            desktopPreview._clickHandler = (e) => e.stopPropagation();
        }
        safeAdd(desktopPreview, "click", desktopPreview._clickHandler);
        safeAdd(desktopPreview, "dblclick", () => openPreviewReviewModal(deps, callbacks));
    }
}

/**
 * Open the full-screen review dialog for the selected routine's tasks.
 * Was `_openPreviewReviewModal`. Reads the selection through `callbacks`
 * because it lives in the parent — see the module header.
 * @param {Object} deps - The parent's live deps
 * @param {{getSelectedItem: function(): (HTMLElement|null)}} callbacks
 * @returns {void}
 */
export function openPreviewReviewModal(deps, callbacks) {
    // Dismiss hint on first use
    const hintEl = document.getElementById('switch-preview-hint');
    if (hintEl) {
        hintEl.remove();
        deps.AppState?.update(s => {
            if (!s.settings.dismissedEducationalTips) s.settings.dismissedEducationalTips = {};
            s.settings.dismissedEducationalTips['tip.routinePreview'] = true;
        }, false);
    }

    const selected = callbacks.getSelectedItem();
    if (!selected) return;

    const cycleKey = selected.dataset.cycleKey;
    const currentState = deps.AppState?.get();
    const cycleData = currentState?.data?.cycles?.[cycleKey];
    if (!cycleData?.tasks) return;

    const cycleName = cycleData.title || cycleKey;
    const timestamp = cycleData.lastModified || cycleData.createdAt;
    const dateStr = timestamp
        ? new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : '';
    const dateLabel = cycleData.lastModified ? getLabel('switcher.modified') : getLabel('switcher.created');

    const escDiv = document.createElement("div");
    const escapeText = (str) => { escDiv.textContent = str; return escDiv.innerHTML; };

    const completedCount = cycleData.tasks.filter(t => t.completed).length;
    const taskRows = cycleData.tasks.map(task => {
        const check = task.completed ? '&#10004;' : '&mdash;';
        const cls = task.completed ? ' completed' : '';
        return `<div class="preview-modal-task${cls}"><span class="preview-modal-check">${check}</span> ${escapeText(task.text)}</div>`;
    }).join('');

    // Remove existing preview modal if any
    const existing = document.getElementById(DOM_IDS.PREVIEW_REVIEW_OVERLAY);
    if (existing) existing.remove();

    // Create modal as native dialog for proper top-layer stacking
    const overlay = document.createElement('dialog');
    overlay.id = 'preview-review-overlay';
    overlay.className = 'preview-review-dialog';
    overlay.innerHTML = `
        <div class="modal-content preview-review-modal">
            <button class="close-modal preview-review-close" aria-label="${getLabel('button.close')}">&times;</button>
            <h3 class="preview-review-title">${escapeText(cycleName)}</h3>
            <div class="preview-review-meta">
                ${cycleData.tasks.length} task${cycleData.tasks.length !== 1 ? 's' : ''} &middot; ${completedCount} completed${dateStr ? ` &middot; ${dateLabel}: ${dateStr}` : ''}
            </div>
            <div class="preview-review-body">${taskRows}</div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.showModal();

    // Close handlers
    const close = () => { if (overlay.open) overlay.close(); overlay.remove(); };
    overlay.querySelector(DOM_SELECTORS.PREVIEW_REVIEW_CLOSE).addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent routine switcher's document-level handler from closing
        if (e.target === overlay) close();
    });
}
