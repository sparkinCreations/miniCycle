/**
 * AppInit - 2-Phase Initialization Coordinator for miniCycle (DI-Pure)
 *
 * Solves race conditions by coordinating miniCycle module initialization:
 * - Phase 1 (Core Systems): AppState + cycle data loaded
 * - Phase 2 (App Ready): All miniCycle modules initialized
 *
 * Also provides plugin support with lifecycle hooks for extensibility.
 *
 * Now includes initialSetup and completeInitialSetup methods (extracted
 * from main script).
 *
 * @version 1.459
 */

// Module-level deps for late injection (DI-pure, no window.* fallbacks)
let _deps = {
	// For initialSetup
	loadMiniCycleData: null,
	createInitialSchema25Data: null,
	showCycleCreationModal: null,
	getOnboardingManager: null,
	getMiniCycleState: null,

	// For completeInitialSetup
	loadMiniCycle: null,
	updateReminderButtons: null,
	updateDueDateVisibility: null,
	checkOverdueTasks: null,
	organizeCompletedTasks: null,
	startReminders: null,
	updateThemeColor: null,
	getElementById: null,
	addBodyClass: null,
	removeBodyClass: null
};

export function setAppInitDependencies(dependencies) {
	const descriptors = {};
	for (const [key, value] of Object.entries(dependencies)) {
		descriptors[key] = { value, writable: true, configurable: true };
	}
	Object.defineProperties(_deps, descriptors);
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

	async waitForCore() {
		if (this.coreReady) {
			return;
		}

		if (!this._corePromise) {
			this._corePromise = new Promise(resolve => {
				this._coreResolve = resolve;
			});
		}

		console.log('⏳ Waiting for core systems...');
		await this._corePromise;
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

	async waitForApp() {
		if (this.appReady) {
			return;
		}

		if (!this._appPromise) {
			this._appPromise = new Promise(resolve => {
				this._appResolve = resolve;
			});
		}

		console.log('⏳ Waiting for miniCycle app...');
		await this._appPromise;
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
			console.log('🆕 No Schema 2.5 data found - creating initial structure...');
			_deps.createInitialSchema25Data?.();
			schemaData = miniCycleState?.load?.() || _deps.loadMiniCycleData?.();
		}

		const { cycles, activeCycle, reminders, settings } = schemaData;

		console.log('📦 Loaded Schema 2.5 data:', {
			activeCycle,
			cycleCount: Object.keys(cycles).length,
			hasReminders: !!reminders,
			hasSettings: !!settings
		});

		const onboardingManager = _deps.getOnboardingManager?.();
		if (onboardingManager?.shouldShowOnboarding?.()) {
			console.log('👋 First time user - showing onboarding first...');
			onboardingManager.showOnboarding(cycles, activeCycle);
			return;
		}

		if (!activeCycle || !cycles[activeCycle]) {
			console.log('🆕 Existing user, no active cycle found, prompting for new cycle creation...');
			_deps.showCycleCreationModal?.();
			return;
		}

		await this.runCompleteInitialSetup(activeCycle, null, schemaData);
	}

	async runCompleteInitialSetup(activeCycle, fullSchemaData = null, schemaData = null) {
		console.log('✅ Completing initial setup for cycle:', activeCycle);

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

		const { cycles, reminders, settings } = schemaData;
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
}

export const appInit = new AppInit();

export const APPINIT_VERSION = '2.0.0';

console.log('🚀 miniCycle AppInit loaded (Phase 2 - no window.* exports)');
