# miniCycle Schema 2.5 Documentation

## Overview

Schema 2.5 represents the current data structure for miniCycle, consolidating all application state, user data, settings, and metadata into a single unified format. This schema supports multiple cycles, recurring tasks, theme unlocks, and comprehensive user progress tracking.

## Schema Version

**Current Version**: `2.5`

## Complete Schema Structure

```javascript
const SCHEMA_2_5_CURRENT = {
  schemaVersion: "2.5",

  miniCycle: {

    metadata: {
      createdAt: null,
      lastModified: null,
      migratedFrom: null,
      migrationDate: null,
      totalCyclesCreated: 0,
      totalTasksCompleted: 0,
      schemaVersion: "2.5"
    },

    settings: {
      theme: null,                    // Current: unlocked themes
      darkMode: false,                // Current: dark mode toggle
      alwaysShowRecurring: false,     // Current: always show recurring setting
      autoSave: true,

      defaultRecurringSettings: {     // Current: recurring task defaults
        frequency: null,
        indefinitely: true,
        time: null
      },

      unlockedThemes: [],            // Current: milestone theme unlocks
      unlockedFeatures: [],          // Current: milestone feature unlocks

      notificationPosition: { x: 0, y: 0 },  // Current: draggable notifications
      notificationPositionModified: false,

      accessibility: {
        reducedMotion: false,        // Future-ready for accessibility
        highContrast: false,
        screenReaderHints: false
      }
    },

    data: {
      cycles: {
        // Current miniCycleStorage structure
        "Default Cycle": {
          title: "Default Cycle",
          tasks: [],
          recurringTemplates: {},
          autoReset: true,
          deleteCheckedTasks: false,
          cycleCount: 0
        }
      }
    },

    appState: {
      activeCycleId: "Default Cycle"   // Current: lastUsedMiniCycle
    },

    userProgress: {
      cyclesCompleted: 0,             // Current: cycle completion tracking
      rewardMilestones: []            // Current: milestone rewards system
    },

    // Current reminder system
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

## Key Sections

### Metadata

Tracks application-level information and migration history:

- **createdAt**: Initial data creation timestamp
- **lastModified**: Last update timestamp
- **migratedFrom**: Previous schema version (if migrated)
- **migrationDate**: When migration occurred
- **totalCyclesCreated**: Lifetime cycle creation count
- **totalTasksCompleted**: Lifetime task completion count
- **schemaVersion**: Current schema version identifier

### Settings

#### Theme & Display
- **theme**: Currently selected theme name
- **darkMode**: Dark mode enabled/disabled
- **unlockedThemes**: Array of themes unlocked through milestones

#### Recurring Task Defaults
- **defaultRecurringSettings**: Default values for new recurring tasks
  - `frequency`: Daily, weekly, monthly, yearly
  - `indefinitely`: Whether to repeat forever
  - `time`: Default time of day for recurring tasks

#### Notifications
- **notificationPosition**: User-draggable notification position (x, y coordinates)
- **notificationPositionModified**: Whether user has customized position

#### Accessibility (Future-Ready)
- **reducedMotion**: Respect user motion preferences
- **highContrast**: High contrast mode
- **screenReaderHints**: Enhanced screen reader support

### Data

#### Cycles Structure

Each cycle contains:
- **title**: Display name of the cycle
- **tasks**: Array of task objects
- **recurringTemplates**: Recurring task definitions
- **autoReset**: Auto Cycle Mode (true) or Manual Cycle Mode (false)
- **deleteCheckedTasks**: To-Do Mode (true) or Cycle Mode (false)
- **cycleCount**: Number of times cycle has been completed

### App State

Tracks current application state:
- **activeCycleId**: Currently selected cycle (maps to `lastUsedMiniCycle`)

### User Progress

Gamification and achievement tracking:
- **cyclesCompleted**: Total cycles completed across all cycles
- **rewardMilestones**: Array of unlocked milestone rewards

### Custom Reminders

User-configurable reminder system:
- **enabled**: Reminders on/off
- **indefinite**: Repeat reminders forever
- **dueDatesReminders**: Remind about task due dates
- **repeatCount**: Number of times to repeat reminders
- **frequencyValue**: Numeric interval value
- **frequencyUnit**: Time unit (minutes, hours, days)

## Migration Support

Schema 2.5 includes built-in migration tracking:

```javascript
metadata: {
  migratedFrom: "2.0",           // Previous schema version
  migrationDate: "2024-10-15",   // When migration occurred
  schemaVersion: "2.5"           // Current version
}
```

## Usage Example

```javascript
// Loading data
const data = JSON.parse(localStorage.getItem('miniCycleData'));
if (data.schemaVersion === "2.5") {
  const activeCycle = data.miniCycle.data.cycles[data.miniCycle.appState.activeCycleId];
  const isDarkMode = data.miniCycle.settings.darkMode;
}

// Saving data
localStorage.setItem('miniCycleData', JSON.stringify(schema));
```

## File Format Compatibility

This schema structure is also used in `.mcyc` file exports/imports, ensuring consistent data representation across:
- localStorage persistence
- File exports
- File imports
- Data migrations

## Related Documentation

- [MCYC_FILE_FORMAT.md](./MCYC_FILE_FORMAT.md) - File import/export format
- [DEVELOPER_DOCUMENTATION.md](./DEVELOPER_DOCUMENTATION.md) - Architecture overview
- [minicycle-recurring-guide.md](./minicycle-recurring-guide.md) - Recurring task implementation
