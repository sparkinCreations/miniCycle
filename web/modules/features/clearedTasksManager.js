/**
 * Cleared Tasks Manager Module (DI-Pure)
 *
 * Tracks cleared tasks for To-Do mode routines.
 * Per-routine storage - cleared tasks travel with .mcyc exports.
 * Includes recreate mode to restore cleared tasks.
 *
 * @module features/clearedTasksManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_ENTRIES = 500;
const PRUNE_DAYS = 90;
const MODAL_Z_INDEX = 10000;

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

const di = createDIModule('ClearedTasksManager', {
    AppState: required(),
    appInit: required(),
    showNotification: required(),
    showConfirmationModal: optional(null),
    addTask: optional(null)
});

export const setClearedTasksManagerDependencies = di.setDependencies;

// ============================================================================
// CLEARED TASKS MANAGER CLASS
// ============================================================================

/**
 * Manages cleared task tracking for To-Do mode routines
 */
export class ClearedTasksManager {
    constructor(overrides = {}) {
        this.deps = di.resolve(overrides);
        this.modalOverlay = null;
        this.isRecreateMode = false;
        this.selectedTasks = new Set();
        console.log('ClearedTasksManager initialized');
    }

    // ========================================================================
    // CORE METHODS
    // ========================================================================

    /**
     * Record a cleared task
     * @param {Object} task - Task object being cleared
     */
    recordClearedTask(task) {
        if (!task || !task.text) {
            console.warn('ClearedTasksManager: Invalid task to record');
            return;
        }

        const state = this.deps.AppState.get();
        const activeCycleId = state?.appState?.activeCycleId;

        if (!activeCycleId) {
            console.warn('ClearedTasksManager: No active cycle');
            return;
        }

        const entry = {
            id: `clr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            taskText: task.text,
            clearedAt: Date.now(),
            wasHighPriority: task.highPriority || false,
            hadDueDate: !!task.dueDate
        };

        this.deps.AppState.update(s => {
            const cycle = s.data.cycles[activeCycleId];
            if (!cycle) return;

            // Initialize clearedTasks if needed
            if (!cycle.clearedTasks) {
                cycle.clearedTasks = {
                    entries: [],
                    totalCleared: 0,
                    autoPruneEnabled: true
                };
            }

            // Add entry at the beginning (newest first)
            cycle.clearedTasks.entries.unshift(entry);
            cycle.clearedTasks.totalCleared++;

            // Trim to max entries
            if (cycle.clearedTasks.entries.length > MAX_ENTRIES) {
                cycle.clearedTasks.entries = cycle.clearedTasks.entries.slice(0, MAX_ENTRIES);
            }

            // Auto-prune old entries
            if (cycle.clearedTasks.autoPruneEnabled) {
                this._pruneOldEntries(cycle.clearedTasks);
            }
        }, true);

        console.log('ClearedTasksManager: Recorded cleared task', task.text);
    }

    /**
     * Record multiple cleared tasks at once
     * @param {Array} tasks - Array of task objects
     */
    recordMultipleClearedTasks(tasks) {
        if (!tasks || tasks.length === 0) return;

        const state = this.deps.AppState.get();
        const activeCycleId = state?.appState?.activeCycleId;

        if (!activeCycleId) return;

        const entries = tasks.map(task => ({
            id: `clr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            taskText: task.text,
            clearedAt: Date.now(),
            wasHighPriority: task.highPriority || false,
            hadDueDate: !!task.dueDate
        }));

        this.deps.AppState.update(s => {
            const cycle = s.data.cycles[activeCycleId];
            if (!cycle) return;

            if (!cycle.clearedTasks) {
                cycle.clearedTasks = {
                    entries: [],
                    totalCleared: 0,
                    autoPruneEnabled: true
                };
            }

            cycle.clearedTasks.entries.unshift(...entries);
            cycle.clearedTasks.totalCleared += entries.length;

            if (cycle.clearedTasks.entries.length > MAX_ENTRIES) {
                cycle.clearedTasks.entries = cycle.clearedTasks.entries.slice(0, MAX_ENTRIES);
            }

            if (cycle.clearedTasks.autoPruneEnabled) {
                this._pruneOldEntries(cycle.clearedTasks);
            }
        }, true);

        console.log(`ClearedTasksManager: Recorded ${tasks.length} cleared tasks`);
    }

    /**
     * Get cleared tasks for a routine
     * @param {string} [cycleId] - Cycle ID (defaults to active)
     * @returns {Object} { entries: Array, totalCleared: number }
     */
    getClearedTasks(cycleId = null) {
        const state = this.deps.AppState.get();
        const id = cycleId || state?.appState?.activeCycleId;

        if (!id) return { entries: [], totalCleared: 0 };

        const cycle = state.data.cycles[id];
        return {
            entries: cycle?.clearedTasks?.entries || [],
            totalCleared: cycle?.clearedTasks?.totalCleared || 0
        };
    }

    /**
     * Clear all cleared task records for a routine
     * @param {string} [cycleId] - Cycle ID (defaults to active)
     */
    clearAll(cycleId = null) {
        const state = this.deps.AppState.get();
        const id = cycleId || state?.appState?.activeCycleId;

        if (!id) return;

        this.deps.AppState.update(s => {
            const cycle = s.data.cycles[id];
            if (cycle?.clearedTasks) {
                cycle.clearedTasks.entries = [];
                // Note: totalCleared is NOT reset - it's a lifetime counter
            }
        }, true);

        this.deps.showNotification('Cleared tasks list emptied', 'success');

        // Refresh modal if open
        if (this.modalOverlay) {
            this._renderModalContent();
        }
    }

    /**
     * Remove a specific entry by ID
     * @param {string} entryId - Entry ID to remove
     * @param {string} [cycleId] - Cycle ID (defaults to active)
     */
    removeEntry(entryId, cycleId = null) {
        const state = this.deps.AppState.get();
        const id = cycleId || state?.appState?.activeCycleId;

        if (!id || !entryId) return;

        this.deps.AppState.update(s => {
            const cycle = s.data.cycles[id];
            if (cycle?.clearedTasks?.entries) {
                cycle.clearedTasks.entries = cycle.clearedTasks.entries.filter(e => e.id !== entryId);
            }
        }, true);
    }

    /**
     * Prune entries older than 90 days
     * @private
     */
    _pruneOldEntries(clearedTasks) {
        const cutoff = Date.now() - (PRUNE_DAYS * 24 * 60 * 60 * 1000);
        const originalLength = clearedTasks.entries.length;

        clearedTasks.entries = clearedTasks.entries.filter(e => e.clearedAt > cutoff);

        const pruned = originalLength - clearedTasks.entries.length;
        if (pruned > 0) {
            console.log(`ClearedTasksManager: Pruned ${pruned} entries older than ${PRUNE_DAYS} days`);
        }
    }

    // ========================================================================
    // RECREATE METHODS
    // ========================================================================

    /**
     * Recreate selected tasks
     */
    async recreateSelectedTasks() {
        if (this.selectedTasks.size === 0) {
            this.deps.showNotification('No tasks selected', 'warning');
            return;
        }

        const addTask = this.deps.addTask;
        if (!addTask) {
            this.deps.showNotification('Cannot recreate tasks - addTask not available', 'error');
            return;
        }

        const { entries } = this.getClearedTasks();
        const toRecreate = entries.filter(e => this.selectedTasks.has(e.id));

        let created = 0;
        for (const entry of toRecreate) {
            try {
                await addTask(entry.taskText, {
                    highPriority: entry.wasHighPriority
                });
                created++;
            } catch (err) {
                console.error('Failed to recreate task:', err);
            }
        }

        this.deps.showNotification(`Recreated ${created} task${created !== 1 ? 's' : ''}`, 'success');

        // Exit recreate mode
        this.isRecreateMode = false;
        this.selectedTasks.clear();
        this.closeModal();
    }

    // ========================================================================
    // MODAL METHODS
    // ========================================================================

    /**
     * Open the cleared tasks modal
     */
    openModal() {
        if (this.modalOverlay) {
            this.closeModal();
        }

        this.isRecreateMode = false;
        this.selectedTasks.clear();

        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'cleared-tasks-modal-overlay';
        this.modalOverlay.setAttribute('role', 'dialog');
        this.modalOverlay.setAttribute('aria-modal', 'true');
        this.modalOverlay.setAttribute('aria-label', 'Cleared Tasks');
        this.modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: ${MODAL_Z_INDEX};
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;

        this.modalOverlay.innerHTML = `
            <div class="cleared-tasks-modal" style="
                background: var(--bg-primary, #fff);
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                transform: translateY(20px);
                transition: transform 0.2s ease;
            ">
                <header style="
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid var(--border-color, #e0e0e0);
                    gap: 12px;
                ">
                    <button class="cleared-back-btn" aria-label="Close" style="
                        background: none;
                        border: none;
                        font-size: 20px;
                        cursor: pointer;
                        padding: 4px 8px;
                        color: var(--text-primary, #333);
                    ">&larr;</button>
                    <h2 style="
                        flex: 1;
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                        color: var(--text-primary, #333);
                    ">Cleared Tasks</h2>
                    <button class="cleared-recreate-btn" style="
                        background: var(--primary-color, #4c79ff);
                        border: none;
                        border-radius: 6px;
                        font-size: 14px;
                        cursor: pointer;
                        padding: 6px 12px;
                        color: white;
                    ">Recreate</button>
                </header>
                <div class="cleared-tasks-summary" style="
                    padding: 12px 16px;
                    background: var(--bg-secondary, #f5f5f5);
                    font-size: 14px;
                    color: var(--text-secondary, #666);
                "></div>
                <div class="cleared-tasks-modal-content" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                "></div>
                <footer class="cleared-tasks-footer" style="
                    display: none;
                    padding: 12px 16px;
                    border-top: 1px solid var(--border-color, #e0e0e0);
                    gap: 12px;
                ">
                    <button class="cleared-cancel-btn" style="
                        flex: 1;
                        padding: 10px;
                        border: 1px solid var(--border-color, #e0e0e0);
                        border-radius: 6px;
                        background: none;
                        cursor: pointer;
                        color: var(--text-primary, #333);
                    ">Cancel</button>
                    <button class="cleared-confirm-btn" style="
                        flex: 1;
                        padding: 10px;
                        border: none;
                        border-radius: 6px;
                        background: var(--primary-color, #4c79ff);
                        cursor: pointer;
                        color: white;
                    ">Recreate Selected</button>
                </footer>
            </div>
        `;

        document.body.appendChild(this.modalOverlay);

        // Setup event handlers
        this._setupModalHandlers();

        // Render content
        this._renderModalContent();

        // Animate in
        requestAnimationFrame(() => {
            this.modalOverlay.style.opacity = '1';
            this.modalOverlay.querySelector('.cleared-tasks-modal').style.transform = 'translateY(0)';
        });
    }

    /**
     * Close the cleared tasks modal
     */
    closeModal() {
        if (!this.modalOverlay) return;

        this.modalOverlay.style.opacity = '0';
        this.modalOverlay.querySelector('.cleared-tasks-modal').style.transform = 'translateY(20px)';

        setTimeout(() => {
            this.modalOverlay?.remove();
            this.modalOverlay = null;
            this.isRecreateMode = false;
            this.selectedTasks.clear();
        }, 200);
    }

    /**
     * Setup modal event handlers
     * @private
     */
    _setupModalHandlers() {
        if (!this.modalOverlay) return;

        // Back button
        const backBtn = this.modalOverlay.querySelector('.cleared-back-btn');
        backBtn?.addEventListener('click', () => {
            if (this.isRecreateMode) {
                this.isRecreateMode = false;
                this.selectedTasks.clear();
                this._renderModalContent();
                this._updateFooterVisibility();
            } else {
                this.closeModal();
            }
        });

        // Recreate button (enters recreate mode)
        const recreateBtn = this.modalOverlay.querySelector('.cleared-recreate-btn');
        recreateBtn?.addEventListener('click', () => {
            this.isRecreateMode = true;
            this._renderModalContent();
            this._updateFooterVisibility();
        });

        // Cancel button in footer
        const cancelBtn = this.modalOverlay.querySelector('.cleared-cancel-btn');
        cancelBtn?.addEventListener('click', () => {
            this.isRecreateMode = false;
            this.selectedTasks.clear();
            this._renderModalContent();
            this._updateFooterVisibility();
        });

        // Confirm recreate button
        const confirmBtn = this.modalOverlay.querySelector('.cleared-confirm-btn');
        confirmBtn?.addEventListener('click', () => {
            this.recreateSelectedTasks();
        });

        // Click outside to close
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.closeModal();
            }
        });

        // Escape key to close
        const escHandler = (e) => {
            if (e.key === 'Escape' && this.modalOverlay) {
                if (this.isRecreateMode) {
                    this.isRecreateMode = false;
                    this.selectedTasks.clear();
                    this._renderModalContent();
                    this._updateFooterVisibility();
                } else {
                    this.closeModal();
                    document.removeEventListener('keydown', escHandler);
                }
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * Update footer visibility based on recreate mode
     * @private
     */
    _updateFooterVisibility() {
        const footer = this.modalOverlay?.querySelector('.cleared-tasks-footer');
        const recreateBtn = this.modalOverlay?.querySelector('.cleared-recreate-btn');

        if (footer && recreateBtn) {
            footer.style.display = this.isRecreateMode ? 'flex' : 'none';
            recreateBtn.style.display = this.isRecreateMode ? 'none' : 'block';
        }
    }

    /**
     * Render modal content
     * @private
     */
    _renderModalContent() {
        const content = this.modalOverlay?.querySelector('.cleared-tasks-modal-content');
        const summary = this.modalOverlay?.querySelector('.cleared-tasks-summary');
        if (!content || !summary) return;

        const { entries, totalCleared } = this.getClearedTasks();

        // Update summary
        summary.innerHTML = `
            <strong>${totalCleared}</strong> task${totalCleared !== 1 ? 's' : ''} cleared total
            ${entries.length > 0 ? ` &bull; Showing last ${entries.length} (90 days)` : ''}
        `;

        if (entries.length === 0) {
            content.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--text-secondary, #666);
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
                    <p style="margin: 0;">No cleared tasks</p>
                    <p style="margin: 8px 0 0; font-size: 14px;">Tasks you clear in To-Do mode will appear here</p>
                </div>
            `;
            return;
        }

        const html = entries.map(entry => this._renderEntry(entry)).join('');
        content.innerHTML = html;

        // Setup click handlers for entries in recreate mode
        if (this.isRecreateMode) {
            content.querySelectorAll('.cleared-entry').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.id;
                    if (this.selectedTasks.has(id)) {
                        this.selectedTasks.delete(id);
                        el.classList.remove('selected');
                    } else {
                        this.selectedTasks.add(id);
                        el.classList.add('selected');
                    }
                    this._updateConfirmButton();
                });
            });
        }
    }

    /**
     * Update confirm button state
     * @private
     */
    _updateConfirmButton() {
        const btn = this.modalOverlay?.querySelector('.cleared-confirm-btn');
        if (btn) {
            btn.textContent = `Recreate Selected (${this.selectedTasks.size})`;
            btn.disabled = this.selectedTasks.size === 0;
            btn.style.opacity = this.selectedTasks.size === 0 ? '0.5' : '1';
        }
    }

    /**
     * Render a single entry
     * @private
     */
    _renderEntry(entry) {
        const isSelected = this.selectedTasks.has(entry.id);
        const date = new Date(entry.clearedAt);
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="cleared-entry ${isSelected ? 'selected' : ''}"
                 data-id="${entry.id}"
                 style="
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 12px;
                    background: ${isSelected ? 'var(--primary-color-light, #e8efff)' : 'var(--bg-secondary, #f5f5f5)'};
                    border-radius: 8px;
                    margin-bottom: 8px;
                    cursor: ${this.isRecreateMode ? 'pointer' : 'default'};
                    border: 2px solid ${isSelected ? 'var(--primary-color, #4c79ff)' : 'transparent'};
                    transition: all 0.15s ease;
                 ">
                ${this.isRecreateMode ? `
                    <span style="
                        width: 20px;
                        height: 20px;
                        border: 2px solid ${isSelected ? 'var(--primary-color, #4c79ff)' : 'var(--border-color, #ccc)'};
                        border-radius: 4px;
                        background: ${isSelected ? 'var(--primary-color, #4c79ff)' : 'transparent'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                        color: white;
                        font-size: 12px;
                    ">${isSelected ? '✓' : ''}</span>
                ` : ''}
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        color: var(--text-primary, #333);
                        word-break: break-word;
                    ">${this._escapeHtml(entry.taskText)}</div>
                    <div style="
                        font-size: 12px;
                        color: var(--text-secondary, #888);
                        margin-top: 4px;
                        display: flex;
                        gap: 8px;
                    ">
                        <span>${dateStr} ${timeStr}</span>
                        ${entry.wasHighPriority ? '<span style="color: var(--danger-color, #dc3545);">High Priority</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     * @private
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let instance = null;

/**
 * Initialize the cleared tasks manager
 * @param {Object} deps - Dependencies
 * @returns {ClearedTasksManager}
 */
export function initClearedTasksManager(deps = {}) {
    if (!instance) {
        instance = new ClearedTasksManager(deps);
    }
    return instance;
}

/**
 * Get the cleared tasks manager instance
 * @returns {ClearedTasksManager|null}
 */
export function getClearedTasksManager() {
    return instance;
}

console.log('ClearedTasksManager module loaded (DI-pure)');
