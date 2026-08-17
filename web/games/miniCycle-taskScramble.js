// miniCycle-taskScramble.js — extracted from miniCycle-taskScramble.html (Aug 2026).
// Inline scripts each need a CSP SHA-256 hash in three deployment configs;
// an external file needs none. Matches miniCycle-taskOrder.js, which was
// extracted earlier.
// Scramble a string by shuffling its characters
function scrambleString(str) {
  let arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

// Retrieve task names from localStorage (from your Task Cycle: Mini app)
function getTaskNames() {
  let taskNames = [];
  const miniCycleName = localStorage.getItem("lastUsedMiniCycle");
  if (miniCycleName) {
    const miniCycleStorage = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const currentCycle = miniCycleStorage[miniCycleName];
    if (currentCycle && Array.isArray(currentCycle.tasks)) {
      // Extract non-empty task texts
      taskNames = currentCycle.tasks
        .map(task => task.text)
        .filter(text => text && text.trim() !== "");
    }
  }
  return taskNames;
}

// Get tasks, use fallback if none are found
let tasks = getTaskNames();
if (tasks.length === 0) {
  tasks = ["Sample Task", "Check Serial", "Verify Part", "Inspect Job"];
}

let currentTask = "";

// Load a new task: choose one randomly, scramble each word separately
function loadNewTask() {
  currentTask = tasks[Math.floor(Math.random() * tasks.length)];
  let scrambled = currentTask
    .split(' ')
    .map(word => scrambleString(word))
    .join(' ');
  document.getElementById("scrambledWord").textContent = scrambled;
  document.getElementById("feedback").textContent = "";
  document.getElementById("guessInput").value = "";
}

// Event listener for submitting the guess
document.getElementById("submitGuess").addEventListener("click", function () {
  const guess = document.getElementById("guessInput").value.trim();
  if (guess.toLowerCase() === currentTask.toLowerCase()) {
    document.getElementById("feedback").textContent = "Correct! 🎉";
  } else {
    document.getElementById("feedback").textContent = "Try again! ❌";
  }
});

// Event listener for moving to the next task
document.getElementById("nextTask").addEventListener("click", function () {
  loadNewTask();
});

// Load a new task when the page loads
window.onload = loadNewTask;
  
