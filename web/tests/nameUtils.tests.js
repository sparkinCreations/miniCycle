/**
 * NameUtils Tests
 * Tests for modules/utils/nameUtils.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runNameUtilsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/nameUtils.js?v=${cacheBuster}`);
    const { getUniqueCycleName, cycleNameExists } = mod;

    resultsDiv.innerHTML = '<h2>NameUtils Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('getUniqueCycleName is an exported function', () => {
        if (typeof getUniqueCycleName !== 'function') {
            throw new Error(`Expected function, got ${typeof getUniqueCycleName}`);
        }
    });

    await test('cycleNameExists is an exported function', () => {
        if (typeof cycleNameExists !== 'function') {
            throw new Error(`Expected function, got ${typeof cycleNameExists}`);
        }
    });

    // ── cycleNameExists ──────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔍 cycleNameExists</h4>';

    await test('returns false for empty cycles', () => {
        if (cycleNameExists('Test', {}) !== false) throw new Error('expected false');
    });

    await test('returns false when default arg (no cycles passed)', () => {
        if (cycleNameExists('Test') !== false) throw new Error('expected false');
    });

    await test('returns true when name is a key', () => {
        if (cycleNameExists('Morning', { 'Morning': {} }) !== true) throw new Error('expected true');
    });

    await test('returns false when name is not a key', () => {
        if (cycleNameExists('Evening', { 'Morning': {} }) !== false) throw new Error('expected false');
    });

    await test('always returns a boolean (coerces truthy value via !!)', () => {
        const r = cycleNameExists('Morning', { 'Morning': { id: 'x' } });
        if (typeof r !== 'boolean') throw new Error('expected boolean, got ' + typeof r);
        if (r !== true) throw new Error('expected true');
    });

    await test('falsy stored value (0) still counts as not-existing', () => {
        // existingCycles['X'] === 0 is falsy → !!0 === false
        if (cycleNameExists('X', { 'X': 0 }) !== false) throw new Error('expected false for falsy value');
    });

    await test('is case-sensitive', () => {
        if (cycleNameExists('morning', { 'Morning': {} }) !== false) throw new Error('should be case-sensitive');
    });

    // ── getUniqueCycleName: unmodified path ──────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✨ getUniqueCycleName — new name</h4>';

    await test('returns name unchanged when it does not exist', () => {
        const r = getUniqueCycleName('My Routine', {});
        if (r.name !== 'My Routine') throw new Error(`got "${r.name}"`);
        if (r.wasModified !== false) throw new Error('wasModified should be false');
    });

    await test('shape: returns { name: string, wasModified: boolean }', () => {
        const r = getUniqueCycleName('Solo', {});
        if (typeof r !== 'object' || !r) throw new Error('not an object');
        if (typeof r.name !== 'string') throw new Error('name not string');
        if (typeof r.wasModified !== 'boolean') throw new Error('wasModified not boolean');
    });

    await test('works with default existingCycles arg', () => {
        const r = getUniqueCycleName('Alone');
        if (r.name !== 'Alone' || r.wasModified !== false) throw new Error('default arg failed');
    });

    // ── getUniqueCycleName: numbered variations ──────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔢 getUniqueCycleName — collisions</h4>';

    await test('appends (2) on first collision', () => {
        const r = getUniqueCycleName('Routine', { 'Routine': {} });
        if (r.name !== 'Routine (2)') throw new Error(`got "${r.name}"`);
        if (r.wasModified !== true) throw new Error('wasModified should be true');
    });

    await test('skips to (3) when (2) is also taken', () => {
        const r = getUniqueCycleName('Routine', { 'Routine': {}, 'Routine (2)': {} });
        if (r.name !== 'Routine (3)') throw new Error(`got "${r.name}"`);
        if (r.wasModified !== true) throw new Error('wasModified should be true');
    });

    await test('finds first available gap in the sequence', () => {
        // (2) is free even though base and (3) are taken
        const r = getUniqueCycleName('Routine', { 'Routine': {}, 'Routine (3)': {} });
        if (r.name !== 'Routine (2)') throw new Error(`got "${r.name}"`);
    });

    await test('counter starts at 2, never (1)', () => {
        const r = getUniqueCycleName('X', { 'X': {} });
        if (r.name === 'X (1)') throw new Error('should never produce (1)');
        if (r.name !== 'X (2)') throw new Error(`got "${r.name}"`);
    });

    // ── getUniqueCycleName: maxAttempts boundary + timestamp fallback ─────────
    resultsDiv.innerHTML += '<h4 class="test-section">⏱️ getUniqueCycleName — exhaustion fallback</h4>';

    await test('respects maxAttempts: tries up to (maxAttempts+1) before fallback', () => {
        // maxAttempts=2 → tries (2) and (3); both free → uses (2)
        const r = getUniqueCycleName('R', { 'R': {} }, 2);
        if (r.name !== 'R (2)') throw new Error(`got "${r.name}"`);
    });

    await test('falls back to timestamp when all numbered slots taken', () => {
        // maxAttempts=2 → only checks (2),(3). Fill base,(2),(3) → fallback to timestamp.
        const existing = { 'R': {}, 'R (2)': {}, 'R (3)': {} };
        const before = Date.now();
        const r = getUniqueCycleName('R', existing, 2);
        const after = Date.now();
        if (r.wasModified !== true) throw new Error('wasModified should be true');
        const m = r.name.match(/^R \((\d+)\)$/);
        if (!m) throw new Error(`expected timestamp form, got "${r.name}"`);
        const ts = Number(m[1]);
        // Timestamp must be a large epoch value, not a small counter like 2/3/4
        if (ts < before || ts > after) throw new Error(`timestamp ${ts} outside [${before},${after}]`);
    });

    await test('timestamp fallback name is genuinely unique (not in existing)', () => {
        const existing = { 'R': {}, 'R (2)': {}, 'R (3)': {} };
        const r = getUniqueCycleName('R', existing, 2);
        if (existing[r.name]) throw new Error('fallback name collided with existing');
    });

    await test('default maxAttempts (10) checks (2) through (11)', () => {
        // Fill base + (2)..(11), leave (12) — with default 10, should hit timestamp fallback
        const existing = { 'R': {} };
        for (let i = 2; i <= 11; i++) existing[`R (${i})`] = {};
        const r = getUniqueCycleName('R', existing); // default maxAttempts = 10
        const m = r.name.match(/^R \((\d+)\)$/);
        if (!m || Number(m[1]) <= 11) throw new Error(`expected timestamp fallback, got "${r.name}"`);
    });

    await test('default maxAttempts uses (11) when only (2)..(10) taken', () => {
        const existing = { 'R': {} };
        for (let i = 2; i <= 10; i++) existing[`R (${i})`] = {};
        const r = getUniqueCycleName('R', existing); // default 10 → checks up to (11)
        if (r.name !== 'R (11)') throw new Error(`got "${r.name}"`);
    });

    // ── edge cases ───────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧪 getUniqueCycleName — edge cases</h4>';

    await test('empty-string base name with no collision returns "" unmodified', () => {
        const r = getUniqueCycleName('', {});
        if (r.name !== '' || r.wasModified !== false) throw new Error(`got "${r.name}" / ${r.wasModified}`);
    });

    await test('preserves special characters in base name', () => {
        const r = getUniqueCycleName('Work & Play (daily)', { 'Work & Play (daily)': {} });
        if (r.name !== 'Work & Play (daily) (2)') throw new Error(`got "${r.name}"`);
    });

    // ── Object.prototype key names ───────────────────────────────────────────
    // Routine names land directly as object keys, so a plain `existingCycles[name]`
    // read inherits from Object.prototype. These names must be treated as FREE on an
    // empty cycles object — before the Object.hasOwn fix each was reported as a
    // collision and silently renamed to "X (2)" with wasModified=true.
    resultsDiv.innerHTML += '<h4 class="test-section">🧬 getUniqueCycleName — inherited key names</h4>';

    for (const inherited of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf']) {
        await test(`"${inherited}" is available on an empty cycles object`, () => {
            const r = getUniqueCycleName(inherited, {});
            if (r.name !== inherited || r.wasModified !== false) {
                throw new Error(`got "${r.name}" / wasModified=${r.wasModified}`);
            }
        });

        await test(`cycleNameExists("${inherited}") is false on an empty cycles object`, () => {
            if (cycleNameExists(inherited, {}) !== false) {
                throw new Error(`expected false for "${inherited}"`);
            }
        });

        await test(`"${inherited}" still collides when genuinely present`, () => {
            const r = getUniqueCycleName(inherited, { [inherited]: {} });
            if (r.name !== `${inherited} (2)` || r.wasModified !== true) {
                throw new Error(`got "${r.name}" / wasModified=${r.wasModified}`);
            }
        });
    }

    await test('"__proto__" is forced to a suffixed name (never used as a raw key)', () => {
        const r = getUniqueCycleName('__proto__', {});
        if (r.name !== '__proto__ (2)' || r.wasModified !== true) {
            throw new Error(`got "${r.name}" / wasModified=${r.wasModified}`);
        }
    });

    await test('the "__proto__" result is an own property that survives JSON', () => {
        // Assigning the raw "__proto__" key sets the prototype instead of creating an
        // own property: the routine reads back in memory but serialises to {} and is
        // lost on reload. The suffixed name must behave like any ordinary key.
        const cycles = {};
        const { name } = getUniqueCycleName('__proto__', cycles);
        cycles[name] = { title: 'kept' };

        if (!Object.keys(cycles).includes(name)) {
            throw new Error(`"${name}" is not an own property: ${JSON.stringify(Object.keys(cycles))}`);
        }
        const roundTripped = JSON.parse(JSON.stringify(cycles));
        if (roundTripped[name]?.title !== 'kept') {
            throw new Error(`lost on JSON round-trip: ${JSON.stringify(roundTripped)}`);
        }
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
