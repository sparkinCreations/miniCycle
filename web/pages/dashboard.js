// dashboard.js — miniCycle's private dashboard for landing-page views and clicks
//
// Consumes the aggregated payload from netlify/functions/track.js:
//   { timezone, generatedAt, events: {key: record}, pageviews: {key: record} }
//   record = { total, daily: {"YYYY-MM-DD": n}, hourly: {"YYYY-MM-DD": {"14": n}},
//              hours: n[24], weekdays: n[7], recent: [] }
//
// Pages are data-driven: every pageview key is a page, and a click belongs to
// the page whose key prefixes its name ("product-app-launch" → "product"). A
// new tracked page therefore shows up here without a code change.
//
// PRIVACY: the function stores hit counts only — no visitor, session, referrer
// or device. Every rate on this page is hits ÷ hits, never a per-person rate.
// See web/legal/privacy.html before adding anything that needs more than that.

(() => {
    'use strict';

    const API_URL = '/.netlify/functions/track';
    const REFRESH_INTERVAL_MS = 60_000;
    const REMEMBER_KEY = 'minicycle.dashboard.secret';
    const RANGE_KEY = 'minicycle.dashboard.range';
    const PAGE_KEY = 'minicycle.dashboard.page';
    const THEME_KEY = 'minicycle.dashboard.theme';
    const DAY_MS = 86_400_000;
    const DEFAULT_RANGE_DAYS = 30;
    const MAX_SPAN_DAYS = 400;      // matches the function's daily-bucket retention
    const WEEKLY_ABOVE_DAYS = 92;   // longer spans are charted by week
    const WEEKLY_ABOVE_DAYS_NARROW = 45;
    const DENSE_ABOVE_COLUMNS = 45;
    const TOP_CLICKS_LIMIT = 10;
    const SPARK_MIN_CLICKS = 10;
    const RECENT_LIMIT = 40;
    const OTHER_PAGE = '~other';    // "~" is stripped by the function, so it can't collide
    const NARROW_QUERY = '(max-width: 640px)';

    // Fixed colour slots. A page keeps its colour whatever the filter or its rank.
    const KNOWN_PAGES = [
        { key: 'product', label: 'Product page', color: 'var(--series-1)' },
        { key: 'learn-more', label: 'Learn More', color: 'var(--series-2)' },
        { key: 'mcyc-format', label: '.mcyc format', color: 'var(--series-3)' },
    ];
    const EXTRA_PAGE_COLOR = 'var(--series-4)';
    const OTHER_COLOR = 'var(--series-other)';

    const THEMES = ['auto', 'light', 'dark'];
    const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let secret = '';
    let selectedDays = DEFAULT_RANGE_DAYS;   // null = all time
    let selectedPage = null;                 // null = all pages
    let theme = 'auto';
    let showAllClicks = false;
    let lastData = null;                     // last good payload, for re-render + error fallback
    let lastUpdatedText = '';

    const $ = (id) => document.getElementById(id);
    const els = {
        authScreen: $('authScreen'),
        authError: $('authError'),
        authForm: $('authForm'),
        secretInput: $('secretInput'),
        rememberCheckbox: $('rememberSecret'),
        dashboard: $('dashboard'),
        tiles: $('tiles'),
        content: $('content'),
        refreshBtn: $('refreshBtn'),
        themeBtn: $('themeBtn'),
        signOutBtn: $('signOutBtn'),
        rangeTabs: $('rangeTabs'),
        pageTabs: $('pageTabs'),
        errorBanner: $('errorBanner'),
        lastUpdated: $('lastUpdated'),
        footNote: $('footNote'),
        tip: $('tip'),
    };

    const isOpen = () => !els.dashboard.hidden;
    const isNarrow = () => window.matchMedia(NARROW_QUERY).matches;

    // ─── DOM helper ───────────────────────────────────────────

    // Text always goes in via textContent: event names come from the open POST
    // endpoint, so they are untrusted input.
    function el(tag, opts, ...children) {
        const node = document.createElement(tag);
        const o = opts || {};
        if (o.className) node.className = o.className;
        if (o.text != null) node.textContent = String(o.text);
        if (o.title) node.title = o.title;
        if (o.style) Object.assign(node.style, o.style);
        if (o.attrs) for (const [k, v] of Object.entries(o.attrs)) node.setAttribute(k, v);
        for (const child of children) if (child) node.appendChild(child);
        return node;
    }

    const fmt = (n) => Number(n).toLocaleString();
    const pct = (part, whole) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');
    const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;

    // ─── Dates ────────────────────────────────────────────────

    // The API buckets days and hours in TRACK_TIMEZONE and says which zone it
    // used. Mirror it so "today" agrees with the server, not the viewer's offset.
    let timezone = 'UTC';
    let dateKeyFormatter = makeKeyFormatter('UTC');

    function makeKeyFormatter(tz) {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        });
    }

    function setTimezone(tz) {
        try {
            dateKeyFormatter = makeKeyFormatter(tz || 'UTC');
            timezone = tz || 'UTC';
        } catch {
            dateKeyFormatter = makeKeyFormatter('UTC');
            timezone = 'UTC';
        }
    }

    const dateKeyFor = (d) => dateKeyFormatter.format(d);

    const keyToUTCNoon = (key) => {
        const [y, m, d] = String(key).split('-').map(Number);
        return Date.UTC(y, m - 1, d, 12);
    };

    const utcToKey = (ms) => {
        const d = new Date(ms);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    };

    // The last `n` calendar date keys, ending today. Steps in UTC from a noon
    // anchor so a DST shift can't duplicate or skip a day.
    function dateKeysBack(n, endDate = new Date()) {
        const anchor = keyToUTCNoon(dateKeyFor(endDate));
        const keys = [];
        for (let i = n - 1; i >= 0; i--) keys.push(utcToKey(anchor - i * DAY_MS));
        return keys;
    }

    // Every day from the earliest recorded bucket through today, so "All time"
    // still charts as a continuous, gap-filled series.
    function spanKeys(...recordMaps) {
        let earliest = null;
        for (const map of recordMaps) {
            for (const rec of Object.values(map || {})) {
                for (const day of Object.keys(rec.daily || {})) {
                    if (!earliest || day < earliest) earliest = day;
                }
            }
        }
        if (!earliest) return dateKeysBack(1);
        const days = Math.round((keyToUTCNoon(dateKeyFor(new Date())) - keyToUTCNoon(earliest)) / DAY_MS) + 1;
        return dateKeysBack(Math.min(MAX_SPAN_DAYS, Math.max(1, days)));
    }

    // Built from explicit parts — `new Date('2026-07-27')` parses as UTC
    // midnight and renders a day early for viewers west of UTC.
    const formatDay = (key) => {
        const [y, m, d] = String(key).split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    const formatFull = (d) =>
        `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, ${formatTime(d)}`;

    function formatWhen(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const mins = Math.round((Date.now() - d.getTime()) / 60_000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins} min ago`;
        if (mins < 24 * 60) return `${Math.round(mins / 60)} hr ago`;
        return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${formatTime(d)}`;
    }

    // Chart columns: one per day, or one per week on long spans. Weeks are
    // counted back from today, so the newest column is always a full 7 days.
    function buildBuckets(dayKeys) {
        const limit = isNarrow() ? WEEKLY_ABOVE_DAYS_NARROW : WEEKLY_ABOVE_DAYS;
        if (dayKeys.length <= limit) {
            return {
                unit: 'day',
                buckets: dayKeys.map((k) => ({ keys: [k], label: formatDay(k), title: formatDay(k) })),
            };
        }
        const buckets = [];
        for (let end = dayKeys.length; end > 0; end -= 7) {
            const keys = dayKeys.slice(Math.max(0, end - 7), end);
            const first = formatDay(keys[0]);
            const last = formatDay(keys[keys.length - 1]);
            buckets.unshift({ keys, label: first, title: keys.length > 1 ? `${first} – ${last}` : first });
        }
        return { unit: 'week', buckets };
    }

    // ─── Pages + event names ──────────────────────────────────

    function buildPages(events, pageviews) {
        const known = new Set(KNOWN_PAGES.map((p) => p.key));
        const extras = Object.keys(pageviews).filter((k) => !known.has(k)).sort();
        const all = KNOWN_PAGES.concat(
            extras.map((key, i) => ({
                key,
                label: titleCase(key),
                color: i === 0 ? EXTRA_PAGE_COLOR : OTHER_COLOR,
            }))
        );

        // Longest key first, so "learn-more-x" can never be claimed by a
        // shorter page key that happens to prefix it.
        const byLength = all.map((p) => p.key).sort((a, b) => b.length - a.length);
        const eventPage = {};
        const withData = new Set(Object.keys(pageviews));
        let hasOther = false;
        for (const key of Object.keys(events)) {
            const owner = byLength.find((p) => key.startsWith(`${p}-`)) || OTHER_PAGE;
            eventPage[key] = owner;
            if (owner === OTHER_PAGE) hasOther = true;
            else withData.add(owner);
        }

        const pages = all.filter((p) => withData.has(p.key));
        if (hasOther) pages.push({ key: OTHER_PAGE, label: 'Other', color: OTHER_COLOR });
        return { pages, eventPage };
    }

    const titleCase = (s) =>
        String(s).split('-').filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // The click's name without its page prefix.
    function eventSuffix(key, pageKey) {
        return pageKey !== OTHER_PAGE && key.startsWith(`${pageKey}-`) ? key.slice(pageKey.length + 1) : key;
    }

    // Unlabelled links are recorded as "href-<host-and-path>" by the pages.
    function eventLabel(suffix) {
        if (suffix.startsWith('href-')) return `Link: ${suffix.slice(5).split('-').join(' ')}`;
        return titleCase(suffix) || 'Unlabeled';
    }

    // The one conversion these pages exist for: opening the app.
    const isLaunch = (suffix) => suffix === 'app-launch' || suffix.startsWith('app-launch-');

    // Outcomes worth watching, each matched on the click's name without its
    // page prefix. A goal with no clicks ever recorded is left out of the table.
    const GOALS = [
        { label: 'App launches', match: isLaunch },
        { label: 'Chrome extension clicks', match: (s) => s.startsWith('chrome-install') },
        { label: 'User manual opens', match: (s) => s.includes('user-manual') },
        { label: 'Schema downloads', match: (s) => s.startsWith('schema-download') },
    ];

    // ─── Data shaping ─────────────────────────────────────────

    // Older payload shapes (bare number, or { total, clicks[] }) are tolerated
    // so the dashboard keeps working against a not-yet-redeployed function.
    function normalizeRecord(v) {
        if (typeof v === 'number') return { total: v, daily: {}, hourly: {}, hours: [], weekdays: [], recent: [] };
        if (!v || typeof v !== 'object') {
            return { total: parseInt(v, 10) || 0, daily: {}, hourly: {}, hours: [], weekdays: [], recent: [] };
        }
        const daily = {};
        if (v.daily && typeof v.daily === 'object') {
            for (const [day, n] of Object.entries(v.daily)) {
                const count = Number(n);
                if (Number.isFinite(count) && count > 0) daily[day] = count;
            }
        }
        let recent = [];
        if (Array.isArray(v.recent)) recent = v.recent;
        else if (Array.isArray(v.clicks)) recent = v.clicks;
        return {
            total: Number(v.total) || 0,
            daily,
            hourly: v.hourly && typeof v.hourly === 'object' ? v.hourly : {},
            hours: Array.isArray(v.hours) ? v.hours : [],
            weekdays: Array.isArray(v.weekdays) ? v.weekdays : [],
            recent,
        };
    }

    function normalizeMap(source) {
        const out = {};
        if (!source || typeof source !== 'object') return out;
        for (const [k, v] of Object.entries(source)) out[k] = normalizeRecord(v);
        return out;
    }

    // Range-aware total for one record. `keys === null` means all time, which
    // uses the lifetime `total` — that survives daily-bucket pruning.
    function recordTotal(record, keys) {
        if (!record) return 0;
        if (!keys) return Number(record.total) || 0;
        let sum = 0;
        for (const key of keys) sum += Number(record.daily[key]) || 0;
        return sum;
    }

    // Everything the panels need for one set of days, per page and overall.
    function summarize(model, keys) {
        const byPage = {};
        for (const p of model.pages) byPage[p.key] = { views: 0, clicks: 0, launches: 0 };
        for (const p of model.pages) {
            if (p.key !== OTHER_PAGE) byPage[p.key].views = recordTotal(model.pageviews[p.key], keys);
        }
        for (const [key, rec] of Object.entries(model.events)) {
            const owner = model.eventPage[key];
            const n = recordTotal(rec, keys);
            byPage[owner].clicks += n;
            if (isLaunch(eventSuffix(key, owner))) byPage[owner].launches += n;
        }
        const total = { views: 0, clicks: 0, launches: 0 };
        for (const p of scopedPages(model)) {
            total.views += byPage[p.key].views;
            total.clicks += byPage[p.key].clicks;
            total.launches += byPage[p.key].launches;
        }
        return { byPage, total };
    }

    const scopedPages = (model) =>
        (selectedPage ? model.pages.filter((p) => p.key === selectedPage) : model.pages);

    // One value per bucket for a page: its views, its clicks, or its app launches.
    function pageSeries(model, page, buckets, measure) {
        const records = measure === 'views'
            ? (model.pageviews[page.key] ? [model.pageviews[page.key]] : [])
            : Object.keys(model.events)
                .filter((k) => model.eventPage[k] === page.key
                    && (measure !== 'launches' || isLaunch(eventSuffix(k, page.key))))
                .map((k) => model.events[k]);
        return buckets.map((b) => {
            let sum = 0;
            for (const rec of records) sum += recordTotal(rec, b.keys);
            return sum;
        });
    }

    // When visitors arrive, for the selected page and range.
    //   weekdays — always follows the range: a date key already says which weekday it is.
    //   hours    — follows the range only when the function's per-day hour counts
    //              (`hourly`, kept for ~3 months and only for hits recorded since that
    //              field shipped) account for every hit in it. Otherwise it falls back
    //              to the lifetime histogram, and `hoursRanged` says so.
    function timePatterns(model, keys) {
        const inScope = (pageKey) => !selectedPage || pageKey === selectedPage;
        let records = Object.keys(model.pageviews).filter(inScope).map((k) => model.pageviews[k]);
        let unit = 'view';
        if (!sumHistogram(records, 'hours', 24).some((n) => n > 0)) {
            records = Object.keys(model.events).filter((k) => inScope(model.eventPage[k])).map((k) => model.events[k]);
            unit = 'click';
        }
        const lifetimeHours = sumHistogram(records, 'hours', 24);
        const lifetimeDays = sumHistogram(records, 'weekdays', 7);
        const any = lifetimeHours.some((n) => n > 0) || lifetimeDays.some((n) => n > 0);
        if (!keys) return { unit, any, hours: lifetimeHours, weekdays: lifetimeDays, hoursRanged: false };

        const weekdays = new Array(7).fill(0);
        const hours = new Array(24).fill(0);
        let dayTotal = 0;
        let hourTotal = 0;
        for (const key of keys) {
            const weekday = new Date(keyToUTCNoon(key)).getUTCDay();
            for (const rec of records) {
                const n = Number(rec.daily[key]) || 0;
                weekdays[weekday] += n;
                dayTotal += n;
                const byHour = rec.hourly[key];
                if (!byHour || typeof byHour !== 'object') continue;
                for (let h = 0; h < 24; h++) {
                    const c = Number(byHour[h]) || 0;
                    hours[h] += c;
                    hourTotal += c;
                }
            }
        }
        const hoursRanged = hourTotal === dayTotal;
        return { unit, any, hours: hoursRanged ? hours : lifetimeHours, weekdays, hoursRanged };
    }

    function sumHistogram(records, field, length) {
        const out = new Array(length).fill(0);
        for (const rec of records) {
            const bucket = rec[field];
            if (!Array.isArray(bucket)) continue;
            for (let i = 0; i < length; i++) out[i] += Number(bucket[i]) || 0;
        }
        return out;
    }

    // ─── Tooltip ──────────────────────────────────────────────

    function showTip(title, rows, total, x, y) {
        const tip = els.tip;
        tip.replaceChildren(el('div', { className: 'tip-title', text: title }));
        for (const row of rows) {
            tip.appendChild(
                el('div', { className: 'tip-row' },
                    row.color ? el('i', { style: { background: row.color } }) : null,
                    el('b', { text: typeof row.value === 'number' ? fmt(row.value) : row.value }),
                    el('span', { text: row.label }),
                )
            );
        }
        if (total != null) {
            tip.appendChild(
                el('div', { className: 'tip-row tip-total' },
                    el('b', { text: fmt(total) }),
                    el('span', { text: 'Total' }),
                )
            );
        }
        tip.hidden = false;
        const pad = 12;
        const w = tip.offsetWidth;
        const h = tip.offsetHeight;
        let left = x + 14;
        if (left + w + pad > window.innerWidth) left = x - w - 14;
        let top = y + 14;
        if (top + h + pad > window.innerHeight) top = y - h - 14;
        tip.style.left = `${Math.max(pad, left)}px`;
        tip.style.top = `${Math.max(pad, top)}px`;
    }

    const hideTip = () => { els.tip.hidden = true; };

    // ─── Charts ───────────────────────────────────────────────

    // A round axis top with at most four steps: 0 / 5 / 10 / 15 / 20.
    function axisScale(max) {
        if (max <= 4) {
            const top = Math.max(1, Math.ceil(max));
            return { top, ticks: Array.from({ length: top + 1 }, (_, i) => i) };
        }
        const rough = max / 4;
        const pow = 10 ** Math.floor(Math.log10(rough));
        const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough);
        const top = Math.ceil(max / step) * step;
        const ticks = [];
        for (let t = 0; t <= top + step / 2; t += step) ticks.push(t);
        return { top, ticks };
    }

    // Stacked column chart. `series` = [{ label, color, values[] }], one value
    // per column. Hover or arrow keys read out every series at that column.
    // `format` writes the axis ticks; `describe(i)` replaces the tooltip rows
    // for charts whose value is derived (a rate) rather than a plain count.
    function columnChart({ name, columns, series, unit, format = fmt, describe, emptyText }) {
        const totals = columns.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
        const max = Math.max(...totals, 0);
        if (max === 0) return el('div', { className: 'empty-plot', text: emptyText || `No ${unit}s in this range.` });

        const { top, ticks } = axisScale(max);
        const dense = columns.length > DENSE_ABOVE_COLUMNS;

        const yAxis = el('div', { className: 'y-axis', attrs: { 'aria-hidden': 'true' } });
        const plot = el('div', {
            className: 'plot',
            attrs: {
                tabindex: '0',
                role: 'group',
                'aria-label': `${name}. Left and right arrow keys read each column; the table below lists every value.`,
            },
        });
        for (const t of ticks) {
            const pos = `${(t / top) * 100}%`;
            yAxis.appendChild(el('span', { text: format(t), style: { bottom: pos } }));
            if (t > 0) plot.appendChild(el('div', { className: 'gridline', style: { bottom: pos } }));
        }

        const cols = el('div', { className: 'cols' });
        const colNodes = columns.map((_, i) => {
            const col = el('div', { className: dense ? 'col dense' : 'col' });
            for (const s of series) {
                if (s.values[i] > 0) {
                    col.appendChild(el('div', {
                        className: 'seg-bar',
                        style: { height: `${(s.values[i] / top) * 100}%`, background: s.color },
                    }));
                }
            }
            cols.appendChild(col);
            return col;
        });
        plot.appendChild(cols);

        // A week of columns always has room for every label, even on a phone.
        const maxLabels = isNarrow() ? 4 : 8;
        const step = columns.length <= 7 ? 1 : Math.max(1, Math.ceil(columns.length / maxLabels));
        const xAxis = el('div', { className: 'x-axis', attrs: { 'aria-hidden': 'true' } });
        columns.forEach((c, i) => {
            // Anchored to the right so the newest column is always labelled.
            const show = (columns.length - 1 - i) % step === 0;
            let cls = '';
            if (columns.length > 12 && i === 0) cls = 'edge-left';
            else if (columns.length > 12 && i === columns.length - 1) cls = 'edge-right';
            xAxis.appendChild(el('span', { className: cls, text: show ? c.label : '' }));
        });

        let active = -1;
        const setActive = (i, x, y) => {
            if (active >= 0) colNodes[active].classList.remove('active');
            active = i;
            if (i < 0) { hideTip(); return; }
            colNodes[i].classList.add('active');
            if (describe) { showTip(columns[i].title, describe(i), null, x, y); return; }
            const rows = series.map((s) => ({ label: s.label, color: s.color, value: s.values[i] }));
            if (series.length === 1) rows[0].label = `${unit}${rows[0].value === 1 ? '' : 's'}`;
            showTip(columns[i].title, rows, series.length > 1 ? totals[i] : null, x, y);
        };
        const activateAtColumn = (i) => {
            const r = colNodes[i].getBoundingClientRect();
            setActive(i, r.left + r.width / 2, r.top + r.height / 3);
        };

        plot.addEventListener('pointermove', (e) => {
            const r = cols.getBoundingClientRect();
            const i = Math.min(columns.length - 1,
                Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * columns.length)));
            setActive(i, e.clientX, e.clientY);
        });
        plot.addEventListener('pointerleave', () => setActive(-1));
        plot.addEventListener('blur', () => setActive(-1));
        plot.addEventListener('keydown', (e) => {
            const last = columns.length - 1;
            let next = null;
            if (e.key === 'ArrowLeft') next = active < 0 ? last : Math.max(0, active - 1);
            else if (e.key === 'ArrowRight') next = active < 0 ? last : Math.min(last, active + 1);
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = last;
            else if (e.key === 'Escape') { setActive(-1); return; }
            if (next == null) return;
            e.preventDefault();
            activateAtColumn(next);
        });

        return el('div', { className: 'chart' }, yAxis, plot, xAxis);
    }

    function sparkline(values, color, small) {
        if (values.length < 2 || values.every((v) => v === 0)) return null;
        const max = Math.max(...values, 1);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', small ? 'spark small' : 'spark');
        svg.setAttribute('viewBox', '0 0 100 30');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        line.setAttribute('points', values
            .map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(1)},${(28 - (v / max) * 26).toFixed(1)}`)
            .join(' '));
        // Keeps the 2px stroke crisp while the viewBox is stretched to fit.
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        if (color) line.style.stroke = color;
        svg.appendChild(line);
        return svg;
    }

    // ─── Stat tiles ───────────────────────────────────────────

    function deltaNode(current, prior, title) {
        if (prior === 0 && current === 0) return null;
        let text;
        let cls = '';
        if (prior === 0) { text = '▲ New'; cls = 'up'; }
        else if (current === prior) { text = 'No change'; }
        else {
            const change = ((current - prior) / prior) * 100;
            text = `${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(0)}%`;
            cls = change > 0 ? 'up' : 'down';
        }
        return el('span', { className: cls ? `delta ${cls}` : 'delta', text, title });
    }

    // A rate changes in percentage points, not percent of a percent.
    function pointDeltaNode(current, prior, title) {
        if (current == null || prior == null) return null;
        const diff = (current - prior) * 100;
        if (Math.abs(diff) < 0.05) return el('span', { className: 'delta', text: 'No change', title });
        return el('span', {
            className: diff > 0 ? 'delta up' : 'delta down',
            text: `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)} pts`,
            title,
        });
    }

    function tile(label, value, delta, extra, note) {
        return el('div', { className: 'tile' },
            el('div', { className: 'tile-label', text: label }),
            el('div', { className: 'tile-value', text: value }),
            el('div', { className: 'tile-foot' },
                el('div', null, delta, note ? el('div', { className: 'tile-note', text: note }) : null),
                extra,
            ),
        );
    }

    function renderTiles(model, keys, chart) {
        const now = summarize(model, keys).total;
        const prior = keys ? summarize(model, dateKeysBack(selectedDays * 2).slice(0, selectedDays)).total : null;
        const vs = keys ? `Compared with the previous ${selectedDays} days` : '';
        const note = keys ? null : 'All time';

        const scoped = scopedPages(model);
        const trend = (measure) => chart.buckets.map((_, i) =>
            scoped.reduce((sum, p) => sum + pageSeries(model, p, [chart.buckets[i]], measure)[0], 0));

        const sparkColor = scoped.length === 1 ? scoped[0].color : null;

        const rate = (t) => (t.views > 0 ? t.launches / t.views : null);

        const todayKey = [dateKeyFor(new Date())];
        const weekAgoKey = dateKeysBack(8).slice(0, 1);
        const today = summarize(model, todayKey).total;
        const weekAgo = summarize(model, weekAgoKey).total;

        els.tiles.replaceChildren(
            tile('Page views', fmt(now.views),
                prior && deltaNode(now.views, prior.views, vs), sparkline(trend('views'), sparkColor), note),
            tile('Clicks', fmt(now.clicks),
                prior && deltaNode(now.clicks, prior.clicks, vs), sparkline(trend('clicks'), sparkColor), note),
            tile('App launches', fmt(now.launches),
                prior && deltaNode(now.launches, prior.launches, vs), null, note),
            tile('Launch rate', pct(now.launches, now.views),
                prior && pointDeltaNode(rate(now), rate(prior), vs), null, 'Launches ÷ views'),
            tile('Views today', fmt(today.views),
                deltaNode(today.views, weekAgo.views, 'Compared with the same day last week'),
                null, plural(today.clicks, 'click')),
        );
    }

    // ─── Panels ───────────────────────────────────────────────

    function card(title, note, half) {
        const node = el('section', { className: half ? 'card half' : 'card' });
        node.appendChild(
            el('div', { className: 'card-head' },
                el('h2', { text: title }),
                note ? el('span', { className: 'card-note', text: note }) : null,
            )
        );
        return node;
    }

    const subHead = (title, note) =>
        el('div', { className: 'sub-head' }, el('h3', { text: title }), el('span', { text: note }));

    const rangeSentence = () => (selectedDays ? `Last ${selectedDays} days` : 'All time');

    // Every charted day as CSV, one row per day and page — for a spreadsheet.
    function downloadCsv(model, dayKeys) {
        const pages = scopedPages(model);
        const one = (page, measure, day) => pageSeries(model, page, [{ keys: [day] }], measure)[0];
        const lines = ['date,page,views,clicks,app_launches'];
        for (const day of dayKeys) {
            for (const p of pages) {
                const views = p.key === OTHER_PAGE ? 0 : one(p, 'views', day);
                lines.push([day, p.key === OTHER_PAGE ? 'other' : p.key, views, one(p, 'clicks', day), one(p, 'launches', day)].join(','));
            }
        }
        const url = URL.createObjectURL(new Blob([`${lines.join('\n')}\n`], { type: 'text/csv' }));
        const link = el('a', { attrs: { href: url, download: `minicycle-landing-${dayKeys[0]}_${dayKeys[dayKeys.length - 1]}.csv` } });
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    const priorKeysFor = (keys) => (keys ? dateKeysBack(selectedDays * 2).slice(0, selectedDays) : null);

    const changeWords = (now, before) => {
        const change = ((now - before) / before) * 100;
        return `${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(0)}%`;
    };

    // Plain-language answers to "what happened?", so the charts don't have to
    // be read to find out. Each line is only shown when there is enough data
    // behind it to mean something.
    function renderHighlights(model, keys, dayKeys) {
        const MIN_VIEWS = 20;    // a page needs this many views before its rate is compared
        const MIN_CLICKS = 5;    // a button needs this many clicks before it counts as a mover
        const QUIET_DAYS = 7;
        const items = [];
        const add = (label, text) => items.push({ label, text });
        const scoped = scopedPages(model);
        const real = scoped.filter((p) => p.key !== OTHER_PAGE);
        const now = summarize(model, keys);
        const priorKeys = priorKeysFor(keys);
        const before = priorKeys ? summarize(model, priorKeys) : null;

        if (before && before.total.views > 0 && now.total.views !== before.total.views) {
            add('Traffic', `Page views are ${changeWords(now.total.views, before.total.views)} on the previous ${selectedDays} days (${fmt(now.total.views)} vs ${fmt(before.total.views)}).`);
        }
        if (before && before.total.views >= MIN_VIEWS && now.total.views >= MIN_VIEWS) {
            const a = (now.total.launches / now.total.views) * 100;
            const b = (before.total.launches / before.total.views) * 100;
            if (Math.abs(a - b) >= 0.5) {
                add('Launch rate', `${a.toFixed(1)}% of views led to an app launch, ${a > b ? 'up' : 'down'} from ${b.toFixed(1)}%.`);
            }
        }

        let best = null;
        for (const day of dayKeys) {
            const views = real.reduce((sum, p) => sum + recordTotal(model.pageviews[p.key], [day]), 0);
            if (views > 0 && (!best || views > best.views)) best = { day, views };
        }
        if (best && dayKeys.length > 1) {
            const [y, m, d] = best.day.split('-').map(Number);
            const name = new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
            add('Busiest day', `${name}, with ${plural(best.views, 'view')}.`);
        }

        if (!selectedPage) {
            const rated = real
                .map((p) => ({ p, s: now.byPage[p.key] }))
                .filter((r) => r.s.views >= MIN_VIEWS)
                .map((r) => ({ label: r.p.label, rate: (r.s.launches / r.s.views) * 100 }))
                .sort((a, b) => b.rate - a.rate);
            if (rated.length > 1 && rated[0].rate > rated[1].rate) {
                add('Best converter', `${rated[0].label} turns ${rated[0].rate.toFixed(1)}% of views into app launches; ${rated[1].label} is next at ${rated[1].rate.toFixed(1)}%.`);
            }
        }

        if (priorKeys) {
            const movers = Object.entries(model.events)
                .filter(([key]) => !selectedPage || model.eventPage[key] === selectedPage)
                .map(([key, rec]) => {
                    const owner = model.eventPage[key];
                    return {
                        label: eventLabel(eventSuffix(key, owner)),
                        page: scoped.find((p) => p.key === owner),
                        count: recordTotal(rec, keys),
                        prior: recordTotal(rec, priorKeys),
                    };
                })
                .filter((r) => r.prior >= MIN_CLICKS && r.count !== r.prior);
            const where = (r) => (selectedPage || !r.page ? '' : ` on ${r.page.label}`);
            const riser = movers.filter((r) => r.count > r.prior).sort((a, b) => (b.count - b.prior) - (a.count - a.prior))[0];
            const faller = movers.filter((r) => r.count < r.prior).sort((a, b) => (a.count - a.prior) - (b.count - b.prior))[0];
            if (riser) add('Rising', `"${riser.label}"${where(riser)} is ${changeWords(riser.count, riser.prior)} (${fmt(riser.count)} clicks vs ${fmt(riser.prior)}).`);
            if (faller) add('Falling', `"${faller.label}"${where(faller)} is ${changeWords(faller.count, faller.prior)} (${fmt(faller.count)} clicks vs ${fmt(faller.prior)}).`);
        }

        const when = timePatterns(model, keys);
        if (when.hours.some((n) => n > 0) && when.weekdays.some((n) => n > 0)) {
            const h = when.hours.indexOf(Math.max(...when.hours));
            const twelve = h % 12 === 0 ? 12 : h % 12;
            const hour = `${twelve} ${h < 12 ? 'am' : 'pm'}`;
            const dayName = WEEKDAY_NAMES[when.weekdays.indexOf(Math.max(...when.weekdays))];
            const span = keys ? `In the last ${selectedDays} days` : 'Over all time';
            add('Peak time', !keys || when.hoursRanged
                ? `${span}, most ${when.unit}s arrive around ${hour}, and ${dayName} is the busiest day.`
                : `${span}, ${dayName} is the busiest day. Over all time, most ${when.unit}s arrive around ${hour}.`);
        }

        // A page that used to get views and now gets none usually means its
        // tracking broke, not that everyone left.
        const lastWeek = dateKeysBack(QUIET_DAYS);
        for (const p of real) {
            const rec = model.pageviews[p.key];
            if (rec && rec.total > 0 && recordTotal(rec, lastWeek) === 0) {
                add('Check', `${p.label} has recorded no views for ${QUIET_DAYS} days. Worth confirming its tracking still fires.`);
            }
        }

        if (items.length === 0) return null;
        const node = card('Highlights', rangeSentence());
        const list = el('div', { className: 'insights' });
        for (const item of items) {
            list.appendChild(el('div', { className: item.label === 'Check' ? 'insight warn' : 'insight' },
                el('div', { className: 'insight-label', text: item.label }),
                el('p', { text: item.text })));
        }
        node.appendChild(list);
        return node;
    }

    // Outcomes rather than buttons: several buttons can serve one goal, and a
    // goal can be reached from more than one page.
    function renderGoals(model, keys) {
        const real = scopedPages(model).filter((p) => p.key !== OTHER_PAGE);
        if (real.length === 0) return null;
        const priorKeys = priorKeysFor(keys);
        const views = real.reduce((sum, p) => sum + recordTotal(model.pageviews[p.key], keys), 0);

        const rows = [];
        for (const goal of GOALS) {
            const perPage = {};
            let total = 0;
            let prior = 0;
            let ever = 0;
            for (const [key, rec] of Object.entries(model.events)) {
                const owner = model.eventPage[key];
                if (!real.some((p) => p.key === owner) || !goal.match(eventSuffix(key, owner))) continue;
                const n = recordTotal(rec, keys);
                perPage[owner] = (perPage[owner] || 0) + n;
                total += n;
                ever += rec.total;
                if (priorKeys) prior += recordTotal(rec, priorKeys);
            }
            if (ever > 0) rows.push({ goal, perPage, total, prior });
        }
        if (rows.length === 0) return null;

        const split = real.length > 1;
        const node = card('Goals', `${rangeSentence()} · clicks that count as an outcome`);
        const head = el('tr', null,
            el('th', { text: 'Goal' }),
            ...(split ? real.map((p) => el('th', null,
                el('span', { className: 'th-page' }, el('span', { className: 'dot', style: { background: p.color } }), el('span', { text: p.label })))) : []),
            el('th', { text: split ? 'Total' : 'Clicks' }),
            el('th', { text: 'Per 100 views' }),
            priorKeys ? el('th', { text: 'Change' }) : null,
        );
        const body = el('tbody');
        const vs = `Compared with the previous ${selectedDays} days`;
        for (const r of rows) {
            body.appendChild(el('tr', null,
                el('td', { text: r.goal.label }),
                ...(split ? real.map((p) => el('td', { className: r.perPage[p.key] ? '' : 'muted', text: fmt(r.perPage[p.key] || 0) })) : []),
                el('td', { className: 'strong', text: fmt(r.total) }),
                el('td', { text: views > 0 ? ((r.total / views) * 100).toFixed(1) : '—' }),
                priorKeys ? el('td', null, deltaNode(r.total, r.prior, vs) || el('span', { className: 'delta', text: '—' })) : null,
            ));
        }
        node.appendChild(el('div', { className: 'x-scroll' }, el('table', null, el('thead', null, head), body)));
        return node;
    }

    function renderActivity(model, chart, dayKeys) {
        const scoped = scopedPages(model);
        const unitNote = chart.unit === 'week' ? ' · by week' : ' · by day';
        const node = card('Activity', rangeSentence() + unitNote);

        if (scoped.length > 1) {
            const legend = el('div', { className: 'legend' });
            for (const p of scoped) {
                legend.appendChild(el('span', null, el('i', { style: { background: p.color } }), el('span', { text: p.label })));
            }
            node.querySelector('.card-head').appendChild(legend);
        }

        const build = (measure) => scoped
            .filter((p) => measure === 'clicks' || p.key !== OTHER_PAGE)
            .map((p) => ({ label: p.label, color: p.color, values: pageSeries(model, p, chart.buckets, measure) }));
        const views = build('views');
        const clicks = build('clicks');
        const sumAll = (series) => series.reduce((sum, s) => sum + s.values.reduce((a, b) => a + b, 0), 0);
        const column = (series, i) => series.reduce((sum, s) => sum + s.values[i], 0);

        // Launch rate per column. One neutral series: a rate can't be stacked by page.
        const launches = scoped.map((p) => pageSeries(model, p, chart.buckets, 'launches'));
        const launchAt = (i) => launches.reduce((sum, values) => sum + values[i], 0);
        const rates = chart.buckets.map((_, i) => (column(views, i) > 0 ? (launchAt(i) / column(views, i)) * 100 : 0));
        const totalLaunches = chart.buckets.reduce((sum, _, i) => sum + launchAt(i), 0);

        node.appendChild(subHead('Page views', fmt(sumAll(views))));
        node.appendChild(columnChart({ name: 'Page views over time', columns: chart.buckets, series: views, unit: 'view' }));
        node.appendChild(subHead('Clicks', fmt(sumAll(clicks))));
        node.appendChild(columnChart({ name: 'Clicks over time', columns: chart.buckets, series: clicks, unit: 'click' }));
        node.appendChild(subHead('Launch rate', `${pct(totalLaunches, sumAll(views))} · app launches ÷ views`));
        node.appendChild(columnChart({
            name: 'Launch rate over time',
            columns: chart.buckets,
            series: [{ label: 'Launch rate', color: 'var(--ink-3)', values: rates }],
            unit: 'launch',
            emptyText: 'No app launches in this range.',
            format: (t) => `${fmt(t)}%`,
            describe: (i) => [
                { label: 'launch rate', value: pct(launchAt(i), column(views, i)) },
                { label: `launch${launchAt(i) === 1 ? '' : 'es'}`, value: launchAt(i) },
                { label: `view${column(views, i) === 1 ? '' : 's'}`, value: column(views, i) },
            ],
        }));

        // The table twin: every charted value, readable without hovering.
        const head = el('tr', null,
            el('th', { text: chart.unit === 'week' ? 'Week' : 'Day' }),
            el('th', { text: 'Views' }),
            el('th', { text: 'Clicks' }),
            el('th', { text: 'App launches' }),
            el('th', { text: 'Launch rate' }),
        );
        const body = el('tbody');
        for (let i = chart.buckets.length - 1; i >= 0; i--) {
            body.appendChild(el('tr', null,
                el('td', { text: chart.buckets[i].title }),
                el('td', { text: fmt(column(views, i)) }),
                el('td', { text: fmt(column(clicks, i)) }),
                el('td', { text: fmt(launchAt(i)) }),
                el('td', { text: pct(launchAt(i), column(views, i)) }),
            ));
        }
        const csv = el('button', { className: 'ghost-btn', text: 'Download CSV', attrs: { type: 'button' } });
        csv.addEventListener('click', () => downloadCsv(model, dayKeys));
        node.appendChild(
            el('div', { className: 'card-tools' },
                el('details', { className: 'table-view' },
                    el('summary', { text: 'Show as table' }),
                    el('div', { className: 'table-scroll' }, el('table', null, el('thead', null, head), body)),
                ),
                csv,
            )
        );
        return node;
    }

    // Newest recorded hit for a page, view or click — a quick "is tracking alive" check.
    function lastHit(model, pageKey) {
        let latest = '';
        const scan = (rec) => {
            for (const t of rec.recent) if (String(t) > latest) latest = String(t);
        };
        if (model.pageviews[pageKey]) scan(model.pageviews[pageKey]);
        for (const [key, rec] of Object.entries(model.events)) {
            if (model.eventPage[key] === pageKey) scan(rec);
        }
        return latest;
    }

    // Always lists every page — it is the comparison, and its rows set the filter.
    function renderPages(model, keys) {
        const real = model.pages.filter((p) => p.key !== OTHER_PAGE);
        if (real.length === 0) return null;
        const { byPage } = summarize(model, keys);

        const node = card('Pages', `${rangeSentence()} · select a page to filter`);
        const head = el('tr', null,
            ...['Page', 'Views', 'Clicks', 'Clicks per view', 'App launches', 'Launch rate', 'Last hit']
                .map((t) => el('th', { text: t })));
        const body = el('tbody');
        const total = { views: 0, clicks: 0, launches: 0 };

        for (const p of real) {
            const s = byPage[p.key];
            total.views += s.views;
            total.clicks += s.clicks;
            total.launches += s.launches;
            const btn = el('button', {
                className: 'link-btn',
                attrs: { type: 'button', 'data-page': p.key, 'aria-pressed': String(selectedPage === p.key) },
            }, el('span', { className: 'dot', style: { background: p.color } }), el('span', { text: p.label }));
            body.appendChild(el('tr', null,
                el('td', null, btn),
                el('td', { text: fmt(s.views) }),
                el('td', { text: fmt(s.clicks) }),
                el('td', { text: s.views > 0 ? (s.clicks / s.views).toFixed(2) : '—' }),
                el('td', { text: fmt(s.launches) }),
                el('td', { text: pct(s.launches, s.views) }),
                el('td', { className: 'muted', text: formatWhen(lastHit(model, p.key)) || '—' }),
            ));
        }
        if (real.length > 1) {
            body.appendChild(el('tr', { className: 'total' },
                el('td', { text: 'All pages' }),
                el('td', { text: fmt(total.views) }),
                el('td', { text: fmt(total.clicks) }),
                el('td', { text: total.views > 0 ? (total.clicks / total.views).toFixed(2) : '—' }),
                el('td', { text: fmt(total.launches) }),
                el('td', { text: pct(total.launches, total.views) }),
                el('td', { text: '' }),
            ));
        }

        node.appendChild(el('div', { className: 'x-scroll' }, el('table', null, el('thead', null, head), body)));
        node.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-page]');
            if (btn) setPage(selectedPage === btn.dataset.page ? null : btn.dataset.page);
        });
        return node;
    }

    function renderTopClicks(model, keys, chart) {
        const priorKeys = keys ? dateKeysBack(selectedDays * 2).slice(0, selectedDays) : null;
        const pageByKey = {};
        for (const p of model.pages) pageByKey[p.key] = p;

        const rows = Object.entries(model.events)
            .filter(([key]) => !selectedPage || model.eventPage[key] === selectedPage)
            .map(([key, rec]) => ({
                key,
                rec,
                page: pageByKey[model.eventPage[key]],
                count: recordTotal(rec, keys),
                prior: priorKeys ? recordTotal(rec, priorKeys) : 0,
            }))
            .filter((r) => r.count > 0)
            .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

        const node = card('Top clicks', rows.length ? `${plural(rows.length, 'button')} clicked` : rangeSentence(), true);
        if (rows.length === 0) {
            node.appendChild(el('div', { className: 'empty-plot', text: 'No clicks in this range.' }));
            return node;
        }

        const max = rows[0].count;
        const vs = `Compared with the previous ${selectedDays} days`;
        const visible = showAllClicks ? rows : rows.slice(0, TOP_CLICKS_LIMIT);
        for (const r of visible) {
            const suffix = eventSuffix(r.key, r.page.key);
            const name = el('div', { className: 'rank-name', text: eventLabel(suffix), title: r.key });
            if (isLaunch(suffix)) name.appendChild(el('span', { className: 'tag', text: 'App launch' }));
            if (!selectedPage) {
                name.appendChild(el('span', { className: 'rank-meta' },
                    el('span', { className: 'dot', style: { background: r.page.color } }),
                    el('span', { text: r.page.label })));
            }
            node.appendChild(el('div', { className: 'rank-row' },
                name,
                // Below a handful of clicks a trend line is just a row of spikes.
                (r.count >= SPARK_MIN_CLICKS
                    && sparkline(chart.buckets.map((b) => recordTotal(r.rec, b.keys)), r.page.color, true))
                    || el('span', { className: 'spark small' }),
                el('span', { className: 'rank-count', text: fmt(r.count) }),
                (keys && deltaNode(r.count, r.prior, vs)) || el('span', { className: 'delta' }),
                el('div', { className: 'rank-track' },
                    el('div', { className: 'rank-fill', style: { width: `${(r.count / max) * 100}%`, background: r.page.color } })),
            ));
        }

        if (rows.length > TOP_CLICKS_LIMIT) {
            const more = el('button', {
                className: 'ghost-btn more-btn',
                text: showAllClicks ? 'Show top 10' : `Show all ${rows.length}`,
                attrs: { type: 'button' },
            });
            more.addEventListener('click', () => { showAllClicks = !showAllClicks; render(); });
            node.appendChild(more);
        }
        return node;
    }

    // A fixed-size ring from the API (the newest 50 per event), so it ignores the range.
    function renderRecent(model) {
        const pageByKey = {};
        for (const p of model.pages) pageByKey[p.key] = p;

        const items = [];
        for (const [key, rec] of Object.entries(model.events)) {
            const page = pageByKey[model.eventPage[key]];
            if (selectedPage && page.key !== selectedPage) continue;
            for (const time of rec.recent) items.push({ time: String(time), page, label: eventLabel(eventSuffix(key, page.key)) });
        }
        for (const [key, rec] of Object.entries(model.pageviews)) {
            const page = pageByKey[key];
            if (!page || (selectedPage && key !== selectedPage)) continue;
            for (const time of rec.recent) items.push({ time: String(time), page, view: true });
        }
        if (items.length === 0) return null;
        items.sort((a, b) => b.time.localeCompare(a.time));

        const node = card('Recent activity', 'Newest first · not limited by the date range', true);
        const feed = el('div', { className: 'feed' });
        for (const item of items.slice(0, RECENT_LIMIT)) {
            const what = el('div', { className: 'feed-what', text: item.view ? 'Page view' : item.label });
            what.appendChild(el('span', { className: 'rank-meta' },
                el('span', { className: 'dot', style: { background: item.page.color } }),
                el('span', { text: item.page.label })));
            const when = new Date(item.time);
            feed.appendChild(el('div', { className: 'feed-row' },
                what,
                el('span', {
                    className: 'feed-when',
                    text: formatWhen(item.time),
                    title: Number.isNaN(when.getTime()) ? '' : formatFull(when),
                }),
            ));
        }
        node.appendChild(feed);
        return node;
    }

    function renderPatterns(model, keys) {
        const when = timePatterns(model, keys);
        if (!when.any) return [];

        const page = selectedPage && model.pages.find((p) => p.key === selectedPage);
        const color = page ? page.color : 'var(--series-1)';
        const { unit } = when;
        const measure = unit === 'view' ? 'Page views' : 'Clicks';
        const scope = keys ? rangeSentence().toLowerCase() : 'all time';
        // Said outright when the hour chart can't follow the range yet.
        const hourNote = !keys || when.hoursRanged
            ? `${measure} · ${scope}`
            : `${measure} · all time (hourly detail doesn't cover this whole range yet)`;

        const hourCols = Array.from({ length: 24 }, (_, h) => {
            const suffix = h < 12 ? 'am' : 'pm';
            const twelve = h % 12 === 0 ? 12 : h % 12;
            return { label: `${twelve}${suffix[0]}`, title: `${twelve}:00 ${suffix}` };
        });
        const dayCols = WEEKDAY_NAMES.map((d) => ({ label: d.slice(0, 3), title: d }));

        const byHour = card('By hour of day', hourNote, true);
        byHour.appendChild(columnChart({
            name: `${measure} by hour of day`, columns: hourCols, unit,
            series: [{ label: unit, color, values: when.hours }],
        }));
        const byDay = card('By day of week', `${measure} · ${scope}`, true);
        byDay.appendChild(columnChart({
            name: `${measure} by day of week`, columns: dayCols, unit,
            series: [{ label: unit, color, values: when.weekdays }],
        }));
        return [byHour, byDay];
    }

    // ─── Render ───────────────────────────────────────────────

    function renderPageTabs(model) {
        const tabs = [el('button', {
            text: 'All pages',
            attrs: { type: 'button', 'data-page': '', 'aria-pressed': String(!selectedPage) },
        })];
        for (const p of model.pages) {
            tabs.push(el('button', {
                attrs: { type: 'button', 'data-page': p.key, 'aria-pressed': String(selectedPage === p.key) },
            }, el('span', { className: 'dot', style: { background: p.color } }), el('span', { text: p.label })));
        }
        els.pageTabs.replaceChildren(...tabs);
        els.pageTabs.hidden = model.pages.length < 2;
    }

    function stateMessage(title, detail) {
        return el('div', { className: 'state' }, el('p', { text: title }), el('small', { text: detail }));
    }

    function render() {
        if (!lastData) return;
        hideTip();
        const { events, pageviews } = lastData;
        const model = { events, pageviews, ...buildPages(events, pageviews) };

        if (selectedPage && !model.pages.some((p) => p.key === selectedPage)) selectedPage = null;
        renderPageTabs(model);

        els.footNote.textContent =
            `Days and hours are bucketed in ${timezone}. A view is counted once per browser session; nothing recorded identifies a visitor.`;

        if (model.pages.length === 0) {
            els.tiles.replaceChildren();
            els.content.replaceChildren(stateMessage('Nothing recorded yet.',
                'Open a landing page or click one of its buttons to start counting.'));
            return;
        }

        const keys = selectedDays ? dateKeysBack(selectedDays) : null;
        // Charts always need a concrete day list; "All time" spans from the
        // earliest recorded day through today.
        const dayKeys = keys || spanKeys(events, pageviews);
        const chart = buildBuckets(dayKeys);

        renderTiles(model, keys, chart);

        const panels = [
            renderHighlights(model, keys, dayKeys),
            renderActivity(model, chart, dayKeys),
            renderGoals(model, keys),
            renderPages(model, keys),
            renderTopClicks(model, keys, chart),
            renderRecent(model),
            ...renderPatterns(model, keys),
        ].filter(Boolean);

        els.content.replaceChildren(el('div', { className: 'grid' }, ...panels));
    }

    function showError(msg) {
        if (lastData) {
            // Keep the last good view rather than replacing real numbers with an error page.
            els.errorBanner.textContent = `${msg} Showing data from ${lastUpdatedText}.`;
            els.errorBanner.hidden = false;
            return;
        }
        els.errorBanner.hidden = true;
        els.tiles.replaceChildren();
        els.content.replaceChildren(stateMessage(msg, 'Check your connection, then choose Refresh.'));
    }

    // ─── Network ──────────────────────────────────────────────

    async function fetchCounts() {
        // Only blank the page on a cold load. A refresh holds the current frame
        // (dimmed) so nothing jumps or loses its scroll position.
        if (lastData) els.dashboard.classList.add('is-loading');
        else els.content.replaceChildren(stateMessage('Loading…', ''));
        try {
            // The secret goes in the Authorization header, never the query
            // string — query strings are captured by hosting access logs.
            const res = await fetch(API_URL, {
                headers: { Authorization: `Bearer ${secret}` },
                cache: 'no-store',
            });
            if (res.status === 401) {
                signOut(true);
                return;
            }
            if (!res.ok) {
                showError(`The tracking service answered with an error (${res.status}).`);
                return;
            }
            const data = await res.json();
            const rawEvents = data && (data.events || data.counts);
            if (!rawEvents) {
                showError('The tracking service sent an unexpected response.');
                return;
            }
            setTimezone(data.timezone);
            lastData = { events: normalizeMap(rawEvents), pageviews: normalizeMap(data.pageviews) };
            lastUpdatedText = formatTime(new Date());
            els.errorBanner.hidden = true;
            els.lastUpdated.textContent = `Updated ${lastUpdatedText}`;
            render();
        } catch {
            showError('Could not load the data.');
        } finally {
            els.dashboard.classList.remove('is-loading');
        }
    }

    // ─── Preferences ──────────────────────────────────────────

    function readStore(key) {
        try { return localStorage.getItem(key); } catch { return null; }
    }

    function writeStore(key, value) {
        try {
            if (value == null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        } catch { /* storage disabled */ }
    }

    function loadRange() {
        const saved = readStore(RANGE_KEY);
        if (saved === 'all') return null;
        const n = parseInt(saved, 10);
        return [7, 30, 90].includes(n) ? n : DEFAULT_RANGE_DAYS;
    }

    function syncRangeTabs() {
        const current = selectedDays ? String(selectedDays) : 'all';
        for (const tab of els.rangeTabs.querySelectorAll('button')) {
            tab.setAttribute('aria-pressed', String(tab.dataset.days === current));
        }
    }

    function setPage(pageKey) {
        selectedPage = pageKey || null;
        showAllClicks = false;
        writeStore(PAGE_KEY, selectedPage);
        render();
    }

    function applyTheme() {
        if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', theme);
        els.themeBtn.textContent = `Theme: ${theme.charAt(0).toUpperCase()}${theme.slice(1)}`;
    }

    // ─── Auth ─────────────────────────────────────────────────

    function openDashboard() {
        els.authError.hidden = true;
        els.authScreen.hidden = true;
        els.dashboard.hidden = false;
        fetchCounts();
    }

    function signOut(rejected) {
        writeStore(REMEMBER_KEY, null);
        secret = '';
        lastData = null;
        hideTip();
        els.secretInput.value = '';
        els.rememberCheckbox.checked = false;
        els.dashboard.hidden = true;
        els.authScreen.hidden = false;
        els.authError.hidden = !rejected;
        els.secretInput.focus();
    }

    // ─── Wire up ──────────────────────────────────────────────

    els.authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const value = els.secretInput.value.trim();
        if (!value) return;
        secret = value;
        writeStore(REMEMBER_KEY, els.rememberCheckbox.checked ? secret : null);
        openDashboard();
    });

    els.refreshBtn.addEventListener('click', fetchCounts);
    els.signOutBtn.addEventListener('click', () => signOut(false));

    els.themeBtn.addEventListener('click', () => {
        theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
        writeStore(THEME_KEY, theme === 'auto' ? null : theme);
        applyTheme();
    });

    // Filter changes re-render from the cached payload — no refetch needed.
    els.rangeTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('button');
        if (!tab) return;
        selectedDays = tab.dataset.days === 'all' ? null : parseInt(tab.dataset.days, 10);
        showAllClicks = false;
        writeStore(RANGE_KEY, selectedDays ? String(selectedDays) : 'all');
        syncRangeTabs();
        render();
    });

    els.pageTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('button');
        if (tab) setPage(tab.dataset.page);
    });

    // Crossing the phone breakpoint changes column bucketing and axis labels.
    window.matchMedia(NARROW_QUERY).addEventListener('change', render);
    window.addEventListener('scroll', hideTip, { passive: true });

    // Auto-refresh: skip while the tab is hidden, then catch up on return.
    setInterval(() => {
        if (isOpen() && document.visibilityState === 'visible') fetchCounts();
    }, REFRESH_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isOpen()) fetchCounts();
    });

    const savedTheme = readStore(THEME_KEY);
    theme = THEMES.includes(savedTheme) ? savedTheme : 'auto';
    applyTheme();

    selectedDays = loadRange();
    selectedPage = readStore(PAGE_KEY) || null;
    syncRangeTabs();

    // Auto-login if a secret was remembered on this device.
    const remembered = readStore(REMEMBER_KEY);
    if (remembered) {
        secret = remembered;
        els.secretInput.value = remembered;
        els.rememberCheckbox.checked = true;
        openDashboard();
    }
})();
