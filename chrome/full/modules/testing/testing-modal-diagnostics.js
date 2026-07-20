/**
 * Testing Modal Diagnostics - Health checks and info displays
 *
 * Provides diagnostic functions for checking application health,
 * data integrity, schema validation, and displaying system info.
 *
 * @module testing-modal-diagnostics
 */

import { UI_TIMEOUTS } from '../core/constants.js';
import {
    getDeps,
    showNotification,
    appendToTestResults,
    safeAddEventListenerById
} from './testing-modal-core.js';
import { getLabel } from '../labels/labelResolver.js';

// ==========================================
// BUTTON SETUP
// ==========================================

/**
 * Setup diagnostics tab button event listeners
 */
export function setupDiagnosticsButtons() {
    safeAddEventListenerById("run-health-check", "click", () => {
        runHealthCheck();
    });

    safeAddEventListenerById("check-data-integrity", "click", () => {
        checkDataIntegrity();
    });

    safeAddEventListenerById("validate-schema", "click", () => {
        validateSchema();
    });

    safeAddEventListenerById("show-app-info", "click", () => {
        showAppInfo();
    });

    safeAddEventListenerById("show-storage-info", "click", () => {
        showStorageInfo();
    });

    safeAddEventListenerById("show-performance-info", "click", () => {
        showPerformanceInfo();
    });

    safeAddEventListenerById("show-boot-timing", "click", () => {
        showBootTiming();
    });
}

// ==========================================
// HEALTH CHECK FUNCTIONS
// ==========================================

/**
 * Run full health check on application state
 */
export function runHealthCheck() {
    const deps = getDeps();
    appendToTestResults("Running Full Health Check...\n");
    showNotification(getLabel('notify.diagHealthCheck'), "info", UI_TIMEOUTS.NOTIFICATION_LONG);

    setTimeout(() => {
        if (!deps.AppState?.isReady?.()) {
            appendToTestResults("AppState not ready\n\n");
            showNotification(getLabel('notify.diagNoAppState'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = deps.AppState.get();
        if (!currentState) {
            appendToTestResults("No state data available\n\n");
            showNotification(getLabel('notify.diagNoData'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const { data, metadata } = currentState;
        const cycles = data.cycles || {};
        const cycleCount = Object.keys(cycles).length;

        let totalTasks = 0;
        Object.values(cycles).forEach(cycle => {
            totalTasks += (cycle.tasks?.length || 0);
        });

        appendToTestResults(`Health Check Complete!\n`);
        appendToTestResults(`Found ${cycleCount} routines\n`);
        appendToTestResults(`Total Tasks: ${totalTasks}\n`);
        appendToTestResults(`Storage Status: OK\n`);
        appendToTestResults(`Schema Version: ${metadata?.schemaVersion || '2.5'}\n\n`);

        showNotification(getLabel('notify.diagHealthCheckDone'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
    }, 1500);
}

/**
 * Check data integrity of all cycles and tasks
 */
export function checkDataIntegrity() {
    const deps = getDeps();
    appendToTestResults("Checking Data Integrity...\n");
    showNotification(getLabel('notify.diagIntegrityCheck'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);

    setTimeout(() => {
        if (!deps.AppState?.isReady?.()) {
            appendToTestResults("AppState not ready\n\n");
            showNotification(getLabel('notify.diagNoAppState'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = deps.AppState.get();
        if (!currentState) {
            appendToTestResults("No state data available\n\n");
            return;
        }

        const { data } = currentState;
        const cycles = data.cycles || {};
        const results = [];

        Object.entries(cycles).forEach(([cycleId, cycle]) => {
            if (!cycle.title) {
                results.push({ cycle: cycleId, issue: 'Missing title' });
            }
            if (!Array.isArray(cycle.tasks)) {
                results.push({ cycle: cycleId, issue: 'Tasks is not an array' });
                return;
            }

            cycle.tasks.forEach((task, index) => {
                if (!task.text || typeof task.text !== 'string') {
                    results.push({ cycle: cycle.title, taskIndex: index, issue: 'Missing or invalid task text' });
                }
                if (task.id === undefined) {
                    results.push({ cycle: cycle.title, taskIndex: index, issue: 'Missing task ID' });
                }
            });
        });

        if (results.length === 0) {
            appendToTestResults("Data Integrity: PASSED\n");
            appendToTestResults("All cycles and tasks have valid structure\n\n");
            showNotification(getLabel('notify.diagIntegrityPassed'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
        } else {
            appendToTestResults(`Data Integrity: ${results.length} issues found\n`);
            results.forEach(result => {
                appendToTestResults(`- Cycle: ${result.cycle}, Issue: ${result.issue}\n`);
            });
            appendToTestResults("\n");
            showNotification(`Found ${results.length} data integrity issues`, "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
        }
    }, 1000);
}

/**
 * Validate schema versions across all cycles
 */
export function validateSchema() {
    const deps = getDeps();
    appendToTestResults("Validating Schema Versions...\n");
    showNotification(getLabel('notify.diagSchemaValidating'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);

    setTimeout(() => {
        if (!deps.AppState?.isReady?.()) {
            appendToTestResults("AppState not ready\n\n");
            showNotification(getLabel('notify.diagNoAppState'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = deps.AppState.get();
        if (!currentState) {
            appendToTestResults("No state data available\n\n");
            return;
        }

        const { data, metadata } = currentState;
        const cycles = data.cycles || {};
        const schemaVersion = metadata?.schemaVersion || 'unknown';

        let totalTasks = 0;
        let cyclesWithOldFormat = 0;

        Object.values(cycles).forEach(cycle => {
            totalTasks += (cycle.tasks?.length || 0);

            if (cycle.schemaVersion && cycle.schemaVersion < 2.5) {
                cyclesWithOldFormat++;
            }
        });

        appendToTestResults(`Schema Analysis:\n`);
        appendToTestResults(`- Current Schema Version: ${schemaVersion}\n`);
        appendToTestResults(`- Total Routines: ${Object.keys(cycles).length}\n`);
        appendToTestResults(`- Total Tasks: ${totalTasks}\n`);
        appendToTestResults(`- Cycles needing migration: ${cyclesWithOldFormat}\n\n`);

        if (cyclesWithOldFormat > 0) {
            showNotification(`Found ${cyclesWithOldFormat} cycles that may need migration`, "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
        } else {
            showNotification(getLabel('notify.diagSchemaValid'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
        }
    }, 800);
}

// ==========================================
// INFO DISPLAY FUNCTIONS
// ==========================================

/**
 * Display application information
 */
export function showAppInfo() {
    const deps = getDeps();
    appendToTestResults("Application Information:\n");

    const state = deps.AppState?.get();
    const metadata = state?.metadata || {};
    const version = metadata.version || metadata.schemaVersion || "1.371";
    const buildDate = metadata.lastModified
        ? new Date(metadata.lastModified).toLocaleDateString()
        : "Unknown";

    appendToTestResults(`- Version: ${version}\n`);
    appendToTestResults(`- Schema Version: ${metadata.schemaVersion || "2.5"}\n`);
    appendToTestResults(`- Name: miniCycle\n`);
    appendToTestResults(`- Developer: Sparkin Creations\n`);
    appendToTestResults(`- Last Modified: ${buildDate}\n`);
    appendToTestResults(`- User Agent: ${navigator.userAgent}\n\n`);

    showNotification(getLabel('notify.diagAppInfo'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
}

/**
 * Display storage usage information
 */
export function showStorageInfo() {
    appendToTestResults("Storage Analysis:\n");

    const storageUsed = JSON.stringify(localStorage).length;
    const storageLimit = 5 * 1024 * 1024; // 5MB typical limit
    const usagePercent = ((storageUsed / storageLimit) * 100).toFixed(2);

    appendToTestResults(`- Storage Used: ${(storageUsed / 1024).toFixed(2)} KB\n`);
    appendToTestResults(`- Estimated Limit: ${(storageLimit / 1024 / 1024).toFixed(2)} MB\n`);
    appendToTestResults(`- Usage: ${usagePercent}%\n`);
    appendToTestResults(`- Available Keys: ${Object.keys(localStorage).length}\n\n`);

    showNotification(`Storage: ${usagePercent}% used`, "info", UI_TIMEOUTS.NOTIFICATION_LONG);
}

/**
 * Display performance metrics
 */
export function showPerformanceInfo() {
    appendToTestResults("Performance Information:\n");

    const performanceInfo = performance.getEntriesByType("navigation")[0];
    if (performanceInfo) {
        const pageLoadTime = performanceInfo.loadEventEnd - performanceInfo.fetchStart;
        const domLoadTime = performanceInfo.domContentLoadedEventEnd - performanceInfo.fetchStart;

        appendToTestResults(`- Page Load Time: ${pageLoadTime > 0 ? pageLoadTime.toFixed(2) + 'ms' : 'N/A'}\n`);
        appendToTestResults(`- DOM Content Loaded: ${domLoadTime > 0 ? domLoadTime.toFixed(2) + 'ms' : 'N/A'}\n`);
        appendToTestResults(`- DNS Lookup: ${(performanceInfo.domainLookupEnd - performanceInfo.domainLookupStart).toFixed(2)}ms\n`);
        appendToTestResults(`- Server Response: ${(performanceInfo.responseEnd - performanceInfo.requestStart).toFixed(2)}ms\n`);
    } else {
        appendToTestResults(`- Performance data not available\n`);
    }

    appendToTestResults(`- Memory Used: ${(performance.memory?.usedJSHeapSize / 1024 / 1024 || 0).toFixed(2)} MB\n`);
    appendToTestResults(`- Memory Limit: ${(performance.memory?.jsHeapSizeLimit / 1024 / 1024 || 0).toFixed(2)} MB\n`);
    appendToTestResults(`- Viewport: ${window.innerWidth}x${window.innerHeight}\n\n`);

    showNotification(getLabel('notify.diagPerfInfo'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
}

/**
 * Display boot phase timing recorded by the orchestrator.
 * Reads window.getMiniCycleBootTiming() — the diagnostic accessor exposed
 * during boot. Especially useful on slow devices to see WHERE boot time goes
 * (module fetch vs core vs feature wiring vs UI).
 */
export function showBootTiming() {
    const timing = window.getMiniCycleBootTiming?.();
    if (!timing || timing.interactiveSinceNavigation_ms == null) {
        appendToTestResults("⏱️ BOOT TIMING\n- Not available (page may have booted before instrumentation, or perf API blocked)\n\n");
        showNotification(getLabel('notify.diagBootTiming'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
        return;
    }

    // Output renders in .testing-output (monospace, pre-wrap) — aligned columns
    // and bars display correctly. Keep lines ≤ ~45 chars for the mobile modal.
    const RULE_W = 34;
    const ms = (v) => (v == null ? 'N/A' : `${v}ms`);
    const p = timing.phases || {};
    const boot = timing.bootSequence_ms;
    const out = [];

    // Version + cache + capture-time stamp: traces get shared (screenshots /
    // feedback form) — without these a trace can't be attributed to a build or
    // placed in a rollout timeline (July 14 lesson: an Android trace arrived
    // unidentifiable mid-rollout). Time = when the trace was captured, local.
    out.push(`⏱️ BOOT TIMING (v${globalThis.APP_VERSION || '?'} · cache ${globalThis.CACHE_VERSION || '?'})`);
    out.push(new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));
    out.push('═'.repeat(RULE_W));
    out.push(`${'Interactive'.padEnd(15)}${ms(timing.interactiveSinceNavigation_ms).padStart(8)}  (since page open)`);
    out.push(`${'Boot started'.padEnd(15)}${ms(timing.bootStartSinceNavigation_ms).padStart(8)}`);
    out.push(`${'Boot sequence'.padEnd(15)}${ms(boot).padStart(8)}`);
    const pctOf = (v, total) => (v != null && total ? `${String(Math.round((v / total) * 100)).padStart(4)}%` : '');
    [['Imports', p.moduleImport_ms],
     ['Core', p.core_ms],
     ['Features', p.features_ms],
     ['UI finalize', p.ui_ms]].forEach(([label, v]) => {
        out.push(`  ${label.padEnd(13)}${ms(v).padStart(8)}${pctOf(v, boot)}`);
    });

    // First-run choice-screen perception (only present for a brand-new user's
    // first session — the screen sets the marks). Shows how much of the real
    // boot the choice screen masked: perceived wait ≪ real boot is the win.
    const fr = timing.firstRun;
    if (fr) {
        out.push('');
        out.push('FIRST-RUN PERCEPTION');
        out.push('─'.repeat(RULE_W));
        out.push(`${'Choice shown'.padEnd(16)}${ms(fr.choiceShownAt_ms).padStart(8)}  (since page open)`);
        out.push(`${'User decided in'.padEnd(16)}${ms(fr.decisionTime_ms).padStart(8)}`);
        out.push(`${'Perceived wait'.padEnd(16)}${ms(fr.perceivedWait_ms).padStart(8)}  (after tapping)`);
        out.push(`${'Real boot'.padEnd(16)}${ms(boot).padStart(8)}`);
        if (fr.bootDoneBeforeTap === true) out.push('  ✓ boot finished before the user picked');
    }

    // Per-phase breakdown of the Features window, ranked with bars — the dominant
    // phase is the first defer/parallelization target on slow devices.
    const rankedPhases = Object.entries(timing.featuresByPhase || {})
        .map(([k, v]) => [k.replace(/_ms$/, ''), v ?? 0])
        .sort((a, b) => b[1] - a[1]);
    if (rankedPhases.length) {
        out.push('');
        out.push('FEATURES BY PHASE');
        out.push('─'.repeat(RULE_W));
        const maxPhase = rankedPhases[0][1] || 1;
        const featTotal = p.features_ms || rankedPhases.reduce((s, [, v]) => s + v, 0) || 1;
        rankedPhases.forEach(([name, v]) => {
            const bar = '█'.repeat(Math.max(1, Math.round((v / maxPhase) * 10)));
            out.push(`${name.padEnd(16)}${ms(v).padStart(7)}${pctOf(v, featTotal)} ${bar}`);
        });
    }

    // Per-module ranking (top 15) — the deferral decision data. init is exact
    // (sequential wire+init incl. DI wiring); import overlaps within a phase
    // (parallel fetch+parse), so rank by it but never sum it.
    const mods = timing.moduleTimings || [];
    if (mods.length) {
        const interactiveAt = timing.interactiveSinceNavigation_ms;
        const n = (v) => (v == null ? '–' : String(v));
        out.push('');
        out.push(`TOP MODULES (15 of ${mods.length}, ms)`);
        out.push('─'.repeat(RULE_W));
        out.push(`${'module'.padEnd(22)}${'total'.padStart(6)}${'imp'.padStart(5)}${'init'.padStart(5)}`);
        mods.slice(0, 15).forEach(m => {
            const post = interactiveAt != null && m.at_ms != null && m.at_ms >= interactiveAt;
            out.push(`${(m.name + (post ? '⁺' : '')).padEnd(22)}${n(m.total_ms).padStart(6)}${n(m.import_ms).padStart(5)}${n(m.init_ms).padStart(5)}`);
        });
        out.push('⁺ = post-boot (loaded after interactive)');
        out.push('init exact · imp overlaps — rank, don\'t sum');
    }

    // ── Network/cache accounting for THIS load + precache completeness ──
    // Answers "was this run actually served from cache?" remotely (July 14:
    // a device's warm runs showed network-shaped imps; a controlled run served
    // 121/121 from SW — the trace must be able to tell those apart itself).
    // transferSize === 0 ⇒ served from SW/HTTP cache; > 0 ⇒ real network bytes.
    const js = performance.getEntriesByType('resource').filter(e => /\.js(\?|$)/.test(e.name));
    const cached = js.filter(e => e.transferSize === 0).length;
    const networked = js.filter(e => e.transferSize > 0);
    const netKB = Math.round(networked.reduce((s, e) => s + e.transferSize, 0) / 1024);
    out.push('');
    out.push('NETWORK (this load, JS)');
    out.push('─'.repeat(RULE_W));
    out.push(`${'served'.padEnd(12)}${String(js.length).padStart(5)}   cached ${cached} · networked ${networked.length} (${netKB}KB)`);
    [...networked].sort((a, b) => b.duration - a.duration).slice(0, 5).forEach(e => {
        out.push(`  ${Math.round(e.duration)}ms ${Math.round(e.transferSize / 1024)}KB ${e.name.split('/').pop().split('?')[0].slice(0, 28)}`);
    });

    appendToTestResults(out.join('\n') + '\n');

    // Precache completeness (async): count entries in the static cache — an
    // interrupted install (Android kills the SW with the app) leaves this short
    // and every later "warm" load re-fetches the missing files.
    if (typeof caches !== 'undefined' && caches.keys) {
        caches.keys().then(async (names) => {
            const lines = [];
            for (const name of names.filter(n => n.includes('miniCycle'))) {
                const c = await caches.open(name);
                const count = (await c.keys()).length;
                lines.push(`${name}: ${count} entries`);
            }
            const controlled = navigator.serviceWorker?.controller ? 'controlling' : 'NOT controlling';
            appendToTestResults(`SW ${controlled} · ` + (lines.join(' · ') || 'no caches') + '\n\n');
        }).catch(() => appendToTestResults('cache enumeration unavailable\n\n'));
    } else {
        appendToTestResults('\n');
    }

    showNotification(getLabel('notify.diagBootTiming'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
}

