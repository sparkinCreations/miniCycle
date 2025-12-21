# Folder Structure & Module Naming Refactor Plan

**Status:** ✅ COMPLETED (December 21, 2025)
**Priority:** Medium
**Estimated Effort:** 1-2 days
**Breaking Changes:** Yes (import paths change)
**Dependencies:** Implemented ahead of Schema 2.6

---

## ✅ Implementation Complete

The following changes were made on December 21, 2025:

1. **Folder renamed:** `modules/cycle/` → `modules/routine/`
2. **Files renamed:**
   - `cycleManager.js` → `routineManager.js`
   - `cycleSwitcher.js` → `routineSwitcher.js`
   - `cycleLoader.js` → `routineLoader.js`
3. **Classes renamed:**
   - `CycleManager` → `RoutineManager`
   - `CycleSwitcher` → `RoutineSwitcher`
4. **DI setters renamed:**
   - `setCycleManagerDependencies` → `setRoutineManagerDependencies`
   - `setCycleSwitcherDependencies` → `setRoutineSwitcherDependencies`
   - `setCycleLoaderDependencies` → `setRoutineLoaderDependencies`

**Backward compatibility aliases provided** for all renamed exports to prevent breaking existing code.

---

## 🎯 Original Overview

This plan addressed terminology inconsistencies in folder and module naming to align with Schema 2.6's `cycles` → `routine` migration and improve overall clarity.

### The Problem (RESOLVED)

**Old folder structure used "cycle" terminology:**
```
modules/
├── cycle/                    # ❌ Called "cycle" but manages routines
│   ├── cycleManager.js       # ❌ Creates/manages routines, not cycles
│   ├── cycleSwitcher.js      # ❌ Switches routines, not cycles
│   ├── cycleLoader.js        # ❌ Loads/saves routines
│   └── modeManager.js        # ✅ OK (manages modes)
```

**Issues (RESOLVED):**
- Folder name `cycle/` conflicts with user mental model ("I create routines")
- Module names like `cycleManager` should be `routineManager`
- Inconsistent with Schema 2.6 terminology (`data.routine`)
- Confusing for new developers joining the project

---

## ✅ Proposed Folder Structure

### Current Structure (Schema 2.5)

```
web/
├── modules/
│   ├── core/
│   │   ├── appState.js
│   │   └── appInit.js
│   │
│   ├── cycle/                          # ❌ Should be "routine"
│   │   ├── cycleManager.js             # ❌ Should be "routineManager"
│   │   ├── cycleSwitcher.js            # ❌ Should be "routineSwitcher"
│   │   ├── cycleLoader.js              # ❌ Should be "routineLoader"
│   │   ├── modeManager.js              # ✅ OK
│   │   └── migrationManager.js         # ✅ OK
│   │
│   ├── task/
│   │   ├── taskCore.js
│   │   ├── taskDOM.js
│   │   ├── taskEvents.js
│   │   ├── taskRenderer.js
│   │   ├── taskUtils.js
│   │   └── taskValidation.js
│   │
│   ├── recurring/
│   │   ├── recurringCore.js
│   │   ├── recurringPanel.js
│   │   └── recurringIntegration.js
│   │
│   ├── ui/
│   │   ├── undoRedoManager.js
│   │   ├── menuManager.js
│   │   ├── modalManager.js
│   │   ├── onboardingManager.js
│   │   ├── settingsManager.js
│   │   └── gamesManager.js
│   │
│   ├── features/
│   │   ├── dueDates.js
│   │   ├── reminders.js
│   │   ├── themeManager.js
│   │   └── statsPanel.js
│   │
│   ├── utils/
│   │   ├── globalUtils.js
│   │   ├── errorHandler.js
│   │   ├── deviceDetection.js
│   │   └── notifications.js
│   │
│   ├── testing/
│   │   ├── testingModal.js
│   │   ├── consoleCapture.js
│   │   └── testRunner.js
│   │
│   └── other/
│       └── (plugin examples)
```

### Proposed Structure (Schema 2.6)

```
web/
├── modules/
│   ├── core/
│   │   ├── appState.js
│   │   └── appInit.js
│   │
│   ├── routine/                        # ✅ Renamed from "cycle"
│   │   ├── routineManager.js           # ✅ Renamed from "cycleManager"
│   │   ├── routineSwitcher.js          # ✅ Renamed from "cycleSwitcher"
│   │   ├── routineLoader.js            # ✅ Renamed from "cycleLoader"
│   │   ├── modeManager.js              # ✅ No change (manages modes)
│   │   └── migrationManager.js         # ✅ No change (manages migrations)
│   │
│   ├── task/
│   │   ├── taskCore.js                 # ✅ No change
│   │   ├── taskDOM.js                  # ✅ No change
│   │   ├── taskEvents.js               # ✅ No change
│   │   ├── taskRenderer.js             # ✅ No change
│   │   ├── taskUtils.js                # ✅ No change
│   │   └── taskValidation.js           # ✅ No change
│   │
│   ├── recurring/
│   │   ├── recurringCore.js            # ✅ No change
│   │   ├── recurringPanel.js           # ✅ No change
│   │   └── recurringIntegration.js     # ✅ No change
│   │
│   ├── ui/
│   │   ├── undoRedoManager.js          # ✅ No change
│   │   ├── menuManager.js              # ✅ No change
│   │   ├── modalManager.js             # ✅ No change
│   │   ├── onboardingManager.js        # ✅ No change
│   │   ├── settingsManager.js          # ✅ No change
│   │   └── gamesManager.js             # ✅ No change
│   │
│   ├── features/
│   │   ├── dueDates.js                 # ✅ No change
│   │   ├── reminders.js                # ✅ No change
│   │   ├── themeManager.js             # ✅ No change
│   │   └── statsPanel.js               # ✅ No change
│   │
│   ├── utils/
│   │   ├── globalUtils.js              # ✅ No change
│   │   ├── errorHandler.js             # ✅ No change
│   │   ├── deviceDetection.js          # ✅ No change
│   │   └── notifications.js            # ✅ No change
│   │
│   ├── testing/
│   │   ├── testingModal.js             # ✅ No change
│   │   ├── consoleCapture.js           # ✅ No change
│   │   └── testRunner.js               # ✅ No change
│   │
│   └── other/
│       └── (plugin examples)            # ✅ No change
```

---

## 📝 File Renames Required

### Folder Rename

```bash
modules/cycle/ → modules/routine/
```

### Module Renames

| Old Name | New Name | Reason |
|----------|----------|--------|
| `cycleManager.js` | `routineManager.js` | Manages routines, not cycles |
| `cycleSwitcher.js` | `routineSwitcher.js` | Switches between routines |
| `cycleLoader.js` | `routineLoader.js` | Loads/saves routine data |
| `modeManager.js` | *(no change)* | Manages modes (Auto/Manual/ToDo) |
| `migrationManager.js` | *(no change)* | Manages schema migrations |

### Test File Renames

```
tests/
├── cycleManager.tests.js → routineManager.tests.js
├── cycleSwitcher.tests.js → routineSwitcher.tests.js
├── cycleLoader.tests.js → routineLoader.tests.js
└── modeManager.tests.js (no change)
```

---

## 🔄 Import Path Updates

All imports referencing the `cycle/` folder need updating:

### Main Application

**File:** `miniCycle-scripts.js`

```javascript
// OLD
import { CycleManager } from './modules/cycle/cycleManager.js';
import { CycleSwitcher } from './modules/cycle/cycleSwitcher.js';
import { CycleLoader } from './modules/cycle/cycleLoader.js';
import { ModeManager } from './modules/cycle/modeManager.js';

// NEW
import { RoutineManager } from './modules/routine/routineManager.js';
import { RoutineSwitcher } from './modules/routine/routineSwitcher.js';
import { RoutineLoader } from './modules/routine/routineLoader.js';
import { ModeManager } from './modules/routine/modeManager.js';
```

### Class Name Updates

Classes should also be renamed for consistency:

```javascript
// OLD
export class CycleManager { }
export class CycleSwitcher { }
export class CycleLoader { }

// NEW
export class RoutineManager { }
export class RoutineSwitcher { }
export class RoutineLoader { }
```

### Instance Variable Names

```javascript
// OLD
const cycleManager = new CycleManager();
const cycleSwitcher = new CycleSwitcher();
const cycleLoader = new CycleLoader();

// NEW
const routineManager = new RoutineManager();
const routineSwitcher = new RoutineSwitcher();
const routineLoader = new RoutineLoader();
```

---

## 📦 Files That Import These Modules

**Need to update imports in:**

1. **miniCycle-scripts.js** - Main orchestrator
2. **modules/ui/menuManager.js** - Cycle switching menu
3. **modules/ui/settingsManager.js** - Settings panel
4. **modules/ui/modalManager.js** - Modals for cycle creation
5. **modules/ui/onboardingManager.js** - Onboarding flow
6. **modules/task/taskCore.js** - Task operations
7. **modules/features/statsPanel.js** - Statistics display
8. **tests/cycleManager.tests.js** - Test file
9. **tests/cycleSwitcher.tests.js** - Test file
10. **tests/cycleLoader.tests.js** - Test file
11. **tests/integration.tests.js** - Integration tests
12. **tests/automated/run-browser-tests.js** - Test runner

---

## 🧪 Testing Strategy

### Test Renames

```bash
# Rename test files
mv tests/cycleManager.tests.js → tests/routineManager.tests.js
mv tests/cycleSwitcher.tests.js → tests/routineSwitcher.tests.js
mv tests/cycleLoader.tests.js → tests/routineLoader.tests.js
```

### Update Test Imports

```javascript
// OLD
import { CycleManager } from '../modules/cycle/cycleManager.js';

// NEW
import { RoutineManager } from '../modules/routine/routineManager.js';
```

### Update Test Suite Config

**File:** `tests/module-test-suite.html`

```html
<!-- OLD -->
<option value="cycleManager">Cycle Manager</option>
<option value="cycleSwitcher">Cycle Switcher</option>
<option value="cycleLoader">Cycle Loader</option>

<!-- NEW -->
<option value="routineManager">Routine Manager</option>
<option value="routineSwitcher">Routine Switcher</option>
<option value="routineLoader">Routine Loader</option>
```

### Update Test Runner

**File:** `tests/automated/run-browser-tests.js`

```javascript
// OLD
const modules = [
  'cycleManager',
  'cycleSwitcher',
  'cycleLoader',
  // ...
];

// NEW
const modules = [
  'routineManager',
  'routineSwitcher',
  'routineLoader',
  // ...
];
```

---

## 📚 Documentation Updates

### Files to Update

1. **FOLDER_STRUCTURE.md**
   - Update folder tree diagrams
   - Update module descriptions
   - Update "cycle" → "routine" terminology

2. **DEVELOPER_DOCUMENTATION.md**
   - Update import examples
   - Update module references
   - Update architecture diagrams

3. **CLAUDE.md**
   - Update module system section
   - Update import patterns
   - Update file paths

4. **INDEX.md**
   - Update quick reference links
   - Update module counts

5. **TESTING_ARCHITECTURE.md**
   - Update test file references
   - Update module test descriptions

6. **TESTING_README.md**
   - Update test module names
   - Update file paths

7. **All Architecture Docs**
   - Search for "cycleManager" references
   - Update to "routineManager"

---

## 🚀 Implementation Plan

### Phase 1: Preparation (2-3 hours)

1. **Create feature branch**
   ```bash
   git checkout -b refactor/routine-terminology
   ```

2. **Document current state**
   ```bash
   # List all imports of cycle modules
   grep -r "from.*cycle/" modules/ miniCycle-scripts.js tests/

   # Count affected files
   grep -rl "cycle/" modules/ miniCycle-scripts.js tests/ | wc -l
   ```

3. **Run baseline tests**
   ```bash
   npm test  # Verify all 1070 tests passing
   ```

### Phase 2: Folder & File Renames (1 hour)

```bash
# Rename folder
mv modules/cycle modules/routine

# Rename files within routine/
cd modules/routine
mv cycleManager.js routineManager.js
mv cycleSwitcher.js routineSwitcher.js
mv cycleLoader.js routineLoader.js

# Rename test files
cd tests
mv cycleManager.tests.js routineManager.tests.js
mv cycleSwitcher.tests.js routineSwitcher.tests.js
mv cycleLoader.tests.js routineLoader.tests.js
```

### Phase 3: Update Imports (2-3 hours)

**Systematic approach:**

1. Update `miniCycle-scripts.js`
2. Update all `modules/` files
3. Update all `tests/` files
4. Update test suite HTML
5. Update test runner

**Use find-and-replace carefully:**
- `modules/cycle/` → `modules/routine/`
- `CycleManager` → `RoutineManager`
- `CycleSwitcher` → `RoutineSwitcher`
- `CycleLoader` → `RoutineLoader`
- `cycleManager` → `routineManager`
- `cycleSwitcher` → `routineSwitcher`
- `cycleLoader` → `routineLoader`

### Phase 4: Update Class Names (1 hour)

Inside each renamed module:

```javascript
// routineManager.js
export class RoutineManager {  // Changed from CycleManager
  constructor() { }
}

// routineSwitcher.js
export class RoutineSwitcher {  // Changed from CycleSwitcher
  constructor() { }
}

// routineLoader.js
export class RoutineLoader {  // Changed from CycleLoader
  constructor() { }
}
```

### Phase 5: Testing (2-3 hours)

```bash
# Run full test suite
npm test

# Verify all 1070+ tests still pass
# Fix any broken imports
# Update test expectations if needed
```

### Phase 6: Documentation (2-3 hours)

- Update all 7 documentation files
- Update folder structure diagrams
- Update architecture references
- Search docs for "cycleManager" and update

---

## ⚠️ Risks & Mitigation

### Risk 1: Broken Imports
**Impact:** High - App won't load
**Mitigation:**
- Use automated find-and-replace with verification
- Test after each batch of changes
- Keep browser console open to catch import errors

### Risk 2: Missed References
**Impact:** Medium - Some features broken
**Mitigation:**
- Comprehensive grep search before/after
- Full test suite execution
- Manual testing of cycle operations

### Risk 3: Test Failures
**Impact:** Medium - CI/CD blocked
**Mitigation:**
- Run tests frequently during refactor
- Fix tests incrementally
- Don't merge until 100% passing

### Risk 4: Documentation Drift
**Impact:** Low - Confusion for developers
**Mitigation:**
- Update docs immediately after code
- Use checklist to track all doc files
- Review all changes in PR

---

## ✅ Success Criteria

- [ ] Folder renamed: `modules/cycle/` → `modules/routine/`
- [ ] Files renamed: 3 module files + 3 test files
- [ ] All imports updated (0 references to old paths)
- [ ] All class names updated
- [ ] All instance variables updated
- [ ] All 1070+ tests passing
- [ ] Test suite UI updated
- [ ] Test runner updated
- [ ] 7 documentation files updated
- [ ] Manual testing complete (create, switch, load routines)
- [ ] No console errors
- [ ] PWA still installs correctly
- [ ] Git history clean (good commit messages)

---

## 📊 Estimated Impact

### Files Changed: ~25-30 files
- 3 module renames
- 3 test file renames
- ~12 files with import updates
- 7 documentation files
- 2-3 configuration files

### Lines Changed: ~150-200 lines
- Mostly import statements
- Some class name updates
- Some variable renames
- Documentation updates

### Time Investment: 1-2 days
- Day 1: Renames, imports, class updates, testing
- Day 2: Documentation, final testing, PR review

### Risk Level: Low-Medium
- Straightforward mechanical changes
- Good test coverage prevents regressions
- Can be done incrementally
- Easy to verify completeness

---

## 🔗 Relationship to Schema 2.6

**This refactor should be done TOGETHER with Schema 2.6:**

1. Schema 2.6 changes `data.cycles` → `data.routine`
2. This refactor changes `modules/cycle/` → `modules/routine/`
3. Combined: Complete terminology alignment across schema + code

**Benefits of combined implementation:**
- Single migration for users
- One set of documentation updates
- Consistent terminology everywhere
- Single PR/release

**Release as:** Version 1.360 or 1.400
- Breaking changes warrant version bump
- Clear changelog entry
- Migration guide for developers

---

## 🔮 Future Considerations

After this refactor:

1. **Variable naming audit**
   - Search for remaining "cycle" variables that should be "routine"
   - Update function parameter names
   - Update comments and JSDoc

2. **UI text consistency**
   - Ensure buttons/labels use consistent terminology
   - "Create Routine" not "Create Cycle"
   - "Switch Routines" not "Switch Cycles"

3. **Consider `cycleCount` field**
   - Keep as-is (it counts completions, which are cycles)
   - Or rename to `completionCount` for absolute clarity?
   - Document the distinction in schema

---

## 📝 Checklist for Implementation

### Pre-Implementation
- [ ] Read this plan thoroughly
- [ ] Review Schema 2.6 plan
- [ ] Create feature branch
- [ ] Run baseline tests (verify 1070 passing)
- [ ] Document current import paths

### During Implementation
- [ ] Rename folder
- [ ] Rename module files
- [ ] Rename test files
- [ ] Update all imports systematically
- [ ] Update class names
- [ ] Update instance variables
- [ ] Run tests after each phase
- [ ] Fix failing tests immediately

### Post-Implementation
- [ ] All tests passing (1070+)
- [ ] No console errors
- [ ] Documentation updated
- [ ] Manual testing complete
- [ ] PR created with clear description
- [ ] Changelog updated
- [ ] Migration notes written

---

**Last Updated:** November 14, 2025
**Status:** Ready for implementation alongside Schema 2.6
**Estimated Completion:** 1-2 days
