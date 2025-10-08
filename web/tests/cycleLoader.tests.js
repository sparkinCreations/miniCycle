/**
 * CycleLoader Module Tests (Schema 2.5)
 * Tests for the main cycle loading and coordination functionality
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
    
    try {
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
                                        completed: false,
                                        dueDate: null,
                                        highPriority: false
                                    },
                                    {
                                        id: 'task2',
                                        text: 'Test Task 2',
                                        completed: true,
                                        dueDate: '2024-12-01',
                                        highPriority: true
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
        
        // Test successful dependency injection
        if (typeof setCycleLoaderDependencies !== 'function') {
            throw new Error('setCycleLoaderDependencies function not available');
        }
    });
    
    test('throws error for missing required dependencies', () => {
        // Reset dependencies
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
    
    test('loads cycle successfully with valid data', () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));
        let tasksCalled = false;
        let uiUpdated = false;
        
        setCycleLoaderDependencies({
            loadMiniCycleData: () => mockData,
            addTask: () => { tasksCalled = true; },
            updateThemeColor: () => { uiUpdated = true; }
        });
        
        // Create required DOM elements
        const taskList = document.createElement('div');
        taskList.id = 'taskList';
        document.body.appendChild(taskList);
        
        const titleElement = document.createElement('h1');
        titleElement.id = 'mini-cycle-title';
        document.body.appendChild(titleElement);
        
        loadMiniCycle();
        
        if (!tasksCalled) {
            throw new Error('Tasks were not rendered');
        }
        
        if (titleElement.textContent !== 'Test Cycle') {
            throw new Error('Cycle title not properly set');
        }
        
        // Cleanup
        document.body.removeChild(taskList);
        document.body.removeChild(titleElement);
    });
    
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
    
    test('handles missing active cycle gracefully', () => {
        const mockData = JSON.parse(localStorage.getItem('miniCycleData'));
        mockData.appState.activeCycleId = 'nonexistent';
        
        setCycleLoaderDependencies({
            loadMiniCycleData: () => mockData,
            addTask: () => {}
        });
        
        // Should not throw error, just log and return
        loadMiniCycle();
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
        
        if (cycle.tasks[2].text !== 'Valid Task') {
            throw new Error('Valid text should remain unchanged');
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
        
        if (cycle.tasks[1].id !== 'task2') {
            throw new Error('Existing ID should remain unchanged');
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
        
        if (!result.wasModified) {
            throw new Error('Should detect modifications were made');
        }
    });
    
    test('handles empty task array', () => {
        const cycle = { tasks: [] };
        const result = repairAndCleanTasks(cycle);
        
        if (cycle.tasks.length !== 0 || result.wasModified) {
            throw new Error('Empty array should remain unchanged');
        }
    });
    
    test('handles missing task array', () => {
        const cycle = {};
        const result = repairAndCleanTasks(cycle);
        
        if (!Array.isArray(cycle.tasks) || cycle.tasks.length !== 0) {
            throw new Error('Should create empty tasks array');
        }
    });

    // === DOM RENDERING TESTS ===
    resultsDiv.innerHTML += '<h4>🎨 DOM Rendering Tests</h4>';
    
    test('renders tasks to DOM correctly', () => {
        const taskList = document.createElement('div');
        taskList.id = 'taskList';
        document.body.appendChild(taskList);
        
        let addTaskCalls = [];
        setCycleLoaderDependencies({
            addTask: (...args) => { addTaskCalls.push(args); }
        });
        
        const tasks = [
            { id: 'task1', text: 'Test Task 1', completed: false },
            { id: 'task2', text: 'Test Task 2', completed: true, highPriority: true }
        ];
        
        renderTasksToDOM(tasks);
        
        if (addTaskCalls.length !== 2) {
            throw new Error(`Expected 2 addTask calls, got ${addTaskCalls.length}`);
        }
        
        if (addTaskCalls[0][0] !== 'Test Task 1' || addTaskCalls[1][0] !== 'Test Task 2') {
            throw new Error('Task text not properly passed to addTask');
        }
        
        if (addTaskCalls[1][4] !== true) { // highPriority parameter
            throw new Error('High priority not properly passed to addTask');
        }
        
        document.body.removeChild(taskList);
    });
    
    test('handles missing taskList element gracefully', () => {
        const tasks = [{ id: 'task1', text: 'Test Task', completed: false }];
        
        // Should not throw error when taskList doesn't exist
        renderTasksToDOM(tasks);
    });
    
    test('handles empty task array in rendering', () => {
        const taskList = document.createElement('div');
        taskList.id = 'taskList';
        taskList.innerHTML = '<div>existing content</div>';
        document.body.appendChild(taskList);
        
        renderTasksToDOM([]);
        
        if (taskList.innerHTML !== '') {
            throw new Error('Task list should be cleared even with empty array');
        }
        
        document.body.removeChild(taskList);
    });

    // === UI STATE TESTS ===
    resultsDiv.innerHTML += '<h4>🎛️ UI State Tests</h4>';
    
    test('updates cycle UI state correctly', () => {
        // Create required DOM elements
        const titleElement = document.createElement('h1');
        titleElement.id = 'mini-cycle-title';
        document.body.appendChild(titleElement);
        
        const autoResetToggle = document.createElement('input');
        autoResetToggle.id = 'toggleAutoReset';
        autoResetToggle.type = 'checkbox';
        document.body.appendChild(autoResetToggle);
        
        const deleteTasksToggle = document.createElement('input');
        deleteTasksToggle.id = 'deleteCheckedTasks';
        deleteTasksToggle.type = 'checkbox';
        document.body.appendChild(deleteTasksToggle);
        
        setCycleLoaderDependencies({
            updateThemeColor: () => {}
        });
        
        const cycle = {
            title: 'Test Cycle Title',
            autoReset: true,
            deleteCheckedTasks: false
        };
        
        const settings = {
            darkMode: true,
            theme: 'dark-ocean'
        };
        
        updateCycleUIState(cycle, settings);
        
        if (titleElement.textContent !== 'Test Cycle Title') {
            throw new Error('Cycle title not properly set');
        }
        
        if (!autoResetToggle.checked) {
            throw new Error('Auto reset toggle not properly set');
        }
        
        if (deleteTasksToggle.checked) {
            throw new Error('Delete tasks toggle should be unchecked');
        }
        
        if (!document.body.classList.contains('dark-mode')) {
            throw new Error('Dark mode class not applied');
        }
        
        // Cleanup
        document.body.removeChild(titleElement);
        document.body.removeChild(autoResetToggle);
        document.body.removeChild(deleteTasksToggle);
        document.body.classList.remove('dark-mode', 'theme-dark-ocean');
    });
    
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
        
        if (!document.body.classList.contains('dark-mode')) {
            throw new Error('Dark mode class not applied');
        }
        
        if (!document.body.classList.contains('theme-golden-glow')) {
            throw new Error('Theme class not applied');
        }
        
        if (!themeColorCalled) {
            throw new Error('updateThemeColor dependency not called');
        }
        
        // Cleanup
        document.body.classList.remove('dark-mode', 'theme-golden-glow');
    });
    
    test('removes previous theme classes', () => {
        document.body.classList.add('theme-dark-ocean');
        
        setCycleLoaderDependencies({
            updateThemeColor: () => {}
        });
        
        applyThemeSettings({ theme: 'golden-glow' });
        
        if (document.body.classList.contains('theme-dark-ocean')) {
            throw new Error('Previous theme class not removed');
        }
        
        if (!document.body.classList.contains('theme-golden-glow')) {
            throw new Error('New theme class not applied');
        }
        
        // Cleanup
        document.body.classList.remove('theme-golden-glow');
    });

    // === REMINDERS TESTS ===
    resultsDiv.innerHTML += '<h4>⏰ Reminders Tests</h4>';
    
    test('sets up reminders correctly', () => {
        const enableReminders = document.createElement('input');
        enableReminders.id = 'enableReminders';
        enableReminders.type = 'checkbox';
        document.body.appendChild(enableReminders);
        
        const frequencySection = document.createElement('div');
        frequencySection.id = 'frequency-section';
        frequencySection.classList.add('hidden');
        document.body.appendChild(frequencySection);
        
        let reminderStarted = false;
        setCycleLoaderDependencies({
            startReminders: () => { reminderStarted = true; }
        });
        
        const reminders = { enabled: true };
        
        setupRemindersForCycle(reminders);
        
        if (!enableReminders.checked) {
            throw new Error('Reminders checkbox not checked');
        }
        
        if (frequencySection.classList.contains('hidden')) {
            throw new Error('Frequency section should be visible');
        }
        
        if (!reminderStarted) {
            throw new Error('Reminders not started');
        }
        
        // Cleanup
        document.body.removeChild(enableReminders);
        document.body.removeChild(frequencySection);
    });
    
    test('handles disabled reminders', () => {
        const enableReminders = document.createElement('input');
        enableReminders.id = 'enableReminders';
        enableReminders.type = 'checkbox';
        enableReminders.checked = true;
        document.body.appendChild(enableReminders);
        
        const frequencySection = document.createElement('div');
        frequencySection.id = 'frequency-section';
        document.body.appendChild(frequencySection);
        
        let reminderStarted = false;
        setCycleLoaderDependencies({
            startReminders: () => { reminderStarted = true; }
        });
        
        const reminders = { enabled: false };
        
        setupRemindersForCycle(reminders);
        
        if (enableReminders.checked) {
            throw new Error('Reminders checkbox should be unchecked');
        }
        
        if (!frequencySection.classList.contains('hidden')) {
            throw new Error('Frequency section should be hidden');
        }
        
        if (reminderStarted) {
            throw new Error('Reminders should not start when disabled');
        }
        
        // Cleanup
        document.body.removeChild(enableReminders);
        document.body.removeChild(frequencySection);
    });

    // === DEPENDENT COMPONENTS TESTS ===
    resultsDiv.innerHTML += '<h4>🔗 Dependent Components Tests</h4>';
    
    test('updates all dependent components', () => {
        let progressUpdated = false;
        let completeButtonChecked = false;
        let headerUpdated = false;
        let statsUpdated = false;
        
        setCycleLoaderDependencies({
            updateProgressBar: () => { progressUpdated = true; },
            checkCompleteAllButton: () => { completeButtonChecked = true; },
            updateMainMenuHeader: () => { headerUpdated = true; },
            updateStatsPanel: () => { statsUpdated = true; }
        });
        
        updateDependentComponents();
        
        if (!progressUpdated || !completeButtonChecked || !headerUpdated || !statsUpdated) {
            throw new Error('Not all dependent components were updated');
        }
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
        
        if (!savedData.metadata.lastModified) {
            throw new Error('Metadata timestamp not updated');
        }
    });
    
    test('handles corrupted localStorage in save', () => {
        localStorage.setItem('miniCycleData', 'invalid json');
        
        // Should not throw error
        saveCycleData('cycle1', { title: 'Test' });
    });
    
    test('handles missing localStorage data in save', () => {
        localStorage.removeItem('miniCycleData');
        
        // Should not throw error
        saveCycleData('cycle1', { title: 'Test' });
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4>⚠️ Error Handling Tests</h4>';
    
    test('handles missing dependencies gracefully', () => {
        setCycleLoaderDependencies({
            loadMiniCycleData: () => ({ metadata: { version: '2.5' } })
            // Missing addTask dependency
        });
        
        let errorThrown = false;
        try {
            loadMiniCycle();
        } catch (error) {
            errorThrown = true;
        }
        
        if (!errorThrown) {
            throw new Error('Should throw error for missing required dependencies');
        }
    });
        // === INITIALIZATION TESTS ===
        resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';
        
        test('sets dependencies correctly', () => {
            const mockDeps = {
                loadMiniCycleData: () => ({ metadata: { version: '2.5' } }),
                addTask: () => {},
                updateThemeColor: () => {}
            };
            
            setCycleLoaderDependencies(mockDeps);
            
            // Test successful dependency injection
            if (typeof setCycleLoaderDependencies !== 'function') {
                throw new Error('setCycleLoaderDependencies function not available');
            }
        });
        
        test('throws error for missing required dependencies', () => {
            // Reset dependencies
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
        
        test('handles missing active cycle gracefully', () => {
            const mockData = JSON.parse(localStorage.getItem('miniCycleData'));
            mockData.appState.activeCycleId = 'nonexistent';
            
            setCycleLoaderDependencies({
                loadMiniCycleData: () => mockData,
                addTask: () => {}
            });
            
            // Should not throw error, just log and return
            loadMiniCycle();
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
            
            if (cycle.tasks[2].text !== 'Valid Task') {
                throw new Error('Valid text should remain unchanged');
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
            
            if (cycle.tasks[1].id !== 'task2') {
                throw new Error('Existing ID should remain unchanged');
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
            
            if (!result.wasModified) {
                throw new Error('Should detect modifications were made');
            }
        });
        
        test('handles empty task array', () => {
            const cycle = { tasks: [] };
            const result = repairAndCleanTasks(cycle);
            
            if (cycle.tasks.length !== 0 || result.wasModified) {
                throw new Error('Empty array should remain unchanged');
            }
        });
        
        test('handles missing task array', () => {
            const cycle = {};
            const result = repairAndCleanTasks(cycle);
            
            if (!Array.isArray(cycle.tasks) || cycle.tasks.length !== 0) {
                throw new Error('Should create empty tasks array');
            }
        });

        // === SIMPLIFIED TESTS FOR AUTOMATION ===
        resultsDiv.innerHTML += '<h4>⚡ Simplified Tests</h4>';
        
        test('DOM rendering handles missing elements gracefully', () => {
            const tasks = [{ id: 'task1', text: 'Test Task', completed: false }];
            
            setCycleLoaderDependencies({
                addTask: () => {}
            });
            
            // Should not throw error when taskList doesn't exist
            renderTasksToDOM(tasks);
        });
        
        test('UI state handles missing elements gracefully', () => {
            const cycle = { title: 'Test' };
            const settings = {};
            
            setCycleLoaderDependencies({
                updateThemeColor: () => {}
            });
            
            // Should not throw error when DOM elements don't exist
            updateCycleUIState(cycle, settings);
        });
        
        test('applies basic theme settings', () => {
            setCycleLoaderDependencies({
                updateThemeColor: () => {}
            });
            
            const settings = { darkMode: true };
            applyThemeSettings(settings);
            
            // Just verify function doesn't throw
        });
        
        test('reminders handle missing elements gracefully', () => {
            setCycleLoaderDependencies({
                startReminders: () => {}
            });
            
            const reminders = { enabled: true };
            setupRemindersForCycle(reminders);
            
            // Should not throw when DOM elements missing
        });
        
        test('updates dependent components safely', () => {
            setCycleLoaderDependencies({
                updateProgressBar: () => {},
                checkCompleteAllButton: () => {},
                updateMainMenuHeader: () => {},
                updateStatsPanel: () => {}
            });
            
            updateDependentComponents();
        });
        
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
        
        test('handles missing localStorage data in save', () => {
            localStorage.removeItem('miniCycleData');
            
            // Should not throw error
            saveCycleData('cycle1', { title: 'Test' });
        });

        // Test code will go here...
        
    } catch (error) {
        console.error('Error running CycleLoader tests:', error);
        resultsDiv.innerHTML += `<div class="result fail">❌ Fatal error: ${error.message}</div>`;
    } finally {
        // === RESULTS SUMMARY ===
        const totalTests = 15;
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
}

// Export for module testing
export { runCycleLoaderTests };