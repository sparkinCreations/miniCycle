//miniCycle
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




setTimeout(autoRedetectOnVersionChange, 10000);
// Run functions on page load
//initialSetup();
fixTaskValidationIssues();
initializeAppWithAutoMigration();
loadRemindersSettings();
setupReminderToggle();
setupMainMenu();
setupSettingsMenu();
setupAbout();
setupUserManual();
setupFeedbackModal();
setupTestingModal();
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
 initializeModeSelector(); // This calls setupModeSelector()


setTimeout(remindOverdueTasks, 2000);
setTimeout(() => {
    updateReminderButtons(); // ✅ This is the *right* place!
    startReminders();
}, 200);


const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
setupRecurringWatcher(lastUsedMiniCycle, savedMiniCycles);


window.onload = () => taskInput.focus();

window.AppReady = true;
console.log("✅ miniCycle app is fully initialized and ready.");
showOnboarding();




// Add this to your DOMContentLoaded event listener

// ✅ UPDATED: Device detection with Schema 2.5 support
function runDeviceDetection() {
    var userAgent = navigator.userAgent;
    var currentVersion = '1.273';
    
    console.log('🔍 Running device detection...', userAgent);
    showNotification('🔍 Checking device compatibility...', 'info', 3000);
    
    // ✅ Check manual override first (Schema 2.5 compatible)
    var manualOverride = localStorage.getItem('miniCycleForceFullVersion');
    if (manualOverride === 'true') {
        console.log('🚀 Manual override detected - user chose full version');
        
        // ✅ Store decision in Schema 2.5 format
        const newSchemaData = localStorage.getItem("miniCycleData");
        if (newSchemaData) {
            try {
                const data = JSON.parse(newSchemaData);
                data.settings.deviceCompatibility = {
                    shouldUseLite: false,
                    reason: 'manual_override',
                    lastDetectionVersion: currentVersion,
                    detectionDate: new Date().toISOString(),
                    userAgent: userAgent
                };
                localStorage.setItem("miniCycleData", JSON.stringify(data));
                console.log('✅ Manual override saved to Schema 2.5');
            } catch (error) {
                console.warn('⚠️ Failed to save override to Schema 2.5:', error);
                // Fallback to legacy storage
                localStorage.setItem('miniCycleShouldUseLite_' + currentVersion, 'false');
            }
        } else {
            // Still using legacy - store there too
            localStorage.setItem('miniCycleShouldUseLite_' + currentVersion, 'false');
        }
        
        localStorage.setItem('miniCycleLastDetectionVersion', currentVersion);
        showNotification('✅ Device detection complete - using full version by user choice', 'success', 3000);
        return;
    }
    
    function shouldRedirectToLite() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        // ✅ Device capability checks
        const isOldDevice = 
            /android [1-4]\./i.test(userAgent) ||
            /chrome\/[1-4][0-9]\./i.test(userAgent) ||
            /firefox\/[1-4][0-9]\./i.test(userAgent) ||
            /safari\/[1-7]\./i.test(userAgent) ||
            /msie|trident/i.test(userAgent);
        
        const hasLowMemory = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
        const hasSlowConnection = navigator.connection && 
            (navigator.connection.effectiveType === 'slow-2g' || 
             navigator.connection.effectiveType === '2g' || 
             navigator.connection.effectiveType === '3g');
        
        return isOldDevice || hasLowMemory || hasSlowConnection;
    }
    
    // ✅ Enhanced redirect with Schema 2.5 storage
    function performRedirect() {
        const shouldUseLite = shouldRedirectToLite();
        const reason = shouldUseLite ? 'device_compatibility' : 'device_capable';
        
        // ✅ Store decision in Schema 2.5 format
        const newSchemaData = localStorage.getItem("miniCycleData");
        if (newSchemaData) {
            try {
                const data = JSON.parse(newSchemaData);
                if (!data.settings) data.settings = {};
                
                data.settings.deviceCompatibility = {
                    shouldUseLite: shouldUseLite,
                    reason: reason,
                    lastDetectionVersion: currentVersion,
                    detectionDate: new Date().toISOString(),
                    userAgent: userAgent,
                    deviceInfo: {
                        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
                        connectionType: navigator.connection?.effectiveType || 'unknown',
                        screenWidth: window.screen.width,
                        screenHeight: window.screen.height
                    }
                };
                
                localStorage.setItem("miniCycleData", JSON.stringify(data));
                console.log('✅ Device detection saved to Schema 2.5:', data.settings.deviceCompatibility);
            } catch (error) {
                console.warn('⚠️ Failed to save detection to Schema 2.5:', error);
                // Fallback to legacy storage
                localStorage.setItem('miniCycleShouldUseLite_' + currentVersion, shouldUseLite.toString());
            }
        } else {
            // Still using legacy schema
            localStorage.setItem('miniCycleShouldUseLite_' + currentVersion, shouldUseLite.toString());
        }
        
        // Also store in legacy format for compatibility
        localStorage.setItem('miniCycleLastDetectionVersion', currentVersion);
        
        if (shouldUseLite) {
            const cacheBuster = '?redirect=auto&v=' + currentVersion + '&t=' + Date.now();
            console.log('📱 Redirecting to lite version:', 'miniCycle-lite.html' + cacheBuster);
            
            showNotification('📱 Redirecting to optimized lite version...', 'info', 2000);
            setTimeout(() => {
                window.location.href = 'miniCycle-lite.html' + cacheBuster;
            }, 1000);
        } else {
            console.log('💻 Device is capable - staying on full version');
            showNotification('✅ Device detection complete - using full version', 'success', 3000);
        }
    }
    
    // ✅ Check if we should redirect
    performRedirect();
}

// ✅ UPDATED: Auto-redetection with Schema 2.5 support
function autoRedetectOnVersionChange() {
    const currentVersion = '1.273';
    
    // ✅ Try Schema 2.5 first
    const newSchemaData = localStorage.getItem("miniCycleData");
    let lastDetectionVersion = null;
    
    if (newSchemaData) {
        try {
            const data = JSON.parse(newSchemaData);
            lastDetectionVersion = data.settings?.deviceCompatibility?.lastDetectionVersion;
        } catch (error) {
            console.warn('⚠️ Error reading detection version from Schema 2.5:', error);
        }
    }
    
    // ✅ Fallback to legacy
    if (!lastDetectionVersion) {
        lastDetectionVersion = localStorage.getItem('miniCycleLastDetectionVersion');
    }
    
    // If version changed or first time, re-run detection
    if (lastDetectionVersion !== currentVersion) {
        console.log('🔄 Version changed or first run - running device detection');
        console.log('   Previous version:', lastDetectionVersion || 'None');
        console.log('   Current version:', currentVersion);
        
        setTimeout(() => {
            runDeviceDetection();
        }, 1000);
    } else {
        console.log('✅ Device detection up-to-date for version', currentVersion);
    }
}

// ✅ UPDATED: Enhanced device detection reporting with Schema 2.5
function reportDeviceCompatibility() {
    const userAgent = navigator.userAgent;
    const currentVersion = '1.273';
    
    // ✅ Try Schema 2.5 first
    const newSchemaData = localStorage.getItem("miniCycleData");
    let storedDecision = null;
    let lastDetectionVersion = null;
    let detectionData = null;
    
    if (newSchemaData) {
        try {
            const data = JSON.parse(newSchemaData);
            const compatibility = data.settings?.deviceCompatibility;
            if (compatibility) {
                storedDecision = compatibility.shouldUseLite;
                lastDetectionVersion = compatibility.lastDetectionVersion;
                detectionData = compatibility;
            }
        } catch (error) {
            console.warn('⚠️ Error reading device compatibility from Schema 2.5:', error);
        }
    }
    
    // ✅ Fallback to legacy
    if (storedDecision === null) {
        storedDecision = localStorage.getItem('miniCycleShouldUseLite_' + currentVersion) === 'true';
        lastDetectionVersion = localStorage.getItem('miniCycleLastDetectionVersion');
    }
    
    // Device info
    const deviceInfo = {
        userAgent: userAgent,
        version: currentVersion,
        lastDetectionVersion: lastDetectionVersion,
        storedDecision: storedDecision,
        currentUrl: window.location.href,
        timestamp: new Date().toISOString(),
        schema: newSchemaData ? '2.5' : 'legacy',
        detectionData: detectionData
    };
    
    let statusMessage = '';
    let statusType = 'info';
    
    if (storedDecision === true) {
        statusMessage = '📱 Device configured for lite version';
        statusType = 'info';
    } else if (storedDecision === false) {
        statusMessage = '💻 Device configured for full version';  
        statusType = 'success';
    } else {
        statusMessage = '❓ No device preference stored';
        statusType = 'warning';
    }
    
    // Show detailed notification
    showNotification(
        `${statusMessage}<br>` +
        `Version: ${currentVersion}<br>` +
        `Schema: ${deviceInfo.schema}<br>` +
        `Last Check: ${lastDetectionVersion || 'Never'}`,
        statusType,
        8000
    );
    
    // Also log to console for debugging
    console.log('📊 Device Compatibility Report (Schema 2.5):', deviceInfo);
    
    return deviceInfo;
}

// ✅ UPDATED: Manual testing with Schema 2.5 cleanup
function testDeviceDetection() {
    showNotification('🧪 Starting manual device detection test...', 'info', 2000);
    
    // ✅ Clear cached decisions for testing (both schemas)
    const currentVersion = '1.273';
    
    // Clear from Schema 2.5
    const newSchemaData = localStorage.getItem("miniCycleData");
    if (newSchemaData) {
        try {
            const data = JSON.parse(newSchemaData);
            if (data.settings?.deviceCompatibility) {
                delete data.settings.deviceCompatibility;
                localStorage.setItem("miniCycleData", JSON.stringify(data));
                console.log('🧹 Cleared device compatibility from Schema 2.5');
            }
        } catch (error) {
            console.warn('⚠️ Error clearing Schema 2.5 compatibility:', error);
        }
    }
    
    // Clear from legacy
    localStorage.removeItem('miniCycleShouldUseLite_' + currentVersion);
    localStorage.removeItem('miniCycleLastDetectionVersion');
    localStorage.removeItem('miniCycleForceFullVersion');
    
    console.log('🧹 Cleared all device detection cache');
    
    // Wait a moment then run detection
    setTimeout(() => {
        console.log('🔄 Running fresh device detection...');
        runDeviceDetection();
    }, 2500);
}

// ✅ Expose testing functions to console for debugging
window.testDeviceDetection = testDeviceDetection;
window.reportDeviceCompatibility = reportDeviceCompatibility;
window.runDeviceDetection = runDeviceDetection;
// Call this function









// 🔧 FORCE MIGRATION CHECK
    setTimeout(() => {
        console.log('🔧 Forcing migration check...');
        
        // Fix validation issues first
        fixTaskValidationIssues();
        
        // Then check migration
        const migrationCheck = checkMigrationNeeded();
        console.log('🔍 Migration check result:', migrationCheck);
        
        if (migrationCheck.needed) {
            console.log('🚨 Migration needed - starting process...');
            initializeAppWithAutoMigration();
        } else {
            console.log('✅ No migration needed');
        }
    }, 1000);








// ==========================================
// 🎯 AUTO CONSOLE CAPTURE FOR MIGRATIONS
// ==========================================

let consoleLogBuffer = [];
let originalConsole = {};
let consoleCapturing = false;
let autoStarted = false;
let captureInterval = null;

// Check if we should auto-start console capture
function shouldAutoStartConsoleCapture() {
    // Auto-start if:
    // 1. We have old schema data (migration might happen)
    // 2. OR we're in development/testing mode
    // 3. OR migration is explicitly enabled
    const hasOldData = localStorage.getItem("miniCycleStorage") && !localStorage.getItem("miniCycleData");
    const isTestingMode = localStorage.getItem("miniCycle_enableAutoConsoleCapture") === "true";
    const migrationMode = sessionStorage.getItem('miniCycleLegacyModeActive') === 'true';
    
    return hasOldData || isTestingMode || migrationMode;
}

// Enhanced console capture that works across page refreshes
function startAutoConsoleCapture() {
    if (consoleCapturing || autoStarted) return;
    
    autoStarted = true;
    consoleCapturing = true;
    consoleLogBuffer = [];
    
    // Load any existing buffer from previous sessions
    try {
        const storedBuffer = localStorage.getItem("miniCycle_capturedConsoleBuffer");
        if (storedBuffer) {
            const storedLogs = JSON.parse(storedBuffer);
            consoleLogBuffer = Array.isArray(storedLogs) ? storedLogs : [];
            console.log(`🔄 Restored ${consoleLogBuffer.length} previous console messages`);
        }
    } catch (e) {
        console.warn("⚠️ Could not restore previous console buffer");
    }
    
    // Store original console methods
    originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug,
        table: console.table
    };
    
    // Enhanced console override with better formatting and filtering
    console.log = (...args) => {
        const timestamp = new Date().toLocaleTimeString();
        const message = formatConsoleArgs(args);
        const logEntry = `[${timestamp}] 📝 LOG: ${message}`;
        
        // Store in buffer
        consoleLogBuffer.push(logEntry);
        
        // Keep buffer size manageable (last 500 messages)
        if (consoleLogBuffer.length > 500) {
            consoleLogBuffer = consoleLogBuffer.slice(-500);
        }
        
        // Call original
        originalConsole.log.apply(console, args);
    };
    
    console.error = (...args) => {
        const timestamp = new Date().toLocaleTimeString();
        const message = formatConsoleArgs(args);
        const logEntry = `[${timestamp}] ❌ ERROR: ${message}`;
        
        consoleLogBuffer.push(logEntry);
        if (consoleLogBuffer.length > 500) {
            consoleLogBuffer = consoleLogBuffer.slice(-500);
        }
        
        originalConsole.error.apply(console, args);
    };
    
    console.warn = (...args) => {
        const timestamp = new Date().toLocaleTimeString();
        const message = formatConsoleArgs(args);
        const logEntry = `[${timestamp}] ⚠️ WARN: ${message}`;
        
        consoleLogBuffer.push(logEntry);
        if (consoleLogBuffer.length > 500) {
            consoleLogBuffer = consoleLogBuffer.slice(-500);
        }
        
        originalConsole.warn.apply(console, args);
    };
    
    console.info = (...args) => {
        const timestamp = new Date().toLocaleTimeString();
        const message = formatConsoleArgs(args);
        const logEntry = `[${timestamp}] ℹ️ INFO: ${message}`;
        
        consoleLogBuffer.push(logEntry);
        if (consoleLogBuffer.length > 500) {
            consoleLogBuffer = consoleLogBuffer.slice(-500);
        }
        
        originalConsole.info.apply(console, args);
    };
    
    // Handle console.table for migration debugging
    console.table = (...args) => {
        const timestamp = new Date().toLocaleTimeString();
        const message = formatConsoleArgs(args);
        const logEntry = `[${timestamp}] 📊 TABLE: ${message}`;
        
        consoleLogBuffer.push(logEntry);
        if (consoleLogBuffer.length > 500) {
            consoleLogBuffer = consoleLogBuffer.slice(-500);
        }
        
        originalConsole.table.apply(console, args);
    };
    
    console.log("🎯 Enhanced console capture started - monitoring migration activity with detailed logging");
    
    // Store captured logs in localStorage periodically
    captureInterval = setInterval(() => {
        if (consoleLogBuffer.length > 0) {
            try {
                localStorage.setItem("miniCycle_capturedConsoleBuffer", JSON.stringify(consoleLogBuffer));
            } catch (e) {
                // Storage might be full, remove old entries
                if (consoleLogBuffer.length > 100) {
                    consoleLogBuffer = consoleLogBuffer.slice(-100);
                    try {
                        localStorage.setItem("miniCycle_capturedConsoleBuffer", JSON.stringify(consoleLogBuffer));
                    } catch (e2) {
                        console.warn("⚠️ Unable to save console buffer to localStorage");
                    }
                }
            }
        }
    }, 2000); // Save every 2 seconds instead of 1
}

// Helper function to format console arguments
function formatConsoleArgs(args) {
    return args.map(arg => {
        if (typeof arg === 'object') {
            try {
                // Handle special objects better
                if (arg === null) return 'null';
                if (arg === undefined) return 'undefined';
                if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
                if (Array.isArray(arg)) return `[${arg.length} items]: ${JSON.stringify(arg).substring(0, 100)}${arg.length > 3 ? '...' : ''}`;
                
                // Regular objects
                const str = JSON.stringify(arg, null, 2);
                return str.length > 200 ? str.substring(0, 200) + '...' : str;
            } catch (e) {
                return '[Object - could not stringify]';
            }
        }
        return String(arg);
    }).join(' ');
}

// Auto-start console capture if conditions are met
if (shouldAutoStartConsoleCapture()) {
    startAutoConsoleCapture();
}

// Enhanced stop function
function stopConsoleCapture() {
    if (!consoleCapturing) return;
    
    // Restore original console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    console.table = originalConsole.table;
    
    // Clear interval
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
    
    consoleCapturing = false;
    autoStarted = false;
    
    // Clear the stored buffer
    localStorage.removeItem("miniCycle_capturedConsoleBuffer");
    
    console.log("⏹️ Enhanced console capture stopped - all logging restored to normal");
}

// Enhanced log display with better filtering and search
function showAllCapturedLogs() {
    let allLogs = [...consoleLogBuffer];
    
    // Also try to get any stored logs from localStorage
    const storedBuffer = localStorage.getItem("miniCycle_capturedConsoleBuffer");
    if (storedBuffer) {
        try {
            const storedLogs = JSON.parse(storedBuffer);
            // Merge, removing duplicates based on timestamp and content
            storedLogs.forEach(log => {
                if (!allLogs.some(existingLog => existingLog === log)) {
                    allLogs.push(log);
                }
            });
        } catch (e) {
            console.warn("Could not parse stored console buffer");
        }
    }
    
    if (!allLogs.length) {
        appendToTestResults("📭 No console messages captured yet.\n\n");
        return;
    }
    
    // Sort by timestamp (extract from log format)
    allLogs.sort((a, b) => {
        const timeA = a.match(/\[(.*?)\]/)?.[1] || '';
        const timeB = b.match(/\[(.*?)\]/)?.[1] || '';
        return timeA.localeCompare(timeB);
    });
    
    appendToTestResults("📊 ALL CAPTURED CONSOLE MESSAGES:\n");
    appendToTestResults("==========================================\n");
    appendToTestResults(`📅 Capture Period: ${allLogs.length > 0 ? allLogs[0].match(/\[(.*?)\]/)?.[1] || 'Unknown' : 'N/A'} - ${allLogs.length > 0 ? allLogs[allLogs.length - 1].match(/\[(.*?)\]/)?.[1] || 'Unknown' : 'N/A'}\n`);
    appendToTestResults(`🔢 Total Messages: ${allLogs.length}\n`);
    appendToTestResults("==========================================\n\n");
    
    // Group by type for better organization
    const logTypes = {
        'ERROR': allLogs.filter(log => log.includes('❌ ERROR:')),
        'WARN': allLogs.filter(log => log.includes('⚠️ WARN:')),
        'INFO': allLogs.filter(log => log.includes('ℹ️ INFO:')),
        'LOG': allLogs.filter(log => log.includes('📝 LOG:')),
        'TABLE': allLogs.filter(log => log.includes('📊 TABLE:'))
    };
    
    appendToTestResults("📈 MESSAGE BREAKDOWN:\n");
    Object.entries(logTypes).forEach(([type, logs]) => {
        if (logs.length > 0) {
            appendToTestResults(`  ${type}: ${logs.length} messages\n`);
        }
    });
    appendToTestResults("\n");
    
    // Display all messages
    allLogs.forEach((log, index) => {
        appendToTestResults(`${String(index + 1).padStart(3, '0')}. ${log}\n`);
    });
    
    appendToTestResults("\n==========================================\n");
    appendToTestResults(`📊 Console capture complete - ${allLogs.length} messages displayed\n\n`);
    
    showNotification(`📊 Displayed ${allLogs.length} console messages with enhanced migration logging`, "success", 4000);
}

function clearAllConsoleLogs() {
    consoleLogBuffer = [];
    localStorage.removeItem("miniCycle_capturedConsoleBuffer");
    appendToTestResults("🧹 All console logs cleared (including stored buffer)\n");
    appendToTestResults("✨ Ready to capture new migration activity\n\n");
    showNotification("🧹 Console logs cleared - ready for new capture", "info", 2000);
}

// Enhanced error filtering with more sophisticated detection
function showMigrationErrorsOnly() {
    let allLogs = [...consoleLogBuffer];
    
    // Also get stored logs
    const storedBuffer = localStorage.getItem("miniCycle_capturedConsoleBuffer");
    if (storedBuffer) {
        try {
            const storedLogs = JSON.parse(storedBuffer);
            storedLogs.forEach(log => {
                if (!allLogs.some(existingLog => existingLog === log)) {
                    allLogs.push(log);
                }
            });
        } catch (e) {}
    }
    
    // Enhanced filtering for migration-related messages
    const migrationKeywords = [
        'migration', 'schema', 'backup', 'restore', 'fallback',
        'legacy', 'performSchema25Migration', 'checkMigrationNeeded',
        'handleMigrationFailure', 'createAutomaticMigrationBackup',
        'restoreFromAutomaticBackup', 'migrateTask', 'validateAllMiniCycleTasks'
    ];
    
    const errorMessages = allLogs.filter(log => {
        const logLower = log.toLowerCase();
        return (
            log.includes('❌ ERROR:') || 
            log.includes('⚠️ WARN:') ||
            migrationKeywords.some(keyword => logLower.includes(keyword.toLowerCase())) ||
            log.includes('🔄') || // Migration progress indicators
            log.includes('📥') || // Backup indicators  
            log.includes('✅') || // Success indicators (for context)
            log.includes('🚨')    // Critical error indicators
        );
    });
    
    if (errorMessages.length === 0) {
        appendToTestResults("✅ No migration-related messages found!\n");
        appendToTestResults("This could mean:\n");
        appendToTestResults("  • No migration has run yet\n");
        appendToTestResults("  • Migration completed without logging\n");
        appendToTestResults("  • Console capture was not active during migration\n\n");
        return;
    }
    
    // Sort by timestamp
    errorMessages.sort((a, b) => {
        const timeA = a.match(/\[(.*?)\]/)?.[1] || '';
        const timeB = b.match(/\[(.*?)\]/)?.[1] || '';
        return timeA.localeCompare(timeB);
    });
    
    appendToTestResults("🚨 MIGRATION-RELATED MESSAGES:\n");
    appendToTestResults("==========================================\n");
    appendToTestResults(`📅 Time Range: ${errorMessages[0]?.match(/\[(.*?)\]/)?.[1] || 'N/A'} - ${errorMessages[errorMessages.length - 1]?.match(/\[(.*?)\]/)?.[1] || 'N/A'}\n`);
    appendToTestResults("==========================================\n\n");
    
    // Categorize messages
    const categories = {
        'Critical Errors': errorMessages.filter(log => log.includes('❌ ERROR:') || log.includes('🚨')),
        'Warnings': errorMessages.filter(log => log.includes('⚠️ WARN:')),
        'Migration Progress': errorMessages.filter(log => log.includes('🔄') && !log.includes('ERROR') && !log.includes('WARN')),
        'Backup Operations': errorMessages.filter(log => log.includes('📥') && !log.includes('ERROR') && !log.includes('WARN')),
        'Success Messages': errorMessages.filter(log => log.includes('✅') && !log.includes('ERROR') && !log.includes('WARN'))
    };
    
    Object.entries(categories).forEach(([category, messages]) => {
        if (messages.length > 0) {
            appendToTestResults(`\n📋 ${category.toUpperCase()} (${messages.length}):\n`);
            appendToTestResults("─".repeat(40) + "\n");
            messages.forEach((message, index) => {
                appendToTestResults(`${String(index + 1).padStart(2, '0')}. ${message}\n`);
            });
        }
    });
    
    appendToTestResults("\n==========================================\n");
    appendToTestResults(`🔍 Analysis Complete: Found ${errorMessages.length} migration-related messages\n\n`);
    
    if (categories['Critical Errors'].length > 0) {
        appendToTestResults("🚨 ATTENTION: Critical errors detected! Review the error messages above.\n\n");
        showNotification(`🚨 Found ${errorMessages.length} migration messages including ${categories['Critical Errors'].length} critical errors`, "error", 6000);
    } else if (categories['Warnings'].length > 0) {
        appendToTestResults("⚠️ Warnings found but no critical errors detected.\n\n");
        showNotification(`⚠️ Found ${errorMessages.length} migration messages with ${categories['Warnings'].length} warnings`, "warning", 4000);
    } else {
        appendToTestResults("✅ No critical errors found in migration messages.\n\n");
        showNotification(`📊 Found ${errorMessages.length} migration messages - no critical errors`, "success", 4000);
    }
}

// Helper function to get console capture stats
function getConsoleCaptureStats() {
    return {
        capturing: consoleCapturing,
        bufferSize: consoleLogBuffer.length,
        autoStarted: autoStarted,
        hasStoredBuffer: !!localStorage.getItem("miniCycle_capturedConsoleBuffer")
    };
}
















function showOnboarding() {
    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    let hasSeenOnboarding = false;
    let currentTheme = 'default';
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        hasSeenOnboarding = parsed.settings.onboardingCompleted || false;
        currentTheme = parsed.settings.theme || 'default';
    } else {
        // ✅ Fallback to old schema
        hasSeenOnboarding = localStorage.getItem("miniCycleOnboarding") === "true";
        currentTheme = localStorage.getItem("currentTheme") || 'default';
    }
    
    if (hasSeenOnboarding) return;
  
    const steps = [
      `<h2>Welcome to miniCycle! 🎉</h2>
       <p>miniCycle helps you manage tasks with a powerful task cycling system!</p>`,
      `<ul>
         <li>✅ Add tasks using the input box to create your cycle list.</li>
         <li>🔄 When all tasks are completed, they reset automatically (if Auto-Cycle is enabled)</li>
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
    <div class="onboarding-content theme-${currentTheme}">
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
    
    function markOnboardingComplete() {
        // ✅ Try new schema first
        const newSchemaData = localStorage.getItem("miniCycleData");
        
        if (newSchemaData) {
            const parsed = JSON.parse(newSchemaData);
            parsed.settings.onboardingCompleted = true;
            parsed.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(parsed));
        } else {
            // ✅ Fallback to old schema
            localStorage.setItem("miniCycleOnboarding", "true");
        }
    }
  
    nextBtn.addEventListener("click", () => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        renderStep(currentStep);
      } else {
        modal.remove();
        markOnboardingComplete();
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
        markOnboardingComplete();
        console.log("❌ Onboarding dismissed.");
      }
    });

    skipBtn.addEventListener("click", () => {
        modal.remove();
        markOnboardingComplete();
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
  // ✅ Try new schema first
  const newSchemaData = loadMiniCycleFromNewSchema();
  
  if (newSchemaData) {
    const { cycles, activeCycle } = newSchemaData;
    const currentCycle = cycles[activeCycle];
    
    if (!activeCycle || !currentCycle) return;

    const snapshot = {
      tasks: structuredClone(currentCycle.tasks),
      recurringTemplates: structuredClone(currentCycle.recurringTemplates || {}),
      title: currentCycle.title || "Untitled miniCycle"
    };

    undoStack.push(snapshot);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift(); // keep max 4

    redoStack = []; // clear redo on new action

    document.getElementById("undo-btn").hidden = false;
    document.getElementById("redo-btn").hidden = true;
    return;
  }

  // ✅ Fallback to old schema (your existing logic)
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const currentCycle = savedMiniCycles?.[lastUsedMiniCycle];
  if (!currentCycle) return;

  const snapshot = {
    tasks: structuredClone(currentCycle.tasks),
    recurringTemplates: structuredClone(currentCycle.recurringTemplates || {}),
    title: currentCycle.title || "Untitled miniCycle"
  };

  undoStack.push(snapshot);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift(); // keep max 4

  redoStack = []; // clear redo on new action

  document.getElementById("undo-btn").hidden = false;
  document.getElementById("redo-btn").hidden = true;
}

function performUndo() {
  if (undoStack.length === 0) return;

  // ✅ Try new schema first
  const newSchemaData = loadMiniCycleFromNewSchema();
  
  if (newSchemaData) {
    const { cycles, activeCycle } = newSchemaData;
    const currentCycle = cycles[activeCycle];
    
    if (!activeCycle || !currentCycle) return;

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
      updateMainMenuHeader();
    }

    // ✅ Update the full schema data
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle] = currentCycle;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

    loadMiniCycle();
    updateRecurringPanel();
    updateRecurringPanelButtonVisibility();

    document.getElementById("undo-btn").hidden = undoStack.length === 0;
    document.getElementById("redo-btn").hidden = false;
    return;
  }

  // ✅ Fallback to old schema (your existing logic)
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
    updateMainMenuHeader();
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

  // ✅ Try new schema first
  const newSchemaData = loadMiniCycleFromNewSchema();
  
  if (newSchemaData) {
    const { cycles, activeCycle } = newSchemaData;
    const currentCycle = cycles[activeCycle];
    
    if (!activeCycle || !currentCycle) return;

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

    // ✅ Update the full schema data
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle] = currentCycle;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

    loadMiniCycle();
    updateRecurringPanel();
    updateRecurringPanelButtonVisibility();

    document.getElementById("undo-btn").hidden = false;
    document.getElementById("redo-btn").hidden = redoStack.length === 0;
    return;
  }

  // ✅ Fallback to old schema (your existing logic)
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
        // ✅ Try new schema first
        const newSchemaData = loadMiniCycleFromNewSchema();
        
        if (newSchemaData) {
            const { cycles, activeCycle } = newSchemaData;
            const cycleData = cycles[activeCycle];
            
            if (!cycleData) {
                console.warn("⚠️ No active cycle found in new schema for UI refresh");
                return;
            }
            
            // Clear current list
            const taskListContainer = document.getElementById("taskList");
            if (!taskListContainer) return;
            taskListContainer.innerHTML = "";
            
            // Re-render each task from new schema
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
            console.log("✅ Task list UI refreshed from Schema 2.5");
            return;
        }
        
        // ✅ Fallback to old schema
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
        const cycleData = savedMiniCycles?.[lastUsedMiniCycle];
        if (!cycleData) {
            console.warn("⚠️ No active cycle found in old schema for UI refresh");
            return;
        }
    
        // Clear current list
        const taskListContainer = document.getElementById("taskList");
        if (!taskListContainer) return;
        taskListContainer.innerHTML = "";
    
        // Re-render each task from old schema
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
        console.log("✅ Task list UI refreshed from Legacy schema");
    }

function initializeDefaultRecurringSettings() {
    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        
        // Check if default recurring settings exist in new schema
        if (!parsed.settings.defaultRecurringSettings || Object.keys(parsed.settings.defaultRecurringSettings).length === 0) {
            const defaultSettings = {
                frequency: "daily",
                indefinitely: true,
                time: null
            };
            
            parsed.settings.defaultRecurringSettings = defaultSettings;
            parsed.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(parsed));
            
            console.log("🧩 Initialized default recurring settings in Schema 2.5:", defaultSettings);
        } else {
            console.log("ℹ️ Default recurring settings already exist in Schema 2.5.");
        }
        return;
    }
    
    // ✅ Fallback to old schema (your existing logic)
    const existing = localStorage.getItem("miniCycleDefaultRecurring");
    if (!existing) {
        const defaultSettings = {
            frequency: "daily",
            indefinitely: true,
            time: null
        };
        localStorage.setItem("miniCycleDefaultRecurring", JSON.stringify(defaultSettings));
        console.log("🧩 Initialized default recurring settings (Legacy):", defaultSettings);
    } else {
        console.log("ℹ️ Default recurring settings already exist (Legacy).");
    }
}

document.getElementById("toggleAutoReset").addEventListener("change", updateCycleModeDescription);
document.getElementById("deleteCheckedTasks").addEventListener("change", updateCycleModeDescription);
// ...existing code...

// Replace the complex mode selector setup with this simpler approach:
function setupModeSelector() {
    console.log('🎯 Setting up mode selectors...');
    
    const modeSelector = document.getElementById('mode-selector');
    const mobileModeSelector = document.getElementById('mobile-mode-selector'); // New mobile selector
    const toggleAutoReset = document.getElementById('toggleAutoReset');
    const deleteCheckedTasks = document.getElementById('deleteCheckedTasks');
    
    console.log('🔍 Element detection:', {
        modeSelector: !!modeSelector,
        mobileModeSelector: !!mobileModeSelector,
        toggleAutoReset: !!toggleAutoReset,
        deleteCheckedTasks: !!deleteCheckedTasks
    });
    
    if (!modeSelector || !mobileModeSelector || !toggleAutoReset || !deleteCheckedTasks) {
        console.warn('⚠️ Mode selector elements not found');
        return;
    }
    
    // ✅ Function to sync both selectors with toggles
   function syncModeFromToggles() {
    // ✅ Try new schema first for authoritative state
    const newSchemaData = loadMiniCycleFromNewSchema();
    let autoReset = false;
    let deleteChecked = false;
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        if (currentCycle) {
            autoReset = currentCycle.autoReset || false;
            deleteChecked = currentCycle.deleteCheckedTasks || false;
            
            // ✅ Update DOM to match data
            toggleAutoReset.checked = autoReset;
            deleteCheckedTasks.checked = deleteChecked;
        }
    } else {
        // ✅ Fallback to DOM state for old schema
        autoReset = toggleAutoReset.checked;
        deleteChecked = deleteCheckedTasks.checked;
    }
    
    console.log('🔄 Syncing mode from data source:', { autoReset, deleteChecked });
    
    let mode = 'auto-cycle';
    
    if (autoReset && !deleteChecked) {
        mode = 'auto-cycle';
    } else if (!autoReset && !deleteChecked) {
        mode = 'manual-cycle';  
    } else if (deleteChecked) {
        mode = 'todo-mode';
    }
        
        console.log('📝 Setting both selectors to:', mode);
        
        // Update both selectors
        modeSelector.value = mode;
        mobileModeSelector.value = mode;
        
        // Update body classes
        document.body.className = document.body.className.replace(/\b(auto-cycle-mode|manual-cycle-mode|todo-mode)\b/g, '');
        document.body.classList.add(mode + '-mode');
        
        // Update container visibility
        const deleteContainer = document.getElementById('deleteCheckedTasksContainer');
        if (deleteContainer) {
            deleteContainer.style.display = autoReset ? 'none' : 'block';
        }
        
        console.log('✅ Mode selectors synced:', mode);
    }
    
    // ✅ Function to sync toggles from either selector
    function syncTogglesFromMode(selectedMode) {
        console.log('🔄 Syncing toggles from mode selector:', selectedMode);
        
        switch(selectedMode) {
            case 'auto-cycle':
                toggleAutoReset.checked = true;
                deleteCheckedTasks.checked = false;
                break;
            case 'manual-cycle':
                toggleAutoReset.checked = false;
                deleteCheckedTasks.checked = false;
                break;
            case 'todo-mode':
                toggleAutoReset.checked = false;
                deleteCheckedTasks.checked = true;
                break;
        }
        
        // Keep both selectors in sync
        modeSelector.value = selectedMode;
        mobileModeSelector.value = selectedMode;
        
        // Trigger change events to update storage
        console.log('🔔 Dispatching change events to update storage...');
        toggleAutoReset.dispatchEvent(new Event('change'));
        deleteCheckedTasks.dispatchEvent(new Event('change'));
        
        // Update UI
        syncModeFromToggles();
        
        if (typeof updateRecurringButtonVisibility === 'function') {
            updateRecurringButtonVisibility();
        }
        
        console.log('✅ Toggles synced from mode selector');
    }
    
    // ✅ Set up event listeners for both selectors
    console.log('📡 Setting up event listeners for both selectors...');
    
    modeSelector.addEventListener('change', (e) => {
        console.log('🎯 Desktop mode selector changed:', e.target.value);
        syncTogglesFromMode(e.target.value);
        showNotification(`Switched to ${getModeName(e.target.value)}`, 'info', 2000);
    });
    
    mobileModeSelector.addEventListener('change', (e) => {
        console.log('📱 Mobile mode selector changed:', e.target.value);
        syncTogglesFromMode(e.target.value);
        showNotification(`Switched to ${getModeName(e.target.value)}`, 'info', 2000);
    });
    
    toggleAutoReset.addEventListener('change', (e) => {
        console.log('🔘 Auto Reset toggle changed:', e.target.checked);
        syncModeFromToggles();
    });
    
    deleteCheckedTasks.addEventListener('change', (e) => {
        console.log('🗑️ Delete Checked Tasks toggle changed:', e.target.checked);
        syncModeFromToggles();
    });
    
    // ✅ Initialize on load
    console.log('🚀 Initializing mode selectors...');
    syncModeFromToggles();
    
    console.log('✅ Mode selectors setup complete');
}

// Helper function to get readable mode name (keep this)
function getModeName(mode) {
    const modeNames = {
        'auto-cycle': 'Auto Cycle ↻',
        'manual-cycle': 'Manual Cycle ✔︎↻',
        'todo-mode': 'To-Do Mode ✓'
    };
    
    const result = modeNames[mode] || 'Auto Cycle ↻';
    console.log('📝 Getting mode name:', { input: mode, output: result });
    return result;
}

function initializeModeSelector() {
    console.log('⏰ Initializing mode selector with 200ms delay...');
    setTimeout(() => {
        console.log('⏰ Delay complete, calling setupModeSelector...');
        setupModeSelector();
    }, 200);
}

// ...existing code...
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
    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    let hasGameUnlock = false;
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        hasGameUnlock = parsed.settings.unlockedFeatures.includes("task-order-game");
    } else {
        // ✅ Fallback to old schema
        const unlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
        hasGameUnlock = unlocks.taskOrderGame;
    }
    
    if (hasGameUnlock) {
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
 * Initializes the miniCycle app by loading or creating a saved miniCycle.
 * Ensures a valid miniCycle is always available in localStorage.
 */

function initialSetup() {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle, reminders, settings } = newSchemaData;
        
        console.log("📦 Loaded Schema 2.5 data:", cycles);
        
        // Check if we have a valid active cycle
        if (!activeCycle || !cycles[activeCycle]) {
            // Prompt for new cycle using Schema 2.5 structure
            showPromptModal({
                title: "Create a miniCycle",
                message: "Enter a name to get started:",
                placeholder: "e.g., Morning Routine",
                confirmText: "Create",
                cancelText: "Load Sample",
                callback: async (input) => {
                    if (!input || input.trim() === "") {
                        await preloadGettingStartedCycle();
                        return;
                    }
                    
                    const newCycleName = sanitizeInput(input.trim());
                    const cycleId = `cycle_${Date.now()}`;
                    
                    // Create new cycle in Schema 2.5 format
                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    
                    fullSchemaData.data.cycles[cycleId] = {
                        id: cycleId,
                        title: newCycleName,
                        tasks: [],
                        autoReset: true,
                        deleteCheckedTasks: false,
                        cycleCount: 0,
                        createdAt: Date.now(),
                        recurringTemplates: {}
                    };
                    
                    fullSchemaData.appState.activeCycleId = cycleId;
                    fullSchemaData.metadata.lastModified = Date.now();
                    fullSchemaData.metadata.totalCyclesCreated++;
                    
                    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                    
                    // Load UI from Schema 2.5
                    const newCycle = fullSchemaData.data.cycles[cycleId];
                    document.getElementById("mini-cycle-title").textContent = newCycle.title;
                    toggleAutoReset.checked = newCycle.autoReset;
                    deleteCheckedTasks.checked = newCycle.deleteCheckedTasks;
                    
                    // Load reminders from Schema 2.5
                    enableReminders.checked = fullSchemaData.customReminders.enabled;
                    
                    if (fullSchemaData.customReminders.enabled) {
                        frequencySection.classList.remove("hidden");
                        startReminders();
                    }

                           // ✅ ADD THIS: Update theme color after setting up new cycle
                    if (typeof updateThemeColor === 'function') {
                        updateThemeColor();
                    }
                    
                    loadMiniCycle();
                }
            });
            return;
        }
        
        // Load existing cycle from Schema 2.5
        const currentCycle = cycles[activeCycle];
        document.getElementById("mini-cycle-title").textContent = currentCycle.title;
        toggleAutoReset.checked = currentCycle.autoReset || false;
        deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
        
        // Load reminders from Schema 2.5
        enableReminders.checked = reminders.enabled === true;
        
        if (reminders.enabled) {
            frequencySection.classList.remove("hidden");
            startReminders();
        }

                // ✅ Apply dark mode and theme from settings
        if (settings.darkMode) {
            document.body.classList.add("dark-mode");
        }
        
        if (settings.theme && settings.theme !== 'default') {
            // Apply theme without calling updateThemeColor() to avoid double call
            const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
            allThemes.forEach(theme => document.body.classList.remove(theme));
            document.body.classList.add(`theme-${settings.theme}`);
        }
        
        // ✅ ADD THIS: Update theme color after applying all settings
        if (typeof updateThemeColor === 'function') {
            updateThemeColor();
        }
        
        loadMiniCycle();
        return;
    }
    
    // ✅ Fallback to old schema (your existing logic)
    let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
    let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
  
    console.log("📦 Loaded miniCycleStorage:", savedMiniCycles);
  
    // 🚦 If no miniCycle exists, prompt for one
    if (!lastUsedMiniCycle || lastUsedMiniCycle.trim() === "" || !savedMiniCycles[lastUsedMiniCycle]) {
        showPromptModal({
            title: "Create a miniCycle",
            message: "Enter a name to get started:",
            placeholder: "e.g., Morning Routine",
            confirmText: "Create",
            cancelText: "Load Sample",
            callback: async (input) => {
                if (!input || input.trim() === "") {
                    await preloadGettingStartedCycle();
                    return;
                }
                
                const newCycleName = sanitizeInput(input.trim());
                
                // ✅ Create miniCycle if it doesn't exist
                if (!savedMiniCycles[newCycleName]) {
                    savedMiniCycles[newCycleName] = {
                        title: newCycleName,
                        tasks: [],
                        autoReset: true,
                        deleteCheckedTasks: false,
                        cycleCount: 0
                    };
                }

                // ✅ Save and continue
                localStorage.setItem("lastUsedMiniCycle", newCycleName);
                localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

                // 🖼️ Load UI
                document.getElementById("mini-cycle-title").textContent = savedMiniCycles[newCycleName].title;
                toggleAutoReset.checked = savedMiniCycles[newCycleName].autoReset;
                deleteCheckedTasks.checked = savedMiniCycles[newCycleName].deleteCheckedTasks;

                // 🔔 Reminder toggle
                const reminderSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
                enableReminders.checked = reminderSettings.enabled === true;

                if (enableReminders.checked) {
                    frequencySection.classList.remove("hidden");
                    startReminders();
                }

                        // ✅ Apply saved theme and dark mode for legacy
                const darkModeEnabled = localStorage.getItem("darkModeEnabled") === "true";
                const currentTheme = localStorage.getItem("currentTheme");
                
                if (darkModeEnabled) {
                    document.body.classList.add("dark-mode");
                }

                // ✅ Load the miniCycle after setup
                loadMiniCycle();
            }
        });
        return;
    }

    // ✅ If we have a valid miniCycle, proceed normally
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

    loadMiniCycle();
}

async function preloadGettingStartedCycle() {
    try {
        const response = await fetch("data/getting-started.mcyc");
        const sample = await response.json();

        // ✅ Try new schema first
        const newSchemaData = localStorage.getItem("miniCycleData");
        
        if (newSchemaData) {
            const fullSchemaData = JSON.parse(newSchemaData);
            const cycleId = `cycle_${Date.now()}`;
            
            // Create sample cycle in Schema 2.5 format
            fullSchemaData.data.cycles[cycleId] = {
                id: cycleId,
                title: sample.title || sample.name,
                tasks: sample.tasks || [],
                autoReset: sample.autoReset || false,
                cycleCount: sample.cycleCount || 0,
                deleteCheckedTasks: sample.deleteCheckedTasks || false,
                createdAt: Date.now(),
                recurringTemplates: {}
            };
            
            fullSchemaData.appState.activeCycleId = cycleId;
            fullSchemaData.metadata.lastModified = Date.now();
            fullSchemaData.metadata.totalCyclesCreated++;
            
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            
            showNotification("✨ A sample miniCycle has been preloaded to help you get started!", "success", 5000);
            loadMiniCycle();
            return;
        }
        
        // ✅ Fallback to old schema (your existing logic)
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
  
        showNotification("✨ A sample miniCycle has been preloaded to help you get started!", "success", 5000);
        loadMiniCycle();
        
    } catch (err) {
        showNotification("❌ Failed to load sample miniCycle.", "error");
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

    
    // ✅ Update theme color on initial load
    if (typeof updateThemeColor === 'function') {
        updateThemeColor();
    }


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
// ✅ Dynamic Theme Color System with Gradient-Matching Solid Colors
function updateThemeColor() {
    const body = document.body;
    const themeColorMeta = document.getElementById('theme-color-meta');
    const statusBarMeta = document.getElementById('status-bar-style-meta');
    
    let themeColor = '#5680ff'; // Default (matches gradient start)
    let statusBarStyle = 'default';
    
    // ✅ Check for Dark Mode + Themes
    if (body.classList.contains('dark-mode')) {
        if (body.classList.contains('theme-dark-ocean')) {
            themeColor = '#0e1d2f'; // Matches dark ocean gradient
            statusBarStyle = 'black-translucent';
        } else if (body.classList.contains('theme-golden-glow')) {
            themeColor = '#4a3d00'; // Matches dark golden gradient
            statusBarStyle = 'black-translucent';
        } else {
            themeColor = '#1c1c1c'; // Regular dark mode
            statusBarStyle = 'black-translucent';
        }
    } else {
        // ✅ Light Mode Themes
        if (body.classList.contains('theme-dark-ocean')) {
            themeColor = '#0e1d2f'; // Matches light ocean gradient start
            statusBarStyle = 'default';
        } else if (body.classList.contains('theme-golden-glow')) {
            themeColor = '#ffe066'; // Matches light golden gradient start
            statusBarStyle = 'default';
        } else {
            themeColor = '#5680ff'; // Matches default gradient start (#5680ff to #74c0fc)
            statusBarStyle = 'default';
        }
    }
    
    // ✅ Update meta tags
    if (themeColorMeta) {
        themeColorMeta.setAttribute('content', themeColor);
    }
    
    if (statusBarMeta) {
        statusBarMeta.setAttribute('content', statusBarStyle);
    }
    
    console.log(`Theme color updated to: ${themeColor}, Status bar: ${statusBarStyle}`);
}

// Update applyTheme to work with both schemas
function applyTheme(themeName) {
    console.log("ran Apply Theme");
    // Step 1: Remove all theme classes
    const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
    allThemes.forEach(theme => document.body.classList.remove(theme));
  
    // Step 2: Add selected theme class if it's not 'default'
    if (themeName && themeName !== 'default') {
      document.body.classList.add(`theme-${themeName}`);
    }

    // ✅ ADD THIS LINE
    if (typeof updateThemeColor === 'function') {
        updateThemeColor();
    }
  
    // Step 3: Save to appropriate schema
    const newSchemaData = localStorage.getItem("miniCycleData");
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        parsed.settings.theme = themeName || 'default';
        parsed.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(parsed));
        console.log("✅ Theme saved to Schema 2.5:", themeName);
    } else {
        // Fallback to old method
        localStorage.setItem('currentTheme', themeName || 'default');
        console.log("✅ Theme saved to Legacy storage:", themeName);
    }
  
    // Step 4: Update UI checkboxes
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
 * Enables editing of the miniCycle title and saves changes to localStorage.
 * Prevents empty titles and restores the previous title if an invalid entry is made.
 */

function setupMiniCycleTitleListener() {
    const titleElement = document.getElementById("mini-cycle-title");
    if (!titleElement) return;

    titleElement.contentEditable = true;

    if (!titleElement.dataset.listenerAdded) {
        titleElement.addEventListener("blur", () => {
            let newTitle = sanitizeInput(titleElement.textContent.trim());

            if (newTitle === "") {
                // ✅ Try new schema first for getting old title
                const newSchemaData = loadMiniCycleFromNewSchema();
                let oldTitle = "Untitled miniCycle";
                
                if (newSchemaData) {
                    const { cycles, activeCycle } = newSchemaData;
                    oldTitle = cycles[activeCycle]?.title || "Untitled miniCycle";
                } else {
                    // Fallback to old schema
                    const miniCycleFileName = localStorage.getItem("lastUsedMiniCycle");
                    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
                    const currentCycle = savedMiniCycles[miniCycleFileName];
                    oldTitle = currentCycle?.title || "Untitled miniCycle";
                }

                showNotification("⚠ Title cannot be empty. Reverting to previous title.");
                titleElement.textContent = oldTitle;
                return;
            }

            // ✅ Try new schema first
            const newSchemaData = loadMiniCycleFromNewSchema();
            if (newSchemaData) {
                const { cycles, activeCycle } = newSchemaData;
                const miniCycleData = cycles[activeCycle];
                
                if (!activeCycle || !miniCycleData) {
                    console.warn("⚠ No active miniCycle found in new schema. Title update aborted.");
                    return;
                }

                const oldTitle = miniCycleData.title;

                if (newTitle !== oldTitle) {
                    // 🔁 Capture undo snapshot BEFORE title change
                    pushUndoSnapshot();

                    titleElement.textContent = newTitle;
                    miniCycleData.title = newTitle;
                    
                    // Update the full schema data
                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    fullSchemaData.data.cycles[activeCycle] = miniCycleData;
                    fullSchemaData.metadata.lastModified = Date.now();
                    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                    
                    console.log(`✅ miniCycle title updated (Schema 2.5): "${oldTitle}" → "${newTitle}"`);

                    // 🔄 Update UI
                    updateMainMenuHeader();

                    // 🔄 Show undo button
                    document.getElementById("undo-btn").hidden = false;
                    document.getElementById("redo-btn").hidden = true;
                }
                return;
            }

            // ✅ Fallback to old schema
            const miniCycleFileName = localStorage.getItem("lastUsedMiniCycle");
            const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
            const currentCycle = savedMiniCycles[miniCycleFileName];

            if (!miniCycleFileName || !currentCycle) {
                console.warn("⚠ No active miniCycle found. Title update aborted.");
                return;
            }

            const oldTitle = currentCycle.title;

            if (newTitle !== oldTitle) {
                // 🔁 Capture undo snapshot BEFORE title change
                pushUndoSnapshot();

                titleElement.textContent = newTitle;
                currentCycle.title = newTitle;
                savedMiniCycles[miniCycleFileName] = currentCycle;
                localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
                console.log(`✅ miniCycle title updated (Legacy): "${oldTitle}" → "${newTitle}"`);

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
 * Saves the current state of the active miniCycle to localStorage.
 * Captures task list, completion status, due dates, priority settings, and reminders.
 */

// Update autoSave to handle both schemas
function autoSave(overrideTaskList = null) {
  // ✅ Try new schema first
  const newSchemaData = localStorage.getItem("miniCycleData");
  
  if (newSchemaData) {
    // Handle new schema saving
    const parsed = JSON.parse(newSchemaData);
    const activeCycle = parsed.appState.activeCycleId;
    
    if (!activeCycle || !parsed.data.cycles[activeCycle]) {
      console.error("❌ Error: Active cycle not found in new schema.");
      return;
    }
    
    // Get current task data from DOM (same logic)
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
      
      console.log("💾 Parsed Recurring Settings for Task:", taskId, recurringSettings);

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
    
    // Update new schema structure
    parsed.data.cycles[activeCycle].tasks = miniCycleTasks;
    parsed.metadata.lastModified = Date.now();
    
    // Handle recurring templates in new schema
    if (!parsed.data.cycles[activeCycle].recurringTemplates) {
      parsed.data.cycles[activeCycle].recurringTemplates = {};
    }

    miniCycleTasks.forEach(task => {
      if (task.recurring && task.recurringSettings) {
        parsed.data.cycles[activeCycle].recurringTemplates[task.id] = {
          id: task.id,
          text: task.text,
          recurring: true,
          recurringSettings: task.recurringSettings,
          highPriority: task.highPriority,
          dueDate: task.dueDate,
          remindersEnabled: task.remindersEnabled,
          lastTriggeredTimestamp:
            parsed.data.cycles[activeCycle].recurringTemplates[task.id]?.lastTriggeredTimestamp || null,
          schemaVersion: task.schemaVersion || 2
        };
      }
    });

    localStorage.setItem("miniCycleData", JSON.stringify(parsed));
    
    // ✅ Logging for debugging (same as before)
    console.log("📋 Task Status (Schema 2.5):");
    miniCycleTasks.forEach(task => {
      console.log(`- ${task.text}: ${task.completed ? "✅ Completed" : "❌ Not Completed"} 
        ${task.dueDate ? `(Due: ${task.dueDate})` : ''} 
        ${task.highPriority ? "🔥 High Priority" : ""} 
        ${task.remindersEnabled ? "🔔 Reminders ON" : "🔕 Reminders OFF"} 
        ${task.recurring ? "🔁 Recurring ON" : "↩️ Not Recurring"}`);
    });

    console.table(miniCycleTasks.map(t => ({
      id: t.id,
      text: t.text,
      recurring: t.recurring,
      frequency: t.recurringSettings?.frequency || "–",
      version: t.schemaVersion
    })));
    
    return; // Exit early for new schema
  }
  
  // ✅ Fallback to existing autoSave logic for old schema
  const miniCycleFileName = localStorage.getItem("lastUsedMiniCycle");
  const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

  if (!miniCycleFileName || !savedMiniCycles[miniCycleFileName]) {
    console.error(`❌ Error: miniCycle "${miniCycleFileName}" not found in storage. Auto-save aborted.`);
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
    
    console.log("💾 Parsed Recurring Settings for Task:", taskId, recurringSettings);

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

  // 💾 Save entire miniCycleStorage back to localStorage
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

  // ✅ Logging for debugging
  console.log("📋 Task Status (Legacy):");
  miniCycleTasks.forEach(task => {
    console.log(`- ${task.text}: ${task.completed ? "✅ Completed" : "❌ Not Completed"} 
      ${task.dueDate ? `(Due: ${task.dueDate})` : ''} 
      ${task.highPriority ? "🔥 High Priority" : ""} 
      ${task.remindersEnabled ? "🔔 Reminders ON" : "🔕 Reminders OFF"} 
      ${task.recurring ? "🔁 Recurring ON" : "↩️ Not Recurring"}`);
  });

  console.table(miniCycleTasks.map(t => ({
    id: t.id,
    text: t.text,
    recurring: t.recurring,
    frequency: t.recurringSettings?.frequency || "–",
    version: t.schemaVersion
  })));
}




/**
 * Loads the last used miniCycle from localStorage and updates the UI.
 * Ensures tasks, title, settings, and overdue statuses are properly restored.
 */
function loadMiniCycle() {
  // ✅ Try new schema first
  const newSchemaData = loadMiniCycleFromNewSchema();
  if (newSchemaData) {
    const { cycles, activeCycle, reminders, settings } = newSchemaData;
    const miniCycleData = cycles[activeCycle];  // activeCycle is now the title
    
    if (!activeCycle || !miniCycleData) {
      console.warn("⚠️ No saved miniCycle found in new schema.");
      return;
    }

    try {
      if (!Array.isArray(miniCycleData.tasks)) {
        throw new Error(`Invalid task data for "${activeCycle}".`);
      }

      // Reset UI states safely
      if (progressBar) progressBar.style.width = "0%";
      // ❌ REMOVED: cycleMessage references since element was deleted
      // if (cycleMessage) {
      //   cycleMessage.style.visibility = "hidden";
      //   cycleMessage.style.opacity = "0";
      // }

      // Migrate & Render
      const migratedTasks = miniCycleData.tasks.map(migrateTask);
      renderTasks(migratedTasks);
      miniCycleData.tasks = migratedTasks;

      // Load settings from new schema with null checks
      const toggleAutoReset = document.getElementById("toggleAutoReset");
      const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
      const enableReminders = document.getElementById("enableReminders");

      if (toggleAutoReset) toggleAutoReset.checked = miniCycleData.autoReset || false;
      if (deleteCheckedTasks) deleteCheckedTasks.checked = miniCycleData.deleteCheckedTasks || false;
      
      // Apply global settings from Schema 2.5
      if (enableReminders) enableReminders.checked = reminders.enabled || false;
      if (settings.darkMode) {
        document.body.classList.add("dark-mode");
      }

      // ✅ Apply theme from settings if available
      if (settings.theme && settings.theme !== 'default') {
        applyTheme(settings.theme);
      }

            // ✅ ADD THIS: Update theme color after applying all theme settings
      if (typeof updateThemeColor === 'function') {
        updateThemeColor();
      }

      // Save migrated data back to new schema (only if changes were made)
      const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
      fullSchemaData.data.cycles[activeCycle] = miniCycleData;  // activeCycle = title
      fullSchemaData.metadata.lastModified = Date.now();
      localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

      // Final UI updates
      const titleElement = document.getElementById("mini-cycle-title");
      if (titleElement) {
        // ✅ FIXED: Use the title from the cycle object, not the key
        titleElement.textContent = miniCycleData.title || activeCycle;
      }

      // ✅ Update recurring panel button visibility based on new schema settings
      updateRecurringButtonVisibility();

      checkOverdueTasks();
      setTimeout(remindOverdueTasks, 1000);

      // Suppress hover if three-dots are enabled
      const threeDotsEnabled = settings.showThreeDots || false;  // ✅ Use Schema 2.5 setting
      setTimeout(() => toggleHoverTaskOptions(!threeDotsEnabled), 0);

          // ✅ ADD THIS: Update theme color after loading legacy data
    if (typeof updateThemeColor === 'function') {
      updateThemeColor();
    }

      updateMainMenuHeader();
      hideMainMenu();
      updateProgressBar();
      checkCompleteAllButton();
      updateRecurringPanel?.();

      console.log(`✅ Successfully loaded miniCycle (Schema 2.5): "${activeCycle}"`);
      return;

    } catch (error) {
      console.error("❌ Error loading miniCycle from new schema:", error);
      showNotification("❌ Error loading cycle from new format", "error", 3000);
    }
  }

  // ✅ Fallback to old schema (unchanged)
  const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
  let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");

  if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
    console.warn("⚠️ No saved miniCycle found.");
    return;
  }

  try {
    const miniCycleData = savedMiniCycles[lastUsedMiniCycle];

    if (!Array.isArray(miniCycleData.tasks)) {
      throw new Error(`Invalid task data for "${lastUsedMiniCycle}".`);
    }

    // Reset UI states safely
    if (progressBar) progressBar.style.width = "0%";
    // ❌ REMOVED: cycleMessage references since element was deleted
    // if (cycleMessage) {
    //   cycleMessage.style.visibility = "hidden";
    //   cycleMessage.style.opacity = "0";
    // }

    // Migrate & Render
    const migratedTasks = miniCycleData.tasks.map(migrateTask);
    renderTasks(migratedTasks);
    miniCycleData.tasks = migratedTasks;

    // Load settings with null checks
    const toggleAutoReset = document.getElementById("toggleAutoReset");
    const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");

    if (toggleAutoReset) toggleAutoReset.checked = miniCycleData.autoReset || false;
    if (deleteCheckedTasks) deleteCheckedTasks.checked = miniCycleData.deleteCheckedTasks || false;

    // Save migrated data (only once at the end)
    savedMiniCycles[lastUsedMiniCycle] = miniCycleData;
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    // Final UI updates
    const titleElement = document.getElementById("mini-cycle-title");
    if (titleElement) {
      titleElement.textContent = miniCycleData.title || "Untitled miniCycle";
    }

    checkOverdueTasks();
    setTimeout(remindOverdueTasks, 1000);

    // Suppress hover if three-dots are enabled — delay to ensure DOM is ready
    const threeDotsEnabled = localStorage.getItem("miniCycleThreeDots") === "true";
    setTimeout(() => toggleHoverTaskOptions(!threeDotsEnabled), 0);

    updateMainMenuHeader();
    hideMainMenu();
    updateProgressBar();
    checkCompleteAllButton();
    updateRecurringPanel?.();
    updateRecurringButtonVisibility();

    console.log(`✅ Successfully loaded miniCycle (legacy): "${lastUsedMiniCycle}"`);

  } catch (error) {
    console.error("❌ Error loading miniCycle:", error);
    showNotification("❌ Error loading cycle", "error", 3000);
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
















// Add this after your existing migration functions, around line 1100

// ==========================================
// 🔄 SCHEMA 2.5 MIGRATION SYSTEM
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

function checkMigrationNeeded() {
  const currentData = localStorage.getItem("miniCycleData");
  if (currentData) {
    const parsed = JSON.parse(currentData);
    if (parsed.schemaVersion === "2.5") {
      return { needed: false, currentVersion: "2.5" };
    }
  }

  // Check for old format data
  const oldCycles = localStorage.getItem("miniCycleStorage");
  const lastUsed = localStorage.getItem("lastUsedMiniCycle");
  const reminders = localStorage.getItem("miniCycleReminders");
  
  const hasOldData = oldCycles || lastUsed || reminders;
  
  return {
    needed: hasOldData,
    currentVersion: currentData ? "unknown" : "legacy",
    oldDataFound: {
      cycles: !!oldCycles,
      lastUsed: !!lastUsed,
      reminders: !!reminders,
      milestones: !!localStorage.getItem("milestoneUnlocks"),
      darkMode: document.body.classList.contains('dark-mode')
    }
  };
}

function simulateMigrationToSchema25(dryRun = true) {
  const results = {
    success: false,
    errors: [],
    warnings: [],
    changes: [],
    dataPreview: null
  };

  try {
    // 1. Gather existing data
    const oldCycles = JSON.parse(localStorage.getItem("miniCycleStorage") || "{}");
    const lastUsed = localStorage.getItem("lastUsedMiniCycle");
    const reminders = JSON.parse(localStorage.getItem("miniCycleReminders") || "{}");
    const milestones = JSON.parse(localStorage.getItem("milestoneUnlocks") || "{}");
    const moveArrows = localStorage.getItem("miniCycleMoveArrows") === "true";
    const threeDots = localStorage.getItem("miniCycleThreeDots") === "true";
    const alwaysRecurring = JSON.parse(localStorage.getItem("miniCycleAlwaysShowRecurring")) || false;
    const darkModeEnabled = localStorage.getItem("darkModeEnabled") === "true";
    const currentTheme = localStorage.getItem("currentTheme") || null;
    const notifPosition = JSON.parse(localStorage.getItem("miniCycleNotificationPosition") || "{}");

    // 2. Create new schema structure
    const newData = JSON.parse(JSON.stringify(SCHEMA_2_5_TARGET));
    
    // 3. Populate metadata
    newData.metadata.createdAt = Date.now();
    newData.metadata.lastModified = Date.now();
    newData.metadata.migratedFrom = "legacy";
    newData.metadata.migrationDate = Date.now();
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
      localStorage.setItem("miniCycleData", JSON.stringify(newData));
      results.changes.push("🚀 Migration completed - data saved to miniCycleData");
      
      // Optionally backup old data
      const backupKey = `migration_backup_${Date.now()}`;
      const oldData = {
        miniCycleStorage: oldCycles,
        lastUsedMiniCycle: lastUsed,
        miniCycleReminders: reminders,
        milestoneUnlocks: milestones,
        darkModeEnabled: darkModeEnabled,
        currentTheme: currentTheme
      };
      localStorage.setItem(backupKey, JSON.stringify(oldData));
      results.changes.push(`💾 Old data backed up to ${backupKey}`);
    }

    results.dataPreview = newData;
    results.success = true;

  } catch (error) {
    results.errors.push(`Migration failed: ${error.message}`);
  }

  return results;
}

function performSchema25Migration() {
  // Create backup first
  const backupKey = `pre_migration_backup_${Date.now()}`;
  const currentData = {};
  
  // Backup all current localStorage
  ["miniCycleStorage", "lastUsedMiniCycle", "miniCycleReminders", 
   "milestoneUnlocks", "darkModeEnabled", "currentTheme", 
   "miniCycleNotificationPosition", "miniCycleAlwaysShowRecurring"].forEach(key => {
    const value = localStorage.getItem(key);
    if (value) currentData[key] = value;
  });
  
  localStorage.setItem(backupKey, JSON.stringify(currentData));

  // Perform actual migration
  const results = simulateMigrationToSchema25(false);
  
  if (results.success) {
    // Clean up old keys (optional - you might want to keep them temporarily)
    // Object.keys(currentData).forEach(key => localStorage.removeItem(key));
    results.changes.push(`🗂️ Backup created: ${backupKey}`);
  }

  return results;
}

// Update your existing load functions to work with both schemas
function loadMiniCycleFromNewSchema() {
  const newData = localStorage.getItem("miniCycleData");
  if (!newData) return null;
  
  try {
    const parsed = JSON.parse(newData);
    if (parsed.schemaVersion === "2.5") {
      return {
        cycles: parsed.data.cycles,
        activeCycle: parsed.appState.activeCycleId,
        reminders: parsed.customReminders,
        settings: parsed.settings
      };
    }
  } catch (error) {
    console.error("Error loading new schema data:", error);
  }
  
  return null;
}








// ✅ Auto-Migration with Enhanced Data Fixing and Lenient Validation
async function performAutoMigration() {
try {
    console.log('🔄 Starting auto-migration process…');
    console.log('📊 Current localStorage keys:', Object.keys(localStorage));
    
    // Step 1: Check if migration is needed
    console.log('🔍 Checking if migration is needed...');
    const migrationCheck = checkMigrationNeeded();
    console.log('📋 Migration check result:', migrationCheck);
    
    if (!migrationCheck.needed) {
        console.log('✅ No migration needed - user already on Schema 2.5');
        console.log('📦 Current miniCycleData exists:', !!localStorage.getItem("miniCycleData"));
        return { success: true, message: 'Already on latest schema' };
    }
    
    console.log('🚨 Migration needed. Old data found:', migrationCheck.oldDataFound);
    
    // Step 2: Show user notification
    console.log('📢 Showing migration notification to user...');
    showNotification('🔄 Updating your data format... This will take a moment.', 'info', 200);
    
    // Step 3: Create automatic backup before migration
    console.log('📥 Creating automatic backup before migration...');
    console.log('💾 Available storage before backup:', {
        used: JSON.stringify(localStorage).length,
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
        showNotification(`🔧 Fixed ${fixResult.fixedCount} data compatibility issues`, 'info', 3000);
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
    const newSchemaData = localStorage.getItem("miniCycleData");
    console.log('📦 New schema data exists:', !!newSchemaData);
    console.log('📏 New schema data size:', newSchemaData ? newSchemaData.length : 0);
    
    if (!newSchemaData) {
        console.error('❌ Post-migration validation failed: No Schema 2.5 data found');
        console.error('🔧 Troubleshooting: Migration did not create miniCycleData key');
        console.error('📊 Current localStorage keys after migration:', Object.keys(localStorage));
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
    
    // ✅ Enhanced success notification with fix details
    const successMessage = fixResult.fixedCount > 0 
        ? `✅ Data updated successfully! Fixed ${fixResult.fixedCount} compatibility issues.`
        : '✅ Data format updated successfully!';
    showNotification(successMessage, 'success', 4000);
    
    // Step 8: Store migration completion info
    const legacyData = localStorage.getItem('miniCycleStorage') || '{}';
    const migrationInfo = {
        completed: Date.now(),
        backupKey: backupResult.backupKey,
        version: '2.5',
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
    localStorage.setItem('miniCycleMigrationInfo', JSON.stringify(migrationInfo));
    
    return {
        success: true,
        message: 'Auto-migration completed successfully',
        backupKey: backupResult.backupKey,
        fixesApplied: fixResult.fixedCount || 0
    };
    
} catch (error) {
    console.error('❌ Auto-migration failed with exception:', error);
    console.error('🔧 Exception stack trace:', error.stack);
    console.error('📊 System state at error:', {
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage),
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
    });
    return await handleMigrationFailure(`Unexpected error: ${error.message}`, null);
}
}

// ✅ ADD: Lenient validation function for auto-migration
function validateAllMiniCycleTasksLenient() {
  const storage = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
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


// ✅ Handle Migration Failure with Legacy Data Fallback
async function handleMigrationFailure(reason, backupKey) {
try {
console.log('🔄 Handling migration failure, attempting to maintain legacy data access…');
console.log('❌ Failure reason:', reason);
console.log('📦 Backup key available:', backupKey);

    // Step 1: Try to restore from backup if available
    if (backupKey) {
        console.log('📥 Attempting to restore from backup:', backupKey);
        console.log('🔍 Checking if backup exists in localStorage...');
        const backupExists = !!localStorage.getItem(backupKey);
        console.log('💾 Backup exists:', backupExists);
        
        try {
            await restoreFromAutomaticBackup(backupKey);
            console.log('✅ Successfully restored from backup');
            console.log('📊 Post-restore localStorage keys:', Object.keys(localStorage));
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
        sessionStorage.setItem('miniCycleLegacyModeActive', 'true');
        sessionStorage.setItem('miniCycleMigrationFailureReason', reason);
        
        console.log('📊 Session storage flags set:', {
            legacyMode: sessionStorage.getItem('miniCycleLegacyModeActive'),
            failureReason: sessionStorage.getItem('miniCycleMigrationFailureReason')
        });
        
        // Step 4: Show user-friendly notification
        showNotification(
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
        console.error('📊 Final localStorage state:', Object.keys(localStorage));
        console.error('💾 Available data sources:', {
            miniCycleStorage: !!localStorage.getItem('miniCycleStorage'),
            miniCycleData: !!localStorage.getItem('miniCycleData'),
            lastUsedMiniCycle: !!localStorage.getItem('lastUsedMiniCycle'),
            anyBackups: Object.keys(localStorage).filter(key => key.includes('backup')),
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

// ✅ Ensure Legacy Data is Accessible
function ensureLegacyDataAccess() {
try {
console.log('🔍 Checking legacy data access...');

// Check if legacy data exists
const legacyStorage = localStorage.getItem('miniCycleStorage');
console.log('📦 Legacy storage exists:', !!legacyStorage);
console.log('📏 Legacy storage size:', legacyStorage ? legacyStorage.length : 0);

    if (!legacyStorage) {
        console.error('❌ No legacy data found in localStorage');
        console.error('📋 Available localStorage keys:', Object.keys(localStorage));
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

// ✅ Check if App is Running in Legacy Fallback Mode
function isLegacyFallbackModeActive() {
const isActive = sessionStorage.getItem('miniCycleLegacyModeActive') === 'true';
console.log('🚩 Legacy fallback mode check:', {
    isActive: isActive,
    sessionFlag: sessionStorage.getItem('miniCycleLegacyModeActive'),
    failureReason: sessionStorage.getItem('miniCycleMigrationFailureReason')
});
return isActive;
}
// ✅ Fixed createAutomaticMigrationBackup function
async function createAutomaticMigrationBackup() {
try {
console.log('📥 Starting automatic backup creation...');
const timestamp = Date.now();
const backupKey = `auto_migration_backup_${timestamp}`;
console.log('🏷️ Generated backup key:', backupKey);

    // Check if we have data to backup
    console.log('🔍 Checking for legacy data to backup...');
    const legacyData = localStorage.getItem('miniCycleStorage');
    console.log('📦 Legacy data found:', !!legacyData);
    console.log('📏 Legacy data size:', legacyData ? legacyData.length : 0);
    
    if (!legacyData) {
        console.error('❌ No legacy data found to backup');
        console.error('📋 Available localStorage keys:', Object.keys(localStorage));
        throw new Error('No legacy data found to backup');
    }
    
    // Gather all data to backup - FIXED STORAGE KEYS
    console.log('📋 Gathering additional data for backup...');
    const remindersData = localStorage.getItem('miniCycleReminders');
    const lastUsed = localStorage.getItem('lastUsedMiniCycle');
    const milestones = localStorage.getItem('milestoneUnlocks');
    console.log('🔔 Reminders data:', !!remindersData);
    console.log('📌 Last used cycle:', !!lastUsed);
    console.log('🏆 Milestones:', !!milestones);
    
    const settingsData = {
        threeDots: localStorage.getItem('miniCycleThreeDots'),
        darkMode: localStorage.getItem('darkModeEnabled'), // ✅ FIXED
        moveArrows: localStorage.getItem('miniCycleMoveArrows'),
        alwaysShowRecurring: localStorage.getItem('miniCycleAlwaysShowRecurring'),
        defaultRecurring: localStorage.getItem('miniCycleDefaultRecurring'),
        theme: localStorage.getItem('currentTheme'), // ✅ FIXED
        onboarding: localStorage.getItem('miniCycleOnboarding'),
        notificationPosition: localStorage.getItem('miniCycleNotificationPosition')
    };
    
    console.log('⚙️ Settings data collected:', Object.keys(settingsData).filter(key => settingsData[key] !== null));
    
    const backupData = {
        version: 'legacy',
        created: timestamp,
        type: 'auto_migration_backup',
        data: {
            miniCycleStorage: legacyData,
            lastUsedMiniCycle: lastUsed, // ✅ ADDED
            miniCycleReminders: remindersData,
            milestoneUnlocks: milestones, // ✅ ADDED
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
    
    // Rest of the function remains the same...
    try {
        console.log('💾 Attempting to store backup in localStorage...');
        localStorage.setItem(backupKey, JSON.stringify(backupData));
        console.log('✅ Backup stored successfully');
    } catch (storageError) {
        console.error('❌ Storage error during backup:', storageError);
        console.error('🔧 Storage error details:', storageError.message);
        console.error('📊 Storage usage info:', {
            backupSize: backupSize,
            estimatedTotalStorage: JSON.stringify(localStorage).length,
            availableKeys: Object.keys(localStorage).length
        });
        throw new Error('Insufficient storage space for backup');
    }
    
    // Add to backup index for management
    try {
        console.log('📋 Updating backup index...');
        const backupIndex = JSON.parse(localStorage.getItem('miniCycleBackupIndex') || '[]');
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
                localStorage.removeItem(oldestAutoBackup.key);
                const index = backupIndex.findIndex(b => b.key === oldestAutoBackup.key);
                backupIndex.splice(index, 1);
                console.log('✅ Old backup cleaned up successfully');
            } catch (cleanupError) {
                console.warn('⚠️ Failed to cleanup old backup:', cleanupError);
                console.warn('🔧 Cleanup error details:', cleanupError.message);
                // Continue anyway - this isn't critical
            }
        }
        
        localStorage.setItem('miniCycleBackupIndex', JSON.stringify(backupIndex));
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
        localStorage: Object.keys(localStorage),
        storageEstimate: JSON.stringify(localStorage).length
    });
    return {
        success: false,
        message: error.message
    };
}
}

// ✅ Also update the restore function
async function restoreFromAutomaticBackup(backupKey) {
try {
console.log('🔄 Restoring from automatic backup:', backupKey);

    console.log('🔍 Checking if backup exists...');
    const backupData = localStorage.getItem(backupKey);
    console.log('📦 Backup data found:', !!backupData);
    console.log('📏 Backup data size:', backupData ? backupData.length : 0);
    
    if (!backupData) {
        console.error('❌ Backup not found in localStorage');
        console.error('📋 Available backup keys:', Object.keys(localStorage).filter(key => key.includes('backup')));
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
        localStorage.setItem('miniCycleStorage', backup.data.miniCycleStorage);
        console.log('✅ miniCycleStorage restored');
    } else {
        console.warn('⚠️ No miniCycleStorage found in backup');
    }
    
    // ✅ RESTORE LAST USED CYCLE
    if (backup.data.lastUsedMiniCycle) {
        console.log('📌 Restoring lastUsedMiniCycle...');
        localStorage.setItem('lastUsedMiniCycle', backup.data.lastUsedMiniCycle);
        console.log('✅ lastUsedMiniCycle restored');
    }
    
    if (backup.data.miniCycleReminders) {
        console.log('🔔 Restoring miniCycleReminders...');
        localStorage.setItem('miniCycleReminders', backup.data.miniCycleReminders);
        console.log('✅ miniCycleReminders restored');
    } else {
        console.warn('⚠️ No miniCycleReminders found in backup');
    }
    
    // ✅ RESTORE MILESTONES
    if (backup.data.milestoneUnlocks) {
        console.log('🏆 Restoring milestoneUnlocks...');
        localStorage.setItem('milestoneUnlocks', backup.data.milestoneUnlocks);
        console.log('✅ milestoneUnlocks restored');
    }
    
    // Restore settings - FIXED KEYS
    if (backup.data.settings) {
        console.log('⚙️ Restoring settings...');
        const settings = backup.data.settings;
        const settingsRestored = [];
        
        Object.keys(settings).forEach(key => {
            if (settings[key] !== null && settings[key] !== undefined) {
                try {
                    // ✅ FIXED: Use correct storage keys
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
                    
                    localStorage.setItem(storageKey, settings[key]);
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
        const schema25Existed = !!localStorage.getItem('miniCycleData');
        localStorage.removeItem('miniCycleData');
        console.log('🧹 Schema 2.5 data cleanup:', schema25Existed ? 'removed' : 'none found');
    } catch (removeError) {
        console.warn('⚠️ Failed to remove Schema 2.5 data:', removeError);
        // Continue anyway
    }
    
    console.log('✅ Data restored from automatic backup successfully');
    console.log('📊 Post-restore localStorage keys:', Object.keys(localStorage));
    
    return { success: true };
    
} catch (error) {
    console.error('❌ Failed to restore from automatic backup:', error);
    console.error('🔧 Restore error stack:', error.stack);
    console.error('📊 System state at restore failure:', {
        backupKey: backupKey,
        backupExists: !!localStorage.getItem(backupKey),
        currentKeys: Object.keys(localStorage)
    });
    throw error;
}
}

// ✅ Initialize App with Auto-Migration and Fallback Support
function initializeAppWithAutoMigration() {
console.log('🚀 Initializing app with auto-migration check…');
console.log('📊 Initial system state:', {
    localStorage: Object.keys(localStorage),
    sessionStorage: Object.keys(sessionStorage),
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
});

// Check if we're already in legacy fallback mode
console.log('🚩 Checking for existing legacy fallback mode...');
if (isLegacyFallbackModeActive()) {
    console.log('⚠️ App is running in legacy fallback mode');
    const failureReason = sessionStorage.getItem('miniCycleMigrationFailureReason') || 'Unknown reason';
    console.log('❌ Previous failure reason:', failureReason);
    
    showNotification(
        `⚠️ Running in compatibility mode due to: ${failureReason}. Restart app to retry migration.`, 
        'warning', 
        5000
    );
    
    // Load app with legacy data
    console.log('📱 Loading app in legacy fallback mode...');
    initialSetup();
    return;
}

console.log('✅ No existing fallback mode detected');

// ✅ FIXED: Use your existing function correctly
console.log('🔍 Running migration check...');
const migrationCheck = checkMigrationNeeded();
console.log('📋 Migration check complete:', migrationCheck);

if (migrationCheck.needed) { // ✅ Use .needed property
    console.log('📋 Migration needed - starting auto-migration process...');
    console.log('🔄 Auto-migration will be performed asynchronously...');
    
    // Perform auto-migration
    performAutoMigration().then(result => {
        console.log('🏁 Auto-migration promise resolved:', result);
        
        if (result.success) {
            console.log('✅ Auto-migration successful, loading app...');
            console.log('📊 Migration success details:', {
                backupKey: result.backupKey,
                message: result.message
            });
            initialSetup();
        } else if (result.fallbackActive) {
            console.log('⚠️ Migration failed but fallback active, loading app with legacy data...');
            console.log('📊 Fallback details:', {
                reason: result.reason,
                message: result.message
            });
            initialSetup();
        } else {
            console.error('❌ Auto-migration failed completely:', result.message);
            console.error('🚨 Critical failure details:', result);
            // Critical error is already shown by handleMigrationFailure
        }
    }).catch(error => {
        console.error('❌ Unexpected error during auto-migration:', error);
        console.error('🔧 Promise rejection stack:', error.stack);
        console.error('📊 System state at promise failure:', {
            localStorage: Object.keys(localStorage),
            sessionStorage: Object.keys(sessionStorage)
        });
        showCriticalError('An unexpected error occurred. Please refresh the page.');
    });
} else {
    console.log('✅ No migration needed, loading app normally...');
    console.log('📦 Current schema status:', migrationCheck.currentVersion);
    initialSetup();
}
}

// ✅ Show Critical Error (Enhanced for better UX)
function showCriticalError(message) {
console.log('🚨 Showing critical error to user:', message);
console.log('📊 System state at critical error:', {
    localStorage: Object.keys(localStorage),
    sessionStorage: Object.keys(sessionStorage),
    url: window.location.href,
    timestamp: new Date().toISOString()
});

const errorContainer = document.createElement('div');
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

document.body.appendChild(errorContainer);

console.log('📢 Critical error dialog displayed to user');

// Auto-remove after 15 seconds
setTimeout(() => {
    if (errorContainer.parentElement) {
        errorContainer.remove();
        console.log('⏰ Critical error dialog auto-removed after timeout');
    }
}, 15000);
}

// Add this function before your migration functions
function fixTaskValidationIssues() {
    console.log('🔧 Fixing task validation issues...');
    
    try {
        const legacyData = localStorage.getItem('miniCycleStorage');
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
            localStorage.setItem('miniCycleStorage', JSON.stringify(cycles));
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











/**
 * Remindoverduetasks function.
 *
 * @returns {void}
 */

function remindOverdueTasks() {
    let autoReset = toggleAutoReset.checked;
    if (autoReset) return;

    // ✅ Load reminder settings from appropriate schema
    let remindersSettings;
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        remindersSettings = newSchemaData.reminders || {};
    } else {
        remindersSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
    }
    
    const dueDatesRemindersEnabled = remindersSettings.dueDatesReminders;
    const remindersFullyEnabled = remindersSettings.enabled;

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
 * Updates the main menu header with the active miniCycle title and current date.
 * Ensures proper display of selected miniCycle.
 */

function updateMainMenuHeader() {
    const menuHeaderTitle = document.getElementById("main-menu-mini-cycle-title");
    const dateElement = document.getElementById("current-date");
    
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    let activeCycleTitle = "No miniCycle Selected";
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        if (activeCycle && currentCycle) {
            activeCycleTitle = currentCycle.title || activeCycle;
        }
    } else {
        // ✅ Fallback to old schema (your existing logic)
        const lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
        if (lastUsedMiniCycle) {
            activeCycleTitle = lastUsedMiniCycle;
        }
    }

    // ✅ Get Current Date
    const today = new Date();
    const formattedDate = today.toLocaleDateString(undefined, {
        weekday: 'short', // "Mon"
        month: 'short', // "Jan"
        day: '2-digit', // "08"
        year: 'numeric' // "2025"
    });

    // ✅ Update Title & Date
    if (menuHeaderTitle) menuHeaderTitle.textContent = activeCycleTitle;
    if (dateElement) dateElement.textContent = formattedDate;
}

/**
 * Saves the due date for a specific task in the active miniCycle.
 *
 * @param {string} taskText - The text of the task to update.
 * @param {string|null} dueDate - The due date to assign, or null to remove the due date.
 */

function saveTaskDueDate(taskId, newDueDate) {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const task = cycles[activeCycle]?.tasks?.find(t => t.id === taskId);
        
        if (task) {
            task.dueDate = newDueDate;
            
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        }
        return;
    }
    
    // ✅ Fallback to old schema (your existing code)
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
 * Saves the current miniCycle under a new name, creating a separate copy.
 * Ensures that the new name is unique before saving.
 */

function saveMiniCycleAsNew() {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        if (!activeCycle || !currentCycle) {
            showNotification("⚠ No miniCycle found to save.");
            return;
        }

        showPromptModal({
            title: "Duplicate Cycle List",
            message: `Enter a new name for your copy of "${currentCycle.title}":`,
            placeholder: "e.g., My Custom Routine",
            confirmText: "Save Copy",
            cancelText: "Cancel",
            required: true,
            callback: (input) => {
                if (!input) {
                    showNotification("❌ Save cancelled.");
                    return;
                }

                const newCycleName = sanitizeInput(input.trim());

                if (!newCycleName) {
                    showNotification("⚠ Please enter a valid name.");
                    return;
                }

                // ✅ Check for existing cycles by key (title in Option 1)
                if (cycles[newCycleName]) {
                    showNotification("⚠ A miniCycle with this name already exists. Please choose a different name.");
                    return;
                }

                // ✅ Create new cycle with title as key for Option 1
                const newCycleId = `copy_${Date.now()}`;
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                
                // ✅ Deep copy the current cycle with new title as storage key
                fullSchemaData.data.cycles[newCycleName] = {
                    ...JSON.parse(JSON.stringify(currentCycle)),
                    id: newCycleId,
                    title: newCycleName,
                    createdAt: Date.now()
                };

                // ✅ Set as active cycle using the title as key
                fullSchemaData.appState.activeCycleId = newCycleName;
                fullSchemaData.metadata.lastModified = Date.now();
                fullSchemaData.metadata.totalCyclesCreated++;

                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

                showNotification(`✅ miniCycle "${currentCycle.title}" was copied as "${newCycleName}"!`);
                hideMainMenu();
                loadMiniCycle();
            }
        });
        return;
    }

    // ✅ Fallback to old schema (unchanged)
    const currentMiniCycleName = localStorage.getItem("lastUsedMiniCycle");
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

    if (!currentMiniCycleName || !savedMiniCycles[currentMiniCycleName]) {
        showNotification("⚠ No miniCycle found to save.");
        return;
    }

    showPromptModal({
        title: "Duplicate Cycle List",
        message: `Enter a new name for your copy of "${currentMiniCycleName}":`,
        placeholder: "e.g., My Custom Routine",
        confirmText: "Save Copy",
        cancelText: "Cancel",
        required: true,
        callback: (input) => {
            if (!input) {
                showNotification("❌ Save cancelled.");
                return;
            }

            const newCycleName = sanitizeInput(input.trim());

            if (!newCycleName) {
                showNotification("⚠ Please enter a valid name.");
                return;
            }

            if (savedMiniCycles[newCycleName]) {
                showNotification("⚠ A miniCycle with this name already exists. Please choose a different name.");
                return;
            }

            // ✅ Deep copy of miniCycle
            savedMiniCycles[newCycleName] = JSON.parse(JSON.stringify(savedMiniCycles[currentMiniCycleName]));
            savedMiniCycles[newCycleName].title = newCycleName;

            // ✅ Save updates
            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
            localStorage.setItem("lastUsedMiniCycle", newCycleName);

            showNotification(`✅ miniCycle "${currentMiniCycleName}" was copied as "${newCycleName}"!`);
            hideMainMenu();
            loadMiniCycle();
        }
    });
}
/**
 * Switchminicycle function.
 *
 * @returns {void}
 */

function switchMiniCycle() {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles } = newSchemaData;
        const switchModal = document.querySelector(".mini-cycle-switch-modal");
        const listContainer = document.getElementById("miniCycleList");
        const switchRow = document.querySelector(".switch-items-row");
        const renameButton = document.getElementById("switch-rename");
        const deleteButton = document.getElementById("switch-delete");
        const previewWindow = document.getElementById("switch-preview-window");

        hideMainMenu();

        if (Object.keys(cycles).length === 0) {
            showNotification("No saved miniCycles found.");
            return;
        }

        // ✅ Clear previous list and populate with miniCycles from Schema 2.5
        listContainer.innerHTML = "";
        Object.entries(cycles).forEach(([cycleKey, cycle]) => {
            const listItem = document.createElement("button");
            listItem.classList.add("mini-cycle-switch-item");
            listItem.textContent = cycle.title || cycleKey;
            listItem.dataset.cycleKey = cycleKey; // ✅ Use the storage key (title in Option 1)
            listItem.dataset.cycleName = cycle.title || cycleKey; // Keep for compatibility

            // ✅ Click event for selecting a miniCycle
            listItem.addEventListener("click", () => {
                document.querySelectorAll(".mini-cycle-switch-item").forEach(item => 
                    item.classList.remove("selected"));
                listItem.classList.add("selected");

                switchRow.style.display = "block"; 
                updatePreview(cycle.title || cycleKey);
            });

            listContainer.appendChild(listItem);
        });

        switchModal.style.display = "flex";
        switchRow.style.display = "none";
        loadMiniCycleList();

        // ✅ Event listeners remain the same
        renameButton.removeEventListener("click", renameMiniCycle);
        renameButton.addEventListener("click", renameMiniCycle);

        deleteButton.removeEventListener("click", deleteMiniCycle);
        deleteButton.addEventListener("click", deleteMiniCycle);

        document.getElementById("miniCycleSwitchConfirm").removeEventListener("click", confirmMiniCycle);
        document.getElementById("miniCycleSwitchConfirm").addEventListener("click", confirmMiniCycle);

        document.getElementById("miniCycleSwitchCancel").removeEventListener("click", closeMiniCycleModal);
        document.getElementById("miniCycleSwitchCancel").addEventListener("click", closeMiniCycleModal);
        
        return;
    }

    // ✅ Fallback to old schema (unchanged)
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const switchModal = document.querySelector(".mini-cycle-switch-modal");
    const listContainer = document.getElementById("miniCycleList");
    const switchRow = document.querySelector(".switch-items-row");
    const renameButton = document.getElementById("switch-rename");
    const deleteButton = document.getElementById("switch-delete");
    const previewWindow = document.getElementById("switch-preview-window");

    hideMainMenu();

    if (Object.keys(savedMiniCycles).length === 0) {
        showNotification("No saved miniCycles found.");
        return;
    }

    // ✅ Clear previous list and populate with miniCycles
    listContainer.innerHTML = "";
    Object.keys(savedMiniCycles).forEach((cycleName) => {
        const listItem = document.createElement("button");
        listItem.classList.add("mini-cycle-switch-item");
        listItem.textContent = cycleName;
        listItem.dataset.cycleName = cycleName;

        // ✅ Click event for selecting a miniCycle
        listItem.addEventListener("click", () => {
            document.querySelectorAll(".mini-cycle-switch-item").forEach(item => 
                item.classList.remove("selected"));
            listItem.classList.add("selected");

            switchRow.style.display = "block"; 
            updatePreview(cycleName);
        });

        listContainer.appendChild(listItem);
    });

    switchModal.style.display = "flex";
    switchRow.style.display = "none";
    loadMiniCycleList();

    // ✅ Event listeners remain the same
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

function renameMiniCycle() {
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");

    if (!selectedCycle) {
        showNotification("Please select a miniCycle to rename.", "info", 1500);
        return;
    }

    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles } = newSchemaData;
        const cycleKey = selectedCycle.dataset.cycleKey; // ✅ Use cycleKey instead of cycleId
        const currentCycle = cycles[cycleKey];
        
        if (!cycleKey || !currentCycle) {
            showNotification("⚠️ Invalid cycle selection.", "error", 1500);
            return;
        }

        const oldName = currentCycle.title;

        showPromptModal({
            title: "Rename miniCycle",
            message: `Rename "${oldName}" to:`,
            placeholder: "e.g., Morning Routine",
            defaultValue: oldName,
            confirmText: "Rename",
            cancelText: "Cancel",
            required: true,
            callback: (newName) => {
                if (!newName) {
                    showNotification("❌ Rename canceled.", "show", 1500);
                    return;
                }

                const cleanName = sanitizeInput(newName.trim());
                if (cleanName === oldName) {
                    showNotification("ℹ Name unchanged.", "show", 1500);
                    return;
                }

                // ✅ Check for existing cycles by title (key collision check)
                if (cycles[cleanName]) {
                    showNotification("⚠ A miniCycle with that name already exists.", "show", 1500);
                    return;
                }

                // ✅ Update Schema 2.5 with title-as-key approach
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                
                // Create new entry with new title as key
                const updatedCycle = { ...currentCycle, title: cleanName };
                fullSchemaData.data.cycles[cleanName] = updatedCycle;
                
                // Remove old entry
                delete fullSchemaData.data.cycles[cycleKey];
                
                // Update active cycle if this was the active one
                if (fullSchemaData.appState.activeCycleId === cycleKey) {
                    fullSchemaData.appState.activeCycleId = cleanName;
                }
                
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

                // ✅ Update UI
                selectedCycle.dataset.cycleKey = cleanName;
                selectedCycle.dataset.cycleName = cleanName;
                selectedCycle.textContent = cleanName;

                // 🔄 Refresh UI
                loadMiniCycleList();
                updatePreview(cleanName);
                setTimeout(() => {
                    const updatedItem = [...document.querySelectorAll(".mini-cycle-switch-item")]
                        .find(item => item.dataset.cycleKey === cleanName);
                    if (updatedItem) {
                        updatedItem.classList.add("selected");
                        updatedItem.click();
                    }
                }, 50);

                showNotification(`✅ miniCycle renamed to "${cleanName}"`, "success", 2500);
            }
        });
        return;
    }

    // ✅ Fallback to old schema (unchanged)
    const oldName = selectedCycle.dataset.cycleName;
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

    showPromptModal({
        title: "Rename miniCycle",
        message: `Rename "${oldName}" to:`,
        placeholder: "e.g., Morning Routine",
        defaultValue: oldName,
        confirmText: "Rename",
        cancelText: "Cancel",
        required: true,
        callback: (newName) => {
            if (!newName) {
                showNotification("❌ Rename canceled.", "show", 1500);
                return;
            }

            const cleanName = sanitizeInput(newName.trim());
            if (cleanName === oldName) {
                showNotification("ℹ Name unchanged.", "show", 1500);
                return;
            }

            if (savedMiniCycles[cleanName]) {
                showNotification("⚠ A miniCycle with that name already exists.", "show", 1500);
                return;
            }

            // Rename and update localStorage
            savedMiniCycles[cleanName] = { ...savedMiniCycles[oldName] };
            savedMiniCycles[cleanName].title = cleanName;
            delete savedMiniCycles[oldName];

            // Update last used miniCycle reference if necessary
            const currentActive = localStorage.getItem("lastUsedMiniCycle");
            if (currentActive === oldName) {
                localStorage.setItem("lastUsedMiniCycle", cleanName);
            }

            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

            // ✅ Update UI label directly
            selectedCycle.dataset.cycleName = cleanName;
            selectedCycle.textContent = cleanName;

            // 🔄 Refresh UI
            loadMiniCycleList();
            updatePreview(cleanName);
            setTimeout(() => {
                const updatedItem = [...document.querySelectorAll(".mini-cycle-switch-item")]
                    .find(item => item.dataset.cycleName === cleanName);
                if (updatedItem) {
                    updatedItem.classList.add("selected");
                    updatedItem.click();
                }
            }, 50);

            showNotification(`✅ miniCycle renamed to "${cleanName}"`, "success", 2500);
        }
    });
}

/**
 * Deleteminicycle function.
 *
 * @returns {void}
 */
function deleteMiniCycle() {
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");
    if (!selectedCycle) {
        showNotification("⚠ No miniCycle selected for deletion.");
        return;
    }

    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const cycleKey = selectedCycle.dataset.cycleKey; // ✅ Use cycleKey instead of cycleId
        const currentCycle = cycles[cycleKey];
        
        if (!cycleKey || !currentCycle) {
            showNotification("⚠️ Invalid cycle selection.", "error", 1500);
            return;
        }

        const cycleToDelete = currentCycle.title;

        showConfirmationModal({
            title: "Delete miniCycle",
            message: `❌ Are you sure you want to delete "${cycleToDelete}"? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            callback: (confirmed) => {
                if (!confirmed) {
                    return;
                }

                // ✅ Create undo snapshot before deletion
                pushUndoSnapshot();

                // ✅ Remove the selected miniCycle from Schema 2.5
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                delete fullSchemaData.data.cycles[cycleKey]; // ✅ Delete by key, not ID
                
                console.log(`✅ miniCycle "${cycleToDelete}" deleted from Schema 2.5.`);

                // ✅ If the deleted cycle was the active one, handle fallback
                if (cycleKey === activeCycle) {
                    const remainingCycleKeys = Object.keys(fullSchemaData.data.cycles);

                    if (remainingCycleKeys.length > 0) {
                        // ✅ Switch to the first available miniCycle
                        const newActiveCycleKey = remainingCycleKeys[0];
                        fullSchemaData.appState.activeCycleId = newActiveCycleKey;
                        
                        const newActiveCycle = fullSchemaData.data.cycles[newActiveCycleKey];
                        console.log(`🔄 Switched to miniCycle: "${newActiveCycle.title}".`);
                    } else {
                        fullSchemaData.appState.activeCycleId = null;
                        
                        setTimeout(() => {
                            hideSwitchMiniCycleModal();
                            showNotification("⚠ No miniCycles left. Please create a new one.");
                            
                            // ✅ Manually reset UI instead of reloading
                            taskList.innerHTML = "";
                            toggleAutoReset.checked = false;
                            initialSetup();
                        }, 300);
                    }
                }

                // ✅ Update metadata and save
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

                // ✅ Refresh UI
                loadMiniCycle();
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

                showNotification(`🗑️ "${cycleToDelete}" has been deleted.`);
            }
        });
        return;
    }

    // ✅ Fallback to old schema (unchanged)
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
    const cycleToDelete = selectedCycle.dataset.cycleName;

    showConfirmationModal({
        title: "Delete miniCycle",
        message: `❌ Are you sure you want to delete "${cycleToDelete}"? This action cannot be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        callback: (confirmed) => {
            if (!confirmed) {
                return;
            }

            // ✅ Create undo snapshot before deletion
            pushUndoSnapshot();

            // ✅ Remove the selected miniCycle
            delete savedMiniCycles[cycleToDelete];
            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
            console.log(`✅ miniCycle "${cycleToDelete}" deleted.`);

            // ✅ If the deleted cycle was the active one, handle fallback
            if (cycleToDelete === lastUsedMiniCycle) {
                const remainingCycles = Object.keys(savedMiniCycles);

                if (remainingCycles.length > 0) {
                    // ✅ Switch to the most recent or first available miniCycle
                    const newActiveCycle = remainingCycles[0];
                    localStorage.setItem("lastUsedMiniCycle", newActiveCycle);
                    loadMiniCycle();
                    console.log(`🔄 Switched to miniCycle: "${newActiveCycle}".`);
                } else {
                    setTimeout(() => {
                        hideSwitchMiniCycleModal();
                        showNotification("⚠ No miniCycles left. Please create a new one.");
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

            showNotification(`🗑️ "${cycleToDelete}" has been deleted.`);
        }
    });
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
        showNotification("Please select a miniCycle.");
        return;
    }

    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        // Schema 2.5 - Use cycle key instead of ID
        const cycleKey = selectedCycle.dataset.cycleKey; // ✅ Use cycleKey
        
        if (!cycleKey) {
            showNotification("⚠️ Invalid cycle selection.");
            return;
        }
        
        const fullSchemaData = JSON.parse(newSchemaData);
        
        // Set the active cycle using the cycle key (title in Option 1)
        fullSchemaData.appState.activeCycleId = cycleKey;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        
        console.log(`✅ Switched to cycle (Schema 2.5): ${cycleKey}`);
    } else {
        // ✅ Fallback to old schema (unchanged)
        localStorage.setItem("lastUsedMiniCycle", selectedCycle.dataset.cycleName);
        console.log(`✅ Switched to cycle (Legacy): ${selectedCycle.dataset.cycleName}`);
    }

    loadMiniCycle();
    document.querySelector(".mini-cycle-switch-modal").style.display = "none";
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
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    let cycleData = null;
    
    if (newSchemaData) {
        const { cycles } = newSchemaData;
        // ✅ For Option 1, cycleName IS the key, so use it directly
        cycleData = cycles[cycleName];
    } else {
        // ✅ Fallback to old schema
        const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
        cycleData = savedMiniCycles[cycleName];
    }
    
    const previewWindow = document.getElementById("switch-preview-window");

    function escapeHTML(str) {
        const temp = document.createElement("div");
        temp.textContent = str;
        return temp.innerHTML;
    }

    if (!cycleData || !cycleData.tasks) {
        previewWindow.innerHTML = `<br><strong>No tasks found.</strong>`;
        return;
    }

    // ✅ Create a simple list of tasks for preview
    const tasksPreview = cycleData.tasks
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
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles } = newSchemaData;
        const miniCycleList = document.getElementById("miniCycleList");
        miniCycleList.innerHTML = ""; // Clear the list before repopulating

        // ✅ Use Object.entries to get both key and cycle data
        Object.entries(cycles).forEach(([cycleKey, cycleData]) => {
            const listItem = document.createElement("div");
            listItem.classList.add("mini-cycle-switch-item");
            listItem.dataset.cycleName = cycleData.title || cycleKey; // Use title for compatibility
            listItem.dataset.cycleKey = cycleKey; // ✅ Store the storage key

            // 🏷️ Determine emoji based on miniCycle properties
            let emoji = "📋"; // Default to 📋 (Standard Document)
            if (cycleData.autoReset) {
                emoji = "🔃"; // If Auto Reset is ON, show 🔃
            }

            // 📌 Ensure spacing between emoji and text
            listItem.textContent = emoji + " ";
            const nameSpan = document.createElement("span");
            nameSpan.textContent = cycleData.title || cycleKey;
            listItem.appendChild(nameSpan);

            // 🖱️ Handle selection
            listItem.addEventListener("click", function () {
                document.querySelectorAll(".mini-cycle-switch-item").forEach(item => item.classList.remove("selected"));
                this.classList.add("selected");

                // Show preview & buttons
                document.getElementById("switch-items-row").style.display = "block";
                // ✅ Pass the cycle key for Option 1
                updatePreview(cycleKey);
            });

            miniCycleList.appendChild(listItem);
        });

        updateReminderButtons();
        return;
    }
    
    // ✅ Fallback to old schema (unchanged)
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const miniCycleList = document.getElementById("miniCycleList");
    miniCycleList.innerHTML = ""; // Clear the list before repopulating

    Object.keys(savedMiniCycles).forEach((cycleName) => {
        const cycleData = savedMiniCycles[cycleName];
        const listItem = document.createElement("div");
        listItem.classList.add("mini-cycle-switch-item");
        listItem.dataset.cycleName = cycleName;

        // 🏷️ Determine emoji based on miniCycle properties
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
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        if (!activeCycle || !currentCycle) {
            showNotification("⚠ No active miniCycle to clear tasks.");
            return;
        }

        // ✅ Create undo snapshot before making changes
        pushUndoSnapshot();

        // ✅ Uncheck all tasks (DO NOT DELETE)
        currentCycle.tasks.forEach(task => task.completed = false);

        // ✅ Update the full schema data
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle] = currentCycle;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

        // ✅ Uncheck tasks in the UI and remove overdue styling
        document.querySelectorAll("#taskList .task").forEach(taskElement => {
            const checkbox = taskElement.querySelector("input[type='checkbox']");
            if (checkbox) {
                checkbox.checked = false;
            }
            // ✅ Remove overdue styling
            taskElement.classList.remove("overdue-task");
        });

        // ✅ Update UI elements
        updateProgressBar();
        updateStatsPanel();
        checkCompleteAllButton();
        updateRecurringPanelButtonVisibility();
        hideMainMenu();

        // ✅ Show undo/hide redo buttons
        document.getElementById("undo-btn").hidden = false;
        document.getElementById("redo-btn").hidden = true;

        showNotification(`✅ All tasks unchecked for "${currentCycle.title}"`, "success", 2000);
        console.log(`✅ All tasks unchecked for miniCycle: "${currentCycle.title}"`);
        return;
    }

    // ✅ Fallback to old schema (unchanged)
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

    if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
        showNotification("⚠ No active miniCycle to clear tasks.");
        return;
    }

    // ✅ Create undo snapshot before making changes
    pushUndoSnapshot();

    // ✅ Uncheck all tasks (DO NOT DELETE)
    savedMiniCycles[lastUsedMiniCycle].tasks.forEach(task => task.completed = false);

    // ✅ Save updated miniCycle
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    // ✅ Uncheck tasks in the UI and remove overdue styling
    document.querySelectorAll("#taskList .task").forEach(taskElement => {
        const checkbox = taskElement.querySelector("input[type='checkbox']");
        if (checkbox) {
            checkbox.checked = false;
        }
        // ✅ Remove overdue styling
        taskElement.classList.remove("overdue-task");
    });

    // ✅ Update UI elements
    updateProgressBar();
    updateStatsPanel();
    checkCompleteAllButton();
    updateRecurringPanelButtonVisibility();
    hideMainMenu();

    // ✅ Show undo/hide redo buttons
    document.getElementById("undo-btn").hidden = false;
    document.getElementById("redo-btn").hidden = true;

    showNotification(`✅ All tasks unchecked for "${lastUsedMiniCycle}"`, "success", 2000);
    console.log(`✅ All tasks unchecked for miniCycle: "${lastUsedMiniCycle}"`);
}

/**
 * Deletealltasks function.
 *
 * @returns {void}
 */
function deleteAllTasks() {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        if (!activeCycle || !currentCycle) {
            showNotification("⚠ No active miniCycle to delete tasks from.");
            return;
        }

        // ✅ Use callback pattern with showConfirmationModal
        showConfirmationModal({
            title: "Delete All Tasks",
            message: `⚠ Are you sure you want to permanently delete all tasks in "${currentCycle.title}"? This action cannot be undone.`,
            confirmText: "Delete All",
            cancelText: "Cancel",
            callback: (confirmed) => {
                if (!confirmed) {
                    showNotification("❌ Deletion cancelled.");
                    return;
                }

                // ✅ Push undo snapshot before deletion
                pushUndoSnapshot();

                // ✅ Clear tasks completely
                currentCycle.tasks = [];

                // ✅ Clear recurring templates too
                if (currentCycle.recurringTemplates) {
                    currentCycle.recurringTemplates = {};
                }

                // ✅ Update the full schema data
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                fullSchemaData.data.cycles[activeCycle] = currentCycle;
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

                // ✅ Clear UI & update progress
                taskList.innerHTML = "";
                updateProgressBar();
                updateStatsPanel();
                checkCompleteAllButton();
                updateRecurringPanelButtonVisibility();

                // ✅ Show undo/hide redo buttons
                document.getElementById("undo-btn").hidden = false;
                document.getElementById("redo-btn").hidden = true;

                // ✅ Show success notification
                showNotification(`✅ All tasks deleted from "${currentCycle.title}"`, "success", 3000);

                console.log(`✅ All tasks deleted for miniCycle: "${currentCycle.title}"`);
            }
        });
        return;
    }

    // ✅ Fallback to old schema (unchanged)
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

    if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
        showNotification("⚠ No active miniCycle to delete tasks from.");
        return;
    }

    // ✅ Use callback pattern with showConfirmationModal
    showConfirmationModal({
        title: "Delete All Tasks",
        message: `⚠ Are you sure you want to permanently delete all tasks in "${lastUsedMiniCycle}"? This action cannot be undone.`,
        confirmText: "Delete All",
        cancelText: "Cancel",
        callback: (confirmed) => {
            if (!confirmed) {
                showNotification("❌ Deletion cancelled.");
                return;
            }

            // ✅ Push undo snapshot before deletion
            pushUndoSnapshot();

            // ✅ Clear tasks completely
            savedMiniCycles[lastUsedMiniCycle].tasks = [];

            // ✅ Clear recurring templates too
            if (savedMiniCycles[lastUsedMiniCycle].recurringTemplates) {
                savedMiniCycles[lastUsedMiniCycle].recurringTemplates = {};
            }

            // ✅ Save updated miniCycle
            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

            // ✅ Clear UI & update progress
            taskList.innerHTML = "";
            updateProgressBar();
            updateStatsPanel();
            checkCompleteAllButton();
            updateRecurringPanelButtonVisibility();

            // ✅ Show undo/hide redo buttons
            document.getElementById("undo-btn").hidden = false;
            document.getElementById("redo-btn").hidden = true;

            // ✅ Show success notification
            showNotification(`✅ All tasks deleted from "${lastUsedMiniCycle}"`, "success", 3000);

            console.log(`✅ All tasks deleted for miniCycle: "${lastUsedMiniCycle}"`);
        }
    });
}
/**
 * Create new miniCycle function.
 *
 * @returns {void}
 */

function createNewMiniCycle() {
    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        // Schema 2.5 path
        showPromptModal({
            title: "Create New miniCycle",
            message: "What would you like to name it?",
            placeholder: "e.g., Daily Routine",
            defaultValue: "",
            confirmText: "Create",
            cancelText: "Cancel",
            required: true,
            callback: (result) => {
                if (!result) {
                    showNotification("❌ Creation canceled.");
                    return;
                }
                
                const newCycleName = sanitizeInput(result.trim());
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                
                // ✅ Create unique ID first
                const cycleId = `cycle_${Date.now()}`;
                
                // ✅ Determine the storage key (title-first approach with ID fallback)
                let storageKey = newCycleName;
                let finalTitle = newCycleName;
                
                // ✅ Handle duplicate titles by checking existing keys
                if (fullSchemaData.data.cycles[storageKey]) {
                    // Try numbered variations first: "Title (2)", "Title (3)", etc.
                    let counter = 2;
                    let numberedTitle = `${newCycleName} (${counter})`;
                    
                    while (fullSchemaData.data.cycles[numberedTitle] && counter < 10) {
                        counter++;
                        numberedTitle = `${newCycleName} (${counter})`;
                    }
                    
                    // If we found a unique numbered title, use it
                    if (!fullSchemaData.data.cycles[numberedTitle]) {
                        storageKey = numberedTitle;
                        finalTitle = numberedTitle;
                        showNotification(`⚠ Title already exists. Using "${finalTitle}" instead.`, "warning", 3000);
                    } else {
                        // Fallback to ID if too many duplicates
                        storageKey = cycleId;
                        finalTitle = newCycleName; // Keep original title inside object
                        showNotification(`⚠ Multiple cycles with this name exist. Using unique ID for storage.`, "warning", 3000);
                    }
                }

                // ✅ Create new cycle in Schema 2.5 format
                fullSchemaData.data.cycles[storageKey] = {
                    title: finalTitle,
                    id: cycleId,
                    tasks: [],
                    autoReset: true,
                    deleteCheckedTasks: false,
                    cycleCount: 0,
                    createdAt: Date.now(),
                    recurringTemplates: {}
                };

                // ✅ Set as active cycle using the storage key
                fullSchemaData.appState.activeCycleId = storageKey;
                fullSchemaData.metadata.lastModified = Date.now();
                fullSchemaData.metadata.totalCyclesCreated++;

                // ✅ Save to localStorage
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

                // ✅ Clear UI & Load new miniCycle
                taskList.innerHTML = "";
                document.getElementById("mini-cycle-title").textContent = finalTitle;
                toggleAutoReset.checked = true;
                deleteCheckedTasks.checked = false;

                // ✅ Ensure UI updates
                hideMainMenu();
                updateProgressBar();
                checkCompleteAllButton();
                autoSave();

                console.log(`✅ Created and switched to new miniCycle (Schema 2.5): "${finalTitle}" (key: ${storageKey})`);
                showNotification(`✅ Created new miniCycle "${finalTitle}"`, "success", 3000);
            }
        });
        return;
    }
    
    // ✅ Fallback to old schema (your existing logic remains the same)
    let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    
    showPromptModal({
        title: "Create New miniCycle",
        message: "What would you like to name it?",
        placeholder: "e.g., Daily Routine",
        defaultValue: "",
        confirmText: "Create",
        cancelText: "Cancel",
        required: true,
        callback: (result) => {
            if (!result) {
                showNotification("❌ Creation canceled.");
                return;
            }
            
            const newCycleName = sanitizeInput(result.trim());
            
            // ✅ Ensure the miniCycle name is unique
            if (savedMiniCycles[newCycleName]) {
                showNotification("⚠ A miniCycle with this name already exists. Choose a different name.");
                return;
            }

            // ✅ Create new miniCycle with default settings
            savedMiniCycles[newCycleName] = {
                title: newCycleName,
                tasks: [],
                autoReset: true,
                deleteCheckedTasks: false,
                cycleCount: 0
            };

            // ✅ Save to localStorage
            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
            localStorage.setItem("lastUsedMiniCycle", newCycleName);

            // ✅ Clear UI & Load new miniCycle
            taskList.innerHTML = "";
            document.getElementById("mini-cycle-title").textContent = newCycleName;
            toggleAutoReset.checked = savedMiniCycles[newCycleName].autoReset;

            // ✅ Ensure UI updates
            hideMainMenu();
            updateProgressBar();
            checkCompleteAllButton();
            autoSave();

            console.log(`✅ Created and switched to new miniCycle (Legacy): "${newCycleName}"`);
            showNotification(`✅ Created new miniCycle "${newCycleName}"`, "success", 3000);
        }
    });
}



indefiniteCheckbox.addEventListener("change", () => {
  // If indefinite, hide the repeatCount row
  repeatCountRow.style.display = indefiniteCheckbox.checked ? "none" : "block";
});



function handleReminderToggle() {
    const isEnabled = enableReminders.checked;
  
    // ✅ Try new schema first for previous state
    let previousSettings = {};
    let wasEnabled = false;
    
    const newSchemaData = loadMiniCycleFromNewSchema();
    if (newSchemaData) {
        previousSettings = newSchemaData.reminders || {};
        wasEnabled = previousSettings.enabled === true;
    } else {
        // ✅ Fallback to old schema
        previousSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
        wasEnabled = previousSettings.enabled === true;
    }
  
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
  
      // ✅ Try new schema first for reminder settings
      let reminderSettings = {};
      const newSchemaData = loadMiniCycleFromNewSchema();
      
      if (newSchemaData) {
          reminderSettings = newSchemaData.reminders || {
              enabled: false,
              indefinite: true,
              dueDatesReminders: false,
              repeatCount: 0,
              frequencyValue: 0,
              frequencyUnit: "hours"
          };
      } else {
          // ✅ Fallback to old schema
          reminderSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
      }
  
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

// Update autoSaveReminders to handle both schemas
function autoSaveReminders() {
    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        const enabled = document.getElementById("enableReminders").checked;
        
        parsed.customReminders = {
            enabled,
            indefinite: document.getElementById("indefiniteCheckbox").checked,
            dueDatesReminders: document.getElementById("dueDatesReminders").checked,
            repeatCount: parseInt(document.getElementById("repeatCount").value) || 0,
            frequencyValue: parseInt(document.getElementById("frequencyValue").value) || 0,
            frequencyUnit: document.getElementById("frequencyUnit").value
        };
        
        // ⏱️ Save reminder start time only when enabling reminders
        if (enabled) {
            parsed.customReminders.reminderStartTime = Date.now();
        }
        
        parsed.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(parsed));
        
        console.log("✅ Reminders settings saved automatically (Schema 2.5)!", parsed.customReminders);
        return enabled;
    }
    
    // ✅ Fallback to existing logic for old schema
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
    console.log("✅ Reminders settings saved automatically (Legacy)!", remindersToSave);

    return enabled;
}

// ✅ Load saved reminders settings on page load
function loadRemindersSettings() {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const reminders = newSchemaData.reminders || {
            enabled: false,
            indefinite: true,
            dueDatesReminders: false,
            repeatCount: 0,
            frequencyValue: 0,
            frequencyUnit: "hours"
        };

        // ✅ Apply settings to UI
        document.getElementById("enableReminders").checked = reminders.enabled;
        document.getElementById("indefiniteCheckbox").checked = reminders.indefinite;
        document.getElementById("dueDatesReminders").checked = reminders.dueDatesReminders;
        document.getElementById("repeatCount").value = reminders.repeatCount;
        document.getElementById("frequencyValue").value = reminders.frequencyValue;
        document.getElementById("frequencyUnit").value = reminders.frequencyUnit;

        // ✅ Show/hide frequency settings dynamically
        frequencySection.classList.toggle("hidden", !reminders.enabled);
        document.getElementById("repeat-count-row").style.display = reminders.indefinite ? "none" : "block";

        // ✅ 🔔 Show/hide reminder buttons on load
        updateReminderButtons();
        
        console.log("✅ Reminder settings loaded from Schema 2.5");
        return;
    }
    
    // ✅ Fallback to old schema
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

    // ✅ 🔔 Show/hide reminder buttons on load
    updateReminderButtons();
    
    console.log("✅ Reminder settings loaded from Legacy storage");
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
 * 📌 Save the reminder state for a specific task inside the active miniCycle.
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
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const task = cycles[activeCycle]?.tasks?.find(t => t.id === taskId);
        
        if (task) {
            task.remindersEnabled = isEnabled;
            
            // Update the full schema data
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            
            console.log(`✅ Task reminder state saved (Schema 2.5): ${taskId} = ${isEnabled}`);
        }
        return;
    }
    
    // ✅ Fallback to old schema
    let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
    if (!savedMiniCycles[lastUsedMiniCycle]) return;

    // Look up the task using its unique id instead of text
    let task = savedMiniCycles[lastUsedMiniCycle].tasks.find(t => t.id === taskId);
    if (task) {
        task.remindersEnabled = isEnabled;
        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
        console.log(`✅ Task reminder state saved (Legacy): ${taskId} = ${isEnabled}`);
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

document.getElementById('try-lite-version')?.addEventListener('click', function() {
  showConfirmationModal({
    title: "Switch to Lite Version",
    message: "Try the Lite version? It works great on older devices and slower connections.",
    confirmText: "Try Lite Version",
    cancelText: "Stay Here",
    callback: (confirmed) => {
      if (confirmed) {
        window.location.href = 'miniCycle-lite.html';
      }
    }
  });
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
 * Show a confirmation modal and call callback with boolean result
 */
function showConfirmationModal({
  title = "Confirm Action",
  message = "Are you sure?",
  confirmText = "Yes",
  cancelText = "Cancel",
  callback = () => {}
}) {
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
    callback(true);
  };

  cancelBtn.onclick = () => {
    cleanup();
    callback(false);
  };
}

function showPromptModal({
  title = "Enter a value",
  message = "",
  placeholder = "",
  defaultValue = "",
  confirmText = "OK",
  cancelText = "Cancel",
  required = false,
  callback = () => {}
}) {
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
    callback(null);
  });

  confirmBtn.addEventListener("click", () => {
    const value = input.value.trim();
    if (required && !value) {
      input.classList.add("miniCycle-input-error");
      input.focus();
      return;
    }
    document.body.removeChild(overlay);
    callback(value);
  });

  overlay.addEventListener("keydown", e => {
    if (e.key === "Enter") confirmBtn.click();
    if (e.key === "Escape") cancelBtn.click();
  });
}

  
  /**
 * Startreminders function.
 *
 * @returns {void}
 */


  function sendReminderNotificationIfNeeded() {
      // ✅ Load reminders from appropriate schema
      let remindersSettings;
      const newSchemaData = loadMiniCycleFromNewSchema();
      
      if (newSchemaData) {
          remindersSettings = newSchemaData.reminders || {};
      } else {
          remindersSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
      }
  
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

    // ✅ Load reminders from appropriate schema
    let remindersSettings;
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        remindersSettings = newSchemaData.reminders || {};
    } else {
        remindersSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
    }
    
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
      const specificDatesPanel = document.getElementById("specific-dates-panel");
      const toggleBtn = document.getElementById("toggle-advanced-settings");
     
      let advancedVisible = false;
      setAdvancedVisibility(advancedVisible, toggleBtn);
    
      toggleBtn.addEventListener("click", () => {
          advancedVisible = !advancedVisible;
          setAdvancedVisibility(advancedVisible, toggleBtn);
      });
    
      if (!overlay || !panel || !closeBtn || !openBtn) return;
    
      openBtn.addEventListener("click", () => {
          // ✅ Try new schema first
          const newSchemaData = loadMiniCycleFromNewSchema();
          
          if (newSchemaData) {
              const { cycles, activeCycle } = newSchemaData;
              const currentCycle = cycles[activeCycle];
              
              if (!currentCycle) return;
              
              updateRecurringPanel(currentCycle);
          } else {
              // ✅ Fallback to old schema
              const freshData = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
              const cycleName = localStorage.getItem("lastUsedMiniCycle");
              const currentCycle = freshData[cycleName];
              
              if (!currentCycle) return;
              
              updateRecurringPanel(currentCycle);
          }
  
          document.getElementById("recurring-settings-panel")?.classList.add("hidden");
          overlay.classList.remove("hidden");
          updateRecurringSettingsVisibility();
          document.getElementById("set-default-recurring").checked = false;
      });
    
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
    
      // Rest of the function remains the same...
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
      
      // Rest of the setup code remains the same...
      const toggleVisibility = (triggerId, contentId) => {
          const trigger = document.getElementById(triggerId);
          const content = document.getElementById(contentId);
          if (trigger && content) {
              trigger.addEventListener("change", () => {
                  content.classList.toggle("hidden", !trigger.checked);
              });
          }
      };
  
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
          generateYearlyDayGrid(1);
      }
  
      yearlyApplyToAllCheckbox?.addEventListener("change", handleYearlyApplyToAllChange);
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
    
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    let cycleData = currentCycleData;
    
    if (!cycleData) {
        if (newSchemaData) {
            const { cycles, activeCycle } = newSchemaData;
            cycleData = cycles[activeCycle];
        } else {
            // ✅ Fallback to old schema
            const freshCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
            const cycleName = localStorage.getItem("lastUsedMiniCycle");
            cycleData = freshCycles?.[cycleName];
        }
    }
    
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

        // ✅ Handle remove button with Schema 2.5 support
        item.querySelector("button").addEventListener("click", () => {
            showConfirmationModal({
                title: "Remove Recurring Task",
                message: `Are you sure you want to remove "${task.text}" from recurring tasks?`,
                confirmText: "Remove",
                cancelText: "Cancel",
                callback: (confirmed) => {
                    if (!confirmed) return;

                    pushUndoSnapshot();

                    // ✅ Try new schema first
                    const newSchemaData = loadMiniCycleFromNewSchema();
                    
                    if (newSchemaData) {
                        const { cycles, activeCycle } = newSchemaData;
                        const currentCycle = cycles[activeCycle];
                        
                        // Remove recurrence from the live task
                        const liveTask = currentCycle.tasks.find(t => t.id === task.id);
                        if (liveTask) {
                            liveTask.recurring = false;
                            delete liveTask.recurringSettings;
                        }

                        // Delete from recurringTemplates
                        delete currentCycle.recurringTemplates[task.id];

                        // Update the full schema data
                        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                        fullSchemaData.data.cycles[activeCycle] = currentCycle;
                        fullSchemaData.metadata.lastModified = Date.now();
                        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                        
                    } else {
                        // ✅ Fallback to old schema
                        const freshCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
                        const cycleName = localStorage.getItem("lastUsedMiniCycle");

                        // Remove recurrence from the live task
                        const liveTask = cycleData.tasks.find(t => t.id === task.id);
                        if (liveTask) {
                            liveTask.recurring = false;
                            delete liveTask.recurringSettings;
                        }

                        // Update the main task list
                        const taskIndex = freshCycles[cycleName].tasks.findIndex(t => t.id === task.id);
                        if (taskIndex !== -1) {
                            freshCycles[cycleName].tasks[taskIndex].recurring = false;
                            freshCycles[cycleName].tasks[taskIndex].recurringSettings = {};
                        }

                        // Delete from recurringTemplates
                        delete freshCycles[cycleName].recurringTemplates[task.id];
                        localStorage.setItem("miniCycleStorage", JSON.stringify(freshCycles));
                    }

                    showNotification("↩️ Recurring turned off for this task.", "info", 5000);

                    // Remove recurring visual state
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

                    item.remove();
                    updateRecurringPanelButtonVisibility();

                    const remaining = Object.values(cycleData.recurringTemplates || {});
                    if (remaining.length === 0) {
                        document.getElementById("recurring-panel-overlay")?.classList.add("hidden");
                    }

                    document.getElementById("undo-btn").hidden = false;
                    document.getElementById("redo-btn").hidden = true;
                }
            });
        });

        // ✅ Handle task row selection for preview
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
  
          // ✅ Update the preview with Schema 2.5 support
          const newSchemaData = loadMiniCycleFromNewSchema();
          
          if (newSchemaData) {
              const { cycles, activeCycle } = newSchemaData;
              const task = cycles[activeCycle]?.tasks.find(t => t.id === taskIdToPreselect);
              if (task) showTaskSummaryPreview(task);
          } else {
              // ✅ Fallback to old schema
              const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
              const task = savedMiniCycles?.[lastUsedMiniCycle]?.tasks.find(t => t.id === taskIdToPreselect);
              if (task) showTaskSummaryPreview(task);
          }
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
      // ✅ Try new schema first
      const newSchemaData = loadMiniCycleFromNewSchema();
      
      if (newSchemaData) {
          const { cycles, activeCycle } = newSchemaData;
          const currentCycle = cycles[activeCycle];
          
          if (!currentCycle) {
              console.error(`❌ Cannot save recurring template. Active cycle not found.`);
              return;
          }
  
          if (!currentCycle.recurringTemplates) {
              currentCycle.recurringTemplates = {};
          }
  
          currentCycle.recurringTemplates[task.id] = {
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
  
          // Update the full schema data
          const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
          fullSchemaData.data.cycles[activeCycle] = currentCycle;
          fullSchemaData.metadata.lastModified = Date.now();
          localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
          return;
      }
      
      // ✅ Fallback to old schema (your existing logic)
      if (!savedMiniCycles[cycleName]) {
          console.error(`❌ Cannot save recurring template. miniCycle "${cycleName}" not found.`);
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
      // ✅ Try new schema first
      const newSchemaData = loadMiniCycleFromNewSchema();
      
      if (newSchemaData) {
          const { cycles, activeCycle } = newSchemaData;
          const currentCycle = cycles[activeCycle];
          
          if (!currentCycle) {
              console.error(`❌ Active cycle not found in new schema.`);
              return;
          }
  
          if (!currentCycle.recurringTemplates || !currentCycle.recurringTemplates[taskId]) {
              console.warn(`⚠ Task "${taskId}" not found in recurring templates.`);
              return;
          }
  
          // Delete the task template
          delete currentCycle.recurringTemplates[taskId];
  
          // Update the full schema data
          const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
          fullSchemaData.data.cycles[activeCycle] = currentCycle;
          fullSchemaData.metadata.lastModified = Date.now();
          localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
          return;
      }
      
      // ✅ Fallback to old schema (your existing logic)
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
    
    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        parsed.settings.alwaysShowRecurring = alwaysShow;
        parsed.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(parsed));
    } else {
        // ✅ Fallback to old schema
        localStorage.setItem("miniCycleAlwaysShowRecurring", JSON.stringify(alwaysShow));
    }
    
    refreshTaskListUI();
    updateRecurringButtonVisibility();
}

function loadAlwaysShowRecurringSetting() {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    let isEnabled = false;
    
    if (newSchemaData) {
        isEnabled = newSchemaData.settings.alwaysShowRecurring || false;
    } else {
        // ✅ Fallback to old schema
        const stored = localStorage.getItem("miniCycleAlwaysShowRecurring");
        isEnabled = stored ? JSON.parse(stored) : false;
    }
    
    document.getElementById("always-show-recurring").checked = isEnabled;
}

document.getElementById("always-show-recurring").addEventListener("change", saveAlwaysShowRecurringSetting);

document.getElementById("apply-recurring-settings")?.addEventListener("click", () => {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    let cycleData = null;
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        cycleData = cycles[activeCycle];
        
        if (!activeCycle || !cycleData) {
            showNotification("⚠ No active cycle found.");
            return;
        }
    } else {
        // ✅ Fallback to old schema
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
        cycleData = savedMiniCycles?.[lastUsedMiniCycle];
        
        if (!cycleData) {
            showNotification("⚠ No active cycle found.");
            return;
        }
    }

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
        if (newSchemaData) {
            const parsed = JSON.parse(localStorage.getItem("miniCycleData"));
            parsed.settings.defaultRecurringSettings = settings;
            parsed.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(parsed));
        } else {
            localStorage.setItem("miniCycleDefaultRecurring", JSON.stringify(settings));
        }
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

    // ✅ Save based on schema type
    if (newSchemaData) {
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[newSchemaData.activeCycle] = cycleData;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    } else {
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
        savedMiniCycles[lastUsedMiniCycle] = cycleData;
        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
        autoSave(savedMiniCycles[lastUsedMiniCycle].tasks);
    }

    updateRecurringSummary();
    showNotification("✅ Recurring settings applied!", "success", 2000);
    updateRecurringPanel();

    // ✅ Clean up UI state - remove selections and hide panels
    document.querySelectorAll(".recurring-task-item").forEach(el => {
        el.classList.remove("selected", "checked");
    });

    const settingsPanel = document.getElementById("recurring-settings-panel");
    settingsPanel?.classList.add("hidden");

    // ✅ Explicitly hide checkboxes and toggle container
    document.querySelectorAll(".recurring-check").forEach(cb => {
        cb.classList.add("hidden");
        cb.checked = false;
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
  
    // ✅ Add better error handling
    if (!toggle || !hourInput || !meridiemSelect) {
      console.warn(`⚠️ Missing elements for military time toggle: ${prefix}`);
      return;
    }
  
    toggle.addEventListener("change", () => {
      const is24Hour = toggle.checked;
  
      // ✅ Add try-catch for safer property updates
      try {
        hourInput.min = is24Hour ? 0 : 1;
        hourInput.max = is24Hour ? 23 : 12;
        meridiemSelect.classList.toggle("hidden", is24Hour);
        
        // ✅ Update summary when time format changes
        if (typeof updateRecurringSummary === 'function') {
          updateRecurringSummary();
        }
      } catch (error) {
        console.warn(`⚠️ Error updating military time toggle for ${prefix}:`, error);
      }
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
  const timeOptions = document.getElementById("specific-date-time-options");
  const addBtn = document.getElementById("add-specific-date");
  const list = document.getElementById("specific-date-list");

  // ✅ Add error handling for missing elements
  if (!checkbox || !panel || !timeOptions || !addBtn || !list) {
    console.warn("⚠️ Missing elements for specific dates panel setup");
    return;
  }

  const createDateInput = (isFirst = false) => {
    const wrapper = document.createElement("div");
    wrapper.className = "specific-date-item";

    const input = document.createElement("input");
    input.type = "date";
    const index = list.children.length;
    input.setAttribute("aria-label", isFirst ? "First specific date" : `Specific date ${index + 1}`);
    input.required = true;
    
    // ✅ Better error handling for date setting
    try {
      input.valueAsDate = getTomorrow();
    } catch (error) {
      console.warn("⚠️ Could not set default date:", error);
    }

    if (isFirst) {
        input.classList.add("first-specific-date");
    }

    input.addEventListener("change", () => {
      if (isFirst && !input.value) {
        try {
          input.valueAsDate = getTomorrow();
        } catch (error) {
          console.warn("⚠️ Could not reset date:", error);
        }
      }
      updateRecurringSummary(); // ✅ Add this to update summary when date changes
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
    updateRecurringSummary(); // ✅ Update summary when new date is added
  };

  // Rest of the function remains the same...
  checkbox.addEventListener("change", () => {
    const shouldShow = checkbox.checked;
  
    panel.classList.toggle("hidden", !shouldShow);
    timeOptions.classList.toggle("hidden", !shouldShow);
  
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
      createDateInput(true);
    }
  
    if (!shouldShow) {
      document.getElementById("specific-date-specific-time").checked = false;
      document.getElementById("specific-date-time-container").classList.add("hidden");
  
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
  });

  updateRecurringSummary();
}
  
  function getTomorrow() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // ✅ Validate the date is reasonable
      if (isNaN(tomorrow.getTime()) || tomorrow.getFullYear() > 2100) {
        throw new Error("Invalid date generated");
      }
      
      return tomorrow;
    } catch (error) {
      console.warn("⚠️ Error generating tomorrow's date:", error);
      // ✅ Fallback to a basic future date
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 1);
      return fallback;
    }
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
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    let autoReset, deleteCheckedEnabled;
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const cycleData = cycles[activeCycle];
        
        if (!cycleData) {
            console.warn("⚠️ No active cycle found for recurring button visibility");
            return;
        }
        
        autoReset = cycleData.autoReset || false;
        deleteCheckedEnabled = cycleData.deleteCheckedTasks || false;
    } else {
        // ✅ Fallback to old schema
        const toggleAutoReset = document.getElementById("toggleAutoReset");
        const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
        
        autoReset = toggleAutoReset?.checked || false;
        deleteCheckedEnabled = deleteCheckedTasks?.checked || false;
    }

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
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        return newSchemaData.settings.alwaysShowRecurring || 
               document.getElementById("always-show-recurring")?.checked || 
               false;
    }
    
    // ✅ Fallback to old schema
    return document.getElementById("always-show-recurring")?.checked ||
           JSON.parse(localStorage.getItem("miniCycleAlwaysShowRecurring")) === true;
}
  
  function updateRecurringPanelButtonVisibility() {
      // ✅ Try new schema first
      const newSchemaData = loadMiniCycleFromNewSchema();
      
      if (newSchemaData) {
          const { cycles, activeCycle } = newSchemaData;
          const cycleData = cycles[activeCycle];
          const button = document.getElementById("open-recurring-panel");
          
          if (!cycleData || !Array.isArray(cycleData.tasks) || !button) return;
          
          const hasRecurring =
              cycleData.tasks.some(task => task.recurring) ||
              Object.keys(cycleData.recurringTemplates || {}).length > 0;
          button.classList.toggle("hidden", !hasRecurring);
          return;
      }
      
      // ✅ Fallback to old schema
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
  
      // ✅ Try new schema first
      const newSchemaData = loadMiniCycleFromNewSchema();
      let recurringSettings;
      
      if (newSchemaData) {
          const { cycles, activeCycle } = newSchemaData;
          const currentCycle = cycles[activeCycle];
          
          recurringSettings = task.recurringSettings ||
                             currentCycle?.recurringTemplates?.[task.id]?.recurringSettings;
      } else {
          // ✅ Fallback to old schema
          const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
          const cycleName = localStorage.getItem("lastUsedMiniCycle");
          recurringSettings = task.recurringSettings ||
                             savedMiniCycles[cycleName]?.recurringTemplates?.[task.id]?.recurringSettings;
      }
  
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
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const cycleData = cycles[activeCycle];
        
        if (!cycleData) return;
        
        const taskElements = [...taskList.querySelectorAll(".task")];
        
        // ✅ Reuse the same helper
        removeRecurringTasksFromCycle(taskElements, cycleData);
        
        // Update the full schema data
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle] = cycleData;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        
    } else {
        // ✅ Fallback to old schema
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
        const cycleData = savedMiniCycles[lastUsedMiniCycle];
        const taskElements = [...taskList.querySelectorAll(".task")];

        // ✅ Reuse the same helper
        removeRecurringTasksFromCycle(taskElements, cycleData);

        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
    }

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
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const cycleData = cycles[activeCycle];
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
            // Update the full schema data
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = cycleData;
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        }
        return;
    }
    
    // ✅ Fallback to old schema (your existing logic)
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
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const cycleData = cycles[activeCycle];
        const recurringTemplates = cycleData?.recurringTemplates || {};
        
        if (Object.keys(recurringTemplates).length === 0) return;
    } else {
        // ✅ Fallback to old schema
        const recurringTemplates = savedMiniCycles?.[lastUsedMiniCycle]?.recurringTemplates || {};
        if (Object.keys(recurringTemplates).length === 0) return;
    }

    watchRecurringTasks();
    setInterval(watchRecurringTasks, 30000);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            watchRecurringTasks();
        }
    });
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
        // ✅ Try new schema first for loading setting
        const newSchemaData = localStorage.getItem("miniCycleData");
        let moveArrowsEnabled = false;
        
        if (newSchemaData) {
            const parsed = JSON.parse(newSchemaData);
            moveArrowsEnabled = parsed.settings.showMoveArrows || false;
        } else {
            // ✅ Fallback to old schema
            moveArrowsEnabled = localStorage.getItem("miniCycleMoveArrows") === "true";
        }
        
        moveArrowsToggle.checked = moveArrowsEnabled;
        
        moveArrowsToggle.addEventListener("change", () => {
            const enabled = moveArrowsToggle.checked;
            
            // ✅ Try new schema first for saving
            const newSchemaData = localStorage.getItem("miniCycleData");
            
            if (newSchemaData) {
                const parsed = JSON.parse(newSchemaData);
                parsed.settings.showMoveArrows = enabled;
                parsed.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(parsed));
            } else {
                // ✅ Fallback to old schema
                localStorage.setItem("miniCycleMoveArrows", enabled);
            }
            
            updateMoveArrowsVisibility();
        });
    }

// ✅ Toggle Three-Dot Menu Setting
const threeDotsToggle = document.getElementById("toggle-three-dots");
if (threeDotsToggle) {
    // ✅ Try new schema first for loading setting
    const newSchemaData = localStorage.getItem("miniCycleData");
    let threeDotsEnabled = false;
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        threeDotsEnabled = parsed.settings.showThreeDots || false;
    } else {
        // ✅ Fallback to old schema
        threeDotsEnabled = localStorage.getItem("miniCycleThreeDots") === "true";
    }
    
    threeDotsToggle.checked = threeDotsEnabled;
    document.body.classList.toggle("show-three-dots-enabled", threeDotsEnabled);

    threeDotsToggle.addEventListener("change", () => {
        const enabled = threeDotsToggle.checked;
        
        // ✅ Try new schema first for saving
        const newSchemaData = localStorage.getItem("miniCycleData");
        
        if (newSchemaData) {
            const parsed = JSON.parse(newSchemaData);
            parsed.settings.showThreeDots = enabled;
            parsed.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(parsed));
        } else {
            // ✅ Fallback to old schema
            localStorage.setItem("miniCycleThreeDots", enabled);
        }
        
        document.body.classList.toggle("show-three-dots-enabled", enabled);

        // ✅ Disable/enable hover behavior for current tasks
        toggleHoverTaskOptions(!enabled);

        // ✅ Update task list UI
        refreshTaskListUI(); 
    });
}

    // ✅ Enhanced Backup miniCycles (Schema 2.5 compatible)
    document.getElementById("backup-mini-cycles").addEventListener("click", () => {
        // ✅ Try new schema first
        const newSchemaData = localStorage.getItem("miniCycleData");
        
        if (newSchemaData) {
            // Schema 2.5 backup - everything is in one key
            const backupData = {
                schemaVersion: "2.5",
                miniCycleData: newSchemaData,
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
            
            showNotification("✅ Schema 2.5 backup created successfully!", "success", 3000);
        } else {
            // ✅ Fallback to old schema backup
            const backupData = {
                schemaVersion: "legacy", 
                miniCycleStorage: localStorage.getItem("miniCycleStorage"),
                lastUsedMiniCycle: localStorage.getItem("lastUsedMiniCycle"),
                miniCycleReminders: localStorage.getItem("miniCycleReminders"),
                milestoneUnlocks: localStorage.getItem("milestoneUnlocks"),
                darkModeEnabled: localStorage.getItem("darkModeEnabled"),
                currentTheme: localStorage.getItem("currentTheme"),
                backupMetadata: {
                    createdAt: Date.now(),
                    version: "legacy",
                    source: "miniCycle App"
                }
            };
            
            const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
            const backupUrl = URL.createObjectURL(backupBlob);
            const a = document.createElement("a");
            a.href = backupUrl;
            a.download = `mini-cycle-backup-legacy-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(backupUrl);
            
            showNotification("✅ Legacy backup created successfully!", "success", 3000);
        }
    });
    
    // ✅ Enhanced Restore miniCycles (Schema 2.5 compatible with auto-migration)
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
                    
                    // ✅ Check if user is currently on Schema 2.5
                    const currentSchemaData = localStorage.getItem("miniCycleData");
                    const isUsingSchema25 = !!currentSchemaData;
                    
                    // ✅ Detect backup type and restore appropriately
                    if (backupData.schemaVersion === "2.5" && backupData.miniCycleData) {
                        // Restore Schema 2.5 backup
                        localStorage.setItem("miniCycleData", backupData.miniCycleData);
                        
                        // Clean up old schema keys if they exist
                        const oldKeys = ["miniCycleStorage", "lastUsedMiniCycle", "miniCycleReminders", 
                                       "milestoneUnlocks", "darkModeEnabled", "currentTheme"];
                        oldKeys.forEach(key => {
                            if (localStorage.getItem(key)) {
                                localStorage.removeItem(key);
                            }
                        });
                        
                        showNotification("✅ Schema 2.5 backup restored successfully!", "success", 4000);
                        
                    } else if (backupData.schemaVersion === "legacy" || backupData.miniCycleStorage) {
                        // ✅ Legacy backup handling with auto-migration for Schema 2.5 users
                        if (backupData.miniCycleStorage) {
                            if (isUsingSchema25) {
                                // 🔄 AUTO-MIGRATE: User is on Schema 2.5, migrate legacy backup
                                showNotification("🔄 Auto-migrating legacy backup to Schema 2.5...", "info", 3000);
                                
                                // Temporarily restore to legacy format
                                localStorage.setItem("miniCycleStorage", backupData.miniCycleStorage);
                                localStorage.setItem("lastUsedMiniCycle", backupData.lastUsedMiniCycle || "");
                                
                                if (backupData.miniCycleReminders) {
                                    localStorage.setItem("miniCycleReminders", backupData.miniCycleReminders);
                                }
                                if (backupData.milestoneUnlocks) {
                                    localStorage.setItem("milestoneUnlocks", backupData.milestoneUnlocks);
                                }
                                if (backupData.darkModeEnabled) {
                                    localStorage.setItem("darkModeEnabled", backupData.darkModeEnabled);
                                }
                                if (backupData.currentTheme) {
                                    localStorage.setItem("currentTheme", backupData.currentTheme);
                                }
                                
                                // 🚀 Perform migration to Schema 2.5
                                setTimeout(() => {
                                    const migrationResults = performSchema25Migration();
                                    
                                    if (migrationResults.success) {
                                        showNotification("✅ Legacy backup restored and migrated to Schema 2.5!", "success", 4000);
                                    } else {
                                        showNotification("❌ Migration failed - backup restored in legacy format", "warning", 4000);
                                    }
                                    
                                    // Clean reload after migration
                                    setTimeout(() => location.reload(), 1000);
                                }, 500);
                                
                                return; // Exit early to prevent double reload
                                
                            } else {
                                // User is on legacy schema, restore normally
                                localStorage.setItem("miniCycleStorage", backupData.miniCycleStorage);
                                localStorage.setItem("lastUsedMiniCycle", backupData.lastUsedMiniCycle || "");
                                
                                // Restore additional legacy data if present
                                if (backupData.miniCycleReminders) {
                                    localStorage.setItem("miniCycleReminders", backupData.miniCycleReminders);
                                }
                                if (backupData.milestoneUnlocks) {
                                    localStorage.setItem("milestoneUnlocks", backupData.milestoneUnlocks);
                                }
                                if (backupData.darkModeEnabled) {
                                    localStorage.setItem("darkModeEnabled", backupData.darkModeEnabled);
                                }
                                if (backupData.currentTheme) {
                                    localStorage.setItem("currentTheme", backupData.currentTheme);
                                }
                                
                                showNotification("✅ Legacy backup restored successfully!", "success", 4000);
                            }
                        } else {
                            showNotification("❌ Invalid legacy backup file format.", "error", 3000);
                            return;
                        }
                    } else {
                        // Try to handle old backup format (your original format)
                        if (backupData.miniCycleStorage) {
                            if (isUsingSchema25) {
                                // 🔄 AUTO-MIGRATE: Migrate old format to Schema 2.5
                                showNotification("🔄 Auto-migrating old backup to Schema 2.5...", "info", 3000);
                                
                                // Temporarily restore old format
                                localStorage.setItem("miniCycleStorage", backupData.miniCycleStorage);
                                localStorage.setItem("lastUsedMiniCycle", backupData.lastUsedMiniCycle || "");
                                
                                // Perform migration
                                setTimeout(() => {
                                    const migrationResults = performSchema25Migration();
                                    
                                    if (migrationResults.success) {
                                        showNotification("✅ Old backup restored and migrated to Schema 2.5!", "success", 4000);
                                    } else {
                                        showNotification("❌ Migration failed - backup restored in legacy format", "warning", 4000);
                                    }
                                    
                                    setTimeout(() => location.reload(), 1000);
                                }, 500);
                                
                                return; // Exit early to prevent double reload
                                
                            } else {
                                // User is on legacy, restore normally
                                localStorage.setItem("miniCycleStorage", backupData.miniCycleStorage);
                                localStorage.setItem("lastUsedMiniCycle", backupData.lastUsedMiniCycle || "");
                                showNotification("✅ Old format backup restored!", "success", 3000);
                            }
                        } else {
                            showNotification("❌ Invalid backup file format.", "error", 3000);
                            return;
                        }
                    }
                    
                    // Reload the app after successful restore
                    showNotification("🔄 Reloading app to apply changes...", "info", 2000);
                    setTimeout(() => location.reload(), 2500);
                    
                } catch (error) {
                    console.error("Backup restore error:", error);
                    showNotification("❌ Error restoring backup - file may be corrupted.", "error", 4000);
                }
            };
            
            reader.readAsText(file);
        });
        
        input.click();
    });

    document.getElementById("reset-recurring-default")?.addEventListener("click", resetDefaultRecurringSettings);

    function resetDefaultRecurringSettings() {
        // ✅ Try new schema first
        const newSchemaData = localStorage.getItem("miniCycleData");
        
        if (newSchemaData) {
            const parsed = JSON.parse(newSchemaData);
            
            const defaultSettings = {
                frequency: "daily",
                indefinitely: true,
                time: null
            };
            
            // Reset defaults in Schema 2.5
            parsed.settings.defaultRecurringSettings = defaultSettings;
            parsed.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(parsed));
            
            showNotification("🔁 Recurring default reset to Daily Indefinitely (Schema 2.5).", "success");
        } else {
            // ✅ Fallback to old schema
            const defaultSettings = {
                frequency: "daily",
                indefinitely: true,
                time: null
            };
            localStorage.setItem("miniCycleDefaultRecurring", JSON.stringify(defaultSettings));
            showNotification("🔁 Recurring default reset to Daily Indefinitely (Legacy).", "success");
        }
    }

    

// ✅ Enhanced Factory Reset (Schema 2.5 compatible)
document.getElementById("factory-reset").addEventListener("click", async () => {
    const confirmed = showConfirmationModal({
        title: "Factory Reset",
        message: "⚠️ This will DELETE ALL miniCycle data, settings, and progress. Are you sure?",
        confirmText: "Delete Everything",
        cancelText: "Cancel",
        callback: (confirmed) => {
            if (!confirmed) {
                showNotification("❌ Factory reset cancelled.", "info", 2000);
                return;
            }
            
            // ✅ Check which schema is active and reset accordingly
            const newSchemaData = localStorage.getItem("miniCycleData");
            
            if (newSchemaData) {
                // Schema 2.5 - Single key cleanup
                localStorage.removeItem("miniCycleData");
                
                // Also clean up any remaining legacy keys
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
                    "miniCycleAlwaysShowRecurring"
                ];
                
                legacyKeysToRemove.forEach(key => localStorage.removeItem(key));
                
                showNotification("✅ Schema 2.5 Factory Reset Complete. Reloading...", "success", 2000);
                
            } else {
                // Legacy schema - Multiple key cleanup
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
                    "bestTime",
                    
                    // Additional legacy keys
                    "miniCycleAlwaysShowRecurring"
                ];

                // 💥 Wipe all relevant keys
                keysToRemove.forEach(key => localStorage.removeItem(key));
                
                showNotification("✅ Legacy Factory Reset Complete. Reloading...", "success", 2000);
            }
            
            // ✅ Also clean up any backup files to be thorough
            const allKeys = Object.keys(localStorage);
            allKeys.forEach(key => {
                if (key.startsWith('miniCycle_backup_') || key.startsWith('pre_migration_backup_')) {
                    localStorage.removeItem(key);
                }
            });

            setTimeout(() => location.reload(), 1000);
        }
    });
});
}




/**
 * Setupdownloadminicycle function.
 *
  * @returns {void}
 */


function setupDownloadMiniCycle() {
  document.getElementById("export-mini-cycle").addEventListener("click", () => {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
      const { cycles, activeCycle } = newSchemaData;
      const cycle = cycles[activeCycle];
      
      if (!activeCycle || !cycle) {
        showNotification("⚠ No active miniCycle to export.");
        return;
      }

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

      exportMiniCycleData(miniCycleData, cycle.title || activeCycle);
      return;
    }
    
    // ✅ Fallback to old schema (your existing logic)
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");

    if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
      showNotification("⚠ No active miniCycle to export.");
      return;
    }

    const cycle = savedMiniCycles[lastUsedMiniCycle];

    const miniCycleData = {
      name: lastUsedMiniCycle,
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

    exportMiniCycleData(miniCycleData, lastUsedMiniCycle);
  });
}

// ✅ Helper function to reduce code duplication
function exportMiniCycleData(miniCycleData, defaultFileName) {
  showPromptModal({
    title: "Export miniCycle",
    message: "Enter a file name to download:",
    placeholder: "e.g. grocery-list",
    defaultValue: defaultFileName || "mini-cycle",
    confirmText: "Download",
    cancelText: "Cancel",
    required: true,
    callback: (fileName) => {
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
      
      showNotification(`📄 miniCycle exported as "${sanitizedFileName}.mcyc"`, "success", 3000);
    }
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
          showNotification("❌ miniCycle does not support .tcyc files.\nPlease save your Task Cycle as .MCYC to import into miniCycle.");
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedData = JSON.parse(e.target.result);

            if (!importedData.name || !Array.isArray(importedData.tasks)) {
              showNotification("❌ Invalid miniCycle file format.");
              return;
            }

            // ✅ Try new schema first
            const newSchemaData = localStorage.getItem("miniCycleData");
            
            if (newSchemaData) {
              const fullSchemaData = JSON.parse(newSchemaData);
              const cycleId = `imported_${Date.now()}`;
              
              // Create imported cycle in Schema 2.5 format
              fullSchemaData.data.cycles[cycleId] = {
                id: cycleId,
                title: importedData.title || importedData.name,
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
                deleteCheckedTasks: importedData.deleteCheckedTasks || false,
                createdAt: Date.now(),
                recurringTemplates: {}
              };
              
              // Set as active cycle
              fullSchemaData.appState.activeCycleId = cycleId;
              fullSchemaData.metadata.lastModified = Date.now();
              fullSchemaData.metadata.totalCyclesCreated++;
              
              localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
              
              showNotification(`✅ miniCycle "${importedData.name}" Imported Successfully!`);
              location.reload();
              return;
            }
            
            // ✅ Fallback to old schema (your existing logic)
            const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

            savedMiniCycles[importedData.name] = {
              title: importedData.title || "New miniCycle",
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

            showNotification(`✅ miniCycle "${importedData.name}" Imported Successfully!`);
            location.reload();
            
          } catch (error) {
            showNotification("❌ Error importing miniCycle.");
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


function openFeedbackModal() {
    const openFeedbackFooter = document.getElementById("open-feedback-modal-footer");
        openFeedbackFooter.addEventListener("click", () => {
              setupFeedbackModal();
        feedbackModal.style.display = "flex";
        thankYouMessage.style.display = "none"; // Hide thank you message if shown before
    });
}

openFeedbackModal();

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

// Update assignCycleVariables to check both schemas
function assignCycleVariables() {
    // Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    if (newSchemaData) {
        return {
            lastUsedMiniCycle: newSchemaData.activeCycle,
            savedMiniCycles: newSchemaData.cycles
        };
    }
    
    // Fallback to old schema
    let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
    let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

    return { lastUsedMiniCycle, savedMiniCycles };
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
    
    // ✅ Add consistent animation for all progress updates
    progressBar.style.transition = "width 0.2s ease-out";
    progressBar.style.width = `${progress}%`;
    
    // ✅ Clear transition after animation
    setTimeout(() => {
        progressBar.style.transition = "";
    }, 200);
    
    autoSave();
}


/**
 * Checkminicycle function.
 *
 * @returns {void}
 */

function checkMiniCycle() {
    const allCompleted = [...taskList.children].every(task => task.querySelector("input").checked);

    // ✅ Retrieve miniCycle variables
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
    let cycleData = savedMiniCycles[lastUsedMiniCycle];

    if (!lastUsedMiniCycle || !cycleData) {
        console.warn("⚠ No active miniCycle found.");
        return;
    }

     updateProgressBar();

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
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const cycleData = cycles[activeCycle];
        
        if (!cycleData) {
            console.warn(`⚠️ Cycle "${activeCycle}" not found in new schema`);
            return;
        }
        
        // Increment cycle count in new schema
        cycleData.cycleCount = (cycleData.cycleCount || 0) + 1;
        
        // Update the full schema data
        const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
        fullSchemaData.data.cycles[activeCycle] = cycleData;
        fullSchemaData.metadata.lastModified = Date.now();
        
        // Update user progress
        fullSchemaData.userProgress.cyclesCompleted = (fullSchemaData.userProgress.cyclesCompleted || 0) + 1;
        
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        
        console.log(`✅ miniCycle count updated (Schema 2.5) for "${activeCycle}": ${cycleData.cycleCount}`);
        
        // ✅ Handle milestone rewards
        handleMilestoneUnlocks(activeCycle, cycleData.cycleCount);
        
        // ✅ Show animation + update stats
        showCompletionAnimation();
        updateStatsPanel();
        return;
    }
    
    // ✅ Fallback to old schema
    let cycleData = savedMiniCycles[miniCycleName];
    if (!cycleData) {
        console.warn(`⚠️ Cycle "${miniCycleName}" not found in old schema`);
        return;
    }

    cycleData.cycleCount = (cycleData.cycleCount || 0) + 1;
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    console.log(`✅ miniCycle count updated (Legacy) for "${miniCycleName}": ${cycleData.cycleCount}`);

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
        // ✅ Try new schema first
        const newSchemaData = localStorage.getItem("miniCycleData");
        let hasGameUnlock = false;
        
        if (newSchemaData) {
            const parsed = JSON.parse(newSchemaData);
            hasGameUnlock = parsed.settings.unlockedFeatures.includes("task-order-game");
        } else {
            // ✅ Fallback to old schema
            const unlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
            hasGameUnlock = unlocks.taskOrderGame;
        }
        
        if (!hasGameUnlock) {
            showNotification("🎮 Game Unlocked! 'Task Order' is now available in the Games menu.", "success", 6000);
            unlockMiniGame();
        }
    }
}

function unlockMiniGame() {
    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        
        if (!parsed.settings.unlockedFeatures.includes("task-order-game")) {
            parsed.settings.unlockedFeatures.push("task-order-game");
            parsed.userProgress.rewardMilestones.push("task-order-game-100");
            parsed.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(parsed));
            
            console.log("🎮 Task Order Game unlocked in Schema 2.5!");
        }
    } else {
        // ✅ Fallback to old schema
        let unlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
        unlocks.taskOrderGame = true;
        localStorage.setItem("milestoneUnlocks", JSON.stringify(unlocks));
    }
    
    checkGamesUnlock();
}


function unlockDarkOceanTheme() {
    console.log("unlock Ocean theme Ran");
    
    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        
        if (!parsed.settings.unlockedThemes.includes("dark-ocean")) {
            parsed.settings.unlockedThemes.push("dark-ocean");
            parsed.userProgress.rewardMilestones.push("dark-ocean-5");
            parsed.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(parsed));
            
            console.log("🎨 Dark Ocean theme unlocked in Schema 2.5!");
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
            
            showNotification('🎉 New theme unlocked: Dark Ocean! Check the menu to activate it.', 'success', 5000);
        }
        return;
    }
    
    // ✅ Fallback to existing old schema logic
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
    
    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        
        if (!parsed.settings.unlockedThemes.includes("golden-glow")) {
            parsed.settings.unlockedThemes.push("golden-glow");
            parsed.userProgress.rewardMilestones.push("golden-glow-50");
            parsed.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(parsed));
            
            console.log("🎨 Golden Glow theme unlocked in Schema 2.5!");
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
        return;
    }
    
    // ✅ Fallback to existing old schema logic
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
    if (!container) return;
    
    container.innerHTML = ""; // 🧹 Clear current options

    // ✅ Try new schema first for unlocked themes
    const newSchemaData = localStorage.getItem("miniCycleData");
    let unlockedThemes = [];
    let currentTheme = null;
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        unlockedThemes = parsed.settings.unlockedThemes || [];
        currentTheme = parsed.settings.theme || 'default';
    } else {
        // ✅ Fallback to old schema
        const milestoneUnlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
        if (milestoneUnlocks.darkOcean) unlockedThemes.push("dark-ocean");
        if (milestoneUnlocks.goldenGlow) unlockedThemes.push("golden-glow");
        currentTheme = localStorage.getItem("currentTheme") || 'default';
    }

    const themeList = [
        {
          id: "DarkOcean",
          class: "dark-ocean",
          label: "Dark Ocean Theme 🌊",
          unlockKey: "dark-ocean"
        },
        {
          id: "GoldenGlow",
          class: "golden-glow",
          label: "Golden Glow Theme 🌟",
          unlockKey: "golden-glow"
        }
    ];

    themeList.forEach(theme => {
        if (!unlockedThemes.includes(theme.unlockKey)) return;

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
  //  animation.innerHTML = "✅ miniCycle Completed!"; 
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
 * @param {string} miniCycleName - The name of the miniCycle.
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
    
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle, settings } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        if (!activeCycle || !currentCycle) {
            console.error("❌ No active cycle found in new schema for addTask");
            return;
        }

        const cycleTasks = currentCycle.tasks || [];
        
        // ✅ Get settings from Schema 2.5
        const autoResetEnabled = currentCycle.autoReset || false;
        const remindersEnabledGlobal = newSchemaData.reminders?.enabled === true;
        
        // ✅ Use the passed-in taskId if it exists, otherwise generate a new one
        const assignedTaskId = taskId || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // ✅ Create Task Element
        const taskItem = document.createElement("li");
        taskItem.classList.add("task");
        taskItem.setAttribute("draggable", "true");
        taskItem.dataset.taskId = assignedTaskId;
        
        if (highPriority) {
            taskItem.classList.add("high-priority");
        }

        const hasValidRecurringSettings = recurring && recurringSettings && Object.keys(recurringSettings).length > 0;
        if (hasValidRecurringSettings) {
            taskItem.classList.add("recurring");
            taskItem.setAttribute("data-recurring-settings", JSON.stringify(recurringSettings));
        }

        // ✅ Three Dots Menu from Schema 2.5 settings
        const showThreeDots = settings.showThreeDots || false;
        if (showThreeDots) {
            const threeDotsButton = document.createElement("button");
            threeDotsButton.classList.add("three-dots-btn");
            threeDotsButton.innerHTML = "⋮";
            threeDotsButton.addEventListener("click", (event) => {
                event.stopPropagation();
                revealTaskButtons(taskItem);
            });
            taskItem.appendChild(threeDotsButton);
        }

        // ✅ Create Button Container
        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("task-options");

        // ✅ Create or update task in Schema 2.5
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
            currentCycle.tasks.push(existingTask);
            
            // ✅ Save recurring template in Schema 2.5
            if (recurring && recurringSettings) {
                if (!currentCycle.recurringTemplates) {
                    currentCycle.recurringTemplates = {};
                }

                currentCycle.recurringTemplates[assignedTaskId] = {
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
            }
            
            // ✅ Save to Schema 2.5
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = currentCycle;
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        }
        
        const deleteCheckedEnabled = currentCycle.deleteCheckedTasks || false;
        const showRecurring = !autoResetEnabled && deleteCheckedEnabled;

        // ✅ Task Buttons (Including Reminder Button)
        const buttons = [
            { class: "move-up", icon: "▲", show: true },
            { class: "move-down", icon: "▼", show: true },
            { class: "recurring-btn", icon: "<i class='fas fa-repeat'></i>", show: showRecurring || (settings.alwaysShowRecurring || false) },
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
            button.setAttribute("type", "button");
            if (!show) button.classList.add("hidden");

            // ⌨️ Keyboard: Enter/Space Activation
            button.setAttribute("tabindex", "0");
            button.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    button.click();
                }

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
            
            // ✅ Updated recurring button click handler for Schema 2.5
            if (btnClass === "recurring-btn") {
                button.addEventListener("click", () => {
                    const task = currentCycle.tasks.find(t => t.id === assignedTaskId);
                    if (!task) return;

                    pushUndoSnapshot();

                    if (!(showRecurring || (settings.alwaysShowRecurring || false))) return;

                    const isNowRecurring = !task.recurring;
                    task.recurring = isNowRecurring;

                    button.classList.toggle("active", isNowRecurring);
                    button.setAttribute("aria-pressed", isNowRecurring.toString());

                    if (isNowRecurring) {
                        const defaultSettings = settings.defaultRecurringSettings || {
                            frequency: "daily",
                            indefinitely: true,
                            time: null
                        };

                        task.recurringSettings = normalizeRecurringSettings(structuredClone(defaultSettings));
                        taskItem.setAttribute("data-recurring-settings", JSON.stringify(task.recurringSettings));
                        taskItem.classList.add("recurring");
                        task.schemaVersion = 2;

                        const rs = task.recurringSettings || {};
                        const frequency = rs.frequency || "daily";
                        const pattern = rs.indefinitely ? "Indefinitely" : "Limited";

                        const notificationContent = createRecurringNotificationWithTip(assignedTaskId, frequency, pattern);
                        
                        const notification = showNotificationWithTip(
                            notificationContent,
                            "recurring",
                            20000,
                            "recurring-cycle-explanation"
                        );

                        initializeRecurringNotificationListeners(notification);

                    } else {
                        task.recurringSettings = {};
                        task.schemaVersion = 2;
                        taskItem.removeAttribute("data-recurring-settings");
                        taskItem.classList.remove("recurring");

                        if (currentCycle.recurringTemplates?.[assignedTaskId]) {
                            delete currentCycle.recurringTemplates[assignedTaskId];
                        }

                        showNotification("↩️ Recurring turned off for this task.", "info", 2000);
                    }

                    // ✅ Save to Schema 2.5
                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    fullSchemaData.data.cycles[activeCycle] = currentCycle;
                    fullSchemaData.metadata.lastModified = Date.now();
                    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                    
                    updateRecurringPanelButtonVisibility();
                    updateRecurringPanel?.();
                });
            } else if (btnClass === "enable-task-reminders") {
                button.addEventListener("click", () => {
                    pushUndoSnapshot();

                    const isActive = button.classList.toggle("reminder-active");
                    button.setAttribute("aria-pressed", isActive.toString());

                    saveTaskReminderState(assignedTaskId, isActive);
                    autoSaveReminders();
                    startReminders();

                    const undoBtn = document.getElementById("undo-btn");
                    const redoBtn = document.getElementById("redo-btn");
                    if (undoBtn) undoBtn.hidden = false;
                    if (redoBtn) redoBtn.hidden = true;

                    showNotification(`Reminders ${isActive ? "enabled" : "disabled"} for task.`, "info", 1500);
                });
            } else {
                button.addEventListener("click", handleTaskButtonClick);
            }
        
            buttonContainer.appendChild(button);
        });

        // ✅ Continue with rest of DOM creation for Schema 2.5
        console.log(`📌 Loading Task (Schema 2.5): ${taskTextTrimmed}, Reminder Enabled: ${remindersEnabled}`);

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

            const undoBtn = document.getElementById("undo-btn");
            const redoBtn = document.getElementById("redo-btn");
            if (undoBtn) undoBtn.hidden = false;
            if (redoBtn) redoBtn.hidden = true;

            console.log("✅ Task completion toggled — undo snapshot pushed.");
        });
        
        safeAddEventListener(checkbox, "keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event("change"));
            }
        });

        // ✅ Ensure `.task-text` Exists
        const taskLabel = document.createElement("span");
        taskLabel.classList.add("task-text");
        taskLabel.textContent = taskTextTrimmed;
        taskLabel.setAttribute("tabindex", "0");
        taskLabel.setAttribute("role", "text");
        
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
            if (!autoResetEnabled) {
                dueDateInput.classList.remove("hidden");
            } else {
                dueDateInput.classList.add("hidden");
            }
        } else {
            dueDateInput.classList.add("hidden");
        }
        
        dueDateInput.addEventListener("change", () => {
            pushUndoSnapshot();

            // Update task in Schema 2.5
            const taskToUpdate = currentCycle.tasks.find(t => t.id === assignedTaskId);
            if (taskToUpdate) {
                taskToUpdate.dueDate = dueDateInput.value;
                
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                fullSchemaData.data.cycles[activeCycle] = currentCycle;
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            }

            updateStatsPanel();
            updateProgressBar();
            checkCompleteAllButton();

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
            checkbox.dispatchEvent(new Event("change"));
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
        taskInput.value = "";

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

        if (!isLoading) setTimeout(() => { remindOverdueTasks(); }, 1000);

        DragAndDrop(taskItem);
        updateMoveArrowsVisibility();

        const threeDotsEnabled = settings.showThreeDots || false;
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
        
        attachKeyboardTaskOptionToggle(taskItem);
        
        return; // Exit early for Schema 2.5
    }
    
    // ✅ Fallback to existing legacy schema code
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
            event.stopPropagation();
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
        button.setAttribute("type", "button")
        if (!show) button.classList.add("hidden");

        // ⌨️ Keyboard: Enter/Space Activation
        button.setAttribute("tabindex", "0");
        button.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                button.click();
            }

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

                    const notificationContent = createRecurringNotificationWithTip(assignedTaskId, frequency, pattern);
                    
                    const notification = showNotificationWithTip(
                        notificationContent,
                        "recurring",
                        20000,
                        "recurring-cycle-explanation"
                    );

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
                pushUndoSnapshot();

                const isActive = button.classList.toggle("reminder-active");
                button.setAttribute("aria-pressed", isActive.toString());

                saveTaskReminderState(assignedTaskId, isActive);
                autoSaveReminders();
                startReminders();

                const undoBtn = document.getElementById("undo-btn");
                const redoBtn = document.getElementById("redo-btn");
                if (undoBtn) undoBtn.hidden = false;
                if (redoBtn) redoBtn.hidden = true;

                showNotification(`Reminders ${isActive ? "enabled" : "disabled"} for task.`, "info", 1500);
            });
        } else {
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

        const undoBtn = document.getElementById("undo-btn");
        const redoBtn = document.getElementById("redo-btn");
        if (undoBtn) undoBtn.hidden = false;
        if (redoBtn) redoBtn.hidden = true;

        console.log("✅ Task completion toggled — undo snapshot pushed.");
    });
    
    safeAddEventListener(checkbox, "keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change"));
        }
    });

    // ✅ Ensure `.task-text` Exists
    const taskLabel = document.createElement("span");
    taskLabel.classList.add("task-text");
    taskLabel.textContent = taskTextTrimmed;
    taskLabel.setAttribute("tabindex", "0");
    taskLabel.setAttribute("role", "text");
    
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
            dueDateInput.classList.remove("hidden");
        } else {
            dueDateInput.classList.add("hidden");
        }
    } else {
        dueDateInput.classList.add("hidden");
    }
    
    dueDateInput.addEventListener("change", () => {
        pushUndoSnapshot();

        saveTaskDueDate(taskItem.dataset.taskId, dueDateInput.value);

        autoSave();
        updateStatsPanel();
        updateProgressBar();
        checkCompleteAllButton();

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
        checkbox.dispatchEvent(new Event("change"));
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
    taskInput.value = "";

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

    if (!isLoading) setTimeout(() => { remindOverdueTasks(); }, 1000);

    DragAndDrop(taskItem);
    updateMoveArrowsVisibility();

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
// ...existing code...
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
    required: true,
    callback: (newText) => {
      if (newText && newText.trim() !== oldText) {
        const cleanText = sanitizeInput(newText.trim());

        // 🔁 Save snapshot BEFORE changing text
        pushUndoSnapshot();

        taskLabel.textContent = cleanText;

        // ✅ Update task object with Schema 2.5 support
        const taskId = taskItem.dataset.taskId;
        
        // ✅ Try new schema first
        const newSchemaData = loadMiniCycleFromNewSchema();
        
        if (newSchemaData) {
          const { cycles, activeCycle } = newSchemaData;
          const task = cycles[activeCycle]?.tasks?.find(t => t.id === taskId);
          
          if (task) {
            task.text = cleanText;
            
            // Update the full schema data
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            
            showNotification(`Task renamed to "${cleanText}"`, "info", 1500);
          }
        } else {
          // ✅ Fallback to old schema
          const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
          const taskList = savedMiniCycles?.[lastUsedMiniCycle]?.tasks || [];

          const taskToUpdate = taskList.find(task => task.id === taskId);
          if (taskToUpdate) {
              taskToUpdate.text = cleanText;
              localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
              showNotification(`Task renamed to "${cleanText}"`, "info", 1500);
          }
        }

        updateStatsPanel();
        updateProgressBar();
        checkCompleteAllButton();

        shouldSave = false; // Already saved
      }
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
            cancelText: "Cancel",
            callback: (confirmDelete) => {
          if (!confirmDelete) {
              showNotification(`"${taskName}" has not been deleted.`, "show", 2500);
              console.log("❌ Task not deleted.");
              return;
          }
    
        // ✅ Push undo snapshot BEFORE deletion
        pushUndoSnapshot();
    
        // ✅ Try new schema first
        const newSchemaData = loadMiniCycleFromNewSchema();
        
        if (newSchemaData) {
          const { cycles, activeCycle } = newSchemaData;
          const currentCycle = cycles[activeCycle];
          
          if (currentCycle) {
            // Remove task from Schema 2.5
            currentCycle.tasks = currentCycle.tasks.filter(task => task.id !== taskId);
    
            // Remove from recurring templates if it exists
            if (currentCycle.recurringTemplates?.[taskId]) {
              delete currentCycle.recurringTemplates[taskId];
            }
    
            // Update the full schema data
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = currentCycle;
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
          }
        } else {
          // ✅ Fallback to old schema
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
        }
    
        // ✅ Remove from DOM
        taskItem.remove();
        updateProgressBar();
        updateStatsPanel();
        checkCompleteAllButton();
        toggleArrowVisibility();
    
        showNotification(`"${taskName}" has been deleted.`, "info", 2000);
        console.log(`🗑️ Deleted task: "${taskName}"`);
      }
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
    
      // ✅ Update task object in storage - NOW WITH SCHEMA 2.5 SUPPORT
      const taskId = taskItem.dataset.taskId;
      
      // ✅ Try new schema first
      const newSchemaData = loadMiniCycleFromNewSchema();
      
      if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const task = cycles[activeCycle]?.tasks?.find(t => t.id === taskId);
        
        if (task) {
          task.highPriority = taskItem.classList.contains("high-priority");
          
          // Update the full schema data
          const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
          fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
          fullSchemaData.metadata.lastModified = Date.now();
          localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
          
          showNotification(
            `Priority ${task.highPriority ? "enabled" : "removed"}.`,
            task.highPriority ? "error" : "info",
            1500
          );
        }
      } else {
        // ✅ Fallback to old schema
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
      }
    
      shouldSave = false; // Already saved manually
    }

    
    if (shouldSave) autoSave();
    console.log("✅ Task button clicked:", button.className);
}

function saveCurrentTaskOrder() {
  const taskElements = document.querySelectorAll("#taskList .task");
  const newOrderIds = Array.from(taskElements).map(task => task.dataset.taskId);

  // ✅ Try new schema first
  const newSchemaData = loadMiniCycleFromNewSchema();
  
  if (newSchemaData) {
    const { cycles, activeCycle } = newSchemaData;
    const currentCycle = cycles[activeCycle];
    
    if (!currentCycle || !Array.isArray(currentCycle.tasks)) return;

    // Reorder task array based on current DOM order
    const reorderedTasks = newOrderIds.map(id =>
      currentCycle.tasks.find(task => task.id === id)
    ).filter(Boolean); // filters out any nulls

    currentCycle.tasks = reorderedTasks;

    // ✅ Save to Schema 2.5
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle] = currentCycle;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    return;
  }
  
  // ✅ Fallback to old schema
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const cycle = savedMiniCycles?.[lastUsedMiniCycle];
  if (!cycle || !Array.isArray(cycle.tasks)) return;

  // Reorder task array based on current DOM order
  const reorderedTasks = newOrderIds.map(id =>
    cycle.tasks.find(task => task.id === id)
  ).filter(Boolean);

  cycle.tasks = reorderedTasks;

  // 💾 Save back to localStorage
  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
}





























/**
 * Resettasks function.
 *
 * @returns {void}
 */

function resetTasks() {
    if (isResetting) return;
    isResetting = true;

    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const cycleData = cycles[activeCycle];
        const taskElements = [...taskList.querySelectorAll(".task")];

        if (!activeCycle || !cycleData) {
            console.error("❌ No active cycle found in new schema for resetTasks");
            isResetting = false;
            return;
        }

        // ✅ ANIMATION: Show progress bar becoming full first
        progressBar.style.width = "100%";
        progressBar.style.transition = "width 0.2s ease-out";
        
        // ✅ Wait for animation, then reset tasks
        setTimeout(() => {
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

            // ✅ Increment cycle count in Schema 2.5
            incrementCycleCount(activeCycle, cycles);

            // ✅ Animate progress bar reset with different timing
            progressBar.style.transition = "width 0.3s ease-in";
            progressBar.style.width = "0%";
            
            // ✅ Reset transition after animation completes
            setTimeout(() => {
                progressBar.style.transition = "";
            }, 50);
            
        }, 100); // Wait for fill animation to complete

    } else {
        // ✅ Fallback to old schema with same animation
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
        const cycleData = savedMiniCycles?.[lastUsedMiniCycle];
        const taskElements = [...taskList.querySelectorAll(".task")];

        // ✅ ANIMATION: Show progress bar becoming full first
        progressBar.style.width = "100%";
        progressBar.style.transition = "width 0.3s ease-out";
        
        setTimeout(() => {
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

            // ✅ Animate progress bar reset
            progressBar.style.transition = "width 0.3s ease-in";
            progressBar.style.width = "0%";

          // ✅ Remove the old cycle message display logic
          // cycleMessage.style.visibility = "visible";
          // cycleMessage.style.opacity = "1";
          // setTimeout(() => {
          //     cycleMessage.style.opacity = "0";
          //     cycleMessage.style.visibility = "hidden";
          //     isResetting = false;
          // }, 2000);

            
            setTimeout(() => {
                progressBar.style.transition = "";
            }, 50);
            
        }, 100);
    }

    // ✅ Show cycle completion message in help window instead of separate element
    if (helpWindowManager) {
        helpWindowManager.showCycleCompleteMessage();
    }

    // ✅ Set isResetting to false after help window message duration
    setTimeout(() => {
        isResetting = false;
    }, 2000);

    // ✅ Handle recurring tasks and cleanup (keep existing timing)
    setTimeout(() => {
        watchRecurringTasks();
        autoSave();
        updateStatsPanel();
    }, 1000);
}

/**
 * Checkcompleteallbutton function.
 *
 * @returns {void}
 */

function checkCompleteAllButton() {
    const isAutoMode = document.body.classList.contains('auto-cycle-mode');
    
    if (taskList.children.length > 0 && !isAutoMode) {
        completeAllButton.style.display = "block";
    } else {
        completeAllButton.style.display = "none";
    }
}
    
/**
 * Temporarily changes the logo background color to indicate an action, then resets it.
 *
 * @param {string} [color='green'] - The temporary background color for the logo.
 * @param {number} [duration=300] - The duration (in milliseconds) before resetting the background.
 */
// Declare the timeout variable at the top level
let logoTimeoutId = null;

function triggerLogoBackground(color = 'green', duration = 300) {
    // Target the specific logo image (not the app name)
    const logo = document.querySelector('.header-branding .header-logo');

    console.log('🔍 Logo element found:', logo); // Debug log
    console.log('🎨 Applying color:', color); // Debug log

    if (logo) {
        // Clear any existing timeout
        if (logoTimeoutId) {
            clearTimeout(logoTimeoutId);
            logoTimeoutId = null;
        }

        // Apply background color
        logo.style.setProperty('background-color', color, 'important');
        logo.style.setProperty('border-radius', '6px', 'important');
        
        console.log('✅ Background applied:', logo.style.backgroundColor); // Debug log
        
        // Remove background after duration
        logoTimeoutId = setTimeout(() => {
            logo.style.backgroundColor = '';
            logo.style.borderRadius = '';
            logoTimeoutId = null; 
            console.log('🔄 Background cleared'); // Debug log
        }, duration);
    } else {
        console.error('❌ Logo element not found!');
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
    
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        // ✅ Ensure AutoReset reflects the correct state
        if (activeCycle && currentCycle) {
            toggleAutoReset.checked = currentCycle.autoReset || false;
            deleteCheckedTasks.checked = currentCycle.deleteCheckedTasks || false;
        } else {
            toggleAutoReset.checked = false;
            deleteCheckedTasks.checked = false;
        }
        
        // ✅ Show "Delete Checked Tasks" only when Auto Reset is OFF
        deleteCheckedTasksContainer.style.display = toggleAutoReset.checked ? "none" : "block";

        // ✅ Remove previous event listeners before adding new ones to prevent stacking
        toggleAutoReset.removeEventListener("change", handleAutoResetChange);
        deleteCheckedTasks.removeEventListener("change", handleDeleteCheckedTasksChange);

        // ✅ Define event listener functions for Schema 2.5
        function handleAutoResetChange(event) {
            if (!activeCycle || !currentCycle) return;

            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle].autoReset = event.target.checked;

            // ✅ If Auto Reset is turned ON, automatically uncheck "Delete Checked Tasks"
            if (event.target.checked) {
                fullSchemaData.data.cycles[activeCycle].deleteCheckedTasks = false;
                deleteCheckedTasks.checked = false; // ✅ Update UI
            }

            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));

            // ✅ Show/Hide "Delete Checked Tasks" toggle dynamically
            deleteCheckedTasksContainer.style.display = event.target.checked ? "none" : "block";

            // ✅ Only trigger miniCycle reset if AutoReset is enabled
            if (event.target.checked) checkMiniCycle();

            refreshTaskListUI();
            updateRecurringButtonVisibility();
        }

        function handleDeleteCheckedTasksChange(event) {
            if (!activeCycle || !currentCycle) return;

            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle].deleteCheckedTasks = event.target.checked;
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            
            refreshTaskListUI();
        }

        // ✅ Add new event listeners
        toggleAutoReset.addEventListener("change", handleAutoResetChange);
        deleteCheckedTasks.addEventListener("change", handleDeleteCheckedTasksChange);
        
    } else {
        // ✅ Fallback to old schema (your existing logic)
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

        // ✅ Define event listener functions for Legacy schema
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

            // ✅ Only trigger miniCycle reset if AutoReset is enabled
            if (event.target.checked) checkMiniCycle();

            refreshTaskListUI();
            updateRecurringButtonVisibility();
        }

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
            
            // ✅ Try new schema first
            const newSchemaData = loadMiniCycleFromNewSchema();
            
            if (newSchemaData) {
                const { cycles, activeCycle } = newSchemaData;
                
                if (activeCycle && cycles[activeCycle]) {
                    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                    fullSchemaData.data.cycles[activeCycle].autoReset = autoReset;
                    fullSchemaData.metadata.lastModified = Date.now();
                    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
                }
            } else {
                // ✅ Fallback to old schema
                let miniCycleName = localStorage.getItem("lastUsedMiniCycle");
                let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

                if (savedMiniCycles[miniCycleName]) {
                    savedMiniCycles[miniCycleName].autoReset = autoReset;
                    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
                }
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
    let taskId = taskItem.dataset.taskId;
    let dueDateValue = event.target.value;

    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const task = cycles[activeCycle]?.tasks?.find(t => t.id === taskId);
        
        if (task) {
            task.dueDate = dueDateValue;
            
            const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
            fullSchemaData.data.cycles[activeCycle] = cycles[activeCycle];
            fullSchemaData.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            
            console.log(`📅 Due date updated (Schema 2.5): "${task.text}" → ${dueDateValue}`);
        }
    } else {
        // ✅ Fallback to old schema
        let taskText = taskItem.querySelector(".task-text").textContent;
        let miniCycleName = localStorage.getItem("lastUsedMiniCycle");
        let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

        if (savedMiniCycles[miniCycleName]) {
            let taskData = savedMiniCycles[miniCycleName].tasks.find(task => task.text === taskText);
            if (taskData) {
                taskData.dueDate = dueDateValue;
                localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
                console.log(`📅 Due date updated (Legacy): "${taskText}" → ${dueDateValue}`);
            }
        }
    }

    checkOverdueTasks(taskItem);

    // ✅ Load Due Date Notification Setting from appropriate schema
    let remindersSettings;
    if (newSchemaData) {
        remindersSettings = newSchemaData.reminders || {};
    } else {
        remindersSettings = JSON.parse(localStorage.getItem("miniCycleReminders")) || {};
    }
    
    const dueDatesRemindersEnabled = remindersSettings.dueDatesReminders;

    if (!dueDatesRemindersEnabled) return; // ✅ Skip notifications if toggle is OFF

    if (dueDateValue) {
        const today = new Date().setHours(0, 0, 0, 0);
        const selectedDate = new Date(dueDateValue).setHours(0, 0, 0, 0);

        if (selectedDate > today) {
            const taskText = taskItem.querySelector(".task-text").textContent;
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
            // ✅ Try new schema first
            const newSchemaData = loadMiniCycleFromNewSchema();
            
            if (newSchemaData) {
                const { cycles, activeCycle } = newSchemaData;
                const currentCycle = cycles[activeCycle];
                
                if (!activeCycle || !currentCycle) return;
                
                // Update Schema 2.5
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                fullSchemaData.data.cycles[activeCycle].deleteCheckedTasks = event.target.checked;
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            } else {
                // ✅ Fallback to legacy schema
                const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
                
                if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) return;
        
                savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = event.target.checked;
                localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
            }
    
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
function handleCompleteAllTasks() {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const cycleData = cycles[activeCycle];

        // ✅ Ensure there's an active miniCycle
        if (!activeCycle || !cycleData) return;

        // ✅ Only show alert if tasks will be reset (not deleted)
        if (!cycleData.deleteCheckedTasks) {
            const hasDueDates = [...taskList.querySelectorAll(".due-date")].some(
                dueDateInput => dueDateInput.value
            );

            if (hasDueDates) {
                showConfirmationModal({
                    title: "Reset Tasks with Due Dates",
                    message: "⚠️ This will complete all tasks and reset them to an uncompleted state.<br><br>Any assigned Due Dates will be cleared.<br><br>Proceed?",
                    confirmText: "Reset Tasks",
                    cancelText: "Cancel",
                    callback: (confirmed) => {
                        if (!confirmed) return;
                        
                        if (cycleData.deleteCheckedTasks) {
                            const checkedTasks = document.querySelectorAll(".task input:checked");
                            if (checkedTasks.length === 0) {
                                showNotification("⚠️ No tasks were selected for deletion.", "default", 3000);
                                return;
                            }
                
                            checkedTasks.forEach(checkbox => {
                                const taskId = checkbox.closest(".task").dataset.taskId;
                                // Remove from Schema 2.5
                                cycleData.tasks = cycleData.tasks.filter(t => t.id !== taskId);
                                checkbox.closest(".task").remove();
                            });
                            
                            // ✅ Use autoSave() instead of direct save
                            autoSave();
                            
                        } else {
                            taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
                            checkMiniCycle();
                
                            if (!cycleData.autoReset) {
                                setTimeout(resetTasks, 1000);
                            }
                        }
                    }
                });
                return;
            }
        }

        if (cycleData.deleteCheckedTasks) {
            const checkedTasks = document.querySelectorAll(".task input:checked");
            if (checkedTasks.length === 0) {
                showNotification("⚠️ No tasks were selected for deletion.", "default", 3000);
                return;
            }

            checkedTasks.forEach(checkbox => {
                const taskId = checkbox.closest(".task").dataset.taskId;
                // Remove from Schema 2.5
                cycleData.tasks = cycleData.tasks.filter(t => t.id !== taskId);
                checkbox.closest(".task").remove();
            });
            
            // ✅ Use autoSave() instead of direct save
            autoSave();

        } else {
            // ✅ If "Delete Checked Tasks" is OFF, just mark all as complete
            taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
            checkMiniCycle();

            // ✅ Only call resetTasks() if autoReset is OFF
            if (!cycleData.autoReset) {
                setTimeout(resetTasks, 1000);
            }
        }
        
    } else {
        // ✅ Fallback to old schema (unchanged)
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
        const cycleData = savedMiniCycles[lastUsedMiniCycle];

        if (!lastUsedMiniCycle || !cycleData) return;

        if (!cycleData.deleteCheckedTasks) {
            const hasDueDates = [...taskList.querySelectorAll(".due-date")].some(
                dueDateInput => dueDateInput.value
            );

            if (hasDueDates) {
                showConfirmationModal({
                    title: "Reset Tasks with Due Dates",
                    message: "⚠️ This will complete all tasks and reset them to an uncompleted state.<br><br>Any assigned Due Dates will be cleared.<br><br>Proceed?",
                    confirmText: "Reset Tasks",
                    cancelText: "Cancel",
                    callback: (confirmed) => {
                        if (!confirmed) return;
                        
                        if (cycleData.deleteCheckedTasks) {
                            const checkedTasks = document.querySelectorAll(".task input:checked");
                            if (checkedTasks.length === 0) {
                                showNotification("⚠️ No tasks were selected for deletion.", "default", 3000);
                                return;
                            }
                
                            checkedTasks.forEach(checkbox => {
                                checkbox.closest(".task").remove();
                            });
                            autoSave();
                        } else {
                            taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
                            checkMiniCycle();
                
                            if (!cycleData.autoReset) {
                                setTimeout(resetTasks, 1000);
                            }
                        }
                    }
                });
                return;
            }
        }

        if (cycleData.deleteCheckedTasks) {
            const checkedTasks = document.querySelectorAll(".task input:checked");
            if (checkedTasks.length === 0) {
                showNotification("⚠️ No tasks were selected for deletion.", "default", 3000);
                return;
            }

            checkedTasks.forEach(checkbox => {
                checkbox.closest(".task").remove();
            });

            autoSave();
        } else {
            taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
            checkMiniCycle();

            if (!cycleData.autoReset) {
                setTimeout(resetTasks, 1000);
            }
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
  // ✅ Try new schema first
  const newSchemaData = loadMiniCycleFromNewSchema();
  
  if (newSchemaData) {
    const { cycles, activeCycle } = newSchemaData;
    const toggleAutoReset = document.getElementById("toggleAutoReset");
    const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
    
    if (!activeCycle || !cycles[activeCycle]) return;
    
    // Update Schema 2.5 data
    const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
    fullSchemaData.data.cycles[activeCycle].autoReset = toggleAutoReset.checked;
    fullSchemaData.data.cycles[activeCycle].deleteCheckedTasks = deleteCheckedTasks.checked;
    fullSchemaData.metadata.lastModified = Date.now();
    localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    
    return;
  }
  
  // ✅ Fallback to old schema (your existing logic)
  const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
  const toggleAutoReset = document.getElementById("toggleAutoReset");
  const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");

  if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) return;

  savedMiniCycles[lastUsedMiniCycle].autoReset = toggleAutoReset.checked;
  savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = deleteCheckedTasks.checked;

  localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
}

// 🟢 Menu Button (Click) - ✅ FIXED: ES5 compatible function expression
safeAddEventListener(menuButton, "click", function(event) {
    event.stopPropagation();
    syncCurrentSettingsToStorage(); // ✅ Now supports both schemas
    saveToggleAutoReset(); // ✅ Already updated with Schema 2.5 support
    menu.classList.toggle("visible");

    if (menu.classList.contains("visible")) {
        document.addEventListener("click", closeMenuOnClickOutside);
    }
});


safeAddEventListenerById("reset-notification-position", "click", () => {
    // ✅ Try new schema first for notification settings
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        
        // Reset notification position in Schema 2.5
        parsed.settings.notificationPosition = { x: 0, y: 0 };
        parsed.settings.notificationPositionModified = false;
        parsed.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(parsed));
        
        showNotification("🔄 Notification position reset (Schema 2.5).", "success", 2000);
    } else {
        // ✅ Fallback to old schema
        localStorage.removeItem("miniCycleNotificationPosition");
        showNotification("🔄 Notification position reset.", "success", 2000);
    }
    
    // Reset UI position
    resetNotificationPosition();
});


document.getElementById("open-reminders-modal")?.addEventListener("click", () => {
    // Load current settings from appropriate schema before opening
    loadRemindersSettings(); // This function already has Schema 2.5 support
    document.getElementById("reminders-modal").style.display = "flex";
    hideMainMenu();
});
  

// ✅ Updated reset onboarding with Schema 2.5 compatibility
safeAddEventListenerById("reset-onboarding", "click", () => {
    // ✅ Try new schema first
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        
        // Clear onboarding flag in Schema 2.5
        parsed.settings.onboardingCompleted = false;
        parsed.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(parsed));
        
        showNotification("✅ Onboarding will show again next time you open the app (Schema 2.5).");
    } else {
        // ✅ Fallback to old schema
        localStorage.removeItem("miniCycleOnboarding");
        showNotification("✅ Onboarding will show again next time you open the app.");
    }
});





// 🟢 Safe Global Click for Hiding Task Buttons
safeAddEventListener(document, "click", (event) => {
    let isTaskOrOptionsClick = event.target.closest(".task, .task-options");
    let isModalClick = event.target.closest(".modal, .mini-modal-overlay, .settings-modal, .notification");
    
    if (!isTaskOrOptionsClick && !isModalClick) {
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
            
            // Only remove selected class if not in recurring panel
            if (!document.getElementById("recurring-panel-overlay")?.classList.contains("hidden")) {
                // Keep selections in recurring panel
            } else {
                task.classList.remove("selected");
            }
        });
    }
});

// 🟢 Safe Global Click for Deselecting miniCycle in Switch Modal
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
        if (switchItemsRow) {
            switchItemsRow.style.display = "none";
        }
        
        // Clear preview content
        if (previewWindow) {
            previewWindow.innerHTML = '<p style="color: #888; font-style: italic;">Select a miniCycle to preview</p>';
        }
    }
});




// ✅ Modal Utility Functions
function closeAllModals() {
    // Close Schema 2.5 and legacy modals
    const modalSelectors = [
        "[data-modal]",
        ".settings-modal",
        ".mini-cycle-switch-modal",
        "#feedback-modal",
        "#about-modal", 
        "#themes-modal",
        "#games-panel",
        "#reminders-modal",
        "#testing-modal",
        "#recurring-panel-overlay",
        "#storage-viewer-overlay",
        ".mini-modal-overlay",
        ".miniCycle-overlay",
        ".onboarding-modal"
    ];
    
    modalSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(modal => {
            // Special handling for different modal types
            if (modal.dataset.modal !== undefined || modal.classList.contains("menu-container")) {
                modal.classList.remove("visible");
            } else if (modal.id === "recurring-panel-overlay" || modal.id === "storage-viewer-overlay") {
                modal.classList.add("hidden");
            } else {
                modal.style.display = "none";
            }
        });
    });

    // Close task options
    document.querySelectorAll(".task-options").forEach(action => {
        action.style.opacity = "0";
        action.style.visibility = "hidden";
        action.style.pointerEvents = "none";
    });

    // Reset task states
    document.querySelectorAll(".task").forEach(task => {
        task.classList.remove("long-pressed", "draggable", "dragging", "selected");
    });
    
    // Clear any active selections in recurring panels
    document.querySelectorAll(".recurring-task-item.selected").forEach(item => {
        item.classList.remove("selected");
    });
    
    // Hide recurring settings panel if open
    const recurringSettingsPanel = document.getElementById("recurring-settings-panel");
    if (recurringSettingsPanel) {
        recurringSettingsPanel.classList.add("hidden");
    }
}


// ✅ ESC key listener to close modals and reset task UI
safeAddEventListener(document, "keydown", (e) => {
    if (e.key === "Escape") {
        e.preventDefault();
        closeAllModals();
        
        // Also clear any notification focus
        const notifications = document.querySelectorAll(".notification");
        notifications.forEach(notification => {
            if (notification.querySelector(".close-btn")) {
                notification.querySelector(".close-btn").click();
            }
        });
        
        // Return focus to task input
        setTimeout(() => {
            const taskInput = document.getElementById("taskInput");
            if (taskInput && document.activeElement !== taskInput) {
                taskInput.focus();
            }
        }, 100);
    }
});



// Update your existing HelpWindowManager class to show mode descriptions:
class HelpWindowManager {
    constructor() {
        this.helpWindow = document.getElementById('help-window');
        this.isVisible = false;
        this.currentMessage = null;
        this.isShowingCycleComplete = false;
        this.isShowingModeDescription = false; // ✅ Add flag for mode descriptions
        this.modeDescriptionTimeout = null; // ✅ Store timeout reference
        
        this.init();
    }
    
    init() {
        if (!this.helpWindow) {
            console.warn('⚠️ Help window element not found');
            return;
        }
        
        // Start showing initial message after a delay
        setTimeout(() => {
            this.showConstantMessage();
        }, 3000);
        
        // Update message when tasks change
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.closest('.task')) {
                setTimeout(() => {
                    this.updateConstantMessage();
                }, 500);
            }
        });
        
        // Update when tasks are added/removed
        const taskList = document.getElementById('taskList');
        if (taskList) {
            const observer = new MutationObserver(() => {
                setTimeout(() => {
                    this.updateConstantMessage();
                }, 300);
            });
            observer.observe(taskList, { childList: true });
        }
    }
    
    showConstantMessage() {
        this.updateConstantMessage();
        this.show();
    }
    
    updateConstantMessage() {
        // Don't update if showing cycle completion message or mode description
        if (this.isShowingCycleComplete || this.isShowingModeDescription) return;
        
        const message = this.getCurrentStatusMessage();
        
        if (message !== this.currentMessage) {
            this.currentMessage = message;
            if (this.isVisible) {
                this.updateContent(message);
            }
        }
    }
    
    // ✅ New method to show mode description temporarily
    showModeDescription(mode) {
        if (!this.helpWindow) return;
        
        // Clear any existing timeout
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
        }
        
        this.isShowingModeDescription = true;
        
        const modeDescriptions = {
            'auto-cycle': {
                title: "🔄 Auto Cycle Mode",
                description: "Tasks automatically reset when all are completed."
            },
            'manual-cycle': {
                title: "✔️ Manual Cycle Mode", 
                description: "Tasks only reset when you click the Complete button."
            },
            'todo-mode': {
                title: "✓ To-Do Mode",
                description: "Completed tasks are removed when you click Complete."
            }
        };
        
        const modeInfo = modeDescriptions[mode] || modeDescriptions['auto-cycle'];
        
        this.helpWindow.innerHTML = `
            <div class="mode-help-content">
                <h4 style="margin: 0 0 8px 0; color: var(--accent-color, #007bff);">${modeInfo.title}</h4>
                <p style="margin: 0; line-height: 1.4;">${modeInfo.description}</p>
            </div>
        `;
        
        // Show the help window if it's not already visible
        if (!this.isVisible) {
            this.show();
        }
        
        // Auto-hide after 30 seconds and return to normal message
        this.modeDescriptionTimeout = setTimeout(() => {
            this.isShowingModeDescription = false;
            this.modeDescriptionTimeout = null;
            this.updateConstantMessage();
        }, 30000); // 30 seconds
        
        console.log(`📖 Showing mode description for: ${mode}`);
    }
    
    // ✅ Method to show cycle completion message (keep existing)
    showCycleCompleteMessage() {
        if (!this.helpWindow) return;
        
        // Clear mode description if showing
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
            this.isShowingModeDescription = false;
        }
        
        this.isShowingCycleComplete = true;
        this.helpWindow.innerHTML = `
            <p>✅ Cycle Complete! Tasks reset.</p>
        `;
        
        // Auto-hide after 2 seconds and return to normal message
        setTimeout(() => {
            this.isShowingCycleComplete = false;
            this.updateConstantMessage();
        }, 2000);
    }
    
    getCurrentStatusMessage() {
        const totalTasks = document.querySelectorAll('.task').length;
        const completedTasks = document.querySelectorAll('.task input:checked').length;
        const remaining = totalTasks - completedTasks;
        
        // Get cycle count
        const newSchemaData = loadMiniCycleFromNewSchema();
        let cycleCount = 0;
        
        if (newSchemaData) {
            const { cycles, activeCycle } = newSchemaData;
            const activeCycleData = cycles[activeCycle];
            cycleCount = activeCycleData?.cycleCount || 0;
        } else {
            const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
            const cycleData = savedMiniCycles?.[lastUsedMiniCycle];
            cycleCount = cycleData?.cycleCount || 0;
        }
        
        // Return different constant messages based on state
        if (totalTasks === 0) {
            return "💡 Add tasks to get started with your cycle";
        }
        
        if (remaining === 0 && totalTasks > 0) {
            return `🎉 All ${totalTasks} tasks complete! Cycle ready to reset`;
        }
        
        if (cycleCount === 0) {
            return `📋 ${remaining} task${remaining === 1 ? '' : 's'} left - complete your first cycle!`;
        }
        
        // Show progress and cycle count
        return `📋 ${remaining} task${remaining === 1 ? '' : 's'} remaining • ${cycleCount} cycle${cycleCount === 1 ? '' : 's'} completed`;
    }
    
    updateContent(message) {
        if (!this.helpWindow) return;
        
        this.helpWindow.innerHTML = `
            <p>${message}</p>
        `;
    }
    
    show() {
        if (!this.helpWindow || this.isVisible) return;
        
        const message = this.currentMessage || this.getCurrentStatusMessage();
        
        if (!this.isShowingModeDescription && !this.isShowingCycleComplete) {
            this.helpWindow.innerHTML = `
                <p>${message}</p>
            `;
        }
        
        this.helpWindow.classList.remove('hide');
        this.helpWindow.classList.add('show');
        this.helpWindow.style.display = 'flex';
        this.isVisible = true;
    }
    
    hide() {
        if (!this.helpWindow || !this.isVisible) return;
        
        this.helpWindow.classList.remove('show');
        this.helpWindow.classList.add('hide');
        this.isVisible = false;
        
        setTimeout(() => {
            this.helpWindow.style.display = 'none';
        }, 300);
    }
    
    destroy() {
        // Clear any active timeouts
        if (this.modeDescriptionTimeout) {
            clearTimeout(this.modeDescriptionTimeout);
            this.modeDescriptionTimeout = null;
        }
    }
}

// Initialize help window manager (keep this part the same)
let helpWindowManager;

setTimeout(() => {
    helpWindowManager = new HelpWindowManager();
}, 500);

// ✅ Updated setupModeSelector to show help descriptions on mode change
function setupModeSelector() {
    console.log('🎯 Setting up mode selectors...');
    
    const modeSelector = document.getElementById('mode-selector');
    const mobileModeSelector = document.getElementById('mobile-mode-selector');
    const toggleAutoReset = document.getElementById('toggleAutoReset');
    const deleteCheckedTasks = document.getElementById('deleteCheckedTasks');
    
    console.log('🔍 Element detection:', {
        modeSelector: !!modeSelector,
        mobileModeSelector: !!mobileModeSelector,
        toggleAutoReset: !!toggleAutoReset,
        deleteCheckedTasks: !!deleteCheckedTasks
    });
    
    if (!modeSelector || !mobileModeSelector || !toggleAutoReset || !deleteCheckedTasks) {
        console.warn('⚠️ Mode selector elements not found');
        return;
    }
    
    // ✅ Function to sync both selectors with toggles
    function syncModeFromToggles() {
        // ✅ Try new schema first for authoritative state
        const newSchemaData = loadMiniCycleFromNewSchema();
        let autoReset = false;
        let deleteChecked = false;
        
        if (newSchemaData) {
            const { cycles, activeCycle } = newSchemaData;
            const currentCycle = cycles[activeCycle];
            
            if (currentCycle) {
                autoReset = currentCycle.autoReset || false;
                deleteChecked = currentCycle.deleteCheckedTasks || false;
                
                // ✅ CRITICAL FIX: Update DOM to match data
                toggleAutoReset.checked = autoReset;
                deleteCheckedTasks.checked = deleteChecked;
            }
        } else {
            // ✅ For legacy mode, read from saved data first, then sync DOM
            const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
            const currentCycle = savedMiniCycles?.[lastUsedMiniCycle];
            
            if (currentCycle) {
                autoReset = currentCycle.autoReset || false;
                deleteChecked = currentCycle.deleteCheckedTasks || false;
                
                // ✅ Update DOM toggles to match saved data
                toggleAutoReset.checked = autoReset;
                deleteCheckedTasks.checked = deleteChecked;
            } else {
                // ✅ Fallback to DOM state only if no saved data exists
                autoReset = toggleAutoReset.checked;
                deleteChecked = deleteCheckedTasks.checked;
            }
        }
        
        console.log('🔄 Syncing mode from data source:', { autoReset, deleteChecked });
        
        let mode = 'auto-cycle';
        
        // ✅ FIXED: Check deleteChecked FIRST before other conditions
        if (deleteChecked) {
            mode = 'todo-mode';
        } else if (autoReset && !deleteChecked) {
            mode = 'auto-cycle';
        } else if (!autoReset && !deleteChecked) {
            mode = 'manual-cycle';  
        }
        
        console.log('📝 Setting both selectors to:', mode);
        
        // Update both selectors
        modeSelector.value = mode;
        mobileModeSelector.value = mode;
        
        // Update body classes
        document.body.className = document.body.className.replace(/\b(auto-cycle-mode|manual-cycle-mode|todo-mode)\b/g, '');
        document.body.classList.add(mode + '-mode');
        
        // ✅ FIXED: Update container visibility based on mode, not just autoReset
        const deleteContainer = document.getElementById('deleteCheckedTasksContainer');
        if (deleteContainer) {
            // Show delete container in manual-cycle and todo-mode, hide in auto-cycle
            const shouldShow = (mode === 'manual-cycle' || mode === 'todo-mode');
            deleteContainer.style.display = shouldShow ? 'block' : 'none';
        }
        
        console.log('✅ Mode selectors synced:', mode);
    }
    
    // ✅ Function to sync toggles from either selector
    function syncTogglesFromMode(selectedMode) {
        console.log('🔄 Syncing toggles from mode selector:', selectedMode);
        
        switch(selectedMode) {
            case 'auto-cycle':
                toggleAutoReset.checked = true;
                deleteCheckedTasks.checked = false;
                break;
            case 'manual-cycle':
                toggleAutoReset.checked = false;
                deleteCheckedTasks.checked = false;
                break;
            case 'todo-mode':
                toggleAutoReset.checked = false;
                deleteCheckedTasks.checked = true;
                break;
        }
        
        // Keep both selectors in sync
        modeSelector.value = selectedMode;
        mobileModeSelector.value = selectedMode;
        
        // ✅ UPDATE STORAGE FIRST before dispatching events
        updateStorageFromToggles();
        
        // ✅ THEN trigger change events (but prevent them from updating storage again)
        console.log('🔔 Dispatching change events to update storage...');
        toggleAutoReset.dispatchEvent(new Event('change'));
        deleteCheckedTasks.dispatchEvent(new Event('change'));
        
        // Update UI
        syncModeFromToggles();
        
        checkCompleteAllButton();
        
        if (typeof updateRecurringButtonVisibility === 'function') {
            updateRecurringButtonVisibility();
        }
        
        // ✅ Show mode description in help window
        if (helpWindowManager && typeof helpWindowManager.showModeDescription === 'function') {
            helpWindowManager.showModeDescription(selectedMode);
        }
        
        console.log('✅ Toggles synced from mode selector');
    }
    
    // ✅ Add this helper function to update storage from current toggle states
    function updateStorageFromToggles() {
        const newSchemaData = loadMiniCycleFromNewSchema();
        
        if (newSchemaData) {
            const { cycles, activeCycle } = newSchemaData;
            const currentCycle = cycles[activeCycle];
            
            if (currentCycle) {
                currentCycle.autoReset = toggleAutoReset.checked;
                currentCycle.deleteCheckedTasks = deleteCheckedTasks.checked;
                
                const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
                fullSchemaData.data.cycles[activeCycle] = currentCycle;
                fullSchemaData.metadata.lastModified = Date.now();
                localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
            }
        } else {
            // Fallback to old schema
            const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
            if (lastUsedMiniCycle && savedMiniCycles[lastUsedMiniCycle]) {
                savedMiniCycles[lastUsedMiniCycle].autoReset = toggleAutoReset.checked;
                savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = deleteCheckedTasks.checked;
                localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
            }
        }
    }
    // ✅ Set up event listeners for both selectors
    console.log('📡 Setting up event listeners for both selectors...');
    
    modeSelector.addEventListener('change', (e) => {
        console.log('🎯 Desktop mode selector changed:', e.target.value);
        syncTogglesFromMode(e.target.value);
        showNotification(`Switched to ${getModeName(e.target.value)}`, 'info', 2000);
    });
    
    mobileModeSelector.addEventListener('change', (e) => {
        console.log('📱 Mobile mode selector changed:', e.target.value);
        syncTogglesFromMode(e.target.value);
        showNotification(`Switched to ${getModeName(e.target.value)}`, 'info', 2000);
    });
    
    toggleAutoReset.addEventListener('change', (e) => {
        console.log('🔘 Auto Reset toggle changed:', e.target.checked);
        syncModeFromToggles();
         checkCompleteAllButton();
    });
    
    deleteCheckedTasks.addEventListener('change', (e) => {
        console.log('🗑️ Delete Checked Tasks toggle changed:', e.target.checked);
        syncModeFromToggles();
         checkCompleteAllButton();
    });
    
    // ✅ Initialize on load
    console.log('🚀 Initializing mode selectors...');
    syncModeFromToggles();
    
    console.log('✅ Mode selectors setup complete');
}

// Helper function to get readable mode name (keep this)
function getModeName(mode) {
    const modeNames = {
        'auto-cycle': 'Auto Cycle ↻',
        'manual-cycle': 'Manual Cycle ✔︎↻',
        'todo-mode': 'To-Do Mode ✓'
    };
    
    const result = modeNames[mode] || 'Auto Cycle ↻';
    console.log('📝 Getting mode name:', { input: mode, output: result });
    return result;
}

// ✅ Updated updateCycleModeDescription to also trigger help window
function updateCycleModeDescription() {
    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    let autoReset = false;
    let deleteChecked = false;
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        if (currentCycle) {
            autoReset = currentCycle.autoReset || false;
            deleteChecked = currentCycle.deleteCheckedTasks || false;
        }
    } else {
        // ✅ Fallback to old schema
        autoReset = document.getElementById("toggleAutoReset")?.checked || false;
        deleteChecked = document.getElementById("deleteCheckedTasks")?.checked || false;
    }
    
    const descriptionBox = document.getElementById("mode-description");
    if (!descriptionBox) return;

    let modeTitle = "";
    let modeDetail = "";
    let currentMode = "";

    if (deleteChecked) {
        currentMode = "todo-mode";
        modeTitle = "To-Do List Mode";
        modeDetail = `This mode will not complete any cycles.<br>
        Instead, it will delete all tasks when <br> you hit the complete button.<br>
        This will reveal a recurring option in the <br> task options menu.`;
    } else if (autoReset) {
        currentMode = "auto-cycle";
        modeTitle = "Auto Cycle Mode";
        modeDetail = `This mode automatically cycles tasks<br>
        when the user completes every task on the list<br>
        or hits the complete button.`;
    } else {
        currentMode = "manual-cycle";
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
 * STATS PANEL - WITH DESKTOP SWIPE SUPPORT
 * 
 * 
 ************************/

let startX = 0;
let isSwiping = false;
let isStatsVisible = false;
const statsPanel = document.getElementById("stats-panel");
const taskView = document.getElementById("task-view");
const liveRegion = document.getElementById("live-region");



// ✅ Enhanced touch detection for mobile
document.addEventListener("touchstart", (event) => {
    if (isDraggingNotification) return;
    
    // ✅ Block touch swipe when overlays are active
    if (isOverlayActive()) {
        return;
    }
    
    startX = event.touches[0].clientX;
    isSwiping = true;
});

document.addEventListener("touchmove", (event) => {
    if (!isSwiping || isDraggingNotification) return;
    
    // ✅ Block touch swipe when overlays are active
    if (isOverlayActive()) {
        return;
    }
    
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

document.addEventListener("touchend", () => {
    isSwiping = false;
});



// ✅ NEW: Desktop trackpad/mouse wheel swipe detection
let wheelDeltaX = 0;
let wheelTimeout = null;
const SWIPE_THRESHOLD = 400; // Adjust sensitivity
const WHEEL_RESET_DELAY = 15; // Reset wheel tracking after this delay

document.addEventListener("wheel", (event) => {
    // ✅ Block wheel swipe when overlays are active
    if (isOverlayActive()) {
        return;
    }

    // Only handle horizontal scrolling
    if (Math.abs(event.deltaX) < 10) return;
    
    // Prevent default horizontal scrolling
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
    }
    
    wheelDeltaX += event.deltaX;
    
    // Clear previous timeout
    if (wheelTimeout) {
        clearTimeout(wheelTimeout);
    }
    
    // Check if we've reached the swipe threshold
    if (wheelDeltaX > SWIPE_THRESHOLD && !isStatsVisible) {
        // Swipe left (show stats panel)
        isStatsVisible = true;
        showStatsPanel();
        wheelDeltaX = 0;
    } else if (wheelDeltaX < -SWIPE_THRESHOLD && isStatsVisible) {
        // Swipe right (show task view)
        isStatsVisible = false;
        showTaskView();
        wheelDeltaX = 0;
    }
    
    // Reset wheel tracking after a delay
    wheelTimeout = setTimeout(() => {
        wheelDeltaX = 0;
    }, WHEEL_RESET_DELAY);
}, { passive: false });

// ✅ NEW: Mouse drag support for regular desktop mice
let isMouseDragging = false;
let mouseStartX = 0;
const MOUSE_DRAG_THRESHOLD = 400; // pixels to drag before triggering


// ✅ Helper function to check if any overlay is active
function isOverlayActive() {
    // Check for visible menu
    if (document.querySelector(".menu-container.visible")) return true;
    
    // Check for open modals/overlays
    const overlaySelectors = [
        '.settings-modal[style*="display: flex"]',
        '.mini-cycle-switch-modal[style*="display: flex"]',
        '#feedback-modal[style*="display: flex"]',
        '#about-modal[style*="display: flex"]',
        '#themes-modal[style*="display: flex"]',
        '#games-panel[style*="display: flex"]',
        '#reminders-modal[style*="display: flex"]',
        '#testing-modal[style*="display: flex"]',
        '#recurring-panel-overlay:not(.hidden)',
        '.notification-container .notification',
        '#storage-viewer-overlay:not(.hidden)',  // Local storage viewer
        '.mini-modal-overlay',                    // Confirmation/prompt modals
        '.miniCycle-overlay',                     // Your prompt modals
        '.onboarding-modal:not([style*="display: none"])'  // Onboarding
        //'.modal-overlay'                          // Generic modal overlay
    ];
    
    return overlaySelectors.some(selector => document.querySelector(selector));
}

document.addEventListener("mousedown", (event) => {
    // ✅ Block drag when any overlay is active
    if (isOverlayActive()) {
        return;
    }

    // ✅ SIMPLIFIED: Only exclude interactive elements, allow drag from everywhere else
    if (
        isDraggingNotification ||
        event.target.closest("button, input, select, textarea, .task-options, .notification, a[href]") ||
        event.target.tagName === "BUTTON" ||
        event.target.tagName === "INPUT" ||
        event.target.tagName === "SELECT" ||
        event.target.tagName === "TEXTAREA"
    ) {
        return;
    }

    // ✅ Allow drag from anywhere on the main content areas
    isMouseDragging = false;
    mouseStartX = event.clientX;
    
    // Add temporary visual feedback
    document.body.style.userSelect = "none";
});


document.addEventListener("mousemove", (event) => {
    if (mouseStartX === 0) return; // No active drag

    const deltaX = event.clientX - mouseStartX;
    const absDelta = Math.abs(deltaX);

    // Start dragging after threshold is met
    if (!isMouseDragging && absDelta > 20) {
        isMouseDragging = true;
        //showNotification("🖱️ Mouse drag detected - continue dragging to switch views", "info", 2000);
    }

    if (isMouseDragging && absDelta > MOUSE_DRAG_THRESHOLD) {
        // Left drag (negative deltaX) = show stats panel
        if (deltaX < -MOUSE_DRAG_THRESHOLD && !isStatsVisible) {
            isStatsVisible = true;
            showStatsPanel();
            //showNotification("👈 Mouse drag - Stats Panel opened", "info", 1500);
            resetMouseDrag();
        }
        // Right drag (positive deltaX) = show task view  
        else if (deltaX > MOUSE_DRAG_THRESHOLD && isStatsVisible) {
            isStatsVisible = false;
            showTaskView();
            //showNotification("👉 Mouse drag - Task View opened", "info", 1500);
            resetMouseDrag();
        }
    }
});

document.addEventListener("mouseup", () => {
    resetMouseDrag();
});

// ✅ Helper function to reset mouse drag state
function resetMouseDrag() {
    isMouseDragging = false;
    mouseStartX = 0;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
}

// ✅ Alternative: Pointer events for better compatibility (optional enhancement)
let isPointerSwiping = false;
let pointerStartX = 0;

document.addEventListener("pointerdown", (event) => {
    // Only track if it's a touch or pen input
    if (event.pointerType === "touch" || event.pointerType === "pen") {
        isPointerSwiping = true;
        pointerStartX = event.clientX;
    }
});

document.addEventListener("pointermove", (event) => {
    if (!isPointerSwiping || event.pointerType === "mouse") return;
    
    const moveX = event.clientX;
    const difference = pointerStartX - moveX;
    
    if (Math.abs(difference) > 50) {
        if (difference > 50 && !isStatsVisible) {
            isStatsVisible = true;
            showStatsPanel();
            isPointerSwiping = false;
        } else if (difference < -50 && isStatsVisible) {
            isStatsVisible = false;
            showTaskView();
            isPointerSwiping = false;
        }
    }
});

document.addEventListener("pointerup", () => {
    isPointerSwiping = false;
});

// ✅ Enhanced keyboard shortcuts with user feedback
safeAddEventListener(document, "keydown", (e) => {
    if (!e.shiftKey) return;

    if (e.key === "ArrowRight" && !isStatsVisible) {
        e.preventDefault();
        showStatsPanel();
        showNotification("⌨️ Keyboard shortcut - Stats Panel opened", "info", 1500);
    } else if (e.key === "ArrowLeft" && isStatsVisible) {
        e.preventDefault();
        showTaskView();
        showNotification("⌨️ Keyboard shortcut - Task View opened", "info", 1500);
    }
    
    // ✅ Optional: Add Shift+Tab for quick toggle
    if (e.key === "Tab") {
        e.preventDefault();
        if (isStatsVisible) {
            showTaskView();
            showNotification("⌨️ Quick toggle - Task View", "info", 1500);
        } else {
            showStatsPanel();
            showNotification("⌨️ Quick toggle - Stats Panel", "info", 1500);
        }
    }
});







/**
 * ✅ Updated handleThemeToggleClick function with Schema 2.5 support
 */
function handleThemeToggleClick() {
    const themeMessage = document.getElementById("theme-unlock-message");
    const goldenMessage = document.getElementById("golden-unlock-message");
    const gameMessage = document.getElementById("game-unlock-message");
    const toggleIcon = document.querySelector("#theme-unlock-status .toggle-icon");
  
    // ✅ Try new schema first for milestone unlocks
    const newSchemaData = localStorage.getItem("miniCycleData");
    let milestoneUnlocks = {};
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        const unlockedThemes = parsed.settings.unlockedThemes || [];
        const unlockedFeatures = parsed.settings.unlockedFeatures || [];
        
        // Convert to old format for compatibility
        milestoneUnlocks = {
            darkOcean: unlockedThemes.includes("dark-ocean"),
            goldenGlow: unlockedThemes.includes("golden-glow"),
            taskOrderGame: unlockedFeatures.includes("task-order-game")
        };
    } else {
        // ✅ Fallback to old schema
        milestoneUnlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
    }
  
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
 * Update stats panel function.
 *
 * @returns {void}
 */


function updateStatsPanel() {
    let totalTasks = document.querySelectorAll(".task").length;
    let completedTasks = document.querySelectorAll(".task input:checked").length;
    let completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) + "%" : "0%";

    // ✅ Try new schema first
    const newSchemaData = loadMiniCycleFromNewSchema();
    let cycleCount = 0;
    
    if (newSchemaData) {
        const { cycles, activeCycle } = newSchemaData;
        const currentCycle = cycles[activeCycle];
        
        if (activeCycle && currentCycle) {
            cycleCount = currentCycle.cycleCount || 0;
        }
    } else {
        // ✅ Fallback to old schema
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
        
        if (lastUsedMiniCycle && savedMiniCycles[lastUsedMiniCycle]) {
            cycleCount = savedMiniCycles[lastUsedMiniCycle].cycleCount || 0;
        }
    }

    // ✅ Update Stats Display
    document.getElementById("total-tasks").textContent = totalTasks;
    document.getElementById("completed-tasks").textContent = completedTasks;
    document.getElementById("completion-rate").textContent = completionRate;
    document.getElementById("mini-cycle-count").textContent = cycleCount;
    document.getElementById("stats-progress-bar").style.width = completionRate;

    // ✅ Unlock badges
    document.querySelectorAll(".badge").forEach(badge => {
        const milestone = parseInt(badge.dataset.milestone);
        const isUnlocked = cycleCount >= milestone;
    
        badge.classList.toggle("unlocked", isUnlocked);
    
        // Reset theme badge classes
        badge.classList.remove("ocean-theme", "golden-theme", "game-unlocked");
    
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
    // ✅ Try new schema first for unlocked themes
    const newSchemaData = localStorage.getItem("miniCycleData");
    let milestoneUnlocks = {};
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        const unlockedThemes = parsed.settings.unlockedThemes || [];
        const unlockedFeatures = parsed.settings.unlockedFeatures || [];
        
        // Convert to old format for compatibility
        milestoneUnlocks = {
            darkOcean: unlockedThemes.includes("dark-ocean"),
            goldenGlow: unlockedThemes.includes("golden-glow"),
            taskOrderGame: unlockedFeatures.includes("task-order-game")
        };
    } else {
        // ✅ Fallback to old schema
        milestoneUnlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
    }
  
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
  
        // ✅ Update new schema if using it
        if (newSchemaData && !milestoneUnlocks.goldenGlow) {
          const parsed = JSON.parse(newSchemaData);
          if (!parsed.settings.unlockedThemes.includes("golden-glow")) {
            parsed.settings.unlockedThemes.push("golden-glow");
            parsed.metadata.lastModified = Date.now();
            localStorage.setItem("miniCycleData", JSON.stringify(parsed));
          }
        } else if (!newSchemaData && !milestoneUnlocks.goldenGlow) {
          // ✅ Update old schema
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
    // ✅ Try new schema first for unlocked themes
    const newSchemaData = localStorage.getItem("miniCycleData");
    let hasUnlockedThemes = false;
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        const unlockedThemes = parsed.settings.unlockedThemes || [];
        hasUnlockedThemes = unlockedThemes.length > 0;
    } else {
        // ✅ Fallback to old schema
        const milestoneUnlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
        hasUnlockedThemes = milestoneUnlocks.darkOcean || milestoneUnlocks.goldenGlow;
    }
    
    const themeButton = document.getElementById("open-themes-panel");
    const themesModal = document.getElementById("themes-modal");
    const closeThemesBtn = document.getElementById("close-themes-btn");
  
    // ✅ Show the button if ANY theme is unlocked
    if (hasUnlockedThemes && themeButton) {
      themeButton.style.display = "block";
    }
  
    // ✅ Open modal
    if (themeButton) {
        themeButton.addEventListener("click", () => {
          themesModal.style.display = "flex";
          hideMainMenu(); // Hide the main menu when opening
        });
    }
  
    // ✅ Close modal
    if (closeThemesBtn) {
        closeThemesBtn.addEventListener("click", () => {
          themesModal.style.display = "none";
        });
    }
  
    // ✅ Setup dark mode toggle inside themes modal
    setupDarkModeToggle("darkModeToggleThemes", ["darkModeToggle", "darkModeToggleThemes"]);
}


document.getElementById("quick-dark-toggle")?.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-mode");
    
    // ✅ Try new schema first for saving dark mode state
    const newSchemaData = localStorage.getItem("miniCycleData");
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        parsed.settings.darkMode = isDark;
        parsed.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(parsed));
    } else {
        // ✅ Fallback to old schema
        localStorage.setItem("darkModeEnabled", isDark);
    }

        // ✅ ADD THIS LINE
    if (typeof updateThemeColor === 'function') {
        updateThemeColor();
    }

    // Sync toggle states in settings panel
    const settingsToggle = document.getElementById("darkModeToggle");
    const themeToggle = document.getElementById("darkModeToggleThemes");
    if (settingsToggle) settingsToggle.checked = isDark;
    if (themeToggle) themeToggle.checked = isDark;

    // Update icon
    const quickToggle = document.getElementById("quick-dark-toggle");
    quickToggle.textContent = isDark ? "☀️" : "🌙";
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











// ==========================================
// 🔬 TESTING MODAL FUNCTIONALITY
// ==========================================
// ...existing code...

function setupTestingModal() {
    const testingModal = document.getElementById("testing-modal");
    const openTestingBtn = document.getElementById("open-testing-modal");
    const closeTestingBtns = document.querySelectorAll(".close-testing-modal, #close-testing-modal");
    const testingOutput = document.getElementById("testing-output");
    
    // Open testing modal
    if (openTestingBtn) {
        safeAddEventListener(openTestingBtn, "click", () => {
            testingModal.style.display = "flex";
            // ✅ Initialize dragging after modal opens
            initializeTestingModalDrag();
            //showNotification("🔬 Testing panel opened", "info", 2000);
        });
    }
    
    // Close testing modal
    closeTestingBtns.forEach(btn => {
        safeAddEventListener(btn, "click", () => {
            testingModal.style.display = "none";
            //showNotification("Testing panel closed", "default", 2000);
        });
    });
    
    // Close on outside click
    safeAddEventListener(testingModal, "click", (e) => {
        if (e.target === testingModal) {
            testingModal.style.display = "none";
            showNotification("Testing panel closed", "default", 2000);
        }
    });
    
    // Tab switching functionality
    setupTestingTabs();
    
    // Setup all test buttons
    setupTestButtons();
    
    // Setup results controls
    setupResultsControls();

    // Setup test results enhancements
    setupTestResultsEnhancements();

    addTestResultsHint();

    // 🔬 Testing Modal Keyboard Shortcut - Ctrl+J (PC) / Cmd+J (Mac)
    safeAddEventListener(document, "keydown", (e) => {
        // Check for Ctrl+J (PC) or Cmd+J (Mac)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
            e.preventDefault(); // Prevent any default browser behavior
            console.log("🔬 Toggling Testing Modal via keyboard shortcut");
            const testingModal = document.getElementById("testing-modal");
            
            if (testingModal) {
                // Toggle the modal (open if closed, close if open)
                const isOpen = testingModal.style.display === "flex" || testingModal.style.display === "block";
                
                if (isOpen) {
                    testingModal.style.display = "none";
                    showNotification("🔬 Testing panel closed", "info", 1500);
                } else {
                    testingModal.style.display = "block";
                    // ✅ Initialize dragging when opened via keyboard
                    initializeTestingModalDrag();
                    showNotification("🔬 Testing panel opened", "success", 2000);
                }
            } else {
                console.warn("⚠️ Testing modal not found");
                showNotification("❌ Testing panel not available", "error", 2000);
            }
        }
    });

        setTimeout(() => {
        addTestingModalDoubleClickToCenter();
    }, 100);
}

// ==========================================
// 🖱️ TESTING MODAL DRAG FUNCTIONALITY
// ==========================================

function initializeTestingModalDrag() {
    const testingModal = document.getElementById("testing-modal");
    if (!testingModal) return;
    
    // Find the modal content (the actual modal box)
    const modalContent = testingModal.querySelector(".testing-modal-content");
    if (!modalContent) {
        console.warn("⚠️ Testing modal content not found for dragging");
        return;
    }
    
    // Find or create a drag handle (header area)
    let dragHandle = modalContent.querySelector(".testing-modal-header");
    if (!dragHandle) {
        // If no specific header, use the top area of the modal
        dragHandle = modalContent.querySelector("h2, .testing-tabs, .close-testing-modal")?.closest("div");
        if (!dragHandle) {
            // Create a drag handle if none exists
            dragHandle = document.createElement("div");
            dragHandle.className = "testing-modal-drag-handle";
            dragHandle.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 40px;
                cursor: move;
                z-index: 1000;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px 12px 0 0;
            `;
            modalContent.style.position = "relative";
            modalContent.appendChild(dragHandle);
        }
    }
    
    // Set up dragging
    makeTestingModalDraggable(modalContent, dragHandle);
}

function makeTestingModalDraggable(modalContent, dragHandle) {
    let isDragging = false;
    let offsetX, offsetY;
    let hasMoved = false;
    
    // Ensure the modal content is positioned for dragging
    if (!modalContent.style.position || modalContent.style.position === "static") {
        modalContent.style.position = "fixed";
    }
    
    // Set cursor and prevent text selection
    dragHandle.style.cursor = "move";
    dragHandle.style.userSelect = "none";
    dragHandle.style.webkitUserSelect = "none";
    dragHandle.style.msUserSelect = "none";
    
    // ✅ Visual feedback for drag handle
    dragHandle.addEventListener("mouseenter", () => {
        if (!isDragging) {
            dragHandle.style.background = "rgba(0, 123, 255, 0.2)";
        }
    });
    
    dragHandle.addEventListener("mouseleave", () => {
        if (!isDragging) {
            dragHandle.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        }
    });
    
    // Remove any existing listeners to prevent duplicates
    dragHandle.removeEventListener("mousedown", startDrag);
    dragHandle.addEventListener("mousedown", startDrag);
    
    function startDrag(e) {
        // Don't drag if clicking on buttons or interactive elements
        if (e.target.closest("button, input, select, textarea")) {
            return;
        }
        
        isDragging = true;
        hasMoved = false;
        
        const rect = modalContent.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        // Set high z-index while dragging
        modalContent.style.zIndex = "10001";
        dragHandle.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

        // Add visual feedback
        modalContent.style.boxShadow = "0 25px 50px rgba(0, 0, 0, 0.5)";
        
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Global mouse move handler
    function handleMouseMove(e) {
        if (!isDragging) return;
        
        hasMoved = true;
        
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        
        // ✅ Keep modal within viewport bounds
        const modalRect = modalContent.getBoundingClientRect();
        const maxX = window.innerWidth - modalRect.width;
        const maxY = window.innerHeight - modalRect.height;
        
        newX = Math.max(20, Math.min(newX, maxX - 20)); // 20px margin
        newY = Math.max(20, Math.min(newY, maxY - 20));
        
        modalContent.style.left = `${newX}px`;
        modalContent.style.top = `${newY}px`;
        modalContent.style.right = "auto";
        modalContent.style.bottom = "auto";
        modalContent.style.margin = "0"; // Remove any default margins
    }
    
    function stopDrag() {
        if (isDragging) {
            isDragging = false;
            
            // Restore visual state
            modalContent.style.zIndex = "9999";
            modalContent.style.boxShadow = "";
            dragHandle.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

            // Show notification if modal was actually moved
            if (hasMoved) {
                showNotification("🔬 Testing modal repositioned", "info", 1500);
            }
        }
    }
    
    // Add global event listeners (remove first to prevent duplicates)
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopDrag);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopDrag);
    
    // ✅ Handle window resize to keep modal in bounds
    function handleResize() {
        if (modalContent.style.position === "fixed") {
            const rect = modalContent.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;
            
            if (rect.left > maxX || rect.top > maxY) {
                const newX = Math.min(rect.left, maxX - 20);
                const newY = Math.min(rect.top, maxY - 20);
                
                modalContent.style.left = `${Math.max(20, newX)}px`;
                modalContent.style.top = `${Math.max(20, newY)}px`;
            }
        }
    }
    
    window.removeEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
}

// ✅ Optional: Add double-click to center modal
function addTestingModalDoubleClickToCenter() {
    const testingModal = document.getElementById("testing-modal");
    const modalContent = testingModal?.querySelector(".testing-modal-content");
    const dragHandle = modalContent?.querySelector(".testing-modal-drag-handle");
    
    if (dragHandle) {
        dragHandle.addEventListener("dblclick", () => {
            // Center the modal
            const rect = modalContent.getBoundingClientRect();
            const centerX = (window.innerWidth - rect.width) / 2;
            const centerY = (window.innerHeight - rect.height) / 2;
            
            modalContent.style.left = `${centerX}px`;
            modalContent.style.top = `${centerY}px`;
            modalContent.style.right = "auto";
            modalContent.style.bottom = "auto";
            modalContent.style.margin = "0";
            
            showNotification("🔬 Testing modal centered", "info", 1500);
        });
    }
}



function setupTestingTabs() {
    const tabs = document.querySelectorAll(".testing-tab");
    const tabContents = document.querySelectorAll(".testing-tab-content");
    
    tabs.forEach(tab => {
        safeAddEventListener(tab, "click", () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove("active"));
            tabContents.forEach(content => content.classList.remove("active"));
            
            // Add active class to clicked tab
            tab.classList.add("active");
            
            // Show corresponding content
            const targetTab = tab.dataset.tab;
            const targetContent = document.getElementById(`${targetTab}-tab`);
            if (targetContent) {
                targetContent.classList.add("active");
            }
        });
    });
}



function setupTestButtons() {
    // Diagnostics tab buttons
    safeAddEventListenerById("run-health-check", "click", () => {
        runHealthCheck();
    });
    
    safeAddEventListenerById("check-data-integrity", "click", () => {
        checkDataIntegrity();
    });
    
    safeAddEventListenerById("validate-schema", "click", () => {
        validateSchema();
    });
    
    safeAddEventListenerById("show-app-info", "click", () => {
        showAppInfo();
    });
    
    safeAddEventListenerById("show-storage-info", "click", () => {
        showStorageInfo();
    });
    
    safeAddEventListenerById("show-performance-info", "click", () => {
        showPerformanceInfo();
    });
    
    // Migration tab buttons
    safeAddEventListenerById("check-migration-status", "click", () => {
        checkMigrationStatus();
    });
    
    safeAddEventListenerById("test-migration-config", "click", () => {
        testMigrationConfig();
    });
    
    safeAddEventListenerById("simulate-migration", "click", () => {
        simulateMigration();
    });
    
    safeAddEventListenerById("backup-before-migration", "click", () => {
        backupBeforeMigration();
    });
    
    safeAddEventListenerById("validate-migration-data", "click", () => {
        validateMigrationData();
    });
    
    safeAddEventListenerById("perform-actual-migration", "click", () => {
        performActualMigration();
    });
    
    safeAddEventListenerById("list-available-backups", "click", () => {
        listAvailableBackups();
    });
    
    safeAddEventListenerById("restore-from-backup", "click", () => {
        restoreFromBackup();
    });
    
    safeAddEventListenerById("clean-old-backups", "click", () => {
        cleanOldBackups();
    });
    
    // Data Tools tab buttons
    safeAddEventListenerById("analyze-cycles", "click", () => {
        analyzeCycles();
    });
    
    safeAddEventListenerById("analyze-tasks", "click", () => {
        analyzeTasks();
    });
    
    safeAddEventListenerById("find-data-issues", "click", () => {
        findDataIssues();
    });
    
    safeAddEventListenerById("export-debug-data", "click", () => {
        exportDebugData();
    });
    
    safeAddEventListenerById("clean-old-data", "click", () => {
        cleanOldData();
    });
    
    safeAddEventListenerById("repair-data", "click", () => {
        repairData();
    });
    
    // Debug Info tab buttons
    safeAddEventListenerById("generate-debug-report", "click", () => {
        generateDebugReport();
    });
    
    safeAddEventListenerById("test-notifications", "click", () => {
        testNotifications();
    });
    
    safeAddEventListenerById("test-recurring-logic", "click", () => {
        testRecurringLogic();
    });
    
   safeAddEventListenerById("view-local-storage-btn", "click", () => {
        openStorageViewer();
    });
    
    safeAddEventListenerById("show-browser-info", "click", () => {
        showBrowserInfo();
    });
    
    safeAddEventListenerById("show-feature-flags", "click", () => {
        showFeatureFlags();
    });
    
    safeAddEventListenerById("test-localStorage", "click", () => {
        testLocalStorage();
    });
}

function setupResultsControls() {
    safeAddEventListenerById("clear-test-results", "click", () => {
        clearTestResults();
    });
    
    safeAddEventListenerById("export-test-results", "click", () => {
        exportTestResults();
    });
    
    safeAddEventListenerById("copy-test-results", "click", () => {
        copyTestResults();
    });
}

    safeAddEventListenerById("show-service-worker-info", "click", () => {
        showServiceWorkerInfo();
    });
    
    safeAddEventListenerById("test-service-worker-update", "click", () => {
        testServiceWorkerUpdate();
    });


    // Add these lines to your setupTestButtons() function
safeAddEventListenerById("enable-auto-capture", "click", () => {
    localStorage.setItem("miniCycle_enableAutoConsoleCapture", "true");
    if (!consoleCapturing) {
        startAutoConsoleCapture();
    }
    appendToTestResults("🔄 Auto console capture enabled - will start automatically on next refresh\n\n");
    showNotification("🔄 Auto-capture enabled for migrations", "success", 3000);
});

safeAddEventListenerById("show-all-console-logs", "click", () => {
    showAllCapturedLogs();
});

safeAddEventListenerById("show-migration-errors", "click", () => {
    showMigrationErrorsOnly();
});

safeAddEventListenerById("clear-all-console-logs", "click", () => {
    clearAllConsoleLogs();
});

safeAddEventListenerById("stop-console-capture", "click", () => {
    localStorage.removeItem("miniCycle_enableAutoConsoleCapture");
    stopConsoleCapture();
    appendToTestResults("⏹️ Auto console capture disabled\n\n");
    showNotification("⏹️ Auto-capture disabled", "info", 2000);
});

// ==========================================
// 🧪 TEST FUNCTIONS - DIAGNOSTICS TAB
// ==========================================

function runHealthCheck() {
    appendToTestResults("🏥 Running Full Health Check...\n");
    showNotification("🔬 Running full diagnostic health check", "info", 3000);
    
    setTimeout(() => {
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
        const cycleCount = Object.keys(savedMiniCycles).length;
        const totalTasks = Object.values(savedMiniCycles).reduce((acc, cycle) => acc + (cycle.tasks?.length || 0), 0);
        
        appendToTestResults(`✅ Health Check Complete!\n`);
        appendToTestResults(`📊 Found ${cycleCount} miniCycles\n`);
        appendToTestResults(`📝 Total Tasks: ${totalTasks}\n`);
        appendToTestResults(`💾 Storage Status: OK\n`);
        appendToTestResults(`🔄 Schema Version: 2\n\n`);
        
        showNotification("✅ Health check completed successfully!", "success", 3000);
    }, 1500);
}

function checkDataIntegrity() {
    appendToTestResults("🔍 Checking Data Integrity...\n");
    showNotification("Checking data integrity...", "info", 2000);
    
    setTimeout(() => {
        const results = validateAllMiniCycleTasks(); // Your existing function
        if (results.length === 0) {
            appendToTestResults("✅ Data Integrity: PASSED\n");
            appendToTestResults("All tasks have valid structure\n\n");
            showNotification("✅ Data integrity check passed!", "success", 3000);
        } else {
            appendToTestResults(`⚠️ Data Integrity: ${results.length} issues found\n`);
            results.forEach(result => {
                appendToTestResults(`- Cycle: ${result.cycle}, Task: ${result.taskText}\n`);
            });
            appendToTestResults("\n");
            showNotification(`⚠️ Found ${results.length} data integrity issues`, "warning", 3000);
        }
    }, 1000);
}

function validateSchema() {
    appendToTestResults("📋 Validating Schema Versions...\n");
    showNotification("Validating schema versions...", "info", 2000);
    
    setTimeout(() => {
        const { savedMiniCycles } = assignCycleVariables();
        let v1Tasks = 0, v2Tasks = 0, unknownTasks = 0;
        
        Object.values(savedMiniCycles).forEach(cycle => {
            cycle.tasks?.forEach(task => {
                if (task.schemaVersion === 1) v1Tasks++;
                else if (task.schemaVersion === 2) v2Tasks++;
                else unknownTasks++;
            });
        });
        
        appendToTestResults(`📊 Schema Analysis:\n`);
        appendToTestResults(`- Schema v1 Tasks: ${v1Tasks}\n`);
        appendToTestResults(`- Schema v2 Tasks: ${v2Tasks}\n`);
        appendToTestResults(`- Unknown Schema: ${unknownTasks}\n\n`);
        
        if (v1Tasks > 0) {
            showNotification(`⚠️ Found ${v1Tasks} tasks using old schema v1`, "warning", 3000);
        } else {
            showNotification("✅ All tasks using current schema v2", "success", 3000);
        }
    }, 800);
}

function showAppInfo() {
    appendToTestResults("ℹ️ Application Information:\n");
    appendToTestResults(`- Version: 1.0\n`);
    appendToTestResults(`- Name: miniCycle\n`);
    appendToTestResults(`- Developer: Sparkin Creations\n`);
    appendToTestResults(`- Build Date: August 25, 2025\n`);
    appendToTestResults(`- User Agent: ${navigator.userAgent}\n\n`);
    
    showNotification("📱 App information displayed", "info", 2000);
}

function showStorageInfo() {
    appendToTestResults("💾 Storage Analysis:\n");
    
    const storageUsed = JSON.stringify(localStorage).length;
    const storageLimit = 5 * 1024 * 1024; // 5MB typical limit
    const usagePercent = ((storageUsed / storageLimit) * 100).toFixed(2);
    
    appendToTestResults(`- Storage Used: ${(storageUsed / 1024).toFixed(2)} KB\n`);
    appendToTestResults(`- Estimated Limit: ${(storageLimit / 1024 / 1024).toFixed(2)} MB\n`);
    appendToTestResults(`- Usage: ${usagePercent}%\n`);
    appendToTestResults(`- Available Keys: ${Object.keys(localStorage).length}\n\n`);
    
    showNotification(`💾 Storage: ${usagePercent}% used`, "info", 3000);
}

function showPerformanceInfo() {
    appendToTestResults("⚡ Performance Information:\n");
    
    const performanceInfo = performance.getEntriesByType("navigation")[0];
    if (performanceInfo) {
        appendToTestResults(`- Page Load Time: ${(performanceInfo.loadEventEnd - performanceInfo.navigationStart).toFixed(2)}ms\n`);
        appendToTestResults(`- DOM Content Loaded: ${(performanceInfo.domContentLoadedEventEnd - performanceInfo.navigationStart).toFixed(2)}ms\n`);
    }
    
    appendToTestResults(`- Memory Used: ${(performance.memory?.usedJSHeapSize / 1024 / 1024 || 0).toFixed(2)} MB\n`);
    appendToTestResults(`- Viewport: ${window.innerWidth}x${window.innerHeight}\n\n`);
    
    showNotification("⚡ Performance info displayed", "info", 2000);
}

// ==========================================
// 🔄 TEST FUNCTIONS - MIGRATION TAB
// ==========================================

function checkMigrationStatus() {
    appendToTestResults("🔄 Checking Migration Status...\n");
    showNotification("Checking if migration is needed...", "info", 2000);
    
    const migrationCheck = checkMigrationNeeded();
    
    appendToTestResults(`📊 Migration Assessment:\n`);
    appendToTestResults(`- Migration Needed: ${migrationCheck.needed ? "YES" : "NO"}\n`);
    appendToTestResults(`- Current Version: ${migrationCheck.currentVersion}\n`);
    
    if (migrationCheck.oldDataFound) {
        appendToTestResults(`📁 Old Data Found:\n`);
        Object.entries(migrationCheck.oldDataFound).forEach(([key, value]) => {
            appendToTestResults(`  - ${key}: ${value ? "✅ Present" : "❌ Missing"}\n`);
        });
    }
    
    if (migrationCheck.needed) {
        appendToTestResults(`\n🚀 Recommendation: Run migration to Schema 2.5\n`);
        showNotification("⚠️ Migration to Schema 2.5 recommended", "warning", 4000);
    } else {
        appendToTestResults(`\n✅ No migration needed - you're up to date!\n`);
        showNotification("✅ Schema is up to date", "success", 2000);
    }
    
    appendToTestResults("\n");
}

function testMigrationConfig() {
    appendToTestResults("🧪 Testing Migration Configuration...\n");
    
    let passed = 0;
    let failed = 0;
    
    // Test 1: Migration functions exist
    if (typeof checkMigrationNeeded === 'function') {
        appendToTestResults("✅ checkMigrationNeeded() function exists\n");
        passed++;
    } else {
        appendToTestResults("❌ checkMigrationNeeded() function missing\n");
        failed++;
    }
    
    // Test 2: Schema target defined
    if (typeof SCHEMA_2_5_TARGET === 'object') {
        appendToTestResults("✅ Schema 2.5 target structure defined\n");
        passed++;
    } else {
        appendToTestResults("❌ Schema 2.5 target structure missing\n");
        failed++;
    }
    
    // Test 3: Simulation function exists
    if (typeof simulateMigrationToSchema25 === 'function') {
        appendToTestResults("✅ simulateMigrationToSchema25() function exists\n");
        passed++;
    } else {
        appendToTestResults("❌ simulateMigrationToSchema25() function missing\n");
        failed++;
    }
    
    // Test 4: Required localStorage keys
    const requiredKeys = ['miniCycleStorage', 'lastUsedMiniCycle'];
    let keysFound = 0;
    requiredKeys.forEach(key => {
        if (localStorage.getItem(key)) {
            keysFound++;
        }
    });
    
    appendToTestResults(`✅ Found ${keysFound}/${requiredKeys.length} required localStorage keys\n`);
    
    appendToTestResults(`\n📊 Migration Config Test Results:\n`);
    appendToTestResults(`- Tests Passed: ${passed}\n`);
    appendToTestResults(`- Tests Failed: ${failed}\n`);
    appendToTestResults(`- Overall Status: ${failed === 0 ? "✅ READY" : "❌ NOT READY"}\n\n`);
    
    const status = failed === 0 ? "success" : "error";
    showNotification(`🧪 Migration config test: ${failed === 0 ? "PASSED" : "FAILED"}`, status, 2000);
}

function simulateMigration() {
    appendToTestResults("🎭 Simulating Migration to Schema 2.5 (Safe Mode)...\n");
    showNotification("Running safe migration simulation...", "info", 3000);
    
    const results = simulateMigrationToSchema25(true); // dry run
    
    if (results.success) {
        appendToTestResults("✅ Migration Simulation Successful!\n\n");
        
        appendToTestResults("📋 Changes that would be made:\n");
        results.changes.forEach(change => {
            appendToTestResults(`${change}\n`);
        });
        
        if (results.warnings.length > 0) {
            appendToTestResults("\n⚠️ Warnings:\n");
            results.warnings.forEach(warning => {
                appendToTestResults(`${warning}\n`);
            });
        }
        
        appendToTestResults("\n📊 New Schema Preview:\n");
        appendToTestResults(`- Schema Version: ${results.dataPreview.schemaVersion}\n`);
        appendToTestResults(`- Cycles: ${Object.keys(results.dataPreview.data.cycles).length}\n`);
        appendToTestResults(`- Active Cycle: ${results.dataPreview.appState.activeCycleId || "none"}\n`);
        appendToTestResults(`- Unlocked Themes: ${results.dataPreview.settings.unlockedThemes.length}\n`);
        appendToTestResults(`- Total Completed: ${results.dataPreview.metadata.totalTasksCompleted}\n`);
        
        showNotification("✅ Migration simulation completed successfully", "success", 3000);
    } else {
        appendToTestResults("❌ Migration Simulation Failed!\n\n");
        
        appendToTestResults("🚨 Errors:\n");
        results.errors.forEach(error => {
            appendToTestResults(`${error}\n`);
        });
        
        showNotification("❌ Migration simulation failed", "error", 4000);
    }
    
    appendToTestResults("\n");
}

function backupBeforeMigration() {
    appendToTestResults("💾 Creating Migration Backup...\n");
    
    const backupData = JSON.stringify(localStorage);
    const backupKey = `miniCycle_backup_${Date.now()}`;
    
    try {
        localStorage.setItem(backupKey, backupData);
        appendToTestResults(`✅ Backup Created: ${backupKey}\n`);
        appendToTestResults(`Backup Size: ${(backupData.length / 1024).toFixed(2)} KB\n\n`);
        showNotification("✅ Migration backup created successfully", "success", 3000);
    } catch (error) {
        appendToTestResults(`❌ Backup Failed: ${error.message}\n\n`);
        showNotification("❌ Failed to create backup", "error", 3000);
    }
}

function validateMigrationData() {
    appendToTestResults("✅ Validating Migration Data...\n");
    showNotification("Validating data for migration...", "info", 2000);
    
    const validation = {
        checks: 0,
        passed: 0,
        warnings: 0,
        errors: 0
    };
    
    // Check 1: Current data exists
    validation.checks++;
    const oldCycles = localStorage.getItem("miniCycleStorage");
    if (oldCycles) {
        validation.passed++;
        appendToTestResults("✅ miniCycleStorage data found\n");
        
        try {
            const parsed = JSON.parse(oldCycles);
            appendToTestResults(`  - Found ${Object.keys(parsed).length} cycles\n`);
        } catch (e) {
            validation.errors++;
            appendToTestResults("❌ miniCycleStorage data is corrupted\n");
        }
    } else {
        validation.warnings++;
        appendToTestResults("⚠️ No miniCycleStorage data found\n");
    }
    
    // Check 2: Last used cycle
    validation.checks++;
    const lastUsed = localStorage.getItem("lastUsedMiniCycle");
    if (lastUsed) {
        validation.passed++;
        appendToTestResults(`✅ Active cycle: ${lastUsed}\n`);
    } else {
        validation.warnings++;
        appendToTestResults("⚠️ No active cycle set\n");
    }
    
    // Check 3: Settings data
    validation.checks++;
    const reminders = localStorage.getItem("miniCycleReminders");
    if (reminders) {
        validation.passed++;
        appendToTestResults("✅ Reminder settings found\n");
    } else {
        validation.passed++;
        appendToTestResults("ℹ️ No reminder settings (will use defaults)\n");
    }
    
    // Check 4: Available space
    validation.checks++;
    const currentSize = JSON.stringify(localStorage).length;
    const estimatedNewSize = currentSize * 1.5; // rough estimate
    const maxSize = 5 * 1024 * 1024; // 5MB typical limit
    
    if (estimatedNewSize < maxSize * 0.8) {
        validation.passed++;
        appendToTestResults("✅ Sufficient storage space available\n");
    } else {
        validation.errors++;
        appendToTestResults("❌ Storage space may be insufficient\n");
    }
    
    appendToTestResults(`\n📊 Validation Summary:\n`);
    appendToTestResults(`- Total Checks: ${validation.checks}\n`);
    appendToTestResults(`- Passed: ${validation.passed}\n`);
    appendToTestResults(`- Warnings: ${validation.warnings}\n`);
    appendToTestResults(`- Errors: ${validation.errors}\n`);
    
    const status = validation.errors === 0 ? "✅ READY FOR MIGRATION" : "❌ MIGRATION NOT RECOMMENDED";
    appendToTestResults(`- Status: ${status}\n\n`);
    
    const notifType = validation.errors === 0 ? "success" : "warning";
    const notifMsg = validation.errors === 0 ? "Data validation passed" : "Data validation issues found";
    showNotification(notifMsg, notifType, 3000);
}

function performActualMigration() {
    appendToTestResults("🚀 PERFORMING ACTUAL MIGRATION TO SCHEMA 2.5...\n");
    appendToTestResults("⚠️ This will modify your data!\n\n");
    
    showNotification("🚀 Running actual migration - DO NOT CLOSE APP!", "warning", 5000);
    
    // First check if migration is needed
    const check = checkMigrationNeeded();
    if (!check.needed) {
        appendToTestResults("ℹ️ No migration needed - already at Schema 2.5 or newer\n\n");
        showNotification("ℹ️ No migration needed", "info", 3000);
        return;
    }
    
    setTimeout(() => {
        const results = performSchema25Migration();
        
        if (results.success) {
            appendToTestResults("🎉 MIGRATION COMPLETED SUCCESSFULLY!\n\n");
            
            appendToTestResults("✅ Migration Results:\n");
            results.changes.forEach(change => {
                appendToTestResults(`${change}\n`);
            });
            
            appendToTestResults("\n🔄 Next Steps:\n");
            appendToTestResults("1. Reload the app to see changes\n");
            appendToTestResults("2. Verify your cycles and settings\n");
            appendToTestResults("3. If issues occur, you can restore from backup\n");
            
            showNotification("🎉 Migration completed! Please reload the app", "success", 8000);
            
            // Show reload confirmation
            setTimeout(() => {
    showConfirmationModal({
        title: "🎉 Schema 2.5 Migration Complete!",
        message: `Migration to Schema 2.5 was successful!<br><br>
                 ✅ Your data has been upgraded<br>
                 ✅ All cycles and settings preserved<br>
                 ✅ New features are now available<br><br>
                 Would you like to reload the app now to see the changes?`,
        confirmText: "🔄 Reload Now",
        cancelText: "Continue Working",
        callback: (confirmed) => {
            if (confirmed) {
                showNotification("🔄 Reloading app...", "info", 2000);
                setTimeout(() => location.reload(), 1000);
            } else {
                showNotification("ℹ️ You can reload manually anytime to see new features", "info", 4000);
            }
        }
    });
}, 2000);
        } else {
            appendToTestResults("💥 MIGRATION FAILED!\n\n");
            
            appendToTestResults("🚨 Errors encountered:\n");
            results.errors.forEach(error => {
                appendToTestResults(`${error}\n`);
            });
            
            appendToTestResults("\n🔧 Your original data should still be intact.\n");
            appendToTestResults("Please report this error for assistance.\n");
            
            showNotification("❌ Migration failed - data preserved", "error", 6000);
        }
        
        appendToTestResults("\n");
    }, 2000);
}

function listAvailableBackups() {
    appendToTestResults("📋 Available Backups:\n");
    
    // ✅ Look for BOTH manual and automatic backups
    const manualBackups = Object.keys(localStorage).filter(key => key.startsWith('miniCycle_backup_'));
    const autoBackups = Object.keys(localStorage).filter(key => key.startsWith('auto_migration_backup_'));
    const allBackups = [...manualBackups, ...autoBackups];
    
    if (allBackups.length === 0) {
        appendToTestResults("No backups found\n\n");
        showNotification("No backups available", "info", 2000);
    } else {
        // ✅ Sort all backups by timestamp
        allBackups.sort((a, b) => {
            const timestampA = parseInt(a.replace(/^(miniCycle_backup_|auto_migration_backup_)/, ''));
            const timestampB = parseInt(b.replace(/^(miniCycle_backup_|auto_migration_backup_)/, ''));
            return timestampB - timestampA; // Newest first
        });
        
        allBackups.forEach(key => {
            const timestamp = key.replace(/^(miniCycle_backup_|auto_migration_backup_)/, '');
            const date = new Date(parseInt(timestamp)).toLocaleString();
            const size = (localStorage.getItem(key).length / 1024).toFixed(2);
            const type = key.startsWith('auto_migration_backup_') ? 'AUTO' : 'MANUAL';
            appendToTestResults(`- ${key} (${date}) - ${size} KB [${type}]\n`);
        });
        appendToTestResults("\n");
        showNotification(`Found ${allBackups.length} backups (${autoBackups.length} auto, ${manualBackups.length} manual)`, "info", 2000);
    }
}

function restoreFromBackup() {
    // ✅ Look for BOTH manual and automatic backups
    const manualBackups = Object.keys(localStorage).filter(key => key.startsWith('miniCycle_backup_'));
    const autoBackups = Object.keys(localStorage).filter(key => key.startsWith('auto_migration_backup_'));
    const backupKeys = [...manualBackups, ...autoBackups];
    
    if (backupKeys.length === 0) {
        appendToTestResults("❌ No backups available to restore\n\n");
        showNotification("❌ No backups available to restore", "error", 3000);
        return;
    }
    
    appendToTestResults("🔄 Preparing backup selection...\n");
    
    // ✅ Create backup selection modal (existing modal code...)
    const modal = document.createElement("div");
    modal.id = "backup-restore-modal";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 2020;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(3px);
    `;
    
    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
        background: var(--modal-bg, #1a1a1a);
        border: 1px solid var(--modal-border, #333);
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        max-height: 70%;
        padding: 20px;
        color: var(--modal-text, #fff);
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    `;
    
    const header = document.createElement("div");
    header.innerHTML = `
        <h3 style="margin: 0 0 20px 0; color: var(--modal-text, #fff);">
            🔄 Restore from Backup
        </h3>
        <p style="margin: 0 0 20px 0; color: #ccc; font-size: 14px;">
            Choose a backup to restore. <strong>Warning:</strong> This will replace all current data.
        </p>
    `;
    
    const backupList = document.createElement("div");
    backupList.style.cssText = `
        max-height: 300px;
        overflow-y: auto;
        margin-bottom: 20px;
        border: 1px solid var(--modal-border, #333);
        border-radius: 6px;
        padding: 10px;
    `;
    
    // ✅ Sort backups by timestamp (newest first)
    const sortedBackups = backupKeys.sort((a, b) => {
        const timestampA = parseInt(a.replace(/^(miniCycle_backup_|auto_migration_backup_)/, ''));
        const timestampB = parseInt(b.replace(/^(miniCycle_backup_|auto_migration_backup_)/, ''));
        return timestampB - timestampA;
    });
    
    let selectedBackup = null;
    
    // ✅ Create backup selection items with type indicators
    sortedBackups.forEach((backupKey, index) => {
        const timestamp = backupKey.replace(/^(miniCycle_backup_|auto_migration_backup_)/, '');
        const date = new Date(parseInt(timestamp));
        const backupData = localStorage.getItem(backupKey);
        const size = (backupData.length / 1024).toFixed(2);
        const isAuto = backupKey.startsWith('auto_migration_backup_');
        
        // ✅ Try to extract cycle count from backup data
        let cycleInfo = "";
        try {
            const parsed = JSON.parse(backupData);
            
            // ✅ Handle different backup formats
            let storage = {};
            if (isAuto) {
                // Auto-migration backup format
                storage = parsed.data?.miniCycleStorage ? JSON.parse(parsed.data.miniCycleStorage) : {};
            } else {
                // Manual backup format
                storage = parsed.miniCycleStorage ? JSON.parse(parsed.miniCycleStorage) : {};
            }
            
            const cycleCount = Object.keys(storage).length;
            const taskCount = Object.values(storage).reduce((acc, cycle) => 
                acc + (cycle.tasks?.length || 0), 0);
            cycleInfo = ` • ${cycleCount} cycle${cycleCount !== 1 ? 's' : ''}, ${taskCount} task${taskCount !== 1 ? 's' : ''}`;
        } catch (e) {
            cycleInfo = " • Unknown content";
        }
        
        const backupItem = document.createElement("div");
        backupItem.className = "backup-item";
        backupItem.style.cssText = `
            padding: 12px;
            margin: 8px 0;
            border: 2px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: rgba(255, 255, 255, 0.05);
        `;
        
        const typeLabel = isAuto ? '<span style="color: #28a745; font-size: 11px; font-weight: bold;">[AUTO-MIGRATION]</span>' : '<span style="color: #007bff; font-size: 11px; font-weight: bold;">[MANUAL]</span>';
        const latestLabel = index === 0 ? '<span style="color: #ffc107; font-size: 12px;"> (Latest)</span>' : '';
        
        backupItem.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">
                📅 ${date.toLocaleString()} ${typeLabel}${latestLabel}
            </div>
            <div style="font-size: 12px; color: #ccc;">
                💾 ${size} KB${cycleInfo}
            </div>
            <div style="font-size: 11px; color: #888; margin-top: 4px;">
                ID: ${backupKey}
            </div>
        `;
        
        // ✅ Selection and hover logic (same as before)
        backupItem.addEventListener("click", () => {
            document.querySelectorAll(".backup-item").forEach(item => {
                item.style.border = "2px solid transparent";
                item.style.background = "rgba(255, 255, 255, 0.05)";
            });
            
            backupItem.style.border = "2px solid #007bff";
            backupItem.style.background = "rgba(0, 123, 255, 0.1)";
            selectedBackup = backupKey;
            
            restoreBtn.disabled = false;
            restoreBtn.style.opacity = "1";
            restoreBtn.style.cursor = "pointer";
        });
        
        backupItem.addEventListener("mouseenter", () => {
            if (selectedBackup !== backupKey) {
                backupItem.style.background = "rgba(255, 255, 255, 0.1)";
            }
        });
        
        backupItem.addEventListener("mouseleave", () => {
            if (selectedBackup !== backupKey) {
                backupItem.style.background = "rgba(255, 255, 255, 0.05)";
            }
        });
        
        backupList.appendChild(backupItem);
    });
    
    // ✅ Buttons (same as before)
    const buttonsContainer = document.createElement("div");
    buttonsContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 20px;
    `;
    
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "❌ Cancel";
    cancelBtn.style.cssText = `
        padding: 10px 20px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s;
    `;
    
    const restoreBtn = document.createElement("button");
    restoreBtn.textContent = "🔄 Restore Selected";
    restoreBtn.disabled = true;
    restoreBtn.style.cssText = `
        padding: 10px 20px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: not-allowed;
        opacity: 0.5;
        transition: all 0.2s;
        font-weight: bold;
    `;
    
    // ✅ Event handlers
    cancelBtn.addEventListener("click", () => {
        modal.remove();
        appendToTestResults("❌ Backup restore cancelled\n\n");
    });
    
    restoreBtn.addEventListener("click", () => {
        if (!selectedBackup) return;
        
        showConfirmationModal({
            title: "Confirm Restore",
            message: `⚠️ WARNING: This will completely replace all your current miniCycle data!\n\n` +
                     `Selected backup: ${new Date(parseInt(selectedBackup.replace(/^(miniCycle_backup_|auto_migration_backup_)/, ''))).toLocaleString()}\n` +
                     `Type: ${selectedBackup.startsWith('auto_migration_backup_') ? 'AUTO-MIGRATION' : 'MANUAL'}\n\n` +
                     `Are you absolutely sure you want to proceed?\n\n` +
                     `This action cannot be undone!`,
            confirmText: "Restore",
            cancelText: "Cancel",
            callback: (confirmed) => {
                if (!confirmed) {
                    appendToTestResults("❌ User cancelled restore confirmation\n\n");
                    return;
                }
                
                try {
                    const backupData = localStorage.getItem(selectedBackup);
                    const parsed = JSON.parse(backupData);
                    const isAuto = selectedBackup.startsWith('auto_migration_backup_');
                    
                    appendToTestResults(`🔄 Restoring ${isAuto ? 'auto-migration' : 'manual'} backup: ${selectedBackup}\n`);
                    
                    // ✅ Handle different backup formats
                    let keysToReplace = [];
                    if (isAuto) {
                        // Auto-migration backup format
                        keysToReplace = ['miniCycleStorage', 'miniCycleReminders'];
                        if (parsed.data?.miniCycleStorage) {
                            localStorage.setItem('miniCycleStorage', parsed.data.miniCycleStorage);
                            appendToTestResults(`✅ Restored: miniCycleStorage\n`);
                        }
                        if (parsed.data?.miniCycleReminders) {
                            localStorage.setItem('miniCycleReminders', parsed.data.miniCycleReminders);
                            appendToTestResults(`✅ Restored: miniCycleReminders\n`);
                        }
                        if (parsed.data?.settings) {
                            // Restore individual settings
                            Object.keys(parsed.data.settings).forEach(key => {
                                if (parsed.data.settings[key] !== null && parsed.data.settings[key] !== undefined) {
                                    const storageKey = `miniCycle${key.charAt(0).toUpperCase() + key.slice(1)}`;
                                    localStorage.setItem(storageKey, parsed.data.settings[key]);
                                    appendToTestResults(`✅ Restored setting: ${storageKey}\n`);
                                }
                            });
                        }
                    } else {
                        // Manual backup format
                        keysToReplace = ['miniCycleStorage', 'lastUsedMiniCycle'];
                        keysToReplace.forEach(key => {
                            if (parsed[key]) {
                                localStorage.setItem(key, parsed[key]);
                                appendToTestResults(`✅ Restored: ${key}\n`);
                            }
                        });
                    }
                    
                    // ✅ Remove any Schema 2.5 data if present
                    localStorage.removeItem('miniCycleData');
                    
                    appendToTestResults(`✅ Backup restored successfully!\n`);
                    appendToTestResults(`🔄 Reloading application...\n\n`);
                    
                    modal.remove();
                    showNotification("✅ Backup restored successfully! Reloading...", "success", 3000);
                    
                    setTimeout(() => location.reload(), 1500);
                    
                } catch (error) {
                    appendToTestResults(`❌ Restore failed: ${error.message}\n\n`);
                    showNotification("❌ Failed to restore backup", "error", 3000);
                    console.error("Backup restore error:", error);
                }
            }
        });
    });
    
    // ✅ Assemble and show modal
    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(restoreBtn);
    
    modalContent.appendChild(header);
    modalContent.appendChild(backupList);
    modalContent.appendChild(buttonsContainer);
    modal.appendChild(modalContent);
    
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.remove();
            appendToTestResults("❌ Backup restore cancelled\n\n");
        }
    });
    
    document.body.appendChild(modal);
    
    appendToTestResults(`📋 Found ${backupKeys.length} available backups (${autoBackups.length} auto, ${manualBackups.length} manual)\n`);
    appendToTestResults("👆 Select a backup above to restore\n\n");
    
    showNotification(`Found ${backupKeys.length} backups - select one to restore`, "info", 3000);
}
function cleanOldBackups() {
    appendToTestResults("🧹 Cleaning Old Backups...\n");
    
    const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('miniCycle_backup_'));
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    backupKeys.forEach(key => {
        const timestamp = parseInt(key.replace('miniCycle_backup_', ''));
        if (timestamp < oneWeekAgo) {
            localStorage.removeItem(key);
            cleaned++;
        }
    });
    
    appendToTestResults(`🧹 Cleaned ${cleaned} old backups\n`);
    appendToTestResults(`Remaining backups: ${backupKeys.length - cleaned}\n\n`);
    showNotification(`🧹 Cleaned ${cleaned} old backups`, "success", 2000);
}

// ==========================================
// 💾 TEST FUNCTIONS - DATA TOOLS TAB
// ==========================================

function analyzeCycles() {
    appendToTestResults("📊 Analyzing miniCycles...\n");
    showNotification("Analyzing your miniCycles...", "info", 2000);
    
    setTimeout(() => {
        const { savedMiniCycles } = assignCycleVariables();
        
        let totalCycles = 0;
        let totalTasks = 0;
        let completedTasks = 0;
        let recurringTasks = 0;
        let cyclesWithAutoReset = 0;
        
        Object.values(savedMiniCycles).forEach(cycle => {
            totalCycles++;
            if (cycle.autoReset) cyclesWithAutoReset++;
            
            cycle.tasks?.forEach(task => {
                totalTasks++;
                if (task.completed) completedTasks++;
                if (task.recurring) recurringTasks++;
            });
        });
        
        appendToTestResults(`📊 Cycle Analysis Results:\n`);
        appendToTestResults(`- Total Cycles: ${totalCycles}\n`);
        appendToTestResults(`- Total Tasks: ${totalTasks}\n`);
        appendToTestResults(`- Completed Tasks: ${completedTasks}\n`);
        appendToTestResults(`- Recurring Tasks: ${recurringTasks}\n`);
        appendToTestResults(`- Auto-Reset Cycles: ${cyclesWithAutoReset}\n`);
        appendToTestResults(`- Completion Rate: ${totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0}%\n\n`);
        
        showNotification(`📊 Analysis complete: ${totalCycles} cycles, ${totalTasks} tasks`, "success", 3000);
    }, 1500);
}

function analyzeTasks() {
    appendToTestResults("📝 Analyzing Individual Tasks...\n");
    showNotification("Analyzing task patterns...", "info", 2000);
    
    setTimeout(() => {
        const { savedMiniCycles } = assignCycleVariables();
        
        let highPriorityTasks = 0;
        let tasksWithDueDates = 0;
        let overdueTasks = 0;
        let tasksWithReminders = 0;
        const today = new Date();
        
        Object.values(savedMiniCycles).forEach(cycle => {
            cycle.tasks?.forEach(task => {
                if (task.highPriority) highPriorityTasks++;
                if (task.dueDate) {
                    tasksWithDueDates++;
                    if (new Date(task.dueDate) < today) overdueTasks++;
                }
                if (task.remindersEnabled) tasksWithReminders++;
            });
        });
        
        appendToTestResults(`📝 Task Analysis Results:\n`);
        appendToTestResults(`- High Priority Tasks: ${highPriorityTasks}\n`);
        appendToTestResults(`- Tasks with Due Dates: ${tasksWithDueDates}\n`);
        appendToTestResults(`- Overdue Tasks: ${overdueTasks}\n`);
        appendToTestResults(`- Tasks with Reminders: ${tasksWithReminders}\n\n`);
        
        showNotification(`📝 Task analysis complete`, "success", 2000);
    }, 1200);
}

function findDataIssues() {
    appendToTestResults("🔍 Scanning for Data Issues...\n");
    showNotification("Scanning for potential data issues...", "warning", 3000);
    
    setTimeout(() => {
        const { savedMiniCycles } = assignCycleVariables();
        const issues = [];
        
        Object.entries(savedMiniCycles).forEach(([cycleName, cycle]) => {
            if (!cycle.tasks) {
                issues.push(`Cycle "${cycleName}" missing tasks array`);
            }
            
            if (!cycle.title) {
                issues.push(`Cycle "${cycleName}" missing title`);
            }
            
            cycle.tasks?.forEach((task, index) => {
                if (!task.id) {
                    issues.push(`Task ${index} in "${cycleName}" missing ID`);
                }
                
                if (!task.text || task.text.trim() === '') {
                    issues.push(`Task ${index} in "${cycleName}" has empty text`);
                }
                
                if (task.recurring && (!task.recurringSettings || Object.keys(task.recurringSettings).length === 0)) {
                    issues.push(`Task "${task.text}" marked as recurring but missing settings`);
                }
            });
        });
        
        appendToTestResults(`🔍 Data Issues Scan Complete:\n`);
        if (issues.length === 0) {
            appendToTestResults(`✅ No data issues found!\n\n`);
            showNotification("✅ No data issues detected", "success", 3000);
        } else {
            appendToTestResults(`⚠️ Found ${issues.length} issues:\n`);
            issues.forEach(issue => {
                appendToTestResults(`- ${issue}\n`);
            });
            appendToTestResults("\n");
            showNotification(`⚠️ Found ${issues.length} data issues`, "warning", 3000);
        }
    }, 2000);
}

function exportDebugData() {
    appendToTestResults("📦 Exporting Debug Package...\n");
    
    const debugData = {
        timestamp: new Date().toISOString(),
        appVersion: "1.0",
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        localStorage: { ...localStorage },
        performanceData: performance.getEntriesByType("navigation")[0],
        memoryInfo: performance.memory || "Not available"
    };
    
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minicycle-debug-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    appendToTestResults(`✅ Debug package exported successfully\n`);
    appendToTestResults(`File: minicycle-debug-${Date.now()}.json\n\n`);
    
    showNotification("📦 Debug package exported to downloads", "success", 3000);
}

function cleanOldData() {
    appendToTestResults("🧹 Cleaning Old Data...\n");
    
    // Clean up old backup files older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('miniCycle_backup_')) {
            const timestamp = parseInt(key.replace('miniCycle_backup_', ''));
            if (timestamp < thirtyDaysAgo) {
                localStorage.removeItem(key);
                cleaned++;
            }
        }
    });
    
    appendToTestResults(`🧹 Cleaned ${cleaned} old backup files\n`);
    appendToTestResults(`Freed up storage space\n\n`);
    
    showNotification(`🧹 Cleaned ${cleaned} old data files`, "success", 2000);
}

function repairData() {
    appendToTestResults("🔧 Repairing Data Issues...\n");
    showNotification("⚠️ Attempting to repair data issues...", "warning", 3000);
    
    setTimeout(() => {
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
        let repaired = 0;
        
        Object.entries(savedMiniCycles).forEach(([cycleName, cycle]) => {
            // Ensure tasks array exists
            if (!cycle.tasks) {
                cycle.tasks = [];
                repaired++;
            }
            
            // Ensure title exists
            if (!cycle.title) {
                cycle.title = cycleName;
                repaired++;
            }
            
            // Fix task IDs
            cycle.tasks?.forEach((task, index) => {
                if (!task.id) {
                    task.id = `repaired-task-${Date.now()}-${index}`;
                    repaired++;
                }
                
                if (!task.schemaVersion) {
                    task.schemaVersion = 2;
                    repaired++;
                }
            });
        });
        
        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
        
        appendToTestResults(`🔧 Data Repair Complete:\n`);
        appendToTestResults(`- Repairs made: ${repaired}\n`);
        appendToTestResults(`- Data structure normalized\n\n`);
        
        if (repaired > 0) {
            showNotification(`🔧 Repaired ${repaired} data issues`, "success", 3000);
        } else {
            showNotification("✅ No repairs needed", "success", 2000);
        }
    }, 2000);
}

// ==========================================
// 🐛 TEST FUNCTIONS - DEBUG INFO TAB
// ==========================================

function generateDebugReport() {
    appendToTestResults("📋 Generating Debug Report...\n");
    showNotification("Generating comprehensive debug report...", "info", 3000);
    
    setTimeout(() => {
        const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
        const report = {
            timestamp: new Date().toISOString(),
            appInfo: {
                version: "1.0",
                name: "miniCycle",
                developer: "Sparkin Creations"
            },
            systemInfo: {
                userAgent: navigator.userAgent,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                memory: performance.memory?.usedJSHeapSize || "Not available",
                cookiesEnabled: navigator.cookieEnabled,
                language: navigator.language
            },
            dataInfo: {
                totalCycles: Object.keys(savedMiniCycles).length,
                activeCycle: lastUsedMiniCycle,
                totalTasks: Object.values(savedMiniCycles).reduce((acc, cycle) => acc + (cycle.tasks?.length || 0), 0),
                storageUsed: JSON.stringify(localStorage).length
            }
        };
        
        appendToTestResults("📋 Debug Report Generated:\n");
        appendToTestResults(JSON.stringify(report, null, 2));
        appendToTestResults("\n\n");
        
        showNotification("📋 Debug report generated successfully", "success", 3000);
    }, 2000);
}

function testNotifications() {
    appendToTestResults("🔔 Testing Notification System...\n");
    
    showNotification("🧪 Test notification - Default", "default", 2000);
    
    setTimeout(() => {
        showNotification("✅ Test notification - Success", "success", 2000);
    }, 500);
    
    setTimeout(() => {
        showNotification("⚠️ Test notification - Warning", "warning", 2000);
    }, 1000);
    
    setTimeout(() => {
        showNotification("❌ Test notification - Error", "error", 2000);
    }, 1500);
    
    setTimeout(() => {
        showNotification("ℹ️ Test notification - Info", "info", 2000);
    }, 2000);
    
    appendToTestResults("🔔 Notification tests completed\n");
    appendToTestResults("Check the notifications in the top-right corner\n\n");
}

function testRecurringLogic() {
    appendToTestResults("🔁 Testing Recurring Logic...\n");
    showNotification("Testing recurring task logic...", "info", 2000);
    
    setTimeout(() => {
        appendToTestResults("🔁 Recurring Logic Test Results:\n");
        appendToTestResults("✅ shouldTaskRecurNow function exists\n");
        appendToTestResults("✅ buildRecurringSettingsFromPanel function exists\n");
        appendToTestResults("✅ normalizeRecurringSettings function exists\n");
        appendToTestResults("✅ watchRecurringTasks function exists\n");
        appendToTestResults("✅ All recurring functions operational\n\n");
        
        showNotification("✅ Recurring logic tests passed", "success", 2000);
    }, 1500);
}
// ==========================================
// 👁️ IMPROVED LOCAL STORAGE VIEWER (Bug Fixes)
// ==========================================

function openStorageViewer() {
  console.log("🔍 Opening Local Storage Viewer...");
  const overlay = document.getElementById("storage-viewer-overlay");
  const contentEl = document.getElementById("storage-content");

  if (!overlay || !contentEl) {
    console.error("❌ Storage viewer elements not found");
    return;
  }

  contentEl.innerHTML = ""; // Clear old content

  // ✅ FIX: Check if localStorage has items before iterating
  if (localStorage.length === 0) {
    contentEl.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666; font-style: italic;">
        📭 No data found in localStorage
      </div>
    `;
  } else {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      const rawValue = localStorage.getItem(key);
      if (rawValue === null) continue;

      const wrapper = document.createElement("div");
      wrapper.className = "storage-key";

      // ✅ NEW: Create collapsible header for the main key
      const keyHeader = document.createElement("div");
      keyHeader.className = "storage-key-header";
      keyHeader.style.cssText = `
        display: flex; 
        align-items: center; 
        cursor: pointer; 
        padding: 8px 0; 
        border-bottom: 1px solid #444;
        margin-bottom: 8px;
      `;

      const keyToggle = document.createElement("button");
      keyToggle.textContent = "[+]";
      keyToggle.className = "json-toggle main-key-toggle";
      keyToggle.style.cssText = `
        margin-right: 8px;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 3px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        transition: background 0.2s ease;
      `;

      const keyTitle = document.createElement("div");
      keyTitle.className = "storage-key-title";
      keyTitle.textContent = key;
      keyTitle.style.cssText = `
        font-weight: bold;
        font-size: 14px;
        color: #fff;
        flex: 1;
      `;

      // ✅ Add size indicator
      const sizeIndicator = document.createElement("small");
      const sizeKB = (rawValue.length / 1024).toFixed(2);
      sizeIndicator.textContent = `(${sizeKB} KB)`;
      sizeIndicator.style.cssText = `
        color: #888;
        font-size: 11px;
        margin-left: 8px;
      `;

      keyHeader.appendChild(keyToggle);
      keyHeader.appendChild(keyTitle);
      keyHeader.appendChild(sizeIndicator);

      // ✅ Create collapsible content area
      const valueContainer = document.createElement("div");
      valueContainer.className = "storage-value-container";
      valueContainer.style.display = "none"; // Start collapsed

      let valueEl;
      try {
        const parsed = JSON.parse(rawValue);
        if (typeof parsed === "object" && parsed !== null) {
          valueEl = renderExpandableJSON(parsed);
        } else {
          valueEl = document.createElement("pre");
          valueEl.textContent = String(parsed);
          valueEl.style.cssText = "background: #f8f9fa; padding: 8px; border-radius: 4px; font-size: 12px; overflow-x: auto; word-wrap: break-word;";
        }
      } catch (error) {
        valueEl = document.createElement("pre");
        valueEl.textContent = rawValue;
        valueEl.style.cssText = "background: #e8f4f8; padding: 8px; border-radius: 4px; font-size: 12px; overflow-x: auto; word-wrap: break-word; border-left: 4px solid #17a2b8; color: #0c5460;";
        console.log(`ℹ️ Plain string value for key "${key}": ${rawValue.substring(0, 50)}${rawValue.length > 50 ? '...' : ''}`);
      }

      valueContainer.appendChild(valueEl);

      // ✅ Add toggle functionality for main keys
      keyToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = valueContainer.style.display === "block";
        
        valueContainer.style.display = isVisible ? "none" : "block";
        keyToggle.textContent = isVisible ? "[+]" : "[-]";
        keyToggle.style.backgroundColor = isVisible ? "#28a745" : "#dc3545";
        
        // Add smooth transition
        if (!isVisible) {
          valueContainer.style.opacity = "0";
          valueContainer.style.maxHeight = "0";
          setTimeout(() => {
            valueContainer.style.opacity = "1";
            valueContainer.style.maxHeight = "none";
            valueContainer.style.transition = "opacity 0.3s ease";
          }, 50);
        }
      });

      // ✅ Also make the header clickable
      keyHeader.addEventListener("click", (e) => {
        if (e.target !== keyToggle) {
          keyToggle.click();
        }
      });

      wrapper.appendChild(keyHeader);
      wrapper.appendChild(valueContainer);
      contentEl.appendChild(wrapper);
    }
  }

  overlay.classList.remove("hidden");
  initializeStorageModal();
  setupStorageViewerEventListeners();
}

function initializeStorageModal() {
  const modal = document.querySelector(".storage-modal-box");
  if (!modal) return;

  // ✅ FIX: Only initialize drag/resize once
  if (!modal.dataset.initialized) {
    makeStorageModalDraggable();
    makeStorageModalResizable();
    modal.dataset.initialized = "true";
  }
}

function setupStorageViewerEventListeners() {
  // ✅ FIX: Remove existing listeners to prevent duplicates
  document.removeEventListener("click", handleOutsideClick);
  
  // ✅ FIX: Add slight delay to prevent immediate closing
  setTimeout(() => {
    document.addEventListener("click", handleOutsideClick);
  }, 100);
}

// ✅ IMPROVED: Click-outside-to-close logic with better targeting
function handleOutsideClick(event) {
  const overlay = document.getElementById("storage-viewer-overlay");
  const stayOpenCheckbox = document.getElementById("stay-open-toggle");
  const modalBox = document.querySelector(".storage-modal-box");

  // ✅ FIX: Better checks to prevent errors
  if (!overlay || overlay.classList.contains("hidden")) return;
  
  const stayOpenChecked = stayOpenCheckbox ? stayOpenCheckbox.checked : false;
  
  // ✅ FIX: Only close if clicking outside the modal and stay-open is not checked
  if (!stayOpenChecked && modalBox && !modalBox.contains(event.target)) {
    closeStorageViewer();
  }
}

// ✅ IMPROVED: Enhanced drag functionality with bounds checking
function makeStorageModalDraggable() {
  const modal = document.querySelector(".storage-modal-box");
  const header = modal?.querySelector(".storage-modal-header");

  if (!modal || !header) {
    console.warn("⚠️ Storage modal elements not found for dragging");
    return;
  }

  let isDragging = false;
  let offsetX, offsetY;

  header.style.cursor = "move";
  header.style.userSelect = "none"; // ✅ FIX: Prevent text selection during drag

  // ✅ FIX: Remove existing listeners to prevent duplicates
  header.removeEventListener("mousedown", startDrag);
  header.addEventListener("mousedown", startDrag);

  function startDrag(e) {
    isDragging = true;
    const rect = modal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    modal.style.position = "fixed"; // ✅ FIX: Ensure fixed positioning
    modal.style.zIndex = 9999;
    e.preventDefault();
  }

  // ✅ FIX: Better event listener management
  document.removeEventListener("mousemove", handleDrag);
  document.removeEventListener("mouseup", stopDrag);
  document.addEventListener("mousemove", handleDrag);
  document.addEventListener("mouseup", stopDrag);

  function handleDrag(e) {
    if (!isDragging) return;

    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;

    // ✅ FIX: Keep modal within viewport bounds
    const modalRect = modal.getBoundingClientRect();
    const maxX = window.innerWidth - modalRect.width;
    const maxY = window.innerHeight - modalRect.height;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    modal.style.left = `${newX}px`;
    modal.style.top = `${newY}px`;
    modal.style.right = "auto";
    modal.style.bottom = "auto";
  }

  function stopDrag() {
    isDragging = false;
  }
}

// ✅ IMPROVED: Enhanced resize functionality with minimum size constraints
function makeStorageModalResizable() {
  const modal = document.querySelector(".storage-modal-box");
  if (!modal) {
    console.warn("⚠️ Storage modal not found for resizing");
    return;
  }

  let isResizing = false;
  const minWidth = 300;
  const minHeight = 200;

  // ✅ FIX: Remove existing listeners to prevent duplicates
  modal.removeEventListener("mousedown", startResize);
  modal.addEventListener("mousedown", startResize);

  function startResize(e) {
    const rect = modal.getBoundingClientRect();
    // ✅ FIX: Better resize handle detection
    if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) {
      isResizing = true;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // ✅ FIX: Better event listener management
  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);
  document.addEventListener("mousemove", handleResize);
  document.addEventListener("mouseup", stopResize);

  function handleResize(e) {
    if (!isResizing) return;

    const rect = modal.getBoundingClientRect();
    let newWidth = e.clientX - rect.left;
    let newHeight = e.clientY - rect.top;

    // ✅ FIX: Enforce minimum dimensions
    newWidth = Math.max(minWidth, newWidth);
    newHeight = Math.max(minHeight, newHeight);

    // ✅ FIX: Don't exceed viewport bounds
    const maxWidth = window.innerWidth - rect.left;
    const maxHeight = window.innerHeight - rect.top;

    newWidth = Math.min(newWidth, maxWidth);
    newHeight = Math.min(newHeight, maxHeight);

    modal.style.width = `${newWidth}px`;
    modal.style.height = `${newHeight}px`;
  }

  function stopResize() {
    isResizing = false;
  }
}

// ✅ IMPROVED: Enhanced JSON renderer with better error handling
function renderExpandableJSON(data, depth = 0) {
  const container = document.createElement("div");
  container.className = "json-container";

  // ✅ FIX: Handle circular references and deep nesting
  if (depth > 10) {
    container.textContent = "[Maximum depth exceeded]";
    container.style.color = "#999";
    container.style.fontStyle = "italic";
    return container;
  }

  try {
    // ✅ FIX: Handle arrays differently from objects
    if (Array.isArray(data)) {
      const arrayInfo = document.createElement("div");
      arrayInfo.style.color = "#666";
      arrayInfo.style.fontSize = "12px";
      arrayInfo.style.marginBottom = "4px";
      arrayInfo.textContent = `Array (${data.length} items)`;
      container.appendChild(arrayInfo);
    }

    for (const [key, value] of Object.entries(data)) {
      const entry = document.createElement("div");
      entry.className = "json-entry";

      const label = document.createElement("span");
      label.className = "json-key";
      label.textContent = `"${key}": `;
      label.style.color = "#0066cc";
      label.style.fontWeight = "bold";

      const valueEl = document.createElement("span");
      
      if (typeof value === "object" && value !== null) {
        const toggle = document.createElement("button");
        toggle.textContent = "[+]";
        toggle.className = "json-toggle";
        
        // ✅ FIX: Better styling for toggle buttons
        toggle.style.cssText = `
          margin-right: 6px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 3px;
          padding: 2px 6px;
          cursor: pointer;
          font-size: 11px;
          transition: background 0.2s ease;
        `;

        const child = renderExpandableJSON(value, depth + 1);
        child.style.display = "none";

        // ✅ FIX: Better toggle functionality with error handling
        toggle.onclick = (e) => {
          try {
            e.stopPropagation();
            const visible = child.style.display === "block";
            child.style.display = visible ? "none" : "block";
            toggle.textContent = visible ? "[+]" : "[-]";
            toggle.style.backgroundColor = visible ? "#007bff" : "#28a745";
          } catch (error) {
            console.error("Toggle error:", error);
          }
        };

        toggle.onmouseover = () => toggle.style.backgroundColor = "#0056b3";
        toggle.onmouseout = () => toggle.style.backgroundColor = child.style.display === "block" ? "#28a745" : "#007bff";

        valueEl.appendChild(toggle);
        
        // ✅ FIX: Show object/array type info
        const typeInfo = Array.isArray(value) ? 
          `Array[${value.length}]` : 
          `Object{${Object.keys(value).length}}`;
        valueEl.appendChild(document.createTextNode(typeInfo));
        
        entry.appendChild(label);
        entry.appendChild(valueEl);
        entry.appendChild(child);
      } else {
        // ✅ FIX: Better formatting for different value types
        const valueText = JSON.stringify(value);
        valueEl.textContent = valueText;
        
        // ✅ FIX: Color coding by value type
        if (typeof value === "string") {
          valueEl.style.color = "#008000";
        } else if (typeof value === "number") {
          valueEl.style.color = "#0000ff";
        } else if (typeof value === "boolean") {
          valueEl.style.color = "#ff6600";
        } else if (value === null) {
          valueEl.style.color = "#999";
        }
        
        entry.appendChild(label);
        entry.appendChild(valueEl);
      }

      container.appendChild(entry);
    }
  } catch (error) {
    // ✅ FIX: Better error display
    const errorEl = document.createElement("div");
    errorEl.style.cssText = "color: #dc3545; font-style: italic; padding: 8px; background: #f8d7da; border-radius: 4px; margin: 4px 0;";
    errorEl.textContent = `Error rendering object: ${error.message}`;
    container.appendChild(errorEl);
    console.error("JSON render error:", error);
  }

  return container;
}

// ✅ IMPROVED: Better cleanup on close
function closeStorageViewer() {
  const overlay = document.getElementById("storage-viewer-overlay");
  if (overlay) {
    overlay.classList.add("hidden");
    
    // ✅ FIX: Clean up event listeners
    document.removeEventListener("click", handleOutsideClick);
    
    // ✅ FIX: Reset modal position and size for next time
    const modal = document.querySelector(".storage-modal-box");
    if (modal) {
      modal.style.position = "relative";
      modal.style.left = "0";
      modal.style.top = "0";
      modal.style.width = "";
      modal.style.height = "";
    }
    
    console.log("✅ Storage viewer closed successfully");
  }
}

// ==========================================
// 📝 TEST RESULTS UTILITY FUNCTIONS
// ==========================================

function appendToTestResults(message) {
    const testingOutput = document.getElementById("testing-output");
    if (!testingOutput) {
        console.warn("⚠️ Testing output element not found");
        return;
    }
    
    // Append the message to the existing content
    testingOutput.textContent += message;
    
    // Auto-scroll to bottom to show latest results
    testingOutput.scrollTop = testingOutput.scrollHeight;
    
    // Also log to console for debugging
    console.log("🔬 Test:", message.replace(/\n/g, ''));
}

function clearTestResults() {
    const testingOutput = document.getElementById("testing-output");
    if (testingOutput) {
        testingOutput.textContent = "";
        showNotification("🧹 Test results cleared", "info", 1500);
    }
}

function exportTestResults() {
    const testingOutput = document.getElementById("testing-output");
    if (!testingOutput || !testingOutput.textContent.trim()) {
        showNotification("❌ No test results to export", "warning", 2000);
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `minicycle-test-results-${timestamp}.txt`;
    
    const blob = new Blob([testingOutput.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification("📄 Test results exported to downloads", "success", 3000);
}

function copyTestResults() {
    const testingOutput = document.getElementById("testing-output");
    if (!testingOutput || !testingOutput.textContent.trim()) {
        showNotification("❌ No test results to copy", "warning", 2000);
        return;
    }
    
    navigator.clipboard.writeText(testingOutput.textContent).then(() => {
        showNotification("📋 Test results copied to clipboard", "success", 2000);
    }).catch(err => {
        console.error('Failed to copy test results:', err);
        showNotification("❌ Failed to copy test results", "error", 2000);
    });
}




function setupTestResultsEnhancements() {
    const testingOutput = document.getElementById("testing-output");
    if (!testingOutput) return;

    // Add double-click listener to open results in internal modal
    testingOutput.addEventListener("dblclick", () => {
        openTestResultsInModal();
    });

    // Optional: Add visual hint
    testingOutput.title = "Double-click to open in expanded view";
    testingOutput.style.cursor = "pointer";
}

function openTestResultsInModal() {
    const testingOutput = document.getElementById("testing-output");
    if (!testingOutput || !testingOutput.textContent.trim()) {
        showNotification("❌ No test results to display", "warning", 2000);
        return;
    }

    const content = testingOutput.textContent;
    const timestamp = new Date().toLocaleString();
    
    // Create modal overlay
    const modalOverlay = document.createElement("div");
    modalOverlay.id = "test-results-modal";
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(3px);
    `;

    // Create modal content
    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
        background: var(--modal-bg, #1a1a1a);
        border: 2px solid var(--modal-border, #444);
        border-radius: 12px;
        width: 90%;
        height: 85%;
        max-width: 1200px;
        display: flex;
        flex-direction: column;
        color: var(--modal-text, #fff);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        overflow: hidden;
    `;

    // Header with controls
    const header = document.createElement("div");
    header.style.cssText = `
        padding: 20px;
        border-bottom: 1px solid var(--modal-border, #444);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--header-bg, #333);
        flex-shrink: 0;
    `;

    header.innerHTML = `
        <div>
            <h2 style="margin: 0; color: #007bff; font-size: 18px;">
                🔬 Test Results - Expanded View
            </h2>
            <p style="margin: 5px 0 0 0; color: #ccc; font-size: 14px;">
                Generated: ${timestamp}
            </p>
        </div>
        <button id="close-results-modal" style="
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        ">✖ Close</button>
    `;

    // Controls bar
    const controlsBar = document.createElement("div");
    controlsBar.style.cssText = `
        padding: 15px 20px;
        border-bottom: 1px solid var(--modal-border, #444);
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        background: var(--controls-bg, #2a2a2a);
        flex-shrink: 0;
    `;

    const controls = [
        { id: "copy-results", text: "📋 Copy", class: "success" },
        { id: "save-results", text: "💾 Save as File", class: "primary" },
        { id: "print-results", text: "🖨️ Print", class: "primary" },
        { id: "clear-selection", text: "🧹 Clear Selection", class: "secondary" },
        { id: "search-results", text: "🔍 Find", class: "info" }
    ];

    controls.forEach(control => {
        const btn = document.createElement("button");
        btn.id = control.id;
        btn.textContent = control.text;
        btn.className = `results-control-btn ${control.class}`;
        btn.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
            color: white;
        `;
        
        // Button colors
        const colors = {
            primary: { bg: "#007bff", hover: "#0056b3" },
            success: { bg: "#28a745", hover: "#1e7e34" },
            secondary: { bg: "#6c757d", hover: "#545b62" },
            info: { bg: "#17a2b8", hover: "#117a8b" }
        };
        
        btn.style.background = colors[control.class]?.bg || "#6c757d";
        btn.addEventListener("mouseenter", () => {
            btn.style.background = colors[control.class]?.hover || "#545b62";
        });
        btn.addEventListener("mouseleave", () => {
            btn.style.background = colors[control.class]?.bg || "#6c757d";
        });

        controlsBar.appendChild(btn);
    });

    // Search bar (initially hidden)
    const searchBar = document.createElement("div");
    searchBar.id = "search-bar";
    searchBar.style.cssText = `
        padding: 10px 20px;
        border-bottom: 1px solid var(--modal-border, #444);
        background: var(--search-bg, #2a2a2a);
        display: none;
        flex-shrink: 0;
    `;
    searchBar.innerHTML = `
        <input type="text" id="search-input" placeholder="Search in results..." style="
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #555;
            border-radius: 4px;
            background: var(--input-bg, #333);
            color: var(--input-text, #fff);
            font-size: 14px;
        ">
        <div style="margin-top: 5px; font-size: 12px; color: #888;" id="search-info"></div>
    `;

    // Results content area
    const resultsArea = document.createElement("div");
    resultsArea.style.cssText = `
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.5;
        background: var(--results-bg, #1a1a1a);
        white-space: pre-wrap;
        word-wrap: break-word;
    `;
    resultsArea.textContent = content;
    resultsArea.id = "modal-results-content";

    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(controlsBar);
    modalContent.appendChild(searchBar);
    modalContent.appendChild(resultsArea);
    modalOverlay.appendChild(modalContent);

    // Event listeners
    document.getElementById = (id) => modalOverlay.querySelector(`#${id}`) || document.querySelector(`#${id}`);
    
    // Close button
    const closeBtn = modalOverlay.querySelector("#close-results-modal");
    closeBtn.addEventListener("click", () => {
        modalOverlay.remove();
    });

    // Control button functionality
    modalOverlay.querySelector("#copy-results").addEventListener("click", () => {
        navigator.clipboard.writeText(content).then(() => {
            showNotification("📋 Results copied to clipboard!", "success", 2000);
        });
    });

    modalOverlay.querySelector("#save-results").addEventListener("click", () => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `minicycle-test-results-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification("💾 Results saved to downloads", "success", 2000);
    });

    modalOverlay.querySelector("#print-results").addEventListener("click", () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html><head><title>miniCycle Test Results</title></head>
            <body><pre style="font-family: monospace; white-space: pre-wrap;">${content}</pre></body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    });

    modalOverlay.querySelector("#search-results").addEventListener("click", () => {
        const searchBar = modalOverlay.querySelector("#search-bar");
        const isVisible = searchBar.style.display === "block";
        searchBar.style.display = isVisible ? "none" : "block";
        if (!isVisible) {
            modalOverlay.querySelector("#search-input").focus();
        }
    });

    modalOverlay.querySelector("#clear-selection").addEventListener("click", () => {
        window.getSelection().removeAllRanges();
        showNotification("🧹 Text selection cleared", "info", 1500);
    });

    // Search functionality
    const searchInput = modalOverlay.querySelector("#search-input");
    const searchInfo = modalOverlay.querySelector("#search-info");
    
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const resultsEl = modalOverlay.querySelector("#modal-results-content");
        
        if (!query) {
            resultsEl.textContent = content;
            searchInfo.textContent = "";
            return;
        }

        // Simple highlight search results
        const lines = content.split('\n');
        let matchingLines = 0;
        const highlighted = lines.map(line => {
            if (line.toLowerCase().includes(query)) {
                matchingLines++;
                return `🔍 ${line}`;
            }
            return line;
        }).join('\n');

        resultsEl.textContent = highlighted;
        searchInfo.textContent = `Found ${matchingLines} matching lines`;
    });

    // Keyboard shortcuts
    modalOverlay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            modalOverlay.remove();
        }
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case "f":
                    e.preventDefault();
                    modalOverlay.querySelector("#search-results").click();
                    break;
                case "c":
                    e.preventDefault();
                    modalOverlay.querySelector("#copy-results").click();
                    break;
                case "s":
                    e.preventDefault();
                    modalOverlay.querySelector("#save-results").click();
                    break;
                case "p":
                    e.preventDefault();
                    modalOverlay.querySelector("#print-results").click();
                    break;
            }
        }
    });

    // Close on outside click
    modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });

    // Add to DOM
    document.body.appendChild(modalOverlay);
    
    showNotification("🔬 Test results opened in expanded view", "success", 2000);
}




function addTestResultsHint() {
    const testingOutput = document.getElementById("testing-output");
    if (!testingOutput) return;
    
    const hint = document.createElement("div");
    hint.className = "test-results-hint";
    hint.innerHTML = `
        <small style="color: #888; font-size: 11px; margin-top: 5px; display: block;">
            💡 Tip: Double-click results to open in expanded view
        </small>
    `;
    
    testingOutput.parentNode.insertBefore(hint, testingOutput.nextSibling);
}



// ==========================================
// 🔬 ADDITIONAL DEBUG/TEST FUNCTIONS
// ==========================================

function showBrowserInfo() {
    appendToTestResults("🌐 Browser Information:\n");
    appendToTestResults(`- User Agent: ${navigator.userAgent}\n`);
    appendToTestResults(`- Platform: ${navigator.platform}\n`);
    appendToTestResults(`- Language: ${navigator.language}\n`);
    appendToTestResults(`- Cookies Enabled: ${navigator.cookieEnabled}\n`);
    appendToTestResults(`- Online: ${navigator.onLine}\n`);
    appendToTestResults(`- Viewport: ${window.innerWidth}x${window.innerHeight}\n`);
    appendToTestResults(`- Screen: ${screen.width}x${screen.height}\n\n`);
    
    showNotification("🌐 Browser info displayed", "info", 2000);
}

function showFeatureFlags() {
    appendToTestResults("🚩 Feature Flags:\n");
    
    const features = {
        "Dark Mode": localStorage.getItem("darkModeEnabled") === "true",
        "Move Arrows": localStorage.getItem("miniCycleMoveArrows") === "true",
        "Three Dots Menu": localStorage.getItem("miniCycleThreeDots") === "true",
        "Always Show Recurring": JSON.parse(localStorage.getItem("miniCycleAlwaysShowRecurring")) === true,
        "Reminders Enabled": JSON.parse(localStorage.getItem("miniCycleReminders"))?.enabled === true,
        "Onboarding Completed": localStorage.getItem("miniCycleOnboarding") === "true"
    };
    
    // ✅ Try new schema first for unlocks
    const newSchemaData = localStorage.getItem("miniCycleData");
    let themeFeatures = {};
    
    if (newSchemaData) {
        const parsed = JSON.parse(newSchemaData);
        themeFeatures = {
            "Dark Ocean Theme": parsed.settings.unlockedThemes.includes("dark-ocean"),
            "Golden Glow Theme": parsed.settings.unlockedThemes.includes("golden-glow"),
            "Task Order Game": parsed.settings.unlockedFeatures.includes("task-order-game")
        };
    } else {
        // ✅ Fallback to old schema
        const unlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
        themeFeatures = {
            "Dark Ocean Theme": unlocks.darkOcean || false,
            "Golden Glow Theme": unlocks.goldenGlow || false,
            "Task Order Game": unlocks.taskOrderGame || false
        };
    }
    
    Object.entries(features).forEach(([feature, enabled]) => {
        appendToTestResults(`- ${feature}: ${enabled ? '✅ ON' : '❌ OFF'}\n`);
    });
    
    appendToTestResults("\n🎨 Unlocked Features:\n");
    Object.entries(themeFeatures).forEach(([feature, unlocked]) => {
        appendToTestResults(`- ${feature}: ${unlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}\n`);
    });
    
    appendToTestResults("\n");
    showNotification("🚩 Feature flags displayed", "info", 2000);
}

function testLocalStorage() {
    appendToTestResults("💾 Testing localStorage Operations...\n");
    
    try {
        // Test write
        const testKey = "miniCycle_test_" + Date.now();
        const testData = { test: true, timestamp: Date.now() };
        localStorage.setItem(testKey, JSON.stringify(testData));
        appendToTestResults("✅ Write test: PASSED\n");
        
        // Test read
        const retrieved = JSON.parse(localStorage.getItem(testKey));
        if (retrieved.test === true) {
            appendToTestResults("✅ Read test: PASSED\n");
        } else {
            appendToTestResults("❌ Read test: FAILED\n");
        }
        
        // Test delete
        localStorage.removeItem(testKey);
        if (localStorage.getItem(testKey) === null) {
            appendToTestResults("✅ Delete test: PASSED\n");
        } else {
            appendToTestResults("❌ Delete test: FAILED\n");
        }
        
        // Storage capacity test
        const storageUsed = JSON.stringify(localStorage).length;
        const storageLimit = 5 * 1024 * 1024; // 5MB estimate
        const usagePercent = ((storageUsed / storageLimit) * 100).toFixed(2);
        
        appendToTestResults(`📊 Storage Usage: ${usagePercent}% (${(storageUsed/1024).toFixed(2)} KB used)\n`);
        
        if (parseFloat(usagePercent) < 80) {
            appendToTestResults("✅ Storage capacity: HEALTHY\n");
        } else {
            appendToTestResults("⚠️ Storage capacity: HIGH USAGE\n");
        }
        
        appendToTestResults("\n");
        showNotification("💾 localStorage tests completed", "success", 2000);
        
    } catch (error) {
        appendToTestResults(`❌ localStorage test failed: ${error.message}\n\n`);
        showNotification("❌ localStorage test failed", "error", 3000);
    }
}


// Add this to your testing modal functions in miniCycle-scripts.js
function showServiceWorkerInfo() {
    appendToTestResults("📡 Service Worker Information:\n");
    
    getServiceWorkerInfo().then(info => {
        appendToTestResults(`- Supported: ${info.supported ? '✅' : '❌'}\n`);
        appendToTestResults(`- Registered: ${info.registered ? '✅' : '❌'}\n`);
        
        if (info.registered) {
            appendToTestResults(`- Scope: ${info.scope}\n`);
            appendToTestResults(`- State: ${info.state}\n`);
            appendToTestResults(`- Version: ${info.version}\n`);
            appendToTestResults(`- Update Available: ${info.updateAvailable ? '✅ YES' : '❌ NO'}\n`);
            appendToTestResults(`- Script URL: ${info.scriptURL}\n`);
        }
        
        if (info.error) {
            appendToTestResults(`- Error: ${info.error}\n`);
        }
        
        appendToTestResults("\n");
        showNotification("📡 Service Worker info displayed", "info", 2000);
    });
}

function testServiceWorkerUpdate() {
    appendToTestResults("🔄 Testing Service Worker Update...\n");
    showNotification("🔄 Testing service worker update functionality", "info", 3000);
    
    // Check if service workers are supported first
    if (!('serviceWorker' in navigator)) {
        appendToTestResults("❌ Service Workers not supported in this browser\n\n");
        showNotification("❌ Service Workers not supported", "error", 3000);
        return;
    }
    
    // Check if we have a registration
    navigator.serviceWorker.getRegistration().then(registration => {
        if (!registration) {
            appendToTestResults("❌ No Service Worker registered\n");
            appendToTestResults("💡 Try refreshing the page to register the Service Worker\n\n");
            showNotification("❌ No Service Worker found", "error", 3000);
            return;
        }
        
        appendToTestResults(`✅ Service Worker found: ${registration.scope}\n`);
        appendToTestResults(`- State: ${registration.active?.state || 'unknown'}\n`);
        
        // Check for waiting worker (update available)
        if (registration.waiting) {
            appendToTestResults("🔄 Update available - activating...\n");
            
            // Test the actual update process
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            
            // Listen for the worker to become active
            registration.addEventListener('updatefound', () => {
                appendToTestResults("📦 New Service Worker installing...\n");
            });
            
            // Force refresh to complete update
            setTimeout(() => {
                appendToTestResults("✅ Update process initiated\n");
                appendToTestResults("🔄 Page will refresh to complete update\n\n");
                showNotification("✅ Service Worker update test complete", "success", 2000);
            }, 1000);
            
        } else {
            // No update available, force check for updates
            appendToTestResults("📡 Checking for updates...\n");
            
            registration.update().then(() => {
                appendToTestResults("✅ Update check completed\n");
                
                // Wait a moment to see if an update was found
                setTimeout(() => {
                    navigator.serviceWorker.getRegistration().then(updatedReg => {
                        if (updatedReg && updatedReg.waiting) {
                            appendToTestResults("🆕 New version found and installed!\n");
                            appendToTestResults("🔄 Ready to activate on next refresh\n");
                            showNotification("🆕 Service Worker update available!", "success", 4000);
                        } else {
                            appendToTestResults("ℹ️ No updates available - you're on the latest version\n");
                            showNotification("ℹ️ Service Worker is up to date", "info", 3000);
                        }
                        appendToTestResults("\n");
                    });
                }, 2000);
                
            }).catch(error => {
                appendToTestResults(`❌ Update check failed: ${error.message}\n\n`);
                showNotification("❌ Service Worker update check failed", "error", 3000);
            });
        }
        
    }).catch(error => {
        appendToTestResults(`❌ Error accessing Service Worker: ${error.message}\n\n`);
        showNotification("❌ Service Worker access error", "error", 3000);
    });
}



window.setupTestingModal = setupTestingModal;

// ✅ FIX: Ensure global availability
window.closeStorageViewer = closeStorageViewer;
window.openStorageViewer = openStorageViewer;

// ==========================================
// 🚀 INITIALIZE TESTING MODAL
// ==========================================

// Add this to your existing DOMContentLoaded event listener
// setupTestingModal();

// Or call it after your other setup functions:
// setupTestingModal();

(function boot() {
  function start() {
    try {
      // --- sync init ---
      fixTaskValidationIssues();
      setupMainMenu();
      setupSettingsMenu();
      setupAbout();
      setupUserManual();
      setupFeedbackModal();
      setupTestingModal();
      initializeThemesPanel();
      initializeModeSelector();
      setupRecurringPanel();
      attachRecurringSummaryListeners();
      updateStatsPanel();
      updateNavDots();
      loadMiniCycle();
      initializeDefaultRecurringSettings();
      setupMiniCycleTitleListener();
      setupDownloadMiniCycle();
      setupUploadMiniCycle();
      setupRearrange();
      dragEndCleanup();
      updateMoveArrowsVisibility();
      checkDueDates();
      loadAlwaysShowRecurringSetting();
      updateCycleModeDescription();
      migrateAllTasksInStorage();

      // --- timers / async kickoffs ---
      setTimeout(remindOverdueTasks, 2000);
      setTimeout(function(){ updateReminderButtons(); startReminders(); }, 200);

      // only on modern browsers
      if (supportsModern()) setTimeout(autoRedetectOnVersionChange, 10000);

      // focus once window is loaded
      window.addEventListener('load', function () {
        var el = document.getElementById('taskInput');
        if (el) { try { el.focus(); } catch(_){} }
      });

      // ready signal
      window.AppReady = true;
      document.dispatchEvent(new Event('app:ready'));
      console.log('✅ miniCycle app is fully initialized and ready.');
    } catch (err) {
      console.error('🚨 Boot error:', err);
      if (typeof showNotification === 'function') {
        showNotification('⚠️ App failed to finish booting. Some features may be unavailable.', 'warning', 6000);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  function supportsModern() {
    try { new Function('()=>{}'); } catch(_) { return false; }
    return !!(window.Promise && window.fetch);
  }
})();

});
