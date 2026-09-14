#!/usr/bin/env python3
"""
build-visual-map.py — regenerates docs/architecture/diagrams/visual-map-*.svg

    python3 scripts/build-visual-map.py

WHY A GENERATOR
---------------
The docs site is self-hosted Docsify behind a `script-src 'self'` CSP with no
Mermaid plugin, so diagrams have to be static SVG. Hand-written SVG has one
recurring failure: text that escapes its box, because nobody can eyeball a
string width. This script measures every string against a Helvetica width
table, wraps it inside its card, and sizes each card from its content, so a
wording change cannot overflow. Stdlib only, like the validate-*.py scripts.

Edit the diagram functions at the bottom, re-run, and re-open
docs/architecture/CODEBASE_VISUAL_MAP.md. The counts on diagram 1 are the
only volatile numbers — they mirror docs/PROJECT_STATS.md.
"""
import html
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'docs', 'architecture', 'diagrams')

# ---------------------------------------------------------------------------
# Text measurement (Helvetica AFM advance widths, per 1000 em)
# ---------------------------------------------------------------------------
_REG = dict(zip(
    "abcdefghijklmnopqrstuvwxyz",
    [556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500]))
_REG.update(zip(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611]))
_BOLD = dict(zip(
    "abcdefghijklmnopqrstuvwxyz",
    [556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500]))
_BOLD.update(zip(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    [722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611]))
_PUNCT = {' ': 278, '.': 278, ',': 278, ':': 278, ';': 278, '-': 333, '(': 333, ')': 333, '/': 278,
          '_': 556, '[': 278, ']': 278, '{': 334, '}': 334, '·': 278, '→': 1000, '?': 556, '!': 278,
          "'": 191, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, '*': 389, '+': 584, '<': 584,
          '>': 584, '=': 584, '@': 1015, '\\': 278, '^': 469, '`': 333, '|': 260, '~': 584, '—': 1000,
          '–': 556, '≠': 584, '≈': 584, '✓': 750, '…': 1000, '×': 584, '“': 500, '”': 500}
for d in "0123456789":
    _REG[d] = 556
    _BOLD[d] = 556
_REG.update(_PUNCT)
_BOLD.update({k: v + 30 for k, v in _PUNCT.items()})

SAFETY = 1.07  # system-ui on macOS renders slightly wider than Helvetica


def text_w(s, size, bold=False, mono=False):
    if mono:
        return len(s) * 0.62 * size
    table = _BOLD if bold else _REG
    return sum(table.get(c, 620) for c in s) / 1000 * size * SAFETY


def wrap(s, size, maxw, bold=False, mono=False):
    """Greedy word wrap. Returns a list of lines that each fit maxw."""
    words = s.split(' ')
    lines, cur = [], ''
    for w in words:
        cand = w if not cur else cur + ' ' + w
        if text_w(cand, size, bold, mono) <= maxw or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ---------------------------------------------------------------------------
# Palette + typography
# ---------------------------------------------------------------------------
INK = '#1b2540'
BODY = '#2a3550'
MUTED = '#6b7893'
LINE = '#8a97b3'
BORDER = '#d5dbe8'
ACCENT = '#3b63d8'
FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"
MONO = "Menlo, Consolas, 'Courier New', monospace"

KIND = {
    'plain':  dict(fill='#ffffff', stroke=BORDER),
    'accent': dict(fill='#eef3ff', stroke=ACCENT),
    'header': dict(fill='#ffffff', stroke=ACCENT),
    'chip':   dict(fill='#eef3ff', stroke='#c5d3f5'),
    'warn':   dict(fill='#fff7e3', stroke='#e2b93b'),
    'ok':     dict(fill='#e8f5ee', stroke='#7cc49a'),
    'danger': dict(fill='#fdecea', stroke='#e08a84'),
    'code':   dict(fill='#f4f6fa', stroke=BORDER),
    'muted':  dict(fill='#f4f6fa', stroke=BORDER),
}

# style name -> (size, bold, colour, mono)
STYLE = {
    'body':   (11, False, BODY, False),
    'muted':  (10.5, False, MUTED, False),
    'strong': (11, True, INK, False),
    'mono':   (10.5, False, INK, True),
    'danger': (10.5, True, '#b3261e', False),
    'warn':   (10.5, False, '#6b4f00', False),
    'ok':     (10.5, False, '#1e5e3a', False),
    'small':  (9.5, False, MUTED, False),
}
LH = 1.4  # line-height multiplier


def esc(s):
    return html.escape(s, quote=True)


class SVG:
    def __init__(self, width, title):
        self.width = width
        self.title = title
        self.parts = []
        self.height = 0

    def add(self, s):
        self.parts.append(s)

    def render(self, height):
        self.height = height
        head = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.width} {height}" '
            f'width="{self.width}" height="{height}" font-family="{FONT}" font-size="11">\n'
            f'  <title>{esc(self.title)}</title>\n'
            '  <defs>\n'
            '    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            f'<path d="M0,0 L10,5 L0,10 z" fill="{LINE}"/></marker>\n'
            '    <marker id="arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            f'<path d="M0,0 L10,5 L0,10 z" fill="{ACCENT}"/></marker>\n'
            '    <marker id="arrow-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            '<path d="M0,0 L10,5 L0,10 z" fill="#b8860b"/></marker>\n'
            '    <filter id="shadow" x="-5%" y="-5%" width="110%" height="120%">'
            f'<feDropShadow dx="0" dy="1" stdDeviation="1.4" flood-color="{INK}" flood-opacity="0.10"/></filter>\n'
            '  </defs>\n'
            f'  <rect width="{self.width}" height="{height}" rx="16" fill="#f6f7fb"/>\n'
        )
        return head + ''.join(self.parts) + '</svg>\n'


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------
def header(svg, number, title, subtitle):
    """Diagram header: number badge, title, subtitle. Returns the y where content starts."""
    svg.add(f'  <circle cx="44" cy="36" r="15" fill="{ACCENT}"/>\n')
    svg.add(f'  <text x="44" y="41" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff">{number}</text>\n')
    svg.add(f'  <text x="70" y="33" font-size="17" font-weight="700" fill="{INK}">{esc(title)}</text>\n')
    svg.add(f'  <text x="70" y="51" font-size="11.5" fill="{MUTED}">{esc(subtitle)}</text>\n')
    svg.add(f'  <line x1="28" y1="68" x2="{svg.width - 28}" y2="68" stroke="{BORDER}"/>\n')
    return 84


def section(svg, x, y, label, width=None):
    """Small-caps section label with a hairline. Returns next y."""
    svg.add(f'  <text x="{x}" y="{y + 10}" font-size="10.5" font-weight="700" letter-spacing="1.2" fill="{MUTED}">{esc(label.upper())}</text>\n')
    return y + 22


def layout_lines(lines, width, pad):
    """Expand (text, style) entries into wrapped rows. Returns [(row_text, style)]."""
    rows = []
    for entry in lines:
        if entry is None:
            rows.append(('', 'gap'))
            continue
        text, style = entry if isinstance(entry, tuple) else (entry, 'body')
        size, bold, _, mono = STYLE[style]
        for r in wrap(text, size, width - 2 * pad, bold, mono):
            rows.append((r, style))
    return rows


def measure_card(width, title=None, lines=(), pad=12, band=False, title_size=12, gap_after_title=4):
    h = pad
    if band:
        h = 26 + pad - 4
    elif title:
        h += title_size * 1.15 + gap_after_title
    for _, style in layout_lines(lines, width, pad):
        if style == 'gap':
            h += 5
        else:
            h += STYLE[style][0] * LH
    return h + pad - 2


def card(svg, x, y, width, title=None, lines=(), kind='plain', pad=12, band=False,
         title_size=12, height=None, center=False, badge=None, shadow=True, gap_after_title=4):
    """Draw a card. Height auto-sizes to content unless given. Returns the height drawn."""
    h = height or measure_card(width, title, lines, pad, band, title_size, gap_after_title)
    k = KIND[kind]
    filt = ' filter="url(#shadow)"' if shadow else ''
    svg.add(f'  <g data-box="1">\n')
    svg.add(f'    <rect x="{x}" y="{y}" width="{width}" height="{h:.1f}" rx="10" fill="{k["fill"]}" stroke="{k["stroke"]}"{filt}/>\n')
    cy = y + pad
    anchor = ' text-anchor="middle"' if center else ''
    tx = x + width / 2 if center else x + pad
    if band:
        svg.add(f'    <path d="M{x},{y + 10} a10,10 0 0 1 10,-10 h{width - 20} a10,10 0 0 1 10,10 v16 h-{width} z" fill="{ACCENT}"/>\n')
        if badge is not None:
            svg.add(f'    <circle cx="{x + 16}" cy="{y + 13}" r="9" fill="#ffffff"/>\n')
            svg.add(f'    <text x="{x + 16}" y="{y + 16.5}" text-anchor="middle" font-size="10" font-weight="700" fill="{ACCENT}">{badge}</text>\n')
            svg.add(f'    <text x="{x + 32}" y="{y + 17.5}" font-size="{title_size}" font-weight="700" fill="#ffffff">{esc(title)}</text>\n')
        else:
            svg.add(f'    <text x="{x + width / 2}" y="{y + 17.5}" text-anchor="middle" font-size="{title_size}" font-weight="700" fill="#ffffff">{esc(title)}</text>\n')
        cy = y + 26 + pad - 4
    elif title:
        if badge is not None:
            svg.add(f'    <circle cx="{x + pad + 9}" cy="{cy + title_size * 0.45}" r="9" fill="{ACCENT}"/>\n')
            svg.add(f'    <text x="{x + pad + 9}" y="{cy + title_size * 0.45 + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="#ffffff">{badge}</text>\n')
            svg.add(f'    <text x="{x + pad + 24}" y="{cy + title_size * 0.9}" font-size="{title_size}" font-weight="700" fill="{INK}">{esc(title)}</text>\n')
        else:
            svg.add(f'    <text x="{tx}" y="{cy + title_size * 0.9}"{anchor} font-size="{title_size}" font-weight="700" fill="{INK}">{esc(title)}</text>\n')
        cy += title_size * 1.15 + gap_after_title
    for row, style in layout_lines(lines, width, pad):
        if style == 'gap':
            cy += 5
            continue
        size, bold, colour, mono = STYLE[style]
        fw = ' font-weight="700"' if bold else ''
        ff = f' font-family="{MONO}"' if mono else ''
        svg.add(f'    <text x="{tx}" y="{cy + size * 0.95:.1f}"{anchor} xml:space="preserve" font-size="{size}"{fw}{ff} fill="{colour}">{esc(row)}</text>\n')
        cy += size * LH
    svg.add('  </g>\n')
    return h


def chip(svg, x, y, width, text, kind='chip', height=24, bold=True, size=10.5, colour=None):
    k = KIND[kind]
    col = colour or (INK if kind in ('chip', 'plain', 'muted', 'code') else {'ok': '#1e5e3a', 'warn': '#6b4f00', 'danger': '#b3261e', 'accent': ACCENT}[kind])
    svg.add('  <g data-box="1">\n')
    svg.add(f'    <rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{height / 2}" fill="{k["fill"]}" stroke="{k["stroke"]}"/>\n')
    fw = ' font-weight="700"' if bold else ''
    svg.add(f'    <text x="{x + width / 2}" y="{y + height / 2 + size * 0.35:.1f}" text-anchor="middle" font-size="{size}"{fw} fill="{col}">{esc(text)}</text>\n')
    svg.add('  </g>\n')


def chip_auto(svg, x, y, text, kind='chip', height=22, size=10, bold=False, padx=10):
    w = text_w(text, size, bold) + 2 * padx
    chip(svg, x, y, w, text, kind, height, bold, size)
    return w


def arrow(svg, x1, y1, x2, y2, label=None, dashed=False, marker='arrow', colour=LINE, width=1.5):
    dash = ' stroke-dasharray="4 3"' if dashed else ''
    svg.add(f'  <path d="M{x1},{y1} L{x2},{y2}" stroke="{colour}" stroke-width="{width}" fill="none"{dash} marker-end="url(#{marker})"/>\n')
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        lw = text_w(label, 9.5) + 8
        svg.add(f'  <rect x="{mx - lw / 2}" y="{my - 14}" width="{lw:.1f}" height="14" rx="4" fill="#f6f7fb"/>\n')
        svg.add(f'  <text x="{mx}" y="{my - 3.5}" text-anchor="middle" font-size="9.5" fill="{MUTED}">{esc(label)}</text>\n')


def elbow(svg, points, dashed=False, marker='arrow', colour=LINE, width=1.5, label=None, label_at=None):
    d = 'M' + ' L'.join(f'{x},{y}' for x, y in points)
    dash = ' stroke-dasharray="4 3"' if dashed else ''
    svg.add(f'  <path d="{d}" stroke="{colour}" stroke-width="{width}" fill="none"{dash} marker-end="url(#{marker})"/>\n')
    if label:
        lx, ly = label_at
        lw = text_w(label, 9.5) + 8
        svg.add(f'  <rect x="{lx - lw / 2}" y="{ly - 10}" width="{lw:.1f}" height="14" rx="4" fill="#f6f7fb"/>\n')
        svg.add(f'  <text x="{lx}" y="{ly}" text-anchor="middle" font-size="9.5" fill="{MUTED}">{esc(label)}</text>\n')


def footer(svg, y, items, note=None):
    """'Read next' strip. Returns bottom y."""
    lines = [('Read next:  ' + '  ·  '.join(items), 'body')]
    if note:
        lines.append((note, 'small'))
    h = card(svg, 28, y, svg.width - 56, lines=lines, kind='accent', pad=10, shadow=False)
    return y + h


def row_cards(svg, x, y, total_w, specs, gap=14, kind='plain', band=False, arrows=True, equal=True, pad=12, badges=False):
    """Draw a row of cards of equal height. specs: [(title, lines)] or [(title, lines, kind)]."""
    n = len(specs)
    w = (total_w - gap * (n - 1)) / n
    heights = [measure_card(w, s[0], s[1], pad, band) for s in specs]
    h = max(heights) if equal else None
    xs = []
    for i, s in enumerate(specs):
        cx = x + i * (w + gap)
        k = s[2] if len(s) > 2 else kind
        card(svg, cx, y, w, s[0], s[1], k, pad, band, height=h, badge=(i + 1) if badges else None)
        xs.append(cx)
        if arrows and i < n - 1:
            arrow(svg, cx + w + 1, y + (h or heights[i]) / 2, cx + w + gap - 1, y + (h or heights[i]) / 2)
    return h or max(heights), w, xs


def write(name, svg, height):
    path = os.path.join(OUT, name)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(svg.render(height))
    print('wrote', os.path.relpath(path, os.path.dirname(HERE)), f'({height}px tall)')


# ---------------------------------------------------------------------------
# Diagram 1 — layers
# ---------------------------------------------------------------------------
def diagram_layers():
    svg = SVG(1000, 'miniCycle codebase layers: HTML gauntlet, entrypoint, three boot phases, module directories, persistence')
    y = header(svg, 1, 'The codebase in five layers',
               'What loads, in what order, and where the code and the data live. Follow the spine top to bottom.')
    LX, CX, CW = 28, 190, 782  # label column, content x, content width
    spine_x = 60
    band_tops = []

    def band_label(y0, n, name, hint):
        band_tops.append(y0 + 14)
        svg.add(f'  <circle cx="{spine_x}" cy="{y0 + 14}" r="13" fill="{ACCENT}"/>\n')
        svg.add(f'  <text x="{spine_x}" y="{y0 + 18.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff">{n}</text>\n')
        svg.add(f'  <text x="{spine_x + 22}" y="{y0 + 11}" font-size="12.5" font-weight="700" fill="{INK}">{esc(name)}</text>\n')
        for i, l in enumerate(wrap(hint, 10, CX - spine_x - 34)):
            svg.add(f'  <text x="{spine_x + 22}" y="{y0 + 26 + i * 13}" font-size="10" fill="{MUTED}">{esc(l)}</text>\n')

    # Band 1 — gauntlet
    band_label(y, 1, 'miniCycle.html', 'ordered head scripts, ES5 only above the gate')
    specs = [
        ('version.js?v=', [('publishes APP_VERSION', 'muted')]),
        ('pre-paint settings', [('theme applied before first paint', 'muted')]),
        ('modulepreload', [('hashed URLs from the module map', 'muted')]),
        ('es2020 canary', [('?. and ?? parse whole or die whole', 'muted')]),
        ('feature gate', [('runs LAST, alone in its block', 'muted')], 'accent'),
    ]
    h, w, xs = row_cards(svg, CX, y, CW, specs, gap=16)
    gate_cx = xs[-1] + w / 2
    elbow(svg, [(gate_cx, y + h), (gate_cx, y + h + 22)], dashed=True, marker='arrow-warn', colour='#b8860b')
    pill_w = text_w('old browser → lite/ (frozen fallback)', 10) + 20
    chip(svg, gate_cx - pill_w / 2, y + h + 24, pill_w, 'old browser → lite/ (frozen fallback)', kind='warn', height=22, bold=False, size=10)
    y += h + 66

    # Band 2 — entrypoint
    band_label(y, 2, 'Entrypoint', 'one file, one dynamic import')
    a_w, b_w = 250, 300
    ha = card(svg, CX, y, a_w, 'miniCycle-main.js', [('the only script the HTML loads', 'muted')])
    arrow(svg, CX + a_w + 1, y + ha / 2, CX + a_w + 60 - 1, y + ha / 2, label='import()')
    card(svg, CX + a_w + 60, y, b_w, 'modules/boot/orchestrator.js', [('sequence · timeouts · retry · boot UI', 'muted')], height=ha)
    y += ha + 30

    # Band 3 — phases
    band_label(y, 3, 'Boot phases', 'each phase has a timeout')
    specs = [
        ('Phase 1 · coreBoot.js', [('AppState, GlobalUtils, migration', 'body'), ('waitForCore() resolves here', 'muted'), ('first run: state is still null (by design)', 'warn')]),
        ('Phase 2 · featureBoot.js', [('moduleLoader reads moduleManifests.js', 'body'), ('topological sort · 8 load phases', 'muted'), ('all dependency wiring happens here', 'ok')]),
        ('Phase 3 · uiBoot.js', [('event listeners, UI finalisation', 'body'), ('loader hidden, app interactive', 'muted'), ('sets the appBooted flag', 'muted')]),
    ]
    h, w, xs = row_cards(svg, CX, y, CW, specs, gap=16, band=True)
    y += h + 30

    # Band 4 — modules
    band_label(y, 4, 'modules/', '158 modules, strict DI, no window.* fallbacks')
    dirs = [('core/', 9, 'appState, diBase, constants'), ('boot/', 7, 'orchestrator, loader, manifests'),
            ('task/', 13, 'CRUD, DOM, events, drag'), ('routine/', 10, 'switcher, loader, modes'),
            ('recurring/', 18, 'watcher, matcher, panel'), ('ui/', 45, 'modals, menus, settings, undo'),
            ('features/', 12, 'themes, stats, history'), ('utils/', 25, 'notifications, device, icons'),
            ('labels/', 3, 'defaultLabels, getLabel()'), ('storage/', 2, 'IndexedDB backup, persist'),
            ('testing/', 9, 'in-app test modal'), ('platform/', 1, 'capacitorBridge'),
            ('progress/ · other/', 4, 'cycle completion · plugins')]
    cols, gap = 5, 12
    w = (CW - gap * (cols - 1)) / cols
    ch = 44
    for i, (name, count, hint) in enumerate(dirs):
        cx = CX + (i % cols) * (w + gap)
        cy = y + (i // cols) * (ch + 10)
        svg.add('  <g data-box="1">\n')
        svg.add(f'    <rect x="{cx}" y="{cy}" width="{w:.1f}" height="{ch}" rx="8" fill="#ffffff" stroke="{BORDER}" filter="url(#shadow)"/>\n')
        svg.add(f'    <text x="{cx + 10}" y="{cy + 18}" font-size="11.5" font-weight="700" fill="{INK}">{esc(name)}</text>\n')
        pw = text_w(str(count), 10, True) + 12
        svg.add(f'    <rect x="{cx + w - 10 - pw:.1f}" y="{cy + 8}" width="{pw:.1f}" height="16" rx="8" fill="#eef3ff"/>\n')
        svg.add(f'    <text x="{cx + w - 10 - pw / 2:.1f}" y="{cy + 19.5}" text-anchor="middle" font-size="10" font-weight="700" fill="{ACCENT}">{count}</text>\n')
        svg.add(f'    <text x="{cx + 10}" y="{cy + 34}" font-size="10" fill="{MUTED}">{esc(hint)}</text>\n')
        svg.add('  </g>\n')
    y += 3 * (ch + 10) + 20

    # Band 5 — persistence
    band_label(y, 5, 'Persistence', 'one document, one write path')
    specs = [
        ('AppState', [('single Schema 2.5 document', 'body'), ('get() live ref · update() only writer', 'muted')]),
        ('localStorage', [('primary store', 'body'), ('600 ms debounced save', 'muted')]),
        ('IndexedDB', [('backupManager mirror', 'body'), ('undo snapshots', 'muted')]),
        ('service-worker.js', [('offline shell', 'body'), ('BOOT_CRITICAL precache', 'muted')]),
    ]
    h, w, xs = row_cards(svg, CX, y, CW, specs, gap=16, arrows=False)
    for i in range(2):
        arrow(svg, xs[i] + w + 1, y + h / 2, xs[i + 1] - 1, y + h / 2)
    y += h + 26

    # spine through the badges
    for a, b in zip(band_tops, band_tops[1:]):
        svg.add(f'  <line x1="{spine_x}" y1="{a + 13}" x2="{spine_x}" y2="{b - 13}" stroke="{ACCENT}" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/>\n')

    y = footer(svg, y, ['MODULE_LOADER_GUIDE.md', 'DI_PATTERNS.md', 'DATA_SCHEMA_GUIDE.md', 'FOLDER_STRUCTURE.md'],
               note='Directory counts are from v2.560 — the live numbers are in PROJECT_STATS.md')
    write('visual-map-01-layers.svg', svg, int(y + 28))


# ---------------------------------------------------------------------------
# Diagram 2 — boot sequence
# ---------------------------------------------------------------------------
def diagram_boot():
    svg = SVG(1000, 'miniCycle boot sequence: three orchestrator phases, the eight loader phases inside Phase 2, and the per-module lifecycle')
    y = header(svg, 2, 'Boot sequence', 'orchestrator.js runBootSequence(): three timed phases, then what happens to every module inside Phase 2.')
    X, W = 28, 944

    # timeline
    rail_y = y + 8
    svg.add(f'  <line x1="{X + 20}" y1="{rail_y}" x2="{X + W - 20}" y2="{rail_y}" stroke="{BORDER}" stroke-width="6" stroke-linecap="round"/>\n')
    specs = [
        ('Phase 1 · Core', [('coreBoot.js · 15 s timeout', 'muted'), ('AppState.init, GlobalUtils, migration', 'body')]),
        ('Server version gate', [('fetch overlaps Phase 1', 'muted'), ('stale build → updating overlay', 'body')], 'muted'),
        ('Phase 2 · Features', [('featureBoot.js · 20 s timeout', 'muted'), ('dialog modals injected, then the loader', 'body')], 'accent'),
        ('Phase 3 · UI', [('uiBoot.js · 15 s timeout', 'muted'), ('listeners wired, loader hidden', 'body')]),
    ]
    y = rail_y + 16
    h, w, xs = row_cards(svg, X, y, W, specs, gap=16, arrows=False, pad=12)
    for i, cx in enumerate(xs):
        col = ACCENT if i != 1 else '#9aa9c7'
        svg.add(f'  <circle cx="{cx + w / 2}" cy="{rail_y}" r="7" fill="{col}" stroke="#f6f7fb" stroke-width="2"/>\n')
    y += h + 26

    # Phase 2 expansion
    p2x = xs[2] + w / 2
    elbow(svg, [(p2x, y - 26), (p2x, y - 6)], marker='arrow-accent', colour=ACCENT)
    y = section(svg, X, y, 'Inside Phase 2 — moduleLoader walks moduleManifests.js in eight load phases')
    phases = [('CORE_UTILS', 'errors · labels · notify'), ('THEME_VISUAL', 'themes · onboarding'), ('TASK_MGMT', 'taskDOM · drag-drop'),
              ('RECURRING', 'recurring · due dates'), ('CYCLE', 'routines · modes'), ('UI_MANAGERS', 'menu · settings · undo'),
              ('FEATURES', 'stats · help · effects'), ('TESTING', 'optional · may fail')]
    gap = 8
    pw = (W - gap * 7) / 8
    ph = 48
    for i, (name, hint) in enumerate(phases):
        cx = X + i * (pw + gap)
        k = KIND['chip'] if i < 7 else KIND['muted']
        svg.add('  <g data-box="1">\n')
        svg.add(f'    <rect x="{cx:.1f}" y="{y}" width="{pw:.1f}" height="{ph}" rx="8" fill="{k["fill"]}" stroke="{k["stroke"]}"/>\n')
        svg.add(f'    <circle cx="{cx + 14:.1f}" cy="{y + 15}" r="8" fill="{ACCENT if i < 7 else "#9aa9c7"}"/>\n')
        svg.add(f'    <text x="{cx + 14:.1f}" y="{y + 18.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#ffffff">{i + 1}</text>\n')
        svg.add(f'    <text x="{cx + 27:.1f}" y="{y + 19}" font-size="10" font-weight="700" fill="{INK}">{esc(name)}</text>\n')
        svg.add(f'    <text x="{cx + 10:.1f}" y="{y + 37}" font-size="9.5" fill="{MUTED}">{esc(hint)}</text>\n')
        svg.add('  </g>\n')
        if i < 7:
            svg.add(f'  <path d="M{cx + pw + 1:.1f},{y + ph / 2} L{cx + pw + gap - 1:.1f},{y + ph / 2}" stroke="{LINE}" stroke-width="1.2"/>\n')
    y += ph + 12
    svg.add(f'  <text x="{X}" y="{y + 10}" font-size="10.5" fill="{MUTED}">{esc("Modules in one phase import in parallel. Wiring and init run one at a time, so same-phase providers have registered before a consumer wires.")}</text>\n')
    y += 34

    # lifecycle
    y = section(svg, X, y, 'Per-module lifecycle — loadModule() then initializeModule()')
    specs = [
        ('import()', [('manifest.path with ?v=', 'muted'), ('perf mark recorded', 'muted')]),
        ('build deps', [('only what the manifest declares', 'muted'), ('ENFORCE_REQUIRES on', 'mono')]),
        ('setXDependencies()', [('Object.defineProperties', 'mono'), ('getters stay lazy', 'muted')]),
        ('init(deps)', [('constructs the instance', 'muted'), ('facades load sub-modules here', 'muted')]),
        ('registerProvides()', [('provides[] → deps.api', 'mono'), ('instance → deps.api.x', 'mono')]),
    ]
    h, w, xs = row_cards(svg, X, y, W, specs, gap=34, badges=True, pad=11)
    y += h + 26

    # notes
    half = (W - 16) / 2
    h1 = card(svg, X, y, half, 'Core-ready is not state-ready', [
        ('After waitForCore() a returning user has data and isReady() is true. A first-run user has data = null: get() returns null and update() is a no-op until the first-run screen persists a routine.', 'warn'),
        None,
        ('Guard reads; do not assume writes land. Do not make waitForCore() await isReady() — that deadlocks boot (measured Aug 2026). Pinned by the first-run state contract journey.', 'warn'),
    ], kind='warn')
    h2 = card(svg, X + half + 16, y, half, 'Safety nets around the sequence', [
        ('16 s late fallback: gate wanted lite, or boot never started → lite/', 'ok'),
        ('60 s load timeout: #app-loader still visible → lite/', 'ok'),
        ('Boot failure counter: 2 consecutive failures → caches cleared, retry', 'ok'),
        ('destroyAllModules() on retry calls every module\'s destroy()', 'ok'),
        None,
        ('Phase timeouts live in core/constants.js (BOOT_TIMEOUTS).', 'muted'),
    ], kind='ok')
    y += max(h1, h2) + 20
    y = footer(svg, y, ['MODULE_LOADER_GUIDE.md', 'APPINIT_EXPLAINED.md', 'APPINIT_SYSTEM.md', 'ERROR_RECOVERY.md'])
    write('visual-map-02-boot.svg', svg, int(y + 28))


# ---------------------------------------------------------------------------
# Diagram 3 — DI pipeline
# ---------------------------------------------------------------------------
def diagram_di():
    svg = SVG(1000, 'miniCycle dependency injection: the four-step pipeline a dependency travels, where a miss fails silently, the facade forward-through, and the gates')
    y = header(svg, 3, 'How a dependency reaches module code', 'Four layers, in order. Miss any one and the module sees undefined — no error, no warning.')
    X, W = 28, 944

    specs = [
        ('Manifest declares', [('boot/moduleManifests.js', 'mono'), None,
                               ('requires — same or earlier phase', 'body'), ('optionalDeps — cross-phase, may be null', 'body'), ('lazyRequires — later phase, called late', 'body'),
                               None, ('DOM helpers (CORE_DEPS) need no entry', 'muted')]),
        ('depMappings routes', [('boot/featureBoot.js', 'mono'), None,
                                ('name → resolver, usually a late-binding wrapper:', 'body'), ('(...a)=>deps.task?.X?.(...a)', 'mono'),
                                None, ('resolves on first call, not at wire time', 'muted')]),
        ('Setter accepts', [('setMyModuleDependencies()', 'mono'), None,
                            ('generated by createDIModule() in diBase.js', 'body'), ('copies property descriptors so getters stay lazy', 'body'),
                            None, ('never spread deps — a spread runs the getters now', 'danger')]),
        ('deps getter exposes', [('get deps() → di.resolve()', 'mono'), None,
                                 ('required() missing → warns, resolves null', 'body'), ('optional(default) missing → the default', 'body'), ('{ strict: true } → throws instead', 'body'),
                                 None, ('check the getter really exposes the name', 'muted')]),
    ]
    h, w, xs = row_cards(svg, X, y, W, specs, gap=24, band=True, badges=True, pad=12)
    y += h + 22

    # rule 19 + module code
    left_w = 600
    right_w = W - left_w - 16
    mc_x = X + left_w + 16
    elbow(svg, [(xs[3] + w / 2, y - 22), (xs[3] + w / 2, y - 4)], marker='arrow-accent', colour=ACCENT)
    h1 = card(svg, X, y, left_w, 'Rule 19 — never optional-chain a required() dep', [
        ('deps.thing?.() on a required dep writes a branch that only runs when wiring is broken, and that branch does nothing: the feature is quietly missing.', 'warn'),
        None,
        ('v2.418 lost import-mode, share-mode and theme-on-import for a day exactly this way, and a runtime audit found it, not a test. Let it throw where it happens so the failure names itself. validate:chains gates it (catch blocks exempt).', 'warn'),
    ], kind='warn')
    h2 = card(svg, mc_x, y, right_w, 'Module code', [
        ('this.deps.showNotification(m)', 'mono'), ('// required: read unguarded', 'muted'), None,
        ('this.deps.helpWindow?.open()', 'mono'), ('// optional: a guard is fine', 'muted'),
    ], kind='code')
    y += max(h1, h2) + 26

    # facades
    y = section(svg, X, y, 'Facades forward deps to sub-modules the manifest never lists (on purpose — listing them double-initialises)')
    fx_w = 210
    hf = card(svg, X, y, fx_w, 'taskDOM (facade)', [
        ('its manifest optionalDeps carry forward-through names it never calls itself', 'body'), None,
        ('wireSubModuleDependencies()', 'mono'),
    ])
    sub_x = X + fx_w + 40
    subs = ['taskRenderer', 'taskEvents', 'taskValidation', 'taskUtils']
    sh = 22
    total = len(subs) * sh + (len(subs) - 1) * 6
    sy = y + (hf - total) / 2
    for i, s in enumerate(subs):
        cy = sy + i * (sh + 6)
        chip(svg, sub_x, cy, 118, s, kind='plain', height=sh, bold=False, size=10.5)
        elbow(svg, [(X + fx_w + 1, y + hf / 2), (X + fx_w + 20, y + hf / 2), (X + fx_w + 20, cy + sh / 2), (sub_x - 1, cy + sh / 2)])
    tbl_x = sub_x + 118 + 24
    tbl_w = X + W - tbl_x
    rows = [
        ('settingsManager', 'settingsUI · cycleExport · cycleImport · backupRestore · dataSanitizer · shareManager'),
        ('taskCore', 'taskCRUD · taskCompletion · taskCycleReset'),
        ('taskDOM', 'taskRenderer · taskEvents · taskValidation · taskUtils'),
        ('preferencesManager', 'bgImage · presets'),
        ('statsPanel', 'gestures · rewards  (reach the manager via this.m)'),
        ('notifications', 'educationalTips  — STATIC import'),
        ('onboardingManager', 'splash · demo · carousel  — STATIC imports'),
        ('routineSwitcher', 'routineSwitcherActions  — STATIC import'),
    ]
    lines = []
    for f, s in rows:
        lines.append((f, 'strong'))
        lines.append((s, 'muted'))
    # two columns inside the table card: draw manually
    pad = 12
    col_w = (tbl_w - 3 * pad) / 2
    rh = 37
    th = pad + 18 + 4 * rh + pad - 8
    svg.add('  <g data-box="1">\n')
    svg.add(f'    <rect x="{tbl_x}" y="{y}" width="{tbl_w:.1f}" height="{th}" rx="10" fill="#ffffff" stroke="{BORDER}" filter="url(#shadow)"/>\n')
    svg.add(f'    <text x="{tbl_x + pad}" y="{y + pad + 9}" font-size="12" font-weight="700" fill="{INK}">The eight facades and what each one loads</text>\n')
    for i, (f, s) in enumerate(rows):
        cx = tbl_x + pad + (i // 4) * (col_w + pad)
        cy = y + pad + 22 + (i % 4) * rh
        svg.add(f'    <text x="{cx:.1f}" y="{cy + 9}" font-size="10.5" font-weight="700" fill="{INK}">{esc(f)}</text>\n')
        for j, l in enumerate(wrap(s, 9.5, col_w)[:2]):
            svg.add(f'    <text x="{cx:.1f}" y="{cy + 21 + j * 11}" font-size="9.5" fill="{MUTED}">{esc(l)}</text>\n')
    svg.add('  </g>\n')
    y += max(hf, th) + 12
    svg.add(f'  <text x="{X}" y="{y + 10}" font-size="10.5" fill="{MUTED}">{esc("A static import from a boot-critical module makes the target boot-critical too — add it to BOOT_CRITICAL in service-worker.js and run npm run test:sw.")}</text>\n')
    y += 34

    # gates
    y = section(svg, X, y, 'Gates that make each failure class impossible to ship')
    specs = [
        ('validate:di', [('undeclared · nowhere · undeliverable = 0', 'ok')], 'ok'),
        ('validate:chains', [('no ?. on a required() dep', 'ok')], 'ok'),
        ('validate:provides', [('every provides name exists; no duplicates', 'ok')], 'ok'),
        ('validate:api', [('appContext reads resolve; *ApiObj are allow-lists', 'ok')], 'ok'),
        ('diWiring tests', [('runtime: every optionalDep has a real route', 'ok')], 'ok'),
    ]
    h, w, xs = row_cards(svg, X, y, W, specs, gap=12, arrows=False, pad=10)
    y += h + 20
    y = footer(svg, y, ['MAKING_CODE_CHANGES.md', 'DI_PATTERNS.md', 'HIDDEN_CODEBASE_INSIGHTS.md', 'DEPENDENCY_MAP.md'],
               note='DI is the third architecture. Plain ES imports were tried in Nov 2025 and split instances across ?v= URLs — do not propose going back.')
    write('visual-map-03-di-pipeline.svg', svg, int(y + 28))


# ---------------------------------------------------------------------------
# Diagram 4 — state flow
# ---------------------------------------------------------------------------
def diagram_state():
    svg = SVG(1000, 'miniCycle state flow: one task completion from tap to persisted state and re-render')
    y = header(svg, 4, 'One interaction, end to end', 'The user completes a task. Everything that writes state goes through the same door.')
    X, W = 28, 944
    c1, c2, c3 = 330, 280, 300
    g = (W - c1 - c2 - c3) / 2
    x1, x2, x3 = X, X + c1 + g, X + c1 + g + c2 + g

    # left column — flow
    top = y
    steps = [
        ('Tap on a task row', [('delegated click handler in taskDOM / taskEvents', 'muted')], 'plain'),
        ('handleTaskCompletionChange(checkbox)', [('task/taskCompletion.js, behind the taskCore facade', 'muted')], 'plain'),
        ('captureStateSnapshot(currentState)', [('undo system · skipped while an undo/redo is running', 'muted')], 'plain'),
        ('AppState.update(producer, immediate?)', [
            ('1  oldData = structuredClone(this.data)', 'body'),
            ('2  producer(this.data) mutates in place', 'body'),
            ('3  metadata.lastModified + lastModifiedBy (tab id)', 'body'),
            ('4  scheduleSave(immediate) — 600 ms debounce', 'body'),
            ('5  notifyListeners(new, old)', 'body'),
            None,
            ('on throw: data = oldData, error notification, rethrow', 'danger'),
        ], 'accent'),
        ('Follow-ups in the same handler', [('handleTaskListMovement · checkOverdueTasks', 'muted'), ('watchRecurringTasks · helpWindowManager hints', 'muted')], 'plain'),
    ]
    ys = []
    for title, lines, kind in steps:
        h = card(svg, x1, y, c1, title, lines, kind=kind, badge=len(ys) + 1)
        ys.append((y, h))
        y += h + 22
    for (a, ha), (b, hb) in zip(ys, ys[1:]):
        arrow(svg, x1 + c1 / 2, a + ha + 1, x1 + c1 / 2, b - 1)
    left_bottom = y - 22
    upd_y, upd_h = ys[3]

    # middle column
    y = upd_y
    hs = card(svg, x2, y, c2, 'save() → localStorage', [('then backupManager mirrors to IndexedDB', 'muted')])
    arrow(svg, x1 + c1 + 1, upd_y + hs / 2, x2 - 1, upd_y + hs / 2)
    y += hs + 14
    hl = card(svg, x2, y, c2, 'Subscribers — AppState.subscribe()', [
        ('undoRedoManager — tracks the transaction', 'body'),
        ('dailyResetManager — schedule checks', 'body'),
        ('focusTaskPanel — re-reads its task', 'body'),
        ('onboardingManager · demo · carousel', 'body'),
    ])
    y += hl + 14
    hr = card(svg, x2, y, c2, 'Rendering is explicit', [
        ('Not a subscriber. Callers re-render through refreshUIFromState() or renderTasks() after the update resolves.', 'muted'),
    ], kind='muted')
    mid_bottom = y + hr

    # right column — state tree
    y = top
    tree = [
        'state.schemaVersion   "2.5"',
        'state.metadata        { lastModified }',
        'state.appState.activeCycleId',
        'state.data.cycles[id]',
        '  .title              (no `name`)',
        '  .tasks[]            Task objects',
        '  .cycleCount         resets so far',
        '  .recurringTemplates keyed by taskId',
        '  .history            { events[] }',
        '  .clearedTasks       { entries[] }',
        'state.settings        theme, darkMode',
        'state.userProgress    milestones',
        'state.achievements    { unlocked[] }',
    ]
    ht = card(svg, x3, y, c3, 'The Schema 2.5 document', [(t, 'mono') for t in tree] + [None, ('full reference: reference/DATA_SCHEMA_GUIDE.md', 'small')], kind='code', pad=12)
    y += ht + 14
    hw = card(svg, x3, y, c3, 'Rules this flow enforces', [
        ('get() is a live reference. Mutate it before update() and the undo snapshot is already wrong (rule 13).', 'warn'), None,
        ('Never count or read completion from the DOM: it holds only the active routine\'s rendered rows (rule 14).', 'warn'), None,
        ('User text goes through textContent, never innerHTML (rule 7).', 'warn'),
    ], kind='warn')
    right_bottom = y + hw

    y = max(left_bottom, mid_bottom, right_bottom) + 22
    h = card(svg, X, y, W, 'Why one door matters', [
        ('Undo, autosave, multi-tab metadata and the error rollback all hang off update(). A new writer inherits all four for free. dataAccess.js (loadMiniCycleData, autoSave) is a legacy wrapper around the same state — read it, do not add consumers.', 'ok'),
    ], kind='ok')
    y += h + 20
    y = footer(svg, y, ['DATA_SCHEMA_GUIDE.md', 'UNDO_REDO_ARCHITECTURE.md', 'HISTORY_SYSTEM.md', 'EVENT_LISTENER_GUIDE.md', 'ASYNC_UI_PATTERNS.md'])
    write('visual-map-04-state-flow.svg', svg, int(y + 28))


# ---------------------------------------------------------------------------
# Diagram 5 — shipping
# ---------------------------------------------------------------------------
def diagram_shipping():
    svg = SVG(1000, 'miniCycle shipping pipeline: local loop, validation gates, the release script, CI, the Netlify build, and the live surfaces')
    y = header(svg, 5, 'From edit to production', 'A push to main is a deploy. App code ships only through the release script.')
    X, W = 28, 944

    # row 1
    lw = 230
    hl = card(svg, X, y, lw, 'Local loop (from web/)', [('npm start → localhost:8080', 'mono'), ('npm test — 3665 tests', 'mono'), ('npm run lint', 'mono')], badge=1)
    gx = X + lw + 30
    gw = X + W - gx
    hg = card(svg, gx, y, gw, 'Gates — each exists because the bug it blocks once shipped', [
        ('validate:  csp · html · docs · di · comments · builtins · labels · keys · chains · api · inline · cache · provides · reset', 'ok'),
        ('test:  sw (precache drift) · layout (7 viewports) · meta · journey · a11y · changelog', 'ok'),
        None,
        ('All run in CI (test.yml). validate:csp is the hard pre-push gate. Reference: working-on-code/VALIDATION_GATES.md', 'muted'),
    ], kind='ok', badge=2)
    h = max(hl, hg)
    arrow(svg, X + lw + 1, y + hl / 2, gx - 1, y + hl / 2)
    y += h + 24

    # release script
    elbow(svg, [(X + W / 2, y - 24), (X + W / 2, y - 4)], marker='arrow-accent', colour=ACCENT)
    stages = [('version.js', 'APP + CACHE version'), ('stamps', 'SW · HTML · CSS · manifests'), ('stats', 'collect-stats → PROJECT_STATS'),
              ('validation', 'then a restore script'), ('CSP hashes', 'inline scripts → netlify.toml'), ('changelog · tag · push', 'pre-push CSP gate first')]
    pad = 14
    inner_w = W - 2 * pad
    gap = 10
    sw = (inner_w - gap * 5) / 6
    sh = 46
    notes = [
        ('A bare git push of app code is a half-dark deploy: hashed bundles and HTML disagree, caches overwrite non-atomically, and there is no version signal.', 'danger'),
        ('Docs-only pushes are fine. After every --push confirm that git rev-list --left-right --count origin/main...HEAD prints 0 0 — the tag can push even when the branch is rejected.', 'muted'),
        ('Platform snapshots on demand: --chrome (extension), --ios and --android (Capacitor). Web deploys continuously; platforms lag by design.', 'muted'),
    ]
    rows = layout_lines(notes, W, pad)
    notes_h = sum(STYLE[s][0] * LH for _, s in rows) + 6
    rh = 26 + pad + sh + 12 + notes_h + pad
    svg.add('  <g data-box="1">\n')
    svg.add(f'    <rect x="{X}" y="{y}" width="{W}" height="{rh:.1f}" rx="10" fill="#ffffff" stroke="{ACCENT}" filter="url(#shadow)"/>\n')
    svg.add(f'    <path d="M{X},{y + 10} a10,10 0 0 1 10,-10 h{W - 20} a10,10 0 0 1 10,10 v16 h-{W} z" fill="{ACCENT}"/>\n')
    svg.add(f'    <circle cx="{X + 16}" cy="{y + 13}" r="9" fill="#ffffff"/>\n')
    svg.add(f'    <text x="{X + 16}" y="{y + 16.5}" text-anchor="middle" font-size="10" font-weight="700" fill="{ACCENT}">3</text>\n')
    svg.add(f'    <text x="{X + 32}" y="{y + 17.5}" font-size="12" font-weight="700" fill="#ffffff">{esc("cd web && ./scripts/update-version.sh --auto --push --changelog   — the only way app code ships")}</text>\n')
    svg.add('  </g>\n')
    sy = y + 26 + pad
    for i, (t, sub) in enumerate(stages):
        cx = X + pad + i * (sw + gap)
        svg.add('  <g data-box="1">\n')
        svg.add(f'    <rect x="{cx:.1f}" y="{sy}" width="{sw:.1f}" height="{sh}" rx="8" fill="#eef3ff" stroke="#c5d3f5"/>\n')
        svg.add(f'    <text x="{cx + sw / 2:.1f}" y="{sy + 19}" text-anchor="middle" font-size="10.5" font-weight="700" fill="{INK}">{esc(t)}</text>\n')
        svg.add(f'    <text x="{cx + sw / 2:.1f}" y="{sy + 35}" text-anchor="middle" font-size="9.5" fill="{MUTED}">{esc(sub)}</text>\n')
        svg.add('  </g>\n')
        if i < 5:
            svg.add(f'  <path d="M{cx + sw + 1:.1f},{sy + sh / 2} L{cx + sw + gap - 1:.1f},{sy + sh / 2}" stroke="{LINE}" stroke-width="1.2" marker-end="url(#arrow)"/>\n')
    cy = sy + sh + 12
    svg.add('  <g data-box="1">\n')
    svg.add(f'    <rect x="{X + 1}" y="{cy - 4}" width="{W - 2}" height="{notes_h + 4:.1f}" fill="none" stroke="none"/>\n')
    for row, style in rows:
        size, bold, colour, mono = STYLE[style]
        fw = ' font-weight="700"' if bold else ''
        svg.add(f'    <text x="{X + pad}" y="{cy + size * 0.95:.1f}" font-size="{size}"{fw} fill="{colour}">{esc(row)}</text>\n')
        cy += size * LH
    svg.add('  </g>\n')
    y += rh + 24

    # row 3
    elbow(svg, [(X + W / 2, y - 24), (X + W / 2, y - 4)], marker='arrow-accent', colour=ACCENT)
    w1, w3 = 210, 240
    w2 = W - w1 - w3 - 2 * 30
    h1 = card(svg, X, y, w1, 'GitHub main', [('CI: .github/workflows/test.yml', 'body'), ('5 suites + every validator', 'body'), None, ('CI reports; it does not gate. Netlify builds in parallel.', 'muted')], badge=4)
    h2 = card(svg, X + w1 + 30, y, w2, 'Netlify build — repo-root netlify.toml is the authority', [
        ('node scripts/build-web.cjs → web/dist/', 'mono'),
        ('dist/build/** — every JS entry, chunk and the CSS bundle, content-hashed', 'body'),
        ('dist/modules/**.js — stable-path shims (export * from the hashed file)', 'body'),
        ('HTML rewritten to hashed URLs; inline script bytes untouched, so CSP holds', 'body'),
        ('docs/ curated (no archive, future-work, incidents) · stats.json · SW precache list', 'body'),
    ], badge=5)
    h3 = card(svg, X + w1 + 30 + w2 + 30, y, w3, 'Live surfaces', [
        ('miniCycle.app — production PWA', 'body'), ('docs.minicycle.app — this docs site', 'body'),
        ('test.minicycle.app — staging + in-app tests', 'body'), ('minicycleapp.com — product page', 'body'), None,
        ('web/_redirects owns path redirects', 'muted'),
    ], badge=6)
    h = max(h1, h2, h3)
    arrow(svg, X + w1 + 1, y + h / 2, X + w1 + 30 - 1, y + h / 2)
    arrow(svg, X + w1 + 30 + w2 + 1, y + h / 2, X + w1 + 30 + w2 + 30 - 1, y + h / 2)
    y += h + 24

    # row 4
    half = (W - 16) / 2
    h1 = card(svg, X, y, half, 'Verify a deploy by artifact shape, never by version number', [
        ('HTML script src points into /build/ with a hash', 'warn'),
        ('/package.json returns 404 — source files are not served', 'warn'),
        ('HTML routes carry a short cache; validate:cache guards the /* catch-all', 'warn'), None,
        ('Details: deployment/BUILD_PROCESS.md', 'muted'),
    ], kind='warn')
    h2 = card(svg, X + half + 16, y, half, 'What the client does on its next visit', [
        ('service-worker.js serves the shell cache-first for an instant open', 'body'),
        ('version.js?v= is fetched live; verifyVersionFresh() compares and heals', 'body'),
        ('old HTML can only name old hashes, so a mixed module graph cannot exist', 'body'), None,
        ('Details: deployment/SERVICE_WORKER_UPDATE_STRATEGY.md', 'muted'),
    ], kind='accent')
    y += max(h1, h2) + 20
    y = footer(svg, y, ['BUILD_PROCESS.md', 'UPDATE-VERSION-GUIDE.md', 'VALIDATION_GATES.md', 'SERVICE_WORKER_UPDATE_STRATEGY.md', 'DEPLOYMENT.md'])
    write('visual-map-05-shipping.svg', svg, int(y + 28))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    diagram_layers()
    diagram_boot()
    diagram_di()
    diagram_state()
    diagram_shipping()
