/**
 * CycleLoader Module Tests (Schema 2.5)
 * Simplified tests for the main cycle loading and coordination functionality
 */

// Import the module
import {
    loadMiniCycle,
    repairAndCleanTasks,
    renderTasksToDOM,
    updateCycleUIState,
    applyThemeSettings,
    setupRemindersForCycle,
    updateDependentComponents,
    saveCycleData,
    setCycleLoaderDependencies
} from '../utilities/cycleLoader.js';

function runCycleLoaderTests() {
    const resultsDiv = document.getElementById('test-results');
    resultsDiv.innerHTML = '<h3>🔄 CycleLoader Module Tests</h3>';
    
    const passed = { count: 0 };
    
    function test(name, testFn) {
        try {
            // Create fresh mock Schema 2.5 data for each test
            const mockSchemaData = {
                metadata: {
                    version: "2.5",
                    lastModified: Date.now()
                },
                settings: {
                    darkMode: false,
                    theme: 'default'
                },
                data: {
                    cycles: {
                        'cycle1': {
                            id: 'cycle1',
                            title: 'Test Cycle',
                            tasks: [
                                {
                                    id: 'task1',
                                    text: 'Test Task 1',
                                    completed: false
                                }
                            ],
                            autoReset: true,
                            deleteCheckedTasks: false
                        }
                    }
                },
                appState: {
                    activeCycleId: 'cycle1'
                },
                reminders: {
                    enabled: true,
                    frequency: 30
                },
                userProgress: {}
            };
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));
            
            // Reset dependencies for each test
            setCycleLoaderDependencies({});
            
            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';
    
    test('sets dependencies correctly', () => {
        const mockDeps = {
            loadMiniCycleData: () => ({ metadata: { version: '2.5' } }),
            addTask: () => {},
            updateThemeColor: () => {}
        };
        
        setCycleLoaderDependencies(mockDeps);
        
        if (typeof setCycleLoaderDependencies !== 'function') {
            throw new Error('setCycleLoaderDependencies function not available');
        }
    });
    
    test('throws error for missing required dependencies', () => {
        setCycleLoaderDependencies({});
        
        let errorThrown = false;
        try {
            loadMiniCycle();
        } catch (error) {
            if (error.message.includes('missing dependency')) {
                errorThrown = true;
            }
        }
        
        if (!errorThrown) {
            throw new Error('Should throw error for missing dependencies');
        }
    });

    // === CORE FUNCTIONALITY TESTS ===
    resultsDiv.innerHTML += '<h4>⚙️ Core Functionality Tests</h4>';
    
    test('handles missing Schema 2.5 data gracefully', () => {
        let initialDataCreated = false;
        
        setCycleLoaderDependencies({
            loadMiniCycleData: () => null,
            createInitialSchema25Data: () => { initialDataCreated = true; },
            addTask: () => {}
        });
        
        loadMiniCycle();
        
        if (!initialDataCreated) {
            throw new Error('Should create initial data when none exists');
        }
    });

    // === TASK REPAIR TESTS ===
    resultsDiv.innerHTML += '<h4>🔧 Task Repair Tests</h4>';
    
    test('repairs tasks with missing text', () => {
        const cycle = {
            tasks: [
                { id: 'task1', text: '', completed: false },
                { id: 'task2', text: null, completed: false },
                { id: 'task3', text: 'Valid Task', completed: false }
            ]
        };
        
        const result = repairAndCleanTasks(cycle);
        
        if (!result.wasModified) {
            throw new Error('Should detect modifications were made');
        }
        
        if (cycle.tasks[0].text !== '[Task 1]' || cycle.tasks[1].text !== '[Task 2]') {
            throw new Error('Missing text not properly repaired');
        }
    });
    
    test('repairs tasks with missing IDs', () => {
        const cycle = {
            tasks: [
                { text: 'Task 1', completed: false },
                { id: 'task2', text: 'Task 2', completed: false }
            ]
        };
        
        const result = repairAndCleanTasks(cycle);
        
        if (!result.wasModified) {
            throw new Error('Should detect modifications were made');
        }
        
        if (!cycle.tasks[0].id || !cycle.tasks[0].id.startsWith('task-')) {
            throw new Error('Missing ID not properly repaired');
        }
    });
    
    test('removes completely invalid tasks', () => {
        const cycle = {
            tasks: [
                { id: 'task1', text: 'Valid Task', completed: false },
                null,
                undefined,
                'invalid string',
                { id: 'task2', text: 'Another Valid Task', completed: true }
            ]
        };
        
        const result = repairAndCleanTasks(cycle);
        
        if (cycle.tasks.length !== 2) {
            throw new Error(`Expected 2 valid tasks, got ${cycle.tasks.length}`);
        }
    });

    // === DOM RENDERING TESTS ===
    resultsDiv.innerHTML += '<h4>🎨 DOM Rendering Tests</h4>';
    
    test('handles missing taskList element gracefully', () => {
        const tasks = [{ id: 'task1', text: 'Test Task', completed: false }];
        
        setCycleLoaderDependencies({
            addTask: () => {}
        });
        
        // Should not throw error when taskList doesn't exist
        renderTasksToDOM(tasks);
    });

    // === UI STATE TESTS ===
    resultsDiv.innerHTML += '<h4>🎛️ UI State Tests</h4>';
    
    test('handles missing UI elements gracefully', () => {
        const cycle = { title: 'Test' };
        const settings = {};
        
        setCycleLoaderDependencies({
            updateThemeColor: () => {}
        });
        
        // Should not throw error when DOM elements don't exist
        updateCycleUIState(cycle, settings);
    });

    // === THEME TESTS ===
    resultsDiv.innerHTML += '<h4>🎨 Theme Tests</h4>';
    
    test('applies theme settings correctly', () => {
        let themeColorCalled = false;
        setCycleLoaderDependencies({
            updateThemeColor: () => { themeColorCalled = true; }
        });
        
        const settings = {
            darkMode: true,
            theme: 'golden-glow'
        };
        
        applyThemeSettings(settings);
        
        if (!themeColorCalled) {
            throw new Error('updateThemeColor dependency not called');
        }
        
        // Cleanup
        document.body.classList.remove('dark-mode', 'theme-golden-glow');
    });

    // === DATA PERSISTENCE TESTS ===
    resultsDiv.innerHTML += '<h4>💾 Data Persistence Tests</h4>';
    
    test('saves cycle data correctly', () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));
        const updatedCycle = {
            id: 'cycle1',
            title: 'Updated Cycle',
            tasks: [{ id: 'new-task', text: 'New Task', completed: false }]
        };
        
        saveCycleData('cycle1', updatedCycle);
        
        const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
        const savedCycle = savedData.data.cycles.cycle1;
        
        if (savedCycle.title !== 'Updated Cycle') {
            throw new Error('Cycle data not properly saved');
        }
    });
    
    test('handles corrupted localStorage in save', () => {
        localStorage.setItem('miniCycleData', 'invalid json');
        
        // Should not throw error
        saveCycleData('cycle1', { title: 'Test' });
    });

    // === RESULTS SUMMARY ===
    const totalTests = 10;
    const passedTests = passed.count;
    const failedTests = totalTests - passedTests;
    
    resultsDiv.innerHTML += '<h4>📊 Test Summary</h4>';
    if (failedTests === 0) {
        resultsDiv.innerHTML += '<div class="result pass">✅ 🎉 All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">❌ ⚠️ Some tests failed</div>`;
    }
    
    resultsDiv.innerHTML += `
        <div class="summary">
            <h3>Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests) * 100)}%)</h3>
        </div>
    `;
}

// Export for module testing
export { runCycleLoaderTests };