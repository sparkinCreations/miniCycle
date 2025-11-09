# Theme Architecture for miniCycle

**Version**: 2.0 (Improved)
**Created**: 2024-11-09
**Purpose**: Scalable theming system for unlimited theme creation

---

## Philosophy

**Themes should be**:
- ✅ Easy to create (just define colors/values)
- ✅ Impossible to break (validated structure)
- ✅ Discoverable (see all themeable properties)
- ✅ Hot-swappable (no page reload needed)
- ✅ Maintainable (add new properties in one place)

---

## Proposed Architecture

### Layered System

```
themes/
├── _base/
│   ├── theme-template.css          # Template showing all themeable properties
│   ├── theme-tokens.json           # Schema/documentation
│   └── theme-validator.js          # Optional: validate theme completeness
├── definitions/
│   ├── default.json                # Theme as data
│   ├── dark.json
│   ├── ocean.json
│   ├── golden.json
│   └── [future-themes].json        # Easy to add more!
├── compiled/
│   ├── theme-default.css           # Generated from JSON
│   ├── theme-dark.css
│   ├── theme-ocean.css
│   └── theme-golden.css
└── theme-builder.js                # Build script: JSON → CSS
```

---

## Theme Token Schema

### theme-tokens.json (Source of Truth)

```json
{
  "schema": "1.0",
  "description": "Defines all themeable properties in miniCycle",
  "categories": {
    "brand": {
      "description": "Primary brand colors",
      "tokens": {
        "primary": {
          "type": "color",
          "default": "#4c79ff",
          "description": "Main brand color"
        },
        "primaryLight": {
          "type": "color",
          "default": "#74c0fc",
          "description": "Lighter variant of primary"
        },
        "accent": {
          "type": "color",
          "default": "#007BFF",
          "description": "Accent color for CTAs"
        }
      }
    },
    "backgrounds": {
      "description": "Background colors and gradients",
      "tokens": {
        "body": {
          "type": "gradient",
          "default": "linear-gradient(135deg, #4c79ff, #74c0fc)",
          "description": "Main app background"
        },
        "surface": {
          "type": "color",
          "default": "#ffffff",
          "description": "Card/surface background"
        },
        "surfaceOpacity": {
          "type": "opacity",
          "default": "0.95",
          "description": "Surface transparency"
        }
      }
    },
    "header": {
      "description": "Header/navigation styling",
      "tokens": {
        "bg": {
          "type": "color",
          "default": "#5680ff",
          "description": "Header background"
        },
        "border": {
          "type": "color",
          "default": "rgba(255, 255, 255, 0.2)",
          "description": "Header border color"
        },
        "text": {
          "type": "color",
          "default": "#ffffff",
          "description": "Header text color"
        }
      }
    },
    "text": {
      "description": "Typography colors",
      "tokens": {
        "primary": {
          "type": "color",
          "default": "#ffffff",
          "description": "Primary text color"
        },
        "secondary": {
          "type": "color",
          "default": "#e0e0e0",
          "description": "Secondary text color"
        },
        "onSurface": {
          "type": "color",
          "default": "#333333",
          "description": "Text on white surfaces"
        }
      }
    },
    "semantic": {
      "description": "Semantic colors (success, warning, error)",
      "tokens": {
        "success": {
          "type": "color",
          "default": "#28a745",
          "description": "Success state color"
        },
        "warning": {
          "type": "color",
          "default": "#ffc107",
          "description": "Warning state color"
        },
        "error": {
          "type": "color",
          "default": "#dc3545",
          "description": "Error state color"
        }
      }
    },
    "effects": {
      "description": "Shadows, overlays, etc.",
      "tokens": {
        "shadowSoft": {
          "type": "shadow",
          "default": "0 2px 4px rgba(0, 0, 0, 0.1)",
          "description": "Subtle shadow"
        },
        "shadowMedium": {
          "type": "shadow",
          "default": "0 4px 10px rgba(0, 0, 0, 0.3)",
          "description": "Standard shadow"
        },
        "overlayBg": {
          "type": "color",
          "default": "rgba(0, 0, 0, 0.5)",
          "description": "Modal overlay background"
        }
      }
    }
  }
}
```

---

## Theme Definition Format

### Example: ocean.json

```json
{
  "name": "Dark Ocean",
  "id": "ocean",
  "author": "miniCycle Team",
  "version": "1.0",
  "darkMode": true,
  "description": "Deep ocean blues with teal accents",
  "preview": {
    "thumbnail": "assets/themes/ocean-preview.png",
    "colors": ["#1a3a4f", "#4ecdc4", "#0c1724"]
  },
  "tokens": {
    "brand": {
      "primary": "#1a3a4f",
      "primaryLight": "#2a5a7f",
      "accent": "#4ecdc4"
    },
    "backgrounds": {
      "body": "linear-gradient(135deg, #0c1724, #1a3a4f)",
      "surface": "#1e2a3a",
      "surfaceOpacity": "0.9"
    },
    "header": {
      "bg": "#1a3a4f",
      "border": "rgba(78, 205, 196, 0.3)",
      "text": "#ffffff"
    },
    "text": {
      "primary": "#ffffff",
      "secondary": "#b0e0e6",
      "onSurface": "#e0f7fa"
    },
    "semantic": {
      "success": "#4ecdc4",
      "warning": "#ffd700",
      "error": "#ff6b6b"
    },
    "effects": {
      "shadowSoft": "0 2px 4px rgba(0, 0, 0, 0.3)",
      "shadowMedium": "0 4px 10px rgba(0, 0, 0, 0.5)",
      "overlayBg": "rgba(12, 23, 36, 0.8)"
    }
  }
}
```

### Example: minimal.json (New theme - easy!)

```json
{
  "name": "Minimal",
  "id": "minimal",
  "author": "You",
  "version": "1.0",
  "darkMode": false,
  "description": "Clean, minimal design",
  "tokens": {
    "brand": {
      "primary": "#000000",
      "primaryLight": "#333333",
      "accent": "#666666"
    },
    "backgrounds": {
      "body": "linear-gradient(135deg, #f5f5f5, #ffffff)",
      "surface": "#ffffff",
      "surfaceOpacity": "1"
    },
    "header": {
      "bg": "#000000",
      "border": "rgba(0, 0, 0, 0.1)",
      "text": "#ffffff"
    },
    "text": {
      "primary": "#000000",
      "secondary": "#666666",
      "onSurface": "#000000"
    },
    "semantic": {
      "success": "#000000",
      "warning": "#666666",
      "error": "#000000"
    },
    "effects": {
      "shadowSoft": "0 1px 3px rgba(0, 0, 0, 0.05)",
      "shadowMedium": "0 2px 8px rgba(0, 0, 0, 0.1)",
      "overlayBg": "rgba(255, 255, 255, 0.9)"
    }
  }
}
```

**That's it! 40 lines to create a complete theme.**

---

## Build Process

### theme-builder.js

```javascript
/**
 * Theme Builder
 * Converts JSON theme definitions to CSS files
 */

const fs = require('fs');
const path = require('path');

// Load theme schema
const schema = require('./themes/_base/theme-tokens.json');

// Build CSS from theme JSON
function buildThemeCSS(themeData) {
  const { id, name, tokens } = themeData;

  let css = `/**\n * Theme: ${name}\n * ID: ${id}\n * Auto-generated from themes/definitions/${id}.json\n * DO NOT EDIT MANUALLY\n */\n\n`;

  css += `[data-theme="${id}"] {\n`;

  // Generate CSS variables from tokens
  for (const [category, values] of Object.entries(tokens)) {
    css += `\n  /* ${category} */\n`;

    for (const [key, value] of Object.entries(values)) {
      const cssVarName = `--theme-${category}-${key}`;
      css += `  ${cssVarName}: ${value};\n`;
    }
  }

  css += `}\n`;

  return css;
}

// Validate theme against schema
function validateTheme(themeData) {
  const errors = [];

  // Check required fields
  if (!themeData.name) errors.push('Missing theme name');
  if (!themeData.id) errors.push('Missing theme id');
  if (!themeData.tokens) errors.push('Missing tokens');

  // Check all required categories exist
  for (const category of Object.keys(schema.categories)) {
    if (!themeData.tokens[category]) {
      errors.push(`Missing category: ${category}`);
    }
  }

  // Check all required tokens exist in each category
  for (const [category, categoryData] of Object.entries(schema.categories)) {
    if (themeData.tokens[category]) {
      for (const tokenName of Object.keys(categoryData.tokens)) {
        if (!themeData.tokens[category][tokenName]) {
          errors.push(`Missing token: ${category}.${tokenName}`);
        }
      }
    }
  }

  return errors;
}

// Build all themes
function buildAllThemes() {
  const definitionsDir = path.join(__dirname, 'themes/definitions');
  const outputDir = path.join(__dirname, 'themes/compiled');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Read all theme definitions
  const themeFiles = fs.readdirSync(definitionsDir).filter(f => f.endsWith('.json'));

  console.log(`🎨 Building ${themeFiles.length} themes...\n`);

  themeFiles.forEach(file => {
    const themePath = path.join(definitionsDir, file);
    const themeData = JSON.parse(fs.readFileSync(themePath, 'utf8'));

    console.log(`Building: ${themeData.name} (${themeData.id})`);

    // Validate
    const errors = validateTheme(themeData);
    if (errors.length > 0) {
      console.error(`❌ Validation failed for ${themeData.name}:`);
      errors.forEach(err => console.error(`   - ${err}`));
      return;
    }

    // Build CSS
    const css = buildThemeCSS(themeData);

    // Write to compiled/
    const outputPath = path.join(outputDir, `theme-${themeData.id}.css`);
    fs.writeFileSync(outputPath, css);

    console.log(`✅ Generated: ${outputPath}`);
  });

  console.log(`\n🎉 All themes built successfully!`);
}

// Run if called directly
if (require.main === module) {
  buildAllThemes();
}

module.exports = { buildThemeCSS, validateTheme, buildAllThemes };
```

---

## Usage in CSS

### Base styles use theme variables

```css
/* styles/layout/header.css */
header {
  background: var(--theme-header-bg);
  border-bottom: 1px solid var(--theme-header-border);
  color: var(--theme-header-text);
}

/* styles/base/reset.css */
body {
  background: var(--theme-backgrounds-body);
  color: var(--theme-text-primary);
}

/* styles/components/tasks.css */
.task-item {
  background: var(--theme-backgrounds-surface);
  color: var(--theme-text-onSurface);
  box-shadow: var(--theme-effects-shadowSoft);
}
```

---

## Theme Switching (JavaScript)

### Current approach (data attribute)

```javascript
function setTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('selectedTheme', themeId);
}

// Load saved theme
const savedTheme = localStorage.getItem('selectedTheme') || 'default';
setTheme(savedTheme);
```

### Enhanced: Theme metadata access

```javascript
// Load all theme metadata
async function loadThemeRegistry() {
  const themes = [
    await fetch('themes/definitions/default.json').then(r => r.json()),
    await fetch('themes/definitions/dark.json').then(r => r.json()),
    await fetch('themes/definitions/ocean.json').then(r => r.json()),
    await fetch('themes/definitions/golden.json').then(r => r.json())
  ];

  return themes;
}

// Display theme picker
async function showThemePicker() {
  const themes = await loadThemeRegistry();

  themes.forEach(theme => {
    const option = document.createElement('div');
    option.className = 'theme-option';
    option.innerHTML = `
      <img src="${theme.preview.thumbnail}" alt="${theme.name}">
      <h3>${theme.name}</h3>
      <p>${theme.description}</p>
      <div class="theme-colors">
        ${theme.preview.colors.map(c => `<span style="background:${c}"></span>`).join('')}
      </div>
    `;
    option.onclick = () => setTheme(theme.id);

    themePickerContainer.appendChild(option);
  });
}
```

---

## Build Scripts

### package.json

```json
{
  "scripts": {
    "build:themes": "node themes/theme-builder.js",
    "watch:themes": "nodemon --watch themes/definitions -e json --exec 'npm run build:themes'",
    "validate:themes": "node themes/theme-builder.js --validate-only",
    "new:theme": "node themes/create-theme-scaffold.js"
  }
}
```

### create-theme-scaffold.js (Helper)

```javascript
/**
 * Interactive theme creator
 * Creates a new theme from template
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function createTheme() {
  console.log('🎨 Create New miniCycle Theme\n');

  const name = await prompt('Theme name: ');
  const id = name.toLowerCase().replace(/\s+/g, '-');
  const description = await prompt('Description: ');
  const darkMode = (await prompt('Is this a dark theme? (y/n): ')) === 'y';

  const template = {
    name,
    id,
    author: "Your Name",
    version: "1.0",
    darkMode,
    description,
    preview: {
      thumbnail: `assets/themes/${id}-preview.png`,
      colors: ["#000000", "#ffffff", "#cccccc"]
    },
    tokens: {
      brand: {
        primary: await prompt('Primary brand color (#hex): '),
        primaryLight: "#cccccc",
        accent: "#007BFF"
      },
      // ... other categories with defaults
    }
  };

  const outputPath = path.join(__dirname, 'themes/definitions', `${id}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(template, null, 2));

  console.log(`\n✅ Theme created: ${outputPath}`);
  console.log(`📝 Edit the file to customize all colors`);
  console.log(`🏗️  Run 'npm run build:themes' to compile`);

  rl.close();
}

createTheme();
```

---

## Benefits of This Approach

### For You (Developer)
1. **Add theme in 5 minutes**: Just create JSON, run build
2. **Validation**: Can't accidentally break themes
3. **Documentation**: Schema shows all themeable properties
4. **Consistency**: All themes have same structure
5. **Version control**: JSON diffs are clean

### For Users
1. **Theme previews**: Can show thumbnail + colors before applying
2. **Theme metadata**: Display author, description
3. **Easy sharing**: Share a JSON file, not CSS
4. **Future**: Could allow user-created themes via UI

### For Maintenance
1. **Add new themeable property once**: Update schema → rebuild all themes
2. **No duplication**: Logic in one place (builder)
3. **Testing**: Can programmatically test all themes render correctly
4. **Migration**: If schema changes, write migration script for all JSONs

---

## Migration Path from Current CSS

### Step 1: Extract Current Themes to JSON

```bash
# Manual process - analyze current CSS themes
# Create JSON for: default, dark, ocean, golden
```

### Step 2: Set Up Build Process

```bash
npm install --save-dev nodemon  # For watch mode
node themes/theme-builder.js    # Generate CSS files
```

### Step 3: Update CSS to Use New Variables

```css
/* Replace */
background: var(--header-bg);

/* With */
background: var(--theme-header-bg);
```

### Step 4: Test Each Theme

```javascript
// Programmatic testing
['default', 'dark', 'ocean', 'golden'].forEach(theme => {
  setTheme(theme);
  // Visual check or screenshot
});
```

### Step 5: Remove Old Theme CSS

Once new system works, delete old scattered theme code.

---

## Advanced: Theme Store (Future)

### Community themes

```javascript
// themes/registry.json
{
  "official": [
    { "id": "default", "url": "themes/compiled/theme-default.css" },
    { "id": "dark", "url": "themes/compiled/theme-dark.css" }
  ],
  "community": [
    {
      "id": "cyberpunk",
      "name": "Cyberpunk 2077",
      "author": "CoolUser123",
      "url": "https://themes.minicycle.com/cyberpunk.json",
      "downloads": 1523,
      "rating": 4.8
    }
  ]
}
```

### Dynamic theme loading

```javascript
async function installTheme(themeUrl) {
  const themeData = await fetch(themeUrl).then(r => r.json());

  // Validate
  const errors = validateTheme(themeData);
  if (errors.length) throw new Error('Invalid theme');

  // Generate CSS
  const css = buildThemeCSS(themeData);

  // Inject into page
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Apply
  setTheme(themeData.id);
}
```

---

## Example: Adding a New Property

### Scenario: Want to make button border radius themeable

**1. Update schema** (`theme-tokens.json`):
```json
{
  "components": {
    "tokens": {
      "buttonRadius": {
        "type": "size",
        "default": "8px",
        "description": "Button border radius"
      }
    }
  }
}
```

**2. Update all theme JSONs** (can script this):
```json
{
  "tokens": {
    "components": {
      "buttonRadius": "8px"  // Each theme sets its value
    }
  }
}
```

**3. Rebuild**:
```bash
npm run build:themes
```

**4. Use in CSS**:
```css
.button {
  border-radius: var(--theme-components-buttonRadius);
}
```

**Done! All themes updated automatically.**

---

## File Structure Summary

```
themes/
├── _base/
│   ├── theme-template.css          # Reference template
│   └── theme-tokens.json           # Schema (source of truth)
├── definitions/                     # 👈 THIS IS WHERE YOU WORK
│   ├── default.json                # ← Edit these JSON files
│   ├── dark.json
│   ├── ocean.json
│   ├── golden.json
│   ├── minimal.json                # ← Easy to add new themes
│   └── your-custom-theme.json
├── compiled/                        # 🤖 AUTO-GENERATED
│   ├── theme-default.css           # ← Don't edit these
│   ├── theme-dark.css
│   ├── theme-ocean.css
│   └── theme-golden.css
├── theme-builder.js                # Build script
└── create-theme-scaffold.js        # Helper script
```

**Workflow**:
1. Edit JSON in `definitions/`
2. Run `npm run build:themes`
3. CSS generated in `compiled/`
4. Never edit `compiled/` files directly

---

## Checklist: Implementing This System

- [ ] Create `themes/` directory structure
- [ ] Write `theme-tokens.json` schema
- [ ] Extract current themes to JSON format
- [ ] Write `theme-builder.js` script
- [ ] Test build process
- [ ] Update CSS to use new variable names
- [ ] Test all themes render correctly
- [ ] Write `create-theme-scaffold.js` helper
- [ ] Document theme creation process
- [ ] (Optional) Create theme preview UI
- [ ] (Optional) Add theme validation to CI/CD

---

**Maintainer**: Update schema when adding themeable properties
**Last Updated**: 2024-11-09
