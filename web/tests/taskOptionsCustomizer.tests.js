/**
 * TaskOptionsCustomizer Tests
 *
 * Tests for per-cycle task option button visibility customization
 * Follows miniCycle browser testing patterns
 * Compatible with both manual browser testing and automated CI/CD
 */

export function runTaskOptionsCustomizerTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>TaskOptionsCustomizer Tests</h2>';
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
        console.log('🔒 Saved original localStorage for individual TaskOptionsCustomizer test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual TaskOptionsCustomizer test completed - original localStorage restored');
        }
    }

    // Import the module class
    const TaskOptionsCustomizer = window.TaskOptionsCustomizer;

    // Check if class is available
    if (!TaskOptionsCustomizer) {
        resultsDiv.innerHTML += '<div class="result fail">TaskOptionsCustomizer class not found. Make sure the module is properly loaded.</div>';
        restoreOriginalData();
        return { passed: 0, total: 1 };
    }

    function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Mock Schema 2.5 data with cycles
            const mockSchemaData = {
                metadata: {
                    version: "2.5",
                    lastModified: Date.now()
                },
                settings: {
                    showThreeDots: false
                },
                ui: {
                    moveArrowsVisible: false
                },
                appState: {
                    activeCycleId: 'test-cycle-1'
                },
                data: {
                    cycles: {
                        'test-cycle-1': {
                            id: 'test-cycle-1',
                            title: 'Test Cycle',
                            tasks: [],
                            taskOptionButtons: {
                                customize: true,
                                moveArrows: false,
                                threeDots: false,
                                highPriority: true,
                                rename: true,
                                delete: true,
                                recurring: false,
                                dueDate: false,
                                reminders: false
                            }
                        },
                        'test-cycle-2': {
                            id: 'test-cycle-2',
                            title: 'Test Cycle 2',
                            tasks: []
                            // No taskOptionButtons - should use defaults
                        }
                    }
                },
                userProgress: {}
            };
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            // Reset DOM state
            document.body.className = '';

            // Remove existing modals
            const existingModal = document.getElementById('task-options-customizer-modal');
            if (existingModal) existingModal.remove();

            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';

    test('creates instance successfully', () => {
        const instance = new TaskOptionsCustomizer();
        if (!instance || typeof instance.showCustomizationModal !== 'function') {
            throw new Error('TaskOptionsCustomizer not properly initialized');
        }
    });

    test('accepts dependency injection', () => {
        const mockAppState = {
            isReady: () => true,
            get: () => ({ data: { cycles: {} } }),
            update: () => {}
        };
        const mockNotification = () => {};

        const instance = new TaskOptionsCustomizer({
            AppState: mockAppState,
            showNotification: mockNotification,
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            renderTaskList: () => {}
        });

        if (!instance.deps.AppState || !instance.deps.showNotification) {
            throw new Error('Dependency injection failed');
        }
    });

    test('uses window defaults when no dependencies provided', () => {
        // Set up window defaults
        window.AppState = {
            isReady: () => true,
            get: () => ({ data: { cycles: {} } }),
            update: () => {}
        };
        window.showNotification = () => {};
        window.refreshTaskListUI = () => {};

        const instance = new TaskOptionsCustomizer();

        if (!instance.deps.AppState || !instance.deps.showNotification) {
            throw new Error('Should use window defaults');
        }

        // Cleanup
        delete window.AppState;
        delete window.showNotification;
        delete window.refreshTaskListUI;
    });

    // === MODAL CREATION TESTS ===
    resultsDiv.innerHTML += '<h4>🪟 Modal Creation Tests</h4>';

    test('showCustomizationModal creates modal element', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (fn) => {
                    fn(mockData);
                    localStorage.setItem('miniCycleData', JSON.stringify(mockData));
                }
            },
            showNotification: () => {},
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        if (!modal) {
            throw new Error('Modal not created');
        }
    });

    test('modal contains all button options', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            getElementById: (id) => document.getElementById(id),
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');

        // Should have 9 options: customize, moveArrows, threeDots, highPriority, rename, delete, recurring, dueDate, reminders
        if (checkboxes.length !== 9) {
            throw new Error(`Expected 9 checkboxes, got ${checkboxes.length}`);
        }
    });

    test('modal contains cycle title in subtitle', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const subtitle = modal.querySelector('.modal-subtitle');

        if (!subtitle || !subtitle.textContent.includes('Test Cycle')) {
            throw new Error('Cycle title not in modal subtitle');
        }
    });

    test('removes existing modal before creating new one', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');
        await instance.showCustomizationModal('test-cycle-1');

        const modals = document.querySelectorAll('#task-options-customizer-modal');
        if (modals.length !== 1) {
            throw new Error('Should only have one modal at a time');
        }
    });

    // === BUTTON CONFIGURATION TESTS ===
    resultsDiv.innerHTML += '<h4>⚙️ Button Configuration Tests</h4>';

    test('customize button is always disabled', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const customizeCheckbox = modal.querySelector('[data-option="customize"]');

        if (!customizeCheckbox.disabled || !customizeCheckbox.checked) {
            throw new Error('Customize button should be disabled and checked');
        }
    });

    test('loads current cycle button settings', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));
        mockData.data.cycles['test-cycle-1'].taskOptionButtons.highPriority = false;

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const highPriorityCheckbox = modal.querySelector('[data-option="highPriority"]');

        if (highPriorityCheckbox.checked) {
            throw new Error('highPriority should be unchecked based on cycle settings');
        }
    });

    test('uses defaults when cycle has no taskOptionButtons', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-2');

        const modal = document.getElementById('task-options-customizer-modal');
        const customizeCheckbox = modal.querySelector('[data-option="customize"]');

        if (!customizeCheckbox.checked) {
            throw new Error('Should use default (customize=true)');
        }
    });

    // === SAVE FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4>💾 Save Functionality Tests</h4>';

    test('saves customization to cycle', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));
        let updateCalled = false;

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (fn) => {
                    fn(mockData);
                    updateCalled = true;
                }
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');

        // Change a checkbox
        const recurringCheckbox = modal.querySelector('[data-option="recurring"]');
        recurringCheckbox.checked = true;

        instance.saveCustomization('test-cycle-1', checkboxes);

        if (!updateCalled) {
            throw new Error('AppState.update should be called');
        }

        if (!mockData.data.cycles['test-cycle-1'].taskOptionButtons.recurring) {
            throw new Error('Recurring option should be saved as true');
        }
    });

    test('ensures customize button is always enabled after save', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (fn) => fn(mockData)
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');

        instance.saveCustomization('test-cycle-1', checkboxes);

        if (!mockData.data.cycles['test-cycle-1'].taskOptionButtons.customize) {
            throw new Error('Customize button should always be enabled after save');
        }
    });

    test('calls renderTaskList after save', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));
        let renderCalled = false;

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (fn) => fn(mockData)
            },
            showNotification: () => {},
            renderTaskList: () => { renderCalled = true; }
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');

        instance.saveCustomization('test-cycle-1', checkboxes);

        if (!renderCalled) {
            throw new Error('renderTaskList should be called after save');
        }
    });

    // === MOVE ARROWS SYNCHRONIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔄 Move Arrows Synchronization Tests</h4>';

    test('syncs move arrows with global setting on modal show', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));
        mockData.ui.moveArrowsVisible = true;
        mockData.data.cycles['test-cycle-1'].taskOptionButtons.moveArrows = false;

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const moveArrowsCheckbox = modal.querySelector('[data-option="moveArrows"]');

        // Should be checked because global setting is true
        if (!moveArrowsCheckbox.checked) {
            throw new Error('moveArrows should sync with global setting (true)');
        }
    });

    test('syncs global setting when move arrows changed', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));
        mockData.ui.moveArrowsVisible = false;

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (fn) => fn(mockData)
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
        const moveArrowsCheckbox = modal.querySelector('[data-option="moveArrows"]');

        // Enable move arrows
        moveArrowsCheckbox.checked = true;

        instance.saveCustomization('test-cycle-1', checkboxes);

        if (!mockData.ui.moveArrowsVisible) {
            throw new Error('Global moveArrowsVisible should be synced to true');
        }
    });

    test('calls updateMoveArrowsVisibility when move arrows changed', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));
        mockData.ui.moveArrowsVisible = false;
        let updateArrowsCalled = false;

        window.updateMoveArrowsVisibility = () => { updateArrowsCalled = true; };

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (fn) => fn(mockData)
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
        const moveArrowsCheckbox = modal.querySelector('[data-option="moveArrows"]');

        moveArrowsCheckbox.checked = true;

        instance.saveCustomization('test-cycle-1', checkboxes);

        if (!updateArrowsCalled) {
            throw new Error('updateMoveArrowsVisibility should be called');
        }

        delete window.updateMoveArrowsVisibility;
    });

    // === BUTTON VISIBILITY TESTS ===
    resultsDiv.innerHTML += '<h4>👁️ Button Visibility Tests</h4>';

    test('getButtonVisibility returns cycle settings', () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData
            }
        });

        const visibility = instance.getButtonVisibility('test-cycle-1');

        if (!visibility.customize || visibility.moveArrows) {
            throw new Error('Should return cycle taskOptionButtons');
        }
    });

    test('getButtonVisibility returns defaults when no cycle settings', () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData
            }
        });

        const visibility = instance.getButtonVisibility('test-cycle-2');

        // Should use defaults
        if (!visibility.customize) {
            throw new Error('Should return DEFAULT_TASK_OPTION_BUTTONS');
        }
    });

    test('getButtonVisibility handles missing AppState', () => {
        const instance = new TaskOptionsCustomizer({
            AppState: null
        });

        const visibility = instance.getButtonVisibility('test-cycle-1');

        if (!visibility.customize) {
            throw new Error('Should return defaults when AppState missing');
        }
    });

    // === RESET FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4>🔄 Reset Functionality Tests</h4>';

    test('reset button restores defaults', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');

        // Change all checkboxes
        checkboxes.forEach(cb => {
            if (!cb.disabled) cb.checked = false;
        });

        instance.resetToDefaults(checkboxes);

        // Check that defaults are restored
        const highPriorityCheckbox = modal.querySelector('[data-option="highPriority"]');
        if (!highPriorityCheckbox.checked) {
            throw new Error('highPriority should be reset to default (true)');
        }
    });

    // === MODAL CLOSE TESTS ===
    resultsDiv.innerHTML += '<h4>❌ Modal Close Tests</h4>';

    test('closeModal removes show class', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        modal.classList.add('show');

        instance.closeModal(modal);

        if (modal.classList.contains('show')) {
            throw new Error('Show class should be removed');
        }
    });

    test('ESC key closes modal', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        modal.classList.add('show');

        // Simulate ESC key press
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(escEvent);

        if (modal.classList.contains('show')) {
            throw new Error('ESC key should close modal');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4>⚠️ Error Handling Tests</h4>';

    test('handles missing cycle gracefully', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('non-existent-cycle');

        const modal = document.getElementById('task-options-customizer-modal');
        if (modal) {
            throw new Error('Should not create modal for non-existent cycle');
        }
    });

    test('handles AppState not ready', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => false,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        if (modal) {
            throw new Error('Should not create modal when AppState not ready');
        }
    });

    test('handles missing renderTaskList gracefully', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (fn) => fn(mockData)
            },
            showNotification: () => {},
            renderTaskList: null
        });

        // Should not throw
        instance.refreshAllTaskButtons();
    });

    // === INTEGRATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔗 Integration Tests</h4>';

    test('integrates with AppState when available', async () => {
        window.AppState = {
            isReady: () => true,
            get: () => JSON.parse(localStorage.getItem('miniCycleData')),
            update: (fn) => {
                const data = JSON.parse(localStorage.getItem('miniCycleData'));
                fn(data);
                localStorage.setItem('miniCycleData', JSON.stringify(data));
            }
        };

        const instance = new TaskOptionsCustomizer();

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        if (!modal) {
            throw new Error('Should work with window.AppState');
        }

        delete window.AppState;
    });

    test('global function showTaskOptionsCustomizer works', async () => {
        window.AppState = {
            isReady: () => true,
            get: () => JSON.parse(localStorage.getItem('miniCycleData')),
            update: () => {}
        };

        window.taskOptionsCustomizer = new TaskOptionsCustomizer();

        if (typeof window.taskOptionsCustomizer.showCustomizationModal !== 'function') {
            throw new Error('Global instance should have showCustomizationModal method');
        }

        delete window.AppState;
        delete window.taskOptionsCustomizer;
    });

    // === PERFORMANCE TESTS ===
    resultsDiv.innerHTML += '<h4>⚡ Performance Tests</h4>';

    test('modal creation completes within reasonable time', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: () => {}
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        const startTime = performance.now();
        await instance.showCustomizationModal('test-cycle-1');
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 100) {
            throw new Error(`Modal creation took too long: ${duration.toFixed(2)}ms`);
        }
    });

    test('save operation completes quickly', async () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));

        const instance = new TaskOptionsCustomizer({
            AppState: {
                isReady: () => true,
                get: () => mockData,
                update: (fn) => fn(mockData)
            },
            showNotification: () => {},
            renderTaskList: () => {}
        });

        await instance.showCustomizationModal('test-cycle-1');

        const modal = document.getElementById('task-options-customizer-modal');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');

        const startTime = performance.now();
        instance.saveCustomization('test-cycle-1', checkboxes);
        const endTime = performance.now();

        const duration = endTime - startTime;

        if (duration > 50) {
            throw new Error(`Save operation took too long: ${duration.toFixed(2)}ms`);
        }
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">WARNING: Some tests failed</div>';
    }

    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();

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
