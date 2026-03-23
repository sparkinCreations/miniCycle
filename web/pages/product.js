// product.js — Product page carousel, changelog, and interaction logic
// Extracted from inline <script> to comply with Content Security Policy

(function () {
    'use strict';

    // =========================================================
    // Hover handlers (moved from inline onmouseover/onmouseout)
    // =========================================================
    const changelogToggleBtn = document.getElementById('changelog-toggle');
    if (changelogToggleBtn) {
        changelogToggleBtn.addEventListener('mouseover', function () {
            this.style.color = 'rgba(0,0,0,0.8)';
        });
        changelogToggleBtn.addEventListener('mouseout', function () {
            this.style.color = 'rgba(0,0,0,0.5)';
        });
    }

    document.querySelectorAll('.hover-link').forEach(function (link) {
        link.addEventListener('mouseover', function () {
            this.style.color = 'white';
            this.style.borderColor = 'white';
        });
        link.addEventListener('mouseout', function () {
            this.style.color = 'rgba(255,255,255,0.7)';
            this.style.borderColor = 'rgba(255,255,255,0.3)';
        });
    });

    // =========================================================
    // Carousel
    // =========================================================
    const videos = [
        {
            src: '../assets/videos/samples/Daily_Home_Routine.gif',
            title: 'Daily Home Routine',
            description: 'Streamline your daily home tasks with organized cycles that keep you productive and focused.',
            isVideo: true
        },
        {
            src: '../assets/videos/samples/Daily_Work_Routine.gif',
            title: 'Daily Work Routine',
            description: 'Boost your work productivity with structured cycle lists that help you stay on track throughout the day.',
            isVideo: true
        },
        {
            src: '../assets/videos/samples/Monday_Fitness_Routine.gif',
            title: 'Monday Fitness Routine',
            description: 'Start your week strong with organized fitness cycles that make staying healthy simple and sustainable.',
            isVideo: true
        },
        {
            src: null,
            title: 'Built for You',
            description: 'Privacy-focused, offline-first, and designed to work beautifully on every device you own.',
            isVideo: false
        }
    ];

    let currentIndex = 0;
    let isTransitioning = false;

    const videoElement = document.getElementById('currentVideo');
    const featuresSlide = document.getElementById('featuresSlide');
    const titleElement = document.getElementById('videoTitle');
    const descriptionElement = document.getElementById('videoDescription');
    const videoInfo = document.querySelector('.video-info');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const dots = document.querySelectorAll('.dot');

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

        if (videos[currentIndex].isVideo && !video.isVideo) {
            videoElement.classList.add('fade-out');
            setTimeout(function () {
                videoElement.style.display = 'none';
                featuresSlide.style.display = 'block';
                setTimeout(function () {
                    featuresSlide.classList.add('active');
                    updateContent(video, index);
                }, 50);
            }, 250);

        } else if (!videos[currentIndex].isVideo && video.isVideo) {
            featuresSlide.classList.remove('active');
            setTimeout(function () {
                featuresSlide.style.display = 'none';
                videoElement.style.display = 'block';
                videoElement.src = video.src;
                videoElement.classList.remove('fade-out');
                videoElement.classList.add('fade-in');
                updateContent(video, index);
            }, 250);

        } else if (video.isVideo) {
            videoElement.classList.add('fade-out');
            setTimeout(function () {
                videoElement.src = video.src;
                videoElement.classList.remove('fade-out');
                videoElement.classList.add('fade-in');
                updateContent(video, index);
            }, 250);
        } else {
            updateContent(video, index);
        }
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
    // Changelog
    // =========================================================
    fetch('../CHANGELOG.md')
        .then(function (response) { return response.text(); })
        .then(function (markdown) {
            var html = markdown
                .replace(/^## \[([^\]]+)\] - (.+)$/gm, '<h3 style="margin-top: 20px; margin-bottom: 10px; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">v$1 <span style="font-weight: normal; font-size: 0.85em; opacity: 0.7;">($2)</span></h3>')
                .replace(/^# (.+)$/gm, '')
                .replace(/^- (.+)$/gm, '<li style="margin-left: 20px; margin-bottom: 5px;">$1</li>')
                .replace(/\n\n/g, '</ul><ul style="list-style: none; padding: 0;">')
                .replace(/^(.+)$/gm, function (line) { return line.startsWith('<') ? line : '<p>' + line + '</p>'; });

            html = '<ul style="list-style: none; padding: 0;">' + html + '</ul>';
            html = html.replace(/<p><\/p>/g, '').replace(/<ul[^>]*><\/ul>/g, '');

            document.getElementById('changelog-content').innerHTML = html || '<p>No changelog entries yet.</p>';
        })
        .catch(function () {
            document.getElementById('changelog-content').innerHTML = '<p style="opacity: 0.7;">Could not load changelog.</p>';
        });

    var changelogContent = document.getElementById('changelog-content');
    var changelogInner = document.getElementById('changelog-inner');
    var changelogArrow = document.getElementById('changelog-arrow');
    var changelogHint = document.getElementById('changelog-hint');
    var changelogState = 'closed';

    function setChangelogState(state) {
        changelogState = state;
        if (state === 'closed') {
            changelogContent.style.maxHeight = '0';
            changelogInner.style.maxHeight = 'none';
            changelogArrow.style.transform = 'rotate(0deg)';
            changelogHint.style.display = 'none';
            changelogToggleBtn.setAttribute('aria-expanded', 'false');
        } else if (state === 'open') {
            changelogContent.style.maxHeight = '200px';
            changelogInner.style.maxHeight = '170px';
            changelogArrow.style.transform = 'rotate(180deg)';
            changelogHint.style.display = 'block';
            changelogToggleBtn.setAttribute('aria-expanded', 'true');
        } else if (state === 'expanded') {
            changelogContent.style.maxHeight = '500px';
            changelogInner.style.maxHeight = '470px';
            changelogArrow.style.transform = 'rotate(180deg)';
            changelogHint.style.display = 'none';
            changelogToggleBtn.setAttribute('aria-expanded', 'true');
        }
    }

    changelogToggleBtn.addEventListener('click', function () {
        if (changelogState === 'closed') setChangelogState('open');
        else setChangelogState('closed');
    });

    changelogContent.addEventListener('dblclick', function () {
        if (changelogState === 'open') setChangelogState('expanded');
        else if (changelogState === 'expanded') setChangelogState('open');
    });

    if (window.location.hash === '#changelog') {
        setTimeout(function () {
            setChangelogState('open');
            document.getElementById('changelog').scrollIntoView({ behavior: 'smooth' });
        }, 500);
    }

    // =========================================================
    // Dynamic copyright year
    // =========================================================
    var yearEl = document.getElementById('year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
})();
