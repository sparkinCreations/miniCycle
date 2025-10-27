/**
 * Quick test script for task modules
 * Tests taskValidation, taskUtils, taskRenderer, and taskDOM to ensure nothing broke
 */

const { chromium } = require('playwright');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const modules = ['taskValidation', 'taskUtils', 'taskRenderer', 'taskEvents', 'taskDOM'];

async function runModuleTests(page, moduleName) {
    console.log(`\n${colors.cyan}🧪 Testing ${moduleName}...${colors.reset}`);

    try {
        const cacheBuster = Date.now();
        await page.goto(`http://localhost:8080/tests/module-test-suite.html?v=${cacheBuster}`, {
            waitUntil: 'networkidle',
            timeout: 10000
        });

        await page.selectOption('#module-select', moduleName);
        await page.waitForTimeout(500);
        await page.click('#run-tests-btn');
        await page.waitForTimeout(500);

        const timeout = 45000;
        await page.waitForSelector('h3:has-text("Results:")', { timeout });

        const summary = await page.textContent('h3:has-text("Results:")');
        const match = summary.match(/(\d+)\/(\d+)/);
        const passedTests = match ? parseInt(match[1]) : 0;
        const totalTests = match ? parseInt(match[2]) : 0;
        const failedTests = totalTests - passedTests;

        let failedDetails = [];
        if (failedTests > 0) {
            failedDetails = await page.$$eval('.result.fail', els =>
                els.map(el => el.textContent.trim())
            );
        }

        const allPassed = failedTests === 0;

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

async function runTests() {
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}🚀 Task Modules Quick Test${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

    const startTime = Date.now();

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ bypassCSP: true });
    await context.grantPermissions(['notifications'], { origin: 'http://localhost:8080' });

    await context.addInitScript(() => {
        window.__MINICYCLE_TEST__ = true;
        if (typeof Notification === 'undefined') {
            window.Notification = function (title, opts) { return { close() {} }; };
        }
        Notification.permission = 'granted';
        Notification.requestPermission = () => Promise.resolve('granted');
    });

    const results = [];

    for (const module of modules) {
        const page = await context.newPage();
        await page.route('**/*', async (route) => {
            await route.continue({ headers: { ...route.request().headers(), 'Cache-Control': 'no-cache' } });
        });
        const result = await runModuleTests(page, module);
        results.push(result);
        await page.close();
    }

    await context.close();
    await browser.close();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

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

    process.exit(allPassed ? 0 : 1);
}

runTests().catch(error => {
    console.error(`${colors.red}❌ Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
});
