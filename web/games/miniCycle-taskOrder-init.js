// miniCycle-taskOrder-init.js — Dark mode + reduced motion detection (flash-free, before paint)
try {
    var d = JSON.parse(localStorage.getItem('miniCycleData'));
    if (d && d.settings) {
        if (d.settings.darkMode) document.documentElement.classList.add('dark-mode');
        if (d.settings.reducedMotion) document.documentElement.classList.add('reduced-motion');
    }
} catch(e) {}
