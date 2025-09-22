// ==========================================
// 🎯 REUSABLE CONFIRMATION MODAL TEMPLATE
// ==========================================

/**
 * Creates a customizable confirmation modal with callback support
 * 
 * @param {Object} options - Configuration options for the modal
 * @param {string} [options.title="Confirm Action"] - Modal title
 * @param {string} [options.message="Are you sure?"] - Modal message (supports HTML)
 * @param {string} [options.confirmText="Yes"] - Confirm button text
 * @param {string} [options.cancelText="Cancel"] - Cancel button text
 * @param {string} [options.icon=""] - Optional icon (emoji or HTML)
 * @param {string} [options.type="default"] - Modal type: "default", "danger", "warning", "info", "success"
 * @param {boolean} [options.allowOutsideClick=true] - Allow closing by clicking outside
 * @param {boolean} [options.showCloseButton=true] - Show X close button
 * @param {Function} [options.callback] - Callback function that receives boolean result
 * @param {Function} [options.onConfirm] - Optional separate confirm callback
 * @param {Function} [options.onCancel] - Optional separate cancel callback
 */
function showConfirmationModal(options = {}) {
    // ✅ Default configuration
    const config = {
        title: "Confirm Action",
        message: "Are you sure?",
        confirmText: "Yes",
        cancelText: "Cancel",
        icon: "",
        type: "default", // default, danger, warning, info, success
        allowOutsideClick: true,
        showCloseButton: true,
        callback: () => {},
        onConfirm: null,
        onCancel: null,
        ...options
    };

    // ✅ Create modal overlay
    const overlay = document.createElement("div");
    overlay.className = `confirmation-modal-overlay confirmation-modal-${config.type}`;
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(2px);
        opacity: 0;
        transition: opacity 0.2s ease;
    `;

    // ✅ Create modal content
    const modal = document.createElement("div");
    modal.className = "confirmation-modal-box";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("tabindex", "-1");
    
    // ✅ Type-based styling
    const typeStyles = {
        default: { border: "#333", confirm: "#007bff", cancel: "#6c757d" },
        danger: { border: "#dc3545", confirm: "#dc3545", cancel: "#6c757d" },
        warning: { border: "#ffc107", confirm: "#ffc107", cancel: "#6c757d" },
        info: { border: "#17a2b8", confirm: "#17a2b8", cancel: "#6c757d" },
        success: { border: "#28a745", confirm: "#28a745", cancel: "#6c757d" }
    };
    
    const colors = typeStyles[config.type] || typeStyles.default;
    
    modal.style.cssText = `
        background: var(--modal-bg, #1a1a1a);
        border: 2px solid ${colors.border};
        border-radius: 12px;
        padding: 0;
        color: var(--modal-text, #fff);
        min-width: 320px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        transform: scale(0.8);
        transition: transform 0.2s ease;
        overflow: hidden;
    `;

    // ✅ Create header
    const header = document.createElement("div");
    header.className = "confirmation-modal-header";
    header.style.cssText = `
        background: var(--modal-header-bg, #2a2a2a);
        padding: 16px 20px;
        border-bottom: 1px solid ${colors.border};
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: relative;
    `;
    
    const titleContent = document.createElement("div");
    titleContent.style.cssText = "display: flex; align-items: center; gap: 10px;";
    
    if (config.icon) {
        const iconSpan = document.createElement("span");
        iconSpan.innerHTML = config.icon;
        iconSpan.style.fontSize = "20px";
        titleContent.appendChild(iconSpan);
    }
    
    const titleText = document.createElement("h3");
    titleText.textContent = config.title;
    titleText.style.cssText = "margin: 0; font-size: 18px; font-weight: bold;";
    titleContent.appendChild(titleText);
    
    header.appendChild(titleContent);
    
    // ✅ Close button (if enabled)
    if (config.showCloseButton) {
        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "✖";
        closeBtn.className = "confirmation-modal-close";
        closeBtn.style.cssText = `
            background: transparent;
            border: none;
            color: #fff;
            font-size: 16px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background 0.2s;
        `;
        closeBtn.onmouseover = () => closeBtn.style.background = "rgba(255,255,255,0.1)";
        closeBtn.onmouseout = () => closeBtn.style.background = "transparent";
        header.appendChild(closeBtn);
    }

    // ✅ Create body
    const body = document.createElement("div");
    body.className = "confirmation-modal-body";
    body.innerHTML = config.message;
    body.style.cssText = `
        padding: 20px;
        line-height: 1.5;
        font-size: 14px;
    `;

    // ✅ Create footer with buttons
    const footer = document.createElement("div");
    footer.className = "confirmation-modal-footer";
    footer.style.cssText = `
        background: var(--modal-footer-bg, #2a2a2a);
        padding: 16px 20px;
        border-top: 1px solid ${colors.border};
        display: flex;
        gap: 12px;
        justify-content: flex-end;
    `;

    // ✅ Create buttons
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = config.confirmText;
    confirmBtn.className = "confirmation-modal-confirm";
    confirmBtn.style.cssText = `
        background: ${colors.confirm};
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
        min-width: 80px;
    `;
    confirmBtn.onmouseover = () => confirmBtn.style.opacity = "0.8";
    confirmBtn.onmouseout = () => confirmBtn.style.opacity = "1";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = config.cancelText;
    cancelBtn.className = "confirmation-modal-cancel";
    cancelBtn.style.cssText = `
        background: ${colors.cancel};
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 80px;
    `;
    cancelBtn.onmouseover = () => cancelBtn.style.opacity = "0.8";
    cancelBtn.onmouseout = () => cancelBtn.style.opacity = "1";

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    // ✅ Assemble modal
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ✅ Cleanup function
    const cleanup = () => {
        document.removeEventListener("keydown", handleKeydown);
        overlay.style.opacity = "0";
        modal.style.transform = "scale(0.8)";
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 200);
    };

    // ✅ Event handlers
    const handleConfirm = () => {
        cleanup();
        if (config.onConfirm) config.onConfirm();
        config.callback(true);
    };

    const handleCancel = () => {
        cleanup();
        if (config.onCancel) config.onCancel();
        config.callback(false);
    };

    const handleKeydown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleConfirm();
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancel();
        }
    };

    // ✅ Attach event listeners
    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);
    
    if (config.showCloseButton) {
        const closeBtn = header.querySelector(".confirmation-modal-close");
        closeBtn?.addEventListener("click", handleCancel);
    }
    
    if (config.allowOutsideClick) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        });
    }

    document.addEventListener("keydown", handleKeydown);

    // ✅ Show modal with animation
    setTimeout(() => {
        overlay.style.opacity = "1";
        modal.style.transform = "scale(1)";
        cancelBtn.focus(); // Focus cancel for safety
    }, 10);

    // ✅ Return modal reference for advanced usage
    return {
        overlay,
        modal,
        close: handleCancel,
        confirm: handleConfirm
    };
}

// ==========================================
// 📚 EASY-TO-USE PRESET FUNCTIONS
// ==========================================

/**
 * Quick delete confirmation
 */
function confirmDelete(itemName, callback) {
    return showConfirmationModal({
        title: "Delete Item",
        message: `Are you sure you want to delete "${itemName}"?<br><br>This action cannot be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
        icon: "🗑️",
        type: "danger",
        callback: callback
    });
}

/**
 * Quick save confirmation
 */
function confirmSave(callback) {
    return showConfirmationModal({
        title: "Save Changes",
        message: "Do you want to save your changes?",
        confirmText: "Save",
        cancelText: "Don't Save",
        icon: "💾",
        type: "info",
        callback: callback
    });
}

/**
 * Quick reset confirmation
 */
function confirmReset(callback) {
    return showConfirmationModal({
        title: "Reset Data",
        message: "⚠️ This will reset all data to default settings.<br><br>Are you sure you want to continue?",
        confirmText: "Reset",
        cancelText: "Cancel",
        icon: "🔄",
        type: "warning",
        callback: callback
    });
}

/**
 * Quick exit confirmation
 */
function confirmExit(callback) {
    return showConfirmationModal({
        title: "Exit Application",
        message: "Are you sure you want to exit?<br><br>Any unsaved changes will be lost.",
        confirmText: "Exit",
        cancelText: "Stay",
        icon: "🚪",
        type: "warning",
        callback: callback
    });
}

// ==========================================
// 📋 USAGE EXAMPLES
// ==========================================

/*
// ✅ Basic usage with callback
showConfirmationModal({
    title: "Delete Task",
    message: "Are you sure you want to delete this task?",
    confirmText: "Delete",
    cancelText: "Cancel",
    callback: (confirmed) => {
        if (confirmed) {
            console.log("User confirmed!");
            // Delete the task
        } else {
            console.log("User cancelled");
        }
    }
});

// ✅ Advanced usage with separate callbacks
showConfirmationModal({
    title: "Save Changes",
    message: "Do you want to save your changes before exiting?",
    confirmText: "Save & Exit",
    cancelText: "Exit Without Saving",
    icon: "💾",
    type: "info",
    onConfirm: () => {
        saveData();
        exitApp();
    },
    onCancel: () => {
        exitApp();
    }
});

// ✅ Using preset functions
confirmDelete("My Important Task", (confirmed) => {
    if (confirmed) {
        deleteTask();
    }
});

confirmReset(() => {
    resetAllData();
});

// ✅ Custom styling example
showConfirmationModal({
    title: "🎉 Congratulations!",
    message: "You've completed all tasks!<br><br>Would you like to start a new cycle?",
    confirmText: "Start New Cycle",
    cancelText: "Stay Here",
    type: "success",
    allowOutsideClick: false,
    callback: (confirmed) => {
        if (confirmed) {
            startNewCycle();
        }
    }
});

// ✅ Getting modal reference for advanced control
const modal = showConfirmationModal({
    title: "Processing...",
    message: "Please wait while we process your request.",
    confirmText: "OK",
    cancelText: "Cancel",
    callback: (confirmed) => {
        if (confirmed) {
            processRequest();
        }
    }
});

// Later, you can programmatically close it
// modal.close();
*/