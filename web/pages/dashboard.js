// dashboard.js — miniCycle dashboard for CTA click tracking
//
// Consumes the aggregated payload from netlify/functions/track.js:
//   { timezone, generatedAt, events: {key: record}, pageviews: {key: record} }
//   record = { total, daily: {"YYYY-MM-DD": n}, hours: n[24], weekdays: n[7], recent: [] }
//
// Day/hour buckets are pre-computed server-side in TRACK_TIMEZONE; this file
// mirrors that zone so "today" lines up with the server's buckets.

(() => {
    'use strict';

    const API_URL = '/.netlify/functions/track';
    const REFRESH_INTERVAL_MS = 60_000;
    const REMEMBER_KEY = 'minicycle.dashboard.secret';
    const RANGE_KEY = 'minicycle.dashboard.range';
    const RECENT_LIMIT = 25;
    const DAY_MS = 86_400_000;
    const DEFAULT_RANGE_DAYS = 30;
    const MAX_SPAN_DAYS = 400;   // matches the function's daily-bucket retention
    const MAX_AXIS_LABELS = 9;

    let secret = '';
    let selectedDays = DEFAULT_RANGE_DAYS;   // null = all time
    let lastData = null;                     // last successful payload, for re-render + error fallback

    const $ = (id) => document.getElementById(id);
    const els = {
        authScreen: $('authScreen'),
        authError: $('authError'),
        authForm: $('authForm'),
        secretInput: $('secretInput'),
        rememberCheckbox: $('rememberSecret'),
        dashboard: $('dashboard'),
        content: $('content'),
        refreshBtn: $('refreshBtn'),
        rangeTabs: $('rangeTabs'),
        errorBanner: $('errorBanner'),
        lastUpdated: $('lastUpdated'),
        totalClicks: $('totalClicks'),
        totalViews: $('totalViews'),
        todayTotal: $('todayTotal'),
        productTotal: $('productTotal'),
        learnMoreTotal: $('learnMoreTotal'),
        totalClicksDelta: $('totalClicksDelta'),
        totalViewsDelta: $('totalViewsDelta'),
        todayTotalDelta: $('todayTotalDelta'),
        productTotalDelta: $('productTotalDelta'),
        learnMoreTotalDelta: $('learnMoreTotalDelta'),
        totalClicksRange: $('totalClicksRange'),
        totalViewsRange: $('totalViewsRange'),
        productTotalRange: $('productTotalRange'),
        learnMoreTotalRange: $('learnMoreTotalRange'),
    };

    const PAGE_VIEW_LABELS = {
        'product': 'Product Page',
        'learn-more': 'Learn More Page',
    };

    const isProduct = (k) => k.startsWith('product-');
    const isLearnMore = (k) => k.startsWith('learn-more-');

    // ─── Dates ────────────────────────────────────────────────

    // The API buckets days/hours in TRACK_TIMEZONE and reports which zone it
    // used. Mirror it so "today" agrees with the server instead of drifting by
    // the viewer's own offset.
    let dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    });

    function setTimezone(tz) {
        try {
            dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
            });
        } catch {
            dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
            });
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

    // Continuous run of the last `n` calendar date keys, ending today. Steps in
    // UTC from a noon anchor so a DST shift can't duplicate or skip a day.
    function dateKeysBack(n, endDate = new Date()) {
        const anchor = keyToUTCNoon(dateKeyFor(endDate));
        const keys = [];
        for (let i = n - 1; i >= 0; i--) keys.push(utcToKey(anchor - i * DAY_MS));
        return keys;
    }

    // Every day from the earliest recorded bucket through today, so the "All"
    // range still produces a continuous (gap-filled) series.
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

    const formatTime = (d) =>
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build from explicit parts — `new Date('2026-07-27')` parses as UTC midnight
    // and then renders one day early for viewers west of UTC.
    const formatDate = (key) => {
        const [y, m, d] = String(key).split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const formatDateTime = (s) => {
        const d = new Date(s);
        return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${formatTime(d)}`;
    };

    // ─── Labels ───────────────────────────────────────────────

    const friendlyName = (key) =>
        key
            .replace(/^(product|learn-more)-/, '')
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

    const pageLabel = (key) => {
        if (isProduct(key)) return 'Product';
        if (isLearnMore(key)) return 'Learn More';
        return 'Other';
    };

    const badgeClassFor = (key) => {
        if (key.includes('get-started') || key.includes('try-minicycle')) return 'badge-primary';
        if (key.includes('learn-more') && !isLearnMore(key)) return 'badge-secondary';
        if (key.includes('try-now')) return 'badge-nav';
        if (key.includes('read-user-manual')) return 'badge-secondary';
        return null;
    };

    const BADGE_TEXT = {
        'badge-primary': 'Primary CTA',
        'badge-secondary': 'Secondary CTA',
        'badge-nav': 'Nav CTA',
    };

    const rangeLabel = () => (selectedDays ? `${selectedDays}d` : 'all time');
    const rangeSentence = () => (selectedDays ? `Last ${selectedDays} days` : 'All time');

    const el = (tag, opts = {}, ...children) => {
        const node = document.createElement(tag);
        if (opts.className) node.className = opts.className;
        if (opts.text != null) node.textContent = String(opts.text);
        if (opts.title) node.title = opts.title;
        if (opts.style) Object.assign(node.style, opts.style);
        for (const child of children) if (child) node.appendChild(child);
        return node;
    };

    // ─── Data shaping ─────────────────────────────────────────

    // Older payload shapes (bare number, or { total, clicks[] }) are tolerated so
    // the dashboard keeps working against a not-yet-redeployed function.
    function normalizeRecord(v) {
        if (typeof v === 'number') {
            return { total: v, daily: {}, hours: [], weekdays: [], recent: [] };
        }
        if (!v || typeof v !== 'object') {
            return { total: parseInt(v, 10) || 0, daily: {}, hours: [], weekdays: [], recent: [] };
        }
        const daily = {};
        if (v.daily && typeof v.daily === 'object') {
            for (const [day, n] of Object.entries(v.daily)) {
                const count = Number(n);
                if (Number.isFinite(count) && count > 0) daily[day] = count;
            }
        }
        return {
            total: Number(v.total) || 0,
            daily,
            hours: Array.isArray(v.hours) ? v.hours : [],
            weekdays: Array.isArray(v.weekdays) ? v.weekdays : [],
            recent: Array.isArray(v.recent) ? v.recent
                : Array.isArray(v.clicks) ? v.clicks
                : [],
        };
    }

    function normalizeMap(source) {
        const out = {};
        for (const [k, v] of Object.entries(source)) out[k] = normalizeRecord(v);
        return out;
    }

    function normalizeEvents(raw) {
        if (raw && raw.events) return normalizeMap(raw.events);
        if (raw && raw.counts) return normalizeMap(raw.counts);
        return null;
    }

    function normalizePageviews(raw) {
        if (!raw || !raw.pageviews) return {};
        return normalizeMap(raw.pageviews);
    }

    // Range-aware total for one record. `keys === null` means all time, which
    // uses the lifetime `total` — that survives daily-bucket pruning.
    function recordTotal(record, keys) {
        if (!record) return 0;
        if (!keys) return Number(record.total) || 0;
        let sum = 0;
        const daily = record.daily || {};
        for (const key of keys) sum += Number(daily[key]) || 0;
        return sum;
    }

    function groupTotal(records, keys, keyFilter) {
        let sum = 0;
        for (const [key, rec] of Object.entries(records)) {
            if (keyFilter && !keyFilter(key)) continue;
            sum += recordTotal(rec, keys);
        }
        return sum;
    }

    // Gap-filled series: every day in `keys` gets a value, including zeros.
    function seriesFor(records, keys, keyFilter) {
        return keys.map((day) => {
            let sum = 0;
            for (const [key, rec] of Object.entries(records)) {
                if (keyFilter && !keyFilter(key)) continue;
                sum += Number(rec.daily?.[day]) || 0;
            }
            return sum;
        });
    }

    function sumHistogram(records, field, length) {
        const out = new Array(length).fill(0);
        for (const val of Object.values(records)) {
            const bucket = val[field];
            if (!Array.isArray(bucket)) continue;
            for (let i = 0; i < length; i++) out[i] += Number(bucket[i]) || 0;
        }
        return out;
    }

    function recentClicks(events, limit) {
        const all = [];
        for (const [key, val] of Object.entries(events)) {
            for (const ts of val.recent || []) all.push({ event: key, time: ts });
        }
        all.sort((a, b) => String(b.time).localeCompare(String(a.time)));
        return all.slice(0, limit);
    }

    // ─── Building blocks ──────────────────────────────────────

    function panel(title, note, { wide = false } = {}) {
        const section = el('div', { className: wide ? 'page-section wide' : 'page-section' });
        section.appendChild(
            el('div', { className: 'page-section-header' },
                el('h3', { text: title }),
                note ? el('span', { className: 'page-total', text: note }) : null,
            )
        );
        return section;
    }

    function subhead(title, note) {
        return el('div', { className: 'subhead' },
            el('h4', { text: title }),
            note ? el('span', { className: 'page-total', text: note }) : null,
        );
    }

    // Vertical column chart. Reads left→right in time order, unlike the old
    // newest-first bar list, and renders zero days as empty slots.
    function columnChart(values, labels, tooltip) {
        const max = Math.max(...values, 1);
        const cols = el('div', { className: 'chart-cols' });
        const axis = el('div', { className: 'chart-axis' });
        // Thin the axis on narrow screens so date labels don't collide.
        const maxLabels = window.innerWidth < 700 ? 5 : MAX_AXIS_LABELS;
        const step = Math.max(1, Math.ceil(values.length / maxLabels));

        values.forEach((count, i) => {
            const col = el('div', {
                className: 'chart-col',
                title: tooltip ? tooltip(i, count) : `${labels[i]}: ${count}`,
            });
            const bar = el('div', {
                className: count === 0 ? 'chart-bar zero' : 'chart-bar',
                style: { height: count === 0 ? '3px' : `${Math.max(3, Math.round((count / max) * 100))}%` },
            });
            col.appendChild(bar);
            cols.appendChild(col);
            // Label every `step`th column, anchored so the newest day always shows.
            const show = (values.length - 1 - i) % step === 0;
            axis.appendChild(el('span', { text: show ? labels[i] : '' }));
        });

        return el('div', { className: 'chart' }, cols, axis);
    }

    // ─── Panels ───────────────────────────────────────────────

    function renderActivity(events, pageviews, keys) {
        const clickSeries = seriesFor(events, keys);
        const viewSeries = seriesFor(pageviews, keys);
        if (clickSeries.every((n) => n === 0) && viewSeries.every((n) => n === 0)) return null;

        const labels = keys.map(formatDate);
        const section = panel('Activity', rangeSentence(), { wide: true });

        const clickTotal = clickSeries.reduce((a, b) => a + b, 0);
        section.appendChild(subhead('Clicks', `${clickTotal} in range`));
        section.appendChild(columnChart(clickSeries, labels,
            (i, n) => `${labels[i]}: ${n} click${n === 1 ? '' : 's'}`));

        const viewTotal = viewSeries.reduce((a, b) => a + b, 0);
        section.appendChild(subhead('Page views', `${viewTotal} in range`));
        section.appendChild(columnChart(viewSeries, labels,
            (i, n) => `${labels[i]}: ${n} view${n === 1 ? '' : 's'}`));

        return section;
    }

    function renderConversion(events, pageviews, keys) {
        const productViews = recordTotal(pageviews['product'], keys);
        const learnMoreViews = recordTotal(pageviews['learn-more'], keys);
        const productLaunches = recordTotal(events['product-app-launch'], keys);
        const learnMoreLaunches = recordTotal(events['learn-more-app-launch'], keys);

        const launchRows = [
            { label: 'Product Page', views: productViews, launches: productLaunches },
            { label: 'Learn More Page', views: learnMoreViews, launches: learnMoreLaunches },
        ].filter((r) => r.views > 0 || r.launches > 0);

        if (launchRows.length === 0) return null;

        // Views are raw hits, not deduplicated visitors — the privacy policy rules
        // out any per-visitor identifier — so this is clicks-per-view, not a
        // true per-person conversion rate.
        const section = panel('App Launch Rate', 'Launches ÷ page views');

        launchRows.forEach(({ label, views, launches }) => {
            const rate = views > 0 ? `${((launches / views) * 100).toFixed(1)}%` : '—';
            section.appendChild(
                el('div', { className: 'click-row recent-row' },
                    el('div', { className: 'recent-info' },
                        el('span', { className: 'click-name', text: label }),
                        el('span', { className: 'recent-page', text: `${views} views · ${launches} launches` }),
                    ),
                    el('span', { className: 'click-count', text: rate }),
                )
            );
        });

        const overallViews = productViews + learnMoreViews;
        const overallLaunches = productLaunches + learnMoreLaunches;
        if (overallViews > 0 && launchRows.length > 1) {
            section.appendChild(
                el('div', { className: 'click-row', style: { fontWeight: '600' } },
                    el('span', { className: 'click-name', text: 'Overall' }),
                    el('span', {
                        className: 'click-count',
                        text: `${((overallLaunches / overallViews) * 100).toFixed(1)}%`,
                    }),
                )
            );
        }

        const engagementRows = [
            { label: 'Product Page', views: productViews, clicks: groupTotal(events, keys, isProduct) },
            { label: 'Learn More Page', views: learnMoreViews, clicks: groupTotal(events, keys, isLearnMore) },
        ].filter((r) => r.views > 0 || r.clicks > 0);

        if (engagementRows.length > 0) {
            section.appendChild(subhead('Engagement Rate', 'Any click ÷ views'));
            engagementRows.forEach(({ label, views, clicks }) => {
                const rate = views > 0 ? `${((clicks / views) * 100).toFixed(1)}%` : '—';
                section.appendChild(
                    el('div', { className: 'click-row recent-row' },
                        el('div', { className: 'recent-info' },
                            el('span', { className: 'click-name', text: label }),
                            el('span', { className: 'recent-page', text: `${views} views · ${clicks} clicks` }),
                        ),
                        el('span', { className: 'click-count', text: rate }),
                    )
                );
            });
        }

        return section;
    }

    // Hour/weekday histograms are stored as lifetime aggregates, so they cannot
    // follow the range selector. Labelled explicitly rather than left ambiguous.
    function renderTimePatterns(events) {
        const hours = sumHistogram(events, 'hours', 24);
        const weekdays = sumHistogram(events, 'weekdays', 7);
        if (hours.every((h) => h === 0) && weekdays.every((d) => d === 0)) return null;

        const hourLabels = Array.from({ length: 24 }, (_, h) =>
            h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`
        );
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const section = panel('Time Patterns', 'All time · not filtered by range', { wide: true });
        section.appendChild(subhead('By hour of day', null));
        section.appendChild(columnChart(hours, hourLabels,
            (i, n) => `${hourLabels[i]}: ${n} click${n === 1 ? '' : 's'}`));
        section.appendChild(subhead('By day of week', null));
        section.appendChild(columnChart(weekdays, dayLabels,
            (i, n) => `${dayLabels[i]}: ${n} click${n === 1 ? '' : 's'}`));
        return section;
    }

    function renderPageViews(pageviews, keys) {
        const rows = Object.entries(pageviews)
            .map(([key, rec]) => ({ key, count: recordTotal(rec, keys) }))
            .filter((r) => r.count > 0)
            .sort((a, b) => b.count - a.count);

        if (rows.length === 0) return null;

        const total = rows.reduce((sum, r) => sum + r.count, 0);
        const section = panel('Page Views', `${total} · ${rangeLabel()}`);
        for (const { key, count } of rows) {
            section.appendChild(
                el('div', { className: 'click-row' },
                    el('span', { className: 'click-name', text: PAGE_VIEW_LABELS[key] || friendlyName(key) }),
                    el('span', { className: 'click-count', text: count }),
                )
            );
        }
        return section;
    }

    function renderPageSection(title, records, keys, keyFilter) {
        const rows = Object.entries(records)
            .filter(([key]) => !keyFilter || keyFilter(key))
            .map(([key, rec]) => ({ key, count: recordTotal(rec, keys) }))
            .filter((r) => r.count > 0)
            .sort((a, b) => b.count - a.count);

        if (rows.length === 0) return null;

        const sum = rows.reduce((acc, r) => acc + r.count, 0);
        const section = panel(title, `${sum} clicks · ${rangeLabel()}`);
        const body = el('div', { className: 'scroll-body' });

        for (const { key, count } of rows) {
            const name = el('span', { className: 'click-name', text: friendlyName(key) });
            const cls = badgeClassFor(key);
            if (cls) name.appendChild(el('span', { className: `click-badge ${cls}`, text: BADGE_TEXT[cls] }));
            body.appendChild(
                el('div', { className: 'click-row' }, name, el('span', { className: 'click-count', text: count }))
            );
        }
        section.appendChild(body);
        return section;
    }

    // The recent feed is a fixed-size ring from the API, so it ignores the range.
    function renderRecent(events) {
        const recent = recentClicks(events, RECENT_LIMIT);
        if (recent.length === 0) return null;

        const section = panel('Recent Clicks', `Latest ${recent.length} · not filtered by range`);
        const body = el('div', { className: 'scroll-body' });
        for (const { event, time } of recent) {
            body.appendChild(
                el('div', { className: 'click-row recent-row' },
                    el('div', { className: 'recent-info' },
                        el('span', { className: 'click-name', text: friendlyName(event) }),
                        el('span', { className: 'recent-page', text: pageLabel(event) }),
                    ),
                    el('span', { className: 'recent-time', text: formatDateTime(time) }),
                )
            );
        }
        section.appendChild(body);
        return section;
    }

    // ─── Summary cards ────────────────────────────────────────

    function formatDelta(current, prior) {
        if (prior === 0 && current === 0) return { text: '', cls: '' };
        if (prior === 0 && current > 0) return { text: '▲ new', cls: 'up' };
        if (current === prior) return { text: '0%', cls: '' };
        const pct = ((current - prior) / prior) * 100;
        return {
            text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%`,
            cls: pct > 0 ? 'up' : 'down',
        };
    }

    function applyDelta(node, current, prior, title) {
        if (!node) return;
        const { text, cls } = formatDelta(current, prior);
        node.textContent = text;
        node.className = 'delta' + (cls ? ` ${cls}` : '');
        node.title = text ? title : '';
    }

    function clearDeltas() {
        for (const node of [els.totalClicksDelta, els.totalViewsDelta, els.todayTotalDelta,
            els.productTotalDelta, els.learnMoreTotalDelta]) {
            if (node) { node.textContent = ''; node.className = 'delta'; node.title = ''; }
        }
    }

    function renderSummary(events, pageviews, keys) {
        for (const node of [els.totalClicksRange, els.totalViewsRange,
            els.productTotalRange, els.learnMoreTotalRange]) {
            if (node) node.textContent = `· ${rangeLabel()}`;
        }

        els.totalClicks.textContent = groupTotal(events, keys);
        els.totalViews.textContent = groupTotal(pageviews, keys);
        els.productTotal.textContent = groupTotal(events, keys, isProduct);
        els.learnMoreTotal.textContent = groupTotal(events, keys, isLearnMore);

        const today = [dateKeyFor(new Date())];
        els.todayTotal.textContent = groupTotal(events, today);

        // Today always compares to the same weekday last week.
        applyDelta(els.todayTotalDelta,
            groupTotal(events, today),
            groupTotal(events, dateKeysBack(8).slice(0, 1)),
            'vs. same day last week');

        // All-time has no equivalent prior window to compare against.
        if (!keys) {
            for (const node of [els.totalClicksDelta, els.totalViewsDelta,
                els.productTotalDelta, els.learnMoreTotalDelta]) {
                if (node) { node.textContent = ''; node.className = 'delta'; node.title = ''; }
            }
            return;
        }

        // The card value and its delta now cover the same window: the selected
        // range, compared against the immediately preceding range of equal length.
        const prior = dateKeysBack(selectedDays * 2).slice(0, selectedDays);
        const vs = `vs. previous ${selectedDays} days`;

        applyDelta(els.totalClicksDelta, groupTotal(events, keys), groupTotal(events, prior), vs);
        applyDelta(els.totalViewsDelta, groupTotal(pageviews, keys), groupTotal(pageviews, prior), vs);
        applyDelta(els.productTotalDelta,
            groupTotal(events, keys, isProduct), groupTotal(events, prior, isProduct), vs);
        applyDelta(els.learnMoreTotalDelta,
            groupTotal(events, keys, isLearnMore), groupTotal(events, prior, isLearnMore), vs);
    }

    // ─── Render ───────────────────────────────────────────────

    function renderEmpty() {
        els.content.replaceChildren(
            el('div', { className: 'empty-state' },
                el('p', { text: 'No clicks recorded yet.' }),
                el('small', { text: 'Click a CTA button on the product or learn more page to start tracking.' }),
            )
        );
        for (const node of [els.totalClicks, els.totalViews, els.productTotal,
            els.learnMoreTotal, els.todayTotal]) {
            node.textContent = '0';
        }
        clearDeltas();
        els.lastUpdated.textContent = `Updated ${formatTime(new Date())}`;
    }

    function render() {
        if (!lastData) return;
        const { events, pageviews } = lastData;

        if (Object.keys(events).length === 0 && Object.keys(pageviews).length === 0) {
            renderEmpty();
            return;
        }

        const keys = selectedDays ? dateKeysBack(selectedDays) : null;
        renderSummary(events, pageviews, keys);

        // Charts always need a concrete day list; "All" spans from the earliest
        // recorded day through today.
        const chartKeys = keys || spanKeys(events, pageviews);

        const panels = [
            renderActivity(events, pageviews, chartKeys),
            renderConversion(events, pageviews, keys),
            renderPageViews(pageviews, keys),
            renderPageSection('Product Page', events, keys, isProduct),
            renderPageSection('Learn More Page', events, keys, isLearnMore),
            renderPageSection('Other', events, keys, (k) => !isProduct(k) && !isLearnMore(k)),
            renderTimePatterns(events),
            renderRecent(events),
        ].filter(Boolean);

        if (panels.length === 0) {
            els.content.replaceChildren(
                el('div', { className: 'empty-state' },
                    el('p', { text: `No activity in the last ${selectedDays} days.` }),
                    el('small', { text: 'Try a wider range.' }),
                )
            );
            return;
        }

        els.content.replaceChildren(el('div', { className: 'panels' }, ...panels));
    }

    function showError(msg) {
        if (lastData) {
            // Keep the last good view on screen rather than replacing real numbers
            // with a stale-looking error page.
            els.errorBanner.textContent = `${msg} Showing data from ${els.lastUpdated.textContent.replace('Updated ', '')}.`;
            els.errorBanner.hidden = false;
            return;
        }
        els.errorBanner.hidden = true;
        els.content.replaceChildren(
            el('div', { className: 'empty-state' },
                el('p', { text: msg }),
                el('small', { text: 'Check your connection and try again.' }),
            )
        );
        for (const node of [els.totalClicks, els.totalViews, els.productTotal,
            els.learnMoreTotal, els.todayTotal]) {
            node.textContent = '—';
        }
        clearDeltas();
    }

    // ─── Network ──────────────────────────────────────────────

    async function fetchCounts() {
        // Only blank the page on a cold load; auto-refresh renders in place so
        // the view doesn't flash and lose scroll position every minute.
        if (!lastData) {
            els.content.replaceChildren(el('div', { className: 'loading', text: 'Loading...' }));
        }
        try {
            // Secret goes in the Authorization header, never the query string —
            // query strings are captured by hosting access logs.
            const res = await fetch(API_URL, {
                headers: { Authorization: `Bearer ${secret}` },
                cache: 'no-store',
            });
            if (res.status === 401) {
                handleUnauthorized();
                return;
            }
            const data = await res.json();
            const events = normalizeEvents(data);
            if (events == null) {
                showError('Unexpected response.');
                return;
            }
            setTimezone(data.timezone);
            lastData = { events, pageviews: normalizePageviews(data) };
            els.errorBanner.hidden = true;
            els.lastUpdated.textContent = `Updated ${formatTime(new Date())}`;
            render();
        } catch {
            showError('Failed to load data.');
        }
    }

    function handleUnauthorized() {
        forgetSecret();
        secret = '';
        lastData = null;
        els.secretInput.value = '';
        if (els.rememberCheckbox) els.rememberCheckbox.checked = false;
        els.dashboard.style.display = 'none';
        els.authScreen.style.display = 'flex';
        els.authError.style.display = 'block';
    }

    // ─── Auth + remember ──────────────────────────────────────

    function rememberSecret(s) {
        try { localStorage.setItem(REMEMBER_KEY, s); } catch { /* storage disabled */ }
    }

    function forgetSecret() {
        try { localStorage.removeItem(REMEMBER_KEY); } catch { /* storage disabled */ }
    }

    function loadRemembered() {
        try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
    }

    function loadRange() {
        try {
            const saved = localStorage.getItem(RANGE_KEY);
            if (saved === 'all') return null;
            const n = parseInt(saved, 10);
            return [7, 30, 90].includes(n) ? n : DEFAULT_RANGE_DAYS;
        } catch {
            return DEFAULT_RANGE_DAYS;
        }
    }

    function saveRange() {
        try { localStorage.setItem(RANGE_KEY, selectedDays ? String(selectedDays) : 'all'); }
        catch { /* storage disabled */ }
    }

    function syncRangeTabs() {
        const current = selectedDays ? String(selectedDays) : 'all';
        for (const tab of els.rangeTabs.querySelectorAll('.range-tab')) {
            const active = tab.dataset.days === current;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-pressed', String(active));
        }
    }

    function authenticate() {
        const value = els.secretInput.value.trim();
        if (!value) return;
        secret = value;

        if (els.rememberCheckbox?.checked) rememberSecret(secret);
        else forgetSecret();

        els.authError.style.display = 'none';
        els.authScreen.style.display = 'none';
        els.dashboard.style.display = 'block';
        fetchCounts();
    }

    // ─── Wire up ──────────────────────────────────────────────

    els.authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        authenticate();
    });

    els.refreshBtn.addEventListener('click', fetchCounts);

    // Range changes re-render from cached data — no refetch needed.
    els.rangeTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.range-tab');
        if (!tab) return;
        selectedDays = tab.dataset.days === 'all' ? null : parseInt(tab.dataset.days, 10);
        saveRange();
        syncRangeTabs();
        render();
    });

    // Auto-refresh: skip when tab is hidden, then catch up on return.
    setInterval(() => {
        if (els.dashboard.style.display === 'block' && document.visibilityState === 'visible') {
            fetchCounts();
        }
    }, REFRESH_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && els.dashboard.style.display === 'block') {
            fetchCounts();
        }
    });

    selectedDays = loadRange();
    syncRangeTabs();

    // Auto-login if we have a remembered secret.
    const remembered = loadRemembered();
    if (remembered) {
        secret = remembered;
        els.secretInput.value = remembered;
        if (els.rememberCheckbox) els.rememberCheckbox.checked = true;
        els.authScreen.style.display = 'none';
        els.dashboard.style.display = 'block';
        fetchCounts();
    }
})();
