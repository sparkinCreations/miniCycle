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

    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function renderDashboard(counts) {
        var content = document.getElementById('content');
        var keys = Object.keys(counts);

        if (keys.length === 0) {
            content.innerHTML = '<div class="empty-state"><p>No clicks recorded yet.</p><small>Click a CTA button on the product or learn more page to start tracking.</small></div>';
            document.getElementById('totalClicks').textContent = '0';
            document.getElementById('productTotal').textContent = '0';
            document.getElementById('learnMoreTotal').textContent = '0';
            return;
        }

        // Group by page
        var product = {};
        var learnMore = {};
        var total = 0;
        var productSum = 0;
        var learnMoreSum = 0;

        keys.forEach(function (key) {
            var val = counts[key];
            total += val;
            if (key.startsWith('product-')) {
                product[key] = val;
                productSum += val;
            } else if (key.startsWith('learn-more-')) {
                learnMore[key] = val;
                learnMoreSum += val;
            }
        });

        document.getElementById('totalClicks').textContent = total;
        document.getElementById('productTotal').textContent = productSum;
        document.getElementById('learnMoreTotal').textContent = learnMoreSum;

        var html = '';

        // Sort by count descending
        function sortedEntries(obj) {
            return Object.entries(obj).sort(function (a, b) { return b[1] - a[1]; });
        }

        if (Object.keys(product).length > 0) {
            html += '<div class="page-section">';
            html += '<div class="page-section-header"><h3>Product Page</h3><span class="page-total">' + productSum + ' total clicks</span></div>';
            sortedEntries(product).forEach(function (entry) {
                html += '<div class="click-row">';
                html += '<span class="click-name">' + friendlyName(entry[0]) + getBadge(entry[0]) + '</span>';
                html += '<span class="click-count">' + entry[1] + '</span>';
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
                html += '<span class="click-count">' + entry[1] + '</span>';
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
                if (data && data.counts) {
                    renderDashboard(data.counts);
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
