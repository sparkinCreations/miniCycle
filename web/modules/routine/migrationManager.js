/**
 * 🔄 miniCycle Migration Manager (DI-Pure)
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
 */

import { createDIModule, optional } from '../core/diBase.js';
import { Z_INDEX, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('MigrationManager', {
    storage: optional(null),
    sessionStorage: optional(null),
    showNotification: optional(null),
    initialSetup: optional(null),
    onInitialSetupComplete: optional(null),
    now: optional(null),
    document: optional(null)
});

// Late-binding deps via Proxy (standard: _deps with underscore prefix)
/** @type {{storage: Storage|null, sessionStorage: Storage|null, showNotification: Function|null, initialSetup: Function|null, onInitialSetupComplete: Function|null, now: Function|null, document: Document|null}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

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
    di.setDependencies(overrides);
    const resolved = di.resolve();
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
    assertInjected('storage', _deps.storage);
    assertInjected('now', _deps.now);

    const initialData = {
        schemaVersion: "2.5",
        metadata: {
            createdAt: _deps.now(),
            lastModified: _deps.now(),
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
            // Match isTouchDevice() logic from deviceDetection.js
            showThreeDots: !(window.matchMedia?.('(pointer: fine)')?.matches) && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0),
            onboardingCompleted: false,
            guidedTourStep: null,
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
            reducedMotion: false,
            highContrast: false,
            fontSize: '16'
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

    _deps.storage.setItem("miniCycleData", JSON.stringify(initialData));
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
        guidedTourStep: null,
        defaultRecurringSettings: {
            frequency: null,
            indefinitely: true,
            time: null
        },
        unlockedThemes: [],
        unlockedFeatures: [],
        notificationPosition: { x: 0, y: 0 },
        notificationPositionModified: false,
        reducedMotion: false,
        highContrast: false,
        fontSize: '16'
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
    assertInjected('storage', _deps.storage);
    assertInjected('document', _deps.document);

    const currentData = _deps.storage.getItem("miniCycleData");
    if (currentData) {
        const parsed = JSON.parse(currentData);
        if (parsed.schemaVersion === "2.5") {
            return { needed: false, currentVersion: "2.5" };
        }
    }

    // Check for old format data
    const oldCycles = _deps.storage.getItem("miniCycleStorage");
    const lastUsed = _deps.storage.getItem("lastUsedMiniCycle");
    const reminders = _deps.storage.getItem("miniCycleReminders");

    const hasOldData = !!(oldCycles || lastUsed || reminders);

    return {
        needed: hasOldData,
        currentVersion: currentData ? "unknown" : "legacy",
        oldDataFound: {
            cycles: !!oldCycles,
            lastUsed: !!lastUsed,
            reminders: !!reminders,
            milestones: !!_deps.storage.getItem("milestoneUnlocks"),
            darkMode: _deps.document.body.classList.contains('dark-mode')
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
    assertInjected('storage', _deps.storage);
    assertInjected('now', _deps.now);

    const results = {
        success: false,
        errors: [],
        warnings: [],
        changes: [],
        dataPreview: null
    };

    try {
        // 1. Gather existing data
        const oldCycles = JSON.parse(_deps.storage.getItem("miniCycleStorage") || "{}");
        const lastUsed = _deps.storage.getItem("lastUsedMiniCycle");
        const reminders = JSON.parse(_deps.storage.getItem("miniCycleReminders") || "{}");
        const milestones = JSON.parse(_deps.storage.getItem("milestoneUnlocks") || "{}");
        const moveArrows = _deps.storage.getItem("miniCycleMoveArrows") === "true";
        const threeDots = _deps.storage.getItem("miniCycleThreeDots") === "true";
        const alwaysRecurring = JSON.parse(_deps.storage.getItem("miniCycleAlwaysShowRecurring")) || false;
        const darkModeEnabled = _deps.storage.getItem("darkModeEnabled") === "true";
        const currentTheme = _deps.storage.getItem("currentTheme") || null;
        const notifPosition = JSON.parse(_deps.storage.getItem("miniCycleNotificationPosition") || "{}");

        // 2. Create new schema structure
        const newData = JSON.parse(JSON.stringify(SCHEMA_2_5_TARGET));

        // 3. Populate metadata
        newData.metadata.createdAt = _deps.now();
        newData.metadata.lastModified = _deps.now();
        newData.metadata.migratedFrom = "legacy";
        newData.metadata.migrationDate = _deps.now();
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
        // Mark first-cycle celebration as already shown for migrated users
        // (they are not new users — don't show the first-cycle overlay)
        if (totalCompleted > 0) {
            newData.userProgress.firstCycleCelebrated = true;
        }
        if (milestones.darkOcean) newData.userProgress.rewardMilestones.push("dark-ocean-5");
        if (milestones.goldenGlow) newData.userProgress.rewardMilestones.push("golden-glow-50");

        results.changes.push(`✅ Found ${Object.keys(oldCycles).length} cycles to migrate`);
        results.changes.push(`✅ Active cycle: ${lastUsed || "none"}`);
        results.changes.push(`✅ Total completed cycles: ${totalCompleted}`);
        results.changes.push(`✅ Reminders enabled: ${reminders.enabled ? "yes" : "no"}`);
        results.changes.push(`✅ Themes unlocked: ${newData.settings.unlockedThemes.length}`);

        if (!dryRun) {
            // Backup old data BEFORE writing new data (prevents data loss if migration fails mid-write)
            const backupKey = `migration_backup_${_deps.now()}`;
            const oldData = {
                miniCycleStorage: oldCycles,
                lastUsedMiniCycle: lastUsed,
                miniCycleReminders: reminders,
                milestoneUnlocks: milestones,
                darkModeEnabled: darkModeEnabled,
                currentTheme: currentTheme
            };
            _deps.storage.setItem(backupKey, JSON.stringify(oldData));
            results.changes.push(`💾 Old data backed up to ${backupKey}`);

            // Now perform migration
            _deps.storage.setItem("miniCycleData", JSON.stringify(newData));
            results.changes.push("🚀 Migration completed - data saved to miniCycleData");
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
    assertInjected('storage', _deps.storage);
    assertInjected('now', _deps.now);

    // Create backup first
    const backupKey = `pre_migration_backup_${_deps.now()}`;
    const currentData = {};

    // Backup all current localStorage
    ["miniCycleStorage", "lastUsedMiniCycle", "miniCycleReminders",
     "milestoneUnlocks", "darkModeEnabled", "currentTheme",
     "miniCycleNotificationPosition", "miniCycleAlwaysShowRecurring"].forEach(key => {
        const value = _deps.storage.getItem(key);
        if (value) currentData[key] = value;
    });

    _deps.storage.setItem(backupKey, JSON.stringify(currentData));

    // Perform actual migration
    const results = simulateMigrationToSchema25(false);

    if (results.success) {
        // Clean up old keys (optional - you might want to keep them temporarily)
        // Object.keys(currentData).forEach(key => _deps.storage.removeItem(key));
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
    assertInjected('storage', _deps.storage);

    const storage = JSON.parse(_deps.storage.getItem("miniCycleStorage")) || {};
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
    assertInjected('storage', _deps.storage);

    try {
        const legacyData = _deps.storage.getItem('miniCycleStorage');
        if (!legacyData) {
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
                    }

                    if (task.recurring.recurIndefinitely === undefined) {
                        task.recurring.recurIndefinitely = true;
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added recurIndefinitely`);
                    }

                    if (task.recurring.useSpecificTime === undefined) {
                        task.recurring.useSpecificTime = false;
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added useSpecificTime`);
                    }

                    // ✅ Set frequency if missing
                    if (!task.recurring.frequency) {
                        task.recurring.frequency = 'daily'; // Most common default
                        fixedTasks++;
                        fixedDetails.push(`${task.taskText}: Added default frequency`);
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
                    }
                }
            });
        });

        if (fixedTasks > 0) {
            _deps.storage.setItem('miniCycleStorage', JSON.stringify(cycles));
            // Details available in fixedDetails array if needed for debugging

            return {
                success: true,
                fixedCount: fixedTasks,
                details: fixedDetails,
                message: `Fixed ${fixedTasks} validation issues`
            };
        } else {
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
 * INTERNAL - Use initAppWithAutoMigration() instead
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
    assertInjected('storage', _deps.storage);
    assertInjected('showNotification', _deps.showNotification);
    assertInjected('now', _deps.now);

    const {
        forceMode = false,
        skipValidation = false,
        skipBackup = false
    } = options;

    try {

        // ✅ FORCE MODE: Skip all safety checks
        if (forceMode) {

            if (!skipBackup) {
                const backupResult = await createAutomaticMigrationBackup();
            }

            // ✅ Apply fixes without validation
            const fixResult = fixTaskValidationIssues();

            // ✅ Force the migration
            const migrationResult = performSchema25Migration();

            if (migrationResult.success || migrationResult.partialSuccess) {
                _deps.showNotification('✅ ' + getLabel('notify.forceMigrationComplete'), 'success', UI_TIMEOUTS.NOTIFICATION_EXTRA_LONG);
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

        // Step 1: Check if migration is needed
        const migrationCheck = checkMigrationNeeded();

        if (!migrationCheck.needed) {
            return { success: true, message: 'Already on latest schema' };
        }

        // Step 2: Show user notification
        _deps.showNotification('🔄 ' + getLabel('notify.dataFormatUpdating'), 'info', 200);

        // Step 3: Create automatic backup before migration

        const backupResult = await createAutomaticMigrationBackup();

        if (!backupResult.success) {
            console.error('❌ Backup creation failed:', backupResult.message);
            console.error('🔧 Troubleshooting: Check storage space and localStorage accessibility');
            return await handleMigrationFailure('Backup creation failed', null);
        }

        // Step 3.5: ✅ ENHANCED - Pre-fix data validation issues with detailed reporting
        const fixResult = fixTaskValidationIssues();

        if (fixResult.success && fixResult.fixedCount > 0) {
            // Details available in fixResult.details if needed for debugging
            _deps.showNotification(`🔧 ${getLabel('notify.dataIssuesFixed', { vars: { count: fixResult.fixedCount } })}`, 'info', UI_TIMEOUTS.NOTIFICATION_LONG);
        } else if (!fixResult.success) {
            console.warn('⚠️ Data fixing encountered issues, but continuing with migration');
            console.warn('🔧 Fix error:', fixResult.message);
        } else {
        }

        // Step 4: ✅ ENHANCED - Use lenient validation for auto-migration

        // ✅ Use lenient validation instead of strict validation
        const legacyValidationResults = validateAllMiniCycleTasksLenient();

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

        // Step 5: Perform the actual migration using your existing function

        const migrationResult = performSchema25Migration();

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

        // Step 6: ✅ Simple post-migration validation
        const newSchemaData = _deps.storage.getItem("miniCycleData");

        if (!newSchemaData) {
            console.error('❌ Post-migration validation failed: No Schema 2.5 data found');
            console.error('🔧 Troubleshooting: Migration did not create miniCycleData key');
            console.error('📊 Current localStorage keys after migration:', Object.keys(_deps.storage));
            return await handleMigrationFailure('Migration validation failed - no new data found', backupResult.backupKey);
        }

        try {
            const parsed = JSON.parse(newSchemaData);

            if (!parsed.schemaVersion || parsed.schemaVersion !== '2.5') {
                throw new Error(`Schema version missing or incorrect: ${parsed.schemaVersion}`);
            }
            if (!parsed.data || !parsed.data.cycles) {
                throw new Error('Missing cycles data structure');
            }

        } catch (validationError) {
            console.error('❌ Post-migration validation failed:', validationError.message);
            console.error('🔧 Troubleshooting: Schema structure is invalid');
            console.error('📋 Raw data snippet:', newSchemaData.substring(0, 500) + '...');
            return await handleMigrationFailure('Migration validation failed', backupResult.backupKey);
        }

        // Step 7: Success!

        // ✅ Clean up old separate localStorage keys
        _deps.storage.removeItem("overdueTaskStates"); // Clean up old separate key

        // ✅ Enhanced success notification with fix details
        const successMessage = fixResult.fixedCount > 0
            ? '✅ ' + getLabel('notify.dataUpdatedWithFixes', { vars: { count: fixResult.fixedCount } })
            : '✅ ' + getLabel('notify.dataFormatUpdated');
        _deps.showNotification(successMessage, 'success', UI_TIMEOUTS.NOTIFICATION_EXTENDED);

        // Step 8: Store migration completion info
        const legacyData = _deps.storage.getItem('miniCycleStorage') || '{}';
        const migrationInfo = {
            completed: _deps.now(),
            backupKey: backupResult.backupKey,
            version: '1.395',
            autoMigrated: true,
            dataFixesApplied: fixResult.fixedCount || 0,
            migrationSummary: {
                originalDataSize: legacyData.length,
                newDataSize: newSchemaData.length,
                changesApplied: migrationResult.changes?.length || 0,
                fixesApplied: fixResult.details || []
            }
        };

        _deps.storage.setItem('miniCycleMigrationInfo', JSON.stringify(migrationInfo));

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
    assertInjected('storage', _deps.storage);
    assertInjected('showNotification', _deps.showNotification);
    assertInjected('now', _deps.now);

    const minimalData = {
        schemaVersion: "2.5",
        metadata: {
            createdAt: _deps.now(),
            lastModified: _deps.now(),
            migratedFrom: "force_migration",
            migrationDate: _deps.now(),
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
                    createdAt: _deps.now(),
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

    _deps.storage.setItem("miniCycleData", JSON.stringify(minimalData));

    _deps.showNotification('⚠️ ' + getLabel('notify.freshCycleCreated'), 'warning', UI_TIMEOUTS.NOTIFICATION_PERSISTENT);

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
    assertInjected('storage', _deps.storage);
    assertInjected('sessionStorage', _deps.sessionStorage);
    assertInjected('showNotification', _deps.showNotification);

    try {

        // Step 1: Try to restore from backup if available
        if (backupKey) {
            const backupExists = !!_deps.storage.getItem(backupKey);

            try {
                await restoreFromAutomaticBackup(backupKey);
            } catch (restoreError) {
                console.error('❌ Failed to restore from backup:', restoreError);
                console.error('🔧 Restore error details:', restoreError.message);
                console.error('📋 Continuing with fallback strategy...');
                // Continue with fallback - don't fail here
            }
        } else {
        }

        // Step 2: Ensure legacy data is accessible
        const legacyDataExists = ensureLegacyDataAccess();

        if (legacyDataExists) {

            // Step 3: Set session flag to use legacy mode until reload
            _deps.sessionStorage.setItem('miniCycleLegacyModeActive', 'true');
            _deps.sessionStorage.setItem('miniCycleMigrationFailureReason', reason);

            // Step 4: Show user-friendly notification
            _deps.showNotification(
                '⚠️ ' + getLabel('notify.migrationFailed'),
                'warning',
                UI_TIMEOUTS.NOTIFICATION_PERSISTENT
            );

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
            console.error('📊 Final localStorage state:', Object.keys(_deps.storage));
            console.error('💾 Available data sources:', {
                miniCycleStorage: !!_deps.storage.getItem('miniCycleStorage'),
                miniCycleData: !!_deps.storage.getItem('miniCycleData'),
                lastUsedMiniCycle: !!_deps.storage.getItem('lastUsedMiniCycle'),
                anyBackups: Object.keys(_deps.storage).filter(key => key.includes('backup')),
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
    assertInjected('storage', _deps.storage);

    try {

        // Check if legacy data exists
        const legacyStorage = _deps.storage.getItem('miniCycleStorage');

        if (!legacyStorage) {
            console.error('❌ No legacy data found in localStorage');
            console.error('📋 Available localStorage keys:', Object.keys(_deps.storage));
            return false;
        }

        // Try to parse the legacy data to ensure it's valid
        try {
            const parsedData = JSON.parse(legacyStorage);

            if (typeof parsedData === 'object' && parsedData !== null) {

                // Additional validation
                const cycleKeys = Object.keys(parsedData);

                if (cycleKeys.length > 0) {
                    const firstCycle = parsedData[cycleKeys[0]];
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
    assertInjected('sessionStorage', _deps.sessionStorage);

    const isActive = _deps.sessionStorage.getItem('miniCycleLegacyModeActive') === 'true';
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
    assertInjected('storage', _deps.storage);
    assertInjected('now', _deps.now);

    try {
        const timestamp = _deps.now();
        const backupKey = `auto_migration_backup_${timestamp}`;

        // Check if we have data to backup
        const legacyData = _deps.storage.getItem('miniCycleStorage');

        if (!legacyData) {
            console.error('❌ No legacy data found to backup');
            console.error('📋 Available localStorage keys:', Object.keys(_deps.storage));
            throw new Error('No legacy data found to backup');
        }

        // Gather all data to backup
        const remindersData = _deps.storage.getItem('miniCycleReminders');
        const lastUsed = _deps.storage.getItem('lastUsedMiniCycle');
        const milestones = _deps.storage.getItem('milestoneUnlocks');

        const settingsData = {
            threeDots: _deps.storage.getItem('miniCycleThreeDots'),
            darkMode: _deps.storage.getItem('darkModeEnabled'),
            moveArrows: _deps.storage.getItem('miniCycleMoveArrows'),
            alwaysShowRecurring: _deps.storage.getItem('miniCycleAlwaysShowRecurring'),
            defaultRecurring: _deps.storage.getItem('miniCycleDefaultRecurring'),
            theme: _deps.storage.getItem('currentTheme'),
            onboarding: _deps.storage.getItem('miniCycleOnboarding'),
            notificationPosition: _deps.storage.getItem('miniCycleNotificationPosition')
        };

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

        try {
            _deps.storage.setItem(backupKey, JSON.stringify(backupData));
        } catch (storageError) {
            console.error('❌ Storage error during backup:', storageError);
            console.error('🔧 Storage error details:', storageError.message);
            console.error('📊 Storage usage info:', {
                backupSize: backupSize,
                estimatedTotalStorage: JSON.stringify(_deps.storage).length,
                availableKeys: Object.keys(_deps.storage).length
            });
            throw new Error('Insufficient storage space for backup');
        }

        // Add to backup index for management
        try {
            const backupIndex = JSON.parse(_deps.storage.getItem('miniCycleBackupIndex') || '[]');

            backupIndex.push({
                key: backupKey,
                created: timestamp,
                type: 'auto_migration',
                size: JSON.stringify(backupData).length
            });

            // Keep only last 5 automatic backups to prevent storage bloat
            const autoBackups = backupIndex.filter(b => b.type === 'auto_migration');

            if (autoBackups.length > 5) {
                const oldestAutoBackup = autoBackups.sort((a, b) => a.created - b.created)[0];

                try {
                    _deps.storage.removeItem(oldestAutoBackup.key);
                    const index = backupIndex.findIndex(b => b.key === oldestAutoBackup.key);
                    backupIndex.splice(index, 1);
                } catch (cleanupError) {
                    console.warn('⚠️ Failed to cleanup old backup:', cleanupError);
                    console.warn('🔧 Cleanup error details:', cleanupError.message);
                    // Continue anyway - this isn't critical
                }
            }

            _deps.storage.setItem('miniCycleBackupIndex', JSON.stringify(backupIndex));

        } catch (indexError) {
            console.warn('⚠️ Failed to update backup index:', indexError);
            console.warn('🔧 Index error details:', indexError.message);
            // Continue anyway - backup was created successfully
        }

        return {
            success: true,
            backupKey: backupKey,
            size: JSON.stringify(backupData).length
        };

    } catch (error) {
        console.error('❌ Failed to create automatic backup:', error);
        console.error('🔧 Backup creation error:', error.message);
        console.error('📊 System state at backup failure:', {
            localStorage: Object.keys(_deps.storage),
            storageEstimate: JSON.stringify(_deps.storage).length
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
    assertInjected('storage', _deps.storage);

    try {

        const backupData = _deps.storage.getItem(backupKey);

        if (!backupData) {
            console.error('❌ Backup not found in localStorage');
            console.error('📋 Available backup keys:', Object.keys(_deps.storage).filter(key => key.includes('backup')));
            throw new Error('Backup not found');
        }

        let backup;
        try {
            backup = JSON.parse(backupData);
        } catch (parseError) {
            console.error('❌ Backup data is corrupted:', parseError);
            console.error('🔧 Parse error details:', parseError.message);
            console.error('📋 Raw backup preview:', backupData.substring(0, 200) + '...');
            throw new Error('Backup data is corrupted');
        }

        // Restore legacy data
        if (backup.data.miniCycleStorage) {
            _deps.storage.setItem('miniCycleStorage', backup.data.miniCycleStorage);
        } else {
            console.warn('⚠️ No miniCycleStorage found in backup');
        }

        // Restore last used cycle
        if (backup.data.lastUsedMiniCycle) {
            _deps.storage.setItem('lastUsedMiniCycle', backup.data.lastUsedMiniCycle);
        }

        if (backup.data.miniCycleReminders) {
            _deps.storage.setItem('miniCycleReminders', backup.data.miniCycleReminders);
        } else {
            console.warn('⚠️ No miniCycleReminders found in backup');
        }

        // Restore milestones
        if (backup.data.milestoneUnlocks) {
            _deps.storage.setItem('milestoneUnlocks', backup.data.milestoneUnlocks);
        }

        // Restore settings
        if (backup.data.settings) {
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

                        _deps.storage.setItem(storageKey, settings[key]);
                        settingsRestored.push(key);
                    } catch (settingError) {
                        console.warn(`⚠️ Failed to restore setting ${key}:`, settingError);
                        // Continue with other settings
                    }
                }
            });

        } else {
            console.warn('⚠️ No settings found in backup');
        }

        // Remove any Schema 2.5 data that might have been created
        try {
            const schema25Existed = !!_deps.storage.getItem('miniCycleData');
            _deps.storage.removeItem('miniCycleData');
        } catch (removeError) {
            console.warn('⚠️ Failed to remove Schema 2.5 data:', removeError);
            // Continue anyway
        }

        return { success: true };

    } catch (error) {
        console.error('❌ Failed to restore from automatic backup:', error);
        console.error('🔧 Restore error stack:', error.stack);
        console.error('📊 System state at restore failure:', {
            backupKey: backupKey,
            backupExists: !!_deps.storage.getItem(backupKey),
            currentKeys: Object.keys(_deps.storage)
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
    assertInjected('document', _deps.document);
    assertInjected('now', _deps.now);

    const errorContainer = _deps.document.createElement('div');
    errorContainer.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #ff4444; color: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: ${Z_INDEX.OVERLAY_CRITICAL}; max-width: 400px; text-align: center; font-family: Inter, sans-serif; line-height: 1.5;`;

    // Fix #38: Escape message to prevent XSS
    const escapeHtml = (str) => {
        if (typeof str !== 'string') return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
    };

    errorContainer.innerHTML = `
        <h3 style="margin-top: 0;">⚠️ App Error</h3>
        <p style="margin-bottom: 20px;">${escapeHtml(message)}</p>
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

    _deps.document.body.appendChild(errorContainer);

    // Auto-remove after 15 seconds
    setTimeout(() => {
        if (errorContainer.parentElement) {
            errorContainer.remove();
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
export async function initAppWithAutoMigration(options = {}) {
    assertInjected('storage', _deps.storage);
    assertInjected('sessionStorage', _deps.sessionStorage);
    assertInjected('showNotification', _deps.showNotification);
    assertInjected('initialSetup', _deps.initialSetup);
    assertInjected('now', _deps.now);

    // Check if we're already in legacy fallback mode
    if (isLegacyFallbackModeActive()) {
        const failureReason = _deps.sessionStorage.getItem('miniCycleMigrationFailureReason') || 'Unknown reason';

        _deps.showNotification(
            '⚠️ ' + getLabel('notify.compatibilityMode', { vars: { reason: failureReason } }),
            'warning',
            UI_TIMEOUTS.NOTIFICATION_SLOW
        );

        // Load app with legacy data
        await _deps.initialSetup();
        _deps.onInitialSetupComplete?.();
        return;
    }

    // Run migration check
    const migrationCheck = checkMigrationNeeded();

    if (migrationCheck.needed) {
        try{
        const result = await performAutoMigration(options);

            if (result.success) {
                await _deps.initialSetup();
                _deps.onInitialSetupComplete?.();
            } else if (result.fallbackActive) {
                await _deps.initialSetup();
                _deps.onInitialSetupComplete?.();
            } else {
                console.error('❌ Auto-migration failed completely:', result.message);
                console.error('🚨 Critical failure details:', result);
                // Critical error is already shown by handleMigrationFailure
            }
        } catch(error) {
            console.error('❌ Unexpected error during auto-migration:', error);
            console.error('🔧 Promise rejection stack:', error.stack);
         showCriticalError('An unexpected error occurred. Please refresh the page.');
        }
    } else {
        await _deps.initialSetup();
        _deps.onInitialSetupComplete?.();
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
    return initAppWithAutoMigration({
        forceMode: true,
        skipValidation: true
    });
}

// ==========================================
// 🎯 MODULE LOADED
// ==========================================
