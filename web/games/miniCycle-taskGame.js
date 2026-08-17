// miniCycle-taskGame.js — extracted from miniCycle- taskGame.html (Aug 2026).
// Inline scripts each need a CSP SHA-256 hash in three deployment configs;
// an external file needs none. Matches miniCycle-taskOrder.js, which was
// extracted earlier.
// Function to retrieve task names from localStorage (from your Task Cycle: Mini app)
function getTaskNames() {
  let taskNames = [];
  const miniCycleName = localStorage.getItem("lastUsedMiniCycle");
  if (miniCycleName) {
    const miniCycleStorage = JSON.parse(localStorage.getItem("miniCycleStorage")) || {};
    const currentCycle = miniCycleStorage[miniCycleName];
    if (currentCycle && Array.isArray(currentCycle.tasks)) {
      taskNames = currentCycle.tasks
        .map(task => task.text)
        .filter(text => text && text.trim() !== "");
    }
  }
  return taskNames;
}

// Fallback sample tasks if none are stored
let tasks = getTaskNames();
if (tasks.length === 0) {
  tasks = ["Inspect Part", "Check Serial", "Verify Job", "Record Number"];
}

let targetTask = "";
let score = 0;

// Function to randomly shuffle an array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Start a new round by selecting a target and generating options
function startRound() {
  document.getElementById("feedback").textContent = "";
  // Choose a random target task
  targetTask = tasks[Math.floor(Math.random() * tasks.length)];
  document.getElementById("displayTask").textContent = targetTask;

  // Create options: include the correct task and three others (if available)
  let options = [targetTask];
  // Pick additional tasks from the array without duplicates
  let otherTasks = tasks.filter(task => task !== targetTask);
  shuffleArray(otherTasks);
  for (let i = 0; i < 3 && i < otherTasks.length; i++) {
    options.push(otherTasks[i]);
  }
  // If there are not enough tasks, duplicate some to fill the options
  while (options.length < 4) {
    options.push(targetTask);
  }
  // Shuffle the options so the correct answer isn't always in the same place
  options = shuffleArray(options);

  // Render buttons for options
  const optionsContainer = document.getElementById("optionsContainer");
  optionsContainer.innerHTML = "";
  options.forEach(option => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = option;
    btn.addEventListener("click", function() {
      if (option.toLowerCase() === targetTask.toLowerCase()) {
        document.getElementById("feedback").textContent = "Correct! 🎉";
        score++;
      } else {
        document.getElementById("feedback").textContent = "Oops, try again! ❌";
      }
      document.getElementById("score").textContent = "Score: " + score;
      // Disable all buttons after an answer is chosen
      document.querySelectorAll(".option-btn").forEach(b => b.disabled = true);
    });
    optionsContainer.appendChild(btn);
  });
}

// Set up next round button
document.getElementById("nextRound").addEventListener("click", function() {
  startRound();
});

// Start the first round on page load
window.onload = startRound;
  
