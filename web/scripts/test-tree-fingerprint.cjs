/**
 * One definition of "which test tree is this", shared by the runner that WRITES
 * tests/.test-count.json and the collector that READS it.
 *
 * It must live in one file: two copies that drift would make a stale count look
 * fresh, which is the exact failure the manifest exists to prevent.
 *
 * The fingerprint covers the name and byte size of every *.tests.js the runner
 * could load. That catches added, removed, renamed, and edited suites. It does
 * NOT catch an edit that leaves the file exactly the same size — a rewritten
 * assertion, say — but such an edit cannot change the test COUNT unless it also
 * adds or removes a test(), which changes the size. Cheap and sufficient.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TESTS_DIR = path.resolve(__dirname, '..', 'tests');

function testTreeFingerprint(dir = TESTS_DIR) {
    let entries;
    try {
        entries = fs.readdirSync(dir).filter(f => f.endsWith('.tests.js')).sort();
    } catch {
        return null;
    }
    const parts = entries.map(name => {
        let size = -1;
        try { size = fs.statSync(path.join(dir, name)).size; } catch { /* unreadable — recorded as -1 */ }
        return `${name}:${size}`;
    });
    return crypto.createHash('sha1').update(parts.join('\n')).digest('hex');
}

module.exports = { testTreeFingerprint, TESTS_DIR };
