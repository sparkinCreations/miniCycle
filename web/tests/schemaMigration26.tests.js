/**
 * Schema 2.5 → 2.6 migration tests — one group per step, then the whole.
 * The migration is pure; AppState runs it at boot. Last group: repairRoutineKeys, the 2.6
 * maintenance step that re-keys title-keyed routines (Nov 2026).
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runSchemaMigration26Tests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/routine/schemaMigration26.js?v=${cacheBuster}`);
    const themes = await import(`../modules/labels/themes.js?v=${cacheBuster}`);
    const prio = await import(`../modules/utils/priorityLevel.js?v=${cacheBuster}`);
    const { migrateSchema_2_5_to_2_6, rekeyRoutines, collapseAutoClear, convertPriority, renameRoutineKeys, stampVersion, toAutoClear, toPriorityLevel, repairRoutineKeys, isRoutineKeyedById } = mod;
    const SWATCH_SETS = prio.collectSwatchSets(themes.THEME_DEFINITIONS);
    const HABIT_HIGH = themes.THEME_DEFINITIONS['habit-tracker'].priorityColors.find(s => s.level === 'high').hex;

    resultsDiv.innerHTML = '<h2>Schema 2.5 → 2.6 Migration Tests</h2><h3>Running tests...</h3>';
    await setupTestEnvironment();
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    let seq = 0;
    const makeId = () => `routine-${++seq}`;
    const now = () => 1789000000000;
    const migrate = (doc, extra = {}) => migrateSchema_2_5_to_2_6(doc, { makeId, now, swatchSets: SWATCH_SETS, ...extra });

    /** A realistic 2.5 document: two routines keyed by NAME, every priority/clear copy present. */
    const fixture25 = () => ({
        schemaVersion: '2.5',
        metadata: { createdAt: 1, lastModified: 2, migratedFrom: null, migrationDate: null, totalCyclesCreated: 2, totalCyclesCompleted: 7, schemaVersion: '2.5' },
        settings: { theme: 'default', priorityColor: '#facc15', unlockedThemes: ['classic'] },
        data: { cycles: {
            'Morning Routine': {
                id: 'Morning Routine', title: 'Morning Routine', theme: 'habit-tracker', cycleCount: 5, autoReset: true, deleteCheckedTasks: false,
                tasks: [
                    { id: 't1', text: 'Stretch', completed: false, highPriority: true, priorityColor: HABIT_HIGH, dueDate: null, remindersEnabled: false, recurring: false, recurringSettings: {}, deleteWhenComplete: true, deleteWhenCompleteSettings: { cycle: false, todo: true }, schemaVersion: 2 },
                    { id: 't2', text: 'Teal custom', completed: false, highPriority: true, priorityColor: '#1abc9c', dueDate: null, remindersEnabled: false, recurring: false, recurringSettings: {}, deleteWhenComplete: false, deleteWhenCompleteSettings: { cycle: true, todo: false, sprint: true }, schemaVersion: 2 },
                    { id: 't3', text: 'No colour', completed: true, highPriority: true, priorityColor: null, dueDate: null, remindersEnabled: false, recurring: true, recurringSettings: { frequency: 'daily' }, deleteWhenComplete: false, deleteWhenCompleteSettings: null, schemaVersion: 2 },
                    { id: 't4', text: 'Plain', completed: false, highPriority: false, priorityColor: '#dc3545', dueDate: null, remindersEnabled: false, recurring: false, recurringSettings: {}, deleteWhenComplete: false, deleteWhenCompleteSettings: { cycle: false, todo: true }, schemaVersion: 2 }
                ],
                recurringTemplates: { t3: { id: 't3', text: 'No colour', recurring: true, highPriority: true, priorityColor: '#facc15', recurringSettings: { frequency: 'daily' }, nextScheduledOccurrence: 5, deleteWhenComplete: false, deleteWhenCompleteSettings: { cycle: false, todo: true }, position: 2 } },
                clearedTasks: { entries: [{ id: 'clr-1', taskText: 'Gone', clearedAt: 3, wasHighPriority: true, priorityColor: '#28a745', hadDueDate: false, dueDate: null, remindersEnabled: false, deleteWhenComplete: true, deleteWhenCompleteSettings: { cycle: true, todo: true } }], totalCleared: 1, autoPruneEnabled: false },
                history: { events: [
                    { id: 'evt-1', type: 'task_priority_set', timestamp: 4, details: { taskName: 'Stretch', priorityColor: '#7a4d00' } },
                    { id: 'evt-2', type: 'cycle_completed', timestamp: 5, details: { cycleCount: 5, cycleName: 'Morning Routine' } }
                ], maxEvents: 100 }
            },
            'Untitled': { id: 'Untitled', title: '', tasks: [], recurringTemplates: {}, cycleCount: 0, autoReset: false, deleteCheckedTasks: true, history: { events: [], maxEvents: 100 }, clearedTasks: { entries: [], totalCleared: 0, autoPruneEnabled: false } }
        } },
        appState: { activeCycleId: 'Morning Routine', overdueTaskStates: {} },
        userProgress: { cyclesCompleted: 7, rewardMilestones: [] },
        customReminders: { enabled: false }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🔑 Step 1 — re-key routines</h4>';

    await test('routines are re-keyed by generated ids; title is the name; the active id follows', () => {
        seq = 0;
        const doc = rekeyRoutines(fixture25(), makeId);
        const keys = Object.keys(doc.data.cycles);
        if (keys.join(',') !== 'routine-1,routine-2') throw new Error(`keys ${keys.join(',')}`);
        if (doc.data.cycles['routine-1'].id !== 'routine-1') throw new Error('routine.id must equal its key');
        if (doc.data.cycles['routine-1'].title !== 'Morning Routine') throw new Error('title lost');
        if (doc.appState.activeCycleId !== 'routine-1') throw new Error(`active id did not follow: ${doc.appState.activeCycleId}`);
    });

    await test('a routine with no title takes its old key as the title, so no name is lost', () => {
        seq = 0;
        const doc = rekeyRoutines(fixture25(), makeId);
        if (doc.data.cycles['routine-2'].title !== 'Untitled') throw new Error(`title ${JSON.stringify(doc.data.cycles['routine-2'].title)}`);
    });

    await test('a key collision is retried, never merged', () => {
        const ids = ['dup', 'dup', 'dup', 'fresh'];
        let i = 0;
        const doc = rekeyRoutines(fixture25(), () => ids[i++]);
        const keys = Object.keys(doc.data.cycles);
        if (keys.length !== 2 || keys[0] !== 'dup' || keys[1] !== 'fresh') throw new Error(`keys ${keys.join(',')}`);
    });

    await test('an active id that points at no routine becomes null', () => {
        const doc = fixture25(); doc.appState.activeCycleId = 'Nope';
        if (rekeyRoutines(doc, makeId).appState.activeCycleId !== null) throw new Error('dangling active id kept');
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Step 2 — autoClear</h4>';

    await test('toAutoClear: valid map kept, missing modes defaulted, extra boolean modes kept (open map)', () => {
        const a = toAutoClear({ cycle: true, todo: false, sprint: true, junk: 'no' });
        if (JSON.stringify(a) !== JSON.stringify({ cycle: true, todo: false, sprint: true })) throw new Error(JSON.stringify(a));
        const b = toAutoClear(null);
        if (b.cycle !== false || b.todo !== true) throw new Error(`defaults ${JSON.stringify(b)}`);
        const c = toAutoClear({ cycle: 'yes' });
        if (c.cycle !== false) throw new Error('non-boolean mode must fall back to the default');
    });

    await test('collapseAutoClear converts tasks, templates and cleared entries, and drops both legacy fields', () => {
        const doc = collapseAutoClear(fixture25());
        const r = doc.data.cycles['Morning Routine'];
        for (const rec of [...r.tasks, r.recurringTemplates.t3, r.clearedTasks.entries[0]]) {
            if (!rec.autoClear) throw new Error(`autoClear missing on ${rec.id}`);
            if ('deleteWhenComplete' in rec || 'deleteWhenCompleteSettings' in rec) throw new Error(`legacy delete fields survived on ${rec.id}`);
        }
        if (r.tasks[0].autoClear.cycle !== false || r.tasks[0].autoClear.todo !== true) throw new Error('t1 map wrong');
        if (r.tasks[1].autoClear.sprint !== true) throw new Error('extra mode dropped — the map must be open');
        if (r.tasks[2].autoClear.todo !== true) throw new Error('null settings must take the defaults');
    });

    await test('the mirror is ignored: a mirror that disagrees with the map cannot leak into autoClear', () => {
        const doc = fixture25();
        doc.data.cycles['Morning Routine'].tasks[0].deleteWhenComplete = true;         // says clear
        doc.data.cycles['Morning Routine'].tasks[0].deleteWhenCompleteSettings = { cycle: false, todo: false }; // says keep
        const t = collapseAutoClear(doc).data.cycles['Morning Routine'].tasks[0];
        if (t.autoClear.cycle !== false || t.autoClear.todo !== false) throw new Error(`mirror leaked: ${JSON.stringify(t.autoClear)}`);
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🚩 Step 3 — priority levels</h4>';

    await test('toPriorityLevel: another theme\'s swatch, a custom hex by colour family, no colour, unflagged', () => {
        if (toPriorityLevel(true, HABIT_HIGH, SWATCH_SETS) !== 'high') throw new Error('habit-tracker High');
        if (toPriorityLevel(true, '#1abc9c', SWATCH_SETS) !== 'low') throw new Error('teal → low (measured in the plan)');
        if (toPriorityLevel(true, '#ff8c00', SWATCH_SETS) !== 'medium') throw new Error('orange → medium');
        if (toPriorityLevel(true, '#3498db', SWATCH_SETS) !== 'high') throw new Error('blue → high');
        if (toPriorityLevel(true, null, SWATCH_SETS) !== 'high') throw new Error('flagged, no colour → high');
        if (toPriorityLevel(false, '#dc3545', SWATCH_SETS) !== null) throw new Error('unflagged → null whatever the colour');
    });

    await test('convertPriority writes a level on every copy and removes the 2.5 fields', () => {
        const doc = convertPriority(fixture25(), SWATCH_SETS);
        const r = doc.data.cycles['Morning Routine'];
        const levels = r.tasks.map(t => t.priority);
        if (levels.join(',') !== 'high,low,high,') throw new Error(`task levels ${JSON.stringify(levels)}`);
        if (r.recurringTemplates.t3.priority !== 'medium') throw new Error('template level');
        if (r.clearedTasks.entries[0].priority !== 'low') throw new Error('cleared entry level');
        if (r.history.events[0].details.priority !== 'medium') throw new Error('history detail level');
        if ('priorityColor' in r.history.events[1].details) throw new Error('an event without a colour must not gain one');
        for (const rec of [...r.tasks, r.recurringTemplates.t3]) {
            if ('highPriority' in rec || 'priorityColor' in rec) throw new Error(`2.5 fields survived on ${rec.id}`);
        }
        if ('wasHighPriority' in r.clearedTasks.entries[0] || 'priorityColor' in r.clearedTasks.entries[0]) throw new Error('cleared entry kept 2.5 fields');
        if (doc.settings.defaultPriority !== 'medium' || 'priorityColor' in doc.settings) throw new Error(`settings ${JSON.stringify(doc.settings)}`);
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🏷️ Step 4 — rename keys</h4>';

    await test('data.cycles → data.routine, activeCycleId → activeRoutineId, totalCyclesCreated → totalRoutinesCreated; completion counts keep their names', () => {
        const doc = renameRoutineKeys(fixture25());
        if (!doc.data.routine || 'cycles' in doc.data) throw new Error('map not renamed');
        if (doc.appState.activeRoutineId !== 'Morning Routine' || 'activeCycleId' in doc.appState) throw new Error('active id not renamed');
        if (doc.metadata.totalRoutinesCreated !== 2 || 'totalCyclesCreated' in doc.metadata) throw new Error('metadata count not renamed');
        if (doc.metadata.totalCyclesCompleted !== 7 || doc.userProgress.cyclesCompleted !== 7 || doc.data.routine['Morning Routine'].cycleCount !== 5) {
            throw new Error('completion counts must keep their names');
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🔢 Step 5 + the whole</h4>';

    await test('stampVersion sets both version stamps, migratedFrom and migrationDate', () => {
        const doc = stampVersion(fixture25(), now);
        if (doc.schemaVersion !== '2.6' || doc.metadata.schemaVersion !== '2.6') throw new Error('version stamps');
        if (doc.metadata.migratedFrom !== '2.5' || doc.metadata.migrationDate !== now()) throw new Error('migration metadata');
    });

    await test('the whole migration: 2.5 in, a complete 2.6 document out, input untouched', () => {
        seq = 0;
        const input = fixture25();
        const before = JSON.stringify(input);
        const out = migrate(input);
        if (JSON.stringify(input) !== before) throw new Error('the input document was mutated');
        if (out.schemaVersion !== '2.6') throw new Error('not 2.6');
        const r = out.data.routine['routine-1'];
        if (!r || r.title !== 'Morning Routine' || out.appState.activeRoutineId !== 'routine-1') throw new Error('re-key + rename disagree');
        if (r.tasks[0].priority !== 'high' || r.tasks[0].autoClear.todo !== true) throw new Error('task not fully converted');
        if ('cycles' in out.data || 'activeCycleId' in out.appState) throw new Error('2.5 keys survived');
        const text = JSON.stringify(out);
        for (const gone of ['deleteWhenComplete', 'highPriority', 'wasHighPriority', 'priorityColor']) {
            if (text.includes(`"${gone}"`)) throw new Error(`"${gone}" survived somewhere in the document`);
        }
    });

    await test('a 2.6 document is returned unchanged (idempotent), and a non-2.5 document is refused', () => {
        seq = 0;
        const once = migrate(fixture25());
        const twice = migrate(once);
        if (JSON.stringify(twice) !== JSON.stringify(once)) throw new Error('migrating twice changed the document');
        if (twice === once) throw new Error('must return a clone, not the same object');
        let threw = false;
        try { migrate({ schemaVersion: '2.4', data: { cycles: {} } }); } catch { threw = true; }
        if (!threw) throw new Error('an older document must be refused, not guessed at');
        threw = false;
        try { migrateSchema_2_5_to_2_6(fixture25(), { now }); } catch { threw = true; }
        if (!threw) throw new Error('makeId is required');
    });

    await test('an empty 2.5 document (brand-new user) migrates to an empty 2.6 one', () => {
        const out = migrate({ schemaVersion: '2.5', metadata: { totalCyclesCreated: 0 }, settings: {}, data: { cycles: {} }, appState: { activeCycleId: null }, userProgress: {}, customReminders: {} });
        if (Object.keys(out.data.routine).length !== 0 || out.appState.activeRoutineId !== null) throw new Error(JSON.stringify(out));
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🔑 2.6 repair — routine keys</h4>';

    // A 2.6 document as creation/import/rename left it before Nov 2026: id-keyed
    // routines next to title-keyed ones.
    const fixtureMixed = () => ({
        schemaVersion: '2.6',
        data: { routine: {
            'routine-1-a': { id: 'routine-1-a', title: 'Already fine', tasks: [{ id: 't1', text: 'keep' }] },
            'Morning': { id: 'cycle_100', title: 'Morning', tasks: [{ id: 't2', text: 'wake' }] },
            'Renamed Later': { id: 'routine-2-b', title: 'Renamed Later', tasks: [] }
        } },
        appState: { activeRoutineId: 'Morning' }
    });

    await test('isRoutineKeyedById: only key === id counts', () => {
        if (!isRoutineKeyedById('routine-1', { id: 'routine-1' })) throw new Error('id-keyed rejected');
        if (isRoutineKeyedById('Morning', { id: 'cycle_1', title: 'Morning' })) throw new Error('title-keyed accepted');
        if (isRoutineKeyedById('x', { title: 'x' })) throw new Error('missing id accepted');
    });

    await test('a title-keyed routine is filed under its own id; id-keyed routines are untouched', () => {
        const doc = fixtureMixed();
        const map = repairRoutineKeys(doc, () => 'unused');
        const keys = Object.keys(doc.data.routine);
        if (keys.join(',') !== 'routine-1-a,cycle_100,routine-2-b') throw new Error(`keys/order ${keys.join(',')}`);
        if (JSON.stringify(map) !== JSON.stringify([['Morning', 'cycle_100'], ['Renamed Later', 'routine-2-b']])) throw new Error(`map ${JSON.stringify(map)}`);
        if (!Object.entries(doc.data.routine).every(([k, r]) => r.id === k)) throw new Error('a key still differs from its id');
        if (doc.data.routine.cycle_100.tasks[0].text !== 'wake' || doc.data.routine.cycle_100.title !== 'Morning') throw new Error('routine content changed');
    });

    await test('the active routine id follows its routine', () => {
        const doc = fixtureMixed();
        repairRoutineKeys(doc, () => 'unused');
        if (doc.appState.activeRoutineId !== 'cycle_100') throw new Error(`active ${doc.appState.activeRoutineId}`);
    });

    await test('an unusable id (missing, duplicate, not id-shaped, a prototype name) gets a fresh key', () => {
        let n = 0;
        const doc = { data: { routine: {
            'routine-1-a': { id: 'routine-1-a', title: 'A' },
            'No Id': { title: 'No Id' },
            'Dup': { id: 'routine-1-a', title: 'Dup' },
            'Spaced': { id: 'has space', title: 'Spaced' },
            'Proto': { id: '__proto__', title: 'Proto' }
        } }, appState: { activeRoutineId: 'routine-1-a' } };
        const map = repairRoutineKeys(doc, () => `routine-new-${++n}`);
        if (map.map(([, k]) => k).join(',') !== 'routine-new-1,routine-new-2,routine-new-3,routine-new-4') throw new Error(`new keys ${JSON.stringify(map)}`);
        if (Object.getPrototypeOf(doc.data.routine) !== Object.prototype) throw new Error('prototype changed');
        if (Object.keys(doc.data.routine).length !== 5) throw new Error('a routine was merged or dropped');
        if (doc.appState.activeRoutineId !== 'routine-1-a') throw new Error('an untouched active id moved');
    });

    await test('a collision with an existing key is retried, never merged', () => {
        const ids = ['routine-1-a', 'routine-1-a', 'fresh'];
        let i = 0;
        const doc = { data: { routine: { 'routine-1-a': { id: 'routine-1-a', title: 'A' }, 'B': { title: 'B' } } }, appState: {} };
        repairRoutineKeys(doc, () => ids[i++]);
        if (Object.keys(doc.data.routine).join(',') !== 'routine-1-a,fresh') throw new Error(Object.keys(doc.data.routine).join(','));
    });

    await test('a missing title falls back to the old key, so no name is lost', () => {
        const doc = { data: { routine: { 'Evening': { tasks: [] } } }, appState: {} };
        repairRoutineKeys(doc, () => 'routine-9');
        if (doc.data.routine['routine-9'].title !== 'Evening') throw new Error(JSON.stringify(doc.data.routine));
    });

    await test('running the repair twice changes nothing; a clean document is left as it is', () => {
        const doc = fixtureMixed();
        repairRoutineKeys(doc, () => 'unused');
        const once = JSON.stringify(doc);
        const second = repairRoutineKeys(doc, () => { throw new Error('makeId must not be called'); });
        if (second.length !== 0 || JSON.stringify(doc) !== once) throw new Error('second run changed the document');
        const clean = { data: { routine: { 'r-1': { id: 'r-1' } } }, appState: { activeRoutineId: 'r-1' } };
        const routinesBefore = clean.data.routine;
        repairRoutineKeys(clean, () => 'x');
        if (clean.data.routine !== routinesBefore) throw new Error('a clean map was rebuilt');
    });

    await test('a 2.5 document migrated to 2.6 needs no repair (the migration already keys by id)', () => {
        seq = 0;
        const out = migrate(fixture25());
        if (repairRoutineKeys(out, makeId).length !== 0) throw new Error('migration output was not id-keyed');
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    resultsDiv.innerHTML += passed.count === total.count ? '<div class="result pass">✅ All tests passed!</div>' : `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    return { passed: passed.count, total: total.count };
}
