/**
 * miniCycle Routine Switcher — Actions
 *
 * The destructive half of the routine switcher: delete, duplicate, download and
 * rename a routine, plus the inline-edit flow rename runs through.
 *
 * Extracted from `routine/routineSwitcher.js` (Aug 2026, splits-plan Priority 1).
 *
 * ── PATTERN: MANAGER BACK-REFERENCE, AS IN statsPanel ───────────────────────
 * This is the app's existing shape for a STATEFUL sub-module. `statsPanelGestures`
 * and `statsPanelRewards` each hold `this.m` and reach the manager's deps and
 * shared state through it; methods moved verbatim with only ownership rewrites.
 * The same is done here — `this.deps.X` became `this.m.deps.X`, and the four
 * things that stay in the parent are reached as `this.m.*`:
 *
 *   • `_getSelectedItem()` / `_selectedCycleKey` — selection is switcher state
 *   • `loadMiniCycleList()` / `updatePreview()` — list + preview refresh
 *   • `hideSwitchMiniCycleModal()`             — modal lifecycle
 *   • `getObjectSizeBytes` / `getUniqueCycleName` — module bindings the parent
 *     populates from its dynamic versioned imports in initRoutineSwitcher()
 *
 * ── WHY STATIC IMPORT, CONSTRUCTED IN THE CONSTRUCTOR ───────────────────────
 * statsPanel loads its sub-modules with a dynamic `?v=` import inside `init()`.
 * That is wrong HERE: `routineSwitcher.tests.js` builds `new RoutineSwitcher(deps)`
 * without calling `initRoutineSwitcher`, then calls `deleteMiniCycle()`. A
 * dynamically-loaded sub-module would be null on that path and delete would
 * silently do nothing. This class holds no module-level state, so a static
 * import carries no instance-splitting risk (same reasoning as
 * routineSwitcherThemePicker.js, and the same precedent as `longPressHint`).
 *
 * ── REGISTRATION ────────────────────────────────────────────────────────────
 * Not in moduleManifests.js — sub-modules never are. It IS listed in
 * FACADE_SUB_FILES in scripts/validate-di-deps.js so its `this.m.deps.*` reads
 * count toward routineSwitcher's declared dependencies, and in BOOT_CRITICAL in
 * service-worker.js because a static import from a boot-critical module is
 * itself boot-critical.
 *
 * @module routine/routineSwitcherActions
 * @see {@link file://docs/future-work/LARGE_MODULE_SPLITS_PLAN.md} - why this split
 * @see {@link module:features/statsPanelRewards} - the pattern this follows
 */

import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { buildMcycPayload } from '../utils/mcycPayload.js';

export class RoutineSwitcherActions {
    /**
     * @param {Object} manager - The owning RoutineSwitcher instance
     */
    constructor(manager) {
        this.m = manager;
    }

    /**
     * Rename a miniCycle (inline edit)
     */
    renameMiniCycle() {

        const selectedCycle = this.m._getSelectedItem();

        if (!selectedCycle) {
            console.warn('⚠️ No cycle selected for rename');
            this.m.deps.showNotification(getLabel('notify.selectToRename'), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            return;
        }

        // ✅ Use state-based data access
        if (!this.m.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for renameMiniCycle');
            this.m.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = this.m.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for renameMiniCycle');
            this.m.deps.showNotification('⚠️ ' + getLabel('notify.dataNotAvailable'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const cycleKey = selectedCycle.dataset.cycleKey;
        const currentCycle = currentState.data?.cycles?.[cycleKey];

        if (!cycleKey || !currentCycle) {
            console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!currentCycle });
            this.m.deps.showNotification('⚠️ ' + getLabel('notify.invalidCycleSelection'), "error", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            return;
        }

        // ✅ Use inline edit (same as duplicate)
        this._startInlineEdit(selectedCycle, cycleKey);
    }

    /**
     * Delete a miniCycle
     */
    deleteMiniCycle() {

        const selectedCycle = this.m._getSelectedItem();
        if (!selectedCycle) {
            console.warn('⚠️ No cycle selected for deletion');
            this.m.deps.showNotification("⚠ " + getLabel('switcher.noSelectedForDelete'));
            return;
        }

        // ✅ Use state-based data access
        if (!this.m.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for deleteMiniCycle');
            this.m.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = this.m.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for deleteMiniCycle');
            this.m.deps.showNotification('⚠️ ' + getLabel('notify.dataNotAvailable'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const { data, appState } = currentState;
        const cycles = data.cycles || {};
        const activeCycle = appState.activeCycleId;
        const cycleKey = selectedCycle.dataset.cycleKey;
        const currentCycle = cycles[cycleKey];

        if (!cycleKey || !currentCycle) {
            console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!currentCycle });
            this.m.deps.showNotification('⚠️ ' + getLabel('notify.invalidCycleSelection'), "error", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            return;
        }

        const cycleToDelete = currentCycle.title;

        // Calculate the size of the routine being deleted (for storage estimate)
        const routineSizeBytes = this.m.getObjectSizeBytes(currentCycle);

        this.m.deps.showConfirmationModal({
            title: getLabel('switcher.deleteTitle'),
            message: "❌ " + getLabel('switcher.deleteMessage', { vars: { name: cycleToDelete } }),
            confirmText: getLabel('button.delete'),
            cancelText: getLabel('button.cancel'),
            destructive: true,
            callback: (confirmed) => {
                if (!confirmed) {
                    return;
                }

                // Track if we're deleting the active cycle
                const wasActiveCycle = cycleKey === activeCycle;
                let newActiveCycleName = null;

                // ✅ Update through state system
                this.m.deps.AppState.update(state => {
                    // Remove the selected miniCycle
                    delete state.data.cycles[cycleKey];

                    // If the deleted cycle was the active one, handle fallback
                    if (wasActiveCycle) {
                        const remainingCycleKeys = Object.keys(state.data.cycles);

                        if (remainingCycleKeys.length > 0) {
                            // Switch to the first available miniCycle
                            const newActiveCycleKey = remainingCycleKeys[0];
                            state.appState.activeCycleId = newActiveCycleKey;

                            const newActiveCycle = state.data.cycles[newActiveCycleKey];
                            newActiveCycleName = newActiveCycle.title;
                        } else {
                            state.appState.activeCycleId = null;
                        }
                    }

                }, true); // immediate save

                // ✅ Update storage estimate (subtract deleted routine size)
                this.m.adjustStorageEstimate(-routineSizeBytes);
                const barElement = this.m.deps.getElementById(DOM_IDS.STORAGE_BAR_FILL);
                const textElement = this.m.deps.getElementById(DOM_IDS.STORAGE_BAR_TEXT);
                if (barElement && textElement) {
                    this.m.updateStorageBarUIEstimated(barElement, textElement);
                }

                // ✅ Notify undo system of cycle deletion (DI-pure)
                if (typeof this.m.deps.onCycleDeleted === 'function') {
                    // Promise.resolve(): the moduleLoader DI wrapper optional-chains its inner
                    // call, so it yields undefined when the hook is unwired and `.catch` on
                    // undefined throws here — inside a UI flow, after state already changed.
                    Promise.resolve(this.m.deps.onCycleDeleted(cycleKey)).catch(err => {
                        console.warn('⚠️ Undo system cycle deletion notification failed:', err);
                    });
                }

                // ✅ Check if any cycles remain
                const finalState = this.m.deps.AppState.get();
                const remainingCycles = Object.keys(finalState.data.cycles);

                if (remainingCycles.length === 0) {
                    // No cycles left — return the EXISTING user to the neutral
                    // create-routine flow (not the new-user onboarding).
                    setTimeout(() => {
                        this.m.hideSwitchMiniCycleModal();

                        // ✅ FIX: Query DOM elements fresh inside setTimeout (not stale from outer scope)
                        const taskList = this.m.deps.getElementById(DOM_IDS.TASK_LIST);
                        const toggleAutoReset = this.m.deps.getElementById(DOM_IDS.TOGGLE_AUTO_RESET);

                        if (taskList) {
                            taskList.innerHTML = "";
                            this.m.deps.getBody().classList.add(DOM_CLASSES.TASKS_EMPTY);
                        }
                        if (toggleAutoReset) toggleAutoReset.checked = false;

                        // Deleting your last routine is an explicit action by an
                        // EXISTING user — not a reason to replay the brand-new-user
                        // onboarding ("Welcome to miniCycle" + tour walkthrough), which
                        // is what showOnboarding() renders. Show the neutral "Create a
                        // Routine" dialog instead: it offers Load Sample, and cancelling
                        // it loads the getting-started sample, so the app is never left
                        // empty. (Reported on r/websitefeedback — deleting the last
                        // routine surfaced the new-user welcome.)
                        setTimeout(() => {
                            if (typeof this.m.deps.showCycleCreationModal === 'function') {
                                this.m.deps.showCycleCreationModal();
                            } else {
                                console.warn('⚠️ showCycleCreationModal unavailable after deleting last routine');
                            }
                        }, 500);
                    }, 300);
                } else {
                    // Keep modal open - just refresh the list
                    this.m.loadMiniCycleList();

                    // If we deleted the active cycle, update background UI to show new active
                    if (wasActiveCycle && typeof this.m.deps.loadMiniCycle === 'function') {
                        this.m.deps.loadMiniCycle();
                    }

                    // Select first remaining routine
                    setTimeout(() => {
                        const firstCycle = this.m.deps.querySelector(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM);
                        if (firstCycle) {
                            firstCycle.classList.add(DOM_CLASSES.SELECTED);
                            firstCycle.click();
                        }
                    }, 50);
                }

                if (wasActiveCycle && newActiveCycleName) {
                    this.m.deps.showNotification('🗑️ ' + getLabel('notify.cycleDeletedSwitch', { vars: { deleted: cycleToDelete, active: newActiveCycleName } }), "info", UI_TIMEOUTS.NOTIFICATION_EXTENDED);
                } else {
                    this.m.deps.showNotification('🗑️ ' + getLabel('notify.cycleDeleted', { vars: { name: cycleToDelete } }));
                }
            }
        });
    }

    /**
     * Download the selected routine as a .mcyc file with confirmation
     */
    downloadMiniCycle() {
        const selected = this.m._getSelectedItem();
        if (!selected) {
            this.m.deps.showNotification(getLabel('switcher.selectFirst'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
            return;
        }

        const cycleKey = selected.dataset.cycleKey;
        const currentState = this.m.deps.AppState?.get();
        const cycleData = currentState?.data?.cycles?.[cycleKey];
        if (!cycleData) return;

        const cycleName = cycleData.title || cycleKey;

        this.m.deps.showConfirmationModal({
            title: getLabel('switcher.downloadConfirmTitle'),
            message: getLabel('switcher.downloadConfirmMessage', { vars: { name: cycleName } }),
            confirmText: getLabel('routine.download'),
            cancelText: getLabel('button.cancel'),
            destructive: false,
            callback: (confirmed) => {
                if (!confirmed) return;
                const exportData = this._buildExportPayload(cycleKey, cycleData);
                if (typeof this.m.deps.exportMiniCycleData === 'function') {
                    this.m.deps.exportMiniCycleData(exportData, cycleName);
                }
            }
        });
    }

    /**
     * Build export payload from cycle data via the single shared builder
     * (drift-review D-02 — this used to be a third hand-rolled copy that had
     * silently dropped priorityColor AND autoUncheckDaily).
     *
     * includeHistory is true for now — this is the "download routine" path and
     * whether it should carry history (backup semantics) or strip it (share
     * semantics, like shareManager) is an open product decision. Flipping it
     * is a one-word change here.
     * @param {string} cycleKey - The cycle key/ID
     * @param {Object} cycle - The cycle data from AppState
     * @returns {Object} Export-ready data object
     * @private
     */
    _buildExportPayload(cycleKey, cycle) {
        return buildMcycPayload(cycleKey, cycle, { includeHistory: true });
    }

    /**
     * Duplicate the selected miniCycle and show it in inline edit mode
     */
    duplicateMiniCycle() {

        const selectedCycle = this.m._getSelectedItem();

        if (!selectedCycle) {
            console.warn('⚠️ No cycle selected for duplication');
            this.m.deps.showNotification(getLabel('notify.selectToDuplicate'), "info", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            return;
        }

        // ✅ Use state-based data access
        if (!this.m.deps.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for duplicateMiniCycle');
            this.m.deps.showNotification('⚠️ ' + getLabel('notify.appNotReady'), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const currentState = this.m.deps.AppState.get();
        if (!currentState) {
            console.error('❌ No state data available for duplicateMiniCycle');
            this.m.deps.showNotification('⚠️ ' + getLabel('notify.dataNotAvailable'), "error", UI_TIMEOUTS.NOTIFICATION_LONG);
            return;
        }

        const { data } = currentState;
        const cycles = data.cycles || {};
        const cycleKey = selectedCycle.dataset.cycleKey;
        const originalCycle = cycles[cycleKey];

        if (!cycleKey || !originalCycle) {
            console.error('❌ Invalid cycle selection:', { cycleKey, hasCycle: !!originalCycle });
            this.m.deps.showNotification('⚠️ ' + getLabel('notify.invalidCycleSelection'), "error", UI_TIMEOUTS.NOTIFICATION_BRIEF);
            return;
        }

        // ✅ Generate unique name for the copy
        const baseName = `${originalCycle.title} Copy`;
        const { name: uniqueName } = this.m.getUniqueCycleName(baseName, cycles);

        // ✅ Deep copy the cycle data
        const copiedCycle = structuredClone(originalCycle);
        copiedCycle.title = uniqueName;
        copiedCycle.createdAt = Date.now();
        delete copiedCycle.lastModified; // Show "Created" until actual changes are made
        copiedCycle.cycleCount = 0; // Reset cycle count for the copy

        // Fresh history for a fresh routine — the clone otherwise inherits the
        // original's full event log (cycle completions that never happened here).
        // clearedTasks entries reset too, but autoPrune is a preference and travels.
        delete copiedCycle.history;
        if (copiedCycle.clearedTasks && typeof copiedCycle.clearedTasks === 'object') {
            copiedCycle.clearedTasks = {
                ...copiedCycle.clearedTasks,
                entries: [],
                totalCleared: 0
            };
        }

        // ✅ Generate new IDs for all tasks to avoid conflicts — and remap
        // recurringTemplates in lockstep. The map is keyed by task id and each
        // template carries its task's id; leaving it un-remapped severed every
        // taskId↔template link in the copy (watcher spawned duplicates, deleting
        // a copied recurring task couldn't remove its template, template edits
        // never synced).
        if (Array.isArray(copiedCycle.tasks)) {
            const now = Date.now();
            const idRemap = new Map();
            copiedCycle.tasks = copiedCycle.tasks.map((task, index) => {
                const newId = `task-${now}-${index}-${Math.floor(Math.random() * 10000)}`; // Fix #74: add index to prevent collision
                if (task.id) idRemap.set(task.id, newId);
                return { ...task, id: newId };
            });

            if (copiedCycle.recurringTemplates && typeof copiedCycle.recurringTemplates === 'object') {
                copiedCycle.recurringTemplates = Object.fromEntries(
                    Object.entries(copiedCycle.recurringTemplates)
                        .filter(([, template]) => template && typeof template === 'object')
                        .map(([oldId, template], templateIndex) => {
                            // A template without a live task instance is normal
                            // (deleted instance pending recreation) — keep it,
                            // under a fresh id so the copy never shares ids with
                            // the original routine.
                            const newId = idRemap.get(oldId) || `task-${now}-t${templateIndex}-${Math.floor(Math.random() * 10000)}`;
                            return [newId, { ...template, id: newId }];
                        })
                );
            }
        }

        // ✅ Update through state system
        this.m.deps.AppState.update(state => {
            state.data.cycles[uniqueName] = copiedCycle;
            state.metadata.totalCyclesCreated = (state.metadata.totalCyclesCreated || 0) + 1;
        }, true); // immediate save

        // ✅ Update storage estimate (add duplicated routine size)
        const duplicatedSizeBytes = this.m.getObjectSizeBytes(copiedCycle);
        this.m.adjustStorageEstimate(duplicatedSizeBytes);
        const barElement = this.m.deps.getElementById(DOM_IDS.STORAGE_BAR_FILL);
        const textElement = this.m.deps.getElementById(DOM_IDS.STORAGE_BAR_TEXT);
        if (barElement && textElement) {
            this.m.updateStorageBarUIEstimated(barElement, textElement);
        }

        // ✅ Refresh the list and put the new item in inline edit mode
        this.m.loadMiniCycleList();

        // Wait for list to render, then find and edit the new item
        setTimeout(() => {
            const newItem = [...this.m.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM)]
                .find(item => item.dataset.cycleKey === uniqueName);

            if (newItem) {
                // Select the new item
                this.m.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM).forEach(item => item.classList.remove(DOM_CLASSES.SELECTED));
                newItem.classList.add(DOM_CLASSES.SELECTED);
                this.m._selectedCycleKey = newItem.dataset.cycleKey; // keep source of truth in sync

                // Show the switch items row
                const switchItemsRow = this.m.deps.getElementById(DOM_IDS.SWITCH_ITEMS_ROW);
                if (switchItemsRow) {
                    switchItemsRow.style.display = "flex";
                }

                // Update preview
                this.m.updatePreview(uniqueName);

                // ✅ Put the item in inline edit mode
                this._startInlineEdit(newItem, uniqueName);

            }
        }, 100);

        this.m.deps.showNotification('📋 ' + getLabel('notify.routineDuplicated', { vars: { name: uniqueName } }), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
    }

    /**
     * Start inline editing for a cycle item
     * @param {HTMLElement} listItem - The list item element
     * @param {string} cycleKey - The cycle key being edited
     */
    _startInlineEdit(listItem, cycleKey) {
        const titleSpan = listItem.querySelector(DOM_SELECTORS.CYCLE_ITEM_TITLE);
        if (!titleSpan) return;

        const currentName = titleSpan.textContent;

        // On touch devices, use a modal dialog instead of inline editing
        const isTouchDevice = this.m.deps.isTouchDevice;
        if (typeof isTouchDevice === 'function' && isTouchDevice()) {
            this._editRoutineModal(listItem, cycleKey, titleSpan, currentName);
            return;
        }

        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cycle-item-edit-input';
        input.value = currentName;
        input.setAttribute('aria-label', getLabel('accessibility.editRoutineName'));

        // Add focus overlay to dim the modal
        const dialog = this.m.deps.getElementById(DOM_IDS.ROUTINE_SWITCHER_MODAL);
        const overlay = document.createElement('div');
        overlay.className = DOM_CLASSES.EDIT_FOCUS_OVERLAY;
        if (dialog) {
            dialog.style.position = 'relative';
            dialog.appendChild(overlay);
        }
        listItem.classList.add(DOM_CLASSES.EDIT_FOCUS_TARGET);
        // Double rAF ensures browser registers initial opacity:0 before transitioning
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add(DOM_CLASSES.EDIT_FOCUS_ACTIVE)));

        // Replace title span with input
        titleSpan.style.display = 'none';
        titleSpan.parentNode.insertBefore(input, titleSpan.nextSibling);

        // Focus and select all text
        input.focus();
        input.select();

        // Handle blur (save on blur)
        const handleBlur = () => {
            const newValue = input.value;
            this._teardownInlineEdit(input, titleSpan);
            this._commitRename(cycleKey, newValue, currentName);
        };

        // Handle keydown (Enter to save, Escape to cancel)
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // Restore original name
                input.value = currentName;
                input.blur();
            }
        };

        input.addEventListener('blur', handleBlur, { once: true });
        input.addEventListener('keydown', handleKeydown);
    }

    /**
     * Mobile-only modal dialog for renaming routines.
     * Uses the same .miniCycle-prompt-dialog pattern as routine creation.
     *
     * @param {HTMLElement} listItem - The routine list item element
     * @param {string} cycleKey - The cycle key being renamed
     * @param {HTMLElement} titleSpan - The title span element
     * @param {string} currentName - Current routine name
     * @private
     */
    _editRoutineModal(listItem, cycleKey, titleSpan, currentName) {
        const editDialog = document.createElement('dialog');
        editDialog.className = 'miniCycle-prompt-dialog';
        editDialog.setAttribute('role', 'dialog');
        editDialog.setAttribute('aria-modal', 'true');

        const box = document.createElement('div');
        box.className = 'miniCycle-prompt-box';

        const titleEl = document.createElement('div');
        titleEl.className = 'miniCycle-prompt-title';
        titleEl.textContent = getLabel('switcher.renameRoutine');
        box.appendChild(titleEl);

        const messageEl = document.createElement('div');
        messageEl.className = 'miniCycle-prompt-message';
        messageEl.textContent = getLabel('switcher.renameRoutineMessage');
        box.appendChild(messageEl);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'miniCycle-prompt-input';
        input.value = currentName;
        input.setAttribute('aria-label', getLabel('accessibility.editRoutineName'));
        box.appendChild(input);

        const buttons = document.createElement('div');
        buttons.className = 'miniCycle-prompt-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'miniCycle-btn-cancel';
        cancelBtn.textContent = getLabel('button.cancel');

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'miniCycle-btn-confirm';
        saveBtn.textContent = getLabel('button.save');

        buttons.appendChild(cancelBtn);
        buttons.appendChild(saveBtn);
        box.appendChild(buttons);
        editDialog.appendChild(box);
        const body = this.m.deps.getBody?.() || document.body;
        body.appendChild(editDialog);

        // ── Event handlers ──
        const handleSave = () => {
            const value = input.value.trim();
            if (!value) {
                input.classList.add(DOM_CLASSES.MINICYCLE_INPUT_ERROR);
                input.focus();
                return;
            }
            cleanup();
            editDialog.close();
            editDialog.remove();
            this._commitRename(cycleKey, value, currentName);
        };

        const handleCancel = () => {
            cleanup();
            editDialog.close();
            editDialog.remove();
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
        };

        const handleDialogCancel = (e) => {
            e.preventDefault();
            handleCancel();
        };

        const handleBackdropClick = (e) => {
            if (e.target === editDialog) handleCancel();
        };

        // Wire listeners
        saveBtn.addEventListener('click', handleSave);
        cancelBtn.addEventListener('click', handleCancel);
        input.addEventListener('keydown', handleKeydown);
        editDialog.addEventListener('cancel', handleDialogCancel);
        editDialog.addEventListener('click', handleBackdropClick);

        const cleanup = () => {
            saveBtn.removeEventListener('click', handleSave);
            cancelBtn.removeEventListener('click', handleCancel);
            input.removeEventListener('keydown', handleKeydown);
            editDialog.removeEventListener('cancel', handleDialogCancel);
            editDialog.removeEventListener('click', handleBackdropClick);
        };

        editDialog.showModal();
        input.focus();
        input.select();
    }

    /**
     * Tear down inline edit UI (input, overlay, focus target class).
     * Called after inline edit completes or cancels. Not used for modal edit.
     * @param {HTMLInputElement} input - The inline input element
     * @param {HTMLElement} titleSpan - The title span to restore
     * @returns {void}
     * @private
     */
    _teardownInlineEdit(input, titleSpan) {
        input.remove();
        titleSpan.style.display = '';
        const listItem = titleSpan.closest(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM);
        if (listItem) listItem.classList.remove(DOM_CLASSES.EDIT_FOCUS_TARGET);
        const overlay = titleSpan.closest('dialog')?.querySelector(DOM_SELECTORS.EDIT_FOCUS_OVERLAY);
        if (overlay) {
            overlay.classList.remove(DOM_CLASSES.EDIT_FOCUS_ACTIVE);
            const removeOverlay = () => overlay.remove();
            overlay.addEventListener('transitionend', removeOverlay, { once: true });
            setTimeout(removeOverlay, UI_TIMEOUTS.EDIT_OVERLAY_REMOVE);
        }
    }

    /**
     * Commit a routine rename — validates, handles collisions, updates AppState,
     * refreshes the list, and notifies undo system.
     * Shared by both inline edit and modal edit paths.
     * @param {string} oldKey - The original cycle key
     * @param {string} rawNewName - The new name (will be sanitized)
     * @param {string} oldName - The original display name (for no-change detection)
     * @returns {void}
     * @private
     */
    _commitRename(oldKey, rawNewName, oldName) {
        const newName = this.m.deps.sanitizeInput(rawNewName.trim());

        // If name unchanged or empty, do nothing
        if (!newName || newName === oldName) {
            return;
        }

        // Get unique name if there's a collision (but not with self)
        const currentState = this.m.deps.AppState.get();
        const cycles = { ...currentState.data.cycles };
        delete cycles[oldKey];

        const { name: uniqueName, wasModified } = this.m.getUniqueCycleName(newName, cycles);

        if (wasModified) {
            this.m.deps.showNotification('⚠️ ' + getLabel('notify.nameExists', { vars: { name: uniqueName } }), "warning", UI_TIMEOUTS.NOTIFICATION_LONG);
        }

        // Update through state system
        this.m.deps.AppState.update(state => {
            const cycleData = state.data.cycles[oldKey];
            if (!cycleData) return;

            const updatedCycle = { ...cycleData, title: uniqueName };
            state.data.cycles[uniqueName] = updatedCycle;
            delete state.data.cycles[oldKey];

            if (state.appState.activeCycleId === oldKey) {
                state.appState.activeCycleId = uniqueName;
            }

        }, true);

        // Notify undo system of cycle rename
        if (typeof this.m.deps.onCycleRenamed === 'function') {
            // Promise.resolve(): the moduleLoader DI wrapper optional-chains its inner
            // call, so it yields undefined when the hook is unwired and `.catch` on
            // undefined throws here — inside a UI flow, after state already changed.
            Promise.resolve(this.m.deps.onCycleRenamed(oldKey, uniqueName)).catch(err => {
                console.warn('⚠️ Undo system cycle rename notification failed:', err);
            });
        }

        // Refresh the list and re-select
        this.m.loadMiniCycleList();
        setTimeout(() => {
            const renamedItem = [...this.m.deps.querySelectorAll(DOM_SELECTORS.MINI_CYCLE_SWITCH_ITEM)]
                .find(item => item.dataset.cycleKey === uniqueName);
            if (renamedItem) {
                renamedItem.classList.add(DOM_CLASSES.SELECTED);
                renamedItem.click();
            }
        }, 50);

        // Re-apply theme labels/colors in case the active routine was renamed
        this.m.deps.refreshThemeLabels?.();

        this.m.deps.showNotification('✅ ' + getLabel('notify.routineRenamed', { vars: { name: uniqueName } }), "success", UI_TIMEOUTS.NOTIFICATION_SHORT);
    }
}
