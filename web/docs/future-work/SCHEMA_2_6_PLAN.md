# Schema 2.6 Migration Plan

**Status:** Planned (premise re-verified Aug 2026: schema is still 2.5 everywhere; zero `activeRoutineId` adoption)
**Priority:** Medium
**Estimated Effort:** 2-3 days — **optimistic**: as of v2.412, `activeCycleId` appears in ~104 JS files (modules, tests, scripts). The rename itself is mechanical, but the review/verify pass across that blast radius makes 2-3 days a floor, not an estimate
**Breaking Changes:** Yes (requires migration)

---

## 🎯 Overview

Schema 2.6 will improve terminology consistency by renaming `cycles` → `routine` in the data structure, aligning the schema with how users and documentation refer to the core concept.

### The Problem

**Current Schema 2.5:**
```javascript
data: {
  cycles: {                    // ❌ Confusing: "cycles" is the storage key
    "Morning Routine": {       // ← But contains routines, not cycles
      cycleCount: 42           // ← "cycle" here means completions
    }
  }
},
appState: {
  activeCycleId: "Morning Routine"  // ❌ "CycleId" but refers to a routine
}
```

**Issues:**
- `cycles` as a storage key implies multiple completions, not multiple routines
- `activeCycleId` sounds like a completion ID, not a routine identifier
- Terminology conflicts with user mental model ("I have routines")
- Documentation says "create routines" but schema says "cycles"

---

## ✅ Proposed Schema 2.6

```javascript
const SCHEMA_2_6 = {
  schemaVersion: "2.6",

  miniCycle: {

    metadata: {
      createdAt: null,
      lastModified: null,
      migratedFrom: "2.5",           // ← Track migration source
      migrationDate: null,
      totalRoutinesCreated: 0,       // ← Renamed from totalCyclesCreated
      totalTasksCompleted: 0,
      schemaVersion: "2.6"
    },

    settings: {
      theme: null,
      darkMode: false,
      alwaysShowRecurring: false,
      autoSave: true,

      defaultRecurringSettings: {
        frequency: null,
        indefinitely: true,
        time: null
      },

      unlockedThemes: [],
      unlockedFeatures: [],

      notificationPosition: { x: 0, y: 0 },
      notificationPositionModified: false,

      accessibility: {
        reducedMotion: false,
        highContrast: false,
        screenReaderHints: false
      }
    },

    data: {
      routine: {                      // ✅ Changed from "cycles"
        "Default Routine": {          // ✅ Changed from "Default Cycle"
          title: "Default Routine",
          tasks: [],
          recurringTemplates: {},
          autoReset: true,
          deleteCheckedTasks: false,
          cycleCount: 0               // ← Keeps "cycleCount" (completion count)
        }
      }
    },

    appState: {
      activeRoutineId: "Default Routine"   // ✅ Changed from "activeCycleId"
    },

    userProgress: {
      cyclesCompleted: 0,             // ← Keeps "cycles" (completion tracking)
      rewardMilestones: []
    },

    customReminders: {
      enabled: false,
      indefinite: false,
      dueDatesReminders: false,
      repeatCount: 0,
      frequencyValue: 30,
      frequencyUnit: "minutes"
    }
  }
};
```

---

## 🔄 Migration Strategy

### Migration Function

**Location:** `modules/routine/routineLoader.js`

```javascript
/**
 * Migrate from Schema 2.5 to 2.6
 * Changes: cycles → routine, activeCycleId → activeRoutineId
 */
function migrateSchema_2_5_to_2_6(data) {
  console.log('[Migration] Starting 2.5 → 2.6 migration');

  // Create new schema structure
  const migrated = {
    schemaVersion: "2.6",
    miniCycle: {
      metadata: {
        ...data.miniCycle.metadata,
        migratedFrom: "2.5",
        migrationDate: new Date().toISOString(),
        schemaVersion: "2.6",
        // Rename totalCyclesCreated → totalRoutinesCreated
        totalRoutinesCreated: data.miniCycle.metadata.totalCyclesCreated || 0,
        totalTasksCompleted: data.miniCycle.metadata.totalTasksCompleted || 0
      },

      settings: { ...data.miniCycle.settings },

      data: {
        routine: data.miniCycle.data.cycles  // ✅ Rename: cycles → routine
      },

      appState: {
        // ✅ Rename: activeCycleId → activeRoutineId
        activeRoutineId: data.miniCycle.appState.activeCycleId
      },

      userProgress: { ...data.miniCycle.userProgress },
      customReminders: { ...data.miniCycle.customReminders }
    }
  };

  // Remove old field from metadata
  delete migrated.miniCycle.metadata.totalCyclesCreated;

  console.log('[Migration] 2.5 → 2.6 migration complete');
  return migrated;
}
```

### Backward Compatibility

**Handle .mcyc files from Schema 2.5:**
- Detect schema version on import
- Automatically migrate 2.5 → 2.6
- Show notification: "Updated file format to Schema 2.6"
- Preserve all data during migration

---

## 📝 Code Changes Required

### 1. Update Schema Detection

**File:** `modules/routine/routineLoader.js`

```javascript
// Current
if (data.schemaVersion === "2.5") {
  const activeCycle = data.miniCycle.data.cycles[data.miniCycle.appState.activeCycleId];
}

// New (with backward compatibility)
if (data.schemaVersion === "2.6") {
  const activeRoutine = data.miniCycle.data.routine[data.miniCycle.appState.activeRoutineId];
} else if (data.schemaVersion === "2.5") {
  // Auto-migrate
  data = migrateSchema_2_5_to_2_6(data);
  const activeRoutine = data.miniCycle.data.routine[data.miniCycle.appState.activeRoutineId];
}
```

### 2. Update Data Access Patterns

**Files to Update** (representative — the real surface is ~104 JS files that reference `activeCycleId` as of v2.412):
- `miniCycle-main.js` - Entrypoint
- `modules/routine/routineManager.js` - Routine creation/management
- `modules/routine/routineSwitcher.js` - Routine switching
- `modules/routine/routineLoader.js` - Data loading/saving
- `modules/task/taskCore.js` - Task operations
- `modules/features/statsPanel.js` - Statistics display

**Pattern Changes:**
```javascript
// OLD (2.5)
data.miniCycle.data.cycles[cycleId]
data.miniCycle.appState.activeCycleId

// NEW (2.6)
data.miniCycle.data.routine[routineId]
data.miniCycle.appState.activeRoutineId
```

### 3. Update Variable Names

**Rename throughout codebase:**
- `activeCycleId` → `activeRoutineId`
- `cycleId` → `routineId` (when referring to routine identifier)
- `cycles` → `routine` (when referring to data.cycles)

**Keep these names:**
- `cycleCount` (completion count)
- `cyclesCompleted` (total completions)
- "Complete Cycle" button text (user-facing)

---

## 🧪 Testing Requirements

### Unit Tests

**New test file:** `tests/schema-migration.tests.js`

```javascript
describe('Schema 2.5 → 2.6 Migration', () => {
  test('Migrates cycles to routine', () => {
    const schema25 = createSchema25WithCycles();
    const schema26 = migrateSchema_2_5_to_2_6(schema25);

    expect(schema26.miniCycle.data.routine).toBeDefined();
    expect(schema26.miniCycle.data.cycles).toBeUndefined();
  });

  test('Migrates activeCycleId to activeRoutineId', () => {
    const schema25 = createSchema25();
    const schema26 = migrateSchema_2_5_to_2_6(schema25);

    expect(schema26.miniCycle.appState.activeRoutineId).toBe("Morning Routine");
    expect(schema26.miniCycle.appState.activeCycleId).toBeUndefined();
  });

  test('Preserves all routine data during migration', () => {
    const schema25 = createSchema25WithTasks();
    const schema26 = migrateSchema_2_5_to_2_6(schema25);

    const routine = schema26.miniCycle.data.routine["Morning Routine"];
    expect(routine.tasks).toHaveLength(5);
    expect(routine.cycleCount).toBe(42);
  });

  test('Updates metadata correctly', () => {
    const schema25 = createSchema25();
    const schema26 = migrateSchema_2_5_to_2_6(schema25);

    expect(schema26.miniCycle.metadata.migratedFrom).toBe("2.5");
    expect(schema26.miniCycle.metadata.schemaVersion).toBe("2.6");
    expect(schema26.miniCycle.metadata.totalRoutinesCreated).toBeDefined();
  });
});
```

### Integration Tests

1. **Load Schema 2.5 data** → Verify auto-migration works
2. **Import .mcyc file (2.5)** → Verify backward compatibility
3. **Save data** → Verify new format saves correctly
4. **Switch routines** → Verify activeRoutineId updates
5. **Create new routine** → Verify uses new structure

### Manual Testing Checklist

- [ ] Load app with existing 2.5 data
- [ ] Verify routines appear correctly
- [ ] Switch between routines
- [ ] Complete tasks and verify cycle count increases
- [ ] Export .mcyc file and verify format
- [ ] Import old 2.5 .mcyc file
- [ ] Create new routine
- [ ] Test undo/redo with new schema
- [ ] Verify stats panel shows correct data

---

## 📚 Documentation Updates

### Files to Update

1. **SCHEMA_2_6.md** (new)
   - Complete 2.6 schema documentation
   - Migration guide from 2.5

2. **SCHEMA_2_5.md**
   - Add deprecation notice
   - Link to migration guide

3. **MCYC_FILE_FORMAT.md**
   - Document 2.6 format
   - Backward compatibility notes

4. **DEVELOPER_DOCUMENTATION.md**
   - Update schema references
   - Add migration examples

5. **CLAUDE.md**
   - Update data structure examples
   - Note schema version

6. **README.md**
   - Update to "Schema 2.6"
   - Migration announcement

---

## 🚀 Implementation Plan

### Phase 1: Preparation (Day 1)

**Morning:**
- [ ] Create feature branch: `schema-2.6-migration`
- [ ] Write migration function
- [ ] Write unit tests for migration
- [ ] Verify tests pass

**Afternoon:**
- [ ] Update `modules/routine/routineLoader.js` with migration logic
- [ ] Add schema detection for 2.6
- [ ] Test migration with sample data

### Phase 2: Code Updates (Day 2)

**Morning:**
- [ ] Update all `data.cycles` → `data.routine` references
- [ ] Update all `activeCycleId` → `activeRoutineId` references
- [ ] Update variable names throughout codebase
- [ ] Fix any TypeScript/JSDoc comments

**Afternoon:**
- [ ] Run all existing tests
- [ ] Fix any breaking tests
- [ ] Add new integration tests
- [ ] Verify the full current suite still passes — see [PROJECT_STATS.md](../PROJECT_STATS.md) for the live test count

### Phase 3: Documentation & Release (Day 3)

**Morning:**
- [ ] Create SCHEMA_2_6.md documentation
- [ ] Update all related docs
- [ ] Bump version via `./scripts/update-version.sh` (the only way app code ships)
- [ ] Create migration announcement

**Afternoon:**
- [ ] Manual testing on all platforms
- [ ] Test with real user data (backup first!)
- [ ] Final review of all changes
- [ ] Merge to main
- [ ] Deploy with migration

---

## ⚠️ Risks & Mitigation

### Risk 1: Data Loss During Migration
**Mitigation:**
- Automatic backup before migration
- Migration validation checks
- Rollback capability
- Comprehensive testing

### Risk 2: Breaking Existing Integrations
**Mitigation:**
- Support both 2.5 and 2.6 during transition
- Auto-migrate on load
- Document breaking changes
- Version detection in all file operations

### Risk 3: Performance Impact
**Mitigation:**
- Migration runs once per user
- Cache migrated data
- Optimize migration code
- Test with large datasets (100+ routines)

---

## 📊 Success Criteria

- [ ] All existing 2.5 data migrates successfully
- [ ] Zero data loss during migration
- [ ] The full current suite passing (see [PROJECT_STATS.md](../PROJECT_STATS.md))
- [ ] New tests for 2.6 added (10+ tests)
- [ ] Documentation complete and accurate
- [ ] Manual testing on Mac/iPad/iPhone
- [ ] Import/export works with both 2.5 and 2.6
- [ ] Performance unchanged or improved

---

## 🔮 Future Considerations

After Schema 2.6, consider:

1. **Schema 3.0** - Major refactor
   - Flatten nested structure?
   - Add routine categories/tags?
   - Multi-user support?

2. **Versioned APIs**
   - Abstract schema differences
   - Clean internal API

3. **Migration Tools**
   - Admin panel for schema info
   - Manual migration triggers
   - Schema validation tools

4. **Dev-build `validateTask()` enforcement** *(carried over from the archived HIGH_PRIORITY_NULL_DEFAULT_FIX.md postmortem)*
   - Route all task creation through `validateTask()` in dev builds, so field-default drift
     is caught at creation time rather than discovered downstream
   - Precedent: the `highPriority: null` bug (fixed v2.398) shipped because a creation path
     defaulted a field differently from the schema — creation-time validation would have
     flagged it immediately
   - Natural companion to a schema bump: whichever schema version is current, the validator
     enforces its field defaults where objects are born

---

## 📝 Notes

- This is a **terminology fix**, not a feature change
- User experience remains identical
- Improves code clarity for developers
- Sets foundation for future schema improvements
- Consider bundling with other Schema 2.6 changes if planned

---

**Last Updated:** August 2026 (file-name/count corrections + blast-radius note + validateTask subsection; plan premise unchanged since November 14, 2025)
**Author:** Schema Planning Document
**Status:** Ready for implementation when prioritized
