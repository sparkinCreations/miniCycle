/**
 * onboardingDemo.js — the first-run interactive demo.
 *
 * Facade-style sub-module of onboardingManager.js (Priority 8 split, Aug 2026):
 * loaded via dynamic import with ?v= cache-busting from OnboardingManager.init().
 * Do NOT add it to moduleManifests.js — same rule as the settingsManager /
 * taskDOM / statsPanel sub-modules (see HIDDEN_CODEBASE_INSIGHTS).
 *
 * Owns the three builders behind the first-run demo: the passive cycle
 * demonstration, the dynamic "try it" call-to-action that follows the sample
 * routine's completion state, and the interactive demo run from onboarding
 * step 3. Methods were moved VERBATIM from onboardingManager.js with only two
 * ownership rewrites: `this.deps` -> `this.m.deps`, and the one outbound
 * sibling call `_setFirstRunWelcomeMessageText` -> `this.m.<same>`.
 *
 * Why this cluster and not a bigger one: measured Aug 2026, it reaches exactly
 * ONE sibling method and ONE dependency (AppState), and touches no instance
 * state beyond `this.deps` — the narrowest seam in the file. The welcome
 * carousel is deliberately NOT here: it calls INTO these builders, so moving it
 * first would have created a sub-module edge for nothing.
 *
 * Shared state stays OWNED by the manager and is reached via `this.m`.
 */
import { DOM_CLASSES, DOM_SELECTORS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

export class OnboardingDemo {
    constructor(manager) {
        this.m = manager;
    }

    /**
     * Build the cycle-demo SVG into `container` and start a continuously-
     * looping choreography:
     *
     *   tasks tick (1→2→3) → counter morphs to "Cycle Complete!" → counter
     *   increments under the overlay → tasks reset → overlay fades → counter
     *   reappears with new number + pulse → loop.
     *
     * The same demo is used by slide 3 ("Example of a Cycle") and slide 4
     * ("Try it yourself") — only the right-side caption text differs, so
     * each call passes the relevant subtitle label key.
     *
     * @param {HTMLElement} container - the message body div to render into
     * @param {Object} [options]
     * @param {string} [options.subtitleKey='firstRunWelcome.cycleDemoSubtitle']
     *        Label key for the right-of-divider caption. Slide 3 uses the
     *        passive description; slide 4 uses the CTA copy with `↓` arrow.
     * @param {boolean} [options.loop=true]
     *        When true, the choreography runs continuously (tasks tick →
     *        complete → counter increments → reset → repeat). When false,
     *        the cycle plays exactly once and freezes on the celebratory
     *        "Cycle Complete!" final state — tasks stay checked, overlay
     *        stays visible, counter never increments. Used by slide 4
     *        ("Try it yourself") so the frozen success state acts as a
     *        backdrop for the call-to-action.
     * @returns {() => void} cleanup function (cancels all pending timeouts)
     * @private
     */
    _buildCycleDemo(container, {
        subtitleKey = 'firstRunWelcome.cycleDemoSubtitle',
        loop = true
    } = {}) {
        const NS = 'http://www.w3.org/2000/svg';
        const DONE = DOM_CLASSES.CYCLE_DEMO_TASK_DONE;
        const COMPLETE = DOM_CLASSES.CYCLE_DEMO_COMPLETE_VISIBLE;
        const PULSE = DOM_CLASSES.CYCLE_DEMO_COUNTER_PULSE;

        const svg = document.createElementNS(NS, 'svg');
        // Shorter viewBox (200×78 vs old 200×100) — renders at 280×~109px
        // instead of 280×140px (–31px), pulling the cycle-demo slide's
        // total banner height down so it matches the other (text-only)
        // slides more closely. Task rows + counter were re-stacked tighter
        // and pushed up to fit the shorter box.
        svg.setAttribute('viewBox', '0 0 200 78');
        svg.setAttribute('class', DOM_CLASSES.CYCLE_DEMO);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', getLabel('firstRunWelcome.cycleDemoAria'));

        // Three task rows — circles + labels + strike-throughs.
        // Tighter row spacing (16 vs 22) and started higher (y=14 vs 22)
        // so the whole list reads as a compact group at the top of the SVG.
        // Labels come from the `|`-delimited cycleDemoTasks label so the demo
        // can showcase concrete routine steps (default: cleaning verbs) rather
        // than abstract "Task 1/2/3" placeholders.
        const taskLabels = getLabel('firstRunWelcome.cycleDemoTasks').split('|');
        const taskRows = [
            { i: 1, y: 14 },
            { i: 2, y: 30 },
            { i: 3, y: 46 }
        ];
        taskRows.forEach(({ i, y }) => {
            const g = document.createElementNS(NS, 'g');
            g.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_TASK);
            g.dataset.task = String(i);

            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_CIRCLE);
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', String(y));
            circle.setAttribute('r', '5');
            g.appendChild(circle);

            const check = document.createElementNS(NS, 'path');
            check.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_CHECK);
            check.setAttribute('d', `M9 ${y} l2.5 2.5 l4 -5`);
            g.appendChild(check);

            const label = document.createElementNS(NS, 'text');
            label.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_LABEL);
            label.setAttribute('x', '24');
            label.setAttribute('y', String(y + 3));
            // Fallback to `Task N` if a label is missing (e.g., tasks list
            // was edited to fewer than 3 entries) so the demo still renders.
            label.textContent = taskLabels[i - 1] || `Task ${i}`;
            g.appendChild(label);

            const strike = document.createElementNS(NS, 'line');
            strike.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_STRIKE);
            strike.setAttribute('x1', '23');
            strike.setAttribute('x2', '78');
            strike.setAttribute('y1', String(y + 1));
            strike.setAttribute('y2', String(y + 1));
            g.appendChild(strike);

            svg.appendChild(g);
        });

        // Vertical divider between the task column and the right-side caption.
        // Sits just past the strike line's right edge (x=78) and brackets the
        // tighter task-row stack (y=14, 30, 46) without extending down past
        // the counter.
        const divider = document.createElementNS(NS, 'line');
        divider.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_DIVIDER);
        divider.setAttribute('x1', '88');
        divider.setAttribute('x2', '88');
        divider.setAttribute('y1', '8');
        divider.setAttribute('y2', '54');
        svg.appendChild(divider);

        // Right-of-divider caption — short explanation of why the counter
        // grows. Lines split on `|` from the label and align with the task
        // rows (y=14, 30, 46) so the right column reads in rhythm with the
        // left. Text-anchor "start" + x=96 left-align just past the divider.
        const subtitleLines = getLabel(subtitleKey).split('|');
        const subtitleY = [14, 30, 46];
        const subtitleText = document.createElementNS(NS, 'text');
        subtitleText.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_SUBTITLE);
        subtitleText.setAttribute('text-anchor', 'start');
        subtitleLines.forEach((line, idx) => {
            const tspan = document.createElementNS(NS, 'tspan');
            tspan.setAttribute('x', '96');
            // Fall back to evenly-spaced y values if the label has more than
            // 3 lines (defensive — keeps overflow lines visible rather than
            // stacking on top of each other).
            tspan.setAttribute('y', String(subtitleY[idx] ?? (subtitleY[2] + (idx - 2) * 16)));

            // Detect a trailing arrow character (e.g. `↓`) and split it into
            // its own tspan so CSS can animate the arrow alone (bounce) to
            // draw the eye toward the routine below the banner.
            const arrowMatch = line.match(/^(.*?)(\s*[↓↑→←])$/);
            if (arrowMatch) {
                tspan.appendChild(document.createTextNode(arrowMatch[1]));
                const arrow = document.createElementNS(NS, 'tspan');
                arrow.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_ARROW);
                arrow.textContent = arrowMatch[2];
                tspan.appendChild(arrow);
            } else {
                tspan.textContent = line;
            }
            subtitleText.appendChild(tspan);
        });
        svg.appendChild(subtitleText);

        // Counter at the bottom, LEFT-ALIGNED under the task column so the
        // entire SVG composition leans left. text-anchor="start" anchors the
        // text from x=8 (matches the circle column at cx=12 minus the radius).
        // The "Cycle Complete!" overlay shares the same anchor + position so
        // toggling --complete reads as a single in-place morph.
        const counterText = document.createElementNS(NS, 'text');
        counterText.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_COUNTER);
        counterText.setAttribute('x', '8');
        counterText.setAttribute('y', '70');
        counterText.setAttribute('text-anchor', 'start');
        counterText.appendChild(document.createTextNode(`${getLabel('firstRunWelcome.cycleDemoCycles')} `));
        const countSpan = document.createElementNS(NS, 'tspan');
        countSpan.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_COUNT);
        countSpan.textContent = '0';
        counterText.appendChild(countSpan);
        svg.appendChild(counterText);

        const completeText = document.createElementNS(NS, 'text');
        completeText.setAttribute('class', DOM_CLASSES.CYCLE_DEMO_COMPLETE_TEXT);
        completeText.setAttribute('x', '8');
        completeText.setAttribute('y', '70');
        completeText.setAttribute('text-anchor', 'start');
        completeText.textContent = getLabel('firstRunWelcome.cycleDemoComplete');
        svg.appendChild(completeText);

        container.appendChild(svg);

        // Choreography — self-rescheduling loop. Each tick() schedules a
        // setTimeout and tracks its id; cleanup cancels the whole set.
        let count = 0;
        let active = true;
        const pendingTimers = new Set();
        const tick = (delay, fn) => {
            if (!active) return;
            const id = setTimeout(() => {
                pendingTimers.delete(id);
                if (active) fn();
            }, delay);
            pendingTimers.add(id);
        };

        const runIteration = () => {
            if (!active) return;

            tick(UI_TIMEOUTS.CYCLE_DEMO_TASK_1, () => {
                svg.querySelector('[data-task="1"]')?.classList.add(DONE);
            });
            tick(UI_TIMEOUTS.CYCLE_DEMO_TASK_2, () => {
                svg.querySelector('[data-task="2"]')?.classList.add(DONE);
            });
            tick(UI_TIMEOUTS.CYCLE_DEMO_TASK_3, () => {
                svg.querySelector('[data-task="3"]')?.classList.add(DONE);
            });
            // Counter morphs into "Cycle Complete!" (fade-out + fade-in overlay).
            tick(UI_TIMEOUTS.CYCLE_DEMO_COMPLETE, () => {
                svg.classList.add(COMPLETE);
            });

            // Single-shot mode (slide 4): freeze on the celebratory final
            // state — tasks stay checked, "Cycle Complete!" overlay stays,
            // counter never increments. Skip the rest of the choreography.
            if (!loop) return;

            // Increment counter text WHILE it's hidden behind the overlay.
            tick(UI_TIMEOUTS.CYCLE_DEMO_COUNTER_UPDATE, () => {
                count += 1;
                countSpan.textContent = String(count);
            });
            // Tasks uncheck (still hidden behind complete overlay).
            tick(UI_TIMEOUTS.CYCLE_DEMO_RESET, () => {
                svg.querySelectorAll(`.${DONE}`).forEach(el => el.classList.remove(DONE));
            });
            // Hide overlay → counter fades back in showing the new number.
            // Pulse the new number so the increment reads clearly.
            tick(UI_TIMEOUTS.CYCLE_DEMO_RESTORE, () => {
                svg.classList.remove(COMPLETE);
                // Toggle pulse off then on so the animation re-fires each iteration.
                svg.classList.remove(PULSE);
                // Force reflow so the re-add restarts the keyframe.
                void svg.offsetWidth;
                svg.classList.add(PULSE);
            });
            // Loop: schedule the next iteration to begin immediately.
            tick(UI_TIMEOUTS.CYCLE_DEMO_LOOP, () => {
                svg.classList.remove(PULSE);
                runIteration();
            });
        };

        runIteration();

        return () => {
            active = false;
            pendingTimers.forEach(clearTimeout);
            pendingTimers.clear();
        };
    }

    /**
     * Build the slide-4 dynamic CTA. Reads the active routine's tasks,
     * picks an appropriate message based on completion state, and
     * subscribes to AppState so the message updates as the user checks
     * and unchecks tasks. Returns a cleanup function that unsubscribes
     * when the carousel leaves the slide.
     *
     * State → message mapping:
     *   - remaining === total           → tryItMessage (initial)
     *   - remaining === 0               → tryItComplete
     *   - remaining === 1               → tryItAlmost
     *   - 1 < remaining < total         → tryItProgress (interpolated)
     *
     * Uncheck detection: when remaining increases vs. the previous
     * observed value AND the user had made progress, briefly show
     * tryItUnchecked before reverting to the current-state message.
     * @param {HTMLElement} container - the .first-run-welcome__message div
     * @returns {Function} cleanup
     * @private
     */


    _buildTryItDynamic(container) {
        const computeRemaining = () => {
            const state = this.m.deps.AppState?.get?.();
            const activeId = state?.appState?.activeCycleId;
            const tasks = state?.data?.cycles?.[activeId]?.tasks || [];
            const total = tasks.length;
            const remaining = tasks.filter(t => !t.completed).length;
            return { total, remaining };
        };

        const messageForState = ({ total, remaining }) => {
            if (total === 0) return getLabel('firstRunWelcome.tryItMessage');
            if (remaining === 0) return getLabel('firstRunWelcome.tryItComplete');
            if (remaining === total) return getLabel('firstRunWelcome.tryItMessage');
            if (remaining === 1) return getLabel('firstRunWelcome.tryItAlmost');
            return getLabel('firstRunWelcome.tryItProgress', {
                vars: {
                    remaining,
                    taskWord: getLabel('noun.task', { count: remaining })
                }
            });
        };

        let prevRemaining = computeRemaining().remaining;
        let prevTotal = computeRemaining().total;
        let uncheckRevertTimer = null;

        // Initial paint
        this.m._setFirstRunWelcomeMessageText(container, messageForState(computeRemaining()));

        const subKey = 'firstRunWelcome:tryItProgress';
        const handler = () => {
            // Bail if the container was torn down (slide changed) before
            // this update fired. Cleanup will unsubscribe; this is just
            // a defensive check for the race window.
            if (!container.isConnected) return;
            const next = computeRemaining();
            const showUncheck = next.remaining > prevRemaining && prevRemaining < prevTotal;
            prevRemaining = next.remaining;
            prevTotal = next.total;

            if (showUncheck) {
                this.m._setFirstRunWelcomeMessageText(container, getLabel('firstRunWelcome.tryItUnchecked'));
                if (uncheckRevertTimer) clearTimeout(uncheckRevertTimer);
                uncheckRevertTimer = setTimeout(() => {
                    if (!container.isConnected) return;
                    this.m._setFirstRunWelcomeMessageText(container, messageForState(computeRemaining()));
                    uncheckRevertTimer = null;
                }, UI_TIMEOUTS.NOTIFICATION_BRIEF || 2500);
                return;
            }

            this.m._setFirstRunWelcomeMessageText(container, messageForState(next));
        };

        const hasSubscribe = typeof this.m.deps.AppState?.subscribe === 'function';
        if (hasSubscribe) {
            this.m.deps.AppState.subscribe(subKey, handler);
        }

        return () => {
            if (uncheckRevertTimer) {
                clearTimeout(uncheckRevertTimer);
                uncheckRevertTimer = null;
            }
            if (hasSubscribe) {
                this.m.deps.AppState.unsubscribe?.(subKey, handler);
            }
        };
    }

    /**
     * Start the interactive cycle demo, replacing the SVG animation.
     * Users tap checkboxes to complete tasks, triggering a cycle reset.
     * @param {HTMLElement} container - The step content container
     * @returns {Function} Cleanup function to remove listeners and timers.
     */
    _startInteractiveDemo(container) {
        const taskNames = [
            getLabel('onboarding.step2Task1'),
            getLabel('onboarding.step2Task2'),
            getLabel('onboarding.step2Task3')
        ];

        // Replace animation + button with interactive demo
        const animEl = container.querySelector(DOM_SELECTORS.ONBOARDING_CYCLE_ANIMATION);
        const tryBtn = container.querySelector(DOM_SELECTORS.ONBOARDING_TRY_BTN);
        const hintEl = container.querySelector(DOM_SELECTORS.ONBOARDING_CHOICE_HINT);
        if (animEl) animEl.remove();
        if (tryBtn) tryBtn.remove();
        // Remove hint temporarily — will re-add below the demo with updated text
        if (hintEl) hintEl.remove();

        const demo = document.createElement('div');
        demo.className = 'cycle-demo';
        demo.setAttribute('aria-label', getLabel('onboarding.step2Title'));

        // Build task rows
        taskNames.forEach((name, i) => {
            const row = document.createElement('div');
            row.className = 'cycle-demo-task';
            row.dataset.index = i;

            row.innerHTML = `
                <div class="cycle-demo-checkbox" role="checkbox" aria-checked="false" tabindex="0">
                    <svg viewBox="0 0 24 24" class="cycle-demo-checkmark" aria-hidden="true">
                        <path d="M5,13 L9,17 L19,7" />
                    </svg>
                </div>
                <span class="cycle-demo-task-text"></span>
            `;

            // Use textContent for user-sourced label text (XSS safe)
            row.querySelector(DOM_SELECTORS.CYCLE_DEMO_TASK_TEXT).textContent = name;
            demo.appendChild(row);
        });

        // Cycle counter
        const counterEl = document.createElement('div');
        counterEl.className = 'cycle-demo-counter';
        counterEl.textContent = `${getLabel('onboarding.step2Cycles')}: 0`;
        demo.appendChild(counterEl);

        // "Cycle Complete!" flash element
        const completeEl = document.createElement('div');
        completeEl.className = 'cycle-demo-complete';
        completeEl.textContent = getLabel('onboarding.step2CycleComplete');
        demo.appendChild(completeEl);

        container.appendChild(demo);
        if (hintEl) {
            hintEl.textContent = getLabel('onboarding.step2ActiveHint');
            container.appendChild(hintEl);
        }

        // State
        let cycleCount = 0;
        let checked = [false, false, false];
        let resetting = false;
        const pendingTimers = [];

        const trackTimeout = (fn, delay) => {
            const id = setTimeout(fn, delay);
            pendingTimers.push(id);
            return id;
        };

        const resetDemo = () => {
            resetting = true;
            cycleCount++;

            // Show "Cycle Complete!" flash
            completeEl.classList.add(DOM_CLASSES.VISIBLE);
            counterEl.textContent = `${getLabel('onboarding.step2Cycles')}: ${cycleCount}`;

            trackTimeout(() => {
                // Reset all checkboxes
                checked = [false, false, false];
                demo.querySelectorAll(DOM_SELECTORS.CYCLE_DEMO_TASK).forEach(row => {
                    row.classList.remove(DOM_CLASSES.CHECKED);
                    const cb = row.querySelector(DOM_SELECTORS.CYCLE_DEMO_CHECKBOX);
                    if (cb) cb.setAttribute('aria-checked', 'false');
                });

                // Hide flash
                completeEl.classList.remove(DOM_CLASSES.VISIBLE);
                resetting = false;
            }, 1200);
        };

        const handleTaskClick = (e) => {
            if (resetting) return;
            const row = e.target.closest(DOM_SELECTORS.CYCLE_DEMO_TASK);
            if (!row) return;

            const idx = parseInt(row.dataset.index, 10);
            if (isNaN(idx)) return;

            // Toggle
            checked[idx] = !checked[idx];
            row.classList.toggle(DOM_CLASSES.CHECKED, checked[idx]);
            const cb = row.querySelector(DOM_SELECTORS.CYCLE_DEMO_CHECKBOX);
            if (cb) cb.setAttribute('aria-checked', String(checked[idx]));

            // Check if all complete
            if (checked.every(Boolean)) {
                trackTimeout(resetDemo, 400);
            }
        };

        demo.addEventListener('click', handleTaskClick);

        // Keyboard support (Enter/Space to toggle)
        const handleKeydown = (e) => {
            if (resetting) return;
            if (e.key === 'Enter' || e.key === ' ') {
                const cb = e.target.closest(DOM_SELECTORS.CYCLE_DEMO_CHECKBOX);
                if (cb) {
                    e.preventDefault();
                    const row = cb.closest(DOM_SELECTORS.CYCLE_DEMO_TASK);
                    if (row) {
                        row.click();
                    }
                }
            }
        };
        demo.addEventListener('keydown', handleKeydown);

        // Return cleanup function
        return () => {
            pendingTimers.forEach(id => clearTimeout(id));
            pendingTimers.length = 0;
            demo.removeEventListener('click', handleTaskClick);
            demo.removeEventListener('keydown', handleKeydown);
        };
    }

}
