/**
 * 🔄 miniCycle Migration Manager
 *
 * Pattern: Strict Dependency Injection (🔧)
 * Handles schema version migrations with strict dependencies
 *
 * CRITICAL: Call setMigrationManagerDependencies() before using any functions!
 *
 * Responsibilities:
 * - Schema version detection and migration
 * - Legacy data format conversion to Schema 2.5
 * - Data validation and fixing
 * - Automatic backup and restore
 * - Fallback to legacy mode on failure
 *
 * Dependencies: storage, sessionStorage, showNotification, initialSetup, now, document
 * Lines: ~1,420
 * Risk: Medium (critical data operations)
 *
 * @module modules/cycle/migrationManager
 * @version 1.386
 */

// ==========================================
// 🔧 STRICT DEPENDENCY INJECTION
// ==========================================

const Deps = {
    storage: null,              // window.localStorage
    sessionStorage: null,       // window.sessionStorage
    showNotification: null,     // (message, type, duration) => void
    initialSetup: null,         // () => void (app initialization fallback)
    now: null,                  // () => Date.now()
    document: null              // document reference for DOM operations
};

/**
 * Configure migration manager dependencies
 * MUST be called before using any migration functions
 *
 * @param {Object} overrides - Dependency overrides
 * @param {Object} overrides.storage - localStorage reference
 * @param {Object} overrides.sessionStorage - sessionStorage reference
 * @param {Function} overrides.showNotification - Notification function
 * @param {Function} overrides.initialSetup - App initialization function
 * @param {Function} overrides.now - Time function (for testing)
 * @param {Object} overrides.document - Document reference (for DOM operations)
 */
export function setMigrationManagerDependencies(overrides = {}) {
    Object.assign(Deps, overrides);
    console.log('🔄 Migration Manager dependencies configured:', {
        storage: !!Deps.storage,
        sessionStorage: !!Deps.sessionStorage,
        showNotification: typeof Deps.showNotification === 'function',
        initialSetup: typeof Deps.initialSetup === 'function',
        now: typeof Deps.now === 'function',
        document: !!Deps.document
    });
}

/**
 * Ensure dependency is available (fail-fast)
 *
 * @param {string} name - Dependency name
 * @param {*} value - Dependency value to check
 * @throws {Error} If dependency is missing
 */
function assertInjected(name, value) {
    const isValid = name === 'storage' || name === 'sessionStorage' || name === 'document'
        ? !!value
        : typeof value === 'function';

    if (!isValid) {
        throw new Error(
            `migrationManager: missing required dependency '${name}'. ` +
            `Call setMigrationManagerDependencies() first.`
        );
    }
}

// ==========================================
// 🆕 SCHEMA 2.5 INITIALIZATION
// ==========================================

/**
 * Create initial Schema 2.5 data structure
 * Used for first-time users or fresh start
 *
 * @public
 */
export function createInitialSchema25Data() {
    assertInjected('storage', Deps.storage);
    assertInjected('now', Deps.now);

    const initialData = {
        schemaVersion: "2.5",
        metadata: {
            createdAt: Deps.now(),
            lastModified: Deps.now(),
            migratedFrom: null,
            migrationDate: null,
            totalCyclesCreated: 0,
            totalTasksCompleted: 0,
            schemaVersion: "2.5"
        },
        settings: {
            theme: 'default',
            darkMode: false,
            alwaysShowRecurring: false,
            autoSave: true,
            showThreeDots: false,
            onboardingCompleted: false,
            dismissedEducationalTips: {},
            defaultRecurringSettings: {
                frequency: "daily",
                indefinitely: true,
                time: null
            },
            unlockedThemes: [],
            unlockedFeatures: [],
            notificationPosition: { x: 0, y: 0 },
            notificationPositionModified: false,
            accessibility: {
                reducedMotion: false,
                highContrast: false,
                screenReaderHints: false
            }
        },
        data: {
            cycles: {} // Empty - user will create their first cycle
        },
        appState: {
            activeCycleId: null, // No active cycle yet
            overdueTaskStates: {} // ✅ Add this for overdue task tracking
        },
        userProgress: {
            cyclesCompleted: 0,
            rewardMilestones: []
        },
        customReminders: {
            enabled: false,
            indefinite: false,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 30,
            frequencyUnit: "minutes"
        }
    };

    Deps.storage.setItem("miniCycleData", JSON.stringify(initialData));
    console.log('✅ Initial Schema 2.5 data created');
}

// ==========================================
// 🔄 SCHEMA 2.5 MIGRATION CONSTANTS
// ==========================================

const SCHEMA_2_5_TARGET = {
    schemaVersion: "2.5",
    metadata: {
        createdAt: null,
        lastModified: null,
        migratedFrom: null,
        migrationDate: null,
        totalCyclesCreated: 0,
        totalTasksCompleted: 0,
        schemaVersion: "2.5"
    },
    settings: {
        theme: null,
        darkMode: false,
        alwaysShowRecurring: false,
        autoSave: true,
        defaultRecurringSettings: {
            frequency: null,
            indefinitely: true,
            time: null
        },
        unlockedThemes: [],
        unlockedFeatures: [],
        notificationPosition: { x: 0, y: 0 },
        notificationPositionModified: false,
        accessibility: {
            reducedMotion: false,
            highContrast: false,
            screenReaderHints: false
        }
    },
    data: {
        cycles: {}
    },
    appState: {
        activeCycleId: null
    },
    userProgress: {
        cyclesCompleted: 0,
        rewardMilestones: []
    },
    customReminders: {
        enabled: false,
        indefinite: false,
        dueDatesReminders: false,
        repeatCount: 0,
        frequencyValue: 30,
        frequencyUnit: "minutes"
    }
};

// ==========================================
// 🔍 MIGRATION DETECTION
// ==========================================

/**
 * Check if migration is needed
 *
 * @returns {Object} Migration check result
 * @returns {boolean} .needed - Whether migration is needed
 * @returns {string} .currentVersion - Current schema version
 * @returns {Object} .oldDataFound - Legacy data detection details
 *
 * @public
 */
export function checkMigrationNeeded() {
    assertInjected('storage', Deps.storage);
    assertInjected('document', Deps.document);

    const currentData = Deps.storage.getItem("miniCycleData");
    if (currentData) {
        const parsed = JSON.parse(currentData);
        if (parsed.schemaVersion === "2.5") {
            return { needed: false, currentVersion: "2.5" };
        }
    }

    // Check for old format data
    const oldCycles = Deps.storage.getItem("miniCycleStorage");
    const lastUsed = Deps.storage.getItem("lastUsedMiniCycle");
    const reminders = Deps.storage.getItem("miniCycleReminders");

    const hasOldData = !!(oldCycles || lastUsed || reminders);

    return {
        needed: hasOldData,
        currentVersion: currentData ? "unknown" : "legacy",
        oldDataFound: {
            cycles: !!oldCycles,
            lastUsed: !!lastUsed,
            reminders: !!reminders,
            milestones: !!Deps.storage.getItem("milestoneUnlocks"),
            darkMode: Deps.document.body.classList.contains('dark-mode')
        }
    };
}

// ==========================================
// 🧪 MIGRATION SIMULATION & EXECUTION
// ==========================================

/**
 * Simulate migration to Schema 2.5 (dry run or actual)
 *
 * @param {boolean} dryRun - If true, only simulate without saving
 * @returns {Object} Migration simulation results
 *
 * @public
 */
export function simulateMigrationToSchema25(dryRun = true) {
    assertInjected('storage', Deps.storage);
    assertInjected('now', Deps.now);

    const results = {
        success: false,
        errors: [],
        warnings: [],
        changes: [],
        dataPreview: null
    };

    try {
        // 1. Gather existing data
        const oldCycles = JSON.parse(Deps.storage.getItem("miniCycleStorage") || "{}");
        const lastUsed = Deps.storage.getItem("lastUsedMiniCycle");
        const reminders = JSON.parse(Deps.storage.getItem("miniCycleReminders") || "{}");
        const milestones = JSON.parse(Deps.storage.getItem("milestoneUnlocks") || "{}");
        const moveArrows = Deps.storage.getItem("miniCycleMoveArrows") === "true";
        const threeDots = Deps.storage.getItem("miniCycleThreeDots") === "true";
        const alwaysRecurring = JSON.parse(Deps.storage.getItem("miniCycleAlwaysShowRecurring")) || false;
        const darkModeEnabled = Deps.storage.getItem("darkModeEnabled") === "true";
        const currentTheme = Deps.storage.getItem("currentTheme") || null;
        const notifPosition = JSON.parse(Deps.storage.getItem("miniCycleNotificationPosition") || "{}");

        // 2. Create new schema structure
        const newData = JSON.parse(JSON.stringify(SCHEMA_2_5_TARGET));

        // 3. Populate metadata
        newData.metadata.createdAt = Deps.now();
        newData.metadata.lastModified = Deps.now();
        newData.metadata.migratedFrom = "legacy";
        newData.metadata.migrationDate = Deps.now();
        newData.metadata.totalCyclesCreated = Object.keys(oldCycles).length;

        // Calculate total completed tasks
        let totalCompleted = 0;
        Object.values(oldCycles).forEach(cycle => {
            totalCompleted += cycle.cycleCount || 0;
        });
        newData.metadata.totalTasksCompleted = totalCompleted;

        // 4. Populate settings
        newData.settings.theme = currentTheme;
        newData.settings.darkMode = darkModeEnabled;
        newData.settings.alwaysShowRecurring = alwaysRecurring;

        // Unlocked themes from milestones
        if (milestones.darkOcean) newData.settings.unlockedThemes.push("dark-ocean");
        if (milestones.goldenGlow) newData.settings.unlockedThemes.push("golden-glow");
        if (milestones.taskOrderGame) newData.settings.unlockedFeatures.push("task-order-game");

        // Notification position
        if (notifPosition.x || notifPosition.y) {
            newData.settings.notificationPosition = notifPosition;
            newData.settings.notificationPositionModified = true;
        }

        // 5. Migrate cycles
        newData.data.cycles = oldCycles;
        newData.appState.activeCycleId = lastUsed;

        // 6. Migrate reminders
        newData.customReminders = {
            enabled: reminders.enabled || false,
            indefinite: reminders.indefinite || false,
            dueDatesReminders: reminders.dueDatesReminders || false,
            repeatCount: reminders.repeatCount || 0,
            frequencyValue: reminders.frequencyValue || 30,
            frequencyUnit: reminders.frequencyUnit || "minutes"
        };

        // 7. User progress
        newData.userProgress.cyclesCompleted = totalCompleted;
        if (milestones.darkOcean) newData.userProgress.rewardMilestones.push("dark-ocean-5");
        if (milestones.goldenGlow) newData.userProgress.rewardMilestones.push("golden-glow-50");

        results.changes.push(`✅ Found ${Object.keys(oldCycles).length} cycles to migrate`);
        results.changes.push(`✅ Active cycle: ${lastUsed || "none"}`);
        results.changes.push(`✅ Total completed cycles: ${totalCompleted}`);
        results.changes.push(`✅ Reminders enabled: ${reminders.enabled ? "yes" : "no"}`);
        results.changes.push(`✅ Themes unlocked: ${newData.settings.unlockedThemes.length}`);

        if (!dryRun) {
            // Actually perform migration
            Deps.storage.setItem("miniCycleData", JSON.stringify(newData));
            results.changes.push("🚀 Migration completed - data saved to miniCycleData");

            // Optionally backup old data
            const backupKey = `migration_backup_${Deps.now()}`;
            const oldData = {
                miniCycleStorage: oldCycles,
                lastUsedMiniCycle: lastUsed,
                miniCycleReminders: reminders,
                milestoneUnlocks: milestones,
                darkModeEnabled: darkModeEnabled,
                currentTheme: currentTheme
            };
            Deps.storage.setItem(backupKey, JSON.stringify(oldData));
            results.changes.push(`💾 Old data backed up to ${backupKey}`);
        }

        results.dataPreview = newData;
        results.success = true;

    } catch (error) {
        results.errors.push(`Migration failed: ${error.message}`);
    }

    return results;
}

/**
 * Perform Schema 2.5 migration with backup
 *
 * @returns {Object} Migration results
 *
 * @public
 */
export function performSchema25Migration() {
    assertInjected('storage', Deps.storage);
    assertInjected('now', Deps.now);

    // Create backup first
    const backupKey = `pre_migration_backup_${Deps.now()}`;
    const currentData = {};

    // Backup all current localStorage
    ["miniCycleStorage", "lastUsedMiniCycle", "miniCycleReminders",
     "milestoneUnlocks", "darkModeEnabled", "currentTheme",
     "miniCycleNotificationPosition", "miniCycleAlwaysShowRecurring"].forEach(key => {
        const value = Deps.storage.getItem(key);
        if (value) currentData[key] = value;
    });

    Deps.storage.setItem(backupKey, JSON.stringify(currentData));

    // Perform actual migration
    const results = simulateMigrationToSchema25(false);

    if (results.success) {
        // Clean up old keys (optional - you might want to keep them temporarily)
        // Object.keys(currentData).forEach(key => Deps.storage.removeItem(key));
        results.changes.push(`🗂️ Backup created: ${backupKey}`);
    }

    return results;
}

// ==========================================
// 🔧 DATA VALIDATION & FIXING
// ==========================================

/**
 * Validate all tasks with lenient rules (critical errors only)
 * Used during auto-migration to allow migration to proceed
 *
 * @returns {Array} Array of critical validation errors
 *
 * @public
 */
export function validateAllMiniCycleTasksLenient() {
    assertInjected('storage', Deps.storage);

    const storage = JSON.parse(Deps.storage.getItem("miniCycleStorage")) || {};
    const results = [];

    for (const [cycleName, cycleData] of Object.entries(storage)) {
        if (!Array.isArray(cycleData.tasks)) continue;

        cycleData.tasks.forEach(task => {
            const criticalErrors = [];

            // ✅ Only check for critical errors that would break migration
            if (!task.text && !task.taskText) {
                criticalErrors.push("Task has no text content");
            }

            if (!task.id) {
                criticalErrors.push("Task missing unique ID");
            }

            // ✅ Check for completely malformed recurring settings (not just missing properties)
            if (task.recurring && task.recurringSettings && typeof task.recurringSettings !== 'object') {
                criticalErrors.push("Recurring settings is not a valid object");
            }

            // ✅ Only report tasks with critical issues
            if (criticalErrors.length > 0) {
                results.push({
                    cycle: cycleName,
                    taskText: task.text || task.taskText || "(no text)",
                    id: task.id || "(no id)",
                    errors: criticalErrors
                });
            }
        });
    }

    return results;
}

/**
 * Fix common task validation issues automatically
 * Adds missing required fields to recurring tasks
 *
 * @returns {Object} Fix results with count and details
 *
 * @public
 */
export function fixTaskValidationIssues() {
    assertInjected('storage', Deps.storage);

    console.log('🔧 Fixing task validation issues...');

    try {
        const legacyData = Deps.storage.getItem('miniCycleStorage');
        if (!legacyData) {
            console.log('⚠️ No legacy data found');
            return { success: false, message: 'No legacy data found' };
        }

        const cycles = JSON.parse(legacyData);
        let fixedTasks = 0;
        let fixedDetails = [];

        Object.keys(cycles).forEach(cycleName => {
            const cycle = cycles[cycleName];
            if (!cycle.tasks || !Array.isArray(cycle.tasks)) return;

            cycle.tasks.forEach(task => {
                const taskId = task.id || 'unknown';
                console.log(`🔍 Checking task: "${task.taskText}" (${taskId})`);

                // ✅ NEW: Handle tasks that SHOULD have recurring but don't
                if (!task.recurring && (task.taskText || task.id)) {
                    // Skip tasks that are clearly not meant to be recurring
                    // (This is the safest approach - only fix existing recurring objects)
                    return;
                }

                // ✅ Handle tasks with incomplete recurring objects
                if (task.recurring && typeof task.recurring === 'object') {

                    // Set sensible defaults based on existing data or fallbacks
                    if (task.recurring.recurCount === undefined) {
                        task.recurring.recurCount = 1;
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added recurCount`);
                        console.log('  ✅ Fixed: Added recurCount = 1');
                    }

                    if (task.recurring.recurIndefinitely === undefined) {
                        task.recurring.recurIndefinitely = true;
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added recurIndefinitely`);
                        console.log('  ✅ Fixed: Added recurIndefinitely = true');
                    }

                    if (task.recurring.useSpecificTime === undefined) {
                        task.recurring.useSpecificTime = false;
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added useSpecificTime`);
                        console.log('  ✅ Fixed: Added useSpecificTime = false');
                    }

                    // ✅ Set frequency if missing
                    if (!task.recurring.frequency) {
                        task.recurring.frequency = 'daily'; // Most common default
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added default frequency`);
                        console.log('  ✅ Fixed: Added frequency = daily');
                    }

                    // Fix missing frequency blocks based on actual frequency
                    const freq = task.recurring.frequency;

                    if (freq === 'hourly' && !task.recurring.hourly) {
                        task.recurring.hourly = {
                            useSpecificMinute: false,
                            minute: 0
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added hourly block`);
                        console.log('  ✅ Fixed: Added hourly block');
                    }

                    if (freq === 'daily' && !task.recurring.daily) {
                        task.recurring.daily = {
                            useSpecificTime: false,
                            hour: 12,
                            minute: 0,
                            meridiem: 'PM',
                            militaryTime: false
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added daily block`);
                        console.log('  ✅ Fixed: Added daily block');
                    }

                    if (freq === 'weekly' && !task.recurring.weekly) {
                        task.recurring.weekly = {
                            useSpecificDays: false,
                            days: [],
                            useSpecificTime: false,
                            hour: 12,
                            minute: 0,
                            meridiem: 'PM',
                            militaryTime: false
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added weekly block`);
                        console.log('  ✅ Fixed: Added weekly block');
                    }

                    if (freq === 'biweekly' && !task.recurring.biweekly) {
                        task.recurring.biweekly = {
                            useSpecificDays: false,
                            days: [],
                            useSpecificTime: false,
                            hour: 12,
                            minute: 0,
                            meridiem: 'PM',
                            militaryTime: false
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added biweekly block`);
                        console.log('  ✅ Fixed: Added biweekly block');
                    }

                    if (freq === 'monthly' && !task.recurring.monthly) {
                        task.recurring.monthly = {
                            useSpecificDays: false,
                            days: [],
                            useSpecificTime: false,
                            hour: 12,
                            minute: 0,
                            meridiem: 'PM',
                            militaryTime: false
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added monthly block`);
                        console.log('  ✅ Fixed: Added monthly block');
                    }

                    if (freq === 'yearly' && !task.recurring.yearly) {
                        task.recurring.yearly = {
                            useSpecificMonths: false,
                            months: [],
                            useSpecificDays: false,
                            days: [],
                            useSpecificTime: false,
                            hour: 12,
                            minute: 0,
                            meridiem: 'PM',
                            militaryTime: false
                        };
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added yearly block`);
                        console.log('  ✅ Fixed: Added yearly block');
                    }
                }
            });
        });

        if (fixedTasks > 0) {
            Deps.storage.setItem('miniCycleStorage', JSON.stringify(cycles));
            console.log(`✅ Fixed ${fixedTasks} task validation issues:`);
            fixedDetails.forEach(detail => console.log(`   - ${detail}`));

            return {
                success: true,
                fixedCount: fixedTasks,
                details: fixedDetails,
                message: `Fixed ${fixedTasks} validation issues`
            };
        } else {
            console.log('✅ No fixes needed');
            return {
                success: true,
                fixedCount: 0,
                message: 'No validation issues found'
            };
        }

    } catch (error) {
        console.error('❌ Error fixing task validation:', error);
        return {
            success: false,
            error: error.message,
            message: `Error during fix: ${error.message}`
        };
    }
}

// ==========================================
// 🔄 AUTOMATIC MIGRATION SYSTEM
// ==========================================

/**
 * Perform automatic migration with enhanced error handling
 * INTERNAL - Use initializeAppWithAutoMigration() instead
 *
 * @param {Object} options - Migration options
 * @param {boolean} options.forceMode - Skip all safety checks
 * @param {boolean} options.skipValidation - Skip validation step
 * @param {boolean} options.skipBackup - Skip backup creation
 * @returns {Promise<Object>} Migration result
 *
 * @private
 */
async function performAutoMigration(options = {}) {
    assertInjected('storage', Deps.storage);
    assertInjected('showNotification', Deps.showNotification);
    assertInjected('now', Deps.now);

    const {
        forceMode = false,
        skipValidation = false,
        skipBackup = false
    } = options;

    try {
        console.log('🔄 Starting auto-migration process…', {
            forceMode,
            skipValidation,
            skipBackup
        });

        // ✅ FORCE MODE: Skip all safety checks
        if (forceMode) {
            console.log('🚨 FORCE MODE ACTIVE - Bypassing all safety checks');

            if (!skipBackup) {
                const backupResult = await createAutomaticMigrationBackup();
                console.log('💾 Emergency backup created:', backupResult.backupKey);
            }

            // ✅ Apply fixes without validation
            const fixResult = fixTaskValidationIssues();
            console.log('🔧 Applied fixes:', fixResult);

            // ✅ Force the migration
            const migrationResult = performSchema25Migration();

            if (migrationResult.success || migrationResult.partialSuccess) {
                Deps.showNotification('✅ Force migration completed! Some data may need manual review.', 'success', 6000);
                return {
                    success: true,
                    forced: true,
                    message: 'Force migration completed',
                    warnings: migrationResult.warnings || []
                };
            } else {
                // Even force mode failed - create minimal Schema 2.5 structure
                return createMinimalSchema25();
            }
        }

        console.log('📊 Current localStorage keys:', Object.keys(Deps.storage));

        // Step 1: Check if migration is needed
        console.log('🔍 Checking if migration is needed...');
        const migrationCheck = checkMigrationNeeded();
        console.log('📋 Migration check result:', migrationCheck);

        if (!migrationCheck.needed) {
            console.log('✅ No migration needed - user already on Schema 2.5');
            console.log('📦 Current miniCycleData exists:', !!Deps.storage.getItem("miniCycleData"));
            return { success: true, message: 'Already on latest schema' };
        }

        console.log('🚨 Migration needed. Old data found:', migrationCheck.oldDataFound);

        // Step 2: Show user notification
        console.log('📢 Showing migration notification to user...');
        Deps.showNotification('🔄 Updating your data format... This will take a moment.', 'info', 200);

        // Step 3: Create automatic backup before migration
        console.log('📥 Creating automatic backup before migration...');
        console.log('💾 Available storage before backup:', {
            used: JSON.stringify(Deps.storage).length,
            limit: '~5-10MB (browser dependent)'
        });

        const backupResult = await createAutomaticMigrationBackup();
        console.log('💾 Backup result:', backupResult);

        if (!backupResult.success) {
            console.error('❌ Backup creation failed:', backupResult.message);
            console.error('🔧 Troubleshooting: Check storage space and localStorage accessibility');
            return await handleMigrationFailure('Backup creation failed', null);
        }

        console.log('✅ Backup created successfully:', {
            backupKey: backupResult.backupKey,
            size: backupResult.size,
            sizeKB: Math.round(backupResult.size / 1024)
        });

        // Step 3.5: ✅ ENHANCED - Pre-fix data validation issues with detailed reporting
        console.log('🔧 Pre-fixing known data validation issues...');
        const fixResult = fixTaskValidationIssues();
        console.log('🔧 Data fix result:', fixResult);

        if (fixResult.success && fixResult.fixedCount > 0) {
            console.log(`✅ Successfully fixed ${fixResult.fixedCount} data issues:`);
            fixResult.details?.forEach(detail => console.log(`   - ${detail}`));
            Deps.showNotification(`🔧 Fixed ${fixResult.fixedCount} data compatibility issues`, 'info', 3000);
        } else if (!fixResult.success) {
            console.warn('⚠️ Data fixing encountered issues, but continuing with migration');
            console.warn('🔧 Fix error:', fixResult.message);
        } else {
            console.log('✅ No data fixes needed - all data is already compatible');
        }

        // Step 4: ✅ ENHANCED - Use lenient validation for auto-migration
        console.log('🔍 Performing lenient validation for auto-migration...');
        console.log('📋 Using lenient validation approach for better migration success...');

        // ✅ Use lenient validation instead of strict validation
        const legacyValidationResults = validateAllMiniCycleTasksLenient();
        console.log('📊 Lenient validation results:', legacyValidationResults);

        if (legacyValidationResults.length > 0) {
            console.error('❌ Critical data issues found even after fixes:', legacyValidationResults);
            console.error('🔧 These are fundamental problems that prevent migration:');
            legacyValidationResults.forEach((error, index) => {
                console.error(`   ${index + 1}. ${JSON.stringify(error, null, 2)}`);
            });

            // ✅ Show user-friendly message about what went wrong
            const errorSummary = legacyValidationResults.length === 1
                ? `1 critical issue: ${legacyValidationResults[0].errors?.[0] || 'Unknown error'}`
                : `${legacyValidationResults.length} critical issues found`;

            return await handleMigrationFailure(`Data validation failed: ${errorSummary}`, backupResult.backupKey);
        }

        console.log('✅ Lenient validation passed - data is ready for migration');

        // Step 5: Perform the actual migration using your existing function
        console.log('🔄 Performing Schema 2.5 migration...');
        console.log('📦 Calling performSchema25Migration()...');

        const migrationResult = performSchema25Migration();
        console.log('🔄 Migration process result:', migrationResult);

        if (!migrationResult.success) {
            console.error('❌ Migration failed:', migrationResult.errors || migrationResult);
            console.error('🔧 Troubleshooting: Check performSchema25Migration() function');
            if (migrationResult.errors) {
                migrationResult.errors.forEach((error, index) => {
                    console.error(`   Error ${index + 1}:`, error);
                });
            }
            return await handleMigrationFailure('Migration process failed', backupResult.backupKey);
        }

        console.log('✅ Migration process completed successfully');
        console.log('📋 Changes applied:', migrationResult.changes || 'No changes array provided');

        // Step 6: ✅ Simple post-migration validation
        console.log('✅ Validating migrated data...');
        const newSchemaData = Deps.storage.getItem("miniCycleData");
        console.log('📦 New schema data exists:', !!newSchemaData);
        console.log('📏 New schema data size:', newSchemaData ? newSchemaData.length : 0);

        if (!newSchemaData) {
            console.error('❌ Post-migration validation failed: No Schema 2.5 data found');
            console.error('🔧 Troubleshooting: Migration did not create miniCycleData key');
            console.error('📊 Current localStorage keys after migration:', Object.keys(Deps.storage));
            return await handleMigrationFailure('Migration validation failed - no new data found', backupResult.backupKey);
        }

        try {
            console.log('🔍 Parsing and validating new schema structure...');
            const parsed = JSON.parse(newSchemaData);
            console.log('📊 Parsed schema structure:', {
                schemaVersion: parsed.schemaVersion,
                hasMetadata: !!parsed.metadata,
                hasData: !!parsed.data,
                hasCycles: !!parsed.data?.cycles,
                cycleCount: parsed.data?.cycles ? Object.keys(parsed.data.cycles).length : 0,
                hasAppState: !!parsed.appState,
                activeCycleId: parsed.appState?.activeCycleId
            });

            if (!parsed.schemaVersion || parsed.schemaVersion !== '2.5') {
                throw new Error(`Schema version missing or incorrect: ${parsed.schemaVersion}`);
            }
            if (!parsed.data || !parsed.data.cycles) {
                throw new Error('Missing cycles data structure');
            }

            console.log('✅ Post-migration validation passed');
            console.log('🎯 Final data structure validated successfully');

        } catch (validationError) {
            console.error('❌ Post-migration validation failed:', validationError.message);
            console.error('🔧 Troubleshooting: Schema structure is invalid');
            console.error('📋 Raw data snippet:', newSchemaData.substring(0, 500) + '...');
            return await handleMigrationFailure('Migration validation failed', backupResult.backupKey);
        }

        // Step 7: Success!
        console.log('✅ Auto-migration completed successfully');
        console.log('🎉 Migration summary:', {
            backupKey: backupResult.backupKey,
            migrationChanges: migrationResult.changes?.length || 0,
            finalDataSize: newSchemaData.length,
            dataFixesApplied: fixResult.fixedCount || 0,
            timestamp: new Date().toISOString()
        });

        // ✅ Clean up old separate localStorage keys
        console.log('🧹 Cleaning up legacy localStorage keys...');
        Deps.storage.removeItem("overdueTaskStates"); // Clean up old separate key
        console.log('✅ Removed old overdueTaskStates key');

        // ✅ Enhanced success notification with fix details
        const successMessage = fixResult.fixedCount > 0
            ? `✅ Data updated successfully! Fixed ${fixResult.fixedCount} compatibility issues.`
            : '✅ Data format updated successfully!';
        Deps.showNotification(successMessage, 'success', 4000);

        // Step 8: Store migration completion info
        const legacyData = Deps.storage.getItem('miniCycleStorage') || '{}';
        const migrationInfo = {
            completed: Deps.now(),
            backupKey: backupResult.backupKey,
            version: '1.386',
            autoMigrated: true,
            dataFixesApplied: fixResult.fixedCount || 0,
            migrationSummary: {
                originalDataSize: legacyData.length,
                newDataSize: newSchemaData.length,
                changesApplied: migrationResult.changes?.length || 0,
                fixesApplied: fixResult.details || []
            }
        };

        console.log('💾 Storing migration completion info:', migrationInfo);
        Deps.storage.setItem('miniCycleMigrationInfo', JSON.stringify(migrationInfo));

        return {
            success: true,
            message: 'Auto-migration completed successfully',
            backupKey: backupResult.backupKey,
            fixesApplied: fixResult.fixedCount || 0
        };

    } catch (error) {
        if (forceMode) {
            console.warn('⚠️ Force migration failed, creating minimal schema');
            return createMinimalSchema25();
        }
        return await handleMigrationFailure(`Unexpected error: ${error.message}`, null);
    }
}

/**
 * Create minimal Schema 2.5 structure as last resort
 * INTERNAL - Called when all migration attempts fail
 *
 * @returns {Object} Creation result
 *
 * @private
 */
function createMinimalSchema25() {
    assertInjected('storage', Deps.storage);
    assertInjected('showNotification', Deps.showNotification);
    assertInjected('now', Deps.now);

    console.log('🆘 Creating minimal Schema 2.5 structure as last resort');

    const minimalData = {
        schemaVersion: "2.5",
        metadata: {
            createdAt: Deps.now(),
            lastModified: Deps.now(),
            migratedFrom: "force_migration",
            migrationDate: Deps.now(),
            totalCyclesCreated: 1,
            totalTasksCompleted: 0,
            schemaVersion: "2.5"
        },
        settings: {
            theme: null,
            darkMode: false,
            alwaysShowRecurring: false,
            autoSave: true,
            defaultRecurringSettings: { time: null },
            unlockedThemes: [],
            unlockedFeatures: [],
            notificationPosition: { x: 0, y: 0 },
            notificationPositionModified: false
        },
        data: {
            cycles: {
                "Default Cycle": {
                    id: "default_cycle",
                    title: "Default Cycle",
                    tasks: [],
                    autoReset: true,
                    deleteCheckedTasks: false,
                    cycleCount: 0,
                    createdAt: Deps.now(),
                    recurringTemplates: {}
                }
            }
        },
        appState: {
            activeCycleId: "Default Cycle"
        },
        userProgress: {
            rewardMilestones: []
        },
        customReminders: {
            enabled: false,
            indefinite: false,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 30,
            frequencyUnit: "minutes"
        }
    };

    Deps.storage.setItem("miniCycleData", JSON.stringify(minimalData));

    Deps.showNotification('⚠️ Created fresh miniCycle. Previous data may have been incompatible.', 'warning', 8000);

    return {
        success: true,
        forced: true,
        minimal: true,
        message: 'Created minimal Schema 2.5 structure'
    };
}

// ==========================================
// 🛡️ FAILURE HANDLING & RECOVERY
// ==========================================

/**
 * Handle migration failure with legacy data fallback
 * INTERNAL - Attempts to restore backup and enable legacy mode
 *
 * @param {string} reason - Failure reason
 * @param {string} backupKey - Backup key to restore from
 * @returns {Promise<Object>} Failure handling result
 *
 * @private
 */
async function handleMigrationFailure(reason, backupKey) {
    assertInjected('storage', Deps.storage);
    assertInjected('sessionStorage', Deps.sessionStorage);
    assertInjected('showNotification', Deps.showNotification);

    try {
        console.log('🔄 Handling migration failure, attempting to maintain legacy data access…');
        console.log('❌ Failure reason:', reason);
        console.log('📦 Backup key available:', backupKey);

        // Step 1: Try to restore from backup if available
        if (backupKey) {
            console.log('📥 Attempting to restore from backup:', backupKey);
            console.log('🔍 Checking if backup exists in localStorage...');
            const backupExists = !!Deps.storage.getItem(backupKey);
            console.log('💾 Backup exists:', backupExists);

            try {
                await restoreFromAutomaticBackup(backupKey);
                console.log('✅ Successfully restored from backup');
                console.log('📊 Post-restore localStorage keys:', Object.keys(Deps.storage));
            } catch (restoreError) {
                console.error('❌ Failed to restore from backup:', restoreError);
                console.error('🔧 Restore error details:', restoreError.message);
                console.error('📋 Continuing with fallback strategy...');
                // Continue with fallback - don't fail here
            }
        } else {
            console.log('⚠️ No backup key provided, skipping restore attempt');
        }

        // Step 2: Ensure legacy data is accessible
        console.log('🔍 Checking legacy data accessibility...');
        const legacyDataExists = ensureLegacyDataAccess();
        console.log('📦 Legacy data accessible:', legacyDataExists);

        if (legacyDataExists) {
            console.log('✅ Legacy data found and accessible');

            // Step 3: Set session flag to use legacy mode until reload
            console.log('🚩 Setting legacy fallback mode flags...');
            Deps.sessionStorage.setItem('miniCycleLegacyModeActive', 'true');
            Deps.sessionStorage.setItem('miniCycleMigrationFailureReason', reason);

            console.log('📊 Session storage flags set:', {
                legacyMode: Deps.sessionStorage.getItem('miniCycleLegacyModeActive'),
                failureReason: Deps.sessionStorage.getItem('miniCycleMigrationFailureReason')
            });

            // Step 4: Show user-friendly notification
            Deps.showNotification(
                '⚠️ Unable to update data format. Using existing data until next app reload. Your data is safe!',
                'warning',
                8000
            );

            console.log('✅ Fallback to legacy data successful');

            return {
                success: false,
                fallbackActive: true,
                message: 'Migration failed but legacy data access maintained',
                reason: reason
            };
        } else {
            // Step 5: Last resort - critical error
            console.error('❌ No legacy data available for fallback');
            console.error('🚨 CRITICAL: Complete data loss scenario');
            console.error('📊 Final localStorage state:', Object.keys(Deps.storage));
            console.error('💾 Available data sources:', {
                miniCycleStorage: !!Deps.storage.getItem('miniCycleStorage'),
                miniCycleData: !!Deps.storage.getItem('miniCycleData'),
                lastUsedMiniCycle: !!Deps.storage.getItem('lastUsedMiniCycle'),
                anyBackups: Object.keys(Deps.storage).filter(key => key.includes('backup')),
            });

            showCriticalError('Unable to access your data. Please contact support or try refreshing the page.');

            return {
                success: false,
                fallbackActive: false,
                message: 'Migration failed and no legacy data available',
                reason: reason
            };
        }

    } catch (error) {
        console.error('❌ Failed to handle migration failure:', error);
        console.error('🔧 Handler error stack:', error.stack);
        console.error('🚨 CRITICAL: Migration failure handler itself failed');
        showCriticalError('Critical error occurred. Please refresh the page.');

        return {
            success: false,
            fallbackActive: false,
            message: 'Failed to handle migration failure',
            reason: `${reason} + ${error.message}`
        };
    }
}

/**
 * Ensure legacy data is accessible
 * INTERNAL - Validates legacy data exists and is parseable
 *
 * @returns {boolean} Whether legacy data is accessible
 *
 * @private
 */
function ensureLegacyDataAccess() {
    assertInjected('storage', Deps.storage);

    try {
        console.log('🔍 Checking legacy data access...');

        // Check if legacy data exists
        const legacyStorage = Deps.storage.getItem('miniCycleStorage');
        console.log('📦 Legacy storage exists:', !!legacyStorage);
        console.log('📏 Legacy storage size:', legacyStorage ? legacyStorage.length : 0);

        if (!legacyStorage) {
            console.error('❌ No legacy data found in localStorage');
            console.error('📋 Available localStorage keys:', Object.keys(Deps.storage));
            return false;
        }

        // Try to parse the legacy data to ensure it's valid
        try {
            console.log('🔍 Attempting to parse legacy data...');
            const parsedData = JSON.parse(legacyStorage);
            console.log('📊 Parsed legacy data structure:', {
                type: typeof parsedData,
                isObject: typeof parsedData === 'object',
                isNull: parsedData === null,
                keys: typeof parsedData === 'object' && parsedData !== null ? Object.keys(parsedData) : 'N/A',
                cycleCount: typeof parsedData === 'object' && parsedData !== null ? Object.keys(parsedData).length : 0
            });

            if (typeof parsedData === 'object' && parsedData !== null) {
                console.log('✅ Legacy data is accessible and valid');

                // Additional validation
                const cycleKeys = Object.keys(parsedData);
                console.log('📋 Available legacy cycles:', cycleKeys);

                if (cycleKeys.length > 0) {
                    const firstCycle = parsedData[cycleKeys[0]];
                    console.log('📊 First cycle structure:', {
                        hasTasks: !!firstCycle.tasks,
                        taskCount: Array.isArray(firstCycle.tasks) ? firstCycle.tasks.length : 'Not array',
                        hasTitle: !!firstCycle.title,
                        hasAutoReset: 'autoReset' in firstCycle
                    });
                }

                return true;
            } else {
                console.error('❌ Legacy data is not a valid object');
                console.error('📋 Actual data type:', typeof parsedData);
                console.error('📋 Data content preview:', JSON.stringify(parsedData).substring(0, 200));
                return false;
            }
        } catch (parseError) {
            console.error('❌ Legacy data is corrupted:', parseError);
            console.error('🔧 Parse error details:', parseError.message);
            console.error('📋 Raw data preview:', legacyStorage.substring(0, 200) + '...');
            return false;
        }

    } catch (error) {
        console.error('❌ Error checking legacy data access:', error);
        console.error('🔧 Access check error:', error.message);
        return false;
    }
}

/**
 * Check if app is running in legacy fallback mode
 * INTERNAL - Checks session storage for fallback flag
 *
 * @returns {boolean} Whether fallback mode is active
 *
 * @private
 */
function isLegacyFallbackModeActive() {
    assertInjected('sessionStorage', Deps.sessionStorage);

    const isActive = Deps.sessionStorage.getItem('miniCycleLegacyModeActive') === 'true';
    console.log('🚩 Legacy fallback mode check:', {
        isActive: isActive,
        sessionFlag: Deps.sessionStorage.getItem('miniCycleLegacyModeActive'),
        failureReason: Deps.sessionStorage.getItem('miniCycleMigrationFailureReason')
    });
    return isActive;
}

// ==========================================
// 💾 BACKUP & RESTORE SYSTEM
// ==========================================

/**
 * Create automatic migration backup
 * INTERNAL - Creates backup before migration
 *
 * @returns {Promise<Object>} Backup result
 *
 * @private
 */
async function createAutomaticMigrationBackup() {
    assertInjected('storage', Deps.storage);
    assertInjected('now', Deps.now);

    try {
        console.log('📥 Starting automatic backup creation...');
        const timestamp = Deps.now();
        const backupKey = `auto_migration_backup_${timestamp}`;
        console.log('🏷️ Generated backup key:', backupKey);

        // Check if we have data to backup
        console.log('🔍 Checking for legacy data to backup...');
        const legacyData = Deps.storage.getItem('miniCycleStorage');
        console.log('📦 Legacy data found:', !!legacyData);
        console.log('📏 Legacy data size:', legacyData ? legacyData.length : 0);

        if (!legacyData) {
            console.error('❌ No legacy data found to backup');
            console.error('📋 Available localStorage keys:', Object.keys(Deps.storage));
            throw new Error('No legacy data found to backup');
        }

        // Gather all data to backup
        console.log('📋 Gathering additional data for backup...');
        const remindersData = Deps.storage.getItem('miniCycleReminders');
        const lastUsed = Deps.storage.getItem('lastUsedMiniCycle');
        const milestones = Deps.storage.getItem('milestoneUnlocks');
        console.log('🔔 Reminders data:', !!remindersData);
        console.log('📌 Last used cycle:', !!lastUsed);
        console.log('🏆 Milestones:', !!milestones);

        const settingsData = {
            threeDots: Deps.storage.getItem('miniCycleThreeDots'),
            darkMode: Deps.storage.getItem('darkModeEnabled'),
            moveArrows: Deps.storage.getItem('miniCycleMoveArrows'),
            alwaysShowRecurring: Deps.storage.getItem('miniCycleAlwaysShowRecurring'),
            defaultRecurring: Deps.storage.getItem('miniCycleDefaultRecurring'),
            theme: Deps.storage.getItem('currentTheme'),
            onboarding: Deps.storage.getItem('miniCycleOnboarding'),
            notificationPosition: Deps.storage.getItem('miniCycleNotificationPosition')
        };

        console.log('⚙️ Settings data collected:', Object.keys(settingsData).filter(key => settingsData[key] !== null));

        const backupData = {
            version: 'legacy',
            created: timestamp,
            type: 'auto_migration_backup',
            data: {
                miniCycleStorage: legacyData,
                lastUsedMiniCycle: lastUsed,
                miniCycleReminders: remindersData,
                milestoneUnlocks: milestones,
                settings: settingsData
            },
            metadata: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                migrationReason: 'Automatic migration to Schema 2.5'
            }
        };

        const backupSize = JSON.stringify(backupData).length;
        console.log('📊 Backup data prepared:', {
            totalSize: backupSize,
            totalSizeKB: Math.round(backupSize / 1024),
            legacyDataSize: legacyData.length,
            remindersSize: remindersData ? remindersData.length : 0,
            lastUsedSize: lastUsed ? lastUsed.length : 0,
            milestonesSize: milestones ? milestones.length : 0,
            settingsCount: Object.keys(settingsData).filter(key => settingsData[key] !== null).length
        });

        try {
            console.log('💾 Attempting to store backup in localStorage...');
            Deps.storage.setItem(backupKey, JSON.stringify(backupData));
            console.log('✅ Backup stored successfully');
        } catch (storageError) {
            console.error('❌ Storage error during backup:', storageError);
            console.error('🔧 Storage error details:', storageError.message);
            console.error('📊 Storage usage info:', {
                backupSize: backupSize,
                estimatedTotalStorage: JSON.stringify(Deps.storage).length,
                availableKeys: Object.keys(Deps.storage).length
            });
            throw new Error('Insufficient storage space for backup');
        }

        // Add to backup index for management
        try {
            console.log('📋 Updating backup index...');
            const backupIndex = JSON.parse(Deps.storage.getItem('miniCycleBackupIndex') || '[]');
            console.log('📊 Current backup index size:', backupIndex.length);

            backupIndex.push({
                key: backupKey,
                created: timestamp,
                type: 'auto_migration',
                size: JSON.stringify(backupData).length
            });

            // Keep only last 5 automatic backups to prevent storage bloat
            const autoBackups = backupIndex.filter(b => b.type === 'auto_migration');
            console.log('🗂️ Auto backup count:', autoBackups.length);

            if (autoBackups.length > 5) {
                console.log('🧹 Cleaning up old backups...');
                const oldestAutoBackup = autoBackups.sort((a, b) => a.created - b.created)[0];
                console.log('🗑️ Removing oldest backup:', oldestAutoBackup.key);

                try {
                    Deps.storage.removeItem(oldestAutoBackup.key);
                    const index = backupIndex.findIndex(b => b.key === oldestAutoBackup.key);
                    backupIndex.splice(index, 1);
                    console.log('✅ Old backup cleaned up successfully');
                } catch (cleanupError) {
                    console.warn('⚠️ Failed to cleanup old backup:', cleanupError);
                    console.warn('🔧 Cleanup error details:', cleanupError.message);
                    // Continue anyway - this isn't critical
                }
            }

            Deps.storage.setItem('miniCycleBackupIndex', JSON.stringify(backupIndex));
            console.log('✅ Backup index updated successfully');

        } catch (indexError) {
            console.warn('⚠️ Failed to update backup index:', indexError);
            console.warn('🔧 Index error details:', indexError.message);
            // Continue anyway - backup was created successfully
        }

        console.log('✅ Automatic backup created successfully:', backupKey);
        return {
            success: true,
            backupKey: backupKey,
            size: JSON.stringify(backupData).length
        };

    } catch (error) {
        console.error('❌ Failed to create automatic backup:', error);
        console.error('🔧 Backup creation error:', error.message);
        console.error('📊 System state at backup failure:', {
            localStorage: Object.keys(Deps.storage),
            storageEstimate: JSON.stringify(Deps.storage).length
        });
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Restore from automatic backup
 * INTERNAL - Restores data from a backup key
 *
 * @param {string} backupKey - Backup key to restore from
 * @returns {Promise<Object>} Restore result
 *
 * @private
 */
async function restoreFromAutomaticBackup(backupKey) {
    assertInjected('storage', Deps.storage);

    try {
        console.log('🔄 Restoring from automatic backup:', backupKey);

        console.log('🔍 Checking if backup exists...');
        const backupData = Deps.storage.getItem(backupKey);
        console.log('📦 Backup data found:', !!backupData);
        console.log('📏 Backup data size:', backupData ? backupData.length : 0);

        if (!backupData) {
            console.error('❌ Backup not found in localStorage');
            console.error('📋 Available backup keys:', Object.keys(Deps.storage).filter(key => key.includes('backup')));
            throw new Error('Backup not found');
        }

        let backup;
        try {
            console.log('🔍 Parsing backup data...');
            backup = JSON.parse(backupData);
            console.log('📊 Backup structure:', {
                version: backup.version,
                type: backup.type,
                created: new Date(backup.created).toISOString(),
                hasData: !!backup.data,
                hasMetadata: !!backup.metadata
            });
        } catch (parseError) {
            console.error('❌ Backup data is corrupted:', parseError);
            console.error('🔧 Parse error details:', parseError.message);
            console.error('📋 Raw backup preview:', backupData.substring(0, 200) + '...');
            throw new Error('Backup data is corrupted');
        }

        // Restore legacy data
        if (backup.data.miniCycleStorage) {
            console.log('📦 Restoring miniCycleStorage...');
            Deps.storage.setItem('miniCycleStorage', backup.data.miniCycleStorage);
            console.log('✅ miniCycleStorage restored');
        } else {
            console.warn('⚠️ No miniCycleStorage found in backup');
        }

        // Restore last used cycle
        if (backup.data.lastUsedMiniCycle) {
            console.log('📌 Restoring lastUsedMiniCycle...');
            Deps.storage.setItem('lastUsedMiniCycle', backup.data.lastUsedMiniCycle);
            console.log('✅ lastUsedMiniCycle restored');
        }

        if (backup.data.miniCycleReminders) {
            console.log('🔔 Restoring miniCycleReminders...');
            Deps.storage.setItem('miniCycleReminders', backup.data.miniCycleReminders);
            console.log('✅ miniCycleReminders restored');
        } else {
            console.warn('⚠️ No miniCycleReminders found in backup');
        }

        // Restore milestones
        if (backup.data.milestoneUnlocks) {
            console.log('🏆 Restoring milestoneUnlocks...');
            Deps.storage.setItem('milestoneUnlocks', backup.data.milestoneUnlocks);
            console.log('✅ milestoneUnlocks restored');
        }

        // Restore settings
        if (backup.data.settings) {
            console.log('⚙️ Restoring settings...');
            const settings = backup.data.settings;
            const settingsRestored = [];

            Object.keys(settings).forEach(key => {
                if (settings[key] !== null && settings[key] !== undefined) {
                    try {
                        // Use correct storage keys
                        let storageKey;
                        switch(key) {
                            case 'darkMode':
                                storageKey = 'darkModeEnabled';
                                break;
                            case 'theme':
                                storageKey = 'currentTheme';
                                break;
                            default:
                                storageKey = `miniCycle${key.charAt(0).toUpperCase() + key.slice(1)}`;
                        }

                        Deps.storage.setItem(storageKey, settings[key]);
                        settingsRestored.push(key);
                        console.log(`   ✅ Restored setting: ${key} -> ${storageKey}`);
                    } catch (settingError) {
                        console.warn(`⚠️ Failed to restore setting ${key}:`, settingError);
                        // Continue with other settings
                    }
                }
            });

            console.log('✅ Settings restoration complete:', settingsRestored);
        } else {
            console.warn('⚠️ No settings found in backup');
        }

        // Remove any Schema 2.5 data that might have been created
        try {
            console.log('🧹 Cleaning up any Schema 2.5 data...');
            const schema25Existed = !!Deps.storage.getItem('miniCycleData');
            Deps.storage.removeItem('miniCycleData');
            console.log('🧹 Schema 2.5 data cleanup:', schema25Existed ? 'removed' : 'none found');
        } catch (removeError) {
            console.warn('⚠️ Failed to remove Schema 2.5 data:', removeError);
            // Continue anyway
        }

        console.log('✅ Data restored from automatic backup successfully');
        console.log('📊 Post-restore localStorage keys:', Object.keys(Deps.storage));

        return { success: true };

    } catch (error) {
        console.error('❌ Failed to restore from automatic backup:', error);
        console.error('🔧 Restore error stack:', error.stack);
        console.error('📊 System state at restore failure:', {
            backupKey: backupKey,
            backupExists: !!Deps.storage.getItem(backupKey),
            currentKeys: Object.keys(Deps.storage)
        });
        throw error;
    }
}

/**
 * Show critical error to user with UI overlay
 * INTERNAL - Creates error modal for critical failures
 *
 * @param {string} message - Error message to display
 *
 * @private
 */
function showCriticalError(message) {
    assertInjected('document', Deps.document);
    assertInjected('now', Deps.now);

    console.log('🚨 Showing critical error to user:', message);
    console.log('📊 System state at critical error:', {
        localStorage: Deps.storage ? Object.keys(Deps.storage) : 'N/A',
        sessionStorage: Deps.sessionStorage ? Object.keys(Deps.sessionStorage) : 'N/A',
        url: window.location.href,
        timestamp: new Date(Deps.now()).toISOString()
    });

    const errorContainer = Deps.document.createElement('div');
    errorContainer.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #ff4444; color: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; max-width: 400px; text-align: center; font-family: Inter, sans-serif; line-height: 1.5;`;

    errorContainer.innerHTML = `
        <h3 style="margin-top: 0;">⚠️ App Error</h3>
        <p style="margin-bottom: 20px;">${message}</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button onclick="location.reload()" style="
                background: white;
                color: #ff4444;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
            ">Reload App</button>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: transparent;
                color: white;
                border: 1px solid white;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
            ">Dismiss</button>
        </div>
    `;

    Deps.document.body.appendChild(errorContainer);

    console.log('📢 Critical error dialog displayed to user');

    // Auto-remove after 15 seconds
    setTimeout(() => {
        if (errorContainer.parentElement) {
            errorContainer.remove();
            console.log('⏰ Critical error dialog auto-removed after timeout');
        }
    }, 15000);
}

// ==========================================
// 🚀 APP INITIALIZATION WITH MIGRATION
// ==========================================

/**
 * Initialize app with auto-migration check and fallback support
 * This is the main entry point for migration system
 *
 * @param {Object} options - Initialization options
 * @param {boolean} options.forceMode - Force migration bypassing safety checks
 * @returns {void} Initializes app or shows error
 *
 * @public
 */
export function initializeAppWithAutoMigration(options = {}) {
    assertInjected('storage', Deps.storage);
    assertInjected('sessionStorage', Deps.sessionStorage);
    assertInjected('showNotification', Deps.showNotification);
    assertInjected('initialSetup', Deps.initialSetup);
    assertInjected('now', Deps.now);

    console.log('🚀 Initializing app with auto-migration check…');
    console.log('📊 Initial system state:', {
        localStorage: Object.keys(Deps.storage),
        sessionStorage: Object.keys(Deps.sessionStorage),
        userAgent: navigator.userAgent,
        timestamp: new Date(Deps.now()).toISOString()
    });

    // Check if we're already in legacy fallback mode
    console.log('🚩 Checking for existing legacy fallback mode...');
    if (isLegacyFallbackModeActive()) {
        console.log('⚠️ App is running in legacy fallback mode');
        const failureReason = Deps.sessionStorage.getItem('miniCycleMigrationFailureReason') || 'Unknown reason';
        console.log('❌ Previous failure reason:', failureReason);

        Deps.showNotification(
            `⚠️ Running in compatibility mode due to: ${failureReason}. Restart app to retry migration.`,
            'warning',
            5000
        );

        // Load app with legacy data
        console.log('📱 Loading app in legacy fallback mode...');
        Deps.initialSetup();
        return;
    }

    console.log('✅ No existing fallback mode detected');

    // Run migration check
    console.log('🔍 Running migration check...');
    const migrationCheck = checkMigrationNeeded();
    console.log('📋 Migration check complete:', migrationCheck);

    if (migrationCheck.needed) {
        console.log('📋 Migration needed - starting auto-migration process...');
        console.log('🔄 Auto-migration will be performed asynchronously...');

        // Pass through any options (like forceMode)
        performAutoMigration(options).then(result => {
            console.log('🏁 Auto-migration promise resolved:', result);

            if (result.success) {
                console.log('✅ Auto-migration successful, loading app...');
                console.log('📊 Migration success details:', {
                    backupKey: result.backupKey,
                    message: result.message,
                    forced: result.forced || false,
                    minimal: result.minimal || false
                });
                Deps.initialSetup();
            } else if (result.fallbackActive) {
                console.log('⚠️ Migration failed but fallback active, loading app with legacy data...');
                console.log('📊 Fallback details:', {
                    reason: result.reason,
                    message: result.message
                });
                Deps.initialSetup();
            } else {
                console.error('❌ Auto-migration failed completely:', result.message);
                console.error('🚨 Critical failure details:', result);
                // Critical error is already shown by handleMigrationFailure
            }
        }).catch(error => {
            console.error('❌ Unexpected error during auto-migration:', error);
            console.error('🔧 Promise rejection stack:', error.stack);
            console.error('📊 System state at promise failure:', {
                localStorage: Object.keys(Deps.storage),
                sessionStorage: Object.keys(Deps.sessionStorage)
            });
            showCriticalError('An unexpected error occurred. Please refresh the page.');
        });
    } else {
        console.log('✅ No migration needed, loading app normally...');
        console.log('📦 Current schema status:', migrationCheck.currentVersion);
        Deps.initialSetup();
    }
}

/**
 * Force app migration bypassing all safety checks
 * USE WITH CAUTION - Only for recovery scenarios
 *
 * @returns {void} Triggers force migration
 *
 * @public
 */
export function forceAppMigration() {
    console.log('🚨 Forcing app migration...');
    return initializeAppWithAutoMigration({
        forceMode: true,
        skipValidation: true
    });
}

// ==========================================
// 🎯 MODULE LOADED
// ==========================================

console.log('🔄 Migration Manager module loaded');
