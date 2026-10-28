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
    var TASK_LABEL_MAX    = 22;   // chars before truncation
    var SPAWN_ATTEMPTS    = 40;   // random spots tried per button before accepting an overlap
    var SPAWN_GAP         = 6;    // px kept between spawned buttons
    var MAX_FRAME_DT      = 0.05; // s — a longer frame (tab hidden, stall) moves as if it were this long

    // The app's document (read only) and this game's own bests. The bests have
    // their own key: until Oct 2026 the game rewrote the whole miniCycleData to
    // save them, which could overwrite newer changes from the app open in
    // another tab. Mirrored in core/constants.js STORAGE_KEYS.TASK_ORDER_GAME_STATS.
    var APP_DATA_KEY      = 'miniCycleData';
    var STATS_KEY         = 'miniCycleTaskOrderStats';

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

    /***** App data (read only) *****/
    function readJson(key) {
        try {
            var raw = localStorage.getItem(key);
            var parsed = raw ? JSON.parse(raw) : null;
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (error) {
            console.error('Error reading ' + key + ':', error);
            return null;
        }
    }

    /**
     * The active routine's task names. Reads format 2.6 (data.routine,
     * appState.activeRoutineId) and still 2.5 (data.cycles, activeCycleId).
     * Until Oct 2026 this accepted ONLY a document marked "2.5", so after the
     * 2.6 migration (Sep 2026) every player got the built-in placeholder tasks.
     */
    function getTaskNames() {
        var appData = readJson(APP_DATA_KEY);
        if (!appData) return [];
        var data = appData.data || {};
        var appState = appData.appState || {};
        var routines = data.routine || data.cycles;
        var activeId = appState.activeRoutineId || appState.activeCycleId;
        var routine = routines && activeId ? routines[activeId] : null;
        if (!routine || !Array.isArray(routine.tasks)) return [];

        return routine.tasks
            .map(function (task) { return task && task.text; })
            .filter(function (text) { return typeof text === 'string' && text.trim() !== ''; });
    }

    /***** Bests (own key) *****/
    function emptyStats() {
        return { bestRound: 0, bestTime: null, gamesPlayed: 0 };
    }

    /** A stored best time in ms, or null. JSON turned the old Infinity into null. */
    function validTime(time) {
        return typeof time === 'number' && isFinite(time) && time > 0 ? time : null;
    }

    function normalizeStats(stats) {
        var out = emptyStats();
        if (!stats || typeof stats !== 'object') return out;
        out.bestRound = typeof stats.bestRound === 'number' && stats.bestRound > 0 ? stats.bestRound : 0;
        out.bestTime = validTime(stats.bestTime);
        out.gamesPlayed = typeof stats.gamesPlayed === 'number' && stats.gamesPlayed > 0 ? stats.gamesPlayed : 0;
        if (typeof stats.lastPlayed === 'number') out.lastPlayed = stats.lastPlayed;
        return out;
    }

    /**
     * All difficulties' bests. First read after Oct 2026: carry over what the
     * old version kept in the app document (settings.gameStats.taskOrderGame,
     * written only while data was 2.5).
     */
    function loadAllStats() {
        var stored = readJson(STATS_KEY);
        if (stored) return stored;
        var appData = readJson(APP_DATA_KEY);
        var legacy = appData && appData.settings && appData.settings.gameStats &&
            appData.settings.gameStats.taskOrderGame;
        return legacy && typeof legacy === 'object' ? legacy : {};
    }

    function loadGameStats(difficulty) {
        return normalizeStats(loadAllStats()[difficulty]);
    }

    /**
     * Record one finished game. The best round counts any game; the best time
     * only a WON game (all rounds cleared), or losing quickly would set a
     * "best" time.
     * @returns {{saved: boolean, isNewBest: boolean}}
     */
    function saveGameStats(difficulty, roundReached, elapsedMs, won) {
        try {
            var all = loadAllStats();
            var stats = normalizeStats(all[difficulty]);
            var isNewBest = false;
            if (roundReached > stats.bestRound) { stats.bestRound = roundReached; isNewBest = true; }
            if (won && (stats.bestTime === null || elapsedMs < stats.bestTime)) { stats.bestTime = elapsedMs; isNewBest = true; }
            stats.gamesPlayed += 1;
            stats.lastPlayed = Date.now();
            all[difficulty] = stats;
            localStorage.setItem(STATS_KEY, JSON.stringify(all));
            return { saved: true, isNewBest: isNewBest };
        } catch (error) {
            console.error('Error saving game stats:', error);
            return { saved: false, isNewBest: false };
        }
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
    var nextRoundTimer = null;

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
    // Picking a difficulty always starts a fresh game at it. Speeds are set when
    // a round's buttons are made, so until Oct 2026 a change during round 1 only
    // relabelled the game (Easy speeds, recorded under Hard), and after a loss
    // past round 1 the buttons did nothing at all.
    difficultyButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var picked = this.dataset.difficulty;
            if (!DIFFICULTY_SETTINGS[picked]) return;
            var changed = picked !== currentDifficulty;

            difficultyButtons.forEach(function (b) {
                var on = b === btn;
                b.classList.toggle('active', on);
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            currentDifficulty = picked;
            updateLeaderboardDisplay();

            if (changed || !gameActive) restartGame();
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
    function updateLeaderboard(currentRound, elapsedTime, won) {
        var result = saveGameStats(currentDifficulty, currentRound, elapsedTime, won);
        updateLeaderboardDisplay();
        return result;
    }

    function updateLeaderboardDisplay() {
        var stats = loadGameStats(currentDifficulty);
        var difficultyLabel = DIFFICULTY_SETTINGS[currentDifficulty].label;

        lbTitleEl.textContent = LABELS.yourBest.replace('{difficulty}', difficultyLabel);
        bestRoundEl.textContent = stats.bestRound;
        bestTimeEl.textContent = stats.bestTime === null ? LABELS.noTime :
            Math.floor(stats.bestTime / 1000) + 's';
        gamesPlayedEl.textContent = stats.gamesPlayed;
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
        updateScoreboard();

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

    function updateScoreboard() {
        scoreboardEl.textContent = LABELS.scoreboard
            .replace('{round}', round)
            .replace('{score}', score);
    }

    function createMovingTaskButton(taskObj) {
        var btn = document.createElement("button");
        btn.className = "task-btn";
        btn.textContent = taskObj.order + '. ' + cleanTaskName(taskObj.text);
        btn.dataset.order = taskObj.order;

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
                        updateScoreboard();
                        stopMovement();
                        stopTimer();
                        var elapsedTime = Date.now() - gameStartTime;
                        var result = updateLeaderboard(round, elapsedTime, true);
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
                    nextRoundTimer = setTimeout(function () {
                        nextRoundTimer = null;
                        startRound();
                    }, NEXT_ROUND_DELAY_MS);
                }
            } else {
                stopMovement();
                stopTimer();
                var elapsedTime2 = Date.now() - gameStartTime;
                var result2 = updateLeaderboard(round, elapsedTime2, false);
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

        // Measured in place, then put somewhere it does not cover a button
        // already out (overlapping spawns hid each other's numbers).
        btn.style.visibility = 'hidden';
        taskWindow.appendChild(btn);
        var pos = getSpawnPosition(btn.offsetWidth, btn.offsetHeight);
        btn.style.left = pos.x + "px";
        btn.style.top = pos.y + "px";
        btn.style.visibility = '';
    }

    function showNewBest() {
        feedbackEl.textContent = LABELS.newBest;
        feedbackEl.className = "feedback new-best";
    }

    /**
     * A random spot inside the field for a w×h button that overlaps no button
     * already placed, when one can be found in SPAWN_ATTEMPTS tries (a crowded
     * small field may have none; the last try is used then).
     */
    function getSpawnPosition(w, h) {
        var maxX = Math.max(0, taskWindow.clientWidth - w);
        var maxY = Math.max(0, taskWindow.clientHeight - h);
        var placed = [];
        document.querySelectorAll('#taskWindow .task-btn').forEach(function (other) {
            if (other.style.visibility === 'hidden') return;
            placed.push({ x: parseFloat(other.style.left), y: parseFloat(other.style.top), w: other.offsetWidth, h: other.offsetHeight });
        });
        var pos = { x: 0, y: 0 };
        for (var attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
            pos = { x: Math.floor(Math.random() * (maxX + 1)), y: Math.floor(Math.random() * (maxY + 1)) };
            var clear = placed.every(function (o) {
                return pos.x + w + SPAWN_GAP <= o.x || o.x + o.w + SPAWN_GAP <= pos.x ||
                       pos.y + h + SPAWN_GAP <= o.y || o.y + o.h + SPAWN_GAP <= pos.y;
            });
            if (clear) break;
        }
        return pos;
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
        // Capped: after the tab was hidden, rAF resumes with a gap of seconds,
        // and moving by all of it threw every button against a wall at once.
        var dt = Math.min((timestamp - lastTimestamp) / 1000, MAX_FRAME_DT);
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
        // A round that was about to start would otherwise start on top of this
        // game (and reset its timer).
        if (nextRoundTimer) {
            clearTimeout(nextRoundTimer);
            nextRoundTimer = null;
        }
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
