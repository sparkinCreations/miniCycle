/**
 * miniCycle Routine Switcher — Data Repair
 *
 * Normalises a routine's stored shape before the app switches into it: drops
 * junk tasks, fills in missing ids and defaults, and repairs cycle-level fields.
 *
 * Extracted from `routine/routineSwitcher.js` (Aug 2026, splits-plan Priority 1).
 * The cleanest seam left in that file: one dependency, no calls back into the
 * parent, no instance state.
 *
 * ── WHY THIS ONE MATTERS MOST OF THE FOUR ───────────────────────────────────
 * Repair is SILENT by design. It rewrites the user's stored routine and returns
 * a boolean nobody surfaces — no thrown error, no notification, nothing on
 * screen. A regression here corrupts data quietly, which is why it got a test
 * suite before it got moved, and why the suite covers each default individually
 * rather than one happy path.
 *
 * Takes `AppState` directly rather than a deps bag: it is the only dependency,
 * and naming it makes the transaction boundary obvious at the call site.
 *
 * @module routine/routineSwitcherRepair
 * @see {@link file://docs/future-work/LARGE_MODULE_SPLITS_PLAN.md} - why this split
 */

/**
 * Validate and repair a cycle in place (through AppState), returning whether
 * anything needed fixing.
 *
 * @param {Object} AppState - The live AppState (get + update)
 * @param {string} cycleKey - Storage key of the cycle to check
 * @returns {boolean} true when at least one repair was applied
 */
export function validateAndRepairCycleData(AppState, cycleKey) {
    const currentState = AppState.get();
    const originalCycle = currentState?.data?.cycles?.[cycleKey];

    if (!originalCycle) {
        console.warn(`⚠️ Cycle not found for validation: ${cycleKey}`);
        return false;
    }

    // ✅ Clone the cycle to avoid mutating state outside AppState.update()
    const cycle = structuredClone(originalCycle);
    let repaired = false;

    // Ensure tasks is an array
    if (!Array.isArray(cycle.tasks)) {
        console.warn(`⚠️ Cycle "${cycleKey}" has invalid tasks - resetting to empty array`);
        cycle.tasks = [];
        repaired = true;
    }

    // Validate and repair each task
    const validTasks = [];
    for (const task of cycle.tasks) {
        if (!task || typeof task !== 'object') {
            console.warn('⚠️ Skipping invalid task (not an object)');
            repaired = true;
            continue;
        }

        // Generate ID if missing. Suffix entropy matches the main generator
        // (globalUtils generateHashId): this loop runs synchronously, so every
        // repaired task shares the same millisecond — a 0-999 suffix had ~17%
        // birthday-collision odds at 20 tasks, and a collision makes
        // drag-reorder silently drop a task (find-by-id resolves both to the
        // first match).
        if (!task.id || typeof task.id !== 'string') {
            task.id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
            console.warn(`⚠️ Generated missing task ID: ${task.id}`);
            repaired = true;
        }

        // Default text to empty string if missing
        if (typeof task.text !== 'string') {
            task.text = task.text ? String(task.text) : '';
            repaired = true;
        }

        // Default boolean fields
        if (typeof task.completed !== 'boolean') {
            task.completed = Boolean(task.completed);
            repaired = true;
        }
        if (typeof task.highPriority !== 'boolean') {
            task.highPriority = Boolean(task.highPriority);
            repaired = true;
        }
        if (typeof task.remindersEnabled !== 'boolean') {
            task.remindersEnabled = Boolean(task.remindersEnabled);
            repaired = true;
        }
        if (typeof task.recurring !== 'boolean') {
            task.recurring = Boolean(task.recurring);
            repaired = true;
        }

        // Default dueDate to null
        if (task.dueDate === undefined) {
            task.dueDate = null;
            repaired = true;
        }

        // (deleteWhenComplete is optional — undefined is a valid state; a
        // dead self-assignment lived here until v2.365.)
        if (!task.deleteWhenCompleteSettings || typeof task.deleteWhenCompleteSettings !== 'object') {
            task.deleteWhenCompleteSettings = { cycle: false, todo: true };
            repaired = true;
        }

        // Ensure recurringSettings is an object if task is recurring
        if (task.recurring && (!task.recurringSettings || typeof task.recurringSettings !== 'object')) {
            task.recurringSettings = {};
            repaired = true;
        }

        validTasks.push(task);
    }

    // Update tasks if any were removed or repaired
    if (validTasks.length !== cycle.tasks.length || repaired) {
        cycle.tasks = validTasks;
        repaired = true;
    }

    // Ensure cycle has required fields
    if (!cycle.title || typeof cycle.title !== 'string') {
        cycle.title = cycleKey; // Use key as fallback title
        repaired = true;
    }
    if (typeof cycle.cycleCount !== 'number' || cycle.cycleCount < 0) {
        cycle.cycleCount = 0;
        repaired = true;
    }
    if (typeof cycle.autoReset !== 'boolean') {
        cycle.autoReset = true; // Default to auto-cycle mode
        repaired = true;
    }
    if (typeof cycle.deleteCheckedTasks !== 'boolean') {
        cycle.deleteCheckedTasks = false;
        repaired = true;
    }

    // ✅ Apply repairs through AppState.update() - never mutate outside transaction
    if (repaired) {
        AppState.update(state => {
            state.data.cycles[cycleKey] = cycle;
        }, true);
    }

    return repaired;
}
