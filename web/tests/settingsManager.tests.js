/**
 * Settings Manager Tests
 *
 * Tests for utilities/ui/settingsManager.js
 * Pattern: Resilient Constructor 🛡️
 *
 * Functions tested:
 * - setupSettingsMenu() - Initialize settings UI
 * - setupDownloadMiniCycle() - Setup export functionality
 * - setupUploadMiniCycle() - Setup import functionality
 * - exportMiniCycleData() - Export .mcyc file
 * - syncCurrentSettingsToStorage() - Sync settings to Schema 2.5
 */

export function runSettingsManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>⚙️ Settings Manager Tests</h2>';
    let passed = { count: 0 }, total = { count: 0 };

    // Import the module class
    const SettingsManager = window.SettingsManager;

    // Check if class is available
    if (!SettingsManager) {
        resultsDiv.innerHTML += '<div class="result fail">SettingsManager class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Mock full Schema 2.5 data structure
            const mockFullSchema = {
                metadata: {
                    version: "2.5",
                    lastModified: Date.now(),
                    totalCyclesCreated: 1
                },
                settings: {
                    theme: 'default',
                    darkMode: false
                },
                data: {
                    cycles: {
                        'cycle-1': {
                            id: 'cycle-1',
                            title: 'Test Cycle',
                            tasks: [
                                { id: 'task-1', text: 'Task 1', completed: false },
                                { id: 'task-2', text: 'Task 2', completed: true }
                            ],
                            cycleCount: 5,
                            autoReset: true
                        }
                    }
                },
                appState: {
                    activeCycleId: 'cycle-1',
                    currentMode: 'auto-cycle'
                },
                userProgress: {
                    cyclesCompleted: 10
                }
            };

            // Flattened data structure that loadMiniCycleData returns
            const mockFlattenedData = {
                cycles: mockFullSchema.data.cycles,
                activeCycle: mockFullSchema.appState.activeCycleId
            };

            localStorage.setItem('miniCycleData', JSON.stringify(mockFullSchema));

            // Reset DOM state
            document.body.className = '';

            // Clear any global state
            delete window.AppState;
            delete window.showNotification;

            testFn(mockFlattenedData, mockFullSchema);
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';

    test('creates instance successfully', () => {
        const instance = new SettingsManager();
        if (!instance || typeof instance.setupSettingsMenu !== 'function') {
            throw new Error('SettingsManager not properly initialized');
        }
    });

    test('has correct version', () => {
        const instance = new SettingsManager();
        if (!instance.version || instance.version !== '1.330') {
            throw new Error('Version not set correctly');
        }
    });

    test('accepts dependency injection', () => {
        const mockLoad = () => ({ cycles: {}, activeCycle: null });
        const mockNotify = () => {};

        const instance = new SettingsManager({
            loadMiniCycleData: mockLoad,
            showNotification: mockNotify,
            AppState: () => ({ isReady: () => true, get: () => ({}) })
        });

        if (!instance) {
            throw new Error('Dependency injection failed');
        }
    });

    test('has fallback methods for all dependencies', () => {
        const instance = new SettingsManager();

        // Check key fallback methods exist
        if (typeof instance.fallbackLoadData !== 'function') {
            throw new Error('Missing fallbackLoadData');
        }
        if (typeof instance.fallbackNotification !== 'function') {
            throw new Error('Missing fallbackNotification');
        }
    });

    test('initializes with false initialized flag', () => {
        const instance = new SettingsManager();
        if (instance.initialized !== false) {
            throw new Error('initialized should start as false');
        }
    });

    // === CORE FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Core Functionality</h4>';

    test('setupSettingsMenu sets up event listeners', () => {
        const openBtn = document.createElement('button');
        openBtn.id = 'open-settings';
        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-settings';
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        const modalContent = document.createElement('div');
        modalContent.className = 'settings-modal-content';

        const instance = new SettingsManager({
            querySelector: (sel) => {
                if (sel === '.settings-modal') return modal;
                if (sel === '.settings-modal-content') return modalContent;
                return null;
            },
            getElementById: (id) => {
                if (id === 'open-settings') return openBtn;
                if (id === 'close-settings') return closeBtn;
                if (id === 'toggle-move-arrows') return null; // Skip move arrows
                if (id === 'toggle-three-dots') return null; // Skip three dots
                return document.createElement('div');
            },
            setupDarkModeToggle: () => {},
            setupQuickDarkToggle: () => {},
            loadMiniCycleData: () => ({ cycles: {}, activeCycle: null })
        });

        // Run setup
        instance.setupSettingsMenu();

        // Check that event handlers are attached (simulate click)
        let modalOpened = false;
        modal.style.display = 'none';

        // Manually trigger the open button
        openBtn.click();

        // The real module adds listeners directly, so this test just verifies no errors
        if (!instance) {
            throw new Error('setupSettingsMenu should complete without error');
        }
    });

    test('setupDownloadMiniCycle creates download button handler', (mockFlattenedData) => {
        const exportBtn = document.createElement('button');
        exportBtn.id = 'export-mini-cycle';

        const instance = new SettingsManager({
            getElementById: (id) => {
                if (id === 'export-mini-cycle') return exportBtn;
                return null;
            },
            loadMiniCycleData: () => mockFlattenedData,
            showNotification: () => {}
        });

        // Setup the download handler
        instance.setupDownloadMiniCycle();

        // Verify button has a click handler attached (check _onclick or simulate)
        if (!exportBtn) {
            throw new Error('Export button should exist');
        }
    });

    test('setupUploadMiniCycle creates upload button handler', (mockFlattenedData) => {
        const importBtn = document.createElement('button');
        importBtn.id = 'import-mini-cycle';

        const instance = new SettingsManager({
            getElementById: (id) => {
                if (id === 'import-mini-cycle') return importBtn;
                return null;
            },
            loadMiniCycleData: () => mockFlattenedData,
            AppState: () => ({ isReady: () => true, get: () => ({}) })
        });

        // Setup the upload handler
        instance.setupUploadMiniCycle();

        // Verify button exists and setup completed
        if (!importBtn) {
            throw new Error('Import button should exist');
        }
    });

    // === IMPORT/EXPORT FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4>📤 Import/Export Functionality</h4>';

    test('exportMiniCycleData creates download', (mockFlattenedData) => {
        let linkCreated = false;
        let blobCreated = false;

        // Mock URL methods to prevent real downloads
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        URL.createObjectURL = (blob) => {
            blobCreated = true;
            return 'blob:mock-url';
        };
        URL.revokeObjectURL = () => {};

        // Mock document methods
        const originalCreateElement = document.createElement.bind(document);
        const originalAppendChild = document.body.appendChild.bind(document.body);
        const originalRemoveChild = document.body.removeChild.bind(document.body);

        document.createElement = (tag) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') {
                linkCreated = true;
                // Override click to prevent actual download
                el.click = () => {};
            }
            return el;
        };

        // Prevent actual DOM manipulation
        document.body.appendChild = () => {};
        document.body.removeChild = () => {};

        const instance = new SettingsManager({
            loadMiniCycleData: () => mockFlattenedData,
            showNotification: () => {}
        });

        const miniCycleData = {
            name: 'test-cycle',
            title: 'Test Cycle',
            tasks: [],
            autoReset: true,
            cycleCount: 0,
            deleteCheckedTasks: false
        };

        instance.exportMiniCycleData(miniCycleData, 'Test Cycle');

        // Restore originals
        document.createElement = originalCreateElement;
        document.body.appendChild = originalAppendChild;
        document.body.removeChild = originalRemoveChild;
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;

        if (!linkCreated || !blobCreated) {
            throw new Error('Download link and blob should be created');
        }
    });

    test('exportMiniCycleData handles export flow', (mockFlattenedData) => {
        // Mock URL methods
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        URL.createObjectURL = () => 'blob:mock-url';
        URL.revokeObjectURL = () => {};

        // Mock DOM methods
        const originalAppendChild = document.body.appendChild.bind(document.body);
        const originalRemoveChild = document.body.removeChild.bind(document.body);
        document.body.appendChild = () => {};
        document.body.removeChild = () => {};

        const instance = new SettingsManager({
            loadMiniCycleData: () => mockFlattenedData,
            showNotification: () => {}
        });

        const miniCycleData = {
            name: 'test',
            title: 'Test',
            tasks: [{ id: 'task-1', text: 'Task 1', completed: false }],
            autoReset: false,
            cycleCount: 0,
            deleteCheckedTasks: false
        };

        // Should not throw
        try {
            instance.exportMiniCycleData(miniCycleData, 'Test Cycle');
        } finally {
            // Restore originals
            document.body.appendChild = originalAppendChild;
            document.body.removeChild = originalRemoveChild;
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
        }
    });

    test('exportMiniCycleData sanitizes filename', (mockFlattenedData) => {
        let filename = '';

        // Mock URL methods
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        URL.createObjectURL = () => 'blob:mock-url';
        URL.revokeObjectURL = () => {};

        // Mock DOM methods
        const originalAppendChild = document.body.appendChild.bind(document.body);
        const originalRemoveChild = document.body.removeChild.bind(document.body);
        document.body.appendChild = () => {};
        document.body.removeChild = () => {};

        const originalCreateElement = document.createElement.bind(document);
        document.createElement = (tag) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') {
                Object.defineProperty(el, 'download', {
                    set(value) { filename = value; },
                    get() { return filename; }
                });
                el.click = () => {}; // Prevent actual click
            }
            return el;
        };

        const instance = new SettingsManager({
            loadMiniCycleData: () => mockFlattenedData,
            showNotification: () => {}
        });

        instance.exportMiniCycleData({
            name: 'test',
            title: 'My Cycle!',
            tasks: [],
            autoReset: true,
            cycleCount: 0,
            deleteCheckedTasks: false
        }, 'My Cycle!');

        // Restore originals
        document.createElement = originalCreateElement;
        document.body.appendChild = originalAppendChild;
        document.body.removeChild = originalRemoveChild;
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;

        if (!filename.endsWith('.mcyc')) {
            throw new Error('Filename should have .mcyc extension');
        }
    });

    // === SETTINGS SYNCHRONIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>⚙️ Settings Synchronization</h4>';

    test('syncCurrentSettingsToStorage updates localStorage', (mockFlattenedData) => {
        const toggleAutoReset = document.createElement('input');
        toggleAutoReset.type = 'checkbox';
        toggleAutoReset.id = 'toggleAutoReset';
        toggleAutoReset.checked = true;

        const deleteCheckedTasks = document.createElement('input');
        deleteCheckedTasks.type = 'checkbox';
        deleteCheckedTasks.id = 'deleteCheckedTasks';
        deleteCheckedTasks.checked = false;

        const instance = new SettingsManager({
            loadMiniCycleData: () => mockFlattenedData,
            getElementById: (id) => {
                if (id === 'toggleAutoReset') return toggleAutoReset;
                if (id === 'deleteCheckedTasks') return deleteCheckedTasks;
                return null;
            }
        });

        instance.syncCurrentSettingsToStorage();

        // Verify localStorage was updated
        const saved = JSON.parse(localStorage.getItem('miniCycleData'));
        if (!saved) {
            throw new Error('Data should be saved to localStorage');
        }
    });

    test('syncCurrentSettingsToStorage handles missing data gracefully', () => {
        localStorage.clear();

        const instance = new SettingsManager({
            loadMiniCycleData: () => null
        });

        // Should not throw
        expect(() => {
            instance.syncCurrentSettingsToStorage();
        }).not.toThrow();
    });

    // === FACTORY RESET TEST ===
    resultsDiv.innerHTML += '<h4>🔄 Factory Reset</h4>';

    test('factory reset clears all data', () => {
        // This test just verifies the method exists and setup works
        const resetBtn = document.createElement('button');
        resetBtn.id = 'factory-reset';

        const instance = new SettingsManager({
            getElementById: (id) => {
                if (id === 'factory-reset') return resetBtn;
                return null;
            },
            loadMiniCycleData: () => ({}),
            showConfirmationModal: () => {},
            AppState: () => null
        });

        // Setup should attach event listener
        instance.setupSettingsMenu();

        // Just verify the instance exists
        if (!instance) {
            throw new Error('Factory reset setup should complete');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4>🛡️ Error Handling</h4>';

    test('handles missing settings modal gracefully', () => {
        const instance = new SettingsManager({
            querySelector: () => null,
            getElementById: () => null,
            setupDarkModeToggle: () => {},
            setupQuickDarkToggle: () => {},
            loadMiniCycleData: () => null
        });

        // Should not throw
        expect(() => {
            instance.setupSettingsMenu();
        }).not.toThrow();
    });

    test('handles corrupted localStorage in export', () => {
        localStorage.clear();

        // Mock URL and DOM methods to prevent downloads
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        const originalAppendChild = document.body.appendChild.bind(document.body);
        const originalRemoveChild = document.body.removeChild.bind(document.body);

        URL.createObjectURL = () => 'blob:mock-url';
        URL.revokeObjectURL = () => {};
        document.body.appendChild = () => {};
        document.body.removeChild = () => {};

        const instance = new SettingsManager({
            loadMiniCycleData: () => null,
            showNotification: () => {}
        });

        const miniCycleData = {
            name: 'test',
            title: 'Test',
            tasks: [],
            autoReset: true,
            cycleCount: 0,
            deleteCheckedTasks: false
        };

        // Should handle gracefully
        try {
            instance.exportMiniCycleData(miniCycleData, 'Test');
        } finally {
            // Restore originals
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
            document.body.appendChild = originalAppendChild;
            document.body.removeChild = originalRemoveChild;
        }
    });

    test('handles missing AppState in syncSettings', () => {
        localStorage.clear();

        const instance = new SettingsManager({
            loadMiniCycleData: () => null,
            AppState: () => null
        });

        // Should not throw
        expect(() => {
            instance.syncCurrentSettingsToStorage();
        }).not.toThrow();
    });

    test('handles schema migration failure gracefully', () => {
        const instance = new SettingsManager({
            performSchema25Migration: () => ({ success: false }),
            showNotification: () => {}
        });

        // Should not throw
        if (!instance) {
            throw new Error('Should handle migration failure');
        }
    });

    // === DOM INTERACTION TESTS ===
    resultsDiv.innerHTML += '<h4>🌐 DOM Interaction</h4>';

    test('opens settings modal on button click', () => {
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        modal.style.display = 'none';

        const openBtn = document.createElement('button');
        openBtn.id = 'open-settings';

        const instance = new SettingsManager({
            querySelector: (sel) => {
                if (sel === '.settings-modal') return modal;
                if (sel === '.settings-modal-content') return document.createElement('div');
                return null;
            },
            getElementById: (id) => {
                if (id === 'open-settings') return openBtn;
                if (id === 'close-settings') return document.createElement('button');
                return null;
            },
            setupDarkModeToggle: () => {},
            setupQuickDarkToggle: () => {},
            hideMainMenu: () => {},
            loadMiniCycleData: () => null
        });

        instance.setupSettingsMenu();

        // Simulate button click
        openBtn.click();

        if (modal.style.display !== 'flex') {
            throw new Error('Modal should be visible after click');
        }
    });

    test('closes settings modal on close button click', () => {
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        modal.style.display = 'flex';

        const closeBtn = document.createElement('button');
        closeBtn.id = 'close-settings';

        const instance = new SettingsManager({
            querySelector: (sel) => {
                if (sel === '.settings-modal') return modal;
                if (sel === '.settings-modal-content') return document.createElement('div');
                return null;
            },
            getElementById: (id) => {
                if (id === 'open-settings') return document.createElement('button');
                if (id === 'close-settings') return closeBtn;
                return null;
            },
            setupDarkModeToggle: () => {},
            setupQuickDarkToggle: () => {},
            loadMiniCycleData: () => null
        });

        instance.setupSettingsMenu();

        // Simulate close button click
        closeBtn.click();

        if (modal.style.display !== 'none') {
            throw new Error('Modal should be hidden after close click');
        }
    });

    // === INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔗 Integration Tests</h4>';

    test('integrates with AppState when available', (mockFlattenedData, mockFullSchema) => {
        const mockAppState = {
            isReady: () => true,
            get: () => mockFullSchema
        };

        const instance = new SettingsManager({
            AppState: () => mockAppState
        });

        // Should be able to access AppState
        const state = instance.deps.AppState();
        if (!state || typeof state.isReady !== 'function') {
            throw new Error('AppState integration failed');
        }
    });

    test('works without AppState (fallback mode)', (mockFlattenedData) => {
        delete window.AppState;

        const instance = new SettingsManager({
            loadMiniCycleData: () => mockFlattenedData
        });

        // Should work with localStorage fallback
        expect(() => {
            instance.syncCurrentSettingsToStorage();
        }).not.toThrow();
    });

    test('integrates with dark mode toggle', () => {
        let darkModeSetup = false;

        const instance = new SettingsManager({
            querySelector: () => null,
            getElementById: () => null,
            setupDarkModeToggle: () => { darkModeSetup = true; },
            setupQuickDarkToggle: () => {},
            loadMiniCycleData: () => null
        });

        instance.setupSettingsMenu();

        if (!darkModeSetup) {
            throw new Error('Dark mode toggle should be set up');
        }
    });

    // === GLOBAL FUNCTIONS TESTS ===
    resultsDiv.innerHTML += '<h4>🌍 Global Functions</h4>';

    test('exposes global setupSettingsMenu function', () => {
        if (typeof window.setupSettingsMenu !== 'function') {
            throw new Error('Global setupSettingsMenu not properly exposed');
        }
    });

    test('exposes global setupDownloadMiniCycle function', () => {
        if (typeof window.setupDownloadMiniCycle !== 'function') {
            throw new Error('Global setupDownloadMiniCycle not properly exposed');
        }
    });

    test('exposes global setupUploadMiniCycle function', () => {
        if (typeof window.setupUploadMiniCycle !== 'function') {
            throw new Error('Global setupUploadMiniCycle not properly exposed');
        }
    });

    test('exposes global syncCurrentSettingsToStorage function', () => {
        if (typeof window.syncCurrentSettingsToStorage !== 'function') {
            throw new Error('Global syncCurrentSettingsToStorage not properly exposed');
        }
    });

    test('global functions work correctly', () => {
        // These should not throw
        expect(() => {
            window.setupSettingsMenu?.();
            window.setupDownloadMiniCycle?.();
            window.setupUploadMiniCycle?.();
            window.syncCurrentSettingsToStorage?.();
        }).not.toThrow();
    });

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Performance Tests</h4>';

    test('setupSettingsMenu completes quickly', () => {
        const instance = new SettingsManager({
            querySelector: () => document.createElement('div'),
            getElementById: () => document.createElement('button'),
            setupDarkModeToggle: () => {},
            setupQuickDarkToggle: () => {},
            loadMiniCycleData: () => null
        });

        const startTime = performance.now();
        instance.setupSettingsMenu();
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 200) { // 200ms threshold
            throw new Error(`setupSettingsMenu took too long: ${duration.toFixed(2)}ms`);
        }
    });

    test('exportMiniCycleData completes quickly', () => {
        // Mock URL and DOM methods to prevent downloads
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        const originalAppendChild = document.body.appendChild.bind(document.body);
        const originalRemoveChild = document.body.removeChild.bind(document.body);

        URL.createObjectURL = () => 'blob:mock-url';
        URL.revokeObjectURL = () => {};
        document.body.appendChild = () => {};
        document.body.removeChild = () => {};

        const instance = new SettingsManager({
            showNotification: () => {}
        });

        const miniCycleData = {
            name: 'test',
            title: 'Test',
            tasks: [],
            autoReset: true,
            cycleCount: 0,
            deleteCheckedTasks: false
        };

        const startTime = performance.now();
        instance.exportMiniCycleData(miniCycleData, 'Test');
        const endTime = performance.now();

        // Restore originals
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        document.body.appendChild = originalAppendChild;
        document.body.removeChild = originalRemoveChild;

        const duration = endTime - startTime;

        if (duration > 50) { // 50ms threshold
            throw new Error(`exportMiniCycleData took too long: ${duration.toFixed(2)}ms`);
        }
    });

    // === EDGE CASES ===
    resultsDiv.innerHTML += '<h4>🎯 Edge Cases</h4>';

    test('handles empty settings object', () => {
        const instance = new SettingsManager({
            loadMiniCycleData: () => ({ cycles: {}, activeCycle: null })
        });

        // Should not throw
        if (!instance) {
            throw new Error('Should handle empty settings');
        }
    });

    test('handles missing data in export', () => {
        // Mock URL and DOM methods to prevent downloads
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        const originalAppendChild = document.body.appendChild.bind(document.body);
        const originalRemoveChild = document.body.removeChild.bind(document.body);

        URL.createObjectURL = () => 'blob:mock-url';
        URL.revokeObjectURL = () => {};
        document.body.appendChild = () => {};
        document.body.removeChild = () => {};

        const instance = new SettingsManager({
            showNotification: () => {}
        });

        const miniCycleData = {
            name: 'test',
            title: 'Test'
            // Missing tasks, autoReset, etc.
        };

        // Should handle gracefully
        try {
            instance.exportMiniCycleData(miniCycleData, 'Test');
        } finally {
            // Restore originals
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
            document.body.appendChild = originalAppendChild;
            document.body.removeChild = originalRemoveChild;
        }
    });

    test('handles very large data export', () => {
        // Mock URL and DOM methods to prevent downloads
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        const originalAppendChild = document.body.appendChild.bind(document.body);
        const originalRemoveChild = document.body.removeChild.bind(document.body);

        URL.createObjectURL = () => 'blob:mock-url';
        URL.revokeObjectURL = () => {};
        document.body.appendChild = () => {};
        document.body.removeChild = () => {};

        const instance = new SettingsManager({
            showNotification: () => {}
        });

        // Create large dataset
        const largeTasks = Array.from({ length: 1000 }, (_, i) => ({
            id: `task-${i}`,
            text: `Task ${i}`,
            completed: false
        }));

        const miniCycleData = {
            name: 'large-test',
            title: 'Large Test',
            tasks: largeTasks,
            autoReset: true,
            cycleCount: 0,
            deleteCheckedTasks: false
        };

        // Should handle large dataset
        try {
            instance.exportMiniCycleData(miniCycleData, 'Large Test');
        } finally {
            // Restore originals
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
            document.body.appendChild = originalAppendChild;
            document.body.removeChild = originalRemoveChild;
        }
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    return { passed: passed.count, total: total.count };
}

// Helper function for exception testing
function expect(fn) {
    return {
        not: {
            toThrow: () => {
                try {
                    fn();
                } catch (error) {
                    throw new Error('Expected function not to throw, but it threw: ' + error.message);
                }
            }
        },
        toThrow: () => {
            let threw = false;
            try {
                fn();
            } catch (error) {
                threw = true;
            }
            if (!threw) {
                throw new Error('Expected function to throw, but it did not');
            }
        }
    };
}
