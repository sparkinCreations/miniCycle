/**
 * recurringTemplate Tests
 * Tests for modules/recurring/recurringTemplate.js
 *
 * The value here is not the field list — it is that ONE field list exists. Five
 * writers had drifted into five different shapes, and the missing
 * nextScheduledOccurrence was a live bug (restored recurring tasks never fired).
 * These pin the shape and the two traps that made the drift dangerous.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runRecurringTemplateTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { buildRecurringTemplate, RECURRING_TEMPLATE_SCHEMA_VERSION, isRecurringPinned, getRecurringPauseState, syncTemplateFromTask, healTemplatesFromTasks } =
        await import(`../modules/recurring/recurringTemplate.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>🔁 recurringTemplate Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);
    const assert = (c, m) => { if (!c) throw new Error(m); };
    const assertEq = (a, e, m) => assert(a === e, `${m} (expected ${e}, got ${a})`);

    const base = () => ({
        id: 't-1', text: 'water the plants',
        recurringSettings: { frequency: 'daily', indefinitely: true },
        nextScheduledOccurrence: 1786000000000
    });

    // ── syncTemplateFromTask / healTemplatesFromTasks ─────────────────────
    // The watcher recreates a task from its template, so an edit on the live task
    // must reach the template or it holds only until the next occurrence. Until
    // Oct 2026 a renamed recurring task came back under its old name.
    const routineWith = (taskOverrides = {}, templateOverrides = {}) => ({
        tasks: [{ id: 't-1', text: 'water the plants', dueDate: null, priority: null, remindersEnabled: false, recurring: true, ...taskOverrides }],
        recurringTemplates: { 't-1': buildRecurringTemplate({ ...base(), ...templateOverrides }) }
    });

    await test('syncTemplateFromTask: a rename reaches the template', () => {
        const r = routineWith();
        const changed = syncTemplateFromTask(r, 't-1', { text: 'water the garden' });
        assertEq(changed, true, 'reports the change');
        assertEq(r.recurringTemplates['t-1'].text, 'water the garden', 'template text follows the task');
    });

    await test('syncTemplateFromTask: the reminder flag, due date and priority follow too', () => {
        const r = routineWith();
        syncTemplateFromTask(r, 't-1', { remindersEnabled: true, dueDate: '2026-11-01', priority: 'high' });
        const t = r.recurringTemplates['t-1'];
        assertEq(t.remindersEnabled, true, 'remindersEnabled');
        assertEq(t.dueDate, '2026-11-01', 'dueDate');
        assertEq(t.priority, 'high', 'priority');
        syncTemplateFromTask(r, 't-1', { dueDate: '', priority: 'nonsense' });
        assertEq(t.dueDate, null, 'an empty due date stores null');
        assertEq(t.priority, null, 'an invalid level stores null');
    });

    await test('syncTemplateFromTask: no template, or nothing different, is a no-op that says so', () => {
        const r = routineWith();
        assertEq(syncTemplateFromTask(r, 'nope', { text: 'x' }), false, 'unknown task');
        assertEq(syncTemplateFromTask(r, 't-1', { text: 'water the plants' }), false, 'same text');
        assertEq(syncTemplateFromTask(r, 't-1', { text: '   ' }), false, 'blank text never blanks the template');
        assertEq(r.recurringTemplates['t-1'].text, 'water the plants', 'template untouched');
    });

    await test('healTemplatesFromTasks: repairs drifted templates, counts them, dryRun only counts', () => {
        const r = routineWith({ text: 'renamed long ago', remindersEnabled: true });
        r.tasks.push({ id: 't-2', text: 'no template here', recurring: false });
        assertEq(healTemplatesFromTasks(r, { dryRun: true }), 1, 'dry run counts the drifted template');
        assertEq(r.recurringTemplates['t-1'].text, 'water the plants', 'dry run writes nothing');
        assertEq(healTemplatesFromTasks(r), 1, 'repairs one');
        assertEq(r.recurringTemplates['t-1'].text, 'renamed long ago', 'text repaired');
        assertEq(r.recurringTemplates['t-1'].remindersEnabled, true, 'reminder flag repaired');
        assertEq(healTemplatesFromTasks(r), 0, 'second pass finds nothing');
    });

    await test('healTemplatesFromTasks: a template whose task is gone is left alone', () => {
        const r = routineWith();
        r.tasks = [];   // cleared, waiting for its next occurrence
        assertEq(healTemplatesFromTasks(r), 0, 'nothing to compare against');
        assertEq(r.recurringTemplates['t-1'].text, 'water the plants', 'template kept');
    });

    await test('produces the full field set every writer needs', () => {
        const t = buildRecurringTemplate(base());
        const required = [
            'id', 'text', 'recurring', 'recurringSettings', 'dueDate', 'priority',
            'remindersEnabled', 'autoClear', 'occurrenceCount', 'lastTriggeredTimestamp',
            'nextScheduledOccurrence', 'position', 'schemaVersion', 'paused'
        ];
        const missing = required.filter(k => !(k in t));
        assert(missing.length === 0, `missing field(s): ${missing.join(', ')}`);
        assertEq(t.recurring, true, 'recurring must be true');
        assertEq(t.schemaVersion, RECURRING_TEMPLATE_SCHEMA_VERSION, 'schemaVersion');
    });

    await test('position defaults to null and only keeps a non-negative integer', () => {
        // null means "append" — the watcher's old behaviour, and what every
        // template written before the field existed reads as.
        assertEq(buildRecurringTemplate(base()).position, null, 'default');
        assertEq(buildRecurringTemplate({ ...base(), position: 0 }).position, 0, 'zero is a real position');
        assertEq(buildRecurringTemplate({ ...base(), position: 3 }).position, 3, 'integer kept');
        for (const bad of [-1, 1.5, '2', NaN, undefined]) {
            assertEq(buildRecurringTemplate({ ...base(), position: bad }).position, null, `invalid ${String(bad)} → null`);
        }
    });

    await test('a template built with no scheduling never fires — and says so', () => {
        // The bug this module exists to stop: recurringWatcher gates on
        // `nextScheduledOccurrence == null`, which matches undefined AND null, so
        // both readings are equally dead. Silence here is what made it invisible.
        const warnings = [];
        const real = console.warn;
        console.warn = (...a) => warnings.push(a.join(' '));
        try {
            const t = buildRecurringTemplate({ ...base(), nextScheduledOccurrence: undefined });
            assertEq(t.nextScheduledOccurrence, null, 'undefined must normalise to null');
            assert(warnings.some(w => /never fire/i.test(w)),
                'a template with no next occurrence must warn — it is inert');
        } finally { console.warn = real; }
    });

    await test('defaults match the recurring contract', () => {
        const t = buildRecurringTemplate(base());
        assertEq(t.autoClear.cycle, true, 'recurring instances clear on reset by default');
        assertEq(t.autoClear.todo, true, 'and in To-Do mode');
        assertEq(t.occurrenceCount, 0, 'a fresh template has no occurrences yet');
        assertEq(t.lastTriggeredTimestamp, null, 'never triggered');
        assertEq(t.priority, null, 'priority default');
        assertEq(t.dueDate, null, 'dueDate default');
        assertEq(t.remindersEnabled, false, 'remindersEnabled default');
        assertEq(t.paused, false, 'a template is live until the user pauses it');
        assertEq(buildRecurringTemplate({ ...base(), paused: true }).paused, true, 'paused kept');
        assertEq(buildRecurringTemplate({ ...base(), paused: 'yes' }).paused, false, 'only a real true pauses');
        assert(t.autoClear && typeof t.autoClear === 'object',
            'autoClear must be an object, not null');
    });

    await test('caller values win over every default', () => {
        const t = buildRecurringTemplate({
            ...base(),
            dueDate: '2026-09-01', priority: 'high',
            remindersEnabled: true, 
            autoClear: { cycle: false, todo: false },
            occurrenceCount: 7, lastTriggeredTimestamp: 123
        });
        assertEq(t.dueDate, '2026-09-01', 'dueDate');
        assertEq(t.priority, 'high', 'priority');
        assertEq(t.occurrenceCount, 7, 'progress toward a finite count must survive');
        assertEq(t.lastTriggeredTimestamp, 123, 'lastTriggeredTimestamp');
        assertEq(t.autoClear.cycle, false, 'supplied settings win');
    });

    await test('autoClear gets a fresh object, never a shared one', () => {
        // Two templates sharing one settings object would let editing one silently
        // change the other.
        const a = buildRecurringTemplate(base());
        const b = buildRecurringTemplate(base());
        assert(a.autoClear !== b.autoClear,
            'each template must own its settings object');
        a.autoClear.cycle = 'mutated';
        assert(b.autoClear.cycle !== 'mutated', 'mutation leaked between templates');
    });

    // ── Pinned = paused, derived ───────────────────────────────────────────
    const pinRoutine = ({ todoMode = false, instance = true, keep = { cycle: false, todo: true } } = {}) => ({
        deleteCheckedTasks: todoMode,
        tasks: instance ? [{ id: 'r', text: 'Rent', recurring: true, autoClear: keep }] : [],
        recurringTemplates: { r: { id: 'r', paused: false } }
    });

    await test('a recurring task set not to clear in the current mode is pinned', () => {
        assertEq(isRecurringPinned(pinRoutine(), 'r'), true, 'Clear on Reset off in a cycle mode');
        assertEq(isRecurringPinned(pinRoutine({ keep: { cycle: true, todo: true } }), 'r'), false, 'Clear on Reset on');
    });

    await test('a recurring pin holds in every mode, even on a map from before that rule', () => {
        assertEq(isRecurringPinned(pinRoutine({ todoMode: true }), 'r'), true, 'pinned in the cycle modes is pinned in To-Do');
        assertEq(isRecurringPinned(pinRoutine({ todoMode: true, keep: { cycle: true, todo: false } }), 'r'), true, 'Marked for Clearing off');
        assertEq(isRecurringPinned(pinRoutine({ keep: { cycle: true, todo: false } }), 'r'), true, 'pinned in To-Do is pinned in the cycle modes');
    });

    await test('no instance in the list, or no routine, is never pinned', () => {
        assertEq(isRecurringPinned(pinRoutine({ instance: false }), 'r'), false, 'absent instance');
        assertEq(isRecurringPinned(null, 'r'), false, 'no routine');
        assertEq(isRecurringPinned({}, 'r'), false, 'routine without tasks');
    });

    await test('a pause of the user\'s own wins over the pin', () => {
        const routine = pinRoutine();
        assertEq(getRecurringPauseState(routine, { id: 'r', paused: true }), 'manual', 'paused then pinned reads as a normal pause');
        assertEq(getRecurringPauseState(routine, { id: 'r', paused: false }), 'pinned', 'pinned without a pause');
        assertEq(getRecurringPauseState(pinRoutine({ keep: { cycle: true, todo: true } }), { id: 'r', paused: true }), 'manual', 'unpinned keeps the user\'s pause');
        assertEq(getRecurringPauseState(pinRoutine({ keep: { cycle: true, todo: true } }), { id: 'r', paused: false }), null, 'neither');
        assertEq(getRecurringPauseState(routine, null), null, 'no template');
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    return { passed: passed.count, total: total.count };
}
