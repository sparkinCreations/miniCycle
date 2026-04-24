// product.js — Product page carousel, changelog accordion, and smooth scroll
// Redesigned to match learn_more.html visual patterns

(function () {
    'use strict';

    // =========================================================
    // Carousel (only if elements exist on page)
    // =========================================================
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');

    if (prevBtn && nextBtn) {
        var videos = [
            { src: '../assets/videos/samples/Daily_Home_Routine.gif', title: 'Daily Home Routine', description: 'Streamline your daily home tasks with organized cycles that keep you productive and focused.' },
            { src: '../assets/videos/samples/Daily_Work_Routine.gif', title: 'Daily Work Routine', description: 'Boost your work productivity with structured cycle lists that help you stay on track throughout the day.' },
            { src: '../assets/videos/samples/Monday_Fitness_Routine.gif', title: 'Monday Fitness Routine', description: 'Start your week strong with organized fitness cycles that make staying healthy simple and sustainable.' }
        ];

        var currentIndex = 0;
        var isTransitioning = false;
        var videoElement = document.getElementById('currentVideo');
        var titleElement = document.getElementById('videoTitle');
        var descriptionElement = document.getElementById('videoDescription');
        var videoInfo = document.querySelector('.video-info');
        var dots = document.querySelectorAll('.dot');

        function updateContent(video, index) {
            titleElement.textContent = video.title;
            descriptionElement.textContent = video.description;
            dots.forEach(function (dot, i) {
                dot.classList.toggle('active', i === index);
                dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
            });
            videoElement.alt = 'miniCycle demo: ' + video.title;
            setTimeout(function () { videoInfo.classList.remove('fade-out'); currentIndex = index; isTransitioning = false; }, 100);
        }

        function updateVideo(index) {
            if (isTransitioning) return;
            isTransitioning = true;
            var video = videos[index];
            videoInfo.classList.add('fade-out');
            videoElement.classList.add('fade-out');
            setTimeout(function () { videoElement.src = video.src; videoElement.classList.remove('fade-out'); videoElement.classList.add('fade-in'); updateContent(video, index); }, 250);
        }

        function nextVideo() { updateVideo((currentIndex + 1) % videos.length); }
        function prevVideo() { updateVideo((currentIndex - 1 + videos.length) % videos.length); }

        nextBtn.addEventListener('click', function () { nextBtn.style.transform = 'scale(0.9)'; setTimeout(function () { nextBtn.style.transform = ''; }, 150); nextVideo(); });
        prevBtn.addEventListener('click', function () { prevBtn.style.transform = 'scale(0.9)'; setTimeout(function () { prevBtn.style.transform = ''; }, 150); prevVideo(); });
        dots.forEach(function (dot, index) { dot.addEventListener('click', function () { updateVideo(index); }); });
        document.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') nextVideo(); if (e.key === 'ArrowLeft') prevVideo(); });
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setInterval(nextVideo, 15000); }
    }

    // =========================================================
    // Features Carousel (infinite loop via cloned slides)
    // =========================================================
    var featuresCarousel = document.getElementById('featuresCarousel');
    var featuresDots = document.getElementById('featuresDots');

    if (featuresCarousel && featuresDots) {
        var featuresPrevBtn = document.querySelector('.features-arrow-prev');
        var featuresNextBtn = document.querySelector('.features-arrow-next');
        var featuresProgressBar = document.getElementById('featuresProgressBar');

        var AUTO_ADVANCE_MS = 5000;
        var USER_PAUSE_MS = 10000;

        // Snapshot real cards BEFORE we clone.
        var realCards = Array.prototype.slice.call(featuresCarousel.querySelectorAll('.feature-card'));
        var N = realCards.length;

        // Clone full set to the left and right. DOM becomes: [clonesL][real][clonesR].
        function buildClones(side) {
            return realCards.map(function (c) {
                var clone = c.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                clone.setAttribute('tabindex', '-1');
                clone.dataset.clone = side;
                return clone;
            });
        }
        var leftClones = buildClones('left');
        var rightClones = buildClones('right');
        for (var li = 0; li < leftClones.length; li++) {
            featuresCarousel.insertBefore(leftClones[li], realCards[0]);
        }
        for (var ri = 0; ri < rightClones.length; ri++) {
            featuresCarousel.appendChild(rightClones[ri]);
        }
        // All cards in DOM order (3 * N total)
        var allCards = Array.prototype.slice.call(featuresCarousel.querySelectorAll('.feature-card'));

        // Build dots — one per REAL card only
        for (var fi = 0; fi < N; fi++) {
            var fDot = document.createElement('button');
            fDot.type = 'button';
            fDot.className = 'features-dot';
            fDot.setAttribute('aria-label', 'Go to feature ' + (fi + 1));
            fDot.setAttribute('role', 'tab');
            featuresDots.appendChild(fDot);
        }
        var fDots = featuresDots.querySelectorAll('.features-dot');

        function getFeatureStep() {
            if (allCards.length < 2) return allCards[0] ? allCards[0].offsetWidth : 0;
            return allCards[N + 1].offsetLeft - allCards[N].offsetLeft;
        }

        // offsetLeft of first real card (start of middle set)
        function getRealOffset() {
            return allCards[N] ? allCards[N].offsetLeft : 0;
        }

        // Set initial scroll position to the first real card (not the first clone).
        // Uses 'instant' to defeat any inherited smooth scrolling.
        function jumpToRealStart() {
            try {
                featuresCarousel.scrollTo({ left: getRealOffset(), behavior: 'instant' });
            } catch (e) {
                featuresCarousel.scrollLeft = getRealOffset();
            }
        }
        jumpToRealStart();

        // When the user scrolls past the real band into a clone zone, silently teleport
        // by N * step to the matching real card. Clones are identical to real cards, so
        // the jump is invisible — as long as it's truly instant (no animation).
        var isTeleporting = false;
        function instantScroll(target) {
            try {
                featuresCarousel.scrollTo({ left: target, behavior: 'instant' });
            } catch (e) {
                featuresCarousel.scrollLeft = target;
            }
        }
        function checkTeleport() {
            var step = getFeatureStep();
            if (!step) return;
            var realStart = getRealOffset();
            var realEnd = realStart + step * (N - 1); // offset of last real card
            var pos = featuresCarousel.scrollLeft;
            var shift = step * N;
            if (pos > realEnd + step * 0.5) {
                isTeleporting = true;
                instantScroll(pos - shift);
                isTeleporting = false;
            } else if (pos < realStart - step * 0.5) {
                isTeleporting = true;
                instantScroll(pos + shift);
                isTeleporting = false;
            }
        }

        function getActiveRealIdx() {
            var step = getFeatureStep();
            if (!step) return 0;
            var pos = Math.round((featuresCarousel.scrollLeft - getRealOffset()) / step);
            return ((pos % N) + N) % N;
        }

        function updateFeatureUi() {
            var idx = getActiveRealIdx();
            for (var di = 0; di < fDots.length; di++) {
                fDots[di].classList.toggle('active', di === idx);
                fDots[di].setAttribute('aria-selected', di === idx ? 'true' : 'false');
            }
            if (featuresProgressBar) {
                var progress = N > 1 ? idx / (N - 1) : 0;
                featuresProgressBar.style.width = (progress * 100) + '%';
            }
        }

        var featureScrollTimer;
        featuresCarousel.addEventListener('scroll', function () {
            if (isTeleporting) return;
            updateFeatureUi();
            clearTimeout(featureScrollTimer);
            featureScrollTimer = setTimeout(function () {
                checkTeleport();
                updateFeatureUi();
            }, 150);
        });

        // ---- Navigation ----
        function scrollNext() {
            featuresCarousel.scrollBy({ left: getFeatureStep(), behavior: 'smooth' });
        }
        function scrollPrev() {
            featuresCarousel.scrollBy({ left: -getFeatureStep(), behavior: 'smooth' });
        }

        // Jump to a specific real card via dots — pick the nearest copy (real or clone)
        // to keep the visual scroll distance short.
        function scrollToRealIdx(realIdx) {
            var step = getFeatureStep();
            if (!step) return;
            var currentCardPos = Math.round(featuresCarousel.scrollLeft / step);
            var candidates = [realIdx, realIdx + N, realIdx + 2 * N];
            var closest = candidates[0];
            for (var k = 1; k < candidates.length; k++) {
                if (Math.abs(candidates[k] - currentCardPos) < Math.abs(closest - currentCardPos)) {
                    closest = candidates[k];
                }
            }
            featuresCarousel.scrollTo({ left: closest * step, behavior: 'smooth' });
        }

        // ---- Auto-advance ----
        var autoAdvanceInterval = null;
        var pauseResumeTimer = null;
        var isUserPaused = false;

        function canAutoAdvance() {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
            if (!window.matchMedia('(min-width: 768px)').matches) return false;
            return true;
        }
        function tickAutoAdvance() {
            if (isUserPaused) return;
            scrollNext();
        }
        function startAutoAdvance() {
            stopAutoAdvance();
            if (!canAutoAdvance()) return;
            autoAdvanceInterval = setInterval(tickAutoAdvance, AUTO_ADVANCE_MS);
        }
        function stopAutoAdvance() {
            if (autoAdvanceInterval) {
                clearInterval(autoAdvanceInterval);
                autoAdvanceInterval = null;
            }
        }
        function pauseFor(ms) {
            isUserPaused = true;
            clearTimeout(pauseResumeTimer);
            if (ms) {
                pauseResumeTimer = setTimeout(function () { isUserPaused = false; }, ms);
            }
        }
        function resumeNow() {
            clearTimeout(pauseResumeTimer);
            isUserPaused = false;
        }

        // Pause on pointer hover / keyboard focus
        featuresCarousel.addEventListener('mouseenter', function () { pauseFor(0); });
        featuresCarousel.addEventListener('mouseleave', function () { resumeNow(); });
        featuresCarousel.addEventListener('focusin', function () { pauseFor(0); });
        featuresCarousel.addEventListener('focusout', function () { resumeNow(); });

        // Dot clicks: jump to real idx via nearest copy
        for (var dk = 0; dk < fDots.length; dk++) {
            (function (idx) {
                fDots[idx].addEventListener('click', function () {
                    pauseFor(USER_PAUSE_MS);
                    scrollToRealIdx(idx);
                });
            })(dk);
        }

        if (featuresPrevBtn) {
            featuresPrevBtn.addEventListener('click', function () {
                pauseFor(USER_PAUSE_MS);
                scrollPrev();
            });
        }
        if (featuresNextBtn) {
            featuresNextBtn.addEventListener('click', function () {
                pauseFor(USER_PAUSE_MS);
                scrollNext();
            });
        }

        // Keyboard navigation when carousel has focus
        featuresCarousel.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                pauseFor(USER_PAUSE_MS);
                scrollNext();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                pauseFor(USER_PAUSE_MS);
                scrollPrev();
            }
        });

        // Restart auto-advance on resize. Do NOT re-jump the scroll position —
        // that would visibly "reset to first card" during responsive transitions.
        // Teleport logic handles any position drift on its own.
        window.addEventListener('resize', function () {
            updateFeatureUi();
            if (canAutoAdvance()) {
                if (!autoAdvanceInterval) startAutoAdvance();
            } else {
                stopAutoAdvance();
            }
        });

        updateFeatureUi();
        startAutoAdvance();
    }

    // =========================================================
    // Changelog Accordion
    // =========================================================
    var INITIAL_VERSIONS = 5;

    function formatDate(dateStr) {
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        var month = parseInt(parts[1], 10) - 1;
        var day = parseInt(parts[2], 10);
        return months[month] + ' ' + day + ', ' + parts[0];
    }

    // Bullets we don't want to surface on the public changelog — they're
    // internal version-bump commits that tell users nothing useful.
    var NOISE_BULLET_PATTERNS = [
        /^(?:feat|chore|fix)?:?\s*update\s+(?:app|software)\s+version\b/i,
        /^(?:feat|chore|fix)?:?\s*bump\s+version\b/i,
        /^(?:feat|chore|fix)?:?\s*version\s+bump\b/i
    ];

    function isNoiseBullet(text) {
        for (var k = 0; k < NOISE_BULLET_PATTERNS.length; k++) {
            if (NOISE_BULLET_PATTERNS[k].test(text)) return true;
        }
        return false;
    }

    function parseChangelog(markdown) {
        var entries = [];
        var sections = markdown.split(/^## /m);

        for (var i = 0; i < sections.length; i++) {
            var section = sections[i].trim();
            if (!section) continue;

            var headerMatch = section.match(/^\[([^\]]+)\]\s*-\s*(.+)$/m);
            if (!headerMatch) continue;

            var version = headerMatch[1];
            var date = headerMatch[2].trim();
            var changes = [];

            var lines = section.split('\n');
            for (var j = 1; j < lines.length; j++) {
                var line = lines[j].trim();
                if (line.startsWith('- ')) {
                    var bullet = line.substring(2);
                    if (!isNoiseBullet(bullet)) {
                        changes.push(bullet);
                    }
                }
            }

            // Skip entries that are entirely version-bump noise (e.g. v2.187)
            if (changes.length > 0) {
                entries.push({ version: version, date: date, changes: changes });
            }
        }

        return entries;
    }

    function renderChangelog(entries) {
        var changelogList = document.getElementById('changelogList');
        changelogList.innerHTML = '';

        var visibleCount = Math.min(INITIAL_VERSIONS, entries.length);
        var hasMore = entries.length > INITIAL_VERSIONS;

        function createChangelogItem(entry, index) {
            var item = document.createElement('div');
            item.className = 'changelog-item';

            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'changelog-question';
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-controls', 'changelog-answer-' + index);

            // Header row: [version + badge] [date + expand icon]
            var headerRow = document.createElement('span');
            headerRow.className = 'cl-header-row';

            var left = document.createElement('span');
            left.className = 'cl-left';
            var vSpan = document.createElement('span');
            vSpan.textContent = 'v' + entry.version;
            left.appendChild(vSpan);
            if (index === 0) {
                var badge = document.createElement('span');
                badge.className = 'cl-badge';
                badge.textContent = 'Latest';
                left.appendChild(badge);
            }

            var right = document.createElement('span');
            right.className = 'cl-right';
            var dateSpan = document.createElement('span');
            dateSpan.className = 'cl-date';
            dateSpan.textContent = formatDate(entry.date);
            var expandIcon = document.createElement('span');
            expandIcon.className = 'cl-expand';
            expandIcon.setAttribute('aria-hidden', 'true');
            expandIcon.textContent = '+';
            right.appendChild(dateSpan);
            right.appendChild(expandIcon);

            headerRow.appendChild(left);
            headerRow.appendChild(right);
            button.appendChild(headerRow);

            // Summary: first change as a hint
            if (entry.changes.length > 0) {
                var summary = document.createElement('span');
                summary.className = 'cl-summary';
                var text = entry.changes[0];
                summary.textContent = text.length > 70 ? text.substring(0, 67) + '…' : text;
                button.appendChild(summary);
            }

            var answer = document.createElement('div');
            answer.className = 'changelog-answer';
            answer.id = 'changelog-answer-' + index;

            var content = document.createElement('div');
            content.className = 'changelog-answer-content';

            var ul = document.createElement('ul');
            for (var j = 0; j < entry.changes.length; j++) {
                var li = document.createElement('li');
                li.textContent = entry.changes[j];
                ul.appendChild(li);
            }
            content.appendChild(ul);
            answer.appendChild(content);
            item.appendChild(button);
            item.appendChild(answer);

            button.addEventListener('click', function () {
                var isActive = item.classList.contains('active');
                if (isActive) {
                    item.classList.remove('active');
                    button.setAttribute('aria-expanded', 'false');
                } else {
                    item.classList.add('active');
                    button.setAttribute('aria-expanded', 'true');
                }
            });

            return item;
        }

        // Render initial visible items
        for (var i = 0; i < visibleCount; i++) {
            changelogList.appendChild(createChangelogItem(entries[i], i));
        }

        // "Show older versions" toggle with scrollable container
        if (hasMore) {
            var olderContainer = document.createElement('div');
            olderContainer.className = 'changelog-older';

            for (var i = visibleCount; i < entries.length; i++) {
                olderContainer.appendChild(createChangelogItem(entries[i], i));
            }

            var showMoreBtn = document.createElement('button');
            showMoreBtn.type = 'button';
            showMoreBtn.className = 'show-more-btn';
            showMoreBtn.textContent = 'Show older versions';

            var isOpen = false;
            showMoreBtn.addEventListener('click', function () {
                isOpen = !isOpen;
                if (isOpen) {
                    olderContainer.classList.add('open');
                    showMoreBtn.textContent = 'Hide older versions';
                } else {
                    olderContainer.classList.remove('open');
                    showMoreBtn.textContent = 'Show older versions';
                }
            });

            changelogList.appendChild(showMoreBtn);
            changelogList.appendChild(olderContainer);
        }
    }

    // =========================================================
    // Changelog toggle — hidden by default, revealed on click
    // =========================================================
    var changelogContainer = document.getElementById('changelogContainer');
    var changelogToggleBtn = document.getElementById('changelogToggleBtn');
    var changelogLoaded = false;
    var changelogOpen = false;

    function openChangelog() {
        changelogOpen = true;
        changelogContainer.classList.add('open');
        changelogToggleBtn.textContent = 'Hide changelog';
    }

    function closeChangelog() {
        changelogOpen = false;
        changelogContainer.classList.remove('open');
        changelogToggleBtn.textContent = 'View full changelog';
    }

    function loadAndShowChangelog() {
        if (!changelogLoaded) {
            changelogLoaded = true;
            // Daily cache-buster: forces refetch once a day for visitors whose browsers
            // cached the original 1-year-max-age response. Within a day, the URL is stable
            // so the netlify.toml *.md rule (max-age=300, must-revalidate) handles the rest.
            var cacheKey = new Date().toISOString().split('T')[0];
            fetch('../CHANGELOG.md?v=' + cacheKey)
                .then(function (response) { return response.text(); })
                .then(function (markdown) {
                    var entries = parseChangelog(markdown);
                    if (entries.length > 0) {
                        renderChangelog(entries);
                    } else {
                        document.getElementById('changelogList').innerHTML =
                            '<p style="text-align:center; color:#888;">No changelog entries yet.</p>';
                    }
                    openChangelog();
                })
                .catch(function () {
                    document.getElementById('changelogList').innerHTML =
                        '<p style="text-align:center; color:#888;">Could not load changelog.</p>';
                    openChangelog();
                });
        } else {
            openChangelog();
        }
    }

    if (changelogToggleBtn) {
        changelogToggleBtn.addEventListener('click', function () {
            if (changelogOpen) {
                closeChangelog();
            } else {
                loadAndShowChangelog();
            }
        });
    }

    // Auto-open changelog if linked via hash
    if (window.location.hash === '#changelog') {
        setTimeout(function () {
            var changelogSection = document.getElementById('changelog');
            if (changelogSection) {
                changelogSection.scrollIntoView({ behavior: 'smooth' });
            }
            loadAndShowChangelog();
        }, 800);
    }

    // =========================================================
    // Smooth scroll for anchor links
    // =========================================================
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // =========================================================
    // CTA Click Tracking
    // =========================================================
    function trackClick(event) {
        try {
            fetch('/.netlify/functions/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: event }),
            }).catch(function () { /* silent fail — tracking is non-critical */ });
        } catch (e) { /* silent fail */ }
    }

    document.querySelectorAll('a.cta-primary, a.cta-secondary, a.cta-btn').forEach(function (link) {
        link.addEventListener('click', function () {
            var label = this.textContent.trim().toLowerCase().replace(/\s+/g, '-');
            trackClick('product-' + label);
        });
    });

    // =========================================================
    // Scroll Reveal (IntersectionObserver)
    // =========================================================
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var revealElements = document.querySelectorAll('.reveal');
        if (revealElements.length > 0 && 'IntersectionObserver' in window) {
            var revealObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        revealObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

            revealElements.forEach(function (el) {
                revealObserver.observe(el);
            });
        }
    } else {
        // Reduced motion: show everything immediately
        document.querySelectorAll('.reveal').forEach(function (el) {
            el.classList.add('visible');
        });
    }

    // =========================================================
    // Hero Phone Crossfade (20s interval)
    // =========================================================
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var heroPhoneImgs = document.querySelectorAll('.hero-phone-img');
        if (heroPhoneImgs.length > 1) {
            var heroPhoneIndex = 0;
            var heroPhonePaused = false;
            var heroPhoneContainer = document.querySelector('.hero-phone');

            heroPhoneContainer.addEventListener('mouseenter', function () { heroPhonePaused = true; });
            heroPhoneContainer.addEventListener('mouseleave', function () { heroPhonePaused = false; });

            setInterval(function () {
                if (heroPhonePaused) return;
                heroPhoneImgs[heroPhoneIndex].classList.remove('active');
                heroPhoneIndex = (heroPhoneIndex + 1) % heroPhoneImgs.length;
                heroPhoneImgs[heroPhoneIndex].classList.add('active');
            }, 20000);
        }
    }

    // =========================================================
    // Dynamic copyright year
    // =========================================================
    var yearEl = document.getElementById('year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
})();
