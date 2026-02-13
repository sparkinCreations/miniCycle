/**
 * History Manager Module (DI-Pure)
 *
 * Tracks history events for each routine (cycle completed, tasks cleared, etc.)
 * Per-routine storage - history travels with .mcyc exports.
 *
 * @module features/historyManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_SELECTORS, Z_INDEX } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_EVENTS = 100;


// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

const di = createDIModule('HistoryManager', {
    AppState: required(),
    appInit: required(),
    showNotification: required(),
    safeAddEventListener: optional(null),
    showConfirmationModal: optional(null),
    clearedTasksManager: optional(null),
    updateStatsPanel: optional(null),
    addTask: optional(null)
});

export const setHistoryManagerDependencies = di.setDependencies;

// ============================================================================
// HISTORY MANAGER CLASS
// ============================================================================

/**
 * Manages history events for routines
 */
export class HistoryManager {
    constructor(overrides = {}) {
        this.deps = di.resolve(overrides);
        this.modalOverlay = null;
        this.activeTab = 'events'; // 'events' or 'cleared'
        this.isRecreateMode = false;
        this.selectedTasks = new Set();
        console.log('HistoryManager initialized');
    }

    // ========================================================================
    // CORE METHODS
    // ========================================================================

    /**
     * Log a history event to the current routine
     * @param {string} type - Event type: 'cycle_completed', 'tasks_cleared', 'cycle_reset', 'achievement_unlocked'
     * @param {Object} details - Event-specific details
     */
    logEvent(type, details = {}) {
        const state = this.deps.AppState.get();
        const activeCycleId = state?.appState?.activeCycleId;

        if (!activeCycleId) {
            console.warn('HistoryManager: No active cycle to log event');
            return;
        }

        const event = {
            id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type,
            timestamp: Date.now(),
            details
        };

        this.deps.AppState.update(s => {
            const cycle = s.data.cycles[activeCycleId];
            if (!cycle) return;

            // Initialize history if needed
            if (!cycle.history) {
                cycle.history = { events: [], maxEvents: MAX_EVENTS };
            }

            // Add event at the beginning (newest first)
            cycle.history.events.unshift(event);

            // Trim to max events
            if (cycle.history.events.length > MAX_EVENTS) {
                cycle.history.events = cycle.history.events.slice(0, MAX_EVENTS);
            }
        }, true);

        console.log(`HistoryManager: Logged ${type} event`, details);
    }

    /**
     * Get history events for a routine
     * @param {string} [cycleId] - Cycle ID (defaults to active)
     * @returns {Array} History events
     */
    getHistory(cycleId = null) {
        const state = this.deps.AppState.get();
        const id = cycleId || state?.appState?.activeCycleId;

        if (!id) return [];

        const cycle = state.data.cycles[id];
        return cycle?.history?.events || [];
    }

    /**
     * Clear all history for a routine
     * @param {string} [cycleId] - Cycle ID (defaults to active)
     */
    clearHistory(cycleId = null) {
        const state = this.deps.AppState.get();
        const id = cycleId || state?.appState?.activeCycleId;

        if (!id) return;

        this.deps.AppState.update(s => {
            const cycle = s.data.cycles[id];
            if (cycle?.history) {
                cycle.history.events = [];
            }
        }, true);

        this.deps.showNotification('History cleared', 'success');

        // Refresh modal if open
        if (this.modalOverlay) {
            this._renderModalContent();
        }
    }

    /**
     * Reset routine progress (cycle count and cleared tasks count) to 0
     * Does NOT affect global achievements or history/cleared task entries
     * @private
     */
    _resetRoutineProgress() {
        const state = this.deps.AppState.get();
        const cycleId = state?.appState?.activeCycleId;

        if (!cycleId) return;

        // Store current tab to restore after
        const currentTab = this.activeTab;

        const doReset = () => {
            this.deps.AppState.update(s => {
                const cycle = s.data.cycles[cycleId];
                if (cycle) {
                    // Reset cycle count
                    cycle.cycleCount = 0;
                    // Reset cleared tasks count (but keep entries)
                    if (cycle.clearedTasks) {
                        cycle.clearedTasks.totalCleared = 0;
                    }
                }
            }, true);

            this.deps.showNotification('Routine progress reset to 0', 'success');

            // Refresh stats panel if available
            if (this.deps.updateStatsPanel) {
                this.deps.updateStatsPanel();
            }
        };

        const confirmModal = this.deps.showConfirmationModal;
        if (confirmModal) {
            // Close history modal first so confirmation appears on top
            this.closeModal();

            confirmModal({
                title: 'Reset Routine Progress',
                message: 'This will reset this routine\'s cycle count and cleared tasks count to 0. History and cleared task entries will NOT be deleted. Global achievement progress will NOT be affected.',
                confirmText: 'Reset',
                cancelText: 'Cancel',
                callback: (confirmed) => {
                    if (confirmed) {
                        doReset();
                    }
                    // Re-open history modal after confirmation
                    this.openModal(currentTab);
                }
            });
        } else {
            if (confirm('Reset this routine\'s progress to 0? History will not be affected.')) {
                doReset();
            }
        }
    }

    // ========================================================================
    // MODAL METHODS
    // ========================================================================

    /**
     * Open the history modal
     * @param {string} [initialTab='events'] - Initial tab to show ('events' or 'cleared')
     */
    openModal(initialTab = 'events') {
        if (this.modalOverlay) {
            this.closeModal();
        }

        this.activeTab = initialTab;
        this.isRecreateMode = false;
        this.selectedTasks.clear();

        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'history-modal-overlay';
        this.modalOverlay.setAttribute('role', 'dialog');
        this.modalOverlay.setAttribute('aria-modal', 'true');
        this.modalOverlay.setAttribute('aria-label', getLabel('history.title'));
        this.modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: ${Z_INDEX.OVERLAY_CRITICAL};
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;

        // Get cleared tasks count for badge
        const clearedCount = this._getClearedTasksCount();

        this.modalOverlay.innerHTML = `
            <div class="history-modal" style="
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
                    <button class="history-back-btn" aria-label="${getLabel('button.close')}" style="
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
                    ">History</h2>
                    <button class="history-action-btn" style="
                        background: none;
                        border: none;
                        font-size: 14px;
                        cursor: pointer;
                        padding: 4px 12px;
                        color: var(--danger-color, #dc3545);
                    ">Clear All</button>
                </header>
                ${clearedCount > 0 ? `
                <div class="history-tabs" style="
                    display: flex;
                    border-bottom: 1px solid var(--border-color, #e0e0e0);
                ">
                    <button class="history-tab" data-tab="events" style="
                        flex: 1;
                        padding: 12px;
                        border: none;
                        background: none;
                        font-size: 14px;
                        cursor: pointer;
                        color: var(--text-primary, #333);
                        border-bottom: 2px solid transparent;
                        transition: all 0.15s ease;
                    ">📜 Events</button>
                    <button class="history-tab" data-tab="cleared" style="
                        flex: 1;
                        padding: 12px;
                        border: none;
                        background: none;
                        font-size: 14px;
                        cursor: pointer;
                        color: var(--text-primary, #333);
                        border-bottom: 2px solid transparent;
                        transition: all 0.15s ease;
                    ">✓ Cleared Tasks <span style="
                        background: var(--primary-color, #4c79ff);
                        color: white;
                        border-radius: 10px;
                        padding: 1px 6px;
                        font-size: 11px;
                        margin-left: 4px;
                    ">${clearedCount}</span></button>
                </div>
                ` : ''}
                <div class="history-modal-content" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                "></div>
                <div class="history-reset-section" style="
                    padding: 12px 16px;
                    border-top: 1px solid var(--border-color, #e0e0e0);
                    text-align: center;
                ">
                    <button class="history-reset-progress-btn" style="
                        background: none;
                        border: none;
                        font-size: 13px;
                        cursor: pointer;
                        padding: 8px 16px;
                        color: var(--text-secondary, #666);
                        text-decoration: underline;
                    ">Reset Routine Progress</button>
                </div>
                <footer class="history-footer" style="
                    display: none;
                    padding: 12px 16px;
                    border-top: 1px solid var(--border-color, #e0e0e0);
                    gap: 12px;
                ">
                    <button class="history-cancel-btn" style="
                        flex: 1;
                        padding: 10px;
                        border: 1px solid var(--border-color, #e0e0e0);
                        border-radius: 6px;
                        background: none;
                        cursor: pointer;
                        color: var(--text-primary, #333);
                    ">Cancel</button>
                    <button class="history-confirm-btn" style="
                        flex: 1;
                        padding: 10px;
                        border: none;
                        border-radius: 6px;
                        background: var(--primary-color, #4c79ff);
                        cursor: pointer;
                        color: white;
                    ">Recreate Selected (0)</button>
                </footer>
            </div>
        `;

        document.body.appendChild(this.modalOverlay);

        // Setup event handlers
        this._setupModalHandlers();

        // Update active tab styling
        this._updateTabStyles();

        // Render content
        this._renderModalContent();

        // Animate in
        requestAnimationFrame(() => {
            this.modalOverlay.style.opacity = '1';
            this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_MODAL).style.transform = 'translateY(0)';
        });
    }

    /**
     * Close the history modal
     */
    closeModal() {
        if (!this.modalOverlay) return;

        // Clean up escape handler to prevent leak
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }

        // Clean up overlay click handler
        if (this._overlayClickHandler) {
            this.modalOverlay.removeEventListener('click', this._overlayClickHandler);
            this._overlayClickHandler = null;
        }

        this.modalOverlay.style.opacity = '0';
        this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_MODAL).style.transform = 'translateY(20px)';

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
        const backBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_BACK_BTN);
        backBtn?.addEventListener('click', () => {
            if (this.isRecreateMode) {
                this.isRecreateMode = false;
                this.selectedTasks.clear();
                this._renderModalContent();
                this._updateFooterVisibility();
                this._updateActionButton();
            } else {
                this.closeModal();
            }
        });

        // Action button (Clear All / Recreate)
        const actionBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_ACTION_BTN);
        actionBtn?.addEventListener('click', () => {
            if (this.activeTab === 'events') {
                // Clear history
                const confirmModal = this.deps.showConfirmationModal;
                if (confirmModal) {
                    confirmModal({
                        title: 'Clear History',
                        message: 'Are you sure you want to clear all history for this routine?',
                        confirmText: 'Clear',
                        cancelText: 'Cancel',
                        callback: (confirmed) => {
                            if (confirmed) this.clearHistory();
                        }
                    });
                } else {
                    if (confirm('Clear all history for this routine?')) {
                        this.clearHistory();
                    }
                }
            } else if (this.activeTab === 'cleared') {
                // Enter recreate mode
                this.isRecreateMode = true;
                this._renderModalContent();
                this._updateFooterVisibility();
                this._updateActionButton();
            }
        });

        // Tab buttons
        this.modalOverlay.querySelectorAll(DOM_SELECTORS.HISTORY_TAB).forEach(tab => {
            tab.addEventListener('click', () => {
                const newTab = tab.dataset.tab;
                if (newTab !== this.activeTab) {
                    this.activeTab = newTab;
                    this.isRecreateMode = false;
                    this.selectedTasks.clear();
                    this._updateTabStyles();
                    this._renderModalContent();
                    this._updateFooterVisibility();
                    this._updateActionButton();
                }
            });
        });

        // Footer cancel button
        const cancelBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_CANCEL_BTN);
        cancelBtn?.addEventListener('click', () => {
            this.isRecreateMode = false;
            this.selectedTasks.clear();
            this._renderModalContent();
            this._updateFooterVisibility();
            this._updateActionButton();
        });

        // Footer confirm button
        const confirmBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_CONFIRM_BTN);
        confirmBtn?.addEventListener('click', () => {
            this._recreateSelectedTasks();
        });

        // Reset routine progress button
        const resetProgressBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_RESET_PROGRESS_BTN);
        if (resetProgressBtn) {
            const safeAdd = this.deps.safeAddEventListener || ((el, evt, fn) => el.addEventListener(evt, fn));
            safeAdd(resetProgressBtn, 'click', () => {
                this._resetRoutineProgress();
            });
        }

        // Click outside to close (store handler for cleanup in closeModal)
        this._overlayClickHandler = (e) => {
            if (e.target === this.modalOverlay) {
                this.closeModal();
            }
        };
        this.modalOverlay.addEventListener('click', this._overlayClickHandler);

        // Escape key to close - store handler for cleanup in closeModal
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.modalOverlay) {
                if (this.isRecreateMode) {
                    this.isRecreateMode = false;
                    this.selectedTasks.clear();
                    this._renderModalContent();
                    this._updateFooterVisibility();
                    this._updateActionButton();
                } else {
                    this.closeModal();
                }
            }
        };
        document.addEventListener('keydown', this._escHandler);
    }

    /**
     * Render modal content based on active tab
     * @private
     */
    _renderModalContent() {
        const content = this.modalOverlay?.querySelector(DOM_SELECTORS.HISTORY_MODAL_CONTENT);
        if (!content) return;

        if (this.activeTab === 'cleared') {
            this._renderClearedTasksContent(content);
        } else {
            this._renderEventsContent(content);
        }
    }

    /**
     * Render events tab content
     * @private
     */
    _renderEventsContent(content) {
        const events = this.getHistory();

        if (events.length === 0) {
            content.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--text-secondary, #666);
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">📜</div>
                    <p style="margin: 0;">No history yet</p>
                    <p style="margin: 8px 0 0; font-size: 14px;">Complete cycles or clear tasks to see history here</p>
                </div>
            `;
            return;
        }

        // Group events by date
        const groups = this._groupEventsByDate(events);

        let html = '';
        for (const [label, groupEvents] of Object.entries(groups)) {
            html += `
                <div class="history-group" style="margin-bottom: 24px;">
                    <h3 style="
                        font-size: 12px;
                        font-weight: 600;
                        color: var(--text-secondary, #666);
                        text-transform: uppercase;
                        margin: 0 0 12px;
                        padding-bottom: 8px;
                        border-bottom: 1px solid var(--border-color, #e0e0e0);
                    ">${label}</h3>
                    ${groupEvents.map(evt => this._renderEvent(evt)).join('')}
                </div>
            `;
        }

        content.innerHTML = html;
    }

    /**
     * Render cleared tasks tab content
     * @private
     */
    _renderClearedTasksContent(content) {
        const clearedData = this._getClearedTasks();
        const entries = clearedData.entries || [];

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

        const html = entries.map(entry => this._renderClearedEntry(entry)).join('');
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
     * Render a single cleared task entry
     * @private
     */
    _renderClearedEntry(entry) {
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
     * Group events by date (Today, Yesterday, Earlier)
     * @private
     */
    _groupEventsByDate(events) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;

        const groups = {
            'Today': [],
            'Yesterday': [],
            'Earlier': []
        };

        for (const event of events) {
            const eventDate = new Date(event.timestamp);
            const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime();

            if (eventDay >= today) {
                groups['Today'].push(event);
            } else if (eventDay >= yesterday) {
                groups['Yesterday'].push(event);
            } else {
                groups['Earlier'].push(event);
            }
        }

        // Remove empty groups
        for (const key of Object.keys(groups)) {
            if (groups[key].length === 0) {
                delete groups[key];
            }
        }

        return groups;
    }

    /**
     * Render a single event
     * @private
     */
    _renderEvent(event) {
        const icons = {
            'cycle_completed': '🔄',
            'tasks_cleared': '✓',
            'cycle_reset': '🔁',
            'achievement_unlocked': '🏆'
        };

        const labels = {
            'cycle_completed': 'Cycle Completed',
            'tasks_cleared': 'Tasks Cleared',
            'cycle_reset': 'Cycle Reset',
            'achievement_unlocked': 'Achievement Unlocked'
        };

        const time = new Date(event.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        let detailText = '';
        if (event.details) {
            if (event.details.cycleCount !== undefined) {
                detailText = `Cycle #${event.details.cycleCount}`;
            } else if (event.details.tasksCleared !== undefined) {
                detailText = `${event.details.tasksCleared} task${event.details.tasksCleared !== 1 ? 's' : ''}`;
            } else if (event.details.achievementId) {
                 detailText = this._escapeHtml(event.details.achievementName || event.details.achievementId);

            }
        }

        return `
            <div class="history-event" style="
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 12px;
                background: var(--bg-secondary, #f5f5f5);
                border-radius: 8px;
                margin-bottom: 8px;
            ">
                <span style="font-size: 20px;">${icons[event.type] || '📌'}</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        font-weight: 500;
                        color: var(--text-primary, #333);
                    ">${labels[event.type] || this._escapeHtml(event.type)}</div>
                    ${detailText ? `<div style="
                        font-size: 13px;
                        color: var(--text-secondary, #666);
                        margin-top: 2px;
                    ">${detailText}</div>` : ''}
                </div>
                <span style="
                    font-size: 12px;
                    color: var(--text-secondary, #888);
                    white-space: nowrap;
                ">${time}</span>
            </div>
        `;
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Get cleared tasks count for the current routine
     * @private
     * @returns {number}
     */
    _getClearedTasksCount() {
        if (!this.deps.clearedTasksManager) return 0;
        const data = this.deps.clearedTasksManager.getClearedTasks();
        return data?.entries?.length || 0;
    }

    /**
     * Get cleared tasks data for the current routine
     * @private
     * @returns {Object} { entries: [], totalCleared: 0 }
     */
    _getClearedTasks() {
        if (!this.deps.clearedTasksManager) {
            return { entries: [], totalCleared: 0 };
        }
        return this.deps.clearedTasksManager.getClearedTasks();
    }

    /**
     * Update tab styling to show active tab
     * @private
     */
    _updateTabStyles() {
        if (!this.modalOverlay) return;

        this.modalOverlay.querySelectorAll(DOM_SELECTORS.HISTORY_TAB).forEach(tab => {
            const isActive = tab.dataset.tab === this.activeTab;
            tab.style.fontWeight = isActive ? '600' : '400';
            tab.style.borderBottomColor = isActive ? 'var(--primary-color, #4c79ff)' : 'transparent';
            tab.style.color = isActive ? 'var(--primary-color, #4c79ff)' : 'var(--text-primary, #333)';
        });
    }

    /**
     * Update footer visibility based on mode
     * @private
     */
    _updateFooterVisibility() {
        if (!this.modalOverlay) return;

        const footer = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_FOOTER);
        if (footer) {
            footer.style.display = this.isRecreateMode ? 'flex' : 'none';
        }
    }

    /**
     * Update action button text based on tab and mode
     * @private
     */
    _updateActionButton() {
        if (!this.modalOverlay) return;

        const actionBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_ACTION_BTN);
        if (!actionBtn) return;

        if (this.activeTab === 'events') {
            actionBtn.textContent = 'Clear All';
            actionBtn.style.color = 'var(--danger-color, #dc3545)';
            actionBtn.style.display = '';
        } else if (this.activeTab === 'cleared') {
            if (this.isRecreateMode) {
                actionBtn.style.display = 'none';
            } else {
                actionBtn.textContent = 'Recreate Tasks';
                actionBtn.style.color = 'var(--primary-color, #4c79ff)';
                actionBtn.style.display = '';
            }
        }
    }

    /**
     * Update confirm button with selected count
     * @private
     */
    _updateConfirmButton() {
        if (!this.modalOverlay) return;

        const confirmBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_CONFIRM_BTN);
        if (confirmBtn) {
            const count = this.selectedTasks.size;
            confirmBtn.textContent = `Recreate Selected (${count})`;
            confirmBtn.disabled = count === 0;
            confirmBtn.style.opacity = count === 0 ? '0.5' : '1';
        }
    }

    /**
     * Recreate selected tasks from cleared list
     * @private
     */
    async _recreateSelectedTasks() {
        if (this.selectedTasks.size === 0) return;

        const addTask = this.deps.addTask;
        console.log('🔄 HistoryManager: addTask dependency:', typeof addTask, addTask);

        if (!addTask || typeof addTask !== 'function') {
            console.error('❌ HistoryManager: addTask not available');
            this.deps.showNotification('Cannot recreate tasks - addTask not available', 'error');
            return;
        }

        const clearedData = this._getClearedTasks();
        const entries = clearedData.entries || [];
        const toRecreate = entries.filter(e => this.selectedTasks.has(e.id));
        console.log('🔄 HistoryManager: Tasks to recreate:', toRecreate.length);

        let created = 0;
        for (const entry of toRecreate) {
            try {
                console.log(`🔄 HistoryManager: Recreating task "${entry.taskText}"`);
                const result = await addTask(entry.taskText, {
                    highPriority: entry.wasHighPriority || false
                });
                console.log('🔄 HistoryManager: addTask result:', result);

                if (result) {
                    created++;
                    // Note: Entry stays in cleared list as historical record
                    // Recreate ≠ Restore - we're creating a new task, not undoing the clear
                } else {
                    console.warn('⚠️ HistoryManager: addTask returned falsy value');
                }
            } catch (err) {
                console.error('❌ HistoryManager: Failed to recreate task:', err);
            }
        }

        if (created > 0) {
            this.deps.showNotification(
                `Recreated ${created} task${created !== 1 ? 's' : ''}`,
                'success'
            );
        } else {
            this.deps.showNotification('Failed to recreate tasks - check console for details', 'warning');
        }

        // Reset state and refresh
        this.isRecreateMode = false;
        this.selectedTasks.clear();

        // Check if there are any cleared tasks left
        const newCount = this._getClearedTasksCount();
        if (newCount === 0) {
            // No more cleared tasks, switch to events tab
            this.activeTab = 'events';
        }

        this._renderModalContent();
        this._updateFooterVisibility();
        this._updateActionButton();

        // Re-render the entire modal to update/remove the tabs if needed
        if (newCount === 0) {
            this.closeModal();
            this.openModal('events');
        }
    }

    /**
     * Escape HTML special characters
     * @private
     * @param {string} text
     * @returns {string}
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
 * Initialize the history manager
 * @param {Object} deps - Dependencies
 * @returns {HistoryManager}
 */
export function initHistoryManager(deps = {}) {
    if (!instance) {
        instance = new HistoryManager(deps);
    }
    return instance;
}

/**
 * Get the history manager instance
 * @returns {HistoryManager|null}
 */
export function getHistoryManager() {
    return instance;
}

console.log('HistoryManager module loaded (DI-pure)');
