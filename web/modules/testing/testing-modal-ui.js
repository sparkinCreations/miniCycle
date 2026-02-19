/**
 * Testing Modal UI - Drag, resize, and enhancements
 *
 * Provides UI interactions for the testing modal including dragging,
 * resizing the results area, keyboard shortcuts, and expanded view.
 *
 * @module testing-modal-ui
 */

import {
    getDeps,
    showNotification,
    safeAddEventListener,
    setupTestingTabs
} from './testing-modal-core.js';
import { DOM_IDS, DOM_SELECTORS } from '../core/constants.js';

// ==========================================
// RESULTS AREA RESIZE FUNCTIONALITY
// ==========================================

const MIN_RESULTS_HEIGHT = 80;

/**
 * Apply saved results area height when modal opens
 */
export function applyResultsAreaSavedHeight() {
    // Wait for modal CSS transitions to complete
    setTimeout(() => {
        const resultsArea = document.querySelector(DOM_SELECTORS.TESTING_RESULTS_AREA);
        const activeTabContent = document.querySelector(DOM_SELECTORS.TESTING_TAB_CONTENT_ACTIVE);
        const modalBody = document.querySelector(DOM_SELECTORS.TESTING_MODAL_BODY);

        if (!resultsArea || !modalBody) return;

        const savedHeight = loadResultsAreaHeight();
        const modalBodyHeight = modalBody.getBoundingClientRect().height;
        const maxAllowedResultsHeight = modalBodyHeight;

        if (savedHeight && savedHeight >= MIN_RESULTS_HEIGHT && savedHeight <= maxAllowedResultsHeight) {
            resultsArea.style.height = `${savedHeight}px`;
            resultsArea.style.minHeight = `${savedHeight}px`;
            resultsArea.style.maxHeight = `${savedHeight}px`;
            resultsArea.style.flex = 'none';

            if (activeTabContent) {
                const availableHeight = modalBodyHeight - savedHeight - 50;
                activeTabContent.style.height = `${availableHeight}px`;
                activeTabContent.style.maxHeight = `${availableHeight}px`;
                activeTabContent.style.overflow = 'auto';
            }
        } else {
            resultsArea.style.height = '';
            resultsArea.style.minHeight = '';
            resultsArea.style.maxHeight = '';
            resultsArea.style.flex = '';

            if (activeTabContent) {
                activeTabContent.style.height = '';
                activeTabContent.style.maxHeight = '';
                activeTabContent.style.overflow = '';
            }
        }
    }, 100);
}

/**
 * Load saved height from AppState
 * @returns {number|null} Saved height or null
 */
function loadResultsAreaHeight() {
    try {
        const deps = getDeps();
        const appState = deps.AppState?.get?.();
        return appState?.settings?.testingModalResultsHeight || null;
    } catch (e) {
        return null;
    }
}

/**
 * Save height to AppState
 * @param {number} height - Height to save
 */
function saveResultsAreaHeight(height) {
    try {
        const deps = getDeps();
        if (deps.AppState?.update) {
            deps.AppState.update(state => {
                state.settings = state.settings || {};
                state.settings.testingModalResultsHeight = height;
            });
        }
    } catch (e) {
        console.warn('Could not save results height:', e);
    }
}

/**
 * Setup results area resize functionality
 */
export function setupResultsAreaResize() {
    const resultsHeader = document.querySelector(DOM_SELECTORS.TESTING_RESULTS_HEADER);
    const resultsArea = document.querySelector(DOM_SELECTORS.TESTING_RESULTS_AREA);
    const modalBody = document.querySelector(DOM_SELECTORS.TESTING_MODAL_BODY);

    if (!resultsHeader || !resultsArea || !modalBody) {
        return;
    }

    // Prevent duplicate initialization
    if (resultsHeader.dataset.resizeInitialized) {
        applyResultsAreaSavedHeight();
        return;
    }
    resultsHeader.dataset.resizeInitialized = 'true';

    let isResizing = false;
    let startY = 0;
    let startResultsHeight = 0;
    let startContentHeight = 0;
    const minContentHeight = 60;

    function getHeight(el) {
        return el.getBoundingClientRect().height || el.offsetHeight;
    }

    function getActiveTabContent() {
        return document.querySelector(DOM_SELECTORS.TESTING_TAB_CONTENT_ACTIVE);
    }

    function getEventY(e) {
        if (e.touches && e.touches.length > 0) {
            return e.touches[0].clientY;
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
            return e.changedTouches[0].clientY;
        }
        return e.clientY;
    }

    function startResize(e) {
        const target = e.target;
        if (target.tagName === 'BUTTON' || target.closest('button') || target.closest('.testing-results-controls')) {
            return;
        }

        const activeTabContent = getActiveTabContent();
        if (!activeTabContent) return;

        const clientY = getEventY(e);
        if (clientY === undefined) return;

        startResultsHeight = getHeight(resultsArea);
        startContentHeight = getHeight(activeTabContent);

        if (startResultsHeight < MIN_RESULTS_HEIGHT) startResultsHeight = 250;
        if (startContentHeight < minContentHeight) startContentHeight = 300;

        isResizing = true;
        startY = clientY;

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';

        resultsArea.style.height = `${startResultsHeight}px`;
        resultsArea.style.minHeight = `${startResultsHeight}px`;
        resultsArea.style.maxHeight = `${startResultsHeight}px`;
        resultsArea.style.flex = 'none';

        activeTabContent.style.height = `${startContentHeight}px`;
        activeTabContent.style.maxHeight = `${startContentHeight}px`;
        activeTabContent.style.overflow = 'auto';

        e.preventDefault();
    }

    function doResize(e) {
        if (!isResizing) return;

        const activeTabContent = getActiveTabContent();
        if (!activeTabContent) return;

        const clientY = getEventY(e);
        if (clientY === undefined) return;

        const deltaY = startY - clientY;

        let newResultsHeight = startResultsHeight + deltaY;
        let newContentHeight = startContentHeight - deltaY;

        if (newResultsHeight < MIN_RESULTS_HEIGHT) {
            newResultsHeight = MIN_RESULTS_HEIGHT;
            newContentHeight = startContentHeight + startResultsHeight - MIN_RESULTS_HEIGHT;
        }
        if (newContentHeight < minContentHeight) {
            newContentHeight = minContentHeight;
            newResultsHeight = startContentHeight + startResultsHeight - minContentHeight;
        }

        resultsArea.style.height = `${newResultsHeight}px`;
        resultsArea.style.minHeight = `${newResultsHeight}px`;
        resultsArea.style.maxHeight = `${newResultsHeight}px`;

        activeTabContent.style.height = `${newContentHeight}px`;
        activeTabContent.style.maxHeight = `${newContentHeight}px`;
    }

    function stopResize() {
        if (!isResizing) return;
        isResizing = false;

        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        const currentHeight = getHeight(resultsArea);
        if (currentHeight >= MIN_RESULTS_HEIGHT) {
            saveResultsAreaHeight(Math.round(currentHeight));
        }
    }

    // Mouse events
    resultsHeader.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);

    // Touch events
    resultsHeader.addEventListener('touchstart', startResize, { passive: false });
    document.addEventListener('touchmove', doResize, { passive: false });
    document.addEventListener('touchend', stopResize, { passive: true });

    applyResultsAreaSavedHeight();
}

// ==========================================
// TESTING MODAL DRAG FUNCTIONALITY
// ==========================================

/**
 * Initialize drag functionality for testing modal
 */
export function initTestingModalDrag() {
    const deps = getDeps();
    const testingModal = deps.getModal('testing');
    if (!testingModal) return;

    const modalContent = testingModal.querySelector(DOM_SELECTORS.TESTING_MODAL_CONTENT);
    if (!modalContent) {
        console.warn("Testing modal content not found for dragging");
        return;
    }

    let dragHandle = modalContent.querySelector(`${DOM_SELECTORS.TESTING_MODAL_HEADER}, ${DOM_SELECTORS.TESTING_MODAL_DRAG_HANDLE}`);
    if (!dragHandle) {
        dragHandle = modalContent.querySelector(`h2, .testing-tabs, ${DOM_SELECTORS.CLOSE_TESTING_MODAL}`)?.closest("div");
        if (!dragHandle) {
            dragHandle = document.createElement("div");
            dragHandle.className = "testing-modal-drag-handle";
            dragHandle.innerHTML = ':: Drag to Move ::';
            modalContent.style.position = "relative";
            modalContent.appendChild(dragHandle);
        }
    }

    makeTestingModalDraggable(modalContent, dragHandle);
}

/**
 * Make the testing modal draggable
 * @param {Element} modalContent - Modal content element
 * @param {Element} dragHandle - Drag handle element
 */
function makeTestingModalDraggable(modalContent, dragHandle) {
    let isDragging = false;
    let offsetX, offsetY;
    let hasMoved = false;

    if (!modalContent.style.position || modalContent.style.position === "static") {
        modalContent.style.position = "fixed";
    }

    dragHandle.removeEventListener("mousedown", startDrag);
    dragHandle.addEventListener("mousedown", startDrag);

    function startDrag(e) {
        if (e.target.closest("button, input, select, textarea")) {
            return;
        }

        isDragging = true;
        hasMoved = false;

        const rect = modalContent.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        modalContent.style.zIndex = "10001";
        modalContent.style.boxShadow = "0 25px 50px rgba(0, 0, 0, 0.5)";
        modalContent.style.transform = "scale(1.02)";
        dragHandle.classList.add("dragging");

        e.preventDefault();
        e.stopPropagation();
    }

    function handleMouseMove(e) {
        if (!isDragging) return;

        hasMoved = true;

        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        const modalRect = modalContent.getBoundingClientRect();
        const margin = 20;
        const maxX = window.innerWidth - modalRect.width - margin;
        const maxY = window.innerHeight - modalRect.height - margin;

        newX = Math.max(margin, Math.min(newX, maxX));
        newY = Math.max(margin, Math.min(newY, maxY));

        modalContent.style.left = `${newX}px`;
        modalContent.style.top = `${newY}px`;
        modalContent.style.right = "auto";
        modalContent.style.bottom = "auto";
        modalContent.style.margin = "0";
    }

    function stopDrag() {
        if (isDragging) {
            isDragging = false;

            modalContent.style.zIndex = "9999";
            modalContent.style.boxShadow = "";
            modalContent.style.transform = "scale(1)";
            dragHandle.classList.remove("dragging");

            if (hasMoved) {
                showNotification("Testing modal repositioned", "info", 1500);
            }
        }
    }

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopDrag);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopDrag);

    function handleResize() {
        if (modalContent.style.position === "fixed") {
            const rect = modalContent.getBoundingClientRect();
            const margin = 20;
            const maxX = window.innerWidth - rect.width - margin;
            const maxY = window.innerHeight - rect.height - margin;

            if (rect.left > maxX || rect.top > maxY) {
                const newX = Math.min(rect.left, maxX);
                const newY = Math.min(rect.top, maxY);

                modalContent.style.left = `${Math.max(margin, newX)}px`;
                modalContent.style.top = `${Math.max(margin, newY)}px`;
            }
        }
    }

    window.removeEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
}

/**
 * Add double-click to center modal functionality
 */
export function addTestingModalDoubleClickToCenter() {
    const deps = getDeps();
    const testingModal = deps.getModal('testing');
    const modalContent = testingModal?.querySelector(DOM_SELECTORS.TESTING_MODAL_CONTENT);
    const dragHandle = modalContent?.querySelector(`${DOM_SELECTORS.TESTING_MODAL_DRAG_HANDLE}, ${DOM_SELECTORS.TESTING_MODAL_HEADER}`);

    if (dragHandle) {
        dragHandle.addEventListener("dblclick", () => {
            const rect = modalContent.getBoundingClientRect();
            const centerX = (window.innerWidth - rect.width) / 2;
            const centerY = (window.innerHeight - rect.height) / 2;

            const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            const duration = reducedMotion ? '0ms' : '0.3s';
            modalContent.style.transition = `left ${duration} ease, top ${duration} ease`;
            modalContent.style.left = `${centerX}px`;
            modalContent.style.top = `${centerY}px`;
            modalContent.style.right = "auto";
            modalContent.style.bottom = "auto";
            modalContent.style.margin = "0";

            setTimeout(() => {
                modalContent.style.transition = "";
            }, 300);

            showNotification("Testing modal centered", "info", 1500);
        });

        dragHandle.title = "Double-click to center modal";
    }
}

// ==========================================
// TEST RESULTS ENHANCEMENTS
// ==========================================

/**
 * Setup test results enhancements (double-click to expand)
 */
export function setupTestResultsEnhancements() {
    const testingOutput = document.getElementById(DOM_IDS.TESTING_OUTPUT);
    if (!testingOutput) return;

    testingOutput.addEventListener("dblclick", () => {
        openTestResultsInModal();
    });

    testingOutput.title = "Double-click to open in expanded view";
    testingOutput.style.cursor = "pointer";
}

/**
 * Open test results in expanded modal view
 */
export function openTestResultsInModal() {
    const testingOutput = document.getElementById(DOM_IDS.TESTING_OUTPUT);
    if (!testingOutput || !testingOutput.textContent.trim()) {
        showNotification("No test results to display", "warning", 2000);
        return;
    }

    const content = testingOutput.textContent;
    const timestamp = new Date().toLocaleString();

    // Create modal overlay as <dialog> for top-layer stacking above testing modal
    const modalOverlay = document.createElement("dialog");
    modalOverlay.id = "test-results-modal";
    modalOverlay.className = "test-results-overlay";

    // Create modal content
    const modalContent = document.createElement("div");
    modalContent.className = "test-results-content";

    // Header
    const header = document.createElement("div");
    header.className = "test-results-header";

    header.innerHTML = `
        <div>
            <h2 class="test-results-title">Test Results - Expanded View</h2>
            <p class="test-results-timestamp">Generated: ${timestamp}</p>
        </div>
        <button id="close-results-modal" class="test-results-close-btn">Close</button>
    `;

    // Controls bar
    const controlsBar = document.createElement("div");
    controlsBar.className = "test-results-controls";

    const controls = [
        { id: "copy-results", text: "Copy", class: "success" },
        { id: "save-results", text: "Save as File", class: "primary" },
        { id: "print-results", text: "Print", class: "primary" },
        { id: "clear-selection", text: "Clear Selection", class: "secondary" },
        { id: "search-results", text: "Find", class: "info" }
    ];

    controls.forEach(control => {
        const btn = document.createElement("button");
        btn.id = control.id;
        btn.textContent = control.text;
        btn.className = `test-results-btn ${control.class}`;
        controlsBar.appendChild(btn);
    });

    // Search bar
    const searchBar = document.createElement("div");
    searchBar.id = "search-bar";
    searchBar.className = "test-results-search-bar";
    searchBar.innerHTML = `
        <input type="text" id="search-input" name="search-input" placeholder="Search in results..." class="test-results-search-input">
        <div class="test-results-search-info" id="search-info"></div>
    `;

    // Results area
    const resultsArea = document.createElement("div");
    resultsArea.className = "test-results-body";
    resultsArea.textContent = content;
    resultsArea.id = "modal-results-content";

    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(controlsBar);
    modalContent.appendChild(searchBar);
    modalContent.appendChild(resultsArea);
    modalOverlay.appendChild(modalContent);

    const closeResultsModal = () => {
        if (modalOverlay.open) modalOverlay.close();
        modalOverlay.remove();
    };

    // Event listeners
    const closeBtn = modalOverlay.querySelector("#close-results-modal");
    closeBtn.addEventListener("click", closeResultsModal);

    modalOverlay.querySelector("#copy-results").addEventListener("click", () => {
        navigator.clipboard.writeText(content).then(() => {
            showNotification("Results copied to clipboard!", "success", 2000);
        });
    });

    modalOverlay.querySelector("#save-results").addEventListener("click", () => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `minicycle-test-results-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification("Results saved to downloads", "success", 2000);
    });

    modalOverlay.querySelector("#print-results").addEventListener("click", () => {
        const printWindow = window.open('', '_blank');
        const doc = printWindow.document;
        doc.open();
        const html = doc.createElement('html');
        const head = doc.createElement('head');
        const title = doc.createElement('title');
        title.textContent = 'miniCycle Test Results';
        head.appendChild(title);
        html.appendChild(head);
        const body = doc.createElement('body');
        const pre = doc.createElement('pre');
        pre.style.cssText = 'font-family: monospace; white-space: pre-wrap;';
        pre.textContent = content;
        body.appendChild(pre);
        html.appendChild(body);
        doc.appendChild(html);
        doc.close();
        printWindow.print();
    });

    modalOverlay.querySelector("#search-results").addEventListener("click", () => {
        const searchBarEl = modalOverlay.querySelector("#search-bar");
        const isVisible = searchBarEl.style.display === "block";
        searchBarEl.style.display = isVisible ? "none" : "block";
        if (!isVisible) {
            modalOverlay.querySelector("#search-input").focus();
        }
    });

    modalOverlay.querySelector("#clear-selection").addEventListener("click", () => {
        window.getSelection().removeAllRanges();
        showNotification("Text selection cleared", "info", 1500);
    });

    // Search functionality
    const searchInput = modalOverlay.querySelector("#search-input");
    const searchInfo = modalOverlay.querySelector("#search-info");

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const resultsEl = modalOverlay.querySelector("#modal-results-content");

        if (!query) {
            resultsEl.textContent = content;
            searchInfo.textContent = "";
            return;
        }

        const lines = content.split('\n');
        let matchingLines = 0;
        const highlighted = lines.map(line => {
            if (line.toLowerCase().includes(query)) {
                matchingLines++;
                return `> ${line}`;
            }
            return line;
        }).join('\n');

        resultsEl.textContent = highlighted;
        searchInfo.textContent = `Found ${matchingLines} matching lines`;
    });

    // Keyboard shortcuts
    modalOverlay.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case "f":
                    e.preventDefault();
                    modalOverlay.querySelector("#search-results").click();
                    break;
                case "c":
                    e.preventDefault();
                    modalOverlay.querySelector("#copy-results").click();
                    break;
                case "s":
                    e.preventDefault();
                    modalOverlay.querySelector("#save-results").click();
                    break;
                case "p":
                    e.preventDefault();
                    modalOverlay.querySelector("#print-results").click();
                    break;
            }
        }
    });

    // ESC key via native dialog cancel event
    modalOverlay.addEventListener("cancel", (e) => {
        e.preventDefault();
        closeResultsModal();
    });

    // Close on backdrop click
    modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
            closeResultsModal();
        }
    });

    document.body.appendChild(modalOverlay);
    modalOverlay.showModal();
    showNotification("Test results opened in expanded view", "success", 2000);
}

/**
 * Add hint for double-click functionality
 */
export function addTestResultsHint() {
    const testingOutput = document.getElementById(DOM_IDS.TESTING_OUTPUT);
    if (!testingOutput) return;

    const hint = document.createElement("div");
    hint.className = "test-results-hint";
    hint.innerHTML = `
        <small>Tip: Double-click results to open in expanded view</small>
    `;

    testingOutput.parentNode.insertBefore(hint, testingOutput.nextSibling);
}

// ==========================================
// INITIALIZE ENHANCEMENTS
// ==========================================

/**
 * Initialize all testing modal enhancements
 * @param {Object} callbacks - Callback functions from main module
 * @param {Function} callbacks.setupTestButtons - Button setup function
 * @param {Function} callbacks.setupResultsControls - Results controls setup function
 */
export function initTestingModalEnhancements(callbacks = {}) {
    setupTestingTabs();
    setupTestResultsEnhancements();
    addTestResultsHint();

    // Keyboard shortcut: Ctrl+J / Cmd+J
    safeAddEventListener(document, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
            e.preventDefault();
            const testingModal = getDeps().getModal('testing');

            if (testingModal) {
                if (testingModal.open) {
                    testingModal.close();
                    testingModal._previousFocus?.focus({ focusVisible: false });
                    showNotification("Testing panel closed", "info", 1500);
                } else {
                    testingModal._previousFocus = document.activeElement;
                    testingModal.showModal();
                    initTestingModalDrag();
                    showNotification("Testing panel opened", "success", 2000);

                    setTimeout(() => {
                        setupTestingTabs();
                        if (callbacks.setupTestButtons) callbacks.setupTestButtons();
                        if (callbacks.setupResultsControls) callbacks.setupResultsControls();
                    }, 150);
                }
            } else {
                console.warn("Testing modal not found");
                showNotification("Testing panel not available", "error", 2000);
            }
        }
    });

    setTimeout(() => {
        addTestingModalDoubleClickToCenter();
    }, 100);
}

console.log('Testing Modal UI loaded (DI-pure)');
