/**
 * McycPayload Tests
 * Tests for modules/utils/mcycPayload.js
 *
 * The single .mcyc payload builder (drift-review D-02 — replaced three
 * hand-rolled copies that had silently diverged). Asserts:
 *   - includeHistory flag controls history/clearedTasks presence
 *   - priorityColor and autoUncheckDaily survive the trip (the two fields
 *     the old copies dropped)
 *   - retired defaultRecurTime is stripped from exports (even from legacy
 *     stored settings that still carry it)
 *   - live cycle data is never mutated
 *   - defaults for missing fields, id generation fallback
 */
import { createProtectedTest } from './testHelpers.js';

export async function runMcycPayloadTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { buildMcycPayload, buildMcycFilename } = await import(`../modules/utils/mcycPayload.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>McycPayload Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    function makeCycle(overrides = {}) {
        return {
            title: 'Morning Routine',
            tasks: [{
                id: 'task-1',
                text: 'Stretch',
                completed: true,
                dueDate: '2026-07-30',
                highPriority: true,
                priorityColor: '#8b1a1a',
                remindersEnabled: true,
                recurring: false,
                recurringSettings: null,
                deleteWhenComplete: false,
                deleteWhenCompleteSettings: { cycle: false, todo: true },
                schemaVersion: 2
            }],
            autoReset: true,
            cycleCount: 42,
            deleteCheckedTasks: false,
            taskOptionButtons: null,
            recurringTemplates: {},
            reminders: { enabled: true },
            autoUncheckDaily: { enabled: true, time: '04:00' },
            createdAt: '2026-01-01T00:00:00.000Z',
            theme: 'fitness',
            history: { events: [{ type: 'cycle_completed', timestamp: 1, details: {} }], maxEvents: 100 },
            clearedTasks: { entries: [{ taskText: 'secret task', clearedAt: 1 }], totalCleared: 1, autoPruneEnabled: true },
            ...overrides
        };
    }

    await test('includeHistory: false omits history and clearedTasks keys entirely', () => {
        const payload = buildMcycPayload('my-cycle', makeCycle(), { includeHistory: false });
        if ('history' in payload) throw new Error('history key should be absent, not null');
        if ('clearedTasks' in payload) throw new Error('clearedTasks key should be absent, not null');
    });

    await test('includeHistory: true carries history and clearedTasks through', () => {
        const payload = buildMcycPayload('my-cycle', makeCycle(), { includeHistory: true });
        if (payload.history?.events?.length !== 1) throw new Error('history should round-trip');
        if (payload.clearedTasks?.entries?.[0]?.taskText !== 'secret task') throw new Error('clearedTasks should round-trip');
    });

    await test('priorityColor survives (dropped by the old share/switcher copies)', () => {
        const payload = buildMcycPayload('my-cycle', makeCycle(), { includeHistory: false });
        if (payload.tasks[0].priorityColor !== '#8b1a1a') {
            throw new Error(`priorityColor lost: got ${payload.tasks[0].priorityColor}`);
        }
    });

    await test('autoUncheckDaily survives (dropped by the old switcher copy)', () => {
        const payload = buildMcycPayload('my-cycle', makeCycle(), { includeHistory: true });
        if (payload.autoUncheckDaily?.time !== '04:00') throw new Error('autoUncheckDaily lost');
    });

    await test('exports do NOT carry the retired defaultRecurTime field', () => {
        // defaultRecurTime was retired in v2.358: it had writers but zero
        // readers, and import-side normalization strips it — so exporting it
        // made every export/import round trip asymmetric on a dead field.
        const cycle = makeCycle();
        cycle.tasks[0].recurring = true;
        // Legacy fixture: stored settings from pre-2.358 versions CARRY the
        // field — the builder must actively strip it, not merely stop writing
        // it (a clone passthrough alone keeps it circulating in .mcyc files).
        cycle.tasks[0].recurringSettings = { frequency: 'daily', defaultRecurTime: '2025-01-01T09:00:00.000Z' };
        const payload = buildMcycPayload('my-cycle', cycle, { includeHistory: false });
        const settings = payload.tasks[0].recurringSettings;
        if ('defaultRecurTime' in settings) throw new Error('retired field must be stripped even from legacy stored settings');
        if (settings.frequency !== 'daily') throw new Error('existing settings should be preserved');
        // The strip must act on the clone only — live stored data is untouched
        if (!('defaultRecurTime' in cycle.tasks[0].recurringSettings)) throw new Error('builder must not mutate live cycle data');
    });

    await test('live cycle data is not mutated by the build', () => {
        const cycle = makeCycle();
        cycle.tasks[0].recurring = true;
        cycle.tasks[0].recurringSettings = { frequency: 'daily' };
        buildMcycPayload('my-cycle', cycle, { includeHistory: true });
        if (cycle.tasks[0].recurringSettings.defaultRecurTime) {
            throw new Error('build mutated the live recurringSettings object');
        }
    });

    await test('missing fields fall back to safe defaults', () => {
        const payload = buildMcycPayload('bare-cycle', {}, { includeHistory: false });
        if (payload.title !== 'New Routine') throw new Error('title default wrong');
        if (!Array.isArray(payload.tasks) || payload.tasks.length !== 0) throw new Error('tasks default wrong');
        if (payload.theme !== 'classic') throw new Error('theme default wrong');
        if (payload.cycleCount !== 0) throw new Error('cycleCount default wrong');
        if (payload.name !== 'bare-cycle') throw new Error('name should be the cycle key');
    });

    await test('task without an id gets a generated fallback id', () => {
        const cycle = makeCycle();
        delete cycle.tasks[0].id;
        const payload = buildMcycPayload('my-cycle', cycle, { includeHistory: false });
        if (!payload.tasks[0].id || !payload.tasks[0].id.startsWith('task-')) {
            throw new Error('missing task id should be generated');
        }
    });

    // Filename sanitization (export-review finding: the old ASCII-only
    // sanitize turned every non-Latin title into pure underscores)
    await test('buildMcycFilename keeps non-Latin titles distinguishable', () => {
        const jp = buildMcycFilename('朝のルーティン');
        const ru = buildMcycFilename('Тренировка');
        if (jp !== '朝のルーティン') throw new Error(`Japanese title must survive, got "${jp}"`);
        if (ru !== 'Тренировка') throw new Error(`Cyrillic title must survive, got "${ru}"`);
        if (jp === ru) throw new Error('distinct titles must produce distinct filenames');
    });

    await test('buildMcycFilename strips path-illegal chars and Windows trailing dots', () => {
        if (buildMcycFilename('a/b:c') !== 'a_b_c') throw new Error('path-illegal chars must become underscores');
        if (buildMcycFilename('done...') !== 'done') throw new Error('trailing dots must be stripped (Windows)');
        if (buildMcycFilename('Morning Routine') !== 'Morning Routine') throw new Error('interior spaces are legal and must survive');
    });

    await test('buildMcycFilename falls back to "routine" when nothing printable survives', () => {
        if (buildMcycFilename('???') !== 'routine') throw new Error('punctuation-only title must fall back');
        if (buildMcycFilename('') !== 'routine') throw new Error('empty title must fall back');
        if (buildMcycFilename(undefined) !== 'routine') throw new Error('undefined title must fall back');
        if (buildMcycFilename('  .. ') !== 'routine') throw new Error('whitespace/dots-only title must fall back');
    });

    // Results
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
