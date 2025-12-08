// startupManager.tests.js - Browser-based tests for StartupManager

import { setStartupManagerDependencies, StartupManager } from '../modules/core/startupManager.js';
import {
  setupTestEnvironment,
  createProtectedTest,
  createMockAppState,
  createMockData,
  setupLocalStorage
} from './testHelpers.js';

export async function runStartupManagerTests(resultsDiv, isPartOfSuite = false) {
  resultsDiv.innerHTML = '<h2>StartupManager Tests</h2><h3>Setting up mocks...</h3>';

  const env = await setupTestEnvironment();

  resultsDiv.innerHTML = '<h2>StartupManager Tests</h2><h3>Running tests...</h3>';
  let passed = { count: 0 }, total = { count: 0 };

  const test = createProtectedTest(resultsDiv, passed, total);

  // Test 1: Restores last active cycle without mutating data
  await test('Restores last active cycle and preserves tasks', async () => {
    const mockSchema = createMockData({
      settings: {
        appState: {
          activeCycle: 'Test Cycle'
        }
      },
      data: {
        cycles: [
          {
            name: 'Test Cycle',
            tasks: [
              { id: 't1', title: 'Task 1' },
              { id: 't2', title: 'Task 2' }
            ]
          }
        ]
      }
    });

    setupLocalStorage(mockSchema); // ensure AppState mock reads this

    const mockState = createMockAppState();
    let loadMiniCycleCalledWith = null;

    setStartupManagerDependencies({
      AppState: () => mockState,
      loadMiniCycleData: () => mockSchema,
      loadMiniCycle: (name) => {
        loadMiniCycleCalledWith = name;
      },
      refreshUIFromState: () => {},
      showNotification: () => {},
      AppMeta: { version: 'test' }
    });

    const manager = new StartupManager();
    await manager.restoreLastSession();

    if (loadMiniCycleCalledWith !== 'Test Cycle') {
      throw new Error(`Expected loadMiniCycle to be called with "Test Cycle", got "${loadMiniCycleCalledWith}"`);
    }

    const restored = mockSchema.data.cycles.find(c => c.name === 'Test Cycle');
    if (!restored || !Array.isArray(restored.tasks) || restored.tasks.length !== 2) {
      throw new Error('Tasks were mutated or lost during restore');
    }
  });

  // Test 2: Safe no-op when no active cycle
  await test('No-op when no active cycle is set', async () => {
    const mockSchema = createMockData({
      settings: {
        appState: {
          activeCycle: null
        }
      }
    });

    setupLocalStorage(mockSchema);

    const mockState = createMockAppState();
    let loadMiniCycleCalls = 0;

    setStartupManagerDependencies({
      AppState: () => mockState,
      loadMiniCycleData: () => mockSchema,
      loadMiniCycle: () => { loadMiniCycleCalls++; },
      refreshUIFromState: () => {},
      showNotification: () => {},
      AppMeta: { version: 'test' }
    });

    const manager = new StartupManager();
    await manager.restoreLastSession();

    if (loadMiniCycleCalls !== 0) {
      throw new Error('loadMiniCycle should not be called when no active cycle');
    }
  });
}
