/**
 * mcycPayload.js — the single builder for .mcyc routine payloads.
 *
 * Drift-review D-02: there were THREE hand-rolled copies of this payload
 * (shareManager, cycleExportManager, routineSwitcher) and they had already
 * diverged twice — C-06 (the history/clearedTasks privacy strip reached only
 * shareManager) and priorityColor (present only in cycleExportManager, so
 * share and switcher-download round-trips silently dropped custom priority
 * colors). One builder, one shape; call sites choose only includeHistory.
 *
 * Pure data transform — no DI, no side effects, no manifest entry needed.
 * Safe to import statically from manifest modules and facade sub-modules
 * alike (duplicate module instances would be harmless, and bare relative
 * imports resolve to a single URL anyway).
 */

/**
 * Build a .mcyc export/share payload from a cycle record.
 * @param {string} cycleKey - Storage key of the cycle
 * @param {Object} cycle - Cycle record from state.data.cycles[cycleKey]
 * @param {Object} options
 * @param {boolean} options.includeHistory - Include history + clearedTasks.
 *   true  = backup-for-self semantics (Settings export, routine download);
 *   false = share-with-others semantics (shareManager) — never send the
 *           owner's event log or cleared-task names to another person (C-06).
 * @returns {Object} JSON-serializable .mcyc payload
 */
export function buildMcycPayload(cycleKey, cycle, { includeHistory }) {
    const payload = {
        name: cycleKey,
        title: cycle.title || 'New Routine',
        tasks: (cycle.tasks || []).map(task => {
            // Clone to avoid mutating live cycle data
            const settings = task.recurringSettings
                ? structuredClone(task.recurringSettings)
                : {};

            // defaultRecurTime retired in v2.358 (writers but zero readers;
            // import-side normalization strips it). Deleting — not just
            // no-longer-writing — because STORED settings from every earlier
            // version still carry the field, and a clone passthrough would
            // keep circulating it in shared .mcyc files for years. Stored
            // data itself converges naturally (the applicator normalizes it
            // away on any settings re-apply); no migration for a dead field.
            delete settings.defaultRecurTime;

            return {
                id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                text: task.text || '',
                completed: task.completed || false,
                dueDate: task.dueDate || null,
                highPriority: task.highPriority || false,
                priorityColor: task.priorityColor || null,
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
        autoUncheckDaily: cycle.autoUncheckDaily || null,
        createdAt: cycle.createdAt || null,
        theme: cycle.theme || 'classic'
    };

    if (includeHistory) {
        payload.history = cycle.history || null;
        payload.clearedTasks = cycle.clearedTasks || null;
    }

    return payload;
}

/**
 * Build a filesystem-safe filename stem from a routine title.
 *
 * Keeps Unicode: modern filesystems and every target browser handle it, and
 * the old ASCII-only sanitize turned every non-Latin title into pure
 * underscores — a Japanese and a Russian routine exported to identical
 * indistinguishable names (export-review finding, Aug 2026). Strips only what
 * is actually illegal in a filename: path separators/reserved punctuation,
 * control characters, and trailing dots/spaces (Windows rejects those).
 *
 * Shared by BOTH export paths (cycleExportManager download, shareManager
 * share sheet) so their sanitization can't diverge again — same reasoning as
 * buildMcycPayload above.
 *
 * @param {string} cycleName - Routine title (may be empty/undefined)
 * @returns {string} Non-empty filename stem; 'routine' when nothing printable survives
 */
export function buildMcycFilename(cycleName) {
    const cleaned = String(cycleName || '')
        .replace(/[/\\:*?"<>|]/g, '_')         // path-illegal
        .replace(/[\u0000-\u001F\u007F]/g, '')  // control chars
        .replace(/[.\s]+$/, '')                // trailing dots/spaces
        .trim();
    // A name of pure separators/underscores is worse than a generic one.
    return /[^\s_]/.test(cleaned) ? cleaned : 'routine';
}
