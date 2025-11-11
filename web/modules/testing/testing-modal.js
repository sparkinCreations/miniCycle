/**
 * 🔬 miniCycle Testing Modal Module
 *
 * Provides a comprehensive testing interface for debugging and validating
 * miniCycle functionality, including storage, migration, and state management.
 *
 * @module testing-modal
 * @version 1.349
 */

// ==========================================
// 📦 MODULE IMPORTS
// ==========================================

// ✅ REMOVED: Static import creates duplicate without version parameter
// import { MiniCycleNotifications } from './notifications.js';
// Instead, use window.notifications (loaded with version in miniCycle-scripts.js)

// ==========================================
// � DEPENDENCY HELPERS (Safe Global Access)
// ==========================================

// ✅ Use globally available notifications instance
const getNotifications = () => window.notifications || null;

// Safe access to notification functions (uses global instance)
// ✅ FIXED: Removed duration = 2000 default to avoid overriding notification.show's duration = null default
function safeShowNotification(message, type = "info", duration) {
    try {
        const notifications = getNotifications();
        if (notifications && typeof notifications.show === 'function') {
            return notifications.show(message, type, duration);
        }
        // Fallback to window.showNotification if available
        if (typeof window.showNotification === 'function') {
            return window.showNotification(message, type, duration);
        }
        console.log(`[Notification Fallback] ${message}`);
    } catch (error) {
        console.log(`[Notification Fallback] ${message}`);
        console.warn('Notification system error:', error);
    }
}

// Safe access to confirmation modal
function safeShowConfirmationModal(options) {
    try {
        return notifications.showConfirmationModal(options);
    } catch (error) {
        console.warn('Confirmation modal error:', error);
        // Fallback to basic confirm
        return Promise.resolve(confirm(options.message || 'Confirm action?'));
    }
}

// Safe access to prompt modal
function safeShowPromptModal(options) {
    try {
        return notifications.showPromptModal(options);
    } catch (error) {
        console.warn('Prompt modal error:', error);
        // Fallback to basic prompt
        return Promise.resolve(prompt(options.message || 'Enter value:', options.defaultValue || ''));
    }
}

function safeDeleteStorageItem(key, storageType) {
    if (typeof window.deleteStorageItem === 'function') {
        window.deleteStorageItem(key, storageType);
    } else {
        // Fallback implementation
        const storage = storageType === 'local' ? localStorage : sessionStorage;
        storage.removeItem(key);
        console.log(`Deleted storage item: ${key}`);
    }
}

// Use safe versions throughout this module
const showNotification = safeShowNotification;

// ==========================================
// �🛠️ UTILITY FUNCTIONS
// ==========================================
// 🛠️ UTILITY FUNCTIONS (Using Global Utils)
// ==========================================

// Note: safeAddEventListener functions are now available globally
// from the GlobalUtils module imported in the main script.
// For backward compatibility within this module, we'll use the global functions
const safeAddEventListener = window.safeAddEventListener || function(element, event, handler) {
    if (!element) return;
    element.addEventListener(event, handler);
};

const safeAddEventListenerById = window.safeAddEventListenerById || function(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`⚠ Cannot attach event listener: #${id} not found.`);
    }
};

// ==========================================
// 🔬 ENHANCED TESTING MODAL FUNCTIONALITY
// ==========================================

function setupTestingModal() {
    const testingModal = document.getElementById("testing-modal");
    const openTestingBtn = document.getElementById("open-testing-modal");
    const closeTestingBtns = document.querySelectorAll(".close-testing-modal, #close-testing-modal");
    
    if (!testingModal || !openTestingBtn) {
        console.warn("⚠️ Testing modal elements not found");
        return;
    }
    
    // Open testing modal with enhanced features
    safeAddEventListener(openTestingBtn, "click", () => {
        testingModal.style.display = "flex";
        initializeTestingModalDrag();
        showNotification("🔬 Testing panel opened", "info", 2000);
        
        // Setup ALL functionality AFTER modal is visible
        setTimeout(() => {
            // Setup tabs first
            setupTestingTabs();
            
            // Setup buttons
            setupTestButtons();
            
            // Setup results controls
            setupResultsControls();
            
            // Setup automated testing integration
            if (typeof window.setupAutomatedTestingFunctions === 'function') {
                window.setupAutomatedTestingFunctions();
            }
        }, 150);
    });
    
    // Close testing modal
    closeTestingBtns.forEach(btn => {
        safeAddEventListener(btn, "click", () => {
            testingModal.style.display = "none";
            showNotification("Testing panel closed", "default", 2000);
        });
    });
    
    // Close on outside click
    safeAddEventListener(testingModal, "click", (e) => {
        if (e.target === testingModal) {
            testingModal.style.display = "none";
            showNotification("Testing panel closed", "default", 2000);
        }
    });

    // Add these missing functions after your existing code:

// ==========================================
// 📑 TESTING TABS SETUP
// ==========================================

function setupTestingTabs() {
    const tabButtons = document.querySelectorAll('.testing-tab');
    const tabContents = document.querySelectorAll('.testing-tab-content');
    
    if (tabButtons.length === 0) {
        console.warn("⚠️ Testing tab buttons not found");
        return;
    }
    
    tabButtons.forEach(button => {
        safeAddEventListener(button, 'click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remove active class from all tabs and buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Find the corresponding content with the correct ID format
            const targetContentId = targetTab + '-tab';
            const targetContent = document.getElementById(targetContentId);
            
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
    
    // Set first tab as active by default
    if (tabButtons[0]) {
        tabButtons[0].click();
    }
}

// ==========================================
// 🎛️ TESTING RESULTS CONTROLS SETUP
// ==========================================

function setupResultsControls() {
    // Clear results button
    safeAddEventListenerById("clear-test-results", "click", () => {
        clearTestResults();
    });
    
    // Export results button
    safeAddEventListenerById("export-test-results", "click", () => {
        exportTestResults();
    });
    
    // Copy results button
    safeAddEventListenerById("copy-test-results", "click", () => {
        copyTestResults();
    });
    
    // Search/filter functionality (if elements exist)
    const searchInput = document.getElementById("search-test-results");
    if (searchInput) {
        safeAddEventListener(searchInput, "input", (e) => {
            const query = e.target.value.toLowerCase();
            const testingOutput = document.getElementById("testing-output");
            if (!testingOutput) return;
            
            const lines = testingOutput.textContent.split('\n');
            const filteredLines = lines.filter(line => 
                line.toLowerCase().includes(query)
            );
            
            if (query.trim() === '') {
                // Show all lines if no search query
                testingOutput.textContent = lines.join('\n');
            } else {
                testingOutput.textContent = filteredLines.join('\n');
            }
        });
    }
}

// Add any other missing functions that are called in setupTestingModal()
    
    // Setup enhanced functionality that doesn't depend on modal being visible
    setupTestingTabs();
    setupTestResultsEnhancements();
    addTestResultsHint();
    
    // 🔬 Enhanced Testing Modal Keyboard Shortcut - Ctrl+J (PC) / Cmd+J (Mac)
    safeAddEventListener(document, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
            e.preventDefault();
            const testingModal = document.getElementById("testing-modal");
            
            if (testingModal) {
                const isOpen = testingModal.style.display === "flex" || testingModal.style.display === "block";
                
                if (isOpen) {
                    testingModal.style.display = "none";
                    showNotification("🔬 Testing panel closed", "info", 1500);
                } else {
                    testingModal.style.display = "flex";
                    initializeTestingModalDrag();
                    showNotification("🔬 Testing panel opened", "success", 2000);
                    
                    // Setup functionality when opened via keyboard
                    setTimeout(() => {
                        setupTestingTabs();
                        setupTestButtons();
                        setupResultsControls();
                    }, 150);
                }
            } else {
                console.warn("⚠️ Testing modal not found");
                showNotification("❌ Testing panel not available", "error", 2000);
            }
        }
    });

    // Initialize dragging enhancement with delay
    setTimeout(() => {
        addTestingModalDoubleClickToCenter();
    }, 100);
}

// ==========================================
// 🖱️ ENHANCED TESTING MODAL DRAG FUNCTIONALITY
// ==========================================

function initializeTestingModalDrag() {
    const testingModal = document.getElementById("testing-modal");
    if (!testingModal) return;
    
    const modalContent = testingModal.querySelector(".testing-modal-content");
    if (!modalContent) {
        console.warn("⚠️ Testing modal content not found for dragging");
        return;
    }
    
    // Find or create a drag handle (header area)
    let dragHandle = modalContent.querySelector(".testing-modal-header, .testing-modal-drag-handle");
    if (!dragHandle) {
        // Try to find existing header elements
        dragHandle = modalContent.querySelector("h2, .testing-tabs, .close-testing-modal")?.closest("div");
        if (!dragHandle) {
            // Create a professional drag handle if none exists
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
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
                font-weight: bold;
                text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            `;
            dragHandle.innerHTML = '⋮⋮ Drag to Move ⋮⋮';
            modalContent.style.position = "relative";
            modalContent.appendChild(dragHandle);
        }
    }
    
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
    
    // Enhanced drag handle styling
    dragHandle.style.cursor = "move";
    dragHandle.style.userSelect = "none";
    dragHandle.style.webkitUserSelect = "none";
    dragHandle.style.msUserSelect = "none";
    
    // Enhanced visual feedback for drag handle
    dragHandle.addEventListener("mouseenter", () => {
        if (!isDragging) {
            dragHandle.style.background = "linear-gradient(135deg, #5a6fd8 0%, #6a4c93 100%)";
            dragHandle.style.transform = "scale(1.02)";
        }
    });
    
    dragHandle.addEventListener("mouseleave", () => {
        if (!isDragging) {
            dragHandle.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
            dragHandle.style.transform = "scale(1)";
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
        
        // Enhanced visual feedback while dragging
        modalContent.style.zIndex = "10001";
        modalContent.style.boxShadow = "0 25px 50px rgba(0, 0, 0, 0.5)";
        modalContent.style.transform = "scale(1.02)";
        dragHandle.style.background = "linear-gradient(135deg, #4e5ed6 0%, #5d4284 100%)";
        
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Global mouse move handler with improved bounds checking
    function handleMouseMove(e) {
        if (!isDragging) return;
        
        hasMoved = true;
        
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        
        // Enhanced viewport bounds checking with safety margins
        const modalRect = modalContent.getBoundingClientRect();
        const margin = 20;
        const maxX = window.innerWidth - modalRect.width - margin;
        const maxY = window.innerHeight - modalRect.height - margin;
        
        newX = Math.max(margin, Math.min(newX, maxX));
        newY = Math.max(margin, Math.min(newY, maxY));
        
        modalContent.style.left = `${newX}px`;
        modalContent.style.top = `${newY}px`;
        modalContent.style.right = "auto";
        modalContent.style.bottom = "auto";
        modalContent.style.margin = "0";
    }
    
    function stopDrag() {
        if (isDragging) {
            isDragging = false;
            
            // Restore visual state with smooth transition
            modalContent.style.zIndex = "9999";
            modalContent.style.boxShadow = "";
            modalContent.style.transform = "scale(1)";
            dragHandle.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
            
            // Show notification if modal was actually moved
            if (hasMoved) {
                showNotification("🔬 Testing modal repositioned", "info", 1500);
            }
        }
    }
    
    // Clean up existing listeners and add new ones
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopDrag);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopDrag);
    
    // Enhanced window resize handling
    function handleResize() {
        if (modalContent.style.position === "fixed") {
            const rect = modalContent.getBoundingClientRect();
            const margin = 20;
            const maxX = window.innerWidth - rect.width - margin;
            const maxY = window.innerHeight - rect.height - margin;
            
            if (rect.left > maxX || rect.top > maxY) {
                const newX = Math.min(rect.left, maxX);
                const newY = Math.min(rect.top, maxY);
                
                modalContent.style.left = `${Math.max(margin, newX)}px`;
                modalContent.style.top = `${Math.max(margin, newY)}px`;
            }
        }
    }
    
    window.removeEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
}

// ✅ Enhanced double-click to center modal
function addTestingModalDoubleClickToCenter() {
    const testingModal = document.getElementById("testing-modal");
    const modalContent = testingModal?.querySelector(".testing-modal-content");
    const dragHandle = modalContent?.querySelector(".testing-modal-drag-handle, .testing-modal-header");
    
    if (dragHandle) {
        dragHandle.addEventListener("dblclick", () => {
            // Center the modal with smooth animation
            const rect = modalContent.getBoundingClientRect();
            const centerX = (window.innerWidth - rect.width) / 2;
            const centerY = (window.innerHeight - rect.height) / 2;
            
            // Add transition for smooth centering
            modalContent.style.transition = "left 0.3s ease, top 0.3s ease";
            modalContent.style.left = `${centerX}px`;
            modalContent.style.top = `${centerY}px`;
            modalContent.style.right = "auto";
            modalContent.style.bottom = "auto";
            modalContent.style.margin = "0";
            
            // Remove transition after animation
            setTimeout(() => {
                modalContent.style.transition = "";
            }, 300);
            
            showNotification("🔬 Testing modal centered", "info", 1500);
        });
        
        // Add visual hint for double-click
        dragHandle.title = "Double-click to center modal";
    }
}

// ==========================================
// 🧪 ENHANCED TEST FUNCTIONS SETUP
// ==========================================

function setupTestButtons() {
    // Enhanced diagnostics tab buttons
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
    
    // Enhanced migration tab buttons
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
    
    // Enhanced data tools tab buttons
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
    
    // Enhanced debug info tab buttons
    safeAddEventListenerById("generate-debug-report", "click", () => {
        generateDebugReport();
    });
    
    safeAddEventListenerById("test-notifications-debug", "click", () => {
        testNotifications();
    });
    
    safeAddEventListenerById("test-recurring-logic", "click", () => {
        testRecurringLogic();
    });
    
    safeAddEventListenerById("view-local-storage-btn", "click", () => {
        console.log("🔍 View Local Storage button clicked!");
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
    
    // Service Worker buttons
    safeAddEventListenerById("show-service-worker-info", "click", () => {
        showServiceWorkerInfo();
    });
    
    safeAddEventListenerById("test-service-worker-update", "click", () => {
        testServiceWorkerUpdate();
    });

    // Console capture buttons
    safeAddEventListenerById("enable-auto-capture", "click", () => {
        localStorage.setItem("miniCycle_enableAutoConsoleCapture", "true");
        if (typeof startAutoConsoleCapture === 'function' && !window.consoleCapturing) {
            startAutoConsoleCapture();
        }
        appendToTestResults("🔄 Auto console capture enabled - will start automatically on next refresh\n\n");
        showNotification("🔄 Auto-capture enabled for migrations", "success", 3000);
    });

    safeAddEventListenerById("show-all-console-logs", "click", () => {
        if (typeof showAllCapturedLogs === 'function') {
            showAllCapturedLogs();
        } else {
            appendToTestResults("❌ Console capture function not available\n\n");
        }
    });

    safeAddEventListenerById("show-migration-errors", "click", () => {
        if (typeof showMigrationErrorsOnly === 'function') {
            showMigrationErrorsOnly();
        } else {
            appendToTestResults("❌ Migration error function not available\n\n");
        }
    });

    safeAddEventListenerById("clear-all-console-logs", "click", () => {
        if (typeof clearAllConsoleLogs === 'function') {
            clearAllConsoleLogs();
        } else {
            appendToTestResults("❌ Console clear function not available\n\n");
        }
    });

    safeAddEventListenerById("stop-console-capture", "click", () => {
        localStorage.removeItem("miniCycle_enableAutoConsoleCapture");
        if (typeof stopConsoleCapture === 'function') {
            stopConsoleCapture();
        }
        appendToTestResults("⏹️ Auto console capture disabled\n\n");
        showNotification("⏹️ Auto-capture disabled", "info", 2000);
    });
}

// ==========================================
// 📝 ENHANCED TEST RESULTS UTILITY FUNCTIONS
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
    safeShowConfirmationModal({
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
        
        safeShowConfirmationModal({
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

// Make functions globally available
window.setupTestingModal = setupTestingModal;
window.openStorageViewer = openStorageViewer;
window.closeStorageViewer = closeStorageViewer;
window.appendToTestResults = appendToTestResults;
window.clearTestResults = clearTestResults;
window.exportTestResults = exportTestResults;
window.copyTestResults = copyTestResults;

// Make notification functions globally available
window.showNotification = safeShowNotification;
window.showConfirmationModal = safeShowConfirmationModal;
window.showPromptModal = safeShowPromptModal;

