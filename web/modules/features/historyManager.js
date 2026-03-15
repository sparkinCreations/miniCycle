/**
 * History Manager Module (DI-Pure)
 *
 * Tracks history events for each routine (cycle completed, tasks cleared, etc.)
 * Per-routine storage - history travels with .mcyc exports.
 *
 * @module features/historyManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';
import { getLabel, getIcon } from '../labels/labelResolver.js';
import { handleVerticalArrowNav, handleHorizontalArrowNav } from '../utils/keyboardNav.js';

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

        // Snapshot the themed label + icon at log time so history preserves
        // the vocabulary that was active (e.g. "Streak Extended" stays even
        // if the user later switches to a different theme).
        const labelMap = {
            'cycle_completed': 'history.cycleCompleted',
            'tasks_cleared': 'history.tasksCleared',
            'cycle_reset': 'history.cycleReset',
            'achievement_unlocked': 'history.achievementUnlocked',
            'task_added': 'history.taskAdded',
            'task_deleted': 'history.taskDeleted',
            'task_edited': 'history.taskEdited',
            'recurring_tasks_removed': 'history.recurringTasksRemoved',
            'tasks_removed_on_reset': 'history.tasksRemovedOnReset',
            'task_priority_set': 'history.taskPrioritySet',
            'task_priority_removed': 'history.taskPriorityRemoved',
            'task_priority_color_changed': 'history.taskPriorityColorChanged',
            'theme_changed': 'history.themeChanged'
        };
        const iconMap = {
            'cycle_completed': 'cycleComplete'
        };
        if (labelMap[type]) {
            details._eventLabel = getLabel(labelMap[type]);
        }
        if (iconMap[type]) {
            details._eventIcon = getIcon(iconMap[type]);
        }
        if (type === 'cycle_completed') {
            details._cycleNoun = getLabel('noun.cycle', { count: 1 });
        }
        if (type === 'tasks_cleared' && details.tasksCleared !== undefined) {
            details._taskNoun = getLabel('noun.task', { count: details.tasksCleared });
        }
        if ((type === 'recurring_tasks_removed' || type === 'tasks_removed_on_reset') && details.count !== undefined) {
            details._taskNoun = getLabel('noun.task', { count: details.count });
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

        this.deps.showNotification(getLabel('notify.historyCleared'), 'success');

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

            this.deps.showNotification(getLabel('notify.progressReset'), 'success');

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
                title: getLabel('modal.resetProgressTitle'),
                message: getLabel('modal.resetProgressMessage'),
                confirmText: getLabel('modal.resetProgressConfirm'),
                cancelText: getLabel('button.cancel'),
                callback: (confirmed) => {
                    if (confirmed) {
                        doReset();
                    }
                    // Re-open history modal after confirmation
                    this.openModal(currentTab);
                }
            });
        } else {
            if (confirm(getLabel('modal.resetProgressMessage'))) {
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

        this.modalOverlay = document.createElement('dialog');
        this.modalOverlay.setAttribute('aria-label', getLabel('history.title'));
        this.modalOverlay.setAttribute('aria-modal', 'true');
        this.modalOverlay.style.cssText = `
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
                    ">${getLabel('history.title')}</h2>
                    <button class="history-action-btn" style="
                        background: none;
                        border: none;
                        font-size: 14px;
                        cursor: pointer;
                        padding: 4px 12px;
                        color: var(--danger-color, #dc3545);
                    ">${getLabel('history.clearAll')}</button>
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
                    ">📜 ${getLabel('history.events')}</button>
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
                    ">✓ ${getLabel('history.clearedTasks')} <span style="
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
                    ">${getLabel('history.resetRoutineProgress')}</button>
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
                    ">${getLabel('button.cancel')}</button>
                    <button class="history-confirm-btn" style="
                        flex: 1;
                        padding: 10px;
                        border: none;
                        border-radius: 6px;
                        background: var(--primary-color, #4c79ff);
                        cursor: pointer;
                        color: white;
                    ">${getLabel('history.recreateSelected', { vars: { count: 0 } })}</button>
                </footer>
            </div>
        `;

        document.body.appendChild(this.modalOverlay);
        this.modalOverlay._previousFocus = document.activeElement;
        this.modalOverlay.showModal();

        // Setup event handlers
        this._setupModalHandlers();

        // Update active tab styling
        this._updateTabStyles();

        // Render content
        this._renderModalContent();

        // Animate in and move focus to first focusable element
        requestAnimationFrame(() => {
            this.modalOverlay.style.opacity = '1';
            this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_MODAL).style.transform = 'translateY(0)';
            const firstFocusable = this.modalOverlay.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (firstFocusable) firstFocusable.focus({ focusVisible: false });
        });
    }

    /**
     * Re-render modal content if the modal is currently open.
     * Called by undo/redo to refresh cleared tasks tab without closing.
     */
    refreshIfOpen() {
        if (this.modalOverlay?.open) {
            this._renderModalContent();
        }
    }

    /**
     * Close the history modal
     */
    closeModal() {
        if (!this.modalOverlay) return;

        // Restore focus to previously focused element
        this.modalOverlay._previousFocus?.focus({ focusVisible: false });

        // Clean up overlay click handler
        if (this._overlayClickHandler) {
            this.modalOverlay.removeEventListener('click', this._overlayClickHandler);
            this._overlayClickHandler = null;
        }

        // Clean up button handlers
        const backBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_BACK_BTN);
        const actionBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_ACTION_BTN);
        const cancelBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_CANCEL_BTN);
        const confirmBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_CONFIRM_BTN);
        if (this._backBtnHandler) { backBtn?.removeEventListener('click', this._backBtnHandler); this._backBtnHandler = null; }
        if (this._actionBtnHandler) { actionBtn?.removeEventListener('click', this._actionBtnHandler); this._actionBtnHandler = null; }
        if (this._cancelBtnHandler) { cancelBtn?.removeEventListener('click', this._cancelBtnHandler); this._cancelBtnHandler = null; }
        if (this._confirmBtnHandler) { confirmBtn?.removeEventListener('click', this._confirmBtnHandler); this._confirmBtnHandler = null; }
        if (this._tabHandlers) {
            this._tabHandlers.forEach(({ element, handler }) => element.removeEventListener('click', handler));
            this._tabHandlers = null;
        }
        if (this._tabKeyHandler) {
            this.modalOverlay.querySelector('.history-tabs')?.removeEventListener('keydown', this._tabKeyHandler);
            this._tabKeyHandler = null;
        }
        if (this._contentKeyHandler) {
            this.modalOverlay.querySelector('.history-modal-content')?.removeEventListener('keydown', this._contentKeyHandler);
            this._contentKeyHandler = null;
        }
        if (this._recurringLinkHandler) {
            this.modalOverlay.querySelector('.cleared-view-recurring')?.removeEventListener('click', this._recurringLinkHandler);
            this._recurringLinkHandler = null;
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

        // Back button (store handler for cleanup)
        const backBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_BACK_BTN);
        this._backBtnHandler = () => {
            if (this.isRecreateMode) {
                this.isRecreateMode = false;
                this.selectedTasks.clear();
                this._renderModalContent();
                this._updateFooterVisibility();
                this._updateActionButton();
            } else {
                this.closeModal();
            }
        };
        backBtn?.addEventListener('click', this._backBtnHandler);

        // Action button (Clear All / Recreate) - store handler for cleanup
        const actionBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_ACTION_BTN);
        this._actionBtnHandler = () => {
            if (this.activeTab === 'events') {
                // Clear history
                const confirmModal = this.deps.showConfirmationModal;
                if (confirmModal) {
                    confirmModal({
                        title: getLabel('modal.clearHistoryTitle'),
                        message: getLabel('modal.clearHistoryMessage'),
                        confirmText: getLabel('modal.clearHistoryConfirm'),
                        cancelText: getLabel('button.cancel'),
                        callback: (confirmed) => {
                            if (confirmed) this.clearHistory();
                        }
                    });
                } else {
                    if (confirm(getLabel('modal.clearHistoryMessage'))) {
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
        };
        actionBtn?.addEventListener('click', this._actionBtnHandler);

        // Tab buttons - store handlers for cleanup
        this._tabHandlers = [];
        this.modalOverlay.querySelectorAll(DOM_SELECTORS.HISTORY_TAB).forEach(tab => {
            const handler = () => {
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
            };
            this._tabHandlers.push({ element: tab, handler });
            tab.addEventListener('click', handler);
        });

        // Arrow key navigation for tabs (Left/Right to switch)
        const tabContainer = this.modalOverlay.querySelector('.history-tabs');
        if (tabContainer) {
            this._tabKeyHandler = (event) => {
                if (handleHorizontalArrowNav(event, tabContainer, DOM_SELECTORS.HISTORY_TAB, { wrap: true })) {
                    // Activate the newly focused tab
                    const focusedTab = document.activeElement;
                    if (focusedTab?.dataset?.tab && focusedTab.dataset.tab !== this.activeTab) {
                        this.activeTab = focusedTab.dataset.tab;
                        this.isRecreateMode = false;
                        this.selectedTasks.clear();
                        this._updateTabStyles();
                        this._renderModalContent();
                        this._updateFooterVisibility();
                        this._updateActionButton();
                    }
                }
            };
            tabContainer.addEventListener('keydown', this._tabKeyHandler);
        }

        // Arrow key navigation for event/entry list (Up/Down)
        const contentArea = this.modalOverlay.querySelector('.history-modal-content');
        if (contentArea) {
            this._contentKeyHandler = (event) => {
                // Navigate history events
                handleVerticalArrowNav(event, contentArea, '.history-event');
                // Navigate cleared entries
                handleVerticalArrowNav(event, contentArea, DOM_SELECTORS.CLEARED_ENTRY);
            };
            contentArea.addEventListener('keydown', this._contentKeyHandler);
        }

        // Footer cancel button - store handler for cleanup
        const cancelBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_CANCEL_BTN);
        this._cancelBtnHandler = () => {
            this.isRecreateMode = false;
            this.selectedTasks.clear();
            this._renderModalContent();
            this._updateFooterVisibility();
            this._updateActionButton();
        };
        cancelBtn?.addEventListener('click', this._cancelBtnHandler);

        // Footer confirm button - store handler for cleanup
        const confirmBtn = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_CONFIRM_BTN);
        this._confirmBtnHandler = () => {
            this._recreateSelectedTasks();
        };
        confirmBtn?.addEventListener('click', this._confirmBtnHandler);

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

        // Native dialog cancel event (ESC key)
        this.modalOverlay.addEventListener('cancel', (e) => {
            e.preventDefault();
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
                    <p style="margin: 0;">${getLabel('history.noHistoryYet')}</p>
                    <p style="margin: 8px 0 0; font-size: 14px;">${getLabel('history.noHistoryHint')}</p>
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

        // Show achievement note if any cleared task events exist
        const hasClearedEvents = events.some(evt => evt.type === 'tasks_cleared' || evt.type === 'tasks_removed_on_reset');
        if (hasClearedEvents) {
            html += `
                <p style="
                    font-size: 12px;
                    color: var(--text-secondary, #666);
                    text-align: center;
                    margin: 16px 0 0;
                    font-style: italic;
                ">${getLabel('taskOptions.achievementNote')}</p>
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
                    <p style="margin: 0;">${getLabel('history.noClearedTasks')}</p>
                    <p style="margin: 8px 0 0; font-size: 14px;">${getLabel('history.noClearedHint')}</p>
                </div>
            `;
            return;
        }

        const html = entries.map(entry => this._renderClearedEntry(entry)).join('');

        // Add recurring tasks note below entries
        const state = this.deps.AppState?.get?.();
        const activeCycleId = state?.appState?.activeCycleId;
        const activeCycle = activeCycleId ? state?.data?.cycles?.[activeCycleId] : null;
        const hasRecurring = Object.keys(activeCycle?.recurringTemplates || {}).length > 0;
        const recurringNote = `
            <div style="
                padding: 12px;
                margin-top: 8px;
                background: var(--bg-secondary, #f5f5f5);
                border-radius: 8px;
                font-size: 13px;
                color: var(--text-secondary, #888);
                line-height: 1.4;
            ">
                <span style="margin-right: 4px;">↻</span>
                ${getLabel('history.recurringNote')}
                ${hasRecurring ? `<br><a href="#" class="cleared-view-recurring" style="
                    color: var(--primary-color, #4c79ff);
                    text-decoration: none;
                    font-weight: 500;
                    margin-top: 4px;
                    display: inline-block;
                ">${getLabel('history.viewRecurring')}</a>` : ''}
            </div>
        `;

        content.innerHTML = html + recurringNote;

        // Wire recurring panel link if present
        const recurringLink = content.querySelector('.cleared-view-recurring');
        if (recurringLink) {
            this._recurringLinkHandler = (e) => {
                e.preventDefault();
                this.closeModal();
                const recurringBtn = document.getElementById(DOM_IDS.RECURRING_INFO_LINK);
                if (recurringBtn) recurringBtn.click();
            };
            recurringLink.addEventListener('click', this._recurringLinkHandler);
        }

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
                 tabindex="0"
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
                        ${entry.wasHighPriority ? (() => { const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(entry.priorityColor) ? entry.priorityColor : '#dc3545'; return `<span style="color: var(--danger-color, #dc3545); display: inline-flex; align-items: center; gap: 3px;">${getLabel('history.highPriority')} <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${safeColor};vertical-align:middle;" aria-hidden="true"></span></span>`; })() : ''}
                        ${entry.dueDate ? `<span style="color: var(--color-blue-medium, #3498db);">${getLabel('history.hasDueDate')} ${new Date(entry.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>` : ''}
                        ${entry.remindersEnabled ? `<span style="color: var(--color-orange, #e67e22);">${getLabel('history.hasReminders')}</span>` : ''}
                        ${entry.recurring ? `<span style="color: var(--color-game-primary, #27ae60);">${getLabel('history.isRecurring')}</span>` : ''}
                        ${entry.clearedInMode ? `<span style="color: var(--color-gray-400, #a3a3a3);">${entry.clearedInMode === 'todo' ? getLabel('history.clearedInToDoMode') : getLabel('history.clearedInCycleMode')}</span>` : ''}
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
            [getLabel('history.dateToday')]: [],
            [getLabel('history.dateYesterday')]: [],
            [getLabel('history.dateEarlier')]: []
        };
        const todayKey = getLabel('history.dateToday');
        const yesterdayKey = getLabel('history.dateYesterday');
        const earlierKey = getLabel('history.dateEarlier');

        for (const event of events) {
            const eventDate = new Date(event.timestamp);
            const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime();

            if (eventDay >= today) {
                groups[todayKey].push(event);
            } else if (eventDay >= yesterday) {
                groups[yesterdayKey].push(event);
            } else {
                groups[earlierKey].push(event);
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
            'achievement_unlocked': '🏆',
            'task_added': '➕',
            'task_deleted': '🗑️',
            'task_edited': '✏️',
            'recurring_tasks_removed': '🔁',
            'tasks_removed_on_reset': '🧹',
            'task_priority_set': '⚠️',
            'task_priority_removed': '➖',
            'task_priority_color_changed': '🎨',
            'theme_changed': '🎨'
        };

        const labels = {
            'cycle_completed': getLabel('history.cycleCompleted'),
            'tasks_cleared': getLabel('history.tasksCleared'),
            'cycle_reset': getLabel('history.cycleReset'),
            'achievement_unlocked': getLabel('history.achievementUnlocked'),
            'task_added': getLabel('history.taskAdded'),
            'task_deleted': getLabel('history.taskDeleted'),
            'task_edited': getLabel('history.taskEdited'),
            'recurring_tasks_removed': getLabel('history.recurringTasksRemoved'),
            'tasks_removed_on_reset': getLabel('history.tasksRemovedOnReset'),
            'task_priority_set': getLabel('history.taskPrioritySet'),
            'task_priority_removed': getLabel('history.taskPriorityRemoved'),
            'task_priority_color_changed': getLabel('history.taskPriorityColorChanged'),
            'theme_changed': getLabel('history.themeChanged')
        };

        const time = new Date(event.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        let detailText = '';
        if (event.details) {
            if (event.details.cycleCount !== undefined) {
                const cycleNoun = this._escapeHtml(event.details._cycleNoun) || getLabel('noun.cycle', { count: 1 });
                const capitalized = cycleNoun.charAt(0).toUpperCase() + cycleNoun.slice(1);
                detailText = `${capitalized} #${event.details.cycleCount}`;
            } else if (event.details.tasksCleared !== undefined) {
                const taskNoun = this._escapeHtml(event.details._taskNoun) || getLabel('noun.task', { count: event.details.tasksCleared });
                detailText = `${event.details.tasksCleared} ${taskNoun}`;
            } else if (event.details.achievementId) {
                 detailText = this._escapeHtml(event.details.achievementName || event.details.achievementId);
            } else if (event.details.oldName !== undefined) {
                detailText = `${this._escapeHtml(event.details.oldName)} → ${this._escapeHtml(event.details.newName)}`;
            } else if (event.details.taskName !== undefined) {
                detailText = this._escapeHtml(event.details.taskName);
            } else if (event.details.taskNames !== undefined) {
                const count = event.details.count ?? event.details.taskNames.length;
                const names = event.details.taskNames.map(n => this._escapeHtml(n)).join(', ');
                const taskNounPlural = this._escapeHtml(event.details._taskNoun) || getLabel('noun.task', { count });
                detailText = `${count} ${taskNounPlural}: ${names}`;
            } else if (event.type === 'task_priority_set' && event.details.taskName !== undefined) {
                const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(event.details.priorityColor)
                    ? event.details.priorityColor : '#dc3545';
                detailText = `${this._escapeHtml(event.details.taskName)} <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${safeColor};vertical-align:middle;margin-left:4px;" aria-hidden="true"></span>`;
            } else if (event.type === 'task_priority_removed' && event.details.taskName !== undefined) {
                detailText = this._escapeHtml(event.details.taskName);
            } else if (event.details.themeName !== undefined) {
                detailText = this._escapeHtml(event.details.themeName);
            }
        }

        return `
            <div class="history-event" tabindex="0" style="
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 12px;
                background: var(--bg-secondary, #f5f5f5);
                border-radius: 8px;
                margin-bottom: 8px;
            ">
                <span style="font-size: 20px;">${this._escapeHtml(event.details?._eventIcon) || icons[event.type] || '📌'}</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="
                        font-weight: 500;
                        color: var(--text-primary, #333);
                    ">${this._escapeHtml(event.details?._eventLabel) || labels[event.type] || this._escapeHtml(event.type)}</div>
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
            actionBtn.textContent = getLabel('history.clearAll');
            actionBtn.style.color = 'var(--danger-color, #dc3545)';
            actionBtn.style.display = '';
        } else if (this.activeTab === 'cleared') {
            if (this.isRecreateMode) {
                actionBtn.style.display = 'none';
            } else {
                actionBtn.textContent = getLabel('history.recreateTasks');
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
            confirmBtn.textContent = getLabel('history.recreateSelected', { vars: { count } });
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

        if (!addTask || typeof addTask !== 'function') {
            console.error('❌ HistoryManager: addTask not available');
            this.deps.showNotification(getLabel('notify.recreateUnavailable'), 'error');
            return;
        }

        const clearedData = this._getClearedTasks();
        const entries = clearedData.entries || [];
        const toRecreate = entries.filter(e => this.selectedTasks.has(e.id));

        let created = 0;
        for (const entry of toRecreate) {
            try {
                const recreateOptions = {
                    highPriority: entry.wasHighPriority || false
                };
                // Restore preserved attributes (backward-compatible with older entries)
                if (entry.dueDate) recreateOptions.dueDate = entry.dueDate;
                if (entry.priorityColor) recreateOptions.priorityColor = entry.priorityColor;
                if (entry.remindersEnabled) recreateOptions.remindersEnabled = true;
                // Pass per-mode settings only — createOrUpdateTaskData derives the active
                // deleteWhenComplete value from the current mode + these settings
                if (entry.deleteWhenCompleteSettings) recreateOptions.deleteWhenCompleteSettings = structuredClone(entry.deleteWhenCompleteSettings);
                if (entry.recurring) recreateOptions.recurring = true;
                if (entry.recurringSettings) recreateOptions.recurringSettings = structuredClone(entry.recurringSettings);

                const result = await addTask(entry.taskText, recreateOptions);

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
                getLabel('notify.tasksRecreated', { vars: { count: created } }),
                'success'
            );
        } else {
            this.deps.showNotification(getLabel('notify.clearedRecreateFailed'), 'warning');
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
        if (text == null) return '';
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

