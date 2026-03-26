# Storage Management

miniCycle uses localStorage for data persistence, which provides reliable offline-first storage with a typical quota of 5-10MB. This document explains how miniCycle manages storage constraints while giving users maximum flexibility.

## Design Philosophy

**User agency over arbitrary limits.**

Rather than imposing hard limits like "you can only have 5 routines," miniCycle:

1. Shows users their storage usage (storage bar)
2. Shows individual routine sizes (routine list)
3. Provides tools to manage their own space (.mcyc export/import)
4. Only blocks actions when absolutely necessary (quota exceeded)

This approach respects that different users have different needs. A routine with 3 tasks shouldn't count the same as one with 150.

## Storage Constraints

### localStorage vs IndexedDB

| Feature | localStorage | IndexedDB |
|---------|--------------|-----------|
| Quota | 5-10MB | 100MB+ |
| API | Simple, synchronous | Complex, async |
| Browser support | Universal | Good, some quirks |
| Use case | Small-medium data | Large/structured data |

miniCycle chose localStorage for its simplicity and reliability. The constraints are managed through smart limits and user tools rather than migrating to a more complex storage system.

### IndexedDB Usage

While localStorage handles most app data, IndexedDB is used for larger data that exceeds localStorage limits:

| Database | Purpose | Max Size | Module |
|----------|---------|----------|--------|
| `miniCycleBackgroundDB` | Custom background images | 2MB per image | `ui/preferencesManager.js` |
| `miniCycleUndoHistory` | Undo/redo state snapshots | Configurable | `ui/undoRedoManager.js` |
| `miniCycleTestResultsDB` | Test results storage | - | `testing/testing-modal-integration.js` |

**Background Image Storage:**
- Images are stored as data URLs in IndexedDB
- Single object store: `backgroundImage`
- Schema: `{ id: 'background', dataUrl: string, mode: string, updatedAt: number }`
- Uploading a new image replaces the existing one
- Display modes: `cover`, `center`, `tile`

### Task Limit: 150 per Routine

Each routine is limited to **150 tasks**. This limit:

- Keeps individual routines well within storage bounds
- Ensures UI performance remains snappy
- Encourages users to organize tasks into logical routines
- Leaves ample headroom even with multiple routines

**What happens at the limit:**

| Action | Behavior |
|--------|----------|
| Manual task creation | Blocked with notification |
| Recurring task spawn | Skipped (template preserved for next cycle) |
| Importing .mcyc file | Tasks truncated to 150, user notified |

### Storage Buffer: 0.25MB

miniCycle reserves 0.25MB (256KB) as a safety buffer. This:

- Prevents edge-case failures during save operations
- Accounts for browser overhead and metadata
- Ensures the app never hits the absolute limit

The storage bar shows available space *after* this buffer is applied.

## User-Facing Features

### Storage Bar

Located in the "Switch miniCycle" modal, the storage bar shows:

- Current usage in MB
- Available space in MB
- Color-coded status indicator

**Status Thresholds:**

| Usage | Status | Color | Notification |
|-------|--------|-------|--------------|
| 0-49% | Normal | Green | None |
| 50-74% | Caution | Yellow | None |
| 75-89% | Warning | Orange | One-time toast |
| 90%+ | Critical | Red | None (bar is visible) |

**One-time 75% Warning:** When storage first exceeds 75%, a toast notification appears: *"Storage is getting tight. Export old routines to free up space."* This only shows once per session to avoid notification fatigue.

### Routine Sizes

Each routine in the switch modal displays its estimated size (e.g., "~45.2 KB"). The "~" prefix indicates these are estimates based on JSON serialization. This helps users identify which routines are consuming the most space.

### Help Window

The help window (?) shows the current routine's size alongside task count and cycle count, updating dynamically as data changes.

## Quota Enforcement

Storage quota is checked at all data entry points:

### 1. Task Creation (`taskCRUD.js`)

Before adding a new task:
```javascript
const estimatedSize = estimateTaskSize(taskText);
const storageCheck = canAddToStorage(estimatedSize);
if (!storageCheck.allowed) {
    showNotification(getStorageShortageMessage(storageCheck.shortfall), 'error');
    return;
}
```

### 2. Routine Creation (`routineManager.js`)

Before creating a new routine:
```javascript
const storageCheck = canAddToStorage(ESTIMATED_NEW_CYCLE_SIZE);
if (!storageCheck.allowed) {
    showNotification(getStorageShortageMessage(storageCheck.shortfall), 'error');
    return;
}
```

### 3. Routine Duplication (`menuManager.js`)

Before duplicating a routine:
```javascript
const cycleSize = getObjectSizeBytes(currentCycle);
const storageCheck = canAddToStorage(cycleSize);
if (!storageCheck.allowed) {
    showNotification(getStorageShortageMessage(storageCheck.shortfall), 'error');
    return;
}
```

### 4. Routine Import (`cycleImportManager.js`)

Before importing a .mcyc file:
```javascript
const estimatedSize = getObjectSizeBytes(importedData);
const storageCheck = canAddToStorage(estimatedSize);
if (!storageCheck.allowed) {
    showNotification(getStorageShortageMessage(storageCheck.shortfall), 'error');
    return;
}
```

### Error Messages

When quota is exceeded, users see a helpful message:

> "Not enough storage space. Need 45.2 KB more. Delete some tasks or routines to free up space."

## Managing Storage with .mcyc Files

The .mcyc export/import feature serves dual purposes:

1. **Backup & Sharing** - Save routines for backup or share with others
2. **Storage Management** - Archive routines you're not actively using

**Workflow for freeing space:**

1. Open "Switch miniCycle" modal
2. Note which routines are largest (size displayed on right)
3. Select a routine you want to archive
4. Export it as .mcyc file (saves to your device)
5. Delete it from miniCycle
6. Re-import whenever you need it again

This gives users complete control over their storage tradeoffs without artificial routine limits.

## Technical Implementation

### Storage Utilities (`storageUtils.js`)

Core functions for storage management:

| Function | Purpose |
|----------|---------|
| `getLocalStorageUsedBytes()` | Calculate total bytes used |
| `getLocalStorageQuota()` | Return cached quota or 5MB default |
| `detectStorageQuota()` | Detect actual quota (called on-demand) |
| `getStorageInfo()` | Get usage, available, percentage, status |
| `formatBytes()` | Human-readable size (e.g., "2.5 MB") |
| `getObjectSizeBytes()` | Calculate object size when stringified |
| `canAddToStorage()` | Check if additional bytes would fit |
| `estimateTaskSize()` | Estimate bytes for a new task |
| `getStorageShortageMessage()` | User-friendly shortage message |
| `checkStorageWarning()` | Show one-time 75% warning toast |
| `updateStorageBarUI()` | Update storage bar with lazy detection |

### Size Calculations

localStorage stores strings in UTF-16, so each character uses 2 bytes:

```javascript
const jsonString = JSON.stringify(obj);
const sizeBytes = jsonString.length * 2;
```

Task size estimation includes base overhead for metadata:

```javascript
const baseOverhead = 400; // ~200 chars for id, dates, settings
const textBytes = taskText.length * 2;
return baseOverhead + textBytes;
```

### Quota Detection

Browser quotas vary (typically 5-10MB). miniCycle uses **lazy quota detection** to avoid blocking app boot:

**How it works:**

1. On boot, miniCycle uses a conservative 5MB default
2. When the user opens the "Switch miniCycle" modal, actual quota detection runs
3. The detected quota is cached for the rest of the session

```javascript
// detectStorageQuota() - called when storage bar is shown
while (testSize < maxTest) {
    testSize += 100; // 100KB increments
    localStorage.setItem(testKey, testChunk.repeat(testSize));
}
// testSize now indicates approximate quota
```

**Important notes about quota detection:**

- **Lazy loading** - Detection only runs when the storage modal is opened, not on boot
- **Cached result** - Once detected, the result is cached to avoid repeated expensive operations
- **Test key cleanup** - The test key (`__storage_quota_test__`) is always removed after detection, even if an error occurs
- **Private browsing** - Safari and other browsers may have reduced quotas (sometimes as low as 0) in private/incognito mode
- **Safari quirks** - Safari's localStorage can behave differently, especially regarding quota limits and error handling
- **Detection cost** - The detection involves writing progressively larger values, which takes ~100-500ms when triggered

If quota detection fails for any reason, miniCycle falls back to a conservative 5MB default.

## Constants

Defined in `core/constants.js`:

```javascript
LIMITS: {
    TASKS_PER_CYCLE: 150,        // Max tasks per routine
    TASK_CHARACTER: 500,         // Max characters per task
    CYCLE_NAME_CHARACTER: 100,   // Max characters for routine name
}
```

## Backup Reminder System

Since miniCycle stores all data locally (localStorage + IndexedDB) with no cloud sync, users risk losing routines if browser data is cleared. The backup reminder system periodically nudges users to download a backup file.

### Module

`modules/features/backupReminder.js` — Phase 7 (FEATURES), DI-pure via `createDIModule()`.

### Triggers

| Trigger | Condition | Check Point | Delay |
|---------|-----------|-------------|-------|
| **Timer** | 14+ days since last reminder shown | App boot (`uiBoot.js finalizeUI()`) | 3s |
| **Cycles** | 25+ cycles completed since last reminder | After `incrementCycleCount()` in `cycleCompletion.js` | 2s |
| **Tasks** | 100+ tasks cleared (To-Do mode) since last reminder | After `deleteCompletedTasksImpl()` in `taskCycleReset.js` | 2s |

### Anti-Annoyance Rules

| Rule | Behavior |
|------|----------|
| **Anti-stacking** | If reminder was shown within 3 days, skip (prevents multiple triggers firing at once) |
| **Dismiss cooldown** | If user clicks "Not Now", suppress for 7 days |
| **Recent backup** | If user downloaded a backup within 3 days, skip entirely |
| **New user guard** | Skip timer trigger if user has 0 completed cycles (nothing to back up) |

### State Fields (`state.settings`)

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `lastBackupReminderShown` | number | 0 | Timestamp of last reminder display |
| `backupReminderDismissedUntil` | number | 0 | Suppress until this timestamp (now + 7 days on dismiss) |
| `lastFileBackupTimestamp` | number | 0 | When last backup file was downloaded |
| `cyclesAtLastBackupReminder` | number | 0 | Snapshot of `userProgress.cyclesCompleted` at last reminder |
| `clearedTasksAtLastBackupReminder` | number | 0 | Snapshot of `userProgress.totalTasksCompleted` at last reminder |

### UI Flow

1. Reminder appears as a **confirmation modal** via `showConfirmationModal()`
2. Title: "Back up your routines?" (label: `notify.backupReminderTitle`)
3. Message: "Your routines are stored on this device only. A backup keeps them safe if your browser data is cleared." (label: `notify.backupReminderMessage`)
4. **"Backup All Routines"** button → calls `downloadBackupFile({ skipNamePrompt: true })` → immediate `.json` file download, no name prompt
5. **"Not Now"** button → sets `backupReminderDismissedUntil` to 7 days from now

### Implementation Wiring

```
backupReminder.js (check logic + modal)
  ├── DI deps: AppState, showConfirmationModal, showNotification, downloadBackupFile
  ├── Provides: checkBackupReminderOnBoot, checkBackupReminderOnCycleComplete, checkBackupReminderOnTaskClear
  └── Registered in moduleManifests.js (Phase 7, api: 'features')

Hook points:
  ├── uiBoot.js finalizeUI() → setTimeout(checkBackupReminderOnBoot, 3000)
  ├── cycleCompletion.js incrementCycleCount() → deps.checkBackupReminderOnCycleComplete?.()
  └── taskCycleReset.js deleteCompletedTasksImpl() → _deps.checkBackupReminderOnTaskClear?.()

Backup execution:
  └── backupRestoreManager.js downloadBackupFile() → creates .json blob, downloads, updates lastFileBackupTimestamp
```

### depMappings (`moduleLoader.js`)

```javascript
checkBackupReminderOnBoot: (...args) => deps.features?.checkBackupReminderOnBoot?.(...args),
checkBackupReminderOnCycleComplete: (...args) => deps.features?.checkBackupReminderOnCycleComplete?.(...args),
checkBackupReminderOnTaskClear: (...args) => deps.features?.checkBackupReminderOnTaskClear?.(...args),
downloadBackupFile: (...args) => deps.ui?.downloadBackupFile?.(...args),
```

### Labels (`defaultLabels.js`)

| Key | Value |
|-----|-------|
| `notify.backupReminderTitle` | "Back up your routines?" |
| `notify.backupReminderMessage` | "Your routines are stored on this device only. A backup keeps them safe if your browser data is cleared." |
| `notify.backupReminderConfirm` | "Backup All Routines" |
| `notify.backupReminderDismiss` | "Not Now" |

### Key Design Decisions

- **Confirmation modal, not toast** — backup is an important action that deserves focused attention, not a dismissible toast
- **No name prompt on reminder backup** — one-click flow reduces friction; the default filename includes the date
- **Tracks cycle/task snapshots, not absolute thresholds** — "25 cycles since last reminder" not "at 25, 50, 75 cycles", so the reminder scales naturally with usage
- **`downloadBackupFile()` extracted as reusable** — shared by the Settings backup button (with name prompt) and the reminder (without name prompt), avoiding code duplication

## Summary

miniCycle's storage management provides:

- **Visibility** - Storage bar, routine sizes, help window stats
- **Protection** - Quota enforcement at all entry points
- **Flexibility** - No arbitrary routine limits, user manages tradeoffs
- **Resilience** - 0.25MB buffer, graceful error handling
- **User agency** - Export/import for archival, clear feedback

The goal is preventing silent data loss while giving users the tools to manage their own storage needs.
