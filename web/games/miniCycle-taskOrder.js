// miniCycle-taskOrder.js — Whack-a-Order game logic

(function () {
    'use strict';

    /***** Centralized Labels *****/
    var LABELS = Object.freeze({
        title: 'Whack-a-Order',
        difficultyEasy: 'Easy',
        difficultyNormal: 'Normal',
        difficultyHard: 'Hard',
        instructions: 'Click the tasks in the correct order (1, 2, 3, ...). They will move faster each round!',
        scoreboard: 'Round: {round} | Score: {score}',
        roundComplete: 'Round complete! \u{1F389}',
        wrongOrder: 'Wrong order! Game Over! \u{274C}',
        winner: '\u{1F389} Winner! Time: {time}s',
        newBest: '\u{1F31F} New Best!',
        yourBest: 'Your Best ({difficulty}):',
        restartGame: 'Restart Game',
        backToApp: 'Back to miniCycle',
        gameAriaLabel: 'Whack-a-Order Mini Game',
        taskFieldAria: 'Task field',
        restartAria: 'Restart Game',
        backAria: 'Go back to miniCycle',
        noTime: '--',
        fallbackTasks: [
            'Inspect Part', 'Check Serial', 'Verify Job', 'Record Number',
            'Update Log', 'Order Supplies', 'Calibrate Tool', 'Review Report',
            'Confirm Specs', 'Test Output', 'Schedule Meeting', 'File Report'
        ]
    });

    /***** Game Constants *****/
    // Self-contained page — local constants by design (core/constants.js is the
    // app-side home; games are outside the DI system).
    var BTN_CLEARANCE_X   = 140;  // spawn margin ≈ widest task button, keeps buttons fully inside the window
    var BTN_CLEARANCE_Y   = 50;   // spawn margin ≈ button height
    var TASK_LABEL_MAX    = 22;   // chars before truncation

    var PARTICLE_COUNT    = 12;
    var PARTICLE_MIN_DIST = 50;   // px — burst radius = MIN + random * SPREAD
    var PARTICLE_SPREAD   = 50;
    var PARTICLE_LIFE_MS  = 700;

    var SPEED_JITTER_BASE  = 0.8; // speed = multiplier * (BASE + random * RANGE)
    var SPEED_JITTER_RANGE = 0.4;
    var BOUNCE_DAMP_BASE   = 0.9; // wall bounce: dx *= -(BASE + random * RANGE)
    var BOUNCE_DAMP_RANGE  = 0.2;

    var NEXT_ROUND_DELAY_MS = 1500;
    var NEW_BEST_DELAY_MS   = 800;
    var TIMER_TICK_MS       = 250;

    /** Populate DOM elements from LABELS */
    function populateLabels() {
        document.querySelector('h1').textContent = LABELS.title;
        document.getElementById('instructions').textContent = LABELS.instructions;
        document.querySelector('[data-difficulty="easy"]').textContent = LABELS.difficultyEasy;
        document.querySelector('[data-difficulty="normal"]').textContent = LABELS.difficultyNormal;
        document.querySelector('[data-difficulty="hard"]').textContent = LABELS.difficultyHard;
        document.getElementById('restartBtn').textContent = LABELS.restartGame;
        document.getElementById('restartBtn').setAttribute('aria-label', LABELS.restartAria);
        document.getElementById('back-to-minicycle').textContent = LABELS.backToApp;
        document.getElementById('back-to-minicycle').setAttribute('aria-label', LABELS.backAria);
        document.querySelector('.game-container').setAttribute('aria-label', LABELS.gameAriaLabel);
        document.getElementById('taskWindow').setAttribute('aria-label', LABELS.taskFieldAria);
    }

    /** Check if reduced motion is preferred */
    function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
               document.documentElement.classList.contains('reduced-motion');
    }

    /** Truncate text to maxLen characters */
    function truncateText(text, maxLen) {
        if (text.length <= maxLen) return text;
        return text.substring(0, maxLen - 1) + '\u2026';
    }

    /** Clean task name for game display */
    function cleanTaskName(text) {
        return truncateText(text.trim(), TASK_LABEL_MAX);
    }

    /***** Difficulty Settings *****/
    var DIFFICULTY_SETTINGS = {
        easy:   { baseSpeed: 80,  speedIncrease: 10, maxRounds: 10, label: LABELS.difficultyEasy },
        normal: { baseSpeed: 120, speedIncrease: 15, maxRounds: 10, label: LABELS.difficultyNormal },
        hard:   { baseSpeed: 160, speedIncrease: 20, maxRounds: 15, label: LABELS.difficultyHard }
    };

    var currentDifficulty = 'easy';

    /***** Schema 2.5 Integration *****/
    function getSchema25Data() {
        try {
            var rawData = localStorage.getItem("miniCycleData");
            if (!rawData) return null;
            var schemaData = JSON.parse(rawData);
            if (!schemaData || schemaData.schemaVersion !== "2.5") return null;
            return schemaData;
        } catch (error) {
            console.error('Error reading Schema 2.5 data:', error);
            return null;
        }
    }

    function saveGameStatsToSchema25(difficulty, round, time) {
        try {
            var schemaData = getSchema25Data();
            if (!schemaData) return { saved: false };

            if (!schemaData.settings) schemaData.settings = {};
            if (!schemaData.settings.gameStats) {
                schemaData.settings.gameStats = { taskOrderGame: {} };
            }
            if (!schemaData.settings.gameStats.taskOrderGame) {
                schemaData.settings.gameStats.taskOrderGame = {};
            }
            if (!schemaData.settings.gameStats.taskOrderGame[difficulty]) {
                schemaData.settings.gameStats.taskOrderGame[difficulty] = {
                    bestRound: 0, bestTime: Infinity, gamesPlayed: 0
                };
            }

            var stats = schemaData.settings.gameStats.taskOrderGame[difficulty];
            var isNewBest = false;
            if (round > stats.bestRound) { stats.bestRound = round; isNewBest = true; }
            if (time < stats.bestTime) { stats.bestTime = time; isNewBest = true; }
            stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
            stats.lastPlayed = Date.now();

            localStorage.setItem("miniCycleData", JSON.stringify(schemaData));
            return { saved: true, isNewBest: isNewBest };
        } catch (error) {
            console.error('Error saving game stats:', error);
            return { saved: false };
        }
    }

    function loadGameStatsFromSchema25(difficulty) {
        try {
            var schemaData = getSchema25Data();
            if (!schemaData || !schemaData.settings || !schemaData.settings.gameStats || !schemaData.settings.gameStats.taskOrderGame) {
                return { bestRound: 0, bestTime: Infinity, gamesPlayed: 0 };
            }
            return schemaData.settings.gameStats.taskOrderGame[difficulty] ||
                   { bestRound: 0, bestTime: Infinity, gamesPlayed: 0 };
        } catch (error) {
            return { bestRound: 0, bestTime: Infinity, gamesPlayed: 0 };
        }
    }

    /***** Game Setup *****/
    function getTaskNames() {
        var schemaData = getSchema25Data();
        if (!schemaData) return [];

        var activeCycleId = schemaData.appState && schemaData.appState.activeCycleId;
        if (!activeCycleId) return [];

        var currentCycle = schemaData.data && schemaData.data.cycles && schemaData.data.cycles[activeCycleId];
        if (!currentCycle || !Array.isArray(currentCycle.tasks)) return [];

        return currentCycle.tasks
            .map(function (task) { return task.text; })
            .filter(function (text) { return text && text.trim() !== ""; });
    }

    var tasks = getTaskNames();
    if (tasks.length === 0) {
        tasks = LABELS.fallbackTasks.slice();
    }

    var round = 1;
    var score = 0;
    var expectedOrder = 1;
    var gameActive = true;
    var gameStartTime = null;
    var timerInterval = null;

    var taskWindow = document.getElementById("taskWindow");
    var feedbackEl = document.getElementById("feedback");
    var scoreboardEl = document.getElementById("scoreboard");
    var timerEl = document.getElementById("timer");
    var restartBtn = document.getElementById("restartBtn");
    var bestRoundEl = document.getElementById("bestRound");
    var bestTimeEl = document.getElementById("bestTime");
    var gamesPlayedEl = document.getElementById("gamesPlayed");
    var lbTitleEl = document.getElementById("lbTitle");
    var backToMiniCycle = document.getElementById("back-to-minicycle");
    var difficultyButtons = document.querySelectorAll('.difficulty-btn');

    var currentTasks = [];
    var movementAnimationFrame = null;
    var lastTimestamp = null;

    /***** Timer *****/
    function startTimer() {
        stopTimer();
        gameStartTime = Date.now();
        timerEl.textContent = '0:00';
        timerInterval = setInterval(function () {
            if (!gameStartTime) return;
            var elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
            var mins = Math.floor(elapsed / 60);
            var secs = elapsed % 60;
            timerEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
        }, TIMER_TICK_MS);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    /***** Difficulty Selection *****/
    difficultyButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (!gameActive && round > 1) return;

            difficultyButtons.forEach(function (b) { b.classList.remove('active'); });
            this.classList.add('active');
            currentDifficulty = this.dataset.difficulty;
            updateLeaderboardDisplay();

            if (round > 1) restartGame();
        });
    });

    /***** Particle Effects *****/
    function createParticles(x, y, color) {
        if (prefersReducedMotion()) return;

        var particleCount = PARTICLE_COUNT;
        for (var i = 0; i < particleCount; i++) {
            var particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.background = color;
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';

            var angle = (Math.PI * 2 * i) / particleCount;
            var distance = PARTICLE_MIN_DIST + Math.random() * PARTICLE_SPREAD;
            particle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
            particle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');

            taskWindow.appendChild(particle);
            setTimeout(function (p) { return function () { p.remove(); }; }(particle), PARTICLE_LIFE_MS);
        }
    }

    /***** Leaderboard Functions *****/
    function updateLeaderboard(currentRound, elapsedTime) {
        var result = saveGameStatsToSchema25(currentDifficulty, currentRound, elapsedTime);
        updateLeaderboardDisplay();
        return result;
    }

    function updateLeaderboardDisplay() {
        var stats = loadGameStatsFromSchema25(currentDifficulty);
        var difficultyLabel = DIFFICULTY_SETTINGS[currentDifficulty].label;

        lbTitleEl.textContent = LABELS.yourBest.replace('{difficulty}', difficultyLabel);
        bestRoundEl.textContent = stats.bestRound;
        bestTimeEl.textContent = stats.bestTime === Infinity ? LABELS.noTime :
            Math.floor(stats.bestTime / 1000) + 's';
        gamesPlayedEl.textContent = stats.gamesPlayed || 0;
    }

    /***** Game Functions *****/
    function startRound() {
        if (round === 1) {
            startTimer();
        }
        clearTasks();
        feedbackEl.textContent = "";
        feedbackEl.className = "feedback";
        expectedOrder = 1;
        scoreboardEl.textContent = LABELS.scoreboard
            .replace('{round}', round)
            .replace('{score}', score);

        var roundTasks = shuffleArray(tasks);
        if (roundTasks.length > 10) {
            roundTasks = roundTasks.slice(0, 10);
        }
        currentTasks = roundTasks.map(function (task, index) {
            return { order: index + 1, text: task };
        });

        currentTasks.forEach(function (taskObj) { createMovingTaskButton(taskObj); });

        lastTimestamp = null;
        startMovement();
    }

    function createMovingTaskButton(taskObj) {
        var btn = document.createElement("button");
        btn.className = "task-btn";
        btn.textContent = taskObj.order + '. ' + cleanTaskName(taskObj.text);
        btn.dataset.order = taskObj.order;

        var pos = getRandomPosition();
        btn.style.left = pos.x + "px";
        btn.style.top = pos.y + "px";

        var settings = DIFFICULTY_SETTINGS[currentDifficulty];
        var speedMultiplier = settings.baseSpeed + (round - 1) * settings.speedIncrease;
        var angle = Math.random() * Math.PI * 2;
        var speed = speedMultiplier * (SPEED_JITTER_BASE + Math.random() * SPEED_JITTER_RANGE);

        btn.dataset.dx = (Math.cos(angle) * speed).toFixed(2);
        btn.dataset.dy = (Math.sin(angle) * speed).toFixed(2);

        btn.addEventListener("click", function (e) {
            if (!gameActive) return;
            var clickedOrder = parseInt(this.dataset.order, 10);

            if (clickedOrder === expectedOrder) {
                this.classList.add("clicked");
                this.disabled = true;

                var rect = this.getBoundingClientRect();
                var windowRect = taskWindow.getBoundingClientRect();
                var px = rect.left - windowRect.left + rect.width / 2;
                var py = rect.top - windowRect.top + rect.height / 2;
                createParticles(px, py, getComputedStyle(document.documentElement).getPropertyValue('--game-success').trim() || '#28a745');

                expectedOrder++;

                if (expectedOrder > currentTasks.length) {
                    var diffSettings = DIFFICULTY_SETTINGS[currentDifficulty];

                    if (round >= diffSettings.maxRounds) {
                        score++;
                        stopMovement();
                        stopTimer();
                        var elapsedTime = Date.now() - gameStartTime;
                        var result = updateLeaderboard(round, elapsedTime);
                        feedbackEl.textContent = LABELS.winner.replace('{time}', Math.floor(elapsedTime / 1000));
                        feedbackEl.className = "feedback success";
                        if (result.isNewBest) showNewBest();
                        gameActive = false;
                        restartBtn.style.display = "block";
                        return;
                    }

                    score++;
                    feedbackEl.textContent = LABELS.roundComplete;
                    feedbackEl.className = "feedback success";
                    stopMovement();
                    round++;
                    setTimeout(startRound, NEXT_ROUND_DELAY_MS);
                }
            } else {
                stopMovement();
                stopTimer();
                var elapsedTime2 = Date.now() - gameStartTime;
                var result2 = updateLeaderboard(round, elapsedTime2);
                feedbackEl.textContent = LABELS.wrongOrder;
                feedbackEl.className = "feedback error";
                if (result2.isNewBest) {
                    setTimeout(function () { showNewBest(); }, NEW_BEST_DELAY_MS);
                }
                gameActive = false;
                restartBtn.style.display = "block";
            }
        });

        btn.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.click();
            }
        });

        taskWindow.appendChild(btn);
    }

    function showNewBest() {
        feedbackEl.textContent = LABELS.newBest;
        feedbackEl.className = "feedback new-best";
    }

    function getRandomPosition() {
        var rect = taskWindow.getBoundingClientRect();
        var maxX = rect.width - BTN_CLEARANCE_X;
        var maxY = rect.height - BTN_CLEARANCE_Y;
        return {
            x: Math.max(0, Math.floor(Math.random() * maxX)),
            y: Math.max(0, Math.floor(Math.random() * maxY))
        };
    }

    function shuffleArray(arr) {
        var array = arr.slice();
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    function clearTasks() {
        document.querySelectorAll(".task-btn").forEach(function (btn) { btn.remove(); });
        document.querySelectorAll(".particle").forEach(function (p) { p.remove(); });
    }

    /***** Smooth Movement using requestAnimationFrame *****/
    function animateButtons(timestamp) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        var dt = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;

        var rect = taskWindow.getBoundingClientRect();
        var buttons = document.querySelectorAll(".task-btn:not(.clicked)");

        buttons.forEach(function (btn) {
            var x = parseFloat(btn.style.left);
            var y = parseFloat(btn.style.top);
            var dx = parseFloat(btn.dataset.dx);
            var dy = parseFloat(btn.dataset.dy);

            x += dx * dt;
            y += dy * dt;

            if (x < 0) { x = 0; dx = -dx * (BOUNCE_DAMP_BASE + Math.random() * BOUNCE_DAMP_RANGE); btn.dataset.dx = dx; }
            if (x > rect.width - btn.offsetWidth) { x = rect.width - btn.offsetWidth; dx = -dx * (BOUNCE_DAMP_BASE + Math.random() * BOUNCE_DAMP_RANGE); btn.dataset.dx = dx; }
            if (y < 0) { y = 0; dy = -dy * (BOUNCE_DAMP_BASE + Math.random() * BOUNCE_DAMP_RANGE); btn.dataset.dy = dy; }
            if (y > rect.height - btn.offsetHeight) { y = rect.height - btn.offsetHeight; dy = -dy * (BOUNCE_DAMP_BASE + Math.random() * BOUNCE_DAMP_RANGE); btn.dataset.dy = dy; }

            btn.style.left = x + "px";
            btn.style.top = y + "px";
        });

        movementAnimationFrame = requestAnimationFrame(animateButtons);
    }

    function startMovement() {
        stopMovement();
        movementAnimationFrame = requestAnimationFrame(animateButtons);
    }

    function stopMovement() {
        if (movementAnimationFrame) {
            cancelAnimationFrame(movementAnimationFrame);
            movementAnimationFrame = null;
        }
    }

    /***** Restart Game Handler *****/
    function restartGame() {
        gameActive = true;
        round = 1;
        score = 0;
        restartBtn.style.display = "none";
        feedbackEl.textContent = "";
        feedbackEl.className = "feedback";
        timerEl.textContent = '0:00';
        startRound();
    }

    restartBtn.addEventListener("click", restartGame);

    backToMiniCycle.addEventListener("click", function () {
        window.location.href = "../miniCycle.html";
    });

    window.onload = function () {
        populateLabels();
        updateLeaderboardDisplay();
        startRound();
    };
})();
