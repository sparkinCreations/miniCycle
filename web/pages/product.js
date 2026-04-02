// product.js — Product page carousel, changelog accordion, and smooth scroll
// Redesigned to match learn_more.html visual patterns

(function () {
    'use strict';

    // =========================================================
    // Carousel
    // =========================================================
    var videos = [
        {
            src: '../assets/videos/samples/Daily_Home_Routine.gif',
            title: 'Daily Home Routine',
            description: 'Streamline your daily home tasks with organized cycles that keep you productive and focused.'
        },
        {
            src: '../assets/videos/samples/Daily_Work_Routine.gif',
            title: 'Daily Work Routine',
            description: 'Boost your work productivity with structured cycle lists that help you stay on track throughout the day.'
        },
        {
            src: '../assets/videos/samples/Monday_Fitness_Routine.gif',
            title: 'Monday Fitness Routine',
            description: 'Start your week strong with organized fitness cycles that make staying healthy simple and sustainable.'
        }
    ];

    var currentIndex = 0;
    var isTransitioning = false;

    var videoElement = document.getElementById('currentVideo');
    var titleElement = document.getElementById('videoTitle');
    var descriptionElement = document.getElementById('videoDescription');
    var videoInfo = document.querySelector('.video-info');
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    var dots = document.querySelectorAll('.dot');

    function updateContent(video, index) {
        titleElement.textContent = video.title;
        descriptionElement.textContent = video.description;

        dots.forEach(function (dot, i) {
            dot.classList.toggle('active', i === index);
            dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
        });

        videoElement.alt = 'miniCycle demo: ' + video.title;

        setTimeout(function () {
            videoInfo.classList.remove('fade-out');
            currentIndex = index;
            isTransitioning = false;
        }, 100);
    }

    function updateVideo(index) {
        if (isTransitioning) return;
        isTransitioning = true;

        var video = videos[index];

        videoInfo.classList.add('fade-out');
        videoElement.classList.add('fade-out');

        setTimeout(function () {
            videoElement.src = video.src;
            videoElement.classList.remove('fade-out');
            videoElement.classList.add('fade-in');
            updateContent(video, index);
        }, 250);
    }

    function nextVideo() {
        updateVideo((currentIndex + 1) % videos.length);
    }

    function prevVideo() {
        updateVideo((currentIndex - 1 + videos.length) % videos.length);
    }

    nextBtn.addEventListener('click', function () {
        nextBtn.style.transform = 'scale(0.9)';
        setTimeout(function () { nextBtn.style.transform = ''; }, 150);
        nextVideo();
    });

    prevBtn.addEventListener('click', function () {
        prevBtn.style.transform = 'scale(0.9)';
        setTimeout(function () { prevBtn.style.transform = ''; }, 150);
        prevVideo();
    });

    dots.forEach(function (dot, index) {
        dot.addEventListener('click', function () { updateVideo(index); });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') nextVideo();
        if (e.key === 'ArrowLeft') prevVideo();
    });

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setInterval(nextVideo, 15000);
    }

    // =========================================================
    // Changelog Accordion
    // =========================================================
    var INITIAL_VERSIONS = 5;

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
                    changes.push(line.substring(2));
                }
            }

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
            button.textContent = 'v' + entry.version + '  (' + entry.date + ')';

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

    fetch('../CHANGELOG.md')
        .then(function (response) { return response.text(); })
        .then(function (markdown) {
            var entries = parseChangelog(markdown);
            if (entries.length > 0) {
                renderChangelog(entries);
            } else {
                document.getElementById('changelogList').innerHTML =
                    '<p style="text-align:center; color:#888;">No changelog entries yet.</p>';
            }
        })
        .catch(function () {
            document.getElementById('changelogList').innerHTML =
                '<p style="text-align:center; color:#888;">Could not load changelog.</p>';
        });

    // Auto-open changelog if linked via hash
    if (window.location.hash === '#changelog') {
        setTimeout(function () {
            var changelogSection = document.getElementById('changelog');
            if (changelogSection) {
                changelogSection.scrollIntoView({ behavior: 'smooth' });
            }
            // Open the first entry
            var firstItem = document.querySelector('.changelog-item');
            if (firstItem && !firstItem.classList.contains('active')) {
                firstItem.querySelector('.changelog-question').click();
            }
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
    // Dynamic copyright year
    // =========================================================
    var yearEl = document.getElementById('year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
})();
