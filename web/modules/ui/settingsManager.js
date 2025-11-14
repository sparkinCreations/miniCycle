/**
 * ⚙️ miniCycle Settings Manager
 * Handles settings panel, import/export, and configuration
 *
 * @module settingsManager
 * @version 1.356
 * @pattern Resilient Constructor 🛡️
 */

import { appInit } from '../core/appInit.js';
import { calculateNextOccurrence } from '../recurring/recurringCore.js';

export class SettingsManager {
    constructor(dependencies = {}) {
        this.version = '1.356';
        this.initialized = false;

        // Store dependencies with resilient fallbacks
        this.deps = {
            loadMiniCycleData: dependencies.loadMiniCycleData || this.fallbackLoadData,
            AppState: dependencies.AppState || (() => null),
            showNotification: dependencies.showNotification || this.fallbackNotification,
            showConfirmationModal: dependencies.showConfirmationModal || this.fallbackConfirmationModal,
            hideMainMenu: dependencies.hideMainMenu || (() => {}),
            getElementById: dependencies.getElementById || ((id) => document.getElementById(id)),
            querySelector: dependencies.querySelector || ((sel) => document.querySelector(sel)),
            querySelectorAll: dependencies.querySelectorAll || ((sel) => document.querySelectorAll(sel)),
            safeAddEventListener: dependencies.safeAddEventListener || this.fallbackAddListener,
            setupDarkModeToggle: dependencies.setupDarkModeToggle || (() => console.warn('Dark mode toggle not available')),
            setupQuickDarkToggle: dependencies.setupQuickDarkToggle || (() => console.warn('Quick dark toggle not available')),
            updateMoveArrowsVisibility: dependencies.updateMoveArrowsVisibility || (() => {}),
            toggleHoverTaskOptions: dependencies.toggleHoverTaskOptions || (() => {}),
            refreshTaskListUI: dependencies.refreshTaskListUI || (() => {}),
            performSchema25Migration: dependencies.performSchema25Migration || (() => ({ success: false })),
            resetDefaultRecurringSettings: dependencies.resetDefaultRecurringSettings || (() => {})
        };
    }

    /**
     * Initialize settings manager
     */
    async init() {
        if (this.initialized) return;

        // Wait for core systems
        await appInit.waitForCore();

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

        // ✅ Remove previous listeners before adding new ones
        if (openSettingsBtn) {
            openSettingsBtn.removeEventListener("click", openSettings);
            openSettingsBtn.addEventListener("click", openSettings);
        }

        if (closeSettingsBtn) {
            closeSettingsBtn.removeEventListener("click", closeSettings);
            closeSettingsBtn.addEventListener("click", closeSettings);
        }

        document.removeEventListener("click", closeOnClickOutside);
        document.addEventListener("click", closeOnClickOutside);

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
                console.error('❌ Schema 2.5 data required for move arrows toggle');
                return;
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

            moveArrowsToggle.addEventListener("change", () => {
                const enabled = moveArrowsToggle.checked;

                console.log('🔄 Move arrows toggle changed:', enabled);

                // ✅ Use state system if available
                const AppState = this.deps.AppState();
                if (AppState?.isReady?.()) {
                    AppState.update(state => {
                        if (!state.ui) state.ui = {};
                        state.ui.moveArrowsVisible = enabled;
                        state.metadata.lastModified = Date.now();
                    }, true); // immediate save

                    console.log('✅ Move arrows setting saved to state:', enabled);
                } else {
                    // ✅ Fallback to localStorage if state not ready
                    console.warn('⚠️ AppState not ready, using localStorage fallback');
                    const schemaData = this.deps.loadMiniCycleData();
                    if (schemaData) {
                        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                        fullSchemaData.settings.showMoveArrows = enabled;
                        fullSchemaData.metadata.lastModified = Date.now();
                        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                    }
                }

                this.deps.updateMoveArrowsVisibility();
            });

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

            threeDotsToggle.addEventListener("change", () => {
                const enabled = threeDotsToggle.checked;

                console.log('🔄 Three dots toggle changed:', enabled);

                // ✅ Update through AppState if available (prevents race conditions)
                const AppState = this.deps.AppState();
                if (AppState?.isReady?.()) {
                    AppState.update(state => {
                        if (!state.settings) state.settings = {};
                        state.settings.showThreeDots = enabled;
                        state.metadata.lastModified = Date.now();
                    }, true); // immediate save
                    console.log('✅ Three dots setting saved to AppState:', enabled);
                } else {
                    // Fallback to direct localStorage update
                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    if (fullSchemaData) {
                        if (!fullSchemaData.settings) fullSchemaData.settings = {};
                        fullSchemaData.settings.showThreeDots = enabled;
                        fullSchemaData.metadata.lastModified = Date.now();
                        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                        console.log('✅ Three dots setting saved to localStorage:', enabled);
                    }
                }

                document.body.classList.toggle("show-three-dots-enabled", enabled);

                // ✅ Disable/enable hover behavior for current tasks
                this.deps.toggleHoverTaskOptions(!enabled);

                // ✅ Update task list UI
                this.deps.refreshTaskListUI();
            });

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

            completedDropdownToggle.addEventListener("change", () => {
                const enabled = completedDropdownToggle.checked;

                console.log('🔄 Completed dropdown toggle changed:', enabled);

                // ✅ Use state system if available
                const AppState = this.deps.AppState();
                if (AppState?.isReady?.()) {
                    AppState.update(state => {
                        if (!state.settings) state.settings = {};
                        state.settings.showCompletedDropdown = enabled;
                        state.metadata.lastModified = Date.now();
                    }, true); // immediate save

                    console.log('✅ Completed dropdown setting saved to state:', enabled);
                } else {
                    // ✅ Fallback to localStorage if state not ready
                    console.warn('⚠️ AppState not ready, using localStorage fallback');
                    const schemaData = this.deps.loadMiniCycleData();
                    if (schemaData) {
                        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                        if (!fullSchemaData.settings) fullSchemaData.settings = {};
                        fullSchemaData.settings.showCompletedDropdown = enabled;
                        fullSchemaData.metadata.lastModified = Date.now();
                        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                    }
                }

                // ✅ If enabling, organize existing completed tasks
                if (enabled && typeof window.organizeCompletedTasks === 'function') {
                    window.organizeCompletedTasks();
                }

                // ✅ If disabling, move completed tasks back to main list
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
            });

            console.log('✅ Completed dropdown toggle setup completed');
        }

        // ✅ Update backup function to be Schema 2.5 only
        const backupBtn = this.deps.getElementById("backup-mini-cycles");
        if (backupBtn) {
            backupBtn.addEventListener("click", () => {
                console.log('📤 Creating backup (Schema 2.5 only)...');

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

                this.deps.showNotification("✅ Schema 2.5 backup created successfully!", "success", 3000);
            });
        }

        // ✅ Update restore function to convert legacy backups to Schema 2.5 (idempotent + cancel-safe)
        (() => {
          const restoreBtn = this.deps.getElementById("restore-mini-cycles");
          if (!restoreBtn) return;

          let fileInput = null;
          let isPickerOpen = false;

          const resetPicker = () => { isPickerOpen = false; };

          const handleRestore = () => {
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
            fileInput.id = "import-cycle-file-input";
            fileInput.name = "cycleImport";
            fileInput.accept = "application/json,.json";
            fileInput.style.display = "none";
            document.body.appendChild(fileInput);

            // When picker closes (even on cancel), window regains focus
            const onFocusAfterPicker = () => {
              resetPicker();
              window.removeEventListener("focus", onFocusAfterPicker);
              // Cleanup dangling input on cancel
              if (fileInput && !fileInput.files?.length) {
                fileInput.remove();
                fileInput = null;
              }
            };
            window.addEventListener("focus", onFocusAfterPicker, { once: true });

            fileInput.addEventListener("change", (event) => {
              const file = event.target.files[0];
              if (!file) {
                if (fileInput) {
                  fileInput.remove();
                  fileInput = null;
                }
                resetPicker();
                return;
              }

              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  // ✅ XSS PROTECTION: Validate file size (max 10MB)
                  const maxSize = 10 * 1024 * 1024; // 10MB
                  if (e.target.result.length > maxSize) {
                    this.deps.showNotification("❌ File too large (max 10MB)", "error");
                    return;
                  }

                  const backupData = JSON.parse(e.target.result);

                  // ✅ XSS PROTECTION: Validate backup data is an object
                  if (typeof backupData !== 'object' || backupData === null) {
                    this.deps.showNotification("❌ Invalid backup file format", "error");
                    return;
                  }

                  // ✅ XSS PROTECTION: Sanitize all user-generated content in imported data
                  // Security fix (v1.353): Prevent XSS attacks via malicious .mcyc files
                  this.sanitizeImportedData(backupData);

                  // ✅ Check if user is currently on Schema 2.5 (should always be true now)
                  const currentSchemaData = localStorage.getItem("miniCycleData");
                  if (!currentSchemaData) {
                    this.deps.showNotification("❌ Cannot restore - Schema 2.5 data structure required.", "error");
                    return;
                  }

                  // ✅ Handle Schema 2.5 backup
                  if (backupData.schemaVersion === "2.5" && backupData.miniCycleData) {
                    localStorage.setItem("miniCycleData", backupData.miniCycleData);
                    this.deps.showNotification("✅ Schema 2.5 backup restored successfully!", "success", 4000);

                    this.deps.showNotification("🔄 Reloading app to apply changes...", "info", 2000);
                    setTimeout(() => location.reload(), 2500);
                    return;
                  }

                  // ✅ Handle legacy backup - convert to Schema 2.5
                  if (backupData.schemaVersion === "legacy" || backupData.miniCycleStorage) {
                    this.deps.showNotification("🔄 Auto-converting legacy backup to Schema 2.5...", "info", 3000);

                    if (!backupData.miniCycleStorage) {
                      this.deps.showNotification("❌ Invalid legacy backup file format.", "error", 3000);
                      return;
                    }

                    // ✅ CRITICAL: Stop AppState from auto-saving over our migration
                    this.neutralizeAppState();

                    // Temporarily restore legacy keys
                    localStorage.setItem("miniCycleStorage", backupData.miniCycleStorage);
                    localStorage.setItem("lastUsedMiniCycle", backupData.lastUsedMiniCycle || "");

                    if (backupData.miniCycleReminders) {
                      localStorage.setItem("miniCycleReminders", backupData.miniCycleReminders);
                    }
                    if (backupData.milestoneUnlocks) {
                      localStorage.setItem("milestoneUnlocks", backupData.milestoneUnlocks);
                    }
                    if (backupData.darkModeEnabled !== undefined) {
                      localStorage.setItem("darkModeEnabled", backupData.darkModeEnabled);
                    }
                    if (backupData.currentTheme) {
                      localStorage.setItem("currentTheme", backupData.currentTheme);
                    }

                    // Migrate to 2.5
                    setTimeout(() => {
                      const migrationResults = this.deps.performSchema25Migration();

                      if (migrationResults.success) {
                        this.deps.showNotification("✅ Legacy backup restored and converted to Schema 2.5!", "success", 4000);
                      } else {
                        this.deps.showNotification("❌ Migration failed during restore", "error", 4000);
                      }

                      setTimeout(() => location.reload(), 1000);
                    }, 500);

                    return; // prevent double reload path
                  }

                  this.deps.showNotification("❌ Invalid backup file format.", "error", 3000);
                } catch (error) {
                  console.error("Backup restore error:", error);
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
            }, { once: true });

            fileInput.click();
          };

          // Idempotent listener attachment
          if (restoreBtn._restoreHandler) {
            restoreBtn.removeEventListener("click", restoreBtn._restoreHandler);
          }
          restoreBtn._restoreHandler = handleRestore;
          restoreBtn.addEventListener("click", restoreBtn._restoreHandler);
        }).bind(this)();


        const resetRecurringBtn = this.deps.getElementById("reset-recurring-default");
        if (resetRecurringBtn) {
            resetRecurringBtn.addEventListener("click", () => this.resetDefaultRecurringSettings());
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
            resetBtn.addEventListener("click", () => {
                this.deps.showConfirmationModal({
                    title: "Factory Reset",
                    message: "⚠️ This will DELETE ALL miniCycle data, settings, and progress. Are you sure?",
                    confirmText: "Delete Everything",
                    cancelText: "Cancel",
                    callback: async (confirmed) => {
                        if (!confirmed) {
                            this.deps.showNotification("❌ Factory reset cancelled.", "info", 2000);
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
            });
        }).bind(this)();
    }

    /**
     * Reset default recurring settings
     * Update reset recurring default for Schema 2.5 only
     */
    resetDefaultRecurringSettings() {
        console.log('🔁 Resetting recurring defaults (Schema 2.5 only)...');

        const schemaData = localStorage.getItem("miniCycleData");
        if (!schemaData) {
            console.error('❌ Schema 2.5 data required for reset');
            this.deps.showNotification("❌ No Schema 2.5 data found. Cannot reset defaults.", "error");
            return;
        }

        const parsed = JSON.parse(schemaData);

        const defaultSettings = {
            frequency: "daily",
            indefinitely: true,
            time: null
        };

        // Reset defaults in Schema 2.5
        parsed.settings.defaultRecurringSettings = defaultSettings;
        parsed.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(parsed));

        this.deps.showNotification("🔁 Recurring default reset to Daily Indefinitely.", "success");
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

      exportBtn.addEventListener("click", () => {
        console.log('📤 Exporting miniCycle (Schema 2.5 only)...');

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
              schemaVersion: task.schemaVersion || 2
            };
          }),
          autoReset: cycle.autoReset || false,
          cycleCount: cycle.cycleCount || 0,
          deleteCheckedTasks: cycle.deleteCheckedTasks || false
        };

        console.log('✅ Export data prepared');
        this.exportMiniCycleData(miniCycleData, cycle.title || activeCycle);
      });
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
        window.addEventListener("focus", onFocusAfterPicker, { once: true });

        fileInput.addEventListener("change", (event) => {
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

              // Map tasks with proper structure
              const mappedTasks = importedData.tasks.map((task) => {
                const safeSettings = task.recurringSettings || {};
                if (task.recurring && !safeSettings.specificTime && !safeSettings.defaultRecurTime) {
                  safeSettings.defaultRecurTime = new Date().toISOString();
                }
                return {
                  id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  text: task.text || "",
                  completed: false,
                  dueDate: task.dueDate || null,
                  highPriority: task.highPriority || false,
                  remindersEnabled: task.remindersEnabled || false,
                  recurring: task.recurring || false,
                  recurringSettings: safeSettings,
                  schemaVersion: task.schemaVersion || 2
                };
              });

              // ✅ Create recurring templates for tasks with recurring: true
              const recurringTemplates = {};
              mappedTasks.forEach(task => {
                if (task.recurring && task.recurringSettings) {
                  try {
                    recurringTemplates[task.id] = {
                      id: task.id,
                      text: task.text,
                      dueDate: task.dueDate || null,
                      highPriority: task.highPriority || false,
                      remindersEnabled: task.remindersEnabled || false,
                      recurring: true,
                      recurringSettings: structuredClone(task.recurringSettings),
                      nextScheduledOccurrence: calculateNextOccurrence(task.recurringSettings, Date.now()),
                      schemaVersion: 2
                    };
                    console.log(`✅ Created recurring template for imported task: ${task.id}`);
                  } catch (error) {
                    console.warn(`⚠️ Failed to create template for task ${task.id}:`, error);
                  }
                }
              });

              fullSchemaData.data.cycles[cycleId] = {
                id: cycleId,
                title: importedData.title || importedData.name,
                tasks: mappedTasks,
                autoReset: importedData.autoReset !== false,
                cycleCount: importedData.cycleCount || 0,
                deleteCheckedTasks: importedData.deleteCheckedTasks || false,
                createdAt: Date.now(),
                recurringTemplates: recurringTemplates
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
        }, { once: true });

        fileInput.click();
      };

      // Attach listeners idempotently
      importButtons.forEach((buttonId) => {
        const button = this.deps.getElementById(buttonId);
        if (!button) return;

        if (button._importHandler) {
          button.removeEventListener("click", button._importHandler);
        }
        button._importHandler = handleImport;
        button.addEventListener("click", button._importHandler);
      });
    }

    /**
     * Sync current settings to storage
     */
    syncCurrentSettingsToStorage() {
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

        // Update Schema 2.5 data
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle].autoReset = toggleAutoReset.checked;
        fullSchemaData.data.cycles[activeCycle].deleteCheckedTasks = deleteCheckedTasks.checked;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        console.log('✅ Settings synced to Schema 2.5 successfully');
    }

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

        // Get sanitization function (with fallback)
        const sanitize = typeof window.sanitizeInput === 'function'
            ? window.sanitizeInput
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
export function initSettingsManager(dependencies) {
    settingsManager = new SettingsManager(dependencies);
    return settingsManager.init().then(() => settingsManager);
}

// Expose class for testing
if (typeof window !== 'undefined') {
    window.SettingsManager = SettingsManager;

    // Global wrapper functions for backward compatibility
    window.setupSettingsMenu = () => settingsManager?.setupSettingsMenu();
    window.setupDownloadMiniCycle = () => settingsManager?.setupDownloadMiniCycle();
    window.exportMiniCycleData = (data, name) => settingsManager?.exportMiniCycleData(data, name);
    window.setupUploadMiniCycle = () => settingsManager?.setupUploadMiniCycle();
    window.syncCurrentSettingsToStorage = () => settingsManager?.syncCurrentSettingsToStorage();
}

console.log('⚙️ Settings Manager v1.330 loaded');
