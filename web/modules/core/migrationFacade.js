/**
 * @file migrationFacade.js
 * @description Facade for migration functions - consolidates 8 globals into one export
 * @module modules/core/migrationFacade
 *
 * Created Dec 2025 to reduce window.* pollution.
 * All migration functions are imported from migrationManager and exposed via this facade.
 *
 * Instead of:
 *   window.createInitialSchema25Data()
 *   window.performSchema25Migration()
 *   etc.
 *
 * Use:
 *   import { MigrationFacade } from './migrationFacade.js';
 *   MigrationFacade.createInitialData();
 *   MigrationFacade.performMigration();
 */

// Will be populated when initMigrationFacade is called
let migrationModule = null;

/**
 * Initialize the migration facade with the migration module
 * @param {Object} migrationMod - The imported migration module
 */
export function initMigrationFacade(migrationMod) {
    migrationModule = migrationMod;
    console.log('✅ Migration facade initialized');
}

/**
 * Migration Facade - unified access to all migration functions
 * Reduces 8 window.* globals to 1 importable object
 */
export const MigrationFacade = {
    /**
     * Create initial Schema 2.5 data structure
     */
    createInitialData() {
        return migrationModule?.createInitialSchema25Data?.();
    },

    /**
     * Check if migration is needed
     */
    checkNeeded() {
        return migrationModule?.checkMigrationNeeded?.();
    },

    /**
     * Simulate migration without applying changes
     */
    simulate() {
        return migrationModule?.simulateMigrationToSchema25?.();
    },

    /**
     * Perform the Schema 2.5 migration
     */
    performMigration() {
        return migrationModule?.performSchema25Migration?.();
    },

    /**
     * Validate all miniCycle tasks (lenient mode)
     */
    validateTasks() {
        return migrationModule?.validateAllMiniCycleTasksLenient?.();
    },

    /**
     * Fix task validation issues
     */
    fixIssues() {
        return migrationModule?.fixTaskValidationIssues?.();
    },

    /**
     * Initialize app with automatic migration
     */
    initWithAutoMigration() {
        return migrationModule?.initAppWithAutoMigration?.();
    },

    /**
     * Force migration (even if not needed)
     */
    forceMigration() {
        return migrationModule?.forceAppMigration?.();
    },

    // ========== Direct access to original functions ==========
    // For cases where you need the original function reference

    get createInitialSchema25Data() {
        return migrationModule?.createInitialSchema25Data;
    },

    get checkMigrationNeeded() {
        return migrationModule?.checkMigrationNeeded;
    },

    get simulateMigrationToSchema25() {
        return migrationModule?.simulateMigrationToSchema25;
    },

    get performSchema25Migration() {
        return migrationModule?.performSchema25Migration;
    },

    get validateAllMiniCycleTasksLenient() {
        return migrationModule?.validateAllMiniCycleTasksLenient;
    },

    get fixTaskValidationIssues() {
        return migrationModule?.fixTaskValidationIssues;
    },

    get initAppWithAutoMigration() {
        return migrationModule?.initAppWithAutoMigration;
    },

    get forceAppMigration() {
        return migrationModule?.forceAppMigration;
    }
};

// Also export individual functions for those who prefer direct imports
export function createInitialSchema25Data() {
    return MigrationFacade.createInitialData();
}

export function checkMigrationNeeded() {
    return MigrationFacade.checkNeeded();
}

export function simulateMigrationToSchema25() {
    return MigrationFacade.simulate();
}

export function performSchema25Migration() {
    return MigrationFacade.performMigration();
}

export function validateAllMiniCycleTasksLenient() {
    return MigrationFacade.validateTasks();
}

export function fixTaskValidationIssues() {
    return MigrationFacade.fixIssues();
}

export function initAppWithAutoMigration() {
    return MigrationFacade.initWithAutoMigration();
}

export function forceAppMigration() {
    return MigrationFacade.forceMigration();
}

console.log('📦 migrationFacade module loaded');
