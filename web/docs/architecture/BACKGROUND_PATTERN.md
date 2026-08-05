# Background Pattern System

**Last Updated:** August 5, 2026

The stationery-themed background pattern in miniCycle (pencils, notebooks, coffee cups, etc.).

> **Where it lives now:** the default pattern is a plain, readable SVG file at
> `assets/images/pattern.svg`, referenced by `styles/base/background.css`
> (`body::before` — position:fixed so it stays locked in place on mobile
> touch-drag). A URL-encoded copy of the same pattern lives in
> `generatePatternSvg()` in `modules/ui/preferencesManager.js` — used when the
> user customizes pattern color/opacity in Personalization. Each non-classic
> vocab theme also has its own pattern file (`pattern-habit-tracker.svg`,
> `pattern-fitness.svg`, `pattern-scholar.svg`, `pattern-cleaning.svg`),
> selected via `html[data-vocab-theme="..."]` rules in `background.css`.

---

## Quick Start: Common Tasks

### Change the pattern opacity (visibility)

**File:** `assets/images/pattern.svg`

1. Find the `stroke='rgba(255,255,255,0.07)'` on the outer `<g>` group
2. Change `0.07` to your desired value:
   - `0.05` = more subtle
   - `0.07` = current (7% white)
   - `0.10` = more visible
3. **Also update the template** in `generatePatternSvg()`
   (`modules/ui/preferencesManager.js`) if the shapes change — otherwise the
   user-customized pattern drifts from the default one. (Users can also set
   pattern color/opacity themselves in Personalization; the default opacity for
   that path is `DEFAULT_PATTERN_OPACITY` in `preferencesManager.js`.)
4. Dark mode additionally dims the pattern via `body.dark-mode::before { opacity: 0.45; }` in `background.css`

### Turn off the pattern

Users can toggle this in **Menu > Personalization > Background Pattern**.

In code, the `body.no-bg-pattern` class hides it.

### Change tile size (how spread out elements are)

**File:** `styles/base/background.css`

1. Search for `background-size: 400px 400px`
2. Change both values:
   - `300px 300px` = more dense/repetitive
   - `500px 500px` = more spread out
3. Keep both values equal for square tiles
4. **Update both occurrences** (the base `body::before` rule and the
   `body.custom-pattern` rule)

---

## The Pattern at a Glance

| Element | Location in Pattern | What It Looks Like |
|---------|--------------------|--------------------|
| Pencil | Upper-left | Hexagonal pencil with wood grain |
| Paperclip | Upper-right | Curved wire paperclip |
| Notepad (spiral) | Upper-center | Notepad with binding holes and ruled lines |
| Crayon/Pen | Right-middle | Pen-like crayon with clip and grip texture |
| Eraser/Highlighter | Left-middle | Capped stick (labeled "Eraser" in the SVG) |
| Notebook | Center-bottom | Open notebook with spine and page lines |
| Checkbox | Lower-right | Checked checkbox |
| Coffee mug | Lower-left | Cup with saucer and steam |

(Names in parentheses match the `<!-- comments -->` inside `pattern.svg`.)

### Visual Layout

```
+-------------------+-------------------+
|                   |                   |
|   PENCIL          |      PAPERCLIP    |
|                   |                   |
+--------+----------+----------+--------+
|        |   SPIRAL NOTEBOOK   |        |
|        +----------+----------+        |
| HIGH-  |                     |  PEN   |
| LIGHTER|                     |        |
|        |                     |        |
+--------+----------+----------+--------+
|        |     BOOK            |CHECKBOX|
| COFFEE |                     |        |
|  CUP   |                     |        |
+-------------------+-------------------+
```

---

## How to Edit the Pattern

The default pattern is a plain SVG file — no encoding workflow needed.

### Step 1: Edit `assets/images/pattern.svg`

It's readable XML:
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <g fill="none" stroke="rgba(255,255,255,0.07)" ...>
    <!-- Pencil (top-left) -->
    <g transform="rotate(-12 20 28)">
      ...
    </g>
    <!-- More elements -->
  </g>
</svg>
```

Each element is inside a `<g>` tag with a `transform` that positions it.

### Step 2: Keep the custom-color template in sync

`generatePatternSvg()` in `modules/ui/preferencesManager.js` contains an inline
copy of the same SVG (single-quoted attributes, `encodeURIComponent`-ed at
runtime). It's used when the user picks a custom pattern color/opacity in
Personalization. If you change shapes in `pattern.svg`, mirror the change in
this template — otherwise the customized pattern won't match the default one.

### Step 3: Consider the per-theme patterns

The vocab themes each ship their own tile (`pattern-habit-tracker.svg`,
`pattern-fitness.svg`, `pattern-scholar.svg`, `pattern-cleaning.svg` in
`assets/images/`). Structural changes (tile size, stroke conventions) should
usually be applied to all of them.

---

## Element Reference

Each element below shows the decoded SVG code. Copy and modify as needed.

### Pencil
**Position:** `rotate(-12 20 28)` (upper-left, tilted -12 degrees)

```xml
<g transform='rotate(-12 20 28)'>
  <path d='M15 5 L15 28 L18 32 L21 28 L21 5 L18 2 Z'/>  <!-- body -->
  <path d='M15 5 L21 5'/>                                <!-- ferrule band -->
  <path d='M15.5 7 L20.5 7'/>                            <!-- ferrule detail -->
  <rect x='15' y='28' width='6' height='2' rx='0.5'/>    <!-- eraser holder -->
  <line x1='18' y1='32' x2='18' y2='35'/>                <!-- tip -->
  <path d='M16 8 L16 26 M18 8 L18 26 M20 8 L20 26' stroke-width='0.5'/> <!-- wood grain -->
</g>
```

### Paperclip
**Position:** `rotate(18 155 22)` (upper-right, tilted 18 degrees)

```xml
<g transform='rotate(18 155 22)'>
  <path d='M148 6 C146 6 145 8 145 10 L145 14 C145 18 149 18 149 14 L149 10 C149 8 151 8 151 10 L151 22 C151 26 145 26 145 22 L145 12'/>
</g>
```

### Spiral Notebook
**Position:** `rotate(-6 95 32)` (upper-center, tilted -6 degrees)

```xml
<g transform='rotate(-6 95 32)'>
  <rect x='78' y='12' width='28' height='36' rx='2'/>     <!-- cover -->
  <circle cx='82' cy='16' r='1.5'/>                       <!-- binding holes -->
  <circle cx='82' cy='22' r='1.5'/>
  <circle cx='82' cy='28' r='1.5'/>
  <circle cx='82' cy='34' r='1.5'/>
  <circle cx='82' cy='40' r='1.5'/>
  <line x1='86' y1='18' x2='102' y2='18'/>                <!-- ruled lines -->
  <line x1='86' y1='24' x2='102' y2='24'/>
  <line x1='86' y1='30' x2='98' y2='30'/>
  <line x1='86' y1='36' x2='100' y2='36'/>
  <line x1='86' y1='42' x2='94' y2='42'/>
</g>
```

### Pen/Marker
**Position:** `rotate(15 175 95)` (right-middle, tilted 15 degrees)

```xml
<g transform='rotate(15 175 95)'>
  <path d='M168 70 L168 103 L171 107 L174 103 L174 70 L171 67 Z'/> <!-- body -->
  <path d='M168 70 L174 70'/>                             <!-- cap line -->
  <rect x='168' y='72' width='6' height='4' rx='0.5'/>    <!-- clip -->
  <path d='M167 77 L167 87 M167 82 L165 82' stroke-width='1'/> <!-- grip -->
  <line x1='171' y1='107' x2='171' y2='111'/>             <!-- tip -->
</g>
```

### Highlighter
**Position:** `rotate(-18 18 125)` (left-middle, tilted -18 degrees)

```xml
<g transform='rotate(-18 18 125)'>
  <rect x='8' y='100' width='10' height='32' rx='2'/>     <!-- body -->
  <rect x='9' y='130' width='8' height='6' rx='1'/>       <!-- cap -->
  <rect x='10' y='132' width='6' height='4'/>             <!-- chisel tip -->
  <path d='M11 104 L11 112 M15 104 L15 112' stroke-width='0.8'/> <!-- grip lines -->
  <rect x='8' y='98' width='10' height='3' rx='1'/>       <!-- top cap -->
</g>
```

### Book
**Position:** `rotate(8 90 135)` (center-bottom, tilted 8 degrees)

```xml
<g transform='rotate(8 90 135)'>
  <path d='M65 115 Q65 112 68 112 L98 112 Q101 112 101 115 L101 145 Q101 148 98 148 L68 148 Q65 148 65 145 Z'/> <!-- cover -->
  <path d='M65 115 L65 145 Q65 148 68 148' stroke-width='2'/> <!-- spine -->
  <path d='M68 112 L68 148'/>                             <!-- spine edge -->
  <line x1='72' y1='119' x2='97' y2='119'/>               <!-- page lines -->
  <line x1='72' y1='125' x2='97' y2='125'/>
  <line x1='72' y1='131' x2='91' y2='131'/>
  <line x1='72' y1='137' x2='95' y2='137'/>
</g>
```

### Checkbox
**Position:** `rotate(-8 160 150)` (lower-right, tilted -8 degrees)

```xml
<g transform='rotate(-8 160 150)'>
  <rect x='148' y='138' width='18' height='18' rx='3'/>   <!-- outer box -->
  <rect x='150' y='140' width='14' height='14' rx='2' stroke-width='0.8'/> <!-- inner box -->
  <path d='M153 148 L156 151 L162 143' stroke-width='1.8'/> <!-- checkmark -->
</g>
```

### Coffee Cup
**Position:** `rotate(5 42 175)` (lower-left, tilted 5 degrees)

```xml
<g transform='rotate(5 42 175)'>
  <ellipse cx='42' cy='190' rx='12' ry='3'/>              <!-- saucer -->
  <path d='M32 190 L32 173 Q32 168 37 168 L47 168 Q52 168 52 173 L52 190'/> <!-- cup body -->
  <path d='M52 178 Q58 178 58 183 Q58 188 52 186'/>       <!-- handle -->
  <path d='M38 165 Q42 162 46 165' stroke-width='0.8'/>   <!-- steam -->
  <path d='M36 162 Q42 158 48 162' stroke-width='0.8'/>
  <path d='M39 159 Q42 156 45 159' stroke-width='0.8'/>
</g>
```

---

## Adding a New Element

1. **Open** `assets/images/pattern.svg`
2. **Create** your element inside a `<g>` tag:
   ```xml
   <g transform='rotate(ANGLE X Y)'>
     <!-- your shapes here -->
   </g>
   ```
3. **Position** it by choosing X, Y coordinates that don't overlap existing elements (see layout diagram above)
4. **Rotate** it slightly (5-20 degrees) for visual variety
5. **Mirror** the addition into the `generatePatternSvg()` template in `modules/ui/preferencesManager.js` (and the per-theme pattern SVGs if applicable)

### Transform Explained

```xml
<g transform='rotate(ANGLE X Y)'>
```

- `ANGLE` = rotation in degrees (negative = counter-clockwise)
- `X, Y` = the center point of rotation (where the element sits in the 200x200 grid)

---

## Full SVG

The canonical source is `assets/images/pattern.svg` — edit it directly. The
copy below is kept for reference (shapes as of Aug 2026):

```xml
<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>
  <g fill='none' stroke='rgba(255,255,255,0.07)' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'>

    <!-- Pencil -->
    <g transform='rotate(-12 20 28)'>
      <path d='M15 5 L15 28 L18 32 L21 28 L21 5 L18 2 Z'/>
      <path d='M15 5 L21 5'/>
      <path d='M15.5 7 L20.5 7'/>
      <rect x='15' y='28' width='6' height='2' rx='0.5'/>
      <line x1='18' y1='32' x2='18' y2='35'/>
      <path d='M16 8 L16 26 M18 8 L18 26 M20 8 L20 26' stroke-width='0.5'/>
    </g>

    <!-- Paperclip -->
    <g transform='rotate(18 155 22)'>
      <path d='M148 6 C146 6 145 8 145 10 L145 14 C145 18 149 18 149 14 L149 10 C149 8 151 8 151 10 L151 22 C151 26 145 26 145 22 L145 12'/>
    </g>

    <!-- Spiral Notebook -->
    <g transform='rotate(-6 95 32)'>
      <rect x='78' y='12' width='28' height='36' rx='2'/>
      <circle cx='82' cy='16' r='1.5'/>
      <circle cx='82' cy='22' r='1.5'/>
      <circle cx='82' cy='28' r='1.5'/>
      <circle cx='82' cy='34' r='1.5'/>
      <circle cx='82' cy='40' r='1.5'/>
      <line x1='86' y1='18' x2='102' y2='18'/>
      <line x1='86' y1='24' x2='102' y2='24'/>
      <line x1='86' y1='30' x2='98' y2='30'/>
      <line x1='86' y1='36' x2='100' y2='36'/>
      <line x1='86' y1='42' x2='94' y2='42'/>
    </g>

    <!-- Pen/Marker -->
    <g transform='rotate(15 175 95)'>
      <path d='M168 70 L168 103 L171 107 L174 103 L174 70 L171 67 Z'/>
      <path d='M168 70 L174 70'/>
      <rect x='168' y='72' width='6' height='4' rx='0.5'/>
      <path d='M167 77 L167 87 M167 82 L165 82' stroke-width='1'/>
      <line x1='171' y1='107' x2='171' y2='111'/>
    </g>

    <!-- Highlighter -->
    <g transform='rotate(-18 18 125)'>
      <rect x='8' y='100' width='10' height='32' rx='2'/>
      <rect x='9' y='130' width='8' height='6' rx='1'/>
      <rect x='10' y='132' width='6' height='4'/>
      <path d='M11 104 L11 112 M15 104 L15 112' stroke-width='0.8'/>
      <rect x='8' y='98' width='10' height='3' rx='1'/>
    </g>

    <!-- Book -->
    <g transform='rotate(8 90 135)'>
      <path d='M65 115 Q65 112 68 112 L98 112 Q101 112 101 115 L101 145 Q101 148 98 148 L68 148 Q65 148 65 145 Z'/>
      <path d='M65 115 L65 145 Q65 148 68 148' stroke-width='2'/>
      <path d='M68 112 L68 148'/>
      <line x1='72' y1='119' x2='97' y2='119'/>
      <line x1='72' y1='125' x2='97' y2='125'/>
      <line x1='72' y1='131' x2='91' y2='131'/>
      <line x1='72' y1='137' x2='95' y2='137'/>
    </g>

    <!-- Checkbox -->
    <g transform='rotate(-8 160 150)'>
      <rect x='148' y='138' width='18' height='18' rx='3'/>
      <rect x='150' y='140' width='14' height='14' rx='2' stroke-width='0.8'/>
      <path d='M153 148 L156 151 L162 143' stroke-width='1.8'/>
    </g>

    <!-- Coffee Cup -->
    <g transform='rotate(5 42 175)'>
      <ellipse cx='42' cy='190' rx='12' ry='3'/>
      <path d='M32 190 L32 173 Q32 168 37 168 L47 168 Q52 168 52 173 L52 190'/>
      <path d='M52 178 Q58 178 58 183 Q58 188 52 186'/>
      <path d='M38 165 Q42 162 46 165' stroke-width='0.8'/>
      <path d='M36 162 Q42 158 48 162' stroke-width='0.8'/>
      <path d='M39 159 Q42 156 45 159' stroke-width='0.8'/>
    </g>

  </g>
</svg>
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Pattern not showing | Check if `body.no-bg-pattern` class is set, or if a background image overrides it (`body.has-bg-image` hides the pattern) |
| Custom-colored pattern doesn't match default | The `generatePatternSvg()` template in `preferencesManager.js` is out of sync with `pattern.svg` |
| Encoding errors (custom-color path) | The template is `encodeURIComponent`-ed at runtime — keep single-quoted attributes, avoid raw `#` in colors inside the template string |
| Elements overlapping | Adjust the X, Y values in the transform |

---

## Technical Details

### Why an external SVG file?

- Only ~3-4KB, cached like any static asset
- Readable/editable in place (no encode/decode workflow)
- Browser tiles it efficiently via GPU
- Lives on `body::before` (position:fixed) so it stays locked in place during mobile touch-drag

The custom-color path (Personalization) still uses an inline
`data:image/svg+xml` URL — it has to, since the color/opacity are generated at
runtime and applied via the `--custom-pattern-bg` variable.

### File locations

| What | Where |
|------|-------|
| Default pattern SVG | `assets/images/pattern.svg` |
| Per-theme pattern SVGs | `assets/images/pattern-{habit-tracker,fitness,scholar,cleaning}.svg` |
| CSS rules (tiling, theme switching, dark-mode dimming) | `styles/base/background.css` |
| Custom color/opacity template + toggle | `modules/ui/preferencesManager.js` (`generatePatternSvg()`) |
| User docs | `docs/reference/FEATURE_LIST.md` |

### Global SVG properties

The `<g>` wrapper sets defaults for all elements:

```xml
<g fill='none'                           <!-- outlines only, no fill -->
   stroke='rgba(255,255,255,0.07)'       <!-- 7% white -->
   stroke-width='1.2'                    <!-- line thickness -->
   stroke-linecap='round'                <!-- rounded line ends -->
   stroke-linejoin='round'>              <!-- rounded corners -->
```

---

*Update this doc when the pattern changes.*
