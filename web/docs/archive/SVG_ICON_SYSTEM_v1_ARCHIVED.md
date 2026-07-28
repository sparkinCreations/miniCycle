# SVG Icon System

> **⚠️ ARCHIVED (superseded) — historical snapshot.**
> This v1.0 document predates the *completed* Font Awesome → inline-SVG migration
> and contains a claim that is **false against the current code**: it states that
> `DOMParser` with `image/svg+xml` "FAILS" and that a `<template>` element must be
> used instead. The live general-icon system (`modules/utils/iconInit.js`) uses
> `DOMParser` successfully — modern `appendChild` auto-adopts cross-document nodes.
> It also documents only the `taskButtons.js` (`TASK_ICONS`) path, not the primary
> `icons.js` (`ICONS` + `FA_MAP`) registry that converts every `fa-*` class.
> Kept for historical context only. **Current doc:** [`../developer-guides/SVG_ICON_SYSTEM.md`](../features/SVG_ICON_SYSTEM.md).

---

**Date**: January 2026
**Status**: Implemented

---

## Overview

miniCycle uses inline SVG icons instead of Font Awesome CDN to eliminate ~2 second critical path latency from external font loading. This document explains the implementation and key technical decisions.

---

## The Problem

Font Awesome loaded from CDN caused:
- ~2 second blocking time on initial page load
- Flash of invisible/unstyled icons (FOUC)
- Dependency on external CDN availability
- Unnecessary network requests for icons we don't use

---

## The Solution

Inline SVG icons embedded directly in JavaScript:

```javascript
// modules/task/taskButtons.js
const TASK_ICONS = {
    'exclamation-triangle': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="#bf0303" d="..."/></svg>',
    'edit': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="#4d4dff" d="..."/></svg>',
    // ... more icons
};
```

---

## Key Technical Decisions

### 1. Using `<template>` Element for SVG Parsing

**Problem**: Setting `innerHTML` directly on a span doesn't properly handle SVG namespace.

```javascript
// WRONG - SVG renders blank
iconSpan.innerHTML = '<svg>...</svg>';
```

**Solution**: Use `<template>` element which properly parses HTML5 including SVG:

```javascript
// CORRECT - SVG renders properly
const template = document.createElement('template');
template.innerHTML = svgString.trim();
const svgNode = template.content.firstChild;
iconSpan.appendChild(svgNode);
```

**Why this works**: The `<template>` element's `content` property is a DocumentFragment that properly parses HTML5 content, including SVG elements with their correct XML namespaces.

### 2. CSS Controls Colors via `fill="currentColor"`

SVGs use `fill="currentColor"` on the `<svg>` element, allowing CSS to control icon colors:

```html
<svg xmlns="..." fill="currentColor"><path d="..."/></svg>
```

CSS sets the color on button classes:

```css
.priority-btn .icon { color: #bf0303; }  /* Red */
.edit-btn .icon { color: #333333; }      /* Black */
.delete-btn .icon { color: #333333; }    /* Black */
```

This is the proper approach because:
- Single source of truth (CSS)
- Easy to theme
- Active states can override (e.g., white icon when button is active)

### 3. Explicit Width/Height Attributes

SVG elements include explicit dimensions for reliable rendering:

```html
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512">
```

---

## File Locations

| File | Purpose |
|------|---------|
| `modules/task/taskButtons.js` | SVG icon definitions and button creation |
| `modules/utils/icons.js` | General icon utilities (menu icons, etc.) |
| `modules/utils/iconInit.js` | Font Awesome replacement on page load |
| `styles/components/icons.css` | Icon styling and sizing |

---

## Icon Colors by Button Type

Colors are defined in `styles/components/task-options.css`:

| Button | Color | Hex | CSS Selector |
|--------|-------|-----|--------------|
| Priority | Dark red | `#bf0303` | `.priority-btn .icon` |
| Edit | Black | `#333333` | `.edit-btn .icon` |
| Delete | Black | `#333333` | `.delete-btn .icon` |
| Recurring | Dark blue | `#0056b3` | `.recurring-btn .icon` |
| Due Date | Gray | `#555` | `.set-due-date .icon` |
| Reminders | Black | `#333333` | `.enable-task-reminders .icon` |

---

## Adding New Icons

1. Find the SVG path data (e.g., from Font Awesome or other icon set)
2. Add to `TASK_ICONS` object in `taskButtons.js`:

```javascript
'new-icon': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="#COLOR" d="PATH_DATA"/></svg>'
```

3. Reference in button config:

```javascript
{ class: "new-btn", iconClass: "fas fa-new-icon", show: true }
```

---

## What Doesn't Work

These approaches were tried and **failed**:

### 1. Direct innerHTML Assignment
```javascript
// FAILS - SVG namespace not properly set
iconSpan.innerHTML = svgString;
```

### 2. DOMParser with 'image/svg+xml'
```javascript
// FAILS - Document context issues when appending
const parser = new DOMParser();
const doc = parser.parseFromString(svg, 'image/svg+xml');
iconSpan.appendChild(doc.documentElement);
```

### 3. Inline fill on `<path>` element
```html
<!-- FAILS to pick up CSS colors, gets overridden -->
<path fill="#333" d="..."/>
```

**Note**: `fill="currentColor"` on the `<svg>` element DOES work and is the correct approach.

---

## Performance Benefits

- **Before**: ~2000ms Font Awesome CDN load time
- **After**: 0ms (icons bundled with JS)
- **Bundle size increase**: ~2KB (negligible)

---

## Related Files

- `styles/components/task-options.css` - Button container styling
- `miniCycle.html` - Removed Font Awesome CDN link

---

**Document Version**: 1.0
**Last Updated**: January 2026
