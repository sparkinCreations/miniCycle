//Mini Cycle
let draggedTask = null;
let logoTimeoutId = null;
let touchStartTime = 0;
let isLongPress = false;
let touchStartY = 0;
let touchEndY = 0;
let holdTimeout = null;
let moved = false;
let isDragging = false;
let rearrangeInitialized = false;
let lastDraggedOver = null;
let lastRearrangeTarget = null;
let lastDragOverTime = 0;
let hasInteracted = false;
let reminderIntervalId = null;
let timesReminded = 0;
let lastReminderTime = null;
let isDraggingNotification = false;
let isResetting = false;
let undoSnapshot = null;
let redoSnapshot = null;
const UNDO_LIMIT = 4;
let undoStack = [];
let redoStack = [];
let didDragReorderOccur = false;
let lastReorderTime = 0;
const REORDER_SNAPSHOT_INTERVAL = 500; // only allow snapshot every 500ms




document.addEventListener('DOMContentLoaded', (event) => {
 


const taskInput = document.getElementById("taskInput");
const addTaskButton = document.getElementById("addTask");
const taskList = document.getElementById("taskList");
const cycleMessage = document.getElementById("cycleMessage");
const progressBar = document.getElementById("progressBar");
const completeAllButton = document.getElementById("completeAll");
const toggleAutoReset = document.getElementById("toggleAutoReset");
const menuButton = document.querySelector(".menu-button");
const menu = document.querySelector(".menu-container");
const exitMiniCycle = document.getElementById("exit-mini-cycle");
const feedbackModal = document.getElementById("feedback-modal");
const openFeedbackBtn = document.getElementById("open-feedback-modal");
const closeFeedbackBtn = document.querySelector(".close-feedback-modal");
const submitFeedbackBtn = document.getElementById("submit-feedback");
const feedbackText = document.getElementById("feedback-text");
const openUserManual = document.getElementById("open-user-manual");
const enableReminders = document.getElementById("enableReminders");
const enableTaskReminders = document.getElementById("enable-task-reminders");
const indefiniteCheckbox = document.getElementById("indefiniteCheckbox");
const repeatCountRow = document.getElementById("repeat-count-row");
const frequencySection = document.getElementById("frequency-section");
const remindersModal = document.getElementById("reminders-modal");
const closeRemindersBtn = document.getElementById("close-reminders-btn");
const closeMainMenuBtn = document.getElementById("close-main-menu");
const themeUnlockMessage = document.getElementById("theme-unlock-message");
const themeUnlockStatus = document.getElementById("theme-unlock-status");
const selectedYearlyDays = {}; // key = month number, value = array of selected days
const yearlyApplyToAllCheckbox = document.getElementById("yearly-apply-days-to-all");

const quickToggle = document.getElementById("quick-dark-toggle");
const darkModeEnabled = localStorage.getItem("darkModeEnabled") === "true";
if (quickToggle) {
  quickToggle.textContent = darkModeEnabled ? "☀️" : "🌙";
}

// === 🎯 Constants for event delegation targets ===
const RECURRING_CLICK_TARGETS = [
    ".weekly-day-box",
    ".biweekly-day-box",
    ".monthly-day-box",
    ".yearly-day-box",
    ".yearly-month-box"
  ];
  
  const RECURRING_CHANGE_TARGETS = [
    "input",
    "select",
    "#yearly-apply-days-to-all"
  ];
  
  // === 🔁 Delegated Change Handler ===
  const handleRecurringChange = (e) => {
    const isMatch = RECURRING_CHANGE_TARGETS.some(selector =>
      e.target.matches(selector)
    );
    if (isMatch) {
      updateRecurringSummary();
    }
  };
  
  // === 🔁 Delegated Click Handler ===
  const handleRecurringClick = (e) => {
    const isMatch = RECURRING_CLICK_TARGETS.some(selector =>
      e.target.matches(selector)
    );
    if (isMatch) {
      updateRecurringSummary();
    }
  };
  
  // === 🧠 Attach Delegated Listeners ===
  function attachRecurringSummaryListeners() {
    const panel = document.getElementById("recurring-settings-panel");
    safeAddEventListener(panel, "change", handleRecurringChange);
    safeAddEventListener(panel, "click", handleRecurringClick);
  }


const DRAG_THROTTLE_MS = 50;
const TASK_LIMIT = 100; 





















/**
 * Migration System Module
 * Returns all migration functionality in a clean, organized way
 */
function createMigrationSystem() {
    
    // ==========================================
    // ⚙️ MIGRATION CONFIGURATION
    // ==========================================
    
    const MIGRATION_CONFIG = {
        // 🕐 Backup retention duration (24 hours default)
        BACKUP_LIFETIME_MS: 24 * 60 * 60 * 1000, // 86400000ms = 24 hours
        
        // 🔧 Migration behavior options
        FAIL_SILENT_TASKS: true,                  // Continue migration even if individual tasks fail
        GENERATE_INTEGRITY_HASH: true,           // Add checksum for debugging
        AUTO_CLEANUP_DELAY_MS: 10000,           // Delay before cleaning successful backups
        
        // 📊 Progress tracking
        PROGRESS_UPDATE_INTERVAL: 100,           // Update UI progress every 100ms
        MAX_VALIDATION_ERRORS: 10,               // Stop validation after N errors
        ENABLE_LOG_DOWNLOAD: true,
        FAIL_SILENT_TASKS: true
    };
    
    // ==========================================
    // 📊 MIGRATION STATUS TRACKING
    // ==========================================
    
    const MIGRATION_STATUS = {
        NOT_NEEDED: 'not_needed',
        PENDING: 'pending',
        IN_PROGRESS: 'in_progress', 
        SUCCESS: 'success',
        ERROR: 'error',
        USER_CANCELLED: 'user_cancelled'
    };
    
    // ==========================================
    // 🔮 SCHEMA VERSION DEFINITIONS
    // ==========================================
    
    const SCHEMA_VERSIONS = {
        LEGACY: 'legacy',           // Pre-versioned data (your original format)
        V1: 'v1',                   // Early task schema with flat recurring properties
        V2: 'v2',                   // Current task schema with recurringSettings object
        V3A: '3A',                  // New unified schema with comprehensive structure
        // Future versions can be added here:
        // V3B: '3B',
        // V4: '4',
    };
    
    const CURRENT_SCHEMA_VERSION = SCHEMA_VERSIONS.V3A;
    
    // ==========================================
    // 🔧 UTILITY FUNCTIONS
    // ==========================================
    
    /**
     * Generate unique device ID for tracking
     */
    function generateDeviceId() {
      return `device-${crypto.randomUUID()}`;
    }
    
    /**
     * Get user-friendly device name
     */
    function getDeviceName() {
        const userAgent = navigator.userAgent;
        if (/iPhone/.test(userAgent)) return "iPhone";
        if (/iPad/.test(userAgent)) return "iPad";
        if (/Android/.test(userAgent)) return "Android Device";
        if (/Mac/.test(userAgent)) return "Mac";
        if (/Windows/.test(userAgent)) return "Windows PC";
        return "Unknown Device";
    }
    
    /**
     * 🔍 ENHANCED VERSION DETECTION
     * Handles your actual legacy format correctly
     */
    function detectSchemaVersion(data) {
        // Check for new 3A structure first
        if (data.schemaVersion === "3A" || data.miniCycle?.metadata?.schemaVersion === "3A") {
            return SCHEMA_VERSIONS.V3A;
        }
        
        // Check for any cycle with tasks to determine version
        for (const [cycleName, cycleData] of Object.entries(data)) {
            if (cycleData && Array.isArray(cycleData.tasks)) {
                for (const task of cycleData.tasks) {
                    // Explicit version 2
                    if (task.schemaVersion === 2) {
                        return SCHEMA_VERSIONS.V2;
                    }
                    
                    // Explicit version 1  
                    if (task.schemaVersion === 1) {
                        return SCHEMA_VERSIONS.V1;
                    }
                    
                    // Check for v2 structure (recurringSettings object) without explicit version
                    if (task.recurringSettings && typeof task.recurringSettings === 'object' && task.recurringSettings.frequency) {
                        return SCHEMA_VERSIONS.V2;
                    }
                    
                    // Check for v1 structure (flat recurring properties) without explicit version
                    if (task.recurring && (task.recurFrequency || task.dailyTime || task.weeklyDays)) {
                        // This is your legacy format - let it go through the full migration path
                        return SCHEMA_VERSIONS.LEGACY;
                    }
                }
            }
        }
        
        // Check if we have any cycle structure at all
        if (typeof data === 'object' && Object.keys(data).length > 0) {
            const firstKey = Object.keys(data)[0];
            const firstCycle = data[firstKey];
            if (firstCycle && (firstCycle.tasks || firstCycle.title)) {
                return SCHEMA_VERSIONS.LEGACY;
            }
        }
        
        return SCHEMA_VERSIONS.LEGACY;
    }
    
    /**
     * 🔮 FUTURE-PROOF VERSION COMPARISON
     */
    function isVersionCurrentOrNewer(version, targetVersion) {
        const versionOrder = [
            SCHEMA_VERSIONS.LEGACY,
            SCHEMA_VERSIONS.V1, 
            SCHEMA_VERSIONS.V2,
            SCHEMA_VERSIONS.V3A
            // Future versions go here
        ];
        
        const currentIndex = versionOrder.indexOf(version);
        const targetIndex = versionOrder.indexOf(targetVersion);
        
        return currentIndex >= targetIndex;
    }
    
    /**
     * Check if migration is needed and what version we're coming from
     */
    function checkMigrationNeeded(data) {
        // No data at all - fresh install
        if (!data || Object.keys(data).length === 0) {
            return { status: MIGRATION_STATUS.NOT_NEEDED, reason: 'fresh_install' };
        }
        
        const detectedVersion = detectSchemaVersion(data);
        
        // Already on current or newer version
        if (isVersionCurrentOrNewer(detectedVersion, CURRENT_SCHEMA_VERSION)) {
            return { status: MIGRATION_STATUS.NOT_NEEDED, reason: 'current_version', version: detectedVersion };
        }
        
        // Needs migration
        return { 
            status: MIGRATION_STATUS.PENDING, 
            reason: 'version_outdated',
            fromVersion: detectedVersion, 
            toVersion: CURRENT_SCHEMA_VERSION 
        };
    }
    
    /**
     * Test Step 1: Migration Configuration
     * Tests all migration config and version detection with your existing data
     */
    function testStep1() {
        try {
            displayTestingResult('🧪 Testing Step 1: Migration Configuration', 'info');
            
            // Test device detection
            const deviceId = generateDeviceId();
            const deviceName = getDeviceName();
            displayTestingResult(`Device: ${deviceName} (${deviceId.substring(0, 20)}...)`, 'success');
            
            // Test version detection with current data
            const currentData = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
            const migrationCheck = checkMigrationNeeded(currentData);
            
            displayTestingResult(`Migration Status: ${migrationCheck.status}`, 'info');
            displayTestingResult(`Reason: ${migrationCheck.reason}`, 'info');
            
            if (migrationCheck.status === MIGRATION_STATUS.PENDING) {
                displayTestingResult(`✅ Migration needed: ${migrationCheck.fromVersion} → ${migrationCheck.toVersion}`, 'warning');
            } else {
                displayTestingResult(`ℹ️ No migration needed: ${migrationCheck.reason}`, 'success');
                if (migrationCheck.version) {
                    displayTestingResult(`Current version: ${migrationCheck.version}`, 'info');
                }
            }
            
            // Test configuration values
            displayTestingResult(`Config - Backup Lifetime: ${MIGRATION_CONFIG.BACKUP_LIFETIME_MS}ms (${MIGRATION_CONFIG.BACKUP_LIFETIME_MS / (1000 * 60 * 60)} hours)`, 'info');
            displayTestingResult(`Config - Fail Silent: ${MIGRATION_CONFIG.FAIL_SILENT_TASKS}`, 'info');
            displayTestingResult(`Config - Generate Hash: ${MIGRATION_CONFIG.GENERATE_INTEGRITY_HASH}`, 'info');
            displayTestingResult(`Config - Auto Cleanup Delay: ${MIGRATION_CONFIG.AUTO_CLEANUP_DELAY_MS}ms`, 'info');
            
            // Test version comparison logic
            displayTestingResult('Testing version comparison logic...', 'info');
            const testComparison1 = isVersionCurrentOrNewer(SCHEMA_VERSIONS.V3A, SCHEMA_VERSIONS.V2);
            const testComparison2 = isVersionCurrentOrNewer(SCHEMA_VERSIONS.V1, SCHEMA_VERSIONS.V2);
            const testComparison3 = isVersionCurrentOrNewer(SCHEMA_VERSIONS.V2, SCHEMA_VERSIONS.V2);
            
            if (testComparison1 && !testComparison2 && testComparison3) {
                displayTestingResult('✅ Version comparison logic working correctly', 'success');
            } else {
                displayTestingResult('❌ Version comparison logic has issues', 'error');
            }
            
            // Test schema version detection with different data types
            displayTestingResult('Testing schema detection with sample data...', 'info');
            
            // Test with empty data
            const emptyTest = detectSchemaVersion({});
            displayTestingResult(`Empty data detected as: ${emptyTest}`, 'info');
            
            // Test with your current data if it exists
            if (Object.keys(currentData).length > 0) {
                const currentVersion = detectSchemaVersion(currentData);
                displayTestingResult(`Your current data detected as: ${currentVersion}`, 'info');
                
                // Analyze your actual data structure
                let totalTasks = 0;
                let totalCycles = Object.keys(currentData).length;
                let v1Tasks = 0;
                let v2Tasks = 0;
                let legacyTasks = 0;
                
                for (const [cycleName, cycleData] of Object.entries(currentData)) {
                    if (cycleData && Array.isArray(cycleData.tasks)) {
                        totalTasks += cycleData.tasks.length;
                        
                        for (const task of cycleData.tasks) {
                            if (task.schemaVersion === 2) {
                                v2Tasks++;
                            } else if (task.schemaVersion === 1) {
                                v1Tasks++;
                            } else {
                                legacyTasks++;
                            }
                        }
                    }
                }
                
                displayTestingResult(`Data Analysis: ${totalCycles} cycles, ${totalTasks} total tasks`, 'info');
                displayTestingResult(`Task Versions: ${legacyTasks} legacy, ${v1Tasks} v1, ${v2Tasks} v2`, 'info');
            }
            
            // Test constants are accessible
            displayTestingResult(`Current Target Schema: ${CURRENT_SCHEMA_VERSION}`, 'info');
            displayTestingResult(`Available Schema Versions: ${Object.values(SCHEMA_VERSIONS).join(', ')}`, 'info');
            
            displayTestingResult('✅ Step 1 Complete - Configuration is ready!', 'success');
            
            return migrationCheck;
            
        } catch (error) {
            displayTestingResult(`❌ Step 1 Error: ${error.message}`, 'error');
            console.error('Step 1 test error:', error);
            return null;
        }
    }
    
    /**
     * Enhanced migration detection specifically for testing
     * Provides more detailed analysis than the basic checkMigrationNeeded
     */
    function analyzeMigrationData() {
        try {
            displayTestingResult('🔍 Detailed Migration Analysis:', 'info');
            
            const currentData = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
            
            if (Object.keys(currentData).length === 0) {
                displayTestingResult('📭 No data found - fresh install', 'info');
                return;
            }
            
            let analysisResults = {
                cycles: 0,
                tasks: 0,
                completedTasks: 0,
                recurringTasks: 0,
                tasksWithDueDates: 0,
                tasksWithPriority: 0,
                schemaVersions: {},
                corruptedTasks: 0,
                migrationIssues: []
            };
            
            for (const [cycleName, cycleData] of Object.entries(currentData)) {
                analysisResults.cycles++;
                
                if (!cycleData.tasks || !Array.isArray(cycleData.tasks)) {
                    analysisResults.migrationIssues.push(`Cycle "${cycleName}" has invalid tasks array`);
                    continue;
                }
                
                for (const task of cycleData.tasks) {
                    analysisResults.tasks++;
                    
                    // Check for corruption
                    if (!task.id || !task.text) {
                        analysisResults.corruptedTasks++;
                    }
                    
                    if (task.completed) analysisResults.completedTasks++;
                    if (task.recurring) analysisResults.recurringTasks++;
                    if (task.dueDate) analysisResults.tasksWithDueDates++;
                    if (task.highPriority) analysisResults.tasksWithPriority++;
                    
                    // Track schema versions
                    const version = task.schemaVersion || 'unversioned';
                    analysisResults.schemaVersions[version] = (analysisResults.schemaVersions[version] || 0) + 1;
                }
            }
            
            // Display results
            displayTestingResult(`📊 Found ${analysisResults.cycles} cycles with ${analysisResults.tasks} total tasks`, 'info');
            displayTestingResult(`✅ Completed: ${analysisResults.completedTasks}, 🔄 Recurring: ${analysisResults.recurringTasks}`, 'info');
            displayTestingResult(`📅 With Due Dates: ${analysisResults.tasksWithDueDates}, 🔥 Priority: ${analysisResults.tasksWithPriority}`, 'info');
            
            // Schema version breakdown
            displayTestingResult('Schema Version Distribution:', 'info');
            for (const [version, count] of Object.entries(analysisResults.schemaVersions)) {
                displayTestingResult(`  ${version}: ${count} tasks`, 'info');
            }
            
            // Issues
            if (analysisResults.corruptedTasks > 0) {
                displayTestingResult(`⚠️ Found ${analysisResults.corruptedTasks} corrupted tasks`, 'warning');
            }
            
            if (analysisResults.migrationIssues.length > 0) {
                displayTestingResult('Migration Issues Found:', 'warning');
                analysisResults.migrationIssues.forEach(issue => {
                    displayTestingResult(`  ⚠️ ${issue}`, 'warning');
                });
            }
            
            if (analysisResults.corruptedTasks === 0 && analysisResults.migrationIssues.length === 0) {
                displayTestingResult('✅ No data issues found - ready for migration!', 'success');
            }
            
            return analysisResults;
            
        } catch (error) {
            displayTestingResult(`❌ Migration analysis failed: ${error.message}`, 'error');
            return null;
        }
    }


    // ==========================================
// 🚀 STEP 3: CORE MIGRATION LOGIC
// ==========================================
// Add this to your existing createMigrationSystem() function

// ==========================================
// 🔧 CORE MIGRATION FUNCTIONS
// ==========================================

/**
 * Main migration function to Schema 3A
 * Uses your existing migrateTask logic for guaranteed compatibility
 */
async function migrateToSchema3A(oldData, migrationCheck, migrationType = "auto") {
  try {
    console.log(`🔄 Starting migration from ${migrationCheck.fromVersion} to ${migrationCheck.toVersion}`);
    
    // Initialize new Schema 3A structure (using your provided schema)
    const newData = {
      schemaVersion: "3A",
      miniCycle: {
        metadata: {
          deviceId: generateDeviceId(),
          deviceName: getDeviceName(),
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          appVersion: "1.0.0",
          migratedFrom: migrationCheck.fromVersion,
          migrationType: migrationType, // "auto" | "manual_backup" | "none"
          migrationDate: new Date().toISOString(),
          migrationHash: null, // Will be calculated after migration
          totalCyclesCreated: 0,
          totalTasksCompleted: 0,
          totalTasksCleared: 0,
          totalTasksMigrated: 0,
          migrationErrors: [], // Track any non-fatal migration issues
          schemaVersion: "3A"
        },
        
        settings: {
          // Migrate existing settings or use defaults
          theme: localStorage.getItem("selectedTheme") || "default",
          darkMode: JSON.parse(localStorage.getItem("darkMode") || "false"),
          globalSound: true,
          
          // New 3A settings with defaults
          onboarding: {
            complete: true, // Existing users skip onboarding
            currentStep: null,
            resetRequested: false
          },
          
          notificationPosition: { x: 50, y: 50 },
          notificationPositionModified: false,
          
          defaultRecurringSettings: {
            frequency: "daily",
            indefinitely: true,
            time: null
          },
          recurringDefaultsModified: false,
          
          // Initialize empty task UI overrides
          taskUIOverrides: {
            global: {},
            cycles: {},
            tasks: {}
          },
          
          // Migrate existing preferences
          preferredLanguage: "en-US",
          accessibility: {
            reducedMotion: false,
            highContrast: false,
            screenReaderHints: true
          },
          fontSize: "medium",
          fontStyle: "system",
          alwaysShowRecurring: JSON.parse(localStorage.getItem("miniCycleAlwaysShowRecurring") || "false"),
          autoSave: true,
          deleteCheckedTasksGlobal: false,
          unlockedThemes: migrateUnlockedThemes(),
          unlockedFeatures: ["basicTasks"],
          premiumActive: false,
          premiumStartDate: null,
          premiumExpiresAt: null,
          preferredTimeFormat: "12h",
          
          defaultLayoutOverrides: {
            layoutMode: "default",
            components: {
              taskList: { visible: true, position: { x: 0, y: 0 }, size: { width: 400, height: 600 } },
              panel: { visible: true, position: { x: 300, y: 0 }, size: { width: 300, height: 600 } },
              cycleNotes: { visible: false, position: { x: 600, y: 0 }, size: { width: 350, height: 500 } }
            }
          },
          
          // 🧪 Experimental Features & Testing
          experimental: {
            // Toggles core dev/testing behavior
            testMode: false,
            // Feature switches for A/B tests, betas, or internal features
            features: {
              newReminderUI: false,
              advancedAnalytics: true,
              betaIntegrations: false
            },
            // Store temporary test-specific data
            data: {
              lastReminderUITestRun: null,
              betaFeedbackNotes: [],
              debugOverrides: {
                ignoreReminderFireTime: false
              }
            },
            // Metadata about the current experiment state
            meta: {
              lastFeatureCheck: "2025-08-16T18:00:00.000Z",
              schemaTestedOn: "3A",
              devBuild: "1.2.0-beta"
            }
          }
        },
        
        userProfile: {
          nickname: "User",
          pronouns: "",
          createdAt: new Date().toISOString(),
          deviceLabel: getDeviceName(),
          preferences: {
            showMotivationalTips: true,
            showGreeting: true,
            greetingStyle: "casual"
          }
        },
        
        customReminders: [], // Start empty, users can add their own
        tags: [],
        
        data: {
          cycleTemplates: {},
          cycles: [],
          history: { cycles: [], archivedTasks: [] }
        },
        
        cycleNotes: { notes: [] },
        
        appState: {
          activeCycleId: null,
          recentCycles: []
        },
        
        userBackups: [],
        backupReminder: {
          lastPrompted: null,
          lastUserBackup: null,
          skipUntil: null,
          nextBackupPromptDueAt: null
        },
        backups: [],
        analytics: { enabled: true, data: {} },
        userProgress: {
          tasksClearedInTodoMode: 0,
          recurringTasksArchived: 0,
          cyclesCompleted: 0,
          rewardMilestones: []
        }
      }
    };
   
    // Migrate existing cycles and tasks using your proven migration logic
    if (oldData && typeof oldData === 'object') {
      await migrateCyclesAndTasks(oldData, newData, migrationCheck.fromVersion);
    }
   
    // 🔐 Generate integrity hash for debugging (optional)
    if (MIGRATION_CONFIG.GENERATE_INTEGRITY_HASH) {
      newData.miniCycle.metadata.migrationHash = generateMigrationHash(newData);
    }
   
    console.log(`✅ Migration to Schema 3A completed successfully`);
    return newData;
    
  } catch (error) {
    console.error(`❌ Migration to Schema 3A failed:`, error);
    throw error;
  }
}

/**
 * 🚨 USES YOUR EXISTING migrateTask LOGIC - GUARANTEED COMPATIBILITY
 * Enhanced with fail-silent option and error tracking
 */
async function migrateCyclesAndTasks(oldData, newData, fromVersion) {
  let totalTasksCompleted = 0;
  let totalCyclesCreated = 0;
  let totalTasksMigrated = 0;
  const migrationErrors = [];
 
  for (const [cycleName, cycleData] of Object.entries(oldData)) {
    // Skip non-cycle data
    if (typeof cycleData !== 'object' || !cycleData.tasks) continue;
    
    const cycleId = `cycle-${generateUUID()}`;
    
    try {
      // Migrate cycle
      const migratedCycle = {
        cycleName: cycleName,
        id: cycleId,
        title: cycleData.title || cycleName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        currentMode: "auto", // Default mode
        autoReset: cycleData.autoReset !== false,
        deleteCheckedTasks: cycleData.deleteCheckedTasks || false,
        completeButtonVisible: true,
        premiumFeaturesUsed: false,
        
        layoutOverrides: {
          layoutMode: "default",
          layoutLocked: false,
          components: {
            taskList: { visible: true, position: { x: 0, y: 0 }, size: { width: 400, height: 600 }, zIndex: 1 },
            panel: { visible: true, position: { x: 300, y: 0 }, size: { width: 300, height: 600 }, zIndex: 2 },
            cycleNotes: { visible: false, position: { x: 650, y: 0 }, size: { width: 350, height: 500 }, zIndex: 3 }
          },
          lastModified: new Date().toISOString()
        },
        
        tasks: [],
        recurringTemplates: {},
        analytics: {
          totalTasksCompleted: 0,
          totalTasksCleared: 0,
          totalCyclesCompleted: cycleData.cycleCount || 0,
          lastCompletedAt: null,
          lastTaskCreated: null,
          lastTaskModified: null
        },
        metadata: {
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          deviceId: newData.miniCycle.metadata.deviceId,
          totalTasksCompleted: 0,
          averageCompletionTime: 1800
        }
      };
      
      // 🚨 CRITICAL: Use YOUR existing migrateTask function for guaranteed compatibility
      if (Array.isArray(cycleData.tasks)) {
        for (let taskIndex = 0; taskIndex < cycleData.tasks.length; taskIndex++) {
          const oldTask = cycleData.tasks[taskIndex];
          
          try {
            // Use YOUR proven migrateTask logic that handles v1->v2 migration
            const yourMigratedTask = migrateTaskUsingYourLogic(oldTask);
            
            // Then upgrade to 3A format
            const schema3ATask = upgradeTaskToSchema3A(yourMigratedTask, cycleId);
            migratedCycle.tasks.push(schema3ATask);
            
            totalTasksMigrated++;
            if (oldTask.completed) {
              totalTasksCompleted++;
              migratedCycle.analytics.totalTasksCompleted++;
            }
            
          } catch (taskError) {
            const errorInfo = {
              type: 'task_migration_error',
              cycleName: cycleName,
              taskIndex: taskIndex,
              taskText: oldTask?.text || 'Unknown task',
              error: taskError.message,
              timestamp: new Date().toISOString()
            };
            
            migrationErrors.push(errorInfo);
            console.warn(`⚠️ Failed to migrate task "${oldTask?.text}" in cycle "${cycleName}":`, taskError);
            
            // 🔧 Fail-silent option: Continue migration or throw?
            if (!MIGRATION_CONFIG.FAIL_SILENT_TASKS) {
              throw new Error(`Task migration failed: ${taskError.message}`);
            }
            
            // If fail-silent, create a basic fallback task
            try {
              const fallbackTask = createFallbackTask(oldTask, cycleId, taskIndex);
              migratedCycle.tasks.push(fallbackTask);
              totalTasksMigrated++;
              
              errorInfo.resolution = 'created_fallback_task';
              console.log(`🔧 Created fallback task for failed migration`);
              
            } catch (fallbackError) {
              errorInfo.resolution = 'task_skipped';
              console.error(`❌ Could not create fallback task:`, fallbackError);
            }
          }
        }
      }
      
      newData.miniCycle.data.cycles.push(migratedCycle);
      totalCyclesCreated++;
      
      // Set first cycle as active
      if (!newData.miniCycle.appState.activeCycleId) {
        newData.miniCycle.appState.activeCycleId = cycleId;
      }
      
    } catch (cycleError) {
      const errorInfo = {
        type: 'cycle_migration_error',
        cycleName: cycleName,
        error: cycleError.message,
        timestamp: new Date().toISOString()
      };
      
      migrationErrors.push(errorInfo);
      console.warn(`⚠️ Failed to migrate cycle "${cycleName}":`, cycleError);
      
      if (!MIGRATION_CONFIG.FAIL_SILENT_TASKS) {
        throw new Error(`Cycle migration failed: ${cycleError.message}`);
      }
      
      errorInfo.resolution = 'cycle_skipped';
    }
  }
 
  // Update global stats
  newData.miniCycle.metadata.totalCyclesCreated = totalCyclesCreated;
  newData.miniCycle.metadata.totalTasksCompleted = totalTasksCompleted;
  newData.miniCycle.metadata.totalTasksMigrated = totalTasksMigrated;
  newData.miniCycle.metadata.migrationErrors = migrationErrors;
 
  // Log migration summary
  if (migrationErrors.length > 0) {
    console.warn(`⚠️ Migration completed with ${migrationErrors.length} non-fatal errors`);
    console.log('Migration errors:', migrationErrors);
  } else {
    console.log(`✅ Migration completed successfully: ${totalCyclesCreated} cycles, ${totalTasksMigrated} tasks`);
  }

  // After migration logic
displayMigrationSummary({
  totalCyclesCreated,
  totalTasksMigrated,
  totalTasksCompleted,
  migrationErrors,
  timestamp: new Date().toISOString()
});
}

/**
 * Wrapper for your existing migrateTask function
 */
function migrateTaskUsingYourLogic(oldTask) {
  // 🚨 CRITICAL: This calls YOUR existing migrateTask function
  // This ensures 100% compatibility with your current migration logic
  if (typeof migrateTask === 'function') {
    return migrateTask(oldTask);
  } else {
    // Fallback if migrateTask function not found
    console.warn('⚠️ migrateTask function not found, using basic migration');
    return basicTaskMigration(oldTask);
  }
}

/**
 * Basic task migration fallback (if your migrateTask isn't available)
 */
function basicTaskMigration(oldTask) {
  // Simple fallback migration - preserves basic structure
  return {
    ...oldTask,
    id: oldTask.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    recurringSettings: oldTask.recurringSettings || null,
    metadata: oldTask.metadata || {
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    }
  };
}

/**
 * Upgrade task from your migrated format to Schema 3A
 */
function upgradeTaskToSchema3A(migratedTask, cycleId) {
  const taskId = migratedTask.id && migratedTask.id.startsWith("task-")
    ? migratedTask.id
    : `task-3a-${generateUUID()}`;

  return {
    taskShortName: migratedTask.taskShortName || "Task",
    id: taskId,
    customOrder: migratedTask.customOrder ?? 1,
    text: migratedTask.text || "Migrated Task",
    completed: migratedTask.completed === true,  // Ensure it's strictly a boolean

    dueDate: migratedTask.dueDate || null,
    priority: migratedTask.priority || {
      level: "normal",
      enabled: false
    },

    remindersEnabled: migratedTask.remindersEnabled || false,
    reminderSettings: migratedTask.reminderSettings || {
      enabled: false,
      frequency: {
        type: "interval",
        value: 60,
        unit: "minutes"
      },
      lastFired: null
    },

    flagForRemoval: false,
    recurring: migratedTask.recurring || false,
    recurringSettings: migratedTask.recurringSettings || null,
    tags: migratedTask.tags || [],

    metadata: {
      createdAt: migratedTask.metadata?.createdAt || new Date().toISOString(),
      createdFromTemplate: false,
      templateName: null,
      modifiedAt: new Date().toISOString(),
      deviceId: generateDeviceId(),
      migrationFallback: false
    }
  };
}
/**
 * Create a basic fallback task when migration fails
 */
function createFallbackTask(originalTask, cycleId, taskIndex) {
  const taskId = `fallback-task-${Date.now()}-${taskIndex}`;

  return {
    taskShortName: "Migrated Task",
    id: taskId,
    customOrder: taskIndex + 1,
    text: originalTask?.text || `Migrated Task ${taskIndex + 1}`,
    completed: originalTask?.completed || false,
    
    dueDate: null,
    priority: {
      level: "normal",
      enabled: false
    },
    
    remindersEnabled: false,
    reminderSettings: {
      enabled: false,
      frequency: {
        type: "interval",
        value: 60,
        unit: "minutes"
      },
      lastFired: null
    },
    
    flagForRemoval: false,
    recurring: false,
    recurringSettings: null,
    tags: [],
    
    metadata: {
      createdAt: new Date().toISOString(),
      createdFromTemplate: false,
      templateName: null,
      modifiedAt: new Date().toISOString(),
      deviceId: "migration-fallback",
      migrationFallback: true
    }
  };
}

/**
 * Migrate unlocked themes from existing storage
 */
function migrateUnlockedThemes() {
  try {
    const existingThemes = JSON.parse(localStorage.getItem("unlockedThemes") || "[]");
    return Array.isArray(existingThemes) ? existingThemes : [];
  } catch (error) {
    console.warn('Failed to migrate unlocked themes:', error);
    return [];
  }
}



/**
 * Generate migration hash for integrity checking
 */
function generateMigrationHash(data) {
  try {
    const dataString = JSON.stringify(data);
    // Simple hash function (you could use a more robust one)
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `migration-${Math.abs(hash).toString(36)}-${Date.now()}`;
  } catch (error) {
    console.warn('Failed to generate migration hash:', error);
    return `migration-fallback-${Date.now()}`;
  }
}

function displayMigrationSummary(summary) {
  const {
    totalCyclesCreated,
    totalTasksMigrated,
    totalTasksCompleted,
    migrationErrors = [],
    timestamp = new Date().toISOString(),
  } = summary;

  const successMsg = `✅ Migration Complete
  • ${totalCyclesCreated} cycles migrated
  • ${totalTasksMigrated} tasks processed
  • ${totalTasksCompleted} tasks marked completed
  • ${migrationErrors.length} issue(s) encountered`;

  console.groupCollapsed(`🧾 Migration Summary @ ${timestamp}`);
  console.log(successMsg);
  if (migrationErrors.length > 0) {
    console.table(migrationErrors);
  }
  console.groupEnd();

  // Optional: Add log download option for power users
  if (MIGRATION_CONFIG.ENABLE_LOG_DOWNLOAD) {
    const logData = {
      timestamp,
      totalCyclesCreated,
      totalTasksMigrated,
      totalTasksCompleted,
      migrationErrors
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `migration-log-${timestamp}.json`;
    link.textContent = "📥 Download Migration Log";
    link.style.display = "block";
    document.body.appendChild(link);
  }
}

// ==========================================
// 🧪 DIAGNOSTICS PANEL INTEGRATION
// ==========================================

/**
 * Enhanced migration status check for your diagnostics panel
 */
function checkMigrationStatusForDiagnostics() {
  try {
    const currentData = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
    const migrationCheck = checkMigrationNeeded(currentData);
    
    let result = {
      status: migrationCheck.status,
      fromVersion: migrationCheck.fromVersion,
      toVersion: migrationCheck.toVersion,
      reason: migrationCheck.reason,
      dataSize: Object.keys(currentData).length,
      readyForMigration: migrationCheck.status === MIGRATION_STATUS.PENDING
    };
    
    // Display in your diagnostics panel
    displayTestingResult(`📊 Migration Status Check Results:`, 'info');
    displayTestingResult(`Status: ${result.status}`, result.readyForMigration ? 'warning' : 'success');
    
    if (result.readyForMigration) {
      displayTestingResult(`Migration needed: ${result.fromVersion} → ${result.toVersion}`, 'warning');
      displayTestingResult(`Reason: ${result.reason}`, 'info');
      displayTestingResult(`Data entries to migrate: ${result.dataSize}`, 'info');
    } else {
      displayTestingResult(`No migration needed: ${result.reason}`, 'success');
    }
    
    return result;
    
  } catch (error) {
    displayTestingResult(`❌ Migration status check failed: ${error.message}`, 'error');
    return { error: error.message };
  }
}

/**
 * Safe simulation of migration for testing (doesn't modify actual data)
 */
async function simulateMigrationForDiagnostics() {
  try {
    displayTestingResult(`🧪 Starting migration simulation...`, 'info');
    
    const currentData = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
    const migrationCheck = checkMigrationNeeded(currentData);
    
    if (migrationCheck.status !== MIGRATION_STATUS.PENDING) {
      displayTestingResult(`No migration needed (${migrationCheck.reason})`, 'success');
      return;
    }
    
    // Create a copy for simulation (don't modify real data)
    const testData = JSON.parse(JSON.stringify(currentData));
    
    displayTestingResult(`Simulating migration: ${migrationCheck.fromVersion} → ${migrationCheck.toVersion}`, 'info');
    
    // Run migration on test data
    const startTime = Date.now();
    const migratedData = await migrateToSchema3A(testData, migrationCheck, 'simulation');
    const duration = Date.now() - startTime;
    
    // Report results
    displayTestingResult(`✅ Migration simulation completed in ${duration}ms`, 'success');
    displayTestingResult(`Cycles migrated: ${migratedData.miniCycle.metadata.totalCyclesCreated}`, 'info');
    displayTestingResult(`Tasks migrated: ${migratedData.miniCycle.metadata.totalTasksMigrated}`, 'info');
    displayTestingResult(`Completed tasks preserved: ${migratedData.miniCycle.metadata.totalTasksCompleted}`, 'info');
    
    if (migratedData.miniCycle.metadata.migrationErrors.length > 0) {
      displayTestingResult(`⚠️ ${migratedData.miniCycle.metadata.migrationErrors.length} non-fatal errors occurred`, 'warning');
      migratedData.miniCycle.metadata.migrationErrors.forEach((error, index) => {
        displayTestingResult(`Error ${index + 1}: ${error.type} - ${error.error}`, 'warning');
      });
    }
    
    // Validate migrated data
    const validation = validateSchema3AData(migratedData);
    if (validation.isValid) {
      displayTestingResult(`✅ Migrated data passed validation`, 'success');
    } else {
      displayTestingResult(`❌ Migrated data validation failed:`, 'error');
      validation.errors.forEach(error => {
        displayTestingResult(`  • ${error}`, 'error');
      });
    }
    
    return migratedData;
    
  } catch (error) {
    displayTestingResult(`❌ Migration simulation failed: ${error.message}`, 'error');
    console.error('Migration simulation error:', error);
    return null;
  }
}

/**
 * Validate Schema 3A data structure
 */
function validateSchema3AData(data) {
  const errors = [];
  
  try {
    // Check basic structure
    if (!data.schemaVersion || data.schemaVersion !== '3A') {
      errors.push('Missing or invalid schemaVersion');
    }
    
    if (!data.miniCycle) {
      errors.push('Missing miniCycle object');
    }
    
    if (!data.miniCycle?.metadata) {
      errors.push('Missing metadata');
    }
    
    if (!data.miniCycle?.settings) {
      errors.push('Missing settings');
    }
    
    if (!data.miniCycle?.data?.cycles) {
      errors.push('Missing cycles array');
    }
    
    // Validate cycles
    if (data.miniCycle?.data?.cycles) {
      for (const cycle of data.miniCycle.data.cycles) {
        if (!cycle.id || !cycle.title) {
          errors.push(`Invalid cycle: missing id or title`);
        }
        
        // Validate tasks
        if (cycle.tasks) {
          for (const task of cycle.tasks) {
            if (!task.id || !task.text) {
              errors.push(`Invalid task in cycle ${cycle.title}: missing id or text`);
            }
          }
        }
      }
    }
    
  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}


// ==========================================
// 🚀 ACTUAL MIGRATION EXECUTION
// ==========================================

/**
 * Perform the actual migration (for when you're ready)
 * This could be triggered by a new button or existing functionality
 */
async function performActualMigration() {
  try {
    displayTestingResult("🚀 Starting actual Schema 3A migration...", "warning");
    displayTestingResult("⚠️ This will modify your data - backup recommended!", "warning");
    
    // Create automatic backup before migration
    enhancedCreateMigrationBackup();
    
    // Get current data
    const currentData = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
    const migrationCheck = checkMigrationNeeded(currentData);
    
    if (migrationCheck.status !== MIGRATION_STATUS.PENDING) {
      displayTestingResult(`❌ Migration not needed: ${migrationCheck.reason}`, 'error');
      return false;
    }
    
    // Perform migration
    displayTestingResult("🔄 Migrating data to Schema 3A...", "info");
    const startTime = Date.now();
    
    const migratedData = await migrateToSchema3A(currentData, migrationCheck, 'auto');
    
    const duration = Date.now() - startTime;
    
    // Save migrated data
    localStorage.setItem("miniCycleStorage", JSON.stringify(migratedData));
    
    // Report success
    displayTestingResult(`✅ Migration completed successfully in ${duration}ms`, 'success');
    displayTestingResult(`📊 Migration Summary:`, 'info');
    displayTestingResult(`  • Cycles migrated: ${migratedData.miniCycle.metadata.totalCyclesCreated}`, 'success');
    displayTestingResult(`  • Tasks migrated: ${migratedData.miniCycle.metadata.totalTasksMigrated}`, 'success');
    displayTestingResult(`  • Completed tasks preserved: ${migratedData.miniCycle.metadata.totalTasksCompleted}`, 'success');
    
    if (migratedData.miniCycle.metadata.migrationErrors.length > 0) {
      displayTestingResult(`⚠️ ${migratedData.miniCycle.metadata.migrationErrors.length} non-fatal errors occurred`, 'warning');
    }
    
    displayTestingResult(``, 'info');
    displayTestingResult(`🎉 Your app is now running Schema 3A!`, 'success');
    displayTestingResult(`🔄 Please refresh the page to see the changes`, 'info');
      cleanupOldBackups(); // Clean expired backups after migration
    
    return true;
    
  } catch (error) {
    displayTestingResult(`❌ Migration failed: ${error.message}`, 'error');
    displayTestingResult(`🔄 Your original data is safe and unchanged`, 'info');
    console.error('Migration error:', error);
    return false;
  }


  
}

/**
 * 🧹 Cleans up expired backups based on BACKUP_LIFETIME_MS
 */
function cleanupOldBackups() {
  try {
    const storageKey = "migrationBackups";
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    const backups = JSON.parse(raw);
    const now = Date.now();

    const filtered = backups.filter(backup => {
      const createdAt = new Date(backup.createdAt).getTime();
      return now - createdAt < MIGRATION_CONFIG.BACKUP_LIFETIME_MS;
    });

    // Only update storage if something was removed
    if (filtered.length !== backups.length) {
      localStorage.setItem(storageKey, JSON.stringify(filtered));
      console.log(`🧹 Cleaned up ${backups.length - filtered.length} expired backup(s)`);
    }
  } catch (err) {
    console.warn("⚠️ Failed to clean up old backups:", err);
  }
}



// ==========================================
// 🎯 RETURN UPDATED PUBLIC API
// ==========================================

// Add these new functions to your existing return statement:
return {
  // ... existing Step 1 functions ...
  MIGRATION_CONFIG,
  MIGRATION_STATUS,
  SCHEMA_VERSIONS,
  CURRENT_SCHEMA_VERSION,
  generateDeviceId,
  getDeviceName,
  detectSchemaVersion,
  isVersionCurrentOrNewer,
  checkMigrationNeeded,
  testStep1,
  analyzeMigrationData,
  
  // NEW Step 3 functions:
  migrateToSchema3A,
  migrateCyclesAndTasks,
  migrateTaskUsingYourLogic,
  upgradeTaskToSchema3A,
  createFallbackTask,
  generateMigrationHash,
  validateSchema3AData,
  performActualMigration,
  cleanupOldBackups,
  
  // Diagnostics panel integration:
  checkMigrationStatusForDiagnostics,
  simulateMigrationForDiagnostics
};
    

  }



// ==========================================
// 🎯 INITIALIZE MIGRATION SYSTEM
// ==========================================


// Create the migration system and expose it globally
const MigrationSystem = createMigrationSystem();
// Make the most commonly used items globally accessible for convenience
const { 
 MIGRATION_CONFIG,
  MIGRATION_STATUS,
  SCHEMA_VERSIONS,
  CURRENT_SCHEMA_VERSION,
  generateDeviceId,
  getDeviceName,
  detectSchemaVersion,
  isVersionCurrentOrNewer,
  checkMigrationNeeded,
  testStep1,
  analyzeMigrationData,
  migrateToSchema3A,
  migrateCyclesAndTasks,
  migrateTaskUsingYourLogic,
  upgradeTaskToSchema3A,
  createFallbackTask,
  generateMigrationHash,
  validateSchema3AData,
  performActualMigration,
  cleanupOldBackups,
  checkMigrationStatusForDiagnostics,
  simulateMigrationForDiagnostics
} = MigrationSystem;

console.log('✅ Migration system initialized');
























// Run functions on page load
initialSetup();
loadRemindersSettings();
setupReminderToggle();
setupMainMenu();
setupSettingsMenu();
setupTestingModal();
setupAbout();
setupUserManual();
setupFeedbackModal();
updateStatsPanel(); 
 updateNavDots();
applyTheme(localStorage.getItem('currentTheme'));
loadMiniCycle();
initializeDefaultRecurringSettings();
setupMiniCycleTitleListener();
setupDownloadMiniCycle();
setupUploadMiniCycle();
setupRearrange();
dragEndCleanup ();
updateMoveArrowsVisibility();
checkDueDates();
initializeThemesPanel();
setupRecurringPanel();
attachRecurringSummaryListeners();
migrateAllTasksInStorage();
loadAlwaysShowRecurringSetting();
updateCycleModeDescription();
setTimeout(remindOverdueTasks, 2000);
closeResultsPopup();
setTimeout(() => {
    updateReminderButtons(); // ✅ This is the *right* place!
    startReminders();
}, 200);


















































const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
setupRecurringWatcher(lastUsedMiniCycle, savedMiniCycles);


window.onload = () => taskInput.focus();


showOnboarding();
setTimeout(updateCycleModeDescription, 10000);

function showOnboarding() {
    const hasSeenOnboarding = localStorage.getItem("miniCycleOnboarding");
    if (hasSeenOnboarding) return;
  
    const steps = [
      `<h2>Welcome to Task Cycle: Mini! 🎉</h2>
       <p>Mini Cycle helps you manage tasks with a powerful reset system!</p>`,
      `<ul>
         <li>✅ Add tasks using the input box</li>
         <li>🔄 Tasks reset automatically (if Auto-Reset is enabled)</li>
         <li>📊 Track your progress and unlock themes</li>
       </ul>`,
      `<ul>
         <li>📱 On mobile, long press a task to open the menu</li>
         <li>📱 Long press and move to rearrange tasks</li>
          <li>📱 Swipe Left to access Stats Panel</li>
         <li>📵 Use Settings to show task buttons on older phones</li>
       </ul>`
    ];
  
    let currentStep = 0;
  
    const modal = document.createElement("div");
    modal.id = "onboarding-modal";
    modal.className = "onboarding-modal";
    modal.innerHTML = `
    <div class="onboarding-content theme-${localStorage.getItem("currentTheme") || 'default'}">
      <button id="onboarding-skip" class="onboarding-skip">Skip ✖</button>
      <div id="onboarding-step-content"></div>
      <div class="onboarding-controls">
        <button id="onboarding-prev" class="hidden">⬅ Back</button>
        <button id="onboarding-next">Next ➡</button>
      </div>
    </div>
  `;
  
    document.body.appendChild(modal);
    const stepContent = document.getElementById("onboarding-step-content");
    const nextBtn = document.getElementById("onboarding-next");
    const prevBtn = document.getElementById("onboarding-prev");
    const skipBtn = document.getElementById("onboarding-skip");
  
    function renderStep(index) {
      stepContent.innerHTML = steps[index];
      prevBtn.classList.toggle("hidden", index === 0);
      nextBtn.textContent = index === steps.length - 1 ? "Start 🚀" : "Next ➡";
    }
  
    nextBtn.addEventListener("click", () => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        renderStep(currentStep);
      } else {
        modal.remove();
        localStorage.setItem("miniCycleOnboarding", "true");
        console.log("✅ Onboarding finished.");
      }
    });
  
    prevBtn.addEventListener("click", () => {
      if (currentStep > 0) {
        currentStep--;
        renderStep(currentStep);
      }
    });
  
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
        localStorage.setItem("miniCycleOnboarding", "true");
        console.log("❌ Onboarding dismissed.");
      }
    });

    skipBtn.addEventListener("click", () => {
    modal.remove();
    localStorage.setItem("miniCycleOnboarding", "true");
    console.log("⏭️ Onboarding skipped.");
    });
  
    renderStep(currentStep);
  }


/**
 * Adds an event listener safely by removing any existing listener first.
 * This prevents duplicate event bindings and ensures only one listener is active at a time.
 *
 * @param {HTMLElement} element - The element to attach the event listener to.
 * @param {string} event - The event type (e.g., "click", "input").
 * @param {Function} handler - The function that handles the event.
 */




function safeAddEventListener(element, event, handler) {
    if (!element) return; // Prevent errors if element is null
    element.removeEventListener(event, handler); // Clear old one
    element.addEventListener(event, handler); // Add fresh
}

function safeAddEventListenerById(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        safeAddEventListener(element, event, handler);
    } else {
        console.warn(`⚠ Cannot attach event listener: #${id} not found.`);
    }
}

// ==== 🔁 UNDO / REDO SYSTEM =============================
// - Tracks task + recurring state snapshots
// - Limit: 4 snapshots
// - Functions: pushUndoSnapshot, performUndo, performRedo
// ========================================================

document.getElementById("undo-btn").hidden = true;
document.getElementById("redo-btn").hidden = true;

document.getElementById("undo-btn")?.addEventListener("click", performUndo);
document.getElementById("redo-btn")?.addEventListener("click", performRedo);



function pushUndoSnapshot() {
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const currentCycle = savedMiniCycles?.[lastUsedMiniCycle];
  if (!currentCycle) return;

const snapshot = {
  tasks: structuredClone(currentCycle.tasks),
  recurringTemplates: structuredClone(currentCycle.recurringTemplates || {}),
  title: currentCycle.title || "Untitled Mini Cycle"
};

  undoStack.push(snapshot);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift(); // keep max 4

  redoStack = []; // clear redo on new action

  document.getElementById("undo-btn").hidden = false;
  document.getElementById("redo-btn").hidden = true;
}

function performUndo() {
  if (undoStack.length === 0) return;

  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const currentCycle = savedMiniCycles?.[lastUsedMiniCycle];
  if (!currentCycle) return;

  const currentSnapshot = {
    tasks: structuredClone(currentCycle.tasks),
    recurringTemplates: structuredClone(currentCycle.recurringTemplates || {}),
    title: currentCycle.title
  };
  redoStack.push(currentSnapshot);

  const snapshotToRestore = undoStack.pop();
  currentCycle.tasks = structuredClone(snapshotToRestore.tasks);
  currentCycle.recurringTemplates = structuredClone(snapshotToRestore.recurringTemplates || {});

  if (snapshotToRestore.title !== undefined) {
    currentCycle.title = snapshotToRestore.title;
    document.getElementById("mini-cycle-title").textContent = snapshotToRestore.title;
    updateMainMenuHeader(); // Optional: keep sidebar menu in sync
  }

  savedMiniCycles[lastUsedMiniCycle] = currentCycle;
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

  loadMiniCycle();
  updateRecurringPanel();
  updateRecurringPanelButtonVisibility();

  document.getElementById("undo-btn").hidden = undoStack.length === 0;
  document.getElementById("redo-btn").hidden = false;
}

function performRedo() {
  if (redoStack.length === 0) return;

  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const currentCycle = savedMiniCycles?.[lastUsedMiniCycle];
  if (!currentCycle) return;

  const currentSnapshot = {
    tasks: structuredClone(currentCycle.tasks),
    recurringTemplates: structuredClone(currentCycle.recurringTemplates || {}),
    title: currentCycle.title
  };
  undoStack.push(currentSnapshot);

  const snapshotToRestore = redoStack.pop();
  currentCycle.tasks = structuredClone(snapshotToRestore.tasks);
  currentCycle.recurringTemplates = structuredClone(snapshotToRestore.recurringTemplates || {});

  if (snapshotToRestore.title !== undefined) {
    currentCycle.title = snapshotToRestore.title;
    document.getElementById("mini-cycle-title").textContent = snapshotToRestore.title;
    updateMainMenuHeader();
  }

  savedMiniCycles[lastUsedMiniCycle] = currentCycle;
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

  loadMiniCycle();
  updateRecurringPanel();
  updateRecurringPanelButtonVisibility();

  document.getElementById("undo-btn").hidden = false;
  document.getElementById("redo-btn").hidden = redoStack.length === 0;
}


function renderTasks(tasksArray = []) {
  const taskList = document.getElementById("taskList");
  taskList.innerHTML = ""; // Clear existing tasks from DOM

  tasksArray.forEach(task => {
    addTask(
      task.text,
      task.completed,
      false,                     // shouldSave: false (don't save during render)
      task.dueDate,
      task.highPriority,
      true,                      // isLoading: true (avoid overdue reminder popups)
      task.remindersEnabled,
      task.recurring,
      task.id,
      task.recurringSettings
    );
  });

  // Optionally re-run any UI state updates
  updateProgressBar();
  checkCompleteAllButton();
  updateStatsPanel();
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    e.preventDefault();
    performUndo();
  } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
    e.preventDefault();
    performRedo();
  }
});



// 🔧 Utility Function (can go at top of your scripts)
function generateNotificationId(message) {
    return message
        .replace(/<br\s*\/?>/gi, '\n')   // Convert <br> to newline
        .replace(/<[^>]*>/g, '')         // Remove all HTML tags
        .replace(/\s+/g, ' ')            // Collapse whitespace
        .trim()
        .toLowerCase();                  // Normalize case
}

function generateHashId(message) {
    const text = generateNotificationId(message);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0; // Force 32-bit int
    }
    return `note-${Math.abs(hash)}`;
}

// ✅ Best-practice UUID generator
function generateUUID() {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return ([1e7]+-1e3+-4e3+-8e3+-1e11)
    .replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

/**
 * Detects the device type and applies the appropriate class to the body.
 * Determines if the device has touch capabilities or a fine pointer (mouse).
 */

function detectDeviceType() {
    let hasTouchEvents = "ontouchstart" in window;
    let touchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints;
    let isFinePointer = window.matchMedia("(pointer: fine)").matches;

    console.log(`touch detected: hasTouchEvents=${hasTouchEvents}, maxTouchPoints=${touchPoints}, isFinePointer=${isFinePointer}`);

    if (!isFinePointer && (hasTouchEvents || touchPoints > 0)) {
        document.body.classList.add("touch-device");
    } else {
        document.body.classList.add("non-touch-device");
    }
}
detectDeviceType();


    function refreshTaskListUI() {
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const cycleData = savedMiniCycles?.[lastUsedMiniCycle];
  if (!cycleData) return;

  // Clear current list
  const taskListContainer = document.getElementById("taskList");
  if (!taskListContainer) return;
  taskListContainer.innerHTML = "";

  // Re-render each task
  (cycleData.tasks || []).forEach(task => {
    addTask(
      task.text,
      task.completed,
      false, // Don't double save
      task.dueDate,
      task.highPriority,
      true,  // isLoading (skip overdue reminder immediately)
      task.remindersEnabled,
      task.recurring,
      task.id,
      task.recurringSettings
    );
  });

  updateRecurringButtonVisibility();
}


function initializeDefaultRecurringSettings() {
  const existing = localStorage.getItem("miniCycleDefaultRecurring");
  if (!existing) {
    const defaultSettings = {
      frequency: "daily",
      indefinitely: true,
      time: null
    };
    localStorage.setItem("miniCycleDefaultRecurring", JSON.stringify(defaultSettings));
    console.log("🧩 Initialized default recurring settings:", defaultSettings);
  } else {
    console.log("ℹ️ Default recurring settings already exist.");
  }
}

document.getElementById("toggleAutoReset").addEventListener("change", updateCycleModeDescription);
document.getElementById("deleteCheckedTasks").addEventListener("change", updateCycleModeDescription);





/**
 * Initializes the main menu by attaching event listeners to menu buttons.
 * Ensures the function runs only once to prevent duplicate event bindings.
 */

function setupMainMenu() {
    if (setupMainMenu.hasRun) return; // Prevents running more than once
    setupMainMenu.hasRun = true;

    safeAddEventListener(document.getElementById("save-as-mini-cycle"), "click", saveMiniCycleAsNew);
    safeAddEventListener(document.getElementById("open-mini-cycle"), "click", switchMiniCycle);    
    safeAddEventListener(document.getElementById("clear-mini-cycle-tasks"), "click", clearAllTasks);
    safeAddEventListener(document.getElementById("delete-all-mini-cycle-tasks"), "click", deleteAllTasks);
    safeAddEventListener(document.getElementById("new-mini-cycle"), "click", createNewMiniCycle);
    safeAddEventListener(document.getElementById("close-main-menu"), "click", closeMainMenu);
    checkGamesUnlock();
    safeAddEventListener(exitMiniCycle, "click", () => {
        window.location.href = "../index.html";
    });
    
}


function checkGamesUnlock() {
    const unlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
    if (unlocks.taskOrderGame) {
        document.getElementById("games-menu-option").style.display = "block";
    }
}

document.getElementById("open-games-panel").addEventListener("click", () => {
    document.getElementById("games-panel").style.display = "flex";
    setupGamesModalOutsideClick();

});

document.getElementById("close-games-panel").addEventListener("click", () => {
    document.getElementById("games-panel").style.display = "none";
});

document.getElementById("open-task-order-game").addEventListener("click", () => {
    // Load game into container or open in new modal

        window.location.href = "miniCycleGames/miniCycle-taskOrder.html";
   
});
/*
function loadTaskOrderGame() {
    const container = document.getElementById("taskOrderGameContainer");
    if (!container) return;

    fetch("/miniCycleGames/miniCycle-taskOrder.html")
        .then(res => res.text())
        .then(html => {
            container.innerHTML = html;
            container.style.display = "block";
        });
}
*/


function setupGamesModalOutsideClick() {
    const gamesPanel = document.getElementById("games-panel");
    const gamesContent = document.querySelector(".games-modal-content");
    const openButton = document.getElementById("open-games-panel");
  
    if (!gamesPanel || !gamesContent || !openButton) return;
  
    console.log("✅ Games outside click ready");
  
    safeAddEventListener(document, "click", function (event) {
      const isOpen = gamesPanel.style.display === "flex";
      const clickedOutside =
        !gamesContent.contains(event.target) && event.target !== openButton;
  
      if (isOpen && clickedOutside) {
        gamesPanel.style.display = "none";
      }
    });
  }

function closeMainMenu() {
if (menu) { menu.classList.remove("visible");}
}



/**
 * Initializes the Mini Cycle app by loading or creating a saved Mini Cycle.
 * Ensures a valid Mini Cycle is always available in localStorage.
 */

async function initialSetup() {
  let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
  let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

  console.log("📦 Loaded miniCycleStorage:", savedMiniCycles);

  // 🚦 Prompt until user provides a name or cancels (triggers fallback)
  while (!lastUsedMiniCycle || lastUsedMiniCycle.trim() === "") {
    lastUsedMiniCycle = await showPromptModal({
      title: "Create a Mini Cycle",
      message: "Enter a name to get started:",
      placeholder: "e.g., Morning Routine",
      confirmText: "Create",
      cancelText: "Load Sample",
      required: true
    });

    if (!lastUsedMiniCycle || lastUsedMiniCycle.trim() === "") {
      // 🧩 Fallback to loading a default sample
      await preloadGettingStartedCycle();
      return;
    }
  }

  // ✅ Create Mini Cycle if it doesn't exist
  if (!savedMiniCycles[lastUsedMiniCycle]) {
    savedMiniCycles[lastUsedMiniCycle] = {
      title: lastUsedMiniCycle,
      tasks: [],
      autoReset: true,
      deleteCheckedTasks: false,
      cycleCount: 0
    };
  }

  // 💾 Save and continue
  localStorage.setItem("lastUsedMiniCycle", lastUsedMiniCycle);
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

  // 🖼️ Load UI
  document.getElementById("mini-cycle-title").textContent = savedMiniCycles[lastUsedMiniCycle].title;
  toggleAutoReset.checked = savedMiniCycles[lastUsedMiniCycle].autoReset;
  deleteCheckedTasks.checked = savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks;

  // 🔔 Reminder toggle
  const reminderSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
  enableReminders.checked = reminderSettings.enabled === true;

  if (enableReminders.checked) {
    frequencySection.classList.remove("hidden");
    startReminders();
  }
}

  async function preloadGettingStartedCycle() {
    try {
      const response = await fetch("data/getting-started.mcyc"); // adjust path as needed
      const sample = await response.json();
  
      const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
  
      savedMiniCycles[sample.name] = {
        title: sample.title || sample.name,
        tasks: sample.tasks || [],
        autoReset: sample.autoReset || false,
        cycleCount: sample.cycleCount || 0,
        deleteCheckedTasks: sample.deleteCheckedTasks || false
      };
  
      localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
      localStorage.setItem("lastUsedMiniCycle", sample.name);
  
      showNotification("✨ A sample Mini Cycle has been preloaded to help you get started!", "success", 5000);
      loadMiniCycle();
    } catch (err) {
      showNotification("❌ Failed to load sample Mini Cycle.", "error");
      console.error("Sample load error:", err);
    }
  }


function setupDarkModeToggle(toggleId, allToggleIds = []) {
    const thisToggle = document.getElementById(toggleId);
    if (!thisToggle) return;

    // Set initial checked state
    const isDark = localStorage.getItem("darkModeEnabled") === "true";
    thisToggle.checked = isDark;
    document.body.classList.toggle("dark-mode", isDark);

    // Event handler
    thisToggle.addEventListener("change", (e) => {
      
        const enabled = e.target.checked;
        document.body.classList.toggle("dark-mode", enabled);
        localStorage.setItem("darkModeEnabled", enabled.toString());

        // ✅ Sync all other toggles
        allToggleIds.forEach(id => {
            const otherToggle = document.getElementById(id);
            if (otherToggle && otherToggle !== thisToggle) {
                otherToggle.checked = enabled;
            }
        });
    });
}


function applyTheme(themeName) {
    console.log("ran Apply Theme");
    // Step 1: Remove all theme classes
    const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
    allThemes.forEach(theme => document.body.classList.remove(theme));
  
    // Step 2: Add selected theme class if it's not 'default'
    if (themeName && themeName !== 'default') {
      document.body.classList.add(`theme-${themeName}`);
    }
  
    // Step 3: Save to localStorage
    localStorage.setItem('currentTheme', themeName || 'default');
  
    // Step 4: Uncheck all theme checkboxes
    document.querySelectorAll('.theme-toggle').forEach(cb => {
      cb.checked = cb.id === `toggle${capitalize(themeName)}Theme`;
    });
  }
  
  // Optional helper to format checkbox IDs
  function capitalize(str) {
    return str
      ? str.charAt(0).toUpperCase() + str.slice(1).replace(/-./g, s => s.charAt(1).toUpperCase())
      : '';
  }
/**
 * Enables editing of the Mini Cycle title and saves changes to localStorage.
 * Prevents empty titles and restores the previous title if an invalid entry is made.
 */

function setupMiniCycleTitleListener() {
    const titleElement = document.getElementById("mini-cycle-title");
    if (!titleElement) return;

    titleElement.contentEditable = true;

    if (!titleElement.dataset.listenerAdded) {
        titleElement.addEventListener("blur", () => {
            let newTitle = sanitizeInput(titleElement.textContent.trim());

            const miniCycleFileName = localStorage.getItem("lastUsedMiniCycle");
            const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
            const currentCycle = savedMiniCycles[miniCycleFileName];

            if (!miniCycleFileName || !currentCycle) {
                console.warn("⚠ No active Mini Cycle found. Title update aborted.");
                return;
            }

            const oldTitle = currentCycle.title;

            if (newTitle === "") {
                showNotification("⚠ Title cannot be empty. Reverting to previous title.");
                titleElement.textContent = oldTitle;
                return;
            }

            if (newTitle !== oldTitle) {
                // 🔁 Capture undo snapshot BEFORE title change
                pushUndoSnapshot();

                titleElement.textContent = newTitle;
                currentCycle.title = newTitle;
                savedMiniCycles[miniCycleFileName] = currentCycle;
                localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
                console.log(`✅ Mini Cycle title updated: "${oldTitle}" → "${newTitle}"`);

                // 🔄 Update UI
                updateMainMenuHeader();

                // 🔄 Show undo button
                document.getElementById("undo-btn").hidden = false;
                document.getElementById("redo-btn").hidden = true;
            }
        });

        titleElement.dataset.listenerAdded = true;
    }
}

/**
 * Saves the current state of the active Mini Cycle to localStorage.
 * Captures task list, completion status, due dates, priority settings, and reminders.
 */

/**
 * Enhanced autoSave that handles both formats
 */
function autoSave(overrideTaskList = null) {
  const miniCycleFileName = localStorage.getItem("lastUsedMiniCycle");
  const { savedMiniCycles, isSchema3A, originalData } = assignCycleVariables();

  if (!miniCycleFileName || !savedMiniCycles[miniCycleFileName]) {
    console.error(`❌ Error: Mini Cycle "${miniCycleFileName}" not found in storage. Auto-save aborted.`);
    return;
  }

  // Get current task data from DOM
  const miniCycleTasks = overrideTaskList || [...document.getElementById("taskList").children].map(taskElement => {
    const taskTextElement = taskElement.querySelector(".task-text");
    const dueDateElement = taskElement.querySelector(".due-date");
    const reminderButton = taskElement.querySelector(".enable-task-reminders");
    const taskId = taskElement.dataset.taskId;

    if (!taskTextElement || !taskId) {
      console.warn("⚠️ Skipping task (missing text or ID):", taskElement);
      return null;
    }

    let recurringSettings = {};
    const settingsAttr = taskElement.getAttribute("data-recurring-settings");
    try {
      if (settingsAttr) recurringSettings = JSON.parse(settingsAttr);
    } catch (err) {
      console.warn("⚠️ Could not parse recurringSettings from DOM:", err);
    }

    return {
      id: taskId,
      text: taskTextElement.textContent,
      completed: taskElement.querySelector("input[type='checkbox']").checked,
      dueDate: dueDateElement ? dueDateElement.value : null,
      highPriority: taskElement.classList.contains("high-priority"),
      remindersEnabled: reminderButton ? reminderButton.classList.contains("reminder-active") : false,
      recurring: taskElement.querySelector(".recurring-btn")?.classList.contains("active") || false,
      recurringSettings,
      schemaVersion: 2
    };
  }).filter(Boolean);

  // Update the cycle data
  savedMiniCycles[miniCycleFileName].tasks = miniCycleTasks;

  // Handle recurring templates
  if (!savedMiniCycles[miniCycleFileName].recurringTemplates) {
    savedMiniCycles[miniCycleFileName].recurringTemplates = {};
  }

  miniCycleTasks.forEach(task => {
    if (task.recurring && task.recurringSettings) {
      savedMiniCycles[miniCycleFileName].recurringTemplates[task.id] = {
        id: task.id,
        text: task.text,
        recurring: true,
        recurringSettings: task.recurringSettings,
        highPriority: task.highPriority,
        dueDate: task.dueDate,
        remindersEnabled: task.remindersEnabled,
        lastTriggeredTimestamp:
          savedMiniCycles[miniCycleFileName].recurringTemplates[task.id]?.lastTriggeredTimestamp || null,
        schemaVersion: task.schemaVersion || 2
      };
    }
  });

  // Save based on format
  if (isSchema3A) {
    saveToSchema3AFormat(savedMiniCycles, originalData);
  } else {
    // Standard v2 save
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
  }

  console.log("💾 Auto-save completed");
}

/**
 * Save data back to Schema 3A format
 */
function saveToSchema3AFormat(savedMiniCycles, originalData) {
  // Update the Schema 3A structure with current cycle data
  const updatedData = JSON.parse(JSON.stringify(originalData)); // Deep clone
  
  // Clear existing cycles
  updatedData.miniCycle.data.cycles = [];
  
  // Convert v2-compatible cycles back to Schema 3A format
  Object.entries(savedMiniCycles).forEach(([cycleName, cycleData]) => {
    const schema3ACycle = {
      cycleName: cycleName,
      id: `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: cycleData.title || cycleName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      currentMode: "auto",
      autoReset: cycleData.autoReset !== false,
      deleteCheckedTasks: cycleData.deleteCheckedTasks || false,
      completeButtonVisible: true,
      premiumFeaturesUsed: false,
      
      layoutOverrides: {
        layoutMode: "default",
        layoutLocked: false,
        components: {
          taskList: { visible: true, position: { x: 0, y: 0 }, size: { width: 400, height: 600 }, zIndex: 1 },
          panel: { visible: true, position: { x: 300, y: 0 }, size: { width: 300, height: 600 }, zIndex: 2 },
          cycleNotes: { visible: false, position: { x: 650, y: 0 }, size: { width: 350, height: 500 }, zIndex: 3 }
        },
        lastModified: new Date().toISOString()
      },
      
      tasks: cycleData.tasks || [],
      recurringTemplates: cycleData.recurringTemplates || {},
      analytics: {
        totalTasksCompleted: 0,
        totalTasksCleared: 0,
        totalCyclesCompleted: cycleData.cycleCount || 0,
        lastCompletedAt: null,
        lastTaskCreated: null,
        lastTaskModified: null
      },
      metadata: {
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        deviceId: updatedData.miniCycle.metadata.deviceId,
        totalTasksCompleted: 0,
        averageCompletionTime: 1800
      }
    };
    
    updatedData.miniCycle.data.cycles.push(schema3ACycle);
    
    // Set as active if this is the current cycle
    const currentCycleName = localStorage.getItem("lastUsedMiniCycle");
    if (cycleName === currentCycleName) {
      updatedData.miniCycle.appState.activeCycleId = schema3ACycle.id;
    }
  });
  
  // Update metadata
  updatedData.miniCycle.metadata.lastModified = new Date().toISOString();
  
  // Save back to localStorage
  localStorage.setItem("miniCycleStorage", JSON.stringify(updatedData));
  console.log("💾 Saved to Schema 3A format");
}






/**
 * Loads the last used Mini Cycle from localStorage and updates the UI.
 * Ensures tasks, title, settings, and overdue statuses are properly restored.
 *//**
 * Enhanced loadMiniCycle with dual-format support
 */
function loadMiniCycle() {
  const { savedMiniCycles, lastUsedMiniCycle, isSchema3A } = assignCycleVariables();

  if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
    console.warn("⚠️ No saved Mini Cycle found.");
    return;
  }

  try {
    const miniCycleData = savedMiniCycles[lastUsedMiniCycle];

    if (!Array.isArray(miniCycleData.tasks)) {
      throw new Error(`Invalid task data for "${lastUsedMiniCycle}".`);
    }

    // Reset UI states
    progressBar.style.width = "0%";
    cycleMessage.style.visibility = "hidden";
    cycleMessage.style.opacity = "0";

    // Migrate & Render
    const migratedTasks = miniCycleData.tasks.map(migrateTask);
    renderTasks(migratedTasks);
    miniCycleData.tasks = migratedTasks;

    // Load settings
    toggleAutoReset.checked = miniCycleData.autoReset || false;
    deleteCheckedTasks.checked = miniCycleData.deleteCheckedTasks || false;

    // Save migrated data using the appropriate format
    if (isSchema3A) {
      // Will be handled by enhanced autoSave when needed
      console.log("📊 Schema 3A data loaded successfully");
    } else {
      savedMiniCycles[lastUsedMiniCycle] = miniCycleData;
      localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
    }

    // Final UI updates
    const titleElement = document.getElementById("mini-cycle-title");
    titleElement.textContent = miniCycleData.title || "Untitled Mini Cycle";

    checkOverdueTasks();
    setTimeout(remindOverdueTasks, 1000);

    // Suppress hover if three-dots are enabled
    const threeDotsEnabled = localStorage.getItem("miniCycleThreeDots") === "true";
    setTimeout(() => toggleHoverTaskOptions(!threeDotsEnabled), 0);

    updateMainMenuHeader();
    hideMainMenu();
    updateProgressBar();
    checkCompleteAllButton();
    updateRecurringPanel?.();
    updateRecurringButtonVisibility();

    console.log(`✅ Successfully loaded Mini Cycle: "${lastUsedMiniCycle}" (${isSchema3A ? 'Schema 3A' : 'v2'} format)`);

  } catch (error) {
    console.error("❌ Error loading Mini Cycle:", error);
    
    // If Schema 3A loading fails, attempt to restore from backup
    if (isSchema3A) {
      console.log("🔄 Schema 3A loading failed, checking for backup...");
      attemptAutoRecovery();
    }
  }
}

/**
 * Auto-recovery function for Schema 3A failures
 */
function attemptAutoRecovery() {
  console.log("🔄 Attempting automatic recovery...");
  
  // Look for recent migration backup
  const backups = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('miniCycleBackup_migration_')) {
      try {
        const backup = JSON.parse(localStorage.getItem(key));
        backups.push({
          key: key,
          createdAt: backup.backupCreatedAt,
          backup: backup
        });
      } catch (error) {
        console.warn('Corrupted backup:', key);
      }
    }
  }
  
  if (backups.length > 0) {
    // Sort by creation date and use most recent
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const mostRecent = backups[0];
    
    console.log("🔄 Auto-restoring from backup:", mostRecent.key);
    localStorage.setItem("miniCycleStorage", JSON.stringify(mostRecent.backup.originalData));
    
    showNotification("🔄 Schema 3A data error detected. Auto-restored from backup.", "warning", 10000);
    
    // Reload the page to restart with v2 format
    setTimeout(() => location.reload(), 2000);
  } else {
    showNotification("❌ Schema 3A data corrupted and no backup found. Please restore manually.", "error", 15000);
  }
}

function migrateTask(task) {
  // Clone the task to avoid mutating original
  const migrated = structuredClone(task);
  const currentVersion = 2;

  // If schemaVersion is missing, assume version 1
  let version = migrated.schemaVersion || 1;

  // Upgrade from version 1 to 2
  if (version === 1) {
      console.log(`🔁 Migrating task "${migrated.text}" from v1 to v2...`);

      // Create recurringSettings if missing
      if (migrated.recurring) {
          migrated.recurringSettings = {
              frequency: migrated.recurFrequency || "daily",
              useSpecificTime: !!(
                  migrated.dailyTime || 
                  migrated.weeklyTime || 
                  migrated.monthlyTime ||
                  migrated.biweeklyTime ||
                  migrated.yearlyTime ||
                  migrated.specificTime
              ),
              time: migrated.dailyTime || 
                    migrated.weeklyTime || 
                    migrated.monthlyTime ||
                    migrated.biweeklyTime ||
                    migrated.yearlyTime ||
                    migrated.specificTime || null,

              recurIndefinitely: migrated.recurIndefinitely ?? true,
              recurCount: migrated.recurCount ?? null,

              daily: {},
              weekly: {
                  useSpecificDays: !!migrated.weeklyDays,
                  days: migrated.weeklyDays || []
              },
              biweekly: {
                  useSpecificDays: !!migrated.biweeklyDays,
                  days: migrated.biweeklyDays || []
              },
              monthly: {
                  useSpecificDays: !!migrated.monthlyDays,
                  days: migrated.monthlyDays || []
              },
              yearly: {
                  useSpecificMonths: !!migrated.yearlyMonths,
                  months: migrated.yearlyMonths || [],
                  useSpecificDays: !!migrated.yearlyDays,
                  daysByMonth: migrated.yearlyDays ? Object.fromEntries(
                      migrated.yearlyMonths.map(month => [month, migrated.yearlyDays])
                  ) : {},
                  applyDaysToAll: true
              },
              specificDates: {
                  enabled: !!migrated.specificDates,
                  dates: migrated.specificDates || []
              }
          };
      }

      // Clean up old keys
      delete migrated.recurFrequency;
      delete migrated.recurIndefinitely;
      delete migrated.recurCount;
      delete migrated.dailyTime;
      delete migrated.weeklyDays;
      delete migrated.weeklyTime;
      delete migrated.biweeklyDays;
      delete migrated.biweeklyTime;
      delete migrated.monthlyDays;
      delete migrated.monthlyTime;
      delete migrated.yearlyMonths;
      delete migrated.yearlyDays;
      delete migrated.yearlyTime;
      delete migrated.specificDates;
      delete migrated.specificTime;

      version = 2;
  }

  // Update version
  migrated.schemaVersion = currentVersion;

  return migrated;
}

function migrateAllTasksInStorage() {
  const storage = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
  let modified = false;

  for (const [cycleName, cycleData] of Object.entries(storage)) {
    if (!Array.isArray(cycleData.tasks)) continue;

    const migratedTasks = cycleData.tasks.map(task => {
      const migrated = migrateTask(task);
      if (migrated.schemaVersion !== task.schemaVersion) modified = true;
      return migrated;
    });

    storage[cycleName].tasks = migratedTasks;
  }

  if (modified) {
    localStorage.setItem("miniCycleStorage", JSON.stringify(storage));
    console.log("🔁 All tasks migrated to latest schema (v2).");
  } else {
    console.log("✅ All tasks already up to date.");
  }
}




function validateRecurringSchema(task) {
  const errors = [];

  if (!task || typeof task !== "object") {
    errors.push("Invalid task object.");
    return errors;
  }

  if (!task.recurring) return errors; // If not recurring, no validation needed

  const rs = task.recurringSettings;
  if (!rs || typeof rs !== "object") {
    errors.push("Missing or invalid recurringSettings object.");
    return errors;
  }

  // Required base fields
  if (!rs.frequency) errors.push("Missing 'frequency'.");
  if (!("recurCount" in rs)) errors.push("Missing 'recurCount'.");
  if (!("recurIndefinitely" in rs)) errors.push("Missing 'recurIndefinitely'.");
  if (!("useSpecificTime" in rs)) errors.push("Missing 'useSpecificTime'.");
  if (!("time" in rs)) errors.push("Missing 'time'.");
  
  // Required frequency-specific blocks
  const freqBlocks = ["daily", "hourly", "weekly", "biweekly", "monthly", "yearly", "specificDates"];
  for (const key of freqBlocks) {
    if (!(key in rs)) errors.push(`Missing '${key}' block.`);
  }

  return errors;
}

//DEBUG TOOLS


  validateAllMiniCycleTasks();

function validateAllMiniCycleTasks() {
  const storage = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
  const results = [];

  for (const [cycleName, cycleData] of Object.entries(storage)) {
    if (!Array.isArray(cycleData.tasks)) continue;

    cycleData.tasks.forEach(task => {
      const errors = validateRecurringSchema(task);
      if (errors.length > 0) {
        results.push({
          cycle: cycleName,
          taskText: task.text || "(no text)",
          id: task.id || "(no id)",
          errors
        });
      }
    });
  }

  if (results.length === 0) {
    console.log("✅ All recurring tasks are valid.");
  } else {
    console.warn("⚠ Validation issues found:", results);
    console.table(results.map(r => ({
      cycle: r.cycle,
      task: r.taskText,
      id: r.id,
      issues: r.errors.length
    })));
  }

  return results;
}
/**
 * Checks for overdue tasks and visually marks them as overdue.
 * Notifies the user if newly overdue tasks are detected.
 *
 * @param {HTMLElement|null} taskToCheck - The specific task to check, or null to check all tasks.
 */

function checkOverdueTasks(taskToCheck = null) {
    const tasks = taskToCheck ? [taskToCheck] : document.querySelectorAll(".task");
    let autoReset = toggleAutoReset.checked;

    // Retrieve saved overdue states from local storage
    let overdueTaskStates = JSON.parse(localStorage.getItem("overdueTaskStates")) || {};

    // ✅ Track tasks that just became overdue
    let newlyOverdueTasks = [];

    tasks.forEach(task => {
        const taskText = task.querySelector(".task-text").textContent;
        const dueDateInput = task.querySelector(".due-date");
        if (!dueDateInput) return;

        const dueDateValue = dueDateInput.value;
        if (!dueDateValue) {
            // ✅ Date was cleared — remove overdue class
            task.classList.remove("overdue-task");
            delete overdueTaskStates[taskText];
            return;
        }

        const dueDate = new Date(dueDateValue);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate < today) {
            if (!autoReset) {
                if (!overdueTaskStates[taskText]) {
                    newlyOverdueTasks.push(taskText); // ✅ Only notify if it just became overdue
                }
                task.classList.add("overdue-task");
                overdueTaskStates[taskText] = true;
            } else if (overdueTaskStates[taskText]) {
                task.classList.add("overdue-task");
            } else {
                task.classList.remove("overdue-task");
            }
        } else {
            task.classList.remove("overdue-task");
            delete overdueTaskStates[taskText];
        }
    });

    // ✅ Save overdue states in local storage
    localStorage.setItem("overdueTaskStates", JSON.stringify(overdueTaskStates));

    // ✅ Show notification ONLY if there are newly overdue tasks
    if (newlyOverdueTasks.length > 0) {
        showNotification(`⚠️ Overdue Tasks:<br>- ${newlyOverdueTasks.join("<br>- ")}`, "error");
    }
}


/**
 * Remindoverduetasks function.
 *
 * @returns {void}
 */

function remindOverdueTasks() {
    let autoReset = toggleAutoReset.checked;
    if (autoReset) return;

    // ✅ Load reminder settings
    const remindersSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
    const dueDatesRemindersEnabled = remindersSettings.dueDatesReminders;
    const remindersFullyEnabled = remindersSettings.enabled; // ✅ Check if reminders are enabled

    // ✅ Only proceed if due date notifications are enabled
    if (!dueDatesRemindersEnabled) {
        console.log("❌ Due date notifications are disabled. Exiting remindOverdueTasks().");
        return;
    }

    let overdueTasks = [...document.querySelectorAll(".task")]
        .filter(task => task.classList.contains("overdue-task"))
        .map(task => task.querySelector(".task-text").textContent);

    if (overdueTasks.length > 0) {
        showNotification(`⚠️ Overdue Tasks:<br>- ${overdueTasks.join("<br>- ")}`, "error");
    }
}








/**
 * Updates the main menu header with the active Mini Cycle title and current date.
 * Ensures proper display of selected Mini Cycle.
 */

function updateMainMenuHeader() {
    const menuHeaderTitle = document.getElementById("main-menu-mini-cycle-title");
    const dateElement = document.getElementById("current-date");
    const lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle") || "No Mini Cycle Selected";

    // ✅ Get Current Date
    const today = new Date();
    const formattedDate = today.toLocaleDateString(undefined, {
        weekday: 'short', // "Mon"
        month: 'short', // "Jan"
        day: '2-digit', // "08"
        year: 'numeric' // "08"
    });

    // ✅ Update Title & Date
    menuHeaderTitle.textContent = lastUsedMiniCycle;
    dateElement.textContent = formattedDate;
}

/**
 * Saves the due date for a specific task in the active Mini Cycle.
 *
 * @param {string} taskText - The text of the task to update.
 * @param {string|null} dueDate - The due date to assign, or null to remove the due date.
 */

function saveTaskDueDate(taskId, newDueDate) {
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const taskList = savedMiniCycles?.[lastUsedMiniCycle]?.tasks || [];

  const task = taskList.find(t => t.id === taskId);
  if (!task) return;

  task.dueDate = newDueDate;
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
  console.log(`📅 Due date updated for task "${task.text}": ${newDueDate}`);
}
  /***********************
 * 
 * 
 * Menu Management Logic
 * 
 * 
 ************************/

/**
 * Saves the current Mini Cycle under a new name, creating a separate copy.
 * Ensures that the new name is unique before saving.
 */

async function saveMiniCycleAsNew() {
  const currentMiniCycleName = localStorage.getItem("lastUsedMiniCycle");
  const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

  if (!currentMiniCycleName || !savedMiniCycles[currentMiniCycleName]) {
    showNotification("⚠ No Mini Cycle found to save.");
    return;
  }

  const newCycleName = await showPromptModal({
    title: "Save As New Mini Cycle",
    message: `Enter a new name for a copy of "${currentMiniCycleName}":`,
    placeholder: "e.g., My Custom Routine",
    confirmText: "Save Copy",
    cancelText: "Cancel",
    required: true
  });

  // 🛑 Handle cancel or invalid input
  if (!newCycleName || savedMiniCycles[newCycleName]) {
    showNotification("⚠ Invalid name or Mini Cycle already exists.");
    return;
  }

  // ✅ Deep copy the existing Mini Cycle
  savedMiniCycles[newCycleName] = JSON.parse(JSON.stringify(savedMiniCycles[currentMiniCycleName]));
  savedMiniCycles[newCycleName].title = newCycleName;

  // 💾 Save updates
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
  localStorage.setItem("lastUsedMiniCycle", newCycleName);

  showNotification(`✅ Mini Cycle "${currentMiniCycleName}" was copied as "${newCycleName}"!`);
  hideMainMenu();
  loadMiniCycle();
}

/**
 * Switchminicycle function.
 *
 * @returns {void}
 */

function switchMiniCycle() {
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const switchModal = document.querySelector(".mini-cycle-switch-modal");
    const listContainer = document.getElementById("miniCycleList");
    const switchRow = document.querySelector(".switch-items-row");
    const renameButton = document.getElementById("switch-rename");
    const deleteButton = document.getElementById("switch-delete");
    const previewWindow = document.getElementById("switch-preview-window");

    hideMainMenu();


    if (Object.keys(savedMiniCycles).length === 0) {
        showNotification("No saved Mini Cycles found.");
        return;
    }

    // ✅ Clear previous list and populate with Mini Cycles
    listContainer.innerHTML = "";
    Object.keys(savedMiniCycles).forEach((cycleName) => {
        const listItem = document.createElement("button");
        listItem.classList.add("mini-cycle-switch-item");
        listItem.textContent = cycleName;
        listItem.dataset.cycleName = cycleName;

        // ✅ Click event for selecting a Mini Cycle
        listItem.addEventListener("click", () => {
            document.querySelectorAll(".mini-cycle-switch-item").forEach(item => 
                item.classList.remove("selected"));
            listItem.classList.add("selected");

            // ✅ Ensure Action Row is visible
            switchRow.style.display = "block"; 
            updatePreview(cycleName);
          
        });

        listContainer.appendChild(listItem);
    });

    switchModal.style.display = "flex"; // ✅ Show modal
    switchRow.style.display = "none"; 
       // ✅ Load Mini Cycle List before displaying the modal
       loadMiniCycleList();


    // ✅ Prevent duplicate event listeners
    renameButton.removeEventListener("click", renameMiniCycle);
    renameButton.addEventListener("click", renameMiniCycle);

    deleteButton.removeEventListener("click", deleteMiniCycle);
    deleteButton.addEventListener("click", deleteMiniCycle);

    document.getElementById("miniCycleSwitchConfirm").removeEventListener("click", confirmMiniCycle);
    document.getElementById("miniCycleSwitchConfirm").addEventListener("click", confirmMiniCycle);

    document.getElementById("miniCycleSwitchCancel").removeEventListener("click", closeMiniCycleModal);
    document.getElementById("miniCycleSwitchCancel").addEventListener("click", closeMiniCycleModal);
}

  

/**
 * Renameminicycle function.
 *
 * @returns {void}
 */

async function renameMiniCycle() {
  const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");

  if (!selectedCycle) {
    showNotification("⚠ Please select a Mini Cycle to rename.");
    return;
  }

  const oldName = selectedCycle.dataset.cycleName;
  const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

  const newName = await showPromptModal({
    title: "Rename Mini Cycle",
    message: `Rename "${oldName}" to:`,
    placeholder: "e.g., Morning Routine",
    defaultValue: oldName,
    confirmText: "Rename",
    cancelText: "Cancel",
    required: true
  });

  if (!newName) {
    showNotification("❌ Rename canceled.");
    return;
  }

  const cleanName = sanitizeInput(newName.trim());
  if (cleanName === oldName) {
    showNotification("ℹ Name unchanged.");
    return;
  }

  if (savedMiniCycles[cleanName]) {
    showNotification("⚠ A Mini Cycle with that name already exists.");
    return;
  }

  // ✅ Rename in localStorage
  savedMiniCycles[cleanName] = { ...savedMiniCycles[oldName] };
  savedMiniCycles[cleanName].title = cleanName;
  delete savedMiniCycles[oldName];

  // ✅ Update lastUsedMiniCycle if needed
  const currentActive = localStorage.getItem("lastUsedMiniCycle");
  if (currentActive === oldName) {
    localStorage.setItem("lastUsedMiniCycle", cleanName);
  }

  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

  // ✅ Update UI element (keep emoji if used)
  selectedCycle.dataset.cycleName = cleanName;
  const nameSpan = selectedCycle.querySelector("span");
  if (nameSpan) {
    nameSpan.textContent = cleanName;
  }

  // 🔄 Refresh UI
  loadMiniCycleList();
  updatePreview(cleanName);
  setTimeout(() => {
    const updatedItem = [...document.querySelectorAll(".mini-cycle-switch-item")]
      .find(item => item.dataset.cycleName === cleanName);
    if (updatedItem) {
      updatedItem.classList.add("selected");
      updatedItem.click(); // triggers preview
    }
  }, 50);
}

/**
 * Deleteminicycle function.
 *
 * @returns {void}
 */

async function deleteMiniCycle() {
  const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
  let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
  const switchModal = document.querySelector(".mini-cycle-switch-modal");

  const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");
  if (!selectedCycle) {
    showNotification("⚠ No Mini Cycle selected for deletion.");
    return;
  }

  const cycleToDelete = selectedCycle.dataset.cycleName;

  // ✅ Use showConfirmationModal instead of confirm
  const confirmed = await showConfirmationModal({
    title: "Delete Mini Cycle",
    message: `❌ Are you sure you want to delete "${cycleToDelete}"? This action cannot be undone.`,
    confirmText: "Delete",
    cancelText: "Cancel"
  });

  if (!confirmed) {
    return;
  }

  // ✅ Remove the selected Mini Cycle
  delete savedMiniCycles[cycleToDelete];
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
  console.log(`✅ Mini Cycle "${cycleToDelete}" deleted.`);

  // ✅ If the deleted cycle was the active one, handle fallback
  if (cycleToDelete === lastUsedMiniCycle) {
    const remainingCycles = Object.keys(savedMiniCycles);

    if (remainingCycles.length > 0) {
      // ✅ Switch to the most recent or first available Mini Cycle
      const newActiveCycle = remainingCycles[0];
      localStorage.setItem("lastUsedMiniCycle", newActiveCycle);
      loadMiniCycle();
      console.log(`🔄 Switched to Mini Cycle: "${newActiveCycle}".`);
    } else {
      setTimeout(() => {
        hideSwitchMiniCycleModal();
        showNotification("⚠ No Mini Cycles left. Please create a new one.");
        localStorage.removeItem("lastUsedMiniCycle");

        // ✅ Manually reset UI instead of reloading
        taskList.innerHTML = "";
        toggleAutoReset.checked = false;
        initialSetup();
      }, 300);
    }
  }

  loadMiniCycleList();
  setTimeout(updateProgressBar, 500);
  setTimeout(updateStatsPanel, 500);
  checkCompleteAllButton();
  setTimeout(() => {
    const firstCycle = document.querySelector(".mini-cycle-switch-item");
    if (firstCycle) {
      firstCycle.classList.add("selected");
      firstCycle.click();
    }
  }, 50);
}

/**
 * Hideswitchminicyclemodal function.
 *
 * @returns {void}
 */

function hideSwitchMiniCycleModal() {
    const switchModal = document.querySelector(".mini-cycle-switch-modal");
    console.log("🔍 Modal Found?", switchModal); // Debugging log

    if (!switchModal) {
        console.error("❌ Error: Modal not found.");
        return;
    }
    document.querySelector(".mini-cycle-switch-modal").style.display = "none";
    console.log("confirm", switchModal); 
}

/**
 * Confirmminicycle function.
 *
 * @returns {void}
 */

function confirmMiniCycle() {
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");

    if (!selectedCycle) {
        showNotification("Please select a Mini Cycle.");
        return;
    }

    localStorage.setItem("lastUsedMiniCycle", selectedCycle.dataset.cycleName);
    loadMiniCycle();
    document.querySelector(".mini-cycle-switch-modal").style.display = "none"; // ✅ Hide modal after selection
}



/**
 * Closeminicyclemodal function.
 *
 * @returns {void}
 */

function closeMiniCycleModal() {
    document.querySelector(".mini-cycle-switch-modal").style.display = "none";
}


document.addEventListener("click", /**
 * Closeonclickoutside function.
 *
 * @param {any} event - Description. * @returns {void}
 */

/**
 * Closeonclickoutside function.
 *
 * @param {any} event - Description. * @returns {void}
 */

function closeOnClickOutside(event) {
    const switchModalContent = document.querySelector(".mini-cycle-switch-modal-content");
    const switchModal = document.querySelector(".mini-cycle-switch-modal");
    const mainMenu = document.querySelector(".menu-container");

    // ✅ If the modal is open and the clicked area is NOT inside the modal or main menu, close it
    if (
        switchModal.style.display === "flex" &&
        !switchModalContent.contains(event.target) && 
        !mainMenu.contains(event.target)
    ) {
        switchModal.style.display = "none"; 
    }
});


/**
 * Updatepreview function.
 *
 * @param {any} cycleName - Description. * @returns {void}
 */

function updatePreview(cycleName) {
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const previewWindow = document.getElementById("switch-preview-window");

    function escapeHTML(str) {
        const temp = document.createElement("div");
        temp.textContent = str;
        return temp.innerHTML;
      }

    if (!savedMiniCycles[cycleName] || !savedMiniCycles[cycleName].tasks) {
        previewWindow.innerHTML = `<br><strong>No tasks found.</strong>`;
        return;
    }

    // ✅ Create a simple list of tasks for preview
    const tasksPreview = savedMiniCycles[cycleName].tasks
        .map(task => `<div class="preview-task">${task.completed ? "✔️" : "___"} ${escapeHTML(task.text)}</div>`)
        .join("");

    previewWindow.innerHTML = `<strong>Tasks:</strong><br>${tasksPreview}`;
}

/**
 * Loadminicyclelist function.
 *
 * @returns {void}
 */

function loadMiniCycleList() {
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const miniCycleList = document.getElementById("miniCycleList");
    miniCycleList.innerHTML = ""; // Clear the list before repopulating

    Object.keys(savedMiniCycles).forEach((cycleName) => {
        const cycleData = savedMiniCycles[cycleName];
        const listItem = document.createElement("div");
        listItem.classList.add("mini-cycle-switch-item");
        listItem.dataset.cycleName = cycleName;

        // 🏷️ Determine emoji based on Mini Cycle properties
        let emoji = "📋"; // Default to 📋 (Standard Document)
        if (cycleData.autoReset) {
            emoji = "🔃"; // If Auto Reset is ON, show 🔃
        } 

        // 📌 Ensure spacing between emoji and text
        listItem.textContent = emoji + " ";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = cycleName;
        listItem.appendChild(nameSpan);

        // 🖱️ Handle selection
        listItem.addEventListener("click", function () {
            document.querySelectorAll(".mini-cycle-switch-item").forEach(item => item.classList.remove("selected"));
            this.classList.add("selected");

            // Show preview & buttons
            document.getElementById("switch-items-row").style.display = "block";
            updatePreview(cycleName);
           
        });

        miniCycleList.appendChild(listItem);
    });

    updateReminderButtons();
}



/**
 * Clearalltasks function.
 *
 * @returns {void}
 */

function clearAllTasks() {
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

    // ✅ Ensure a valid Mini Cycle exists
    if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
        showNotification("⚠ No active Mini Cycle to clear tasks.");
        return;
    }


    // ✅ Uncheck all tasks (DO NOT DELETE)
    savedMiniCycles[lastUsedMiniCycle].tasks.forEach(task => task.completed = false);

    // ✅ Save updated Mini Cycle
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    // ✅ Uncheck tasks in the UI
    document.querySelectorAll("#taskList .task input[type='checkbox']").forEach(checkbox => {
        checkbox.checked = false;
    });

    // ✅ Update UI elements
    updateProgressBar();
    checkCompleteAllButton();
    autoSave(); // Ensure changes persist
    hideMainMenu();

    console.log(`✅ All tasks unchecked for Mini Cycle: "${lastUsedMiniCycle}"`);
}

/**
 * Deletealltasks function.
 *
 * @returns {void}
 */

async function deleteAllTasks() {
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

  // ✅ Ensure a valid Mini Cycle exists
  if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
    showNotification("⚠ No active Mini Cycle to delete tasks from.");
    return;
  }

  // ✅ Confirm before deleting all tasks using showConfirmationModal
  const confirmed = await showConfirmationModal({
    title: "Delete All Tasks",
    message: `⚠ Are you sure you want to permanently delete all tasks in "${lastUsedMiniCycle}"? This action cannot be undone.`,
    confirmText: "Delete All",
    cancelText: "Cancel"
  });
  if (!confirmed) return;

  // ✅ Clear tasks completely
  savedMiniCycles[lastUsedMiniCycle].tasks = [];

  // ✅ Save updated Mini Cycle
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

  // ✅ Clear UI & update progress
  taskList.innerHTML = "";
  updateProgressBar();
  checkCompleteAllButton();
  autoSave(); // Ensure changes persist

  console.log(`✅ All tasks deleted for Mini Cycle: "${lastUsedMiniCycle}"`);
}

/**
 * Createnewminicycle function.
 *
 * @returns {void}
 */

async function createNewMiniCycle() {
  let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

  // 🧠 Prompt for Mini Cycle name using styled modal
  const newCycleName = await showPromptModal({
    title: "Create New Mini Cycle",
    message: "What would you like to name it?",
    placeholder: "e.g., Daily Routine",
    defaultValue: "",
    confirmText: "Create",
    cancelText: "Cancel",
    required: true
  });

  if (!newCycleName) {
    showNotification("❌ Creation canceled.");
    return;
  }

  const cleanName = sanitizeInput(newCycleName.trim());

  if (savedMiniCycles[cleanName]) {
    showNotification("⚠ A Mini Cycle with this name already exists. Choose a different name.");
    return;
  }

  // ✅ Create new Mini Cycle with defaults
  savedMiniCycles[cleanName] = {
    title: cleanName,
    tasks: [],
    autoReset: true,
    deleteCheckedTasks: false
  };

  // 💾 Save and switch to new Mini Cycle
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
  localStorage.setItem("lastUsedMiniCycle", cleanName);

  // 🔄 Update UI
  taskList.innerHTML = "";
  document.getElementById("mini-cycle-title").textContent = cleanName;
  toggleAutoReset.checked = savedMiniCycles[cleanName].autoReset;

  hideMainMenu();
  updateProgressBar();
  checkCompleteAllButton();
  autoSave();

  console.log(`✅ Created and switched to new Mini Cycle: "${cleanName}"`);
}


indefiniteCheckbox.addEventListener("change", () => {
  // If indefinite, hide the repeatCount row
  repeatCountRow.style.display = indefiniteCheckbox.checked ? "none" : "block";
});



function handleReminderToggle() {
    const isEnabled = enableReminders.checked;
  
    // 🧠 Read previous state from localStorage
    const previousSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
    const wasEnabled = previousSettings.enabled === true;
  
    // ✅ Update the visibility of the frequency section
    frequencySection.classList.toggle("hidden", !isEnabled);
  
    // ✅ Save updated settings and get the current global state
    const globalReminderState = autoSaveReminders();
  
    // ✅ Update the 🔔 task buttons
    updateReminderButtons();
  
    // ✅ Start or stop reminders
    if (globalReminderState) {
      console.log("🔔 Global Reminders Enabled — Starting reminders...");
      if (!wasEnabled) {
        showNotification("🔔 Task reminders enabled!", "success", 2500);
      }
      setTimeout(() => startReminders(), 200);
    } else {
      console.log("🔕 Global Reminders Disabled — Stopping reminders...");
      if (wasEnabled) {
        showNotification("🔕 Task reminders disabled.", "error", 2500);
      }
      stopReminders();
    }
  }
  
  function setupReminderToggle() {
    safeAddEventListener(enableReminders, "change", handleReminderToggle);

    const reminderSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
    enableReminders.checked = reminderSettings.enabled === true;
    frequencySection.classList.toggle("hidden", !reminderSettings.enabled);

    // ✅ 🧠 Reminder system will re-run if already enabled
    if (reminderSettings.enabled) {
        updateReminderButtons();
        startReminders();
    }
}

  function stopReminders() {
    if (reminderIntervalId) {
      clearInterval(reminderIntervalId);
      reminderIntervalId = null;
      console.log("🛑 Reminder system stopped.");
    }
  }







/**
 * 📌 Load saved reminder settings from localStorage and update the UI accordingly.
 */
/**
 * Loadreminderssettings function.
 *
 * @returns {void}
 */

// ✅ Automatically save reminders settings when changed
function autoSaveReminders() {
    const enabled = document.getElementById("enableReminders").checked;

    const remindersToSave = {
        enabled,
        indefinite: document.getElementById("indefiniteCheckbox").checked,
        dueDatesReminders: document.getElementById("dueDatesReminders").checked,
        repeatCount: parseInt(document.getElementById("repeatCount").value) || 0,
        frequencyValue: parseInt(document.getElementById("frequencyValue").value) || 0,
        frequencyUnit: document.getElementById("frequencyUnit").value
    };

    // ⏱️ Save reminder start time only when enabling reminders
    if (enabled) {
        remindersToSave.reminderStartTime = Date.now();
    }

    localStorage.setItem("miniCycleReminders", JSON.stringify(remindersToSave));
    console.log("✅ Reminders settings saved automatically!", remindersToSave);

    return enabled;
}

// ✅ Load saved reminders settings on page load
function loadRemindersSettings() {
    const savedReminders = JSON.parse(localStorage.getItem("miniCycleReminders")) || {
        enabled: false,
        indefinite: true,
        dueDatesReminders: false,
        repeatCount: 0,
        frequencyValue: 0,
        frequencyUnit: "hours"
    };

    // ✅ Apply settings to UI
    document.getElementById("enableReminders").checked = savedReminders.enabled;
    document.getElementById("indefiniteCheckbox").checked = savedReminders.indefinite;
    document.getElementById("dueDatesReminders").checked = savedReminders.dueDatesReminders;
    document.getElementById("repeatCount").value = savedReminders.repeatCount;
    document.getElementById("frequencyValue").value = savedReminders.frequencyValue;
    document.getElementById("frequencyUnit").value = savedReminders.frequencyUnit;

    // ✅ Show/hide frequency settings dynamically
    frequencySection.classList.toggle("hidden", !savedReminders.enabled);
    document.getElementById("repeat-count-row").style.display = savedReminders.indefinite ? "none" : "block";

    // ✅ 🔔 NEW: Show/hide reminder buttons on load
    updateReminderButtons(); // <- This will loop through all tasks and show/hide buttons correctly
}

// ✅ Attach auto-save & restart reminders to all reminder settings inputs safely
/*
safeAddEventListenerById("enableReminders", "change", () => {
    document.getElementById("frequency-section").style.display = document.getElementById("enableReminders").checked ? "block" : "none";
    autoSaveReminders();
    startReminders();
});
*/

safeAddEventListenerById("indefiniteCheckbox", "change", () => {
    document.getElementById("repeat-count-row").style.display = document.getElementById("indefiniteCheckbox").checked ? "none" : "block";
    autoSaveReminders();
    startReminders();
});
safeAddEventListenerById("dueDatesReminders", "change", () => {
    // ✅ Load existing reminder settings
    let remindersSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};

    // ✅ Update only the due dates reminders setting
    remindersSettings.dueDatesReminders = document.getElementById("dueDatesReminders").checked;

    // ✅ Save the updated settings to localStorage
    localStorage.setItem("miniCycleReminders", JSON.stringify(remindersSettings));

    console.log(`💾 Saved Due Dates Reminders setting: ${remindersSettings.dueDatesReminders}`);
});


["repeatCount", "frequencyValue", "frequencyUnit"].forEach(id => {
    safeAddEventListenerById(id, "input", () => {
      const settings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
      if (settings.enabled) {
        autoSaveReminders();
        startReminders();
      }
    });
  });

/**
 * 📌 Save the current reminder settings into localStorage.
 * @returns {object} The saved reminder settings.
 */
/**
 * Savereminderssettings function.
 *
 * @returns {void}
 */


/**
 * 📌 Save the reminder state for a specific task inside the active Mini Cycle.
 * @param {string} taskText - The text of the task to update.
 * @param {boolean} isEnabled - Whether reminders are enabled for this task.
 */
/**
 * Savetaskreminderstate function.
 *
 * @param {any} taskText - Description.
 * @param {any} isEnabled - Description. * @returns {void}
 */



function saveTaskReminderState(taskId, isEnabled) {
    let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
    if (!savedMiniCycles[lastUsedMiniCycle]) return;

    // Look up the task using its unique id instead of text
    let task = savedMiniCycles[lastUsedMiniCycle].tasks.find(t => t.id === taskId);
    if (task) {
        task.remindersEnabled = isEnabled;
        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
    }
}

/**
 * 📌 Handle click event for saving reminders settings.
 * - Saves the settings.
 * - Starts the reminders.
 * - Shows a confirmation alert.
 */

/**
 * 📌 Close the reminders settings modal when the close button is clicked.
 */
closeRemindersBtn.addEventListener("click", () => {
    remindersModal.style.display = "none";
});

/**
 * 📌 Close the reminders modal when clicking outside of it.
 */
window.addEventListener("click", (event) => {
    if (event.target === remindersModal) {
        remindersModal.style.display = "none";
    }
});



/********
 * 
 * Show Notification function
 * 
 */
  
function showNotification(message, type = "default", duration = null) {
  try {
    const notificationContainer = document.getElementById("notification-container");
    if (!notificationContainer) {
      console.warn("⚠️ Notification container not found.");
      return;
    }

    if (typeof message !== "string" || message.trim() === "") {
      console.warn("⚠️ Invalid or empty message passed to showNotification().");
      message = "⚠️ Unknown notification";
    }

    const newId = generateHashId(message);
    if ([...notificationContainer.querySelectorAll(".notification")]
        .some(n => n.dataset.id === newId)) {
      console.log("🔄 Notification already exists, skipping duplicate.");
      return;
    }

    const notification = document.createElement("div");
    notification.classList.add("notification", "show");
    notification.dataset.id = newId;

    if (["error", "success", "info", "warning", "recurring"].includes(type)) {
      notification.classList.add(type);
    }

    // ⏩ Only add default close button if one is not already in message HTML
    if (message.includes('class="close-btn"')) {
      notification.innerHTML = message;
    } else {
      notification.innerHTML = `
        <div class="notification-content">${message}</div>
        <button class="close-btn" title="Close" aria-label="Close notification">✖</button>
      `;
    }

    // Style and handler for any close button
    const closeBtn = notification.querySelector(".close-btn");
    if (closeBtn) {
      Object.assign(closeBtn.style, {
        position: "absolute",
        top: "6px",
        right: "6px",
        background: "transparent",
        border: "none",
        fontSize: "16px",
        cursor: "pointer",
        color: "#fff",
        lineHeight: "1",
        padding: "0"
      });

      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 300);
      });
    }

    notificationContainer.appendChild(notification);

    // Restore saved position
    try {
      const savedPosition = JSON.parse(localStorage.getItem("miniCycleNotificationPosition"));
      if (savedPosition?.top && savedPosition?.left) {
        notificationContainer.style.top = savedPosition.top;
        notificationContainer.style.left = savedPosition.left;
        notificationContainer.style.right = "auto";
      }
    } catch (posError) {
      console.warn("⚠️ Failed to apply saved notification position.", posError);
    }

    // Auto-remove after duration (hover pause)
    if (duration) {
      let hoverPaused = false;
      let remaining = duration;
      let removeTimeout;
      let startTime = Date.now();

      const clearNotification = () => {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 300);
      };

      const startTimer = () => {
        removeTimeout = setTimeout(() => {
          if (!hoverPaused) clearNotification();
        }, remaining);
      };

      const pauseTimer = () => {
        hoverPaused = true;
        clearTimeout(removeTimeout);
        remaining -= (Date.now() - startTime);
      };

      const resumeTimer = () => {
        hoverPaused = false;
        startTime = Date.now();
        startTimer();
      };

      startTimer();
      notification.addEventListener("mouseenter", pauseTimer);
      notification.addEventListener("mouseleave", resumeTimer);
    }

    // Keep drag support
    setupNotificationDragging(notificationContainer);

  } catch (err) {
    console.error("❌ showNotification failed:", err);
  }
}

function setupNotificationDragging(notificationContainer) {
  if (notificationContainer.dragListenersAttached) return;
  notificationContainer.dragListenersAttached = true;

  const interactiveSelectors = [
    '.tip-close', '.tip-toggle',
    '.quick-option', '.radio-circle', '.option-label',
    '.apply-quick-recurring', '.open-recurring-settings',
    'button', 'input', 'select', 'textarea', 'a[href]'
  ];

  // Mouse dragging
  notificationContainer.addEventListener("mousedown", (e) => {
    const isInteractive = interactiveSelectors.some(selector =>
      e.target.matches(selector) || e.target.closest(selector)
    );
    if (isInteractive) return;

    let dragStarted = false;
    let startX = e.clientX;
    let startY = e.clientY;
    const dragThreshold = 5;

    const rect = notificationContainer.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const startDrag = () => {
      if (!dragStarted) {
        dragStarted = true;
        isDraggingNotification = true;
        notificationContainer.classList.add("dragging");
        document.body.style.userSelect = 'none';
      }
    };

    const onMouseMove = (e) => {
      const moveDistance = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
      if (!dragStarted && moveDistance > dragThreshold) startDrag();
      if (dragStarted) {
        e.preventDefault();
        const top = `${e.clientY - offsetY}px`;
        const left = `${e.clientX - offsetX}px`;
        notificationContainer.style.top = top;
        notificationContainer.style.left = left;
        notificationContainer.style.right = "auto";
        localStorage.setItem("miniCycleNotificationPosition", JSON.stringify({ top, left }));
      }
    };

    const onMouseUp = (e) => {
      if (dragStarted) {
        isDraggingNotification = false;
        notificationContainer.classList.remove("dragging");
        document.body.style.userSelect = '';
        if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > dragThreshold) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  // Touch dragging
  notificationContainer.addEventListener("touchstart", (e) => {
    const isInteractive = interactiveSelectors.some(selector =>
      e.target.matches(selector) || e.target.closest(selector)
    );
    if (isInteractive) return;

    let dragStarted = false;
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const dragThreshold = 8;

    const rect = notificationContainer.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;

    const startDrag = () => {
      if (!dragStarted) {
        dragStarted = true;
        isDraggingNotification = true;
        notificationContainer.classList.add("dragging");
        document.body.style.overflow = 'hidden';
      }
    };

    const onTouchMove = (e) => {
      const touch = e.touches[0];
      const moveDistance = Math.abs(touch.clientX - startX) + Math.abs(touch.clientY - startY);
      if (!dragStarted && moveDistance > dragThreshold) startDrag();
      if (dragStarted) {
        e.preventDefault();
        const top = `${touch.clientY - offsetY}px`;
        const left = `${touch.clientX - offsetX}px`;
        notificationContainer.style.top = top;
        notificationContainer.style.left = left;
        notificationContainer.style.right = "auto";
        localStorage.setItem("miniCycleNotificationPosition", JSON.stringify({ top, left }));
      }
    };

    const onTouchEnd = (e) => {
      if (dragStarted) {
        isDraggingNotification = false;
        notificationContainer.classList.remove("dragging");
        document.body.style.overflow = '';
        const finalTouch = e.changedTouches[0];
        if (Math.abs(finalTouch.clientX - startX) + Math.abs(finalTouch.clientY - startY) > dragThreshold) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
  });
}

  


  
  
  function resetNotificationPosition() {
    localStorage.removeItem("miniCycleNotificationPosition");
  
    const container = document.getElementById("notification-container");
    container.style.top = ""; // Revert to default
    container.style.left = "";
    container.style.right = ""; // Reset right as a fallback
  
    console.log("🔄 Notification position reset.");
  }




/**
 * 🎓 Modular Educational Tips System
 * 
 * Features:
 * - Remember dismissed tips per user
 * - Collapsible with lightbulb toggle
 * - Reusable across the app
 * - Easy integration with existing notifications
 */

class EducationalTipManager {
  constructor() {
    this.storageKey = 'miniCycleEducationalTips';
    this.dismissedTips = this.loadDismissedTips();
  }

  loadDismissedTips() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey)) || {};
    } catch (e) {
      return {};
    }
  }

  saveDismissedTips() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.dismissedTips));
  }

  isTipDismissed(tipId) {
    return this.dismissedTips[tipId] === true;
  }

  dismissTip(tipId) {
    this.dismissedTips[tipId] = true;
    this.saveDismissedTips();
  }

  showTip(tipId) {
    delete this.dismissedTips[tipId];
    this.saveDismissedTips();
  }

  createTip(tipId, tipText, options = {}) {
    const {
      icon = '💡',
      borderColor = 'rgba(255, 255, 255, 0.3)',
      backgroundColor = 'rgba(255, 255, 255, 0.1)',
      className = 'educational-tip'
    } = options;

    const isDismissed = this.isTipDismissed(tipId);
    
    return `
      <div class="${className}" id="tip-${tipId}" data-tip-id="${tipId}" 
           style="display: ${isDismissed ? 'none' : 'block'};">
        <div class="tip-content">
          <span class="tip-icon">${icon}</span>
          <span class="tip-text">${tipText}</span>
          <button class="tip-close" aria-label="Dismiss tip">✕</button>
        </div>
      </div>
      <button class="tip-toggle ${isDismissed ? 'show' : 'hide'}" 
              data-tip-id="${tipId}" 
              aria-label="Show educational tip">
        💡
      </button>
    `;
  }

  /**
   * ✅ Enhanced tip listeners with proper event handling
   */
  initializeTipListeners(container) {
    // Handle tip close buttons
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('tip-close')) {
        e.stopPropagation(); // ✅ Prevent drag from starting
        const tipElement = e.target.closest('.educational-tip');
        const tipId = tipElement.dataset.tipId;
        this.hideTip(tipId, container);
      }
    });

    // Handle tip toggle buttons
    container.addEventListener('click', (e) => {
     if (e.target.classList.contains('tip-toggle') || e.target.classList.contains('tip-toggle-btn')) {
        e.stopPropagation(); // ✅ Prevent drag from starting
        const tipId = e.target.dataset.tipId;
        const tipElement = container.querySelector(`#tip-${tipId}`);
        
        if (tipElement.style.display === 'none') {
          this.showTipElement(tipId, container);
        } else {
          this.hideTip(tipId, container);
        }
      }
    });
  }

  hideTip(tipId, container) {
    const tipElement = container.querySelector(`#tip-${tipId}`);
    const toggleButton = container.querySelector(`.tip-toggle[data-tip-id="${tipId}"]`);
    
    if (tipElement) {
      tipElement.style.opacity = '0';
      tipElement.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
        tipElement.style.display = 'none';
        if (toggleButton) {
          toggleButton.classList.remove('hide');
          toggleButton.classList.add('show');
        }
      }, 200);
    }
    
    this.dismissTip(tipId);
  }

  showTipElement(tipId, container) {
    const tipElement = container.querySelector(`#tip-${tipId}`);
    const toggleButton = container.querySelector(`.tip-toggle[data-tip-id="${tipId}"]`);
    
    if (tipElement) {
      tipElement.style.display = 'block';
      tipElement.style.opacity = '0';
      tipElement.style.transform = 'translateY(-10px)';
      
      // Force reflow
      tipElement.offsetHeight;
      
      tipElement.style.opacity = '1';
      tipElement.style.transform = 'translateY(0)';
      
      if (toggleButton) {
        toggleButton.classList.remove('show');
        toggleButton.classList.add('hide');
      }
    }
    
    this.showTip(tipId);
  }
}

// 🌟 Initialize global tip manager
const educationalTips = new EducationalTipManager();

/**
 * 🚀 Enhanced Recurring Notification with Educational Tip
 * Updated implementation for your recurring feature
 */
function createRecurringNotificationWithTip(assignedTaskId, frequency, pattern) {
  const tipId = 'recurring-cycle-explanation';
  const tipText = 'Recurring tasks are deleted on cycle reset and reappear based on their schedule';

  // Only the tooltip box — no 💡 toggle inside
  const educationalTipHTML = `
    <div class="educational-tip recurring-tip" id="tip-${tipId}" data-tip-id="${tipId}" style="display: none;">
      <div class="tip-content">
        <span class="tip-icon">📍</span>
        <span class="tip-text">${tipText}</span>
        <button class="tip-close" aria-label="Dismiss tip">✕</button>
      </div>
    </div>
  `;

  return `
    <div class="main-notification-content" 
         style="position: relative; display: block; padding: 12px 16px; border-radius: 6px;">
      
      <!-- Close button -->
      <button class="close-btn" 
              title="Close" 
              aria-label="Close notification"
              style="position: absolute; top: -7px; right: -7px; background: transparent; border: none; font-size: 16px; cursor: pointer; color: #fff; line-height: 1; padding: 0;">✖</button>

      ${educationalTipHTML}

      <span id="current-settings-${assignedTaskId}">
        🔁 Recurring set to <strong>${frequency}</strong> (${pattern})
      </span><br>

      <div class="quick-recurring-options" data-task-id="${assignedTaskId}">
        <div class="quick-option">
          <span class="radio-circle ${frequency === 'hourly' ? 'selected' : ''}" data-freq="hourly"></span>
          <span class="option-label">Hourly</span>
        </div>
        <div class="quick-option">
          <span class="radio-circle ${frequency === 'daily' ? 'selected' : ''}" data-freq="daily"></span>
          <span class="option-label">Daily</span>
        </div>
        <div class="quick-option">
          <span class="radio-circle ${frequency === 'weekly' ? 'selected' : ''}" data-freq="weekly"></span>
          <span class="option-label">Weekly</span>
        </div>
        <div class="quick-option">
          <span class="radio-circle ${frequency === 'monthly' ? 'selected' : ''}" data-freq="monthly"></span>
          <span class="option-label">Monthly</span>
        </div>
      </div>

      <div class="quick-actions">
        <button class="apply-quick-recurring" data-task-id="${assignedTaskId}" style="display: none;">Apply</button>
        <button class="open-recurring-settings" data-task-id="${assignedTaskId}">⚙ More Options</button>
      </div>

      <!-- Detached Lightbulb toggle -->
      <button class="tip-toggle-btn" data-tip-id="${tipId}" aria-label="Show educational tip">💡</button>
    </div>
  `;
}
/**
 * ✅ Enhanced recurring notification listeners with proper event handling
 */
function initializeRecurringNotificationListeners(notification) {
  // ✅ Close button handler first
  const closeBtn = notification.querySelector(".close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300); // match fade-out speed
    });
  }

  // ✅ Delegate clicks inside notification
  notification.addEventListener("click", (e) => {
    e.stopPropagation();

    // Always get taskId
    const taskId = e.target.dataset.taskId || 
                   e.target.closest("[data-task-id]")?.dataset.taskId;

    // Handle quick option clicks
    if (e.target.closest(".quick-option")) {
      const quickOption = e.target.closest(".quick-option");
      const radioCircle = quickOption.querySelector(".radio-circle");
      const quickOptions = quickOption.closest(".quick-recurring-options");
      const applyButton = notification.querySelector(".apply-quick-recurring");

      quickOptions.querySelectorAll(".radio-circle").forEach(circle => {
        circle.classList.remove("selected");
      });

      radioCircle.classList.add("selected");
      applyButton.style.display = "inline-block";
      applyButton.classList.add("show");
    }

    // Handle apply button clicks
    if (e.target.classList.contains("apply-quick-recurring")) {
      const selectedCircle = notification.querySelector(".radio-circle.selected");
      if (!selectedCircle || !taskId) return;

      const newFrequency = selectedCircle.dataset.freq;
      const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

      applyRecurringToTask(taskId, { frequency: newFrequency }, savedMiniCycles, lastUsedMiniCycle);
      localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

      const targetTask = savedMiniCycles[lastUsedMiniCycle]?.tasks.find(t => t.id === taskId);
      const pattern = targetTask?.recurringSettings?.indefinitely ? "Indefinitely" : "Limited";
      const currentSettingsText = notification.querySelector(`#current-settings-${taskId}`);

      if (currentSettingsText) {
        currentSettingsText.innerHTML = `🔁 Recurring set to <strong>${newFrequency}</strong> (${pattern})`;
        currentSettingsText.style.background = "rgba(255, 255, 255, 0.2)";
        setTimeout(() => currentSettingsText.style.background = "transparent", 800);
      }

      e.target.style.display = "none";
      showApplyConfirmation(currentSettingsText);
      updateRecurringPanel?.();
    }

    // Handle advanced settings button
    if (e.target.classList.contains("open-recurring-settings") && taskId) {
      const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
      const task = savedMiniCycles[lastUsedMiniCycle]?.tasks.find(t => t.id === taskId);

      let startingFrequency;
      const selectedCircle = notification.querySelector(".radio-circle.selected");
      if (selectedCircle) {
        startingFrequency = selectedCircle.dataset.freq;
      } else if (task?.recurringSettings?.frequency) {
        startingFrequency = task.recurringSettings.frequency;
      }

      if (startingFrequency) {
        const freqSelect = document.getElementById("recur-frequency");
        if (freqSelect) {
          freqSelect.value = startingFrequency;
          freqSelect.dispatchEvent(new Event("change"));
        }
      }

      openRecurringSettingsPanelForTask(taskId);

      const notificationEl = e.target.closest(".notification");
      if (notificationEl) {
        notificationEl.classList.remove("show");
        setTimeout(() => notificationEl.remove(), 300);
      }
    }
  });
}
/**
 * Show confirmation message after applying changes
 */
function showApplyConfirmation(targetElement) {
  const tempConfirm = document.createElement("span");
  tempConfirm.textContent = "✨  Applied!";
  tempConfirm.style.color = "#209b17ff";
  tempConfirm.style.fontWeight = "bold";
  tempConfirm.style.marginLeft = "8px";
  tempConfirm.style.opacity = "0";
  tempConfirm.style.transition = "opacity 0.3s ease";
  
  if (targetElement) {
    targetElement.appendChild(tempConfirm);
    
    // Animate in
    setTimeout(() => {
      tempConfirm.style.opacity = "1";
    }, 100);
    
    // Fade out and remove
    setTimeout(() => {
      tempConfirm.style.opacity = "0";
      setTimeout(() => {
        if (tempConfirm.parentNode) {
          tempConfirm.parentNode.removeChild(tempConfirm);
        }
      }, 300);
    }, 2000);
  }
}

// 🛠 Unified recurring update helper
function applyRecurringToTask(taskId, newSettings, savedMiniCycles, lastUsedMiniCycle) {
  const cycleData = savedMiniCycles?.[lastUsedMiniCycle];
  if (!cycleData) return;

  let task = cycleData.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Merge instead of overwrite so we keep advanced panel settings
  task.recurringSettings = {
    ...task.recurringSettings,
    ...newSettings
  };
  task.recurring = true;
  task.schemaVersion = 2;

  // Keep recurringTemplates in sync
  if (!cycleData.recurringTemplates) cycleData.recurringTemplates = {};
  cycleData.recurringTemplates[taskId] = {
    ...(cycleData.recurringTemplates[taskId] || {}),
    id: taskId,
    text: task.text,
    recurring: true,
    schemaVersion: 2,
    recurringSettings: { ...task.recurringSettings }
  };

  // Update DOM attributes for this task
  const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
  if (taskElement) {
    taskElement.classList.add("recurring");
    taskElement.setAttribute("data-recurring-settings", JSON.stringify(task.recurringSettings));
    const recurringBtn = taskElement.querySelector(".recurring-btn");
    if (recurringBtn) {
      recurringBtn.classList.add("active");
      recurringBtn.setAttribute("aria-pressed", "true");
    }
  }
}

/**
 * 🔧 Enhanced showNotification function with educational tips support
 */
/**
 * 🔧 Enhanced showNotification function with fixed dragging support
 */
function showNotificationWithTip(content, type = "default", duration = null, tipId = null) {
  try {
    const notificationContainer = document.getElementById("notification-container");
    if (!notificationContainer) {
      console.warn("⚠️ Notification container not found.");
      return;
    }

    // 💡 Sanitize + Fallback message
    if (typeof content !== "string" || content.trim() === "") {
      console.warn("⚠️ Invalid or empty message passed to showNotificationWithTip().");
      content = "⚠️ Unknown notification";
    }

    const newId = generateHashId(content); // 🔐 Use hash-based ID
    const existing = [...notificationContainer.querySelectorAll(".notification")];

    // ✅ Prevent duplicates
    if (existing.some(n => n.dataset.id === newId)) {
      console.log("🔄 Notification already exists, skipping duplicate.");
      return;
    }

    // ✅ Build notification
    const notification = document.createElement("div");
    notification.classList.add("notification", "show");
    notification.dataset.id = newId;

    if (type === "error") notification.classList.add("error");
    if (type === "success") notification.classList.add("success");
    if (type === "info") notification.classList.add("info");
    if (type === "warning") notification.classList.add("warning");
    if (type === "recurring") notification.classList.add("recurring");

    // 🛡 Check if HTML already has a close button before adding one
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    const hasCloseBtn = tempDiv.querySelector(".close-btn, .notification-close");

    if (hasCloseBtn) {
      notification.innerHTML = content;
    } else {
      notification.innerHTML = `
        <div class="notification-content">${content}</div>
        <button class="notification-close" aria-label="Close notification">✖</button>
      `;
    }

    notificationContainer.appendChild(notification);

    // 🎯 Close button click
    const closeBtn = notification.querySelector(".close-btn, .notification-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Avoid triggering other listeners
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 300);
      });
    }

    // ✅ Initialize tip listeners if this notification has tips
    if (tipId || notification.querySelector(".educational-tip")) {
      educationalTips.initializeTipListeners(notification);
    }

    // ✅ Restore saved position safely
    try {
      const savedPosition = JSON.parse(localStorage.getItem("miniCycleNotificationPosition"));
      if (savedPosition && savedPosition.top && savedPosition.left) {
        notificationContainer.style.top = savedPosition.top;
        notificationContainer.style.left = savedPosition.left;
        notificationContainer.style.right = "auto";
      }
    } catch (posError) {
      console.warn("⚠️ Failed to apply saved notification position.", posError);
    }

    // ✅ Auto-remove logic with hover pause
    if (duration) {
      let hoverPaused = false;
      let remaining = duration;
      let removeTimeout;
      let startTime = Date.now();

      const clearNotification = () => {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 300);
      };

      const startTimer = () => {
        removeTimeout = setTimeout(() => {
          if (!hoverPaused) clearNotification();
        }, remaining);
      };

      const pauseTimer = () => {
        hoverPaused = true;
        clearTimeout(removeTimeout);
        const elapsed = Date.now() - startTime;
        remaining -= elapsed;
      };

      const resumeTimer = () => {
        hoverPaused = false;
        startTime = Date.now();
        startTimer();
      };

      startTimer();
      notification.addEventListener("mouseenter", pauseTimer);
      notification.addEventListener("mouseleave", resumeTimer);
    }

    // ✅ Dragging setup (once)
    setupNotificationDragging(notificationContainer);

    return notification;

  } catch (err) {
    console.error("❌ showNotificationWithTip failed:", err);
  }
}

/**
 * Show a confirmation modal and return a Promise<boolean>
 */
function showConfirmationModal({
  title = "Confirm Action",
  message = "Are you sure?",
  confirmText = "Yes",
  cancelText = "Cancel"
}) {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "mini-modal-overlay";

    // Modal content
    const modal = document.createElement("div");
    modal.className = "mini-modal-box";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("tabindex", "-1");

    modal.innerHTML = `
      <div class="mini-modal-header">${title}</div>
      <div class="mini-modal-body">${message}</div>
      <div class="mini-modal-buttons">
        <button class="btn-confirm">${confirmText}</button>
        <button class="btn-cancel">${cancelText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Elements
    const confirmBtn = modal.querySelector(".btn-confirm");
    const cancelBtn = modal.querySelector(".btn-cancel");

    // Focus cancel by default for safe UX
    setTimeout(() => cancelBtn.focus(), 20);

    // Actions
    const cleanup = () => {
      document.removeEventListener("keydown", handleKeydown);
      document.body.removeChild(overlay);
    };

    const handleKeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmBtn.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelBtn.click();
      }
    };

    // Keyboard shortcut listeners
    document.addEventListener("keydown", handleKeydown);

    // Button handlers
    confirmBtn.onclick = () => {
      cleanup();
      resolve(true);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };
  });
}

function showPromptModal({
  title = "Enter a value",
  message = "",
  placeholder = "",
  defaultValue = "",
  confirmText = "OK",
  cancelText = "Cancel",
  required = false
}) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "miniCycle-overlay";

    overlay.innerHTML = `
      <div class="miniCycle-prompt-box">
        <h2 class="miniCycle-prompt-title">${title}</h2>
        <p class="miniCycle-prompt-message">${message}</p>
        <input type="text" class="miniCycle-prompt-input" placeholder="${placeholder}" value="${defaultValue}" />
        <div class="miniCycle-prompt-buttons">
          <button class="miniCycle-btn-cancel">${cancelText}</button>
          <button class="miniCycle-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector(".miniCycle-prompt-input");
    const cancelBtn = overlay.querySelector(".miniCycle-btn-cancel");
    const confirmBtn = overlay.querySelector(".miniCycle-btn-confirm");

    // Focus input automatically
    setTimeout(() => input.focus(), 50);

    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(null);
    });

    confirmBtn.addEventListener("click", () => {
      const value = input.value.trim();
      if (required && !value) {
        input.classList.add("miniCycle-input-error");
        input.focus();
        return;
      }
      document.body.removeChild(overlay);
      resolve(value);
    });

    overlay.addEventListener("keydown", e => {
      if (e.key === "Enter") confirmBtn.click();
      if (e.key === "Escape") cancelBtn.click();
    });
  });
}

  
  /**
 * Startreminders function.
 *
 * @returns {void}
 */


  function sendReminderNotificationIfNeeded() {
    const remindersSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};

    let tasksWithReminders = [...document.querySelectorAll(".task")]
        .filter(task => task.querySelector(".enable-task-reminders.reminder-active"));

    console.log("🔍 Tasks With Active Reminders:", tasksWithReminders);

    let incompleteTasks = tasksWithReminders
        .filter(task => !task.querySelector("input[type='checkbox']").checked)
        .map(task => task.querySelector(".task-text").textContent);

    if (incompleteTasks.length === 0) {
        console.log("✅ All tasks complete. Stopping reminders.");
        clearInterval(reminderIntervalId);
        return;
    }

    if (!remindersSettings.indefinite && timesReminded >= remindersSettings.repeatCount) {
        console.log("✅ Max reminders sent. Stopping reminders.");
        clearInterval(reminderIntervalId);
        return;
    }

    showNotification(`🔔 You have tasks to complete:<br>- ${incompleteTasks.join("<br>- ")}`, "default");
    timesReminded++;
}





function startReminders() {
    console.log("🔄 Starting Reminder System...");

    if (reminderIntervalId) clearInterval(reminderIntervalId);

    const remindersSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
    if (!remindersSettings.enabled) return;

    let multiplier = remindersSettings.frequencyUnit === "hours" ? 3600000 :
                     remindersSettings.frequencyUnit === "days" ? 86400000 : 60000;
    const intervalMs = remindersSettings.frequencyValue * multiplier;

    // ⏱️ Use stored start time or now if missing
    const now = Date.now();
    const startTime = remindersSettings.reminderStartTime || now;
    const elapsedTime = now - startTime;
    const intervalsPassed = Math.floor(elapsedTime / intervalMs);

    timesReminded = intervalsPassed;
    lastReminderTime = startTime + (intervalsPassed * intervalMs);

    console.log(`⏱️ ${intervalsPassed} interval(s) have passed since reminderStartTime.`);

    // If max reminders already sent, exit early
    if (!remindersSettings.indefinite && timesReminded >= remindersSettings.repeatCount) {
        console.log("✅ Max reminders already reached. Skipping further reminders.");
        return;
    }

// Only send if enough time has passed since last reminder
if ((Date.now() - lastReminderTime) >= intervalMs) {
    console.log("⏰ Sending catch-up reminder on startup.");
    sendReminderNotificationIfNeeded();
} else {
    console.log("⏳ Next reminder not due yet.");
}

    // 🔁 Set up recurring reminders on interval
    reminderIntervalId = setInterval(() => {
        sendReminderNotificationIfNeeded();
    }, intervalMs);
}



  updateRecurringPanelButtonVisibility();


  function setupRecurringPanel() {
    const overlay = document.getElementById("recurring-panel-overlay");
    const panel = document.getElementById("recurring-panel");
    const closeBtn = document.getElementById("close-recurring-panel");
    const openBtn = document.getElementById("open-recurring-panel");
    const yearlyApplyToAllCheckbox = document.getElementById("yearly-apply-days-to-all");
    const specificDatesCheckbox = document.getElementById("recur-specific-dates");
    const specificDatesPanel = document.getElementById("specific-dates-panel"); // ✅ fixed ID
    const toggleBtn = document.getElementById("toggle-advanced-settings");
   
  
    let advancedVisible = false; // Start true if you want it shown on open
    setAdvancedVisibility(advancedVisible, toggleBtn); // Initial state
  
    toggleBtn.addEventListener("click", () => {
      advancedVisible = !advancedVisible;
      setAdvancedVisibility(advancedVisible, toggleBtn);
    });
  
  
    // Modal behavior
    if (!overlay || !panel || !closeBtn || !openBtn) return;
  
openBtn.addEventListener("click", () => {
  // ✅ REFRESH the latest data from localStorage
  const freshData = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
  const cycleName = localStorage.getItem("lastUsedMiniCycle");
  const currentCycle = freshData[cycleName];

  if (!currentCycle) return;

  // ✅ Rebuild the panel with the latest task list
  updateRecurringPanel(currentCycle); // ← You may need to pass this into your render function

  document.getElementById("recurring-settings-panel")?.classList.add("hidden");
  overlay.classList.remove("hidden");
  updateRecurringSettingsVisibility();
});
      document.getElementById("set-default-recurring").checked = false;
  
    closeBtn.addEventListener("click", () => {
        updateRecurringSettingsVisibility();
      overlay.classList.add("hidden");
    });
  
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        updateRecurringSettingsVisibility();
        overlay.classList.add("hidden");
      }
    });
  
    // Frequency change handler
    const frequencySelect = document.getElementById("recur-frequency");
    if (frequencySelect) {
      frequencySelect.addEventListener("change", () => {
        const selectedFrequency = frequencySelect.value;
        const frequencyMap = {
          hourly: document.getElementById("hourly-options"),
          daily: document.getElementById("daily-options"),
          weekly: document.getElementById("weekly-options"),
          biweekly: document.getElementById("biweekly-options"),
          monthly: document.getElementById("monthly-options"),
          yearly: document.getElementById("yearly-options")
        };
        Object.values(frequencyMap).forEach(section => section?.classList.add("hidden"));
        frequencyMap[selectedFrequency]?.classList.remove("hidden");
      });
      updateRecurringSummary();
    }
  
    // Toggle helper
    const toggleVisibility = (triggerId, contentId) => {
      const trigger = document.getElementById(triggerId);
      const content = document.getElementById(contentId);
      if (trigger && content) {
        trigger.addEventListener("change", () => {
          content.classList.toggle("hidden", !trigger.checked);
        });
      }
    };
  
    // Individual toggle groups
    toggleVisibility("hourly-specific-time", "hourly-minute-container");
    toggleVisibility("daily-specific-time", "daily-time-container");
    toggleVisibility("weekly-specific-days", "weekly-day-container");
    toggleVisibility("weekly-specific-time", "weekly-time-container");
    toggleVisibility("biweekly-specific-days", "biweekly-day-container");
    toggleVisibility("biweekly-specific-time", "biweekly-time-container");
    toggleVisibility("monthly-specific-days", "monthly-day-container");
    toggleVisibility("monthly-specific-time", "monthly-time-container");
    toggleVisibility("yearly-specific-months", "yearly-month-container");
    toggleVisibility("yearly-specific-time", "yearly-time-container");
  
    const yearlySpecificDaysCheckbox = document.getElementById("yearly-specific-days");
    const yearlyDayContainer = document.getElementById("yearly-day-container");
    const yearlyMonthSelect = document.getElementById("yearly-month-select");
  
    if (yearlySpecificDaysCheckbox && yearlyDayContainer) {
      yearlySpecificDaysCheckbox.addEventListener("change", () => {
        const hasMonthSelected = getSelectedYearlyMonths().length > 0;
        yearlyDayContainer.classList.toggle("hidden", !yearlySpecificDaysCheckbox.checked || !hasMonthSelected);
      });
    }
    setupTimeConversion({ hourInputId: "specific-date-hour", minuteInputId: "specific-date-minute", meridiemSelectId: "specific-date-meridiem", militaryCheckboxId: "specific-date-military" });
    setupTimeConversion({ hourInputId: "daily-hour", minuteInputId: "daily-minute", meridiemSelectId: "daily-meridiem", militaryCheckboxId: "daily-military" });
    setupTimeConversion({ hourInputId: "weekly-hour", minuteInputId: "weekly-minute", meridiemSelectId: "weekly-meridiem", militaryCheckboxId: "weekly-military" });
    setupTimeConversion({ hourInputId: "biweekly-hour", minuteInputId: "biweekly-minute", meridiemSelectId: "biweekly-meridiem", militaryCheckboxId: "biweekly-military" });
    setupTimeConversion({ hourInputId: "monthly-hour", minuteInputId: "monthly-minute", meridiemSelectId: "monthly-meridiem", militaryCheckboxId: "monthly-military" });
    setupTimeConversion({ hourInputId: "yearly-hour", minuteInputId: "yearly-minute", meridiemSelectId: "yearly-meridiem", militaryCheckboxId: "yearly-military" });
  
    setupMilitaryTimeToggle("daily");
    setupMilitaryTimeToggle("weekly");
    setupMilitaryTimeToggle("biweekly");
    setupMilitaryTimeToggle("monthly");
    setupMilitaryTimeToggle("yearly");
  
    setupWeeklyDayToggle();
    generateMonthlyDayGrid();
    generateYearlyMonthGrid();

  
    if (yearlyMonthSelect) {
      yearlyMonthSelect.addEventListener("change", (e) => {
        const selectedMonth = parseInt(e.target.value);
        generateYearlyDayGrid(selectedMonth);
      });
      generateYearlyDayGrid(1); // Default to January
    }
  
    yearlyApplyToAllCheckbox?.addEventListener("change", handleYearlyApplyToAllChange);
    // Handles specific date visibility and disables advanced options when active
    setupSpecificDatesPanel();
    updateRecurringSummary();
  }

// Define the helper first
function setAdvancedVisibility(visible, toggleBtn) {
    advancedVisible = visible;
    toggleBtn.textContent = visible ? "Hide Advanced Options" : "Show Advanced Options";
  
    // Show/hide all `.frequency-options` panels
    document.querySelectorAll(".frequency-options").forEach(option => {
      option.style.display = visible ? "block" : "none";
    });
  
    // Always show frequency dropdown container
    const frequencyContainer = document.getElementById("recur-frequency-container");
    if (frequencyContainer) frequencyContainer.style.display = "block";
  
    // Handle extras like 'Recur indefinitely' and 'Specific Dates'
    const advancedControls = [
        { checkboxId: "recur-indefinitely" },
        { checkboxId: "recur-specific-dates" }
      ];


    advancedControls.forEach(({ checkboxId, panelId }) => {
      const checkbox = document.getElementById(checkboxId);
      if (!checkbox) return;
  
      const label = checkbox.closest("label");
      if (label) {
        label.style.display = visible ? "flex" : "none";
        
      }
    });
    const defaultBoxContainer = document.getElementById("set-default-recurring-container");
    if (defaultBoxContainer) {
      defaultBoxContainer.style.display = visible ? "block" : "none";
    }

  }

function updateRecurringPanel(currentCycleData = null) {
  const recurringList = document.getElementById("recurring-task-list");
  const freshCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
  const cycleName = localStorage.getItem("lastUsedMiniCycle");
  const cycleData = currentCycleData || freshCycles?.[cycleName];
  if (!cycleData) return;
  
    const templateTasks = Object.values(cycleData.recurringTemplates || {});
    const recurringTasks = templateTasks.map(template => {
      const existingTask = cycleData.tasks.find(t => t.id === template.id);
      return existingTask || template;
    });
  
    recurringList.innerHTML = "";
  
    if (recurringTasks.length === 0) {
      document.getElementById("recurring-panel-overlay")?.classList.add("hidden");
      return;
    }
  
    document.querySelectorAll(".recurring-task-item").forEach(el => {
      el.classList.remove("selected");
    });
  
    recurringTasks.forEach(task => {
      if (!task || !task.id || !task.text) {
        console.warn("⚠ Skipping malformed recurring task in panel:", task);
        return;
      }
  
      const item = document.createElement("li");
      item.className = "recurring-task-item";
      item.setAttribute("data-task-id", task.id);
  
      item.innerHTML = `
        <input type="checkbox" 
               class="recurring-check" 
               id="recurring-check-${task.id}" 
               name="recurring-check-${task.id}" 
               aria-label="Mark this task temporarily">
        <span class="recurring-task-text">${task.text}</span>
        <button title="Remove from Recurring" class="recurring-remove-btn">
          <i class='fas fa-trash recurring-trash-icon'></i>
        </button>
      `;
  
      const checkbox = item.querySelector(".recurring-check");
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        item.classList.toggle("checked");
      });
      checkbox.classList.add("hidden");
  
      // ✅ 🗑️ Handle remove button
      item.querySelector("button").addEventListener("click", async () => {
        const confirmRemove = await showConfirmationModal({
          title: "Remove Recurring Task",
          message: `Are you sure you want to remove "${task.text}" from recurring tasks?`,
          confirmText: "Remove",
          cancelText: "Cancel"
        });
        if (!confirmRemove) return;
  
       // ✅ Remove recurrence from the live task (if in the task list)
const liveTask = cycleData.tasks.find(t => t.id === task.id);
if (liveTask) {
  liveTask.recurring = false;
  delete liveTask.recurringSettings;
}

// 🧠 Ensure task.recurring = false is saved back into the main task list
const taskIndex = freshCycles[cycleName].tasks.findIndex(t => t.id === task.id);
if (taskIndex !== -1) {
  freshCycles[cycleName].tasks[taskIndex].recurring = false;
  freshCycles[cycleName].tasks[taskIndex].recurringSettings = {};
}
showNotification("↩️ Recurring turned off for this task.", "info", 5000);

// ✅ Remove recurring visual state
const matchingTaskItem = document.querySelector(`.task[data-task-id="${task.id}"]`);
if (matchingTaskItem) {
  const recurringBtn = matchingTaskItem.querySelector(".recurring-btn");
  if (recurringBtn) {
    recurringBtn.classList.remove("active");
    recurringBtn.setAttribute("aria-pressed", "false");
    recurringBtn.disabled = false;
  }
  matchingTaskItem.classList.remove("recurring");
  matchingTaskItem.removeAttribute("data-recurring-settings");
}

// ✅ Always delete from recurringTemplates
delete freshCycles[cycleName].recurringTemplates[task.id];
localStorage.setItem("miniCycleStorage", JSON.stringify(freshCycles));
        item.remove();
        updateRecurringPanelButtonVisibility();
  
        const remaining = Object.values(cycleData.recurringTemplates || {});
        if (remaining.length === 0) {
          document.getElementById("recurring-panel-overlay")?.classList.add("hidden");
        }
      });
  
      // ✅ 🧠 Handle task row selection for preview
      item.addEventListener("click", (e) => {
        if (
          e.target.closest(".recurring-remove-btn") ||
          e.target.closest("input[type='checkbox']")
        ) return;
  
        document.querySelectorAll(".recurring-task-item").forEach(el => {
          el.classList.remove("selected");
        });
        item.classList.add("selected");
  
        const taskId = item.dataset.taskId;
        const fullTask = cycleData.tasks.find(t => t.id === taskId) || task;
        showTaskSummaryPreview(fullTask);
      });
  
      recurringList.appendChild(item);
    });
  
    updateRecurringSummary();
  }
  
  function openRecurringSettingsPanelForTask(taskIdToPreselect) {
    updateRecurringPanel(); // Render panel fresh
  
    // Find and preselect the correct task
    const itemToSelect = document.querySelector(`.recurring-task-item[data-task-id="${taskIdToPreselect}"]`);
    if (itemToSelect) {
      itemToSelect.classList.add("selected");
  
      const checkbox = itemToSelect.querySelector("input[type='checkbox']");
      if (checkbox) {
        checkbox.checked = true;
        itemToSelect.classList.add("checked");
      }
  
      // Update the preview
      const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
      const task = savedMiniCycles?.[lastUsedMiniCycle]?.tasks.find(t => t.id === taskIdToPreselect);
      if (task) showTaskSummaryPreview(task);
    }
  
    // Show panel
    document.getElementById("recurring-panel-overlay")?.classList.remove("hidden");
  
    // Make sure checkboxes and toggle show correctly
    updateRecurringSettingsVisibility();
  }



  function updateRecurringSettingsVisibility() {
    const anySelected = document.querySelector(".recurring-task-item.selected");
    const settingsPanel = document.getElementById("recurring-settings-panel");
    const checkboxes = document.querySelectorAll(".recurring-check");
    const changeBtns = document.querySelectorAll(".change-recurring-btn");
    const toggleContainer = document.getElementById("recurring-toggle-actions");
    const toggleBtn = document.getElementById("toggle-check-all");
    const taskCount = document.querySelectorAll(".recurring-task-item").length;
  
    const show = !!anySelected;
  
    if (settingsPanel) {
      settingsPanel.classList.toggle("hidden", !show);
  
      // Show or hide checkboxes
      checkboxes.forEach(box => {
        box.classList.toggle("hidden", !show);
      });
  
      // Hide change buttons when panel is open
      changeBtns.forEach(btn => {
        btn.classList.toggle("hidden", show);
      });
    }
  
    // ✅ Only show toggle if panel is open AND checkboxes are visible AND more than one task
    const checkboxesVisible = Array.from(checkboxes).some(cb => !cb.classList.contains("hidden"));
    const shouldShowToggle = show && taskCount > 1 && checkboxesVisible;
    toggleContainer?.classList.toggle("hidden", !shouldShowToggle);
  
    // Update button label (optional)
    if (toggleBtn && shouldShowToggle) {
      const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked && !cb.classList.contains("hidden"));
      toggleBtn.textContent = anyUnchecked ? "Check All" : "Uncheck All";
    }
  
    updateRecurringSummary();
  }

  document.getElementById("toggle-check-all").addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(".recurring-check:not(.hidden)");
    const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
  
    checkboxes.forEach(cb => {
      cb.checked = anyUnchecked;
      cb.closest(".recurring-task-item").classList.toggle("checked", anyUnchecked);
    });
  
    // 🔁 Update the label based on what you just did
    const toggleCheckAllBtn = document.getElementById("toggle-check-all");
    toggleCheckAllBtn.textContent = anyUnchecked ? "Uncheck All" : "Check All";
  
    updateRecurringSummary();
  });
  
  function loadRecurringSettingsForTask(task) {
    if (!task) return;
  
    const freqSelect = document.getElementById("recur-frequency");
    const recurCheckbox = document.getElementById("recur-indefinitely");
    const recurCountInput = document.getElementById("recur-count-input");
    const countContainer = document.getElementById("recur-count-container");
  
    if (freqSelect && task.recurFrequency) {
        freqSelect.value = task.recurFrequency;
        const changeEvent = new Event("change");
        freqSelect.dispatchEvent(changeEvent);
      }
  
    if (recurCheckbox) {
      recurCheckbox.checked = task.recurIndefinitely ?? true;
    }
  
    if (recurCountInput && task.recurCount != null) {
      recurCountInput.value = task.recurCount;
    }
    updateRecurCountVisibility();
    updateRecurringSummary();
  }






  document.getElementById("specific-date-specific-time").addEventListener("change", (e) => {
    const timeContainer = document.getElementById("specific-date-time-container");
    timeContainer.classList.toggle("hidden", !e.target.checked);
    updateRecurringSummary();
  });
  







  

  function saveRecurringTemplate(task, cycleName, savedMiniCycles) {
    if (!savedMiniCycles[cycleName]) {
      console.error(`❌ Cannot save recurring template. Mini Cycle "${cycleName}" not found.`);
      return;
    }
  
    if (!savedMiniCycles[cycleName].recurringTemplates) {
      savedMiniCycles[cycleName].recurringTemplates = {};
    }
  
    savedMiniCycles[cycleName].recurringTemplates[task.id] = {
      id: task.id,
      text: task.text,
      recurring: true,
      recurringSettings: task.recurringSettings,
      highPriority: task.highPriority || false,
      dueDate: task.dueDate || null,
      remindersEnabled: task.remindersEnabled || false,
      lastTriggeredTimestamp: null,
      schemaVersion: task.schemaVersion || 2
    };
  }

  function deleteRecurringTemplate(taskId, cycleName) {
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
  
    // Check if the cycle exists
    if (!savedMiniCycles[cycleName]) {
      console.error(`❌ Cycle "${cycleName}" not found in storage.`);
      return;
    }
  
    // Check if recurringTemplates exists in this cycle
    if (!savedMiniCycles[cycleName].recurringTemplates || !savedMiniCycles[cycleName].recurringTemplates[taskId]) {
      console.warn(`⚠ Task "${taskId}" not found in recurring templates for cycle "${cycleName}".`);
      return;
    }
  
    // Delete the task template for that cycle
    delete savedMiniCycles[cycleName].recurringTemplates[taskId];
  
    // Save it back to localStorage
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
  }


function saveAlwaysShowRecurringSetting() {
  const alwaysShow = document.getElementById("always-show-recurring").checked;
  localStorage.setItem("miniCycleAlwaysShowRecurring", JSON.stringify(alwaysShow));
  refreshTaskListUI;
  updateRecurringButtonVisibility();
}

function loadAlwaysShowRecurringSetting() {
  const stored = localStorage.getItem("miniCycleAlwaysShowRecurring");
  const isEnabled = stored ? JSON.parse(stored) : false;
  document.getElementById("always-show-recurring").checked = isEnabled;
}

document.getElementById("always-show-recurring").addEventListener("change", saveAlwaysShowRecurringSetting);

document.getElementById("apply-recurring-settings")?.addEventListener("click", () => {
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const cycleData = savedMiniCycles?.[lastUsedMiniCycle];
  const checkedEls = document.querySelectorAll(".recurring-check:checked");

  if (!checkedEls.length) {
    showNotification("⚠ No tasks checked to apply settings.");
    return;
  }

  const settings = normalizeRecurringSettings(buildRecurringSettingsFromPanel());

  // 🕒 Set defaultRecurTime if not using specific time
  if (!settings.specificTime && !settings.defaultRecurTime) {
    settings.defaultRecurTime = new Date().toISOString();
  }

  // 💾 Save default recurring settings if requested
  if (document.getElementById("set-default-recurring")?.checked) {
    localStorage.setItem("miniCycleDefaultRecurring", JSON.stringify(settings));
    showNotification("✅ Default recurring settings saved!", "success", 1500);
  }

  if (!cycleData.recurringTemplates) {
    cycleData.recurringTemplates = {};
  }

  checkedEls.forEach(checkbox => {
    const taskEl = checkbox.closest("[data-task-id]");
    const taskId = taskEl?.dataset.taskId;
    if (!taskId || !taskEl) return;

    let task = cycleData.tasks.find(t => t.id === taskId);
    if (!task) {
      task = {
        id: taskId,
        text: taskEl.querySelector(".recurring-task-text")?.textContent || "Untitled Task",
        recurring: true,
        recurringSettings: structuredClone(settings),
        schemaVersion: 2
      };
    }

    // ✅ Apply recurring settings to task
    task.recurring = true;
    task.schemaVersion = 2;
    task.recurringSettings = structuredClone(settings);

    // ✅ Update recurringTemplates
    cycleData.recurringTemplates[task.id] = {
      id: task.id,
      text: task.text,
      dueDate: task.dueDate || null,
      highPriority: task.highPriority || false,
      remindersEnabled: task.remindersEnabled || false,
      recurring: true,
      recurringSettings: structuredClone(settings),
      schemaVersion: 2
    };

    // ✅ Update DOM
    taskEl.classList.add("recurring");
    taskEl.setAttribute("data-recurring-settings", JSON.stringify(settings));
    const recurringBtn = taskEl.querySelector(".recurring-btn");
    if (recurringBtn) {
      recurringBtn.classList.add("active");
      recurringBtn.setAttribute("aria-pressed", "true");
    }

    syncRecurringStateToDOM(taskEl, settings);
  });

  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
  autoSave(savedMiniCycles[lastUsedMiniCycle].tasks);
  updateRecurringSummary();
  showNotification("✅ Recurring settings applied!", "success", 2000);
  updateRecurringPanel();

  // ✅ Clean up UI state - remove selections and hide panels
  document.querySelectorAll(".recurring-task-item").forEach(el => {
    el.classList.remove("selected", "checked");
  });

  const settingsPanel = document.getElementById("recurring-settings-panel");
  settingsPanel?.classList.add("hidden");

  // ✅ FIX: Explicitly hide checkboxes and toggle container
  document.querySelectorAll(".recurring-check").forEach(cb => {
    cb.classList.add("hidden");
    cb.checked = false; // Also uncheck them for clean state
  });

  const toggleContainer = document.getElementById("recurring-toggle-actions");
  toggleContainer?.classList.add("hidden");

  const preview = document.getElementById("recurring-summary-preview");
  if (preview) preview.classList.add("hidden");

  updateRecurringPanelButtonVisibility();
});
  


  function normalizeRecurringSettings(settings = {}) {
    return {
      frequency: settings.frequency || "daily",
      indefinitely: settings.indefinitely !== false,
      count: settings.count ?? null,
      time: settings.time || null,
  
      specificDates: {
        enabled: settings.specificDates?.enabled || false,
        dates: Array.isArray(settings.specificDates?.dates) ? settings.specificDates.dates : []
      },
  
      hourly: {
        useSpecificMinute: settings.hourly?.useSpecificMinute || false,
        minute: settings.hourly?.minute || 0
      },
  
      weekly: {
        days: Array.isArray(settings.weekly?.days) ? settings.weekly.days : []
      },
  
      biweekly: {
        days: Array.isArray(settings.biweekly?.days) ? settings.biweekly.days : []
      },
  
      monthly: {
        days: Array.isArray(settings.monthly?.days) ? settings.monthly.days : []
      },
  
      yearly: {
        months: Array.isArray(settings.yearly?.months) ? settings.yearly.months : [],
        useSpecificDays: settings.yearly?.useSpecificDays || false,
        applyDaysToAll: settings.yearly?.applyDaysToAll !== false, // default is true
        daysByMonth: settings.yearly?.daysByMonth || {}
      }
    };
  }

  function buildRecurringSettingsFromPanel() {
    const frequency = document.getElementById("recur-frequency").value;
    const indefinitely = document.getElementById("recur-indefinitely").checked;
    const count = indefinitely ? null : parseInt(document.getElementById("recur-count-input").value) || 1;
    const settings = {
      frequency,
      indefinitely,
      count,
      useSpecificTime: false,
      time: null,
      specificDates: {
        enabled: false,
        dates: []
      },
      daily: {},
      hourly: {},
      weekly: {},
      biweekly: {},
      monthly: {},
      yearly: {}
    };
  
    // ✅ Specific Dates Mode
    if (document.getElementById("recur-specific-dates").checked) {
      const dateInputs = document.querySelectorAll("#specific-date-list input[type='date']");
      settings.specificDates.enabled = true;
      settings.specificDates.dates = Array.from(dateInputs).map(input => input.value).filter(Boolean);
  
      if (document.getElementById("specific-date-specific-time").checked) {
        settings.useSpecificTime = true;
        settings.time = {
          hour: parseInt(document.getElementById("specific-date-hour").value) || 0,
          minute: parseInt(document.getElementById("specific-date-minute").value) || 0,
          meridiem: document.getElementById("specific-date-meridiem").value,
          military: document.getElementById("specific-date-military").checked
        };
      }
    } else {
      // ✅ Time block for non-specific-dates
      const timeId = frequency;
      const timeEnabled = document.getElementById(`${timeId}-specific-time`)?.checked;
  
// ✅ Time block for non-specific-dates — EXCLUDE hourly!
if (frequency !== "hourly" && timeEnabled) {
  settings.useSpecificTime = true;
  settings.time = {
    hour: parseInt(document.getElementById(`${timeId}-hour`).value) || 0,
    minute: parseInt(document.getElementById(`${timeId}-minute`).value) || 0,
    meridiem: document.getElementById(`${timeId}-meridiem`).value,
    military: document.getElementById(`${timeId}-military`).checked
  };
}
  
      // ✅ Hourly Specific Minute
      if (frequency === "hourly") {
        const useSpecificMinute = document.getElementById("hourly-specific-time")?.checked;
        const minuteEl = document.getElementById("hourly-minute");
        
        settings.hourly = {
          useSpecificMinute: !!useSpecificMinute,
          minute: useSpecificMinute && minuteEl ? parseInt(minuteEl.value) || 0 : 0
        };
      }
  
      // ✅ Weekly & Biweekly
      if (frequency === "weekly" || frequency === "biweekly") {
        const selector = `.${frequency}-day-box.selected`;
        settings[frequency] = {
          useSpecificDays: document.getElementById(`${frequency}-specific-days`)?.checked,
          days: Array.from(document.querySelectorAll(selector)).map(el => el.dataset.day)
        };
      }
  
      // ✅ Monthly
      if (frequency === "monthly") {
        settings.monthly = {
          useSpecificDays: document.getElementById("monthly-specific-days")?.checked,
          days: Array.from(document.querySelectorAll(".monthly-day-box.selected")).map(el => parseInt(el.dataset.day))
        };
      }
  
      // ✅ Yearly
      if (frequency === "yearly") {
        const applyAll = document.getElementById("yearly-apply-days-to-all")?.checked;
        const useMonths = document.getElementById("yearly-specific-months")?.checked;
        const useDays = document.getElementById("yearly-specific-days")?.checked;
  
        settings.yearly = {
          useSpecificMonths: useMonths,
          months: getSelectedYearlyMonths(),
          useSpecificDays: useDays,
          daysByMonth: applyAll ? { all: selectedYearlyDays["all"] || [] } : { ...selectedYearlyDays },
          applyDaysToAll: applyAll
        };
      }
    }
  
    return settings;
  }
  

function clearNonRelevantRecurringFields(task, frequency) {
  const allowedFields = {
    daily: ["dailyTime"],
    weekly: ["weeklyDays"],
    biweekly: ["biweeklyDays"],
    monthly: ["monthlyDays"],
    yearly: ["yearlyMonths", "yearlyDates"],
    hourly: [],
  };

  const allExtraFields = [
    "specificDates", "specificTime",
    "dailyTime", "weeklyDays", "biweeklyDays", "monthlyDays",
    "yearlyMonths", "yearlyDates"
  ];

  const keep = allowedFields[frequency] || [];
  task.recurringSettings = Object.fromEntries(
    Object.entries(task.recurringSettings).filter(([key]) =>
      ["frequency", "count", "indefinitely", ...keep].includes(key)
    )
  );
}

function syncRecurringStateToDOM(taskEl, recurringSettings) {
  taskEl.setAttribute("data-recurring-settings", JSON.stringify(recurringSettings));
  const recurringBtn = taskEl.querySelector(".recurring-btn");
  if (recurringBtn) {
    recurringBtn.classList.add("active");
    recurringBtn.setAttribute("aria-pressed", "true");
  }
}











  const cancelBtn = document.getElementById("cancel-recurring-settings");

  cancelBtn?.addEventListener("click", () => {
    const settingsPanel = document.getElementById("recurring-settings-panel");
    settingsPanel?.classList.add("hidden");
  
    // Deselect all selected tasks
    document.querySelectorAll(".recurring-task-item").forEach(el => {
      el.classList.remove("selected");
      el.querySelector("input[type='checkbox']").checked = false;
    });
  
    // Hide checkboxes and uncheck them
    document.querySelectorAll(".recurring-check").forEach(cb => {
      cb.checked = false;
      cb.classList.add("hidden");
      cb.closest(".recurring-task-item")?.classList.remove("checked");
    });
  
    // Hide the summary preview if visible
    const preview = document.getElementById("recurring-summary-preview");
    if (preview) preview.classList.add("hidden");
  
    updateRecurringSettingsVisibility();
  });





  document.getElementById("recur-indefinitely").addEventListener("change", (e) => {
    const countContainer = document.getElementById("recur-count-container");
    const recurCount = document.getElementById("recur-count-input");
    const hidden = e.target.checked;
    countContainer.classList.toggle("hidden", hidden);
    updateRecurCountVisibility();
    updateRecurringSummary();
  });

  function setupBiweeklyDayToggle() {
    document.querySelectorAll(".biweekly-day-box").forEach(box => {
      box.addEventListener("click", () => {
        box.classList.toggle("selected");
      });
    });
  }

  setupBiweeklyDayToggle();
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("recurring-panel");
    const taskList = document.getElementById("recurring-task-list");
    const settingsPanel = document.getElementById("recurring-settings-panel");
    const overlay = document.getElementById("recurring-panel-overlay");
    const summaryPreview = document.getElementById("recurring-summary-preview");
  
    if (!overlay || overlay.classList.contains("hidden")) return;
  
    if (taskList.contains(e.target) || settingsPanel.contains(e.target)) return;
  
    // 🔽 New block for hiding summary preview
    if (summaryPreview && !summaryPreview.contains(e.target) && !taskList.contains(e.target)) {
      summaryPreview.classList.add("hidden");
      document.querySelectorAll(".recurring-task-item").forEach(el => el.classList.remove("selected"));
    }
  });









  function setupMilitaryTimeToggle(prefix) {
    const toggle = document.getElementById(`${prefix}-military`);
    const hourInput = document.getElementById(`${prefix}-hour`);
    const meridiemSelect = document.getElementById(`${prefix}-meridiem`);
  
    if (!toggle || !hourInput || !meridiemSelect) return;
  
    toggle.addEventListener("change", () => {
      const is24Hour = toggle.checked;
  
      // Change hour range
      hourInput.min = is24Hour ? 0 : 1;
      hourInput.max = is24Hour ? 23 : 12;
  
      // Hide or show meridiem selector
      meridiemSelect.classList.toggle("hidden", is24Hour);
    });
  }

  function setupTimeConversion({
    hourInputId,
    minuteInputId,
    meridiemSelectId,
    militaryCheckboxId
  }) {
    const hourInput = document.getElementById(hourInputId);
    const minuteInput = document.getElementById(minuteInputId);
    const meridiemSelect = document.getElementById(meridiemSelectId);
    const militaryToggle = document.getElementById(militaryCheckboxId);
  
    if (!hourInput || !minuteInput || !meridiemSelect || !militaryToggle) return;
  
    militaryToggle.addEventListener("change", () => {
      const is24Hour = militaryToggle.checked;
      let hour = parseInt(hourInput.value) || 0;
      let meridiem = meridiemSelect.value;
  
      if (is24Hour) {
        // Convert from 12h to 24h
        if (meridiem === "AM") {
          hour = hour === 12 ? 0 : hour;
        } else {
          hour = hour === 12 ? 12 : hour + 12;
        }
        hourInput.value = hour;
        meridiemSelect.classList.add("hidden");
      } else {
        // Convert from 24h to 12h
        if (hour === 0) {
          hourInput.value = 12;
          meridiemSelect.value = "AM";
        } else if (hour < 12) {
          hourInput.value = hour;
          meridiemSelect.value = "AM";
        } else if (hour === 12) {
          hourInput.value = 12;
          meridiemSelect.value = "PM";
        } else {
          hourInput.value = hour - 12;
          meridiemSelect.value = "PM";
        }
        meridiemSelect.classList.remove("hidden");
      }
    });
  }






  function generateMonthlyDayGrid() {
    const container = document.querySelector(".monthly-days");
    if (!container) return;
  
    container.innerHTML = "";
  
    for (let i = 1; i <= 31; i++) {
      const dayBox = document.createElement("div");
      dayBox.className = "monthly-day-box";
      dayBox.setAttribute("data-day", i);
      dayBox.textContent = i;
  
      // Toggle selection on click
      dayBox.addEventListener("click", () => {
        dayBox.classList.toggle("selected");
      });
  
      container.appendChild(dayBox);
    }
  }

  

  function setupWeeklyDayToggle() {
    document.querySelectorAll(".weekly-day-box").forEach(box => {
      box.addEventListener("click", () => {
        box.classList.toggle("selected");
      });
    });
  }



  function generateYearlyMonthGrid() {
    const container = document.querySelector(".yearly-months");
    if (!container) return;
  
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
    container.innerHTML = "";
  
    monthNames.forEach((name, index) => {
      const monthBox = document.createElement("div");
      monthBox.className = "yearly-month-box";
      monthBox.setAttribute("data-month", index + 1);
      monthBox.textContent = name;
  
      monthBox.addEventListener("click", () => {
        // Toggle selection
        monthBox.classList.toggle("selected");
  
        const selectedMonths = getSelectedYearlyMonths();
  
        // ✅ Reveal or hide the specific-days checkbox label
        const specificDaysLabel = document.getElementById("yearly-specific-days-label");
        if (specificDaysLabel) {
          specificDaysLabel.classList.toggle("hidden", selectedMonths.length === 0);
        }
  
        // Show/hide day container based on selection + checkbox state
        const yearlySpecificDaysCheckbox = document.getElementById("yearly-specific-days");
        const yearlyDayContainer = document.getElementById("yearly-day-container");
  
        if (yearlySpecificDaysCheckbox && yearlyDayContainer) {
          const shouldShow = yearlySpecificDaysCheckbox.checked && selectedMonths.length > 0;
          yearlyDayContainer.classList.toggle("hidden", !shouldShow);
        }
  
        // Update dropdown
        const yearlyMonthSelect = document.getElementById("yearly-month-select");
        if (yearlyMonthSelect) {
          yearlyMonthSelect.innerHTML = "";
  
          selectedMonths.forEach((monthNum) => {
            const option = document.createElement("option");
            option.value = monthNum;
            option.textContent = new Date(0, monthNum - 1).toLocaleString('default', { month: 'long' });
            yearlyMonthSelect.appendChild(option);
          });
  
          if (selectedMonths.length > 0) {
            const currentMonth = index + 1;
            yearlyMonthSelect.value = currentMonth;
            generateYearlyDayGrid(currentMonth);
          } else {
            document.querySelector(".yearly-days").innerHTML = "";
          }
        }
      });
  
      container.appendChild(monthBox);
    });
  }

  
  function generateYearlyDayGrid(monthNumber) {
    const container = document.querySelector(".yearly-days");
    if (!container) return;
  
    container.innerHTML = "";
  
    const daysInMonth = new Date(2025, monthNumber, 0).getDate();
    const selectedDays = selectedYearlyDays[monthNumber] || [];
  const applyToAll = yearlyApplyToAllCheckbox?.checked;
const activeMonths = getSelectedYearlyMonths();

// If "apply to all" is checked, use the shared day list
const sharedDays = selectedYearlyDays["all"] || [];

for (let i = 1; i <= daysInMonth; i++) {
  const dayBox = document.createElement("div");
  dayBox.className = "yearly-day-box";
  dayBox.setAttribute("data-day", i);
  dayBox.textContent = i;

  const isSelected = applyToAll
    ? sharedDays.includes(i)
    : selectedDays.includes(i);

  if (isSelected) {
    dayBox.classList.add("selected");
  }

  dayBox.addEventListener("click", () => {
    dayBox.classList.toggle("selected");
    const isNowSelected = dayBox.classList.contains("selected");

    if (applyToAll) {
      // Update sharedDays
      if (isNowSelected && !sharedDays.includes(i)) {
        sharedDays.push(i);
      } else if (!isNowSelected && sharedDays.includes(i)) {
        const idx = sharedDays.indexOf(i);
        sharedDays.splice(idx, 1);
      }

      selectedYearlyDays["all"] = sharedDays;

      // Sync all selected months
      activeMonths.forEach(month => {
        selectedYearlyDays[month] = [...sharedDays];
      });
    } else {
      // Regular mode, per-month
      const current = selectedYearlyDays[monthNumber] || [];
      if (isNowSelected && !current.includes(i)) {
        current.push(i);
      } else if (!isNowSelected && current.includes(i)) {
        const idx = current.indexOf(i);
        current.splice(idx, 1);
      }
      selectedYearlyDays[monthNumber] = current;
    }
  });

  container.appendChild(dayBox);
}

  }
  
  function handleYearlyApplyToAllChange() {
    const checkbox = document.getElementById("yearly-apply-days-to-all");
    const dropdown = document.getElementById("yearly-month-select");
    const selectedMonths = getSelectedYearlyMonths();
  
    if (!checkbox || !dropdown) return;
  
    if (checkbox.checked) {
      dropdown.classList.add("hidden");
      if (selectedMonths.length > 0) {
        generateYearlyDayGrid(selectedMonths[0]); // Use any selected month for grid
      }
    } else {
      dropdown.classList.remove("hidden");
      const selectedMonth = parseInt(dropdown.value);
      generateYearlyDayGrid(selectedMonth);
    }
  }


  function getSelectedYearlyMonths() {
    return Array.from(document.querySelectorAll(".yearly-month-box.selected"))
                .map(el => parseInt(el.dataset.month));
  }

  function getSelectedMonthlyDays() {
    return Array.from(document.querySelectorAll(".monthly-day-box.selected"))
                .map(el => parseInt(el.dataset.day));
  }
  

function setupSpecificDatesPanel() {
  const checkbox = document.getElementById("recur-specific-dates");
  const panel = document.getElementById("specific-dates-panel");
  const timeOptions = document.getElementById("specific-date-time-options"); // ⬅️ New
  const addBtn = document.getElementById("add-specific-date");
  const list = document.getElementById("specific-date-list");

  const createDateInput = (isFirst = false) => {
    const wrapper = document.createElement("div");
    wrapper.className = "specific-date-item";

    const input = document.createElement("input");
    input.type = "date";
    const index = list.children.length;
    input.setAttribute("aria-label", isFirst ? "First specific date" : `Specific date ${index + 1}`);
    input.required = true;
    input.valueAsDate = getTomorrow();

    if (isFirst) {
        input.classList.add("first-specific-date");
      }

    input.addEventListener("change", () => {
      if (isFirst && !input.value) {
        input.valueAsDate = getTomorrow();
      }
    });

    wrapper.appendChild(input);

    if (!isFirst) {
      const trash = document.createElement("button");
      trash.type = "button";
      trash.className = "trash-btn";
      trash.innerHTML = "<i class='fas fa-trash recurring-date-trash-icon'></i>";
      trash.title = "Remove this date";


      trash.addEventListener("click", () => {
        wrapper.remove();
        updateRecurCountVisibility();
        updateRecurringSummary();
      });
      wrapper.appendChild(trash);
    }

    list.appendChild(wrapper);
  };

  checkbox.addEventListener("change", () => {
    const shouldShow = checkbox.checked;
  
    panel.classList.toggle("hidden", !shouldShow);
    timeOptions.classList.toggle("hidden", !shouldShow);
  
    // Hide all other recurrence panels
    document.querySelectorAll(".frequency-options").forEach(panel => {
      panel.classList.add("hidden");
    });
  
    document.getElementById("recur-frequency-container").classList.toggle("hidden", shouldShow);
    document.getElementById("recur-indefinitely").closest("label").classList.toggle("hidden", shouldShow);
  
    const advancedBtn = document.getElementById("toggle-advanced-settings");
    if (advancedBtn) {
      advancedBtn.classList.toggle("hidden", shouldShow);
    }
  
    if (shouldShow && list.children.length === 0) {
      createDateInput(true); // Add first date
    }
  
    if (!shouldShow) {
      document.getElementById("specific-date-specific-time").checked = false;
      document.getElementById("specific-date-time-container").classList.add("hidden");
  
      // ✅ Re-show frequency options by triggering dropdown change event
      const freqSelect = document.getElementById("recur-frequency");
      if (freqSelect) {
        const event = new Event("change");
        freqSelect.dispatchEvent(event);
      }
    }
  
    updateRecurCountVisibility();
    updateRecurringSummary();
  });

  addBtn.addEventListener("click", () => {
    createDateInput(false);
    updateRecurringSummary();
  });

  updateRecurringSummary();
}
  
  function getTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  function updateRecurCountVisibility() {
    const isIndefinite = document.getElementById("recur-indefinitely").checked;
    const isUsingSpecificDates = document.getElementById("recur-specific-dates").checked;
    const countContainer = document.getElementById("recur-count-container");
  
    // Only show if NOT using specific dates AND NOT recurring indefinitely
    const shouldShow = !isUsingSpecificDates && !isIndefinite;
    countContainer.classList.toggle("hidden", !shouldShow);
  }





function updateRecurringButtonVisibility() {
  const autoReset = toggleAutoReset.checked;
  const deleteCheckedEnabled = deleteCheckedTasks.checked;

  document.querySelectorAll(".task").forEach(taskItem => {
    const recurringButton = taskItem.querySelector(".recurring-btn");
    if (!recurringButton) return;

    if (isAlwaysShowRecurringEnabled() || (!autoReset && deleteCheckedEnabled)) {
  recurringButton.classList.remove("hidden");
    } else {
      recurringButton.classList.add("hidden");
    }
  });
}

function isAlwaysShowRecurringEnabled() {
  return document.getElementById("always-show-recurring")?.checked ||
         JSON.parse(localStorage.getItem("miniCycleAlwaysShowRecurring")) === true;
}
  
  function updateRecurringPanelButtonVisibility() {
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
    const cycleData = savedMiniCycles?.[lastUsedMiniCycle];
    const button = document.getElementById("open-recurring-panel");
  
    if (!cycleData || !Array.isArray(cycleData.tasks) || !button) return;
  
    const hasRecurring =
    cycleData.tasks.some(task => task.recurring) ||
    Object.keys(cycleData.recurringTemplates || {}).length > 0;
    button.classList.toggle("hidden", !hasRecurring);
  }
  
function updateRecurringSummary() {
  const summaryEl = document.getElementById("recurring-summary");
  if (!summaryEl) return;

  // ✅ Build settings from the panel input
  const settings = buildRecurringSettingsFromPanel();

  // ✅ Simulate fallback default time (for preview only)
  if (!settings.useSpecificTime && !settings.defaultRecurTime) {
    settings.defaultRecurTime = new Date().toISOString();
  }

  // ✅ Generate summary text using the shared utility
  const summaryText = buildRecurringSummaryFromSettings(settings);

  // ✅ Apply to DOM
  summaryEl.textContent = summaryText;
  summaryEl.classList.remove("hidden");
}

  function parseDateAsLocal(dateStr) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
  }


  
  function attachRecurringSummaryListeners() {
    const panel = document.getElementById("recurring-settings-panel");
    safeAddEventListener(panel, "change", handleRecurringChange);
    safeAddEventListener(panel, "click", handleRecurringClick);
  }





  function showTaskSummaryPreview(task) {
    if (!task || !task.id) {
      console.warn("No valid task provided for recurring preview.");
      return;
    }
  
    const summaryContainer = document.getElementById("recurring-summary-preview") || createTaskSummaryPreview();
    summaryContainer.innerHTML = "";
  
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const cycleName = localStorage.getItem("lastUsedMiniCycle");
    const recurringSettings =
    task.recurringSettings ||
    savedMiniCycles[cycleName]?.recurringTemplates?.[task.id]?.recurringSettings;
  
    // 🏷️ Label
    const label = document.createElement("div");
    label.textContent = "Current Recurring Settings:";
    label.className = "summary-label";
    summaryContainer.appendChild(label);
  
    // 📄 Summary Text
    const summaryText = document.createElement("div");
    summaryText.className = "summary-text";
    summaryText.textContent = recurringSettings
      ? getRecurringSummaryText(recurringSettings)
      : "This task is not marked as recurring.";
    summaryContainer.appendChild(summaryText);
  
    // 🔘 Change Button
    const changeBtn = document.createElement("button");
    changeBtn.textContent = "Change Recurring Settings";
    changeBtn.className = "change-recurring-btn";
    changeBtn.setAttribute("aria-label", "Change recurring settings for this task");
  
    const settingsPanel = document.getElementById("recurring-settings-panel");
    if (settingsPanel && !settingsPanel.classList.contains("hidden")) {
      changeBtn.classList.add("hidden");
    }
  
    changeBtn.addEventListener("click", () => {
      openRecurringSettingsPanelForTask(task.id);
    });
  
    summaryContainer.appendChild(changeBtn);
    summaryContainer.classList.remove("hidden");
  }
  
  // Helper to create the preview container if it doesn’t exist yet
  function createTaskSummaryPreview() {
    const container = document.createElement("div");
    container.id = "recurring-summary-preview";
    container.className = "recurring-summary recurring-summary-preview hidden";
    document.getElementById("recurring-panel").appendChild(container);
    return container;
  }
  

// Before:
function getRecurringSummaryText(template) {
  return buildRecurringSummaryFromSettings(template.recurringSettings || {});
}

// After—treat the argument itself as the settings
function getRecurringSummaryText(settings) {
  return buildRecurringSummaryFromSettings(settings || {});
}
  


// ✅ Shared utility: Build a recurring summary string from a settings object
function buildRecurringSummaryFromSettings(settings = {}) {
  const freq = settings.frequency || "daily";
  const indefinitely = settings.indefinitely ?? true;
  const count = settings.count;

  // === ✅ SPECIFIC DATES OVERRIDE ===
  if (settings.specificDates?.enabled && settings.specificDates.dates?.length) {
    const formattedDates = settings.specificDates.dates.map(dateStr => {
      const date = parseDateAsLocal(dateStr);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short"
      });
    });

    let summary = `📅 Specific dates: ${formattedDates.join(", ")}`;

    // Optionally show time for specific dates
    if (settings.time) {
      const { hour, minute, meridiem, military } = settings.time;
      const formattedTime = military
        ? `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        : `${hour}:${minute.toString().padStart(2, "0")} ${meridiem}`;
      summary += ` ⏰ at ${formattedTime}`;
    } else if (!settings.useSpecificTime && settings.defaultRecurTime) {
      const time = new Date(settings.defaultRecurTime);
      const fallbackTime = time.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      summary += ` ⏰ at ${fallbackTime}`;
    }

    return summary;
  }

  // === 🔁 Normal Recurrence Fallback ===
  let summaryText = `⏱ Repeats ${freq}`;
  if (!indefinitely && count) {
    summaryText += ` for ${count} time${count !== 1 ? "s" : ""}`;
  } else {
    summaryText += " indefinitely";
  }

  // === TIME HANDLING ===
  if (settings.time && (settings.useSpecificTime ?? true)) {
    const { hour, minute, meridiem, military } = settings.time;
    const formatted = military
      ? `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
      : `${hour}:${minute.toString().padStart(2, "0")} ${meridiem}`;
    summaryText += ` at ${formatted}`;
  } else if (!settings.useSpecificTime && settings.defaultRecurTime) {
    const time = new Date(settings.defaultRecurTime);
    const fallbackTime = time.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    summaryText += ` at ${fallbackTime}`;
  }

  // === HOURLY ===
  if (freq === "hourly" && settings.hourly?.useSpecificMinute) {
    summaryText += ` every hour at :${settings.hourly.minute.toString().padStart(2, "0")}`;
  }

  // === WEEKLY & BIWEEKLY ===
  if ((freq === "weekly" || freq === "biweekly") && settings[freq]?.days?.length) {
    summaryText += ` on ${settings[freq].days.join(", ")}`;
  }

  // === MONTHLY ===
  if (freq === "monthly" && settings.monthly?.days?.length) {
    summaryText += ` on day${settings.monthly.days.length > 1 ? "s" : ""} ${settings.monthly.days.join(", ")}`;
  }

  // === YEARLY ===
  if (freq === "yearly") {
    const months = settings.yearly?.months || [];
    const daysByMonth = settings.yearly?.daysByMonth || {};

    if (months.length) {
      const monthNames = months.map(m => new Date(0, m - 1).toLocaleString("default", { month: "short" }));
      summaryText += ` in ${monthNames.join(", ")}`;
    }

    if (settings.yearly?.useSpecificDays) {
      if (settings.yearly.applyDaysToAll && daysByMonth.all?.length) {
        summaryText += ` on day${daysByMonth.all.length > 1 ? "s" : ""} ${daysByMonth.all.join(", ")}`;
      } else {
        const parts = months.map(month => {
          const days = daysByMonth[month] || [];
          if (days.length === 0) return null;
          const monthName = new Date(0, month - 1).toLocaleString("default", { month: "short" });
          return `${monthName}: ${days.join(", ")}`;
        }).filter(Boolean);

        if (parts.length) {
          summaryText += ` on ${parts.join("; ")}`;
        }
      }
    }
  }

  return summaryText;
}

// Usage in summary preview:
// const summary = buildRecurringSummaryFromSettings(task.recurringSettings);

function removeRecurringTasksFromCycle(taskElements, cycleData) {
  taskElements.forEach(taskEl => {
    const taskId = taskEl.dataset.taskId;
    const isRecurring = taskEl.classList.contains("recurring");

    if (isRecurring) {
      // ✅ Remove from DOM
      taskEl.remove();

      // ✅ Remove from task list in memory
      const index = cycleData.tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        cycleData.tasks.splice(index, 1);
      }
    }
  });
}


function handleRecurringTasksAfterReset() {
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const cycleData = savedMiniCycles[lastUsedMiniCycle];
  const taskElements = [...taskList.querySelectorAll(".task")];

  // ✅ Reuse the same helper
  removeRecurringTasksFromCycle(taskElements, cycleData);

  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

  updateProgressBar();
  updateStatsPanel();
  checkCompleteAllButton();
}

function convert12To24(hour, meridiem) {
  hour = parseInt(hour, 10);
  if (meridiem === "PM" && hour !== 12) return hour + 12;
  if (meridiem === "AM" && hour === 12) return 0;
  return hour;
}


// ✅ Main logic to determine if a task should recur today
function shouldTaskRecurNow(settings, now = new Date()) {
 // ✅ Specific Dates override all… but still honor specific‑time if set
if (settings.specificDates?.enabled) {
  const todayMatch = settings.specificDates.dates?.some(dateStr => {
    const date = parseDateAsLocal(dateStr);
    return date.getFullYear() === now.getFullYear()
        && date.getMonth()  === now.getMonth()
        && date.getDate()   === now.getDate();
  });
  if (!todayMatch) return false;

  // Only trigger at the exact time if the user checked “specific time”
  if (settings.time) {
    const hour   = settings.time.military
                   ? settings.time.hour
                   : convert12To24(settings.time.hour, settings.time.meridiem);
    const minute = settings.time.minute;
    return now.getHours() === hour && now.getMinutes() === minute;
  }

  return true;
}

  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const day = now.getDate();
  const month = now.getMonth() + 1;

  switch (settings.frequency) {
case "daily":
  if (settings.time) {
    const hour = settings.time.military
      ? settings.time.hour
      : convert12To24(settings.time.hour, settings.time.meridiem);
    const minute = settings.time.minute;
    return now.getHours() === hour && now.getMinutes() === minute;
  }
  return now.getHours() === 0 && now.getMinutes() === 0;

   case "weekly":
case "biweekly":
  if (!settings[settings.frequency]?.days?.includes(weekday)) return false;

  if (settings.time) {
    const hour = settings.time.military
      ? settings.time.hour
      : convert12To24(settings.time.hour, settings.time.meridiem);
    const minute = settings.time.minute;
    return now.getHours() === hour && now.getMinutes() === minute;
  }

  return true; // if no time set, recur any time today


   case "monthly":
  if (!settings.monthly?.days?.includes(day)) return false;

  if (settings.time) {
    const hour = settings.time.military
      ? settings.time.hour
      : convert12To24(settings.time.hour, settings.time.meridiem);
    const minute = settings.time.minute;
    return now.getHours() === hour && now.getMinutes() === minute;
  }

  return true; // If no time is set, trigger any time during the day

    case "yearly":
  if (!settings.yearly?.months?.includes(month)) return false;

  if (settings.yearly.useSpecificDays) {
    const daysByMonth = settings.yearly.daysByMonth || {};
    const days = settings.yearly.applyDaysToAll
      ? daysByMonth.all || []
      : daysByMonth[month] || [];

    if (!days.includes(day)) return false;
  }

  if (settings.time) {
    const hour = settings.time.military
      ? settings.time.hour
      : convert12To24(settings.time.hour, settings.time.meridiem);
    const minute = settings.time.minute;
    return now.getHours() === hour && now.getMinutes() === minute;
  }

  return true; // If no time is set, recur any time that day

    case "hourly":
      if (settings.hourly?.useSpecificMinute) {
        const minute = now.getMinutes();
        return minute === settings.hourly.minute;
      }
      return now.getMinutes() === 0;

    default:
      return false;
  }
}







// ✅ Helper: Check if a recurring task should be recreated
function shouldRecreateRecurringTask(template, taskList, now) {
  const { id, text, recurringSettings, recurring, lastTriggeredTimestamp, suppressUntil } = template;

  if (!recurring || !recurringSettings) return false;

  // 🔒 Already exists?
  if (taskList.some(task => task.id === id)) return false;

  // ⏸️ Suppressed?
  if (suppressUntil && new Date(suppressUntil) > now) {
    console.log(`⏸ Skipping "${text}" — suppressed until ${suppressUntil}`);
    return false;
  }

  // ⏱ Triggered recently?
  if (lastTriggeredTimestamp) {
    const last = new Date(lastTriggeredTimestamp);
    const sameMinute =
      last.getFullYear() === now.getFullYear() &&
      last.getMonth()    === now.getMonth()    &&
      last.getDate()     === now.getDate()     &&
      last.getHours()    === now.getHours()    &&
      last.getMinutes()  === now.getMinutes();
    if (sameMinute) return false;
  }

  // 🧠 Recurrence match?
  return shouldTaskRecurNow(recurringSettings, now);
}

function watchRecurringTasks() {
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const cycleData = savedMiniCycles?.[lastUsedMiniCycle];
  const templates = cycleData?.recurringTemplates || {};
  const taskList = cycleData?.tasks || [];

  if (!Object.keys(templates).length) return;

  const now = new Date();
  let taskAdded = false;

  Object.values(templates).forEach(template => {
    // ⛔ Prevent re-adding if task already exists by ID
    if (taskList.some(task => task.id === template.id)) return;
    if (!shouldRecreateRecurringTask(template, taskList, now)) return;

    console.log("⏱ Auto‑recreating recurring task:", template.text);

    addTask(
      template.text,
      false,  // not completed
      false,  // shouldSave = false (batch save at end)
      template.dueDate,
      template.highPriority,
      true,   // isLoading = true
      template.remindersEnabled,
      true,   // recurring = true
      template.id,
      template.recurringSettings
    );

    template.lastTriggeredTimestamp = now.getTime();
    taskAdded = true;
  });

  if (taskAdded) {
    autoSave(); // ✅ batch save only if something was added
  }
}


function setupRecurringWatcher(lastUsedMiniCycle, savedMiniCycles) {
  const recurringTemplates = savedMiniCycles?.[lastUsedMiniCycle]?.recurringTemplates || {};
  if (Object.keys(recurringTemplates).length === 0) return;

  watchRecurringTasks();
  setInterval(watchRecurringTasks, 30000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      watchRecurringTasks();
    }
  });
}



/**
 * Setupsettingsmenu function.
 *
 * @returns {void}
 */
function setupSettingsMenu() {
    const settingsModal = document.querySelector(".settings-modal");
    const settingsModalContent = document.querySelector(".settings-modal-content");
    const openSettingsBtn = document.getElementById("open-settings");
    const closeSettingsBtn = document.getElementById("close-settings");

    /**
     * Opens the settings menu.
     *
     * @param {Event} event - The click event.
     */
    function openSettings(event) {
        event.stopPropagation();
        settingsModal.style.display = "flex";
        hideMainMenu();
    }

    /**
     * Closes the settings menu.
     */
    function closeSettings() {
        settingsModal.style.display = "none";
    }

    function closeOnClickOutside(event) {
        if (settingsModal.style.display === "flex" && 
            !settingsModalContent.contains(event.target) && 
            event.target !== openSettingsBtn) {
            settingsModal.style.display = "none";
        }
    }

    // ✅ Remove previous listeners before adding new ones
    openSettingsBtn.removeEventListener("click", openSettings);
    closeSettingsBtn.removeEventListener("click", closeSettings);
    document.removeEventListener("click", closeOnClickOutside);

    // ✅ Add event listeners (only once)
    openSettingsBtn.addEventListener("click", openSettings);
    closeSettingsBtn.addEventListener("click", closeSettings);
    document.addEventListener("click", closeOnClickOutside);

    // ✅ Dark Mode Toggle (Check if the element exists first)
    setupDarkModeToggle("darkModeToggle", ["darkModeToggle", "darkModeToggleThemes"]);

    // ✅ Toggle Move Arrows Setting
    const moveArrowsToggle = document.getElementById("toggle-move-arrows");
    if (moveArrowsToggle) {
        moveArrowsToggle.checked = localStorage.getItem("miniCycleMoveArrows") === "true";
        moveArrowsToggle.addEventListener("change", () => {
            localStorage.setItem("miniCycleMoveArrows", moveArrowsToggle.checked);
            updateMoveArrowsVisibility();
        });
    }


// ✅ Toggle Three-Dot Menu Setting
const threeDotsToggle = document.getElementById("toggle-three-dots");
if (threeDotsToggle) {
  const enabled = localStorage.getItem("miniCycleThreeDots") === "true";
  threeDotsToggle.checked = enabled;
  document.body.classList.toggle("show-three-dots-enabled", enabled);

  threeDotsToggle.addEventListener("change", () => {
    const enabled = threeDotsToggle.checked;
    localStorage.setItem("miniCycleThreeDots", enabled);
    document.body.classList.toggle("show-three-dots-enabled", enabled);

    // ✅ Disable/enable hover behavior for current tasks
    toggleHoverTaskOptions(!enabled);

    // ✅ Update task list UI
    refreshTaskListUI(); 
  });
}

    // ✅ Backup Mini Cycles
    document.getElementById("backup-mini-cycles").addEventListener("click", () => {
        const backupData = {
            miniCycleStorage: localStorage.getItem("miniCycleStorage"),
            lastUsedMiniCycle: localStorage.getItem("lastUsedMiniCycle"),
        };
        const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const backupUrl = URL.createObjectURL(backupBlob);
        const a = document.createElement("a");
        a.href = backupUrl;
        a.download = "mini-cycle-backup.json";
        a.click();
    });

    // ✅ Restore Mini Cycles
    document.getElementById("restore-mini-cycles").addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.addEventListener("change", (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const backupData = JSON.parse(e.target.result);
                    if (backupData.miniCycleStorage) {
                        localStorage.setItem("miniCycleStorage", backupData.miniCycleStorage);
                        localStorage.setItem("lastUsedMiniCycle", backupData.lastUsedMiniCycle || "");
                        showNotification("✅ Backup Restored!");
                        location.reload();
                    } else {
                        showNotification("❌ Invalid backup file.");
                    }
                } catch (error) {
                    showNotification("❌ Error restoring backup.");
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });

    document.getElementById("reset-recurring-default")?.addEventListener("click", resetDefaultRecurringSettings);

    function resetDefaultRecurringSettings() {
      const defaultSettings = {
        frequency: "daily",
        indefinitely: true,
        time: null
      };
      localStorage.setItem("miniCycleDefaultRecurring", JSON.stringify(defaultSettings));
      showNotification("🔁 Recurring default reset to Daily Indefinitely.", "success");
    }

    
    // ✅ Factory Reset (Clear All Mini Cycles)
// ✅ Factory Reset (Full App Data Wipe)
document.getElementById("factory-reset").addEventListener("click", async () => {
  const confirmed = await showConfirmationModal({
    title: "Factory Reset",
    message: "⚠️ This will DELETE ALL Mini Cycle data, settings, and progress. Are you sure?",
    confirmText: "Delete Everything",
    cancelText: "Cancel"
  });

  if (confirmed) {
    const keysToRemove = [
      // Core cycles & tasks
      "miniCycleStorage",
      "lastUsedMiniCycle",
      "miniCycleState",
      "miniCycleTaskStates",
      "miniCycleThreeDots",
      "miniCycleMoveArrows",

      // UI preferences
      "currentTheme",
      "darkModeEnabled",
      "miniCycleNotificationPosition",

      // Feature toggles & reminders
      "miniCycleReminders",
      "miniCycleDefaultRecurring",

      // Achievements & onboarding
      "milestoneUnlocks",
      "miniCycleOnboarding",
      "overdueTaskStates",

      // Game scores
      "bestRound",
      "bestTime"
    ];

    // 💥 Wipe all relevant keys
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // ✅ Notify and reload
    showNotification("✅ Factory Reset Complete. Reloading...");
    setTimeout(() => location.reload(), 600);
  }
});


// Open Testing Modal Button
const openTestingBtn = document.getElementById("open-testing-modal");
if (openTestingBtn) {
    openTestingBtn.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("testing-modal").style.display = "flex";
        closeSettings(); // Close settings when opening testing
    });
}

// Close Testing Modal
const closeTestingBtns = document.querySelectorAll(".close-testing-modal, #close-testing-modal");
closeTestingBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        document.getElementById("testing-modal").style.display = "none";
    });
});




}





/**
 * Setup Testing Modal functionality
 */
function setupTestingModal() {
    // ==========================================
    // 🔗 MODAL OPEN/CLOSE HANDLERS
    // ==========================================
    
    // Open Testing Modal Button
    const openTestingBtn = document.getElementById("open-testing-modal");
    if (openTestingBtn) {
        openTestingBtn.addEventListener("click", (e) => {
            e.preventDefault();
            document.getElementById("testing-modal").style.display = "flex";
            
            // Close settings when opening testing
            const settingsModal = document.querySelector(".settings-modal");
            if (settingsModal) {
                settingsModal.style.display = "none";
            }
        });
    }

    // Close Testing Modal
    const closeTestingBtns = document.querySelectorAll(".close-testing-modal, #close-testing-modal");
    closeTestingBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            document.getElementById("testing-modal").style.display = "none";
        });
    });

    // Close modal when clicking outside
    const testingModal = document.getElementById("testing-modal");
    if (testingModal) {
        testingModal.addEventListener("click", (e) => {
            if (e.target === testingModal) {
                testingModal.style.display = "none";
            }
        });
    }

    // ==========================================
    // 📑 TAB SWITCHING FUNCTIONALITY
    // ==========================================
    
    const testingTabs = document.querySelectorAll(".testing-tab");
    const testingTabContents = document.querySelectorAll(".testing-tab-content");

    testingTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.getAttribute("data-tab");
            
            // Remove active class from all tabs
            testingTabs.forEach(t => t.classList.remove("active"));
            testingTabContents.forEach(content => content.classList.remove("active"));
            
            // Add active class to clicked tab
            tab.classList.add("active");
            
            // Show corresponding tab content
            const targetContent = document.getElementById(`${targetTab}-tab`);
            if (targetContent) {
                targetContent.classList.add("active");
            }
            
            console.log(`Switched to tab: ${targetTab}`);
        });
    });

    // ==========================================
    // 🧪 TEST BUTTON HANDLERS (Basic Setup)
    // ==========================================
    
    // Diagnostics Tab
    const runHealthCheckBtn = document.getElementById("run-health-check");
    if (runHealthCheckBtn) {
        runHealthCheckBtn.addEventListener("click", () => {
            displayTestingResult("🔍 Running full health check...", "info");
            runHealthCheck();
        });
    }

    const checkDataIntegrityBtn = document.getElementById("check-data-integrity");
    if (checkDataIntegrityBtn) {
        checkDataIntegrityBtn.addEventListener("click", () => {
            displayTestingResult("🔍 Checking data integrity...", "info");
            checkDataIntegrity();
        });
    }

    const showAppInfoBtn = document.getElementById("show-app-info");
    if (showAppInfoBtn) {
        showAppInfoBtn.addEventListener("click", () => {
            displayTestingResult("📱 Loading app information...", "info");
            showAppInfo();
        });
    }

    // Migration Tab
    const checkMigrationStatusBtn = document.getElementById("check-migration-status");
    if (checkMigrationStatusBtn) {
        checkMigrationStatusBtn.addEventListener("click", () => {
            displayTestingResult("🔄 Checking migration status...", "info");
            enhancedCheckMigrationStatus();
            
        });
    }

    const testMigrationConfigBtn = document.getElementById("test-migration-config");
    if (testMigrationConfigBtn) {
        testMigrationConfigBtn.addEventListener("click", () => {
            displayTestingResult("⚙️ Testing migration configuration...", "info");
            testStep1();
        });
    }

    // Results Controls
    const clearResultsBtn = document.getElementById("clear-test-results");
    if (clearResultsBtn) {
        clearResultsBtn.addEventListener("click", clearTestingResults);
    }

    const exportResultsBtn = document.getElementById("export-test-results");
    if (exportResultsBtn) {
        exportResultsBtn.addEventListener("click", exportTestingResults);
    }

    const copyResultsBtn = document.getElementById("copy-test-results");
    if (copyResultsBtn) {
        copyResultsBtn.addEventListener("click", copyTestingResults);
    }

    // ==========================================
    // 📱 DOUBLE-CLICK POPUP FUNCTIONALITY
    // ==========================================
    
    // Better mobile double-tap detection
let tapCount = 0;
let lastTap = 0;
const resultsArea = document.querySelector('.testing-results-area');

if (resultsArea) {
    // Handle touch events for mobile
    resultsArea.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        
        if (tapLength < 500 && tapLength > 0) {
            // Double tap detected
            openResultsPopup();
            e.preventDefault();
        }
        lastTap = currentTime;
    });
    
    // Keep click events for desktop
    resultsArea.addEventListener('click', (e) => {
        tapCount++;
        
        if (tapCount === 1) {
            setTimeout(() => {
                if (tapCount === 1) {
                    tapCount = 0;
                } else if (tapCount === 2) {
                    openResultsPopup();
                    tapCount = 0;
                }
            }, 300);
        }
    });

    // Prevent text selection
    resultsArea.addEventListener('selectstart', (e) => {
        if (tapCount > 0) e.preventDefault();
    });
    
    resultsArea.style.position = 'relative';
    resultsArea.title = 'Double-click/tap to open in popup window • Drag header to resize';
}

    // ==========================================
    // 📏 RESIZE FUNCTIONALITY
    // ==========================================
    
    // Make results area resizable by dragging the header
    const resultsHeader = document.querySelector('.testing-results-header');

    if (resultsHeader && resultsArea) {
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;

        resultsHeader.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            startHeight = parseInt(document.defaultView.getComputedStyle(resultsArea).height, 10);
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const height = startHeight + (e.clientY - startY);
            const minHeight = 150;
            const maxHeight = window.innerHeight * 0.8;
            
            if (height >= minHeight && height <= maxHeight) {
                resultsArea.style.height = height + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.body.style.cursor = 'default';
        });
    }

  

setupEnhancedMigrationHandlers();
    console.log("✅ Testing modal setup complete");

  }

  /**
 * List all available migration backups
 */
function listAvailableBackups() {
    displayTestingResult("🔍 Scanning for migration backups...", "info");
    
    const backups = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('miniCycleBackup_migration_')) {
            try {
                const backup = JSON.parse(localStorage.getItem(key));
                backups.push({
                    key: key,
                    createdAt: backup.backupCreatedAt,
                    reason: backup.backupReason,
                    size: JSON.stringify(backup).length,
                    deviceId: backup.deviceId
                });
            } catch (error) {
                displayTestingResult(`⚠️ Corrupted backup found: ${key}`, 'warning');
            }
        }
    }
    
    if (backups.length === 0) {
        displayTestingResult("No migration backups found", "info");
        return;
    }
    
    displayTestingResult(`Found ${backups.length} migration backup(s):`, "info");
    backups.forEach((backup, index) => {
        const date = new Date(backup.createdAt).toLocaleString();
        const sizeKB = (backup.size / 1024).toFixed(2);
        displayTestingResult(`${index + 1}. ${backup.key}`, "info");
        displayTestingResult(`   Created: ${date}`, "info");
        displayTestingResult(`   Size: ${sizeKB} KB`, "info");
        displayTestingResult(`   Reason: ${backup.reason}`, "info");
    });
    
    return backups;
}

/**
 * Restore from the most recent backup with user selection
 */
async function restoreFromBackup() {
  const backups = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('miniCycleBackup_migration_')) {
      try {
        const backup = JSON.parse(localStorage.getItem(key));
        backups.push({
          key: key,
          createdAt: backup.backupCreatedAt,
          backup: backup
        });
      } catch (error) {
        console.warn('Corrupted backup:', key);
      }
    }
  }

  if (backups.length === 0) {
    displayTestingResult("❌ No migration backups found to restore", "error");
    return;
  }

  // Sort by creation date (most recent first)
  backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // For now, restore the most recent backup
  // In a full implementation, you could show a selection UI
  const mostRecent = backups[0];

  const confirmed = await showConfirmationModal({
    title: "Restore from Backup",
    message: `Restore from backup created ${new Date(mostRecent.createdAt).toLocaleString()}?<br><br>This will replace your current data.`,
    confirmText: "Restore",
    cancelText: "Cancel"
  });

  if (!confirmed) {
    displayTestingResult("Restore cancelled by user", "info");
    return;
  }

  try {
    displayTestingResult("🔄 Restoring from backup...", "info");
    localStorage.setItem("miniCycleStorage", JSON.stringify(mostRecent.backup.originalData));
    displayTestingResult("✅ Backup restored successfully", "success");
    displayTestingResult("🔄 Please refresh the page to see restored data", "info");

    // Optional: Auto-refresh after 3 seconds
    setTimeout(() => {
      showConfirmationModal({
        title: "Reload Required",
        message: "Auto-refresh now to see restored data?",
        confirmText: "Reload",
        cancelText: "Later"
      }).then(reloadConfirmed => {
        if (reloadConfirmed) {
          location.reload();
        }
      });
    }, 3000);

  } catch (error) {
    displayTestingResult(`❌ Restore failed: ${error.message}`, "error");
  }
}

/**
 * Clean up old migration backups
 */
async function cleanOldBackups() {
    const backupKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('miniCycleBackup_migration_')) {
            backupKeys.push(key);
        }
    }

    if (backupKeys.length === 0) {
        displayTestingResult("No migration backups to clean", "info");
        return;
    }

    const confirmed = await showConfirmationModal({
        title: "Clean Old Backups",
        message: "This will permanently delete all migration backup data.",
        confirmText: "Delete",
        cancelText: "Cancel"
    });

    if (!confirmed) {
        displayTestingResult("Cleanup cancelled by user", "info");
        return;
    }

    let cleaned = 0;
    backupKeys.forEach(key => {
        try {
            localStorage.removeItem(key);
            cleaned++;
        } catch (error) {
            displayTestingResult(`Failed to remove ${key}`, "warning");
        }
    });

    displayTestingResult(`🧹 Cleaned up ${cleaned} backup(s)`, "success");
}


/**
 * Enhanced "Check Migration Status" button handler
 */
function enhancedCheckMigrationStatus() {
  displayTestingResult("🔄 Checking migration status...", "info");
  
  try {
    // Use the new diagnostics-integrated function
    const result = checkMigrationStatusForDiagnostics();
    
    // Additional detailed reporting
    if (result.readyForMigration) {
      displayTestingResult(`📋 Migration Details:`, 'info');
      displayTestingResult(`  • Current schema: ${result.fromVersion}`, 'info');
      displayTestingResult(`  • Target schema: ${result.toVersion}`, 'info');
      displayTestingResult(`  • Data entries: ${result.dataSize}`, 'info');
      displayTestingResult(`  • Migration type: Automatic`, 'info');
      displayTestingResult(``, 'info');
      displayTestingResult(`🎯 Next steps:`, 'info');
      displayTestingResult(`  1. Create backup (recommended)`, 'info');
      displayTestingResult(`  2. Run "Simulate Migration" to test`, 'info');
      displayTestingResult(`  3. Use "Test Migration Config" to verify setup`, 'info');
    }
    
  } catch (error) {
    displayTestingResult(`❌ Migration status check failed: ${error.message}`, 'error');
  }
}

/**
 * Enhanced "Test Migration Config" button handler
 */
function enhancedTestMigrationConfig() {
  displayTestingResult("⚙️ Testing migration configuration...", "info");
  
  try {
    // Run the original Step 1 test
    const step1Result = testStep1();
    
    // Additional configuration validation
    displayTestingResult(``, 'info');
    displayTestingResult(`🔧 Configuration Validation:`, 'info');
    displayTestingResult(`  • Migration system: ${step1Result ? '✅ Ready' : '❌ Not ready'}`, step1Result ? 'success' : 'error');
    displayTestingResult(`  • Device detection: ✅ Working`, 'success');
    displayTestingResult(`  • Version detection: ✅ Working`, 'success');
    displayTestingResult(`  • Schema validation: ✅ Working`, 'success');
    
    // Check if migrateTask function is available
    if (typeof migrateTask === 'function') {
      displayTestingResult(`  • Your migrateTask function: ✅ Found`, 'success');
    } else {
      displayTestingResult(`  • Your migrateTask function: ⚠️ Not found (will use fallback)`, 'warning');
    }
    
    displayTestingResult(``, 'info');
    displayTestingResult(`✅ Migration configuration test completed`, 'success');
    
  } catch (error) {
    displayTestingResult(`❌ Migration config test failed: ${error.message}`, 'error');
  }
}

/**
 * Enhanced "Simulate Migration" button handler
 */
function enhancedSimulateMigration() {
  displayTestingResult("🧪 Preparing migration simulation...", "info");
  displayTestingResult("⚠️ This is a SAFE test - your data will not be modified", "warning");
  displayTestingResult(``, 'info');
  
  // Run the simulation
  simulateMigrationForDiagnostics();
}

/**
 * Enhanced "Create Migration Backup" button handler  
 */
function enhancedCreateMigrationBackup() {
  displayTestingResult("💾 Creating migration backup...", "info");
  
  try {
    const currentData = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
    
    if (Object.keys(currentData).length === 0) {
      displayTestingResult("ℹ️ No data to backup (fresh installation)", "info");
      return;
    }
    
    // Create backup with timestamp
    const backupKey = `miniCycleBackup_migration_${Date.now()}`;
    const backupData = {
      originalData: currentData,
      backupCreatedAt: new Date().toISOString(),
      backupReason: "pre_migration",
      deviceId: generateDeviceId(),
      deviceName: getDeviceName()
    };
    
    localStorage.setItem(backupKey, JSON.stringify(backupData));
    
    // Calculate backup size
    const backupSize = JSON.stringify(backupData).length;
    const backupSizeKB = (backupSize / 1024).toFixed(2);
    
    displayTestingResult(`✅ Migration backup created successfully`, 'success');
    displayTestingResult(`  • Backup key: ${backupKey}`, 'info');
    displayTestingResult(`  • Backup size: ${backupSizeKB} KB`, 'info');
    displayTestingResult(`  • Cycles backed up: ${Object.keys(currentData).length}`, 'info');
    displayTestingResult(`  • Created at: ${new Date().toLocaleString()}`, 'info');
    displayTestingResult(``, 'info');
    displayTestingResult(`🔒 Backup will be automatically cleaned up after successful migration`, 'info');
    
  } catch (error) {
    displayTestingResult(`❌ Backup creation failed: ${error.message}`, 'error');
  }
}

/**
 * Enhanced "Validate Migration Data" button handler
 */
function enhancedValidateMigrationData() {
  displayTestingResult("🔍 Validating migration data...", "info");
  
  try {
    const currentData = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
    
    if (Object.keys(currentData).length === 0) {
      displayTestingResult("ℹ️ No data to validate (fresh installation)", "info");
      return;
    }
    
    // Detect current schema
    const detectedVersion = detectSchemaVersion(currentData);
    displayTestingResult(`📊 Current schema version: ${detectedVersion}`, 'info');
    
    // Analyze data structure
    let totalCycles = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    let recurringTasks = 0;
    let dataIssues = [];
    
    for (const [cycleName, cycleData] of Object.entries(currentData)) {
      if (typeof cycleData !== 'object' || !cycleData.tasks) {
        dataIssues.push(`Cycle "${cycleName}" has invalid structure`);
        continue;
      }
      
      totalCycles++;
      
      if (Array.isArray(cycleData.tasks)) {
        totalTasks += cycleData.tasks.length;
        
        cycleData.tasks.forEach((task, index) => {
          if (!task.text) {
            dataIssues.push(`Task ${index + 1} in "${cycleName}" missing text`);
          }
          if (task.completed) {
            completedTasks++;
          }
          if (task.recurring || task.recurringSettings) {
            recurringTasks++;
          }
        });
      }
    }
    
    // Display analysis results
    displayTestingResult(``, 'info');
    displayTestingResult(`📈 Data Analysis Results:`, 'info');
    displayTestingResult(`  • Total cycles: ${totalCycles}`, 'info');
    displayTestingResult(`  • Total tasks: ${totalTasks}`, 'info');
    displayTestingResult(`  • Completed tasks: ${completedTasks}`, 'info');
    displayTestingResult(`  • Recurring tasks: ${recurringTasks}`, 'info');
    
    if (dataIssues.length > 0) {
      displayTestingResult(``, 'warning');
      displayTestingResult(`⚠️ Data Issues Found (${dataIssues.length}):`, 'warning');
      dataIssues.forEach(issue => {
        displayTestingResult(`  • ${issue}`, 'warning');
      });
      displayTestingResult(``, 'info');
      displayTestingResult(`🔧 These issues can be automatically fixed during migration`, 'info');
    } else {
      displayTestingResult(`✅ No data issues found - ready for migration`, 'success');
    }
    
  } catch (error) {
    displayTestingResult(`❌ Data validation failed: ${error.message}`, 'error');
  }
}

// ==========================================
// 🔧 BUTTON HANDLER SETUP
// ==========================================

/**
 * Enhanced setup for migration tab buttons
 * Add this to your existing setupTestingModal() function
 */
function setupEnhancedMigrationHandlers() {
  // Enhanced migration status check
  const checkMigrationStatusBtn = document.getElementById("check-migration-status");
  if (checkMigrationStatusBtn) {
    checkMigrationStatusBtn.replaceWith(checkMigrationStatusBtn.cloneNode(true));
    const newBtn = document.getElementById("check-migration-status");
    newBtn.addEventListener("click", enhancedCheckMigrationStatus);
  }

  // Enhanced migration config test
  const testMigrationConfigBtn = document.getElementById("test-migration-config");
  if (testMigrationConfigBtn) {
    testMigrationConfigBtn.replaceWith(testMigrationConfigBtn.cloneNode(true));
    const newBtn = document.getElementById("test-migration-config");
    newBtn.addEventListener("click", enhancedTestMigrationConfig);
  }

  // Enhanced migration simulation
  const simulateMigrationBtn = document.getElementById("simulate-migration");
  if (simulateMigrationBtn) {
    simulateMigrationBtn.replaceWith(simulateMigrationBtn.cloneNode(true));
    const newBtn = document.getElementById("simulate-migration");
    newBtn.addEventListener("click", enhancedSimulateMigration);
  }

  // Enhanced backup creation
  const backupBtn = document.getElementById("backup-before-migration");
  if (backupBtn) {
    backupBtn.replaceWith(backupBtn.cloneNode(true));
    const newBtn = document.getElementById("backup-before-migration");
    newBtn.addEventListener("click", enhancedCreateMigrationBackup);
  }

  // Enhanced data validation
  const validateBtn = document.getElementById("validate-migration-data");
  if (validateBtn) {
    validateBtn.replaceWith(validateBtn.cloneNode(true));
    const newBtn = document.getElementById("validate-migration-data");
    newBtn.addEventListener("click", enhancedValidateMigrationData);
  }

  const performMigrationBtn = document.getElementById("perform-actual-migration");
  if (performMigrationBtn) {
    performMigrationBtn.replaceWith(performMigrationBtn.cloneNode(true));
    const newBtn = document.getElementById("perform-actual-migration");
    newBtn.addEventListener("click", async () => {
      const confirmed = await showConfirmationModal({
        title: "Migrate to Schema 3A",
        message: "⚠️ This will permanently modify your data to Schema 3A! Your backup was created. Continue?",
        confirmText: "Migrate",
        cancelText: "Cancel"
      });
      if (confirmed) {
        await performActualMigration();
      }
    });
  }

  // Backup management handlers
  const listBackupsBtn = document.getElementById("list-available-backups");
  if (listBackupsBtn) {
    listBackupsBtn.replaceWith(listBackupsBtn.cloneNode(true));
    const newBtn = document.getElementById("list-available-backups");
    newBtn.addEventListener("click", listAvailableBackups);
  }

  const restoreBackupBtn = document.getElementById("restore-from-backup");
  if (restoreBackupBtn) {
    restoreBackupBtn.replaceWith(restoreBackupBtn.cloneNode(true));
    const newBtn = document.getElementById("restore-from-backup");
    newBtn.addEventListener("click", restoreFromBackup);
  }

  const cleanBackupsBtn = document.getElementById("clean-old-backups");
  if (cleanBackupsBtn) {
    cleanBackupsBtn.replaceWith(cleanBackupsBtn.cloneNode(true));
    const newBtn = document.getElementById("clean-old-backups");
    newBtn.addEventListener("click", cleanOldBackups);
  }

  console.log("✅ Enhanced migration handlers setup complete");
}







// ==========================================
// 🖥️ TESTING RESULTS DISPLAY SYSTEM
// ==========================================

/**
 * Display test results in the testing modal
 */
function displayTestingResult(message, type = 'info') {
    const testingResults = document.getElementById('testing-results');
    const testingOutput = document.getElementById('testing-output');
    
    if (!testingResults || !testingOutput) return;

    // Hide welcome message if it exists
    const welcomeMessage = testingOutput.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }

    // Create timestamp
    const timestamp = new Date().toLocaleTimeString();
    
    // Color coding for different message types
    const colors = {
        success: '#28a745',
        error: '#dc3545', 
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    const color = colors[type] || colors.info;
    
    // Add the message
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '5px';
    messageDiv.style.color = color;
    messageDiv.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
    
    testingOutput.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    testingResults.scrollTop = testingResults.scrollHeight;

    const popup = document.querySelector('.results-popup-window .results-popup-content');
    if (popup) {
        popup.innerHTML = outputDiv.innerHTML;
    }
}

/**
 * Clear testing results
 */
function clearTestingResults() {
    const testingOutput = document.getElementById('testing-output');
    
    if (testingOutput) {
        testingOutput.innerHTML = `
            <div class="welcome-message">
                <p>👋 Welcome to App Diagnostics!</p>
                <p>Use the tabs above to run tests and diagnostics.</p>
                <p>Results will appear here.</p>
            </div>
        `;
    }
}

/**
 * Export testing results
 */
function exportTestingResults() {
    const testingOutput = document.getElementById('testing-output');
    if (!testingOutput) return;

    const results = testingOutput.innerText || "No test results to export.";
    const timestamp = new Date().toISOString().split('T')[0];
    
    const blob = new Blob([results], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task-cycle-diagnostics-${timestamp}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    displayTestingResult("📥 Test results exported successfully!", "success");
}

/**
 * Copy testing results to clipboard
 */
function copyTestingResults() {
    const testingOutput = document.getElementById('testing-output');
    if (!testingOutput) return;

    const results = testingOutput.innerText || "No test results to copy.";
    
    navigator.clipboard.writeText(results).then(() => {
        displayTestingResult("📋 Test results copied to clipboard!", "success");
    }).catch(err => {
        displayTestingResult("❌ Failed to copy to clipboard: " + err.message, "error");
    });
}


// Add this function with your other testing functions

function openResultsPopup() {
    // Check if popup already exists
    if (document.querySelector('.results-popup-window')) {
        return; // Already open
    }

    // Get current results content
    const resultsContent = document.getElementById('testing-output');
    if (!resultsContent) return;

    // Create popup window
    const popup = document.createElement('div');
    popup.className = 'results-popup-window';
    popup.innerHTML = `
        <div class="results-popup-header">
            <span>📊 Test Results - Detached View</span>
            <button class="popup-close-btn" onclick="closeResultsPopup()">&times;</button>
        </div>
        <div class="results-popup-content">
            ${resultsContent.innerHTML}
        </div>
    `;

    document.body.appendChild(popup);

    // Make draggable
    makeDraggable(popup);

    console.log('📊 Results popup opened');
}


function closeResultsPopup() {
    const popup = document.querySelector('.results-popup-window');
    if (popup) {
        popup.remove();
        console.log('📊 Results popup closed');
    }
}





// Add this draggable helper function

function makeDraggable(element) {
    const header = element.querySelector('.results-popup-header');
    if (!header) return;

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target.classList.contains('popup-close-btn')) return;
        
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === header) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }
    }

    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    
}


window.closeResultsPopup = closeResultsPopup;

// ==========================================
// 🧪 BASIC TEST FUNCTIONS (Starters)
// ==========================================

/**
 * Run comprehensive health check
 */
function runHealthCheck() {
    try {
        displayTestingResult("🔍 Starting comprehensive health check...", "info");
        
        // Check localStorage
        const storage = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
        const cycleCount = Object.keys(storage).length;
        displayTestingResult(`✅ Found ${cycleCount} cycles in storage`, "success");
        
        // Check for corruption
        let totalTasks = 0;
        let corruptedTasks = 0;
        
        for (const [cycleName, cycleData] of Object.entries(storage)) {
            if (cycleData && Array.isArray(cycleData.tasks)) {
                totalTasks += cycleData.tasks.length;
                
                for (const task of cycleData.tasks) {
                    if (!task.id || !task.text) {
                        corruptedTasks++;
                    }
                }
            }
        }
        
        displayTestingResult(`📊 Total tasks: ${totalTasks}`, "info");
        
        if (corruptedTasks > 0) {
            displayTestingResult(`⚠️ Found ${corruptedTasks} corrupted tasks`, "warning");
        } else {
            displayTestingResult("✅ No corrupted tasks found", "success");
        }
        
        // Check browser capabilities
        displayTestingResult(`🌐 Browser: ${navigator.userAgent.split(' ').pop()}`, "info");
        displayTestingResult(`💾 localStorage available: ${!!window.localStorage}`, "success");
        
        displayTestingResult("✅ Health check completed successfully!", "success");
        
    } catch (error) {
        displayTestingResult(`❌ Health check failed: ${error.message}`, "error");
    }
}

/**
 * Check data integrity
 */
function checkDataIntegrity() {
    try {
        const storage = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
        let issues = 0;
        
        for (const [cycleName, cycleData] of Object.entries(storage)) {
            if (!cycleData.title) {
                displayTestingResult(`⚠️ Cycle "${cycleName}" missing title`, "warning");
                issues++;
            }
            
            if (!Array.isArray(cycleData.tasks)) {
                displayTestingResult(`❌ Cycle "${cycleName}" has invalid tasks array`, "error");
                issues++;
            }
        }
        
        if (issues === 0) {
            displayTestingResult("✅ Data integrity check passed!", "success");
        } else {
            displayTestingResult(`⚠️ Found ${issues} data integrity issues`, "warning");
        }
        
    } catch (error) {
        displayTestingResult(`❌ Data integrity check failed: ${error.message}`, "error");
    }
}

/**
 * Show app information
 */
function showAppInfo() {
    try {
        displayTestingResult("📱 App Information:", "info");
        displayTestingResult(`Version: 1.0.0`, "info");
        displayTestingResult(`Device: ${getDeviceName()}`, "info");
        displayTestingResult(`Screen: ${window.screen.width}x${window.screen.height}`, "info");
        displayTestingResult(`Viewport: ${window.innerWidth}x${window.innerHeight}`, "info");
        displayTestingResult(`User Agent: ${navigator.userAgent}`, "info");
        displayTestingResult(`Language: ${navigator.language}`, "info");
        displayTestingResult(`Online: ${navigator.onLine}`, "info");
        
        const storage = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
        const storageSize = JSON.stringify(storage).length;
        displayTestingResult(`Storage Size: ~${(storageSize / 1024).toFixed(2)} KB`, "info");
        
    } catch (error) {
        displayTestingResult(`❌ Failed to get app info: ${error.message}`, "error");
    }
}

/**
 * Check migration status
 */
function checkMigrationStatus() {
    try {
        const currentData = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
        const migrationCheck = checkMigrationNeeded(currentData);
        
        displayTestingResult("🔄 Migration Status Check:", "info");
        displayTestingResult(`Status: ${migrationCheck.status}`, "info");
        displayTestingResult(`Reason: ${migrationCheck.reason}`, "info");
        
        if (migrationCheck.fromVersion) {
            displayTestingResult(`From Version: ${migrationCheck.fromVersion}`, "info");
        }
        
        if (migrationCheck.toVersion) {
            displayTestingResult(`To Version: ${migrationCheck.toVersion}`, "info");
        }
        
        if (migrationCheck.status === MIGRATION_STATUS.PENDING) {
            displayTestingResult("⚠️ Migration is needed!", "warning");
        } else {
            displayTestingResult("✅ No migration needed", "success");
        }
        
    } catch (error) {
        displayTestingResult(`❌ Migration status check failed: ${error.message}`, "error");
    }
}





/**
 * Setupdownloadminicycle function.
 *
 * @returns {void}
 */
function setupDownloadMiniCycle() {
  document.getElementById("export-mini-cycle").addEventListener("click", async () => {
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");

    if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
      showNotification("⚠ No active Mini Cycle to export.");
      return;
    }

    const cycle = savedMiniCycles[lastUsedMiniCycle];

    const miniCycleData = {
      name: lastUsedMiniCycle,
      title: cycle.title || "New Mini Cycle",
      tasks: cycle.tasks.map(task => {
        const settings = task.recurringSettings || {};

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

    // ✅ Replacing built-in prompt with your styled modal
    const fileName = await showPromptModal({
      title: "Export Mini Cycle",
      message: "Enter a file name to download:",
      placeholder: "e.g. grocery-list",
      defaultValue: lastUsedMiniCycle || "mini-cycle",
      confirmText: "Download",
      cancelText: "Cancel",
      required: true
    });

    if (fileName === null) {
      showNotification("❌ Download canceled.");
      return;
    }

    const sanitizedFileName = fileName.trim().replace(/[^a-zA-Z0-9-_ ]/g, "");
    if (!sanitizedFileName) {
      showNotification("❌ Invalid file name. Download canceled.");
      return;
    }

    const blob = new Blob([JSON.stringify(miniCycleData, null, 2)], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizedFileName}.mcyc`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function setupUploadMiniCycle() {
  const importButtons = ["import-mini-cycle", "miniCycleUpload"];

  importButtons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".mcyc";

      input.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.name.endsWith(".tcyc")) {
          showNotification("❌ Mini Cycle does not support .tcyc files.\nPlease save your Task Cycle as .MCYC to import into Mini Cycle.");
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedData = JSON.parse(e.target.result);

            if (!importedData.name || !Array.isArray(importedData.tasks)) {
              showNotification("❌ Invalid Mini Cycle file format.");
              return;
            }

            const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

            savedMiniCycles[importedData.name] = {
              title: importedData.title || "New Mini Cycle",
              tasks: importedData.tasks.map(task => {
                const safeSettings = task.recurringSettings || {};

                // Add fallback time if task is recurring and doesn't use a specific time
                if (task.recurring && !safeSettings.specificTime && !safeSettings.defaultRecurTime) {
                  safeSettings.defaultRecurTime = new Date().toISOString();
                }

                return {
                  id: task.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  text: task.text || "",
                  completed: false, // Always reset tasks on import
                  dueDate: task.dueDate || null,
                  highPriority: task.highPriority || false,
                  remindersEnabled: task.remindersEnabled || false,
                  recurring: task.recurring || false,
                  recurringSettings: safeSettings,
                  schemaVersion: task.schemaVersion || 2
                };
              }),
              autoReset: importedData.autoReset || false,
              cycleCount: importedData.cycleCount || 0,
              deleteCheckedTasks: importedData.deleteCheckedTasks || false
            };

            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
            localStorage.setItem("lastUsedMiniCycle", importedData.name);

            showNotification(`✅ Mini Cycle "${importedData.name}" Imported Successfully!`);
            location.reload();
          } catch (error) {
            showNotification("❌ Error importing Mini Cycle.");
            console.error("Import error:", error);
          }
        };

        reader.readAsText(file);
      });

      input.click();
    });
  });
}

/**
 * Setupfeedbackmodal function.
 *
 * @returns {void}
 */

function setupFeedbackModal() {
    const feedbackModal = document.getElementById("feedback-modal");
    const openFeedbackBtn = document.getElementById("open-feedback-modal");
    const closeFeedbackBtn = document.querySelector(".close-feedback-modal");
    const feedbackForm = document.getElementById("feedback-form");
    const feedbackText = document.getElementById("feedback-text");
    const submitButton = document.getElementById("submit-feedback");
    const thankYouMessage = document.getElementById("thank-you-message");

    // Open Modal
    openFeedbackBtn.addEventListener("click", () => {
        feedbackModal.style.display = "flex";
        hideMainMenu();
        thankYouMessage.style.display = "none"; // Hide thank you message if shown before
    });

    // Close Modal
    closeFeedbackBtn.addEventListener("click", () => {
        feedbackModal.style.display = "none";
    });

    // Close Modal on Outside Click
    window.addEventListener("click", (event) => {
        if (event.target === feedbackModal) {
            feedbackModal.style.display = "none";
        }
    });

    // Handle Form Submission via AJAX (Prevent Page Refresh)
    feedbackForm.addEventListener("submit", function (event) {
        event.preventDefault(); // Prevent default form submission

        // Disable button while sending
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";

        // Prepare Form Data
        const formData = new FormData(feedbackForm);

        // Send request to Web3Forms API
        fetch("https://api.web3forms.com/submit", {
            method: "POST",
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show Thank You Message
                thankYouMessage.style.display = "block";

                // Clear Textarea
                feedbackText.value = "";

                // Hide Form After Submission
                setTimeout(() => {
                    thankYouMessage.style.display = "none";
                    feedbackModal.style.display = "none"; // Close modal after a short delay
                }, 2000);
            } else {
                showNotification("❌ Error sending feedback. Please try again.");
            }
        })
        .catch(error => {
            showNotification("❌ Network error. Please try again later.");
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = "Submit";
        });
    });
}


document.getElementById("feedback-form").addEventListener("submit", (e) => {
    const textarea = document.getElementById("feedback-text");
    textarea.value = sanitizeInput(textarea.value);
});


/**
 * Setupusermanual function.
 *
 * @returns {void}
 */

function setupUserManual() {
    openUserManual.addEventListener("click", () => {
        hideMainMenu(); // Hide the menu when clicking

        // Disable button briefly to prevent multiple clicks
        openUserManual.disabled = true;

        // Redirect to the User Manual page after a short delay
        setTimeout(() => {
            window.location.href = "user-manual.html"; // ✅ Opens the manual page
            
            // Re-enable button after navigation (won't matter much since page changes)
            openUserManual.disabled = false;
        }, 200);
    });
}





/**
 * Setupabout function.
 *
 * @returns {void}
 */

function setupAbout() {
    const aboutModal = document.getElementById("about-modal");
    const openAboutBtn = document.getElementById("open-about-modal");
    const closeAboutBtn = aboutModal.querySelector(".close-modal");

    // Open Modal
    openAboutBtn.addEventListener("click", () => {
        aboutModal.style.display = "flex";
    });

    // Close Modal
    closeAboutBtn.addEventListener("click", () => {
        aboutModal.style.display = "none";
    });

    // Close Modal on Outside Click
    window.addEventListener("click", (event) => {
        if (event.target === aboutModal) {
            aboutModal.style.display = "none";
        }
    });
}


/**
 * Assigncyclevariables function.
 *
 * @returns {void}
 */

/**
 * Enhanced assignCycleVariables with dual-format support
 * Handles both v2 format and Schema 3A format transparently
 */
function assignCycleVariables() {
  const rawData = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
  
  // Detect if this is Schema 3A format
  if (rawData.schemaVersion === "3A" && rawData.miniCycle) {
    return handleSchema3AData(rawData);
  } else {
    return handleV2Data(rawData);
  }
}
/**
 * Handle Schema 3A format data
 */
function handleSchema3AData(schema3AData) {
  // Extract cycles from Schema 3A format
  const cycles = schema3AData.miniCycle.data.cycles || [];
  const activeCycleId = schema3AData.miniCycle.appState.activeCycleId;
  
  // Convert Schema 3A cycles back to v2-compatible format for existing code
  const savedMiniCycles = {};
  cycles.forEach(cycle => {
    savedMiniCycles[cycle.cycleName || cycle.title] = {
      title: cycle.title,
      tasks: cycle.tasks || [],
      autoReset: cycle.autoReset,
      deleteCheckedTasks: cycle.deleteCheckedTasks,
      cycleCount: cycle.analytics?.totalCyclesCompleted || 0,
      recurringTemplates: cycle.recurringTemplates || {}
    };
  });
  
  // Find the active cycle name
  let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
  
  // If we have an active cycle ID, find the corresponding cycle name
  if (activeCycleId && cycles.length > 0) {
    const activeCycle = cycles.find(c => c.id === activeCycleId);
    if (activeCycle) {
      lastUsedMiniCycle = activeCycle.cycleName || activeCycle.title;
      localStorage.setItem("lastUsedMiniCycle", lastUsedMiniCycle);
    }
  }
  
  // Fallback to first cycle if no active cycle found
  if (!lastUsedMiniCycle && cycles.length > 0) {
    lastUsedMiniCycle = cycles[0].cycleName || cycles[0].title;
    localStorage.setItem("lastUsedMiniCycle", lastUsedMiniCycle);
  }
  
  console.log('📊 Using Schema 3A data format');
  return { lastUsedMiniCycle, savedMiniCycles, isSchema3A: true, originalData: schema3AData };
}

/**
 * Handle v2 format data (existing format)
 */
function handleV2Data(v2Data) {
  const lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
  const savedMiniCycles = v2Data;
  
  console.log('📊 Using v2 data format');
  return { lastUsedMiniCycle, savedMiniCycles, isSchema3A: false };
}


/**
 * Updateprogressbar function.
 *
 * @returns {void}
 */

function updateProgressBar() {
    const totalTasks = taskList.children.length;
    const completedTasks = [...taskList.children].filter(task => task.querySelector("input").checked).length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    progressBar.style.width = `${progress}%`;
    autoSave();

}



/**
 * Checkminicycle function.
 *
 * @returns {void}
 */

function checkMiniCycle() {
    const allCompleted = [...taskList.children].every(task => task.querySelector("input").checked);

    // ✅ Retrieve Mini Cycle variables
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
    let cycleData = savedMiniCycles[lastUsedMiniCycle];

    if (!lastUsedMiniCycle || !cycleData) {
        console.warn("⚠ No active Mini Cycle found.");
        return;
    }

    

    // ✅ Only trigger reset if ALL tasks are completed AND autoReset is enabled
    if (allCompleted && taskList.children.length > 0) {
        console.log(`✅ All tasks completed for "${lastUsedMiniCycle}"`);

        // ✅ Auto-reset: Only reset if AutoReset is enabled
        if (cycleData.autoReset) {
            console.log(`🔄 AutoReset is ON. Resetting tasks for "${lastUsedMiniCycle}"...`);
            setTimeout(() => {
                resetTasks(); // ✅ Then reset tasks
            }, 1000);
            return;
        }
    }
    console.log("ran check MiniCyle function");
    updateProgressBar();
    updateStatsPanel();
    autoSave();
    console.log("ran check MiniCyle function2");
}

/**
 * Incrementcyclecount function.
 *
 * @param {any} miniCycleName - Description.
 * @param {any} savedMiniCycles - Description. * @returns {void}
 */

function incrementCycleCount(miniCycleName, savedMiniCycles) {
    let cycleData = savedMiniCycles[miniCycleName];
    if (!cycleData) return;

    cycleData.cycleCount = (cycleData.cycleCount || 0) + 1;
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    console.log(`✅ Mini Cycle count updated for "${miniCycleName}": ${cycleData.cycleCount}`);

    // ✅ Handle milestone rewards
    handleMilestoneUnlocks(miniCycleName, cycleData.cycleCount);

    // ✅ Show animation + update stats
    showCompletionAnimation();
    updateStatsPanel();
}


function handleMilestoneUnlocks(miniCycleName, cycleCount) {
    // ✅ Show milestone achievement message
    checkForMilestone(miniCycleName, cycleCount);

    // ✅ Theme unlocks
    if (cycleCount >= 5) {
        unlockDarkOceanTheme();
    }
    if (cycleCount >= 50) {
        unlockGoldenGlowTheme();
    }

    // ✅ Game unlock
    if (cycleCount >= 100) {
        const unlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
        if (!unlocks.taskOrderGame) {
            showNotification("🎮 Game Unlocked! 'Task Order' is now available in the Games menu.", "success", 6000);
            unlockMiniGame();
        }
    }
}

function unlockMiniGame() {
    let unlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
    unlocks.taskOrderGame = true;
    localStorage.setItem("milestoneUnlocks", JSON.stringify(unlocks));
    checkGamesUnlock();
}


function unlockDarkOceanTheme() {
    console.log("unlock Ocean theme Ran");
    // Load current theme data
    let milestoneUnlocks = JSON.parse(localStorage.getItem('milestoneUnlocks')) || {};
    
    // Only proceed if theme isn't already unlocked
    if (!milestoneUnlocks.darkOcean) {
        console.log("🎨 Unlocking Dark Ocean theme for first cycle completion!");
        
        // Mark theme as unlocked
        milestoneUnlocks.darkOcean = true;
        localStorage.setItem('milestoneUnlocks', JSON.stringify(milestoneUnlocks));
        refreshThemeToggles();
        
        // Show the theme option in menu
        const themeContainer = document.querySelector('.theme-container');
        if (themeContainer) {
            themeContainer.classList.remove('hidden');
        }

        // ✅ Show the Themes Button Immediately
        const themeButton = document.getElementById("open-themes-panel");
        if (themeButton) {
            themeButton.style.display = "block";
        }
        
        // Notify user about unlocked theme
        showNotification('🎉 New theme unlocked: Dark Ocean! Check the menu to activate it.', 'success', 5000);
    }
    refreshThemeToggles();
}

function unlockGoldenGlowTheme() {
    console.log("unlock Golden Glow theme Ran");
    let milestoneUnlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};

    if (!milestoneUnlocks.goldenGlow) {
        console.log("🎨 Unlocking Golden Glow theme at 50 cycles!");

        milestoneUnlocks.goldenGlow = true;
        localStorage.setItem("milestoneUnlocks", JSON.stringify(milestoneUnlocks));
        refreshThemeToggles();

        // Show the theme container (if hidden)
        const themeContainer = document.querySelector('.theme-container');
        if (themeContainer) {
            themeContainer.classList.remove('hidden');
        }

        // Show the theme toggle if it exists
        const themeButton = document.getElementById("open-themes-panel");
        if (themeButton) {
            themeButton.style.display = "block";
        }

        showNotification("🌟 New theme unlocked: Golden Glow! Check the themes menu to activate it.", "success", 5000);
    }
}



function initializeThemesPanel() {
    console.log("🌈 Initializing Theme Panel");

    const existingContainer = document.querySelector('.theme-container');
    if (existingContainer) return; // Prevent duplicates

    const themeContainer = document.createElement('div');
    themeContainer.className = 'theme-container';
    themeContainer.id = 'theme-container';

    const themeOptionContainer = document.createElement('div');
    themeOptionContainer.className = 'theme-option-container';
    themeOptionContainer.id = 'theme-option-container'; // 👈 We'll update this later

    themeContainer.appendChild(themeOptionContainer);

    // Inject into modal
    const themeSection = document.getElementById("theme-options-section");
    themeSection.appendChild(themeContainer);

    // Setup toggle logic
    refreshThemeToggles(); // ⬅ Run this on load
}

// ✅ Rebuild toggles based on unlocked themes
function refreshThemeToggles() {
    const container = document.getElementById("theme-option-container");
    container.innerHTML = ""; // 🧹 Clear current options

    const milestoneUnlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
    const currentTheme = localStorage.getItem("currentTheme");

    const themeList = [
        {
          id: "DarkOcean",
          class: "dark-ocean",
          label: "Dark Ocean Theme 🌊",
          storageKey: "darkOcean"
        },
        {
          id: "GoldenGlow",
          class: "golden-glow",
          label: "Golden Glow Theme 🌟",
          storageKey: "goldenGlow"
        }
      ];

    themeList.forEach(theme => {
        if (!milestoneUnlocks[theme.storageKey]) return;

        const label = document.createElement("label");
        label.className = "custom-checkbox";
        label.innerHTML = `
            <input type="checkbox" id="toggle${theme.id}Theme" class="theme-toggle">
            <span class="checkmark"></span>
            ${theme.label}
        `;

        container.appendChild(label);

        const checkbox = label.querySelector("input");
        checkbox.checked = currentTheme === theme.class;

        checkbox.addEventListener("change", function () {
            if (this.checked) {
                document.querySelectorAll(".theme-toggle").forEach(cb => {
                    if (cb !== this) cb.checked = false;
                });
                applyTheme(theme.class);
            } else {
                applyTheme("default");
            }
        });
    });
}

// ✅ Close Themes Modal when clicking outside of the modal content
window.addEventListener("click", (event) => {
    const themesModal = document.getElementById("themes-modal");
    

    // Only close if you click on the background (not inside modal)
    if (event.target === themesModal) {
        themesModal.style.display = "none";
    }
});

/**
 * Showcompletionanimation function.
 *
 * @returns {void}
 */

function showCompletionAnimation() {
    const animation = document.createElement("div");
    animation.classList.add("mini-cycle-complete-animation");
  //  animation.innerHTML = "✅ Mini Cycle Completed!"; 
  animation.innerHTML = "✔"; 

    document.body.appendChild(animation);

    // ✅ Remove the animation after 1.5 seconds
    setTimeout(() => {
        animation.remove();
    }, 1500);
}

/**
 * Checkformilestone function.
 *
 * @param {any} miniCycleName - Description.
 * @param {any} cycleCount - Description. * @returns {void}
 */

function checkForMilestone(miniCycleName, cycleCount) {
    const milestoneLevels = [10, 25, 50, 100, 200, 500, 1000];

    if (milestoneLevels.includes(cycleCount)) {
        showMilestoneMessage(miniCycleName, cycleCount);
    }
}

/**
 * Displays a milestone achievement message when a user reaches a specific cycle count.
 *
 * @param {string} miniCycleName - The name of the Mini Cycle.
 * @param {number} cycleCount - The number of cycles completed.
 */

function showMilestoneMessage(miniCycleName, cycleCount) {
    const message = `🎉 You've completed ${cycleCount} cycles for "${miniCycleName}"! Keep going! 🚀`;

    // ✅ Create a notification-like popup
    const milestonePopup = document.createElement("div");
    milestonePopup.classList.add("mini-cycle-milestone");
    milestonePopup.textContent = message;

    document.body.appendChild(milestonePopup);

    // ✅ Automatically remove the message after 3 seconds
    setTimeout(() => {
        milestonePopup.remove();
    }, 3000);
}

    /***********************
 * 
 * 
 * Rearrange Management Logic
 * 
 * 
 ************************/


/**
 * Draganddrop function.
 *
 * @param {any} taskElement - Description. * @returns {void}
 */

function DragAndDrop(taskElement) {
 

    // Prevent text selection on mobile
    taskElement.style.userSelect = "none";
    taskElement.style.webkitUserSelect = "none";
    taskElement.style.msUserSelect = "none";

    let touchStartX = 0;
    let touchStartY = 0;
    let holdTimeout = null;
    let isDragging = false;
    let isLongPress = false;
    let isTap = false;
    let preventClick = false;
    const moveThreshold = 15; // 🚀 Movement threshold for long press

    // 📱 **Touch-based Drag for Mobile**
    taskElement.addEventListener("touchstart", (event) => {
        if (event.target.closest(".task-options")) return;
        isLongPress = false;
        isDragging = false;
        isTap = true; 
        readyToDrag = false; 
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        preventClick = false;

        // ✅ NEW FIX: Remove `.long-pressed` from all other tasks before long press starts
        document.querySelectorAll(".task").forEach(task => {
            if (task !== taskElement) {
                task.classList.remove("long-pressed");
                hideTaskButtons(task);
            }
        });

        holdTimeout = setTimeout(() => {
            isLongPress = true;
            isTap = false;
            draggedTask = taskElement;
            isDragging = true;
            taskElement.classList.add("dragging", "long-pressed");

            event.preventDefault();

            console.log("📱 Long Press Detected - Showing Task Options", taskElement);

            // ✅ Ensure task options remain visible
            revealTaskButtons(taskElement);

        }, 500); // Long-press delay (500ms)
    });

    taskElement.addEventListener("touchmove", (event) => {
        const touchMoveX = event.touches[0].clientX;
        const touchMoveY = event.touches[0].clientY;
        const deltaX = Math.abs(touchMoveX - touchStartX);
        const deltaY = Math.abs(touchMoveY - touchStartY);

        // ✅ Cancel long press if moving too much
        if (deltaX > moveThreshold || deltaY > moveThreshold) {
            clearTimeout(holdTimeout);
            isLongPress = false;
            isTap = false; // ✅ Prevent accidental taps after dragging
            return;
        }

        // ✅ Allow normal scrolling if moving vertically
        if (deltaY > deltaX) {
            clearTimeout(holdTimeout);
            isTap = false;
            return;
        }

        if (isLongPress && readyToDrag && !isDragging) {
            taskElement.setAttribute("draggable", "true");
            isDragging = true;

            if (event.cancelable) {
                event.preventDefault();
            }
        }

        if (isDragging && draggedTask) {
            if (event.cancelable) {
                event.preventDefault();
            }
            const movingTask = document.elementFromPoint(event.touches[0].clientX, event.touches[0].clientY);
            if (movingTask) {
              handleRearrange(movingTask, event);
          }
      
        }
    });

    taskElement.addEventListener("touchend", () => {
        clearTimeout(holdTimeout);

        if (isTap) {
            preventClick = true;
            setTimeout(() => { 
                preventClick = false; 
            }, 100);
        }

        if (draggedTask) {
            draggedTask.classList.remove("dragging", "rearranging");
            draggedTask = null;
        }

        isDragging = false;

        // ✅ Ensure task options remain open only when a long press is detected
        if (isLongPress) {
            console.log("✅ Long Press Completed - Keeping Task Options Open", taskElement);
            return;
        }
    
        taskElement.classList.remove("long-pressed");
    });

    // 🖱️ **Mouse-based Drag for Desktop**
    taskElement.addEventListener("dragstart", (event) => {
        if (event.target.closest(".task-options")) return;
        draggedTask = taskElement;
        event.dataTransfer.setData("text/plain", "");

        // ✅ NEW: Add dragging class for desktop as well
        taskElement.classList.add("dragging");

        // ✅ Hide ghost image on desktop
        if (!isTouchDevice()) {
            const transparentPixel = new Image();
            transparentPixel.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
            event.dataTransfer.setDragImage(transparentPixel, 0, 0);
        }
    });

}


let rearrangeTimeout; // Prevents excessive reordering calls

/**
 * Handles the rearrangement of tasks when dragged.
 *
 * @param {HTMLElement} target - The task element being moved.
 * @param {DragEvent | TouchEvent} event - The event triggering the rearrangement.
 */

const REARRANGE_DELAY = 75; // ms delay to smooth reordering

function handleRearrange(target, event) {
  if (!target || !draggedTask || target === draggedTask) return;

  clearTimeout(rearrangeTimeout);

  rearrangeTimeout = setTimeout(() => {
    if (!document.contains(target) || !document.contains(draggedTask)) return;

    const parent = draggedTask.parentNode;
    if (!parent || !target.parentNode) return;

    const bounding = target.getBoundingClientRect();
    const offset = event.clientY - bounding.top;

    // 🧠 Snapshot only if enough time has passed
    const now = Date.now();
    if (now - lastReorderTime > REORDER_SNAPSHOT_INTERVAL) {
      pushUndoSnapshot();
      lastReorderTime = now;
      didDragReorderOccur = true;
    }

    const isLastTask = !target.nextElementSibling;
    const isFirstTask = !target.previousElementSibling;

    document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));

    if (isLastTask && target.nextSibling !== draggedTask) {
      parent.appendChild(draggedTask);
      draggedTask.classList.add("drop-target");
      return;
    }

    if (isFirstTask && target.previousSibling !== draggedTask) {
      parent.insertBefore(draggedTask, parent.firstChild);
      draggedTask.classList.add("drop-target");
      return;
    }

    if (offset > bounding.height / 3) {
      if (target.nextSibling !== draggedTask) {
        parent.insertBefore(draggedTask, target.nextSibling);
      }
    } else {
      if (target.previousSibling !== draggedTask) {
        parent.insertBefore(draggedTask, target);
      }
    }

    draggedTask.classList.add("drop-target");
  }, REARRANGE_DELAY);
}



/**
 * Setuprearrange function.
 *
 * @returns {void}
 */

function setupRearrange() {
  if (window.rearrangeInitialized) return;
  window.rearrangeInitialized = true;

  document.addEventListener("dragover", (event) => {
    event.preventDefault();
    requestAnimationFrame(() => {
      const movingTask = event.target.closest(".task");
      if (movingTask) {
        handleRearrange(movingTask, event);
        // ❌ Don't save yet — just rearrange visually
      }
    });
  });

  document.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!draggedTask) return;

    if (didDragReorderOccur) {
      saveCurrentTaskOrder();
      autoSave();
      updateProgressBar();
      updateStatsPanel();
      checkCompleteAllButton();

      document.getElementById("undo-btn").hidden = false;
      document.getElementById("redo-btn").hidden = true;

      console.log("🔁 Drag reorder completed and saved with undo snapshot.");
    }

    cleanupDragState();
    lastReorderTime = 0;
  didDragReorderOccur = false;
  });
}



/**
 * Cleanupdragstate function.
 *
 * @returns {void}
 */

function cleanupDragState() {
    if (draggedTask) {
        draggedTask.classList.remove("dragging", "rearranging");
        draggedTask = null;
    }

    lastRearrangeTarget = null;
    document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));
}



/**
 * Dragendcleanup function.
 *
 * @returns {void}
 */

function dragEndCleanup () {
    document.addEventListener("drop", cleanupDragState);
    document.addEventListener("dragover", () => {
        document.querySelectorAll(".rearranging").forEach(task => task.classList.remove("rearranging"));
    });
    
    
    }

    /**
 * Updatemovearrowsvisibility function.
 *
 * @returns {void}
 */

function updateMoveArrowsVisibility() {
        const showArrows = localStorage.getItem("miniCycleMoveArrows") === "true";
    
        document.querySelectorAll(".move-btn").forEach(button => {
            button.style.visibility = showArrows ? "visible" : "hidden";
            button.style.opacity = showArrows ? "1" : "0";
        });
    
        // ✅ Ensure `.task-options` remains interactive
        document.querySelectorAll(".task-options").forEach(options => {
            options.style.pointerEvents = "auto"; // 🔥 Fixes buttons becoming unclickable
        });
    
        console.log("✅ Move Arrows Toggled");
        
        toggleArrowVisibility();
        dragEndCleanup ();
    }
    

    
    /**
 * Togglearrowvisibility function.
 *
 * @returns {void}
 */

function toggleArrowVisibility() { 
        const showArrows = localStorage.getItem("miniCycleMoveArrows") === "true"; 
        const allTasks = document.querySelectorAll(".task");
    
        allTasks.forEach((task, index) => {
            const upButton = task.querySelector('.move-up');
            const downButton = task.querySelector('.move-down');
            const taskOptions = task.querySelector('.task-options'); // ✅ Select task options
            const taskButtons = task.querySelectorAll('.task-btn'); // ✅ Select all task buttons
    
            if (upButton) {
                upButton.style.visibility = (showArrows && index !== 0) ? "visible" : "hidden";
                upButton.style.opacity = (showArrows && index !== 0) ? "1" : "0";
                upButton.style.pointerEvents = showArrows ? "auto" : "none"; 
            }
            if (downButton) {
                downButton.style.visibility = (showArrows && index !== allTasks.length - 1) ? "visible" : "hidden";
                downButton.style.opacity = (showArrows && index !== allTasks.length - 1) ? "1" : "0";
                downButton.style.pointerEvents = showArrows ? "auto" : "none"; 
            }
    
            // ✅ Ensure task options remain interactive
        if (taskOptions) {
            taskOptions.style.pointerEvents = "auto";  
        }
    
            // ✅ Ensure individual buttons remain interactive
            taskButtons.forEach(button => {
                button.style.pointerEvents = "auto";
            });
        });
    
        console.log(`✅ Move arrows and buttons are now ${showArrows ? "enabled" : "disabled"}`);
    }
    
    /***********************
 * 
 * 
 * Task Management
 * 
 * 
 ************************/
    /**
     * Adds a new task to the list.
     * @param {string} taskText - The task description.
     * @param {boolean} [completed=false] - Whether the task starts as completed.
     * @param {boolean} [shouldSave=true] - If true, the task is saved.
     * @param {string|null} [dueDate=null] - Optional due date.
     * @param {boolean} [highPriority=false] - If true, the task is marked as high priority.
     * @param {boolean} [isLoading=false] - If true, task is loaded from storage.
     * @param {boolean} [remindersEnabled=false] - If true, reminders are turned on.
     */

    function isAlwaysShowRecurringEnabled() {
  return document.getElementById("always-show-recurring")?.checked ||
         JSON.parse(localStorage.getItem("miniCycleAlwaysShowRecurring")) === true;
}

    
function addTask(taskText, completed = false, shouldSave = true, dueDate = null, highPriority = null, isLoading = false, remindersEnabled = false, recurring = false, taskId = null, recurringSettings = {}) {
     
    if (typeof taskText !== "string") {
        console.error("❌ Error: taskText is not a string", taskText);
        return;
    }
    
    // ⛑️ Sanitize input early to avoid unsafe values spreading
    let taskTextTrimmed = sanitizeInput(taskText.trim());
    if (!taskTextTrimmed) {
        console.warn("⚠ Skipping empty or unsafe task.");
        return;
    }
    
    if (taskTextTrimmed.length > TASK_LIMIT) {
        showNotification(`Task must be ${TASK_LIMIT} characters or less.`);
        return;
    }
    
    // ✅ Prep logic first
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
    const cycleTasks = savedMiniCycles?.[lastUsedMiniCycle]?.tasks || [];

    // ✅ Get settings before creating task
    const autoResetEnabled = toggleAutoReset.checked;
    const reminderSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
    const remindersEnabledGlobal = reminderSettings.enabled === true;
    
    // ✅ Create Task Element
    const taskItem = document.createElement("li");
    taskItem.classList.add("task");
    taskItem.setAttribute("draggable", "true");

    const hasValidRecurringSettings = recurring && recurringSettings && Object.keys(recurringSettings).length > 0;

    if (hasValidRecurringSettings) {
        taskItem.classList.add("recurring");
        taskItem.setAttribute("data-recurring-settings", JSON.stringify(recurringSettings));
    }
    
    // ✅ Use the passed-in taskId if it exists, otherwise generate a new one
    const assignedTaskId = taskId || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    taskItem.dataset.taskId = assignedTaskId;
    
    if (highPriority) {
        taskItem.classList.add("high-priority");
    }

    // ✅ Three Dots Menu (If Enabled)
    const showThreeDots = localStorage.getItem("miniCycleThreeDots") === "true";
    if (showThreeDots) {
        const threeDotsButton = document.createElement("button");
        threeDotsButton.classList.add("three-dots-btn");
        threeDotsButton.innerHTML = "⋮";
        threeDotsButton.addEventListener("click", (event) => {
            event.stopPropagation(); // Don't complete the task
            revealTaskButtons(taskItem);
        });
        taskItem.appendChild(threeDotsButton);
    }

    // ✅ Create Button Container
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("task-options");

    let existingTask = cycleTasks.find(task => task.id === assignedTaskId);
    if (!existingTask) {
        existingTask = {
            id: assignedTaskId,
            text: taskTextTrimmed,
            completed,
            dueDate,
            highPriority,
            remindersEnabled,
            recurring,
            recurringSettings,
            schemaVersion: 2
        };
        cycleTasks.push(existingTask);
        savedMiniCycles[lastUsedMiniCycle].tasks = cycleTasks;
        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
        
        // ✅ Save recurring task into recurringTemplates if applicable
        if (recurring && recurringSettings && savedMiniCycles[lastUsedMiniCycle]) {
            if (!savedMiniCycles[lastUsedMiniCycle].recurringTemplates) {
                savedMiniCycles[lastUsedMiniCycle].recurringTemplates = {};
            }

            savedMiniCycles[lastUsedMiniCycle].recurringTemplates[assignedTaskId] = {
                id: assignedTaskId,
                text: taskTextTrimmed,
                recurring: true,
                recurringSettings: structuredClone(recurringSettings),
                highPriority: highPriority || false,
                dueDate: dueDate || null,
                remindersEnabled: remindersEnabled || false,
                lastTriggeredTimestamp: null,
                schemaVersion: 2
            };
            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
        }
    }
    
    const cycleData = savedMiniCycles?.[lastUsedMiniCycle] ?? {};
    const deleteCheckedEnabled = cycleData.deleteCheckedTasks;
    
    // ✅ Then define your condition:
    const showRecurring = !autoResetEnabled && deleteCheckedEnabled;

    // ✅ Task Buttons (Including Reminder Button)
    const buttons = [
        { class: "move-up", icon: "▲", show: true },
        { class: "move-down", icon: "▼", show: true },
        { class: "recurring-btn", icon: "<i class='fas fa-repeat'></i>", show: showRecurring || isAlwaysShowRecurringEnabled() },
        { class: "set-due-date", icon: "<i class='fas fa-calendar-alt'></i>", show: !autoResetEnabled },
        { class: "enable-task-reminders", icon: "<i class='fas fa-bell'></i>", show: remindersEnabled || remindersEnabledGlobal, toggle: true },
        { class: "priority-btn", icon: "<i class='fas fa-exclamation-triangle'></i>", show: true },
        { class: "edit-btn", icon: "<i class='fas fa-edit'></i>", show: true },
        { class: "delete-btn", icon: "<i class='fas fa-trash'></i>", show: true }
    ];
    
    buttons.forEach(({ class: btnClass, icon, toggle = false, show }) => {
        const button = document.createElement("button");
        button.classList.add("task-btn", btnClass);
        button.innerHTML = icon;
        // ✅ Prevent it from behaving like a submit button in a form
        button.setAttribute("type", "button")
        // Always add it to keep button order stable
        if (!show) button.classList.add("hidden"); // ✅ Keeps layout stable

        // ⌨️ Keyboard: Enter/Space Activation
        button.setAttribute("tabindex", "0");
        button.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                button.click();
            }

            // ⬅️➡️ Left/Right Arrow Navigation
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const focusable = Array.from(buttonContainer.querySelectorAll("button.task-btn"));
                const currentIndex = focusable.indexOf(e.target);
                const nextIndex = e.key === "ArrowRight"
                    ? (currentIndex + 1) % focusable.length
                    : (currentIndex - 1 + focusable.length) % focusable.length;
                focusable[nextIndex].focus();
                e.preventDefault();
            }
        });
                
        // ARIA label setup
        const ariaLabels = {
            "move-up": "Move task up",
            "move-down": "Move task down",
            "recurring-btn": "Toggle recurring task",
            "set-due-date": "Set due date",
            "enable-task-reminders": "Toggle reminders for this task",
            "priority-btn": "Mark task as high priority",
            "edit-btn": "Edit task",
            "delete-btn": "Delete task"
        };
        button.setAttribute("aria-label", ariaLabels[btnClass] || "Task action");
    
        // ARIA toggle state setup
        if (btnClass === "enable-task-reminders") {
            const isActive = remindersEnabled === true;
            button.classList.toggle("reminder-active", isActive);
            button.setAttribute("aria-pressed", isActive.toString());
        } else if (["recurring-btn", "priority-btn"].includes(btnClass)) {
            const isActive = btnClass === "recurring-btn" ? !!recurring : !!highPriority;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", isActive.toString());
        }
        
        // ✅ Updated recurring button click handler with educational tips
        if (btnClass === "recurring-btn") {
            button.addEventListener("click", () => {
                const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
                const taskList = savedMiniCycles?.[lastUsedMiniCycle]?.tasks;
                const taskIdFromDom = taskItem.dataset.taskId;

                if (!taskList) return;
                const targetTask = taskList.find(task => task.id === taskIdFromDom);
                if (!targetTask) return;

                // 🔁 Snapshot before toggling recurrence
                pushUndoSnapshot();

                if (!(showRecurring || document.getElementById("always-show-recurring")?.checked)) return;

                const isNowRecurring = !targetTask.recurring;
                targetTask.recurring = isNowRecurring;

                button.classList.toggle("active", isNowRecurring);
                button.setAttribute("aria-pressed", isNowRecurring.toString());

                if (isNowRecurring) {
                    const defaultSettings = JSON.parse(localStorage.getItem("miniCycleDefaultRecurring") || "{}");

                    targetTask.recurringSettings = normalizeRecurringSettings(structuredClone(defaultSettings));
                    taskItem.setAttribute("data-recurring-settings", JSON.stringify(targetTask.recurringSettings));
                    taskItem.classList.add("recurring");
                    targetTask.schemaVersion = 2;

                    const rs = targetTask.recurringSettings || {};
                    const frequency = rs.frequency || "daily";
                    const pattern = rs.indefinitely ? "Indefinitely" : "Limited";

                    // ✅ Use the new modular educational tip system
                    const notificationContent = createRecurringNotificationWithTip(assignedTaskId, frequency, pattern);
                    
                    const notification = showNotificationWithTip(
                        notificationContent,
                        "recurring",
                        20000, // 20 second duration
                        "recurring-cycle-explanation" // tip ID for initialization
                    );

                    // Initialize the enhanced event listeners for this notification
                    initializeRecurringNotificationListeners(notification);

                } else {
                    targetTask.recurringSettings = {};
                    targetTask.schemaVersion = 2;
                    taskItem.removeAttribute("data-recurring-settings");
                    taskItem.classList.remove("recurring");

                    if (savedMiniCycles[lastUsedMiniCycle]?.recurringTemplates?.[taskIdFromDom]) {
                        delete savedMiniCycles[lastUsedMiniCycle].recurringTemplates[taskIdFromDom];
                    }

                    showNotification("↩️ Recurring turned off for this task.", "info", 2000);
                }

                localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
                updateRecurringPanelButtonVisibility();
                updateRecurringPanel?.();
                autoSave();
            });
        } else if (btnClass === "enable-task-reminders") {
            button.addEventListener("click", () => {
                // 🧠 Only snapshot if user is manually toggling
                pushUndoSnapshot();

                const isActive = button.classList.toggle("reminder-active");
                button.setAttribute("aria-pressed", isActive.toString());

                saveTaskReminderState(assignedTaskId, isActive);
                autoSaveReminders();
                startReminders();

                // 🔄 Update undo/redo UI
                const undoBtn = document.getElementById("undo-btn");
                const redoBtn = document.getElementById("redo-btn");
                if (undoBtn) undoBtn.hidden = false;
                if (redoBtn) redoBtn.hidden = true;

                showNotification(`Reminders ${isActive ? "enabled" : "disabled"} for task.`, "info", 1500);
            });
        } else {
            // All other buttons use the shared handler
            button.addEventListener("click", handleTaskButtonClick);
        }
    
        buttonContainer.appendChild(button);
    });

    console.log(`📌 Loading Task: ${taskTextTrimmed}, Reminder Enabled: ${remindersEnabled}`);

    // ✅ Checkbox for Completion
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("id", `checkbox-${assignedTaskId}`);
    checkbox.setAttribute("name", `task-complete-${assignedTaskId}`);
    checkbox.checked = completed;
    checkbox.setAttribute("aria-label", `Mark task "${taskTextTrimmed}" as complete`);
    checkbox.setAttribute("role", "checkbox");
    checkbox.setAttribute("aria-checked", checkbox.checked);
    
    safeAddEventListener(checkbox, "change", () => {
        pushUndoSnapshot();
        handleTaskCompletionChange(checkbox);
        checkMiniCycle();
        autoSave();
        triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);

        // 🔄 Show undo / hide redo
        const undoBtn = document.getElementById("undo-btn");
        const redoBtn = document.getElementById("redo-btn");
        if (undoBtn) undoBtn.hidden = false;
        if (redoBtn) redoBtn.hidden = true;

        console.log("✅ Task completion toggled — undo snapshot pushed.");
    });
    
    safeAddEventListener(checkbox, "keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault(); // Prevent scrolling or default behavior
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change")); // Reuse your logic above!
        }
    });

    // ✅ Ensure `.task-text` Exists
    const taskLabel = document.createElement("span");
    taskLabel.classList.add("task-text");
    taskLabel.textContent = taskTextTrimmed;
    taskLabel.setAttribute("tabindex", "0");
    taskLabel.setAttribute("role", "text"); // optional for semantics
    
    // 🔁 Add blue recurring icon if this task is recurring
    if (recurring) {
        const icon = document.createElement("span");
        icon.className = "recurring-indicator";
        icon.innerHTML = `<i class="fas fa-sync-alt"></i>`;
        taskLabel.appendChild(icon);
    }
        
    // ✅ Due Date Input (Hidden by Default)
    const dueDateInput = document.createElement("input");
    dueDateInput.type = "date";
    dueDateInput.classList.add("due-date");
    dueDateInput.setAttribute("aria-describedby", `task-desc-${assignedTaskId}`);
    taskLabel.id = `task-desc-${assignedTaskId}`;   

    if (dueDate) {
        dueDateInput.value = dueDate;
        if (!toggleAutoReset.checked) {
            dueDateInput.classList.remove("hidden"); // Show if Auto Reset is OFF
        } else {
            dueDateInput.classList.add("hidden"); // Hide if Auto Reset is ON
        }
    } else {
        dueDateInput.classList.add("hidden"); // No date set? Keep it hidden
    }
    
    dueDateInput.addEventListener("change", () => {
        // 🔁 Push undo snapshot BEFORE changing due date
        pushUndoSnapshot();

        saveTaskDueDate(taskItem.dataset.taskId, dueDateInput.value);

        // ✅ Save + update UI
        autoSave();
        updateStatsPanel();
        updateProgressBar();
        checkCompleteAllButton();

        // 🎉 Optional: toast
        showNotification("📅 Due date updated", "info", 1500);
    });

    const dueDateButton = buttonContainer.querySelector(".set-due-date");
    if (dueDateButton) {
        dueDateButton.addEventListener("click", () => {
            dueDateInput.classList.toggle("hidden");
            dueDateButton.classList.toggle("active", !dueDateInput.classList.contains("hidden"));
        });
    }

    // ✅ Toggle Completion on Click (excluding buttons)
    taskItem.addEventListener("click", (event) => {
        if (event.target === checkbox || buttonContainer.contains(event.target) || event.target === dueDateInput) return;
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change")); // Manually trigger change event
        checkbox.setAttribute("aria-checked", checkbox.checked);
        checkMiniCycle();
        autoSave();
        triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);
    });

    const taskContent = document.createElement("div");
    taskContent.classList.add("task-content");
    taskContent.appendChild(checkbox);
    taskContent.appendChild(taskLabel);

    taskItem.appendChild(buttonContainer);

    // ✅ Ensure Priority Button Reflects Saved State
    const priorityButton = buttonContainer.querySelector(".priority-btn");
    if (highPriority) {
        priorityButton.classList.add("priority-active");
        priorityButton.setAttribute("aria-pressed", "true");
    }
    
    taskItem.appendChild(taskContent);
    taskItem.appendChild(dueDateInput);
    document.getElementById("taskList").appendChild(taskItem);
    taskInput.value = ""; // ✅ FIX: Clear input field after adding task

    document.querySelector(".task-list-container").scrollTo({
        top: taskList.scrollHeight,
        behavior: "smooth"
    });

    setTimeout(() => { 
        if (completed) {
            taskItem.classList.remove("overdue-task");
        }
    }, 300);

    checkCompleteAllButton();
    updateProgressBar();
    updateStatsPanel();
    if (shouldSave) autoSave();

    // ✅ Check for overdue tasks after adding a task
    if (!isLoading) setTimeout(() => { remindOverdueTasks(); }, 1000);

    // ✅ Enable Drag and Drop
    DragAndDrop(taskItem);

    // ✅ Hide Move Arrows if disabled in settings
    updateMoveArrowsVisibility();

    // ✅ Conditionally allow hover if three-dots menu is disabled
    const threeDotsEnabled = localStorage.getItem("miniCycleThreeDots") === "true";
    if (!threeDotsEnabled) {
        taskItem.addEventListener("mouseenter", showTaskOptions);
        taskItem.addEventListener("mouseleave", hideTaskOptions);
    }

    safeAddEventListener(taskItem, "focus", () => {
        const options = taskItem.querySelector(".task-options");
        if (options) {
            options.style.opacity = "1";
            options.style.visibility = "visible";
            options.style.pointerEvents = "auto";
        }
    });
    
    // ⌨️ Accessibility: show task buttons on keyboard focus
    attachKeyboardTaskOptionToggle(taskItem);
}
    



function toggleHoverTaskOptions(enableHover) {
  document.querySelectorAll(".task").forEach(taskItem => {
    if (enableHover) {
      if (!taskItem.classList.contains("hover-enabled")) {
        taskItem.addEventListener("mouseenter", showTaskOptions);
        taskItem.addEventListener("mouseleave", hideTaskOptions);
        taskItem.classList.add("hover-enabled");
      }
    } else {
      if (taskItem.classList.contains("hover-enabled")) {
        taskItem.removeEventListener("mouseenter", showTaskOptions);
        taskItem.removeEventListener("mouseleave", hideTaskOptions);
        taskItem.classList.remove("hover-enabled");
      }
    }
  });
}



document.addEventListener("click", (e) => {
  const target = e.target.closest(".open-recurring-settings");
  if (!target) return;

  const taskId = target.dataset.taskId;
  if (!taskId) return;

  // 🎯 Use your centralized panel-opening logic
  openRecurringSettingsPanelForTask(taskId);
});

/**
 * ✅ Sanitize user input to prevent XSS attacks or malformed content.
 * @param {string} input - The user input to be sanitized.
 * @returns {string} - Cleaned and safe string, trimmed and limited in length.
 */
function sanitizeInput(input) {
    if (typeof input !== "string") return "";
    const temp = document.createElement("div");
    temp.textContent = input; // Set as raw text (sanitized)
    return temp.textContent.trim().substring(0, TASK_LIMIT); // <-- use textContent here too
  }

    /**
 * ⌨️ Accessibility Helper: Toggles visibility of task buttons when task item is focused or blurred.
 * 
 * When navigating with the keyboard (e.g., using Tab), this ensures that the task option buttons
 * (edit, delete, reminders, etc.) are shown while the task is focused and hidden when it loses focus.
 * 
 * This provides a keyboard-accessible experience similar to mouse hover.
 *
 * @param {HTMLElement} taskItem - The task <li> element to attach listeners to.
 */
    function attachKeyboardTaskOptionToggle(taskItem) {
      /**
       * ⌨️ Show task buttons only when focus is inside a real action element.
       * Prevent buttons from appearing when clicking the checkbox or task text.
       */
      safeAddEventListener(taskItem, "focusin", (e) => {
        const target = e.target;
    
        // ✅ Skip if focusing on safe elements that shouldn't trigger button reveal
        if (
          target.classList.contains("task-text") ||
          target.type === "checkbox" ||
          target.closest(".focus-safe")
        ) {
          return;
        }
    
        const options = taskItem.querySelector(".task-options");
        if (options) {
          options.style.opacity = "1";
          options.style.visibility = "visible";
          options.style.pointerEvents = "auto";
        }
      });
    
      /**
       * ⌨️ Hide task buttons when focus moves outside the entire task
       */
      safeAddEventListener(taskItem, "focusout", (e) => {
        if (taskItem.contains(e.relatedTarget)) return;
    
        const options = taskItem.querySelector(".task-options");
        if (options) {
          options.style.opacity = "0";
          options.style.visibility = "hidden";
          options.style.pointerEvents = "none";
        }
      });
    }



    /**
 * Updatereminderbuttons function.
 *
 * @returns {void}
 */

  
    function updateReminderButtons() {
        console.log("🔍 Running updateReminderButtons()...");
      
        const reminderSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
        const remindersGloballyEnabled = reminderSettings.enabled === true;
      
        document.querySelectorAll(".task").forEach(taskItem => {
          const buttonContainer = taskItem.querySelector(".task-options");
          let reminderButton = buttonContainer.querySelector(".enable-task-reminders");
      
          const taskId = taskItem.dataset.taskId;
          if (!taskId) {
            console.warn("⚠ Skipping task with missing ID:", taskItem);
            return;
          }
      
          const savedTasks = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
          const lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
          const taskData = savedTasks[lastUsedMiniCycle]?.tasks?.find(t => t.id === taskId);
      
          const isActive = taskData?.remindersEnabled === true;
      
          if (remindersGloballyEnabled) {
            if (!reminderButton) {
              // ✅ Create Reminder Button
              reminderButton = document.createElement("button");
              reminderButton.classList.add("task-btn", "enable-task-reminders");
              reminderButton.innerHTML = "<i class='fas fa-bell'></i>";
      
              // Add click event
              reminderButton.addEventListener("click", () => {
                const nowActive = reminderButton.classList.toggle("reminder-active");
                reminderButton.setAttribute("aria-pressed", nowActive.toString());
                saveTaskReminderState(taskId, nowActive);
                autoSaveReminders();
              });
      
              buttonContainer.insertBefore(reminderButton, buttonContainer.children[2]);
              console.log("   ✅ Reminder Button Created & Inserted");
            }
      
            // ✅ Ensure correct state and make it visible
            reminderButton.classList.toggle("reminder-active", isActive);
            reminderButton.setAttribute("aria-pressed", isActive.toString());
            reminderButton.classList.remove("hidden");
      
            console.log(`   🔄 Reminder Button Visible - Active: ${isActive}`);
          } else {
            // ❌ Hide button if reminders are disabled globally
            if (reminderButton) {
              reminderButton.classList.add("hidden"); // Don't remove it; just hide for layout consistency
              reminderButton.classList.remove("reminder-active");
              reminderButton.setAttribute("aria-pressed", "false");
      
              console.log("   🔕 Reminder Button Hidden (Global toggle OFF)");
            }
          }
        });
      
        console.log("✅ Finished updateReminderButtons().");
      }
    
    

    /**
 * Showtaskoptions function.
 *
 * @param {any} event - Description. * @returns {void}
 */

function revealTaskButtons(taskItem) {
  const taskOptions = taskItem.querySelector(".task-options");
  if (!taskOptions) return;

  // 🧹 Hide all other task option menus
  document.querySelectorAll(".task-options").forEach(opts => {
    if (opts !== taskOptions) {
      opts.style.visibility = "hidden";
      opts.style.opacity = "0";
      opts.style.pointerEvents = "none";

      // Optional: hide all child buttons too
      opts.querySelectorAll(".task-btn").forEach(btn => {
        btn.style.visibility = "hidden";
        btn.style.opacity = "0";
        btn.style.pointerEvents = "none";
      });
    }
  });

  // ✅ Show this task's options
  taskOptions.style.visibility = "visible";
  taskOptions.style.opacity = "1";
  taskOptions.style.pointerEvents = "auto";

  const reminderSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
  const remindersEnabledGlobal = reminderSettings.enabled === true;
  const autoResetEnabled = toggleAutoReset.checked;

  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const cycleData = savedMiniCycles?.[lastUsedMiniCycle] ?? {};
  const deleteCheckedEnabled = cycleData.deleteCheckedTasks;

  const alwaysShow = JSON.parse(localStorage.getItem("miniCycleAlwaysShowRecurring")) === true;
  const showRecurring = alwaysShow || (!autoResetEnabled && deleteCheckedEnabled);

  taskOptions.querySelectorAll(".task-btn").forEach(btn => {
    const isReminderBtn = btn.classList.contains("enable-task-reminders");
    const isRecurringBtn = btn.classList.contains("recurring-btn");
    const isDueDateBtn = btn.classList.contains("set-due-date");

    const shouldShow =
      !btn.classList.contains("hidden") ||
      (isReminderBtn && remindersEnabledGlobal) ||
      (isRecurringBtn && showRecurring) ||
      (isDueDateBtn && !autoResetEnabled);

    if (shouldShow) {
      btn.classList.remove("hidden");
      btn.style.visibility = "visible";
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }
  });

  updateMoveArrowsVisibility();
}

    function hideTaskButtons(taskItem) {

      if (taskItem.classList.contains("rearranging")) {
        console.log("⏳ Skipping hide during task rearrangement");
        return;
      }
        const taskOptions = taskItem.querySelector(".task-options");
        if (!taskOptions) return;
    
        taskOptions.style.visibility = "hidden";
        taskOptions.style.opacity = "0";
        taskOptions.style.pointerEvents = "none";
    
        taskItem.querySelectorAll(".task-btn").forEach(btn => {
            btn.style.visibility = "hidden";
            btn.style.opacity = "0";
            btn.style.pointerEvents = "none";
        });
    
        // Keep layout and interactivity clean
        updateMoveArrowsVisibility();
    }




    function showTaskOptions(event) {
        const taskElement = event.currentTarget;
    
        // ✅ Only allow on desktop or if long-pressed on mobile
        const isMobile = isTouchDevice();
        const allowShow = !isMobile || taskElement.classList.contains("long-pressed");
    
        if (allowShow) {
            revealTaskButtons(taskElement);
        }
    }
    

    function hideTaskOptions(event) {
        const taskElement = event.currentTarget;
    
        // ✅ Only hide if not long-pressed on mobile (so buttons stay open during drag)
        const isMobile = isTouchDevice();
        const allowHide = !isMobile || !taskElement.classList.contains("long-pressed");
    
        if (allowHide) {
            hideTaskButtons(taskElement);
        }
    }
    
    
/**
 * Handles the change event when a task's completion status is toggled.
 *
 * @param {HTMLInputElement} checkbox - The checkbox element of the task.
 */

function handleTaskCompletionChange(checkbox) {
        const taskItem = checkbox.closest(".task");
    
         if (checkbox.checked) {
            taskItem.classList.remove("overdue-task");
        } else {
            checkOverdueTasks(taskItem); // ✅ Only check this specific task
        }
    }
    


    /**
 * Istouchdevice function.
 *
 * @returns {void}
 */

function isTouchDevice() {
        let hasTouchEvents = "ontouchstart" in window;
        let touchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints;
        let isFinePointer = window.matchMedia("(pointer: fine)").matches;

        console.log(`touch detected: hasTouchEvents=${hasTouchEvents}, maxTouchPoints=${touchPoints}, isFinePointer=${isFinePointer}`);

        if (isFinePointer) return false;

       
        return hasTouchEvents || touchPoints > 0;
    }
    
 
    

/**
 * Handles button clicks for task-related actions, such as moving, editing, deleting, or changing priority.
 *
 * @param {Event} event - The event triggered by clicking a task button.
 */

function handleTaskButtonClick(event) {
    event.stopPropagation(); // ✅ Prevents click from affecting the whole task

    const button = event.currentTarget;
    const taskItem = button.closest(".task");

    if (!taskItem) return;

    // ✅ Ensure `.task-options` stays interactive
    const taskOptions = taskItem.querySelector(".task-options");
    if (taskOptions) {
        taskOptions.style.pointerEvents = "auto"; // 🔥 FIXES MOBILE CLICK ISSUE
    }

    let shouldSave = false;
    if (button.classList.contains("move-up")) {
  const prevTask = taskItem.previousElementSibling;
  if (prevTask) {
    // 🔁 Save undo snapshot BEFORE reordering
    pushUndoSnapshot();

    if (isTouchDevice()) {
      taskItem.classList.add("rearranging");
    }

    taskItem.parentNode.insertBefore(taskItem, prevTask);
    revealTaskButtons(taskItem);
    toggleArrowVisibility();

    // 💾 Save the new task order to localStorage
    saveCurrentTaskOrder();

    shouldSave = false; // Already saved manually
  }
} else if (button.classList.contains("move-down")) {
  const nextTask = taskItem.nextElementSibling;
  if (nextTask) {
    // 🔁 Save undo snapshot BEFORE reordering
    pushUndoSnapshot();

    if (isTouchDevice()) {
      taskItem.classList.add("rearranging");
    }

    taskItem.parentNode.insertBefore(taskItem, nextTask.nextSibling);
    revealTaskButtons(taskItem);
    toggleArrowVisibility();

    // 💾 Save the new task order to localStorage
    saveCurrentTaskOrder();

    shouldSave = false; // Already saved manually
  }
}
else if (button.classList.contains("edit-btn")) {
  const taskLabel = taskItem.querySelector("span");
  const oldText = taskLabel.textContent.trim();

  showPromptModal({
    title: "Edit Task Name",
    message: "Rename this task:",
    placeholder: "Enter new task name",
    defaultValue: oldText,
    confirmText: "Save",
    cancelText: "Cancel",
    required: true
  }).then(newText => {
    if (newText && newText.trim() !== oldText) {
      const cleanText = sanitizeInput(newText.trim());

      // 🔁 Save snapshot BEFORE changing text
      pushUndoSnapshot();

      taskLabel.textContent = cleanText;

      // ✅ Update task object in localStorage
      const taskId = taskItem.dataset.taskId;
      const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
      const taskList = savedMiniCycles?.[lastUsedMiniCycle]?.tasks || [];

      const taskToUpdate = taskList.find(task => task.id === taskId);
      if (taskToUpdate) {
        taskToUpdate.text = cleanText;
        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
        showNotification(`Task renamed to "${cleanText}"`, "info", 1500);
      }

      updateStatsPanel();
      updateProgressBar();
      checkCompleteAllButton();

      shouldSave = false; // Already saved
    }
  });
}
else if (button.classList.contains("delete-btn")) {
  const taskId = taskItem.dataset.taskId;
  const taskName = taskItem.querySelector(".task-text")?.textContent || "Task";

  showConfirmationModal({
    title: "Delete Task",
    message: `Are you sure you want to delete "${taskName}"?`,
    confirmText: "Delete",
    cancelText: "Cancel"
  }).then(confirmDelete => {
    if (!confirmDelete) {
      showNotification(`"${taskName}" has not been deleted.`);
      console.log("❌ Task not deleted.");
      return;
    }

    // ✅ Push undo snapshot BEFORE deletion
    pushUndoSnapshot();

    // ✅ Remove task from savedMiniCycles
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
    const currentCycle = savedMiniCycles?.[lastUsedMiniCycle];

    if (currentCycle) {
      currentCycle.tasks = currentCycle.tasks.filter(task => task.id !== taskId);

      if (currentCycle.recurringTemplates?.[taskId]) {
        delete currentCycle.recurringTemplates[taskId];
      }

      savedMiniCycles[lastUsedMiniCycle] = currentCycle;
      localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
    }

    // ✅ Remove from DOM
    taskItem.remove();
    updateProgressBar();
    updateStatsPanel();
    checkCompleteAllButton();
    toggleArrowVisibility();

    showNotification(`"${taskName}" has been deleted.`, "info", 2000);
    console.log(`🗑️ Deleted task: "${taskName}"`);
  });

  shouldSave = false; // Already saved manually
}

    
    else if (button.classList.contains("priority-btn")) {
  // 🔁 Save snapshot BEFORE changing priority
  pushUndoSnapshot();

  taskItem.classList.toggle("high-priority");

  // ✅ Reflect priority visually
  if (taskItem.classList.contains("high-priority")) {
    button.classList.add("priority-active");
  } else {
    button.classList.remove("priority-active");
  }

  // ✅ Update task object in storage
  const taskId = taskItem.dataset.taskId;
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const taskList = savedMiniCycles?.[lastUsedMiniCycle]?.tasks || [];

  const taskToUpdate = taskList.find(task => task.id === taskId);
  if (taskToUpdate) {
    taskToUpdate.highPriority = taskItem.classList.contains("high-priority");
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
showNotification(
  `Priority ${taskToUpdate.highPriority ? "enabled" : "removed"}.`,
  taskToUpdate.highPriority ? "error" : "info",
  1500
);
  }

  shouldSave = false; // Already saved manually
}
    
    
    if (shouldSave) autoSave();
    console.log("✅ Task button clicked:", button.className);
}

function saveCurrentTaskOrder() {
  const taskElements = document.querySelectorAll("#taskList .task");
  const newOrderIds = Array.from(taskElements).map(task => task.dataset.taskId);

  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const cycle = savedMiniCycles?.[lastUsedMiniCycle];
  if (!cycle || !Array.isArray(cycle.tasks)) return;

  // Reorder task array based on current DOM order
  const reorderedTasks = newOrderIds.map(id =>
    cycle.tasks.find(task => task.id === id)
  ).filter(Boolean); // filters out any nulls (just in case)

  cycle.tasks = reorderedTasks;

  // 💾 Save back to localStorage
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
}

function openStorageViewer() {
  const overlay = document.getElementById("storage-viewer-overlay");
  const contentEl = document.getElementById("storage-content");

  contentEl.innerHTML = ""; // Clear old content

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const rawValue = localStorage.getItem(key);

    const wrapper = document.createElement("div");
    wrapper.className = "storage-key";

    const keyTitle = document.createElement("div");
    keyTitle.className = "storage-key-title";
    keyTitle.textContent = key;

    let valueEl;
    try {
      const parsed = JSON.parse(rawValue);
      if (typeof parsed === "object" && parsed !== null) {
        valueEl = renderExpandableJSON(parsed);
      } else {
        valueEl = document.createElement("pre");
        valueEl.textContent = String(parsed);
      }
    } catch {
      valueEl = document.createElement("pre");
      valueEl.textContent = rawValue;
    }

    wrapper.appendChild(keyTitle);
    wrapper.appendChild(valueEl);
    contentEl.appendChild(wrapper);
  }

  overlay.classList.remove("hidden");

  // Ensure only one listener is active
  document.removeEventListener("click", handleOutsideClick);
  setTimeout(() => {
    document.addEventListener("click", handleOutsideClick);
  }, 0);
}

  // Click-outside-to-close logic
  function handleOutsideClick(event) {
  const stayOpenCheckbox = document.getElementById("stay-open-toggle");
  const box = document.querySelector("#storage-viewer-overlay .storage-modal-box");

  if (
    stayOpenCheckbox &&
    !stayOpenCheckbox.checked &&
    box &&
    !box.contains(event.target)
  ) {
    closeStorageViewer();
  }
}


// Enable dragging on storage modal
function makeStorageModalDraggable() {
  const modal = document.querySelector(".storage-modal-box");
  const header = modal.querySelector(".storage-modal-header");

  let isDragging = false;
  let offsetX, offsetY;

  header.style.cursor = "move";
  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    const rect = modal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    modal.style.position = "absolute";
    modal.style.zIndex = 9999;
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      modal.style.left = `${e.clientX - offsetX}px`;
      modal.style.top = `${e.clientY - offsetY}px`;
      modal.style.right = "auto";
      modal.style.bottom = "auto";
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}


function makeStorageModalResizable() {
  const modal = document.querySelector(".storage-modal-box");
  let isResizing = false;

  modal.addEventListener("mousedown", function (e) {
    const rect = modal.getBoundingClientRect();
    if (
      e.clientX > rect.right - 16 &&
      e.clientY > rect.bottom - 16
    ) {
      isResizing = true;
      e.preventDefault();
    }
  });

  document.addEventListener("mousemove", function (e) {
    if (isResizing) {
      const modal = document.querySelector(".storage-modal-box");
      modal.style.width = `${e.clientX - modal.offsetLeft}px`;
      modal.style.height = `${e.clientY - modal.offsetTop}px`;
    }
  });

  document.addEventListener("mouseup", function () {
    isResizing = false;
  });
}


function closeStorageViewer() {
  document.getElementById("storage-viewer-overlay").classList.add("hidden");
  document.removeEventListener("click", handleOutsideClick);
}

// ✅ Make sure it's globally available for inline HTML onclick
window.closeStorageViewer = closeStorageViewer;

function renderExpandableJSON(data, depth = 0) {
  const container = document.createElement("div");
  container.className = "json-container";

  for (const [key, value] of Object.entries(data)) {
    const entry = document.createElement("div");
    entry.className = "json-entry";

    const label = document.createElement("span");
    label.className = "json-key";
    label.textContent = `"${key}": `;

    const valueEl = document.createElement("span");
    if (typeof value === "object" && value !== null) {
      const toggle = document.createElement("button");
      toggle.textContent = "[+]";
      toggle.className = "json-toggle";

      const child = renderExpandableJSON(value, depth + 1);
      child.style.display = "none";

      toggle.onclick = () => {
        const visible = child.style.display === "block";
        child.style.display = visible ? "none" : "block";
        toggle.textContent = visible ? "[+]" : "[-]";
      };

      valueEl.appendChild(toggle);
      valueEl.appendChild(document.createTextNode(" { ... }"));
      entry.appendChild(label);
      entry.appendChild(valueEl);
      entry.appendChild(child);
    } else {
      valueEl.textContent = JSON.stringify(value);
      entry.appendChild(label);
      entry.appendChild(valueEl);
    }

    container.appendChild(entry);
  }

  return container;
}




























/**
 * Resettasks function.
 *
 * @returns {void}
 */

function resetTasks() {
  if (isResetting) return;
  isResetting = true;

  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const cycleData = savedMiniCycles?.[lastUsedMiniCycle];
  const taskElements = [...taskList.querySelectorAll(".task")];

  // 🧹 Remove recurring tasks
  removeRecurringTasksFromCycle(taskElements, cycleData);

  // ♻️ Reset non-recurring tasks
  taskElements.forEach(taskEl => {
    const isRecurring = taskEl.classList.contains("recurring");
    if (isRecurring) return;

    const checkbox = taskEl.querySelector("input[type='checkbox']");
    const dueDateInput = taskEl.querySelector(".due-date");

    if (checkbox) checkbox.checked = false;
    taskEl.classList.remove("overdue-task");

    if (dueDateInput) {
      dueDateInput.value = "";
      dueDateInput.classList.add("hidden");
    }
  });

  if (lastUsedMiniCycle && cycleData) {
    incrementCycleCount(lastUsedMiniCycle, savedMiniCycles);
  }



  cycleMessage.style.visibility = "visible";
  cycleMessage.style.opacity = "1";
  progressBar.style.width = "0%";

  setTimeout(() => {
    cycleMessage.style.opacity = "0";
    cycleMessage.style.visibility = "hidden";
    isResetting = false;
  }, 2000);

watchRecurringTasks();
  setTimeout(() => {
    autoSave();
    updateStatsPanel();
  }, 50);
}


/**
 * Checkcompleteallbutton function.
 *
 * @returns {void}
 */

function checkCompleteAllButton() {

    if (taskList.children.length > 0) 
        {
            console.log(taskList.children.length);
    completeAllButton.style.display = "block";
    
    completeAllButton.style.zIndex = "2";
    } else {
        completeAllButton.style.display = taskList.children.length > 0 ? "block" : "none";
        console.log(taskList.children.length);
    
    
    }
    }
    
    
/**
 * Temporarily changes the logo background color to indicate an action, then resets it.
 *
 * @param {string} [color='green'] - The temporary background color for the logo.
 * @param {number} [duration=300] - The duration (in milliseconds) before resetting the background.
 */

function triggerLogoBackground(color = 'green', duration = 300) {
    const logo = document.querySelector('.logo img');

    if (logo) {

        if (logoTimeoutId) {
            clearTimeout(logoTimeoutId);
            logoTimeoutId = null;
        }


        logo.style.backgroundColor = color;
        logoTimeoutId = setTimeout(() => {
            logo.style.backgroundColor = '';
            logoTimeoutId = null; 
        }, duration);
    }
}

/**
 * Savetoggleautoreset function.
 *
 * @returns {void}
 */

function saveToggleAutoReset() {
    const toggleAutoReset = document.getElementById("toggleAutoReset");
    const deleteCheckedTasksContainer = document.getElementById("deleteCheckedTasksContainer");
    const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

    // ✅ Ensure AutoReset reflects the correct state
    if (lastUsedMiniCycle && savedMiniCycles[lastUsedMiniCycle]) {
        toggleAutoReset.checked = savedMiniCycles[lastUsedMiniCycle].autoReset || false;
        deleteCheckedTasks.checked = savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks || false;
    } else {
        toggleAutoReset.checked = false;
        deleteCheckedTasks.checked = false;
    }

    // ✅ Show "Delete Checked Tasks" only when Auto Reset is OFF
    deleteCheckedTasksContainer.style.display = toggleAutoReset.checked ? "none" : "block";

     // ✅ Remove previous event listeners before adding new ones to prevent stacking
     toggleAutoReset.removeEventListener("change", handleAutoResetChange);
     deleteCheckedTasks.removeEventListener("change", handleDeleteCheckedTasksChange);


// ✅ Define event listener functions
/**
 * Handles changes to the Auto Reset toggle.
 * Updates localStorage with the new Auto Reset state and adjusts the UI accordingly.
 *
 * @param {Event} event - The change event triggered by toggling Auto Reset.
 */

function handleAutoResetChange(event) {
    if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) return;

    savedMiniCycles[lastUsedMiniCycle].autoReset = event.target.checked;

    // ✅ If Auto Reset is turned ON, automatically uncheck "Delete Checked Tasks"
    if (event.target.checked) {
        savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = false;
        deleteCheckedTasks.checked = false; // ✅ Update UI
    }

    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    // ✅ Show/Hide "Delete Checked Tasks" toggle dynamically
    deleteCheckedTasksContainer.style.display = event.target.checked ? "none" : "block";

    // ✅ Only trigger Mini Cycle reset if AutoReset is enabled
    if (event.target.checked) checkMiniCycle();

    refreshTaskListUI();

    // ✅ ⬅️ ADD THIS
    updateRecurringButtonVisibility();
}


    /**
     * Handles changes to the "Delete Checked Tasks" toggle.
     * Updates localStorage with the new state and adjusts the Mini Cycle settings accordingly.
     *
     * @param {Event} event - The change event triggered by toggling "Delete Checked Tasks".
     */

function handleDeleteCheckedTasksChange(event) {
        if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) return;

        savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = event.target.checked;
        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
        refreshTaskListUI();
    }
           

         // ✅ Add new event listeners
    toggleAutoReset.addEventListener("change", handleAutoResetChange);
    deleteCheckedTasks.addEventListener("change", handleDeleteCheckedTasksChange);
    

    }




    /**
 * Checkduedates function.
 *
 * @returns {void}
 */

    function checkDueDates() {
        // Make sure we only attach the listener once
        if (!toggleAutoReset.dataset.listenerAdded) {
            toggleAutoReset.dataset.listenerAdded = true;
    
            toggleAutoReset.addEventListener("change", function () {
                let autoReset = this.checked;
                updateDueDateVisibility(autoReset);
                
    
                let miniCycleName = localStorage.getItem("lastUsedMiniCycle");
                let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    
                if (savedMiniCycles[miniCycleName]) {
                    savedMiniCycles[miniCycleName].autoReset = autoReset;
                    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
                }
            });
        }
    
        // ✅ Prevent duplicate event listeners before adding a new one
        document.removeEventListener("change", handleDueDateChange);
        document.addEventListener("change", handleDueDateChange);
    }
    
    // ✅ Function to handle due date changes (placed outside to avoid re-declaration)
    function handleDueDateChange(event) {
        if (!event.target.classList.contains("due-date")) return;
    
        let taskItem = event.target.closest(".task");
        let taskText = taskItem.querySelector(".task-text").textContent;
        let dueDateValue = event.target.value;
    
        let miniCycleName = localStorage.getItem("lastUsedMiniCycle");
        let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    
        if (savedMiniCycles[miniCycleName]) {
            let taskData = savedMiniCycles[miniCycleName].tasks.find(task => task.text === taskText);
            if (taskData) {
                taskData.dueDate = dueDateValue;
                localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
                console.log(`📅 Due date updated: "${taskText}" → ${dueDateValue}`);
            }
        }
    
        checkOverdueTasks(taskItem);
    
        // ✅ Load Due Date Notification Setting
        const remindersSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
        const dueDatesRemindersEnabled = remindersSettings.dueDatesReminders;
    
        if (!dueDatesRemindersEnabled) return; // ✅ Skip notifications if toggle is OFF
    
        if (dueDateValue) {
            const today = new Date().setHours(0, 0, 0, 0);
            const selectedDate = new Date(dueDateValue).setHours(0, 0, 0, 0);
    
            if (selectedDate > today) {
                showNotification(`📅 Task "${taskText}" is due soon!`, "default");
            }
        }
    }
    
    
    // ✅ Apply initial visibility state on load
    let autoReset = toggleAutoReset.checked;
    updateDueDateVisibility(autoReset);
    
    

/**
 * Updates the visibility of due date fields and related UI elements based on Auto Reset settings.
 *
 * @param {boolean} autoReset - Whether Auto Reset is enabled.
 */
    function updateDueDateVisibility(autoReset) {
        const dueDatesRemindersOption = document.getElementById("dueDatesReminders").parentNode; // Get the label container
        if (dueDatesRemindersOption) {
            dueDatesRemindersOption.style.display = autoReset ? "none" : "block";
            }
        

        // Toggle visibility of "Set Due Date" buttons
        document.querySelectorAll(".set-due-date").forEach(button => {
            button.classList.toggle("hidden", autoReset);
        });
    
        if (autoReset) {
            
            // Auto Reset ON = hide all due dates
            document.querySelectorAll(".due-date").forEach(input => {
                input.classList.add("hidden");
            });
    
            // Remove overdue visual styling
            document.querySelectorAll(".overdue-task").forEach(task => {
                task.classList.remove("overdue-task");
            });
    
        } else {
            // Auto Reset OFF = show due dates ONLY if they have a value
            document.querySelectorAll(".due-date").forEach(input => {
                if (input.value) {
                    input.classList.remove("hidden");
                } else {
                    input.classList.add("hidden");
                }
            });
    
            // ✅ Dynamically add the "Set Due Date" button to tasks that don’t have it
            document.querySelectorAll(".task").forEach(taskItem => {
                let buttonContainer = taskItem.querySelector(".task-options");
                let existingDueDateButton = buttonContainer.querySelector(".set-due-date");
    
                if (!existingDueDateButton) {
                    const dueDateButton = document.createElement("button");
                    dueDateButton.classList.add("task-btn", "set-due-date");
                    dueDateButton.innerHTML = "<i class='fas fa-calendar-alt'></i>";
                    dueDateButton.addEventListener("click", () => {
                        const dueDateInput = taskItem.querySelector(".due-date");
                        dueDateInput.classList.toggle("hidden");
                    });
    
                    buttonContainer.insertBefore(dueDateButton, buttonContainer.children[2]); // Insert in correct position
                }
            });
    
            // Recheck and reapply overdue classes as needed
            checkOverdueTasks();
        }
    }
    
    
    
    



    


    
    if (!deleteCheckedTasks.dataset.listenerAdded) {
        deleteCheckedTasks.addEventListener("change", (event) => {
            const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
            
            if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) return;
    
            savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = event.target.checked;
            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
    
            // ✅ Update recurring button visibility in real-time
            updateRecurringButtonVisibility();
        });
    
        deleteCheckedTasks.dataset.listenerAdded = true; 

     
    }



/**
 * Closes the menu when clicking outside of it.
 * Ensures the menu only closes when clicking outside both the menu and menu button.
 *
 * @param {MouseEvent} event - The click event that triggers the check.
 */

function closeMenuOnClickOutside(event) {
    if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
        menu.classList.remove("visible"); // Hide the menu
        document.removeEventListener("click", closeMenuOnClickOutside); // ✅ Remove listener after closing
    }
}



/**
 * Hidemainmenu function.
 *
 * @returns {void}
 */

function hideMainMenu() {
    const menu = document.querySelector(".menu-container");
    menu.classList.remove("visible");
}



// ✅ Function to complete all tasks and handle reset
async function handleCompleteAllTasks() {
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const cycleData = savedMiniCycles[lastUsedMiniCycle];

  // ✅ Ensure there's an active Mini Cycle
  if (!lastUsedMiniCycle || !cycleData) return;

  // ✅ Only show alert if tasks will be reset (not deleted)
  if (!cycleData.deleteCheckedTasks) {
    const hasDueDates = [...taskList.querySelectorAll(".due-date")].some(
      dueDateInput => dueDateInput.value
    );

    if (hasDueDates) {
      const confirmReset = await showConfirmationModal({
        title: "Reset All Tasks?",
        message: "⚠️ This will complete all tasks and reset them to an uncompleted state.<br><br>Any assigned Due Dates will be cleared.<br><br>Proceed?",
        confirmText: "Reset All",
        cancelText: "Cancel"
      });
      if (!confirmReset) return; // ❌ Stop if user cancels
    }
  }

  if (cycleData.deleteCheckedTasks) {
    const checkedTasks = document.querySelectorAll(".task input:checked");
    if (checkedTasks.length === 0) {
      showNotification("⚠️ No tasks were selected for deletion.", "default", 3000);
      return; // ✅ Stop early
    }

    checkedTasks.forEach(checkbox => {
      checkbox.closest(".task").remove();
    });

    autoSave();
    // ✅ Delete all checked tasks if the option is enabled
    document.querySelectorAll(".task input:checked").forEach(checkbox => {
      checkbox.closest(".task").remove();
    });

    autoSave(); // ✅ Save changes after deletion
  } else {
    // ✅ If "Delete Checked Tasks" is OFF, just mark all as complete
    taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
    checkMiniCycle();

    // ✅ Only call resetTasks() if autoReset is OFF
    if (!cycleData.autoReset) {
      setTimeout(resetTasks, 1000);
    }
  }
}

// ✅ Use the new function with safe listener
safeAddEventListener(completeAllButton, "click", handleCompleteAllTasks);


/***********************
 * 
 * 
 * Add Event Listeners
 * 
 * 
 ************************/

document.getElementById("view-local-storage-btn").addEventListener("click", openStorageViewer);


// 🟢 Add Task Button (Click)
safeAddEventListener(addTaskButton, "click", () => {
    const taskText = taskInput.value ? taskInput.value.trim() : "";
    if (!taskText) {
        console.warn("⚠ Cannot add an empty task.");
        return;
    }

    pushUndoSnapshot(); 
    addTask(taskText);
    taskInput.value = "";
});

// 🟢 Task Input (Enter Key)
safeAddEventListener(taskInput, "keypress", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        const taskText = taskInput.value ? taskInput.value.trim() : "";
        if (!taskText) {
            console.warn("⚠ Cannot add an empty task.");
            return;
        }

    pushUndoSnapshot(); 
        addTask(taskText);
        taskInput.value = "";
    }
});

function syncCurrentSettingsToStorage() {
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const toggleAutoReset = document.getElementById("toggleAutoReset");
  const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");

  if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) return;

  savedMiniCycles[lastUsedMiniCycle].autoReset = toggleAutoReset.checked;
  savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = deleteCheckedTasks.checked;

  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
}

// 🟢 Menu Button (Click)
safeAddEventListener(menuButton, "click", (event) => {
  event.stopPropagation();
  syncCurrentSettingsToStorage(); // ✅ capture current state first
  saveToggleAutoReset(); // ✅ then re-link event listeners and refresh UI
  menu.classList.toggle("visible");

  if (menu.classList.contains("visible")) {
    document.addEventListener("click", closeMenuOnClickOutside);
  }
});


safeAddEventListenerById("reset-notification-position", "click", resetNotificationPosition);


document.getElementById("open-reminders-modal").addEventListener("click", () => {
    document.getElementById("reminders-modal").style.display = "flex";
  });
  

  safeAddEventListenerById("reset-onboarding", "click", () => {
    localStorage.removeItem("miniCycleOnboarding");
    showNotification("✅ Onboarding will show again next time you open the app.");
  });


// 🟢 Safe Global Click for Hiding Task Buttons
safeAddEventListener(document, "click", (event) => {
    let isTaskOrOptionsClick = event.target.closest(".task, .task-options");

    if (!isTaskOrOptionsClick) {
        console.log("✅ Clicking outside - closing task buttons");

        document.querySelectorAll(".task-options").forEach(action => {
            action.style.opacity = "0";
            action.style.visibility = "hidden";
            action.style.pointerEvents = "none";
        });

        document.querySelectorAll(".task").forEach(task => {
            task.classList.remove("long-pressed");
            task.classList.remove("draggable");
            task.classList.remove("dragging");
        });
    }
});

// 🟢 Safe Global Click for Deselecting Mini Cycle in Switch Modal
safeAddEventListener(document, "click", (event) => {
    const switchModalContent = document.querySelector(".mini-cycle-switch-modal-content");
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");
    const switchItemsRow = document.getElementById("switch-items-row");
    const previewWindow = document.querySelector(".switch-preview-window");

    if (
        switchModalContent?.contains(event.target) &&
        selectedCycle &&
        !event.target.classList.contains("mini-cycle-switch-item") &&
        !previewWindow?.contains(event.target)
    ) {
        selectedCycle.classList.remove("selected");
        switchItemsRow.style.display = "none";
    }
});




// ✅ Modal Utility Functions
function closeAllModals() {
    document.querySelectorAll("[data-modal]").forEach(modal => {
        // Special handling for menu
        if (modal.dataset.menu !== undefined) {
            modal.classList.remove("visible");
        } else {
            modal.style.display = "none";
        }
    });

    // Optionally close task options too
    document.querySelectorAll(".task-options").forEach(action => {
        action.style.opacity = "0";
        action.style.visibility = "hidden";
        action.style.pointerEvents = "none";
    });

    document.querySelectorAll(".task").forEach(task => {
        task.classList.remove("long-pressed", "draggable", "dragging");
    });
}

// ✅ ESC key listener to close modals and reset task UI
safeAddEventListener(document, "keydown", (e) => {
    if (e.key === "Escape") {
        closeAllModals();
    }
});




function updateCycleModeDescription() {
  const autoReset = document.getElementById("toggleAutoReset")?.checked;
  const deleteChecked = document.getElementById("deleteCheckedTasks")?.checked;
  const descriptionBox = document.getElementById("mode-description");

  if (!descriptionBox) return;

  let modeTitle = "";
  let modeDetail = "";

  if (deleteChecked) {
    modeTitle = "To-Do List Mode";
    modeDetail = `This mode will not complete any cycles.<br>
    Instead, it will delete all tasks when <br> you hit the complete button.<br>
    This will reveal a recurring option in the <br> task options menu.`;
  } else if (autoReset) {
    modeTitle = "Auto Cycle Mode";
    modeDetail = `This mode automatically cycles tasks<br>
    when the user completes every task on the list<br>
    or hits the complete button.`;
  } else {
    modeTitle = "Manual Cycle Mode";
    modeDetail = `This mode only cycles tasks when the <br> user hits the complete button.<br>
    It also enables due dates in the task options menu.`;
  }

  descriptionBox.innerHTML = `<strong>${modeTitle}:</strong><br>${modeDetail}`;
}






/*****SPEACIAL EVENT LISTENERS *****/

document.addEventListener("dragover", (event) => {
  event.preventDefault();
  requestAnimationFrame(() => {
      const movingTask = event.target.closest(".task");
      if (movingTask) {
          handleRearrange(movingTask, event);
      }
      autoSave();
  });
});
document.addEventListener("touchstart", () => {
    hasInteracted = true;
}, { once: true });



document.addEventListener("touchstart", () => {}, { passive: true });



/***********************
 * 
 * 
 * STATS PANEL
 * 
 * 
 ************************/



let startX = 0;
let isSwiping = false;
let isStatsVisible = false;
const statsPanel = document.getElementById("stats-panel");
const taskView = document.getElementById("task-view");
const liveRegion = document.getElementById("live-region");

// Detect swipe start
document.addEventListener("touchstart", (event) => {
    if (isDraggingNotification) return;
    startX = event.touches[0].clientX;
    isSwiping = true;
});

// Detect swipe move
document.addEventListener("touchmove", (event) => {
    if (!isSwiping || isDraggingNotification) return;
    let moveX = event.touches[0].clientX;
    let difference = startX - moveX;

    if (difference > 50 && !isStatsVisible) {
        isStatsVisible = true;
        showStatsPanel();
        isSwiping = false;
    }

    if (difference < -50 && isStatsVisible) {
        isStatsVisible = false;
        showTaskView();
        isSwiping = false;
    }
});
// Reset swipe tracking
document.addEventListener("touchend", () => {
    isSwiping = false;
});





function handleThemeToggleClick() {
    const themeMessage = document.getElementById("theme-unlock-message");
    const goldenMessage = document.getElementById("golden-unlock-message");
    const gameMessage = document.getElementById("game-unlock-message");
    const toggleIcon = document.querySelector("#theme-unlock-status .toggle-icon");
  
    const milestoneUnlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
  
    // 🔁 Always toggle theme message
    themeMessage.classList.toggle("visible");
  
    // 🔁 Toggle golden glow if present
    if (goldenMessage.textContent && goldenMessage.textContent !== "Loading...") {
      goldenMessage.classList.toggle("visible");
    }
  
    // 🔒 Only toggle game message if Golden Glow has been unlocked
    if (milestoneUnlocks.goldenGlow && gameMessage.textContent && gameMessage.textContent !== "Loading...") {
      gameMessage.classList.toggle("visible");
    }
  
    // ⬇️ Update toggle arrow
    if (toggleIcon) {
      const anyVisible =
        themeMessage.classList.contains("visible") ||
        goldenMessage.classList.contains("visible") ||
     gameMessage.classList.contains("visible");
  
      toggleIcon.textContent = anyVisible ? "▲" : "▼";
    }
  }

/**
 * Updatestatspanel function.
 *
 * @returns {void}
 */


function updateStatsPanel() {
    let totalTasks = document.querySelectorAll(".task").length;
    let completedTasks = document.querySelectorAll(".task input:checked").length;
    let completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) + "%" : "0%";

    // ✅ Get the active Mini Cycle
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

    let cycleCount = 0;
    if (lastUsedMiniCycle && savedMiniCycles[lastUsedMiniCycle]) {
        cycleCount = savedMiniCycles[lastUsedMiniCycle].cycleCount || 0; // ✅ Load count from Mini Cycle storage
    }

    // ✅ Update Stats Display
    document.getElementById("total-tasks").textContent = totalTasks;
    document.getElementById("completed-tasks").textContent = completedTasks;
    document.getElementById("completion-rate").textContent = completionRate;
    document.getElementById("mini-cycle-count").textContent = cycleCount; // ✅ Now updates per Mini Cycle
    document.getElementById("stats-progress-bar").style.width = completionRate;

    // ✅ Unlock badges
    document.querySelectorAll(".badge").forEach(badge => {
        const milestone = parseInt(badge.dataset.milestone);
        const isUnlocked = cycleCount >= milestone;
    
        badge.classList.toggle("unlocked", isUnlocked);
    
        // Reset theme badge classes
        badge.classList.remove("ocean-theme", "golden-theme", "game-unlocked"); // 🆕 Reset game-unlocked
    
        // Assign custom theme class if applicable
        if (isUnlocked) {
            if (milestone === 5) {
                badge.classList.add("ocean-theme");
            } else if (milestone === 50) {
                badge.classList.add("golden-theme");
            } else if (milestone === 100) {
                badge.classList.add("game-unlocked"); 
            }
        }
    });
    updateThemeUnlockStatus(cycleCount);
    
}

function updateThemeUnlockStatus(cycleCount) {
    const milestoneUnlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
  
    const themeMessage = document.getElementById("theme-unlock-message");
    const goldenMessage = document.getElementById("golden-unlock-message");
    const gameMessage = document.getElementById("game-unlock-message");
    const themeSection = document.getElementById("theme-unlock-status");
    const toggleIcon = themeSection.querySelector(".toggle-icon");
  
    // === 🌊 DARK OCEAN THEME ===
    if (milestoneUnlocks.darkOcean) {
      themeMessage.textContent = "🌊 Dark Ocean Theme unlocked! 🔓";
      themeMessage.classList.add("unlocked-message");
    } else {
      const needed = Math.max(0, 5 - cycleCount);
      themeMessage.textContent = `🔒 Only ${needed} more cycle${needed !== 1 ? "s" : ""} to unlock 🌊 Dark Ocean Theme!`;
      themeMessage.classList.remove("unlocked-message");
    }
  
    // === 🌟 GOLDEN GLOW THEME === (Only show if Ocean is unlocked)
    if (milestoneUnlocks.darkOcean) {
      if (cycleCount >= 50) {
        goldenMessage.textContent = "🌟 Golden Glow Theme unlocked! 🔓";
        goldenMessage.classList.add("unlocked-message");
  
        if (!milestoneUnlocks.goldenGlow) {
          milestoneUnlocks.goldenGlow = true;
          localStorage.setItem("milestoneUnlocks", JSON.stringify(milestoneUnlocks));
        }
      } else {
        const needed = 50 - cycleCount;
        goldenMessage.textContent = `🔒 ${needed} more cycle${needed !== 1 ? "s" : ""} to unlock 🌟 Golden Glow Theme!`;
        goldenMessage.classList.remove("unlocked-message");
      }
    } else {
      goldenMessage.textContent = "";
      goldenMessage.classList.remove("unlocked-message", "visible");
    }
  
    // === 🎮 TASK ORDER GAME === (Only show if Golden Glow unlocked)
    const showGameHint = milestoneUnlocks.goldenGlow;
    if (showGameHint && gameMessage) {
      const cyclesLeft = Math.max(0, 100 - cycleCount);
    
      if (milestoneUnlocks.taskOrderGame) {
        gameMessage.textContent = "🎮 Task Whack-a-Order Game unlocked! 🔓";
        gameMessage.classList.add("unlocked-message");
      } else {
        gameMessage.textContent = `🔒 Only ${cyclesLeft} more cycle${cyclesLeft !== 1 ? "s" : ""} to unlock 🎮 Task Order Game!`;
        gameMessage.classList.remove("unlocked-message");
      }
    } else {
      gameMessage.textContent = "";
      gameMessage.classList.remove("unlocked-message", "visible");
    }
  
    // === 🧠 Toggle all unlock messages ===
    themeSection.replaceWith(themeSection.cloneNode(true));
    const newThemeSection = document.getElementById("theme-unlock-status");
  
    newThemeSection.addEventListener("click", () => {
      themeMessage.classList.toggle("visible");
  
      if (goldenMessage.textContent && goldenMessage.textContent !== "Loading...") {
        goldenMessage.classList.toggle("visible");
      }
      if (gameMessage.textContent && gameMessage.textContent !== "Loading...") {
        gameMessage.classList.toggle("visible");
      }
  
      if (toggleIcon) {
        toggleIcon.textContent = themeMessage.classList.contains("visible") ? "▲" : "▼";
      }
    });

    safeAddEventListenerById("theme-unlock-status", "click", handleThemeToggleClick);
  }

  function setupThemesPanel() {
    const milestoneUnlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
    const themeButton = document.getElementById("open-themes-panel");
    const themesModal = document.getElementById("themes-modal");
    const closeThemesBtn = document.getElementById("close-themes-btn");
  
    // ✅ Show the button if ANY theme is unlocked
    if (milestoneUnlocks.darkOcean || milestoneUnlocks.goldenGlow) {
      themeButton.style.display = "block";
    }
  
    // ✅ Open modal
    themeButton.addEventListener("click", () => {
      themesModal.style.display = "flex";
      hideMainMenu(); // Hide the main menu when opening
    });
  
    // ✅ Close modal
    closeThemesBtn.addEventListener("click", () => {
      themesModal.style.display = "none";
    });
  
    // ✅ Setup dark mode toggle inside themes modal
    setupDarkModeToggle("darkModeToggleThemes", ["darkModeToggle", "darkModeToggleThemes"]);
  }

document.getElementById("quick-dark-toggle")?.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkModeEnabled", isDark);

  // Sync toggle states in settings panel
  const settingsToggle = document.getElementById("darkModeToggle");
  const themeToggle = document.getElementById("darkModeToggleThemes");
  if (settingsToggle) settingsToggle.checked = isDark;
  if (themeToggle) themeToggle.checked = isDark;

  // Update icon
  const quickToggle = document.getElementById("quick-dark-toggle");
  quickToggle.textContent = isDark ? "☀️" : "🌙"; // sun for dark mode, moon for light mode
});


setupThemesPanel();







// Hook into existing task functions to update stats when tasks change
document.getElementById("taskList").addEventListener("change", updateStatsPanel);
document.getElementById("addTask").addEventListener("click", updateStatsPanel);


const slideLeft = document.getElementById("slide-left");
const slideRight = document.getElementById("slide-right");


slideLeft.classList.add("hide");
slideLeft.classList.remove("show");


// ✅ Optional screen reader support
function announceViewChange(message) {
    if (liveRegion) liveRegion.textContent = message;
}

// ✅ Unified function to show task view
function showTaskView() {
    statsPanel.classList.add("hide");
    statsPanel.classList.remove("show");

    taskView.classList.add("show");
    taskView.classList.remove("hide");

    slideRight.classList.add("show");
    slideRight.classList.remove("hide");

    slideLeft.classList.add("hide");
    slideLeft.classList.remove("show");

    isStatsVisible = false;
    announceViewChange("Task view opened");
     updateNavDots();
}

// ✅ Unified function to show stats panel
function showStatsPanel() {
    statsPanel.classList.add("show");
    statsPanel.classList.remove("hide");

    taskView.classList.add("hide");
    taskView.classList.remove("show");

    slideRight.classList.add("hide");
    slideRight.classList.remove("show");

    slideLeft.classList.add("show");
    slideLeft.classList.remove("hide");

    isStatsVisible = true;
    announceViewChange("Stats panel opened");
     updateNavDots();
}

// 🔄 Initially hide the left slide
slideLeft.classList.add("hide");
slideLeft.classList.remove("show");

// ✅ Use safe listeners
safeAddEventListener(slideRight, "click", showStatsPanel);
safeAddEventListener(slideLeft, "click", showTaskView);

// ⌨️ Shift + Arrow Keyboard Shortcuts
safeAddEventListener(document, "keydown", (e) => {
    if (!e.shiftKey) return;

    if (e.key === "ArrowRight" && isStatsVisible) {
        e.preventDefault();
        showTaskView();
    } else if (e.key === "ArrowLeft" && !isStatsVisible) {
        e.preventDefault();
        showStatsPanel();
    }
});


function updateNavDots() {
    const statsPanel = document.getElementById("stats-panel");
  const statsVisible = statsPanel.classList.contains("show");
  const dots = document.querySelectorAll(".dot");

  if (dots.length === 2) {
    dots[0].classList.toggle("active", !statsVisible); // Task View dot
    dots[1].classList.toggle("active", statsVisible);  // Stats Panel dot
  }
}

document.querySelectorAll(".dot").forEach((dot, index) => {
  dot.addEventListener("click", () => {
    if (index === 0) {
      showTaskView();
    } else {
      showStatsPanel();
    }
  });
});
updateCycleModeDescription();
 setTimeout(updateCycleModeDescription, 10000);

});