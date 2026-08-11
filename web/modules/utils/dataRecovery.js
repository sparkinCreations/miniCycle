/**
 * Data Recovery Utilities
 *
 * Best-effort salvage for corrupted `miniCycleData` in localStorage. Before the app
 * gives up and falls back to a fresh/minimal state, these helpers (1) snapshot the raw
 * corrupted string so nothing is lost, and (2) try a few escalating repair strategies.
 *
 * Intentionally PURE and SYNCHRONOUS: AppState calls these from the boot-critical load
 * path, which runs before DI is wired — so this module takes no injected dependencies
 * and never prompts the user. The caller (AppState) owns notifications and the strict
 * schema validation that gates whether salvaged data is actually used.
 *
 * @module modules/utils/dataRecovery
 */

import { STORAGE_KEYS, LIMITS } from '../core/constants.js';

const CORRUPT_BACKUP_PREFIX = `${STORAGE_KEYS.DATA}_corrupted_`;

/**
 * Resolve a usable Storage-like object (defaults to global localStorage).
 * @param {Storage|null} [storage]
 * @returns {Storage|null}
 */
function resolveStorage(storage) {
    if (storage) return storage;
    return (typeof localStorage !== 'undefined') ? localStorage : null;
}

/**
 * Attempt to salvage a corrupted JSON string using escalating strategies.
 * @param {string} jsonString - The corrupted JSON string
 * @returns {{ data: Object, strategy: string } | null} Salvaged data + the strategy that worked, or null
 */
export function attemptJsonSalvage(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
        return null;
    }

    const strategies = [
        // 1. Try as-is (corruption may be elsewhere / transient).
        { name: 'direct-parse', fn: (str) => JSON.parse(str) },

        // 2. Strip control characters that can sneak into stored strings.
        // eslint-disable-next-line no-control-regex
        { name: 'remove-control-chars', fn: (str) => JSON.parse(str.replace(/[\x00-\x1F\x7F]/g, '')) },

        // 3. Repair truncation MID-STRING — the common case, which the plain
        //    bracket-closer below can't touch: close the unterminated string
        //    literal, strip any dangling partial member, then balance brackets
        //    counting only brackets OUTSIDE strings (a task named "step {1}"
        //    otherwise skews the count). Tried before close-brackets so the
        //    string-aware repair wins when both would parse.
        {
            name: 'close-string-and-brackets',
            fn: (str) => {
                let inString = false;
                let escaped = false;
                // Stack, not counters: truncation inside a nested object needs
                // INTERLEAVED closers (`}` for the task object, then `]` for the
                // tasks array, then the outer `}`s) — unwinding the stack emits
                // them in the right order, which append-all-]-then-all-} cannot.
                const stack = [];
                for (const ch of str) {
                    if (escaped) { escaped = false; continue; }
                    if (inString && ch === '\\') { escaped = true; continue; }
                    if (ch === '"') { inString = !inString; continue; }
                    if (inString) continue;
                    if (ch === '{' || ch === '[') stack.push(ch);
                    else if (ch === '}' || ch === ']') stack.pop();
                }
                let fixed = str;
                // Truncation ON a backslash: `escaped` is still true, so the
                // closing quote appended below would itself be escaped and the
                // string would stay unterminated — strip the dangling backslash
                // first. (escaped can only be true while inString.)
                if (escaped) fixed = fixed.slice(0, -1);
                if (inString) fixed += '"';
                // Truncation can leave a dangling `"key":` or trailing comma
                // that no amount of closers makes parseable — strip it.
                fixed = fixed.replace(/,\s*$/, '').replace(/"[^"]*"\s*:\s*$/, '').replace(/,\s*$/, '');
                // Truncation MID-NUMBER (or mid-true/false/null) is the silent
                // one: `1723200000000` cut to `1723200` still parses after
                // closers, so the salvage adopts a WRONG value instead of a
                // missing one (fuzz: 13/971 cut positions). The last bare
                // literal before the cut is the only member that can be mangled
                // rather than cleanly absent — drop it. Two cases: mid-object
                // (leading comma — drop member and comma) and FIRST member of
                // its object (leading `{` — keep the brace). The second case is
                // the flagship: metadata.lastModified is the first member of
                // metadata, and a truncated-small timestamp feeds the multi-tab
                // adoption comparison. A truncated STRING value needs none of
                // this — the appended closing quote leaves visibly garbled text
                // the repair notification already covers. No-op when the input
                // ends cleanly (`"`, `}`, `]`): the anchors can't match.
                fixed = fixed
                    .replace(/,\s*"[^"]*"\s*:\s*(?:-?[\d.eE+]+|true|false|null)\s*$/, '')
                    .replace(/(\{\s*)"[^"]*"\s*:\s*(?:-?[\d.eE+]+|true|false|null)\s*$/, '$1');
                while (stack.length) {
                    fixed += stack.pop() === '{' ? '}' : ']';
                }
                return JSON.parse(fixed);
            }
        },

        // 4. Repair truncation by closing any unbalanced brackets/braces
        //    (naive count — kept as last resort for corruption the string-aware
        //    pass mis-models, e.g. corrupted quote characters themselves).
        {
            name: 'close-brackets',
            fn: (str) => {
                const openBraces = (str.match(/{/g) || []).length;
                const closeBraces = (str.match(/}/g) || []).length;
                const openBrackets = (str.match(/\[/g) || []).length;
                const closeBrackets = (str.match(/]/g) || []).length;
                let fixed = str;
                fixed += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
                fixed += '}'.repeat(Math.max(0, openBraces - closeBraces));
                return JSON.parse(fixed);
            }
        }
    ];

    for (const strategy of strategies) {
        try {
            const result = strategy.fn(jsonString);
            if (result && typeof result === 'object') {
                console.log(`✅ Data salvaged using strategy: ${strategy.name}`);
                return { data: result, strategy: strategy.name };
            }
        } catch (e) {
            console.warn(`Salvage strategy "${strategy.name}" failed:`, e?.message || e);
        }
    }

    return null;
}

/**
 * Snapshot corrupted data to localStorage so it can be inspected/recovered manually
 * later. Keeps at most LIMITS.MAX_CORRUPT_BACKUPS snapshots (oldest pruned first).
 * @param {string} corruptedData - The raw corrupted string
 * @param {Storage|null} [storage] - Storage target (defaults to global localStorage)
 * @returns {string|null} The backup key, or null if it could not be stored
 */
export function backupCorruptedData(corruptedData, storage) {
    const store = resolveStorage(storage);
    if (!store || !corruptedData) return null;

    const backupKey = `${CORRUPT_BACKUP_PREFIX}${Date.now()}`;

    try {
        // Prune old snapshots so corruption backups can't themselves fill storage.
        const existing = [];
        for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (key?.startsWith(CORRUPT_BACKUP_PREFIX)) existing.push(key);
        }
        if (existing.length >= LIMITS.MAX_CORRUPT_BACKUPS) {
            existing.sort();
            for (let i = 0; i <= existing.length - LIMITS.MAX_CORRUPT_BACKUPS; i++) {
                store.removeItem(existing[i]);
            }
        }

        store.setItem(backupKey, corruptedData);
        console.log(`💾 Corrupted data backed up as: ${backupKey}`);
        return backupKey;
    } catch (e) {
        console.warn('Could not back up corrupted data:', e?.message || e);
        return null;
    }
}

/**
 * Lightweight structural check for salvaged data — just enough to confirm it's
 * shaped like miniCycle data (a cycles map whose entries carry task arrays).
 * AppState applies the stricter Schema 2.5 validator before actually adopting it.
 * @param {Object} data
 * @returns {boolean}
 */
export function validateRecoveredData(data) {
    if (!data || typeof data !== 'object') return false;

    const cycles = data.data?.cycles || data.cycles;
    if (!cycles || typeof cycles !== 'object') return false;

    for (const cycle of Object.values(cycles)) {
        if (!cycle || !Array.isArray(cycle.tasks)) return false;
    }
    return true;
}

/**
 * Structural validation for a Schema 2.5 payload STRING (the value stored at
 * STORAGE_KEYS.DATA / carried in backup files as `miniCycleData`). Shared by
 * the file-restore path (backupRestoreManager) and the testing modal's
 * IndexedDB restore so both reject malformed payloads BEFORE writing to
 * localStorage — the UX contract is "file rejected", not "restored, then
 * recovery mode". Requires `metadata` deliberately: every app-generated
 * payload carries it, so its absence marks a hand-made file (AppState's
 * _ensureMetadata would heal it at boot, but rejecting up front honors the
 * contract).
 * @param {string} payloadString - Raw JSON string to validate
 * @returns {boolean}
 */
export function validateSchema25PayloadString(payloadString) {
    if (typeof payloadString !== 'string') return false;
    try {
        const parsed = JSON.parse(payloadString);
        return !!(parsed &&
            parsed.schemaVersion === "2.5" &&
            parsed.metadata && typeof parsed.metadata === 'object' &&
            parsed.data && typeof parsed.data.cycles === 'object' &&
            parsed.appState && typeof parsed.appState === 'object');
    } catch {
        return false;
    }
}

/**
 * Full synchronous recovery pass: back up the corrupted string, then attempt salvage.
 * Notifications and the final adopt/reject decision are the caller's responsibility.
 * @param {string} corruptedString - The raw corrupted string from storage
 * @param {{ storage?: Storage|null }} [options]
 * @returns {{ recovered: boolean, data: Object|null, strategy: string|null, backupKey: string|null }}
 */
export function recoverCorruptedData(corruptedString, options = {}) {
    const backupKey = backupCorruptedData(corruptedString, options.storage);
    const salvage = attemptJsonSalvage(corruptedString);

    if (salvage?.data && validateRecoveredData(salvage.data)) {
        return { recovered: true, data: salvage.data, strategy: salvage.strategy, backupKey };
    }
    return { recovered: false, data: null, strategy: null, backupKey };
}
