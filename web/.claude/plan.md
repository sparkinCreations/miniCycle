# Plan: Desktop Two-Panel Layout for Routine Switcher Modal

## Goal
On desktop (≥768px), show a side-by-side layout: routine list on the left, task preview on the right. On mobile, keep the current stacked/inline layout unchanged.

## Current State
- Modal content (`mini-cycle-switch-modal-content`) is a single column, max-width 400px
- Preview (`#switch-preview-window`) lives inside `#switch-items-row` (action buttons row), shown inline below the list when a routine is selected
- Preview is 180px wide, max-height 70px, centered
- Action buttons (duplicate/rename/delete/download/theme) are also inside `#switch-items-row`

## Approach: CSS-Only Responsive Layout (with minor HTML restructure)

### Step 1: Restructure HTML in `miniCycle.html`
Move the preview window OUT of `#switch-items-row` into its own sibling container, so the modal content can use CSS grid/flexbox to position them side-by-side:

```
<div class="mini-cycle-switch-modal-content">
  <div class="routine-switcher-left">     ← NEW wrapper
    <h1>Open Routine</h1>
    <input search />
    <div sort/filter />
    <div list />
    <div action-buttons-row />            ← buttons stay here
    <div theme-picker />
    <div cancel/open buttons />
    <div import button />
    <div storage bar />
  </div>
  <div class="routine-switcher-right">    ← NEW wrapper
    <div preview-window />                ← MOVED here
    <div preview-date />                  ← created dynamically, will append here
  </div>
</div>
```

### Step 2: CSS Changes in `routine-switcher.css`

**Desktop (≥768px) — new media query:**
- `.mini-cycle-switch-modal-content`: increase `max-width` to ~700px, use `display: flex` with `flex-direction: row`
- `.routine-switcher-left`: flex: 1, contains all existing content
- `.routine-switcher-right`: width ~250px, sticky/fixed position within modal, shows preview panel with more vertical space (remove 70px max-height cap)
- Hide preview from `#switch-items-row` (it's been moved)

**Mobile (<768px) — existing behavior preserved:**
- `.routine-switcher-right`: hidden (`display: none`)
- Preview stays visible inline in `#switch-items-row` as it does now (we'll need to keep the inline preview OR dynamically move it)

**Simpler alternative:** Instead of moving the DOM element, use CSS to reposition. But since the preview is inside the action row, a structural move is cleaner.

### Step 3: JS Changes in `routineSwitcher.js`
- `updatePreview()`: Also update the desktop preview panel (right side). The simplest approach: update the same `#switch-preview-window` element — it just lives in a different DOM position now.
- Since we're moving the preview element in HTML, the existing JS (`getElementById(DOM_IDS.SWITCH_PREVIEW_WINDOW)`) will still find it — no ID changes needed.
- The `setupPreviewPopout()` double-click handler continues to work since it targets the same element by ID.

### Step 4: Add constants if needed
- Add `ROUTINE_SWITCHER_LEFT` and `ROUTINE_SWITCHER_RIGHT` to `DOM_SELECTORS` in `constants.js` if referenced in JS (may not need IDs if purely CSS-driven)

## Files to Modify
1. **`miniCycle.html`** (~line 1484-1542) — Wrap existing content in `.routine-switcher-left`, add `.routine-switcher-right` with the preview window moved into it
2. **`styles/components/routine-switcher.css`** — Add desktop media query with flex layout, enlarge modal width, style the right panel, adjust preview sizing
3. **`modules/routine/routineSwitcher.js`** — Minor: ensure `updatePreview()` and `setupPreviewPopout()` still work with the moved element (should work since we keep the same IDs). Possibly duplicate preview content to both locations or toggle visibility.
4. **`modules/core/constants.js`** — Add new selectors if needed

## Key Considerations
- The preview `<div>` is currently inside `#switch-items-row` which is hidden until a routine is selected. On desktop, the right panel should show a placeholder ("Select a routine to preview") when nothing is selected, then populate on selection.
- Action buttons row should remain on the left side (below the list).
- The right panel should have enough height to show more tasks (remove 70px cap on desktop).
- Theme picker row stays on the left side.
- Storage bar stays on the left side.
- Mobile breakpoint: ≤768px keeps current single-column behavior, right panel hidden.
