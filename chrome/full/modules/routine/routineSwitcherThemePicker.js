/**
 * miniCycle Routine Switcher — Theme Picker
 *
 * The per-routine vocab-theme picker inside the routine switcher modal: the row
 * of chips for every UNLOCKED theme, applying one to a routine, and the
 * open/close/teardown around it.
 *
 * Extracted from `routine/routineSwitcher.js` (Aug 2026, splits-plan Priority 1,
 * first extraction). The switcher is the largest non-data module in the
 * codebase; this is the smallest and most isolated of its three clusters.
 *
 * ── WHY STATIC IMPORT, NOT A DYNAMIC VERSIONED ONE ──────────────────────────
 * LARGE_MODULE_SPLITS_PLAN.md predicted this cluster would need Pattern 1
 * (dynamic `?v=` import) because it has "internal state or DOM side effects".
 * Measured before extracting, that premise does not hold: the picker's state
 * lives on the DOM element (`picker._clickHandlers`), not in this module. There
 * is no module-level state, no DI setup and no import-time work here, so the
 * instance-splitting bug the versioned-import rule exists to prevent cannot
 * occur — a stateless module is safe to share across versioned parents.
 *
 * Static import is also the SAFER choice here, not merely the simpler one.
 * routineSwitcher loads its dynamic sub-imports inside `initRoutineSwitcher()`
 * into module-level bindings; `routineSwitcher.tests.js` constructs
 * `new RoutineSwitcher(mockDeps)` 19 times WITHOUT calling that init. A dynamic
 * import would leave every one of those instances holding a dead binding, and
 * the theme methods would silently no-op.
 *
 * Precedent is in the parent itself: `keyboardNav`, `mcycPayload` and
 * `longPressHint` are already static imports there. `longPressHint` attaches
 * listeners when called and even carries module-level state — the plan's "no
 * event listeners" rule is about IMPORT-TIME effects, which none of these have.
 *
 * ── DEPS ────────────────────────────────────────────────────────────────────
 * Every function takes the parent's live `deps` object as its first argument
 * rather than importing DI of its own, matching `recurringPanelSetup.js`. The
 * six deps used here — getElementById, vocabThemeManager, AppState,
 * showNotification, logHistoryEvent, refreshThemeLabels — are all already
 * declared on routineSwitcher, so this extraction needs no manifest change.
 *
 * @module routine/routineSwitcherThemePicker
 * @see {@link file://docs/future-work/LARGE_MODULE_SPLITS_PLAN.md} - why this split
 */

import { UI_TIMEOUTS, DOM_IDS, DOM_CLASSES } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// Render order for the chips. Kept verbatim from the parent: the picker shows
// themes in a fixed order rather than however getUnlockedThemeIds() returns them.
const THEME_RENDER_ORDER = ['classic', 'habit-tracker', 'fitness', 'scholar', 'cleaning'];

/**
 * Toggle the picker open or closed for a routine.
 * @param {Object} deps - The parent's live deps
 * @param {string} cycleKey
 * @returns {void}
 */
export function toggleThemePicker(deps, cycleKey) {
    const picker = deps.getElementById(DOM_IDS.THEME_PICKER_ROW);
    if (!picker) return;

    const isOpen = !picker.classList.contains(DOM_CLASSES.HIDDEN);
    if (isOpen) {
        closeThemePicker(deps);
    } else {
        openThemePicker(deps, cycleKey);
    }
}

/**
 * Render and show the theme picker for a given routine.
 *
 * Also the RE-RENDER path: `selectTheme` calls back into this to refresh which
 * chip is current, deliberately without closing.
 *
 * @param {Object} deps - The parent's live deps
 * @param {string} cycleKey
 * @returns {void}
 */
export function openThemePicker(deps, cycleKey) {
    const vtm = deps.vocabThemeManager;
    const picker = deps.getElementById(DOM_IDS.THEME_PICKER_ROW);
    if (!picker || !vtm) return;

    // Update theme button active state
    const themeBtn = deps.getElementById(DOM_IDS.SWITCH_THEME_BTN);
    themeBtn?.setAttribute('aria-expanded', 'true');

    const state = deps.AppState?.get();
    const cycle = state?.data?.cycles?.[cycleKey];
    const currentThemeId = cycle?.theme ?? 'classic';
    const unlocked = new Set(vtm.getUnlockedThemeIds());

    // Clear existing chips and their listeners
    picker.innerHTML = '';
    picker._clickHandlers = picker._clickHandlers ?? [];
    picker._clickHandlers.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    picker._clickHandlers = [];

    // Add title
    const title = document.createElement('div');
    title.className = 'theme-picker-title';
    title.textContent = getLabel('switcher.themePickerTitle');
    picker.appendChild(title);

    // Chips container (bordered area)
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'theme-picker-chips';

    // Build a chip for each unlocked theme only
    THEME_RENDER_ORDER.forEach(id => {
        if (!unlocked.has(id)) return; // hide locked themes entirely

        const def = vtm.getThemeDefinition(id);
        if (!def) return;

        const isCurrent = id === currentThemeId;

        const chip = document.createElement('button');
        chip.className = 'theme-chip';
        chip.setAttribute('role', 'radio');
        chip.setAttribute('aria-checked', String(isCurrent));
        chip.setAttribute('title', def.description);

        const icon = def.icons?.celebrate ?? (id === 'classic' ? '✨' : '');
        chip.innerHTML = [
            icon ? `<span class="theme-chip-icon" aria-hidden="true">${icon}</span>` : '',
            `<span class="theme-chip-name">${def.name}</span>`
        ].join('');

        const handler = (e) => {
            e.stopPropagation();
            selectTheme(deps, cycleKey, id, def);
        };
        chip.addEventListener('click', handler);
        picker._clickHandlers.push({ el: chip, fn: handler });

        chipsContainer.appendChild(chip);
    });

    picker.appendChild(chipsContainer);
    picker.classList.remove(DOM_CLASSES.HIDDEN);
}

/**
 * Apply a theme to a routine, then re-render the picker in place.
 *
 * Was `_selectTheme` on the parent class. On success it re-opens rather than
 * closing, so the newly-current chip becomes the checked one while the user is
 * still looking at the list.
 *
 * @param {Object} deps - The parent's live deps
 * @param {string} cycleKey
 * @param {string} themeId
 * @param {Object} def - Theme definition object
 * @returns {void}
 */
export function selectTheme(deps, cycleKey, themeId, def) {
    const vtm = deps.vocabThemeManager;
    if (!vtm) return;

    const success = vtm.setRoutineTheme(cycleKey, themeId);
    if (success) {
        const icon = def.icons?.celebrate ?? '🎨';
        deps.showNotification(
            `${icon} ${getLabel('notify.themeApplied', { vars: { name: def.name } })}`,
            'success', UI_TIMEOUTS.NOTIFICATION_LONG
        );
        deps.logHistoryEvent?.('theme_changed', { themeName: def.name, themeId });
        // refreshThemeLabels handles all label updates + applies vocab theme color preset
        deps.refreshThemeLabels?.();
        // Re-render picker to update which chip is highlighted (don't close it)
        openThemePicker(deps, cycleKey);
    }
}

/**
 * Hide and reset the theme picker.
 *
 * Releases every chip listener tracked on the element. The parent's `_cleanup()`
 * does NOT touch the picker, so this is the whole teardown contract — it travels
 * with the code rather than being split across two files.
 *
 * @param {Object} deps - The parent's live deps
 * @returns {void}
 */
export function closeThemePicker(deps) {
    const picker = deps.getElementById(DOM_IDS.THEME_PICKER_ROW);
    const themeBtn = deps.getElementById(DOM_IDS.SWITCH_THEME_BTN);
    if (picker) {
        picker.classList.add(DOM_CLASSES.HIDDEN);
        // Clean up chip listeners
        if (picker._clickHandlers) {
            picker._clickHandlers.forEach(({ el, fn }) => el.removeEventListener('click', fn));
            picker._clickHandlers = [];
        }
    }
    themeBtn?.setAttribute('aria-expanded', 'false');
}
