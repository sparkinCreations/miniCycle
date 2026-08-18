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
    const { buildRecurringTemplate, RECURRING_TEMPLATE_SCHEMA_VERSION } =
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

    await test('produces the full field set every writer needs', () => {
        const t = buildRecurringTemplate(base());
        const required = [
            'id', 'text', 'recurring', 'recurringSettings', 'dueDate', 'highPriority',
            'priorityColor', 'remindersEnabled', 'deleteWhenComplete',
            'deleteWhenCompleteSettings', 'occurrenceCount', 'lastTriggeredTimestamp',
            'nextScheduledOccurrence', 'schemaVersion'
        ];
        const missing = required.filter(k => !(k in t));
        assert(missing.length === 0, `missing field(s): ${missing.join(', ')}`);
        assertEq(t.recurring, true, 'recurring must be true');
        assertEq(t.schemaVersion, RECURRING_TEMPLATE_SCHEMA_VERSION, 'schemaVersion');
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
        assertEq(t.deleteWhenComplete, true, 'recurring instances auto-remove by default');
        assertEq(t.occurrenceCount, 0, 'a fresh template has no occurrences yet');
        assertEq(t.lastTriggeredTimestamp, null, 'never triggered');
        assertEq(t.highPriority, false, 'highPriority default');
        assertEq(t.priorityColor, null, 'priorityColor default');
        assertEq(t.dueDate, null, 'dueDate default');
        assertEq(t.remindersEnabled, false, 'remindersEnabled default');
        assert(t.deleteWhenCompleteSettings && typeof t.deleteWhenCompleteSettings === 'object',
            'deleteWhenCompleteSettings must be an object, not null');
    });

    await test('caller values win over every default', () => {
        const t = buildRecurringTemplate({
            ...base(),
            dueDate: '2026-09-01', highPriority: true, priorityColor: '#ff0000',
            remindersEnabled: true, deleteWhenComplete: false,
            deleteWhenCompleteSettings: { cycle: false, todo: false },
            occurrenceCount: 7, lastTriggeredTimestamp: 123
        });
        assertEq(t.dueDate, '2026-09-01', 'dueDate');
        assertEq(t.highPriority, true, 'highPriority');
        assertEq(t.deleteWhenComplete, false, 'an explicit false must survive');
        assertEq(t.occurrenceCount, 7, 'progress toward a finite count must survive');
        assertEq(t.lastTriggeredTimestamp, 123, 'lastTriggeredTimestamp');
        assertEq(t.deleteWhenCompleteSettings.cycle, false, 'supplied settings win');
    });

    await test('deleteWhenCompleteSettings gets a fresh object, never a shared one', () => {
        // Two templates sharing one settings object would let editing one silently
        // change the other.
        const a = buildRecurringTemplate(base());
        const b = buildRecurringTemplate(base());
        assert(a.deleteWhenCompleteSettings !== b.deleteWhenCompleteSettings,
            'each template must own its settings object');
        a.deleteWhenCompleteSettings.cycle = 'mutated';
        assert(b.deleteWhenCompleteSettings.cycle !== 'mutated', 'mutation leaked between templates');
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    return { passed: passed.count, total: total.count };
}
