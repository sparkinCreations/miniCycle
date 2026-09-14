/**
 * Schema Version
 *
 * Pure helpers that answer one question about a stored document: is it the
 * version this build understands, older (migrate it), or NEWER than this build?
 * No DI, no side effects.
 *
 * Why this exists: every version check used to be `schemaVersion === '2.5'`.
 * That cannot tell "older" from "newer", so a build that met data written by a
 * newer app treated it as invalid — and a tab left open across a release then
 * SAVED its own older state over it (reproduced Sep 2026, before this module:
 * the newer document, routine and all, was replaced by the stale tab's copy).
 * Every reader must classify through here so "newer" is a state the app
 * recognises and refuses to overwrite.
 *
 * Versions are compared as NUMBERS, major then minor. Never compare the strings:
 * `"2.5" > "2.10"` is true (STATE_TRUTH_MIGRATION #22).
 *
 * @module utils/schemaVersion
 */

import { SCHEMA } from '../core/constants.js';

const DIGITS = /^\d+$/;

/**
 * Parse a schema version into its numeric parts.
 * Accepts the stored string form ("2.5", "2.10", "2.6.1") and a bare number (2.5).
 * @param {*} value
 * @returns {{major: number, minor: number}|null} null for anything unparseable
 */
export function parseSchemaVersion(value) {
    if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
    if (typeof value !== 'string') return null;
    const parts = value.trim().split('.');
    if (parts.length < 2 || parts.length > 3 || !parts.every(p => DIGITS.test(p))) return null;
    return { major: Number(parts[0]), minor: Number(parts[1]) };
}

/**
 * Numeric comparison of two schema versions.
 * @param {*} a
 * @param {*} b
 * @returns {number|null} -1 when a < b, 0 when equal, 1 when a > b; null if either is unparseable
 */
export function compareSchemaVersions(a, b) {
    const pa = parseSchemaVersion(a);
    const pb = parseSchemaVersion(b);
    if (!pa || !pb) return null;
    if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
    if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
    return 0;
}

/**
 * Classify a stored document against the version this build understands.
 *
 * Reads the document-level `schemaVersion` (falling back to
 * `metadata.schemaVersion`). A missing or unparseable version is 'unknown' —
 * the caller decides what that means (today: the legacy structure checks).
 *
 * @param {Object|null|undefined} doc - Parsed stored document
 * @param {string} [current=SCHEMA.CURRENT] - The version this build writes
 * @returns {'current'|'older'|'newer'|'unknown'}
 */
export function classifyStoredVersion(doc, current = SCHEMA.CURRENT) {
    const stored = doc?.schemaVersion ?? doc?.metadata?.schemaVersion;
    const cmp = compareSchemaVersions(stored, current);
    if (cmp === null) return 'unknown';
    if (cmp === 0) return 'current';
    return cmp < 0 ? 'older' : 'newer';
}
