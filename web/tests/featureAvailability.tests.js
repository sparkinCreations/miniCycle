/**
 * FeatureAvailability Tracker — Browser Tests
 * Verifies optional-module failures are tracked and surfaced once (degraded mode).
 */

export async function runFeatureAvailabilityTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🚦 FeatureAvailability Tests</h2><h3>Loading module...</h3>';

    let featureAvailability;
    try {
        const cacheBuster = window.testCacheBuster || Date.now();
        ({ featureAvailability } = await import(`../modules/utils/featureAvailability.js?v=${cacheBuster}`));
        resultsDiv.innerHTML = '<h2>🚦 FeatureAvailability Tests</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>🚦 FeatureAvailability Tests</h2><div class="result fail">❌ Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    const passed = { count: 0 };
    const total = { count: 0 };

    function assert(cond, msg) { if (!cond) throw new Error(msg); }

    async function test(name, testFn) {
        total.count++;
        featureAvailability.reset(); // isolate: singleton state cleared before each test
        try {
            const result = testFn();
            if (result instanceof Promise) await result;
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            featureAvailability.reset();
        }
    }

    await test('clean state: nothing failed, not degraded, everything available', () => {
        assert(featureAvailability.degradedMode === false, 'should not be degraded initially');
        assert(featureAvailability.isAvailable('anything') === true, 'unknown feature should be available');
        assert(featureAvailability.getFailedFeatures().length === 0, 'no failed features');
    });

    await test('markFailed records the feature and flips degraded mode', () => {
        featureAvailability.markFailed('gamesManager', new Error('boom'));
        assert(featureAvailability.isAvailable('gamesManager') === false, 'failed feature should be unavailable');
        assert(featureAvailability.degradedMode === true, 'should be degraded');
        assert(featureAvailability.isAvailable('statsPanel') === true, 'other features still available');
    });

    await test('markFailed sets the data-degraded-mode hook on <html>', () => {
        assert(!document.documentElement.dataset.degradedMode, 'attribute absent initially');
        featureAvailability.markFailed('statsPanel', new Error('x'));
        assert(document.documentElement.dataset.degradedMode === 'true', 'attribute set after failure');
    });

    await test('markFailed is deduped (same feature twice = one entry)', () => {
        featureAvailability.markFailed('pullToRefresh', new Error('first'));
        featureAvailability.markFailed('pullToRefresh', new Error('second'));
        assert(featureAvailability.getFailedFeatures().length === 1, 'should not duplicate the same feature');
    });

    await test('getFailedFeatures returns name + error', () => {
        featureAvailability.markFailed('helpWindowManager', new Error('nope'));
        const list = featureAvailability.getFailedFeatures();
        assert(list.length === 1 && list[0].name === 'helpWindowManager', 'name captured');
        assert(list[0].error === 'nope', 'error message captured');
    });

    await test('showDegradedModeWarning notifies once and only once', () => {
        let calls = 0;
        const notify = () => { calls++; };
        featureAvailability.markFailed('gamesManager', new Error('x'));
        featureAvailability.showDegradedModeWarning(notify);
        featureAvailability.showDegradedModeWarning(notify);
        assert(calls === 1, `expected 1 notification, got ${calls}`);
    });

    await test('showDegradedModeWarning is a no-op when nothing failed', () => {
        let calls = 0;
        featureAvailability.showDegradedModeWarning(() => { calls++; });
        assert(calls === 0, 'should not notify when no failures');
    });

    await test('warning message uses friendly names and includes the feature', () => {
        let message = '';
        featureAvailability.markFailed('gamesManager', new Error('x'));
        featureAvailability.showDegradedModeWarning((msg) => { message = msg; });
        assert(message.includes('Mini Games'), `friendly name expected, got: ${message}`);
    });

    await test('reset clears failures, degraded mode, and the DOM hook', () => {
        featureAvailability.markFailed('gamesManager', new Error('x'));
        featureAvailability.reset();
        assert(featureAvailability.degradedMode === false, 'degraded cleared');
        assert(featureAvailability.getFailedFeatures().length === 0, 'failures cleared');
        assert(!document.documentElement.dataset.degradedMode, 'DOM hook removed');
    });

    await test('exportReport summarizes failures (and the empty case)', () => {
        assert(featureAvailability.exportReport() === 'No features failed to load.', 'empty report');
        featureAvailability.markFailed('statsPanel', new Error('down'));
        assert(featureAvailability.exportReport().includes('statsPanel: down'), 'report lists the failure');
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
