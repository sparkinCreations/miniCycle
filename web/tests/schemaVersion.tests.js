/**
 * SchemaVersion Tests
 * Tests for modules/utils/schemaVersion.js — numeric version comparison and the
 * current / older / newer / unknown classification of a stored document.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runSchemaVersionTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/schemaVersion.js?v=${cacheBuster}`);
    const { parseSchemaVersion, compareSchemaVersions, classifyStoredVersion } = mod;
    const { SCHEMA } = await import(`../modules/core/constants.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>SchemaVersion Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">🔢 parseSchemaVersion</h4>';

    await test('parses the stored string form and a bare number', () => {
        const s = parseSchemaVersion('2.5');
        if (!s || s.major !== 2 || s.minor !== 5) throw new Error(`"2.5" → ${JSON.stringify(s)}`);
        const n = parseSchemaVersion(2.5);
        if (!n || n.major !== 2 || n.minor !== 5) throw new Error(`2.5 → ${JSON.stringify(n)}`);
        const ten = parseSchemaVersion('2.10');
        if (!ten || ten.minor !== 10) throw new Error(`"2.10" minor should be 10, got ${JSON.stringify(ten)}`);
        const patch = parseSchemaVersion('2.6.1');
        if (!patch || patch.major !== 2 || patch.minor !== 6) throw new Error(`patch form → ${JSON.stringify(patch)}`);
    });

    await test('returns null for anything that is not a version', () => {
        for (const bad of ['2', 'two.five', '', null, undefined, {}, [], NaN, 'legacy', 'corrupt']) {
            if (parseSchemaVersion(bad) !== null) throw new Error(`expected null for ${JSON.stringify(bad)}`);
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">⚖️ compareSchemaVersions</h4>';

    await test('compares as numbers, major then minor — never as strings', () => {
        // The trap this module exists for: as strings, "2.5" > "2.10".
        if (compareSchemaVersions('2.10', '2.5') !== 1) throw new Error('"2.10" must be NEWER than "2.5"');
        if (compareSchemaVersions('2.5', '2.10') !== -1) throw new Error('"2.5" must be OLDER than "2.10"');
        if (compareSchemaVersions('3.0', '2.99') !== 1) throw new Error('major wins over minor');
        if (compareSchemaVersions('2.5', '2.5') !== 0) throw new Error('equal');
        if (compareSchemaVersions('2.5', 2.5) !== 0) throw new Error('string and number forms are equal');
    });

    await test('returns null when either side is unparseable', () => {
        if (compareSchemaVersions('2.5', 'legacy') !== null) throw new Error('right unparseable');
        if (compareSchemaVersions(undefined, '2.5') !== null) throw new Error('left missing');
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🏷️ classifyStoredVersion</h4>';

    await test('classifies a stored document against the current version', () => {
        if (classifyStoredVersion({ schemaVersion: SCHEMA.CURRENT }) !== 'current') throw new Error('current');
        if (classifyStoredVersion({ schemaVersion: '2.4' }) !== 'older') throw new Error('older');
        if (classifyStoredVersion({ schemaVersion: '2.6' }) !== 'newer') throw new Error('newer');
        if (classifyStoredVersion({ schemaVersion: '2.10' }) !== 'newer') throw new Error('"2.10" is newer than "2.5", not older');
        if (classifyStoredVersion({ schemaVersion: '3.0' }) !== 'newer') throw new Error('next major is newer');
    });

    await test('falls back to metadata.schemaVersion and reports unknown for the rest', () => {
        if (classifyStoredVersion({ metadata: { schemaVersion: '2.6' } }) !== 'newer') throw new Error('metadata fallback');
        for (const doc of [{}, null, undefined, { schemaVersion: 'legacy' }, { schemaVersion: null }]) {
            if (classifyStoredVersion(doc) !== 'unknown') throw new Error(`expected unknown for ${JSON.stringify(doc)}`);
        }
    });

    await test('accepts an explicit current version, so a future build can classify against itself', () => {
        if (classifyStoredVersion({ schemaVersion: '2.5' }, '2.6') !== 'older') throw new Error('2.5 is older than 2.6');
        if (classifyStoredVersion({ schemaVersion: '2.6' }, '2.6') !== 'current') throw new Error('2.6 is current for 2.6');
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
