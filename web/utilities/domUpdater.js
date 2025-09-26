// domUpdater.js
class DOMUpdater {
    constructor(appState) {
        this.state = appState;
        this.setupListeners();
    }

    setupListeners() {
        // Listen for task changes
        this.state.subscribe('tasks', (newState, oldState) => {
            this.updateTaskList(newState);
        });

        // Listen for progress changes
        this.state.subscribe('progress', (newState, oldState) => {
            this.updateProgressBar(newState);
        });

        // Listen for theme changes
        this.state.subscribe('theme', (newState, oldState) => {
            this.updateTheme(newState.settings.theme);
        });
    }

    updateTaskList(state) {
        const tasks = state.data.cycles[state.appState.activeCycleId]?.tasks || [];
        const taskList = document.getElementById("taskList");
        
        // Efficient DOM updates - only change what's different
        this.reconcileTaskList(taskList, tasks);
    }

    reconcileTaskList(container, tasks) {
        // Smart DOM diffing - only update changed elements
        const existingItems = Array.from(container.children);
        const existingIds = existingItems.map(item => item.dataset.taskId);
        const newIds = tasks.map(task => task.id);

        // Remove deleted tasks
        existingItems.forEach(item => {
            if (!newIds.includes(item.dataset.taskId)) {
                item.remove();
            }
        });

        // Add/update tasks
        tasks.forEach((task, index) => {
            let taskElement = container.querySelector(`[data-task-id="${task.id}"]`);
            
            if (!taskElement) {
                // Create new element
                taskElement = this.createTaskElement(task);
                container.appendChild(taskElement);
            } else {
                // Update existing element
                this.updateTaskElement(taskElement, task);
            }
        });
    }
}