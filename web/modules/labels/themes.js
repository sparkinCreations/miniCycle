/**
 * @file themes.js
 * @description Vocabulary theme definitions and manager for miniCycle
 * @module labels/themes
 *
 * Themes adapt the app's terminology and icons to different use cases
 * (habits, fitness, studying, cleaning) while keeping all core logic unchanged.
 *
 * Lives alongside defaultLabels.js and labelResolver.js — all label-related
 * files in one place.
 *
 * Resolution order:
 *   1. Active theme override  (e.g. Habit Tracker → "habit")
 *   2. DEFAULT_LABELS         (English fallback — always present)
 *
 * USAGE:
 *   import { vocabThemeManager } from '../labels/themes.js';
 *
 *   vocabThemeManager.getActiveTheme();           // current routine's theme obj
 *   vocabThemeManager.checkThemeUnlocks();        // call after cycle completion
 *   vocabThemeManager.setRoutineTheme(id, 'fitness'); // assign theme to routine
 */

import { createDIModule, optional } from '../core/diBase.js';
import { setLabelResolverDependencies } from './labelResolver.js';

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

/**
 * All vocabulary theme definitions.
 * Label keys use full dot-path format matching getLabel() — e.g. 'noun.task'.
 * unlockAt: null means always available (Classic only).
 *
 * @type {Object.<string, ThemeDefinition>}
 */
export const THEME_DEFINITIONS = {

    classic: {
        id:          'classic',
        name:        'Classic',
        description: 'The original miniCycle experience',
        unlockAt:    null,
        labels:      {},   // empty — falls through to DEFAULT_LABELS
        icons:       {},   // empty — falls through to DEFAULT_LABELS icons
        preview: {
            tagline:      'The original miniCycle experience',
            sampleLabels: ['Task', 'Cycle', 'Complete All'],
            sampleIcons:  []
        }
    },

    'habit-tracker': {
        id:          'habit-tracker',
        name:        'Habit Tracker',
        description: 'Build streaks, track habits',
        unlockAt:    { cycles: 5 },
        labels: {
            'noun.task':                   { one: 'habit',  other: 'habits'  },
            'noun.cycle':                  { one: 'streak', other: 'streaks' },
            'action.addTask':              'Add habit',
            'action.completeCycle':        'Complete Streak',
            'action.clearCompletedTasks':  'Clear Habits',
            'notify.cycleComplete':        'Day completed! Streak extended!',
            'help.cycleComplete':          'Streak extended! Habits reset.',
            'nav.appSubtitle':             'HABIT TRACKER',
        },
        icons: {
            cycleComplete: '👍',
            celebrate:     '🔥',
        },
        preview: {
            tagline:      'Build streaks, track habits',
            sampleLabels: ['Habit', 'Streak', 'Complete Day'],
            sampleIcons:  ['🔥', '👍']
        }
    },

    fitness: {
        id:          'fitness',
        name:        'Fitness',
        description: 'Track workouts, build routines',
        unlockAt:    { cycles: 25 },
        labels: {
            'noun.task':            { one: 'exercise', other: 'exercises' },
            'noun.cycle':           { one: 'workout',  other: 'workouts'  },
            'action.addTask':              'Add exercise',
            'action.completeCycle':        'Complete Workout',
            'action.clearCompletedTasks':  'Clear Exercises',
            'notify.cycleComplete':        'Workout complete!',
            'help.cycleComplete':          'Workout complete! Exercises reset.',
            'nav.appSubtitle':             'FITNESS TRACKER',
        },
        icons: {
            cycleComplete: '💪',
            celebrate:     '🏆',
        },
        preview: {
            tagline:      'Track workouts, build routines',
            sampleLabels: ['Exercise', 'Workout', 'Complete Workout'],
            sampleIcons:  ['💪', '🏆']
        }
    },

    scholar: {
        id:          'scholar',
        name:        'Scholar',
        description: 'Study topics, track sessions',
        unlockAt:    { cycles: 50 },
        labels: {
            'noun.task':            { one: 'topic',         other: 'topics'         },
            'noun.cycle':           { one: 'study session', other: 'study sessions' },
            'action.addTask':              'Add topic',
            'action.completeCycle':        'Complete Session',
            'action.clearCompletedTasks':  'Clear Topics',
            'notify.cycleComplete':        'Study session complete!',
            'help.cycleComplete':          'Study session complete! Topics reset.',
            'nav.appSubtitle':             'STUDY PLANNER',
        },
        icons: {
            cycleComplete: '📚',
            celebrate:     '🎓',
        },
        preview: {
            tagline:      'Study topics, track sessions',
            sampleLabels: ['Topic', 'Study Session', 'Complete Session'],
            sampleIcons:  ['📚', '🎓']
        }
    },

    cleaning: {
        id:          'cleaning',
        name:        'Cleaning',
        description: 'Tackle chores, run clean sweeps',
        unlockAt:    { cycles: 75 },
        labels: {
            'noun.task':            { one: 'chore',       other: 'chores'       },
            'noun.cycle':           { one: 'clean sweep', other: 'clean sweeps' },
            'action.addTask':              'Add chore',
            'action.completeCycle':        'Complete Chores',
            'action.clearCompletedTasks':  'Clear Chores',
            'notify.cycleComplete':        'Chores done!',
            'help.cycleComplete':          'Clean sweep complete! Chores reset.',
            'nav.appSubtitle':             'CHORE MANAGER',
        },
        icons: {
            cycleComplete: '🧼',
            celebrate:     '🧹',
        },
        preview: {
            tagline:      'Tackle chores, run clean sweeps',
            sampleLabels: ['Chore', 'Clean Sweep', 'Complete Chores'],
            sampleIcons:  ['🧹', '🧼']
        }
    }
};

// ============================================================================
// DI SETUP
// ============================================================================

const di = createDIModule('VocabThemeManager', {
    // optional: labelResolver calls getActiveLens() before AppState is injected during settings boot.
    // All methods guard with ?.get() and fall back to THEME_DEFINITIONS.classic when null.
    AppState: optional(null)
});

export const setVocabThemeManagerDependencies = di.setDependencies;

// ============================================================================
// THEME MANAGER
// ============================================================================

export class VocabThemeManager {

    get deps() {
        return di.resolve();
    }

    /**
     * Get the theme object for the currently active routine.
     * Falls back to Classic if theme is missing, unknown, or not yet unlocked.
     *
     * @returns {ThemeDefinition}
     */
    getActiveTheme() {
        const state = this.deps.AppState?.get();
        if (!state) return THEME_DEFINITIONS.classic;

        const activeCycleId = state.appState?.activeCycleId;
        if (!activeCycleId) return THEME_DEFINITIONS.classic;

        const cycle = state.data?.cycles?.[activeCycleId];
        const themeId = cycle?.theme ?? state.settings?.defaultTheme ?? 'classic';

        return THEME_DEFINITIONS[themeId] ?? THEME_DEFINITIONS.classic;
    }

    /**
     * Get the theme object for a specific routine.
     *
     * @param {string} routineId
     * @returns {ThemeDefinition}
     */
    getRoutineTheme(routineId) {
        const state = this.deps.AppState?.get();
        if (!state) return THEME_DEFINITIONS.classic;

        const cycle = state.data?.cycles?.[routineId];
        const themeId = cycle?.theme ?? state.settings?.defaultTheme ?? 'classic';

        return THEME_DEFINITIONS[themeId] ?? THEME_DEFINITIONS.classic;
    }

    /**
     * Get all unlocked theme IDs for the current user.
     * Always includes 'classic'. Uses stored list or computes from progress.
     *
     * @returns {string[]}
     */
    getUnlockedThemeIds() {
        const state = this.deps.AppState?.get();
        if (!state) return ['classic'];

        if (Array.isArray(state.settings?.unlockedThemes)) {
            const ids = state.settings.unlockedThemes;
            return ids.includes('classic') ? ids : ['classic', ...ids];
        }

        // Compute from progress for users before migration
        const progress = state.userProgress?.cyclesCompleted ?? 0;
        return this._computeUnlockedFromProgress(progress);
    }

    /**
     * Assign a theme to a specific routine.
     * Silently ignores if theme is unknown or not yet unlocked.
     *
     * @param {string} routineId
     * @param {string} themeId
     * @returns {boolean} True if saved successfully
     */
    setRoutineTheme(routineId, themeId) {
        if (!THEME_DEFINITIONS[themeId]) {
            console.warn(`VocabThemeManager: Unknown theme "${themeId}"`);
            return false;
        }

        const unlocked = this.getUnlockedThemeIds();
        if (!unlocked.includes(themeId)) {
            console.warn(`VocabThemeManager: Theme "${themeId}" is not yet unlocked`);
            return false;
        }

        this.deps.AppState.update(state => {
            if (state.data?.cycles?.[routineId]) {
                state.data.cycles[routineId].theme = themeId;
                state.metadata.lastModified = Date.now();
            }
        }, true);

        return true;
    }

    /**
     * Set the default theme for new routines.
     *
     * @param {string} themeId
     */
    setDefaultTheme(themeId) {
        if (!THEME_DEFINITIONS[themeId]) {
            console.warn(`VocabThemeManager: Unknown theme "${themeId}"`);
            return;
        }

        this.deps.AppState.update(state => {
            if (!state.settings) state.settings = {};
            state.settings.defaultTheme = themeId;
            state.metadata.lastModified = Date.now();
        }, true);
    }

    /**
     * Check for newly unlocked themes based on current cycle progress.
     * Call this after each cycle completion.
     *
     * @returns {string[]} Newly unlocked theme IDs (empty if none)
     */
    checkThemeUnlocks() {
        const state = this.deps.AppState?.get();
        if (!state) return [];

        const progress = state.userProgress?.cyclesCompleted ?? 0;
        const currentUnlocked = new Set(this.getUnlockedThemeIds());
        const newlyUnlocked = [];

        for (const [id, theme] of Object.entries(THEME_DEFINITIONS)) {
            if (id === 'classic') continue;
            if (currentUnlocked.has(id)) continue;
            if (!theme.unlockAt) continue;

            if (progress >= theme.unlockAt.cycles) {
                newlyUnlocked.push(id);
                currentUnlocked.add(id);
            }
        }

        if (newlyUnlocked.length > 0) {
            this.deps.AppState.update(state => {
                if (!state.settings) state.settings = {};
                state.settings.unlockedThemes = Array.from(currentUnlocked);
                state.metadata.lastModified = Date.now();
            }, false);
        }

        return newlyUnlocked;
    }

    /**
     * Initialise the theme system for an existing user.
     * Sets unlockedThemes and defaultTheme if not already present.
     * Sets theme: 'classic' on any routine that lacks it.
     * Safe to call multiple times — no-ops if already migrated.
     */
    init() {
        const state = this.deps.AppState?.get();
        if (!state) return;

        // Already initialised (check length — empty array [] is truthy but means not yet set up)
        if (state.settings?.unlockedThemes?.length > 0) return;

        console.log('🎨 VocabThemeManager: Initialising theme system...');

        const progress = state.userProgress?.cyclesCompleted ?? 0;
        const unlockedThemes = this._computeUnlockedFromProgress(progress);

        this.deps.AppState.update(s => {
            if (!s.settings) s.settings = {};
            s.settings.unlockedThemes  = unlockedThemes;
            s.settings.defaultTheme    = s.settings.defaultTheme ?? 'classic';

            // Stamp all existing routines with theme: 'classic' if missing
            if (s.data?.cycles) {
                for (const cycle of Object.values(s.data.cycles)) {
                    if (!cycle.theme) cycle.theme = 'classic';
                }
            }
        }, false);

        console.log(`✅ VocabThemeManager: Unlocked themes — ${unlockedThemes.join(', ')}`);
    }

    /**
     * Look up a theme definition by ID.
     * @param {string} themeId
     * @returns {ThemeDefinition|null}
     */
    getThemeDefinition(themeId) {
        return THEME_DEFINITIONS[themeId] ?? null;
    }

    /**
     * Return the next theme that is not yet unlocked, ordered by unlock cost.
     * Returns null when all themes are unlocked.
     *
     * @param {number} globalCycles - Total cycles completed across all routines
     * @returns {ThemeDefinition|null}
     */
    getNextLockedTheme(globalCycles) {
        const unlocked = new Set(this.getUnlockedThemeIds());
        return Object.values(THEME_DEFINITIONS).find(t =>
            t.unlockAt && !unlocked.has(t.id) && globalCycles < t.unlockAt.cycles
        ) ?? null;
    }

    // --------------------------------------------------------------------------
    // Private helpers
    // --------------------------------------------------------------------------

    _computeUnlockedFromProgress(progress) {
        const unlocked = ['classic'];
        for (const [id, theme] of Object.entries(THEME_DEFINITIONS)) {
            if (id === 'classic') continue;
            if (theme.unlockAt && progress >= theme.unlockAt.cycles) {
                unlocked.push(id);
            }
        }
        return unlocked;
    }
}

// ============================================================================
// SINGLETON + LABELRESOLVER WIRING
// ============================================================================

export const vocabThemeManager = new VocabThemeManager();

/**
 * Wire the active-theme getters into labelResolver so getLabel() and getIcon()
 * can pick up vocabulary overrides. Runs at module load time — the functions
 * are lazy closures so AppState doesn't need to be ready yet.
 */
setLabelResolverDependencies({
    getActiveLens:  () => vocabThemeManager.getActiveTheme(),
    getRoutineLens: (routineId) => vocabThemeManager.getRoutineTheme(routineId)
});

console.log('🎨 Vocabulary theme system loaded');
