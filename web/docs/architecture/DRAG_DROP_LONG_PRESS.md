# Cross-Platform Task Interaction System Documentation

## Overview

The task interaction system provides unified user experience across desktop and mobile platforms by dynamically adapting input methods and UI behaviors based on device capabilities. The system handles touch, mouse, and keyboard interactions while preventing conflicts between different interaction modes.

## Architecture Overview

### Device Detection Strategy

The system uses feature detection rather than user agent sniffing to determine appropriate interaction patterns:

```javascript
// Detects touch capability
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Adapts interaction patterns accordingly
if (isTouchDevice) {
    // Enable mobile-specific interactions
} else {
    // Enable desktop-specific interactions
}
```

## Interaction Modes

### Desktop (Mouse/Keyboard) Interactions

#### 1. Hover-Based Menu Access

- **Trigger**: Mouse hover over task container
- **Behavior**: Three-dot menu appears instantly
- **Visual Feedback**: Subtle highlight on hover
- **Timeout**: Menu disappears after mouse leaves area

#### 2. Click-to-Select Patterns

- **Single Click**: Task completion toggle or subtask expansion
- **Right Click**: Context menu for task operations
- **Double Click**: Edit mode activation (where applicable)

#### 3. Keyboard Navigation

- **Tab Navigation**: Sequential focus through tasks
- **Arrow Keys**: Task reordering when in rearrange mode
- **Enter/Space**: Task completion toggle
- **Escape**: Cancel current operation

### Mobile (Touch) Interactions

#### 1. Long Press Menu Access

- **Trigger**: 500ms+ touch hold on task
- **Behavior**: Task enters drag mode + shows task buttons (if three-dots mode is disabled)
- **Three-dots mode**: Long press activates drag only — dedicated button handles menu visibility
- **Visual Feedback**: Task highlights during press, iOS shows native drag preview
- **Haptic**: Vibration feedback (if supported)

#### 2. Gesture-Based Navigation

- **Tap**: Task completion or expansion
- **Swipe Left/Right**: Navigate between main task view and stats panel
- **Pinch**: Zoom operations (disabled in task areas)
- **Pull-to-refresh**: Reload task state (optional)

## Conflict Prevention System

### Swipe vs Long Press Coordination

The system prevents interaction conflicts through careful event management:

```javascript
// Prevents swipe during active long press
// isDragging is a closure variable per task element

taskElement.addEventListener('touchstart', (e) => {
    holdTimeout = setTimeout(() => {
        isLongPress = true;
        this.draggedTask = taskElement;
        isDragging = true;
        taskElement.classList.add(DOM_CLASSES.DRAGGING);
        // Enable undo system on first user interaction (touch drag path)
        this.deps.enableUndoSystemOnFirstInteraction?.();
        // Three-dots check: only show task buttons if three-dots mode is OFF
        const body = this.deps.getBody?.() || document.body;
        const threeDotsEnabled = body.classList.contains(DOM_CLASSES.SHOW_THREE_DOTS_ENABLED);
        if (!threeDotsEnabled) {
            this.deps.revealTaskButtons?.(taskElement, 'long-press');
        }
    }, 500);
});

taskElement.addEventListener('touchmove', (e) => {
    // PRIORITY: If already dragging, process drag FIRST
    if (isDragging && this.draggedTask) {
        e.preventDefault(); // Block swipe navigation
        const targetTask = document.elementFromPoint(x, y)?.closest(DOM_SELECTORS.TASK);
        if (targetTask) this.handleRearrange(targetTask, e);
        return;
    }
    // Allow normal swipe for stats panel
});
```

### Stats Panel Swipe Protection

- **Problem**: Swipe gestures for stats panel could interfere with task interactions
- **Solution**: Contextual swipe detection that considers current UI state
- **Implementation**: Swipe gestures disabled during active task operations

## Drag and Drop System

### Desktop Drag Implementation

#### 1. Drag Initiation

```javascript
taskElement.addEventListener('dragstart', (e) => {
    this._nativeDragActive = true;  // iOS native DnD handoff flag
    this.draggedTask = taskElement;
    e.dataTransfer.setData("text/plain", "");
    taskElement.classList.add(DOM_CLASSES.DRAGGING);
    // Safari desktop: custom 70%-width ghost clone for polished preview
    // Non-Safari/iOS: browser shows native ghost (no intervention needed)
    const ua = navigator.userAgent;
    const isSafariDesktop = /Safari/.test(ua) && !/Chrome/.test(ua)
        && !/Chromium/.test(ua) && !('ontouchstart' in window);
    if (isSafariDesktop) {
        const ghost = taskElement.cloneNode(true);
        // Style at 70% width with theme vars, hide task-options, append offscreen
        event.dataTransfer.setDragImage(ghost, offsetX, offsetY);
        requestAnimationFrame(() => ghost.remove());
    }
});
```

#### 2. Drop Zone Management

- **Visual Feedback**: Drag-over highlighting
- **Position Detection**: Above/below target determination
- **Auto-scroll**: Viewport scrolling during drag operations

#### 3. Rearrange Mode Integration

- **Activation**: Three-dot menu → "Rearrange" option
- **Visual State**: Tasks show move arrows and drag handles
- **Completion**: Click outside or explicit exit

### Mobile Touch Drag

Mobile rearranging uses **iOS native HTML5 Drag and Drop** triggered by long press:

#### 1. iOS Native DnD (Primary)

- **Trigger**: Long press (500ms) on `draggable="true"` element
- **Visual**: iOS shows native drag preview (dark semi-transparent element with content)
- **Events**: `touchstart → dragstart → touchcancel → dragover... → drop`
- **Critical**: `touchcancel` must NOT clear `draggedTask` — the `drop` handler needs it
- **Save**: `saveDragReorder()` in `drop` handler persists new order to AppState

#### 2. Custom Touch Drag (Fallback)

- **When**: Devices where native DnD doesn't trigger (non-iOS touch devices)
- **Events**: `touchstart → touchmove → touchend`
- **Visual**: `elementFromPoint().closest('.task')` + `handleRearrange()`
- **Save**: `saveDragReorder()` in `touchend` handler

#### 3. Arrow-Based Reordering (Accessibility)

- **Trigger**: Toggle arrows visible in settings
- **Interface**: Up/down arrow buttons on each task
- **Action**: Tap arrows to move tasks incrementally
- **Visual**: Clear position indicators, focus management after move

## Fallback Systems

### Settings-Based Overrides

Users can manually enable alternative interaction methods through settings:

#### 1. Force Arrow Navigation

```javascript
// Setting: "Show move arrows for all tasks"
if (userSettings.forceArrows || !dragAndDropSupported) {
    enableArrowNavigation();
}
```

#### 2. Always Show Three-Dot Menu

```javascript
// Setting: "Always show task options"
if (userSettings.alwaysShowMenu) {
    taskMenuButton.style.display = 'block';
}
```

#### 3. Disable Gesture Navigation

```javascript
// Setting: "Disable swipe navigation"
if (userSettings.disableSwipe) {
    swipeGestureEnabled = false;
    showNavigationButtons();
}
```

### Progressive Enhancement Strategy

The system degrades gracefully when advanced features aren't supported:

1. **Touch Detection Failure**: Falls back to always-visible controls
2. **Drag and Drop Unavailable**: Shows arrow navigation by default
3. **Gesture API Missing**: Uses click-based navigation
4. **Older Browsers**: Provides simplified interaction model

## Cross-Platform Event Handling

### Unified Event System

```javascript
// Unified pointer events where supported
if (window.PointerEvent) {
    element.addEventListener('pointerdown', handleStart);
    element.addEventListener('pointermove', handleMove);
    element.addEventListener('pointerup', handleEnd);
} else {
    // Fallback to separate touch/mouse events
    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('mousedown', handleMouseStart);
    // ... additional handlers
}
```

### Timing Considerations

Different interaction patterns require different timing:

|Interaction      |Desktop Timing|Mobile Timing|Rationale                  |
|-----------------|--------------|-------------|---------------------------|
|Hover Menu       |100ms delay   |N/A          |Prevent accidental triggers|
|Long Press       |N/A           |500ms hold   |Allow for touch precision  |
|Double Click     |300ms window  |N/A          |Standard system timing     |
|Swipe Recognition|N/A           |150ms minimum|Distinguish from scrolling |

## Accessibility Integration

### Screen Reader Support

- **Focus Management**: Proper tab order during rearrange mode
- **ARIA Labels**: Dynamic labels for context-sensitive actions
- **Keyboard Equivalents**: Full keyboard navigation support
- **State Announcements**: Mode changes announced to screen readers

### Motor Accessibility

- **Large Touch Targets**: Minimum 44px touch areas on mobile
- **Reduced Motion**: Respects `prefers-reduced-motion` settings
- **Multiple Activation Methods**: Choice between gesture and button interfaces
- **Timeout Extensions**: Longer timeouts for users who need more time

## Performance Considerations

### Event Throttling

```javascript
// Throttle move events during drag operations
const throttledDragMove = throttle((e) => {
    updateDragPosition(e);
}, 16); // 60fps maximum
```

### Memory Management

- **Event Cleanup**: Remove listeners when tasks are deleted
- **Timer Management**: Clear timeouts on interaction cancellation
- **DOM Updates**: Batch visual updates during interactions

## Browser Compatibility

### Modern Browser Features

- **Pointer Events**: Primary interaction system (Chrome 55+, Firefox 59+)
- **Touch Events**: Fallback for older mobile browsers
- **Drag and Drop API**: Desktop browsers with progressive enhancement

### Legacy Support

- **IE11**: Basic click/tap interactions only
- **iOS Safari**: Touch events + native HTML5 DnD (via `draggable="true"` long-press)
- **Android Browser**: Simplified interaction model

## Debugging and Monitoring

### Interaction Logging

```javascript
// Development mode interaction tracking
if (debugMode) {
    console.log('Interaction:', {
        type: eventType,
        device: deviceType,
        timing: performance.now(),
        position: coordinates
    });
}
```

### User Analytics Integration

- **Interaction Success Rates**: Track completion of intended actions
- **Fallback Usage**: Monitor how often users need alternative methods
- **Performance Metrics**: Measure interaction response times

## Conclusion

The cross-platform interaction system provides a seamless user experience by intelligently adapting to device capabilities while maintaining consistent functionality. The layered fallback approach ensures accessibility across diverse hardware and software environments, while the conflict prevention system maintains interface reliability during complex interactions.

The implementation prioritizes user experience consistency over technical simplicity, resulting in an interaction model that feels native on each platform while maintaining functional parity across all supported devices.
