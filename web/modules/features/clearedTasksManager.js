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
import { DOM_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_ENTRIES = 500;
const PRUNE_DAYS = 90;


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
        this._idCounter = 0;
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
            id: `clr-${Date.now()}-${this._idCounter++}-${Math.random().toString(36).substr(2, 5)}`,
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
            id: `clr-${Date.now()}-${this._idCounter++}-${Math.random().toString(36).substr(2, 5)}`,
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

        this.deps.showNotification(getLabel('notify.clearedTasksEmptied'), 'success');

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
            this.deps.showNotification(getLabel('notify.clearedNoSelected'), 'warning');
            return;
        }

        const addTask = this.deps.addTask;
        console.log('🔄 ClearedTasksManager: addTask dependency:', typeof addTask, addTask);

        if (!addTask || typeof addTask !== 'function') {
            console.error('❌ ClearedTasksManager: addTask not available or not a function');
            this.deps.showNotification(getLabel('notify.recreateUnavailable'), 'error');
            return;
        }

        const { entries } = this.getClearedTasks();
        const toRecreate = entries.filter(e => this.selectedTasks.has(e.id));
        console.log('🔄 ClearedTasksManager: Tasks to recreate:', toRecreate.length, toRecreate);

        let created = 0;
        for (const entry of toRecreate) {
            try {
                console.log(`🔄 ClearedTasksManager: Recreating task "${entry.taskText}" (highPriority: ${entry.wasHighPriority})`);
                const result = await addTask(entry.taskText, {
                    highPriority: entry.wasHighPriority
                });
                console.log('🔄 ClearedTasksManager: addTask result:', result);
                if (result) {
                    created++;
                } else {
                    console.warn('⚠️ ClearedTasksManager: addTask returned falsy value:', result);
                }
            } catch (err) {
                console.error('❌ ClearedTasksManager: Failed to recreate task:', err);
            }
        }

        if (created > 0) {
            this.deps.showNotification(getLabel('notify.tasksRecreated', { vars: { count: created } }), 'success');
        } else {
            this.deps.showNotification(getLabel('notify.clearedRecreateFailed'), 'warning');
        }

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

        this.modalOverlay = document.createElement('dialog');
        this.modalOverlay.setAttribute('aria-label', getLabel('history.clearedTasks'));
        this.modalOverlay.style.cssText = `
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
                    <button class="cleared-back-btn" aria-label="${getLabel('button.close')}" style="
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
                    ">${getLabel('history.clearedTasks')}</h2>
                    <button class="cleared-recreate-btn" style="
                        background: var(--primary-color, #4c79ff);
                        border: none;
                        border-radius: 6px;
                        font-size: 14px;
                        cursor: pointer;
                        padding: 6px 12px;
                        color: white;
                    ">${getLabel('history.recreate')}</button>
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
                    ">${getLabel('button.cancel')}</button>
                    <button class="cleared-confirm-btn" style="
                        flex: 1;
                        padding: 10px;
                        border: none;
                        border-radius: 6px;
                        background: var(--primary-color, #4c79ff);
                        cursor: pointer;
                        color: white;
                    ">${getLabel('history.recreateTasks')}</button>
                </footer>
            </div>
        `;

        document.body.appendChild(this.modalOverlay);
        this.modalOverlay._previousFocus = document.activeElement;
        this.modalOverlay.showModal();

        // Setup event handlers
        this._setupModalHandlers();

        // Render content
        this._renderModalContent();

        // Animate in
        requestAnimationFrame(() => {
            this.modalOverlay.style.opacity = '1';
            this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_TASKS_MODAL).style.transform = 'translateY(0)';
        });
    }

    /**
     * Close the cleared tasks modal
     */
    closeModal() {
        if (!this.modalOverlay) return;

        // Restore focus to previously focused element
        this.modalOverlay._previousFocus?.focus();

        // Clean up overlay click handler
        if (this._overlayClickHandler) {
            this.modalOverlay.removeEventListener('click', this._overlayClickHandler);
            this._overlayClickHandler = null;
        }

        // Clean up button handlers
        const backBtn = this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_BACK_BTN);
        const recreateBtn = this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_RECREATE_BTN);
        const cancelBtn = this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_CANCEL_BTN);
        const confirmBtn = this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_CONFIRM_BTN);
        if (this._backBtnHandler) { backBtn?.removeEventListener('click', this._backBtnHandler); this._backBtnHandler = null; }
        if (this._recreateBtnHandler) { recreateBtn?.removeEventListener('click', this._recreateBtnHandler); this._recreateBtnHandler = null; }
        if (this._cancelBtnHandler) { cancelBtn?.removeEventListener('click', this._cancelBtnHandler); this._cancelBtnHandler = null; }
        if (this._confirmBtnHandler) { confirmBtn?.removeEventListener('click', this._confirmBtnHandler); this._confirmBtnHandler = null; }

        this.modalOverlay.style.opacity = '0';
        this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_TASKS_MODAL).style.transform = 'translateY(20px)';

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

        // Back button (store handler for cleanup)
        const backBtn = this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_BACK_BTN);
        this._backBtnHandler = () => {
            if (this.isRecreateMode) {
                this.isRecreateMode = false;
                this.selectedTasks.clear();
                this._renderModalContent();
                this._updateFooterVisibility();
            } else {
                this.closeModal();
            }
        };
        backBtn?.addEventListener('click', this._backBtnHandler);

        // Recreate button (enters recreate mode) - store handler for cleanup
        const recreateBtn = this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_RECREATE_BTN);
        this._recreateBtnHandler = () => {
            this.isRecreateMode = true;
            this._renderModalContent();
            this._updateFooterVisibility();
        };
        recreateBtn?.addEventListener('click', this._recreateBtnHandler);

        // Cancel button in footer - store handler for cleanup
        const cancelBtn = this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_CANCEL_BTN);
        this._cancelBtnHandler = () => {
            this.isRecreateMode = false;
            this.selectedTasks.clear();
            this._renderModalContent();
            this._updateFooterVisibility();
        };
        cancelBtn?.addEventListener('click', this._cancelBtnHandler);

        // Confirm recreate button - store handler for cleanup
        const confirmBtn = this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_CONFIRM_BTN);
        this._confirmBtnHandler = () => {
            this.recreateSelectedTasks();
        };
        confirmBtn?.addEventListener('click', this._confirmBtnHandler);

        // Click outside to close (store handler for cleanup in closeModal)
        this._overlayClickHandler = (e) => {
            if (e.target === this.modalOverlay) {
                this.closeModal();
            }
        };
        this.modalOverlay.addEventListener('click', this._overlayClickHandler);

        // Native dialog cancel event (ESC key)
        this.modalOverlay.addEventListener('cancel', (e) => {
            e.preventDefault();
            if (this.isRecreateMode) {
                this.isRecreateMode = false;
                this.selectedTasks.clear();
                this._renderModalContent();
                this._updateFooterVisibility();
            } else {
                this.closeModal();
            }
        });
    }

    /**
     * Update footer visibility based on recreate mode
     * @private
     */
    _updateFooterVisibility() {
        const footer = this.modalOverlay?.querySelector(DOM_SELECTORS.CLEARED_TASKS_FOOTER);
        const recreateBtn = this.modalOverlay?.querySelector(DOM_SELECTORS.CLEARED_RECREATE_BTN);

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
        const content = this.modalOverlay?.querySelector(DOM_SELECTORS.CLEARED_TASKS_MODAL_CONTENT);
        const summary = this.modalOverlay?.querySelector(DOM_SELECTORS.CLEARED_TASKS_SUMMARY);
        if (!content || !summary) return;

        const { entries, totalCleared } = this.getClearedTasks();

        // Update summary
        const taskWord = getLabel('noun.task', { count: totalCleared });
        summary.innerHTML = `
            <strong>${totalCleared}</strong> ${taskWord} ${getLabel('history.clearedTotal')}
            ${entries.length > 0 ? ` &bull; ${getLabel('history.showingRecent', { vars: { count: entries.length, days: PRUNE_DAYS } })}` : ''}
        `;

        if (entries.length === 0) {
            content.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--text-secondary, #666);
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
                    <p style="margin: 0;">${getLabel('history.noClearedTasks')}</p>
                    <p style="margin: 8px 0 0; font-size: 14px;">${getLabel('history.noClearedHint')}</p>
                </div>
            `;
            return;
        }

        const html = entries.map(entry => this._renderEntry(entry)).join('');
        content.innerHTML = html;

        // Setup click handlers for entries in recreate mode
        if (this.isRecreateMode) {
            content.querySelectorAll(DOM_SELECTORS.CLEARED_ENTRY).forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.id;
                    const checkbox = el.querySelector('span');

                    if (this.selectedTasks.has(id)) {
                        this.selectedTasks.delete(id);
                        el.classList.remove('selected');
                        // Update inline styles for deselected state
                        el.style.background = 'var(--bg-secondary, #f5f5f5)';
                        el.style.border = '2px solid transparent';
                        if (checkbox) {
                            checkbox.style.background = 'transparent';
                            checkbox.style.borderColor = 'var(--border-color, #ccc)';
                            checkbox.textContent = '';
                        }
                    } else {
                        this.selectedTasks.add(id);
                        el.classList.add('selected');
                        // Update inline styles for selected state
                        el.style.background = 'var(--primary-color-light, #e8efff)';
                        el.style.border = '2px solid var(--primary-color, #4c79ff)';
                        if (checkbox) {
                            checkbox.style.background = 'var(--primary-color, #4c79ff)';
                            checkbox.style.borderColor = 'var(--primary-color, #4c79ff)';
                            checkbox.textContent = '✓';
                        }
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
        const btn = this.modalOverlay?.querySelector(DOM_SELECTORS.CLEARED_CONFIRM_BTN);
        if (btn) {
            btn.textContent = getLabel('history.recreateSelected', { vars: { count: this.selectedTasks.size } });
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
                        ${entry.wasHighPriority ? `<span style="color: var(--danger-color, #dc3545);">${getLabel('history.highPriority')}</span>` : ''}
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
