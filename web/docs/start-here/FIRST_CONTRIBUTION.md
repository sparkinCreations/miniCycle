# Your First Contribution to miniCycle

A step-by-step walkthrough for making your first pull request.

> **Before you start**, read [WHAT_IS_MINICYCLE.md](../start-here/WHAT_IS_MINICYCLE.md) so you understand the product. miniCycle is a **routine manager**, not a todo app — tasks cycle (reset) instead of being deleted.

---

## 1. Clone and Run

```bash
# Clone the repo
git clone https://github.com/sparkinCreations/miniCycle.git
cd miniCycle/web

# Install dependencies (for automated tests only)
npm install

# Start the dev server
python3 -m http.server 8080
# OR
npx serve .

# Open in browser
open http://localhost:8080/miniCycle.html
```

No build step to develop. No webpack config to learn. Pure vanilla JavaScript with ES6
modules. (A deploy-time esbuild step bundles releases on Netlify — you never touch it as a
contributor; see [BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md) if curious.)

---

## 2. Run the Tests

```bash
# Automated (headless browser)
npm test

# Manual (browser UI)
open http://localhost:8080/tests/module-test-suite.html
```

All tests must pass before and after your changes. See [PROJECT_STATS.md](../PROJECT_STATS.md) for current test counts.

---

## 3. Understand the Architecture (5-minute version)

miniCycle uses **strict dependency injection** with zero `window.*` globals. Every module declares what it needs and gets it wired at boot time.

**Key concepts:**

| Concept | What it means |
|---------|---------------|
| **DI Framework** | `createDIModule()` from `diBase.js` with `required()` and `optional()` markers |
| **Module Manifests** | `modules/boot/moduleManifests.js` declares every module, its dependencies, and what it provides |
| **Three-Phase Boot** | `coreBoot` → `featureBoot` → `uiBoot`, each loading modules in dependency order |
| **AppState** | Centralized state — always use `AppState.update()`, never mutate directly |

**Folder structure:**

```
modules/
 ├── boot/        ← Boot sequence and module loading
 ├── core/        ← AppState, appInit, DI base, constants
 ├── task/        ← Task CRUD, DOM, events, drag-drop
 ├── routine/     ← Routine management and switching
 ├── recurring/   ← Recurring task scheduling and panel
 ├── ui/          ← Modals, menus, settings, gestures
 ├── features/    ← Themes, stats, achievements, history
 ├── utils/       ← Notifications, device detection, helpers
 ├── labels/      ← Label system and registry
 ├── storage/     ← Backup manager
 ├── progress/    ← Cycle completion tracking
 ├── testing/     ← Test infrastructure
 └── other/       ← Plugins, experimental
```

For deeper understanding, see [DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md) and [DI_PATTERNS.md](DI_PATTERNS.md).

---

## 4. Pick an Issue

Look for issues labeled **`good first issue`** in the GitHub repo. These are scoped to be approachable for someone new to the codebase.

Good first contributions include:
- **Bug fixes** — isolated issues with clear reproduction steps
- **Test coverage** — adding tests for untested edge cases
- **Documentation** — fixing typos, improving explanations, adding examples
- **Accessibility** — improving ARIA labels, keyboard navigation, screen reader support

If you want to work on something not listed, open an issue first to discuss the approach before writing code.

---

## 5. Make Your Changes

### Create a branch

```bash
git checkout -b fix/short-description
# Examples:
# git checkout -b fix/stats-panel-aria-label
# git checkout -b feat/export-csv-button
# git checkout -b docs/fix-getting-started-typo
```

**Branch naming:**
- `fix/` — bug fixes
- `feat/` — new features
- `docs/` — documentation changes
- `refactor/` — code restructuring without behavior changes
- `test/` — adding or updating tests

### Follow the patterns

Every module follows the same DI pattern. When modifying a module, match what's already there:

```javascript
import { createDIModule, required, optional } from '../core/diBase.js'

const di = createDIModule('MyModule', {
    AppState: required(),
    showNotification: optional(null)
})

// Late-binding proxy for accessing deps
const _deps = new Proxy({}, {
    get(_, prop) { return di.resolve()[prop] }
})
```

**Rules:**
- Never use `window.*` to access dependencies — use DI
- Never mutate `AppState` directly — use `AppState.update()`
- Always guard optional dependencies: `if (_deps.showNotification) { ... }`
- Always handle missing DOM elements: `if (!element) return`

### The 5 patterns you'll use daily

The DI scaffolding above is *how* to structure a module. These are the daily habits that decide whether your code matches the rest of the codebase or fights it. You'll touch most of these in your first PR.

#### 1. Use `getLabel()` for every user-facing string

Notification text, modal titles, button labels, ARIA labels, hint text — everything. Hardcoded strings break vocab themes (Habit Tracker, Fitness, etc.) and skip the central registry.

```javascript
import { getLabel } from '../labels/labelResolver.js';

button.textContent = getLabel('action.addTask');
button.setAttribute('aria-label', getLabel('action.addTaskAria'));
```

If a label key doesn't exist yet, **add it to `modules/labels/defaultLabels.js` first**, then use it. Never inline emojis or icons (`📝`, `⋯`) into label text — pass them as `vars` for interpolation.

→ Deep dive: [`CODING_STANDARDS.md`](CODING_STANDARDS.md) §Label System

#### 2. Use constants from `constants.js`, never hardcoded selectors / classes / IDs

```javascript
import { DOM_IDS, DOM_CLASSES, DOM_SELECTORS } from '../core/constants.js';

document.getElementById(DOM_IDS.TASK_LIST);                  // not 'taskList'
element.classList.add(DOM_CLASSES.HIDDEN);                   // not 'hidden'
element.querySelector(DOM_SELECTORS.TASK_TEXT);              // not '.task-text'
```

Same rule for timing values (`UI_TIMEOUTS.NOTIFICATION_BRIEF`), z-index (`Z_INDEX.MODAL`), and limits (`LIMITS.MAX_TASKS`). If the constant doesn't exist yet, add it before using.

→ Deep dive: [`CONSTANTS_SYSTEM_GUIDE.md`](CONSTANTS_SYSTEM_GUIDE.md)

#### 3. Wire shared functions through the 4-step DI pipeline

If your code needs a function from another module, the wiring path is *exactly* four layers — miss any and the dep silently resolves to `undefined`:

1. The provider's manifest entry adds the function name to `provides`
2. `moduleLoader.js` `depMappings` adds an entry pointing into the provider
3. The consumer's manifest adds it to `optionalDeps` (or `requires`)
4. The consumer's `createDIModule({ ... })` declares it with `optional()` / `required()`

```javascript
// Consumer module
const di = createDIModule('MyModule', {
    clearAllTasks: optional(null),  // ← step 4
});

// Then in code:
this.deps.clearAllTasks?.();
```

→ Deep dive: [`MAKING_CODE_CHANGES.md`](MAKING_CODE_CHANGES.md)

#### 4. Clean up every event listener you add

Every `addEventListener` needs a removal path. Memory leaks in modals are the #1 source of accumulated bugs in this codebase. Store the handler reference, attach via `safeAddEventListener` when possible, and remove in `destroy()` / `closeModal()`.

```javascript
// Store reference so we can remove later
this._clickHandler = (e) => this.handleClick(e);
this._element.addEventListener('click', this._clickHandler);

// In destroy() or close handler:
this._element.removeEventListener('click', this._clickHandler);
```

→ Deep dive: [`EVENT_LISTENER_GUIDE.md`](EVENT_LISTENER_GUIDE.md) and the modal checklist in [`HOW_TO_ADD_COOKBOOK.md`](HOW_TO_ADD_COOKBOOK.md)

#### 5. Update state via `AppState.update(state => …)`, never directly

```javascript
this.deps.AppState.update(state => {
    state.data.cycles[cycleId].tasks.push(newTask);
}, true); // true = save immediately, default is debounced
```

Direct mutation (`state.data.cycles[id].tasks = []`) skips the undo system, the debounced save, and the change notifications. **Always go through `update`.** Variables declared `inside` the callback are scoped to the callback — declare them in the outer scope first if you need to read them after.

→ Deep dive: [`developer-guides/CLAUDE.md`](CLAUDE.md) §State Management

#### Bonus: Where does this user-facing message belong?

If you're adding a string but aren't sure whether it's a notification, a modal, an empty-state hint, or a help-window message, see [`MESSAGING_SURFACES.md`](MESSAGING_SURFACES.md) — it has a decision tree.

### Add or update tests

If you changed behavior, update or add tests. Copy the test template to get started:

```bash
cp tests/MODULE_TEMPLATE.tests.js tests/yourModule.tests.js
```

Tests inject mock dependencies — no global state needed:

```javascript
const mockDeps = {
    AppState: { get: () => mockState, update: fn => fn(mockState) },
    showNotification: () => {}
}
```

---

## 6. Verify Your Changes

```bash
# Run the full test suite
npm test

# Check that ALL tests pass (not just yours)
# Expected output: "All tests passed! (XXXX/XXXX - 100%)"
```

If tests fail, fix them before submitting. The CI pipeline runs the same test suite.

---

## 7. Submit a Pull Request

```bash
# Push your branch
git push -u origin fix/short-description
```

Then open a PR on GitHub with:

- **Title**: Short, descriptive (under 70 characters)
- **Description**: What you changed and why
- **Test plan**: How you verified the change works

### PR template

```markdown
## Summary
- Brief description of what changed and why

## Test Plan
- [ ] All existing tests pass (`npm test`)
- [ ] New/updated tests added (if applicable)
- [ ] Manually tested in browser
- [ ] Tested on mobile (if touch/gesture related)
```

---

## 8. Code Review

What to expect after submitting:

1. **Automated checks** — CI runs the full test suite. All tests must pass.
2. **Review** — A maintainer will review your code, usually within a few days.
3. **Feedback** — You may get change requests. This is normal and collaborative, not adversarial.
4. **Merge** — Once approved and passing CI, your PR gets merged.

### Common review feedback

| Feedback | What it means |
|----------|---------------|
| "Use DI for this" | You accessed something via `window.*` or a direct import instead of dependency injection |
| "Guard the optional dep" | You called an optional dependency without checking if it exists first |
| "Match existing pattern" | The module uses a specific pattern — follow it for consistency |
| "Add a test for this" | Behavior changes need test coverage |
| "Check on mobile" | Touch interactions and gestures should be tested on actual devices |

---

## Common Pitfalls

### 1. Importing directly instead of using DI

```javascript
// ❌ Don't do this
import { AppState } from '../core/appState.js'

// ✅ Do this — receive it through DI
const di = createDIModule('MyModule', {
    AppState: required()
})
```

### 2. Forgetting cache busting on dynamic imports

```javascript
// ❌ Missing version query string
const mod = await import('./mySubModule.js')

// ✅ Use cache busting
const version = globalThis.APP_VERSION || 'dev-local'
const mod = await import(`./mySubModule.js?v=${version}`)
```

> Still required in source even though production is content-hashed: dev serves raw
> source where `?v=` is the cache identity, and the release build's rewriter recognizes
> exactly these patterns to rewrite them onto hashed `/build/…` URLs (see
> `docs/deployment/BUILD_PROCESS.md`). A bare `import('./x.js')` breaks BOTH worlds.

### 3. Assuming the app is a todo list

Tasks in miniCycle **cycle** — they reset when completed, not delete. If your feature assumes tasks disappear after completion, it won't fit the product model.

### 4. Skipping `waitForCore()`

```javascript
// ❌ AppState might not be ready yet
const state = _deps.AppState.get()

// ✅ Wait for core systems first
await _deps.appInit.waitForCore()
const state = _deps.AppState.get()
```

---

## Getting Help

- **Read the docs** — The [Developer Documentation Hub](DEVELOPER_DOCUMENTATION.md) links to everything
- **Check CLAUDE.md** — The [AI assistant guide](CLAUDE.md) has a concise summary of patterns and rules
- **Open an issue** — If you're stuck, ask in a GitHub issue before spending hours debugging
- **Check the archive** — The [docs archive](../archive/README.md) has historical context on past design decisions

---

## Quick Reference Links

| Resource | Purpose |
|----------|---------|
| [WHAT_IS_MINICYCLE.md](../start-here/WHAT_IS_MINICYCLE.md) | Understand the product |
| [DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md) | See actual module dependencies |
| [DI_PATTERNS.md](DI_PATTERNS.md) | DI best practices and examples |
| [MODULE_SYSTEM_GUIDE.md](MODULE_SYSTEM_GUIDE.md) | How the module system works |
| [TESTING_QUICK_REFERENCE.md](../testing/TESTING_QUICK_REFERENCE.md) | Running and writing tests |
| [CONTRIBUTING.md](../project-info/CONTRIBUTING.md) | Full contribution guidelines |
| [PROJECT_STATS.md](../PROJECT_STATS.md) | Current metrics (module count, test count, etc.) |
