/**
 * Automated Browser Test Runner
 * Uses Playwright to run the existing browser test suite
 */

const { chromium } = require('playwright');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Test modules to run
const modules = ['themeManager', 'deviceDetection', 'globalUtils', 'notifications'];

async function runModuleTests(page, moduleName) {
    console.log(`\n${colors.cyan}🧪 Testing ${moduleName}...${colors.reset}`);

    try {
        // Navigate to test suite
        await page.goto('http://localhost:8080/tests/module-test-suite.html', {
            waitUntil: 'networkidle',
            timeout: 10000
        });

        // Select module
        await page.selectOption('#module-select', moduleName);

        // Wait for module to load
        await page.waitForTimeout(500);

        // Click Run Tests button
        await page.click('#run-tests-btn');

        // Wait for results
        await page.waitForSelector('h3:has-text("Results:")', { timeout: 30000 });

        // Extract summary
        const summary = await page.textContent('h3:last-of-type');

        // Extract individual test results
        const passedTests = await page.$$eval('.result.pass', els => els.length);
        const failedTests = await page.$$eval('.result.fail', els => els.length);

        // Get failed test details if any
        let failedDetails = [];
        if (failedTests > 0) {
            failedDetails = await page.$$eval('.result.fail', els =>
                els.map(el => el.textContent.trim())
            );
        }

        // Determine if all passed
        const allPassed = failedTests === 0;

        // Print results
        if (allPassed) {
            console.log(`   ${colors.green}✅ ${summary}${colors.reset}`);
        } else {
            console.log(`   ${colors.red}❌ ${summary}${colors.reset}`);
            console.log(`\n   ${colors.yellow}Failed tests:${colors.reset}`);
            failedDetails.forEach(detail => {
                console.log(`   ${colors.red}  • ${detail}${colors.reset}`);
            });
        }

        return {
            module: moduleName,
            passed: allPassed,
            passedCount: passedTests,
            failedCount: failedTests,
            summary,
            failedDetails
        };

    } catch (error) {
        console.log(`   ${colors.red}❌ Error running tests: ${error.message}${colors.reset}`);
        return {
            module: moduleName,
            passed: false,
            passedCount: 0,
            failedCount: 1,
            summary: 'Test execution failed',
            error: error.message
        };
    }
}

async function runAllTests() {
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}🚀 miniCycle Automated Test Suite${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

    const startTime = Date.now();

    // Launch browser
    console.log(`\n${colors.cyan}🌐 Launching browser...${colors.reset}`);
    const browser = await chromium.launch({
        headless: true // Set to false to see browser
    });

    const results = [];

    // Run tests for each module
    for (const module of modules) {
        const page = await browser.newPage();
        const result = await runModuleTests(page, module);
        results.push(result);
        await page.close();
    }

    await browser.close();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Print summary
    console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}📊 Test Summary (${duration}s)${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

    let totalPassed = 0;
    let totalFailed = 0;

    results.forEach(r => {
        const status = r.passed ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`;
        console.log(`   ${status} ${r.module.padEnd(20)} ${r.passedCount}/${r.passedCount + r.failedCount} tests`);
        totalPassed += r.passedCount;
        totalFailed += r.failedCount;
    });

    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

    const allPassed = results.every(r => r.passed);
    const totalTests = totalPassed + totalFailed;
    const percentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

    if (allPassed) {
        console.log(`${colors.green}🎉 All tests passed! (${totalPassed}/${totalTests} - ${percentage}%)${colors.reset}`);
    } else {
        console.log(`${colors.red}⚠️  Some tests failed (${totalPassed}/${totalTests} - ${percentage}%)${colors.reset}`);
    }

    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

    // Exit with proper code for CI/CD
    process.exit(allPassed ? 0 : 1);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error(`${colors.red}❌ Unhandled error: ${error.message}${colors.reset}`);
    process.exit(1);
});

// Run tests
runAllTests().catch(error => {
    console.error(`${colors.red}❌ Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
});
