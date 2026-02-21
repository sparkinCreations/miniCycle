/**
 * Testing Modal Storage Viewer - Interactive localStorage inspector
 *
 * Provides a draggable, resizable modal for viewing localStorage contents
 * with expandable JSON rendering.
 *
 * @module testing-modal-storage-viewer
 */

import {
    getDeps,
    safeAddEventListenerById
} from './testing-modal-core.js';
import { DOM_IDS, DOM_SELECTORS, Z_INDEX } from '../core/constants.js';

// ==========================================
// BUTTON SETUP
// ==========================================

/**
 * Setup storage viewer button event listener
 */
export function setupStorageViewerButton() {
    safeAddEventListenerById("view-local-storage-btn", "click", () => {
        openStorageViewer();
    });
}

// ==========================================
// STORAGE VIEWER FUNCTIONS
// ==========================================

let handleOutsideClickRef = null;

/**
 * Open the storage viewer modal
 */
export function openStorageViewer() {
    const deps = getDeps();
    const overlay = deps.getModal('storageViewer');
    const contentEl = document.getElementById(DOM_IDS.STORAGE_CONTENT);

    if (!overlay || !contentEl) {
        console.error("Storage viewer elements not found");
        return;
    }

    contentEl.innerHTML = "";

    if (localStorage.length === 0) {
        contentEl.innerHTML = `
            <div class="storage-empty-state">
                No data found in localStorage
            </div>
        `;
    } else {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            const rawValue = deps.safeLocalStorageGet(key, null);
            if (rawValue === null) continue;

            const wrapper = document.createElement("div");
            wrapper.className = "storage-key";

            const keyHeader = document.createElement("div");
            keyHeader.className = "storage-key-header";

            const keyToggle = document.createElement("button");
            keyToggle.textContent = "[+]";
            keyToggle.className = "storage-key-toggle";

            const keyTitle = document.createElement("div");
            keyTitle.className = "storage-key-title";
            keyTitle.textContent = key;

            const sizeIndicator = document.createElement("small");
            const sizeKB = (rawValue.length / 1024).toFixed(2);
            sizeIndicator.textContent = `(${sizeKB} KB)`;
            sizeIndicator.className = "storage-key-size";

            keyHeader.appendChild(keyToggle);
            keyHeader.appendChild(keyTitle);
            keyHeader.appendChild(sizeIndicator);

            const valueContainer = document.createElement("div");
            valueContainer.className = "storage-value-container";
            valueContainer.style.display = "none";

            let valueEl;
            const parsed = deps.safeJSONParse(rawValue, null, true);
            if (parsed !== null && typeof parsed === "object") {
                valueEl = renderExpandableJSON(parsed, deps);
            } else if (parsed !== null) {
                valueEl = document.createElement("pre");
                valueEl.textContent = String(parsed);
                valueEl.className = "storage-value-parsed";
            } else {
                valueEl = document.createElement("pre");
                valueEl.textContent = rawValue;
                valueEl.className = "storage-value-raw";
            }

            valueContainer.appendChild(valueEl);

            keyToggle.addEventListener("click", (e) => {
                e.stopPropagation();
                const isVisible = valueContainer.style.display === "block";

                valueContainer.style.display = isVisible ? "none" : "block";
                keyToggle.textContent = isVisible ? "[+]" : "[-]";
                keyToggle.classList.toggle("open", !isVisible);

                if (!isVisible) {
                    valueContainer.style.opacity = "0";
                    valueContainer.style.maxHeight = "0";
                    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                    const expandDuration = reducedMotion ? '0ms' : '0.3s';
                    setTimeout(() => {
                        valueContainer.style.opacity = "1";
                        valueContainer.style.maxHeight = "none";
                        valueContainer.style.transition = `opacity ${expandDuration} ease`;
                    }, 50);
                }
            });

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

    if (!overlay.open) {
        overlay._previousFocus = document.activeElement;
        overlay.showModal();
    }
    initializeStorageModal();
    setupStorageViewerEventListeners();
}

/**
 * Initialize storage modal drag and resize
 */
function initializeStorageModal() {
    const modal = document.querySelector(DOM_SELECTORS.STORAGE_MODAL_BOX);
    if (!modal) return;

    if (!modal.dataset.initialized) {
        makeStorageModalDraggable();
        makeStorageModalResizable();
        modal.dataset.initialized = "true";
    }
}

/**
 * Setup event listeners for storage viewer
 */
function setupStorageViewerEventListeners() {
    if (handleOutsideClickRef) {
        document.removeEventListener("click", handleOutsideClickRef);
    }

    handleOutsideClickRef = handleOutsideClick;

    setTimeout(() => {
        document.addEventListener("click", handleOutsideClickRef);
    }, 100);
}

/**
 * Handle click outside modal to close
 */
function handleOutsideClick(event) {
    const overlay = getDeps().getModal('storageViewer');
    const stayOpenCheckbox = document.getElementById(DOM_IDS.STAY_OPEN_TOGGLE);
    const modalBox = document.querySelector(DOM_SELECTORS.STORAGE_MODAL_BOX);

    if (!overlay || !overlay.open) return;

    const stayOpenChecked = stayOpenCheckbox ? stayOpenCheckbox.checked : false;

    if (!stayOpenChecked && modalBox && !modalBox.contains(event.target)) {
        closeStorageViewer();
    }
}

/**
 * Make storage modal draggable
 */
function makeStorageModalDraggable() {
    const modal = document.querySelector(DOM_SELECTORS.STORAGE_MODAL_BOX);
    const header = modal?.querySelector(".storage-modal-header");

    if (!modal || !header) return;

    let isDragging = false;
    let offsetX, offsetY;

    header.style.cursor = "move";
    header.style.userSelect = "none";

    function startDrag(e) {
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        modal.style.position = "fixed";
        modal.style.zIndex = Z_INDEX.OVERLAY_CRITICAL;
        e.preventDefault();
    }

    function handleDrag(e) {
        if (!isDragging) return;

        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

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

    header.removeEventListener("mousedown", startDrag);
    header.addEventListener("mousedown", startDrag);

    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", stopDrag);
}

/**
 * Make storage modal resizable
 */
function makeStorageModalResizable() {
    const modal = document.querySelector(DOM_SELECTORS.STORAGE_MODAL_BOX);
    if (!modal) return;

    let isResizing = false;
    const minWidth = 300;
    const minHeight = 200;

    function startResize(e) {
        const rect = modal.getBoundingClientRect();
        if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) {
            isResizing = true;
            e.preventDefault();
            e.stopPropagation();
        }
    }

    function handleResize(e) {
        if (!isResizing) return;

        const rect = modal.getBoundingClientRect();
        let newWidth = e.clientX - rect.left;
        let newHeight = e.clientY - rect.top;

        newWidth = Math.max(minWidth, newWidth);
        newHeight = Math.max(minHeight, newHeight);

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

    modal.removeEventListener("mousedown", startResize);
    modal.addEventListener("mousedown", startResize);

    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResize);
}

/**
 * Render expandable JSON tree
 */
function renderExpandableJSON(data, deps, depth = 0) {
    const container = document.createElement("div");
    container.className = "json-container";

    if (depth > 10) {
        container.textContent = "[Maximum depth exceeded]";
        container.className = "json-container json-depth-exceeded";
        return container;
    }

    try {
        if (Array.isArray(data)) {
            const arrayInfo = document.createElement("div");
            arrayInfo.className = "json-array-info";
            arrayInfo.textContent = `Array (${data.length} items)`;
            container.appendChild(arrayInfo);
        }

        for (const [key, value] of Object.entries(data)) {
            const entry = document.createElement("div");
            entry.className = "json-entry";

            const label = document.createElement("span");
            label.className = "json-key";
            label.textContent = `"${key}": `;

            const valueEl = document.createElement("span");

            if (typeof value === "object" && value !== null) {
                const toggle = document.createElement("button");
                toggle.textContent = "[+]";
                toggle.className = "json-toggle";

                const child = renderExpandableJSON(value, deps, depth + 1);
                child.style.display = "none";

                toggle.onclick = (e) => {
                    try {
                        e.stopPropagation();
                        const visible = child.style.display === "block";
                        child.style.display = visible ? "none" : "block";
                        toggle.textContent = visible ? "[+]" : "[-]";
                        toggle.classList.toggle("open", !visible);
                    } catch (error) {
                        console.error("Toggle error:", error);
                    }
                };

                valueEl.appendChild(toggle);

                const typeInfo = Array.isArray(value) ?
                    `Array[${value.length}]` :
                    `Object{${Object.keys(value).length}}`;
                valueEl.appendChild(document.createTextNode(typeInfo));

                entry.appendChild(label);
                entry.appendChild(valueEl);
                entry.appendChild(child);
            } else {
                const valueText = deps.safeJSONStringify(value, String(value));
                valueEl.textContent = valueText;

                if (typeof value === "string") {
                    valueEl.className = "json-value-string";
                } else if (typeof value === "number") {
                    valueEl.className = "json-value-number";
                } else if (typeof value === "boolean") {
                    valueEl.className = "json-value-boolean";
                } else if (value === null) {
                    valueEl.className = "json-value-null";
                }

                entry.appendChild(label);
                entry.appendChild(valueEl);
            }

            container.appendChild(entry);
        }
    } catch (error) {
        const errorEl = document.createElement("div");
        errorEl.className = "json-render-error";
        errorEl.textContent = `Error rendering object: ${error.message}`;
        container.appendChild(errorEl);
    }

    return container;
}

/**
 * Close the storage viewer modal
 */
export function closeStorageViewer() {
    const overlay = getDeps().getModal('storageViewer');
    if (overlay) {
        if (overlay.open) overlay.close();
        overlay._previousFocus?.focus({ focusVisible: false });

        if (handleOutsideClickRef) {
            document.removeEventListener("click", handleOutsideClickRef);
        }

        const modal = document.querySelector(DOM_SELECTORS.STORAGE_MODAL_BOX);
        if (modal) {
            modal.style.position = "relative";
            modal.style.left = "0";
            modal.style.top = "0";
            modal.style.width = "";
            modal.style.height = "";
        }
    }
}

console.log('Testing Modal Storage Viewer loaded (DI-pure)');
