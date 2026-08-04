# Watch Recurring Function Documentation

## Overview

The watch recurring function implements offline-first recurring task scheduling for web applications using a polling-based approach. This system handles the creation and execution of recurring tasks entirely client-side without requiring server connectivity.

## Implementation Approach

### Core Architecture

- **Polling Interval**: Checks every 15 seconds for due tasks while recurring templates exist (`INTERVALS.RECURRING_WATCHER`); drops to a 2-hour idle cadence when none do (`INTERVALS.RECURRING_WATCHER_IDLE`)
- **Local Storage**: Persists recurring task schedules across browser sessions
- **Client-Side Calculation**: Computes next occurrence times locally
- **Cross-Platform Input Handling**: Adapts UI interactions based on device capabilities

### Key Components

#### 1. Task Scheduling Engine

```javascript
// Checks for due recurring tasks every 15 seconds (values live in
// core/constants.js — INTERVALS.RECURRING_WATCHER / RECURRING_WATCHER_IDLE)
setInterval(() => {
    checkRecurringTasks();
}, INTERVALS.RECURRING_WATCHER); // 15000ms active / 7200000ms idle
```

#### 2. Occurrence Calculation

- Calculates next due time based on frequency (daily, weekly, monthly, yearly)
- Handles specific times and date constraints
- Supports indefinite repetition or limited occurrence counts

#### 3. State Management

- Tracks recurring task metadata in localStorage
- Manages task creation timestamps and schedules
- Handles task deletion and modification

## Polling vs Timeout Approach Comparison

### Timeout-Based Implementation

```javascript
// Theoretical timeout approach
function scheduleNextOccurrence(task) {
    const nextTime = calculateNextOccurrence(task.schedule);
    const delay = nextTime - Date.now();

    setTimeout(() => {
        addRecurringTask(task);
        scheduleNextOccurrence(task);
    }, delay);
}
```

### Why Polling is Superior for Web Applications

#### Browser Environment Limitations

1. **Maximum Timeout Limitation**
   - `setTimeout` becomes unreliable for delays > ~24 days
   - Recurring tasks often need to schedule weeks or months ahead
2. **Tab Backgrounding Issues**
   - Browsers throttle or cancel timeouts in background tabs
   - Tasks would fail to execute when app isn't actively viewed
3. **Sleep/Hibernate Recovery**
   - Device sleep states can cause timeouts to never fire
   - Polling approach checks and recovers on next app activation
4. **Browser Tab Management**
   - Users frequently close/reopen tabs
   - Timeouts are lost on tab closure; polling persists via localStorage

#### Reliability Advantages

|Scenario                  |Timeout Approach           |Polling Approach             |
|--------------------------|---------------------------|-----------------------------|
|Device sleeps for 2 hours |Task may be lost           |Executes on wake + next check|
|Tab backgrounded overnight|Timeout throttled/cancelled|Executes when tab active     |
|Browser crash/restart     |All timeouts lost          |Recovers from localStorage   |
|Schedule > 24 days        |Timeout unreliable         |Handles any duration         |
|Multiple overdue tasks    |Must track separately      |Catches all in single check  |

#### Implementation Benefits

1. **Simplified State Management**
   - No timeout IDs to track and manage
   - No complex cleanup on task deletion/modification
   - Single check function handles all recurring tasks
2. **Graceful Degradation**
   - Functions correctly even with extended offline periods
   - Handles multiple missed executions intelligently
   - No race conditions between multiple timeouts
3. **Debugging and Maintenance**
   - Predictable execution pattern
   - Easy to verify system state
   - Clear audit trail of when checks occur

## Performance Considerations

### Efficiency Analysis

- **CPU Impact**: Minimal - single check every 15 seconds (and only a 2-hour heartbeat when no recurring templates exist)
- **Battery Usage**: Negligible compared to typical web app operations
- **Memory Footprint**: Lower than managing multiple timeout objects
- **Network Usage**: Zero - completely offline operation

### 15-Second Interval Justification

- Provides reasonable responsiveness for task scheduling
- Guarantees multiple ticks inside every clock minute, so exact-minute
  pattern matching (specific-time tasks) cannot miss its window while the
  app is awake
- Balances system efficiency with user expectations — and costs nothing
  when idle, since the watcher switches to a 2-hour cadence whenever no
  recurring templates exist
- Appropriate granularity for task management workflows

### Sleep/Freeze Recovery (v2.352)

Polling has one structural blind spot: timers do not tick while a device
sleeps or a tab is frozen, and a visible→visible sleep fires no
`visibilitychange` to trigger catch-up. The watcher therefore measures the
gap between its own ticks — when a tick arrives more than
`LIMITS.RECURRING_OVERSLEEP_FACTOR` (2×) beyond the expected cadence, that
tick delegates wholesale to `catchUpMissedRecurringTasks()`, which trusts
stored timestamps rather than re-matching the clock and notifies the user
about the missed task. Precise-minute spawning is preserved in the normal
case; the seam only opens the trusted catch-up path.

## Date Calculation Reliability

### DST-Safe Week Calculations (v1.348+)

For bi-weekly recurring tasks, the system uses DST-safe date arithmetic to maintain accurate week-to-week scheduling:

```javascript
function getDaysBetween(startDate, endDate) {
  // Normalize both dates to midnight UTC to eliminate DST effects
  const start = new Date(Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  ));
  const end = new Date(Date.UTC(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  ));

  const millisecondsDiff = end - start;
  return Math.floor(millisecondsDiff / (1000 * 60 * 60 * 24));
}
```

**Why This Matters:**

1. **Raw Millisecond Calculation Problem**
   - Naive approach: `(endDate - startDate) / (1000 * 60 * 60 * 24)`
   - Assumes every day is exactly 24 hours
   - **Fails with DST:** Spring forward (23h) and fall back (25h) cause drift

2. **UTC Normalization Solution**
   - Extracts only year/month/day (ignores time)
   - Converts to midnight UTC (no timezone offset)
   - Eliminates DST hour variations from calculation
   - Maintains accurate calendar date arithmetic

3. **Long-Term Accuracy**
   - Prevents week boundary shifts over multiple DST transitions
   - Ensures bi-weekly tasks trigger on correct weeks indefinitely
   - Critical for recurring tasks that span months/years

**Example Impact:**
```javascript
// Without DST-safe calculation
referenceDate = March 3, 2025 (before DST)
testDate = March 17, 2025 (after DST spring forward)
// Raw milliseconds might show 13.96 days (23h day on March 9)
// Week calculation could be off by 1

// With DST-safe calculation
daysBetween = 14 days (accurate calendar days)
weeks = 2 (correct)
```

## Real-World Browser Behavior

### Cross-Platform Compatibility

The polling approach handles various browser implementations consistently:

- **Chrome**: Aggressive tab backgrounding mitigation
- **Safari**: iOS Safari background limitations
- **Firefox**: Memory management during sleep states
- **Edge**: Windows hibernate/sleep integration

### Mobile Considerations

- Handles app backgrounding on mobile devices
- Survives low-memory situations better than timeouts
- Compatible with mobile browser PWA behavior
- Works correctly with mobile device sleep patterns

## Conclusion

While timeout-based scheduling appears more elegant theoretically, the polling approach provides superior reliability in real-world web application environments. The 15-second active interval (with a 2-hour idle fallback and oversleep-triggered catch-up) represents an optimal balance between responsiveness and efficiency, while the offline-first architecture ensures consistent behavior across diverse browser and device scenarios.

The implementation prioritizes user reliability over theoretical performance optimization, resulting in a robust recurring task system that functions consistently regardless of browser behavior, device state, or network connectivity.
