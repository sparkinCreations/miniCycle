// CycleFlow - Claude's Task Cycling Demo
// A clean, modern interpretation of task cycling concepts

class CycleFlow {
    constructor() {
        this.tasks = [];
        this.stats = {
            totalCycles: 0,
            streakDays: 0,
            lastCycleDate: null
        };
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.updateUI();
        this.checkDailyStreak();
        this.setupPWA();
    }

    // Data Management
    loadData() {
        try {
            const saved = localStorage.getItem('cycleflow-data');
            if (saved) {
                const data = JSON.parse(saved);
                this.tasks = data.tasks || [];
                this.stats = { ...this.stats, ...data.stats };
            }
        } catch (error) {
            console.warn('Could not load saved data:', error);
        }
    }

    saveData() {
        try {
            const data = {
                tasks: this.tasks,
                stats: this.stats,
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem('cycleflow-data', JSON.stringify(data));
        } catch (error) {
            console.warn('Could not save data:', error);
        }
    }

    // Task Management
    addTask(text = null) {
        const input = document.getElementById('taskInput');
        const taskText = text || input.value.trim();
        
        if (!taskText) return;

        const task = {
            id: Date.now() + Math.random(),
            text: taskText,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.push(task);
        input.value = '';
        
        this.saveData();
        this.updateUI();
        this.animateTaskAdd();
    }

    toggleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date().toISOString() : null;

        this.saveData();
        this.updateUI();
        
        if (task.completed) {
            this.animateTaskComplete();
            this.checkForCycleCompletion();
        }
    }

    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveData();
        this.updateUI();
    }

    resetTasks() {
        if (this.tasks.length === 0) return;
        
        if (confirm('Are you sure you want to clear all tasks?')) {
            this.tasks = [];
            this.saveData();
            this.updateUI();
        }
    }

    // Cycling Logic
    checkForCycleCompletion() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        
        if (total > 0 && completed === total) {
            setTimeout(() => this.completeCycle(), 500);
        }
    }

    completeCycle() {
        if (this.tasks.length === 0) return;
        
        const completed = this.tasks.filter(t => t.completed).length;
        const total = this.tasks.length;
        
        if (completed < total) {
            if (!confirm(`You still have ${total - completed} incomplete tasks. Complete cycle anyway?`)) {
                return;
            }
        }

        // Update stats
        this.stats.totalCycles++;
        this.stats.lastCycleDate = new Date().toISOString();
        this.updateStreak();

        // Show celebration
        this.showCelebration();

        // Reset tasks after animation
        setTimeout(() => {
            this.tasks = [];
            this.saveData();
            this.updateUI();
        }, 2000);
    }

    updateStreak() {
        const today = new Date();
        const lastCycle = this.stats.lastCycleDate ? new Date(this.stats.lastCycleDate) : null;
        
        if (!lastCycle) {
            this.stats.streakDays = 1;
        } else {
            const daysDiff = Math.floor((today - lastCycle) / (1000 * 60 * 60 * 24));
            
            if (daysDiff === 0) {
                // Same day, keep streak
            } else if (daysDiff === 1) {
                // Next day, increment
                this.stats.streakDays++;
            } else {
                // Streak broken, reset
                this.stats.streakDays = 1;
            }
        }
    }

    checkDailyStreak() {
        const today = new Date().toDateString();
        const lastCycle = this.stats.lastCycleDate ? new Date(this.stats.lastCycleDate).toDateString() : null;
        
        if (lastCycle && lastCycle !== today) {
            const daysDiff = Math.floor((new Date() - new Date(this.stats.lastCycleDate)) / (1000 * 60 * 60 * 24));
            if (daysDiff > 1) {
                // Streak broken
                this.stats.streakDays = 0;
                this.saveData();
            }
        }
    }

    // UI Updates
    updateUI() {
        this.updateStats();
        this.updateTaskList();
        this.updateProgress();
        this.updateCycleButton();
    }

    updateStats() {
        const completed = this.tasks.filter(t => t.completed).length;
        const total = this.tasks.length;
        
        document.getElementById('completedCount').textContent = completed;
        document.getElementById('totalCount').textContent = total;
        document.getElementById('cycleCount').textContent = this.stats.totalCycles;
        document.getElementById('streakCount').textContent = this.stats.streakDays;
    }

    updateTaskList() {
        const container = document.getElementById('taskContainer');
        
        if (this.tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="emoji">📝</div>
                    <p>Start your cycle by adding a task above!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}" onclick="app.toggleTask(${task.id})">
                <div class="task-checkbox">
                    ${task.completed ? '✓' : ''}
                </div>
                <div class="task-text">${this.escapeHtml(task.text)}</div>
                <button class="delete-btn" onclick="event.stopPropagation(); app.deleteTask(${task.id})" title="Delete task">
                    🗑️
                </button>
            </div>
        `).join('');
    }

    updateProgress() {
        const completed = this.tasks.filter(t => t.completed).length;
        const total = this.tasks.length;
        const percentage = total > 0 ? (completed / total) * 100 : 0;
        
        document.getElementById('progressFill').style.width = `${percentage}%`;
    }

    updateCycleButton() {
        const btn = document.getElementById('cycleBtn');
        const completed = this.tasks.filter(t => t.completed).length;
        const total = this.tasks.length;
        
        if (total === 0) {
            btn.disabled = true;
            btn.textContent = '🔄 Complete Cycle';
        } else if (completed === total) {
            btn.disabled = false;
            btn.textContent = '🎉 Cycle Complete!';
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        } else {
            btn.disabled = false;
            btn.textContent = `🔄 Complete Cycle (${completed}/${total})`;
            btn.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)';
        }
    }

    // Animations
    animateTaskAdd() {
        const items = document.querySelectorAll('.task-item');
        const lastItem = items[items.length - 1];
        
        if (lastItem) {
            lastItem.style.transform = 'translateX(-100px)';
            lastItem.style.opacity = '0';
            
            setTimeout(() => {
                lastItem.style.transition = 'all 0.3s ease';
                lastItem.style.transform = 'translateX(0)';
                lastItem.style.opacity = '1';
            }, 50);
        }
    }

    animateTaskComplete() {
        // Add a little celebration effect
        const completedTasks = document.querySelectorAll('.task-item.completed');
        const lastCompleted = completedTasks[completedTasks.length - 1];
        
        if (lastCompleted) {
            lastCompleted.style.transform = 'scale(1.05)';
            setTimeout(() => {
                lastCompleted.style.transform = 'scale(1)';
            }, 200);
        }
    }

    showCelebration() {
        const celebration = document.createElement('div');
        celebration.className = 'celebration';
        celebration.innerHTML = `
            <div class="emoji">🎉</div>
            <h2>Cycle Complete!</h2>
            <p>Great job! You've completed cycle #${this.stats.totalCycles}</p>
            <p><strong>Streak: ${this.stats.streakDays} days</strong></p>
        `;
        
        document.body.appendChild(celebration);
        
        // Add confetti effect
        this.createConfetti();
        
        setTimeout(() => {
            celebration.remove();
        }, 3000);
    }

    createConfetti() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
        const confettiCount = 50;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.top = '-10px';
            confetti.style.width = '10px';
            confetti.style.height = '10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.pointerEvents = 'none';
            confetti.style.zIndex = '9999';
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            
            document.body.appendChild(confetti);
            
            const animation = confetti.animate([
                { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                { transform: `translateY(100vh) rotate(${Math.random() * 360}deg)`, opacity: 0 }
            ], {
                duration: 3000 + Math.random() * 2000,
                easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)'
            });
            
            animation.onfinish = () => confetti.remove();
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Enter key to add task
        document.getElementById('taskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addTask();
            }
        });

        // Auto-save on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveData();
            }
        });

        // Save before page unload
        window.addEventListener('beforeunload', () => {
            this.saveData();
        });
    }

    // PWA Setup
    setupPWA() {
        // Service Worker registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.log('SW registration failed');
            });
        }

        // Install prompt
        let deferredPrompt;
        const installBtn = document.getElementById('installBtn');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installBtn.style.display = 'block';
        });

        installBtn.addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(() => {
                    deferredPrompt = null;
                    installBtn.style.display = 'none';
                });
            }
        });
    }

    // Utilities
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Demo Data
    loadDemoData() {
        const demoTasks = [
            'Review daily goals',
            'Check emails',
            'Exercise for 30 minutes',
            'Prepare healthy lunch',
            'Work on main project',
            'Call a friend or family member',
            'Read for 20 minutes',
            'Plan tomorrow'
        ];

        demoTasks.forEach(task => this.addTask(task));
    }
}

// Initialize the app
const app = new CycleFlow();

// Global functions for HTML onclick handlers
function addTask() {
    app.addTask();
}

function completeCycle() {
    app.completeCycle();
}

function resetTasks() {
    app.resetTasks();
}

// Add demo data button for testing
document.addEventListener('DOMContentLoaded', () => {
    // Add demo button if no tasks exist
    if (app.tasks.length === 0) {
        const demoBtn = document.createElement('button');
        demoBtn.textContent = '✨ Load Demo Tasks';
        demoBtn.className = 'action-btn';
        demoBtn.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
        demoBtn.style.color = 'white';
        demoBtn.onclick = () => {
            app.loadDemoData();
            demoBtn.remove();
        };
        
        document.querySelector('.actions').appendChild(demoBtn);
    }
});