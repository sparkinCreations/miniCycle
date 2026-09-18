/**
 * PriorityLevel Tests
 * Tests for modules/utils/priorityLevel.js — priority as a stored LEVEL
 * (`task.priority`, Schema 2.6) plus the 2.5 readers the migration and importer keep.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runPriorityLevelTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/priorityLevel.js?v=${cacheBuster}`);
    const { normalizePriorityHex, isPriorityLevel, getPrioritySwatches, collectSwatchSets,
            getLevelForHex, getLevelForColorFamily, getPriorityLevel, getLegacyPriorityLevel,
            getPriorityColor, setPriorityLevel, comparePriority,
            hasPriority, priorityFields, getLastPriorityLevel, getLevelForColor, getLevelColor,
            getDefaultPriorityLevel, setDefaultPriorityLevel } = mod;
    const { PRIORITY_LEVELS, DEFAULT_PRIORITY_SWATCHES, COLORS } =
        await import(`../modules/core/constants.js?v=${cacheBuster}`);
    const { THEME_DEFINITIONS } = await import(`../modules/labels/themes.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>PriorityLevel Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const themeById = (id) => Object.values(THEME_DEFINITIONS).find(t => t?.id === id);
    const allSets = collectSwatchSets(THEME_DEFINITIONS);
    const habit = getPrioritySwatches(themeById('habit-tracker'));
    const fitness = getPrioritySwatches(themeById('fitness'));
    const classic = getPrioritySwatches(themeById('classic'));

    // ── Swatch data ──────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Swatch data</h4>';

    await test('PRIORITY_LEVELS is high, medium, low — in sort order', () => {
        if (JSON.stringify([...PRIORITY_LEVELS]) !== JSON.stringify(['high', 'medium', 'low'])) {
            throw new Error(`got ${JSON.stringify(PRIORITY_LEVELS)}`);
        }
    });

    await test('default swatches keep the picker\'s original colours, with High = COLORS.PRIORITY_DEFAULT', () => {
        // These moved out of a hardcoded list in notifications.js — pin the values.
        const byLevel = Object.fromEntries(DEFAULT_PRIORITY_SWATCHES.map(s => [s.level, s.hex]));
        if (byLevel.high !== COLORS.PRIORITY_DEFAULT) throw new Error(`high ${byLevel.high}`);
        if (byLevel.high !== '#dc3545' || byLevel.medium !== '#facc15' || byLevel.low !== '#28a745') {
            throw new Error(`default swatches changed: ${JSON.stringify(byLevel)}`);
        }
    });

    await test('every theme with swatches defines high, medium and low exactly once', () => {
        const themed = Object.values(THEME_DEFINITIONS).filter(t => Array.isArray(t?.priorityColors));
        if (themed.length === 0) throw new Error('no themes with priorityColors found — fixture is wrong');
        for (const theme of themed) {
            const levels = theme.priorityColors.map(s => s.level).sort();
            if (JSON.stringify(levels) !== JSON.stringify(['high', 'low', 'medium'])) {
                throw new Error(`${theme.id} levels: ${JSON.stringify(levels)}`);
            }
            for (const swatch of theme.priorityColors) {
                if (!normalizePriorityHex(swatch.hex)) throw new Error(`${theme.id} has an invalid hex ${swatch.hex}`);
            }
        }
    });

    await test('no colour belongs to two different levels across all themes', () => {
        // If a hex meant "high" in one theme and "low" in another, a stored colour
        // could not be mapped back to a level.
        const seen = {};
        for (const set of [DEFAULT_PRIORITY_SWATCHES, ...allSets]) {
            for (const swatch of set) {
                const hex = normalizePriorityHex(swatch.hex);
                if (seen[hex] && seen[hex] !== swatch.level) {
                    throw new Error(`${hex} is both ${seen[hex]} and ${swatch.level}`);
                }
                seen[hex] = swatch.level;
            }
        }
    });

    await test('getPrioritySwatches uses a theme\'s own set, or the defaults for classic', () => {
        if (fitness !== themeById('fitness').priorityColors) throw new Error('fitness should use its own set');
        // Compare the defaults by VALUE, not identity: priorityLevel.js imports
        // constants.js without ?v=, this file imports it with ?v=, and in dev those
        // are two module instances — equal arrays, different objects.
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        if (!same(classic, DEFAULT_PRIORITY_SWATCHES)) throw new Error('classic should use the defaults');
        if (!same(getPrioritySwatches(null), DEFAULT_PRIORITY_SWATCHES)) throw new Error('null theme should use the defaults');
    });

    await test('collectSwatchSets returns one set per theme that has swatches', () => {
        const expected = Object.values(THEME_DEFINITIONS).filter(t => Array.isArray(t?.priorityColors)).length;
        if (allSets.length !== expected) throw new Error(`expected ${expected} sets, got ${allSets.length}`);
        if (collectSwatchSets(null).length !== 0) throw new Error('null should give no sets');
    });

    // ── normalizePriorityHex / isPriorityLevel ───────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔡 Normalising</h4>';

    await test('normalizePriorityHex lower-cases, expands shorthand, and rejects non-hex', () => {
        if (normalizePriorityHex('#DC3545') !== '#dc3545') throw new Error('upper case');
        if (normalizePriorityHex('#AbC') !== '#aabbcc') throw new Error('shorthand');
        if (normalizePriorityHex('  #28a745 ') !== '#28a745') throw new Error('whitespace');
        for (const bad of ['red', '#12345', '#ggg', '', null, undefined, 42]) {
            if (normalizePriorityHex(bad) !== null) throw new Error(`accepted ${JSON.stringify(bad)}`);
        }
    });

    await test('isPriorityLevel accepts only the three levels', () => {
        for (const good of ['high', 'medium', 'low']) if (!isPriorityLevel(good)) throw new Error(good);
        for (const bad of ['urgent', 'High', '', null, undefined, 1]) {
            if (isPriorityLevel(bad)) throw new Error(`accepted ${JSON.stringify(bad)}`);
        }
    });

    // ── getPriorityLevel (2.6) ───────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📶 getPriorityLevel</h4>';

    await test('reads the stored level, and only a known level', () => {
        for (const level of PRIORITY_LEVELS) {
            if (getPriorityLevel({ priority: level }) !== level) throw new Error(`${level} not read`);
        }
        if (getPriorityLevel({ priority: null }) !== null) throw new Error('null level');
        if (getPriorityLevel({}) !== null) throw new Error('missing level');
        if (getPriorityLevel(null) !== null) throw new Error('null task');
        // A hand-edited file cannot invent a fourth level.
        for (const bad of ['urgent', 'High', true, 1, '']) {
            if (getPriorityLevel({ priority: bad }) !== null) throw new Error(`accepted ${JSON.stringify(bad)}`);
        }
    });

    await test('the retired 2.5 pair is NOT read — an unmigrated record has no priority', () => {
        if (getPriorityLevel({ highPriority: true, priorityColor: '#dc3545' }) !== null) {
            throw new Error('2.5 fields must not be consulted by the 2.6 reader');
        }
    });

    // ── getLegacyPriorityLevel (2.5 records: migration + import) ─────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📶 getLegacyPriorityLevel</h4>';

    await test('a 2.5 record without the flag has no level, even if it remembers a colour', () => {
        if (getLegacyPriorityLevel({ highPriority: false, priorityColor: '#facc15' }, allSets) !== null) {
            throw new Error('unflagged record should be null');
        }
        if (getLegacyPriorityLevel(null, allSets) !== null) throw new Error('null record');
    });

    await test('a flagged 2.5 record with no colour is high — on/off priority always meant high', () => {
        if (getLegacyPriorityLevel({ highPriority: true }, allSets) !== 'high') throw new Error('expected high');
        if (getLegacyPriorityLevel({ highPriority: true, priorityColor: null }, allSets) !== 'high') throw new Error('null colour');
    });

    await test('swatch colours map to their level, from the defaults and from any theme', () => {
        if (getLegacyPriorityLevel({ highPriority: true, priorityColor: '#facc15' }, allSets) !== 'medium') throw new Error('default yellow');
        if (getLegacyPriorityLevel({ highPriority: true, priorityColor: '#1a5c2e' }, allSets) !== 'low') throw new Error('habit-tracker green');
        if (getLegacyPriorityLevel({ highPriority: true, priorityColor: '#C0392B' }, allSets) !== 'high') throw new Error('fitness red, upper case');
    });

    await test('a custom, non-swatch colour takes the level of its colour family', () => {
        // The .mcyc schema allows any hex. A green that is not a swatch (the old
        // fitness preset, #1e8c52) is still green — Low — not High.
        if (getLegacyPriorityLevel({ highPriority: true, priorityColor: '#1e8c52' }, allSets) !== 'low') {
            throw new Error('a non-swatch green should be Low by colour family');
        }
        if (getLegacyPriorityLevel({ highPriority: true, priorityColor: '#ff8c00' }, allSets) !== 'medium') {
            throw new Error('a non-swatch orange should be Medium by colour family');
        }
    });

    // ── getLevelForColorFamily ───────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🌈 getLevelForColorFamily</h4>';

    await test('maps the measured custom colours to their families (pinned)', () => {
        // Decided Sep 2026 over nearest-colour, which mapped navy → High via a dark
        // red swatch and gray/black/white → Low. These are the measured outcomes.
        const expected = {
            '#ff69b4': 'high',   // pink
            '#800000': 'high',   // maroon
            '#ff8c00': 'medium', // orange
            '#daa520': 'medium', // gold
            '#808000': 'medium', // olive
            '#9acd32': 'medium', // lime
            '#1abc9c': 'low',    // teal
            '#3498db': 'high',   // blue — no family
            '#8e44ad': 'high',   // purple — no family
            '#1f3a93': 'high',   // navy — no family
            '#808080': 'high',   // gray — no clear colour
            '#000000': 'high',   // black — no clear colour
            '#ffffff': 'high'    // white — no clear colour
        };
        for (const [hex, want] of Object.entries(expected)) {
            const got = getLevelForColorFamily(hex);
            if (got !== want) throw new Error(`${hex} → ${got}, expected ${want}`);
        }
    });

    await test('every real swatch classifies to its own level by hue alone', () => {
        // Rule 1 (exact match) and rule 3 (hue family) must never disagree today.
        for (const set of [DEFAULT_PRIORITY_SWATCHES, ...allSets]) {
            for (const swatch of set) {
                const got = getLevelForColorFamily(swatch.hex);
                if (got !== swatch.level) throw new Error(`swatch ${swatch.hex} is ${swatch.level} but hue says ${got}`);
            }
        }
    });

    await test('getLevelForColorFamily returns null only for a non-colour', () => {
        for (const bad of ['red', '', null, undefined, '#12345']) {
            if (getLevelForColorFamily(bad) !== null) throw new Error(`expected null for ${JSON.stringify(bad)}`);
        }
        if (getLevelForColorFamily('#ABC') === null) throw new Error('shorthand hex is a colour');
    });

    await test('getLevelForHex knows the defaults even with no theme sets passed', () => {
        if (getLevelForHex('#28a745') !== 'low') throw new Error('default green without sets');
        if (getLevelForHex('#1a5c2e') !== null) throw new Error('a theme-only colour needs its set');
    });

    // ── getPriorityColor ─────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🖌️ getPriorityColor</h4>';

    await test('a level shows the current theme\'s swatch for it', () => {
        if (getPriorityColor({ priority: 'high' }, fitness) !== '#c0392b') throw new Error('fitness high');
        if (getPriorityColor({ priority: 'medium' }, classic) !== '#facc15') throw new Error('classic medium');
        if (getPriorityColor({ priority: 'medium' }, habit) !== '#7a4d00') throw new Error('habit-tracker medium');
        if (getPriorityColor({ priority: 'low' }, fitness) !== '#27ae60') throw new Error('fitness low');
    });

    await test('no swatch set means the defaults', () => {
        if (getPriorityColor({ priority: 'high' }, null) !== COLORS.PRIORITY_DEFAULT) throw new Error('default high');
        if (getPriorityColor({ priority: 'low' }, []) !== '#28a745') throw new Error('default low');
    });

    await test('a task without a level has no display colour', () => {
        if (getPriorityColor({ priority: null }, fitness) !== null) throw new Error('null level');
        if (getPriorityColor({ highPriority: true, priorityColor: '#dc3545' }, fitness) !== null) throw new Error('2.5 fields must not paint');
    });

    // ── setPriorityLevel ─────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✏️ setPriorityLevel</h4>';

    await test('setting a level stores it and round-trips', () => {
        const task = { id: 't1', priority: null };
        if (setPriorityLevel(task, 'medium') !== true) throw new Error('should report success');
        if (task.priority !== 'medium') throw new Error(`stored ${task.priority}`);
        if (getPriorityLevel(task) !== 'medium') throw new Error('round trip');
    });

    await test('null turns priority off', () => {
        const task = { priority: 'low' };
        setPriorityLevel(task, null);
        if (task.priority !== null) throw new Error('still set');
        setPriorityLevel(task, undefined);
        if (task.priority !== null) throw new Error('undefined should also turn it off');
    });

    await test('an unknown level writes nothing', () => {
        const task = { priority: null };
        if (setPriorityLevel(task, 'urgent') !== false) throw new Error('should report failure');
        if (task.priority !== null) throw new Error('task was changed');
        if (setPriorityLevel(null, 'high') !== false) throw new Error('null task');
    });

    await test('setPriorityLevel writes priority and nothing else — never the 2.5 pair', () => {
        const task = { id: 't1' };
        setPriorityLevel(task, 'low');
        const keys = Object.keys(task).sort();
        if (JSON.stringify(keys) !== JSON.stringify(['id', 'priority'])) throw new Error(`unexpected keys ${JSON.stringify(keys)}`);
    });

    // ── comparePriority ──────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">↕️ comparePriority</h4>';

    await test('sorts high, then medium, then low, then no priority — keeping order within a level', () => {
        const tasks = [
            { id: 'none', priority: null },
            { id: 'low', priority: 'low' },
            { id: 'high-1', priority: 'high' },
            { id: 'medium', priority: 'medium' },
            { id: 'high-2', priority: 'high' }
        ];
        const order = [...tasks].sort((a, b) => comparePriority(a, b)).map(t => t.id);
        const expected = ['high-1', 'high-2', 'medium', 'low', 'none'];
        if (JSON.stringify(order) !== JSON.stringify(expected)) {
            throw new Error(`got ${JSON.stringify(order)}`);
        }
    });

    // ── record helpers (priority reader sweep) ───────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📋 record helpers</h4>';

    await test('hasPriority is the on/off read of the stored level', () => {
        if (hasPriority({ priority: 'low' }) !== true) throw new Error('a level counts');
        if (hasPriority({ priority: null }) !== false) throw new Error('null level');
        if (hasPriority({ priority: 'urgent' }) !== false) throw new Error('unknown level must not count');
        if (hasPriority({ highPriority: true }) !== false) throw new Error('the 2.5 flag must not count');
        if (hasPriority(null) !== false) throw new Error('null task');
    });

    await test('priorityFields copies the stored level, normalised, and nothing else', () => {
        const copy = priorityFields({ id: 't1', priority: 'medium', text: 'x' });
        if (JSON.stringify(copy) !== JSON.stringify({ priority: 'medium' })) throw new Error(JSON.stringify(copy));
        if (priorityFields({}).priority !== null) throw new Error('missing level should copy as null');
        if (priorityFields(undefined).priority !== null) throw new Error('missing source');
        if (priorityFields({ priority: 'urgent' }).priority !== null) throw new Error('unknown level should copy as null');
        if (Object.keys(priorityFields({ priority: 'high' })).join(',') !== 'priority') throw new Error('extra keys');
    });

    await test('getLastPriorityLevel is the current level — a task switched off remembers nothing', () => {
        if (getLastPriorityLevel({ priority: 'medium' }) !== 'medium') throw new Error('level not read');
        if (getLastPriorityLevel({ priority: null }) !== null) throw new Error('off should be null');
        if (getLastPriorityLevel({ highPriority: false, priorityColor: '#facc15' }) !== null) throw new Error('a 2.5 colour is not a memory');
    });

    await test('getLevelForColor: swatch, then family, then high', () => {
        if (getLevelForColor(fitness.find(s => s.level === 'medium').hex, allSets) !== 'medium') throw new Error('swatch');
        if (getLevelForColor('#2ecc71', allSets) !== 'low') throw new Error('green family should be low');
        if (getLevelForColor('not-a-colour', allSets) !== 'high') throw new Error('garbage should be high');
    });

    await test('getLevelColor returns the set\'s hex for a level and null for an unknown level', () => {
        if (getLevelColor('medium', habit) !== habit.find(s => s.level === 'medium').hex) throw new Error('habit medium');
        if (getLevelColor('high', null) !== COLORS.PRIORITY_DEFAULT) throw new Error('defaults when no set');
        if (getLevelColor('urgent', habit) !== null) throw new Error('unknown level should be null');
    });

    await test('getDefaultPriorityLevel reads settings.defaultPriority, high when none or unknown', () => {
        if (getDefaultPriorityLevel({ defaultPriority: 'medium' }) !== 'medium') throw new Error('stored default ignored');
        if (getDefaultPriorityLevel({}) !== 'high') throw new Error('no default should be high');
        if (getDefaultPriorityLevel(null) !== 'high') throw new Error('null settings should be high');
        if (getDefaultPriorityLevel({ defaultPriority: 'urgent' }) !== 'high') throw new Error('unknown level should be high');
        if (getDefaultPriorityLevel({ priorityColor: '#facc15' }) !== 'high') throw new Error('the 2.5 colour must not be read');
    });

    await test('setDefaultPriorityLevel writes settings.defaultPriority and nothing else', () => {
        const settings = { theme: 'x' };
        if (!setDefaultPriorityLevel(settings, 'low')) throw new Error('refused a valid level');
        if (settings.defaultPriority !== 'low') throw new Error(`wrote ${settings.defaultPriority}`);
        if (Object.keys(settings).sort().join(',') !== 'defaultPriority,theme') throw new Error('extra keys written');
        if (setDefaultPriorityLevel(settings, 'urgent')) throw new Error('accepted an unknown level');
        if (setDefaultPriorityLevel(null, 'low')) throw new Error('accepted missing settings');
        if (getDefaultPriorityLevel(settings) !== 'low') throw new Error('did not round-trip');
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
