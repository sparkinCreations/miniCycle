/**
 * RoutineSwitcher Theme Picker Tests
 *
 * The per-routine vocab-theme picker inside the routine switcher modal.
 *
 * WRITTEN BEFORE THE EXTRACTION, ON PURPOSE. This cluster had ZERO test
 * coverage — `routineSwitcher.tests.js` contains no theme assertions at all —
 * so an extraction had nothing to prove it still worked. These tests were
 * authored against the pre-split code and passed there; the same file passing
 * after the move is the evidence the move preserved behaviour, which is exactly
 * what LARGE_MODULE_SPLITS_PLAN.md's checklist asks for.
 *
 * What is covered, and why each one earns its place:
 *   - only UNLOCKED themes render (locked ones are hidden entirely, not disabled)
 *   - the current theme is the one marked aria-checked, for screen readers
 *   - selecting re-renders the picker WITHOUT closing it — a self-call inside
 *     the cluster that is easy to lose when methods move to another module
 *   - a failed apply notifies nothing and does not re-render
 *   - chip listeners are torn down on close and on re-render, so repeat opens
 *     cannot stack handlers (the picker tracks them on `picker._clickHandlers`)
 *   - aria-expanded on the toggle button tracks open/closed state
 *   - every path is inert when the picker DOM or vocabThemeManager is absent
 */
import { createProtectedTest } from './testHelpers.js';

export async function runRoutineSwitcherThemePickerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { RoutineSwitcher } = await import(`../modules/routine/routineSwitcher.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>🎨 RoutineSwitcher Theme Picker Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const THEME_DEFS = {
        classic:         { name: 'Classic',  description: 'The default',   icons: { celebrate: '✨' } },
        'habit-tracker': { name: 'Habits',   description: 'Habit vocab',   icons: { celebrate: '🎯' } },
        fitness:         { name: 'Fitness',  description: 'Fitness vocab', icons: { celebrate: '💪' } }
    };

    /**
     * Build the picker DOM plus an instance wired to a fake vocabThemeManager.
     * `unlocked` decides which chips may render; `applySucceeds` drives the
     * setRoutineTheme return value so the failure branch is reachable.
     */
    function setup({ unlocked = ['classic', 'habit-tracker'], theme = 'classic', applySucceeds = true } = {}) {
        document.getElementById('theme-picker-row')?.remove();
        document.getElementById('switch-theme')?.remove();

        const picker = document.createElement('div');
        picker.id = 'theme-picker-row';
        picker.className = 'hidden';
        const themeBtn = document.createElement('button');
        themeBtn.id = 'switch-theme';
        themeBtn.setAttribute('aria-expanded', 'false');
        document.body.append(picker, themeBtn);

        const calls = { setRoutineTheme: [], notifications: [], history: [], refreshed: 0 };
        const deps = {
            // Both required by the constructor itself: it calls
            // setupModalClickOutside(), which reads them unguarded. Omitting either
            // throws before any test body runs — nothing to do with the picker.
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            getModal: () => null,
            getElementById: (id) => document.getElementById(id),
            AppState: { get: () => ({ data: { cycles: { c1: { theme } } } }) },
            showNotification: (msg) => calls.notifications.push(String(msg)),
            logHistoryEvent: (type, detail) => calls.history.push({ type, detail }),
            refreshThemeLabels: () => { calls.refreshed++; },
            vocabThemeManager: {
                getUnlockedThemeIds: () => [...unlocked],
                getThemeDefinition: (id) => THEME_DEFS[id] || null,
                setRoutineTheme: (cycleKey, themeId) => {
                    calls.setRoutineTheme.push({ cycleKey, themeId });
                    return applySucceeds;
                }
            }
        };
        return { instance: new RoutineSwitcher(deps), picker, themeBtn, calls };
    }

    const chips = (picker) => [...picker.querySelectorAll('.theme-chip')];
    const chipNames = (picker) => chips(picker).map(c => c.querySelector('.theme-chip-name')?.textContent);

    // =========================================================
    // 🎨 Rendering
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Rendering</h4>';

    await test('renders a chip for each unlocked theme only', async () => {
        const { instance, picker } = setup({ unlocked: ['classic', 'fitness'] });
        instance.openThemePicker('c1');
        const names = chipNames(picker);
        if (names.length !== 2) throw new Error(`expected 2 chips, got ${names.length}: ${names}`);
        if (!names.includes('Classic') || !names.includes('Fitness')) {
            throw new Error(`unexpected chips: ${names}`);
        }
    });

    await test('a locked theme is absent, not merely disabled', async () => {
        const { instance, picker } = setup({ unlocked: ['classic'] });
        instance.openThemePicker('c1');
        if (chipNames(picker).includes('Habits')) throw new Error('locked theme must not render at all');
        if (chips(picker).length !== 1) throw new Error('only the unlocked theme should render');
    });

    await test('the current theme is the one marked aria-checked', async () => {
        const { instance, picker } = setup({ unlocked: ['classic', 'habit-tracker'], theme: 'habit-tracker' });
        instance.openThemePicker('c1');
        const checked = chips(picker).filter(c => c.getAttribute('aria-checked') === 'true');
        if (checked.length !== 1) throw new Error(`expected exactly 1 checked chip, got ${checked.length}`);
        if (checked[0].querySelector('.theme-chip-name').textContent !== 'Habits') {
            throw new Error('the wrong chip is marked current');
        }
    });

    await test('opening reveals the picker and reports expanded', async () => {
        const { instance, picker, themeBtn } = setup();
        instance.openThemePicker('c1');
        if (picker.classList.contains('hidden')) throw new Error('picker should be visible');
        if (themeBtn.getAttribute('aria-expanded') !== 'true') throw new Error('aria-expanded should be true');
    });

    // =========================================================
    // 🖱️ Selecting
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🖱️ Selecting</h4>';

    await test('clicking a chip applies that theme to that routine', async () => {
        const { instance, picker, calls } = setup({ unlocked: ['classic', 'habit-tracker'] });
        instance.openThemePicker('c1');
        chips(picker).find(c => c.querySelector('.theme-chip-name').textContent === 'Habits').click();
        if (calls.setRoutineTheme.length !== 1) throw new Error('theme was not applied');
        const { cycleKey, themeId } = calls.setRoutineTheme[0];
        if (cycleKey !== 'c1' || themeId !== 'habit-tracker') {
            throw new Error(`applied ${themeId} to ${cycleKey}`);
        }
    });

    await test('a successful apply notifies, logs history and refreshes labels', async () => {
        const { instance, picker, calls } = setup({ unlocked: ['classic', 'habit-tracker'] });
        instance.openThemePicker('c1');
        chips(picker).find(c => c.querySelector('.theme-chip-name').textContent === 'Habits').click();
        if (calls.notifications.length !== 1) throw new Error('expected a confirmation notification');
        if (calls.history.length !== 1 || calls.history[0].type !== 'theme_changed') {
            throw new Error('the theme change was not logged to history');
        }
        if (calls.refreshed !== 1) throw new Error('refreshThemeLabels must run so vocab updates');
    });

    await test('selecting RE-RENDERS the picker and leaves it open', async () => {
        // The self-call inside _selectTheme. Losing it on a move would leave the
        // old chip highlighted with no visible error.
        const { instance, picker } = setup({ unlocked: ['classic', 'habit-tracker'] });
        instance.openThemePicker('c1');
        chips(picker).find(c => c.querySelector('.theme-chip-name').textContent === 'Habits').click();
        if (picker.classList.contains('hidden')) throw new Error('selecting must not close the picker');
        if (chips(picker).length !== 2) throw new Error('the picker should have re-rendered its chips');
    });

    await test('a failed apply changes nothing', async () => {
        const { instance, picker, calls } = setup({ unlocked: ['classic', 'habit-tracker'], applySucceeds: false });
        instance.openThemePicker('c1');
        chips(picker).find(c => c.querySelector('.theme-chip-name').textContent === 'Habits').click();
        if (calls.notifications.length !== 0) throw new Error('a failed apply must not claim success');
        if (calls.refreshed !== 0) throw new Error('labels must not refresh on failure');
        if (calls.history.length !== 0) throw new Error('a failed apply must not be logged');
    });

    // =========================================================
    // 🧹 Teardown
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Teardown</h4>';

    await test('closing hides the picker and reports collapsed', async () => {
        const { instance, picker, themeBtn } = setup();
        instance.openThemePicker('c1');
        instance.closeThemePicker();
        if (!picker.classList.contains('hidden')) throw new Error('picker should be hidden');
        if (themeBtn.getAttribute('aria-expanded') !== 'false') throw new Error('aria-expanded should be false');
    });

    await test('closing releases every tracked chip listener', async () => {
        const { instance, picker } = setup({ unlocked: ['classic', 'habit-tracker'] });
        instance.openThemePicker('c1');
        if (!picker._clickHandlers || picker._clickHandlers.length === 0) {
            throw new Error('chip listeners should be tracked for teardown');
        }
        instance.closeThemePicker();
        if (picker._clickHandlers.length !== 0) throw new Error('listeners were not released on close');
    });

    await test('re-opening does not stack chip listeners', async () => {
        const { instance, picker } = setup({ unlocked: ['classic', 'habit-tracker'] });
        instance.openThemePicker('c1');
        const first = picker._clickHandlers.length;
        instance.openThemePicker('c1');
        instance.openThemePicker('c1');
        if (picker._clickHandlers.length !== first) {
            throw new Error(`handlers grew ${first} → ${picker._clickHandlers.length} across re-opens`);
        }
    });

    await test('a chip click fires once, not once per open', async () => {
        const { instance, picker, calls } = setup({ unlocked: ['classic', 'habit-tracker'] });
        instance.openThemePicker('c1');
        instance.openThemePicker('c1');   // re-render; stale handlers must be gone
        chips(picker).find(c => c.querySelector('.theme-chip-name').textContent === 'Habits').click();
        if (calls.setRoutineTheme.length !== 1) {
            throw new Error(`theme applied ${calls.setRoutineTheme.length} times — stale listeners survived`);
        }
    });

    // =========================================================
    // 🔀 Toggling
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔀 Toggling</h4>';

    await test('toggle opens when closed and closes when open', async () => {
        const { instance, picker } = setup();
        instance.toggleThemePicker('c1');
        if (picker.classList.contains('hidden')) throw new Error('first toggle should open');
        instance.toggleThemePicker('c1');
        if (!picker.classList.contains('hidden')) throw new Error('second toggle should close');
    });

    // =========================================================
    // 🛡️ Missing pieces
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Missing Pieces</h4>';

    await test('no picker element: open and toggle bail before touching the button', async () => {
        // "It does not throw" is not an assertion — test:meta rejects a body that
        // asserts nothing, correctly. The observable contract is that the guard
        // runs BEFORE aria-expanded is written, so a missing picker leaves the
        // toggle button reporting collapsed rather than lying about an open panel.
        const { instance, themeBtn } = setup();
        document.getElementById('theme-picker-row').remove();

        instance.openThemePicker('c1');
        if (themeBtn.getAttribute('aria-expanded') !== 'false') {
            throw new Error('open with no picker must not claim expanded');
        }
        instance.toggleThemePicker('c1');
        if (themeBtn.getAttribute('aria-expanded') !== 'false') {
            throw new Error('toggle with no picker must not claim expanded');
        }
    });

    await test('no picker element: close still reports the button collapsed', async () => {
        const { instance, themeBtn } = setup();
        instance.openThemePicker('c1');                       // expanded = true
        document.getElementById('theme-picker-row').remove();
        instance.closeThemePicker();
        if (themeBtn.getAttribute('aria-expanded') !== 'false') {
            throw new Error('close must collapse the button even with no picker left');
        }
    });

    await test('no vocabThemeManager: open renders nothing and does not throw', async () => {
        const { instance, picker } = setup();
        instance.deps.vocabThemeManager = undefined;
        instance.openThemePicker('c1');
        if (chips(picker).length !== 0) throw new Error('nothing should render without a theme manager');
    });

    await test('an unknown theme id in the unlocked list is skipped', async () => {
        const { instance, picker } = setup({ unlocked: ['classic', 'does-not-exist'] });
        instance.openThemePicker('c1');
        if (chips(picker).length !== 1) throw new Error('a theme with no definition must be skipped');
    });

    // Leave the DOM as we found it.
    document.getElementById('theme-picker-row')?.remove();
    document.getElementById('switch-theme')?.remove();

    // =========================================================
    // RESULTS
    // =========================================================
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace(/<h3>Running tests\.\.\.<\/h3>/, summary);
    return { passed: passed.count, total: total.count };
}
