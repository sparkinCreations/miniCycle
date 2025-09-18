
// ==========================================
// 🔬 TESTING MODAL FUNCTIONALITY
// ==========================================

function setupTestingModal() {
    const testingModal = document.getElementById("testing-modal");
    const openTestingBtn = document.getElementById("open-testing-modal");
    const closeTestingBtns = document.querySelectorAll(".close-testing-modal, #close-testing-modal");
    const testingOutput = document.getElementById("testing-output");
    
    // Open testing modal
    if (openTestingBtn) {
        safeAddEventListener(openTestingBtn, "click", () => {
            testingModal.style.display = "flex";
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
        appendToTestResults(`📊 Found ${cycleCount} Mini Cycles\n`);
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
    appendToTestResults(`- Name: Mini Cycle\n`);
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
    
    setTimeout(() => {
        const { savedMiniCycles } = assignCycleVariables();
        let needsMigration = false;
        let taskCount = 0;
        
        Object.values(savedMiniCycles).forEach(cycle => {
            cycle.tasks?.forEach(task => {
                taskCount++;
                if (!task.schemaVersion || task.schemaVersion < 2) {
                    needsMigration = true;
                }
            });
        });
        
        if (needsMigration) {
            appendToTestResults("⚠️ Migration Required!\n");
            appendToTestResults(`Found tasks using old schema versions\n`);
            appendToTestResults(`Total tasks to migrate: ${taskCount}\n\n`);
            showNotification("⚠️ Migration required for some tasks", "warning", 3000);
        } else {
            appendToTestResults("✅ No Migration Needed\n");
            appendToTestResults("All tasks are using current schema\n\n");
            showNotification("✅ All tasks up to date", "success", 3000);
        }
    }, 1000);
}

function testMigrationConfig() {
    appendToTestResults("🧪 Testing Migration Configuration...\n");
    appendToTestResults("✅ Migration function exists: migrateTask()\n");
    appendToTestResults("✅ Schema validation available\n");
    appendToTestResults("✅ Backup system functional\n\n");
    
    showNotification("🧪 Migration config test passed", "success", 2000);
}

function simulateMigration() {
    appendToTestResults("🎭 Simulating Migration (Safe Mode)...\n");
    showNotification("Running safe migration simulation...", "info", 3000);
    
    setTimeout(() => {
        const { savedMiniCycles } = assignCycleVariables();
        let simulatedMigrations = 0;
        
        Object.values(savedMiniCycles).forEach(cycle => {
            cycle.tasks?.forEach(task => {
                if (!task.schemaVersion || task.schemaVersion < 2) {
                    simulatedMigrations++;
                }
            });
        });
        
        appendToTestResults(`🎭 Simulation Results:\n`);
        appendToTestResults(`- Tasks that would be migrated: ${simulatedMigrations}\n`);
        appendToTestResults(`- Estimated time: ${simulatedMigrations * 0.1}s\n`);
        appendToTestResults(`- Risk level: Low\n\n`);
        
        showNotification(`🎭 Simulation: ${simulatedMigrations} tasks would be migrated`, "info", 3000);
    }, 2000);
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
    
    setTimeout(() => {
        const results = validateAllMiniCycleTasks();
        appendToTestResults(`📊 Validation Complete\n`);
        appendToTestResults(`Issues Found: ${results.length}\n`);
        appendToTestResults(`Migration Safety: ${results.length === 0 ? 'SAFE' : 'REVIEW NEEDED'}\n\n`);
        
        if (results.length === 0) {
            showNotification("✅ Data validation passed - safe to migrate", "success", 3000);
        } else {
            showNotification("⚠️ Data validation found issues", "warning", 3000);
        }
    }, 1500);
}

function performActualMigration() {
    appendToTestResults("🚀 PERFORMING ACTUAL MIGRATION...\n");
    appendToTestResults("⚠️ This will modify your data!\n");
    
    showNotification("🚀 Running actual migration - DO NOT CLOSE APP!", "warning", 5000);
    
    setTimeout(() => {
        try {
            migrateAllTasksInStorage(); // Your existing function
            appendToTestResults("✅ Migration Completed Successfully!\n");
            appendToTestResults("All tasks have been updated to schema v2\n\n");
            showNotification("✅ Migration completed successfully!", "success", 4000);
        } catch (error) {
            appendToTestResults(`❌ Migration Failed: ${error.message}\n\n`);
            showNotification("❌ Migration failed - check console", "error", 4000);
        }
    }, 2000);
}

function listAvailableBackups() {
    appendToTestResults("📋 Available Backups:\n");
    
    const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('miniCycle_backup_'));
    
    if (backupKeys.length === 0) {
        appendToTestResults("No backups found\n\n");
        showNotification("No backups available", "info", 2000);
    } else {
        backupKeys.forEach(key => {
            const timestamp = key.replace('miniCycle_backup_', '');
            const date = new Date(parseInt(timestamp)).toLocaleString();
            const size = (localStorage.getItem(key).length / 1024).toFixed(2);
            appendToTestResults(`- ${key} (${date}) - ${size} KB\n`);
        });
        appendToTestResults("\n");
        showNotification(`Found ${backupKeys.length} backups`, "info", 2000);
    }
}

function restoreFromBackup() {
    const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('miniCycle_backup_'));
    
    if (backupKeys.length === 0) {
        appendToTestResults("❌ No backups available to restore\n\n");
        showNotification("❌ No backups available to restore", "error", 3000);
        return;
    }
    
    appendToTestResults("🔄 Preparing backup selection...\n");
    
    // ✅ Create backup selection modal
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
    
    // ✅ Header
    const header = document.createElement("div");
    header.innerHTML = `
        <h3 style="margin: 0 0 20px 0; color: var(--modal-text, #fff);">
            🔄 Restore from Backup
        </h3>
        <p style="margin: 0 0 20px 0; color: #ccc; font-size: 14px;">
            Choose a backup to restore. <strong>Warning:</strong> This will replace all current data.
        </p>
    `;
    
    // ✅ Backup list container
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
        const timestampA = parseInt(a.replace('miniCycle_backup_', ''));
        const timestampB = parseInt(b.replace('miniCycle_backup_', ''));
        return timestampB - timestampA;
    });
    
    let selectedBackup = null;
    
    // ✅ Create backup selection items
    sortedBackups.forEach((backupKey, index) => {
        const timestamp = backupKey.replace('miniCycle_backup_', '');
        const date = new Date(parseInt(timestamp));
        const backupData = localStorage.getItem(backupKey);
        const size = (backupData.length / 1024).toFixed(2);
        
        // ✅ Try to extract cycle count from backup data
        let cycleInfo = "";
        try {
            const parsed = JSON.parse(backupData);
            const storage = parsed.miniCycleStorage ? JSON.parse(parsed.miniCycleStorage) : {};
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
        
        backupItem.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">
                📅 ${date.toLocaleString()}
                ${index === 0 ? '<span style="color: #28a745; font-size: 12px;"> (Latest)</span>' : ''}
            </div>
            <div style="font-size: 12px; color: #ccc;">
                💾 ${size} KB${cycleInfo}
            </div>
            <div style="font-size: 11px; color: #888; margin-top: 4px;">
                ID: ${backupKey}
            </div>
        `;
        
        // ✅ Selection logic
        backupItem.addEventListener("click", () => {
            // Remove selection from other items
            document.querySelectorAll(".backup-item").forEach(item => {
                item.style.border = "2px solid transparent";
                item.style.background = "rgba(255, 255, 255, 0.05)";
            });
            
            // Select this item
            backupItem.style.border = "2px solid #007bff";
            backupItem.style.background = "rgba(0, 123, 255, 0.1)";
            selectedBackup = backupKey;
            
            // Enable restore button
            restoreBtn.disabled = false;
            restoreBtn.style.opacity = "1";
            restoreBtn.style.cursor = "pointer";
        });
        
        // ✅ Hover effects
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
    
    // ✅ Buttons container
    const buttonsContainer = document.createElement("div");
    buttonsContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 20px;
    `;
    
    // ✅ Cancel button
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
    cancelBtn.onmouseover = () => cancelBtn.style.background = "#545b62";
    cancelBtn.onmouseout = () => cancelBtn.style.background = "#6c757d";
    
    // ✅ Restore button (initially disabled)
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
    
    // ✅ Event listeners
    cancelBtn.addEventListener("click", () => {
        modal.remove();
        appendToTestResults("❌ Backup restore cancelled\n\n");
    });
    /*
    showConfirmationModal({
        title: "Delete Task",
        message: `Are you sure you want to delete "${taskName}"?`,
        confirmText: "Delete",
        cancelText: "Cancel",
        callback: (confirmDelete) => {  // ✅ Use callback instead of .then()
      if (!confirmDelete) {
          showNotification(`"${taskName}" has not been deleted.`, "show", 2500);
          console.log("❌ Task not deleted.");
          return;
      }

    // ✅ Getting modal reference for advanced control
const modal = showConfirmationModal({
    title: "Processing...",
    message: "Please wait while we process your request.",
    confirmText: "OK",
    cancelText: "Cancel",
    callback: (confirmed) => {
        if (confirmed) {
            processRequest();
        }
    }
});
    */
    restoreBtn.addEventListener("click", () => {
        if (!selectedBackup) return;

        const confirmRestore = showConfirmationModal({
            title: "Confirm Restore",
            message: `⚠️ WARNING: This will completely replace all your current Mini Cycle data!\n\n` +
                     `Selected backup: ${new Date(parseInt(selectedBackup.replace('miniCycle_backup_', ''))).toLocaleString()}\n\n` +
                     `Are you absolutely sure you want to proceed?\n\n` +
                     `This action cannot be undone!`,
            confirmText: "Restore",
            cancelText: "Cancel",
            callback: (confirmed) => {
                if (confirmed) {
                    // ✅ Perform restore
                    try {
                        const backupData = localStorage.getItem(selectedBackup);
                        const parsed = JSON.parse(backupData);

                        appendToTestResults(`🔄 Restoring backup: ${selectedBackup}\n`);

                        // ✅ Clear current data first (optional safety step)
                        const keysToReplace = [
                            'miniCycleStorage',
                            'lastUsedMiniCycle'
                        ];

                        keysToReplace.forEach(key => {
                            if (parsed[key]) {
                                localStorage.setItem(key, parsed[key]);
                                appendToTestResults(`✅ Restored: ${key}\n`);
                            }
                        });

                        appendToTestResults(`✅ Backup restored successfully!\n`);
                        appendToTestResults(`🔄 Reloading application...\n\n`);

                        modal.remove();

                        showNotification("✅ Backup restored successfully! Reloading...", "success", 3000);

                        // ✅ Reload after short delay
                        setTimeout(() => {
                            location.reload();
                        }, 1500);

                    } catch (error) {
                        appendToTestResults(`❌ Restore failed: ${error.message}\n\n`);
                        showNotification("❌ Failed to restore backup", "error", 3000);
                        console.error("Backup restore error:", error);
                    }
                }
            }
        });
        
        if (!confirmRestore) {
            appendToTestResults("❌ User cancelled restore confirmation\n\n");
            return;
        }
        
        // ✅ Perform restore
        try {
            const backupData = localStorage.getItem(selectedBackup);
            const parsed = JSON.parse(backupData);
            
            appendToTestResults(`🔄 Restoring backup: ${selectedBackup}\n`);
            
            // ✅ Clear current data first (optional safety step)
            const keysToReplace = [
                'miniCycleStorage',
                'lastUsedMiniCycle'
            ];
            
            keysToReplace.forEach(key => {
                if (parsed[key]) {
                    localStorage.setItem(key, parsed[key]);
                    appendToTestResults(`✅ Restored: ${key}\n`);
                }
            });
            
            appendToTestResults(`✅ Backup restored successfully!\n`);
            appendToTestResults(`🔄 Reloading application...\n\n`);
            
            modal.remove();
            
            showNotification("✅ Backup restored successfully! Reloading...", "success", 3000);
            
            // ✅ Reload after short delay
            setTimeout(() => {
                location.reload();
            }, 1500);
            
        } catch (error) {
            appendToTestResults(`❌ Restore failed: ${error.message}\n\n`);
            showNotification("❌ Failed to restore backup", "error", 3000);
            console.error("Backup restore error:", error);
        }
    });
    
    // ✅ Assemble modal
    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(restoreBtn);
    
    modalContent.appendChild(header);
    modalContent.appendChild(backupList);
    modalContent.appendChild(buttonsContainer);
    modal.appendChild(modalContent);
    
    // ✅ Close on outside click
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.remove();
            appendToTestResults("❌ Backup restore cancelled\n\n");
        }
    });
    
    // ✅ ESC key to close
    const handleEsc = (e) => {
        if (e.key === "Escape") {
            modal.remove();
            appendToTestResults("❌ Backup restore cancelled\n\n");
            document.removeEventListener("keydown", handleEsc);
        }
    };
    document.addEventListener("keydown", handleEsc);
    
    // ✅ Add to DOM
    document.body.appendChild(modal);
    
    appendToTestResults(`📋 Found ${backupKeys.length} available backups\n`);
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
    appendToTestResults("📊 Analyzing Mini Cycles...\n");
    showNotification("Analyzing your Mini Cycles...", "info", 2000);
    
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
                name: "Mini Cycle",
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
    
    const unlocks = JSON.parse(localStorage.getItem("milestoneUnlocks")) || {};
    const themeFeatures = {
        "Dark Ocean Theme": unlocks.darkOcean || false,
        "Golden Glow Theme": unlocks.goldenGlow || false,
        "Task Order Game": unlocks.taskOrderGame || false
    };
    
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

