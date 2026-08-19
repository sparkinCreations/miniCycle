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

// Read task names from Schema 2.5 (`miniCycleData`).
//
// This used to read `lastUsedMiniCycle` + `miniCycleStorage` — the PRE-2.5 keys.
// The app stopped writing them at the schema migration, so the lookup always
// came back empty and the game silently fell back to its sample tasks. Nobody
// noticed because the fallback is indistinguishable from "you have no tasks",
// and because the game's own script was CSP-blocked until v2.429 so it never
// ran at all. Mirrors getTaskNames() in miniCycle-taskOrder.js, which was
// modernised when that game was extracted.
function getSchema25Data() {
  try {
    const raw = localStorage.getItem("miniCycleData");
    if (!raw) return null;
    const schemaData = JSON.parse(raw);
    if (!schemaData || schemaData.schemaVersion !== "2.5") return null;
    return schemaData;
  } catch (error) {
    console.error('Error reading Schema 2.5 data:', error);
    return null;
  }
}

function getTaskNames() {
  const schemaData = getSchema25Data();
  if (!schemaData) return [];

  const activeCycleId = schemaData.appState && schemaData.appState.activeCycleId;
  if (!activeCycleId) return [];

  const currentCycle = schemaData.data && schemaData.data.cycles && schemaData.data.cycles[activeCycleId];
  if (!currentCycle || !Array.isArray(currentCycle.tasks)) return [];

  return currentCycle.tasks
    .map(task => task.text)
    .filter(text => text && text.trim() !== "");
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
  
