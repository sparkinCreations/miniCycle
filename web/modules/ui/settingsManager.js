/**
 * ⚙️ miniCycle Settings Manager (DI-Pure)
 * Handles settings panel, import/export, and configuration
 *
 * @module settingsManager
 * @pattern Resilient Constructor 🛡️
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// APPCONTEXT DYNAMIC IMPORT (versioned for cache-busting, like appInit pattern)
// ============================================================================
let _appContextModule = null;
let ui = () => null; // Fallback until loaded

async function loadAppContext() {
    if (!_appContextModule) {
        const version = typeof window !== 'undefined' ? (window.APP_VERSION || '1.505') : '1.505';
        _appContextModule = await import(`../core/appContext.js?v=${version}`);
        ui = _appContextModule.ui;
        console.log('✅ SettingsManager: appContext loaded with version', version);
    }
    return _appContextModule;
}

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('SettingsManager', {
    appInit: optional(null),
    loadMiniCycleData: optional(null),
    AppState: optional(null),
    showNotification: optional(null),
    showConfirmationModal: optional(null),
    hideMainMenu: optional(null),
    setupDarkModeToggle: optional(null),
    setupQuickDarkToggle: optional(null),
    updateMoveArrowsVisibility: optional(null),
    toggleHoverTaskOptions: optional(null),
    refreshTaskListUI: optional(null),
    performSchema25Migration: optional(null),
    resetDefaultRecurringSettings: optional(null),
    organizeCompletedTasks: optional(null),
    DataValidator: optional(null),
    calculateNextOccurrence: optional(null),
    sanitizeInput: optional(null),
    AppMeta: optional(null),
    safeAddEventListener: optional(null)
});

// Late-binding deps via Proxy
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for SettingsManager (call before creating instance)
 * @param {Object} dependencies - { loadMiniCycleData, showNotification, AppState, DataValidator, etc. }
 */
export function setSettingsManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('⚙️ SettingsManager dependencies set:', Object.keys(dependencies));
}

export class SettingsManager {
    constructor(dependencies = {}) {
        // Store constructor-only deps (DOM helpers that don't change)
        this._constructorDeps = {
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelector: dependencies.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel)),
            safeAddEventListener: dependencies.safeAddEventListener || this.fallbackAddListener.bind(this),
            // Fallback functions bound to this instance
            fallbackLoadData: this.fallbackLoadData.bind(this),
            fallbackNotification: this.fallbackNotification.bind(this),
            fallbackConfirmationModal: this.fallbackConfirmationModal.bind(this)
        };

        // Instance version - uses injected AppMeta (no hardcoded fallback)
        this.version = dependencies.AppMeta?.version || _deps.AppMeta?.version;
        this.initialized = false;
    }

    /**
     * Getter for dependencies - always reads from current module-level _deps
     * This allows late injection via setSettingsManagerDependencies() to work
     */
    get deps() {
        return {
            loadMiniCycleData: _deps.loadMiniCycleData || this._constructorDeps.fallbackLoadData,
            AppState: _deps.AppState || (() => null),
            showNotification: _deps.showNotification || this._constructorDeps.fallbackNotification,
            showConfirmationModal: _deps.showConfirmationModal || this._constructorDeps.fallbackConfirmationModal,
            hideMainMenu: _deps.hideMainMenu || (() => {}),
            setupDarkModeToggle: _deps.setupDarkModeToggle || (() => console.warn('Dark mode toggle not available')),
            setupQuickDarkToggle: _deps.setupQuickDarkToggle || (() => console.warn('Quick dark toggle not available')),
            updateMoveArrowsVisibility: _deps.updateMoveArrowsVisibility || (() => {}),
            toggleHoverTaskOptions: _deps.toggleHoverTaskOptions || (() => {}),
            refreshTaskListUI: _deps.refreshTaskListUI,
            performSchema25Migration: _deps.performSchema25Migration || (() => ({ success: false })),
            resetDefaultRecurringSettings: _deps.resetDefaultRecurringSettings || (() => {}),
            organizeCompletedTasks: _deps.organizeCompletedTasks,
            DataValidator: _deps.DataValidator,
            calculateNextOccurrence: _deps.calculateNextOccurrence,
            sanitizeInput: _deps.sanitizeInput,
            // DOM helpers from constructor
            ...this._constructorDeps
        };
    }

    /**
     * Initialize settings manager
     */
    async init() {
        if (this.initialized) return;

        // Wait for core systems
        await _deps.appInit?.waitForCore();

        try {
            this.setupSettingsMenu();
            this.setupDownloadMiniCycle();
            this.setupUploadMiniCycle();
            this.initialized = true;
            console.log('⚙️ Settings Manager initialized');
        } catch (error) {
            console.warn('Settings Manager initialization failed:', error);
            this.deps.showNotification('Settings may have limited functionality', 'warning');
        }
    }

    /**
     * Neutralize AppState to prevent auto-saving during critical operations
     * Used during factory reset and restore operations to prevent data corruption
     *
     * @private
     */
    neutralizeAppState() {
        const AppState = this.deps.AppState();
        if (!AppState) {
            console.log('ℹ️ No AppState to neutralize');
            return;
        }

        console.log('🛑 Neutralizing AppState to prevent auto-save...');
        try {
            // Clear the debounced save timeout
            if (AppState.saveTimeout) {
                clearTimeout(AppState.saveTimeout);
                AppState.saveTimeout = null;
            }
            // Clear in-memory data so it won't be saved
            AppState.data = null;
            AppState.isDirty = false;
            AppState.isInitialized = false;
            console.log('✅ AppState neutralized');
        } catch (e) {
            console.warn('⚠️ AppState neutralization warning:', e);
        }
    }

    /**
     * Setup settings menu UI and event listeners
     */
    setupSettingsMenu() {
        const settingsModal = this.deps.querySelector(".settings-modal");
        const settingsModalContent = this.deps.querySelector(".settings-modal-content");
        const openSettingsBtn = this.deps.getElementById("open-settings");
        const closeSettingsBtn = this.deps.getElementById("close-settings");

        /**
         * Opens the settings menu.
         *
         * @param {Event} event - The click event.
         */
        const openSettings = (event) => {
            event.stopPropagation();
            if (settingsModal) {
                settingsModal.style.display = "flex";
            }
            this.deps.hideMainMenu();
        };

        /**
         * Closes the settings menu.
         */
        const closeSettings = () => {
            if (settingsModal) {
                settingsModal.style.display = "none";
            }
        };

        const closeOnClickOutside = (event) => {
            if (settingsModal && settingsModal.style.display === "flex" &&
                settingsModalContent && !settingsModalContent.contains(event.target) &&
                event.target !== openSettingsBtn) {
                settingsModal.style.display = "none";
            }
        };

        // Use safeAddEventListener (removes then adds to prevent duplicates)
        const safeAdd = _deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });
        if (openSettingsBtn) {
            safeAdd(openSettingsBtn, "click", openSettings);
        }

        if (closeSettingsBtn) {
            safeAdd(closeSettingsBtn, "click", closeSettings);
        }

        safeAdd(document, "click", closeOnClickOutside);

        // ✅ Dark Mode Toggle
        this.deps.setupDarkModeToggle("darkModeToggle", ["darkModeToggle", "darkModeToggleThemes"]);

        // ✅ Setup Quick Dark Toggle
        this.deps.setupQuickDarkToggle();

        // ✅ Toggle Move Arrows Setting (Schema 2.5 only)
        const moveArrowsToggle = this.deps.getElementById("toggle-move-arrows");
        if (moveArrowsToggle) {
            console.log('🔄 Setting up move arrows toggle (Schema 2.5 only)...');

            const schemaData = this.deps.loadMiniCycleData();
            if (!schemaData) {
                console.warn('⚠️ No Schema 2.5 data yet - move arrows toggle will initialize after cycle creation');
                // Continue with default settings - don't return early
            }

            // ✅ Use state-based approach for move arrows setting
            let moveArrowsEnabled = false;

            const AppState = this.deps.AppState();
            if (AppState?.isReady?.()) {
                const currentState = AppState.get();
                moveArrowsEnabled = currentState?.ui?.moveArrowsVisible || false;
            } else {
                // Fallback for legacy or when state isn't ready
                const schemaData = this.deps.loadMiniCycleData();
                moveArrowsEnabled = schemaData?.settings?.showMoveArrows || false;
            }

            console.log('📊 Loading move arrows setting from state:', moveArrowsEnabled);

            moveArrowsToggle.checked = moveArrowsEnabled;

            moveArrowsToggle._changeHandler = async () => {
                const enabled = moveArrowsToggle.checked;

                console.log('Move arrows toggle changed:', enabled);

                // Use AppState only (no localStorage fallback)
                const AppState = this.deps.AppState();
                if (AppState?.isReady?.()) {
                    await AppState.update(state => {
                        if (!state.ui) state.ui = {};
                        state.ui.moveArrowsVisible = enabled;
                    }, true); // immediate save

                    console.log('Move arrows setting saved to state:', enabled);
                } else {
                    console.error('AppState not ready - setting not saved');
                    ui()?.showNotification?.('Failed to save setting', 'error');
                    moveArrowsToggle.checked = !enabled; // Revert UI
                    return;
                }

                this.deps.updateMoveArrowsVisibility();

                // Sync with customizer modal if it's open
                const customizerModal = document.getElementById('task-options-customizer-modal');
                if (customizerModal) {
                    const moveArrowsCheckbox = customizerModal.querySelector('[data-option="moveArrows"]');
                    if (moveArrowsCheckbox) {
                        moveArrowsCheckbox.checked = enabled;
                        console.log('Synced customizer modal checkbox:', enabled);
                    }
                }
            };
            safeAdd(moveArrowsToggle, "change", moveArrowsToggle._changeHandler);

            console.log('✅ Move arrows toggle setup completed');
        }

        // ✅ Toggle Three-Dot Menu Setting (Schema 2.5 only)
        const threeDotsToggle = this.deps.getElementById("toggle-three-dots");
        if (threeDotsToggle) {
            console.log('🔄 Setting up three dots toggle (Schema 2.5 only)...');

            const schemaData = this.deps.loadMiniCycleData();
            if (!schemaData) {
                console.error('❌ Schema 2.5 data required for three dots toggle');
                return;
            }

            const threeDotsEnabled = schemaData.settings.showThreeDots || false;

            console.log('📊 Loading three dots setting from Schema 2.5:', threeDotsEnabled);

            threeDotsToggle.checked = threeDotsEnabled;
            document.body.classList.toggle("show-three-dots-enabled", threeDotsEnabled);

            threeDotsToggle._changeHandler = async () => {
                const enabled = threeDotsToggle.checked;

                console.log('Three dots toggle changed:', enabled);

                // Use AppState only (no localStorage fallback)
                const AppState = this.deps.AppState();
                if (AppState?.isReady?.()) {
                    await AppState.update(state => {
                        if (!state.settings) state.settings = {};
                        state.settings.showThreeDots = enabled;
                    }, true); // immediate save
                    console.log('Three dots setting saved to AppState:', enabled);
                } else {
                    console.error('AppState not ready - setting not saved');
                    ui()?.showNotification?.('Failed to save setting', 'error');
                    threeDotsToggle.checked = !enabled; // Revert UI
                    return;
                }

                document.body.classList.toggle("show-three-dots-enabled", enabled);

                // Disable/enable hover behavior for current tasks
                this.deps.toggleHoverTaskOptions(!enabled);

                // Update task list UI to add/remove three-dots buttons (DI-pure)
                const refreshTaskListUI = this.deps.refreshTaskListUI;
                if (typeof refreshTaskListUI === 'function') {
                    refreshTaskListUI();
                }
            };
            safeAdd(threeDotsToggle, "change", threeDotsToggle._changeHandler);

            console.log('✅ Three dots toggle setup completed');
        }

        // ✅ Toggle Completed Dropdown Setting (Schema 2.5 only)
        const completedDropdownToggle = this.deps.getElementById("toggle-completed-dropdown");
        if (completedDropdownToggle) {
            console.log('🔄 Setting up completed dropdown toggle (Schema 2.5 only)...');

            // ✅ Use state-based approach - disabled by default
            let completedDropdownEnabled = false;

            const AppState = this.deps.AppState();
            if (AppState?.isReady?.()) {
                const currentState = AppState.get();
                completedDropdownEnabled = currentState?.settings?.showCompletedDropdown || false;
            }

            console.log('📊 Loading completed dropdown setting from state:', completedDropdownEnabled);

            completedDropdownToggle.checked = completedDropdownEnabled;

            completedDropdownToggle._changeHandler = async () => {
                const enabled = completedDropdownToggle.checked;

                console.log('Completed dropdown toggle changed:', enabled);

                // Use AppState only (no localStorage fallback)
                const AppState = this.deps.AppState();
                if (AppState?.isReady?.()) {
                    await AppState.update(state => {
                        if (!state.settings) state.settings = {};
                        state.settings.showCompletedDropdown = enabled;
                    }, true); // immediate save

                    console.log('Completed dropdown setting saved to state:', enabled);
                } else {
                    console.error('AppState not ready - setting not saved');
                    ui()?.showNotification?.('Failed to save setting', 'error');
                    completedDropdownToggle.checked = !enabled; // Revert UI
                    return;
                }

                // If enabling, organize existing completed tasks (DI-pure)
                const organizeCompletedTasks = this.deps.organizeCompletedTasks;
                if (enabled && typeof organizeCompletedTasks === 'function') {
                    organizeCompletedTasks();
                }

                // If disabling, move completed tasks back to main list
                if (!enabled) {
                    const completedList = document.getElementById('completedTaskList');
                    const taskList = document.getElementById('taskList');
                    if (completedList && taskList) {
                        const completedTasks = Array.from(completedList.querySelectorAll('.task'));
                        completedTasks.forEach(task => {
                            taskList.appendChild(task);
                        });
                        // Hide the section
                        const completedSection = document.getElementById('completed-tasks-section');
                        if (completedSection) {
                            completedSection.style.display = 'none';
                        }
                    }
                }
            };
            safeAdd(completedDropdownToggle, "change", completedDropdownToggle._changeHandler);

            console.log('✅ Completed dropdown toggle setup completed');
        }

        // Update backup function to be Schema 2.5 only
        const backupBtn = this.deps.getElementById("backup-mini-cycles");
        if (backupBtn) {
            backupBtn._clickHandler = () => {
                console.log('Creating backup (Schema 2.5 only)...');

                const schemaData = localStorage.getItem("miniCycleData");
                if (!schemaData) {
                    console.error('❌ Schema 2.5 data required for backup');
                    this.deps.showNotification("❌ No Schema 2.5 data found. Cannot create backup.", "error");
                    return;
                }

                // Schema 2.5 backup - everything is in one key
                const backupData = {
                    schemaVersion: "2.5",
                    miniCycleData: schemaData,
                    backupMetadata: {
                        createdAt: Date.now(),
                        version: "2.5",
                        source: "miniCycle App"
                    }
                };

                const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
                const backupUrl = URL.createObjectURL(backupBlob);
                const a = document.createElement("a");
                a.href = backupUrl;
                a.download = `mini-cycle-backup-schema25-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(backupUrl);

                this.deps.showNotification("Schema 2.5 backup created successfully!", "success", 3000);
            };
            safeAdd(backupBtn, "click", backupBtn._clickHandler);
        }

        // ✅ Update restore function to convert legacy backups to Schema 2.5 (idempotent + cancel-safe)
        (() => {
          const restoreBtn = this.deps.getElementById("restore-mini-cycles");
          if (!restoreBtn) return;

          let fileInput = null;
          let isPickerOpen = false;

          const resetPicker = () => { isPickerOpen = false; };

          const handleRestore = () => {
            console.log('🔄 [Restore] Restore button clicked');
            if (isPickerOpen) {
              console.log('⚠️ [Restore] Picker already open, ignoring click');
              return;
            }
            isPickerOpen = true;

            // Clean previous input
            if (fileInput) {
              console.log('🧹 [Restore] Cleaning up previous file input');
              fileInput.remove();
              fileInput = null;
            }

            // Fresh input
            console.log('📂 [Restore] Creating file input element...');
            fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.id = "import-cycle-file-input";
            fileInput.name = "cycleImport";
            fileInput.accept = "application/json,.json,.mcyc";
            fileInput.style.display = "none";
            document.body.appendChild(fileInput);
            console.log('✅ [Restore] File input created and appended to body');

            // When picker closes (even on cancel), window regains focus
            const onFocusAfterPicker = () => {
              console.log('👁️ [Restore] Window regained focus after picker');
              resetPicker();
              window.removeEventListener("focus", onFocusAfterPicker);
              // Cleanup dangling input on cancel
              if (fileInput && !fileInput.files?.length) {
                console.log('🚫 [Restore] No file selected, cleaning up');
                fileInput.remove();
                fileInput = null;
              }
            };
            const safeAddLocal = _deps.safeAddEventListener || ((el, ev, fn, opts) => el?.addEventListener(ev, fn, opts));
            safeAddLocal(window, "focus", onFocusAfterPicker, { once: true });

            fileInput._changeHandler = (event) => {
              console.log('📄 [Restore] File input change event fired');
              const file = event.target.files[0];
              if (!file) {
                console.log('⚠️ [Restore] No file in change event');
                if (fileInput) {
                  fileInput.remove();
                  fileInput = null;
                }
                resetPicker();
                return;
              }
              console.log('📄 [Restore] File selected:', file.name, 'Size:', file.size, 'Type:', file.type);

              const reader = new FileReader();
              reader.onload = async (e) => {
                try {
                  console.log('🔄 [Restore] Starting backup restore process...');

                  // ✅ XSS PROTECTION: Validate file size (max 10MB)
                  const maxSize = 10 * 1024 * 1024; // 10MB
                  if (e.target.result.length > maxSize) {
                    console.error('❌ [Restore] File too large:', e.target.result.length, 'bytes');
                    this.deps.showNotification("❌ File too large (max 10MB)", "error");
                    return;
                  }
                  console.log('✅ [Restore] File size OK:', e.target.result.length, 'bytes');

                  const backupData = JSON.parse(e.target.result);
                  console.log('✅ [Restore] JSON parsed successfully');
                  console.log('📋 [Restore] Backup schema version:', backupData.schemaVersion || 'not specified');

                  // ✅ XSS PROTECTION: Validate backup data is an object
                  if (typeof backupData !== 'object' || backupData === null) {
                    console.error('❌ [Restore] Invalid backup data type:', typeof backupData);
                    this.deps.showNotification("❌ Invalid backup file format", "error");
                    return;
                  }

                  // ✅ XSS PROTECTION: Sanitize all user-generated content in imported data
                  // Security fix (v1.353): Prevent XSS attacks via malicious .mcyc files
                  console.log('🛡️ [Restore] Sanitizing imported data...');
                  this.sanitizeImportedData(backupData);
                  console.log('✅ [Restore] Data sanitization complete');

                  // ✅ Check if user is currently on Schema 2.5 (should always be true now)
                  const currentSchemaData = localStorage.getItem("miniCycleData");
                  if (!currentSchemaData) {
                    console.error('❌ [Restore] No Schema 2.5 data found in localStorage');
                    this.deps.showNotification("❌ Cannot restore - Schema 2.5 data structure required.", "error");
                    return;
                  }
                  console.log('✅ [Restore] Current Schema 2.5 data exists');

                  // ✅ SAFETY: Create pre-restore backup before making changes
                  console.log('💾 [Restore] Creating safety backup before restore...');
                  try {
                    const BackupManager = this.deps.BackupManager?.();
                    if (BackupManager) {
                      await BackupManager.createManualBackup(`Pre-Restore Safety Backup ${new Date().toLocaleString()}`);
                      console.log('✅ [Restore] Safety backup created successfully');
                    } else {
                      console.warn('⚠️ [Restore] BackupManager not available, skipping safety backup');
                    }
                  } catch (backupErr) {
                    console.warn('⚠️ [Restore] Could not create safety backup:', backupErr);
                    // Continue anyway - user confirmed the restore
                  }

                  // ✅ RACE CONDITION FIX: Stop AppState from auto-saving over our restore
                  console.log('🛑 [Restore] Neutralizing AppState to prevent auto-save...');
                  this.neutralizeAppState();

                  // ✅ Handle Schema 2.5 backup
                  if (backupData.schemaVersion === "2.5" && backupData.miniCycleData) {
                    console.log('📦 [Restore] Detected Schema 2.5 backup format');
                    console.log('💾 [Restore] Writing Schema 2.5 data to localStorage...');
                    localStorage.setItem("miniCycleData", backupData.miniCycleData);
                    console.log('✅ [Restore] Schema 2.5 data restored successfully');
                    this.deps.showNotification("✅ Schema 2.5 backup restored successfully!", "success", 4000);

                    console.log('🔄 [Restore] Scheduling reload in 2.5 seconds...');
                    this.deps.showNotification("🔄 Reloading app to apply changes...", "info", 2000);
                    setTimeout(() => location.reload(), 2500);
                    return;
                  }

                  // ✅ Handle legacy backup - convert to Schema 2.5
                  if (backupData.schemaVersion === "legacy" || backupData.miniCycleStorage) {
                    console.log('📦 [Restore] Detected legacy backup format');
                    this.deps.showNotification("🔄 Auto-converting legacy backup to Schema 2.5...", "info", 3000);

                    if (!backupData.miniCycleStorage) {
                      console.error('❌ [Restore] Legacy backup missing miniCycleStorage key');
                      this.deps.showNotification("❌ Invalid legacy backup file format.", "error", 3000);
                      return;
                    }

                    // Note: neutralizeAppState() already called above for all restore types

                    // ✅ CRITICAL: Remove existing Schema 2.5 data so migration will run
                    console.log('🗑️ [Restore] Removing existing Schema 2.5 data to force migration...');
                    localStorage.removeItem("miniCycleData");

                    // Temporarily restore legacy keys
                    console.log('💾 [Restore] Writing legacy keys to localStorage...');
                    localStorage.setItem("miniCycleStorage", backupData.miniCycleStorage);
                    console.log('  ✅ miniCycleStorage restored');
                    localStorage.setItem("lastUsedMiniCycle", backupData.lastUsedMiniCycle || "");
                    console.log('  ✅ lastUsedMiniCycle restored:', backupData.lastUsedMiniCycle || '(empty)');

                    if (backupData.miniCycleReminders) {
                      localStorage.setItem("miniCycleReminders", backupData.miniCycleReminders);
                      console.log('  ✅ miniCycleReminders restored');
                    }
                    if (backupData.milestoneUnlocks) {
                      localStorage.setItem("milestoneUnlocks", backupData.milestoneUnlocks);
                      console.log('  ✅ milestoneUnlocks restored');
                    }
                    if (backupData.darkModeEnabled !== undefined) {
                      localStorage.setItem("darkModeEnabled", backupData.darkModeEnabled);
                      console.log('  ✅ darkModeEnabled restored:', backupData.darkModeEnabled);
                    }
                    if (backupData.currentTheme) {
                      localStorage.setItem("currentTheme", backupData.currentTheme);
                      console.log('  ✅ currentTheme restored:', backupData.currentTheme);
                    }

                    // Migrate to 2.5
                    console.log('🔄 [Restore] Scheduling Schema 2.5 migration...');
                    setTimeout(() => {
                      console.log('🔄 [Restore] Running Schema 2.5 migration...');
                      const migrationResults = this.deps.performSchema25Migration();

                      if (migrationResults.success) {
                        console.log('✅ [Restore] Legacy backup migrated to Schema 2.5 successfully');
                        this.deps.showNotification("✅ Legacy backup restored and converted to Schema 2.5!", "success", 4000);
                      } else {
                        console.error('❌ [Restore] Migration failed:', migrationResults);
                        this.deps.showNotification("❌ Migration failed during restore", "error", 4000);
                      }

                      console.log('🔄 [Restore] Scheduling reload in 1 second...');
                      setTimeout(() => location.reload(), 1000);
                    }, 500);

                    return; // prevent double reload path
                  }

                  console.error('❌ [Restore] Unrecognized backup format - missing schemaVersion or miniCycleStorage');
                  this.deps.showNotification("❌ Invalid backup file format.", "error", 3000);
                } catch (error) {
                  console.error("❌ [Restore] Backup restore error:", error);
                  this.deps.showNotification("❌ Error restoring backup - file may be corrupted.", "error", 4000);
                } finally {
                  if (fileInput) {
                    fileInput.remove();
                    fileInput = null;
                  }
                  resetPicker();
                  window.removeEventListener("focus", onFocusAfterPicker);
                }
              };

              reader.readAsText(file);
            };
            safeAddLocal(fileInput, "change", fileInput._changeHandler, { once: true });

            fileInput.click();
          };

          // Idempotent listener attachment using safeAddEventListener
          restoreBtn._restoreHandler = handleRestore;
          safeAdd(restoreBtn, "click", restoreBtn._restoreHandler);
        }).bind(this)();


        const resetRecurringBtn = this.deps.getElementById("reset-recurring-default");
        if (resetRecurringBtn) {
            resetRecurringBtn._clickHandler = () => this.resetDefaultRecurringSettings();
            safeAdd(resetRecurringBtn, "click", resetRecurringBtn._clickHandler);
        }

        // ✅ Update Factory Reset for Schema 2.5 only (awaits all cleanup; no IndexedDB used)
        (() => {
            const resetBtn = this.deps.getElementById("factory-reset");
            if (!resetBtn) return;

            const runFactoryReset = async () => {
                console.log('🧹 Performing bulletproof Schema 2.5 factory reset...');

                // 0) CRITICAL: Stop AppState from auto-saving over our deletion
                this.neutralizeAppState();

                // 1) Local storage cleanup (primary + legacy + dynamic)
                try {
                    // Schema 2.5 - Single key cleanup
                    localStorage.removeItem("miniCycleData");

                    // Also clean up any remaining legacy keys for thorough cleanup
                    const legacyKeysToRemove = [
                        "miniCycleStorage",
                        "lastUsedMiniCycle",
                        "miniCycleReminders",
                        "miniCycleDefaultRecurring",
                        "milestoneUnlocks",
                        "darkModeEnabled",
                        "currentTheme",
                        "miniCycleNotificationPosition",
                        "miniCycleThreeDots",
                        "miniCycleMoveArrows",
                        "miniCycleOnboarding",
                        "overdueTaskStates",
                        "bestRound",
                        "bestTime",
                        "miniCycleAlwaysShowRecurring",
                        "miniCycle_console_logs",
                        "miniCycle_console_capture_start",
                        "miniCycle_console_capture_enabled"
                    ];
                    legacyKeysToRemove.forEach(key => localStorage.removeItem(key));

                    // Clean up any backup files and dynamic keys
                    const allKeys = Object.keys(localStorage);
                    let dynamicKeysRemoved = 0;
                    allKeys.forEach(key => {
                        // Backup files
                        if (key.startsWith('miniCycle_backup_') || key.startsWith('pre_migration_backup_')) {
                            localStorage.removeItem(key);
                            dynamicKeysRemoved++;
                            return;
                        }
                        // Any key containing miniCycle, minicycle, or TaskCycle (case-insensitive)
                        const keyLower = key.toLowerCase();
                        if (keyLower.includes('minicycle') || keyLower.includes('taskcycle')) {
                            console.log('🧹 Removing additional key:', key);
                            localStorage.removeItem(key);
                            dynamicKeysRemoved++;
                        }
                    });
                    console.log(`🧹 Removed ${dynamicKeysRemoved} additional dynamic keys`);
                } catch (e) {
                    console.warn('⚠️ Local storage cleanup encountered an issue:', e);
                }

                // 2) Session storage cleanup
                try {
                    if (typeof sessionStorage !== 'undefined') {
                        sessionStorage.clear();
                        console.log('🧹 sessionStorage cleared');
                    }
                } catch (e) {
                    console.warn('⚠️ sessionStorage cleanup failed:', e);
                }

                // 3) Service Worker: unsubscribe push (if any) and unregister
                try {
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        await Promise.allSettled(registrations.map(async (registration) => {
                            try {
                                // Try to unsubscribe from Push
                                if (registration.pushManager && typeof registration.pushManager.getSubscription === 'function') {
                                    const sub = await registration.pushManager.getSubscription();
                                    if (sub) {
                                        console.log('🧹 Unsubscribing push subscription');
                                        await sub.unsubscribe();
                                    }
                                }
                            } catch (e) {
                                console.warn('⚠️ Push unsubscribe failed:', e);
                            }
                            try {
                                console.log('🧹 Unregistering service worker:', registration.scope);
                                await registration.unregister();
                            } catch (e) {
                                console.warn('⚠️ Service worker unregister failed:', e);
                            }
                        }));
                    }
                } catch (e) {
                    console.warn('⚠️ Service worker cleanup failed:', e);
                }

                // 4) Cache Storage cleanup (filtered)
                try {
                    if (typeof window.caches !== 'undefined') {
                        const cacheNames = await caches.keys();
                        await Promise.allSettled(
                            cacheNames.map((cacheName) => {
                                if (cacheName.includes('miniCycle') || cacheName.includes('taskCycle')) {
                                    console.log('🧹 Clearing cache:', cacheName);
                                    return caches.delete(cacheName);
                                }
                                return Promise.resolve(false);
                            })
                        );
                    }
                } catch (e) {
                    console.warn('⚠️ Cache cleanup failed:', e);
                }

                // 5) Finalize
                this.deps.showNotification("✅ Factory Reset Complete. Reloading...", "success", 2000);
                setTimeout(() => location.reload(), 800);
            };

            // Attach click with confirmation, guard against double-activation
            resetBtn._clickHandler = () => {
                this.deps.showConfirmationModal({
                    title: "Factory Reset",
                    message: "This will DELETE ALL miniCycle data, settings, and progress. Are you sure?",
                    confirmText: "Delete Everything",
                    cancelText: "Cancel",
                    callback: async (confirmed) => {
                        if (!confirmed) {
                            this.deps.showNotification("Factory reset cancelled.", "info", 2000);
                            return;
                        }

                        // prevent double triggers during reset
                        const prevDisabled = resetBtn.disabled;
                        resetBtn.disabled = true;
                        try {
                            await runFactoryReset();
                        } finally {
                            // If reload fails for some reason, re-enable button
                            resetBtn.disabled = prevDisabled;
                        }
                    }
                });
            };
            safeAdd(resetBtn, "click", resetBtn._clickHandler);
        }).bind(this)();
    }

    /**
     * Reset default recurring settings
     * Update reset recurring default for Schema 2.5 only
     */
    async resetDefaultRecurringSettings() {
        console.log('🔁 Resetting recurring defaults (Schema 2.5 only)...');

        const defaultSettings = {
            frequency: "daily",
            indefinitely: true,
            time: null
        };

        // ✅ Use AppState only (no localStorage fallback)
        const AppState = this.deps.AppState();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.defaultRecurringSettings = defaultSettings;
            }, true);

            this.deps.showNotification("🔁 Recurring default reset to Daily Indefinitely.", "success");
        } else {
            console.error('❌ AppState not ready - settings not saved');
            this.deps.showNotification("❌ Failed to reset defaults.", "error");
        }
    }

    /**
     * Setup download/export functionality
     * Setupdownloadminicycle function - Schema 2.5 ONLY
     *
     * @returns {void}
     */
    setupDownloadMiniCycle() {
      const exportBtn = this.deps.getElementById("export-mini-cycle");
      if (!exportBtn) return;

      const safeAdd = _deps.safeAddEventListener || ((el, ev, fn) => el?.addEventListener(ev, fn));
      exportBtn._clickHandler = () => {
        console.log('Exporting miniCycle (Schema 2.5 only)...');

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
          console.error('❌ Schema 2.5 data required for export');
          this.deps.showNotification("❌ No Schema 2.5 data found. Cannot export.", "error");
          return;
        }

        const { cycles, activeCycle } = schemaData;
        const cycle = cycles[activeCycle];

        if (!activeCycle || !cycle) {
          this.deps.showNotification("⚠ No active miniCycle to export.");
          return;
        }

        console.log('📊 Exporting cycle:', activeCycle);

        const miniCycleData = {
          name: activeCycle,
          title: cycle.title || "New miniCycle",
          tasks: cycle.tasks.map(task => {
            const settings = task.recurringSettings || {};

            // Add fallback time if task is recurring and doesn't use specificTime
            if (task.recurring && !settings.specificTime && !settings.defaultRecurTime) {
              settings.defaultRecurTime = new Date().toISOString();
            }

            return {
              id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              text: task.text || "",
              completed: task.completed || false,
              dueDate: task.dueDate || null,
              highPriority: task.highPriority || false,
              remindersEnabled: task.remindersEnabled || false,
              recurring: task.recurring || false,
              recurringSettings: settings,
              deleteWhenComplete: task.deleteWhenComplete,
              deleteWhenCompleteSettings: task.deleteWhenCompleteSettings || { cycle: false, todo: true },
              schemaVersion: task.schemaVersion || 2
            };
          }),
          autoReset: cycle.autoReset || false,
          cycleCount: cycle.cycleCount || 0,
          deleteCheckedTasks: cycle.deleteCheckedTasks || false,
          taskOptionButtons: cycle.taskOptionButtons || null,
          recurringTemplates: cycle.recurringTemplates || {},
          reminders: cycle.reminders || null,
          createdAt: cycle.createdAt || null
        };

        console.log('Export data prepared');
        this.exportMiniCycleData(miniCycleData, cycle.title || activeCycle);
      };
      safeAdd(exportBtn, "click", exportBtn._clickHandler);
    }

    /**
     * Export cycle data to .mcyc file
     */
    exportMiniCycleData(miniCycleData, cycleName) {
        console.log('📤 Exporting miniCycle data (Schema 2.5 only)...');

        try {
            const dataStr = JSON.stringify(miniCycleData, null, 2);
            const dataBlob = new Blob([dataStr], { type: "application/json" });

            const link = document.createElement("a");
            link.href = URL.createObjectURL(dataBlob);
            link.download = `${cycleName.replace(/[^a-z0-9]/gi, '_')}.mcyc`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(link.href);

            console.log('✅ Export completed successfully');
            this.deps.showNotification(`✅ "${cycleName}" exported successfully!`, "success", 3000);

        } catch (error) {
            console.error('❌ Export failed:', error);
            this.deps.showNotification("❌ Export failed. Please try again.", "error", 3000);
        }
    }

    /**
     * Setup upload/import functionality
     */
    setupUploadMiniCycle() {
      const importButtons = ["import-mini-cycle", "miniCycleUpload"];

      // Shared state
      let fileInput = null;
      let isPickerOpen = false;

      const resetPickerState = () => {
        isPickerOpen = false;
      };

      const handleImport = () => {
        if (isPickerOpen) return;
        isPickerOpen = true;

        // Clean previous input
        if (fileInput) {
          fileInput.remove();
          fileInput = null;
        }

        // Fresh input
        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = "import-data-file-input";
        fileInput.name = "dataImport";
        fileInput.accept = ".mcyc";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        // When the OS file dialog closes (even on cancel), window regains focus
        const onFocusAfterPicker = () => {
          // If change didn't fire (cancel), release the lock
          resetPickerState();
          window.removeEventListener("focus", onFocusAfterPicker);
          // Cleanup dangling input on cancel
          if (fileInput && !fileInput.files?.length) {
            fileInput.remove();
            fileInput = null;
          }
        };
        const safeAddLocal = _deps.safeAddEventListener || ((el, ev, fn, opts) => el?.addEventListener(ev, fn, opts));
        safeAddLocal(window, "focus", onFocusAfterPicker, { once: true });

        fileInput._changeHandler = (event) => {
          const file = event.target.files[0];
          if (!file) {
            fileInput.remove();
            fileInput = null;
            resetPickerState();
            return;
          }

          if (file.name.endsWith(".tcyc")) {
            this.deps.showNotification("❌ miniCycle does not support .tcyc files.\nPlease save your Task Cycle as .MCYC to import into miniCycle.");
            fileInput.remove();
            fileInput = null;
            resetPickerState();
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const importedData = JSON.parse(e.target.result);

              if (!importedData.name || !Array.isArray(importedData.tasks)) {
                this.deps.showNotification("❌ Invalid miniCycle file format.");
                return;
              }

              console.log("📥 Importing miniCycle with auto-conversion to Schema 2.5...");

              // Ensure Schema 2.5 data exists
              const schemaData = this.deps.loadMiniCycleData();
              if (!schemaData) {
                console.error("❌ Schema 2.5 data required for import");
                this.deps.showNotification("❌ Cannot import - Schema 2.5 data structure required.", "error");
                return;
              }

              const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
              const cycleId = `imported_${Date.now()}`;

              console.log("🔄 Creating imported cycle with ID:", cycleId);

              // ✅ FIX #12: Validate and sanitize all task data at import boundary
              const mappedTasks = importedData.tasks.map((task) => {
                const safeSettings = task.recurringSettings || {};
                if (task.recurring && !safeSettings.specificTime && !safeSettings.defaultRecurTime) {
                  safeSettings.defaultRecurTime = new Date().toISOString();
                }

                const taskData = {
                  id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  text: task.text || "",
                  completed: task.completed || false,
                  dueDate: task.dueDate || null,
                  highPriority: task.highPriority || false,
                  remindersEnabled: task.remindersEnabled || false,
                  recurring: task.recurring || false,
                  recurringSettings: safeSettings,
                  deleteWhenComplete: task.deleteWhenComplete,
                  deleteWhenCompleteSettings: task.deleteWhenCompleteSettings || { cycle: false, todo: true },
                  schemaVersion: task.schemaVersion || 2
                };

                // Validate task structure and sanitize text (DI-pure)
                try {
                  const DataValidator = this.deps.DataValidator;
                  if (DataValidator?.validateTask) {
                    return DataValidator.validateTask(taskData);
                  }
                  return taskData; // Return unvalidated if validator not available
                } catch (error) {
                  console.warn(`⚠️ Skipping invalid task during import:`, error.message);
                  return null;
                }
              }).filter(task => task !== null);

              // ✅ Create recurring templates for tasks with recurring: true (DI-pure)
              const recurringTemplates = {};
              const calculateNextOccurrence = this.deps.calculateNextOccurrence;
              mappedTasks.forEach(task => {
                if (task.recurring && task.recurringSettings) {
                  try {
                    let nextOccurrence = null;
                    if (typeof calculateNextOccurrence === 'function') {
                      nextOccurrence = calculateNextOccurrence(task.recurringSettings, Date.now());
                    }
                    recurringTemplates[task.id] = {
                      id: task.id,
                      text: task.text,
                      dueDate: task.dueDate || null,
                      highPriority: task.highPriority || false,
                      remindersEnabled: task.remindersEnabled || false,
                      recurring: true,
                      recurringSettings: structuredClone(task.recurringSettings),
                      nextScheduledOccurrence: nextOccurrence,
                      schemaVersion: 2
                    };
                    console.log(`✅ Created recurring template for imported task: ${task.id}`);
                  } catch (error) {
                    console.warn(`⚠️ Failed to create template for task ${task.id}:`, error);
                  }
                }
              });

              // ✅ FIX #12: Validate and sanitize cycle title (DI-pure)
              let cycleTitle = importedData.title || importedData.name || 'Imported Cycle';
              try {
                const DataValidator = this.deps.DataValidator;
                if (DataValidator?.validateCycleName) {
                  cycleTitle = DataValidator.validateCycleName(cycleTitle);
                }
              } catch (error) {
                console.warn(`⚠️ Invalid cycle title, using default:`, error.message);
                cycleTitle = 'Imported Cycle';
              }

              fullSchemaData.data.cycles[cycleId] = {
                id: cycleId,
                title: cycleTitle,
                tasks: mappedTasks,
                autoReset: importedData.autoReset !== false,
                cycleCount: importedData.cycleCount || 0,
                deleteCheckedTasks: importedData.deleteCheckedTasks || false,
                createdAt: Date.now(),
                recurringTemplates: importedData.recurringTemplates || recurringTemplates,
                taskOptionButtons: importedData.taskOptionButtons || null,
                reminders: importedData.reminders || null
              };

              // Set as active cycle and persist
              fullSchemaData.appState.activeCycleId = cycleId;
              fullSchemaData.metadata.lastModified = Date.now();
              fullSchemaData.metadata.totalCyclesCreated++;
              localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

              // ✅ SYNC AppState with imported cycle data (prevents overwriting with stale data)
              const AppState = this.deps.AppState();
              if (AppState && typeof AppState.init === 'function') {
                  AppState.data = fullSchemaData;
                  AppState.isInitialized = true;
                  AppState.isDirty = false; // Mark as clean since we just saved
                  console.log('✅ AppState synchronized with imported cycle data');
              }

              const recurringCount = Object.keys(recurringTemplates).length;
              console.log(`💾 Import completed successfully to Schema 2.5${recurringCount > 0 ? ` (${recurringCount} recurring templates created)` : ''}`);

              if (recurringCount > 0) {
                this.deps.showNotification(`✅ miniCycle "${importedData.name}" imported with ${recurringCount} recurring task${recurringCount > 1 ? 's' : ''}!`, "success", 4000);
              } else {
                this.deps.showNotification(`✅ miniCycle "${importedData.name}" imported and converted to Schema 2.5!`, "success");
              }
              location.reload();
            } catch (error) {
              this.deps.showNotification("❌ Error importing miniCycle.");
              console.error("Import error:", error);
            } finally {
              if (fileInput) {
                fileInput.remove();
                fileInput = null;
              }
              resetPickerState();
              window.removeEventListener("focus", onFocusAfterPicker);
            }
          };

          reader.readAsText(file);
        };
        safeAddLocal(fileInput, "change", fileInput._changeHandler, { once: true });

        fileInput.click();
      };

      // Attach listeners idempotently using safeAddEventListener
      const safeAdd = _deps.safeAddEventListener || ((el, ev, fn) => { el?.removeEventListener(ev, fn); el?.addEventListener(ev, fn); });
      importButtons.forEach((buttonId) => {
        const button = this.deps.getElementById(buttonId);
        if (!button) return;

        button._importHandler = handleImport;
        safeAdd(button, "click", button._importHandler);
      });
    }

    /**
     * Sync current settings to storage
     */
    async syncCurrentSettingsToStorage() {
        console.log('⚙️ Syncing current settings to storage (Schema 2.5 only)...');

        const schemaData = this.deps.loadMiniCycleData();
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for syncCurrentSettingsToStorage');
            return;
        }

        const { cycles, activeCycle } = schemaData;
        const toggleAutoReset = this.deps.getElementById("toggleAutoReset");
        const deleteCheckedTasks = this.deps.getElementById("deleteCheckedTasks");

        if (!activeCycle || !cycles[activeCycle]) {
            console.warn('⚠️ No active cycle found for settings sync');
            return;
        }

        if (!toggleAutoReset || !deleteCheckedTasks) {
            console.warn('⚠️ Settings toggles not found');
            return;
        }

        console.log('📊 Syncing settings:', {
            activeCycle,
            autoReset: toggleAutoReset.checked,
            deleteCheckedTasks: deleteCheckedTasks.checked
        });

        // ✅ Use AppState only (no localStorage fallback)
        const AppState = this.deps.AppState();
        if (AppState?.isReady?.()) {
            await AppState.update(state => {
                const cycle = state?.data?.cycles?.[activeCycle];
                if (cycle) {
                    cycle.autoReset = toggleAutoReset.checked;
                    cycle.deleteCheckedTasks = deleteCheckedTasks.checked;
                }
            }, true);
            console.log('✅ Settings synced to Schema 2.5 successfully');
        } else {
            console.error('❌ AppState not ready - settings not synced');
        }
    }

    // ✅ MOVED: setupToggleAutoReset() and setupDeleteCheckedTasksModeListener() to modeManager.js
    // These are mode management functions, not settings management

    // Fallback methods
    fallbackLoadData() {
        console.warn('⚠️ Data loading not available');
        return null;
    }

    fallbackNotification(message, type) {
        console.log(`[Settings] ${message}`);
    }

    fallbackConfirmationModal(options) {
        const confirmed = confirm(options.message);
        if (options.callback) {
            options.callback(confirmed);
        }
    }

    fallbackAddListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    /**
     * Sanitize all user-generated content in imported backup data
     * Security fix (v1.353): Prevent XSS attacks via malicious .mcyc files
     * @param {Object} backupData - The parsed backup data object
     */
    sanitizeImportedData(backupData) {
        console.log('🔒 Sanitizing imported data for XSS protection...');

        // Get sanitization function (DI-pure with inline fallback)
        const injectedSanitize = this.deps.sanitizeInput;
        const sanitize = typeof injectedSanitize === 'function'
            ? injectedSanitize
            : (text, maxLength) => {
                if (typeof text !== 'string') return '';
                const temp = document.createElement('div');
                temp.textContent = text;
                return temp.textContent.trim().substring(0, maxLength || 500);
            };

        // Sanitize Schema 2.5 format
        if (backupData.schemaVersion === '2.5' && backupData.miniCycleData) {
            try {
                const data = JSON.parse(backupData.miniCycleData);

                if (data.cycles && typeof data.cycles === 'object') {
                    Object.values(data.cycles).forEach(cycle => {
                        if (!cycle || typeof cycle !== 'object') return;

                        // Sanitize cycle title
                        if (cycle.title) {
                            cycle.title = sanitize(cycle.title, 100);
                        }

                        // Sanitize all task text
                        if (Array.isArray(cycle.tasks)) {
                            cycle.tasks.forEach(task => {
                                if (task && typeof task === 'object') {
                                    if (task.text) {
                                        task.text = sanitize(task.text, 500);
                                    }
                                    // Sanitize recurring task template text if present
                                    if (task.recurringTemplate?.text) {
                                        task.recurringTemplate.text = sanitize(task.recurringTemplate.text, 500);
                                    }
                                }
                            });
                        }
                    });
                }

                // Write sanitized data back
                backupData.miniCycleData = JSON.stringify(data);
                console.log('✅ Schema 2.5 data sanitized successfully');
            } catch (error) {
                console.error('⚠️ Error sanitizing Schema 2.5 data:', error);
            }
        }

        // Sanitize legacy format
        if (backupData.miniCycleStorage) {
            try {
                const legacyData = JSON.parse(backupData.miniCycleStorage);

                if (Array.isArray(legacyData)) {
                    legacyData.forEach(cycle => {
                        if (!cycle || typeof cycle !== 'object') return;

                        // Sanitize cycle name
                        if (cycle.name) {
                            cycle.name = sanitize(cycle.name, 100);
                        }

                        // Sanitize task text
                        if (Array.isArray(cycle.tasks)) {
                            cycle.tasks.forEach(task => {
                                if (task && typeof task === 'object' && task.text) {
                                    task.text = sanitize(task.text, 500);
                                }
                            });
                        }
                    });
                }

                // Write sanitized data back
                backupData.miniCycleStorage = JSON.stringify(legacyData);
                console.log('✅ Legacy data sanitized successfully');
            } catch (error) {
                console.error('⚠️ Error sanitizing legacy data:', error);
            }
        }

        return backupData;
    }
}

// Create global instance
let settingsManager = null;

// Export initialization function
export async function initSettingsManager(dependencies) {
    // Load appContext with version (cache-busting)
    await loadAppContext();

    settingsManager = new SettingsManager(dependencies);
    await settingsManager.init();
    return settingsManager;
}

// DI-pure module (no window.* fallbacks)
console.log('⚙️ Settings Manager loaded (DI-pure, no window.* exports)');
