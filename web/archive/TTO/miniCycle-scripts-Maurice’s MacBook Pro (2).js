//Mini Cycle
let draggedTask = null;
let logoTimeoutId = null;
let touchStartTime = 0;
let isLongPress = false;
let touchStartY = 0;
let touchEndY = 0;
let holdTimeout = null;
let moved = false;
let isDragging = false;
let rearrangeInitialized = false;
let lastDraggedOver = null;
let lastRearrangeTarget = null;
let lastDragOverTime = 0;




document.addEventListener('DOMContentLoaded', (event) => {
 


const taskInput = document.getElementById("taskInput");
const addTaskButton = document.getElementById("addTask");
const taskList = document.getElementById("taskList");
const cycleMessage = document.getElementById("cycleMessage");
const progressBar = document.getElementById("progressBar");
const completeAllButton = document.getElementById("completeAll");
const toggleAutoReset = document.getElementById("toggleAutoReset");
const menuButton = document.querySelector(".menu-button");
const menu = document.querySelector(".menu-container");
const exitMiniCycle = document.getElementById("exit-mini-cycle");
const feedbackModal = document.getElementById("feedback-modal");
const openFeedbackBtn = document.getElementById("open-feedback-modal");
const closeFeedbackBtn = document.querySelector(".close-feedback-modal");
const submitFeedbackBtn = document.getElementById("submit-feedback");
const feedbackText = document.getElementById("feedback-text");
const openUserManual = document.getElementById("open-user-manual");
const DRAG_THROTTLE_MS = 50;
const TASK_LIMIT = 50; 




// Run functions on page load
initialSetup();
setupAbout();
setupSettingsMenu();
setupUserManual();
setupFeedbackModal();
updateStatsPanel(); 
loadMiniCycle();
setupDownloadMiniCycle();
setupUploadMiniCycle();
setupRearrange();
dragEndCleanup ();
updateMoveArrowsVisibility();
window.onload = () => taskInput.focus();

document.getElementById("save-as-mini-cycle").addEventListener("click", saveMiniCycleAsNew);
document.getElementById("open-mini-cycle").addEventListener("click", switchMiniCycle);
document.getElementById("clear-mini-cycle-tasks").addEventListener("click", clearAllTasks);
document.getElementById("delete-all-mini-cycle-tasks").addEventListener("click", deleteAllTasks);
document.getElementById("new-mini-cycle").addEventListener("click", createNewMiniCycle);

exitMiniCycle.addEventListener("click", () => {window.location.href = "../index.html";});


function initialSetup() {
    let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
    let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

    console.log("savedMC:", savedMiniCycles);

    while (!lastUsedMiniCycle || lastUsedMiniCycle.trim() === "") {
        lastUsedMiniCycle = prompt("Enter a name for your Mini Cycle:");
        if (!lastUsedMiniCycle || lastUsedMiniCycle.trim() === "") {
            alert("⚠ You must enter a valid Mini Cycle name.");
        }
    }

    // ✅ If the Mini Cycle doesn't exist, create it with default values
    if (!savedMiniCycles[lastUsedMiniCycle]) {
        savedMiniCycles[lastUsedMiniCycle] = { 
            title: lastUsedMiniCycle, 
            tasks: [], 
            autoReset: true,  // ✅ Default AutoReset to true for new Mini Cycles
            deleteCheckedTasks: false, // ✅ Ensure this property always exists
            cycleCount: 0 // ✅ Track how many times a Mini Cycle has been completed
        };
    }

    localStorage.setItem("lastUsedMiniCycle", lastUsedMiniCycle);
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    // ✅ Set title from stored Mini Cycle data
    document.getElementById("mini-cycle-title").textContent = savedMiniCycles[lastUsedMiniCycle].title;

    // ✅ Load AutoReset setting for this Mini Cycle
    toggleAutoReset.checked = savedMiniCycles[lastUsedMiniCycle].autoReset;
    deleteCheckedTasks.checked = savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks;
}


function setupMiniCycleTitleListener() {
    const titleElement = document.getElementById("mini-cycle-title");
    if (!titleElement) return; // Safety check

    titleElement.contentEditable = true;

    // ✅ Add event listener only once
    if (!titleElement.dataset.listenerAdded) {
        titleElement.addEventListener("blur", () => {
            let newTitle = titleElement.textContent.trim();
            const miniCycleFileName = localStorage.getItem("lastUsedMiniCycle");
            const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

            if (!miniCycleFileName || !savedMiniCycles[miniCycleFileName]) {
                console.warn("⚠ No active Mini Cycle found. Title update aborted.");
                return;
            }

            if (newTitle !== "") {
                savedMiniCycles[miniCycleFileName].title = newTitle;
                localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
                console.log(`✅ Mini Cycle title updated: "${newTitle}"`);
            } else {
                alert("⚠ Title cannot be empty. Reverting to the previous title.");
                titleElement.textContent = savedMiniCycles[miniCycleFileName].title;
            }
        });

        titleElement.dataset.listenerAdded = true;
    }
}

function autoSave() {
    const miniCycleFileName = localStorage.getItem("lastUsedMiniCycle");
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

    // ❌ Error Handling: Check if lastUsedMiniCycle exists
    if (!miniCycleFileName || !savedMiniCycles[miniCycleFileName]) {
        console.error(`❌ Error: Mini Cycle "${miniCycleFileName}" not found in storage. Auto-save aborted.`);
        return;
    }

    console.log("🔄 Auto-saving Mini Cycle:", miniCycleFileName);

    // ✅ Save tasks
    let miniCycleTasks = [...document.getElementById("taskList").children].map(task => ({
        text: task.querySelector("span").textContent,
        completed: task.querySelector("input").checked
    }));

    savedMiniCycles[miniCycleFileName].tasks = miniCycleTasks;
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    // ✅ Log the task status
    console.log("📋 Task Status:");
    miniCycleTasks.forEach(task => {
        console.log(`- ${task.text}: ${task.completed ? "✅ Completed" : "❌ Not Completed"}`);
    });
}


function loadMiniCycle() {
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");

    if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
        console.warn("⚠ No saved Mini Cycle found.");
        return;
    }

    try {
        const miniCycleData = savedMiniCycles[lastUsedMiniCycle];

        if (!Array.isArray(miniCycleData.tasks)) {
            throw new Error(`Invalid task data for "${lastUsedMiniCycle}".`);
        }
        // ✅ Clear existing tasks & load new ones
        taskList.innerHTML = "";
        miniCycleData.tasks.forEach(task => addTask(task.text, task.completed, false));

        // ✅ Load title from Mini Cycle storage
        const titleElement = document.getElementById("mini-cycle-title");
        titleElement.textContent = miniCycleData.title || "Untitled Mini Cycle"; // Default if empty
        
      
         // ✅ Load settings from Mini Cycle storage
         toggleAutoReset.checked = miniCycleData.autoReset || false;
         deleteCheckedTasks.checked = miniCycleData.deleteCheckedTasks || false;

        // ✅ Ensure title editing & saving is handled separately
        setupMiniCycleTitleListener();

        console.log(`✅ Loaded Mini Cycle: "${lastUsedMiniCycle}" with title "${miniCycleData.title}"`);

        hideMainMenu();
        updateProgressBar();
        checkCompleteAllButton();
    } catch (error) {
        console.error("❌ Error loading Mini Cycle:", error);
    }
    updateMainMenuHeader();
}


function updateMainMenuHeader() {
    const menuHeaderTitle = document.getElementById("main-menu-mini-cycle-title");
    const dateElement = document.getElementById("current-date");
    const lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle") || "No Mini Cycle Selected";

    // ✅ Get Current Date
    const today = new Date();
    const formattedDate = today.toLocaleDateString(undefined, {
        weekday: 'short', // "Mon"
        month: 'short', // "Jan"
        day: '2-digit', // "08"
        year: 'numeric' // "08"
    });

    // ✅ Update Title & Date
    menuHeaderTitle.textContent = lastUsedMiniCycle;
    dateElement.textContent = formattedDate;
}


function saveMiniCycleAsNew() {
    const currentMiniCycleName = localStorage.getItem("lastUsedMiniCycle");
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

    if (!currentMiniCycleName || !savedMiniCycles[currentMiniCycleName]) {
        alert("⚠ No Mini Cycle found to save.");
        return;
    }

    let newCycleName = prompt("Enter a new name to save this Mini Cycle as:");
    if (!newCycleName || savedMiniCycles[newCycleName]) {
        alert("⚠ Invalid name or Mini Cycle already exists.");
        return;
    }

    // ✅ Deep copy of Mini Cycle
    savedMiniCycles[newCycleName] = JSON.parse(JSON.stringify(savedMiniCycles[currentMiniCycleName]));
    savedMiniCycles[newCycleName].title = newCycleName; // ✅ New title = New Mini Cycle name

    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
    localStorage.setItem("lastUsedMiniCycle", newCycleName);

    alert(`✅ Mini Cycle "${currentMiniCycleName}" was copied as "${newCycleName}"!`);
    hideMainMenu();
    loadMiniCycle();
}

function switchMiniCycle() {
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const switchModal = document.querySelector(".mini-cycle-switch-modal");
    const listContainer = document.getElementById("miniCycleList");
    const switchRow = document.querySelector(".switch-items-row");
    const renameButton = document.getElementById("switch-rename");
    const deleteButton = document.getElementById("switch-delete");
    const previewWindow = document.getElementById("switch-preview-window");

    hideMainMenu();


    if (Object.keys(savedMiniCycles).length === 0) {
        alert("No saved Mini Cycles found.");
        return;
    }

    // ✅ Clear previous list and populate with Mini Cycles
    listContainer.innerHTML = "";
    Object.keys(savedMiniCycles).forEach((cycleName) => {
        const listItem = document.createElement("button");
        listItem.classList.add("mini-cycle-switch-item");
        listItem.textContent = cycleName;
        listItem.dataset.cycleName = cycleName;

        // ✅ Click event for selecting a Mini Cycle
        listItem.addEventListener("click", () => {
            document.querySelectorAll(".mini-cycle-switch-item").forEach(item => 
                item.classList.remove("selected"));
            listItem.classList.add("selected");

            // ✅ Ensure Action Row is visible
            switchRow.style.display = "block"; 
            updatePreview(cycleName);
        });

        listContainer.appendChild(listItem);
    });

    switchModal.style.display = "flex"; // ✅ Show modal
    switchRow.style.display = "none"; 
       // ✅ Load Mini Cycle List before displaying the modal
       loadMiniCycleList();


    // ✅ Prevent duplicate event listeners
    renameButton.removeEventListener("click", renameMiniCycle);
    renameButton.addEventListener("click", renameMiniCycle);

    deleteButton.removeEventListener("click", deleteMiniCycle);
    deleteButton.addEventListener("click", deleteMiniCycle);

    document.getElementById("miniCycleSwitchConfirm").removeEventListener("click", confirmMiniCycle);
    document.getElementById("miniCycleSwitchConfirm").addEventListener("click", confirmMiniCycle);

    document.getElementById("miniCycleSwitchCancel").removeEventListener("click", closeMiniCycleModal);
    document.getElementById("miniCycleSwitchCancel").addEventListener("click", closeMiniCycleModal);
}


function renameMiniCycle() {
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");

    if (!selectedCycle) {
        alert("Please select a Mini Cycle to rename.");
        return;
    }

    let newName = prompt("Enter a new name for this Mini Cycle:", selectedCycle.textContent);
    if (!newName || newName.trim() === "") {
        alert("Invalid name! Mini Cycle name cannot be empty.");
        return;
    }

    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

    // ✅ Check if new name already exists
    if (savedMiniCycles[newName]) {
        alert("A Mini Cycle with this name already exists. Choose a different name.");
        return;
    }

    // ✅ Rename and update localStorage
    savedMiniCycles[newName] = { ...savedMiniCycles[selectedCycle.dataset.cycleName] };
    delete savedMiniCycles[selectedCycle.dataset.cycleName];

    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    alert(`Mini Cycle renamed to: ${newName}`);
    switchMiniCycle(); // ✅ Refresh modal to update the list
}

function deleteMiniCycle() {
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
    const switchModal = document.querySelector(".mini-cycle-switch-modal"); // ✅ Select modal

    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");
    if (!selectedCycle) {
        alert("⚠ No Mini Cycle selected for deletion.");
        return;
    }

    const cycleToDelete = selectedCycle.dataset.cycleName;

    // ✅ Confirm deletion before proceeding
    if (!confirm(`❌ Are you sure you want to delete "${cycleToDelete}"? This action cannot be undone.`)) {
        return;
    }

    // ✅ Remove the selected Mini Cycle
    delete savedMiniCycles[cycleToDelete];
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
    console.log(`✅ Mini Cycle "${cycleToDelete}" deleted.`);

    // ✅ If the deleted cycle was the active one, handle fallback
    if (cycleToDelete === lastUsedMiniCycle) {
        const remainingCycles = Object.keys(savedMiniCycles);

        if (remainingCycles.length > 0) {
            // ✅ Switch to the most recent or first available Mini Cycle
            const newActiveCycle = remainingCycles[0];
            localStorage.setItem("lastUsedMiniCycle", newActiveCycle);
            loadMiniCycle(); // Load the new active Mini Cycle
            console.log(`🔄 Switched to Mini Cycle: "${newActiveCycle}".`);
        } else {
            setTimeout(() => {
                hideSwitchMiniCycleModal();
                alert("⚠ No Mini Cycles left. Please create a new one.");
                localStorage.removeItem("lastUsedMiniCycle");
        
                // ✅ Manually reset UI instead of reloading
                taskList.innerHTML = "";
                toggleAutoReset.checked = false;
                initialSetup(); // Runs fresh setup
            }, 300);
        }
    }

    hideSwitchMiniCycleModal();
    updateProgressBar();
    checkCompleteAllButton();
}

function hideSwitchMiniCycleModal() {
    const switchModal = document.querySelector(".mini-cycle-switch-modal");
    console.log("🔍 Modal Found?", switchModal); // Debugging log

    if (!switchModal) {
        console.error("❌ Error: Modal not found.");
        return;
    }
    document.querySelector(".mini-cycle-switch-modal").style.display = "none";
    console.log("confirm", switchModal); 
}

function confirmMiniCycle() {
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");

    if (!selectedCycle) {
        alert("Please select a Mini Cycle.");
        return;
    }

    localStorage.setItem("lastUsedMiniCycle", selectedCycle.dataset.cycleName);
    loadMiniCycle();
    document.querySelector(".mini-cycle-switch-modal").style.display = "none"; // ✅ Hide modal after selection
}



function closeMiniCycleModal() {
    document.querySelector(".mini-cycle-switch-modal").style.display = "none";
}


document.addEventListener("click", function closeOnClickOutside(event) {
    const switchModalContent = document.querySelector(".mini-cycle-switch-modal-content");
    const switchModal = document.querySelector(".mini-cycle-switch-modal");
    const mainMenu = document.querySelector(".menu-container");

    // ✅ If the modal is open and the clicked area is NOT inside the modal or main menu, close it
    if (
        switchModal.style.display === "flex" &&
        !switchModalContent.contains(event.target) && 
        !mainMenu.contains(event.target)
    ) {
        switchModal.style.display = "none"; 
    }
});


function updatePreview(cycleName) {
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const previewWindow = document.getElementById("switch-preview-window");

    if (!savedMiniCycles[cycleName] || !savedMiniCycles[cycleName].tasks) {
        previewWindow.innerHTML = `<br><strong>No tasks found.</strong>`;
        return;
    }

    // ✅ Create a simple list of tasks for preview
    const tasksPreview = savedMiniCycles[cycleName].tasks
        .map(task => `<div class="preview-task">${task.completed ? "✔️" : "___"} ${task.text}</div>`)
        .join("");

    previewWindow.innerHTML = `<strong>Tasks:</strong><br>${tasksPreview}`;
}

function loadMiniCycleList() {
    const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const miniCycleList = document.getElementById("miniCycleList");
    miniCycleList.innerHTML = ""; // Clear the list before repopulating

    Object.keys(savedMiniCycles).forEach((cycleName) => {
        const cycleData = savedMiniCycles[cycleName];
        const listItem = document.createElement("div");
        listItem.classList.add("mini-cycle-switch-item");
        listItem.dataset.cycleName = cycleName;

        // 🏷️ Determine emoji based on Mini Cycle properties
        let emoji = "📋"; // Default to 📋 (Standard Document)
        if (cycleData.autoReset) {
            emoji = "🔃"; // If Auto Reset is ON, show 🔃
        } 

        // 📌 Ensure spacing between emoji and text
        listItem.innerHTML = `${emoji}  <span>${cycleName}</span>`;

        // 🖱️ Handle selection
        listItem.addEventListener("click", function () {
            document.querySelectorAll(".mini-cycle-switch-item").forEach(item => item.classList.remove("selected"));
            this.classList.add("selected");

            // Show preview & buttons
            document.getElementById("switch-items-row").style.display = "block";
            updatePreview(cycleName);
        });

        miniCycleList.appendChild(listItem);
    });
}



function clearAllTasks() {
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

    // ✅ Ensure a valid Mini Cycle exists
    if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
        alert("⚠ No active Mini Cycle to clear tasks.");
        return;
    }


    // ✅ Uncheck all tasks (DO NOT DELETE)
    savedMiniCycles[lastUsedMiniCycle].tasks.forEach(task => task.completed = false);

    // ✅ Save updated Mini Cycle
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    // ✅ Uncheck tasks in the UI
    document.querySelectorAll("#taskList .task input[type='checkbox']").forEach(checkbox => {
        checkbox.checked = false;
    });

    // ✅ Update UI elements
    updateProgressBar();
    checkCompleteAllButton();
    autoSave(); // Ensure changes persist
    hideMainMenu();

    console.log(`✅ All tasks unchecked for Mini Cycle: "${lastUsedMiniCycle}"`);
}

function deleteAllTasks() {
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

    // ✅ Ensure a valid Mini Cycle exists
    if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
        alert("⚠ No active Mini Cycle to delete tasks from.");
        return;
    }

    // ✅ Confirm before deleting all tasks
    if (!confirm(`⚠ Are you sure you want to permanently delete all tasks in "${lastUsedMiniCycle}"? This action cannot be undone.`)) {
        return;
    }

    // ✅ Clear tasks completely
    savedMiniCycles[lastUsedMiniCycle].tasks = [];

    // ✅ Save updated Mini Cycle
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    // ✅ Clear UI & update progress
    taskList.innerHTML = "";
    updateProgressBar();
    checkCompleteAllButton();
    autoSave(); // Ensure changes persist

    console.log(`✅ All tasks deleted for Mini Cycle: "${lastUsedMiniCycle}"`);
}

function createNewMiniCycle() {
    let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    
    // ✅ Prompt user for a Mini Cycle name
    let newCycleName = prompt("Enter a name for the new Mini Cycle:");
    if (!newCycleName || newCycleName.trim() === "") {
        alert("⚠ Mini Cycle name cannot be empty.");
        return;
    }
    newCycleName = newCycleName.trim();

    // ✅ Ensure the Mini Cycle name is unique
    if (savedMiniCycles[newCycleName]) {
        alert("⚠ A Mini Cycle with this name already exists. Choose a different name.");
        return;
    }

    // ✅ Create new Mini Cycle with default settings
    savedMiniCycles[newCycleName] = {
        title: newCycleName,
        tasks: [],
        autoReset: true, // ✅ Default Auto Reset to ON
        deleteCheckedTasks: false, // ✅ Default to OFF
    };

    // ✅ Save to localStorage
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
    localStorage.setItem("lastUsedMiniCycle", newCycleName);

    // ✅ Clear UI & Load new Mini Cycle
    taskList.innerHTML = "";
    document.getElementById("mini-cycle-title").textContent = newCycleName;
    toggleAutoReset.checked = savedMiniCycles[newCycleName].autoReset;

    // ✅ Ensure UI updates
    hideMainMenu();
    updateProgressBar();
    checkCompleteAllButton();
    autoSave();

    console.log(`✅ Created and switched to new Mini Cycle: "${newCycleName}"`);
}


function setupSettingsMenu() {
    const settingsModal = document.querySelector(".settings-modal");
    const settingsModalContent = document.querySelector(".settings-modal-content");
    const openSettingsBtn = document.getElementById("open-settings");
    const closeSettingsBtn = document.getElementById("close-settings");

    function openSettings(event) {
        event.stopPropagation(); // Prevent click from propagating
        settingsModal.style.display = "flex";
        hideMainMenu();
    }

    function closeSettings() {
        settingsModal.style.display = "none";
    }

    function closeOnClickOutside(event) {
        if (settingsModal.style.display === "flex" && 
            !settingsModalContent.contains(event.target) && 
            event.target !== openSettingsBtn) {
            settingsModal.style.display = "none";
        }
    }

    // ✅ Remove previous listeners before adding new ones
    openSettingsBtn.removeEventListener("click", openSettings);
    closeSettingsBtn.removeEventListener("click", closeSettings);
    document.removeEventListener("click", closeOnClickOutside);

    // ✅ Add event listeners (only once)
    openSettingsBtn.addEventListener("click", openSettings);
    closeSettingsBtn.addEventListener("click", closeSettings);
    document.addEventListener("click", closeOnClickOutside);

    // ✅ **Toggle Move Arrows Setting**
const moveArrowsToggle = document.getElementById("toggle-move-arrows");
if (moveArrowsToggle) {
    moveArrowsToggle.checked = localStorage.getItem("showMoveArrows") === "true"; 
    moveArrowsToggle.addEventListener("change", () => {
        localStorage.setItem("showMoveArrows", moveArrowsToggle.checked);
        updateMoveArrowsVisibility(); // ✅ No need to reload Mini Cycle!
    });

        
        
    }

    // Backup Mini Cycles
    document.getElementById("backup-mini-cycles").addEventListener("click", () => {
        const backupData = {
            miniCycleStorage: localStorage.getItem("miniCycleStorage"),
            lastUsedMiniCycle: localStorage.getItem("lastUsedMiniCycle"),
        };
        const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const backupUrl = URL.createObjectURL(backupBlob);
        const a = document.createElement("a");
        a.href = backupUrl;
        a.download = "mini-cycle-backup.json";
        a.click();
    });

    // Restore Mini Cycles
    document.getElementById("restore-mini-cycles").addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.addEventListener("change", (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const backupData = JSON.parse(e.target.result);
                    if (backupData.miniCycleStorage) {
                        localStorage.setItem("miniCycleStorage", backupData.miniCycleStorage);
                        localStorage.setItem("lastUsedMiniCycle", backupData.lastUsedMiniCycle || "");
                        alert("✅ Backup Restored!");
                        location.reload(); // Refresh to apply changes
                    } else {
                        alert("❌ Invalid backup file.");
                    }
                } catch (error) {
                    alert("❌ Error restoring backup.");
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });

    // Factory Reset (Clear All Mini Cycles)
    document.getElementById("factory-reset").addEventListener("click", () => {
        if (confirm("⚠️ This will DELETE ALL Mini Cycles and reset everything. Are you sure?")) {
            localStorage.removeItem("miniCycleStorage");
            localStorage.removeItem("lastUsedMiniCycle");
            alert("✅ Factory Reset Complete. Reloading...");
            location.reload(); // Refresh page to reset everything
        }
    });
}



function setupDownloadMiniCycle() {
    document.getElementById("export-mini-cycle").addEventListener("click", () => {
        const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
        const lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");

        if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) {
            alert("⚠ No active Mini Cycle to export.");
            return;
        }

        const miniCycleData = {
            name: lastUsedMiniCycle,
            tasks: savedMiniCycles[lastUsedMiniCycle].tasks || [],
            autoReset: savedMiniCycles[lastUsedMiniCycle].autoReset || false,
            cycleCount: savedMiniCycles[lastUsedMiniCycle].cycleCount || 0,
            deleteCheckedTasks: savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks || false,
            title: savedMiniCycles[lastUsedMiniCycle].title || "New Mini Cycle"
        };

        // ✅ Ask the user for a file name (default to the Mini Cycle name)
        let fileName = prompt("Enter a name for your Mini Cycle file:", lastUsedMiniCycle || "mini-cycle");

        // ✅ If the user cancels (prompt returns null), stop execution
        if (fileName === null) {
            alert("❌ Download canceled.");
            return; // ❌ Exit function
        }

        // ✅ Prevent empty or invalid file names
        fileName = fileName.trim();
        if (fileName === "") {
            alert("❌ Invalid file name. Download canceled.");
            return; // ❌ Exit function
        }

        // ✅ Remove invalid characters
        fileName = fileName.replace(/[^a-zA-Z0-9-_ ]/g, "");

        // ✅ Convert to JSON and save as a .mcyc file
        const blob = new Blob([JSON.stringify(miniCycleData, null, 2)], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileName}.mcyc`;
        a.click();
        URL.revokeObjectURL(url);
    });
}



function setupUploadMiniCycle() {
    // ✅ Support both Import buttons
    const importButtons = ["import-mini-cycle", "miniCycleUpload"];
    
    importButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (!button) return; // Skip if button isn't found

        button.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ""; // Allows .tcyc for validation
            input.addEventListener("change", (event) => {
                const file = event.target.files[0];
                if (!file) return;

                // ✅ Check if file is .tcyc and show message
                if (file.name.endsWith(".tcyc")) {
                    alert("❌ Mini Cycle does not support .tcyc files.\nPlease save your Task Cycle as .MCYC to import into Mini Cycle.");
                    return; // Stop execution
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);

                        // ✅ Ensure file has valid structure
                        if (!importedData.name || !Array.isArray(importedData.tasks)) {
                            alert("❌ Invalid Mini Cycle file format.");
                            return;
                        }

                        // ✅ Load current Mini Cycles
                        const savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

                        // ✅ Add the imported Mini Cycle
                        savedMiniCycles[importedData.name] = {
                            tasks: importedData.tasks,
                            autoReset: importedData.autoReset || false,
                            cycleCount: importedData.cycleCount || 0,
                            deleteCheckedTasks: importedData.deleteCheckedTasks || false,
                            title: importedData.title || "New Mini Cycle"
                        };

                        // ✅ Save back to localStorage
                        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
                        localStorage.setItem("lastUsedMiniCycle", importedData.name);

                        alert(`✅ Mini Cycle "${importedData.name}" Imported Successfully!`);
                        location.reload(); // Refresh to apply changes
                    } catch (error) {
                        alert("❌ Error importing Mini Cycle.");
                    }
                };
                reader.readAsText(file);
            });
            input.click();
        });
    });
}



function setupFeedbackModal() {
    // Open Modal
    openFeedbackBtn.addEventListener("click", () => {
        feedbackModal.style.display = "flex";
        hideMainMenu();
    });

    // Close Modal
    closeFeedbackBtn.addEventListener("click", () => {
        feedbackModal.style.display = "none";
    });

    // Submit Feedback
    submitFeedbackBtn.addEventListener("click", () => {
        const feedback = feedbackText.value.trim();
        if (feedback) {
            alert("Thank you for your feedback!");
            feedbackText.value = ""; // Clear text
            feedbackModal.style.display = "none"; // Close modal
        } else {
            alert("Please enter feedback before submitting.");
        }
    });

    // Close Modal on Outside Click
    window.addEventListener("click", (event) => {
        if (event.target === feedbackModal) {
            feedbackModal.style.display = "none";
        }
    });

}

function setupUserManual() {
    openUserManual.addEventListener("click", () => {
        hideMainMenu();

        // Disable button briefly to prevent multiple clicks
        openUserManual.disabled = true;

        // Show a friendly alert message
        setTimeout(() => {
            alert("📖 The User Manual is coming soon!\nStay tuned for updates.");
            
            // Re-enable button after alert closes
            openUserManual.disabled = false;
        }, 200);
    });
}



function setupAbout() {
    const aboutModal = document.getElementById("about-modal");
    const openAboutBtn = document.getElementById("open-about-modal");
    const closeAboutBtn = aboutModal.querySelector(".close-modal");

    // Open Modal
    openAboutBtn.addEventListener("click", () => {
        aboutModal.style.display = "flex";
    });

    // Close Modal
    closeAboutBtn.addEventListener("click", () => {
        aboutModal.style.display = "none";
    });

    // Close Modal on Outside Click
    window.addEventListener("click", (event) => {
        if (event.target === aboutModal) {
            aboutModal.style.display = "none";
        }
    });
}


function assignCycleVariables() {
    let lastUsedMiniCycle = localStorage.getItem("lastUsedMiniCycle");
    let savedMiniCycles = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};

    return { lastUsedMiniCycle, savedMiniCycles };
}
// ✅ Retrieve Mini Cycle variables
const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

function updateProgressBar() {
    const totalTasks = taskList.children.length;
    const completedTasks = [...taskList.children].filter(task => task.querySelector("input").checked).length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    progressBar.style.width = `${progress}%`;
    autoSave();

}

function checkMiniCycle() {
    updateProgressBar();
    const allCompleted = [...taskList.children].every(task => task.querySelector("input").checked);

    // ✅ Retrieve Mini Cycle variables
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
    let cycleData = savedMiniCycles[lastUsedMiniCycle];

    if (!lastUsedMiniCycle || !cycleData) {
        console.warn("⚠ No active Mini Cycle found.");
        return;
    }

    // ✅ Only trigger reset if ALL tasks are completed AND autoReset is enabled
    if (allCompleted && taskList.children.length > 0) {
        console.log(`✅ All tasks completed for "${lastUsedMiniCycle}"`);

        // ✅ Auto-reset: Only reset if AutoReset is enabled
        if (cycleData.autoReset) {
            console.log(`🔄 AutoReset is ON. Resetting tasks for "${lastUsedMiniCycle}"...`);
            setTimeout(() => {
                incrementCycleCount(lastUsedMiniCycle, savedMiniCycles); // ✅ Count first
                resetTasks(); // ✅ Then reset tasks
            }, 1000);
        }
    }

    updateStatsPanel();
    autoSave();
}

function incrementCycleCount(miniCycleName, savedMiniCycles) {
    let cycleData = savedMiniCycles[miniCycleName];

    // ✅ Ensure valid data
    if (!cycleData) return;

    // ✅ Increment cycle count
    cycleData.cycleCount = (cycleData.cycleCount || 0) + 1;
    localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

    console.log(`✅ Mini Cycle count updated for "${miniCycleName}": ${cycleData.cycleCount}`);

    // ✅ Check for milestone separately
    checkForMilestone(miniCycleName, cycleData.cycleCount);
       // ✅ Show confirmation animation
       showCompletionAnimation();


    updateStatsPanel();
}

function showCompletionAnimation() {
    const animation = document.createElement("div");
    animation.classList.add("mini-cycle-complete-animation");
  //  animation.innerHTML = "✅ Mini Cycle Completed!"; 
  animation.innerHTML = "✔"; 

    document.body.appendChild(animation);

    // ✅ Remove the animation after 1.5 seconds
    setTimeout(() => {
        animation.remove();
    }, 1500);
}

function checkForMilestone(miniCycleName, cycleCount) {
    const milestoneLevels = [10, 25, 50, 100, 200, 500, 1000];

    if (milestoneLevels.includes(cycleCount)) {
        showMilestoneMessage(miniCycleName, cycleCount);
    }
}

function showMilestoneMessage(miniCycleName, cycleCount) {
    const message = `🎉 You've completed ${cycleCount} cycles for "${miniCycleName}"! Keep going! 🚀`;

    // ✅ Create a notification-like popup
    const milestonePopup = document.createElement("div");
    milestonePopup.classList.add("mini-cycle-milestone");
    milestonePopup.textContent = message;

    document.body.appendChild(milestonePopup);

    // ✅ Automatically remove the message after 3 seconds
    setTimeout(() => {
        milestonePopup.remove();
    }, 3000);
}


function DragAndDrop(taskElement) {
    taskElement.setAttribute("draggable", "true");

    // Prevent text selection on mobile
    taskElement.style.userSelect = "none";
    taskElement.style.webkitUserSelect = "none";
    taskElement.style.msUserSelect = "none";

    let touchStartX = 0;
    let touchStartY = 0;
    let holdTimeout = null;
    let isDragging = false;
    let isLongPress = false;
    let isTap = false;
    let preventClick = false;

    // 📱 **Touch-based Drag for Mobile**
    taskElement.addEventListener("touchstart", (event) => {
        if (event.target.closest(".task-options")) return;
        isLongPress = false;
        isDragging = false;
        isTap = true; 
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        preventClick = false;

        holdTimeout = setTimeout(() => {
            isLongPress = true;
            isTap = false;
            draggedTask = taskElement;
            isDragging = true;
            taskElement.classList.add("dragging");

            event.preventDefault();

            
            const buttonRow = taskElement.querySelector(".task-options");
        if (buttonRow) {
            buttonRow.style.display = "flex";
            buttonRow.style.opacity = "1";
            buttonRow.style.visibility = "visible";
            buttonRow.style.pointerEvents = "auto";
        }


            console.log("📱 Long Press Detected - Dragging Enabled");
        }, 500); // Long-press delay (500ms)
    });

    taskElement.addEventListener("touchmove", (event) => {
        const touchMoveX = event.touches[0].clientX;
        const touchMoveY = event.touches[0].clientY;
        const deltaX = Math.abs(touchMoveX - touchStartX);
        const deltaY = Math.abs(touchMoveY - touchStartY);

        // ✅ Allow normal scrolling if moving vertically
        if (deltaY > deltaX) {
            clearTimeout(holdTimeout);
            isTap = false;
            return;
        }

        if (isLongPress && !isDragging) {
            taskElement.setAttribute("draggable", "true");
            isDragging = true;

            if (event.cancelable) {
                event.preventDefault();
            }
        }

        if (isDragging && draggedTask) {
            if (event.cancelable) {
                event.preventDefault();
            }
            const movingTask = document.elementFromPoint(event.touches[0].clientX, event.touches[0].clientY);
            handleRearrange(movingTask, event);
        }
    });

    taskElement.addEventListener("touchend", () => {
        clearTimeout(holdTimeout);

        if (isTap) {
            preventClick = true;
            setTimeout(() => { 
                preventClick = false; 
            }, 100);
        }

        if (draggedTask) {
            draggedTask.classList.remove("dragging", "rearranging");
            draggedTask = null;
        }

        isDragging = false;
    });

// 🖱️ **Mouse-based Drag for Desktop**
taskElement.addEventListener("dragstart", (event) => {
    if (event.target.closest(".task-options")) return;
    draggedTask = taskElement;
    event.dataTransfer.setData("text/plain", "");

    // ✅ Hide ghost image on desktop
    if (!isTouchDevice()) {
        
        const transparentPixel = new Image();
        transparentPixel.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
        event.dataTransfer.setDragImage(transparentPixel, 0, 0);
    }

    taskElement.classList.add("dragging");
});

function isTouchDevice() {
    let hasTouchEvents = "ontouchstart" in window;
    let touchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints;
    let isFinePointer = window.matchMedia("(pointer: fine)").matches;
    
    console.log(`touch detected: hasTouchEvents=${hasTouchEvents}, maxTouchPoints=${touchPoints}, isFinePointer=${isFinePointer}`);
    
    // 🚀 **NEW LOGIC**: 
    // If `isFinePointer` is true (indicating a precise mouse pointer), ignore `maxTouchPoints`
    if (isFinePointer) return false;
    
    // Otherwise, rely on touch events & maxTouchPoints
    return hasTouchEvents || touchPoints > 0;
}




}

function handleRearrange(target, event) {
    if (!target || !draggedTask || target === draggedTask) return;

    const parent = draggedTask.parentNode;
    if (!parent || parent !== target.parentNode) return;

    const bounding = target.getBoundingClientRect();
    const offset = event.clientY - bounding.top;

    // ✅ Remove previous drop indicators (ensures only ONE drop target at a time)
    document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));

    // 🔍 Check if the task is being moved to the LAST position
    const isLastTask = !target.nextElementSibling;

    // 🔍 Check if the task is being moved to the FIRST position
    const isFirstTask = !target.previousElementSibling;


    // ✅ Prevent redundant reordering
    if (offset > bounding.height / 2) {
        if (target.nextSibling !== draggedTask) {
            console.log(`🔄 Moving task AFTER:`, draggedTask, `➡`, target);
            parent.insertBefore(draggedTask, target.nextSibling);
            target.classList.add("drop-target"); // ✅ Highlight where it's being dropped
        }
    } else {
        if (target.previousSibling !== draggedTask) {
            console.log(`🔄 Moving task BEFORE:`, draggedTask, `⬅`, target);
            parent.insertBefore(draggedTask, target);
            target.classList.add("drop-target"); // ✅ Highlight where it's being dropped
        }
    }

    // ✅ Special case: If dragging to the LAST position
    if (isLastTask) {
        parent.appendChild(draggedTask);
        draggedTask.classList.add("drop-target"); // ✅ Ensure the last item is highlighted
    }

    // ✅ Special case: If dragging to the FIRST position
    if (isFirstTask) {
        parent.insertBefore(draggedTask, parent.firstChild); // ✅ Moves it to the very top
        draggedTask.classList.add("drop-target"); // ✅ Ensure the first item is highlighted
    }


}


function setupRearrange() {
    if (window.rearrangeInitialized) return;
    window.rearrangeInitialized = true;

    document.addEventListener("dragover", (event) => {
        event.preventDefault();

        // ✅ **Throttle to prevent excessive calls**
        const now = Date.now();
        if (now - lastDragOverTime < DRAG_THROTTLE_MS) return;
        lastDragOverTime = now;

        if (!draggedTask) return;

        const movingTask = document.elementFromPoint(event.clientX, event.clientY)?.closest(".task");

        // ✅ Only update if target actually changes
        if (movingTask && movingTask !== lastRearrangeTarget) {
            lastRearrangeTarget = movingTask; // Update last target
            handleRearrange(movingTask, event);
        }
    });

    document.addEventListener("drop", (event) => {
        event.preventDefault();
        if (!draggedTask) return;

        const movingTask = document.elementFromPoint(event.clientX, event.clientY)?.closest(".task");
        if (movingTask && movingTask !== draggedTask) {
            handleRearrange(movingTask, event);
        }

        cleanupDragState();
    });
}


function cleanupDragState() {
    if (draggedTask) {
        draggedTask.classList.remove("dragging", "rearranging");
        draggedTask = null;
    }
    document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));
}


function dragEndCleanup () {
    document.addEventListener("dragend", cleanupDragState);
    document.addEventListener("drop", cleanupDragState);
    document.addEventListener("dragover", () => {
        document.querySelectorAll(".rearranging").forEach(task => task.classList.remove("rearranging"));
    });
    
    }

function updateMoveArrowsVisibility() {
    const showArrows = localStorage.getItem("showMoveArrows") === "true";

    // ✅ Show or hide move arrows
    document.querySelectorAll(".move-btn").forEach(button => {
        button.style.display = showArrows ? "inline-block" : "none";
    });

    // ✅ Reapply hover behavior for `.task-options`
    document.querySelectorAll(".task").forEach(task => {
        task.removeEventListener("mouseenter", showTaskOptions);
        task.removeEventListener("mouseleave", hideTaskOptions);

        task.addEventListener("mouseenter", showTaskOptions);
        task.addEventListener("mouseleave", hideTaskOptions);

        
    });

   
    

    // ✅ Ensure `.task-options` visibility is reset
    document.querySelectorAll(".task-options").forEach(options => {
        options.style.visibility = "hidden";
        options.style.opacity = "0";
    });

    console.log("✅ Move Arrows Toggled, Task Options Reset");



}
    
   
function showTaskOptions(event) {
    const taskOptions = event.currentTarget.querySelector(".task-options");
    if (taskOptions) {
        taskOptions.style.visibility = "visible";
        taskOptions.style.opacity = "1";
        toggleArrowVisibility();
    }
}

function hideTaskOptions(event) {
    const taskOptions = event.currentTarget.querySelector(".task-options");
    if (taskOptions) {
        taskOptions.style.visibility = "hidden";
        taskOptions.style.opacity = "0";
        toggleArrowVisibility();
    }
}

function toggleArrowVisibility() {
    const allTasks = document.querySelectorAll(".task");

    allTasks.forEach((task, index) => {
        const upButton = task.querySelector('.move-up');
        const downButton = task.querySelector('.move-down');

        // ✅ Instead of removing them, just hide them visually
        if (upButton) upButton.style.visibility = (index === 0) ? "hidden" : "visible";
        if (downButton) downButton.style.visibility = (index === allTasks.length - 1) ? "hidden" : "visible";
    });
}


function addTask(taskText, completed = false, shouldSave = true) {
    // ✅ Prevent events from being passed by mistake
    if (typeof taskText !== "string") {
        console.error("Error: taskText is not a string", taskText);
        return;
    }
    let taskTextTrimmed = taskText.trim();
    if (!taskTextTrimmed) return;

    // ✅ Enforce TASK_LIMIT
    if (taskTextTrimmed.length > TASK_LIMIT) {
        alert(`Task must be ${TASK_LIMIT} characters or less.`);
        return;
    }

    // ✅ Create Task Element
    const taskItem = document.createElement("li");
    taskItem.classList.add("task");
    taskItem.setAttribute("draggable", "true");

    // ✅ Create Button Container (above the task)
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("task-options");

    // ✅ High Priority Button
    const priorityButton = document.createElement("button");
    priorityButton.classList.add("task-btn", "priority-btn");
    priorityButton.innerHTML = "⚠"; // Warning icon
    priorityButton.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent marking task as complete
        taskItem.classList.toggle("high-priority");
        autoSave();
    });

    // ✅ Edit Button
    const editButton = document.createElement("button");
    editButton.classList.add("task-btn", "edit-btn");
    editButton.innerHTML = "🖊"; // Edit icon
    editButton.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent marking task as complete
        const newText = prompt("Edit task name:", taskTextTrimmed);
        if (newText) {
            taskLabel.textContent = newText.trim();
            autoSave();
        }
    });

    // ✅ Delete Button
    const deleteButton = document.createElement("button");
    deleteButton.classList.add("task-btn", "delete-btn");
    deleteButton.innerHTML = "🗑"; // Delete icon
    deleteButton.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent marking task as complete
        taskItem.remove();
        updateProgressBar();
        updateStatsPanel();
        checkCompleteAllButton();
        autoSave();
    });


   // ✅ **Move Up Button**
   const moveUpButton = document.createElement("button");
   moveUpButton.classList.add("task-btn", "move-btn", "move-up");
   moveUpButton.innerHTML = "▲"; 
   moveUpButton.addEventListener("click", (event) => {
       event.stopPropagation();
       const prevTask = taskItem.previousElementSibling;
       if (prevTask) taskItem.parentNode.insertBefore(taskItem, prevTask);
       autoSave();
   });

   // ✅ **Move Down Button**
   const moveDownButton = document.createElement("button");
   moveDownButton.classList.add("task-btn", "move-btn", "move-down");
   moveDownButton.innerHTML = "▼"; 
   moveDownButton.addEventListener("click", (event) => {
       event.stopPropagation();
       const nextTask = taskItem.nextElementSibling;
       if (nextTask) taskItem.parentNode.insertBefore(taskItem, nextTask.nextSibling);
       autoSave();
   });

   // ✅ Append Buttons Above the Task
   buttonContainer.appendChild(priorityButton);
   buttonContainer.appendChild(editButton);
   buttonContainer.appendChild(deleteButton);
   buttonContainer.appendChild(moveUpButton);
   buttonContainer.appendChild(moveDownButton);
   taskItem.appendChild(buttonContainer);


    // ✅ Checkbox for Completion
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = completed;
    checkbox.addEventListener("change", () => {
        checkMiniCycle();
        autoSave();
        triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);
    });

    // ✅ Task Text
    const taskLabel = document.createElement("span");
    taskLabel.textContent = taskTextTrimmed;

    // ✅ Make Clicking the Entire Task Toggle Completion (Except for Buttons & Checkbox)
    taskItem.addEventListener("click", (event) => {
        // ❌ Prevent toggling if clicking the checkbox or any button
        if (event.target === checkbox || buttonContainer.contains(event.target)) {
            return;
        }

        checkbox.checked = !checkbox.checked;
        checkMiniCycle();
        autoSave();
        triggerLogoBackground(checkbox.checked ? 'green' : 'default', 300);
    });
    

    // ✅ Attach Elements to Task
    taskItem.appendChild(checkbox);
    taskItem.appendChild(taskLabel);

    // ✅ Add Task to the List
    document.getElementById("taskList").appendChild(taskItem);
    taskInput.value = "";

    // ✅ Auto-scroll to new task
    document.querySelector(".task-list-container").scrollTo({
        top: taskList.scrollHeight,
        behavior: "smooth"
    });

    checkCompleteAllButton();
    updateProgressBar();
    updateStatsPanel();
    if (shouldSave) autoSave();

    // ✅ Enable Drag and Drop
    DragAndDrop(taskItem);

       // ✅ Hide Move Arrows if disabled in settings
       updateMoveArrowsVisibility();
}



function resetTasks() {
    taskList.querySelectorAll(".task input").forEach(task => task.checked = false);
  
    // ✅ Show message with smooth fade-in
    cycleMessage.style.visibility = "visible";
    cycleMessage.style.opacity = "1";

    progressBar.style.width = "0%";

    setTimeout(() => {
        // ✅ Hide message with smooth fade-out after 2 seconds
        cycleMessage.style.opacity = "0";
        cycleMessage.style.visibility = "hidden";
    }, 2000);

    updateStatsPanel();
    // ✅ Ensure checkboxes update before saving
    setTimeout(() => {
        autoSave(); // ✅ Save AFTER checkboxes are actually unchecked
    }, 50);
}


function checkCompleteAllButton() {

    if (taskList.children.length > 0) 
        {
            console.log(taskList.children.length);
    completeAllButton.style.display = "block";
    
    completeAllButton.style.zIndex = "2";
    } else {
        completeAllButton.style.display = taskList.children.length > 0 ? "block" : "none";
        console.log(taskList.children.length);
    
    
    }
    }
    
    
function triggerLogoBackground(color = 'green', duration = 300) {
    const logo = document.querySelector('.logo img');

    if (logo) {

        if (logoTimeoutId) {
            clearTimeout(logoTimeoutId);
            logoTimeoutId = null;
        }


        logo.style.backgroundColor = color;
        logoTimeoutId = setTimeout(() => {
            logo.style.backgroundColor = '';
            logoTimeoutId = null; 
        }, duration);
    }
}

function saveToggleAutoReset() {
    const toggleAutoReset = document.getElementById("toggleAutoReset");
    const deleteCheckedTasksContainer = document.getElementById("deleteCheckedTasksContainer");
    const deleteCheckedTasks = document.getElementById("deleteCheckedTasks");
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

    // ✅ Ensure AutoReset reflects the correct state
    if (lastUsedMiniCycle && savedMiniCycles[lastUsedMiniCycle]) {
        toggleAutoReset.checked = savedMiniCycles[lastUsedMiniCycle].autoReset || false;
        deleteCheckedTasks.checked = savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks || false;
    } else {
        toggleAutoReset.checked = false;
        deleteCheckedTasks.checked = false;
    }

    // ✅ Show "Delete Checked Tasks" only when Auto Reset is OFF
    deleteCheckedTasksContainer.style.display = toggleAutoReset.checked ? "none" : "block";

     // ✅ Remove previous event listeners before adding new ones to prevent stacking
     toggleAutoReset.removeEventListener("change", handleAutoResetChange);
     deleteCheckedTasks.removeEventListener("change", handleDeleteCheckedTasksChange);


// ✅ Define event listener functions
    function handleAutoResetChange(event) {
        if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) return;

        savedMiniCycles[lastUsedMiniCycle].autoReset = event.target.checked;
           // ✅ If Auto Reset is turned ON, automatically uncheck "Delete Checked Tasks"
           if (event.target.checked) {
            savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = false;
            deleteCheckedTasks.checked = false; // ✅ Update UI
        }
        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));

        // ✅ Show/Hide "Delete Checked Tasks" toggle dynamically
        deleteCheckedTasksContainer.style.display = event.target.checked ? "none" : "block";

              // ✅ Only trigger Mini Cycle reset if AutoReset is enabled
        if (event.target.checked) checkMiniCycle();
    }

    function handleDeleteCheckedTasksChange(event) {
        if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) return;

        savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = event.target.checked;
        localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
    }
           

         // ✅ Add new event listeners
    toggleAutoReset.addEventListener("change", handleAutoResetChange);
    deleteCheckedTasks.addEventListener("change", handleDeleteCheckedTasksChange);

    }

    if (!deleteCheckedTasks.dataset.listenerAdded) {
        deleteCheckedTasks.addEventListener("change", (event) => {
            if (!lastUsedMiniCycle || !savedMiniCycles[lastUsedMiniCycle]) return;

            savedMiniCycles[lastUsedMiniCycle].deleteCheckedTasks = event.target.checked;
            localStorage.setItem("miniCycleStorage", JSON.stringify(savedMiniCycles));
        });

        deleteCheckedTasks.dataset.listenerAdded = true; 

    }



function closeMenuOnClickOutside(event) {
    if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
        menu.classList.remove("visible"); // Hide the menu
        document.removeEventListener("click", closeMenuOnClickOutside); // ✅ Remove listener after closing
    }
}



function hideMainMenu() {
    const menu = document.querySelector(".menu-container");
    menu.classList.remove("visible");
}

/***********************
 * 
 * 
 * Add Event Listeners
 * 
 * 
 ************************/


menuButton.addEventListener("click", (event) => {
    event.stopPropagation(); // Prevents the event from closing the menu immediately
    saveToggleAutoReset();
    menu.classList.toggle("visible");

    // ✅ If the menu is now visible, add an event listener to close it when clicking outside
    if (menu.classList.contains("visible")) {
        document.addEventListener("click", closeMenuOnClickOutside);
    }
});

addTaskButton.addEventListener("click", () => {
    addTask(taskInput.value); // ✅ Passes the task text, not the event
});

taskInput.addEventListener("keypress", event => {
    if (event.key === "Enter") {
        addTask(taskInput.value); // ✅ Ensures only text is passed
    }
});


completeAllButton.addEventListener("click", () => {
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();
    const cycleData = savedMiniCycles[lastUsedMiniCycle];

    // ✅ Ensure there's an active Mini Cycle
    if (!lastUsedMiniCycle || !cycleData) return;

    if (cycleData.deleteCheckedTasks) {
        // ✅ Delete all checked tasks if the option is enabled
        document.querySelectorAll(".task input:checked").forEach(checkbox => {
            checkbox.closest(".task").remove();
        });

        autoSave(); // ✅ Save changes after deletion
    } else {
        // ✅ If "Delete Checked Tasks" is OFF, just mark all as complete
        taskList.querySelectorAll(".task input").forEach(task => task.checked = true);
        checkMiniCycle();
        
    // ✅ Always reset tasks, even if Auto Reset is off
    setTimeout(resetTasks, 1000);
    }

    
    updateProgressBar();
});


document.addEventListener("click", (event) => {
    let isTaskClick = event.target.closest(".task");

    if (!isTaskClick) {
        // Hide all task action buttons when clicking outside
        document.querySelectorAll(".task-options").forEach(action => {
            action.style.opacity = "0"; // Fade out
            action.style.visibility = "hidden"; // Fully hide
            action.style.pointerEvents = "none"; // Prevent accidental clicks
        });
    }
});


document.addEventListener("click", function(event) {
    const switchModalContent = document.querySelector(".mini-cycle-switch-modal-content");
    const selectedCycle = document.querySelector(".mini-cycle-switch-item.selected");
    const switchItemsRow = document.getElementById("switch-items-row");
    const previewWindow = document.querySelector(".switch-preview-window");

    // ✅ If user clicks inside the modal but outside a selected Mini Cycle AND NOT on the preview
    if (
        switchModalContent.contains(event.target) && 
        selectedCycle && 
        !event.target.classList.contains("mini-cycle-switch-item") &&
        !previewWindow.contains(event.target) // ✅ Prevents unselecting when clicking preview
    ) {
        selectedCycle.classList.remove("selected"); // ✅ Remove selection
        switchItemsRow.style.display = "none"; // ✅ Hide edit/delete buttons
    }
});






/***********************
 * 
 * 
 * STATS PANEL
 * 
 * 
 ************************/



let startX = 0;
let isSwiping = false;
let isStatsVisible = false;
const statsPanel = document.getElementById("stats-panel");
const taskView = document.getElementById("task-view");

// Detect swipe start
document.addEventListener("touchstart", (event) => {
    startX = event.touches[0].clientX;
    isSwiping = true;
});

// Detect swipe move
document.addEventListener("touchmove", (event) => {
    if (!isSwiping) return;
    let moveX = event.touches[0].clientX;
    let difference = startX - moveX;

    // Swipe left → Slide in Stats Panel, Slide out Task View
    if (difference > 50 && !isStatsVisible) {
        statsPanel.classList.add("show");  // Slide in stats
        statsPanel.classList.remove("hide"); // Ensure it's not hiding

        taskView.classList.add("hide"); // Slide out task list
        isStatsVisible = true;
        isSwiping = false;
    }

    // Swipe right → Slide out Stats Panel, Slide in Task View
    if (difference < -50 && isStatsVisible) {
        statsPanel.classList.add("hide");  // Slide out stats
        taskView.classList.remove("hide"); // Bring back task list
        isStatsVisible = false;
        isSwiping = false;
    }
});

// Reset swipe tracking
document.addEventListener("touchend", () => {
    isSwiping = false;
});



function updateStatsPanel() {
    let totalTasks = document.querySelectorAll(".task").length;
    let completedTasks = document.querySelectorAll(".task input:checked").length;
    let completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) + "%" : "0%";

    // ✅ Get the active Mini Cycle
    const { lastUsedMiniCycle, savedMiniCycles } = assignCycleVariables();

    let cycleCount = 0;
    if (lastUsedMiniCycle && savedMiniCycles[lastUsedMiniCycle]) {
        cycleCount = savedMiniCycles[lastUsedMiniCycle].cycleCount || 0; // ✅ Load count from Mini Cycle storage
    }

    // ✅ Update Stats Display
    document.getElementById("total-tasks").textContent = totalTasks;
    document.getElementById("completed-tasks").textContent = completedTasks;
    document.getElementById("completion-rate").textContent = completionRate;
    document.getElementById("mini-cycle-count").textContent = cycleCount; // ✅ Now updates per Mini Cycle
    document.getElementById("stats-progress-bar").style.width = completionRate;
}





// Hook into existing task functions to update stats when tasks change
document.getElementById("taskList").addEventListener("change", updateStatsPanel);
document.getElementById("addTask").addEventListener("click", updateStatsPanel);


const slideLeft = document.getElementById("slide-left");
const slideRight = document.getElementById("slide-right");


slideLeft.classList.add("hide");
slideLeft.classList.remove("show");

slideRight.addEventListener("click", () => {
    statsPanel.classList.add("show");
    statsPanel.classList.remove("hide");

    taskView.classList.add("hide");
    taskView.classList.remove("show");

    slideRight.classList.add("hide");
    slideRight.classList.remove("show");

    slideLeft.classList.add("show");
    slideLeft.classList.remove("hide");

    isStatsVisible = true;
});

slideLeft.addEventListener("click", () => {
    statsPanel.classList.add("hide");
    statsPanel.classList.remove("show");

    taskView.classList.add("show");
    taskView.classList.remove("hide");

    slideRight.classList.add("show");
    slideRight.classList.remove("hide");

    slideLeft.classList.add("hide");
    slideLeft.classList.remove("show");

    isStatsVisible = false;
});






});

