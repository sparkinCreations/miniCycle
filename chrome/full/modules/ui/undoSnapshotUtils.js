/**
 * miniCycle Undo Snapshot Utilities (pure)
 *
 * Validation, sanitisation and identity for undo/redo snapshots. Split out of
 * `undoRedoManager.js` (Priority 3, LARGE_MODULE_SPLITS_PLAN.md).
 *
 * PATTERN 2 — pure utility extraction. Every function here is a pure function of
 * its arguments: no DI container, no module-level mutable state, no listeners,
 * no imports with side effects. That is why this file has no
 * `setDependencies()` and why a plain static import is safe.
 *
 * WHY THIS IS THE RIGHT CUT, and not the one the plan proposed: Priority 3
 * originally scheduled `captureStateSnapshot` for extraction and rated it
 * "Medium risk" for needing its own DI. Measured, that function is the opposite
 * of extractable — 120 lines across six phases, reading and writing
 * `AppGlobalState` throughout, firing a cycle switch to self-heal, and ending in
 * a UI refresh plus a durable write. The functions AROUND it are the clean
 * cluster: five of them touch no dependency at all and only call each other.
 * Moving those needs no wiring, no manifest entry and no `provides` name, and
 * leaves `captureStateSnapshot` in place as readable policy.
 *
 * CONSEQUENCE: a static import from a boot-critical module makes this file
 * boot-critical too. It IS in `BOOT_CRITICAL` in `service-worker.js`; run
 * `npm run test:sw` if you touch it.
 *
 * KEEP IT PURE. The moment something here needs a dependency, it belongs back in
 * the parent (or behind its own DI module) — not wired in through a back door.
 *
 * @module ui/undoSnapshotUtils
 */

// Known valid theme IDs (avoids importing side-effectful themes.js)
const VALID_THEME_IDS = new Set(['classic', 'habit-tracker', 'fitness', 'scholar', 'cleaning']);

/**
 * Validate a single snapshot belongs to the expected cycle
 * @param {Object} snapshot - The snapshot to validate
 * @param {string} expectedCycleId - The cycle ID it should belong to
 * @returns {boolean} True if valid
 */
export function validateSnapshot(snapshot, expectedCycleId) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (!snapshot.activeCycleId) return false;
  if (snapshot.activeCycleId !== expectedCycleId) return false;
  if (!Array.isArray(snapshot.tasks)) return false;
  return true;
}

/**
 * Sanitize a snapshot before restoring to prevent corrupted data from entering state.
 * Clamps numeric fields, validates task entries, and normalizes theme IDs.
 * @param {Object} snapshot - The snapshot to sanitize
 * @returns {Object} The sanitized snapshot (mutated in place for efficiency)
 */
export function sanitizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;

  // Clamp cycleCount to non-negative integer
  if ('cycleCount' in snapshot) {
    const cc = snapshot.cycleCount;
    snapshot.cycleCount = (Number.isFinite(cc) && cc >= 0) ? Math.floor(cc) : 0;
  }

  // Validate theme is a known ID
  if ('theme' in snapshot) {
    if (!VALID_THEME_IDS.has(snapshot.theme)) {
      snapshot.theme = 'classic';
    }
  }

  // Sanitize clearedTasks
  if (snapshot.clearedTasks && typeof snapshot.clearedTasks === 'object') {
    const tc = snapshot.clearedTasks.totalCleared;
    snapshot.clearedTasks.totalCleared = (Number.isFinite(tc) && tc >= 0) ? Math.floor(tc) : 0;
    if (!Array.isArray(snapshot.clearedTasks.entries)) {
      snapshot.clearedTasks.entries = [];
    }
  }

  // Validate task entries — filter out malformed tasks
  if (Array.isArray(snapshot.tasks)) {
    snapshot.tasks = snapshot.tasks.filter(t =>
      t && typeof t === 'object' && typeof t.id === 'string' && typeof t.text === 'string'
    );
  }

  return snapshot;
}

/**
 * Filter snapshots to only include those belonging to the specified cycle
 * @param {Array} snapshots - Array of snapshots to filter
 * @param {string} cycleId - The cycle ID to filter for
 * @returns {Array} Filtered array of valid snapshots
 */
export function filterValidSnapshots(snapshots, cycleId) {
  if (!Array.isArray(snapshots)) return [];
  if (!cycleId) return [];

  const valid = snapshots.filter(snap => validateSnapshot(snap, cycleId));
  const removed = snapshots.length - valid.length;

  if (removed > 0) {
    console.warn(`🧹 Filtered out ${removed} invalid snapshots (wrong cycleId or malformed)`);
  }

  return valid;
}

/**
 * Build snapshot signature for comparison
 */
export function buildSnapshotSignature(s) {
  if (!s) return '';
  return JSON.stringify({
    c: s.activeCycleId,
    t: (s.tasks || []).map(t => ({
      id: t.id, txt: t.text, c: !!t.completed, p: !!t.highPriority, d: t.dueDate || null,
      r: !!t.recurring, re: !!t.remindersEnabled, dwc: !!t.deleteWhenComplete, pc: t.priorityColor || null,
      // Settings OBJECTS, not just their booleans — an edit touching only
      // these would otherwise dedup-skip its snapshot (same class of bug as
      // the taskViewLayout omission below).
      rs: t.recurringSettings ? JSON.stringify(t.recurringSettings) : null,
      dws: t.deleteWhenCompleteSettings ? JSON.stringify(t.deleteWhenCompleteSettings) : null
    })),
    ti: s.title || '',
    ar: !!s.autoReset,
    dc: !!s.deleteCheckedTasks,
    cc: s.cycleCount || 0,
    th: s.theme || 'classic',
    rt: Object.keys(s.recurringTemplates || {}).sort().map(k => {
      const tmpl = s.recurringTemplates[k];
      return { id: k, rs: JSON.stringify(tmpl?.recurringSettings || {}) };
    }),
    ct: s.clearedTasks?.totalCleared || 0,
    // Task view layout — without this in the signature, a layout-only
    // change (drag-end or dock-back) would dedup against the previous
    // snapshot and never push, leaving the move outside undo history.
    tvl: JSON.stringify(s.taskViewLayout?.positions || {})
  });
}

/**
 * Compare two snapshots for equality
 * Uses cached signatures if available for performance
 */
export function snapshotsEqual(a, b) {
  if (!a || !b) return false;

  // ✅ Use cached signatures if available
  if (a._sig && b._sig) {
    return a._sig === b._sig;
  }

  // Fallback to building (shouldn't happen often)
  return buildSnapshotSignature(a) === buildSnapshotSignature(b);
}
