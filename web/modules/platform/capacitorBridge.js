/**
 * capacitorBridge.js — the single point of contact with the Capacitor native runtime.
 *
 * Pure leaf module: it imports nothing from other app modules and is injected
 * nowhere via DI. Import it directly, the same way constants.js / labelResolver
 * helpers are imported. It ships verbatim in BOTH the web app and the Android
 * (Capacitor) build — the Android www/ payload is generated from web/, so this
 * file is identical in both.
 *
 * The contract that keeps the web app safe: on the web there is no global
 * `Capacitor`, so `isNativeApp()` is false and every export is a no-op that
 * returns a "not handled" result. Callers therefore keep their existing web
 * behavior unchanged and only gain native behavior inside the Android app.
 *
 * Native plugins are reached through the runtime proxy (Capacitor.registerPlugin)
 * — NOT through `import`. miniCycle has no bundler (it loads ES modules directly),
 * so the @capacitor/* JS packages cannot be imported in the browser; the proxy
 * forwards method calls to the natively-registered plugin instead. The native
 * side is wired by `npm install @capacitor/<plugin>` + `npx cap sync` in
 * mobile/android. See mobile/ANDROID_BUILD_AND_DIFFERENCES.md §9.
 */

'use strict';

// ── platform detection ───────────────────────────────────────────────────────

function cap() {
    // globalThis avoids a hard window.* reference (also works in workers).
    return typeof globalThis !== 'undefined' ? globalThis.Capacitor : undefined;
}

/** True only inside a Capacitor native shell (the Android app). False on the web. */
export function isNativeApp() {
    const c = cap();
    return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
}

/**
 * Resolve a native plugin proxy by name, or null if unavailable.
 * Guards on isPluginAvailable so calling a method on a not-installed plugin
 * can't throw "not implemented".
 */
function getPlugin(name) {
    const c = cap();
    if (!c || !isNativeApp()) return null;
    if (typeof c.isPluginAvailable === 'function' && !c.isPluginAvailable(name)) return null;
    if (typeof c.registerPlugin === 'function') return c.registerPlugin(name);
    return (c.Plugins && c.Plugins[name]) || null;
}

// ── 1. native shell init (status bar, splash, hardware back) ──────────────────

let _shellInitialized = false;

/**
 * One-time native-shell setup. No-op on the web (and safe to call there).
 * Idempotent — guarded so repeated boots don't stack listeners.
 *
 *  - StatusBar: match the app's dark/light mode and keep it in sync via a
 *    MutationObserver on the `dark-mode` class (set by routineLoader/appInit).
 *  - SplashScreen: hide it once the app UI is up.
 *  - App (back button): close the top-most open modal/menu instead of exiting;
 *    only exit when nothing is open.
 */
export function initNativeShell() {
    if (_shellInitialized || !isNativeApp()) return;
    _shellInitialized = true;

    syncStatusBarToTheme();
    observeThemeForStatusBar();
    hideSplash();
    wireHardwareBackButton();
}

function isDarkMode() {
    return document.documentElement.classList.contains('dark-mode') ||
        document.body.classList.contains('dark-mode');
}

function syncStatusBarToTheme() {
    const StatusBar = getPlugin('StatusBar');
    if (!StatusBar) return;
    const dark = isDarkMode();
    // Style.Dark = light text (for dark backgrounds); Style.Light = dark text.
    StatusBar.setStyle?.({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => {});
    StatusBar.setBackgroundColor?.({ color: dark ? '#1a1a2e' : '#4c79ff' }).catch(() => {});
}

function observeThemeForStatusBar() {
    if (typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => syncStatusBarToTheme());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

function hideSplash() {
    const SplashScreen = getPlugin('SplashScreen');
    SplashScreen?.hide?.().catch(() => {});
}

function wireHardwareBackButton() {
    const App = getPlugin('App');
    if (!App?.addListener) return;
    App.addListener('backButton', ({ canGoBack } = {}) => {
        // 1) If any in-app layer is open (dialog, menu, focus mode, …), close the
        //    top-most one and swallow the press — never let it exit the app.
        if (dismissTopLayer()) return;
        // 2) Real in-app history (e.g. a legal page opened via navigation): go back.
        if (canGoBack) { window.history.back(); return; }
        // 3) At the root with nothing open: require a second press to exit, so an
        //    accidental back can't drop the user out mid-routine.
        confirmRootExit(App);
    });
}

/**
 * Close the top-most open UI layer, if any. Returns true when something was
 * closed (so the back press is consumed). DOM-only by design — capacitorBridge
 * is a leaf module and can't call the UI modules' close methods, so it uses each
 * layer's real open-state signal and close path (verified against the source),
 * which fires the same events the app's own Escape/close handlers do.
 *
 * Priority mirrors the visual stacking (top closes first):
 *   native <dialog>  →  focus mode  →  main menu  →  quick actions
 *     →  task-options menu  →  notifications
 */
function dismissTopLayer() {
    // 1) Native <dialog> modals: settings, preferences, about, reminders, themes,
    //    games, the recurring panel, routine switcher, prompts, etc. The help
    //    window is a <div> (not a <dialog>), so it's correctly left open.
    //    A synthetic Escape would NOT close a native dialog (untrusted events
    //    don't fire the browser's default cancel), so close it explicitly —
    //    .close() still fires the 'close' event the app uses to restore focus.
    const openDialogs = document.querySelectorAll('dialog[open]');
    if (openDialogs.length) {
        openDialogs[openDialogs.length - 1].close();
        return true;
    }

    // 2) Focus mode: its own document keydown handler steps through
    //    mode-modal → menu → exit (and self-gates to defer to any open dialog).
    //    It's a real JS listener, so a synthetic Escape drives it.
    if (document.body.classList.contains('focus-mode')) {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape', code: 'Escape', bubbles: true, cancelable: true,
        }));
        return true;
    }

    // 3) Main menu (hamburger).
    if (document.body.classList.contains('main-menu-open')) {
        document.querySelector('.menu-container')?.classList.remove('visible');
        document.body.classList.remove('main-menu-open');
        return true;
    }

    // 4) Quick-actions menu.
    if (document.body.classList.contains('quick-actions-open')) {
        const qa = document.getElementById('quick-actions-menu');
        if (qa) qa.style.display = 'none';
        document.body.classList.remove('quick-actions-open');
        return true;
    }

    // 5) Per-task options menu (only one is ever visible at a time).
    const taskOptions = document.querySelector('.task-options.task-options-visible');
    if (taskOptions) {
        document.querySelectorAll('.task-options.task-options-visible')
            .forEach((el) => el.classList.remove('task-options-visible'));
        return true;
    }

    // 6) Toast notifications: dismiss via their close button (runs the app's own
    //    dismiss path). Lowest priority — they also auto-expire on their own.
    const notifications = document.querySelectorAll('#notification-container .notification');
    if (notifications.length) {
        let closedAny = false;
        notifications.forEach((n) => {
            const closeBtn = n.querySelector('.close-btn');
            if (closeBtn) { closeBtn.click(); closedAny = true; }
        });
        if (closedAny) return true;
    }

    return false;
}

// ── root-exit guard (double-press to exit) ────────────────────────────────────

let _lastRootBackAt = 0;

function confirmRootExit(App) {
    const now = Date.now();
    if (now - _lastRootBackAt < 2000) {
        App.exitApp?.();
        return;
    }
    _lastRootBackAt = now;
    showExitHint();
}

/**
 * Minimal self-contained "press back again to exit" toast. Dependency-free (the
 * bridge imports no app modules) and auto-removes after the second-press window.
 */
function showExitHint() {
    if (document.getElementById('__mc_exit_hint')) return;
    const hint = document.createElement('div');
    hint.id = '__mc_exit_hint';
    hint.textContent = 'Press back again to exit';
    hint.setAttribute('role', 'status');
    hint.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:calc(24px + env(safe-area-inset-bottom))',
        'transform:translateX(-50%)', 'z-index:2147483647', 'pointer-events:none',
        'background:rgba(0,0,0,0.85)', 'color:#fff', 'padding:10px 18px',
        'border-radius:999px', 'font-size:14px', 'font-family:system-ui,sans-serif',
        'box-shadow:0 2px 10px rgba(0,0,0,0.35)', 'opacity:0',
        'transition:opacity 150ms ease',
    ].join(';');
    document.body.appendChild(hint);
    requestAnimationFrame(() => { hint.style.opacity = '1'; });
    setTimeout(() => {
        hint.style.opacity = '0';
        setTimeout(() => hint.remove(), 200);
    }, 1800);
}

// ── 2. notifications ──────────────────────────────────────────────────────────

let _notifyId = 1;

/**
 * Request the native notification permission.
 * @returns {Promise<'granted'|'denied'|null>} null when not on native.
 */
export async function requestNotificationPermission() {
    const LocalNotifications = getPlugin('LocalNotifications');
    if (!LocalNotifications) return null;
    try {
        const res = await LocalNotifications.requestPermissions();
        return res?.display === 'granted' ? 'granted' : 'denied';
    } catch {
        return 'denied';
    }
}

/** @returns {Promise<'granted'|'denied'|null>} current permission; null off-native. */
export async function checkNotificationPermission() {
    const LocalNotifications = getPlugin('LocalNotifications');
    if (!LocalNotifications) return null;
    try {
        const res = await LocalNotifications.checkPermissions();
        return res?.display === 'granted' ? 'granted' : 'denied';
    } catch {
        return null;
    }
}

/**
 * Fire an immediate local notification on native.
 * @returns {Promise<boolean>} true if scheduled natively; false otherwise (caller
 *          should use its web fallback).
 */
export async function sendNativeNotification({ title, body }) {
    const LocalNotifications = getPlugin('LocalNotifications');
    if (!LocalNotifications) return false;
    try {
        const perm = await checkNotificationPermission();
        if (perm !== 'granted') return false;
        await LocalNotifications.schedule({
            notifications: [{
                id: _notifyId++,
                title,
                body,
                // No `schedule` object = deliver immediately. The small status-bar
                // icon falls back to the app's launcher icon; to brand it, add a
                // monochrome res/drawable/ic_stat_* and set `smallIcon` here.
            }],
        });
        return true;
    } catch (e) {
        console.warn('[capacitorBridge] native notification failed:', e);
        return false;
    }
}

// ── 3. file share / export (.mcyc) ────────────────────────────────────────────

/**
 * Share a routine file natively (via the Android share sheet, which includes
 * "Save to Files"). Writes the payload to the app cache, then shares its URI.
 *
 * @param {Object} opts
 * @param {string} opts.data      File contents (JSON string).
 * @param {string} opts.fileName  e.g. "Morning_Routine.mcyc".
 * @param {string} [opts.title]   Share-sheet title.
 * @param {string} [opts.text]    Accompanying text.
 * @returns {Promise<{handled: boolean, cancelled?: boolean}>}
 *          handled:false  → not native / unavailable; caller should fall back.
 *          handled:true   → native took over (success or user cancel).
 */
export async function shareRoutineFileNative({ data, fileName, title, text }) {
    const Filesystem = getPlugin('Filesystem');
    const Share = getPlugin('Share');
    if (!Filesystem || !Share) return { handled: false };

    try {
        // Write to the cache directory (transient; the share target copies it out).
        const write = await Filesystem.writeFile({
            path: fileName,
            data,
            directory: 'CACHE',
            encoding: 'utf8',
        });
        const uri = write?.uri || (await Filesystem.getUri({ path: fileName, directory: 'CACHE' }))?.uri;
        if (!uri) return { handled: false };

        await Share.share({ title, text, files: [uri] });
        return { handled: true };
    } catch (e) {
        // The share plugin throws on user-cancel; treat that as handled (don't
        // double-prompt with a web download that wouldn't work in the WebView).
        if (e && /cancel/i.test(e.message || '')) return { handled: true, cancelled: true };
        console.warn('[capacitorBridge] native share failed:', e);
        return { handled: true, cancelled: true };
    }
}

/**
 * Share plain text / a URL natively (e.g. "share the app").
 * @returns {Promise<{handled: boolean, cancelled?: boolean}>} (see above)
 */
export async function shareTextNative({ title, text, url }) {
    const Share = getPlugin('Share');
    if (!Share) return { handled: false };
    try {
        await Share.share({ title, text, url });
        return { handled: true };
    } catch (e) {
        if (e && /cancel/i.test(e.message || '')) return { handled: true, cancelled: true };
        console.warn('[capacitorBridge] native text share failed:', e);
        return { handled: true, cancelled: true };
    }
}
