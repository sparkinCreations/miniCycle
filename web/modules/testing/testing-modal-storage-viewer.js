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
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';

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
            <div style="text-align: center; padding: 40px; color: #666; font-style: italic;">
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
                valueEl.style.cssText = "background: #f8f9fa; padding: 8px; border-radius: 4px; font-size: 12px; overflow-x: auto; word-wrap: break-word;";
            } else {
                valueEl = document.createElement("pre");
                valueEl.textContent = rawValue;
                valueEl.style.cssText = "background: #e8f4f8; padding: 8px; border-radius: 4px; font-size: 12px; overflow-x: auto; word-wrap: break-word; border-left: 4px solid #17a2b8; color: #0c5460;";
            }

            valueContainer.appendChild(valueEl);

            keyToggle.addEventListener("click", (e) => {
                e.stopPropagation();
                const isVisible = valueContainer.style.display === "block";

                valueContainer.style.display = isVisible ? "none" : "block";
                keyToggle.textContent = isVisible ? "[+]" : "[-]";
                keyToggle.style.backgroundColor = isVisible ? "#28a745" : "#dc3545";

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

    overlay.classList.remove("hidden");
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

    if (!overlay || overlay.classList.contains("hidden")) return;

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
        modal.style.zIndex = 9999;
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
        container.style.color = "#999";
        container.style.fontStyle = "italic";
        return container;
    }

    try {
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

                const child = renderExpandableJSON(value, deps, depth + 1);
                child.style.display = "none";

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
        const errorEl = document.createElement("div");
        errorEl.style.cssText = "color: #dc3545; font-style: italic; padding: 8px; background: #f8d7da; border-radius: 4px; margin: 4px 0;";
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
        overlay.classList.add("hidden");

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
