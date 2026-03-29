/**
 * @file routineManager.js (DI-Pure)
 * @description Routine creation and management functionality for miniCycle
 * @module modules/routineManager
 * @pattern Resilient Constructor 🛡️
 *
 * Handles:
 * - New cycle creation with modal UI
 * - Sample cycle preloading
 * - Fallback cycle creation
 * - Duplicate name handling
 * - Onboarding integration
 */

import { createDIModule, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, APP_VERSION, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DYNAMIC IMPORTS (loaded at init time with version cache-busting)
// ============================================================================

// Storage utilities - dynamically loaded to avoid ES module cache issues
let canAddToStorage, getStorageShortageMessage;

// Name utilities
let getUniqueCycleName;

// Estimated size for a new empty cycle (structure overhead)
const ESTIMATED_NEW_CYCLE_SIZE = 800; // ~400 chars * 2 bytes

// Cached sample manifest (fetched once per session from manifest.json)
let _sampleManifestCache = null;

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('RoutineManager', {
    AppState: optional(null),
    loadMiniCycleData: optional(null),
    showPromptModal: optional(null),
    showNotification: optional(null),
    sanitizeInput: optional(null),
    completeInitialSetup: optional(null),
    hideMainMenu: optional(null),
    updateMainMenuHeader: optional(null),
    updateProgressBar: optional(null),
    checkCompleteAllButton: optional(null),
    autoSave: optional(null),
    onCycleCreated: optional(null),
    DEFAULT_TASK_OPTION_BUTTONS: optional(null),
    AppMeta: optional(null),
    refreshThemeLabels: optional(null),
    syncModeFromToggles: optional(null),
    updateRecurringInfoLink: optional(null),
    loadMiniCycle: optional(null),
    getBody: optional(() => document.body),
});

// Late-binding deps via Proxy
/** @type {{AppState: Object|null, loadMiniCycleData: Function|null, showPromptModal: Function|null, showNotification: Function|null, sanitizeInput: Function|null, completeInitialSetup: Function|null, hideMainMenu: Function|null, updateMainMenuHeader: Function|null, updateProgressBar: Function|null, checkCompleteAllButton: Function|null, autoSave: Function|null, onCycleCreated: Function|null, DEFAULT_TASK_OPTION_BUTTONS: Object|null, AppMeta: Object|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for RoutineManager (call before creating instance)
 * @param {Object} dependencies - { AppState, showNotification, sanitizeInput, etc. }
 */
export function setRoutineManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
}

/**
 * Manages routine CRUD operations including creation, renaming, deletion, and reset
 */
export class RoutineManager {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        this.deps = {
            // State management (required)
            AppState: resolvedDeps.AppState,
            loadMiniCycleData: resolvedDeps.loadMiniCycleData,

            // UI functions (required)
            showPromptModal: resolvedDeps.showPromptModal,
            showNotification: resolvedDeps.showNotification || this.fallbackNotification.bind(this),
            sanitizeInput: resolvedDeps.sanitizeInput,

            // Lifecycle functions (required)
            completeInitialSetup: resolvedDeps.completeInitialSetup,
            hideMainMenu: resolvedDeps.hideMainMenu,
            updateMainMenuHeader: resolvedDeps.updateMainMenuHeader || (() => {}),
            updateProgressBar: resolvedDeps.updateProgressBar || (() => {}),
            checkCompleteAllButton: resolvedDeps.checkCompleteAllButton || (() => {}),
            autoSave: resolvedDeps.autoSave || (() => {}),

            // Undo system callback (optional)
            onCycleCreated: resolvedDeps.onCycleCreated || null,

            // Constants (required)
            DEFAULT_TASK_OPTION_BUTTONS: resolvedDeps.DEFAULT_TASK_OPTION_BUTTONS,

            // Theme
            refreshThemeLabels: resolvedDeps.refreshThemeLabels || null,

            // Mode sync (must run before refreshThemeLabels on new routine creation)
            syncModeFromToggles: resolvedDeps.syncModeFromToggles || null,

            // Recurring info
            updateRecurringInfoLink: resolvedDeps.updateRecurringInfoLink || null,

            // Load routine (for non-onboarding sample loading)
            loadMiniCycle: resolvedDeps.loadMiniCycle || null,

            // DOM functions
            getBody: resolvedDeps.getBody || (() => document.body),
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelector: dependencies.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel))
        };

        // Validate required dependencies
        this._validateDependencies();

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = resolvedDeps.AppMeta?.version;
    }

    /**
     * Validate that required dependencies are provided
     * @private
     */
    _validateDependencies() {
        const required = [
            'AppState',
            'loadMiniCycleData',
            'showPromptModal',
            'sanitizeInput',
            'completeInitialSetup',
            'hideMainMenu',
            'DEFAULT_TASK_OPTION_BUTTONS'
        ];

        const missing = required.filter(dep => !this.deps[dep]);

        if (missing.length > 0) {
            console.error('❌ RoutineManager missing required dependencies:', missing);
            throw new Error(`RoutineManager missing required dependencies: ${missing.join(', ')}`);
        }
    }

    /**
     * Ensure AppState is ready, attempting reload if needed
     * @param {string} operation - Description of the operation (for error logging)
     * @returns {boolean} True if AppState is ready, false otherwise
     * @private
     */
    _ensureAppStateReady(operation) {
        const appState = this.deps.AppState;
        if (!appState?.isReady?.()) {
            appState?.reload?.();
        }
        if (!appState?.isReady?.()) {
            console.error(`❌ AppState not ready for ${operation}`);
            return false;
        }
        return true;
    }

    /**
     * Fallback notification for when showNotification isn't available
     */
    fallbackNotification(message, type, duration) {
    }

    /**
     * Show cycle creation modal for onboarding
     */
    showCycleCreationModal() {

        setTimeout(() => {
            this._buildCreationDialog({
                title: 'modal.createRoutineTitle',
                message: 'modal.createRoutineMessage',
                placeholder: 'modal.createRoutinePlaceholder',
                isOnboarding: true,
                onCreateBlank: async (inputValue) => {
                    const newCycleName = this.deps.sanitizeInput(inputValue);
                    const cycleId = `cycle_${Date.now()}`;

                    const appState = this.deps.AppState;

                    if (!this._ensureAppStateReady('cycle creation')) {
                        this.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
                        return;
                    }

                    const existingCycles = appState.get()?.data?.cycles || {};
                    const { name: finalTitle, wasModified } = getUniqueCycleName(newCycleName, existingCycles);

                    if (wasModified) {
                        this.deps.showNotification('⚠️ ' + getLabel('notify.nameExists', { vars: { name: finalTitle } }), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
                    }

                    await appState.update(state => {
                        state.data.cycles[finalTitle] = {
                            id: cycleId,
                            title: finalTitle,
                            tasks: [],
                            autoReset: true,
                            deleteCheckedTasks: false,
                            cycleCount: 0,
                            createdAt: Date.now(),
                            theme: 'classic',
                            recurringTemplates: {},
                            reminders: {
                                enabled: false,
                                indefinite: false,
                                dueDatesReminders: false,
                                repeatCount: 0,
                                frequencyValue: 30,
                                frequencyUnit: "minutes"
                            }
                        };

                        state.appState.activeCycleId = finalTitle;
                        state.metadata.lastModified = Date.now();
                        state.metadata.totalCyclesCreated++;
                    }, true);

                    if (typeof this.deps.onCycleCreated === 'function') {
                        this.deps.onCycleCreated(finalTitle).catch(err => {
                            console.warn('⚠️ Undo system cycle creation notification failed:', err);
                        });
                    }

                    const onboardModeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
                    if (onboardModeSelector) {
                        onboardModeSelector.value = 'auto-cycle';
                    }
                    const body = this.deps.getBody();
                    body.className = body.className.replace(
                        /\b(auto-cycle-mode|manual-cycle-mode|todo-mode-mode|todo-mode)\b/g, ''
                    );
                    body.classList.add(DOM_CLASSES.AUTO_CYCLE_MODE);

                    this.deps.refreshThemeLabels?.();
                    this.deps.updateRecurringInfoLink?.();
                    await this.deps.completeInitialSetup(finalTitle, appState.get());
                    document.dispatchEvent(new Event('onboarding:setup-complete'));
                }
            });
        }, 500);
    }

    /**
     * Preload the getting started sample cycle
     * @param {Object} [options={}] - Options
     * @param {boolean} [options.silent=false] - When true, suppresses notifications and fallback cycle creation (caller handles messaging)
     * @returns {Promise<boolean>} True if sample loaded successfully, false on failure
     */
    async preloadGettingStartedCycle(_options = {}) {
        return this.loadSampleRoutine('getting-started.mcyc', { isOnboarding: true, ..._options });
    }

    /**
     * Create a basic fallback cycle if sample loading fails
     */
    async createBasicFallbackCycle() {

        // ✅ Use AppState as source of truth
        const appState = this.deps.AppState;

        if (!this._ensureAppStateReady('fallback cycle creation')) {
            this.deps.showNotification('⚠️ ' + getLabel('notify.failedToCreateCycle'), "error", UI_TIMEOUTS.NOTIFICATION_SLOW);
            return;
        }

        const cycleId = `cycle_${Date.now()}`;
        const fallbackTitle = "Getting Started";

        // ✅ Get unique name (uses centralized utility)
        const existingCycles = appState.get()?.data?.cycles || {};
        const { name: finalTitle } = getUniqueCycleName(fallbackTitle, existingCycles);

        // ✅ Create fallback cycle via AppState.update() - use title as key
        await appState.update(state => {
            state.data.cycles[finalTitle] = {
                id: cycleId,
                title: finalTitle,
                tasks: [
                    {
                        id: "task-welcome",
                        text: "Welcome to miniCycle! 🎉",
                        completed: false,
                        schemaVersion: 2
                    },
                    {
                        id: "task-guide",
                        text: "Add your first task using the input box above ✏️",
                        completed: false,
                        schemaVersion: 2
                    }
                ],
                autoReset: true,
                deleteCheckedTasks: false,
                cycleCount: 0,
                createdAt: Date.now(),
                theme: 'classic',
                recurringTemplates: {}
            };

            state.appState.activeCycleId = finalTitle;
            state.metadata.lastModified = Date.now();
            state.metadata.totalCyclesCreated++;
        }, true); // immediate save

        // ✅ Notify undo system of new cycle (fallback path)
        if (typeof this.deps.onCycleCreated === 'function') {
            this.deps.onCycleCreated(finalTitle).catch(err => {
                console.warn('⚠️ Undo system cycle creation notification failed:', err);
            });
        }

        await this.deps.completeInitialSetup(finalTitle, appState.get());
    }

    /**
     * Create a new miniCycle from the main menu
     */
    createNewMiniCycle() {

        // ✅ Use state-based data access
        if (!this.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for createNewMiniCycle');
            this.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        // ✅ Check storage quota before showing modal
        const storageCheck = canAddToStorage(ESTIMATED_NEW_CYCLE_SIZE);
        if (!storageCheck.allowed) {
            console.warn('Storage quota exceeded. Cannot create new routine.');
            this.deps.showNotification(
                getStorageShortageMessage(storageCheck.shortfall),
                'error',
                UI_TIMEOUTS.NOTIFICATION_SLOW
            );
            return;
        }

        this._buildCreationDialog({
            title: 'modal.newRoutineTitle',
            message: 'modal.newRoutineMessage',
            placeholder: 'modal.newRoutinePlaceholder',
            isOnboarding: false,
            onCreateBlank: (inputValue) => {
                const newCycleName = this.deps.sanitizeInput(inputValue);
                const cycleId = `cycle_${Date.now()}`;

                const existingCycles = this.deps.AppState.get()?.data?.cycles || {};
                const { name: finalTitle, wasModified } = getUniqueCycleName(newCycleName, existingCycles);

                if (wasModified) {
                    this.deps.showNotification('⚠️ ' + getLabel('notify.nameExists', { vars: { name: finalTitle } }), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
                }

                const storageKey = finalTitle;
                let finalResult = null;

                this.deps.AppState.update(state => {
                    state.data.cycles[storageKey] = {
                        title: finalTitle,
                        id: cycleId,
                        tasks: [],
                        autoReset: true,
                        deleteCheckedTasks: false,
                        cycleCount: 0,
                        createdAt: Date.now(),
                        theme: 'classic',
                        recurringTemplates: {},
                        taskOptionButtons: { ...this.deps.DEFAULT_TASK_OPTION_BUTTONS }
                    };

                    state.appState.activeCycleId = storageKey;
                    state.metadata.lastModified = Date.now();
                    state.metadata.totalCyclesCreated++;

                    finalResult = { storageKey, finalTitle };
                }, true);

                const taskList = this.deps.getElementById(DOM_IDS.TASK_LIST);
                const toggleAutoReset = this.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);
                const deleteCheckedTasks = this.deps.getElementById(DOM_IDS.DELETE_CHECKED_TASKS);

                if (taskList) taskList.innerHTML = "";

                const titleElement = this.deps.getElementById(DOM_IDS.MINI_CYCLE_TITLE);
                if (titleElement && finalResult) titleElement.textContent = finalResult.finalTitle;

                if (toggleAutoReset) toggleAutoReset.checked = true;
                if (deleteCheckedTasks) deleteCheckedTasks.checked = false;

                const modeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
                if (modeSelector) {
                    modeSelector.value = 'auto-cycle';
                }
                const body = this.deps.getBody();
                body.className = body.className.replace(
                    /\b(auto-cycle-mode|manual-cycle-mode|todo-mode-mode|todo-mode)\b/g, ''
                );
                body.classList.add(DOM_CLASSES.AUTO_CYCLE_MODE);

                const taskInputContainer = this.deps.querySelector(DOM_SELECTORS.TASK_INPUT);
                if (taskInputContainer) {
                    taskInputContainer.classList.add(DOM_CLASSES.HIDDEN);
                    const toggleText = this.deps.getElementById(DOM_IDS.TOGGLE_TASK_INPUT_TEXT);
                    if (toggleText) toggleText.textContent = getLabel('action.addTask');
                    taskInputContainer.querySelectorAll('input, button').forEach(el => { el.tabIndex = -1; });
                }

                this.deps.hideMainMenu();
                this.deps.updateProgressBar();
                this.deps.checkCompleteAllButton();
                this.deps.updateMainMenuHeader();
                this.deps.refreshThemeLabels?.();

                const recurringLink = this.deps.getElementById(DOM_IDS.RECURRING_INFO_LINK);
                if (recurringLink) recurringLink.classList.remove(DOM_CLASSES.SHOW);

                const emptyHint = this.deps.querySelector(DOM_SELECTORS.EMPTY_STATE_HINT);
                if (emptyHint) {
                    emptyHint.innerHTML = getLabel('empty.noTasksHint').replace('+', '<strong>+</strong>');
                }

                if (finalResult && typeof this.deps.onCycleCreated === 'function') {
                    this.deps.onCycleCreated(finalResult.storageKey).catch(err => {
                        console.warn('⚠️ Undo system cycle creation notification failed:', err);
                    });
                }

                if (finalResult) {
                    this.deps.showNotification(`✅ ${getLabel('notify.routineCreated', { vars: { name: finalResult.finalTitle } })}`, "success", UI_TIMEOUTS.NOTIFICATION_LONG);
                }
            }
        });
    }

    /**
     * Load a sample routine from the examples/sample-routines/ folder
     * @param {string} filename - The .mcyc filename to fetch
     * @param {Object} [options={}] - Options
     * @param {boolean} [options.isOnboarding=false] - True = onboarding path (completeInitialSetup), false = menu path (loadMiniCycle)
     * @param {HTMLDialogElement} [options.dialog=null] - Dialog to close on completion
     * @returns {Promise<boolean>} True if sample loaded successfully
     */
    async loadSampleRoutine(filename, options = {}) {
        const { isOnboarding = false, dialog = null } = options;

        try {
            const response = await fetch(`examples/sample-routines/${filename}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const sample = await response.json();
            const appState = this.deps.AppState;

            if (!this._ensureAppStateReady('sample routine loading')) {
                throw new Error('AppState not ready');
            }

            const cycleId = `cycle_${Date.now()}`;
            const sampleTitle = sample.title || sample.name || 'Sample Routine';
            const existingCycles = appState.get()?.data?.cycles || {};
            const { name: finalTitle } = getUniqueCycleName(sampleTitle, existingCycles);

            await appState.update(state => {
                state.data.cycles[finalTitle] = {
                    id: cycleId,
                    title: finalTitle,
                    tasks: sample.tasks || [],
                    autoReset: sample.autoReset !== false,
                    cycleCount: sample.cycleCount || 0,
                    deleteCheckedTasks: sample.deleteCheckedTasks || false,
                    createdAt: Date.now(),
                    theme: 'classic',
                    recurringTemplates: {},
                    reminders: {
                        enabled: false,
                        indefinite: false,
                        dueDatesReminders: false,
                        repeatCount: 0,
                        frequencyValue: 30,
                        frequencyUnit: "minutes"
                    }
                };

                state.appState.activeCycleId = finalTitle;
                state.metadata.lastModified = Date.now();
                state.metadata.totalCyclesCreated++;
            }, true);

            // Close dialog if provided
            if (dialog?.open) {
                dialog.close();
                dialog.remove();
            }

            // Notify undo system
            if (typeof this.deps.onCycleCreated === 'function') {
                this.deps.onCycleCreated(finalTitle).catch(err => {
                    console.warn('⚠️ Undo system cycle creation notification failed:', err);
                });
            }

            // Onboarding path: skip generic toast — onboardingManager shows its own
            // welcomeSampleLoaded notification with the blank-routine CTA.
            if (!isOnboarding) {
                this.deps.showNotification(
                    '✨ ' + getLabel('notify.sampleLoaded', { vars: { name: sampleTitle } }),
                    'success',
                    UI_TIMEOUTS.NOTIFICATION_SLOW
                );
            }

            if (isOnboarding) {
                await this.deps.completeInitialSetup(finalTitle, appState.get());
            } else {
                // Menu path — sync mode, refresh UI, load routine
                const modeSelector = this.deps.getElementById(DOM_IDS.MODE_SELECTOR);
                if (modeSelector) modeSelector.value = 'auto-cycle';
                const body = this.deps.getBody();
                body.className = body.className.replace(
                    /\b(auto-cycle-mode|manual-cycle-mode|todo-mode-mode|todo-mode)\b/g, ''
                );
                body.classList.add(DOM_CLASSES.AUTO_CYCLE_MODE);

                this.deps.hideMainMenu();
                this.deps.updateProgressBar();
                this.deps.checkCompleteAllButton();
                this.deps.updateMainMenuHeader();
                this.deps.refreshThemeLabels?.();
                this.deps.loadMiniCycle?.();
            }

            return true;

        } catch (err) {
            console.error('❌ Failed to load sample routine:', err);

            // Close dialog on error too
            if (dialog?.open) {
                dialog.close();
                dialog.remove();
            }

            if (!options.silent) {
                this.deps.showNotification(
                    '❌ ' + getLabel('notify.sampleLoadFailed'),
                    'error',
                    UI_TIMEOUTS.NOTIFICATION_LONG
                );
            }

            if (isOnboarding && !options.silent) {
                this.createBasicFallbackCycle();
            }

            return false;
        }
    }

    /**
     * Fetch the sample routine manifest (cached after first load)
     * @returns {Promise<Array<{file: string, name: string, emoji: string}>>}
     * @private
     */
    async _fetchSampleManifest() {
        if (_sampleManifestCache) {
            return _sampleManifestCache;
        }

        try {
            const response = await fetch('examples/sample-routines/manifest.json');
            if (!response.ok) {
                console.warn('⚠️ Failed to load sample manifest:', response.status);
                return [];
            }
            const manifest = await response.json();
            _sampleManifestCache = manifest;
            return manifest;
        } catch (err) {
            console.warn('⚠️ Failed to load sample manifest:', err.message);
            return [];
        }
    }

    /**
     * Build a custom creation dialog with name input + sample routine chips
     * @param {Object} config - Dialog configuration
     * @param {string} config.title - Dialog title label key
     * @param {string} config.message - Dialog message label key
     * @param {string} config.placeholder - Input placeholder label key
     * @param {boolean} [config.isOnboarding=false] - True for onboarding path
     * @param {Function} config.onCreateBlank - Callback when user creates a blank routine with name
     * @private
     */
    async _buildCreationDialog(config) {
        const { title, message, placeholder, isOnboarding = false, onCreateBlank } = config;

        // Fetch sample manifest (cached after first call)
        const samples = await this._fetchSampleManifest();

        const dialog = document.createElement('dialog');
        dialog.className = 'miniCycle-prompt-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');

        const box = document.createElement('div');
        box.className = 'miniCycle-prompt-box';

        // =====================================================================
        // VIEW 1: Name input view
        // =====================================================================
        const nameView = document.createElement('div');
        nameView.className = 'creation-view active';

        const titleEl = document.createElement('div');
        titleEl.className = 'miniCycle-prompt-title';
        titleEl.textContent = getLabel(title);
        nameView.appendChild(titleEl);

        const messageEl = document.createElement('div');
        messageEl.className = 'miniCycle-prompt-message';
        messageEl.textContent = getLabel(message);
        nameView.appendChild(messageEl);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = DOM_IDS.SAMPLE_CREATION_INPUT;
        input.className = 'miniCycle-prompt-input';
        input.placeholder = getLabel(placeholder);
        nameView.appendChild(input);

        // "Load Sample" button (hidden if no samples available)
        const loadSampleBtn = document.createElement('button');
        loadSampleBtn.type = 'button';
        loadSampleBtn.className = 'load-sample-btn';
        loadSampleBtn.textContent = getLabel('button.loadSample');
        if (samples.length > 0) {
            nameView.appendChild(loadSampleBtn);
        }

        // Buttons row
        const buttons = document.createElement('div');
        buttons.className = 'miniCycle-prompt-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'miniCycle-btn-cancel';
        cancelBtn.textContent = getLabel('button.cancel');

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'miniCycle-btn-confirm';
        confirmBtn.textContent = getLabel('button.create');

        buttons.appendChild(cancelBtn);
        buttons.appendChild(confirmBtn);
        nameView.appendChild(buttons);

        box.appendChild(nameView);

        // =====================================================================
        // VIEW 2: Sample list view (only if samples are available)
        // =====================================================================
        let sampleView = null;
        let backBtn = null;
        let sampleList = null;

        if (samples.length > 0) {
            sampleView = document.createElement('div');
            sampleView.className = 'creation-view';

            // Header row: back button + title
            const header = document.createElement('div');
            header.className = 'sample-list-header';

            backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'sample-back-btn';
            backBtn.textContent = getLabel('button.back');
            header.appendChild(backBtn);

            const sampleTitle = document.createElement('div');
            sampleTitle.className = 'sample-list-title';
            sampleTitle.textContent = getLabel('modal.chooseSample');
            header.appendChild(sampleTitle);

            sampleView.appendChild(header);

            // Sample items list
            sampleList = document.createElement('div');
            sampleList.id = DOM_IDS.SAMPLE_CREATION_GRID;
            sampleList.className = 'sample-list';

            for (const sample of samples) {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'sample-item';
                item.dataset.filename = sample.file;

                const emojiSpan = document.createElement('span');
                emojiSpan.className = 'sample-item-emoji';
                emojiSpan.textContent = sample.emoji;
                item.appendChild(emojiSpan);

                const nameSpan = document.createElement('span');
                nameSpan.className = 'sample-item-name';
                nameSpan.textContent = sample.name;
                item.appendChild(nameSpan);

                sampleList.appendChild(item);
            }
            sampleView.appendChild(sampleList);

            box.appendChild(sampleView);
        }

        dialog.appendChild(box);
        document.body.appendChild(dialog);

        // =====================================================================
        // View switching helpers (only needed when samples exist)
        // =====================================================================
        const showNameView = () => {
            if (sampleView) sampleView.classList.remove(DOM_CLASSES.ACTIVE);
            nameView.classList.add(DOM_CLASSES.ACTIVE);
            input.focus();
        };

        const showSampleView = () => {
            nameView.classList.remove(DOM_CLASSES.ACTIVE);
            if (sampleView) sampleView.classList.add(DOM_CLASSES.ACTIVE);
        };

        // =====================================================================
        // Event handlers
        // =====================================================================
        const handleConfirm = () => {
            const value = input.value.trim();
            if (!value) {
                input.classList.add(DOM_CLASSES.MINICYCLE_INPUT_ERROR);
                input.focus();
                return;
            }
            cleanup();
            dialog.close();
            dialog.remove();
            onCreateBlank(value);
        };

        const handleCancel = () => {
            cleanup();
            dialog.close();
            dialog.remove();

            if (isOnboarding) {
                this.preloadGettingStartedCycle();
            }
        };

        const handleSampleClick = (e) => {
            const item = e.target.closest('.sample-item');
            if (!item) return;
            const filename = item.dataset.filename;
            cleanup();
            this.loadSampleRoutine(filename, { isOnboarding, dialog });
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        };

        const handleDialogCancel = (e) => {
            e.preventDefault();
            handleCancel();
        };

        // Close on backdrop click (click on dialog element itself = backdrop)
        const handleBackdropClick = (e) => {
            if (e.target === dialog) {
                handleCancel();
            }
        };

        // Wire listeners
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        input.addEventListener('keydown', handleKeydown);
        dialog.addEventListener('cancel', handleDialogCancel);
        dialog.addEventListener('click', handleBackdropClick);

        // Sample-specific listeners (only when samples exist)
        if (samples.length > 0) {
            loadSampleBtn.addEventListener('click', showSampleView);
            backBtn.addEventListener('click', showNameView);
            sampleList.addEventListener('click', handleSampleClick);
        }

        // Cleanup — removes ALL listeners
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            input.removeEventListener('keydown', handleKeydown);
            dialog.removeEventListener('cancel', handleDialogCancel);
            dialog.removeEventListener('click', handleBackdropClick);

            if (samples.length > 0) {
                loadSampleBtn.removeEventListener('click', showSampleView);
                backBtn.removeEventListener('click', showNameView);
                sampleList.removeEventListener('click', handleSampleClick);
            }
        };

        // Show dialog and focus input
        dialog.showModal();
        input.focus();
    }
}

// Create global instance
let routineManager = null;

// Phase 3 - No window.* exports (main script handles exposure)

/**
 * Initialize the RoutineManager module
 * Dynamically imports utilities with version cache-busting before creating instance
 * @param {Object} dependencies - Dependency injection object
 * @returns {Promise<RoutineManager>} The initialized RoutineManager instance
 */
export async function initRoutineManager(dependencies) {
    // Dynamically import utilities with version for cache-busting
    const version = APP_VERSION;

    // Import storage utilities
    const storageUtils = await import(`../utils/storageUtils.js?v=${version}`);
    canAddToStorage = storageUtils.canAddToStorage;
    getStorageShortageMessage = storageUtils.getStorageShortageMessage;

    // Import name utilities
    const nameUtils = await import(`../utils/nameUtils.js?v=${version}`);
    getUniqueCycleName = nameUtils.getUniqueCycleName;

    // Now create the instance
    routineManager = new RoutineManager(dependencies);
    return routineManager;
}

/**
 * Get the singleton RoutineManager instance
 * @returns {RoutineManager|null} The initialized instance or null
 */
export function getRoutineManager() {
    return routineManager;
}
