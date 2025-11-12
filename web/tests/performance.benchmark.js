/**
 * Performance Benchmark Tests for miniCycle
 *
 * Tests performance of critical operations:
 * - Task creation and rendering
 * - Cycle switching
 * - Undo/redo operations
 * - Recurring task processing
 * - Large dataset handling
 *
 * Run these tests to identify performance bottlenecks.
 */

export function runPerformanceBenchmarks(resultsDiv) {
    resultsDiv.innerHTML = '<h2>⚡ Performance Benchmarks</h2><h3>Running benchmarks...</h3>';

    const results = [];
    let passed = { count: 0 };
    let total = { count: 0 };

    /**
     * Benchmark helper - measures execution time
     */
    function benchmark(name, fn, threshold = 100) {
        total.count++;
        const start = performance.now();

        try {
            fn();
            const duration = performance.now() - start;
            const status = duration < threshold ? 'pass' : 'warn';

            results.push({
                name,
                duration: duration.toFixed(2),
                threshold,
                status
            });

            if (status === 'pass') {
                passed.count++;
                resultsDiv.innerHTML += `<div class="result pass">✅ ${name}: ${duration.toFixed(2)}ms (threshold: ${threshold}ms)</div>`;
            } else {
                resultsDiv.innerHTML += `<div class="result warn">⚠️ ${name}: ${duration.toFixed(2)}ms (exceeds threshold: ${threshold}ms)</div>`;
            }
        } catch (error) {
            results.push({
                name,
                duration: 'ERROR',
                threshold,
                status: 'error',
                error: error.message
            });
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    /**
     * Async benchmark helper
     */
    async function benchmarkAsync(name, fn, threshold = 100) {
        total.count++;
        const start = performance.now();

        try {
            await fn();
            const duration = performance.now() - start;
            const status = duration < threshold ? 'pass' : 'warn';

            results.push({
                name,
                duration: duration.toFixed(2),
                threshold,
                status
            });

            if (status === 'pass') {
                passed.count++;
                resultsDiv.innerHTML += `<div class="result pass">✅ ${name}: ${duration.toFixed(2)}ms (threshold: ${threshold}ms)</div>`;
            } else {
                resultsDiv.innerHTML += `<div class="result warn">⚠️ ${name}: ${duration.toFixed(2)}ms (exceeds threshold: ${threshold}ms)</div>`;
            }
        } catch (error) {
            results.push({
                name,
                duration: 'ERROR',
                threshold,
                status: 'error',
                error: error.message
            });
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // ===== TASK OPERATIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Task Operations</h4>';

    benchmark('Create 100 tasks', () => {
        const tasks = [];
        for (let i = 0; i < 100; i++) {
            tasks.push({
                id: `task-${i}`,
                text: `Task ${i}`,
                checked: false,
                priority: 'normal',
                createdAt: Date.now()
            });
        }
    }, 10);

    benchmark('Render 100 task DOM elements', () => {
        const container = document.createElement('div');
        for (let i = 0; i < 100; i++) {
            const taskEl = document.createElement('li');
            taskEl.className = 'task-item';
            taskEl.innerHTML = `
                <input type="checkbox" id="task-${i}">
                <label for="task-${i}">Task ${i}</label>
                <button class="delete-btn">Delete</button>
            `;
            container.appendChild(taskEl);
        }
    }, 50);

    benchmark('Check/uncheck 100 tasks', () => {
        const tasks = Array.from({ length: 100 }, (_, i) => ({
            id: `task-${i}`,
            checked: false
        }));

        // Toggle all
        tasks.forEach(task => task.checked = true);
        tasks.forEach(task => task.checked = false);
    }, 5);

    // ===== LOCALSTORAGE OPERATIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">💾 localStorage Operations</h4>';

    benchmark('Save 1000 tasks to localStorage', () => {
        const data = {
            cycles: {
                'cycle-1': {
                    name: 'Test Cycle',
                    tasks: Array.from({ length: 1000 }, (_, i) => ({
                        id: `task-${i}`,
                        text: `Task ${i}`,
                        checked: false,
                        priority: 'normal',
                        createdAt: Date.now()
                    })),
                    cycleCount: 0
                }
            }
        };

        localStorage.setItem('miniCycle-perf-test', JSON.stringify(data));
        localStorage.removeItem('miniCycle-perf-test');
    }, 100);

    benchmark('Parse 1000 tasks from localStorage', () => {
        const data = {
            cycles: {
                'cycle-1': {
                    name: 'Test Cycle',
                    tasks: Array.from({ length: 1000 }, (_, i) => ({
                        id: `task-${i}`,
                        text: `Task ${i}`,
                        checked: false
                    }))
                }
            }
        };

        localStorage.setItem('miniCycle-perf-test', JSON.stringify(data));
        const loaded = JSON.parse(localStorage.getItem('miniCycle-perf-test'));
        localStorage.removeItem('miniCycle-perf-test');
    }, 50);

    // ===== ARRAY OPERATIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔢 Array Operations</h4>';

    benchmark('Filter 1000 tasks', () => {
        const tasks = Array.from({ length: 1000 }, (_, i) => ({
            id: `task-${i}`,
            checked: i % 2 === 0,
            priority: i % 3 === 0 ? 'high' : 'normal'
        }));

        const checked = tasks.filter(t => t.checked);
        const highPriority = tasks.filter(t => t.priority === 'high');
    }, 5);

    benchmark('Sort 1000 tasks by priority', () => {
        const tasks = Array.from({ length: 1000 }, (_, i) => ({
            id: `task-${i}`,
            priority: ['high', 'normal', 'low'][i % 3],
            createdAt: Date.now() - (i * 1000)
        }));

        const priorityOrder = { high: 0, normal: 1, low: 2 };
        tasks.sort((a, b) => {
            const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
            return diff !== 0 ? diff : b.createdAt - a.createdAt;
        });
    }, 10);

    benchmark('Map 1000 tasks to new structure', () => {
        const tasks = Array.from({ length: 1000 }, (_, i) => ({
            id: `task-${i}`,
            text: `Task ${i}`,
            checked: false
        }));

        const mapped = tasks.map(t => ({
            ...t,
            displayText: t.text.toUpperCase(),
            status: t.checked ? 'completed' : 'pending'
        }));
    }, 10);

    // ===== STRING OPERATIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📝 String Operations</h4>';

    benchmark('Escape HTML for 100 task texts', () => {
        const texts = Array.from({ length: 100 }, (_, i) =>
            `<script>Task ${i}</script> with "quotes" and 'apostrophes' & special chars`
        );

        texts.forEach(text => {
            const escaped = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        });
    }, 5);

    // ===== DATE OPERATIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📅 Date Operations</h4>';

    benchmark('Calculate 100 recurring task next occurrences', () => {
        const now = new Date();

        for (let i = 0; i < 100; i++) {
            const nextDaily = new Date(now);
            nextDaily.setDate(nextDaily.getDate() + 1);

            const nextWeekly = new Date(now);
            nextWeekly.setDate(nextWeekly.getDate() + 7);

            const nextMonthly = new Date(now);
            nextMonthly.setMonth(nextMonthly.getMonth() + 1);
        }
    }, 10);

    benchmark('Format 100 dates', () => {
        const dates = Array.from({ length: 100 }, (_, i) =>
            new Date(Date.now() + (i * 86400000))
        );

        dates.forEach(date => {
            const formatted = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        });
    }, 15);

    // ===== MEMORY OPERATIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🧠 Memory Operations</h4>';

    benchmark('Create and destroy 1000 objects', () => {
        let objects = [];

        // Create
        for (let i = 0; i < 1000; i++) {
            objects.push({
                id: `obj-${i}`,
                data: new Array(100).fill(0),
                timestamp: Date.now()
            });
        }

        // Destroy
        objects = null;
    }, 20);

    // ===== DOM MANIPULATION =====
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 DOM Manipulation</h4>';

    benchmark('Add and remove 100 DOM elements', () => {
        const container = document.createElement('div');
        const elements = [];

        // Add
        for (let i = 0; i < 100; i++) {
            const el = document.createElement('div');
            el.textContent = `Element ${i}`;
            container.appendChild(el);
            elements.push(el);
        }

        // Remove
        elements.forEach(el => el.remove());
    }, 30);

    benchmark('Update 100 element styles', () => {
        const container = document.createElement('div');
        const elements = [];

        for (let i = 0; i < 100; i++) {
            const el = document.createElement('div');
            container.appendChild(el);
            elements.push(el);
        }

        // Batch style updates
        elements.forEach(el => {
            el.style.backgroundColor = '#f0f0f0';
            el.style.padding = '10px';
            el.style.margin = '5px';
        });

        container.remove();
    }, 20);

    // ===== CYCLE OPERATIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Cycle Operations</h4>';

    benchmark('Create cycle with 100 tasks', () => {
        const cycle = {
            id: 'perf-cycle',
            name: 'Performance Test Cycle',
            tasks: Array.from({ length: 100 }, (_, i) => ({
                id: `task-${i}`,
                text: `Task ${i}`,
                checked: false,
                priority: ['high', 'normal', 'low'][i % 3],
                createdAt: Date.now() - (i * 1000)
            })),
            cycleCount: 0,
            autoReset: false,
            deleteCheckedTasks: false
        };
    }, 15);

    benchmark('Complete all tasks in 100-task cycle', () => {
        const tasks = Array.from({ length: 100 }, (_, i) => ({
            id: `task-${i}`,
            text: `Task ${i}`,
            checked: false
        }));

        // Mark all as checked
        tasks.forEach(task => task.checked = true);
    }, 5);

    benchmark('Reset 100 tasks (cycle completion)', () => {
        const tasks = Array.from({ length: 100 }, (_, i) => ({
            id: `task-${i}`,
            text: `Task ${i}`,
            checked: true
        }));

        // Reset all
        tasks.forEach(task => task.checked = false);
    }, 5);

    // ===== SEARCH AND FILTER =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔍 Search & Filter</h4>';

    benchmark('Search through 1000 tasks', () => {
        const tasks = Array.from({ length: 1000 }, (_, i) => ({
            id: `task-${i}`,
            text: `Task number ${i} with some description`,
            checked: i % 2 === 0
        }));

        const searchTerms = ['number', 'Task', 'description', '500'];
        searchTerms.forEach(term => {
            const results = tasks.filter(task =>
                task.text.toLowerCase().includes(term.toLowerCase())
            );
        });
    }, 10);

    benchmark('Filter tasks by multiple criteria', () => {
        const tasks = Array.from({ length: 1000 }, (_, i) => ({
            id: `task-${i}`,
            text: `Task ${i}`,
            checked: i % 2 === 0,
            priority: ['high', 'normal', 'low'][i % 3],
            hasDueDate: i % 5 === 0,
            isRecurring: i % 7 === 0
        }));

        // Apply multiple filters
        const filtered = tasks.filter(t =>
            !t.checked &&
            t.priority === 'high' &&
            t.hasDueDate &&
            !t.isRecurring
        );
    }, 10);

    // ===== JSON OPERATIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📦 JSON Operations</h4>';

    benchmark('Deep clone 100 task objects', () => {
        const tasks = Array.from({ length: 100 }, (_, i) => ({
            id: `task-${i}`,
            text: `Task ${i}`,
            checked: false,
            priority: 'normal',
            metadata: {
                createdAt: Date.now(),
                tags: ['tag1', 'tag2'],
                history: [{ action: 'created', timestamp: Date.now() }]
            }
        }));

        const cloned = tasks.map(task => JSON.parse(JSON.stringify(task)));
    }, 15);

    benchmark('Serialize and deserialize cycle data', () => {
        const data = {
            schemaVersion: 2.5,
            cycles: {
                'cycle-1': {
                    name: 'Test',
                    tasks: Array.from({ length: 100 }, (_, i) => ({
                        id: `task-${i}`,
                        text: `Task ${i}`,
                        checked: false
                    }))
                }
            }
        };

        const serialized = JSON.stringify(data);
        const deserialized = JSON.parse(serialized);
    }, 20);

    // ===== RESULTS SUMMARY =====
    resultsDiv.innerHTML += '<h3>📊 Performance Summary</h3>';

    const totalDuration = results.reduce((sum, r) => {
        return sum + (r.duration !== 'ERROR' ? parseFloat(r.duration) : 0);
    }, 0);

    const avgDuration = (totalDuration / results.filter(r => r.duration !== 'ERROR').length).toFixed(2);

    resultsDiv.innerHTML += `<div class="result pass" style="background: rgba(255, 255, 255, 0.95); color: #333; font-weight: 600;">📈 Total benchmark time: ${totalDuration.toFixed(2)}ms</div>`;
    resultsDiv.innerHTML += `<div class="result pass" style="background: rgba(255, 255, 255, 0.95); color: #333; font-weight: 600;">📊 Average operation time: ${avgDuration}ms</div>`;
    resultsDiv.innerHTML += `<div class="result pass" style="background: rgba(255, 255, 255, 0.95); color: #155724; font-weight: 600;">✅ Passed: ${passed.count}/${total.count} benchmarks</div>`;

    // Show warnings if any exceeded thresholds
    const warnings = results.filter(r => r.status === 'warn');
    if (warnings.length > 0) {
        resultsDiv.innerHTML += `<div class="result" style="background: #fff3cd; color: #856404; border-left: 4px solid #ffc107; font-weight: 600;">⚠️ ${warnings.length} operation(s) exceeded performance thresholds</div>`;
    }

    const errors = results.filter(r => r.status === 'error');
    if (errors.length > 0) {
        resultsDiv.innerHTML += `<div class="result fail" style="font-weight: 600;">❌ ${errors.length} operation(s) encountered errors</div>`;
    }

    // Memory info if available
    if (performance.memory) {
        const memoryMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
        const limitMB = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
        const memoryPercent = ((memoryMB / limitMB) * 100).toFixed(1);
        resultsDiv.innerHTML += `<div class="result pass" style="background: rgba(255, 255, 255, 0.95); color: #333; font-weight: 600;">🧠 Memory usage: ${memoryMB}MB / ${limitMB}MB (${memoryPercent}%)</div>`;
    }

    return { passed: passed.count, total: total.count, results };
}
