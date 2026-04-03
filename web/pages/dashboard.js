// dashboard.js — Analytics dashboard for CTA click tracking

(function () {
    'use strict';

    var secret = '';
    var API_URL = '/.netlify/functions/track';

    // Badge type based on button name
    function getBadge(name) {
        if (name.includes('get-started') || name.includes('try-minicycle')) return '<span class="click-badge badge-primary">Primary CTA</span>';
        if (name.includes('learn-more') && !name.startsWith('learn-more-')) return '<span class="click-badge badge-secondary">Secondary CTA</span>';
        if (name.includes('try-now')) return '<span class="click-badge badge-nav">Nav CTA</span>';
        if (name.includes('read-user-manual')) return '<span class="click-badge badge-secondary">Secondary CTA</span>';
        return '';
    }

    // Friendly name from event key
    function friendlyName(key) {
        var name = key.replace(/^(product|learn-more)-/, '');
        return name.split('-').map(function (w) {
            return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(' ');
    }

    // Page label from event key
    function pageLabel(key) {
        if (key.startsWith('product-')) return 'Product';
        if (key.startsWith('learn-more-')) return 'Learn More';
        return 'Unknown';
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(dateStr) {
        var d = new Date(dateStr);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    function formatDateTime(dateStr) {
        var d = new Date(dateStr);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
            ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDateKey(dateStr) {
        var d = new Date(dateStr);
        return d.toISOString().split('T')[0];
    }

    // Get daily breakdown from all clicks across all events
    function getDailyBreakdown(events) {
        var days = {};
        Object.keys(events).forEach(function (key) {
            var clicks = events[key].clicks || [];
            clicks.forEach(function (ts) {
                var day = formatDateKey(ts);
                if (!days[day]) days[day] = 0;
                days[day]++;
            });
        });
        // Sort by date descending
        return Object.entries(days).sort(function (a, b) {
            return b[0].localeCompare(a[0]);
        });
    }

    // Get recent clicks across all events
    function getRecentClicks(events, limit) {
        var all = [];
        Object.keys(events).forEach(function (key) {
            var clicks = events[key].clicks || [];
            clicks.forEach(function (ts) {
                all.push({ event: key, time: ts });
            });
        });
        all.sort(function (a, b) { return b.time.localeCompare(a.time); });
        return all.slice(0, limit);
    }

    // Find the max value in daily breakdown for bar chart scaling
    function getMaxDaily(dailyBreakdown) {
        var max = 0;
        dailyBreakdown.forEach(function (entry) {
            if (entry[1] > max) max = entry[1];
        });
        return max || 1;
    }

    function renderDashboard(events) {
        var content = document.getElementById('content');
        var keys = Object.keys(events);

        if (keys.length === 0) {
            content.innerHTML = '<div class="empty-state"><p>No clicks recorded yet.</p><small>Click a CTA button on the product or learn more page to start tracking.</small></div>';
            document.getElementById('totalClicks').textContent = '0';
            document.getElementById('productTotal').textContent = '0';
            document.getElementById('learnMoreTotal').textContent = '0';
            document.getElementById('todayTotal').textContent = '0';
            return;
        }

        // Group by page
        var product = {};
        var learnMore = {};
        var total = 0;
        var productSum = 0;
        var learnMoreSum = 0;

        keys.forEach(function (key) {
            var val = events[key].total || 0;
            total += val;
            if (key.startsWith('product-')) {
                product[key] = events[key];
                productSum += val;
            } else if (key.startsWith('learn-more-')) {
                learnMore[key] = events[key];
                learnMoreSum += val;
            }
        });

        // Today's count
        var today = new Date().toISOString().split('T')[0];
        var todayCount = 0;
        keys.forEach(function (key) {
            (events[key].clicks || []).forEach(function (ts) {
                if (formatDateKey(ts) === today) todayCount++;
            });
        });

        document.getElementById('totalClicks').textContent = total;
        document.getElementById('productTotal').textContent = productSum;
        document.getElementById('learnMoreTotal').textContent = learnMoreSum;
        document.getElementById('todayTotal').textContent = todayCount;

        var html = '';

        // Sort by total count descending
        function sortedEntries(obj) {
            return Object.entries(obj).sort(function (a, b) { return (b[1].total || 0) - (a[1].total || 0); });
        }

        // --- Button Breakdown ---
        if (Object.keys(product).length > 0) {
            html += '<div class="page-section">';
            html += '<div class="page-section-header"><h3>Product Page</h3><span class="page-total">' + productSum + ' total clicks</span></div>';
            sortedEntries(product).forEach(function (entry) {
                html += '<div class="click-row">';
                html += '<span class="click-name">' + friendlyName(entry[0]) + getBadge(entry[0]) + '</span>';
                html += '<span class="click-count">' + (entry[1].total || 0) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        if (Object.keys(learnMore).length > 0) {
            html += '<div class="page-section">';
            html += '<div class="page-section-header"><h3>Learn More Page</h3><span class="page-total">' + learnMoreSum + ' total clicks</span></div>';
            sortedEntries(learnMore).forEach(function (entry) {
                html += '<div class="click-row">';
                html += '<span class="click-name">' + friendlyName(entry[0]) + getBadge(entry[0]) + '</span>';
                html += '<span class="click-count">' + (entry[1].total || 0) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        // --- Daily Breakdown ---
        var dailyBreakdown = getDailyBreakdown(events);
        if (dailyBreakdown.length > 0) {
            var maxDaily = getMaxDaily(dailyBreakdown);
            var displayDays = dailyBreakdown.slice(0, 14); // Last 14 days

            html += '<div class="page-section">';
            html += '<div class="page-section-header"><h3>Daily Activity</h3><span class="page-total">Last ' + displayDays.length + ' days</span></div>';
            displayDays.forEach(function (entry) {
                var pct = Math.round((entry[1] / maxDaily) * 100);
                html += '<div class="daily-row">';
                html += '<span class="daily-date">' + formatDate(entry[0]) + '</span>';
                html += '<div class="daily-bar-container"><div class="daily-bar" style="width: ' + pct + '%"></div></div>';
                html += '<span class="daily-count">' + entry[1] + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        // --- Recent Clicks ---
        var recent = getRecentClicks(events, 20);
        if (recent.length > 0) {
            html += '<div class="page-section">';
            html += '<div class="page-section-header"><h3>Recent Clicks</h3><span class="page-total">Last ' + recent.length + '</span></div>';
            recent.forEach(function (click) {
                html += '<div class="click-row recent-row">';
                html += '<div class="recent-info">';
                html += '<span class="click-name">' + friendlyName(click.event) + '</span>';
                html += '<span class="recent-page">' + pageLabel(click.event) + '</span>';
                html += '</div>';
                html += '<span class="recent-time">' + formatDateTime(click.time) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        content.innerHTML = html;
        document.getElementById('lastUpdated').textContent = 'Updated ' + formatTime(new Date());
    }

    function fetchCounts() {
        document.getElementById('content').innerHTML = '<div class="loading">Loading...</div>';
        fetch(API_URL + '?secret=' + encodeURIComponent(secret))
            .then(function (res) {
                if (res.status === 401) {
                    document.getElementById('dashboard').style.display = 'none';
                    document.getElementById('authScreen').style.display = 'flex';
                    document.getElementById('authError').style.display = 'block';
                    return null;
                }
                return res.json();
            })
            .then(function (data) {
                if (data && data.events) {
                    // Normalize — some values may be plain numbers (pre-timestamp format)
                    var events = {};
                    Object.keys(data.events).forEach(function (k) {
                        var val = data.events[k];
                        if (typeof val === 'number') {
                            events[k] = { total: val, clicks: [] };
                        } else if (typeof val === 'object' && val !== null) {
                            events[k] = { total: val.total || 0, clicks: val.clicks || [] };
                        } else {
                            events[k] = { total: parseInt(val, 10) || 0, clicks: [] };
                        }
                    });
                    renderDashboard(events);
                } else if (data && data.counts) {
                    // Legacy format compatibility
                    var legacyEvents = {};
                    Object.keys(data.counts).forEach(function (k) {
                        legacyEvents[k] = { total: data.counts[k], clicks: [] };
                    });
                    renderDashboard(legacyEvents);
                }
            })
            .catch(function () {
                document.getElementById('content').innerHTML = '<div class="empty-state"><p>Failed to load data.</p><small>Check your connection and try again.</small></div>';
            });
    }

    // Auth
    function authenticate() {
        secret = document.getElementById('secretInput').value.trim();
        if (!secret) return;

        document.getElementById('authError').style.display = 'none';
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        fetchCounts();
    }

    document.getElementById('authBtn').addEventListener('click', authenticate);
    document.getElementById('secretInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') authenticate();
    });

    // Refresh
    document.getElementById('refreshBtn').addEventListener('click', fetchCounts);

    // Auto-refresh every 60 seconds when dashboard is visible
    setInterval(function () {
        if (document.getElementById('dashboard').style.display === 'block') {
            fetchCounts();
        }
    }, 60000);
})();
