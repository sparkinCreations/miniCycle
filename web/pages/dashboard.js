// dashboard.js — miniCycle dashboard for CTA click tracking

(() => {
    'use strict';

    const API_URL = '/.netlify/functions/track';
    const REFRESH_INTERVAL_MS = 60_000;
    const REMEMBER_KEY = 'minicycle.dashboard.secret';
    const RECENT_LIMIT = 20;
    const DAILY_LIMIT = 14;

    let secret = '';
    let carouselIndex = 0; // preserved across refreshes

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
    };

    const DAY_MS = 86_400_000;

    const PAGE_VIEW_LABELS = {
        'product': 'Product Page',
        'learn-more': 'Learn More Page',
    };

    // ─── Helpers ──────────────────────────────────────────────

    // Use local time so "today" matches the user's wall clock, not UTC.
    const localDateKey = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const dateKeyFromString = (s) => localDateKey(new Date(s));

    const formatTime = (d) =>
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const formatDate = (s) =>
        new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' });

    const formatDateTime = (s) => {
        const d = new Date(s);
        return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${formatTime(d)}`;
    };

    const friendlyName = (key) =>
        key
            .replace(/^(product|learn-more)-/, '')
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

    const pageLabel = (key) => {
        if (key.startsWith('product-')) return 'Product';
        if (key.startsWith('learn-more-')) return 'Learn More';
        return 'Other';
    };

    const badgeClassFor = (key) => {
        if (key.includes('get-started') || key.includes('try-minicycle')) return 'badge-primary';
        if (key.includes('learn-more') && !key.startsWith('learn-more-')) return 'badge-secondary';
        if (key.includes('try-now')) return 'badge-nav';
        if (key.includes('read-user-manual')) return 'badge-secondary';
        return null;
    };

    const BADGE_TEXT = {
        'badge-primary': 'Primary CTA',
        'badge-secondary': 'Secondary CTA',
        'badge-nav': 'Nav CTA',
    };

    const el = (tag, opts = {}, ...children) => {
        const node = document.createElement(tag);
        if (opts.className) node.className = opts.className;
        if (opts.text != null) node.textContent = String(opts.text);
        if (opts.style) Object.assign(node.style, opts.style);
        for (const child of children) if (child) node.appendChild(child);
        return node;
    };

    // ─── Data shaping ─────────────────────────────────────────

    function normalizeEvents(raw) {
        const out = {};
        if (raw && raw.events) {
            for (const [k, v] of Object.entries(raw.events)) {
                if (typeof v === 'number') {
                    out[k] = { total: v, clicks: [] };
                } else if (v && typeof v === 'object') {
                    out[k] = {
                        total: Number(v.total) || 0,
                        clicks: Array.isArray(v.clicks) ? v.clicks : [],
                    };
                } else {
                    out[k] = { total: parseInt(v, 10) || 0, clicks: [] };
                }
            }
            return out;
        }
        if (raw && raw.counts) {
            for (const [k, v] of Object.entries(raw.counts)) {
                out[k] = { total: Number(v) || 0, clicks: [] };
            }
            return out;
        }
        return null;
    }

    function normalizePageviews(raw) {
        const out = {};
        if (!raw || !raw.pageviews) return out;
        for (const [k, v] of Object.entries(raw.pageviews)) {
            if (typeof v === 'number') {
                out[k] = { total: v, clicks: [] };
            } else if (v && typeof v === 'object') {
                out[k] = {
                    total: Number(v.total) || 0,
                    clicks: Array.isArray(v.clicks) ? v.clicks : [],
                };
            } else {
                out[k] = { total: parseInt(v, 10) || 0, clicks: [] };
            }
        }
        return out;
    }

    function summarize(events) {
        const today = localDateKey(new Date());
        const product = {}, learnMore = {}, other = {};
        let total = 0, productSum = 0, learnMoreSum = 0, otherSum = 0, todayCount = 0;

        for (const [key, val] of Object.entries(events)) {
            const n = Number(val.total) || 0;
            total += n;
            if (key.startsWith('product-')) { product[key] = val; productSum += n; }
            else if (key.startsWith('learn-more-')) { learnMore[key] = val; learnMoreSum += n; }
            else { other[key] = val; otherSum += n; }

            for (const ts of val.clicks || []) {
                if (dateKeyFromString(ts) === today) todayCount++;
            }
        }
        return { total, productSum, learnMoreSum, otherSum, todayCount, product, learnMore, other };
    }

    function dailyBreakdown(events) {
        const days = {};
        for (const val of Object.values(events)) {
            for (const ts of val.clicks || []) {
                const day = dateKeyFromString(ts);
                days[day] = (days[day] || 0) + 1;
            }
        }
        // ISO-like local date keys sort lexically.
        return Object.entries(days).sort((a, b) => b[0].localeCompare(a[0]));
    }

    function recentClicks(events, limit) {
        const all = [];
        for (const [key, val] of Object.entries(events)) {
            for (const ts of val.clicks || []) all.push({ event: key, time: ts });
        }
        all.sort((a, b) => String(b.time).localeCompare(String(a.time)));
        return all.slice(0, limit);
    }

    // ─── Render ───────────────────────────────────────────────

    function renderEmpty() {
        els.content.replaceChildren(
            el('div', { className: 'empty-state' },
                el('p', { text: 'No clicks recorded yet.' }),
                el('small', { text: 'Click a CTA button on the product or learn more page to start tracking.' }),
            )
        );
        els.totalClicks.textContent = '0';
        els.totalViews.textContent = '0';
        els.productTotal.textContent = '0';
        els.learnMoreTotal.textContent = '0';
        els.todayTotal.textContent = '0';
        [els.totalClicksDelta, els.totalViewsDelta, els.todayTotalDelta,
            els.productTotalDelta, els.learnMoreTotalDelta].forEach((d) => {
            if (d) { d.textContent = ''; d.className = 'delta'; }
        });
        els.lastUpdated.textContent = `Updated ${formatTime(new Date())}`;
    }

    function renderError(msg) {
        els.content.replaceChildren(
            el('div', { className: 'empty-state' },
                el('p', { text: msg }),
                el('small', { text: 'Check your connection and try again.' }),
            )
        );
    }

    function renderSummary(s, viewsTotal) {
        els.totalClicks.textContent = s.total;
        els.totalViews.textContent = viewsTotal;
        els.productTotal.textContent = s.productSum;
        els.learnMoreTotal.textContent = s.learnMoreSum;
        els.todayTotal.textContent = s.todayCount;
    }

    function viewsTotalCount(pageviews) {
        let total = 0;
        for (const v of Object.values(pageviews)) total += Number(v.total) || 0;
        return total;
    }

    function countInWindow(events, startMs, endMs, keyFilter) {
        let count = 0;
        for (const [key, val] of Object.entries(events)) {
            if (keyFilter && !keyFilter(key)) continue;
            for (const ts of val.clicks || []) {
                const t = Date.parse(ts);
                if (t >= startMs && t < endMs) count++;
            }
        }
        return count;
    }

    function formatDelta(current, prior) {
        if (prior === 0 && current === 0) return { text: '', cls: '' };
        if (prior === 0 && current > 0) return { text: '▲ new', cls: 'up' };
        if (current === prior) return { text: '0%', cls: '' };
        const pct = ((current - prior) / prior) * 100;
        const arrow = pct > 0 ? '▲' : '▼';
        const cls = pct > 0 ? 'up' : 'down';
        return { text: `${arrow} ${Math.abs(pct).toFixed(0)}%`, cls };
    }

    function applyDelta(node, current, prior) {
        if (!node) return;
        const { text, cls } = formatDelta(current, prior);
        node.textContent = text;
        node.className = 'delta' + (cls ? ` ${cls}` : '');
    }

    function renderDeltas(events, pageviews) {
        const now = Date.now();
        const last7Start = now - 7 * DAY_MS;
        const prior14Start = now - 14 * DAY_MS;

        // Today vs same weekday last week (local midnight boundaries).
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayMs = todayStart.getTime();
        const lastWeekTodayMs = todayMs - 7 * DAY_MS;

        const isProduct = (k) => k.startsWith('product-');
        const isLearnMore = (k) => k.startsWith('learn-more-');

        applyDelta(els.totalClicksDelta,
            countInWindow(events, last7Start, now),
            countInWindow(events, prior14Start, last7Start));

        applyDelta(els.totalViewsDelta,
            countInWindow(pageviews, last7Start, now),
            countInWindow(pageviews, prior14Start, last7Start));

        applyDelta(els.todayTotalDelta,
            countInWindow(events, todayMs, todayMs + DAY_MS),
            countInWindow(events, lastWeekTodayMs, lastWeekTodayMs + DAY_MS));

        applyDelta(els.productTotalDelta,
            countInWindow(events, last7Start, now, isProduct),
            countInWindow(events, prior14Start, last7Start, isProduct));

        applyDelta(els.learnMoreTotalDelta,
            countInWindow(events, last7Start, now, isLearnMore),
            countInWindow(events, prior14Start, last7Start, isLearnMore));
    }

    function clicksByHour(events) {
        const hours = new Array(24).fill(0);
        for (const val of Object.values(events)) {
            for (const ts of val.clicks || []) {
                const h = new Date(ts).getHours();
                if (h >= 0 && h < 24) hours[h]++;
            }
        }
        return hours;
    }

    function clicksByWeekday(events) {
        const days = new Array(7).fill(0);
        for (const val of Object.values(events)) {
            for (const ts of val.clicks || []) {
                const d = new Date(ts).getDay();
                if (d >= 0 && d < 7) days[d]++;
            }
        }
        return days;
    }

    function renderConversion(events, s, pageviews) {
        if (Object.keys(pageviews).length === 0) return null;

        const productViews = Number(pageviews['product']?.total) || 0;
        const learnMoreViews = Number(pageviews['learn-more']?.total) || 0;
        const productLaunches = Number(events['product-app-launch']?.total) || 0;
        const learnMoreLaunches = Number(events['learn-more-app-launch']?.total) || 0;

        const launchRows = [
            { label: 'Product Page', views: productViews, launches: productLaunches },
            { label: 'Learn More Page', views: learnMoreViews, launches: learnMoreLaunches },
        ].filter((r) => r.views > 0 || r.launches > 0);

        if (launchRows.length === 0) return null;

        const section = el('div', { className: 'page-section' });
        section.appendChild(
            el('div', { className: 'page-section-header' },
                el('h3', { text: 'App Launch Rate' }),
                el('span', { className: 'page-total', text: 'Visitors who clicked through to the app' }),
            )
        );

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
            const rate = `${((overallLaunches / overallViews) * 100).toFixed(1)}%`;
            section.appendChild(
                el('div', { className: 'click-row', style: { fontWeight: '600' } },
                    el('span', { className: 'click-name', text: 'Overall' }),
                    el('span', { className: 'click-count', text: rate }),
                )
            );
        }

        // Engagement (any click)
        const engagementRows = [
            { label: 'Product Page', views: productViews, clicks: s.productSum },
            { label: 'Learn More Page', views: learnMoreViews, clicks: s.learnMoreSum },
        ].filter((r) => r.views > 0 || r.clicks > 0);

        if (engagementRows.length > 0) {
            section.appendChild(
                el('div', { className: 'page-section-header', style: { marginTop: '0.5rem' } },
                    el('h3', { text: 'Engagement Rate' }),
                    el('span', { className: 'page-total', text: 'Any click ÷ views' }),
                )
            );
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

    function renderTimeBars(title, labels, values) {
        const max = Math.max(...values, 1);
        const wrap = el('div');
        wrap.appendChild(
            el('div', { className: 'page-section-header', style: { background: 'transparent', paddingTop: '1rem' } },
                el('h3', { text: title, style: { fontSize: '0.9rem' } }),
            )
        );
        labels.forEach((label, i) => {
            const count = values[i];
            const pct = Math.round((count / max) * 100);
            wrap.appendChild(
                el('div', { className: 'daily-row' },
                    el('span', { className: 'daily-date', text: label }),
                    el('div', { className: 'daily-bar-container' },
                        el('div', { className: 'daily-bar', style: { width: `${pct}%` } }),
                    ),
                    el('span', { className: 'daily-count', text: count }),
                )
            );
        });
        return wrap;
    }

    function renderTimePatterns(events) {
        const hours = clicksByHour(events);
        const weekdays = clicksByWeekday(events);
        if (hours.every((h) => h === 0)) return null;

        const hourLabels = Array.from({ length: 24 }, (_, h) =>
            h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
        );
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const section = el('div', { className: 'page-section' });
        section.appendChild(
            el('div', { className: 'page-section-header' },
                el('h3', { text: 'Time Patterns' }),
                el('span', { className: 'page-total', text: 'When clicks happen' }),
            )
        );
        section.appendChild(renderTimeBars('By hour of day', hourLabels, hours));
        section.appendChild(renderTimeBars('By day of week', dayLabels, weekdays));
        return section;
    }

    function renderPageViews(pageviews) {
        const keys = Object.keys(pageviews);
        if (keys.length === 0) return null;

        const total = viewsTotalCount(pageviews);
        const section = el('div', { className: 'page-section' });
        section.appendChild(
            el('div', { className: 'page-section-header' },
                el('h3', { text: 'Page Views' }),
                el('span', { className: 'page-total', text: `${total} total views` }),
            )
        );

        Object.entries(pageviews)
            .sort((a, b) => (Number(b[1].total) || 0) - (Number(a[1].total) || 0))
            .forEach(([key, val]) => {
                section.appendChild(
                    el('div', { className: 'click-row' },
                        el('span', { className: 'click-name', text: PAGE_VIEW_LABELS[key] || friendlyName(key) }),
                        el('span', { className: 'click-count', text: Number(val.total) || 0 }),
                    )
                );
            });

        // Daily breakdown for views
        const breakdown = dailyBreakdown(pageviews);
        if (breakdown.length > 0) {
            const max = breakdown.reduce((m, [, n]) => Math.max(m, n), 0) || 1;
            const display = breakdown.slice(0, DAILY_LIMIT);
            section.appendChild(el('div', { className: 'page-section-header', style: { marginTop: '1rem' } },
                el('h3', { text: 'Daily Views' }),
                el('span', { className: 'page-total', text: `Last ${display.length} days` }),
            ));
            for (const [day, count] of display) {
                const pct = Math.round((count / max) * 100);
                section.appendChild(
                    el('div', { className: 'daily-row' },
                        el('span', { className: 'daily-date', text: formatDate(day) }),
                        el('div', { className: 'daily-bar-container' },
                            el('div', { className: 'daily-bar', style: { width: `${pct}%` } }),
                        ),
                        el('span', { className: 'daily-count', text: count }),
                    )
                );
            }
        }

        return section;
    }

    function renderPageSection(title, group, sum) {
        if (Object.keys(group).length === 0) return null;

        const section = el('div', { className: 'page-section' });
        section.appendChild(
            el('div', { className: 'page-section-header' },
                el('h3', { text: title }),
                el('span', { className: 'page-total', text: `${sum} total clicks` }),
            )
        );

        Object.entries(group)
            .sort((a, b) => (Number(b[1].total) || 0) - (Number(a[1].total) || 0))
            .forEach(([key, val]) => {
                const name = el('span', { className: 'click-name', text: friendlyName(key) });
                const cls = badgeClassFor(key);
                if (cls) name.appendChild(el('span', { className: `click-badge ${cls}`, text: BADGE_TEXT[cls] }));

                section.appendChild(
                    el('div', { className: 'click-row' },
                        name,
                        el('span', { className: 'click-count', text: Number(val.total) || 0 }),
                    )
                );
            });
        return section;
    }

    function renderDaily(events) {
        const breakdown = dailyBreakdown(events);
        if (breakdown.length === 0) return null;

        const max = breakdown.reduce((m, [, n]) => Math.max(m, n), 0) || 1;
        const display = breakdown.slice(0, DAILY_LIMIT);

        const section = el('div', { className: 'page-section' });
        section.appendChild(
            el('div', { className: 'page-section-header' },
                el('h3', { text: 'Daily Activity' }),
                el('span', { className: 'page-total', text: `Last ${display.length} days` }),
            )
        );

        for (const [day, count] of display) {
            const pct = Math.round((count / max) * 100);
            section.appendChild(
                el('div', { className: 'daily-row' },
                    el('span', { className: 'daily-date', text: formatDate(day) }),
                    el('div', { className: 'daily-bar-container' },
                        el('div', { className: 'daily-bar', style: { width: `${pct}%` } }),
                    ),
                    el('span', { className: 'daily-count', text: count }),
                )
            );
        }
        return section;
    }

    function renderRecent(events) {
        const recent = recentClicks(events, RECENT_LIMIT);
        if (recent.length === 0) return null;

        const section = el('div', { className: 'page-section' });
        section.appendChild(
            el('div', { className: 'page-section-header' },
                el('h3', { text: 'Recent Clicks' }),
                el('span', { className: 'page-total', text: `Last ${recent.length}` }),
            )
        );

        for (const { event, time } of recent) {
            section.appendChild(
                el('div', { className: 'click-row recent-row' },
                    el('div', { className: 'recent-info' },
                        el('span', { className: 'click-name', text: friendlyName(event) }),
                        el('span', { className: 'recent-page', text: pageLabel(event) }),
                    ),
                    el('span', { className: 'recent-time', text: formatDateTime(time) }),
                )
            );
        }
        return section;
    }

    function mountCarousel(slides) {
        if (slides.length === 0) return null;
        if (carouselIndex >= slides.length) carouselIndex = 0;

        const root = el('div', { className: 'carousel' });

        const prev = el('button', { className: 'carousel-arrow prev', text: '←' });
        prev.type = 'button';
        prev.setAttribute('aria-label', 'Previous section');

        const next = el('button', { className: 'carousel-arrow next', text: '→' });
        next.type = 'button';
        next.setAttribute('aria-label', 'Next section');

        const label = el('div', { className: 'carousel-label' });
        const dots = el('div', { className: 'carousel-dots' });

        const center = el('div', { className: 'carousel-center' }, label, dots);
        const controls = el('div', { className: 'carousel-controls' }, prev, center, next);

        const track = el('div', { className: 'carousel-track' });
        slides.forEach(({ node }) => {
            track.appendChild(el('div', { className: 'carousel-slide' }, node));
        });

        const viewport = el('div', { className: 'carousel-viewport' }, track);

        // Build dot buttons
        const dotEls = slides.map((_, i) => {
            const dot = el('button', { className: 'carousel-dot' });
            dot.type = 'button';
            dot.setAttribute('aria-label', `Go to ${slides[i].title}`);
            dot.addEventListener('click', () => goTo(i));
            dots.appendChild(dot);
            return dot;
        });

        function update() {
            track.style.transform = `translateX(-${carouselIndex * 100}%)`;
            label.textContent = slides[carouselIndex].title;
            dotEls.forEach((d, i) => d.classList.toggle('active', i === carouselIndex));
            prev.disabled = carouselIndex === 0;
            next.disabled = carouselIndex === slides.length - 1;
        }

        function goTo(i) {
            carouselIndex = Math.max(0, Math.min(slides.length - 1, i));
            update();
        }

        prev.addEventListener('click', () => goTo(carouselIndex - 1));
        next.addEventListener('click', () => goTo(carouselIndex + 1));

        root.append(controls, viewport);
        root._goTo = goTo; // expose for keyboard handler
        update();
        return root;
    }

    function renderDashboard(events, pageviews) {
        const hasClicks = Object.keys(events).length > 0;
        const hasViews = Object.keys(pageviews).length > 0;

        if (!hasClicks && !hasViews) {
            renderEmpty();
            return;
        }

        const s = hasClicks
            ? summarize(events)
            : { total: 0, productSum: 0, learnMoreSum: 0, otherSum: 0, todayCount: 0, product: {}, learnMore: {}, other: {} };
        renderSummary(s, viewsTotalCount(pageviews));
        renderDeltas(events, pageviews);

        const slides = [
            { title: 'Page Views', node: renderPageViews(pageviews) },
            { title: 'Conversion', node: renderConversion(events, s, pageviews) },
            { title: 'Time Patterns', node: renderTimePatterns(events) },
            { title: 'Product Page', node: renderPageSection('Product Page', s.product, s.productSum) },
            { title: 'Learn More Page', node: renderPageSection('Learn More Page', s.learnMore, s.learnMoreSum) },
            { title: 'Other', node: renderPageSection('Other', s.other, s.otherSum) },
            { title: 'Daily Activity', node: renderDaily(events) },
            { title: 'Recent Clicks', node: renderRecent(events) },
        ].filter((slide) => slide.node);

        const carousel = mountCarousel(slides);
        els.content.replaceChildren(carousel);
        els._carousel = carousel;
        els.lastUpdated.textContent = `Updated ${formatTime(new Date())}`;
    }

    // ─── Network ──────────────────────────────────────────────

    async function fetchCounts() {
        els.content.replaceChildren(el('div', { className: 'loading', text: 'Loading...' }));
        try {
            const res = await fetch(`${API_URL}?secret=${encodeURIComponent(secret)}`);
            if (res.status === 401) {
                handleUnauthorized();
                return;
            }
            const data = await res.json();
            const events = normalizeEvents(data);
            if (events == null) {
                renderError('Unexpected response.');
                return;
            }
            const pageviews = normalizePageviews(data);
            renderDashboard(events, pageviews);
        } catch {
            renderError('Failed to load data.');
        }
    }

    function handleUnauthorized() {
        forgetSecret();
        secret = '';
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

    // Keyboard navigation for carousel — only when dashboard is shown and focus isn't in an input.
    document.addEventListener('keydown', (e) => {
        if (els.dashboard.style.display !== 'block') return;
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const carousel = els._carousel;
        if (!carousel || !carousel._goTo) return;
        e.preventDefault();
        carousel._goTo(carouselIndex + (e.key === 'ArrowRight' ? 1 : -1));
    });

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
