# Theme Creation Guide

> **Note (Feb 2026):** This guide was written for a JSON-based build system that was never implemented.
> The actual theming system is vocabulary-based — see [THEME_ARCHITECTURE.md](../architecture/THEME_ARCHITECTURE.md)
> for how theming actually works (no build step, no JSON files in `styles/themes/`).
>
> The content below is preserved as a design reference.

---

Create custom themes for miniCycle in minutes. No CSS knowledge required - just edit a JSON file.

---

## Quick Start

### 1. Copy the Template

Copy an existing theme as your starting point:

```bash
cp styles/themes/definitions/default.json styles/themes/definitions/my-theme.json
```

### 2. Edit Your Theme

Open `my-theme.json` and customize:

```json
{
  "id": "my-theme",
  "name": "My Custom Theme",
  "description": "A beautiful custom theme",
  "author": "Your Name",
  "version": "1.0.0",
  "tags": ["custom", "dark"],
  "tokens": {
    "colors": {
      "backgrounds": {
        "gradient": "linear-gradient(135deg, #1a1a2e, #16213e)",
        "solid": "#1a1a2e",
        "surface": "rgba(30, 30, 50, 0.95)",
        "surfaceElevated": "#252545"
      },
      "text": {
        "primary": "#ffffff",
        "secondary": "rgba(255, 255, 255, 0.7)",
        "onSurface": "#e0e0e0",
        "muted": "#888888"
      }
    }
  }
}
```

### 3. Preview Your Theme

Open the browser console and run:

```javascript
ThemeManager.setTheme('my-theme');
```

### 4. Iterate

Edit the JSON, save, and run the command again. Changes appear instantly.

---

## Theme Structure

### Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Unique identifier (lowercase, hyphens) | `"my-theme"` |
| `name` | Display name shown to users | `"My Custom Theme"` |

### Optional Fields

| Field | Description | Example |
|-------|-------------|---------|
| `description` | Brief description | `"A calming blue theme"` |
| `author` | Creator name | `"John Doe"` |
| `version` | Semantic version | `"1.0.0"` |
| `tags` | Searchable tags | `["dark", "minimal"]` |

### Tokens

All styling is done through tokens. You only need to define what you want to change - everything else uses defaults.

---

## Color Tokens

### Backgrounds

```json
"backgrounds": {
  "gradient": "linear-gradient(135deg, #color1, #color2)",
  "solid": "#fallback-color",
  "surface": "rgba(255, 255, 255, 0.95)",
  "surfaceElevated": "#ffffff"
}
```

| Token | Used For |
|-------|----------|
| `gradient` | Main app background |
| `solid` | Fallback if gradients not supported |
| `surface` | Cards, panels, modals |
| `surfaceElevated` | Elevated elements (dropdowns, popovers) |

### Text

```json
"text": {
  "primary": "#ffffff",
  "secondary": "rgba(255, 255, 255, 0.7)",
  "onSurface": "#333333",
  "muted": "#888888"
}
```

| Token | Used For |
|-------|----------|
| `primary` | Main text on gradient background |
| `secondary` | Secondary text on gradient |
| `onSurface` | Text on cards/panels |
| `muted` | Disabled, hint, placeholder text |

### Semantic Colors

```json
"semantic": {
  "success": "#28a745",
  "successLight": "#48c764",
  "warning": "#ffc107",
  "warningLight": "#ffda6a",
  "error": "#dc3545",
  "errorLight": "#f1737e",
  "info": "#17a2b8"
}
```

### Header

```json
"header": {
  "bg": "transparent",
  "text": "#ffffff",
  "border": "rgba(255, 255, 255, 0.2)"
}
```

### Components

```json
"components": {
  "card": {
    "bg": "rgba(255, 255, 255, 0.95)",
    "border": "transparent",
    "shadow": "0 4px 6px rgba(0, 0, 0, 0.1)"
  },
  "input": {
    "bg": "#ffffff",
    "border": "#cccccc",
    "focusBorder": "#4c79ff"
  },
  "button": {
    "primaryBg": "#4c79ff",
    "primaryText": "#ffffff",
    "secondaryBg": "#e0e0e0",
    "secondaryText": "#333333"
  },
  "modal": {
    "bg": "#ffffff",
    "text": "#333333",
    "border": "transparent",
    "overlay": "rgba(0, 0, 0, 0.5)"
  },
  "notification": {
    "bg": "#333333",
    "text": "#ffffff"
  },
  "task": {
    "bg": "rgba(255, 255, 255, 0.95)",
    "completedBg": "rgba(200, 255, 200, 0.9)",
    "border": "transparent",
    "checkmark": "#28a745"
  },
  "progress": {
    "trackBg": "rgba(0, 0, 0, 0.1)",
    "fillBg": "#4c79ff",
    "text": "#333333"
  },
  "statsPanel": {
    "bg": "rgba(255, 255, 255, 0.95)",
    "text": "#333333",
    "border": "transparent"
  }
}
```

---

## Example Themes

### Minimal Dark Theme

Only define what's different from default:

```json
{
  "id": "minimal-dark",
  "name": "Minimal Dark",
  "tokens": {
    "colors": {
      "backgrounds": {
        "gradient": "linear-gradient(135deg, #1a1a1a, #2d2d2d)",
        "surface": "rgba(45, 45, 45, 0.95)"
      },
      "text": {
        "onSurface": "#e0e0e0"
      }
    }
  }
}
```

### Ocean Theme

```json
{
  "id": "ocean",
  "name": "Deep Ocean",
  "description": "Calming ocean blues with teal accents",
  "tags": ["dark", "blue", "calm"],
  "tokens": {
    "colors": {
      "backgrounds": {
        "gradient": "linear-gradient(135deg, #0c1724, #1a3a4f)",
        "solid": "#0c1724",
        "surface": "rgba(26, 58, 79, 0.95)",
        "surfaceElevated": "#1e4a5f"
      },
      "text": {
        "primary": "#ffffff",
        "secondary": "rgba(255, 255, 255, 0.8)",
        "onSurface": "#e0f7fa",
        "muted": "#78909c"
      },
      "header": {
        "bg": "rgba(12, 23, 36, 0.9)",
        "text": "#4ecdc4",
        "border": "rgba(78, 205, 196, 0.3)"
      },
      "components": {
        "button": {
          "primaryBg": "#4ecdc4",
          "primaryText": "#0c1724"
        },
        "input": {
          "bg": "#1e3a4f",
          "border": "rgba(78, 205, 196, 0.3)",
          "focusBorder": "#4ecdc4"
        }
      }
    }
  }
}
```

### Golden Glow Theme

```json
{
  "id": "golden-glow",
  "name": "Golden Glow",
  "description": "Warm golden tones",
  "tags": ["light", "warm", "gold"],
  "tokens": {
    "colors": {
      "backgrounds": {
        "gradient": "linear-gradient(135deg, #f7d358, #ffb347)",
        "solid": "#f7d358",
        "surface": "rgba(255, 251, 230, 0.95)"
      },
      "text": {
        "primary": "#4a3d00",
        "secondary": "rgba(74, 61, 0, 0.8)",
        "onSurface": "#4a3d00"
      },
      "header": {
        "text": "#4a3d00",
        "border": "rgba(74, 61, 0, 0.2)"
      },
      "components": {
        "button": {
          "primaryBg": "#d4a700",
          "primaryText": "#ffffff"
        }
      }
    }
  }
}
```

### High Contrast (Accessible)

```json
{
  "id": "high-contrast",
  "name": "High Contrast",
  "description": "Maximum contrast for accessibility",
  "tags": ["accessible", "high-contrast"],
  "tokens": {
    "colors": {
      "backgrounds": {
        "gradient": "#000000",
        "solid": "#000000",
        "surface": "#000000",
        "surfaceElevated": "#1a1a1a"
      },
      "text": {
        "primary": "#ffffff",
        "secondary": "#ffffff",
        "onSurface": "#ffffff",
        "muted": "#cccccc"
      },
      "components": {
        "card": {
          "border": "2px solid #ffffff"
        },
        "button": {
          "primaryBg": "#ffffff",
          "primaryText": "#000000"
        },
        "input": {
          "bg": "#000000",
          "border": "#ffffff",
          "focusBorder": "#ffff00"
        }
      }
    }
  }
}
```

---

## Tips & Best Practices

### 1. Start Simple

Begin with just backgrounds and text colors. Add component tokens only if needed.

### 2. Test Contrast

Ensure text is readable on all backgrounds:
- Light backgrounds → dark text
- Dark backgrounds → light text
- Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### 3. Use Consistent Tones

Pick a base color and generate variations:
- Lighter versions for hover states
- Darker versions for active states
- Semi-transparent versions for overlays

### 4. Consider Both Modes

If your theme is dark, ensure it still looks good. If it's light, check how it appears in bright environments.

### 5. Test All Components

Preview your theme and check:
- [ ] Task list
- [ ] Stats panel
- [ ] Modals
- [ ] Notifications
- [ ] Buttons (all states)
- [ ] Input fields
- [ ] Progress bars

---

## Sharing Themes

### Export

```javascript
const theme = await ThemeManager.loadTheme('my-theme');
const json = ThemeManager.exportTheme(theme);
console.log(json); // Copy this
```

### Import

```javascript
const json = `{ "id": "imported-theme", ... }`;
const theme = ThemeManager.importTheme(json);
ThemeManager.applyTheme(theme);
```

---

## Troubleshooting

### Theme Not Loading

1. Check JSON syntax is valid (use [JSONLint](https://jsonlint.com/))
2. Ensure `id` matches filename (e.g., `my-theme.json` has `"id": "my-theme"`)
3. Check browser console for errors

### Colors Not Applying

1. Token path might be wrong - check spelling
2. CSS variables might not be mapped - check theme-manager.js
3. Try a hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Inconsistent Appearance

1. Some components might not use theme variables yet
2. Check if the component uses CSS variables or hard-coded colors
3. Report missing theme support as a bug

---

## Future Features

These token sections are reserved for future use:

- **typography** - Custom fonts, sizes, weights
- **spacing** - Compact/comfortable density
- **shape** - Border radius styles
- **motion** - Animation speed and style
- **effects** - Shadows, blur, glassmorphism

They're defined in the schema but not yet implemented. Stay tuned!

---

**Questions?** Open an issue on GitHub or check the [Theme Architecture](./future-work/THEME_ARCHITECTURE.md) doc for technical details.
