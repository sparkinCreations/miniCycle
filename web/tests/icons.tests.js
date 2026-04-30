/**
 * Icons Tests
 * Tests for modules/utils/icons.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runIconsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/icons.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>Icons Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('ICONS is an object with entries', () => {
        if (typeof mod.ICONS !== 'object' || mod.ICONS === null) {
            throw new Error(`Expected object, got ${typeof mod.ICONS}`);
        }
        if (Object.keys(mod.ICONS).length === 0) {
            throw new Error('ICONS has no entries');
        }
    });

    await test('FA_MAP is an exported object', () => {
        if (typeof mod.FA_MAP !== 'object' || mod.FA_MAP === null) {
            throw new Error(`Expected object, got ${typeof mod.FA_MAP}`);
        }
    });

    await test('getIcon is an exported function', () => {
        if (typeof mod.getIcon !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.getIcon}`);
        }
    });

    await test('getIcon returns a string for a known icon', () => {
        // Try a common icon name — if it exists, result should be a string
        const firstKey = Object.keys(mod.ICONS)[0];
        if (firstKey) {
            const result = mod.getIcon(firstKey);
            if (typeof result !== 'string') {
                throw new Error(`Expected string, got ${typeof result}`);
            }
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Menu Section Icons</h4>';

    /**
     * Lock the registration of icons used by the main menu's section
     * headers. If any of these are dropped from ICONS or mistyped in
     * FA_MAP, the section header would silently render nothing offline.
     */
    const menuSectionIcons = [
        'list',           // Routine Actions
        'check-circle',   // Task Actions & Features
        'trophy',         // Rewards & Extras
        'question-circle',// Help & Support
        'balance-scale',  // Legal & Info
        'cog',            // Settings & Personalization
        'scroll'          // Mode Info (toggle, not a collapsible section)
    ];

    await test('Menu section icons are registered in ICONS', () => {
        for (const name of menuSectionIcons) {
            if (!mod.ICONS[name]) {
                throw new Error(`Missing ICONS["${name}"] — menu section header would render empty offline`);
            }
            if (typeof mod.ICONS[name] !== 'string') {
                throw new Error(`ICONS["${name}"] should be an SVG string, got ${typeof mod.ICONS[name]}`);
            }
            if (!mod.ICONS[name].includes('<svg')) {
                throw new Error(`ICONS["${name}"] does not look like an SVG markup string`);
            }
        }
    });

    await test('Menu section icons have FA_MAP entries pointing to ICONS keys', () => {
        for (const name of menuSectionIcons) {
            const faKey = `fa-${name}`;
            if (!mod.FA_MAP[faKey]) {
                throw new Error(`Missing FA_MAP["${faKey}"] — replaceFAIcon() can't resolve <i class="fas ${faKey}">`);
            }
            if (mod.FA_MAP[faKey] !== name) {
                throw new Error(`FA_MAP["${faKey}"] should map to "${name}", got "${mod.FA_MAP[faKey]}"`);
            }
        }
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
