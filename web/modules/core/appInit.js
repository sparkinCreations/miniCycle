// Fail-fast legacy entry: any use of appInit.js is a bug.
// The canonical implementation now lives in './appInit.v2.js'.
//
// This file intentionally throws so that any stale imports, cached
// bundles, or service workers that still reference './appInit.js'
// surface an immediate, obvious error instead of silently using
// an outdated implementation.

throw new Error(
	'appInit.js legacy entry must NOT be used. Use appInit.v2.js only.'
);
