/**
 * miniCycle AppInit - 2-Phase Initialization Coordinator
 *
 * Solves race conditions by coordinating module initialization with
 * a promise-based waiting system. Modules can wait for specific phases
 * to complete before proceeding with their initialization.
 *
 * Initialization Phases:
 * - Phase 1 (Core Systems): AppState + cycle data loaded
 * - Phase 2 (App Ready): All modules initialized, UI ready
 *
 * Features:
 * - Promise-based phase waiting with timeout protection
 * - Plugin registration and lifecycle hooks
 * - Initial setup orchestration (onboarding, cycle loading)
 * - Performance timing and status reporting
 *
 * @module core/appInit
 * @version 2.0.0
 * @see {@link module:boot/orchestrator} - Boot sequence coordinator
 * @see {@link module:core/appState} - State management
 */

/**
 * @typedef {import('./types.js').Schema25Data} Schema25Data
 * @typedef {import('./types.js').Cycle} Cycle
 */

/**
 * @typedef {Object} AppInitStatus
 * @property {boolean} coreReady - Whether Phase 1 (core) is complete
 * @property {boolean} appReady - Whether Phase 2 (app) is complete
 * @property {number} pluginCount - Number of registered plugins
 * @property {Object} timings - Phase timing data in milliseconds
 * @property {Array<{name: string, version: string}>} plugins - Registered plugins
 */

import { createDIModule, optional } from './diBase.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('AppInit', {
	// For initialSetup
	loadMiniCycleData: optional(null),
	createInitialSchema25Data: optional(null),
	showCycleCreationModal: optional(null),
	getOnboardingManager: optional(null),
	getMiniCycleState: optional(null),
	showNotification: optional(null),  // For data integrity warnings

	// For completeInitialSetup
	loadMiniCycle: optional(null),
	updateReminderButtons: optional(null),
	updateDueDateVisibility: optional(null),
	checkOverdueTasks: optional(null),
	organizeCompletedTasks: optional(null),
	startReminders: optional(null),
	updateThemeColor: optional(null),
	getElementById: optional((id) => document.getElementById(id)),
	addBodyClass: optional((cls) => document.body.classList.add(cls)),
	removeBodyClass: optional((cls) => document.body.classList.remove(cls))
});

// Helper to get current deps (resolves fresh each time for late binding)
const getDeps = () => di.resolve();

// Legacy _deps reference for compatibility (uses getter for late binding)
const _deps = new Proxy({}, {
	get(_, prop) {
		return getDeps()[prop];
	}
});

/**
 * Set the AppInit dependencies
 * @param {Object} dependencies - Dependencies to inject
 */
export function setAppInitDependencies(dependencies) {
	di.setDependencies(dependencies);
	console.log('🎯 AppInit dependencies set:', Object.keys(dependencies));
}

class AppInit {
	constructor() {
		this.coreReady = false;
		this.appReady = false;

		this._corePromise = null;
		this._coreResolve = null;
		this._appPromise = null;
		this._appResolve = null;

		this.plugins = new Map();
		this.pluginHooks = {
			beforeCore: [],
			afterCore: [],
			beforeApp: [],
			afterApp: []
		};

		this.startTime = Date.now();
		this.phaseTimings = {};
	}

	async markCoreSystemsReady() {
		if (this.coreReady) {
			console.warn('⚠️ Core systems already marked as ready');
			return;
		}

		const startTime = Date.now();
		await this.runHooks('beforeCore');

		this.coreReady = true;
		this.phaseTimings.core = Date.now() - startTime;

		if (this._coreResolve) {
			this._coreResolve();
		}

		console.log(`✅ Core systems ready (${this.phaseTimings.core}ms)`);

		await this.runHooks('afterCore');
		document.dispatchEvent(new Event('init:core-ready'));
	}

	async waitForCore(timeoutMs = 10000) {
		if (this.coreReady) {
			return;
		}

		if (!this._corePromise) {
			this._corePromise = new Promise(resolve => {
				this._coreResolve = resolve;
			});
		}

		console.log('⏳ Waiting for core systems...');

		// Timeout safety: don't hang forever if core never becomes ready
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => {
				reject(new Error(`waitForCore timed out after ${timeoutMs}ms - core never became ready`));
			}, timeoutMs);
		});

		try {
			await Promise.race([this._corePromise, timeoutPromise]);
		} catch (err) {
			console.error('❌', err.message);
			console.warn('⚠️ Continuing without core ready - some features may not work');
			// Don't rethrow - allow app to continue in degraded state
		}
	}

	isCoreReady() {
		return this.coreReady;
	}

	async markAppReady() {
		if (this.appReady) {
			console.warn('⚠️ miniCycle app already marked as ready');
			return;
		}

		const startTime = Date.now();
		await this.runHooks('beforeApp');

		this.appReady = true;
		this.phaseTimings.app = Date.now() - startTime;
		this.phaseTimings.total = Date.now() - this.startTime;

		if (this._appResolve) {
			this._appResolve();
		}

		console.log(`✅ miniCycle app ready (${this.phaseTimings.app}ms) - Total: ${this.phaseTimings.total}ms`);

		await this.runHooks('afterApp');
		document.dispatchEvent(new Event('init:app-ready'));
	}

	async waitForApp(timeoutMs = 15000) {
		if (this.appReady) {
			return;
		}

		if (!this._appPromise) {
			this._appPromise = new Promise(resolve => {
				this._appResolve = resolve;
			});
		}

		console.log('⏳ Waiting for miniCycle app...');

		// Timeout safety: don't hang forever if app never becomes ready
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => {
				reject(new Error(`waitForApp timed out after ${timeoutMs}ms - app never became ready`));
			}, timeoutMs);
		});

		try {
			await Promise.race([this._appPromise, timeoutPromise]);
		} catch (err) {
			console.error('❌', err.message);
			console.warn('⚠️ Continuing without app ready - some features may not work');
		}
	}

	isAppReady() {
		return this.appReady;
	}

	registerPlugin(name, plugin) {
		if (this.plugins.has(name)) {
			console.warn(`⚠️ Plugin ${name} already registered, skipping`);
			return false;
		}

		this.plugins.set(name, plugin);
		console.log(`🔌 Plugin registered: ${name}`);
		return true;
	}

	getPlugin(name) {
		return this.plugins.get(name);
	}

	hasPlugin(name) {
		return this.plugins.has(name);
	}

	getPlugins() {
		return Array.from(this.plugins.entries()).map(([name, plugin]) => ({
			name,
			version: plugin.version || 'unknown',
			plugin
		}));
	}

	addHook(hookName, callback) {
		if (!this.pluginHooks[hookName]) {
			throw new Error(`Unknown hook: ${hookName}. Available: ${Object.keys(this.pluginHooks).join(', ')}`);
		}

		this.pluginHooks[hookName].push(callback);
		console.log(`🪝 Hook added: ${hookName}`);
	}

	async runHooks(hookName) {
		const hooks = this.pluginHooks[hookName] || [];

		if (hooks.length === 0) {
			return;
		}

		console.log(`🪝 Running ${hooks.length} ${hookName} hook(s)...`);

		for (const hook of hooks) {
			try {
				await hook();
			} catch (error) {
				console.error(`Hook ${hookName} failed:`, error);
			}
		}
	}

	getStatus() {
		return {
			coreReady: this.coreReady,
			appReady: this.appReady,
			pluginCount: this.plugins.size,
			timings: this.phaseTimings,
			plugins: this.getPlugins().map(p => ({ name: p.name, version: p.version }))
		};
	}

	printStatus() {
		const status = this.getStatus();
		console.log('📊 miniCycle AppInit Status:', {
			'✅ Core Systems Ready': status.coreReady,
			'✅ App Ready': status.appReady,
			'🔌 Plugins': status.pluginCount,
			'⏱️ Timings': status.timings,
			'📦 Loaded Plugins': status.plugins
		});
	}

	async runInitialSetup() {
		console.log('🚀 Initializing app (Schema 2.5 only)...');

		if (!this.isAppReady()) {
			console.log('⏳ Waiting for Phase 2 modules to finish loading...');
			await this.waitForApp();
			console.log('✅ Phase 2 modules ready, proceeding with initialSetup');
		}

		const miniCycleState = _deps.getMiniCycleState?.();
		let schemaData = miniCycleState?.load?.() || _deps.loadMiniCycleData?.();

		if (!schemaData) {
			// Check if this is corrupted data vs truly empty
			const rawData = localStorage.getItem('miniCycleData');
			if (rawData) {
				// Data exists but couldn't be parsed - CORRUPTED
				console.error('🚨 DATA CORRUPTION DETECTED: localStorage has data but it cannot be parsed');
				console.error('🚨 Raw data preview:', rawData.substring(0, 100));

				// Show recovery modal
				this.showDataCorruptionRecovery(rawData);
				return;
			}

			console.log('🆕 No Schema 2.5 data found - creating initial structure...');
			_deps.createInitialSchema25Data?.();

			// ✅ FIX: Reload AppState so it picks up the newly created data
			// This ensures AppState.isReady() returns true for onboarding and subsequent code
			if (miniCycleState?.reload) {
				miniCycleState.reload();
				console.log('✅ AppState reloaded with new data');
			}

			schemaData = miniCycleState?.load?.() || _deps.loadMiniCycleData?.();
		}

		// Final check - if still no data, something is very wrong
		if (!schemaData) {
			console.error('🚨 Failed to load or create schema data');
			this.showDataCorruptionRecovery(localStorage.getItem('miniCycleData'));
			return;
		}

		const { cycles, activeCycle, reminders, settings } = schemaData;

		console.log('📦 Loaded Schema 2.5 data:', {
			activeCycle,
			cycleCount: Object.keys(cycles).length,
			hasReminders: !!reminders,
			hasSettings: !!settings
		});

		// ✅ FIX: Check onboarding directly from schemaData instead of via AppState
		// This avoids a race condition where AppState.isReady() returns false on initial load
		// because data was just created by dataAccess and AppState wasn't re-initialized
		const hasSeenOnboarding = settings?.onboardingCompleted || false;
		if (!hasSeenOnboarding) {
			console.log('👋 First time user - showing onboarding first...');
			const onboardingManager = _deps.getOnboardingManager?.();
			// Pass schemaData to avoid AppState race condition
			onboardingManager?.showOnboarding?.(cycles, activeCycle, schemaData);
			return;
		}

		// 🛡️ DATA INTEGRITY CHECK: Ensure valid routines exist
		const cycleCount = Object.keys(cycles || {}).length;
		const hasValidActiveCycle = activeCycle && cycles[activeCycle];

		if (cycleCount === 0) {
			// No routines exist at all - show onboarding flow
			console.warn('⚠️ DATA INTEGRITY: No routines exist - showing onboarding with sample option');
			const onboardingManager = _deps.getOnboardingManager?.();
			if (onboardingManager?.showOnboarding) {
				onboardingManager.showOnboarding(cycles, activeCycle, schemaData);
			} else {
				// Fallback if onboarding manager not available
				_deps.showNotification?.('No routines found. Create one or load a sample.', 'warning', 5000);
				_deps.showCycleCreationModal?.();
			}
			return;
		}

		if (!hasValidActiveCycle) {
			// Routines exist but none is active - data corruption
			console.warn('⚠️ DATA INTEGRITY: No active routine (but routines exist) - attempting recovery');

			// Try to auto-recover by activating the first available routine
			const availableCycles = Object.keys(cycles);
			const firstCycle = availableCycles[0];

			if (firstCycle) {
				console.log(`🔧 Auto-recovering: Setting active routine to "${firstCycle}"`);
				const miniCycleState = _deps.getMiniCycleState?.();
				if (miniCycleState?.isReady?.()) {
					await miniCycleState.update(state => {
						state.appState.activeCycleId = firstCycle;
					}, true);
					// Reload schemaData with fixed activeCycle
					schemaData = miniCycleState.load();
					const recoveredActiveCycle = schemaData?.activeCycle || firstCycle;
					_deps.showNotification?.(`Recovered: Activated "${recoveredActiveCycle}"`, 'success', 3000);
					await this.runCompleteInitialSetup(recoveredActiveCycle, null, schemaData);
					return;
				}
			}

			// Recovery failed - show creation modal
			console.warn('⚠️ DATA INTEGRITY: Recovery failed - showing creation modal');
			_deps.showNotification?.('No active routine found. Create one or load a sample.', 'warning', 5000);
			_deps.showCycleCreationModal?.();
			return;
		}

		await this.runCompleteInitialSetup(activeCycle, null, schemaData);
	}

	async runCompleteInitialSetup(activeCycle, fullSchemaData = null, schemaData = null) {
		console.log('✅ Completing initial setup for cycle:', activeCycle);

		// ✅ Remove onboarding-active class to show task list area
		document.body.classList.remove('onboarding-active');

		console.log('⏳ Waiting for TaskDOM to be ready...');
		await this.waitForApp();
		console.log('✅ TaskDOM ready, proceeding with task loading');

		console.log('🎯 Loading miniCycle...');
		const loadMiniCycle = _deps.loadMiniCycle?.();
		if (typeof loadMiniCycle === 'function') {
			await loadMiniCycle();

			console.log('📋 Tasks rendered, updating reminder buttons, due date visibility, and checking overdue tasks...');

			const updateReminderButtons = _deps.updateReminderButtons?.();
			if (typeof updateReminderButtons === 'function') {
				await updateReminderButtons();
				console.log('✅ Reminder buttons updated after task rendering');
			}

			const updateDueDateVisibility = _deps.updateDueDateVisibility?.();
			if (typeof updateDueDateVisibility === 'function') {
				const toggleAutoReset = _deps.getElementById?.('toggleAutoReset');
				const autoReset = toggleAutoReset?.checked || false;
				await updateDueDateVisibility(autoReset);
				console.log('✅ Due date visibility updated after task rendering');
			}

			const checkOverdueTasks = _deps.checkOverdueTasks?.();
			if (typeof checkOverdueTasks === 'function') {
				await checkOverdueTasks();
				console.log('✅ Overdue tasks checked after task rendering');
			}

			const organizeCompletedTasks = _deps.organizeCompletedTasks?.();
			if (typeof organizeCompletedTasks === 'function') {
				organizeCompletedTasks();
				console.log('✅ Completed tasks organized after task rendering');
			}
		} else {
			console.log('⏳ Loader not ready yet, flagging pending load');
		}

		const miniCycleState = _deps.getMiniCycleState?.();
		if (!schemaData) {
			schemaData = miniCycleState?.load?.() || _deps.loadMiniCycleData?.();
		}

		const { cycles, reminders, settings } = schemaData || {};

		if (!cycles) {
			console.warn('⚠️ No cycles data found in schema - legacy migration may still be in progress');
			return;
		}

		const currentCycle = cycles[activeCycle];

		if (!currentCycle) {
			console.error('❌ Cycle not found after setup:', activeCycle);
			return;
		}

		console.log('✅ Loading existing cycle from Schema 2.5:', activeCycle);

		const titleElement = _deps.getElementById?.('mini-cycle-title');
		const toggleAutoReset = _deps.getElementById?.('toggleAutoReset');
		const deleteCheckedTasks = _deps.getElementById?.('deleteCheckedTasks');
		const enableReminders = _deps.getElementById?.('enableReminders');
		const frequencySection = _deps.getElementById?.('frequency-section');

		if (titleElement) {
			titleElement.textContent = currentCycle.title;
		}

		if (toggleAutoReset) {
			toggleAutoReset.checked = currentCycle.autoReset || false;
		}

		if (deleteCheckedTasks) {
			deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
		}

		console.log('⚙️ Applied cycle settings:', {
			autoReset: currentCycle.autoReset,
			deleteCheckedTasks: currentCycle.deleteCheckedTasks
		});

		if (enableReminders) {
			enableReminders.checked = reminders.enabled === true;

			if (reminders.enabled && frequencySection) {
				console.log('🔔 Starting reminders...');
				frequencySection.classList.remove('hidden');
				_deps.startReminders?.();
			}
		}

		if (settings.darkMode) {
			console.log('🌙 Applying dark mode...');
			_deps.addBodyClass?.('dark-mode');
		}

		if (settings.theme && settings.theme !== 'default') {
			console.log('🎨 Applying theme:', settings.theme);
			const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
			allThemes.forEach(theme => _deps.removeBodyClass?.(theme));
			_deps.addBodyClass?.(`theme-${settings.theme}`);
		}

		_deps.updateThemeColor?.();

		console.log('✅ miniCycle app is fully initialized and ready (Schema 2.5).');
		console.log('🎉 Initialization sequence completed successfully!');
		console.log('✅ Initial setup completed successfully');

		return true;
	}

	/**
	 * Show data corruption recovery modal
	 * Offers options to recover from corrupted localStorage data
	 */
	showDataCorruptionRecovery(corruptedData) {
		console.log('🚨 Showing data corruption recovery modal...');

		// Create modal overlay
		const modal = document.createElement('div');
		modal.id = 'data-corruption-modal';
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.9);
			z-index: 100000;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
			box-sizing: border-box;
		`;

		const content = document.createElement('div');
		content.style.cssText = `
			background: linear-gradient(135deg, #1a1a2e, #16213e);
			border-radius: 16px;
			padding: 32px;
			max-width: 500px;
			width: 100%;
			color: white;
			font-family: 'Inter', -apple-system, sans-serif;
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
		`;

		const preview = corruptedData ? corruptedData.substring(0, 50) + '...' : 'No data';

		content.innerHTML = `
			<h2 style="margin: 0 0 16px; color: #ff6b6b; font-size: 1.5rem;">
				⚠️ Data Corruption Detected
			</h2>
			<p style="margin: 0 0 16px; opacity: 0.9; line-height: 1.5;">
				Your saved data appears to be corrupted and cannot be loaded. This may have happened during a test run or browser issue.
			</p>
			<p style="margin: 0 0 24px; font-size: 0.85rem; opacity: 0.7; font-family: monospace; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; word-break: break-all;">
				Preview: ${preview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
			</p>
			<div style="display: flex; flex-direction: column; gap: 12px;">
				<button id="recovery-fresh-start" style="
					background: linear-gradient(135deg, #4c79ff, #74c0fc);
					border: none;
					color: white;
					padding: 14px 20px;
					border-radius: 8px;
					cursor: pointer;
					font-size: 1rem;
					font-weight: 600;
				">
					🆕 Start Fresh (Clear Data)
				</button>
				<button id="recovery-load-sample" style="
					background: rgba(255,255,255,0.1);
					border: 1px solid rgba(255,255,255,0.3);
					color: white;
					padding: 14px 20px;
					border-radius: 8px;
					cursor: pointer;
					font-size: 1rem;
				">
					📥 Load Sample Routine
				</button>
				<button id="recovery-download-backup" style="
					background: transparent;
					border: 1px solid rgba(255,255,255,0.2);
					color: rgba(255,255,255,0.7);
					padding: 10px 20px;
					border-radius: 8px;
					cursor: pointer;
					font-size: 0.9rem;
				">
					💾 Download Corrupted Data (for recovery)
				</button>
			</div>
		`;

		modal.appendChild(content);
		document.body.appendChild(modal);

		// Button handlers
		document.getElementById('recovery-fresh-start').addEventListener('click', () => {
			localStorage.removeItem('miniCycleData');
			modal.remove();
			window.location.reload();
		});

		document.getElementById('recovery-load-sample').addEventListener('click', async () => {
			localStorage.removeItem('miniCycleData');
			modal.remove();
			// Create initial data then show cycle creation modal with sample option
			_deps.createInitialSchema25Data?.();
			const miniCycleState = _deps.getMiniCycleState?.();
			if (miniCycleState?.reload) {
				miniCycleState.reload();
			}
			// Trigger sample load
			_deps.showCycleCreationModal?.();
		});

		document.getElementById('recovery-download-backup').addEventListener('click', () => {
			// Download the corrupted data for potential manual recovery
			const blob = new Blob([corruptedData || ''], { type: 'text/plain' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `miniCycle-corrupted-backup-${Date.now()}.txt`;
			a.click();
			URL.revokeObjectURL(url);
		});
	}
}

export const appInit = new AppInit();

export const APPINIT_VERSION = '2.0.0';

console.log('🚀 miniCycle AppInit loaded (Phase 2 - no window.* exports)');
