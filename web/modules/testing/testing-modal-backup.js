/**
 * Testing Modal Backup - Backup and restore operations
 *
 * Provides backup listing, restoration, and management functionality.
 *
 * @module testing-modal-backup
 */

import {
    getDeps,
    showNotification,
    appendToTestResults,
    safeAddEventListenerById,
    safeShowConfirmationModal,
    escapeHtml
} from './testing-modal-core.js';
import { DOM_SELECTORS, STORAGE_KEYS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ==========================================
// BUTTON SETUP
// ==========================================

/**
 * Setup backup tab button event listeners
 */
export function setupBackupButtons() {
    safeAddEventListenerById("list-available-backups", "click", () => {
        listAvailableBackups();
    });

    safeAddEventListenerById("create-manual-backup", "click", () => {
        createManualBackup();
    });

    safeAddEventListenerById("restore-from-backup", "click", () => {
        restoreFromBackup();
    });

    safeAddEventListenerById("clean-old-backups", "click", () => {
        cleanOldBackups();
    });
}

// ==========================================
// BACKUP FUNCTIONS
// ==========================================

/**
 * List all available backups from IndexedDB and localStorage
 */
export async function listAvailableBackups() {
    const deps = getDeps();
    appendToTestResults("Available Backups:\n\n");

    let totalBackups = 0;

    // IndexedDB backups
    if (deps.backupManager) {
        try {
            const { auto, manual, session, test } = await deps.backupManager.listAllBackups();

            if (test && test.length > 0) {
                appendToTestResults("Test Backups (Pre-Test - last 5):\n");
                test.forEach(backup => {
                    const date = new Date(backup.timestamp).toLocaleString();
                    const size = (backup.metadata.size / 1024).toFixed(2);
                    const cycles = backup.metadata.cycleCount || '?';
                    appendToTestResults(`  - ${date} - ${size} KB (${cycles} cycles)\n`);
                    totalBackups++;
                });
                appendToTestResults("\n");
            }

            if (session && session.length > 0) {
                appendToTestResults("Session Backups (App Opens - last 5):\n");
                session.forEach(backup => {
                    const date = new Date(backup.timestamp).toLocaleString();
                    const size = (backup.metadata.size / 1024).toFixed(2);
                    const cycles = backup.metadata.cycleCount || '?';
                    appendToTestResults(`  - ${date} - ${size} KB (${cycles} cycles)\n`);
                    totalBackups++;
                });
                appendToTestResults("\n");
            }

            if (auto.length > 0) {
                appendToTestResults("Auto-Backups (IndexedDB):\n");
                auto.forEach(backup => {
                    const date = new Date(backup.timestamp).toLocaleString();
                    const size = (backup.metadata.size / 1024).toFixed(2);
                    appendToTestResults(`  - ${date} - ${size} KB [v${backup.metadata.schemaVersion}]\n`);
                    totalBackups++;
                });
                appendToTestResults("\n");
            }

            if (manual.length > 0) {
                appendToTestResults("Manual Backups (IndexedDB - max 50):\n");
                manual.forEach(backup => {
                    const date = new Date(backup.timestamp).toLocaleString();
                    const size = (backup.metadata.size / 1024).toFixed(2);
                    appendToTestResults(`  - ${backup.name} (${date}) - ${size} KB\n`);
                    totalBackups++;
                });
                appendToTestResults("\n");
            }

            const stats = await deps.backupManager.getStats();
            if (stats) {
                appendToTestResults(`Total: ${stats.totalBackups} backups (${stats.totalSizeMB} MB)\n\n`);
            }

        } catch (error) {
            appendToTestResults("IndexedDB backups unavailable\n\n");
            console.error('Error loading IndexedDB backups:', error);
        }
    }

    // Legacy localStorage backups
    const legacyManual = Object.keys(localStorage).filter(key => key.startsWith('miniCycle_backup_'));
    const legacyAuto = Object.keys(localStorage).filter(key => key.startsWith('auto_migration_backup_'));
    const legacyBackups = [...legacyManual, ...legacyAuto];

    if (legacyBackups.length > 0) {
        appendToTestResults("Legacy Backups (localStorage):\n");
        legacyBackups.sort((a, b) => {
            const timestampA = parseInt(a.replace(/^(miniCycle_backup_|auto_migration_backup_)/, ''));
            const timestampB = parseInt(b.replace(/^(miniCycle_backup_|auto_migration_backup_)/, ''));
            return timestampB - timestampA;
        });

        legacyBackups.forEach(key => {
            const timestamp = key.replace(/^(miniCycle_backup_|auto_migration_backup_)/, '');
            const date = new Date(parseInt(timestamp)).toLocaleString();
            const backupValue = deps.safeLocalStorageGet(key, "");
            const size = (backupValue.length / 1024).toFixed(2);
            const type = key.startsWith('auto_migration_backup_') ? 'AUTO' : 'MANUAL';
            appendToTestResults(`  - ${date} - ${size} KB [${type}]\n`);
            totalBackups++;
        });
        appendToTestResults("\n");
    }

    if (totalBackups === 0) {
        appendToTestResults("No backups found\n\n");
        showNotification(getLabel('notify.noBackupsAvailable'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
    } else {
        showNotification(getLabel('notify.backupsFoundCount', { vars: { count: totalBackups } }), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
    }
}

/**
 * Restore from a selected backup with modal UI
 */
export async function restoreFromBackup() {
    const deps = getDeps();
    appendToTestResults("Preparing backup selection...\n");

    let allBackups = [];

    // Load IndexedDB backups
    if (deps.backupManager) {
        try {
            const { auto, manual, session, test } = await deps.backupManager.listAllBackups();

            if (test) {
                test.forEach(backup => {
                    allBackups.push({
                        type: 'indexeddb-test',
                        timestamp: backup.timestamp,
                        id: backup.timestamp,
                        name: `Test Backup ${new Date(backup.timestamp).toLocaleString()}`,
                        size: backup.metadata.size,
                        data: null,
                        metadata: backup.metadata
                    });
                });
            }

            if (session) {
                session.forEach(backup => {
                    allBackups.push({
                        type: 'indexeddb-session',
                        timestamp: backup.timestamp,
                        id: backup.timestamp,
                        name: `Session Backup ${new Date(backup.timestamp).toLocaleString()}`,
                        size: backup.metadata.size,
                        data: null,
                        metadata: backup.metadata
                    });
                });
            }

            auto.forEach(backup => {
                allBackups.push({
                    type: 'indexeddb-auto',
                    timestamp: backup.timestamp,
                    id: backup.timestamp,
                    name: `Auto-Backup ${new Date(backup.timestamp).toLocaleString()}`,
                    size: backup.metadata.size,
                    data: null,
                    metadata: backup.metadata
                });
            });

            manual.forEach(backup => {
                allBackups.push({
                    type: 'indexeddb-manual',
                    timestamp: backup.timestamp,
                    id: backup.id,
                    name: backup.name,
                    size: backup.metadata.size,
                    data: null,
                    metadata: backup.metadata
                });
            });
        } catch (error) {
            console.warn('Could not load IndexedDB backups:', error);
        }
    }

    // Load localStorage backups (legacy)
    const legacyManual = Object.keys(localStorage).filter(key => key.startsWith('miniCycle_backup_'));
    const legacyAuto = Object.keys(localStorage).filter(key => key.startsWith('auto_migration_backup_'));
    const legacyKeys = [...legacyManual, ...legacyAuto];

    legacyKeys.forEach(key => {
        const timestamp = parseInt(key.replace(/^(miniCycle_backup_|auto_migration_backup_)/, ''));
        const backupData = deps.safeLocalStorageGet(key, null);
        allBackups.push({
            type: key.startsWith('auto_migration_backup_') ? 'localstorage-auto' : 'localstorage-manual',
            timestamp,
            id: key,
            name: `Legacy ${key.startsWith('auto_migration_backup_') ? 'Auto' : 'Manual'} Backup`,
            size: backupData ? backupData.length : 0,
            data: backupData,
            metadata: null
        });
    });

    if (allBackups.length === 0) {
        appendToTestResults("No backups available to restore\n\n");
        showNotification(getLabel('notify.noBackupsRestore'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
        return;
    }

    allBackups.sort((a, b) => b.timestamp - a.timestamp);

    // Create backup selection modal as native <dialog> for top-layer stacking
    const modal = document.createElement("dialog");
    modal.id = "backup-restore-modal";
    modal.className = "backup-restore-dialog";

    const modalContent = document.createElement("div");
    modalContent.className = "backup-restore-content";

    const header = document.createElement("div");

    const restoreTitle = document.createElement('h3');
    restoreTitle.className = 'backup-restore-title';
    restoreTitle.textContent = getLabel('test.restoreTitle');

    const restoreDesc = document.createElement('p');
    restoreDesc.className = 'backup-restore-description';
    restoreDesc.innerHTML = getLabel('test.restoreDescription').replace('Warning:', '<strong>Warning:</strong>');

    header.appendChild(restoreTitle);
    header.appendChild(restoreDesc);

    const backupList = document.createElement("div");
    backupList.className = "backup-restore-list";

    let selectedBackup = null;

    allBackups.forEach((backup, index) => {
        const date = new Date(backup.timestamp);
        const size = (backup.size / 1024).toFixed(2);

        let typeLabel = '';
        let storageLabel = '';
        if (backup.type === 'indexeddb-auto') {
            typeLabel = '<span class="backup-type-badge auto">[AUTO]</span>';
            storageLabel = '<span class="backup-storage-label indexeddb">IndexedDB</span>';
        } else if (backup.type === 'indexeddb-manual') {
            typeLabel = '<span class="backup-type-badge manual">[MANUAL]</span>';
            storageLabel = '<span class="backup-storage-label indexeddb">IndexedDB</span>';
        } else if (backup.type === 'indexeddb-test') {
            typeLabel = '<span class="backup-type-badge test">[TEST]</span>';
            storageLabel = '<span class="backup-storage-label indexeddb">IndexedDB</span>';
        } else if (backup.type === 'indexeddb-session') {
            typeLabel = '<span class="backup-type-badge session">[SESSION]</span>';
            storageLabel = '<span class="backup-storage-label indexeddb">IndexedDB</span>';
        } else if (backup.type === 'localstorage-auto') {
            typeLabel = '<span class="backup-type-badge legacy-auto">[LEGACY AUTO]</span>';
            storageLabel = '<span class="backup-storage-label localstorage">localStorage</span>';
        } else {
            typeLabel = '<span class="backup-type-badge legacy-manual">[LEGACY MANUAL]</span>';
            storageLabel = '<span class="backup-storage-label localstorage">localStorage</span>';
        }

        const latestLabel = index === 0 ? '<span class="backup-latest-label"> (Latest)</span>' : '';

        const backupItem = document.createElement("div");
        backupItem.className = "backup-item";

        backupItem.innerHTML = `
            <div class="backup-item-date">
                ${date.toLocaleString()} ${typeLabel}${latestLabel}
            </div>
            <div class="backup-item-details">
                ${size} KB - ${storageLabel}
                ${backup.metadata ? ` - v${escapeHtml(String(backup.metadata.schemaVersion))}` : ''}
            </div>
            <div class="backup-item-name">
                ${escapeHtml(backup.name)}
            </div>
        `;

        backupItem.addEventListener("click", () => {
            document.querySelectorAll(DOM_SELECTORS.BACKUP_ITEM).forEach(item => {
                item.classList.remove('selected');
            });

            backupItem.classList.add('selected');
            selectedBackup = backup;

            restoreBtn.disabled = false;
        });

        backupList.appendChild(backupItem);
    });

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "backup-restore-buttons";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = getLabel('test.cancel');
    cancelBtn.className = "backup-restore-cancel";

    const restoreBtn = document.createElement("button");
    restoreBtn.textContent = getLabel('test.restoreSelected');
    restoreBtn.disabled = true;
    restoreBtn.className = "backup-restore-confirm";

    cancelBtn.addEventListener("click", () => {
        if (modal.open) modal.close();
        modal.remove();
        appendToTestResults("Backup restore cancelled\n\n");
    });

    restoreBtn.addEventListener("click", async () => {
        if (!selectedBackup) return;

        const backupDate = new Date(selectedBackup.timestamp).toLocaleString();
        const backupType = selectedBackup.type.includes('test') ? 'TEST' :
                           selectedBackup.type.includes('session') ? 'SESSION' :
                           selectedBackup.type.includes('auto') ? 'AUTO' : 'MANUAL';
        const storage = selectedBackup.type.includes('indexeddb') ? 'IndexedDB' : 'localStorage';

        safeShowConfirmationModal({
            title: getLabel('test.confirmRestoreTitle'),
            message: `WARNING: This will completely replace all your current miniCycle data!\n\n` +
                     `Selected backup: ${selectedBackup.name}\n` +
                     `Date: ${backupDate}\n` +
                     `Type: ${backupType} (${storage})\n\n` +
                     `Are you absolutely sure you want to proceed?\n\n` +
                     `This action cannot be undone!`,
            confirmText: getLabel('test.restore'),
            cancelText: getLabel('test.cancel'),
            callback: async (confirmed) => {
                if (!confirmed) {
                    appendToTestResults("User cancelled restore confirmation\n\n");
                    return;
                }

                try {
                    appendToTestResults(`Restoring backup: ${selectedBackup.name}\n`);

                    // Create safety backup
                    appendToTestResults(`Creating safety backup before restore...\n`);
                    try {
                        if (deps.backupManager) {
                            await deps.backupManager.createManualBackup(`Pre-Restore Safety Backup ${new Date().toLocaleString()}`);
                            appendToTestResults(`Safety backup created\n`);
                        }
                    } catch (backupErr) {
                        appendToTestResults(`Could not create safety backup: ${backupErr.message}\n`);
                    }

                    // Neutralize AppState to prevent auto-save
                    if (deps.AppState) {
                        if (deps.AppState.saveTimeout) {
                            clearTimeout(deps.AppState.saveTimeout);
                            deps.AppState.saveTimeout = null;
                            appendToTestResults(`Cleared pending AppState save timeout\n`);
                        }
                        deps.AppState.data = null;
                        appendToTestResults(`Nullified AppState.data\n`);
                    }

                    let restoredData = null;

                    // Handle IndexedDB backups
                    if (selectedBackup.type.includes('indexeddb')) {
                        const backupType = selectedBackup.type === 'indexeddb-test' ? 'test' :
                                           selectedBackup.type === 'indexeddb-session' ? 'session' :
                                           selectedBackup.type === 'indexeddb-auto' ? 'auto' : 'manual';
                        restoredData = await deps.backupManager.restoreBackup(selectedBackup.id, backupType);

                        if (!restoredData) {
                            throw new Error('Failed to load backup from IndexedDB');
                        }

                        const isSchema25 = restoredData.schemaVersion === '2.5' || restoredData.schemaVersion === 2.5;

                        if (isSchema25) {
                            localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(restoredData));
                            appendToTestResults(`Restored Schema 2.5 data to localStorage\n`);
                        } else {
                            appendToTestResults(`Detected legacy format backup\n`);
                            localStorage.removeItem(STORAGE_KEYS.DATA);

                            if (restoredData.cycles || restoredData.miniCycleStorage) {
                                const cyclesData = restoredData.cycles || restoredData.miniCycleStorage;
                                deps.safeLocalStorageSet('miniCycleStorage', typeof cyclesData === 'string' ? cyclesData : JSON.stringify(cyclesData));
                                appendToTestResults(`Restored: miniCycleStorage\n`);
                            }
                            if (restoredData.lastUsedMiniCycle || restoredData.activeCycle) {
                                deps.safeLocalStorageSet('lastUsedMiniCycle', restoredData.lastUsedMiniCycle || restoredData.activeCycle);
                                appendToTestResults(`Restored: lastUsedMiniCycle\n`);
                            }
                            if (restoredData.reminders || restoredData.miniCycleReminders) {
                                const remindersData = restoredData.reminders || restoredData.miniCycleReminders;
                                deps.safeLocalStorageSet('miniCycleReminders', typeof remindersData === 'string' ? remindersData : JSON.stringify(remindersData));
                                appendToTestResults(`Restored: miniCycleReminders\n`);
                            }
                            appendToTestResults(`Legacy data will be migrated to Schema 2.5 on reload\n`);
                        }

                    } else {
                        // Handle localStorage backups (legacy)
                        const backupData = deps.safeLocalStorageGet(selectedBackup.id, null);
                        const parsed = deps.safeJSONParse(backupData, null);
                        if (!parsed) {
                            throw new Error('Failed to parse backup data');
                        }

                        const isSchema25 = parsed.schemaVersion === '2.5' || parsed.schemaVersion === 2.5;

                        if (isSchema25) {
                            localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(parsed));
                            appendToTestResults(`Restored Schema 2.5 data from localStorage backup\n`);
                        } else {
                            localStorage.removeItem(STORAGE_KEYS.DATA);
                            const isAuto = selectedBackup.type === 'localstorage-auto';

                            if (isAuto) {
                                if (parsed.data?.miniCycleStorage) {
                                    deps.safeLocalStorageSet('miniCycleStorage', parsed.data.miniCycleStorage);
                                    appendToTestResults(`Restored: miniCycleStorage\n`);
                                }
                                if (parsed.data?.miniCycleReminders) {
                                    deps.safeLocalStorageSet('miniCycleReminders', parsed.data.miniCycleReminders);
                                    appendToTestResults(`Restored: miniCycleReminders\n`);
                                }
                                if (parsed.data?.lastUsedMiniCycle) {
                                    deps.safeLocalStorageSet('lastUsedMiniCycle', parsed.data.lastUsedMiniCycle);
                                    appendToTestResults(`Restored: lastUsedMiniCycle\n`);
                                }
                            } else {
                                ['miniCycleStorage', 'lastUsedMiniCycle', 'miniCycleReminders'].forEach(key => {
                                    if (parsed[key]) {
                                        deps.safeLocalStorageSet(key, typeof parsed[key] === 'string' ? parsed[key] : JSON.stringify(parsed[key]));
                                        appendToTestResults(`Restored: ${key}\n`);
                                    }
                                });
                            }
                            appendToTestResults(`Legacy data will be migrated to Schema 2.5 on reload\n`);
                        }
                    }

                    appendToTestResults(`Backup restored successfully!\n`);
                    appendToTestResults(`Reloading application...\n\n`);

                    if (modal.open) modal.close();
                    modal.remove();
                    showNotification(getLabel('notify.testRestoreSuccess'), "success", UI_TIMEOUTS.NOTIFICATION_LONG);

                    setTimeout(() => location.reload(), 1500);

                } catch (error) {
                    appendToTestResults(`Restore failed: ${error.message}\n\n`);
                    showNotification(getLabel('notify.testRestoreFailed'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
                    console.error("Backup restore error:", error);
                }
            }
        });
    });

    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(restoreBtn);

    modalContent.appendChild(header);
    modalContent.appendChild(backupList);
    modalContent.appendChild(buttonsContainer);
    modal.appendChild(modalContent);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            if (modal.open) modal.close();
            modal.remove();
            appendToTestResults("Backup restore cancelled\n\n");
        }
    });

    // Handle ESC key via native dialog cancel event
    modal.addEventListener("cancel", (e) => {
        e.preventDefault();
        if (modal.open) modal.close();
        modal.remove();
        appendToTestResults("Backup restore cancelled\n\n");
    });

    document.body.appendChild(modal);
    modal.showModal();

    const autoCount = allBackups.filter(b => b.type.includes('auto')).length;
    const manualCount = allBackups.filter(b => b.type.includes('manual')).length;

    appendToTestResults(`Found ${allBackups.length} available backups (${autoCount} auto, ${manualCount} manual)\n`);
    appendToTestResults("Select a backup above to restore\n\n");

    showNotification(getLabel('notify.selectBackupRestore', { vars: { count: allBackups.length } }), "info", UI_TIMEOUTS.NOTIFICATION_LONG);
}

/**
 * Create a manual backup
 */
export async function createManualBackup() {
    const deps = getDeps();
    appendToTestResults("Creating Manual Backup...\n");

    if (!deps.backupManager) {
        appendToTestResults("BackupManager not available\n\n");
        showNotification(getLabel('notify.backupSystemNotLoaded'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
        return;
    }

    const defaultName = `Manual Backup ${new Date().toLocaleString()}`;
    const backupName = prompt("Enter a name for this backup:", defaultName);

    if (!backupName) {
        appendToTestResults("Backup cancelled - no name provided\n\n");
        showNotification(getLabel('notify.backupCancelled'), "info", UI_TIMEOUTS.NOTIFICATION_SHORT);
        return;
    }

    try {
        const success = await deps.backupManager.createManualBackup(backupName);

        if (success) {
            const stats = await deps.backupManager.getStats();
            const totalBackups = stats ? stats.totalBackups : '?';

            appendToTestResults(`Manual backup created successfully!\n`);
            appendToTestResults(`Name: ${backupName}\n`);
            appendToTestResults(`Total backups: ${totalBackups}\n\n`);

            showNotification(getLabel('notify.testBackupCreated', { vars: { name: backupName } }), "success", UI_TIMEOUTS.NOTIFICATION_LONG);
        } else {
            throw new Error('Backup creation returned false');
        }

    } catch (error) {
        appendToTestResults(`Backup failed: ${error.message}\n\n`);
        showNotification(getLabel('notify.testBackupFailed'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
        console.error('Manual backup error:', error);
    }
}

/**
 * Clean old localStorage backups (older than 7 days)
 */
export function cleanOldBackups() {
    appendToTestResults("Cleaning Old Backups...\n");

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

    appendToTestResults(`Cleaned ${cleaned} old backups\n`);
    appendToTestResults(`Remaining backups: ${backupKeys.length - cleaned}\n\n`);
    showNotification(getLabel('notify.backupsCleaned', { vars: { count: cleaned } }), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
}

