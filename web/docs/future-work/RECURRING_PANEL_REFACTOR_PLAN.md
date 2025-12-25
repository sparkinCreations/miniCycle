# Recurring Panel Refactor Plan

## Current State

**Main file:** `recurringPanel.js` (2,252 lines)

**Extracted sub-modules:**
| Module | Lines | Purpose |
|--------|-------|---------|
| `recurringPanelSummary.js` | 182 | Summary text generation |
| `recurringPanelGrids.js` | 102 | Day/month grid generation |
| `recurringPanelForm.js` | 325 | Form data reading/writing |
| `recurringPanelEvents.js` | 264 | Event delegation |

**Pattern used:** Versioned dynamic imports with callback injection
```javascript
const [module] = await Promise.all([
    import(`./recurringPanelModule.js?v=${version}`)
]);
```

---

## Remaining Extraction: Setup Methods (~500 lines)

### Target: `recurringPanelSetup.js`

**Methods to extract:**
- `setupFrequencySelector()` - Frequency dropdown change handler
- `setupToggleVisibility()` - Checkbox-to-panel visibility toggles
- `setupToggleCheckAll()` - Check/uncheck all button
- `setupAdvancedToggle()` - Advanced options visibility
- `setupTimeConversion()` - 12hr/24hr time format conversion
- `setupMilitaryTimeToggle()` - Per-frequency military time toggles
- `setupBiweeklyDayToggle()` - Biweekly day selection
- `setupSpecificDatesPanel()` - Specific dates UI (~100 lines)
- `setupDurationRadioButtons()` - Count vs until-date radio buttons
- `setupMonthlyMutualExclusion()` - Monthly options mutual exclusion
- `setupAdditionalListeners()` - Misc listeners
- `attachRecurringSummaryListeners()` - Summary update triggers

### Callback injection required:
```javascript
let _actions = {};

export function setSetupActions(actions) {
    _actions = actions;
}

// Usage in functions:
_actions.updateRecurringSummary?.();
_actions.generateYearlyDayGrid?.(month);
_actions.getTomorrow?.();
```

### Integration point:
```javascript
// In RecurringPanelManager.setup()
if (_setupModule?.setSetupActions) {
    _setupModule.setSetupActions({
        updateRecurringSummary: () => this.updateRecurringSummary(),
        generateYearlyDayGrid: (month) => this.generateYearlyDayGrid(month),
        getTomorrow: () => this.getTomorrow(),
        updateRecurCountVisibility: () => this.updateRecurCountVisibility()
    });
}
```

---

## Final Target Structure

```
modules/recurring/
├── recurringPanel.js           (~1,700 lines) - Coordinator
├── recurringPanelSummary.js    (182 lines)
├── recurringPanelGrids.js      (102 lines)
├── recurringPanelForm.js       (325 lines)
├── recurringPanelEvents.js     (264 lines)
└── recurringPanelSetup.js      (~500 lines) - NEW
```

---

## Execution Steps

1. Create `recurringPanelSetup.js` with callback injection pattern
2. Extract all `setup*` methods as standalone functions
3. Add `_setupModule` to `loadPanelSubModules()`
4. Wire `setSetupActions()` in `RecurringPanelManager.setup()`
5. Replace class methods with direct calls to loaded functions
6. Test all panel functionality

---

## Risk Notes

- `setupSpecificDatesPanel()` is ~100 lines with complex DOM manipulation
- Some setup methods call `this.getTomorrow()` which is now in form module
- Order matters: grids must be generated before event delegation attaches
