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
import { DOM_IDS, DOM_CLASSES, STORAGE_KEYS, Z_INDEX, UI_TIMEOUTS } from './constants.js';
import { getLabel } from '../labels/labelResolver.js';

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
	syncModeFromToggles: optional(null),
	getElementById: optional((id) => document.getElementById(id)),
	addBodyClass: optional((cls) => document.body.classList.add(cls)),
	removeBodyClass: optional((cls) => document.body.classList.remove(cls))
});

// Helper to get current deps (resolves fresh each time for late binding)
const getDeps = () => di.resolve();

// Legacy _deps reference for compatibility (uses getter for late binding)
/** @type {{loadMiniCycleData: Function|null, createInitialSchema25Data: Function|null, showCycleCreationModal: Function|null, getOnboardingManager: Function|null, getMiniCycleState: Function|null, showNotification: Function|null, loadMiniCycle: Function|null, updateReminderButtons: Function|null, updateDueDateVisibility: Function|null, checkOverdueTasks: Function|null, organizeCompletedTasks: Function|null, startReminders: Function|null, updateThemeColor: Function|null, getElementById: Function, addBodyClass: Function, removeBodyClass: Function}} */
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

	/**
	 * Reset appInit state for boot retry
	 * Called by orchestrator when boot fails and retry is needed
	 */
	reset() {
		this.coreReady = false;
		this.appReady = false;
		this._corePromise = null;
		this._coreResolve = null;
		this._appPromise = null;
		this._appResolve = null;
		this.startTime = Date.now();
		this.phaseTimings = {};
		// Note: Keep plugins and hooks registered - they should persist across retries
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
	}

	async runHooks(hookName) {
		const hooks = this.pluginHooks[hookName] || [];

		if (hooks.length === 0) {
			return;
		}

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
	}

	async runInitialSetup() {

		// Wait for core systems (AppState, etc.) to be ready before loading data
		// Note: With orchestrator pattern, core is always ready by Phase 3, but we check defensively
		if (!this.isCoreReady()) {
			await this.waitForCore();
		}

		const miniCycleState = _deps.getMiniCycleState?.();
		let schemaData = miniCycleState?.load?.() || _deps.loadMiniCycleData?.();

		if (!schemaData) {
			// Check if this is corrupted data vs truly empty
			const rawData = localStorage.getItem(STORAGE_KEYS.DATA);
			if (rawData) {
				// Data exists but couldn't be parsed - CORRUPTED
				console.error('🚨 DATA CORRUPTION DETECTED: localStorage has data but it cannot be parsed');
				console.error('🚨 Raw data length:', rawData.length, 'chars');

				// Show recovery modal
				this.showDataCorruptionRecovery(rawData);
				return;
			}

			_deps.createInitialSchema25Data?.();

			// ✅ FIX: Reload AppState so it picks up the newly created data
			// This ensures AppState.isReady() returns true for onboarding and subsequent code
			if (miniCycleState?.reload) {
				miniCycleState.reload();
			}

			schemaData = miniCycleState?.load?.() || _deps.loadMiniCycleData?.();
		}

		// Final check - if still no data, something is very wrong
		if (!schemaData) {
			console.error('🚨 Failed to load or create schema data');
			this.showDataCorruptionRecovery(localStorage.getItem(STORAGE_KEYS.DATA));
			return;
		}

		const { cycles, activeCycle, reminders, settings } = schemaData;

		// ✅ FIX: Check onboarding directly from schemaData instead of via AppState
		// This avoids a race condition where AppState.isReady() returns false on initial load
		// because data was just created by dataAccess and AppState wasn't re-initialized
		const hasSeenOnboarding = settings?.onboardingCompleted || false;
		const cycleCount = Object.keys(cycles || {}).length;
		const hasValidActiveCycle = activeCycle && cycles[activeCycle];

		// First-run focus-first flow: brand-new user with zero cycles.
		// Loads Your First Routine into Focus View; welcome toast + tour
		// notification defer until first focus-view exit (or app close).
		if (!hasSeenOnboarding && cycleCount === 0) {
			const onboardingManager = _deps.getOnboardingManager?.();
			if (onboardingManager?.runFirstRunFlow) {
				onboardingManager.runFirstRunFlow().catch(err => {
					console.error('❌ runFirstRunFlow failed:', err);
				});
			} else {
				console.warn('⚠️ runFirstRunFlow unavailable — falling back to legacy welcome modal');
				onboardingManager?.showOnboarding?.(cycles, activeCycle, schemaData);
			}
			return;
		}

		// Onboarding incomplete but cycles exist — either the user closed the
		// app mid-first-run (still in Focus View) OR they hit "Reset Onboarding"
		// in Settings. We split on focusModeActive:
		//   • Focus View → re-arm the first-session lifecycle so the welcome
		//     banner reappears and focus-exit / unload finalize onboarding.
		//   • Home View → show the legacy 3-step welcome modal (the original
		//     onboarding experience) for a refresher walkthrough.
		if (!hasSeenOnboarding) {
			const onboardingManager = _deps.getOnboardingManager?.();
			const focusModeActive = !!settings?.focusModeActive;
			if (!focusModeActive && onboardingManager?.showOnboarding) {
				onboardingManager.showOnboarding(cycles, activeCycle, schemaData);
				return;
			}
			onboardingManager?.armFirstSessionLifecycle?.();
			// Fall through to normal init
		}

		// 🛡️ DATA INTEGRITY CHECK: Ensure valid routines exist
		if (cycleCount === 0) {
			// No routines exist at all - show onboarding flow
			console.warn('⚠️ DATA INTEGRITY: No routines exist - showing onboarding with sample option');
			const onboardingManager = _deps.getOnboardingManager?.();
			if (onboardingManager?.showOnboarding) {
				onboardingManager.showOnboarding(cycles, activeCycle, schemaData);
			} else {
				// Fallback if onboarding manager not available
				_deps.showNotification?.(getLabel('notify.noRoutinesFound'), 'warning', UI_TIMEOUTS.NOTIFICATION_SLOW);
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
				const miniCycleState = _deps.getMiniCycleState?.();
				if (miniCycleState?.isReady?.()) {
					await miniCycleState.update(state => {
						state.appState.activeCycleId = firstCycle;
					}, true);
					// Reload schemaData with fixed activeCycle
					schemaData = miniCycleState.load();
					const recoveredActiveCycle = schemaData?.activeCycle || firstCycle;
					_deps.showNotification?.(getLabel('notify.recoveredRoutine', { vars: { name: recoveredActiveCycle } }), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
					await this.runCompleteInitialSetup(recoveredActiveCycle, null, schemaData);
					return;
				}
			}

			// Recovery failed - show creation modal
			console.warn('⚠️ DATA INTEGRITY: Recovery failed - showing creation modal');
			_deps.showNotification?.(getLabel('notify.noActiveRoutine'), 'warning', UI_TIMEOUTS.NOTIFICATION_SLOW);
			_deps.showCycleCreationModal?.();
			return;
		}

		await this.runCompleteInitialSetup(activeCycle, null, schemaData);
	}

	async runCompleteInitialSetup(activeCycle, fullSchemaData = null, schemaData = null) {

		// ✅ Remove onboarding-active class to show task list area
		document.body.classList.remove(DOM_CLASSES.ONBOARDING_ACTIVE);

		// Wait for core systems (TaskDOM is loaded in Phase 2, before Phase 3 runs)
		// Note: With orchestrator pattern, core is always ready by the time this runs
		if (!this.isCoreReady()) {
			await this.waitForCore();
		}

		const loadMiniCycle = _deps.loadMiniCycle?.();
		if (typeof loadMiniCycle === 'function') {
			await loadMiniCycle();

			const updateReminderButtons = _deps.updateReminderButtons?.();
			if (typeof updateReminderButtons === 'function') {
				await updateReminderButtons();
			}

			const updateDueDateVisibility = _deps.updateDueDateVisibility?.();
			if (typeof updateDueDateVisibility === 'function') {
				const toggleAutoReset = _deps.getElementById?.(DOM_IDS.TOGGLE_AUTO_RESET);
				const autoReset = toggleAutoReset?.checked || false;
				await updateDueDateVisibility(autoReset);
			}

			const checkOverdueTasks = _deps.checkOverdueTasks?.();
			if (typeof checkOverdueTasks === 'function') {
				await checkOverdueTasks();
			}

			const organizeCompletedTasks = _deps.organizeCompletedTasks?.();
			if (typeof organizeCompletedTasks === 'function') {
				organizeCompletedTasks();
			}
		} else {
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

		const titleElement = _deps.getElementById?.(DOM_IDS.MINI_CYCLE_TITLE);
		const toggleAutoReset = _deps.getElementById?.(DOM_IDS.TOGGLE_AUTO_RESET);
		const deleteCheckedTasks = _deps.getElementById?.(DOM_IDS.DELETE_CHECKED_TASKS);
		const enableReminders = _deps.getElementById?.(DOM_IDS.ENABLE_REMINDERS);
		const frequencySection = _deps.getElementById?.(DOM_IDS.FREQUENCY_SECTION);

		if (titleElement) {
			titleElement.textContent = currentCycle.title;
		}

		if (toggleAutoReset) {
			toggleAutoReset.checked = currentCycle.autoReset || false;
		}

		if (deleteCheckedTasks) {
			deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
		}

		// Sync mode selector dropdown to match the toggle states we just set
		await _deps.syncModeFromToggles?.();

		if (enableReminders) {
			enableReminders.checked = reminders.enabled === true;

			if (reminders.enabled && frequencySection) {
				frequencySection.classList.remove(DOM_CLASSES.HIDDEN);
				_deps.startReminders?.();
			}
		}

		if (settings.darkMode) {
			_deps.addBodyClass?.('dark-mode');
			document.documentElement?.classList.add(DOM_CLASSES.DARK_MODE);
		} else {
			_deps.removeBodyClass?.('dark-mode');
			document.documentElement?.classList.remove(DOM_CLASSES.DARK_MODE);
		}

		if (settings.theme && settings.theme !== 'default') {
			const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
			allThemes.forEach(theme => _deps.removeBodyClass?.(theme));
			_deps.addBodyClass?.(`theme-${settings.theme}`);
		}

		_deps.updateThemeColor?.();

		// Accessibility settings
		if (settings.reducedMotion) {
			_deps.addBodyClass?.('reduced-motion');
			document.documentElement?.classList.add(DOM_CLASSES.REDUCED_MOTION);
		}
		if (settings.highContrast) {
			_deps.addBodyClass?.('high-contrast');
		}
		if (settings.fontSize && settings.fontSize !== '16') {
			document.documentElement.style.setProperty('--font-size-base', `${settings.fontSize}px`);
		}

		return true;
	}

	/**
	 * Show data corruption recovery modal
	 * Offers options to recover from corrupted localStorage data
	 */
	showDataCorruptionRecovery(corruptedData) {

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
			z-index: ${Z_INDEX.CRITICAL};
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
		document.getElementById(DOM_IDS.RECOVERY_FRESH_START).addEventListener('click', () => {
			localStorage.removeItem(STORAGE_KEYS.DATA);
			modal.remove();
			window.location.reload();
		});

		document.getElementById(DOM_IDS.RECOVERY_LOAD_SAMPLE).addEventListener('click', async () => {
			localStorage.removeItem(STORAGE_KEYS.DATA);
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

		document.getElementById(DOM_IDS.RECOVERY_DOWNLOAD_BACKUP).addEventListener('click', () => {
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

/** @type {AppInit} Singleton instance coordinating app initialization lifecycle */
export const appInit = new AppInit();

/** @type {string} Version of the AppInit module */
export const APPINIT_VERSION = '2.0.0';

