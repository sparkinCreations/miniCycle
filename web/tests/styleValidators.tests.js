/**
 * StyleValidators Tests
 * Tests for modules/utils/styleValidators.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runStyleValidatorsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/styleValidators.js?v=${cacheBuster}`);
    const { isValidHex, normalizeFontSize, normalizeHex } = mod;
    const { FONT_SIZE } = await import(`../modules/core/constants.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>StyleValidators Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('exports isValidHex and normalizeFontSize as functions', () => {
        if (typeof isValidHex !== 'function') throw new Error(`isValidHex: ${typeof isValidHex}`);
        if (typeof normalizeFontSize !== 'function') throw new Error(`normalizeFontSize: ${typeof normalizeFontSize}`);
    });

    // ── isValidHex ───────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 isValidHex</h4>';

    await test('accepts #RGB, #RGBA, #RRGGBB, #RRGGBBAA', () => {
        for (const v of ['#fff', '#FFF', '#fff8', '#ff0000', '#FF0000', '#ff0000cc']) {
            if (isValidHex(v) !== true) throw new Error(`Expected ${v} to be valid`);
        }
    });

    await test('rejects missing hash, bad length, and non-hex digits', () => {
        for (const v of ['fff', '#ff', '#ffffffffff', '#gggggg', '#ff 000', '']) {
            if (isValidHex(v) !== false) throw new Error(`Expected ${JSON.stringify(v)} to be invalid`);
        }
    });

    // ── normalizeHex ─────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 normalizeHex</h4>';

    await test('expands shorthand that isValidHex accepts but 6-digit slicing cannot read', () => {
        // The reason this function exists. Callers doing parseInt on fixed
        // offsets read '' for the third channel of '#f00' and produced
        // rgba(240, 0, NaN, …). Shorthand reaches storage via the preset
        // share-code importer, which gates on isValidHex.
        if (normalizeHex('#f00') !== '#ff0000') throw new Error(`#f00 → ${normalizeHex('#f00')}`);
        if (normalizeHex('#FFF') !== '#FFFFFF') throw new Error(`#FFF → ${normalizeHex('#FFF')}`);
        if (normalizeHex('#abcd') !== '#aabbcc') throw new Error(`#abcd → ${normalizeHex('#abcd')}`);
    });

    await test('passes 6-digit through and drops alpha from 8-digit', () => {
        if (normalizeHex('#ff5e5e') !== '#ff5e5e') throw new Error('6-digit should pass through');
        if (normalizeHex('#11223344') !== '#112233') throw new Error('8-digit should drop its alpha byte');
    });

    await test('returns null for 5- and 7-digit strings isValidHex lets through', () => {
        // isValidHex accepts 3–8 digits, which is correct for its job (gating a
        // value before a style sink). 5 and 7 are not real CSS hex colours and
        // must not reach arithmetic.
        for (const v of ['#12345', '#1234567']) {
            if (isValidHex(v) !== true) throw new Error(`precondition: isValidHex should accept ${v}`);
            if (normalizeHex(v) !== null) throw new Error(`${v} should normalize to null, got ${normalizeHex(v)}`);
        }
    });

    await test('returns null for non-hex and non-strings', () => {
        for (const v of ['red', 'fff', '', null, undefined, 42, {}, []]) {
            if (normalizeHex(v) !== null) throw new Error(`${JSON.stringify(v)} → ${normalizeHex(v)}`);
        }
    });

    await test('every normalizeHex result is safe for fixed-offset parseInt', () => {
        // The contract that matters at the sink: no NaN, ever.
        for (const v of ['#f00', '#FFF', '#abcd', '#ff5e5e', '#11223344']) {
            const safe = normalizeHex(v);
            const parts = [safe.slice(1, 3), safe.slice(3, 5), safe.slice(5, 7)].map(h => parseInt(h, 16));
            if (parts.some(Number.isNaN)) throw new Error(`${v} → ${safe} → NaN channel`);
        }
    });

    await test('rejects non-strings without coercing them', () => {
        // .test() stringifies its argument, so a bare regex check would evaluate
        // these as "null"/"[object Object]" rather than rejecting them by type.
        for (const v of [null, undefined, 0, 0xff0000, {}, [], true, ['#fff']]) {
            if (isValidHex(v) !== false) throw new Error(`Expected ${JSON.stringify(v)} to be invalid`);
        }
    });

    await test('rejects a CSS injection attempt that a truthiness check would pass', () => {
        // The value applyPriorityColor used to forward on a bare `if (globalColor)`.
        if (isValidHex('red; background: url(https://evil.example/x)') !== false) {
            throw new Error('Expected injection-shaped value to be invalid');
        }
    });

    // ── normalizeFontSize ────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔤 normalizeFontSize</h4>';

    await test('accepts the sizes the select offers, as strings', () => {
        for (const [input, expected] of [['14', 14], ['16', 16], ['18', 18], ['20', 20]]) {
            if (normalizeFontSize(input) !== expected) {
                throw new Error(`Expected ${input} -> ${expected}, got ${normalizeFontSize(input)}`);
            }
        }
    });

    await test('accepts numbers as well as strings', () => {
        if (normalizeFontSize(18) !== 18) throw new Error('Expected numeric 18 to normalize');
    });

    await test('honours the FONT_SIZE bounds at both edges', () => {
        if (normalizeFontSize(FONT_SIZE.MIN_PX) !== FONT_SIZE.MIN_PX) throw new Error('MIN_PX should be valid');
        if (normalizeFontSize(FONT_SIZE.MAX_PX) !== FONT_SIZE.MAX_PX) throw new Error('MAX_PX should be valid');
        if (normalizeFontSize(FONT_SIZE.MIN_PX - 1) !== null) throw new Error('Below MIN_PX should be null');
        if (normalizeFontSize(FONT_SIZE.MAX_PX + 1) !== null) throw new Error('Above MAX_PX should be null');
    });

    await test('rejects blanks rather than normalizing them to zero', () => {
        // Number('') and Number('   ') are both 0, which would otherwise pass a
        // bare Number.isFinite check and then fail the range test by accident.
        for (const v of ['', '   ']) {
            if (normalizeFontSize(v) !== null) throw new Error(`Expected ${JSON.stringify(v)} -> null`);
        }
    });

    await test('rejects non-numeric strings and non-string/number types', () => {
        for (const v of ['abc', '16px', null, undefined, {}, [], true, NaN, Infinity]) {
            if (normalizeFontSize(v) !== null) throw new Error(`Expected ${JSON.stringify(v)} -> null`);
        }
    });

    await test('rejects a value shaped to break out of the px template', () => {
        // Sinks interpolate as `${size}px`; this must never reach setProperty.
        if (normalizeFontSize('16px; color: red') !== null) {
            throw new Error('Expected injection-shaped value to be null');
        }
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
