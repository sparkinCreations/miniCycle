/**
 * ==========================================
 * 🔌 EXAMPLE PLUGIN: TIME TRACKER
 * ==========================================
 * 
 * A simple example plugin that demonstrates how to extend miniCycle
 * with time tracking functionality.
 */

class TimeTrackerPlugin extends MiniCyclePlugin {
    constructor() {
        super('TimeTracker', '1.0.0');
        this.startTimes = new Map();
        this.sessionData = new Map();
    }

    async onLoad() {
        await super.onLoad();
        
        // Add time tracker UI elements
        this.addTimeTrackerUI();
        
        // Load saved data
        this.loadSavedData();
        
        console.log('⏱️ Time Tracker Plugin loaded');
    }

    async onUnload() {
        await super.onUnload();
        
        // Save data before unloading
        this.saveData();
        
        // Remove UI elements
        this.removeTimeTrackerUI();
        
        console.log('⏱️ Time Tracker Plugin unloaded');
    }

    onTaskAdded(task) {
        console.log('⏱️ New task added, time tracking available:', task.text);
    }

    onTaskCompleted(task) {
        if (this.startTimes.has(task.id)) {
            const startTime = this.startTimes.get(task.id);
            const duration = Date.now() - startTime;
            
            // Save time data
            this.saveTimeData(task.id, task.text, duration);
            this.startTimes.delete(task.id);
            
            this.addNotification(`Task completed in ${this.formatDuration(duration)}`, 'success');
        }
    }

    onTaskDeleted(task) {
        // Clean up tracking data for deleted task
        this.startTimes.delete(task.id);
        this.sessionData.delete(task.id);
    }

    addTimeTrackerUI() {
        // Add a simple time display to the UI
        const existingDisplay = document.getElementById('time-tracker-display');
        if (existingDisplay) return; // Already added

        const display = document.createElement('div');
        display.id = 'time-tracker-display';
        display.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            z-index: 1000;
            max-width: 250px;
        `;
        display.innerHTML = `
            <div><strong>⏱️ Time Tracker</strong></div>
            <div id="active-timers">No active timers</div>
            <button id="show-time-report" style="margin-top: 5px; padding: 2px 5px;">Show Report</button>
        `;

        document.body.appendChild(display);

        // Add event listeners
        document.getElementById('show-time-report').addEventListener('click', () => {
            this.showTimeReport();
        });

        // Update display every second
        this.updateInterval = setInterval(() => {
            this.updateTimeDisplay();
        }, 1000);
    }

    removeTimeTrackerUI() {
        const display = document.getElementById('time-tracker-display');
        if (display) {
            display.remove();
        }

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    updateTimeDisplay() {
        const activeTimersDiv = document.getElementById('active-timers');
        if (!activeTimersDiv) return;

        if (this.startTimes.size === 0) {
            activeTimersDiv.innerHTML = 'No active timers';
            return;
        }

        let html = '';
        this.startTimes.forEach((startTime, taskId) => {
            const elapsed = Date.now() - startTime;
            const task = this.getCurrentTasks().find(t => t.id === taskId);
            const taskText = task ? task.text.substring(0, 20) + '...' : 'Unknown task';
            html += `<div>${taskText}: ${this.formatDuration(elapsed)}</div>`;
        });

        activeTimersDiv.innerHTML = html;
    }

    startTimer(taskId) {
        if (this.startTimes.has(taskId)) {
            this.addNotification('Timer already running for this task', 'warning');
            return;
        }

        this.startTimes.set(taskId, Date.now());
        this.addNotification('Timer started', 'info');
    }

    stopTimer(taskId) {
        if (!this.startTimes.has(taskId)) {
            this.addNotification('No timer running for this task', 'warning');
            return;
        }

        const startTime = this.startTimes.get(taskId);
        const duration = Date.now() - startTime;
        const task = this.getCurrentTasks().find(t => t.id === taskId);
        
        if (task) {
            this.saveTimeData(taskId, task.text, duration);
        }
        
        this.startTimes.delete(taskId);
        this.addNotification(`Timer stopped: ${this.formatDuration(duration)}`, 'success');
    }

    saveTimeData(taskId, taskText, duration) {
        const timeData = JSON.parse(localStorage.getItem('timeTrackerData') || '{}');
        
        if (!timeData[taskId]) {
            timeData[taskId] = {
                taskText: taskText,
                sessions: []
            };
        }

        timeData[taskId].sessions.push({
            duration: duration,
            date: new Date().toISOString()
        });

        localStorage.setItem('timeTrackerData', JSON.stringify(timeData));
    }

    loadSavedData() {
        const timeData = JSON.parse(localStorage.getItem('timeTrackerData') || '{}');
        console.log('⏱️ Loaded time tracking data:', Object.keys(timeData).length, 'tasks tracked');
    }

    saveData() {
        // Data is saved automatically in saveTimeData
        console.log('⏱️ Time tracking data saved');
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    showTimeReport() {
        const timeData = JSON.parse(localStorage.getItem('timeTrackerData') || '{}');
        
        if (Object.keys(timeData).length === 0) {
            this.addNotification('No time tracking data available', 'info');
            return;
        }

        // Create a simple report
        let report = '⏱️ TIME TRACKING REPORT\n\n';
        let totalTime = 0;

        Object.entries(timeData).forEach(([taskId, data]) => {
            const taskTotal = data.sessions.reduce((sum, session) => sum + session.duration, 0);
            totalTime += taskTotal;
            
            report += `${data.taskText}:\n`;
            report += `  Total: ${this.formatDuration(taskTotal)}\n`;
            report += `  Sessions: ${data.sessions.length}\n\n`;
        });

        report += `TOTAL TIME TRACKED: ${this.formatDuration(totalTime)}`;

        // Show in console and notification
        console.log(report);
        this.addNotification('Time report generated (check console)', 'success');
    }

    // Public methods for integration with task UI
    addTimerToTask(taskElement, taskId) {
        const timerButton = document.createElement('button');
        timerButton.textContent = '⏱️';
        timerButton.title = 'Start/Stop Timer';
        timerButton.style.cssText = 'margin-left: 5px; padding: 2px 5px; border: none; background: #007cba; color: white; border-radius: 3px; cursor: pointer;';
        
        timerButton.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (this.startTimes.has(taskId)) {
                this.stopTimer(taskId);
                timerButton.style.background = '#007cba';
            } else {
                this.startTimer(taskId);
                timerButton.style.background = '#dc3545';
            }
        });

        taskElement.appendChild(timerButton);
    }
}

// Export for use
window.TimeTrackerPlugin = TimeTrackerPlugin;