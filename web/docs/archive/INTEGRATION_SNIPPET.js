/**
 * RECURRING MODULES INTEGRATION SNIPPET
 *
 * Copy and paste this code into miniCycle-scripts.js
 * inside the DOMContentLoaded handler, AFTER AppState initialization
 *
 * Location: After line ~700 where AppState is created
 */

// ============================================
// 🔄 RECURRING MODULES INITIALIZATION
// ============================================

console.log('🔄 Initializing recurring task modules...');

try {
    // Import integration helper
    const { initializeRecurringModules } = await import('./modules/recurring/recurringIntegration.js');

    // Initialize both modules (handles all wiring automatically)
    const recurringModules = await initializeRecurringModules();

    console.log('✅ Recurring modules initialized successfully');

    // Store references for debugging
    window._recurringModules = recurringModules;

    // Optional: Run integration test in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🧪 Running integration test...');
        setTimeout(() => {
            const results = window.testRecurringIntegration();
            if (Object.values(results).every(r => r === true)) {
                console.log('🎉 Recurring integration test PASSED');
            } else {
                console.warn('⚠️ Some recurring integration tests failed:', results);
            }
        }, 1000);
    }

} catch (error) {
    console.error('❌ Failed to initialize recurring modules:', error);

    // Show user-facing error
    if (typeof showNotification === 'function') {
        showNotification('Recurring feature unavailable', 'warning', 3000);
    }

    // Don't throw - let app continue without recurring feature
    console.warn('⚠️ App will continue without recurring functionality');
}

console.log('✅ Recurring modules integration complete');

// ============================================
// END RECURRING MODULES INITIALIZATION
// ============================================
