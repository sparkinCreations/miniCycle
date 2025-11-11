# .mcyc File Format Documentation

**Version:** 1.330
**Schema Version:** 2.5
**Last Updated:** January 2025

---

## Table of Contents

- [What is a .mcyc File?](#what-is-a-mcyc-file)
- [Creating .mcyc Files](#creating-mcyc-files)
  - [Method 1: Export from miniCycle (Recommended)](#method-1-export-from-minicycle-recommended)
  - [Method 2: Create Manually](#method-2-create-manually)
- [File Structure](#file-structure)
  - [Simple Format (Single Cycle)](#simple-format-single-cycle)
  - [Complete Format (Schema 2.5)](#complete-format-schema-25)
- [Schema Reference](#schema-reference)
  - [Task Object](#task-object)
  - [Cycle Object](#cycle-object)
  - [Settings Object](#settings-object)
  - [Recurring Settings](#recurring-settings)
- [Examples](#examples)
- [Import/Export](#importexport)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## What is a .mcyc File?

A `.mcyc` (miniCycle) file is a **JSON-formatted file** that stores miniCycle routines. These files can be:

- **Shared** between users
- **Backed up** for safekeeping
- **Imported** into miniCycle for instant routine setup
- **Created manually** for custom workflows

**File Extension:** `.mcyc`
**MIME Type:** `application/json`
**Character Encoding:** UTF-8

---

## Creating .mcyc Files

### Method 1: Export from miniCycle (Recommended)

The easiest way to create a `.mcyc` file is to export an existing cycle:

1. **Open miniCycle** in your browser
2. **Create your cycle** and add tasks
3. **Open Settings** (gear icon)
4. **Click "Export miniCycle"**
5. **File downloads** as `Cycle_Name.mcyc`

**Advantages:**
- ✅ Automatically generates valid structure
- ✅ Includes all settings and metadata
- ✅ Handles IDs and timestamps automatically
- ✅ No manual JSON editing required

---

### Method 2: Create Manually

For developers or advanced users, you can create `.mcyc` files manually:

#### **Quick Start (Minimal File):**

```json
{
  "name": "my_routine",
  "title": "My Daily Routine",
  "tasks": [
    {
      "id": "t1",
      "text": "First task",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t2",
      "text": "Second task",
      "completed": false,
      "schemaVersion": 2
    }
  ],
  "autoReset": true,
  "cycleCount": 0,
  "deleteCheckedTasks": false
}
```

**Save as:** `My_Daily_Routine.mcyc`

---

## File Structure

miniCycle supports two file formats:

### Simple Format (Single Cycle)

Used for individual cycle exports. Lightweight and easy to edit.

```json
{
  "name": "cycle_identifier",
  "title": "Display Name",
  "tasks": [ /* array of task objects */ ],
  "autoReset": true,
  "cycleCount": 0,
  "deleteCheckedTasks": false
}
```

**Top-Level Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for the cycle |
| `title` | string | Yes | Display name shown in UI |
| `tasks` | array | Yes | Array of task objects |
| `autoReset` | boolean | No | Auto-reset when all tasks complete (default: `true`) |
| `cycleCount` | number | No | Number of times cycle completed (default: `0`) |
| `deleteCheckedTasks` | boolean | No | To-Do mode: delete completed tasks (default: `false`) |

---

### Complete Format (Schema 2.5)

Full application state export. Includes settings, metadata, and multiple cycles.

```json
{
  "schemaVersion": "2.5",
  "metadata": { /* app metadata */ },
  "settings": { /* app settings */ },
  "data": {
    "cycles": {
      "cycle_id": { /* cycle object */ }
    }
  },
  "appState": { /* active cycle, mode */ },
  "userProgress": { /* achievements */ },
  "customReminders": { /* reminder settings */ }
}
```

**Use Cases:**
- Full app backup
- Migrating between devices
- Sharing complete configurations
- Testing/development

---

## Schema Reference

### Task Object

Every task in the `tasks` array uses this structure:

```json
{
  "id": "t1",
  "text": "Task description",
  "completed": false,
  "schemaVersion": 2,
  "dueDate": null,
  "highPriority": false,
  "remindersEnabled": false,
  "recurring": false,
  "recurringSettings": {}
}
```

**Properties:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `id` | string | **Yes** | - | Unique task ID (e.g., `"t1"`, `"t2"`) |
| `text` | string | **Yes** | - | Task description (emojis supported 🎯) |
| `completed` | boolean | **Yes** | `false` | Completion status |
| `schemaVersion` | number | **Yes** | `2` | Task schema version |
| `dueDate` | string\|null | No | `null` | ISO 8601 date string |
| `highPriority` | boolean | No | `false` | Priority flag |
| `remindersEnabled` | boolean | No | `false` | Enable reminders for this task |
| `recurring` | boolean | No | `false` | Is this a recurring task? |
| `recurringSettings` | object | No | `{}` | Recurring configuration (see below) |

---

### Cycle Object

When using the complete format, each cycle is stored in `data.cycles`:

```json
{
  "id": "cycle_1234567890",
  "title": "Morning Routine",
  "tasks": [ /* array of tasks */ ],
  "autoReset": true,
  "deleteCheckedTasks": false,
  "cycleCount": 0,
  "createdAt": 1234567890,
  "recurringTemplates": {}
}
```

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | **Yes** | Unique cycle ID (matches key in `cycles` object) |
| `title` | string | **Yes** | Display name |
| `tasks` | array | **Yes** | Array of task objects |
| `autoReset` | boolean | No | Auto-reset behavior |
| `deleteCheckedTasks` | boolean | No | To-Do mode behavior |
| `cycleCount` | number | No | Times completed |
| `createdAt` | number | No | Unix timestamp (milliseconds) |
| `recurringTemplates` | object | No | Recurring task templates |

---

### Settings Object

Application-wide settings (Complete format only):

```json
{
  "theme": null,
  "darkMode": false,
  "alwaysShowRecurring": false,
  "autoSave": true,
  "defaultRecurringSettings": {
    "frequency": null,
    "indefinitely": true,
    "time": null
  },
  "unlockedThemes": [],
  "unlockedFeatures": [],
  "notificationPosition": { "x": 0, "y": 0 },
  "notificationPositionModified": false,
  "accessibility": {
    "reducedMotion": false,
    "highContrast": false,
    "screenReaderHints": false
  }
}
```

---

### Recurring Settings

For tasks with `recurring: true` (Schema 2.5+ structure):

```json
{
  "frequency": "daily",
  "indefinitely": true,
  "count": null,
  "time": {
    "hour": 9,
    "minute": 0,
    "meridiem": "AM",
    "military": false
  },
  "specificDates": {
    "enabled": false,
    "dates": []
  },
  "hourly": {
    "useSpecificMinute": false,
    "minute": 0
  },
  "weekly": {
    "days": ["Mon", "Wed", "Fri"]
  },
  "biweekly": {
    "week1": ["Mon", "Wed"],
    "week2": ["Tue", "Thu"],
    "referenceDate": "2025-01-06T00:00:00.000Z"
  },
  "monthly": {
    "days": [1, 15]
  },
  "yearly": {
    "months": [1, 6, 12],
    "useSpecificDays": true,
    "daysByMonth": {
      "1": [1, 15],
      "6": [1],
      "12": [25]
    },
    "applyDaysToAll": false
  }
}
```

**Core Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `frequency` | string | Yes | `"hourly"`, `"daily"`, `"weekly"`, `"biweekly"`, `"monthly"`, `"yearly"` |
| `indefinitely` | boolean | Yes | `true` to recur forever, `false` to use count |
| `count` | number\|null | No | Number of times to recur (if not indefinite) |
| `time` | object\|null | No | Specific time of day (see Time Object below) |

**Time Object (optional):**

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `hour` | number | 1-12 | Hour in 12-hour format (or 0-23 if military) |
| `minute` | number | 0-59 | Minute |
| `meridiem` | string | `"AM"`/`"PM"` | AM/PM (ignored if military=true) |
| `military` | boolean | `true`/`false` | Use 24-hour format |

**Frequency-Specific Settings:**

**Hourly:**
```json
"hourly": {
  "useSpecificMinute": true,
  "minute": 30
}
```

**Weekly:**
```json
"weekly": {
  "days": ["Mon", "Wed", "Fri"]
}
```
- `days`: Array of day abbreviations (`"Sun"`, `"Mon"`, `"Tue"`, `"Wed"`, `"Thu"`, `"Fri"`, `"Sat"`)

**Biweekly (v1.348+):**
```json
"biweekly": {
  "week1": ["Mon", "Wed"],
  "week2": ["Tue", "Thu"],
  "referenceDate": "2025-01-06T00:00:00.000Z"
}
```
- `week1`: Days for even weeks (0, 2, 4, ...)
- `week2`: Days for odd weeks (1, 3, 5, ...)
- `referenceDate`: ISO 8601 timestamp for week 0 starting point
- **New in v1.348:** Separate day selections for each week in two-week cycle
- Uses DST-safe date calculation

**Monthly:**
```json
"monthly": {
  "days": [1, 15, 30]
}
```
- `days`: Array of day numbers (1-31)

**Yearly:**
```json
"yearly": {
  "months": [1, 6, 12],
  "useSpecificDays": true,
  "daysByMonth": {
    "1": [1, 15],
    "6": [1],
    "12": [25]
  },
  "applyDaysToAll": false
}
```
- `months`: Array of month numbers (1-12)
- `useSpecificDays`: Whether to use specific days
- `daysByMonth`: Object mapping month number to array of days
- `applyDaysToAll`: If true, uses `daysByMonth.all` for all months

---

## Examples

### Example 1: Simple Morning Routine

```json
{
  "name": "morning_routine",
  "title": "🌅 Morning Routine",
  "tasks": [
    {
      "id": "t1",
      "text": "🛏️ Make bed",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t2",
      "text": "🪥 Brush teeth",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t3",
      "text": "☕ Coffee & breakfast",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t4",
      "text": "📧 Check emails",
      "completed": false,
      "schemaVersion": 2
    }
  ],
  "autoReset": true,
  "cycleCount": 0,
  "deleteCheckedTasks": false
}
```

**Filename:** `Morning_Routine.mcyc`

---

### Example 2: Workout Routine with Recurring Tasks

```json
{
  "name": "workout_routine",
  "title": "💪 Weekly Workout",
  "tasks": [
    {
      "id": "t1",
      "text": "🏃 Cardio - 30 minutes",
      "completed": false,
      "schemaVersion": 2,
      "recurring": true,
      "recurringSettings": {
        "frequency": "weekly",
        "indefinitely": true,
        "count": null,
        "time": {
          "hour": 7,
          "minute": 0,
          "meridiem": "AM",
          "military": false
        },
        "weekly": {
          "days": ["Mon", "Wed", "Fri"]
        }
      }
    },
    {
      "id": "t2",
      "text": "🏋️ Strength training",
      "completed": false,
      "schemaVersion": 2,
      "recurring": true,
      "recurringSettings": {
        "frequency": "biweekly",
        "indefinitely": true,
        "count": null,
        "time": {
          "hour": 7,
          "minute": 0,
          "meridiem": "AM",
          "military": false
        },
        "biweekly": {
          "week1": ["Mon", "Wed", "Fri"],
          "week2": ["Tue", "Thu"],
          "referenceDate": "2025-01-06T00:00:00.000Z"
        }
      }
    },
    {
      "id": "t3",
      "text": "🧘 Stretching & cooldown",
      "completed": false,
      "schemaVersion": 2
    }
  ],
  "autoReset": false,
  "cycleCount": 0,
  "deleteCheckedTasks": false
}
```

**Filename:** `Weekly_Workout.mcyc`

---

### Example 3: Project Checklist (To-Do Mode)

```json
{
  "name": "project_launch",
  "title": "🚀 Product Launch Checklist",
  "tasks": [
    {
      "id": "t1",
      "text": "✅ Finalize feature set",
      "completed": false,
      "schemaVersion": 2,
      "highPriority": true
    },
    {
      "id": "t2",
      "text": "🧪 Complete QA testing",
      "completed": false,
      "schemaVersion": 2,
      "dueDate": "2025-02-01T17:00:00Z"
    },
    {
      "id": "t3",
      "text": "📝 Write documentation",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t4",
      "text": "🎉 Launch announcement",
      "completed": false,
      "schemaVersion": 2,
      "highPriority": true,
      "dueDate": "2025-02-15T12:00:00Z"
    }
  ],
  "autoReset": false,
  "cycleCount": 0,
  "deleteCheckedTasks": true
}
```

**Filename:** `Product_Launch_Checklist.mcyc`

**Note:** `deleteCheckedTasks: true` enables To-Do mode where completed tasks are deleted.

---

### Example 4: Recipe (Step-by-Step)

```json
{
  "name": "pancake_recipe",
  "title": "🥞 Fluffy Pancakes Recipe",
  "tasks": [
    {
      "id": "t1",
      "text": "Mix 2 cups flour, 2 tbsp sugar, 2 tsp baking powder, 1 tsp salt",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t2",
      "text": "Whisk 2 eggs, 1.5 cups milk, 4 tbsp melted butter",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t3",
      "text": "Combine wet and dry ingredients (don't overmix!)",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t4",
      "text": "Heat griddle to medium heat, lightly oil",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t5",
      "text": "Pour 1/4 cup batter per pancake",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t6",
      "text": "Flip when bubbles form (2-3 minutes)",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t7",
      "text": "Cook until golden brown on both sides",
      "completed": false,
      "schemaVersion": 2
    },
    {
      "id": "t8",
      "text": "🍯 Serve with butter and maple syrup!",
      "completed": false,
      "schemaVersion": 2
    }
  ],
  "autoReset": true,
  "cycleCount": 0,
  "deleteCheckedTasks": false
}
```

**Filename:** `Fluffy_Pancakes_Recipe.mcyc`

---

## Import/Export

### Exporting from miniCycle

1. **Open Settings** (⚙️ icon)
2. **Click "Export miniCycle"**
3. **File downloads** as `Cycle_Name.mcyc`
4. **Location:** Your browser's download folder

### Importing into miniCycle

**Method 1: Import Button**
1. **Open Settings** (⚙️ icon)
2. **Click "Import miniCycle"**
3. **Select `.mcyc` file**
4. **Cycle loads automatically**

**Method 2: Onboarding**
1. **First launch** or after clearing data
2. **Choose "Import existing cycle"**
3. **Select `.mcyc` file**
4. **Start using immediately**

**Method 3: Drag & Drop** (if supported)
1. **Drag `.mcyc` file** into miniCycle window
2. **Confirm import**
3. **Cycle loads**

---

## Best Practices

### File Naming

✅ **Good:**
```
Morning_Routine.mcyc
Weekly_Workout_Plan.mcyc
Grocery_Shopping_List.mcyc
```

❌ **Avoid:**
```
my file.mcyc              // Spaces cause issues
new.mcyc                  // Not descriptive
cycle@2024!.mcyc          // Special characters
```

**Pattern:** `{Descriptive_Name}.mcyc`

---

### Task IDs

✅ **Good:**
```json
"id": "t1"
"id": "t2"
"id": "task-morning-1"
```

❌ **Avoid:**
```json
"id": "1"           // Too generic
"id": ""            // Empty
// Missing id        // Required field
```

**Rules:**
- Must be unique within the cycle
- String type (not number)
- Sequential or descriptive

---

### Text Content

✅ **Use emojis** for visual appeal:
```json
"text": "🏃 Go for a run"
"text": "📧 Check emails"
"text": "🥗 Prepare healthy lunch"
```

✅ **Be descriptive:**
```json
"text": "Review quarterly goals and update OKRs"
```

❌ **Too vague:**
```json
"text": "Do stuff"
"text": "Work"
```

---

### Mode Selection

Choose the right mode for your use case:

**Auto-Reset Mode** (`autoReset: true`):
- Daily routines
- Repeatable processes
- Habits and rituals
```json
"autoReset": true,
"deleteCheckedTasks": false
```

**Manual Cycle Mode** (`autoReset: false`):
- Workflows you control
- Multi-step projects
- Flexible routines
```json
"autoReset": false,
"deleteCheckedTasks": false
```

**To-Do Mode** (`deleteCheckedTasks: true`):
- One-time checklists
- Project tasks
- Shopping lists
```json
"autoReset": false,
"deleteCheckedTasks": true
```

---

### Validation

Before sharing `.mcyc` files, validate them:

**Online JSON Validators:**
- https://jsonlint.com/
- https://jsonformatter.curiousconcept.com/

**Command Line:**
```bash
# Using Python
python3 -m json.tool Morning_Routine.mcyc

# Using Node.js
node -e "console.log(JSON.parse(require('fs').readFileSync('Morning_Routine.mcyc')))"
```

**In miniCycle:**
- Import the file
- Check for error notifications
- Verify tasks appear correctly

---

## Troubleshooting

### Common Issues

**1. "Invalid file format" error**

**Cause:** Malformed JSON
**Fix:** Validate JSON syntax
```bash
python3 -m json.tool your_file.mcyc
```

---

**2. "Missing required fields" error**

**Cause:** Missing `id`, `text`, or `schemaVersion`
**Fix:** Ensure every task has:
```json
{
  "id": "t1",
  "text": "Task description",
  "schemaVersion": 2
}
```

---

**3. Tasks don't appear after import**

**Cause:** Empty `tasks` array
**Fix:** Ensure tasks array is not empty:
```json
"tasks": [
  {
    "id": "t1",
    "text": "At least one task",
    "completed": false,
    "schemaVersion": 2
  }
]
```

---

**4. Recurring tasks don't work**

**Cause:** Invalid `recurringSettings`
**Fix:** Use valid frequency and proper format:
```json
"recurring": true,
"recurringSettings": {
  "frequency": "daily",
  "indefinitely": true,
  "time": "09:00"
}
```

Valid frequencies: `"daily"`, `"weekly"`, `"monthly"`

---

**5. File won't download**

**Cause:** Browser blocking download
**Fix:**
- Check browser's download permissions
- Disable popup blocker for miniCycle
- Try a different browser

---

**6. Special characters display incorrectly**

**Cause:** Wrong file encoding
**Fix:** Save file as **UTF-8** encoding
```bash
# Convert to UTF-8 (Mac/Linux)
iconv -f ISO-8859-1 -t UTF-8 input.mcyc > output.mcyc
```

---

## Advanced: Creating .mcyc Files Programmatically

### Node.js Script

```javascript
const fs = require('fs');

function createMcycFile(cycleName, tasks, options = {}) {
  const timestamp = Date.now();
  const cycleId = `cycle_${timestamp}`;

  const mcycData = {
    name: cycleId,
    title: cycleName,
    tasks: tasks.map((text, index) => ({
      id: `t${index + 1}`,
      text: text,
      completed: false,
      schemaVersion: 2,
      dueDate: options.dueDates?.[index] || null,
      highPriority: options.priorities?.[index] || false
    })),
    autoReset: options.autoReset !== false,
    cycleCount: 0,
    deleteCheckedTasks: options.deleteCheckedTasks || false
  };

  const filename = `${cycleName.replace(/[^a-z0-9]/gi, '_')}.mcyc`;
  fs.writeFileSync(filename, JSON.stringify(mcycData, null, 2), 'utf8');
  console.log(`✅ Created: ${filename}`);
  return filename;
}

// Example usage:
createMcycFile('Morning Routine', [
  '🌅 Wake up at 6 AM',
  '🪥 Brush teeth',
  '🏃 Morning jog - 20 min',
  '🥣 Healthy breakfast',
  '📧 Check emails',
  '📝 Plan the day'
], {
  autoReset: true,
  priorities: [false, false, true, false, false, true]
});
```

**Run:**
```bash
node create-mcyc.js
```

---

### Python Script

```python
import json
import time

def create_mcyc_file(cycle_name, tasks, auto_reset=True, delete_checked=False):
    timestamp = int(time.time() * 1000)
    cycle_id = f"cycle_{timestamp}"

    mcyc_data = {
        "name": cycle_id,
        "title": cycle_name,
        "tasks": [
            {
                "id": f"t{i+1}",
                "text": task,
                "completed": False,
                "schemaVersion": 2
            }
            for i, task in enumerate(tasks)
        ],
        "autoReset": auto_reset,
        "cycleCount": 0,
        "deleteCheckedTasks": delete_checked
    }

    filename = f"{cycle_name.replace(' ', '_')}.mcyc"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(mcyc_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Created: {filename}")
    return filename

# Example usage:
create_mcyc_file('Evening Routine', [
    '🍽️ Prepare dinner',
    '📺 Relax time',
    '📚 Read for 30 minutes',
    '🛁 Evening shower',
    '🌙 Bedtime routine'
])
```

**Run:**
```bash
python3 create_mcyc.py
```

---

## Schema Version History

| Version | Date | Changes |
|---------|------|---------|
| **2.5** | Jan 2025 | Current stable version |
| **2.0** | Oct 2024 | Added recurring tasks, settings |
| **1.0** | 2023 | Initial schema |

**Backward Compatibility:** miniCycle automatically migrates older schemas to 2.5.

---

## File Size Limits

**Recommended:**
- Tasks per cycle: < 100
- File size: < 1 MB
- Cycles in complete export: < 50

**Technical Limits:**
- localStorage: ~5-10 MB per origin
- JSON nesting: Avoid deep nesting (< 5 levels)

---

## Security & Privacy

**Safe:**
- ✅ `.mcyc` files contain only task data
- ✅ No personal information required
- ✅ No network requests
- ✅ Stored locally in browser

**Sharing:**
- ⚠️ Review content before sharing
- ⚠️ Remove sensitive information
- ⚠️ Use descriptive but generic names

---

## Resources

**Sample Files:**
- `/data/*.mcyc` - Example routines
- `/data/example-routine-schema25.mcyc` - Schema 2.5 reference

**Documentation:**
- `WHAT_IS_MINICYCLE.md` - App overview
- `QUICK_REFERENCE.md` - Feature guide
- `DEVELOPER_DOCUMENTATION.md` - Technical details

**Support:**
- GitHub: https://github.com/anthropics/claude-code/issues
- In-app: Settings → Diagnostics & Testing

---

## Version

**Document Version:** 1.0
**Schema Version:** 2.5
**miniCycle Version:** 1.330

**Last Updated:** January 2025

---

**Happy task cycling! 🎯**
