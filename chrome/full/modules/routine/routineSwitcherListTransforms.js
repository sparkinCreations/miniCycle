/**
 * miniCycle Routine Switcher — List Transforms
 *
 * The pure sort/filter transforms behind the switcher's routine list: ordering
 * entries by name, recency or size; deriving a routine's mode; and filtering the
 * list to one mode.
 *
 * Extracted from `routine/routineSwitcher.js` (Aug 2026, splits-plan Priority 1,
 * third extraction after the theme picker and preview).
 *
 * ── WHY ONLY THREE OF THE CLUSTER'S EIGHT METHODS ───────────────────────────
 * LARGE_MODULE_SPLITS_PLAN.md scoped this as "search/sort/filter — pure UI
 * filtering, stateless transforms" and listed eight methods. Measured before
 * extracting, only these three are stateless. The other five —
 * `setupSearchInput`, `filterRoutineList`, `setupSortControls`,
 * `_updateSortButtonStates`, `setupFilterControls` — own instance state that the
 * PARENT also depends on:
 *
 *   • `_sortMode`, `_sortDirection` and `_filterMode` are initialised in the
 *     constructor, restored from saved preferences, written back by
 *     `_savePreferences`, and read by list rendering when it builds the
 *     "no routines in this mode" message;
 *   • those five methods call back into the parent 14 times
 *     (`loadMiniCycleList` ×4, `_savePreferences` ×4, `_updateSortButtonStates`
 *     ×4, plus `filterRoutineList` and `_deselectRoutine`).
 *
 * Extracting them would need an interface of about nine getters, setters and
 * callbacks — a seam wider than the code it separates, and the same failure the
 * plan already records for `settingsUIManager`: repetition and wiring moved
 * rather than reduced. They are not a god-module symptom; they are the
 * switcher's own list-control state, sitting where it belongs.
 *
 * ── WHAT MAKES THESE THREE SEPARABLE ────────────────────────────────────────
 * Given their inputs they read nothing else. Mode and direction arrive as
 * arguments instead of being read off the instance, and the size sorter is
 * injected: `getObjectSizeBytes` lives in the parent as a module-level binding
 * populated by the dynamic import inside `initRoutineSwitcher()`, so a
 * statically-imported module cannot reach it. Passing it keeps this file free of
 * both that binding and any import-time work.
 *
 * @module routine/routineSwitcherListTransforms
 * @see {@link file://docs/future-work/LARGE_MODULE_SPLITS_PLAN.md} - why this split
 */

/**
 * Strip leading emoji (including ZWJ sequences and variation selectors) so an
 * alphabetical sort keys off the words a reader sees. Without this, "🔥 Apple"
 * sorts by the fire emoji's code point and lands nowhere near A.
 * @param {string} text
 * @returns {string}
 */
function stripLeadingEmoji(text) {
    return text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');
}

/**
 * Order routine entries for display.
 *
 * `direction` means different things per mode, which is deliberate — 'asc' is
 * always the reading a user expects first: A-Z by name, NEWEST first by
 * recency, LARGEST first by size.
 *
 * @param {Array<[string, Object]>} cycleEntries - [storageKey, cycleData] pairs
 * @param {Object} options
 * @param {string} options.mode - 'alpha' | 'recent' | 'size'
 * @param {string} options.direction - 'asc' | 'desc'
 * @param {function(Object): number} [options.sizeOf] - byte sizer, required for 'size'
 * @returns {Array<[string, Object]>} the same array, sorted in place
 */
export function sortCycles(cycleEntries, { mode, direction, sizeOf } = {}) {
    const isAsc = direction === 'asc';

    if (mode === 'recent') {
        // Sort by lastModified, fall back to createdAt
        // asc = newest first, desc = oldest first
        return cycleEntries.sort((a, b) => {
            const aTime = a[1].lastModified || a[1].createdAt || 0;
            const bTime = b[1].lastModified || b[1].createdAt || 0;
            return isAsc ? bTime - aTime : aTime - bTime;
        });
    } else if (mode === 'size') {
        // Sort by file size
        // asc = largest first, desc = smallest first
        return cycleEntries.sort((a, b) => {
            const aSize = sizeOf(a[1]);
            const bSize = sizeOf(b[1]);
            return isAsc ? bSize - aSize : aSize - bSize;
        });
    } else {
        // Default: alphabetical by title
        // asc = A-Z, desc = Z-A
        return cycleEntries.sort((a, b) => {
            const aTitle = stripLeadingEmoji((a[1].title || a[0]).toLowerCase());
            const bTitle = stripLeadingEmoji((b[1].title || b[0]).toLowerCase());
            return isAsc ? aTitle.localeCompare(bTitle) : bTitle.localeCompare(aTitle);
        });
    }
}

/**
 * Which mode a routine is in.
 *
 * Order matters: a To-Do routine may also carry `autoReset`, and this must agree
 * with what the mode selector shows the user, so `deleteCheckedTasks` wins.
 *
 * @param {Object} cycleData
 * @returns {'todo'|'auto'|'manual'}
 */
export function getCycleMode(cycleData) {
    if (cycleData.deleteCheckedTasks) {
        return 'todo';
    } else if (cycleData.autoReset) {
        return 'auto';
    } else {
        return 'manual';
    }
}

/**
 * Keep only the routines matching a mode. 'all' passes everything through
 * untouched (the same array, not a copy).
 *
 * @param {Array<[string, Object]>} cycleEntries
 * @param {string} filterMode - 'all' | 'todo' | 'auto' | 'manual'
 * @returns {Array<[string, Object]>}
 */
export function filterCycles(cycleEntries, filterMode) {
    if (filterMode === 'all') {
        return cycleEntries;
    }

    return cycleEntries.filter(([key, cycleData]) => {
        return getCycleMode(cycleData) === filterMode;
    });
}
