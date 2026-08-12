/**
 * History Manager Module (DI-Pure)
 *
 * Tracks history events for each routine (cycle completed, tasks cleared, etc.)
 * Per-routine storage - history travels with .mcyc exports.
 *
 * @module features/historyManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { COLORS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES } from '../core/constants.js';
import { getLabel, getIcon } from '../labels/labelResolver.js';
import { handleVerticalArrowNav, handleHorizontalArrowNav } from '../utils/keyboardNav.js';
import { isClickOnNotification } from '../ui/modalUtils.js';
// Local-midnight parse for date-only "YYYY-MM-DD" dueDates — new Date() reads
// them as UTC midnight, showing the previous day in negative UTC offsets.
import { parseDateAsLocal } from '../recurring/recurringDateUtils.js';
import { isValidHex } from '../utils/styleValidators.js';

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
    updateHelpWindow: optional(null),
    addTask: optional(null),
    showHistoryTourNotification: optional(null),
    showClearedTasksTourNotification: optional(null)
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
     * @returns {void}
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
     * @returns {void}
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

            // Refresh help window so cycle count / status reflects the reset
            this.deps.updateHelpWindow?.();
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
     * @returns {void}
     */
    openModal(initialTab = 'events') {
        if (this.modalOverlay) {
            this.closeModal();
        }

        this.activeTab = initialTab;
        this.isRecreateMode = false;
        this.selectedTasks.clear();

        this.modalOverlay = document.createElement('dialog');
        this.modalOverlay.id = DOM_IDS.HISTORY_MODAL_DIALOG;
        this.modalOverlay.setAttribute('aria-label', getLabel('history.title'));
        this.modalOverlay.setAttribute('aria-modal', 'true');
        this.modalOverlay.style.opacity = '0';
        this.modalOverlay.style.transition = 'opacity 0.2s ease';

        // Get cleared tasks count for badge
        const clearedCount = this._getClearedTasksCount();

        this.modalOverlay.innerHTML = `
            <div class="history-modal">
                <header class="history-header">
                    <button class="history-back-btn" aria-label="${getLabel('button.close')}">&larr;</button>
                    <h2 class="history-title">${getLabel('history.title')}</h2>
                    <button class="history-action-btn history-action-btn--danger">${getLabel('history.clearAll')}</button>
                </header>
                ${clearedCount > 0 ? `
                <div class="history-tabs">
                    <button class="history-tab" data-tab="events">📜 ${getLabel('history.events')}</button>
                    <button class="history-tab" data-tab="cleared">✓ ${getLabel('history.clearedTasks')} <span class="history-tab-badge">${clearedCount}</span></button>
                </div>
                ` : ''}
                <div class="history-modal-content"></div>
                <div class="history-reset-section">
                    <button class="history-reset-progress-btn">${getLabel('history.resetRoutineProgress')}</button>
                </div>
                <footer class="history-footer">
                    <button class="history-cancel-btn">${getLabel('button.cancel')}</button>
                    <button class="history-confirm-btn">${getLabel('history.recreateSelected', { vars: { count: 0 } })}</button>
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

            // Trigger appropriate guided tour
            if (this.activeTab === 'cleared') {
                this.deps.showClearedTasksTourNotification?.();
            } else {
                this.deps.showHistoryTourNotification?.();
            }
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
            this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_TABS)?.removeEventListener('keydown', this._tabKeyHandler);
            this._tabKeyHandler = null;
        }
        if (this._contentKeyHandler) {
            this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_MODAL_CONTENT)?.removeEventListener('keydown', this._contentKeyHandler);
            this._contentKeyHandler = null;
        }
        if (this._recurringLinkHandler) {
            this.modalOverlay.querySelector(DOM_SELECTORS.CLEARED_VIEW_RECURRING)?.removeEventListener('click', this._recurringLinkHandler);
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
                    // Remove existing tour notifications before switching tabs
                    // (not just hide — fully remove from DOM to prevent stacking)
                    this.modalOverlay?.querySelectorAll(DOM_SELECTORS.NOTIFICATION_SHOW)
                        .forEach(n => n.remove());

                    this.activeTab = newTab;
                    this.isRecreateMode = false;
                    this.selectedTasks.clear();
                    this._updateTabStyles();
                    this._renderModalContent();
                    this._updateFooterVisibility();
                    this._updateActionButton();

                    // Trigger appropriate tour for the new tab
                    if (newTab === 'cleared') {
                        this.deps.showClearedTasksTourNotification?.();
                    } else {
                        this.deps.showHistoryTourNotification?.();
                    }
                }
            };
            this._tabHandlers.push({ element: tab, handler });
            tab.addEventListener('click', handler);
        });

        // Arrow key navigation for tabs (Left/Right to switch)
        const tabContainer = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_TABS);
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
        const contentArea = this.modalOverlay.querySelector(DOM_SELECTORS.HISTORY_MODAL_CONTENT);
        if (contentArea) {
            this._contentKeyHandler = (event) => {
                // Navigate history events
                handleVerticalArrowNav(event, contentArea, DOM_SELECTORS.HISTORY_EVENT);
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
            if (e.target === this.modalOverlay && !isClickOnNotification(e)) {
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
                <div class="history-empty-state">
                    <div class="history-empty-emoji">📜</div>
                    <p class="history-empty-text">${getLabel('history.noHistoryYet')}</p>
                    <p class="history-empty-hint">${getLabel('history.noHistoryHint')}</p>
                </div>
            `;
            return;
        }

        // Group events by date
        const groups = this._groupEventsByDate(events);

        let html = '';
        for (const [label, groupEvents] of Object.entries(groups)) {
            html += `
                <div class="history-group">
                    <h3 class="history-group-heading">${label}</h3>
                    ${groupEvents.map(evt => this._renderEvent(evt)).join('')}
                </div>
            `;
        }

        // Show achievement note if any cleared task events exist
        const hasClearedEvents = events.some(evt => evt.type === 'tasks_cleared' || evt.type === 'tasks_removed_on_reset');
        if (hasClearedEvents) {
            html += `
                <p class="history-achievement-note">${getLabel('taskOptions.achievementNote')}</p>
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
                <div class="history-empty-state">
                    <div class="history-empty-emoji">✓</div>
                    <p class="history-empty-text">${getLabel('history.noClearedTasks')}</p>
                    <p class="history-empty-hint">${getLabel('history.noClearedHint')}</p>
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
            <div class="history-recurring-note">
                <span class="history-recurring-note-icon">↻</span>
                ${getLabel('history.recurringNote')}
                ${hasRecurring ? `<br><a href="#" class="cleared-view-recurring">${getLabel('history.viewRecurring')}</a>` : ''}
            </div>
        `;

        content.innerHTML = html + recurringNote;

        // Wire recurring panel link if present
        const recurringLink = content.querySelector(DOM_SELECTORS.CLEARED_VIEW_RECURRING);
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
                        el.classList.remove(DOM_CLASSES.SELECTED);
                        if (checkbox) checkbox.textContent = '';
                    } else {
                        this.selectedTasks.add(id);
                        el.classList.add(DOM_CLASSES.SELECTED);
                        if (checkbox) checkbox.textContent = '✓';
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
            <div class="cleared-entry ${isSelected ? 'selected' : ''} ${this.isRecreateMode ? 'selectable' : ''}"
                 data-id="${entry.id}"
                 tabindex="0">
                ${this.isRecreateMode ? `
                    <span class="cleared-entry-checkbox">${isSelected ? '✓' : ''}</span>
                ` : ''}
                <div class="cleared-entry-content">
                    <div class="cleared-entry-text">${this._escapeHtml(entry.taskText)}</div>
                    <div class="cleared-entry-metadata">
                        <span>${dateStr} ${timeStr}</span>
                        ${entry.wasHighPriority ? (() => { const safeColor = isValidHex(entry.priorityColor) ? entry.priorityColor : ''; return `<span class="cleared-entry-priority">${getLabel('history.highPriority')} <span class="history-priority-dot" style="background:${safeColor || 'var(--color-error)'};" aria-hidden="true"></span></span>`; })() : ''}
                        ${entry.dueDate ? `<span class="cleared-entry-due-date">${getLabel('history.hasDueDate')} ${(parseDateAsLocal(entry.dueDate) || new Date(entry.dueDate)).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>` : ''}
                        ${entry.remindersEnabled ? `<span class="cleared-entry-reminders">${getLabel('history.hasReminders')}</span>` : ''}
                        ${entry.recurring ? `<span class="cleared-entry-recurring">${getLabel('history.isRecurring')}</span>` : ''}
                        ${entry.clearedInMode ? `<span class="cleared-entry-mode">${entry.clearedInMode === 'todo' ? getLabel('history.clearedInToDoMode') : getLabel('history.clearedInCycleMode')}</span>` : ''}
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
            'theme_changed': '🎨',
            'undo': '↩️',
            'redo': '↪️'
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
            'theme_changed': getLabel('history.themeChanged'),
            'undo': getLabel('history.undo'),
            'redo': getLabel('history.redo')
        };

        const eventDate = new Date(event.timestamp);
        const dateStr = eventDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const timeStr = eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const time = `${dateStr} ${timeStr}`;

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
            } else if (event.type === 'task_priority_set' && event.details.taskName !== undefined) {
                // Type-specific branches MUST precede the generic taskName one:
                // taskCRUD always logs taskName, so anything below that branch
                // is unreachable for events that carry it. Until v2.371 these
                // two sat below it and the priority dot never rendered
                // (features-review finding, Aug 2026).
                const safeColor = isValidHex(event.details.priorityColor)
                    ? event.details.priorityColor : COLORS.PRIORITY_DEFAULT;
                detailText = `${this._escapeHtml(event.details.taskName)} <span class="history-priority-dot" style="background:${safeColor};" aria-hidden="true"></span>`;
            } else if (event.type === 'task_priority_removed' && event.details.taskName !== undefined) {
                detailText = this._escapeHtml(event.details.taskName);
            } else if (event.details.taskName !== undefined) {
                detailText = this._escapeHtml(event.details.taskName);
            } else if (event.details.taskNames !== undefined) {
                const count = event.details.count ?? event.details.taskNames.length;
                const names = event.details.taskNames.map(n => this._escapeHtml(n)).join(', ');
                const taskNounPlural = this._escapeHtml(event.details._taskNoun) || getLabel('noun.task', { count });
                detailText = `${count} ${taskNounPlural}: ${names}`;
            } else if (event.details.themeName !== undefined) {
                detailText = this._escapeHtml(event.details.themeName);
            } else if (event.details.description !== undefined) {
                // undo/redo events carry a human description of what was
                // un/re-done ("Mode changed", "2 changes"); it was passed by
                // both call sites but discarded here for lack of a branch.
                // LAST in the chain on purpose: it is the generic fallback,
                // and specific branches must stay above it (see the
                // priority-dot lesson right above).
                detailText = this._escapeHtml(event.details.description);
            }
        }

        return `
            <div class="history-event" tabindex="0">
                <span class="history-event-icon">${this._escapeHtml(event.details?._eventIcon) || icons[event.type] || '📌'}</span>
                <div class="history-event-content">
                    <div class="history-event-title">${this._escapeHtml(event.details?._eventLabel) || labels[event.type] || this._escapeHtml(event.type)}</div>
                    ${detailText ? `<div class="history-event-details">${detailText}</div>` : ''}
                </div>
                <span class="history-event-timestamp">${time}</span>
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
            tab.classList.toggle(DOM_CLASSES.ACTIVE, isActive);
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
            footer.classList.toggle(DOM_CLASSES.VISIBLE, this.isRecreateMode);
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
            actionBtn.className = 'history-action-btn history-action-btn--danger';
            actionBtn.hidden = false;
        } else if (this.activeTab === 'cleared') {
            if (this.isRecreateMode) {
                actionBtn.hidden = true;
            } else {
                actionBtn.textContent = getLabel('history.recreateTasks');
                actionBtn.className = 'history-action-btn history-action-btn--primary';
                actionBtn.hidden = false;
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

