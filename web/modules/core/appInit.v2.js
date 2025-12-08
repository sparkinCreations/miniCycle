/**
 * AppInit v2 - 2-Phase Initialization Coordinator for miniCycle (DI-Pure)
 *
 * This file is the canonical implementation. The legacy appInit.js file
 * re-exports from here so that all import paths share the same singleton
 * and always receive the latest implementation.
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
	console.log('🎯 AppInit v2 dependencies set:', Object.keys(dependencies));
}

// Legacy appInit.v2.js has been deprecated and replaced by modules/core/appInit.js.
// This stub file remains only to guard against stale imports; it throws on load.

throw new Error(
	'Legacy modules/core/appInit.v2.js is no longer supported. ' +
	'Please clear your cache or update references to use modules/core/appInit.js instead.'
);
		this._appPromise = null;

		this._appResolve = null;
