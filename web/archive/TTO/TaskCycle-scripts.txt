let currentTaskElement = null; 
let dragDirection = null;
let stopWatchInterval; 
let timeInSeconds = 0;
let taskNumber = 1;
let checkboxCounter = 1;
let subtaskCounter = 0;
let subtaskCountermain = 0;
let checkboxContainermain;
let counter = 0;
var errorN = 1;
let selectedTask = null;
let draggedItem = 0;
let isRearrangeModeActive = false;
let activeRearrangeTask = null;
let activeTask = null;
let isStopWatchRunning = false; 
let startTime = null; 
let elapsedTime = 0; 
let isResetting = false; 

document.addEventListener('DOMContentLoaded', (event) => {
  console.log("DOM fully loaded and parsed");
    attachEventListeners();
   /* startupPage();*/
  
});
document.getElementById('open-app-button').addEventListener('click', () => {
    const app = document.getElementById('app'); 
    const startupPage = document.getElementById('startup-page'); 

    startupPage.classList.add('hidden-startup');
    startupPage.classList.remove('visible-startup');
    app.classList.remove('hidden-app');
    app.classList.add('visible-app');
});

document.getElementById('exit-to-home-page').addEventListener('click', () => {
    const app = document.getElementById('app'); 
    const startupPage = document.getElementById('startup-page');

    startupPage.classList.remove('hidden-startup');
    startupPage.classList.add('visible-startup');
    app.classList.add('hidden-app');
    app.classList.remove('visible-app');
});





function attachEventListeners(){
  // DOM element references and global variables
  const stopWatchToggleButton = document.getElementById('stop-watch-toggle-button');
  const stopWatchToggleButton2 = document.getElementById('stop-watch-toggle-2-button');
  const stopWatchTimerToggleButtonsRow = document.getElementById('stop-watch-timer-buttons-row-container');
  const timerToggleButton = document.getElementById("timer-toggle-button");
  const timerToggleButton2 = document.getElementById("timer-toggle-2-button");
  const timerContainer = document.getElementById("timer-container");
  const timerCloseButton = document.getElementById("timer-close-button");
const stopWatchContainer = document.getElementById('stop-watch-container');
const notesButton = document.getElementById('notes-button');
const notesPanel = document.getElementById('notes-panel');
const savedNotesState = localStorage.getItem('notesPanelState');
const addNoteButton = document.getElementById('add-note');
const newNoteTextarea = document.getElementById('new-note-textarea');
const notesList = document.getElementById('notes-list');
const closeButton = document.getElementById('close-notes');
const menuRearrange = document.getElementById('menuRearrange');
const detailsTextarea = document.getElementById('detailsTextarea');
const editDetailsButton = document.getElementById('editDetailsButton');  
const addButton = document.getElementById('add-button');
const completeButton = document.getElementById('complete-button');
const completeTooltip = document.getElementById('complete-button-tooltip');
const errorMessage = document.getElementById('error-message');
const newCheckboxLabelInput = document.getElementById('new-checkbox-label');
const checkboxList = document.getElementById('checkbox-list');
const completeMessage = document.getElementById('complete-message');
const resetButton = document.getElementById('reset-button');
const counterDiv = document.getElementById('counter');
const counterContainer = document.getElementById('counter-container');
const detailsModal = document.getElementById('detailsModal');
const newCycleButton = document.getElementById('new-cycle'); 
const progressBar = document.getElementById('progress-bar');
const mainMenuButton = document.getElementById('main-menu-button');
const closeStopWatchButton = document.getElementById('close-stop-watch-button');

updateCounter(); // Assuming you have this function defined elsewhere

  const timeline = document.getElementById('timeline-content');
    const modal = document.getElementById('entry-modal');
    const modalContent = modal.querySelector('.entry-text');
    const closeModal = modal.querySelector('.close');
    const prevButton = modal.querySelector('.prev');
    const nextButton = modal.querySelector('.next');
    let currentEntryIndex = -1;

    function updateModalContent(index) {
        const entries = Array.from(timeline.getElementsByClassName('timeline-entry'));
        if (index >= 0 && index < entries.length) {
            modalContent.textContent = entries[index].textContent;
            currentEntryIndex = index;
        }
    }
   // Add click event to the "New" button
   newCycleButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to start a new task cycle? All current tasks will be lost.")) {
        // Clear the task list
        checkboxList.innerHTML = '';

        // Reset task counters
        taskNumber = 1;
        checkboxCounter = 1;
        subtaskCounter = 0;

        // Hide any completion messages
        completeMessage.style.display = 'none';

        // Reset progress bar
        progressBar.style.width = '0%';

        alert("New task cycle created!");
    }
});


    timeline.addEventListener('click', (e) => {
        if (e.target.classList.contains('timeline-entry')) {
            const entries = Array.from(timeline.getElementsByClassName('timeline-entry'));
            const index = entries.indexOf(e.target);
            updateModalContent(index);
            modal.style.display = 'block';
        }
    });

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    prevButton.addEventListener('click', () => {
        updateModalContent(currentEntryIndex - 1);
    });

    nextButton.addEventListener('click', () => {
        updateModalContent(currentEntryIndex + 1);
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

/*
// Detect orientation change
window.addEventListener("orientationchange", function () {
  if (window.orientation === 90 || window.orientation === -90) {
      alert("Please use this app in portrait mode.");
  }
});

// On page load
if (window.innerWidth > window.innerHeight) {
  alert("Please rotate your device to portrait mode.");
}
*/
    
/*TTO-1

    newCheckboxLabelInput.addEventListener('blur', () => {
      // Ensure the input field is hidden
      newCheckboxLabelInput.style.display = 'none';
  });
  
  newCheckboxLabelInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
          // Prevent further blur issues
          newCheckboxLabelInput.removeEventListener('blur', createCheckboxIfNotEmpty);
          createCheckboxIfNotEmpty(); // Create the task
          newCheckboxLabelInput.style.display = 'none'; // Hide the input field
          event.preventDefault();
      }
  });
  
*/


/*  TTO-1
    document.getElementById('add-button').addEventListener('click', () => {
      const newCheckboxLabelInput = document.getElementById('new-checkbox-label');
      const completeButton = document.getElementById('complete-button');
      const taskWindow = document.getElementById('checkbox-list'); // The container for tasks
  
      // Get the bounding rectangles of the Complete button and task window
      const completeButtonRect = completeButton.getBoundingClientRect();
      const taskWindowRect = taskWindow.getBoundingClientRect();
  
      // Set input position dynamically below the Complete button and centered to task window
      newCheckboxLabelInput.style.position = 'absolute';
      newCheckboxLabelInput.style.top = `${completeButtonRect.bottom + window.scrollY + 30}px`; // 30px below Complete button
      newCheckboxLabelInput.style.left = `${taskWindowRect.left + taskWindowRect.width / 2 - newCheckboxLabelInput.offsetWidth / 2}px`; // Centered horizontally
      newCheckboxLabelInput.style.display = 'block';
  
      // Ensure the label input appears fully rendered before calculating width
      setTimeout(() => {
          newCheckboxLabelInput.style.left = `${taskWindowRect.left + taskWindowRect.width / 2 - newCheckboxLabelInput.offsetWidth / 2}px`;
      }, 0);
  
      newCheckboxLabelInput.focus();
  });
  
*/








    // Load Pro version state
let isProVersion = JSON.parse(localStorage.getItem('isProVersion')) || false;

mainMenuPanel();


function mainMenuPanel() {
    const menuPanel = document.getElementById('menu-panel');
    const settingsMenu = document.getElementById('settings-menu');
    const settingsButton = document.getElementById('open-settings');
    const closeSettingsButton = document.getElementById('close-settings');


    // Elements
const proToggle = document.getElementById('pro-version-toggle');
const proLabel = document.getElementById('pro-version-label');

// Initialize toggle state
proToggle.checked = isProVersion;
proLabel.textContent = isProVersion ? 'Pro Version Enabled' : 'Switch to Pro';

// Toggle Pro version
proToggle.addEventListener('change', () => {
    isProVersion = proToggle.checked;

    if (isProVersion) {
        alert('Pro Version Activated! Enjoy unlimited savings!');
        proLabel.textContent = 'Pro Version Enabled';
    } else {
        alert('Switched to Free Version. Save limit applied.');
        proLabel.textContent = 'Switch to Pro';
    }

    // Save state to localStorage
    localStorage.setItem('isProVersion', JSON.stringify(isProVersion));
});

    // Toggle Main Menu visibility
    mainMenuButton.addEventListener('click', () => {
        if (menuPanel.classList.contains('hidden')) {
            menuPanel.classList.remove('hidden');
            menuPanel.classList.add('show'); // Add the show class for smooth animation
            settingsMenu.classList.add('hidden'); // Ensure settings menu is hidden
        } else {
            menuPanel.classList.remove('show');
            menuPanel.classList.add('hidden');
        }
    });

    
// Close the menu panel when clicking outside of it
document.addEventListener('click', (event) => {
  const isClickInsideMenu = menuPanel.contains(event.target);
  const isClickOnMenuButton = mainMenuButton.contains(event.target);

  if (!isClickInsideMenu && !isClickOnMenuButton) {
      menuPanel.classList.remove('show');
      menuPanel.classList.add('hidden');
  }
});


    // Toggle Settings Menu visibility
    settingsButton?.addEventListener('click', () => {
        if (settingsMenu.classList.contains('hidden')) {
            settingsMenu.classList.remove('hidden');
            settingsMenu.classList.add('show'); // Add the show class for smooth animation
            menuPanel.classList.add('hidden'); // Ensure main menu is hidden
        } else {
            settingsMenu.classList.remove('show');
            settingsMenu.classList.add('hidden');
        }
    });

    // Close Settings Menu
    closeSettingsButton?.addEventListener('click', () => {
        settingsMenu.classList.remove('show');
        settingsMenu.classList.add('hidden');
    });
    
        // Enhanced Load Task Cycle
        document.getElementById('load-cycle')?.addEventListener('click', () => {
            const savedCycles = JSON.parse(localStorage.getItem('taskCycles')) || [];
            if (savedCycles.length === 0) {
                alert('No saved task cycles found.');
                return;
            }
    
            // Load the original "cycle list" container
            let cycleListContainer = document.getElementById('cycle-list-container');
            if (!cycleListContainer) {
                cycleListContainer = document.createElement('div');
                cycleListContainer.id = 'cycle-list-container';
                cycleListContainer.style.cssText = `
                    position: fixed;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 10px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    z-index: 1000;
                `;
                document.body.appendChild(cycleListContainer);
            }
            cycleListContainer.innerHTML = ''; // Clear previous content
    
            // Title
            const title = document.createElement('h3');
            title.textContent = 'Saved Task Cycles';
            cycleListContainer.appendChild(title);
    
            // File Actions (Delete/Rename Buttons)
            const fileActions = document.createElement('div');
            fileActions.id = 'file-actions';
            fileActions.innerHTML = `
                <button id="delete-files">Delete</button>
                <button id="rename-files">Rename</button>
            `;
            cycleListContainer.appendChild(fileActions);
    
            const listContainer = document.createElement('div');
            listContainer.id = 'file-list-container';
            cycleListContainer.appendChild(listContainer);
    
            // Close Button
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            closeButton.addEventListener('click', () => {
                cycleListContainer.style.display = 'none';
            });
            cycleListContainer.appendChild(closeButton);
    
            // Render the List
            const renderList = (cycles) => {
                listContainer.innerHTML = ''; // Clear content
                const list = document.createElement('ul');
                cycles.forEach((cycle, index) => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `${cycle.name} (Modified: ${new Date(cycle.timestamp).toLocaleString()})`;
                    listItem.addEventListener('click', () => {
                        document.querySelector('#checkbox-list').innerHTML = '';
                        cycle.tasks.forEach(({ task, subtasks }) => {
                            addTask(task);
                            subtasks.forEach(({ name, completed }) => addSubtask(task, name, completed));
                        });
                        alert(`Task cycle "${cycle.name}" loaded successfully!`);
                        cycleListContainer.style.display = 'none';
                    });
                    list.appendChild(listItem);
                });
                listContainer.appendChild(list);
            };
    
            renderList(savedCycles);
            cycleListContainer.style.display = 'block';
        });
    
    }
    



    let currentCycleName = null; // Track the name of the currently saved file

    const saveCycle = () => {
        const tasks = document.querySelectorAll('.checkbox-container-main');
        const taskCycle = [];
    
        // Collect tasks and subtasks
        tasks.forEach(task => {
            const taskLabel = task.querySelector('.checkbox-label').textContent;
            const subtasks = Array.from(task.querySelectorAll('.subtask-checkbox')).map(subtask => ({
                name: subtask.nextElementSibling.textContent,
                completed: subtask.checked
            }));
            taskCycle.push({ task: taskLabel, subtasks });
        });
    
        const savedCycles = JSON.parse(localStorage.getItem('taskCycles')) || [];
    
        if (!currentCycleName) {
            // Prompt user for a file name on first save
            currentCycleName = prompt('Enter a name for this task cycle:');
            if (!currentCycleName) return; // Exit if no name is entered
        }
    
        // Check if the cycle already exists
        const existingIndex = savedCycles.findIndex(cycle => cycle.name === currentCycleName);
        if (existingIndex !== -1) {
            // Update existing file
            savedCycles[existingIndex] = {
                name: currentCycleName,
                tasks: taskCycle,
                timestamp: new Date().toISOString()
            };
        } else {
            // Save new file
            savedCycles.push({
                name: currentCycleName,
                tasks: taskCycle,
                timestamp: new Date().toISOString()
            });
        }
    
        // Save to localStorage
        localStorage.setItem('taskCycles', JSON.stringify(savedCycles));
        alert(`Task cycle "${currentCycleName}" saved successfully!`);
    };
    
    const saveCycleAs = () => {
        // Always prompt for a new file name
        const newCycleName = prompt('Enter a new name for this task cycle:');
        if (!newCycleName) return;
    
        const tasks = document.querySelectorAll('.checkbox-container-main');
        const taskCycle = [];
    
        tasks.forEach(task => {
            const taskLabel = task.querySelector('.checkbox-label').textContent;
            const subtasks = Array.from(task.querySelectorAll('.subtask-checkbox')).map(subtask => ({
                name: subtask.nextElementSibling.textContent,
                completed: subtask.checked
            }));
            taskCycle.push({ task: taskLabel, subtasks });
        });
    
        const savedCycles = JSON.parse(localStorage.getItem('taskCycles')) || [];
    
        savedCycles.push({
            name: newCycleName,
            tasks: taskCycle,
            timestamp: new Date().toISOString()
        });
    
        // Save to localStorage and update the current cycle name
        localStorage.setItem('taskCycles', JSON.stringify(savedCycles));
        currentCycleName = newCycleName;
        alert(`Task cycle "${newCycleName}" saved successfully!`);
    };
    
    // Connect the Save/Save As buttons to their functions
    document.getElementById('save-cycle').addEventListener('click', saveCycle);
    document.getElementById('save-as-cycle').addEventListener('click', saveCycleAs);
  

  document.getElementById('load-cycle')?.addEventListener('click', () => {
    loadCycle();
});

    





function updateBarChart() {
    const barChartContainer = document.getElementById('bar-chart-container');
    const ctx = document.getElementById('bar-chart').getContext('2d');
    const taskContainers = document.querySelectorAll('.checkbox-container-main');
    const labels = [];
    const completedData = [];
    const uncompletedData = [];
  
    let subtasksExist = false;
  
    // Collect task labels and completion percentages
    taskContainers.forEach(taskContainer => {
        const taskLabel = taskContainer.querySelector('.checkbox-label').textContent;
        const subtasks = taskContainer.querySelectorAll('.subtask-checkbox');
        const completedSubtasks = taskContainer.querySelectorAll('.subtask-checkbox:checked').length;
  
        if (subtasks.length > 0) {
            const totalSubtasks = subtasks.length;
            const completedPercentage = (completedSubtasks / totalSubtasks) * 100;
            const uncompletedPercentage = 100 - completedPercentage;
  
            labels.push(taskLabel);
            completedData.push(completedPercentage);
            uncompletedData.push(uncompletedPercentage);
            subtasksExist = true;
        }
    });
  
    // Hide the chart if no subtasks exist
    if (!subtasksExist) {
        barChartContainer.style.display = 'none';
        return;
    }
  
    barChartContainer.style.display = 'block';
  
    // Destroy existing chart instance if it exists
    if (window.myBarChart) {
        window.myBarChart.destroy();
    }
  
    // Create a horizontal bar chart
    window.myBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Subtasks Completed',
                    data: completedData,
                    backgroundColor: '#4790df',
                    borderWidth: 1,
                    barThickness: 15, // Thinner bars for better spacing
                    borderRadius: 5 // Rounded corners
                },
                {
                    label: 'Pending',
                    data: uncompletedData,
                    backgroundColor: '#e74c3c',
                    borderWidth: 1,
                    barThickness: 15, // Thinner bars for better spacing
                    borderRadius: 5 // Rounded corners
                }
            ]
        },
        options: {
            indexAxis: 'y', // Keeps the bars horizontal
            responsive: true, // Makes the chart responsive
            maintainAspectRatio: false, // Prevents fixed aspect ratio
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    stacked: true, // Stack the bars
                    grid: {
                        display: false // Hides gridlines
                    },
                    ticks: {
                        font: {
                            size: 12 // Adjust font size for clarity
                        }
                    }
                },
                y: {
                    stacked: true, // Stack the bars
                    grid: {
                        display: false // Hides gridlines
                    },
                    ticks: {
                        font: {
                            size: 12 // Adjust font size for clarity
                        },
                        padding: 10 // Add padding between labels
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true, // Use circle icons
                        boxWidth: 10, // Adjust icon size
                        padding: 20 // Add spacing between legend items
                    }
                },
                tooltip: {
                    enabled: true // Keep tooltips enabled
                }
            },
            layout: {
                padding: {
                    top: 20,
                    bottom: 10,
                    left: 10,
                    right: 10
                }
            }
        }
    });
  }
  



function updateStatistics() {
  // TASK STATS
  const totalTasks = document.querySelectorAll('.checkbox-container').length;
  const completedTasks = document.querySelectorAll('.checkbox-container.completed').length;
  const pendingTasks = totalTasks - completedTasks;

  // SUBTASK STATS
  const totalSubtasks = document.querySelectorAll('.subtask-checkbox').length;
  const completedSubtasks = document.querySelectorAll('.subtask-checkbox:checked').length;
  const pendingSubtasks = totalSubtasks - completedSubtasks;


  
  // WEIGHTED CALCULATIONS
  const mainTasks = document.querySelectorAll('.checkbox-container-main');
  let totalWeight = 0;
  let completedWeight = 0;

  mainTasks.forEach((taskContainer) => {
      const mainTask = taskContainer.querySelector('.checkbox-container');
      const subtasks = taskContainer.querySelectorAll('.subtask-checkbox');
      const completedSubtasks = taskContainer.querySelectorAll('.subtask-checkbox:checked');

      totalWeight += 1; // Each main task contributes a weight of 1
      if (mainTask.classList.contains('completed')) {
          completedWeight += 1; // Fully completed task contributes fully
      } else if (subtasks.length > 0) {
          completedWeight += completedSubtasks.length / subtasks.length; // Partial contribution from subtasks
      }
  });

  // COMPLETION PERCENTAGE
  const completionPercentage = ((completedWeight / totalWeight) * 100).toFixed(2);

  // UPDATE TASK STATS IN DOM
  const statsContent = document.getElementById('stats-content-tasks');
  let statsHTML = `
      <div>
          <h3>Tasks Overview</h3>
          <p><span>Total Tasks:</span> ${totalTasks}</p>
          <p class="completed"><span>Completed Tasks:</span> ${completedTasks}</p>
          <p class="pending"><span>Pending Tasks:</span> ${pendingTasks}</p>
      </div>
  `;

  statsContent.innerHTML = statsHTML;

  // UPDATE COMPLETION PERCENTAGE IN DOM
  const percentageContainer = document.getElementById('completion-percentage');
  percentageContainer.innerHTML = `
      <span class="percentage-label">Current Task Cycle Completion</span>
      <span class="percentage-number">${completionPercentage}%</span>
  `;

  // PIE CHART DATA
  const pieChartData = {
      labels: ['Tasks Completed', 'Pending'],
      values: [completedWeight, totalWeight - completedWeight], // Use weighted metrics
  };
  renderPieChart(pieChartData);

  const totalTaskCycles = counter;
  const statsTaskCycles = document.getElementById('stats-content-taskcycles');
  let statsTotalTaskCycles = `
      <div class="task-cycle-container">
          <p><span class="stats-total-task-cycles">Total Task Cycles Completed:</span> ${totalTaskCycles}</p>
      </div>
  `;
  
  statsTaskCycles.innerHTML = statsTotalTaskCycles;
  
  // Optional: Add conditional styling
  if (totalTaskCycles > 10) {
      statsTaskCycles.classList.add('highlight');
  } else {
      statsTaskCycles.classList.remove('highlight');
  }
  


}





function renderPieChart(data) {
  const container = document.getElementById('pie-chart-container');
  container.innerHTML = ''; // Clear previous chart

  const canvas = document.createElement('canvas');
  canvas.id = 'stats-chart';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  new Chart(ctx, {
      type: 'doughnut',
      data: {
          labels: data.labels,
          datasets: [{
              data: data.values,
              backgroundColor: ['#4790df', '#e74c3c'], // Completed and Pending colors
              borderColor: 'white',
              borderWidth: 2,
          }],
      },
      options: {
          responsive: true,
          cutout: '60%', //Adjust inner radius
          plugins: {
              legend: {
                  position: 'bottom',
              },
          },
      },
  });
}


document.getElementById('chart-button').addEventListener('click', () => {
  const statsWindow = document.getElementById('stats-window');
  statsWindow.classList.toggle('show');

  if (statsWindow.classList.contains('show')) {
      updateStatistics();  // Update Task Stats
      updateSubtaskStats();  // Update Subtask Stats
      updateBarChart();  // Update Bar Chart
      displayStats(); // Update the stats content
  }
});

const statsButton = document.getElementById('chart-button'); // The button that opens the stats panel
const statsPanel = document.getElementById('stats-window');   // The stats panel container


// Close the stats panel when clicking outside of it
document.addEventListener('click', (event) => {
    const isClickInsideStats = statsPanel.contains(event.target);
    const isClickOnStatsButton = statsButton.contains(event.target);

    // Close the panel if the click is outside the stats panel and the stats button
    if (!isClickInsideStats && !isClickOnStatsButton) {
        statsPanel.classList.remove('show');
        statsPanel.classList.add('hidden');
    }
});



function updateSubtaskStats() {
  const subtaskStatsContainer = document.getElementById('stats-content-subtasks');
  const subtaskPanel = document.getElementById('subtasks-overview'); // Subtask panel container
  const allMainTasks = document.querySelectorAll('.checkbox-container-main');
  let tasksWithSubtasksCount = 0;

  // Count tasks with subtasks
  allMainTasks.forEach(task => {
      const subtasks = task.querySelectorAll('.subtask-checkbox');
      if (subtasks.length > 0) {
          tasksWithSubtasksCount++;
      }
  });

  const totalSubtasks = document.querySelectorAll('.subtask-checkbox').length;
  const completedSubtasks = document.querySelectorAll('.subtask-checkbox:checked').length;

  // Check if subtasks exist
  if (totalSubtasks === 0) {
      subtaskStatsContainer.classList.add('hidden'); // Hide stats content
      subtaskPanel.classList.add('hidden'); // Hide the entire subtask panel (including border)
      return;
  }

  subtaskStatsContainer.classList.remove('hidden'); // Show stats content
  subtaskPanel.classList.remove('hidden'); // Show the subtask panel (including border)

  const pendingSubtasks = totalSubtasks - completedSubtasks;

  // Update HTML content for subtask stats
  subtaskStatsContainer.innerHTML = `
      <div>
          <h3>Subtask Overview</h3>
          <p><span>Total Tasks with Subtasks:</span> ${tasksWithSubtasksCount}</p>
          <p><span>Total Subtasks:</span> ${totalSubtasks}</p>
          <p class="completed"><span>Completed Subtasks:</span> ${completedSubtasks}</p>
          <p class="pending"><span>Pending Subtasks:</span> ${pendingSubtasks}</p>
      </div>
  `;
}








function updateStatsButtonVisibility() {
  const totalTasks = document.querySelectorAll('.checkbox-container').length;
  const statsButton = document.getElementById('chart-button');
  
  if (totalTasks > 0) {
      statsButton.style.display = 'block'; // Show the button
  } else {
      statsButton.style.display = 'none'; // Hide the button
  }
}





  
    // Event listener for close button in stats window
    document.getElementById('close-stats').addEventListener('click', function() {
        document.getElementById('stats-window').classList.remove('show');
    });

// Event listener for 'View Timeline' button
document.getElementById('view-timeline-button').addEventListener('click', () => {
  const timeline = document.getElementById('timeline');
  const timelineContent = document.getElementById('timeline-content');
  const viewTimelineButton = document.getElementById('view-timeline-button');
  const closeTimelineButton = document.getElementById('close-timeline-button');

  // Show the timeline and hide the button
  timeline.classList.remove('hidden');
  viewTimelineButton.classList.add('hidden');
  closeTimelineButton.classList.remove('hidden');

      // Scroll to the bottom of the timeline
      timelineContent.scrollTop = timelineContent.scrollHeight;
});

// Event listener for 'Close Timeline' button
document.getElementById('close-timeline-button').addEventListener('click', () => {
  const timeline = document.getElementById('timeline');
  const viewTimelineButton = document.getElementById('view-timeline-button');
  const closeTimelineButton = document.getElementById('close-timeline-button');

  // Hide the timeline and show the button
  timeline.classList.add('hidden');
  viewTimelineButton.classList.remove('hidden');
  closeTimelineButton.classList.add('hidden');
});

// Reset timeline visibility when opening the stats window
document.getElementById('chart-button').addEventListener('click', () => {
  const timeline = document.getElementById('timeline');
  const closeTimelineButton = document.getElementById('close-timeline-button');
  const viewTimelineButton = document.getElementById('view-timeline-button');

  // Ensure the timeline is hidden and the button is visible
  timeline.classList.add('hidden');
  closeTimelineButton.classList.add('hidden');
  viewTimelineButton.classList.remove('hidden');
});

    
function addToTimeline(action, description, entryType, existingTimestamp = null) {
  const timeline = document.getElementById('timeline-content');
  const timestamp = existingTimestamp || new Date().toLocaleString(); // Use the existing timestamp if provided
  const entry = document.createElement('div');

  // Add the 'timeline-entry' class and the specific type class (if provided)
  entry.classList.add('timeline-entry');
  if (entryType) {
    entry.classList.add(entryType);
  }

  // Construct the entry's inner HTML
  entry.innerHTML = `<strong>${timestamp}</strong>: ${action} - ${description}`;

  // Append the new entry to the timeline
  timeline.appendChild(entry);

  // Add click listener to the entry
  entry.addEventListener('click', () => {
    showPopup(entry);
  });

  // Save the timeline to localStorage
  saveTimelineToLocalStorage();

  // Update the visibility of the clear button after adding an entry
  updateClearButtonVisibility();
}


// Function to update the visibility of the clear button
function updateClearButtonVisibility() {
  const timelineEntries = document.querySelectorAll('.timeline-entry');
  const clearButton = document.getElementById('clear-timeline-button');
  if (timelineEntries.length > 0) {
      clearButton.classList.add('visible');
  } else {
      clearButton.classList.remove('visible');
  }
}

// Function to clear the timeline
function clearTimeline() {
  const timeline = document.getElementById('timeline-content'); // Adjust ID as per your timeline container
  timeline.innerHTML = ''; // Clear all entries
  updateClearButtonVisibility(); // Update button visibility
}

// Event listener for the clear button
document.getElementById('clear-timeline-button').addEventListener('click', clearTimeline);

// Call updateClearButtonVisibility initially and after every operation



/*
document.querySelector('#checkbox-list').addEventListener('change', () => {
  checkIfAllTasksComplete(); // Check if all tasks are completed
});
*/


//This creates the subtask window
function addSubtaskContainer(id, priority = '') {
  // Create a container for the subtasks (to be scrollable)
  let subtasksScrollContainer = document.createElement('div');
  subtasksScrollContainer.className = 'subtasks-scroll-container';

  // Create a container for the subtask
  let subtaskContainer = document.createElement('div');
  subtaskContainer.className = 'subtask-container hidden';
  subtaskContainer.id = id + '-container';

  // Add data-task-id to the subtask container
  subtaskContainer.setAttribute('data-task-id', id);

  // Create a container to hold all subtask rows
  let subtaskList = document.createElement('div');
  subtaskList.className = 'subtask-list';

  const addSubtaskButton = document.createElement('button');
  addSubtaskButton.textContent = 'Add Subtask';
// Add event listener for logging generic timeline event
addSubtaskButton.addEventListener('click', () => {
  logGenericSubtaskCreation(); // Log that a subtask was created
});

  addSubtaskButton.addEventListener('click', () => {
    const newSubtaskLabelID = `Subtask${subtaskCounter}`;
    addSubtaskCheckbox(newSubtaskLabelID, "", subtaskContainer, true);
  });

  const completeTaskButton = document.createElement('button');
  completeTaskButton.textContent = 'Complete Task';
  completeTaskButton.className = 'complete-task-button hidden'; // initially hidden
  completeTaskButton.addEventListener('click', () => {
    toggleTaskCompletion(completeTaskButton, subtaskContainer);
  });

  // Modify the class of subtaskContainer based on priority
  if (priority === 'high') {
    subtaskContainer.classList.add('subtask-container-high');
  } else if (priority === 'low') {
    subtaskContainer.classList.add('subtask-container-low');
  }

  // Append the subtask list to the subtaskContainer
  subtaskContainer.appendChild(subtaskList);

  // Append the scrollable container for subtasks
  subtaskContainer.appendChild(subtasksScrollContainer);

  // Append the button to add more subtasks
  subtaskContainer.appendChild(addSubtaskButton);

  // Append the complete task button
  subtaskContainer.appendChild(completeTaskButton);

  // Attach the subtaskContainermain to checkboxContainermain
  checkboxContainermain.appendChild(subtaskContainer);
}











function addSubtaskCheckbox(_id, label, subtaskContainer, isNew = false) {
    console.log('addSubtaskCheckbox created');
    const subtaskList = subtaskContainer.querySelector('.subtask-list');
    
    // Create a container for each subtask
    let subtaskRow = document.createElement('div');
    subtaskRow.className = 'subtask-row';

    
    // Add a unique data-subtask-id to the subtask row
    subtaskRow.setAttribute('data-subtask-id', `subtask-${subtaskCounter}`);
  
    // Add data-task-id to the subtask row (inherit from parent container)
    const parentTaskId = subtaskContainer.getAttribute('data-task-id');
    subtaskRow.setAttribute('data-task-id', parentTaskId);
  
    // Create the checkbox for the main subtask
    let subtaskCheckbox = document.createElement('input');
    subtaskCheckbox.type = 'checkbox';
    subtaskCheckbox.id = 'subtask-main-' + subtaskCounter;
    subtaskCheckbox.className = 'subtask-checkbox';
    subtaskCheckbox.addEventListener('change', function () {
      handleSubtaskChange(subtaskContainer);
    });
  
    // Create the label for the main subtask
    const subtaskLabel = document.createElement('label');
    subtaskLabel.setAttribute('for', subtaskCheckbox.id);
    subtaskLabel.className = 'subtask-label';
    subtaskLabel.textContent = label;

  
  
    if (isNew) {
      editSubtaskName(subtaskLabel);
    }
  
    // Create the "Rename" button for the subtask
    const renameButton = document.createElement('button');
    renameButton.innerHTML = '<i class="fas fa-edit"></i>';
    renameButton.addEventListener('click', function () {
      editSubtaskName(subtaskLabel);
    });
  


  function editSubtaskName(labelElement, subtaskContainer) {
    const currentText = labelElement.textContent;
    labelElement.textContent = ''; // Clear current label

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'edit-input';
    editInput.value = currentText;

    // Set placeholder
    editInput.placeholder = "Enter Subtask Name";

    // Handle blur event
    editInput.addEventListener('blur', () => {
        const newSubtaskName = editInput.value.trim() !== '' ? editInput.value : currentText;
        labelElement.textContent = newSubtaskName; 
        editInput.remove();
        

        // Add to the timeline if the name changed
        if (newSubtaskName !== currentText) {
            addToTimeline('Subtask Name Set', newSubtaskName, 'edited');
        }

    });

    // Listen for Enter key press
    editInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            editInput.blur(); // Trigger the blur event to finalize the name
        }
        
    });

    labelElement.appendChild(editInput);
    editInput.focus();
}
  
    // Create the "Delete" button for the subtask
    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.addEventListener('click', function () {
      const subtaskLabel = subtaskRow.querySelector('.subtask-label').textContent;
      addToTimeline('Subtask Deleted', subtaskLabel);
      updateClearButtonVisibility();
  
      subtaskRow.remove();
      const remainingSubtasks = subtaskContainer.querySelectorAll('.subtask-row');
      const parentContainerMain = subtaskContainer.closest('.checkbox-container-main');
      const mainCheckboxContainer = parentContainerMain.querySelector('.checkbox-container');
      const completeTaskButton = parentContainerMain.querySelector('.complete-task-button');
    
      if (remainingSubtasks.length === 0) {
        resetTaskProgress(mainCheckboxContainer); 
        // Reset task completion status and update button state
        mainCheckboxContainer.classList.remove('completed', 'manually-completed');
        completeTaskButton.textContent = 'Complete Task';
        completeTaskButton.classList.add('hidden');
        subtaskContainer.classList.add('hidden');
    
        // Reset background color and update progress
        mainCheckboxContainer.style.backgroundColor = '';
        updateProgressColor(mainCheckboxContainer);
      } else {
        // Adjust visibility of 'Complete Task' button
        if (remainingSubtasks.length < 2) {
          completeTaskButton.classList.add('hidden');
        } else {
          completeTaskButton.classList.remove('hidden');
        }
      }
      handleSubtaskChange(subtaskContainer);
    });

  
  
    // Append the checkbox, label, rename button, and delete button to the subtaskRow
    subtaskRow.appendChild(subtaskCheckbox);
    subtaskRow.appendChild(subtaskLabel);
    subtaskRow.appendChild(renameButton);
    subtaskRow.appendChild(deleteButton);
  
    // Append the subtask row to the subtask list
    subtaskList.appendChild(subtaskRow);
  


    
   // After adding a subtask, check the number of subtasks
   const totalSubtasks = subtaskContainer.querySelectorAll('.subtask-row').length;
   const completeTaskButton = subtaskContainer.querySelector('.complete-task-button');
   const mainCheckboxContainer = subtaskContainer.closest('.checkbox-container-main').querySelector('.checkbox-container');
  
   if (totalSubtasks === 1) {
    completeTaskButton.classList.add('hidden');
    mainCheckboxContainer.classList.remove('completed', 'manually-completed');
    updateProgressColor(mainCheckboxContainer);
  } else {
    completeTaskButton.classList.remove('hidden');
  }

  // Call handleSubtaskChange to update the progress bar and other UI elements
  handleSubtaskChange(subtaskContainer);

  
    // Increment the subtask counter
    subtaskCounter++;
  }



  function logGenericSubtaskCreation() {
    addToTimeline('A new subtask was created', null, 'info');
}





  
  function updateProgressBar() {
    let totalTasks = 0;
    let completedTasksWeight = 0;
  
    const mainTaskContainers = document.querySelectorAll('.checkbox-container-main');
  
    mainTaskContainers.forEach(container => {
      const mainTaskCompleted = container.querySelector('.checkbox-container').classList.contains('completed');
      const subtasks = container.querySelectorAll('.subtask-checkbox');
      const completedSubtasks = container.querySelectorAll('.subtask-checkbox:checked');
      
      // Each main task, regardless of the number of subtasks, has a weight of 1
      totalTasks += 1;
  
      if (mainTaskCompleted) {
        // If the main task is completed, it contributes its full weight
        completedTasksWeight += 1;
      } else if (subtasks.length > 0) {
        // If the main task is not completed, each completed subtask contributes a fraction of the main task's weight
        completedTasksWeight += (completedSubtasks.length / subtasks.length);
      }
    });
  
    const completionPercentage = (completedTasksWeight / totalTasks) * 100;
    document.getElementById('progress-bar').style.width = `${completionPercentage}%`;
    
}


    function addCheckboxmain(id){
      checkboxContainermain = document.createElement('div');
      checkboxContainermain.className = 'checkbox-container-main';
      checkboxContainermain.id = id + '-container';
      checkboxContainermain.setAttribute('data-task-id', id);


    };

    
   
// Function to create a new checkbox if its label isn't empty
function createCheckboxIfNotEmpty() {
  const newLabel = newCheckboxLabelInput.value;
  if (newLabel.trim() !== '') {
    const newCheckboxContainerId = `checkbox-container${checkboxCounter}`;
    addCheckboxmain(newCheckboxContainerId);

    const newCheckboxId = `checkbox${checkboxCounter}`;
    addCheckbox(newCheckboxId, newLabel);

    const newSubtaskContainerLabelID = `Subtask-Container${checkboxCounter}`; 
    addSubtaskContainer(newSubtaskContainerLabelID);

    // Append the main checkbox container to the list
    checkboxList.appendChild(checkboxContainermain);

    // Add this line to log task creation
    addToTimeline('Task Created', newLabel); // Log the creation of the task
    updateClearButtonVisibility();

    // Increment the checkboxCounter after creating the subtask container
    checkboxCounter++;

    // Reset the input field for new checkbox label
    newCheckboxLabelInput.value = '';
    newCheckboxLabelInput.style.display = 'none';
    taskNumber++;
      // Update stats button visibility
      updateStatsButtonVisibility();
  }
}
    function handleBlur(event) {
      if (event.target.value.trim() === '') {
          newCheckboxLabelInput.style.display = 'none';
      } 
      
    }
      // Handling input blur for new checkbox label
      newCheckboxLabelInput.addEventListener('blur', handleBlur);










      
  // Function to add a new checkbox to the list
  function addCheckbox(id, label) {
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';
    checkboxContainer.id = id + '-container';

    const checkboxLabel = document.createElement('label');
    checkboxLabel.setAttribute('for', id);
    checkboxLabel.className = 'checkbox-label';
    checkboxLabel.textContent = label;

    // Three-dot Menu button
    const menuButton = document.createElement('button');
    menuButton.innerHTML = '&#8230;'; // Three dots
    menuButton.className = 'menu-button';

    menuButton.addEventListener('click', function(event) {
      event.stopPropagation();
      currentTaskElement = event.target.closest('.checkbox-container');
      console.log('Setting currentTaskElement:', currentTaskElement);

      showHorizontalMenu(event, currentTaskElement, true);  // Pass `currentTaskElement` instead of `taskElement`
      console.log('Setting currentTaskElement:', currentTaskElement);

  });

    // Menu options
    const taskMenu = document.createElement('div');
    taskMenu.className = 'task-menu hidden';

    const editOption = document.createElement('button');
    editOption.textContent = 'Edit';
    editOption.addEventListener('click', () => { renameTask(id); hideHorizontalMenu(); });
    
    const detailsOption = document.createElement('button');
    detailsOption.textContent = 'Details';
    detailsOption.addEventListener('click', () => { showDetails(currentTaskElement.id.replace('-container', '')); });
    console.log('Setting currentTaskElement:', currentTaskElement);


    taskMenu.appendChild(detailsOption);
    taskMenu.appendChild(editOption);


    // Append to the main container
    checkboxContainer.appendChild(checkboxLabel);
    checkboxContainer.appendChild(menuButton);
    checkboxContainer.appendChild(taskMenu);
    checkboxContainermain.appendChild(checkboxContainer);

    const moveUpButton = document.createElement('button');
    moveUpButton.className = 'move-up hidden';
    moveUpButton.innerHTML = '&#x25B2;'; // Up Arrow
    // Add an event listener for the move-up button, if needed

    // Create the move-down button
    const moveDownButton = document.createElement('button');
    moveDownButton.className = 'move-down hidden';
    moveDownButton.innerHTML = '&#x25BC;'; // Down Arrow
    // Add an event listener for the move-down button, if needed

    // Append the buttons to the task container
    checkboxContainer.appendChild(moveUpButton);
    checkboxContainer.appendChild(moveDownButton);

   
    checkboxContainer.addEventListener('click', (event) => {
       // First, find the parent .checkbox-container-main
       const parentContainerMain = checkboxContainer.closest('.checkbox-container-main');
    
      if (isRearrangeModeActive) {


         
            if (activeRearrangeTask !== parentContainerMain) {
              
              hideArrowsForAllTasks();
              
                // Activate rearrange mode for this task
                activeRearrangeTask = parentContainerMain;
                toggleArrowVisibility(parentContainerMain, true);  // Show arrows
            } 
          console.log("Task completion disabled during rearrange mode.");
          return;
      }
      
      // Check if the clicked element is the three-dot button or a child of it
      if (event.target === menuButton || menuButton.contains(event.target)) {
          // If the three-dot button or its children were clicked, don't proceed further
          return;
      }
    
     
      // Then, within that, find the .subtask-container
      const associatedSubtaskContainerMain = parentContainerMain.querySelector('.subtask-container');
    
      // Check if there are any subtasks in the associatedSubtaskContainerMain
      const subtasks = associatedSubtaskContainerMain.querySelectorAll('.subtask-row');
    
      if (subtasks.length > 0) {
        // Toggle the visibility of the subtaskContainermain if subtasks exist
        associatedSubtaskContainerMain.classList.toggle('hidden');
    } else {
        // If there are no subtasks, toggle the completed state
        checkboxContainer.classList.toggle('completed');
        updateProgressBar();
        //triggerLogoBackground('#4790df', 300); 
        
        changebglogocolor(checkboxContainer);
        checkCompletion();
    
        // Log the task completion change in the timeline
        const taskLabel = checkboxContainer.querySelector('.checkbox-label').textContent;
        const isCompleted = checkboxContainer.classList.contains('completed');
        const action = isCompleted ? 'Task Marked as Completed' : 'Task Marked as Uncompleted';
        const entryType = isCompleted ? 'completed' : 'uncompleted'; // Specify entry type based on completion status
    
        // Add entry to timeline with the specified entry type
        addToTimeline(action, taskLabel, entryType);

      
    
        // Update the visibility of the clear button
        updateClearButtonVisibility();
    }
    

  // Find the associated subtask container
  const associatedSubtaskContainer = checkboxContainer.closest('.checkbox-container-main').querySelector('.subtask-container');


        // Check if there are no subtasks
  if (!associatedSubtaskContainer || associatedSubtaskContainer.querySelectorAll('.subtask-row').length === 0) {
    if (!checkboxContainer.classList.contains('completed')) {
        // Task is being uncompleted and has no subtasks
        resetTaskProgress(checkboxContainer);
        updateProgressColor(checkboxContainer);
        checkboxContainer.style.backgroundColor = ''; // Reset background color
    }
}

    });
  
    



// Updated Three-Dot Menu Button click event listener
menuButton.addEventListener('click', function(event) {
  event.stopPropagation(); // Prevent other click events from hiding the menu immediately
  const menu = menuButton.nextElementSibling;

  menu.classList.toggle('hidden');
});

    updateProgressBar();
}










function hideArrowsForAllTasks() {
  document.querySelectorAll('.checkbox-container').forEach(task => {
      const upButton = task.querySelector('.move-up');
      const downButton = task.querySelector('.move-down');
      if (upButton) upButton.classList.remove('visible');
      if (downButton) downButton.classList.remove('visible');
  });
}


    // Function to rename a task
    function renameTask(id) {
      const checkboxContainer = document.getElementById(id + '-container');
      const labelElement = checkboxContainer.querySelector('.checkbox-label');
      const currentLabel = labelElement.textContent;
  
      labelElement.textContent = ''; // Clear current label
  
      const renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.className = 'rename-input';
      renameInput.value = currentLabel;
      renameInput.placeholder = "Enter new name for task";
      renameInput.addEventListener('blur', () => {
          const newLabel = renameInput.value ? renameInput.value : currentLabel;
          if (newLabel !== currentLabel) {
              addToTimeline('Task Renamed', `From '${currentLabel}' to '${newLabel}'`,'edited');
              updateClearButtonVisibility();
          }
          labelElement.textContent = newLabel;
          renameInput.remove(); // Remove input field
      });
  
      labelElement.appendChild(renameInput);
      renameInput.focus();
  }
  

  function handleBlur(event) {
    if (event.target.value.trim() === '') {
        newCheckboxLabelInput.style.display = 'none';
    } 
    }


    function handleSubtaskChange(subtaskContainer, shouldCheckCompletion = true) {
      const parentContainerMain = subtaskContainer.closest('.checkbox-container-main');
      const mainCheckboxContainer = parentContainerMain.querySelector('.checkbox-container');

          // Skip progress updates if the task is manually completed
          if (mainCheckboxContainer.classList.contains('manually-completed')) {
            return;
        }
  
      // Attach event listeners to subtask checkboxes if not already attached
      subtaskContainer.querySelectorAll('.subtask-checkbox').forEach(subtaskCheckbox => {
          if (!subtaskCheckbox.classList.contains('listener-attached')) {
              subtaskCheckbox.addEventListener('change', () => {
                  const subtaskLabel = subtaskCheckbox.nextElementSibling
                      ? subtaskCheckbox.nextElementSibling.textContent
                      : 'Unnamed Subtask';
                  const isCompleted = subtaskCheckbox.checked;
                  const action = isCompleted ? 'Subtask Marked as Completed' : 'Subtask Marked as Uncompleted';
                  const entryType = isCompleted ? 'completed' : 'uncompleted';
  
                  addToTimeline(action, subtaskLabel, entryType);
                  updateClearButtonVisibility();
              });
  
              // Mark the checkbox to avoid duplicate event listeners
              subtaskCheckbox.classList.add('listener-attached');
          }
      });
  
      // Skip progress updates if the task is manually completed
      if (mainCheckboxContainer.classList.contains('manually-completed')) {
          return;
      }
  
      const allSubtaskCheckboxes = subtaskContainer.querySelectorAll('.subtask-checkbox');
      const checkedSubtaskCheckboxes = subtaskContainer.querySelectorAll('.subtask-checkbox:checked');
  
      // Handle case where no subtasks exist
      if (allSubtaskCheckboxes.length === 0) {
          mainCheckboxContainer.classList.remove('completed');
          subtaskContainer.classList.add('hidden');
          resetTaskProgress(mainCheckboxContainer);
          updateProgressColor(mainCheckboxContainer);
          mainCheckboxContainer.style.backgroundColor = '';
          return;
      }
  
      // Calculate and apply completion percentage
      const completionPercentage = (checkedSubtaskCheckboxes.length / allSubtaskCheckboxes.length) * 100;
      mainCheckboxContainer.style.setProperty('--progress', `${completionPercentage}%`);
  
      // Update completion status of the main task
      const isAllSubtasksCompleted = checkedSubtaskCheckboxes.length === allSubtaskCheckboxes.length;
  
      if (isAllSubtasksCompleted) {
          if (!mainCheckboxContainer.classList.contains('completed')) {
              mainCheckboxContainer.classList.add('completed');
              subtaskContainer.classList.add('hidden'); // Hide subtasks when completed
              logMainTaskCompletionStatus(mainCheckboxContainer, true);
          }
      } else {
          if (mainCheckboxContainer.classList.contains('completed')) {
              mainCheckboxContainer.classList.remove('completed');
              subtaskContainer.classList.remove('hidden'); // Show subtasks if not fully completed
              logMainTaskCompletionStatus(mainCheckboxContainer, false);
          }
      }
  
      // Update UI elements
      updateProgressColor(mainCheckboxContainer);
      updateProgressBar();
  
      // Check overall completion status if required
      if (shouldCheckCompletion) {
          checkCompletion();
      }
  }
  
  function logMainTaskCompletionStatus(mainCheckboxContainer, isCompleted) {
    const taskLabel = mainCheckboxContainer.querySelector('.checkbox-label').textContent;
    const action = isCompleted ? 'Task Marked as Completed' : 'Task Marked as Uncompleted';
    const entryType = isCompleted ? 'completed' : 'uncompleted'; // Specify entry type based on completion status

    // Add entry to timeline with the specified entry type
    addToTimeline(action, taskLabel, entryType);

    // Update the visibility of the clear button
    updateClearButtonVisibility();
}


// Select the logo element
const logo = document.querySelector('.title-section .logo img');




// Keep track of the timeout ID globally
let logoTimeoutId = null;

// Function to trigger the logo background change
function triggerLogoBackground(color = '', duration = 300) {
  const logo = document.querySelector('.title-section .logo img'); // Select the logo element

  if (logo) {
      // Clear any previous timeout to avoid conflicts
      if (logoTimeoutId) {
          clearTimeout(logoTimeoutId);
          logoTimeoutId = null;
      }

      // Apply the background color
      logo.style.backgroundColor = color;

      // Set a new timeout to reset the background color
      logoTimeoutId = setTimeout(() => {
          logo.style.backgroundColor = ''; // Reset to default background color
          logoTimeoutId = null; // Clear the timeout ID
      }, duration);
  }
}





    /* TTO-10
    function updateProgressColor(mainCheckboxContainer) {
      console.log('updateProgressColor called for:', mainCheckboxContainer);
    
      // Determine the correct color based on priority classes
      let color = '#4790df'; // Default color
      if (mainCheckboxContainer.classList.contains('marked-high')) {
          color = '#c22323'; // High priority color
      } else if (mainCheckboxContainer.classList.contains('marked-low')) {
          color = '#00C851'; // Low priority color
      }
    
      // Set the progress color variable
      mainCheckboxContainer.style.setProperty('--progress-color', color);
      console.log('Progress color set to:', color);
    
      // Update the background color based on completion and priority
      if (mainCheckboxContainer.classList.contains('completed')) {
          mainCheckboxContainer.style.backgroundColor = color;
          console.log('Updated completed task background color');
      } else {
          mainCheckboxContainer.style.backgroundColor = ''; // Reset for uncompleted task
          console.log('Reset background color for uncompleted task');
      }
    }
      */

    function updateProgressColor(mainCheckboxContainer) {
      console.log('updateProgressColor called for:', mainCheckboxContainer);
      
      // Determine the correct color based on priority classes
      let color = '#4790df'; // Default color
      if (mainCheckboxContainer.classList.contains('marked-high')) {
          color = '#c22323'; // High priority color
      } else if (mainCheckboxContainer.classList.contains('marked-low')) {
          color = '#00C851'; // Low priority color
      }
      
      // Set the progress color variable
      mainCheckboxContainer.style.setProperty('--progress-color', color);
      console.log('Progress color set to:', color);
      
      // Update the background color based on completion and priority
      if (mainCheckboxContainer.classList.contains('completed')) {
          mainCheckboxContainer.style.backgroundColor = color;
          console.log('Updated completed task background color');
      } else {
          mainCheckboxContainer.style.backgroundColor = ''; // Reset for uncompleted task
          console.log('Reset background color for uncompleted task');
      }
  }
  
    
    function resetTaskProgress(mainCheckboxContainer) {
      // Logic to reset the progress bar, potentially setting --progress to 0%
      mainCheckboxContainer.style.setProperty('--progress', '0%');
      console.log('Task progress reset');
    }
    
  
  
    function toggleTaskCompletion(button, subtaskContainer) {
      const parentContainerMain = subtaskContainer.closest('.checkbox-container-main');
      const mainCheckboxContainer = parentContainerMain.querySelector('.checkbox-container');
      const taskLabel = mainCheckboxContainer.querySelector('.checkbox-label').textContent;
  
      if (button.textContent === 'Complete Task') {
          // Mark the task as completed and manually completed
          mainCheckboxContainer.classList.add('completed', 'manually-completed');
          button.textContent = 'Uncomplete Task';
          subtaskContainer.classList.add('hidden');
  
          // Add timeline entry for completing the task
          addToTimeline('Task Marked as Completed', taskLabel, 'completed');
          updateClearButtonVisibility();
      } else {
          // Unmark the task as completed and manually completed
          mainCheckboxContainer.classList.remove('completed', 'manually-completed');
          button.textContent = 'Complete Task';
          handleSubtaskChange(subtaskContainer, false); // Reflect current subtask progress
  
          // Reset the background color
          mainCheckboxContainer.style.backgroundColor = '';
  
          // Add timeline entry for uncompleting the task
          addToTimeline('Task Marked as Uncompleted', taskLabel);
          updateClearButtonVisibility();
      }
  
      // Update the progress color based on the current state
      updateProgressColor(mainCheckboxContainer);
      updateProgressBar();
      checkCompletion();
      //triggerLogoBackground('#4790df', 300);  // Change to blue for 2 seconds
      changebglogocolor(mainCheckboxContainer);
;
  }
  


    // Updates the task counter display
    function updateCounter() {
      if (counter === 0) {
        counterContainer.classList.add('hidden');
        resetButton.classList.add('hidden');
        counterDiv.textContent = '';
      } else {
        counterContainer.classList.remove('hidden');
        resetButton.classList.remove('hidden')
        counterDiv.textContent = counter;
      }
    }

function checkCompletion() {
  console.log("checkCompletion called"); // To confirm the function is being called
  const parentTasks = document.querySelectorAll('#checkbox-list .checkbox-container');

  console.log("Checking completion for all tasks.");
  const allCompleted = Array.from(parentTasks).every(container => container.classList.contains('completed'));

  if (allCompleted) {
      console.log("Initiating task cycle as all tasks are completed.");
      initiateTaskCycle();
      triggerLogoBackground('green', 1000);
  } else {
      console.log("Not all tasks are completed, task cycle will not be initiated.");
  }
}


function editNote(noteElement) {
    const noteTextElement = noteElement.querySelector('.note-text');
  
    // Convert <br> tags to newlines for the textarea
    let currentText = noteTextElement.innerHTML.replace(/<br>/g, "\n");
  
    // Clear the current text and replace it with a textarea
    noteTextElement.innerHTML = '';

    const textarea = document.createElement('textarea');
    textarea.value = currentText;
    textarea.className = 'edit-textarea'; // Optional: Add a class for styling
    noteTextElement.appendChild(textarea);
    textarea.focus();

    // Define the saveChanges logic inline, passing the required context
    const saveChanges = () => {
        // Capture the original and updated text
        const originalText = currentText.trim();
        const updatedText = textarea.value.replace(/\n/g, '<br>').trim();

        // Update the note text only if it has changed
        if (originalText !== updatedText) {
            noteTextElement.innerHTML = updatedText;

            // Log the editing action
            addToTimeline('Note Edited', originalText, 'edited');
            updateClearButtonVisibility();

            // Save updated notes to localStorage
            saveNotesToLocalStorage();
        } else {
            // If unchanged, restore the original text
            noteTextElement.innerHTML = originalText.replace(/\n/g, '<br>');
        }
    };

    // Save changes when the textarea loses focus
    textarea.addEventListener('blur', saveChanges);

    // Save changes when Ctrl + Enter is pressed
    textarea.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && event.ctrlKey) {
            saveChanges();
        }
    });
}



  function saveChanges() {
    // Capture the original text and the new text
    let originalText = noteTextElement.textContent.trim();
    let updatedText = textarea.value.replace(/\n/g, '<br>').trim();
    noteTextElement.innerHTML = updatedText;

    // Log the editing action if the text has changed
    if (originalText !== updatedText) {
        addToTimeline('Note Edited', originalText, 'edited');
        updateClearButtonVisibility();
    }

    // Ensure buttons are still present
    const buttonContainer = noteElement.querySelector('.note-button-container');
    if (!buttonContainer) {
        const newButtonContainer = document.createElement('div');
        newButtonContainer.className = 'note-button-container';
        
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.className = 'note-edit';
        editButton.addEventListener('click', function() {
            editNote(noteElement);
        });
        newButtonContainer.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'note-delete';
        deleteButton.addEventListener('click', function() {
            noteElement.remove();

            // Save updated notes to localStorage
            saveNotesToLocalStorage();
        });
        newButtonContainer.appendChild(deleteButton);
        
        noteElement.appendChild(newButtonContainer);
    }

    // Save updated notes to localStorage
    saveNotesToLocalStorage();
}



function showHorizontalMenu(event, taskElement, isThreeDotClick = false, showOnlyPriority=false) {
  selectedTask = taskElement; // Set the global variable when showing the menu
  lastMenuShownTime = Date.now();
  const menu = document.getElementById('horizontalMenu');
  const taskRect = taskElement.getBoundingClientRect();

  // Initially display the menu to calculate dimensions, but keep it hidden
  menu.style.display = 'flex';
  menu.style.visibility = 'hidden';

  // Calculate the center position of the task element
  const taskCenterX = taskRect.left + (taskRect.width / 2);

  // Position the menu directly above the task and center it
  menu.style.left = `${taskCenterX - (menu.offsetWidth / 2)}px`;
  menu.style.top = `${taskRect.top - menu.offsetHeight}px`;

  // Now set the visibility to visible
  menu.style.visibility = 'visible';

  // Display the menu
  menu.style.display = 'flex';
  
  const allTasks = document.querySelectorAll('.checkbox-container');
  if (allTasks.length > 1) {
      menuRearrange.style.display = "block";
  } else {
      menuRearrange.style.display = "none";
  }
  updateMarkButtonText(); 
  const allMenuItems = document.querySelectorAll('#horizontalMenu button');
  allMenuItems.forEach(item => {
      if (showOnlyPriority) {
          if (item.id === 'markHigh' || item.id === 'markLow') {
              item.style.display = 'block';
          } else {
              item.style.display = 'none';
          }
      } else {
          if (item.id === 'menuRearrange') {
              // Check the number of tasks before displaying the rearrange button
              const allTasks = document.querySelectorAll('.checkbox-container');
              item.style.display = allTasks.length > 1 ? 'block' : 'none';
          } else {
              // Display all other buttons
              item.style.display = 'block';
          }
      }
  });
  
  if (showOnlyPriority) {
      document.getElementById('priorityMenu').style.display = 'flex';
  } else {
      document.getElementById('priorityMenu').style.display = 'none';
  }
  


}

function hideHorizontalMenu() {
  document.getElementById('horizontalMenu').style.display = 'none';
}
function deleteTask(e) {
  console.log('delete button clicked');
  e.stopPropagation();
  
  if (selectedTask) {
      console.log('Found task to delete:', selectedTask);
      const parentContainer = selectedTask.closest('.checkbox-container-main');
      if (parentContainer) {
      // Extract the task label text before deleting the task
      const taskLabelElement = selectedTask.querySelector('.checkbox-label');
      const taskLabel = taskLabelElement ? taskLabelElement.textContent : 'Unknown Task';

        // Log the deletion of the task before removing it
      addToTimeline('Task Deleted', taskLabel); // Log the deletion of the task
      updateClearButtonVisibility();
          parentContainer.remove();
      } else {
          selectedTask.remove(); // Fallback to remove the selectedTask itself if parent is not found (just to be safe)
      }
      
  } else {
      console.log('No task found to delete');
  }
  hideHorizontalMenu();

    // Update stats button visibility
    updateStatsButtonVisibility();
    updateProgressBar();

}

function disableTaskDragging() {
  const allTasks = document.querySelectorAll('.checkbox-container-main'); // Updated to .checkbox-container-main
  allTasks.forEach(task => {
      task.setAttribute("draggable", false);
      task.classList.remove('draggable');
      task.classList.remove('dragover');  // Ensure dragover class is removed as well
  });
}
function hidePriorityMenu() {
  document.getElementById('priorityMenu').style.display = 'none';
}
function updateMarkButtonText() {
  const menuMarkButton = document.getElementById('menuMark');
  if (currentTaskElement.classList.contains('marked-high') || currentTaskElement.classList.contains('marked-low')) {
    console.log('Setting currentTaskElement:', currentTaskElement);

      menuMarkButton.textContent = 'Reset Priority';
  } else {
      menuMarkButton.textContent = 'Set Priority';
  }
}


    
// Event listener for the add button to show input for a new checkbox
addButton.addEventListener('click', () => {
  newCheckboxLabelInput.style.display = 'block';
  // TTO-10 newCheckboxLabelInput.value = 'Task Item '+ taskNumber;
  newCheckboxLabelInput.focus();
  newCheckboxLabelInput.addEventListener('blur', createCheckboxIfNotEmpty);
});





//Handling Enter key for new checkbox label input
newCheckboxLabelInput.addEventListener('keypress', (event) => {
if (event.key === 'Enter') {
// Prevent the blur event from being triggered after Enter is pressed
newCheckboxLabelInput.removeEventListener('blur', createCheckboxIfNotEmpty);
createCheckboxIfNotEmpty();
// Re-attach the blur event listener
newCheckboxLabelInput.addEventListener('blur', createCheckboxIfNotEmpty);
// Prevent form submission if this is inside a form
event.preventDefault();
}
});

document.querySelectorAll('[id$="-button"]').forEach(button => {
  const tooltip = document.getElementById(`${button.id}-tooltip`);
  let tooltipTimer; // Variable to track the timeout

  button.addEventListener('mouseenter', () => {
    const rect = button.getBoundingClientRect(); // Get the button's position

    // Start a timer to show the tooltip after 3 seconds
    tooltipTimer = setTimeout(() => {
      tooltip.style.display = 'block';
      tooltip.style.position = 'fixed';
      tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`; // Center horizontally
      tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`; // Position above the button
    }, 1000); // 1-second delay
  });

  button.addEventListener('mouseleave', () => {
    // Clear the timer if the user moves the mouse away before 3 seconds
    clearTimeout(tooltipTimer);
    tooltip.style.display = 'none'; // Hide the tooltip immediately
  });
});




function initiateTaskCycle() {
  const mainTaskContainers = document.querySelectorAll('.checkbox-container-main');

  // Mark all tasks as completed
  mainTaskContainers.forEach(mainContainer => {
      const taskCheckbox = mainContainer.querySelector('.checkbox-container');
      taskCheckbox.classList.add('completed');
      taskCheckbox.classList.remove('manually-completed'); // Remove manually-completed class

      // Correctly construct subtask container ID
      const subtaskContainerId = mainContainer.id.replace('checkbox-container', 'Subtask-Container');
      const subtaskContainer = document.getElementById(subtaskContainerId);

      if (subtaskContainer) {
          // Hide the subtask container
          subtaskContainer.classList.add('hidden');
          
          // Reset the Complete Task button text
          const completeTaskButton = subtaskContainer.querySelector('.complete-task-button');
          if (completeTaskButton) {
              completeTaskButton.textContent = 'Complete Task';
          }
      }
  });

  // Log the initiation of a new task cycle in the timeline
  addToTimeline('Task Cycle Initiated', 'All tasks reset to uncompleted');
  updateClearButtonVisibility();

  updateProgressBar();
  counter += 1;
  updateCounter();
  completeMessage.style.display = 'block';


  // After a short delay, reset all tasks to the uncompleted state
  setTimeout(() => {
      mainTaskContainers.forEach(mainContainer => {
          const taskCheckbox = mainContainer.querySelector('.checkbox-container');
          taskCheckbox.classList.remove('completed', 'manually-completed'); // Also remove manually-completed class here
          taskCheckbox.style.setProperty('--progress', '0%');
          taskCheckbox.style.setProperty('--progress-color', '#4790df'); // Reset to default color
          taskCheckbox.style.backgroundColor = ''; // Reset background color to default

          // Reset subtask checkboxes and hide subtask container
          const subtaskContainer = document.getElementById(mainContainer.id.replace('checkbox-container', 'Subtask-Container'));
          if (subtaskContainer) {
              subtaskContainer.classList.add('hidden');
              const subtaskCheckboxes = subtaskContainer.querySelectorAll('.subtask-checkbox');
              subtaskCheckboxes.forEach(checkbox => {
                  checkbox.checked = false;
              });
          }
      });

      resetSubtaskCheckboxes();
      completeMessage.style.display = 'none'; // Hide the "complete" message
  }, 1000);
}



function resetSubtaskCheckboxes() {
  const allSubtasks = document.querySelectorAll('.subtask-checkbox');
  allSubtasks.forEach(subtask => {
      subtask.checked = false;
  });
  updateProgressBar();
}


function completeAllTasks() {
  const allCompleteTaskButtons = document.querySelectorAll('.complete-task-button');
  
  // Debugging: Check if we have any `.complete-task-button` elements
  console.log("Total .complete-task-button elements:", allCompleteTaskButtons.length);

  allCompleteTaskButtons.forEach(button => {
      const parentContainer = button.closest('.checkbox-container-main');
      
      // Debugging: Check if parentContainer is found
      if (!parentContainer) {
          console.error('parentContainer not found for button:', button);
          return;  // skip this iteration
      }

      const mainCheckboxContainer = parentContainer.querySelector('.checkbox-container');

      // Debugging: Check if mainCheckboxContainer is found
      if (!mainCheckboxContainer) {
          console.error('mainCheckboxContainer not found for parentContainer:', parentContainer);
          return;  // skip this iteration
      }
    
      // Check if the main task is marked as completed
      if (mainCheckboxContainer.classList.contains('completed')) {
          const associatedSubtaskContainer = parentContainer.querySelector('.subtask-container');
          // Toggle completion
          toggleTaskCompletion(button, associatedSubtaskContainer, false);
      }
  });
  updateProgressBar();
}

function resetSubtaskState() {
  // Get all completeTaskButtons
  const completeTaskButtons = document.querySelectorAll('.complete-task-button');

  // Iterate over each button and reset it if it's labeled "Uncomplete Task"
  completeTaskButtons.forEach(button => {
    if (button.textContent === 'Uncomplete Task') {
      button.textContent = 'Complete Task';

      // Get the associated subtaskContainer
      const subtaskContainer = button.closest('.subtask-container');

      // Uncheck all subtasks within this container
      const subtaskCheckboxes = subtaskContainer.querySelectorAll('.subtask-checkbox');
      subtaskCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
      });

    }
  });
}








completeButton.addEventListener('click', () => {
  const checkboxContainers = document.querySelectorAll('.checkbox-container');

  // Find all tasks that are marked as completed
  const completedTasks = Array.from(checkboxContainers).filter(container => container.classList.contains('completed'));

  // If at least one task is completed
  if (completedTasks.length > 0) {
      completeAllTasks();
      initiateTaskCycle();
      triggerLogoBackground('green', 1000);
  } else {
      errorN = 0;
      completeTooltip.style.display = 'none';
      // If no tasks are completed, show an error message
      errorMessage.textContent = 'No tasks selected for completion';
      errorMessage.style.display = 'block';
      setTimeout(() => {
          errorMessage.style.display = 'none';
          errorN = 1;
      }, 5000);  // Hide the error message after 5 seconds
  }
  // Reset subtask buttons and checkboxes

  resetSubtaskState();

});


function changebglogocolor(container) {
  if (!container) {
    console.error("Container is undefined or null");
    return;
  }
  if (container.classList.contains('marked-high')) {
    triggerLogoBackground('red', 300);
  } else if (container.classList.contains('marked-low')) {
    triggerLogoBackground('green', 300);
  } else {
    triggerLogoBackground('#4790df', 300);
  }
}

/*

function changebglogocolor(mainCheckboxContainer) {
  // Check if the element has the 'marked-high' class
  if (mainCheckboxContainer.classList.contains('marked-high')) {
      console.log("Condition met: 'marked-high'. Changing logo background to red.");
      triggerLogoBackground('red', 300); 
  } 
  // Check if the element has the 'marked-low' class
  else if (mainCheckboxContainer.classList.contains('marked-low')) {
      console.log("Condition met: 'marked-low'. Changing logo background to green.");
      triggerLogoBackground('green', 300); 
  } 
  // If no conditions are met, apply the default color
  else {
      console.log("No conditions met. Applying default logo background color: #4790df.");
      triggerLogoBackground('#4790df', 300); // Default color
  }
}
*/

  // Logic for resetting task counter
  resetButton.addEventListener('click', () => {
    counter = 0;
    updateCounter();
  });

    //Event listener for right click context menu
document.addEventListener('contextmenu', function(e) {
  
  // If the right-clicked element is within a checkbox-container
  if (e.target.closest('.checkbox-container')) {
    e.preventDefault(); // Prevent default right-click menu
      currentTaskElement = e.target.closest('.checkbox-container');
      console.log('Setting currentTaskElement:', currentTaskElement);

      showHorizontalMenu(e, currentTaskElement);
      console.log('Setting currentTaskElement:', currentTaskElement);

  } else {
      hideHorizontalMenu();
  }
});



addNoteButton.addEventListener('click', () => {
    let noteText = newNoteTextarea.value.trim();
    // Convert newline characters to <br> elements for display
    noteText = noteText.replace(/\n/g, '<br>');

    if (noteText) {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';
        
        const noteTextDiv = document.createElement('div');
        noteTextDiv.className = 'note-text';
        noteTextDiv.innerHTML = noteText; // Use innerHTML here since we're inserting <br> elements
        noteItem.appendChild(noteTextDiv);
        
        const noteButtonContainer = document.createElement('div');
        noteButtonContainer.className = 'note-button-container';

        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', function() {
            editNote(noteItem);
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
            // Get note text before removing
            let noteText = noteItem.querySelector('.note-text').textContent;
    
            // Remove the note item
            notesList.removeChild(noteItem);

            // Add to timeline
            addToTimeline('Note Deleted', noteText);
            updateClearButtonVisibility();

            // Save updated notes to localStorage
            saveNotesToLocalStorage();
        });

        // Append the buttons to the button container
        noteButtonContainer.appendChild(editButton);
        noteButtonContainer.appendChild(deleteButton);

        // Append the button container to the note item
        noteItem.appendChild(noteButtonContainer);

        notesList.appendChild(noteItem);
        newNoteTextarea.value = '';

        // Add to timeline
        addToTimeline('Note Added', noteText);
        updateClearButtonVisibility();

        // Save updated notes to localStorage
        saveNotesToLocalStorage();
    }
});



closeButton.addEventListener('click', () => {
  notesPanel.classList.add('hidden'); // Assuming 'hidden' class hides the panel
});

document.getElementById('notes-button').addEventListener('click', () => {

  if (notesPanel.classList.contains('hidden')) {
    // Open the notes panel
    notesPanel.classList.remove('hidden');
    localStorage.setItem('notesPanelState', 'open'); // Save the state as 'open'
  } else {
    // Close the notes panel
    notesPanel.classList.add('hidden');
    localStorage.setItem('notesPanelState', 'closed'); // Save the state as 'closed'
  }
});

if (savedNotesState === 'open') {
  notesPanel.classList.remove('hidden'); // Keep the panel open
} else {
  notesPanel.classList.add('hidden'); // Default to closed if no state or state is 'closed'
}


// Variables to track timer state
let timerInterval;
let timerRemaining = 300; // Default to 5 minutes (300 seconds)
let isTimerRunning = false;

// Default timer settings
let defaultHours = 0;
let defaultMinutes = 5; // Default to 5 minutes
let defaultSeconds = 0;

function updateTimerDisplay() {
  const hours = Math.floor(timerRemaining / 3600);                // Calculate total hours
  const minutes = Math.floor((timerRemaining % 3600) / 60);      // Remaining minutes
  const seconds = timerRemaining % 60;                          // Remaining seconds

  // Determine if hours should be displayed
  if (hours > 0) {
    // Include hours in the display
    document.getElementById("timer-display").textContent = `${hours}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  } else {
    // Display only minutes and seconds
    document.getElementById("timer-display").textContent = `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
}



// Start the timer
document.getElementById("timer-start-button").addEventListener("click", () => {
  if (!isTimerRunning) {
    isTimerRunning = true;
    timerInterval = setInterval(() => {
      if (timerRemaining > 0) {
        timerRemaining--;
        updateTimerDisplay();
      } else {
        clearInterval(timerInterval);
        isTimerRunning = false;
        alert("Time's up!");
      }
    }, 1000);
  }
});

// Pause the timer
document.getElementById("timer-pause-button").addEventListener("click", () => {
  clearInterval(timerInterval);
  isTimerRunning = false;
});

// Reset the timer to default or custom preset
document.getElementById("timer-reset-button").addEventListener("click", () => {
  clearInterval(timerInterval);
  timerRemaining = calculateSeconds(defaultHours, defaultMinutes, defaultSeconds);
  isTimerRunning = false;
  updateTimerDisplay();
});

// Function to calculate total seconds
function calculateSeconds(hours, minutes, seconds) {
  return hours * 3600 + minutes * 60 + seconds;
}



// Set Timer Logic
// Select both classes and loop through each element
document.querySelectorAll(".set-timer-short-button, .set-timer-full-button").forEach(button => {
  button.addEventListener("click", () => {
    // Show the timer configuration screen
    const setTimerScreen = document.getElementById("set-timer-screen");
    const timerRow = document.getElementById("timer-row");
    const timerButton = document.getElementById("timer-buttons");
    setTimerScreen.style.display = "block"; // Display the settings screen
    timerRow.style.display = "none"; // Hide Timer Display
    timerButton.style.display = "none"; // Hide Timer Display

    // Pre-fill inputs with current defaults
    document.getElementById("hours-input").value = "";
    document.getElementById("minutes-input").value = "";
    document.getElementById("seconds-input").value = "";
  });
});




// Save Timer Settings
document.getElementById("save-timer-button").addEventListener("click", () => {
  // Get user inputs
  let hours = parseInt(document.getElementById("hours-input").value, 10) || 0;
  const minutes = parseInt(document.getElementById("minutes-input").value, 10) || 0;
  const seconds = parseInt(document.getElementById("seconds-input").value, 10) || 0;

  // Limit hours to 24
  if (hours > 24) {
    alert("Hours cannot exceed 24.");
    hours = 24; // Clamp to 24
    document.getElementById("hours-input").value = 24; // Update input field
  }

  // Update default timer settings
  defaultHours = hours;
  defaultMinutes = minutes;
  defaultSeconds = seconds;

  // Update the timerRemaining value
  timerRemaining = calculateSeconds(hours, minutes, seconds);

  // Update the display
  updateTimerDisplay();

  // Hide the timer configuration screen
  document.getElementById("set-timer-screen").style.display = "none";
  document.getElementById("timer-row").style.display = "flex";
  document.getElementById("timer-buttons").style.display = "flex";
});


// Cancel Timer Settings
document.getElementById("cancel-timer-button").addEventListener("click", () => {
  document.getElementById("set-timer-screen").style.display = "none";
  document.getElementById("timer-row").style.display = "flex";
  document.getElementById("timer-buttons").style.display = "flex";
});

// Initialize display
updateTimerDisplay();







  
  timerToggleButton.addEventListener("click", () => {
    timerContainer.classList.toggle("hidden-flex");
    stopWatchTimerToggleButtonsRow.classList.toggle("hidden-flex");
  });
  

// --- CLOSE THE TIMER ---
timerToggleButton2.addEventListener("click", () => {
    timerContainer.classList.toggle("hidden-flex");
    stopWatchTimerToggleButtonsRow.classList.toggle("hidden-flex");
  });


timerCloseButton.addEventListener("click", () => {
    timerContainer.classList.toggle("hidden-flex");
    stopWatchTimerToggleButtonsRow.classList.toggle("hidden-flex");
  });
  












  

// Toggle Stopwatch
stopWatchToggleButton.addEventListener("click", () => {
    stopWatchContainer.classList.add("active");
    timerContainer.classList.remove("active");
  });
  
  // Toggle Timer
  timerToggleButton.addEventListener("click", () => {
    timerContainer.classList.add("active");
    stopWatchContainer.classList.remove("active");
  });




let lastUpdateTime = 0;

/* --- UPDATE STOP-WATCH (was updateStopWatch) --- */
function updateStopWatch() {
  if (isStopWatchRunning) {
    const now = Date.now();
    const totalTimeInSeconds = elapsedTime + Math.floor((now - startTime) / 1000);

    // Update only if the current second changed
    if (Math.floor(now / 1000) !== lastUpdateTime) {
      lastUpdateTime = Math.floor(now / 1000);
      const hours = Math.floor(totalTimeInSeconds / 3600);
      const minutes = Math.floor((totalTimeInSeconds % 3600) / 60);
      const seconds = totalTimeInSeconds % 60;

      document.getElementById('stop-watch').textContent = 
        `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    requestAnimationFrame(updateStopWatch);
  }
}

/* --- START STOP-WATCH --- */
document.getElementById('start-button').addEventListener('click', () => {
  if (!isStopWatchRunning) {
    isStopWatchRunning = true;
    startTime = Date.now();
    updateStopWatch();
  }
});

/* --- STOP STOP-WATCH --- */
document.getElementById('stop-button').addEventListener('click', () => {
  if (isStopWatchRunning) {
    elapsedTime += Math.floor((Date.now() - startTime) / 1000);
    isStopWatchRunning = false;
  }
});

/* --- RESET STOP-WATCH --- */
document.getElementById('reset-stop-watch-button').addEventListener('click', () => {
  isStopWatchRunning = false;
  elapsedTime = 0;
  startTime = null;
  document.getElementById('stop-watch').textContent = "0:00:00";
});


/* --- TOGGLE STOP-WATCH VISIBILITY --- */
stopWatchToggleButton.addEventListener('click', () => {
    stopWatchContainer.classList.toggle('hidden-flex');
    stopWatchTimerToggleButtonsRow.classList.toggle('hidden-flex');
  });
  
  /* --- CLOSE THE STOP-WATCH --- */
  closeStopWatchButton.addEventListener('click', () => {
    stopWatchContainer.classList.toggle('hidden-flex');
    stopWatchTimerToggleButtonsRow.classList.toggle('hidden-flex');
  });
  
  /* --- CLOSE THE STOP-WATCH --- */
  stopWatchToggleButton2.addEventListener('click', () => {
    stopWatchContainer.classList.toggle('hidden-flex');
    stopWatchTimerToggleButtonsRow.classList.toggle('hidden-flex');
  });
  



  
const requestAnimFrame = window.requestAnimationFrame || function(callback) {
  return setTimeout(callback, 1000 / 60);
};




// Hide the horizontal menu if clicked anywhere else on the document
document.addEventListener('click', function(e) {
  // Check if the click was outside the checkbox-list element and horizontal menu
  if (!e.target.closest('#checkbox-list') && !e.target.closest('#horizontalMenu')) {
      // Deactivate rearrange mode and update the UI
      isRearrangeModeActive = false;
      toggleRearrangeMode(isRearrangeModeActive);
      hideArrows();
  }
  // Logic to hide the horizontal menu if it's not clicked
  if (!e.target.closest('#horizontalMenu')) {
      document.getElementById('horizontalMenu').style.display = 'none';
  }
});

// Event listener for the "Details" button in the horizontal menu
document.getElementById('menuDetails').addEventListener('click', function () {
  if (!currentTaskElement) return; // Ensure a task is selected

  // Fetch existing details for the current task
  const existingDetails = currentTaskElement.getAttribute('data-details') || '';
  console.log('data-details', existingDetails);
  detailsTextarea.value = existingDetails; // Pre-fill the textarea with existing details

  // Show the details modal
  detailsModalBackdrop.style.display = 'flex';
  detailsTextarea.setAttribute('disabled', ''); // Disable textarea by default
  editDetailsButton.textContent = 'Edit'; // Reset button to Edit state

      // Close modal on cancel or click outside
      detailsModalBackdrop.addEventListener('click', function (e) {
        if (e.target === detailsModalBackdrop) {
            detailsModalBackdrop.style.display = 'none';
        }
    });
});


document.getElementById('menuRename').addEventListener('click', function() {
  console.log('Rename clicked. Current Task Element:', currentTaskElement);
  console.log('Setting currentTaskElement:', currentTaskElement);

  if (currentTaskElement) {
    console.log('Setting currentTaskElement:', currentTaskElement);

      renameTask(currentTaskElement.id.replace('-container', ''));
      console.log('Setting currentTaskElement:', currentTaskElement);

  }
  hideHorizontalMenu();
});

// Hide the priority menu if clicked anywhere else on the document
document.addEventListener('click', function(e) {
  if (!e.target.closest('#priorityMenu') && !e.target.closest('#menuMark')) {
      hidePriorityMenu();
  }
});



document.getElementById('menuMark').addEventListener('click', function(e) {
  let targetElement = currentTaskElement; // Or another way to get the target element

  if (isSubtask(targetElement)) {
      // Logic to handle marking of subtasks
      markSubtaskPriority(targetElement, 'high'); // Or 'low', depending on the button clicked
  } else {
      // Existing logic for tasks
      if (targetElement.classList.contains('marked-high') || targetElement.classList.contains('marked-low')) {
        // Unmarking priority
        const taskLabel = targetElement.querySelector('.checkbox-label').textContent;
        addToTimeline('Priority Unmarked', taskLabel); // Log unmarking priority
        updateClearButtonVisibility();
          targetElement.classList.remove('marked-high', 'marked-low');
          updateProgressColor(targetElement);
          hideHorizontalMenu();
      } else {
          showHorizontalMenu(e, targetElement, true, true);
      }
      updateMarkButtonText();
  }
});


document.getElementById('markHigh').addEventListener('click', function() {
  if (currentTaskElement) {
      const taskLabel = currentTaskElement.querySelector('.checkbox-label').textContent;
      addToTimeline('Priority Set to High', taskLabel); // Update timeline
      updateClearButtonVisibility();
      currentTaskElement.classList.remove('marked-low');
      currentTaskElement.classList.add('marked-high');
      updateProgressColor(currentTaskElement); // Update the progress color
      hideHorizontalMenu();
  }
});



document.getElementById('markLow').addEventListener('click', function() {
  if (currentTaskElement) {
      const taskLabel = currentTaskElement.querySelector('.checkbox-label').textContent;
      addToTimeline('Priority Set to Low', taskLabel); // Update timeline
      updateClearButtonVisibility();
      currentTaskElement.classList.remove('marked-high');
      currentTaskElement.classList.add('marked-low');
      updateProgressColor(currentTaskElement); // Update the progress color
      hideHorizontalMenu();
  }
});



document.body.addEventListener('click', function(e) {
  if (e.target.id === 'menuDelete') {
    isRearrangeModeActive = false;
    toggleRearrangeMode(false);
    hideArrows();
      console.log('Delete button clicked via delegation');
      deleteTask(e); // Call the deleteTask function
  }
});

document.getElementById('menuSubtasks').addEventListener('click', () => {
  console.log('Subtasks clicked. Current Task Element:', currentTaskElement);
  console.log('Setting currentTaskElement:', currentTaskElement);


  if (currentTaskElement) {
    console.log('Setting currentTaskElement:', currentTaskElement);

      // First, find the parent .checkbox-container-main
      const parentContainer = currentTaskElement.closest('.checkbox-container-main');
      console.log('Setting currentTaskElement:', currentTaskElement);

      
      // Then, within that, find the .subtask-container
      const associatedSubtaskContainer = parentContainer.querySelector('.subtask-container');

      if (associatedSubtaskContainer) {
          associatedSubtaskContainer.classList.toggle('hidden');
      }

      hideHorizontalMenu();
  }
});



/*
detailsModalBackdrop.addEventListener('click', function(e) {
  if (e.target === detailsModalBackdrop) {
      detailsModalBackdrop.style.display = "none";
  }
});
*/

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

// Automatically resize the textarea when its content changes
detailsTextarea.addEventListener('input', function() {
  autoResizeTextarea(this);
});


document.getElementById('editDetailsButton').addEventListener('click', function () {
  if (detailsTextarea.hasAttribute('disabled')) {
      // Enable Edit Mode
      detailsTextarea.removeAttribute('disabled');
      detailsTextarea.focus();
      editDetailsButton.textContent = 'Save';
  } else {
      // Save Mode
      const newDetails = detailsTextarea.value.trim();
      const taskId = currentTaskElement.getAttribute('id');

      if (newDetails) {
          console.log('Saving details...');
          updateTaskDetails(taskId, newDetails); // Centralized save logic
      }

      // Disable editing and reset button text
      detailsTextarea.setAttribute('disabled', '');
      editDetailsButton.textContent = 'Edit';

      // Optional: Close the modal after saving if desired
      detailsModalBackdrop.style.display = 'none';
  }
});



document.addEventListener('dragstart', function(e) {
  if (e.target.classList.contains('checkbox-container-main')) {
      e.dataTransfer.setData("text/plain", e.target.id);
      document.body.style.cursor = 'move';  // Set cursor to 'move'
  }
});




document.addEventListener('dragend', function(e) {
  // Deactivate rearrange mode
  isRearrangeModeActive = false;

  // Call the function to update the UI
  toggleRearrangeMode(isRearrangeModeActive);

  hideArrows();
  document.body.style.cursor = 'default';
});


document.getElementById('checkbox-list').addEventListener('dragover', function(e) {
  e.preventDefault(); // Necessary to allow dropping
  const target = e.target.closest('.checkbox-container-main'); // Updated to .checkbox-container-main
  
  if (target) {
      const rect = target.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      if (offsetY < rect.height / 2) {
          dragDirection = 'up';
      } else {
          dragDirection = 'down';
      }
      target.classList.add('dragover'); // Add a CSS class
  }
});

document.getElementById('checkbox-list').addEventListener('dragleave', function(e) {
  const target = e.target.closest('.checkbox-container-main'); // Updated to .checkbox-container-main
  if (target) {
      target.classList.remove('dragover');  // Remove the CSS class
  }
});

document.getElementById('checkbox-list').addEventListener('drop', function(e) {
  e.preventDefault();
  
  const draggedID = e.dataTransfer.getData("text/plain");
  const draggedElement = document.getElementById(draggedID);

  const dropTarget = e.target.closest('.checkbox-container-main'); // Updated to .checkbox-container-main
  if (dropTarget && draggedElement !== dropTarget) {
    const draggedTaskLabel = draggedElement.querySelector('.checkbox-label').textContent;
    const targetTaskLabel = dropTarget.querySelector('.checkbox-label').textContent;
    if (dragDirection === 'up') {
      dropTarget.before(draggedElement);
      addToTimeline('Task Rearranged', `${draggedTaskLabel} moved above ${targetTaskLabel}`);
      updateClearButtonVisibility();
    } else {
      dropTarget.after(draggedElement);k
      addToTimeline('Task Rearranged', `${draggedTaskLabel} moved below ${targetTaskLabel}`);
      updateClearButtonVisibility();
    }

  }
// Deactivate rearrange mode and update the UI
isRearrangeModeActive = false;
toggleRearrangeMode(isRearrangeModeActive);
hideArrows();
});

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('move-up')) {
      const currentTask = e.target.closest('.checkbox-container-main');
      const previousTask = currentTask.previousElementSibling;
      if (previousTask) {
          currentTask.parentNode.insertBefore(currentTask, previousTask);
          // Update arrows for both the moved task and its new previous sibling
          toggleArrowVisibility(currentTask, true);
          toggleArrowVisibility(previousTask, false); // Update for the task that moved down

          // Log the rearrangement in the timeline
          const taskLabel = currentTask.querySelector('.checkbox-label').textContent;
          addToTimeline('Task Moved Up', taskLabel);
          updateClearButtonVisibility();
      }
  } else if (e.target.classList.contains('move-down')) {
      const currentTask = e.target.closest('.checkbox-container-main');
      const nextTask = currentTask.nextElementSibling;
      if (nextTask) {
          currentTask.parentNode.insertBefore(nextTask, currentTask);
          // Update arrows for both the moved task and its new next sibling
          toggleArrowVisibility(currentTask, true);
          toggleArrowVisibility(nextTask, false); // Update for the task that moved up

          // Log the rearrangement in the timeline
          const taskLabel = currentTask.querySelector('.checkbox-label').textContent;
          addToTimeline('Task Moved Down', taskLabel);
          updateClearButtonVisibility();
      }
  }
});


menuRearrange.addEventListener('click', function(e) {
  // Toggle the current state of rearrange mode
  isRearrangeModeActive = !isRearrangeModeActive;
  toggleRearrangeMode(isRearrangeModeActive);

  // Show or hide arrows based on the Rearrange Mode state for the selected task
  if (isRearrangeModeActive) {
      showArrowsForSelectedTask();
      setActiveTask(selectedTask);
  } else {
      hideArrowsForAllTasks();
  }

  hideHorizontalMenu();
});


function toggleRearrangeMode(enable) {
  const allTasks = document.querySelectorAll('.checkbox-container-main');
  allTasks.forEach(task => {

      if (enable) {
          // Enable Rearrange Mode
          task.setAttribute("draggable", true);
          task.classList.add('draggable');
      } else {
          // Disable Rearrange Mode
          task.setAttribute("draggable", false);
          task.classList.remove('draggable');
          disableTaskDragging();
      }
  });
}


function showArrowsForSelectedTask() {
  if (selectedTask) {
      const container = selectedTask.closest('.checkbox-container-main');
      if (container) {
        activeRearrangeTask = container;
          toggleArrowVisibility(container, true);
      }
  }
}


function toggleArrowVisibility(taskElement, showArrows) {
  const upButton = taskElement.querySelector('.move-up');
  const downButton = taskElement.querySelector('.move-down');
  const allTasks = document.querySelectorAll('.checkbox-container-main');
  const isFirstTask = taskElement === allTasks[0];
  const isLastTask = taskElement === allTasks[allTasks.length - 1];

  if (showArrows) {
      if (upButton) upButton.classList.toggle('visible', !isFirstTask);
      if (downButton) downButton.classList.toggle('visible', !isLastTask);
  } else {
      if (upButton) upButton.classList.remove('visible');
      if (downButton) downButton.classList.remove('visible');
  }
}


document.querySelectorAll('.checkbox-container-main').forEach(task => {
  task.addEventListener('click', function(e) {
      if (isRearrangeModeActive) {
          // Hide arrows for all tasks
          hideArrowsForAllTasks();
          // Show arrows only for the clicked task
          toggleArrowVisibility(this, true);
      }
  });
});




function hideArrows() {
  document.querySelectorAll('.checkbox-container-main').forEach(task => {
    toggleArrowVisibility(task, isRearrangeModeActive);
});
}


// Variable to keep track of the currently active task

document.addEventListener('keydown', function(e) {

  if (!activeTask || !isRearrangeModeActive) {
    return; // Do nothing if no task is active or if not in rearrange mode
}
const currentTask = activeTask.closest('.checkbox-container-main');
    if (!currentTask) {
        return; // Exit if currentTask is null
    }
    
    if (e.key === 'ArrowUp') {
      const currentTask = e.target.closest('.checkbox-container-main');
      const previousTask = currentTask.previousElementSibling;
      if (previousTask) {
          currentTask.parentNode.insertBefore(currentTask, previousTask);
          // Update arrows for both the moved task and its new previous sibling
          toggleArrowVisibility(currentTask, true);
          toggleArrowVisibility(previousTask, false);
          
      }
        
      
    } else if (e.key === 'ArrowDown') {
      const currentTask = e.target.closest('.checkbox-container-main');
      const nextTask = currentTask.nextElementSibling;
      if (nextTask) {
          currentTask.parentNode.insertBefore(nextTask, currentTask);
          // Update arrows for both the moved task and its new next sibling
          toggleArrowVisibility(currentTask, true);
          toggleArrowVisibility(nextTask, false); 
    }
  }

});

// Example function to set the active task - you might set this on click or another event
function setActiveTask(taskElement) {
    activeTask = taskElement;
}

function isSubtask(element) {
  // Check if the element itself or its parent is a subtask
  return element.classList.contains('subtask') || element.parentElement.classList.contains('subtask');
}

function markSubtaskPriority(subtaskElement, priority) {
  // Implement the logic to mark subtask as high or low priority
  if (priority === 'high') {
    subtaskElement.classList.add('marked-high');
    subtaskElement.classList.remove('marked-low');
  } else if (priority === 'low') {
    subtaskElement.classList.add('marked-low');
    subtaskElement.classList.remove('marked-high');
  } else {
    // Unmark
    subtaskElement.classList.remove('marked-high', 'marked-low');
  }
}
 


function updateTaskDetails(taskId, newDetails) {
  console.log('updateTaskDetails called with:', taskId, newDetails);
  const taskContainer = document.getElementById(taskId); // Use `getElementById` since it's an `id`
  if (taskContainer) {
      console.log(`Before update: ${taskContainer.getAttribute('data-details')}`);
      taskContainer.setAttribute('data-details', newDetails); // Update details in DOM
      console.log(`After update: ${taskContainer.getAttribute('data-details')}`);
      addToTimeline(
        'Task Details Updated',
        `For task '${currentTaskElement.querySelector('.checkbox-label').textContent}'`
    );
      saveStateToLocalStorage(); // Save updated state to localStorage
      console.log(`Details saved for task ${taskId}: ${newDetails}`);
  } else {
      console.error(`Task with ID ${taskId} not found.`);
  }
}















function saveStateToLocalStorage() {
  if (isResetting) {
      return; // Don't save anything during reset
  }

  const tasks = [];
  document.querySelectorAll('.checkbox-container-main').forEach(taskContainer => {
      const taskLabel = taskContainer.querySelector('.checkbox-label').textContent;
      const isCompleted = taskContainer.querySelector('.checkbox-container').classList.contains('completed');
      const isManuallyCompleted = taskContainer.querySelector('.checkbox-container').classList.contains('manually-completed');
      const taskId = taskContainer.getAttribute('data-task-id');
      console.log('Task Contianer info Saved:',taskContainer);

      let priority = null;
      if (taskContainer.querySelector('.checkbox-container').classList.contains('marked-high')) {
          priority = 'high';
      } else if (taskContainer.querySelector('.checkbox-container').classList.contains('marked-low')) {
          priority = 'low';
      }

       // Correctly fetch taskDetails from the appropriate element
       const checkboxContainer = taskContainer.querySelector('.checkbox-container'); // Reference the element where data-details is stored
       const taskDetails = checkboxContainer?.getAttribute('data-details') || ''; // Safely fetch data-details
       console.log(`Saving details for task ${taskId}: ${taskDetails}`);
 
       // Capture the open/hidden state of the subtask container
       const subtaskContainer = taskContainer.querySelector('.subtask-container');
       const isSubtaskContainerOpen = !subtaskContainer.classList.contains('hidden');

      const subtasks = Array.from(taskContainer.querySelectorAll('.subtask-row')).map(subtask => {
          const name = subtask.querySelector('.subtask-label').textContent;
          const completed = subtask.querySelector('.subtask-checkbox').checked;
          const subtaskId = subtask.getAttribute('data-subtask-id');

          let subtaskPriority = null;
          if (subtask.classList.contains('marked-high')) {
              subtaskPriority = 'high';
          } else if (subtask.classList.contains('marked-low')) {
              subtaskPriority = 'low';
          }

          return { subtaskId, name, completed, priority: subtaskPriority };
      });

      // Save all task data, including the subtask container state
      tasks.push({
          taskId,
          taskLabel,
          isCompleted,
          isManuallyCompleted,
          priority,
          subtasks,
          details: taskDetails,
          isSubtaskContainerOpen // Save the visibility state
      });
  });

  const state = { tasks, counter };
  console.log("Saving to localStorage with details:", JSON.stringify(state, null, 2));
  localStorage.setItem('taskCycleState', JSON.stringify(state));
}


function loadStateFromLocalStorage() {
  const state = JSON.parse(localStorage.getItem('taskCycleState'));
  if (!state) return;

  counter = state.counter || 0;
  updateCounter();

  const checkboxList = document.getElementById('checkbox-list');

  state.tasks.forEach(({ taskId, taskLabel, isCompleted, isManuallyCompleted, priority, subtasks, details, isSubtaskContainerOpen }) => {
      const newCheckboxContainerId = `checkbox-container${checkboxCounter}`;
      addCheckboxmain(newCheckboxContainerId);

      const newCheckboxId = `checkbox${checkboxCounter}`;
      addCheckbox(newCheckboxId, taskLabel); // Use the saved label directly

      const newSubtaskContainerLabelID = `Subtask-Container${checkboxCounter}`;
      addSubtaskContainer(newSubtaskContainerLabelID);

      checkboxList.appendChild(checkboxContainermain);

      // Restore task metadata
      checkboxContainermain.setAttribute('data-task-id', taskId);
      const mainCheckbox = checkboxContainermain.querySelector('.checkbox-container');
      if (isCompleted) {
          mainCheckbox.classList.add('completed');
          if (isManuallyCompleted) {
              mainCheckbox.classList.add('manually-completed');
          }
      }

      if (priority === 'high') {
          mainCheckbox.classList.add('marked-high');
      } else if (priority === 'low') {
          mainCheckbox.classList.add('marked-low');
      }

    // Restore `data-details` on the `.checkbox-container` element
    if (mainCheckbox) {
      mainCheckbox.setAttribute('data-details', details || ''); // Set details on the correct element
  }

      // Restore subtasks
      subtasks.forEach(({ subtaskId, name, completed, priority: subtaskPriority }) => {
          const subtaskContainer = checkboxContainermain.querySelector('.subtask-container');
          addSubtaskCheckbox(`subtask${subtaskCounter}`, name, subtaskContainer, false);

          const subtaskCheckboxes = subtaskContainer.querySelectorAll('.subtask-checkbox');
          const subtaskCheckbox = subtaskCheckboxes[subtaskCheckboxes.length - 1];
          if (subtaskCheckbox) {
              subtaskCheckbox.checked = completed;

              const subtaskRow = subtaskCheckbox.closest('.subtask-row');
              subtaskRow.setAttribute('data-subtask-id', subtaskId);

              if (subtaskPriority === 'high') {
                  subtaskRow.classList.add('marked-high');
              } else if (subtaskPriority === 'low') {
                  subtaskRow.classList.add('marked-low');
              }
          }
          subtaskCounter++;
      });

      // Restore the open/hidden state of the subtask container
      const subtaskContainer = checkboxContainermain.querySelector('.subtask-container');
      if (isSubtaskContainerOpen) {
          subtaskContainer.classList.remove('hidden'); // Make it visible
      } else {
          subtaskContainer.classList.add('hidden'); // Keep it hidden
      }

      checkboxCounter++;
  });

  // Reflect subtask progress and update global state
  document.querySelectorAll('.subtask-container').forEach(subtaskContainer => {
      reflectSubtaskProgress(subtaskContainer);
  });

  updateProgressBar();
  updateStatsButtonVisibility();
}



function reflectSubtaskProgress(subtaskContainer, shouldCheckCompletion = true) {
  const parentContainerMain = subtaskContainer.closest('.checkbox-container-main');
  const mainCheckboxContainer = parentContainerMain.querySelector('.checkbox-container');

  // Skip updating if the task is manually completed
  if (mainCheckboxContainer.classList.contains('manually-completed')) {
      return;
  }

  const allSubtaskCheckboxes = subtaskContainer.querySelectorAll('.subtask-checkbox');
  const checkedSubtaskCheckboxes = subtaskContainer.querySelectorAll('.subtask-checkbox:checked');

  // Handle the scenario where all subtasks are deleted
  if (allSubtaskCheckboxes.length === 0) {
      return; // Exit early as there are no subtasks to process
  }

  // Calculate the completion percentage for subtasks
  const completionPercentage = (checkedSubtaskCheckboxes.length / allSubtaskCheckboxes.length) * 100;
  mainCheckboxContainer.style.setProperty('--progress', `${completionPercentage}%`);

  // Update the completion status of the main task
  if (checkedSubtaskCheckboxes.length === allSubtaskCheckboxes.length) {
      if (!mainCheckboxContainer.classList.contains('completed')) {
          mainCheckboxContainer.classList.add('completed');
          subtaskContainer.classList.add('hidden'); // Hide subtasks when completed
          logMainTaskCompletionStatus(mainCheckboxContainer, true); // Log completion
      }
  } else {
      if (mainCheckboxContainer.classList.contains('completed')) {
          mainCheckboxContainer.classList.remove('completed');
          subtaskContainer.classList.remove('hidden'); // Show subtasks if not fully completed
          logMainTaskCompletionStatus(mainCheckboxContainer, false); // Log uncompletion
      }
  }

  // Update the progress bar and completion check
  updateProgressColor(mainCheckboxContainer);
  updateProgressBar();

  if (shouldCheckCompletion) {
      checkCompletion();
  }
}





// Save state when a checkbox is toggled
document.querySelector('#checkbox-list').addEventListener('change', (event) => {
    console.log("Checkbox toggled. Element:", event.target);
    console.log("Updated localStorage:", JSON.parse(localStorage.getItem('taskCycleState')));
    saveStateToLocalStorage();
});

// Save state when a new task is added
document.querySelector('#add-button').addEventListener('click', () => {
    console.log("New task added. Current task counter:", checkboxCounter);
    console.log("Updated localStorage after adding a task:", JSON.parse(localStorage.getItem('taskCycleState')));
    saveStateToLocalStorage();
});


resetButton.addEventListener('click', () => {
    counter = 0; // Reset the counter
    updateCounter(); // Update the counter display
    saveStateToLocalStorage(); // Save the reset state
});



// Function to observe changes in the checkbox list
function observeCheckboxListChanges() {
    const checkboxList = document.querySelector('#checkbox-list');

    if (!checkboxList) {
        console.error("Checkbox list element not found!");
        return;
    }

    // Create a MutationObserver to monitor changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                console.log("A task or subtask was added or removed.");
            } else if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                console.log("A task or subtask attribute was modified.");
            }
        });

        // Save the current state whenever any change occurs
        console.log("Saving state to localStorage...");
        saveStateToLocalStorage();
    });

    // Configure the observer to watch for child node changes and attribute changes
    observer.observe(checkboxList, {
        childList: true, // Watch for additions or removals of child nodes
        attributes: true, // Watch for attribute changes
        subtree: true // Monitor all descendants of the checkbox list
    });
}


function saveNotesToLocalStorage() {
    const notes = [];
    document.querySelectorAll('.note-item').forEach(noteItem => {
        const noteText = noteItem.querySelector('.note-text').innerHTML; // Save with <br> formatting
        notes.push(noteText);
    });

    localStorage.setItem('notes', JSON.stringify(notes));
}



function loadNotesFromLocalStorage() {
    const savedNotes = JSON.parse(localStorage.getItem('notes')); // Parse the stored JSON

    if (savedNotes && Array.isArray(savedNotes)) {
        savedNotes.forEach(noteText => {
            const noteItem = document.createElement('div');
            noteItem.className = 'note-item';
            
            const noteTextDiv = document.createElement('div');
            noteTextDiv.className = 'note-text';
            noteTextDiv.innerHTML = noteText; // Restore <br> formatting
            noteItem.appendChild(noteTextDiv);

            const noteButtonContainer = document.createElement('div');
            noteButtonContainer.className = 'note-button-container';

            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', function() {
                editNote(noteItem);
            });

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => {
                // Get note text before removing
                let noteText = noteItem.querySelector('.note-text').textContent;

                // Remove the note item
                notesList.removeChild(noteItem);

                // Add to timeline
                addToTimeline('Note Deleted', noteText);
                updateClearButtonVisibility();

                // Save updated notes to localStorage
                saveNotesToLocalStorage();
            });

            // Append buttons to the button container
            noteButtonContainer.appendChild(editButton);
            noteButtonContainer.appendChild(deleteButton);

            // Append the button container to the note item
            noteItem.appendChild(noteButtonContainer);

            notesList.appendChild(noteItem);
        });

        updateClearButtonVisibility();
    }
}




// Call this function to start observing changes
observeCheckboxListChanges();


loadStateFromLocalStorage(); // Load the state when the page loads
loadNotesFromLocalStorage(); // Load Notes 
loadTimelineFromLocalStorage(); // Load timeline on page load


const resetModal = document.getElementById('reset-modal');
const confirmResetButton = document.getElementById('confirm-reset');
const cancelResetButton = document.getElementById('cancel-reset');

// Show the modal when reset button is clicked
document.getElementById('reset-cycle').addEventListener('click', function () {
  resetModal.classList.remove('hidden');
});

confirmResetButton.addEventListener('click', function () {
    isResetting = true; // Set the resetting flag to true

    // Clear all tasks from the DOM
    const checkboxList = document.getElementById('checkbox-list');
    while (checkboxList.firstChild) {
        checkboxList.removeChild(checkboxList.firstChild);
    }

    // Clear all relevant localStorage data
    localStorage.removeItem('taskCycleState');
    localStorage.clear(); // Optional: Clear all localStorage keys if applicable

    // Reset the app state
    counter = 0; // Reset the task cycle counter
    updateCounter(); // Update the counter display in the UI
    alert('All Task Cycle data has been deleted. The app will reset now.');
    location.reload(); // Reload the app to start fresh
});

  

// Handle cancellation
cancelResetButton.addEventListener('click', function () {
  resetModal.classList.add('hidden');
});


function saveTimelineToLocalStorage() {
  // Retrieve existing timeline entries from localStorage
  const existingTimeline = JSON.parse(localStorage.getItem('timeline')) || [];

  // Extract current timeline entries from the DOM
  const newTimelineEntries = Array.from(document.querySelectorAll('.timeline-entry')).map(entry => {
      const timestamp = entry.querySelector('strong')?.textContent || '';
      const action = entry.textContent.replace(/^.*?:\s*[^:]*?:\s*[^:]*?:\s*/, '');
      const parentTask = entry.dataset.parentTask || null;
      const parentSubtask = entry.dataset.parentSubtask || null;
      const classes = Array.from(entry.classList);

      return {
          timestamp,
          action,
          classes,
          parentTask,
          parentSubtask,
      };
  });

  // Merge new entries with existing ones, avoiding duplicates
  const mergedTimeline = [...existingTimeline];

  newTimelineEntries.forEach(newEntry => {
      const isDuplicate = existingTimeline.some(existingEntry =>
          existingEntry.timestamp === newEntry.timestamp &&
          existingEntry.action === newEntry.action &&
          existingEntry.parentTask === newEntry.parentTask &&
          existingEntry.parentSubtask === newEntry.parentSubtask
      );

      if (!isDuplicate) {
          mergedTimeline.push(newEntry);
      }
  });

  // Save the merged timeline to localStorage
  localStorage.setItem('timeline', JSON.stringify(mergedTimeline));

  console.log('Timeline saved to localStorage (duplicates avoided):', JSON.parse(localStorage.getItem('timeline')));
}


function loadTimelineFromLocalStorage() {
  const savedTimeline = JSON.parse(localStorage.getItem('timeline')) || [];
  const timelineContainer = document.getElementById('timeline-content');
  timelineContainer.innerHTML = ''; // Clear existing entries

  savedTimeline.forEach(entry => {
      const timelineEntry = document.createElement('div');
      
      // Add all saved classes back to the entry
      entry.classes.forEach(cls => timelineEntry.classList.add(cls));

      // Reapply parent task and subtask context
      if (entry.parentTask) {
          timelineEntry.dataset.parentTask = entry.parentTask;
      }
      if (entry.parentSubtask) {
          timelineEntry.dataset.parentSubtask = entry.parentSubtask;
      }

      // Use the saved timestamp and action to reconstruct the entry
      timelineEntry.innerHTML = `<strong>${entry.timestamp}</strong>: ${entry.action}`;
      timelineContainer.appendChild(timelineEntry);

      // Reattach click listeners for modal if needed
      timelineEntry.addEventListener('click', () => {
          showPopup(timelineEntry);
      });
  });
  

  updateClearButtonVisibility();
  console.log('Timeline with subtasks loaded from local storage:', savedTimeline);
}





function clearTimeline() {
    document.getElementById('timeline-content').innerHTML = ''; // Clear entries
    localStorage.removeItem('timeline'); // Remove from storage
    updateClearButtonVisibility();
}


document.addEventListener('keydown', (event) => {
  // Check for the specific key combination, e.g., "Alt + N"
  if (event.altKey && event.key === 'n') {
      event.preventDefault(); // Prevent default browser behavior
      const newCheckboxLabelInput = document.getElementById('new-checkbox-label');
      
      // Show the input field for creating a new task
      if (newCheckboxLabelInput) {
          newCheckboxLabelInput.style.display = 'block';
          newCheckboxLabelInput.focus();
          newCheckboxLabelInput.addEventListener('blur', createCheckboxIfNotEmpty);
      } else {
          console.error("New checkbox label input not found.");
      }
  }
});


let lastSubtaskContainer = null; // To track the last opened subtask container

// Update the reference when a subtask window is opened
document.addEventListener('click', (event) => {
    const parentTask = event.target.closest('.checkbox-container-main');
    if (parentTask) {
        const subtaskContainer = parentTask.querySelector('.subtask-container');
        if (subtaskContainer && !subtaskContainer.classList.contains('hidden')) {
            lastSubtaskContainer = subtaskContainer; // Update the reference
        }
    }
});

// Keyboard shortcut for adding a subtask (Alt + S)
document.addEventListener('keydown', (event) => {
    if (event.altKey && event.key === 's') {
        event.preventDefault(); // Prevent default browser behavior

        if (lastSubtaskContainer) {
            // Create a new subtask
            const newSubtaskLabelID = `Subtask${subtaskCounter}`;
            addSubtaskCheckbox(newSubtaskLabelID, "", lastSubtaskContainer, true); // `true` indicates it's a new subtask
        } else {
            alert("No subtask container is open. Open a subtask container first.");
        }
    }
});












    updateCounter();

}



