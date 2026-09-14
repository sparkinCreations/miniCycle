/**
 * PriorityLevel Tests
 * Tests for modules/utils/priorityLevel.js — priority as high / medium / low while
 * Schema 2.5 stores highPriority + a priorityColor hex.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runPriorityLevelTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/priorityLevel.js?v=${cacheBuster}`);
    const { normalizePriorityHex, isPriorityLevel, getPrioritySwatches, collectSwatchSets,
            getLevelForHex, getLevelForColorFamily, getPriorityLevel, getPriorityColor, setPriorityLevel, comparePriority } = mod;
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

    // ── getPriorityLevel ─────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📶 getPriorityLevel</h4>';

    await test('a task without priority has no level, even if it remembers a colour', () => {
        if (getPriorityLevel({ highPriority: false, priorityColor: '#facc15' }, allSets) !== null) {
            throw new Error('unflagged task should be null');
        }
        if (getPriorityLevel(null, allSets) !== null) throw new Error('null task');
    });

    await test('a flagged task with no colour is high — on/off priority has always meant high', () => {
        if (getPriorityLevel({ highPriority: true }, allSets) !== 'high') throw new Error('expected high');
        if (getPriorityLevel({ highPriority: true, priorityColor: null }, allSets) !== 'high') throw new Error('null colour');
    });

    await test('swatch colours map to their level, from the defaults and from any theme', () => {
        if (getPriorityLevel({ highPriority: true, priorityColor: '#facc15' }, allSets) !== 'medium') throw new Error('default yellow');
        if (getPriorityLevel({ highPriority: true, priorityColor: '#1a5c2e' }, allSets) !== 'low') throw new Error('habit-tracker green');
        if (getPriorityLevel({ highPriority: true, priorityColor: '#C0392B' }, allSets) !== 'high') throw new Error('fitness red, upper case');
    });

    await test('a custom, non-swatch colour takes the level of its colour family', () => {
        // The .mcyc schema allows any hex. A green that is not a swatch (the old
        // fitness preset, #1e8c52) is still green — Low — not High.
        if (getPriorityLevel({ highPriority: true, priorityColor: '#1e8c52' }, allSets) !== 'low') {
            throw new Error('a non-swatch green should be Low by colour family');
        }
        if (getPriorityLevel({ highPriority: true, priorityColor: '#ff8c00' }, allSets) !== 'medium') {
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

    await test('a swatch colour follows the current theme', () => {
        // Picked "red" in habit-tracker (#8b1a1a); now shown in fitness.
        const task = { highPriority: true, priorityColor: '#8b1a1a' };
        if (getPriorityColor(task, fitness, allSets) !== '#c0392b') {
            throw new Error(`expected fitness red, got ${getPriorityColor(task, fitness, allSets)}`);
        }
        const medium = { highPriority: true, priorityColor: '#b8860b' };
        if (getPriorityColor(medium, classic, allSets) !== '#facc15') throw new Error('fitness yellow in classic');
        if (getPriorityColor(medium, habit, allSets) !== '#7a4d00') throw new Error('fitness yellow in habit-tracker');
    });

    await test('a custom colour shows its family level in the current theme, never as stored', () => {
        // A hand-written green shows the theme's Low swatch; an olive its Medium.
        if (getPriorityColor({ highPriority: true, priorityColor: '#1E8C52' }, fitness, allSets) !== '#27ae60') {
            throw new Error('custom green should show the fitness Low swatch');
        }
        if (getPriorityColor({ highPriority: true, priorityColor: '#808000' }, habit, allSets) !== '#7a4d00') {
            throw new Error('custom olive should show the habit-tracker Medium swatch');
        }
    });

    await test('a flagged task with no colour shows the current theme\'s High', () => {
        if (getPriorityColor({ highPriority: true }, habit, allSets) !== '#8b1a1a') throw new Error('habit high');
        if (getPriorityColor({ highPriority: true }, null, allSets) !== COLORS.PRIORITY_DEFAULT) throw new Error('default high');
    });

    await test('an unflagged task has no display colour', () => {
        if (getPriorityColor({ highPriority: false, priorityColor: '#dc3545' }, fitness, allSets) !== null) {
            throw new Error('expected null');
        }
    });

    // ── setPriorityLevel ─────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✏️ setPriorityLevel</h4>';

    await test('setting a level flags the task and stores that theme\'s swatch', () => {
        const task = { id: 't1', highPriority: false, priorityColor: null };
        if (setPriorityLevel(task, 'medium', fitness) !== true) throw new Error('should report success');
        if (task.highPriority !== true) throw new Error('not flagged');
        if (task.priorityColor !== '#b8860b') throw new Error(`stored ${task.priorityColor}`);
        if (getPriorityLevel(task, allSets) !== 'medium') throw new Error('round trip');
    });

    await test('null turns priority off and keeps the colour, like the task toggle', () => {
        const task = { highPriority: true, priorityColor: '#28a745' };
        setPriorityLevel(task, null, classic);
        if (task.highPriority !== false) throw new Error('still flagged');
        if (task.priorityColor !== '#28a745') throw new Error('colour should be kept');
    });

    await test('an unknown level writes nothing', () => {
        const task = { highPriority: false, priorityColor: null };
        if (setPriorityLevel(task, 'urgent', fitness) !== false) throw new Error('should report failure');
        if (task.highPriority !== false || task.priorityColor !== null) throw new Error('task was changed');
        if (setPriorityLevel(null, 'high', fitness) !== false) throw new Error('null task');
    });

    await test('setPriorityLevel only writes the stored field names', () => {
        const task = { id: 't1' };
        setPriorityLevel(task, 'low', habit);
        const keys = Object.keys(task).sort();
        if (JSON.stringify(keys) !== JSON.stringify(['highPriority', 'id', 'priorityColor'])) {
            throw new Error(`unexpected keys ${JSON.stringify(keys)}`);
        }
    });

    // ── comparePriority ──────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">↕️ comparePriority</h4>';

    await test('sorts high, then medium, then low, then no priority — keeping order within a level', () => {
        const tasks = [
            { id: 'none', highPriority: false },
            { id: 'low', highPriority: true, priorityColor: '#27ae60' },
            { id: 'high-1', highPriority: true, priorityColor: '#8b1a1a' },
            { id: 'medium', highPriority: true, priorityColor: '#facc15' },
            { id: 'high-2', highPriority: true }
        ];
        const order = [...tasks].sort((a, b) => comparePriority(a, b, allSets)).map(t => t.id);
        const expected = ['high-1', 'high-2', 'medium', 'low', 'none'];
        if (JSON.stringify(order) !== JSON.stringify(expected)) {
            throw new Error(`got ${JSON.stringify(order)}`);
        }
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
