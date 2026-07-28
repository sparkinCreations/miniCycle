# SVG Animation Overlay Guide

**Last Updated:** April 2026

This guide explains how to create animated SVG overlays on top of static PNG phone mockup screenshots. The technique is used on the miniCycle product page to demonstrate the auto-reset cycle mechanic — tasks checking off, a completion checkmark appearing, and tasks cascading back to unchecked.

---

## Overview

The approach layers an inline SVG on top of a PNG screenshot of the app. The SVG contains:
- The PNG as a background `<image>` element
- Animated elements (checkmarks, glow bars, progress bar, completion overlay) positioned to align with the UI elements in the screenshot
- CSS keyframe animations that run on a unified timeline

The result looks like the app is running live, but it's just a static image with animated SVG elements on top.

---

## File Locations

| File | Purpose |
|------|---------|
| `pages/product.html` | Contains the inline SVG in the "See It In Action" section |
| `pages/cycle-animation.svg` | Standalone version (for testing positioning outside the page) |
| `assets/images/Product/4ps-See-it-in-action-1.png` | Background PNG — app screenshot with all tasks unchecked |

---

## How It Works

### 1. The PNG Background

The SVG `<image>` element loads the phone screenshot as the base layer:

```xml
<image href="../assets/images/Product/4ps-See-it-in-action-1.png"
       x="0" y="0" width="491" height="978"/>
```

- The `viewBox="0 0 491 978"` matches the PNG dimensions (491x978 pixels)
- Everything in the SVG is positioned in this coordinate space
- The PNG must show the app with **all tasks unchecked** (the starting state)

### 2. Animated Checkmarks

Each task has a green checkmark circle that fades in at a specific time:

```xml
<g class="ca c1"><use href="#check" x="95" y="215"/></g>
```

- `ca` = base class (starts at opacity 0)
- `c1` through `c8` = timing class (controls when this check appears and disappears)
- `x` and `y` = position of the checkmark center, aligned over the empty circle in the PNG
- `#check` = reusable symbol defined in `<defs>`:

```xml
<g id="check">
  <circle r="16" fill="#1e8e3e"/>
  <path d="M-7,1 L-3,5 L7,-4" stroke="#1a1a1a" stroke-width="3"
        fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</g>
```

### 3. Green Cascade Glow Bars

Each task has a green overlay rectangle that flashes during the reset cascade:

```xml
<rect class="gb g1" x="82" y="190" width="310" height="48" rx="10"
      fill="#1e8e3e" fill-opacity="0.2"/>
```

- `gb` = base class (starts at opacity 0)
- `g1` through `g8` = timing class (controls when the glow appears)
- The rect should cover the entire task row area
- `fill-opacity="0.2"` keeps it subtle — a translucent green wash over the row

### 4. Progress Bar

A green rectangle that grows as tasks are checked off:

```xml
<rect class="pf" x="85" y="788" width="0" height="8" rx="4" fill="#1e8e3e"/>
```

- Starts at `width: 0`
- Grows to full width (`300px`) as tasks complete
- Shrinks back to 0 during the reset

### 5. Completion Checkmark Overlay

A large green checkmark that appears when all tasks are done:

```xml
<g class="cc">
  <rect x="80" y="185" width="315" height="530" rx="14"
        fill="rgba(255,255,255,0.25)"/>
  <use href="#big-check" x="240" y="460"/>
</g>
```

- Semi-transparent white overlay dims the task list
- Large green circle with checkmark scales in from center
- Fades out as the cascade begins

---

## Animation Timeline

Total cycle: **13 seconds**, loops infinitely.

| Time | What Happens |
|------|-------------|
| 0s - 1s | All tasks unchecked (starting state) |
| 1s | Task 1 checkmark appears |
| 2s | Task 2 checkmark appears |
| 3s | Task 3 checkmark appears |
| 4s | Task 4 checkmark appears |
| 5s | Task 5 checkmark appears |
| 6s | Task 6 checkmark appears |
| 7s | Task 7 checkmark appears |
| 8s | Task 8 checkmark appears (all done) |
| 9s | Big completion checkmark scales in |
| 10s | Cascade starts — glow bar 1 flashes, check 1 fades out |
| 10.2s | Glow bar 2, check 2 fades out |
| 10.4s | Glow bar 3, check 3 fades out |
| ... | Cascade continues down (0.2s apart) |
| 11.4s | Last glow bar, last check fades out |
| 11.6s - 13s | All tasks unchecked, progress bar empty, settle |
| 13s | Loop restarts |

### How Timing Is Calculated

All animations use a single 13s timeline expressed as percentages:

```
Time in seconds / 13 * 100 = percentage

1s  = 7.7%
2s  = 15.4%
10s = 77%
etc.
```

Example — Task 1 checkmark animation:

```css
@keyframes c1 {
  0%, 7.6%  { opacity: 0 }   /* Hidden until 1s */
  7.7%, 78% { opacity: 1 }   /* Visible from 1s to 10.1s */
  80%, 100% { opacity: 0 }   /* Fades out at 10.4s (cascade) */
}
```

---

## Step-by-Step: How to Position Elements

This is the most important part. Getting the animated elements to line up with the PNG screenshot requires manual coordinate adjustment.

### Step 1: Get the PNG Dimensions

```bash
python3 -c "
from PIL import Image
img = Image.open('assets/images/Product/4ps-See-it-in-action-1.png')
print(f'Size: {img.size}')
"
```

Use these dimensions for the SVG `viewBox`:

```xml
<svg viewBox="0 0 491 978">
```

### Step 2: Set Up the Standalone SVG for Testing

Create a file like `pages/cycle-animation.svg` with the PNG background and one checkmark:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 491 978" width="491" height="978">
  <defs>
    <g id="check">
      <circle r="16" fill="#1e8e3e"/>
      <path d="M-7,1 L-3,5 L7,-4" stroke="#1a1a1a" stroke-width="3"
            fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </defs>

  <image href="../assets/images/Product/4ps-See-it-in-action-1.png"
         x="0" y="0" width="491" height="978"/>

  <!-- Test checkmark — adjust x,y to align with first task's checkbox -->
  <use href="#check" x="95" y="215"/>
</svg>
```

### Step 3: Open in Browser and Use DevTools

1. Start the dev server: `npm start` (or `python3 -m http.server 8080`)
2. Open `http://localhost:8080/pages/cycle-animation.svg`
3. Right-click the checkmark circle > **Inspect**
4. In the Elements panel, find the `<use>` element
5. Edit the `x` and `y` attributes directly in DevTools
6. Watch the checkmark move in real time until it sits exactly on the empty circle

### Step 4: Record the Coordinates

For each task row, you need:

| Element | What to position | Attributes to adjust |
|---------|-----------------|---------------------|
| Checkmark | Center of the empty checkbox circle | `x`, `y` on `<use>` |
| Glow bar | Covers the entire task row | `x`, `y`, `width`, `height` on `<rect>` |

**Tips for alignment:**
- The checkmark `x,y` is the **center** of the circle (not top-left)
- The glow bar `x,y` is the **top-left corner** of the rectangle
- Task rows with two lines of text are taller — adjust `height` accordingly
- The glow bar should extend from the left edge of the task card to the right edge

### Step 5: Position Each Element

Repeat Step 3-4 for all 8 tasks. Write down the coordinates:

```
Task 1: check x="95" y="215"   glow x="82" y="190" w="310" h="48"
Task 2: check x="95" y="275"   glow x="82" y="248" w="310" h="58"
Task 3: check x="95" y="350"   glow x="82" y="325" w="310" h="55"
...etc
```

### Step 6: Position the Progress Bar

Find the progress bar track in the PNG and position the fill rectangle:

```xml
<rect class="pf" x="85" y="788" width="0" height="8" rx="4" fill="#1e8e3e"/>
```

- `x` = left edge of the progress bar track
- `y` = top of the progress bar track
- `height` = thickness of the bar
- The `width` is animated (starts at 0, grows to full)
- Update the max width in the `@keyframes pf` to match the track width

### Step 7: Position the Completion Overlay

The big checkmark should be centered over the task list area:

```xml
<g class="cc">
  <rect x="80" y="185" width="315" height="530" rx="14"
        fill="rgba(255,255,255,0.25)"/>
  <use href="#big-check" x="240" y="460"/>
</g>
```

- The `<rect>` should cover the entire task list area (semi-transparent white overlay)
- The `<use href="#big-check">` should be centered within that area
- Adjust `transform-origin` in the CSS to match the center point for the scale animation

---

## Embedding in product.html

**Important:** SVGs loaded via `<img src="file.svg">` cannot load external images (like the PNG) due to browser security restrictions. The SVG **must be inlined** in the HTML.

```html
<div class="cycle-demo">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 491 978" class="cycle-demo-svg">
      <!-- All SVG content goes here inline -->
      <image href="../assets/images/Product/4ps-See-it-in-action-1.png" .../>
      <!-- checkmarks, glow bars, etc. -->
    </svg>
</div>
```

CSS for the container:

```css
.cycle-demo { max-width: 320px; margin: 0 auto; }
.cycle-demo-svg { width: 100%; height: auto; display: block; }
```

The SVG scales responsively because `viewBox` defines the coordinate space and `width: 100%` fills the container.

---

## Adapting for a Different Screenshot

To use a different app screenshot (e.g., a different routine, different theme):

1. **Take a new screenshot** with all tasks unchecked
2. **Check the image dimensions** and update the `viewBox` to match
3. **Replace the `<image href="...">` path** to point to the new PNG
4. **Reposition all checkmarks and glow bars** using the DevTools method (Step 3-6)
5. **Adjust the number of tasks** — add or remove `<g class="ca cN">` and `<rect class="gb gN">` elements
6. **Update the animation keyframes** if the number of tasks changes (the percentages need recalculating)
7. **Update the progress bar max width** in `@keyframes pf` to match the new track width

### Changing the Number of Tasks

If your new screenshot has 5 tasks instead of 8:

1. Remove task elements 6-8 from the SVG
2. Recalculate the timeline:
   - 5 tasks at 1s each = 5s to check all
   - Completion at 6s
   - Cascade at 7s-8s
   - Total cycle: ~10s
3. Update all `@keyframes` percentages based on the new total

---

## Customizing Colors

| Element | Current Color | Where to Change |
|---------|--------------|-----------------|
| Checkmark circle fill | `#1e8e3e` (dark green) | `<g id="check">` circle `fill` |
| Checkmark icon stroke | `#1a1a1a` (near black) | `<g id="check">` path `stroke` |
| Big checkmark circle | `#1e8e3e` | `<g id="big-check">` circle `fill` |
| Big checkmark icon | `#1a1a1a` | `<g id="big-check">` path `stroke` |
| Glow bar color | `#1e8e3e` at 20% opacity | Each `<rect>` `fill` and `fill-opacity` |
| Progress bar | `#1e8e3e` | Progress `<rect>` `fill` |
| Completion overlay | `rgba(255,255,255,0.25)` | Overlay `<rect>` `fill` |

---

## Accessibility

- The animation respects `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
}
```

- The container has `role="img"` and `aria-label` describing the animation
- When motion is reduced, the SVG shows the static PNG with no animated elements

---

## Troubleshooting

### PNG not showing
- If embedded as `<img src="file.svg">`, the PNG won't load (security restriction). Inline the SVG in the HTML instead.
- Check the `href` path is correct relative to the HTML file's location, not the SVG file's location.

### Checkmarks misaligned
- Open the standalone SVG directly in the browser (`localhost:8080/pages/cycle-animation.svg`) for easier DevTools positioning
- Remember: `x,y` on `<use>` is the **center** of the checkmark circle, not the top-left corner

### Glow bars flashing repeatedly
- Make sure glow animations use the full timeline (e.g., `animation: g1 13s ease infinite`) not short durations with `animation-delay` (e.g., `animation: glow 0.6s; animation-delay: 10s`)
- Short durations with delays + `infinite` = the short animation loops every 0.6s after the delay, causing flashing

### Animation not looping
- Use `infinite` on all animation declarations
- Use `forwards` only if you don't want looping (plays once and holds final state)

### Progress bar width not animating
- SVG `<rect>` `width` can be animated with CSS keyframes in most browsers
- If it doesn't work, use `transform: scaleX()` as an alternative

---

## Quick Reference: Current Coordinates

These are the coordinates for `4ps-See-it-in-action-1.png` (491x978):

```
Task 1 (Safety check):          check x=95 y=215   glow x=82 y=190  w=310 h=48
Task 2 (Pain/Meds):             check x=95 y=275   glow x=82 y=248  w=310 h=58
Task 3 (Personal needs):        check x=95 y=350   glow x=82 y=325  w=310 h=55
Task 4 (Position/Reposition):   check x=95 y=425   glow x=82 y=400  w=310 h=58
Task 5 (Call light):            check x=95 y=490   glow x=82 y=465  w=310 h=48
Task 6 (Phone/water/glasses):   check x=95 y=555   glow x=82 y=530  w=310 h=58
Task 7 (Trash can):             check x=95 y=620   glow x=82 y=600  w=310 h=48
Task 8 (Closing):               check x=95 y=685   glow x=82 y=660  w=310 h=58

Progress bar:                   x=85 y=788 max-width=300 h=8
Completion overlay:             rect x=80 y=185 w=315 h=530
Big checkmark:                  x=240 y=460
```
