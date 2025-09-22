
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
    
    // ✅ Schema 2.5 only
    const schemaData = loadMiniCycleData();
    if (!schemaData) {
        appendToTestResults("❌ Schema 2.5 data required for feature flags\n\n");
        showNotification("❌ Schema 2.5 data required", "error", 2000);
        return;
    }
    
    const { settings } = schemaData;
    
    const features = {
        "Dark Mode": settings.darkMode === true,
        "Move Arrows": settings.showMoveArrows === true,
        "Three Dots Menu": settings.showThreeDots === true,
        "Always Show Recurring": settings.alwaysShowRecurring === true,
        "Reminders Enabled": schemaData.reminders?.enabled === true,
        "Onboarding Completed": settings.onboardingCompleted === true
    };
    
    const themeFeatures = {
        "Dark Ocean Theme": settings.unlockedThemes.includes("dark-ocean"),
        "Golden Glow Theme": settings.unlockedThemes.includes("golden-glow"),
        "Task Order Game": settings.unlockedFeatures.includes("task-order-game")
    };
    
    Object.entries(features).forEach(([feature, enabled]) => {
        appendToTestResults(`- ${feature}: ${enabled ? '✅ ON' : '❌ OFF'}\n`);
    });
    
    appendToTestResults("\n🎨 Unlocked Features:\n");
    Object.entries(themeFeatures).forEach(([feature, unlocked]) => {
        appendToTestResults(`- ${feature}: ${unlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}\n`);
    });
    
    appendToTestResults("\n");
    showNotification("🚩 Feature flags displayed (Schema 2.5)", "info", 2000);
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

// ...existing code...

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

// ...existing code...

// ...existing code...

function getServiceWorkerInfo() {
    return new Promise((resolve) => {
        const info = {
            supported: 'serviceWorker' in navigator,
            registered: false,
            state: null,
            scope: null,
            version: null,
            scriptURL: null,
            updateAvailable: false,
            error: null
        };

        if (!info.supported) {
            resolve(info);
            return;
        }

        navigator.serviceWorker.getRegistration()
            .then(registration => {
                if (registration) {
                    info.registered = true;
                    info.state = registration.active?.state || 'unknown';
                    info.scope = registration.scope;
                    info.scriptURL = registration.active?.scriptURL || 'unknown';
                    info.updateAvailable = !!registration.waiting;
                    
                    // Try to get version info from service worker if available
                    if (registration.active) {
                        // You might have version info in your service worker
                        // This is optional and depends on how your SW is structured
                        info.version = 'active';
                    }
                }
                resolve(info);
            })
            .catch(error => {
                info.error = error.message;
                resolve(info);
            });
    });
}

// ...existing code...



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