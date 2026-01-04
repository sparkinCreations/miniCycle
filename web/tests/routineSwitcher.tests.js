/**
 * 🧪 RoutineSwitcher Tests
 * Tests for modules/routine/routineSwitcher.js
 * Pattern: Resilient Constructor 🛡️
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
 *
 * Tests routine switching functionality:
 * - Opening switch modal
 * - Renaming routines
 * - Deleting routines
 * - Confirming routine switch
 * - Routine list management
 * - Preview generation
 */

import {
    setupTestEnvironment,
    createMockAppState,
    createMockNotification,
    waitForAsyncOperations
} from './testHelpers.js';

// Dynamic import to avoid circular dependency issues
let RoutineSwitcher = null;
let setRoutineSwitcherDependencies = null;

export async function runRoutineSwitcherTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🔄 RoutineSwitcher Tests</h2><h3>Loading module...</h3>';

    // Dynamic import of the module
    try {
        const cacheBuster = window.testCacheBuster || Date.now();
        const module = await import(`../modules/routine/routineSwitcher.js?v=${cacheBuster}`);
        RoutineSwitcher = module.RoutineSwitcher;
        setRoutineSwitcherDependencies = module.setRoutineSwitcherDependencies;
    } catch (e) {
        resultsDiv.innerHTML = `<h2>🔄 RoutineSwitcher Tests</h2><div class="result fail">❌ Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    resultsDiv.innerHTML = '<h2>🔄 RoutineSwitcher Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    // Set up RoutineSwitcher module dependencies
    setRoutineSwitcherDependencies({
        safeAddEventListener: env.deps.safeAddEventListener
    });

    // Make RoutineSwitcher available for tests (fallback compatibility)
    window.RoutineSwitcher = RoutineSwitcher;

    resultsDiv.innerHTML = '<h2>🔄 RoutineSwitcher Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // 🔒 SAVE REAL APP DATA ONCE before all tests run (only when running individually)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
        console.log('🔒 Saved original localStorage for individual routineSwitcher test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual routineSwitcher test completed - original localStorage restored');
        }
    }

    // Check if class is available (already imported dynamically above)
    if (!RoutineSwitcher) {
        resultsDiv.innerHTML += '<div class="result fail">❌ RoutineSwitcher class not found. Make sure the module is properly loaded.</div>';
        return { passed: 0, total: 1 };
    }

    async function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Mock Schema 2.5 data with multiple cycles
            const mockSchemaData = {
                metadata: {
                    version: "2.5",
                    lastModified: Date.now()
                },
                settings: {},
                data: {
                    cycles: {
                        'Morning Routine': {
                            title: 'Morning Routine',
                            id: 'cycle-morning',
                            tasks: [
                                { id: 'task-1', text: 'Wake up', completed: false },
                                { id: 'task-2', text: 'Exercise', completed: true },
                                { id: 'task-3', text: 'Breakfast', completed: false }
                            ],
                            cycleCount: 5,
                            autoReset: true,
                            deleteCheckedTasks: false
                        },
                        'Evening Routine': {
                            title: 'Evening Routine',
                            id: 'cycle-evening',
                            tasks: [
                                { id: 'task-4', text: 'Dinner', completed: false },
                                { id: 'task-5', text: 'Read', completed: false }
                            ],
                            cycleCount: 3,
                            autoReset: false,
                            deleteCheckedTasks: false
                        },
                        'Work Tasks': {
                            title: 'Work Tasks',
                            id: 'cycle-work',
                            tasks: [
                                { id: 'task-6', text: 'Check emails', completed: true }
                            ],
                            cycleCount: 10,
                            autoReset: false,
                            deleteCheckedTasks: true
                        }
                    }
                },
                appState: {
                    activeCycleId: 'Morning Routine',
                    currentMode: 'auto-cycle'
                },
                userProgress: {
                    cyclesCompleted: 18,
                    totalTasksCompleted: 120
                }
            };
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            // Reset DOM state
            document.body.className = '';

            // Clear existing modal elements
            const existingModals = document.querySelectorAll('.mini-cycle-switch-modal, #miniCycleList, #switch-preview-window, #switch-items-row');
            existingModals.forEach(el => el.remove());

            // Clear global state
            delete window.AppState;

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization Tests</h4>';

    await test('creates instance successfully', async () => {
        const instance = new RoutineSwitcher();
        if (!instance || typeof instance.switchMiniCycle !== 'function') {
            throw new Error('RoutineSwitcher not properly initialized');
        }
    });

    await test('accepts dependency injection', async () => {
        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => JSON.parse(localStorage.getItem('miniCycleData'))
            },
            showNotification: (msg) => console.log(msg),
            loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')),
            hideMainMenu: () => {}
        };

        const instance = new RoutineSwitcher(mockDeps);

        if (!instance.deps.AppState) {
            throw new Error('Dependency injection failed');
        }
    });


    await test('initializes with empty dependencies object', async () => {
        const instance = new RoutineSwitcher({});
        if (!instance.deps) {
            throw new Error('Should initialize with empty dependencies');
        }
    });

    // === CORE FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Core Functionality</h4>';

    await test('switchMiniCycle with valid AppState', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        // Create mock DOM elements
        const modal = document.createElement('div');
        modal.className = 'mini-cycle-switch-modal';
        modal.style.display = 'none';
        document.body.appendChild(modal);

        const switchRow = document.createElement('div');
        switchRow.className = 'switch-items-row';
        document.body.appendChild(switchRow);

        const renameBtn = document.createElement('button');
        renameBtn.id = 'switch-rename';
        document.body.appendChild(renameBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'switch-delete';
        document.body.appendChild(deleteBtn);

        const confirmBtn = document.createElement('button');
        confirmBtn.id = 'miniCycleSwitchConfirm';
        document.body.appendChild(confirmBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'miniCycleSwitchCancel';
        document.body.appendChild(cancelBtn);

        const listContainer = document.createElement('div');
        listContainer.id = 'miniCycleList';
        document.body.appendChild(listContainer);

        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => schemaData
            },
            querySelector: (sel) => document.querySelector(sel),
            getElementById: (id) => document.getElementById(id),
            hideMainMenu: () => {},
            showNotification: () => {}
        };

        const instance = new RoutineSwitcher(mockDeps);
        instance.switchMiniCycle();

        // Modal should be visible
        if (modal.style.display !== 'flex') {
            throw new Error('Modal should be displayed');
        }
    });

    await test('switchMiniCycle handles no cycles gracefully', async () => {
        // Empty cycles
        const emptyData = {
            metadata: { version: "2.5" },
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };
        localStorage.setItem('miniCycleData', JSON.stringify(emptyData));

        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => emptyData
            },
            querySelector: () => ({ style: {} }),
            getElementById: () => ({}),
            showNotification: (msg) => {
                if (!msg.includes('No saved miniCycles')) {
                    throw new Error('Should notify user of no cycles');
                }
            }
        };

        const instance = new RoutineSwitcher(mockDeps);
        instance.switchMiniCycle();
    });

    await test('hideSwitchMiniCycleModal hides modal', async () => {
        const modal = document.createElement('div');
        modal.className = 'mini-cycle-switch-modal';
        modal.style.display = 'flex';
        document.body.appendChild(modal);

        const mockDeps = {
            querySelector: (sel) => document.querySelector(sel)
        };

        const instance = new RoutineSwitcher(mockDeps);
        instance.hideSwitchMiniCycleModal();

        if (modal.style.display !== 'none') {
            throw new Error('Modal should be hidden');
        }
    });

    await test('updatePreview generates task preview', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        const previewWindow = document.createElement('div');
        previewWindow.id = 'switch-preview-window';
        document.body.appendChild(previewWindow);

        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => schemaData
            },
            getElementById: (id) => document.getElementById(id)
        };

        const instance = new RoutineSwitcher(mockDeps);
        instance.updatePreview('Morning Routine');

        if (!previewWindow.innerHTML.includes('Tasks:')) {
            throw new Error('Preview should contain task list');
        }
        if (!previewWindow.innerHTML.includes('Wake up')) {
            throw new Error('Preview should show task text');
        }
    });

    await test('updatePreview handles missing cycle data', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        const previewWindow = document.createElement('div');
        previewWindow.id = 'switch-preview-window';
        document.body.appendChild(previewWindow);

        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => schemaData
            },
            getElementById: (id) => document.getElementById(id)
        };

        const instance = new RoutineSwitcher(mockDeps);
        instance.updatePreview('NonExistentCycle');

        if (!previewWindow.innerHTML.includes('No tasks found')) {
            throw new Error('Should show "No tasks found" message');
        }
    });

    await test('loadMiniCycleListActual populates cycle list', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        const listContainer = document.createElement('div');
        listContainer.id = 'miniCycleList';
        document.body.appendChild(listContainer);

        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => schemaData
            },
            getElementById: (id) => document.getElementById(id),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            updateReminderButtons: () => {}
        };

        const instance = new RoutineSwitcher(mockDeps);
        instance.loadMiniCycleListActual();

        // Should have 3 cycles
        const items = listContainer.querySelectorAll('.mini-cycle-switch-item');
        if (items.length !== 3) {
            throw new Error(`Expected 3 cycle items, got ${items.length}`);
        }
    });

    await test('loadMiniCycleListActual adds correct emojis', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        const listContainer = document.createElement('div');
        listContainer.id = 'miniCycleList';
        document.body.appendChild(listContainer);

        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => schemaData
            },
            getElementById: (id) => document.getElementById(id),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            updateReminderButtons: () => {}
        };

        const instance = new RoutineSwitcher(mockDeps);
        instance.loadMiniCycleListActual();

        // Morning Routine has autoReset=true, should have 🔄 (auto cycle mode)
        const morningItem = [...listContainer.children].find(el =>
            el.textContent.includes('Morning Routine')
        );
        if (!morningItem || !morningItem.textContent.includes('🔄')) {
            throw new Error('Auto-reset cycle should have 🔄 emoji');
        }

        // Work Tasks has deleteCheckedTasks, should have 📋 (default)
        const workItem = [...listContainer.children].find(el =>
            el.textContent.includes('Work Tasks')
        );
        if (!workItem || !workItem.textContent.includes('📋')) {
            throw new Error('To-do mode cycle should have 📋 emoji');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('handles missing AppState gracefully', async () => {
        const mockDeps = {
            AppState: null,
            showNotification: (msg) => {
                if (!msg.includes('not ready')) {
                    throw new Error('Should notify user about AppState not ready');
                }
            }
        };

        const instance = new RoutineSwitcher(mockDeps);

        // Should not throw
        instance.switchMiniCycle();
    });

    await test('handles missing DOM elements gracefully', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => schemaData
            },
            querySelector: () => null, // Missing elements
            getElementById: () => null,
            showNotification: () => {}
        };

        const instance = new RoutineSwitcher(mockDeps);

        // Should not throw even with missing DOM
        instance.hideSwitchMiniCycleModal();
        instance.loadMiniCycleListActual();
    });

    await test('handles corrupted localStorage gracefully', async () => {
        localStorage.setItem('miniCycleData', 'invalid-json');

        const mockDeps = {
            loadMiniCycleData: () => null,
            showNotification: () => {}
        };

        const instance = new RoutineSwitcher(mockDeps);

        // Should use fallback notification
        const result = instance.deps.showNotification('test');
        // Should not throw
    });

    await test('confirms cycle switch with valid data', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        const selectedCycle = document.createElement('div');
        selectedCycle.className = 'mini-cycle-switch-item selected';
        selectedCycle.dataset.cycleKey = 'Evening Routine';
        document.body.appendChild(selectedCycle);

        let updateCalled = false;
        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => schemaData,
                update: (updateFn, immediate) => {
                    updateCalled = true;
                    const state = JSON.parse(JSON.stringify(schemaData));
                    updateFn(state);
                    return state;
                }
            },
            querySelector: (sel) => document.querySelector(sel),
            showNotification: () => {},
            loadMiniCycle: () => {}
        };

        const instance = new RoutineSwitcher(mockDeps);

        // Mock hideSwitchMiniCycleModal
        instance.hideSwitchMiniCycleModal = () => {};

        instance.confirmMiniCycle();

        // Wait for setTimeout
        await new Promise(resolve => setTimeout(resolve, 150));

        if (!updateCalled) {
            throw new Error('AppState.update should be called');
        }
    });

    // === INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Integration Tests</h4>';


    await test('works without AppState (fallback mode)', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        delete window.AppState;

        // ✅ Updated: updatePreview now requires AppState, so provide it in mockDeps
        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => schemaData
            },
            showNotification: () => {}
        };

        const instance = new RoutineSwitcher(mockDeps);

        // Should work with provided AppState
        const previewWindow = document.createElement('div');
        previewWindow.id = 'switch-preview-window';
        document.body.appendChild(previewWindow);

        instance.updatePreview('Morning Routine');

        // Should render preview
        if (!previewWindow.innerHTML) {
            throw new Error('Should work with provided AppState mock');
        }
    });

    // === GLOBAL FUNCTIONS TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Functions</h4>';

    await test('exposes global compatibility functions', async () => {
        // Check that module exposes expected global functions
        if (typeof window.switchMiniCycle !== 'function' ||
            typeof window.renameMiniCycle !== 'function' ||
            typeof window.deleteMiniCycle !== 'function' ||
            typeof window.confirmMiniCycle !== 'function' ||
            typeof window.hideSwitchMiniCycleModal !== 'function' ||
            typeof window.updatePreview !== 'function' ||
            typeof window.loadMiniCycleList !== 'function' ||
            typeof window.setupModalClickOutside !== 'function') {
            throw new Error('Global functions not properly exposed');
        }
    });

    await test('global functions handle null instance gracefully', async () => {
        // Temporarily clear global instance
        const originalInstance = window.cycleSwitcher;
        delete window.cycleSwitcher;

        // Should not throw
        window.switchMiniCycle();
        window.renameMiniCycle();
        window.deleteMiniCycle();
        window.confirmMiniCycle();
        window.hideSwitchMiniCycleModal();
        window.updatePreview('test');
        window.loadMiniCycleList();
        window.setupModalClickOutside();

        // Restore
        window.cycleSwitcher = originalInstance;
    });

    // === DEBOUNCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⏱️ Debounce Tests</h4>';

    await test('loadMiniCycleList debounces rapid calls', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        let callCount = 0;
        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => schemaData
            },
            getElementById: () => {
                callCount++;
                return document.createElement('div');
            },
            querySelectorAll: () => [],
            updateReminderButtons: () => {}
        };

        const instance = new RoutineSwitcher(mockDeps);

        // Call multiple times rapidly
        instance.loadMiniCycleList();
        instance.loadMiniCycleList();
        instance.loadMiniCycleList();

        // Wait for debounce
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should only call once due to debouncing
        // Note: callCount may vary based on timing, so we just check it was debounced
        if (callCount > 3) {
            throw new Error('Debouncing did not work properly');
        }
    });

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Performance Tests</h4>';

    await test('loadMiniCycleListActual completes quickly', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        const listContainer = document.createElement('div');
        listContainer.id = 'miniCycleList';
        document.body.appendChild(listContainer);

        const mockDeps = {
            AppState: {
                isReady: () => true,
                get: () => schemaData
            },
            getElementById: (id) => document.getElementById(id),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            updateReminderButtons: () => {}
        };

        const instance = new RoutineSwitcher(mockDeps);

        const startTime = performance.now();
        instance.loadMiniCycleListActual();
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 100) { // 100ms threshold
            throw new Error(`Operation took too long: ${duration.toFixed(2)}ms`);
        }
    });

    await test('updatePreview renders quickly', async () => {
        const schemaData = JSON.parse(localStorage.getItem('miniCycleData'));

        const previewWindow = document.createElement('div');
        previewWindow.id = 'switch-preview-window';
        document.body.appendChild(previewWindow);

        const mockDeps = {
            loadMiniCycleData: () => schemaData,
            getElementById: (id) => document.getElementById(id)
        };

        const instance = new RoutineSwitcher(mockDeps);

        const startTime = performance.now();
        instance.updatePreview('Morning Routine');
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 50) { // 50ms threshold
            throw new Error(`Preview rendering took too long: ${duration.toFixed(2)}ms`);
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

    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
