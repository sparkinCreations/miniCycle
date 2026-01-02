/**
 * Automated Performance Benchmark Runner
 * Runs performance benchmarks via Playwright and outputs results
 */

const { chromium } = require('playwright');

async function runPerformanceBenchmarks() {
    console.log('\x1b[34m============================================================\x1b[0m');
    console.log('\x1b[34m⚡ miniCycle Performance Benchmarks\x1b[0m');
    console.log('\x1b[34m============================================================\x1b[0m');
    console.log();

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('\x1b[36m🌐 Loading test page...\x1b[0m');
        await page.goto('http://localhost:8080/tests/module-test-suite.html', {
            waitUntil: 'networkidle',
            timeout: 10000
        });

        console.log('\x1b[36m⚡ Running performance benchmarks...\x1b[0m');
        console.log();

        // Select performance benchmarks
        await page.selectOption('#module-select', 'performance');
        await page.waitForTimeout(500);

        // Run benchmarks
        await page.click('#run-tests-btn');

        // Wait for results (benchmarks should complete within 5 seconds)
        await page.waitForTimeout(6000);

        // Extract results
        const results = await page.evaluate(() => {
            const resultsDiv = document.getElementById('results');
            const passResults = resultsDiv.querySelectorAll('.result.pass');
            const warnResults = resultsDiv.querySelectorAll('.result.warn');
            const failResults = resultsDiv.querySelectorAll('.result.fail');
            const infoResults = resultsDiv.querySelectorAll('.result.info');

            const extract = (elements) => {
                return Array.from(elements).map(el => el.textContent.trim());
            };

            return {
                passed: extract(passResults),
                warnings: extract(warnResults),
                failures: extract(failResults),
                info: extract(infoResults),
                totalPassed: passResults.length,
                totalWarnings: warnResults.length,
                totalFailures: failResults.length
            };
        });

        // Display results
        console.log('\x1b[34m============================================================\x1b[0m');
        console.log('\x1b[34m📊 Benchmark Results\x1b[0m');
        console.log('\x1b[34m============================================================\x1b[0m');
        console.log();

        // Show passed benchmarks
        if (results.passed.length > 0) {
            results.passed.forEach(result => {
                console.log(`   \x1b[32m${result}\x1b[0m`);
            });
        }

        // Show warnings
        if (results.warnings.length > 0) {
            console.log();
            console.log('\x1b[33m⚠️  Performance Warnings:\x1b[0m');
            results.warnings.forEach(result => {
                console.log(`   \x1b[33m${result}\x1b[0m`);
            });
        }

        // Show failures
        if (results.failures.length > 0) {
            console.log();
            console.log('\x1b[31m❌ Benchmark Errors:\x1b[0m');
            results.failures.forEach(result => {
                console.log(`   \x1b[31m${result}\x1b[0m`);
            });
        }

        // Show summary info
        if (results.info.length > 0) {
            console.log();
            console.log('\x1b[36m📈 Summary:\x1b[0m');
            results.info.forEach(result => {
                console.log(`   \x1b[36m${result}\x1b[0m`);
            });
        }

        console.log();
        console.log('\x1b[34m============================================================\x1b[0m');

        // Final status
        if (results.totalFailures > 0) {
            console.log(`\x1b[31m❌ ${results.totalFailures} benchmark(s) encountered errors\x1b[0m`);
            process.exit(1);
        } else if (results.totalWarnings > 0) {
            console.log(`\x1b[33m⚠️  ${results.totalWarnings} benchmark(s) exceeded thresholds\x1b[0m`);
            console.log(`\x1b[32m✅ ${results.totalPassed} benchmark(s) passed\x1b[0m`);
        } else {
            console.log(`\x1b[32m🎉 All ${results.totalPassed} benchmarks passed!\x1b[0m`);
        }

        console.log('\x1b[34m============================================================\x1b[0m');

    } catch (error) {
        console.error('\x1b[31m❌ Error running benchmarks:\x1b[0m', error.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

// Run benchmarks
runPerformanceBenchmarks().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
