# Framework Equivalents — What miniCycle Builds by Hand

**Last Updated:** August 2026

This document maps miniCycle's hand-built architecture to the established frameworks and libraries that solve the same problems. Every pattern listed here was built from scratch in vanilla JavaScript — not because frameworks don't exist, but to understand the problems they solve at a foundational level.

---

## Table of Contents

1. [Dependency Injection](#1-dependency-injection)
2. [State Management](#2-state-management)
3. [Internationalization (i18n)](#3-internationalization-i18n)
4. [Component Lifecycle & Boot](#4-component-lifecycle--boot)
5. [Routing & Mode Management](#5-routing--mode-management)
6. [Event System](#6-event-system)
7. [CSS Architecture](#7-css-architecture)
8. [Offline & PWA](#8-offline--pwa)
9. [Testing](#9-testing)
10. [Summary Table](#summary-table)

---

## 1. Dependency Injection

### The framework equivalent
- **Angular**: `@Injectable()` decorators, hierarchical injectors, `providers` arrays
- **InversifyJS**: `@inject()` decorators with container bindings
- **Spring (Java)**: `@Autowired`, application context

### What miniCycle builds
A custom DI framework in `modules/core/diBase.js` with:

- `createDIModule()` — declares a module with named dependencies
- `required()` / `optional()` — dependency declarations with fail-fast validation
- `di.resolve()` — lazy resolution via getter pattern
- `Object.defineProperties` — preserves lazy getters during wiring (the same problem Angular solves with its injector hierarchy)

```javascript
// miniCycle
const di = createDIModule('RecurringPanel', {
    AppState: required(),
    showNotification: required(),
    safeAddEventListener: optional(null),
});
export const setRecurringPanelDependencies = di.setDependencies;

// Angular equivalent
@Injectable()
export class RecurringPanel {
    constructor(
        private appState: AppState,           // required
        private notification: NotificationService, // required
        @Optional() private eventHelper: EventHelper  // optional
    ) {}
}
```

### The problem both solve
Modules need to reference each other without circular imports, without global variables, and without knowing when their dependencies will be available. Angular's injector resolves this with a container that manages creation order. miniCycle's `Object.defineProperties` with lazy getters solves the same timing problem — dependencies are declared early but resolved late, only when actually accessed.

### What miniCycle adds
A manifest-based wiring layer — dependencies are declared in `moduleManifests.js` and connected by `moduleLoader.js` during `featureBoot.js`. This is analogous to Angular's `NgModule` providers array or Spring's component scanning — a central place that defines what provides what.

---

## 2. State Management

### The framework equivalent
- **Redux**: Single store, reducer functions, `dispatch(action)`, middleware
- **Vuex/Pinia**: Centralized store with mutations and actions
- **Zustand**: Minimal store with `set()` mutator
- **MobX**: Observable state with automatic tracking

### What miniCycle builds
`AppState` in `modules/core/appState.js`:

- Single centralized state object (Schema 2.5)
- `AppState.update(producer)` — mutates state via a producer function (like Immer)
- `AppState.subscribe()` — reactive listeners notified on changes
- 600ms debounced persistence to localStorage
- Immediate save option for critical mutations

```javascript
// miniCycle
AppState.update(state => {
    state.data.cycles[cycleId].tasks.push(newTask);
}, true); // true = immediate save

// Redux equivalent
dispatch({ type: 'ADD_TASK', payload: { cycleId, task: newTask } });
// + reducer + middleware + store.subscribe()

// Zustand equivalent
useStore.setState(state => ({
    cycles: { ...state.cycles, [cycleId]: { ...cycle, tasks: [...tasks, newTask] } }
}));
```

### The problem both solve
Multiple modules need to read and write shared state without stepping on each other, with change notifications so the UI stays in sync. Redux solves this with actions and reducers. miniCycle's producer pattern is closer to Zustand or Immer — direct mutation of a draft object, with the framework handling persistence and notification.

### What miniCycle adds
Built-in debounced persistence to localStorage and an undo/redo system (`undoRedoManager.js`) that wraps `AppState.update()` to automatically snapshot state before mutations — similar to what `redux-undo` provides as middleware.

---

## 3. Internationalization (i18n)

### The framework equivalent
- **i18next**: Key-based lookups with pluralization, interpolation, namespaces
- **react-intl / FormatJS**: ICU message syntax with React components
- **vue-i18n**: `$t('key')` with pluralization and formatting
- **Angular i18n**: `@angular/localize` with template markers

### What miniCycle builds
A label system in `modules/labels/`:

- `defaultLabels.js` — centralized keys across 32+ categories (the "translation file")
- `labelResolver.js` — `getLabel(key, options)` with pluralization and interpolation
- Theme-aware resolution — vocabulary themes override specific keys at runtime

```javascript
// miniCycle
getLabel('action.addTask')                                      // 'Add task'
getLabel('noun.task', { count: 3 })                             // 'tasks'
getLabel('notify.taskRenamed', { vars: { name: 'Buy milk' } })  // 'Task renamed to "Buy milk"'

// i18next equivalent
t('action.addTask')                                             // 'Add task'
t('noun.task', { count: 3 })                                    // 'tasks'
t('notify.taskRenamed', { name: 'Buy milk' })                   // 'Task renamed to "Buy milk"'
```

### The problem both solve
User-facing strings scattered across hundreds of files make consistency impossible and localization impractical. Both systems centralize strings into a registry with key-based lookups, keeping presentation logic separate from text content.

### What miniCycle adds
Theme-aware resolution via `LENS_SENSITIVE_KEYS` — a set of keys that vocabulary themes can override. When a routine uses the "Fitness" theme, `getLabel('noun.task')` returns "workout" instead of "task." This is conceptually similar to i18next namespaces or contexts, but driven by app state rather than user locale.

---

## 4. Component Lifecycle & Boot

### The framework equivalent
- **React**: `useEffect()` hooks, `componentDidMount`, Suspense boundaries
- **Angular**: `ngOnInit`, `ngOnDestroy`, module bootstrapping, lazy loading
- **Vue**: `onMounted`, `onUnmounted`, `createApp().mount()`
- **Spring Boot**: `@PostConstruct`, application context initialization phases

### What miniCycle builds
A 3-phase boot sequence in `modules/boot/`:

```
orchestrator.js (sequence control + boot UI + early coordination)
  → Phase 1: coreBoot.js     — AppState, migration, core utilities
  → Phase 2: featureBoot.js  — module loading, DI wiring, instance creation
  → Phase 3: uiBoot.js       — event listeners, UI finalization, theme application
```

Plus `appInit.js` with a 2-phase readiness system:

```javascript
// miniCycle — wait for core systems before accessing state
await appInit.waitForCore();
const state = AppState.get();

// Angular equivalent
ngOnInit() {
    // Angular guarantees DI is resolved before this runs
    const state = this.appState.get();
}

// React equivalent
useEffect(() => {
    // React guarantees DOM is mounted before this runs
    const state = store.getState();
}, []);
```

### The problem both solve
In any app with many modules, initialization order matters — state must exist before modules that read it, modules must be wired before instances that use them, and DOM must be ready before code that queries it. Frameworks handle this automatically through their component lifecycle. miniCycle handles it explicitly through boot phases with `await` boundaries.

### What miniCycle adds
An `ensureBootModalTemplate()` idempotency pattern that makes boot phases retry-safe — if a phase fails and retries, DOM injections aren't duplicated. This solves a problem that frameworks handle implicitly through virtual DOM diffing (React) or template compilation (Angular).

---

## 5. Routing & Mode Management

### The framework equivalent
- **React Router**: `<Route>`, `useNavigate()`, nested routes
- **Vue Router**: `<router-view>`, route guards, navigation hooks
- **Angular Router**: `RouterModule`, route resolvers, guards

### What miniCycle builds
`modeManager.js` — a state machine that manages three app modes (Auto Cycle, Manual Cycle, To-Do) and panel states (browsing, previewing, editing):

```javascript
// miniCycle — mode determines UI behavior
modeManager.setMode('todo');
// Updates: button labels, help text, completion behavior, task lifecycle

// React Router equivalent (conceptually)
<Route path="/todo" element={<TodoView />} />
```

### The problem both solve
Different "views" of the same app need different behavior, labels, and UI state. Routers solve this by mapping URLs to components. miniCycle's mode manager solves it by mapping mode strings to behavioral configurations — which buttons appear, what completion does, how tasks lifecycle.

### How they differ
miniCycle is a single-page app with no URL routing. Mode management is closer to a finite state machine than a router — it controls behavior, not navigation. The recurring panel's `browsing → previewing → editing` state machine is a direct example: three states with defined transitions, each showing different UI.

---

## 6. Event System

### The framework equivalent
- **React**: Synthetic events, `onClick` props, event delegation via virtual DOM
- **Angular**: `(click)` template bindings, `@HostListener`, RxJS observables
- **Vue**: `@click` directives, `$emit()` for child-to-parent communication
- **EventEmitter (Node.js)**: `on()`, `emit()`, `removeListener()`

### What miniCycle builds
Three complementary patterns:

1. **`safeAddEventListener()`** — removes existing listener before adding, preventing duplicates (solves the problem React's synthetic events solve by replacing handlers on re-render)

2. **Event delegation** — single listener on a container with `event.target.closest()` (the same pattern React uses internally under the hood)

3. **`CustomEvent` dispatch** — for cross-module communication without direct imports (similar to Angular's `EventEmitter` or a pub/sub bus)

```javascript
// miniCycle — safe listener that prevents duplicates
safeAddEventListener(button, 'click', handleClick);
// Internally: button.removeEventListener('click', handleClick);
//             button.addEventListener('click', handleClick);

// React equivalent — framework handles this automatically
<button onClick={handleClick}>

// miniCycle — event delegation
container.addEventListener('click', (e) => {
    const taskItem = e.target.closest('.task-item');
    if (taskItem) handleTaskClick(taskItem);
});

// React equivalent — each element gets its own synthetic handler
{tasks.map(task => <TaskItem key={task.id} onClick={() => handleClick(task)} />)}
```

### The problem both solve
Event listeners in long-lived apps leak memory if not cleaned up, duplicate if added multiple times, and become unmanageable when spread across hundreds of elements. Frameworks solve this by managing listener lifecycle automatically. miniCycle solves it through `safeAddEventListener` (deduplication), WeakMap-based cleanup registries (lifecycle), and event delegation (scalability).

---

## 7. CSS Architecture

### The framework equivalent
- **Tailwind CSS**: Utility-first with design tokens
- **CSS Modules**: Scoped styles per component
- **Styled Components / Emotion**: CSS-in-JS with theme providers
- **Material UI / Chakra**: Design system with token-based theming

### What miniCycle builds
A token-based design system in `styles/base/variables.css`:

- CSS custom properties for spacing (`--space-1` through `--space-12`), colors, typography, z-index, transitions
- CSS files organized by component (see [PROJECT_STATS.md](../PROJECT_STATS.md) for counts)
- Dark mode via `prefers-color-scheme` and manual toggle
- Reduced motion support via `prefers-reduced-motion` (timing variables auto-disable)
- Vocabulary theme color presets applied as `--pref-*` CSS variables at runtime

```css
/* miniCycle — token-based */
background: var(--theme-task-bg);
padding: var(--space-4);
font-size: var(--font-size-md);
transition: opacity var(--transition-normal);
z-index: var(--z-modal);

/* Tailwind equivalent */
<div class="bg-white p-4 text-base transition-opacity z-50">

/* Styled Components equivalent */
const Box = styled.div`
    background: ${({ theme }) => theme.taskBg};
    padding: ${({ theme }) => theme.space[4]};
`;
```

### The problem both solve
Hardcoded values (colors, spacing, z-indexes) create inconsistency and make theming impossible. All these systems centralize design decisions into tokens/variables. miniCycle uses native CSS custom properties — the same primitive that Tailwind compiles down to and that CSS-in-JS libraries generate.

---

## 8. Offline & PWA

### The framework equivalent
- **Workbox (Google)**: Service worker toolkit with caching strategies
- **next-pwa**: Next.js PWA plugin
- **@angular/service-worker**: Angular's built-in SW support

### What miniCycle builds
A hand-written service worker (`service-worker.js`) with:

- Tiered caching strategies per request type: cache-first navigation with background revalidation (staleness healed page-side by `verifyVersionFresh()`), immutable cache-first for content-hashed `/build/` assets, network-first on version mismatch, stale-while-revalidate for the rest
- Versioned cache management (`CACHE_VERSION` in `version.js`)
- Graceful offline support — full app functionality without network
- Lite version redirect failsafes in the HTML (16-second late-boot check + 60-second load timeout)

### The problem both solve
Web apps need to work offline, cache assets efficiently, and update gracefully. Workbox provides this through configurable strategies. miniCycle's service worker implements the same caching strategies manually — understanding exactly when network requests happen, when caches are used, and how updates propagate.

---

## 9. Testing

### The framework equivalent
- **Jest + React Testing Library**: Component testing with DOM assertions
- **Cypress**: E2E browser testing with time travel
- **Vitest**: Fast unit testing for Vite projects

### What miniCycle builds
Playwright browser tests (`web/tests/`) that:

- Run against the actual app in a real browser (localhost:8080)
- Use `createProtectedTest()` to backup/restore localStorage between tests
- Test the full boot sequence, DI wiring, and UI interactions
- Comprehensive test files (see [PROJECT_STATS.md](../PROJECT_STATS.md) for counts)

### The problem both solve
Code needs automated verification. The approach differs — React Testing Library tests components in isolation with a virtual DOM, while miniCycle tests the full app in a real browser. miniCycle's approach is closer to Cypress or Playwright E2E testing, validating that the entire system works together rather than testing units in isolation.

---

## Summary Table

| Problem | Framework Solution | miniCycle Solution | Key File(s) |
|---------|-------------------|-------------------|-------------|
| Dependency injection | Angular DI, InversifyJS | `createDIModule()` with lazy getters | `diBase.js`, `featureBoot.js` |
| State management | Redux, Zustand, Pinia | `AppState.update(producer)` | `appState.js` |
| i18n / string management | i18next, react-intl | `getLabel()` with theme-aware resolution | `defaultLabels.js`, `labelResolver.js` |
| Component lifecycle | React hooks, Angular lifecycle | 3-phase boot + `appInit.waitForCore()` | `orchestrator.js`, `appInit.js` |
| Routing / view state | React Router, Vue Router | Mode manager state machine | `modeManager.js` |
| Event management | React synthetic events | `safeAddEventListener` + delegation | Per-module, `globalUtils.js` |
| Design tokens / theming | Tailwind, Styled Components | CSS custom properties | `variables.css` |
| Offline / PWA | Workbox, next-pwa | Hand-written service worker | `service-worker.js` |
| Testing | Jest, Cypress | Playwright browser tests | `tests/*.js` |
| Undo/redo | redux-undo | `undoRedoManager.js` wrapping AppState | `undoRedoManager.js` |
| Module loading | Webpack, Vite | Manifest-based dynamic imports | `featureBoot.js`, `moduleLoader.js` |
| Selector constants | CSS Modules scoping | `DOM_IDS`, `DOM_SELECTORS`, `DATA_SELECTORS` | `constants.js` |

---

## Why Build These by Hand?

miniCycle is simultaneously a product, a learning project, and a portfolio piece. Building each architectural layer from scratch provides:

1. **Deep understanding** — knowing what `Object.defineProperties` does at the property descriptor level, not just that Angular's `@Injectable()` "handles DI"
2. **Informed future decisions** — the next project will use frameworks, chosen based on understanding what problems they actually solve
3. **Debugging ability** — when a framework's abstraction breaks, understanding the underlying pattern makes the fix obvious
4. **Architecture ownership** — every pattern exists because a real problem demanded it, not because a tutorial prescribed it

The trade-off is real: more boilerplate, more files to touch per feature, and patterns that require documentation for new contributors. But for a solo developer learning the craft, the understanding gained outweighs the productivity cost.

---

## Further Reading

- [DI Patterns Guide](../working-on-code/DI_PATTERNS.md) — full DI pattern reference
- [Architecture Overview](../architecture/ARCHITECTURE_OVERVIEW.md) — system-level architecture
- [Label System Architecture](../architecture/LABEL_SYSTEM_ARCHITECTURE.md) — i18n system deep dive
- [Event Flow Patterns](../architecture/EVENT_FLOW_PATTERNS.md) — event delegation and listener lifecycle
- [CSS Architecture Guide](../architecture/CSS_ARCHITECTURE_GUIDE.md) — design token system
- [Undo/Redo Architecture](../architecture/UNDO_REDO_ARCHITECTURE.md) — state snapshot system
