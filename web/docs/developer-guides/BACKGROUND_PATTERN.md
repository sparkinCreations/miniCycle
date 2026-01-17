# Background Pattern System

**Last Updated:** January 17, 2026

The stationery-themed background pattern in miniCycle (pencils, notebooks, coffee cups, etc.).

---

## Quick Start: Common Tasks

### Change the pattern opacity (visibility)

**File:** `styles/base/reset.css`

1. Search for `rgba(255,255,255,0.07)`
2. Change `0.07` to your desired value:
   - `0.05` = more subtle
   - `0.07` = current (7% white)
   - `0.10` = more visible
3. **Update both occurrences** (lines ~25 and ~36)

### Turn off the pattern

Users can toggle this in **Menu > Personalization > Background Pattern**.

In code, the `body.no-bg-pattern` class hides it.

### Change tile size (how spread out elements are)

**File:** `styles/base/reset.css`

1. Search for `background-size: 400px 400px`
2. Change both values:
   - `300px 300px` = more dense/repetitive
   - `500px 500px` = more spread out
3. Keep both values equal for square tiles

---

## The Pattern at a Glance

| Element | Location in Pattern | What It Looks Like |
|---------|--------------------|--------------------|
| Pencil | Upper-left | Hexagonal pencil with wood grain |
| Paperclip | Upper-right | Curved wire paperclip |
| Spiral Notebook | Upper-center | Notebook with binding holes and ruled lines |
| Pen | Right-middle | Pen with clip and grip texture |
| Highlighter | Left-middle | Highlighter with cap |
| Book | Center-bottom | Open book with spine and page lines |
| Checkbox | Lower-right | Checked checkbox |
| Coffee Cup | Lower-left | Cup with saucer and steam |

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

The pattern is an SVG stored as a URL-encoded string. Here's the workflow:

### Step 1: Decode the SVG

The pattern in `reset.css` looks like this (unreadable):
```
url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org...
```

**To decode it:**

Open browser console and paste:
```javascript
// Copy the encoded string (everything after "data:image/svg+xml," and before the closing ")
const encoded = `%3Csvg xmlns=...%3E`;  // paste here
console.log(decodeURIComponent(encoded));
```

Or use an online tool like [urlencoder.org](https://www.urlencoder.org/).

### Step 2: Edit the SVG

Once decoded, you'll see readable SVG:
```xml
<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>
  <g fill='none' stroke='rgba(255,255,255,0.07)' ...>
    <!-- Pencil -->
    <g transform='rotate(-12 20 28)'>
      ...
    </g>
    <!-- More elements -->
  </g>
</svg>
```

Each element is inside a `<g>` tag with a `transform` that positions it.

### Step 3: Re-encode the SVG

After editing:
```javascript
const svg = `<svg>...</svg>`;  // your edited SVG
console.log(encodeURIComponent(svg));
```

### Step 4: Update reset.css

1. Replace the old encoded string with your new one
2. **Update BOTH occurrences** (lines ~25 and ~36)

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

1. **Decode** the existing SVG (see workflow above)
2. **Create** your element inside a `<g>` tag:
   ```xml
   <g transform='rotate(ANGLE X Y)'>
     <!-- your shapes here -->
   </g>
   ```
3. **Position** it by choosing X, Y coordinates that don't overlap existing elements (see layout diagram above)
4. **Rotate** it slightly (5-20 degrees) for visual variety
5. **Re-encode** and update both occurrences in reset.css

### Transform Explained

```xml
<g transform='rotate(ANGLE X Y)'>
```

- `ANGLE` = rotation in degrees (negative = counter-clockwise)
- `X, Y` = the center point of rotation (where the element sits in the 200x200 grid)

---

## Full Decoded SVG

Copy this for major edits:

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
| Pattern not showing | Check if `body.no-bg-pattern` class is set, or if a background image overrides it |
| Pattern looks broken after edit | Make sure you updated **both** occurrences in reset.css |
| Encoding errors | Check for unescaped `<`, `>`, or `#` characters |
| Elements overlapping | Adjust the X, Y values in the transform |

---

## Technical Details

### Why inline SVG?

- No extra HTTP request (loads with CSS)
- Only ~3-4KB
- Browser tiles it efficiently via GPU
- Single parse, then cached

### File locations

| What | Where |
|------|-------|
| Pattern definition | `styles/base/reset.css` (lines ~25 and ~36) |
| Pattern toggle | `modules/ui/preferencesManager.js` |
| User docs | `docs/features/FEATURE_LIST.md` |

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
