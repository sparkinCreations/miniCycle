/**
 * Automated Browser Test Runner
 * Uses Playwright to run the existing browser test suite
 *
 * Usage:
 *   npm test                     # Run all tests
 *   npm test -- routineManager   # Run single module
 *   npm test -- task             # Run all modules matching "task"
 *   npm test -- --list           # List all available modules
 */

const { chromium } = require('playwright');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// All available test modules (50 modules - matches browser "Run All Tests")
const ALL_MODULES = [
    'integration', 'themeManager', 'deviceDetection', 'routineLoader', 'statsPanel',
    'consoleCapture', 'state', 'recurringCore', 'recurringIntegration', 'recurringPanel',
    'globalUtils', 'notifications', 'dragDropManager', 'migrationManager', 'dueDates',
    'reminders', 'modeManager', 'routineSwitcher', 'routineManager', 'undoRedoManager',
    'gamesManager', 'onboardingManager', 'guidedTourManager', 'modalManager', 'menuManager', 'settingsManager',
    'completedTasksManager', 'pullToRefresh', 'taskCore', 'taskValidation', 'taskUtils', 'taskRenderer',
    'taskEvents', 'taskDOM', 'taskOptionsCustomizer', 'taskUI', 'taskInteractions', 'uiEffects',
    'xss-vulnerability', 'errorHandler', 'testingModal', 'backupManager', 'cycleCompletion',
    'dataValidator', 'appInit', 'appState', 'helpWindowManager', 'constants', 'basicPluginSystem',
    'accessibility', 'stress', 'coreBoot', 'uiBoot', 'featureBoot'
];

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);

    // Check for --list flag
    if (args.includes('--list') || args.includes('-l')) {
        console.log(`\n${colors.blue}Available test modules (${ALL_MODULES.length}):${colors.reset}\n`);
        ALL_MODULES.forEach((mod, i) => {
            console.log(`  ${colors.cyan}${(i + 1).toString().padStart(2)}.${colors.reset} ${mod}`);
        });
        console.log(`\n${colors.yellow}Usage:${colors.reset}`);
        console.log(`  npm test                     ${colors.cyan}# Run all tests${colors.reset}`);
        console.log(`  npm test -- routineManager   ${colors.cyan}# Run single module${colors.reset}`);
        console.log(`  npm test -- task             ${colors.cyan}# Run all modules matching "task"${colors.reset}`);
        console.log(`  npm test -- --list           ${colors.cyan}# Show this list${colors.reset}\n`);
        process.exit(0);
    }

    // Filter out flags, get module filter
    const moduleFilter = args.filter(arg => !arg.startsWith('-'))[0];

    if (!moduleFilter) {
        return ALL_MODULES; // Run all
    }

    // Find matching modules (case-insensitive partial match)
    const lowerFilter = moduleFilter.toLowerCase();
    const matchingModules = ALL_MODULES.filter(mod =>
        mod.toLowerCase().includes(lowerFilter)
    );

    if (matchingModules.length === 0) {
        console.error(`${colors.red}❌ No modules match "${moduleFilter}"${colors.reset}`);
        console.log(`\n${colors.yellow}Available modules:${colors.reset} ${ALL_MODULES.join(', ')}`);
        console.log(`\nRun ${colors.cyan}npm test -- --list${colors.reset} to see all modules.\n`);
        process.exit(1);
    }

    return matchingModules;
}

// Get modules to test based on CLI args
const modules = parseArgs();

async function runModuleTests(page, moduleName) {
    console.log(`\n${colors.cyan}🧪 Testing ${moduleName}...${colors.reset}`);

    try {
        // Navigate to test suite with cache buster to force fresh module loads
        const cacheBuster = Date.now();
        await page.goto(`http://localhost:8080/tests/module-test-suite.html?v=${cacheBuster}`, {
            waitUntil: 'networkidle',
            timeout: 10000
        });

        // Select module
        await page.selectOption('#module-select', moduleName);

        // Wait for module to load (taskCore needs extra time for initialization)
        const loadWait = moduleName === 'taskCore' ? 3000 : 500;
        await page.waitForTimeout(loadWait);

        // Click Run Tests button
        await page.click('#run-tests-btn');

        // Wait a bit for tests to start
        await page.waitForTimeout(500);

        // Wait for results (increased timeout for heavy test modules)
        const timeout = moduleName === 'stress' ? 180000 : moduleName === 'taskCore' ? 60000 : 45000;
        await page.waitForSelector('h3:has-text("Results:")', { timeout });

        // Extract summary (h3 with "Results:" text)
        const summary = await page.textContent('h3:has-text("Results:")');

        // Parse passed/total from summary text (e.g., "Results: 27/27 tests passed (100%)")
        const match = summary.match(/(\d+)\/(\d+)/);
        const passedTests = match ? parseInt(match[1]) : 0;
        const totalTests = match ? parseInt(match[2]) : 0;
        const failedTests = totalTests - passedTests;

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
    const isFiltered = modules.length < ALL_MODULES.length;
    const headerText = isFiltered
        ? `🧪 Testing ${modules.length} module${modules.length > 1 ? 's' : ''}: ${modules.join(', ')}`
        : '🚀 miniCycle Automated Test Suite';

    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}${headerText}${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

    const startTime = Date.now();

    // Launch browser
    console.log(`\n${colors.cyan}🌐 Launching browser...${colors.reset}`);
    const browser = await chromium.launch({
        headless: true // Set to false to see browser
    });

    // Create context with cache disabled to ensure fresh module loads
    const context = await browser.newContext({
        bypassCSP: true
    });

    // Grant notification permissions for reminder tests
    await context.grantPermissions(['notifications'], { origin: 'http://localhost:8080' });

    // Add init script to mock Notification API and capture errors
    await context.addInitScript(() => {
        window.__MINICYCLE_TEST__ = true;
        // Capture errors with full stack traces
        window.onerror = function(message, source, lineno, colno, error) {
            console.error(`[SYNTAX ERROR] ${message} at ${source}:${lineno}:${colno}`);
            if (error && error.stack) {
                console.error(`[STACK] ${error.stack}`);
            }
        };
        if (typeof Notification === 'undefined') {
            window.Notification = function (title, opts) { return { close() {} }; };
        }
        Notification.permission = 'granted';
        Notification.requestPermission = () => Promise.resolve('granted');
    });

    const results = [];

    // Run tests for each module
    for (const module of modules) {
        const page = await context.newPage();
        // Log console messages for debugging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`   ${colors.red}Console error: ${msg.text()}${colors.reset}`);
                // Try to get location info from message
                const location = msg.location();
                if (location && location.url) {
                    console.log(`   ${colors.red}  at ${location.url}:${location.lineNumber}:${location.columnNumber}${colors.reset}`);
                }
            }
        });
        page.on('pageerror', error => {
            console.log(`   ${colors.red}Page error: ${error.message}${colors.reset}`);
            // Log full error details including file/line info
            console.log(`   ${colors.red}Full error: ${error.toString()}${colors.reset}`);
            console.log(`   ${colors.red}Error name: ${error.name}${colors.reset}`);
        });
        // Log network request failures
        page.on('requestfailed', request => {
            console.log(`   ${colors.yellow}Request failed: ${request.url()} - ${request.failure()?.errorText}${colors.reset}`);
        });
        // Disable cache for this page to ensure fresh module loads
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
