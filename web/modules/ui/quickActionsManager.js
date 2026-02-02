/**
 * Quick Actions Manager (DI-Pure)
 *
 * Manages a quick actions panel that provides three switchable views:
 * - Quick Actions (user-pinned) — customizable icon slots
 * - Recently Used (auto) — last N unique actions by recency
 * - Frequently Used (auto) — top N actions by use count
 *
 * Desktop: floating panel to the left of task-view
 * Mobile: non-collapsible top row inside the menu
 *
 * @module ui/quickActionsManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS } from '../core/constants.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const SLOT_COUNT = 5;
const MAX_RECENT = 10;
const FREQUENT_MIN_USES = 3;
const VIEWS = ['pinned', 'recent', 'frequent'];
const VIEW_TITLES = {
    pinned: 'Quick Actions',
    recent: 'Recently Used',
    frequent: 'Frequently Used'
};

// ============================================================================
// ACTION REGISTRY (Phase 1: 5 actions)
// ============================================================================

const ACTION_REGISTRY = {
    'stats': {
        label: 'Stats',
        icon: 'stats',
        section: 'Navigation',
        handler: 'showStatsPanel'
    },
    'open-routine': {
        label: 'Open Routine',
        icon: 'folder-open',
        section: 'Routine Actions',
        handler: 'switchMiniCycle'
    },
    'recurring': {
        label: 'Recurring',
        icon: 'repeat',
        section: 'Task Actions & Features',
        handler: 'openRecurringPanel'
    },
    'reminders': {
        label: 'Reminders',
        icon: 'bell',
        section: 'Task Actions & Features',
        handler: 'openRemindersModal'
    },
    'settings': {
        label: 'Settings',
        icon: 'cog',
        section: 'Settings',
        handler: 'openSettings'
    }
};

// SVG icons for the action registry (inline to avoid dynamic icon imports)
const ACTION_ICONS = {
    'stats': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>',
    'folder-open': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M88.7 223.8L0 375.8V96C0 60.7 28.7 32 64 32H181.5c17 0 33.3 6.7 45.3 18.7l26.5 26.5c12 12 28.3 18.7 45.3 18.7H416c35.3 0 64 28.7 64 64v32H144c-22.8 0-43.8 12.1-55.3 31.8zM534.7 272.8c8.8 15.5 8.2 34.5-1.4 49.4S508.4 352 490.7 352H64c-17.7 0-32-14.3-32-32V379.8L123.3 256H490.7c11.5 0 22.2 6.2 27.9 16.3l16.1 .5z"/></svg>',
    'repeat': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M0 224c0 17.7 14.3 32 32 32s32-14.3 32-32c0-53 43-96 96-96H320v32c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l64-64c12.5-12.5 12.5-32.8 0-45.3l-64-64c-9.2-9.2-22.9-11.9-34.9-6.9S320 19.1 320 32V64H160C71.6 64 0 135.6 0 224zm512 64c0-17.7-14.3-32-32-32s-32 14.3-32 32c0 53-43 96-96 96H192V352c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9l-64 64c-12.5 12.5-12.5 32.8 0 45.3l64 64c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6V448H352c88.4 0 160-71.6 160-160z"/></svg>',
    'bell': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"/></svg>',
    'cog': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>'
};

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('QuickActionsManager', {
    AppState: required(),
    appInit: optional(null),
    showNotification: required(),
    safeAddEventListener: optional(null),
    showStatsPanel: required(),
    showTaskView: optional(null),
    switchMiniCycle: optional(null),
    recurringPanel: required(),
    hideMainMenu: required(),
    isDebug: optional(() => false),
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    getModal: optional(null)
});

const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

export function setQuickActionsManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    if (dependencies.isDebug?.()) console.log('⚡ QuickActionsManager dependencies set:', Object.keys(dependencies));
}

// ============================================================================
// QUICK ACTIONS MANAGER CLASS
// ============================================================================

export class QuickActionsManager {
    constructor(dependencies = {}) {
        const resolved = di.resolve(dependencies);
        this.deps = {
            AppState: resolved.AppState,
            showNotification: resolved.showNotification,
            safeAddEventListener: resolved.safeAddEventListener,
            showStatsPanel: resolved.showStatsPanel,
            showTaskView: resolved.showTaskView,
            switchMiniCycle: resolved.switchMiniCycle,
            recurringPanel: resolved.recurringPanel,
            hideMainMenu: resolved.hideMainMenu,
            isDebug: resolved.isDebug,
            getElementById: resolved.getElementById,
            querySelector: resolved.querySelector,
            getModal: resolved.getModal
        };

        this._initialized = false;
        this._pickerOverlay = null;
        this._pendingSlotIndex = null;
        this._longPressTimer = null;
        this._tooltip = null;
        this._swipeStartX = null;
    }

    async init() {
        if (this._initialized) return;

        await _deps.appInit?.waitForCore();

        // Ensure quickActions data exists in settings
        this._ensureData();

        // Render desktop panel
        this._renderPanel(DOM_IDS.QUICK_ACTIONS_SLOTS);

        // Render mobile menu row
        this._renderPanel(DOM_IDS.QUICK_ACTIONS_MENU_SLOTS);

        // Bind events for desktop panel
        this._bindPanelEvents(DOM_IDS.QUICK_ACTIONS_WINDOW);

        // Bind events for mobile menu row
        this._bindPanelEvents(null, DOM_SELECTORS.QUICK_ACTIONS_MENU_ROW);

        // Create picker overlay (shared between desktop and mobile)
        this._createPickerOverlay();

        // Create tooltip element (shared)
        this._createTooltip();

        this._initialized = true;
        if (this.deps.isDebug?.()) console.log('⚡ QuickActionsManager initialized');
    }

    // ========================================================================
    // DATA MANAGEMENT
    // ========================================================================

    _ensureData() {
        const state = this.deps.AppState?.get();
        if (!state?.settings?.quickActions) {
            this.deps.AppState?.update(s => {
                if (!s.settings) s.settings = {};
                s.settings.quickActions = {
                    pinned: ['stats', null, null, null, null],
                    counts: {},
                    recent: [],
                    activeView: 'pinned'
                };
            });
        }
    }

    _getData() {
        const state = this.deps.AppState?.get();
        return state?.settings?.quickActions || {
            pinned: ['stats', null, null, null, null],
            counts: {},
            recent: [],
            activeView: 'pinned'
        };
    }

    _getActiveView() {
        return this._getData().activeView || 'pinned';
    }

    // ========================================================================
    // VIEW CYCLING
    // ========================================================================

    cycleView(direction) {
        const data = this._getData();
        const currentIndex = VIEWS.indexOf(data.activeView || 'pinned');
        let nextIndex;

        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % VIEWS.length;
        } else {
            nextIndex = (currentIndex - 1 + VIEWS.length) % VIEWS.length;
        }

        const nextView = VIEWS[nextIndex];

        this.deps.AppState?.update(s => {
            if (!s.settings?.quickActions) return;
            s.settings.quickActions.activeView = nextView;
        });

        this._renderAllPanels();
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    _renderAllPanels() {
        this._renderPanel(DOM_IDS.QUICK_ACTIONS_SLOTS);
        this._renderPanel(DOM_IDS.QUICK_ACTIONS_MENU_SLOTS);
        this._updateTitles();
    }

    _renderPanel(containerId) {
        const container = this.deps.getElementById(containerId);
        if (!container) return;

        const view = this._getActiveView();

        container.innerHTML = '';

        switch (view) {
            case 'pinned':
                this._renderPinnedSlots(container);
                break;
            case 'recent':
                this._renderRecentActions(container);
                break;
            case 'frequent':
                this._renderFrequentActions(container);
                break;
        }
    }

    _renderPinnedSlots(container) {
        const data = this._getData();
        const pinned = data.pinned || [];
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < SLOT_COUNT; i++) {
            const actionId = pinned[i];
            if (actionId && ACTION_REGISTRY[actionId]) {
                fragment.appendChild(this._createFilledSlot(actionId, i));
            } else {
                fragment.appendChild(this._createEmptySlot(i));
            }
        }

        container.appendChild(fragment);
    }

    _renderRecentActions(container) {
        const data = this._getData();
        const recent = (data.recent || []).slice(0, SLOT_COUNT);

        if (recent.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'quick-actions-empty-msg';
            msg.textContent = 'No recent actions';
            container.appendChild(msg);
            return;
        }

        const fragment = document.createDocumentFragment();
        recent.forEach(actionId => {
            if (ACTION_REGISTRY[actionId]) {
                fragment.appendChild(this._createFilledSlot(actionId, -1, true));
            }
        });
        container.appendChild(fragment);
    }

    _renderFrequentActions(container) {
        const data = this._getData();
        const counts = data.counts || {};

        // Get actions that meet the minimum use threshold, sorted by count
        const qualifying = Object.entries(counts)
            .filter(([id, count]) => count >= FREQUENT_MIN_USES && ACTION_REGISTRY[id])
            .sort((a, b) => b[1] - a[1])
            .slice(0, SLOT_COUNT);

        if (qualifying.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'quick-actions-empty-msg';
            msg.textContent = 'No frequent actions yet';
            container.appendChild(msg);
            return;
        }

        const fragment = document.createDocumentFragment();
        qualifying.forEach(([actionId]) => {
            if (ACTION_REGISTRY[actionId]) {
                fragment.appendChild(this._createFilledSlot(actionId, -1, true));
            }
        });
        container.appendChild(fragment);
    }

    _updateTitles() {
        const view = this._getActiveView();
        const title = VIEW_TITLES[view] || 'Quick Actions';
        document.querySelectorAll(DOM_SELECTORS.QUICK_ACTIONS_TITLE).forEach(el => {
            el.textContent = title;
        });
    }

    // ========================================================================
    // SLOT CREATION
    // ========================================================================

    _createFilledSlot(actionId, slotIndex, isAutoView = false) {
        const action = ACTION_REGISTRY[actionId];
        const btn = document.createElement('button');
        btn.className = 'quick-actions-slot filled';
        btn.title = action.label;
        btn.setAttribute('aria-label', action.label);
        btn.dataset.actionId = actionId;
        btn.dataset.slotIndex = slotIndex;

        // Icon
        const iconSpan = document.createElement('span');
        iconSpan.className = 'slot-icon';
        iconSpan.innerHTML = ACTION_ICONS[action.icon] || '';
        btn.appendChild(iconSpan);

        // Remove badge (only for pinned view)
        if (!isAutoView && slotIndex >= 0) {
            const removeBadge = document.createElement('span');
            removeBadge.className = 'remove-badge';
            removeBadge.setAttribute('role', 'button');
            removeBadge.setAttribute('aria-label', `Unpin ${action.label}`);
            removeBadge.textContent = '×';
            removeBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                this.unpinAction(slotIndex);
            });
            btn.appendChild(removeBadge);
        }

        // Click handler: execute the action
        btn.addEventListener('click', () => {
            this.executeAction(actionId);
        });

        // Long-press for mobile tooltip
        this._addLongPressHandler(btn, actionId, slotIndex, isAutoView);

        return btn;
    }

    _createEmptySlot(slotIndex) {
        const btn = document.createElement('button');
        btn.className = 'quick-actions-slot empty';
        btn.title = 'Add action';
        btn.setAttribute('aria-label', 'Add action');
        btn.dataset.slotIndex = slotIndex;
        btn.textContent = '+';

        btn.addEventListener('click', () => {
            this.showActionPicker(slotIndex);
        });

        return btn;
    }

    // ========================================================================
    // ACTION EXECUTION
    // ========================================================================

    _warnMissingDep(depName, actionId) {
        console.warn(`⚡ QuickActionsManager: '${depName}' is null — action '${actionId}' cannot execute`);
        this.deps.showNotification?.('Action unavailable. Please try again later.', 'warning', 3000);
    }

    executeAction(actionId) {
        const action = ACTION_REGISTRY[actionId];
        if (!action) return;

        try {
            this.trackAction(actionId);

            switch (action.handler) {
                case 'showStatsPanel':
                    if (!this.deps.showStatsPanel) {
                        this._warnMissingDep('showStatsPanel', actionId);
                        break;
                    }
                    this.deps.showStatsPanel();
                    break;
                case 'switchMiniCycle': {
                    setTimeout(() => {
                        try {
                            const routineBtn = document.getElementById(DOM_IDS.ROUTINE_SWITCHER_BTN);
                            if (routineBtn) {
                                routineBtn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.ROUTINE_SWITCHER_BTN, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.('Action failed. Please try again.', 'error', 3000);
                        }
                    }, 0);
                    break;
                }
                case 'openRecurringPanel':
                    if (!this.deps.recurringPanel?.openPanel) {
                        this._warnMissingDep('recurringPanel.openPanel', actionId);
                        break;
                    }
                    setTimeout(() => {
                        try {
                            this.deps.recurringPanel.openPanel();
                            this.deps.hideMainMenu?.();
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.('Action failed. Please try again.', 'error', 3000);
                        }
                    }, 0);
                    break;
                case 'openRemindersModal': {
                    setTimeout(() => {
                        try {
                            const modal = this.deps.getModal?.('reminders') || this.deps.getElementById(DOM_IDS.REMINDERS_MODAL);
                            if (modal) {
                                modal.style.display = 'flex';
                            } else {
                                this._warnMissingDep('reminders modal', actionId);
                            }
                            this.deps.hideMainMenu?.();
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.('Action failed. Please try again.', 'error', 3000);
                        }
                    }, 0);
                    break;
                }
                case 'openSettings': {
                    setTimeout(() => {
                        try {
                            const settingsBtn = document.getElementById(DOM_IDS.OPEN_SETTINGS);
                            if (settingsBtn) {
                                settingsBtn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.OPEN_SETTINGS, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.('Action failed. Please try again.', 'error', 3000);
                        }
                    }, 0);
                    break;
                }
            }
        } catch (err) {
            console.error(`⚡ Quick action '${actionId}' failed:`, err);
            this.deps.showNotification?.('Action failed. Please try again.', 'error', 3000);
        }
    }

    // ========================================================================
    // PINNING / UNPINNING
    // ========================================================================

    pinAction(slotIndex, actionId) {
        this.deps.AppState?.update(s => {
            if (!s.settings?.quickActions) return;
            s.settings.quickActions.pinned[slotIndex] = actionId;
        });

        this._renderAllPanels();
        this._hidePickerOverlay();
    }

    unpinAction(slotIndex) {
        this.deps.AppState?.update(s => {
            if (!s.settings?.quickActions) return;
            s.settings.quickActions.pinned[slotIndex] = null;
        });

        this._renderAllPanels();
    }

    // ========================================================================
    // TRACKING
    // ========================================================================

    trackAction(actionId) {
        if (!ACTION_REGISTRY[actionId]) return;

        this.deps.AppState?.update(s => {
            if (!s.settings) s.settings = {};
            if (!s.settings.quickActions) {
                s.settings.quickActions = {
                    pinned: ['stats', null, null, null, null],
                    counts: {},
                    recent: [],
                    activeView: 'pinned'
                };
            }
            const qa = s.settings.quickActions;

            // Increment count
            if (!qa.counts) qa.counts = {};
            qa.counts[actionId] = (qa.counts[actionId] || 0) + 1;

            // Add to recent (front), deduplicate, cap
            if (!qa.recent) qa.recent = [];
            qa.recent = qa.recent.filter(id => id !== actionId);
            qa.recent.unshift(actionId);
            if (qa.recent.length > MAX_RECENT) {
                qa.recent = qa.recent.slice(0, MAX_RECENT);
            }
        });

        // Re-render if showing recent or frequent view
        const view = this._getActiveView();
        if (view === 'recent' || view === 'frequent') {
            this._renderAllPanels();
        }
    }

    // ========================================================================
    // ACTION PICKER MODAL
    // ========================================================================

    showActionPicker(slotIndex) {
        this._pendingSlotIndex = slotIndex;

        const data = this._getData();
        const pinned = data.pinned || [];

        // Build picker content
        const picker = this._pickerOverlay.querySelector(DOM_SELECTORS.QUICK_ACTIONS_PICKER);
        const grid = picker.querySelector(DOM_SELECTORS.QUICK_ACTIONS_PICKER_GRID);
        grid.innerHTML = '';

        // Group actions by section
        const sections = {};
        for (const [id, action] of Object.entries(ACTION_REGISTRY)) {
            if (!sections[action.section]) {
                sections[action.section] = [];
            }
            sections[action.section].push({ id, ...action });
        }

        for (const [sectionName, actions] of Object.entries(sections)) {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'quick-actions-picker-section';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'quick-actions-picker-section-title';
            titleDiv.textContent = sectionName;
            sectionDiv.appendChild(titleDiv);

            const itemsDiv = document.createElement('div');
            itemsDiv.className = 'quick-actions-picker-grid';

            actions.forEach(action => {
                const item = document.createElement('button');
                item.className = 'quick-actions-picker-item';

                // Disable if already pinned
                if (pinned.includes(action.id)) {
                    item.classList.add('disabled');
                }

                const iconSpan = document.createElement('span');
                iconSpan.className = 'picker-icon';
                iconSpan.innerHTML = ACTION_ICONS[action.icon] || '';
                item.appendChild(iconSpan);

                const labelSpan = document.createElement('span');
                labelSpan.textContent = action.label;
                item.appendChild(labelSpan);

                item.addEventListener('click', () => {
                    if (!pinned.includes(action.id)) {
                        this.pinAction(slotIndex, action.id);
                    }
                });

                itemsDiv.appendChild(item);
            });

            sectionDiv.appendChild(itemsDiv);
            grid.appendChild(sectionDiv);
        }

        // Show overlay
        this._pickerOverlay.classList.add('visible');
    }

    _createPickerOverlay() {
        // Check if already exists
        if (document.getElementById(DOM_IDS.QUICK_ACTIONS_PICKER_OVERLAY)) {
            this._pickerOverlay = document.getElementById(DOM_IDS.QUICK_ACTIONS_PICKER_OVERLAY);
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = DOM_IDS.QUICK_ACTIONS_PICKER_OVERLAY;
        overlay.className = 'quick-actions-picker-overlay';

        const picker = document.createElement('div');
        picker.className = 'quick-actions-picker';

        const title = document.createElement('h3');
        title.textContent = 'Add Quick Action';
        picker.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'quick-actions-picker-grid';  // matches DOM_SELECTORS.QUICK_ACTIONS_PICKER_GRID (without dot)
        picker.appendChild(grid);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'quick-actions-picker-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this._hidePickerOverlay());
        picker.appendChild(cancelBtn);

        overlay.appendChild(picker);

        // Close on overlay click (not picker itself)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this._hidePickerOverlay();
            }
        });

        document.body.appendChild(overlay);
        this._pickerOverlay = overlay;
    }

    _hidePickerOverlay() {
        if (this._pickerOverlay) {
            this._pickerOverlay.classList.remove('visible');
        }
        this._pendingSlotIndex = null;
    }

    // ========================================================================
    // PANEL EVENTS (arrows, swipe)
    // ========================================================================

    _bindPanelEvents(panelId, panelSelector) {
        const panel = panelId
            ? this.deps.getElementById(panelId)
            : this.deps.querySelector(panelSelector);
        if (!panel) return;

        // Arrow buttons
        const prevBtn = panel.querySelector(DOM_SELECTORS.QUICK_ACTIONS_PREV);
        const nextBtn = panel.querySelector(DOM_SELECTORS.QUICK_ACTIONS_NEXT);

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.cycleView('prev'));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.cycleView('next'));
        }

        // Swipe gesture on header
        const header = panel.querySelector(DOM_SELECTORS.QUICK_ACTIONS_HEADER);
        if (header) {
            this._setupSwipeGesture(header);
        }
    }

    _setupSwipeGesture(element) {
        let startX = 0;
        const threshold = 40;

        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        }, { passive: true });

        element.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const diff = endX - startX;

            if (Math.abs(diff) >= threshold) {
                if (diff > 0) {
                    this.cycleView('prev');
                } else {
                    this.cycleView('next');
                }
            }
        }, { passive: true });

        // Desktop: mouse drag on header
        element.addEventListener('mousedown', (e) => {
            this._swipeStartX = e.clientX;
        });

        element.addEventListener('mouseup', (e) => {
            if (this._swipeStartX !== null) {
                const diff = e.clientX - this._swipeStartX;
                if (Math.abs(diff) >= threshold) {
                    if (diff > 0) {
                        this.cycleView('prev');
                    } else {
                        this.cycleView('next');
                    }
                }
                this._swipeStartX = null;
            }
        });
    }

    // ========================================================================
    // LONG-PRESS (mobile tooltip + remove)
    // ========================================================================

    _addLongPressHandler(element, actionId, slotIndex, isAutoView) {
        let timer = null;

        element.addEventListener('touchstart', (e) => {
            timer = setTimeout(() => {
                this._showTooltip(element, actionId, slotIndex, isAutoView);
            }, 500);
        }, { passive: true });

        element.addEventListener('touchend', () => {
            clearTimeout(timer);
        }, { passive: true });

        element.addEventListener('touchmove', () => {
            clearTimeout(timer);
        }, { passive: true });
    }

    _createTooltip() {
        if (document.getElementById(DOM_IDS.QUICK_ACTIONS_TOOLTIP)) {
            this._tooltip = document.getElementById(DOM_IDS.QUICK_ACTIONS_TOOLTIP);
            return;
        }

        const tooltip = document.createElement('div');
        tooltip.id = DOM_IDS.QUICK_ACTIONS_TOOLTIP;
        tooltip.className = 'quick-actions-tooltip';
        document.body.appendChild(tooltip);
        this._tooltip = tooltip;
    }

    _showTooltip(element, actionId, slotIndex, isAutoView) {
        const action = ACTION_REGISTRY[actionId];
        if (!action || !this._tooltip) return;

        const rect = element.getBoundingClientRect();

        this._tooltip.innerHTML = '';

        const label = document.createElement('div');
        label.textContent = action.label;
        this._tooltip.appendChild(label);

        // Add remove button for pinned view
        if (!isAutoView && slotIndex >= 0) {
            const removeBtn = document.createElement('button');
            removeBtn.className = DOM_SELECTORS.TOOLTIP_REMOVE;
            removeBtn.setAttribute('aria-label', `Remove ${action.label} from quick actions`);
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => {
                this.unpinAction(slotIndex);
                this._hideTooltip();
            });
            this._tooltip.appendChild(removeBtn);
        }

        Object.assign(this._tooltip.style, {
            left: `${rect.left + rect.width / 2}px`,
            top: `${rect.top - 10}px`,
            transform: 'translate(-50%, -100%)'
        });
        this._tooltip.classList.add('visible');

        // Auto-hide after 3 seconds
        setTimeout(() => this._hideTooltip(), UI_TIMEOUTS.TOOLTIP_HIDE);

        // Hide on next touch anywhere
        const hideOnTouch = () => {
            this._hideTooltip();
            document.removeEventListener('touchstart', hideOnTouch);
        };
        setTimeout(() => {
            document.addEventListener('touchstart', hideOnTouch, { once: true, passive: true });
        }, 100);
    }

    _hideTooltip() {
        if (this._tooltip) {
            this._tooltip.classList.remove('visible');
        }
    }
}

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

let quickActionsManager = null;

export async function initQuickActionsManager(dependencies) {
    quickActionsManager = new QuickActionsManager(dependencies);
    await quickActionsManager.init();
    return quickActionsManager;
}

/**
 * Track an action from outside the module (called by menu handlers)
 * @param {string} actionId - Action ID from ACTION_REGISTRY
 */
export function trackAction(actionId) {
    quickActionsManager?.trackAction(actionId);
}

// Boot log only in debug mode (isDebug not available at module level, logged in init instead)
