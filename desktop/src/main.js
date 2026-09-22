/**
 * main.js — the Electron main process for the miniCycle desktop app.
 *
 * Form factor (v1, deliberately minimal): one window running the byte-identical
 * web app from www/, served over a private `app://minicycle` origin. No tray,
 * no global shortcut, no auto-start, no auto-updater — "Check for Updates"
 * inside the app compares the live version.js and points at the download page.
 *
 * Why a custom scheme instead of loadFile(): the app is ~140 native ES modules
 * loaded with <script type="module"> and relative imports. Chromium refuses
 * module scripts (and fetch()) from a file:// origin, and file:// also gives
 * localStorage/IndexedDB an origin that changes with the install path. A
 * registered standard scheme behaves like https: modules load, fetch works,
 * leading-slash paths (`/examples/...`) resolve to www/, and storage is keyed
 * to a stable origin, so the user's routines survive reinstalls and moves.
 *
 * What the web app gets from this file, all through ordinary web APIs:
 *   - .mcyc export: showSaveFilePicker (File System Access API) opens the
 *     native save dialog; the legacy <a download> fallback also gets a native
 *     save dialog because no will-download handler claims it.
 *   - .mcyc import: <input type="file"> opens the native open dialog.
 *   - Reminders: the Notification API posts OS notifications (macOS Notification
 *     Center / Windows Action Center; appUserModelId is required on Windows).
 *   - Links: target="_blank" / window.open to http(s) open in the default
 *     browser; in-payload navigations (legal/, games/) stay inside the window.
 *
 * Smoke test (used by update-version.sh --desktop-dist and by hand):
 *   MINICYCLE_SMOKE=dist/smoke.png electron .
 * boots the app, waits for the boot overlay to clear, writes a screenshot, and
 * exits 0 — or exits 1 on a load failure or renderer crash. Add
 * MINICYCLE_SMOKE_OFFLINE=1 to boot with every http(s) request cancelled at
 * the session level (webRequest.onBeforeRequest) and a live fetch required to
 * fail: proves the packaged app needs nothing from the network to start.
 * (session.enableNetworkEmulation({ offline: true }) was tried first and did
 * NOT block renderer fetches in Electron 44 — the probe still reached the
 * live site — so it is not used.)
 */

'use strict';

const { app, BrowserWindow, Menu, protocol, shell, session, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_SCHEME = 'app';
const APP_HOST = 'minicycle';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const WWW_DIR = path.join(__dirname, '..', 'www');
const LIVE_SITE = 'https://minicycle.app';
const PRODUCT_SITE = 'https://minicycleapp.com';
const SUPPORT_SITE = 'https://sparkincreations.com';

const WINDOW = Object.freeze({ width: 1100, height: 820, minWidth: 380, minHeight: 600 });
const BACKGROUND = '#4c79ff';   // matches the Capacitor shells' launch colour
const SMOKE_SETTLE_MS = 2500;   // after did-finish-load, before the screenshot

// Content types for what the payload actually contains. Unknown extensions
// fall back to octet-stream rather than guessing.
const MIME = Object.freeze({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mcyc': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.webmanifest': 'application/manifest+json'
});

// The payload keeps its inline <script> blocks (same as the Capacitor builds),
// so script-src needs 'unsafe-inline'. Everything else is locked to the app
// origin plus the two hosts the app talks to.
const CSP = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `media-src 'self' blob:`,
    `connect-src 'self' ${LIVE_SITE} https://api.web3forms.com`,
    `frame-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`
].join('; ');

const SMOKE_PATH = process.env.MINICYCLE_SMOKE || '';
const SMOKE_OFFLINE = !!process.env.MINICYCLE_SMOKE_OFFLINE;
let mainWindow = null;

// ── app:// scheme ────────────────────────────────────────────────────────────

// Must run before app.ready.
protocol.registerSchemesAsPrivileged([{
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

function resolvePayloadPath(requestUrl) {
    const url = new URL(requestUrl);
    if (url.host !== APP_HOST) return null;
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const file = path.normalize(path.join(WWW_DIR, pathname));
    // Never serve anything outside www/ (path traversal via encoded dots).
    if (!file.startsWith(WWW_DIR + path.sep)) return null;
    return file;
}

function servePayload(request) {
    const file = resolvePayloadPath(request.url);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
    if (type.startsWith('text/html')) headers['Content-Security-Policy'] = CSP;
    return new Response(fs.readFileSync(file), { status: 200, headers });
}

// ── window ───────────────────────────────────────────────────────────────────

function isExternal(url) {
    return /^https?:/i.test(url) || /^mailto:/i.test(url);
}

function createWindow() {
    const win = new BrowserWindow({
        width: WINDOW.width,
        height: WINDOW.height,
        minWidth: WINDOW.minWidth,
        minHeight: WINDOW.minHeight,
        title: 'miniCycle',
        backgroundColor: BACKGROUND,
        show: false,
        autoHideMenuBar: process.platform !== 'darwin',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: true,
            additionalArguments: [`--minicycle-shell-version=${app.getVersion()}`]
        }
    });

    win.once('ready-to-show', () => { if (!SMOKE_PATH) win.show(); });

    // The app sets document.title itself; keep the native title stable.
    win.on('page-title-updated', (event) => event.preventDefault());

    // Outbound links go to the default browser. Same-origin navigations
    // (legal pages, the Task Order game) stay in the window.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (isExternal(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith(APP_ORIGIN)) {
            event.preventDefault();
            if (isExternal(url)) shell.openExternal(url);
        }
    });

    win.on('closed', () => { mainWindow = null; });
    if (SMOKE_OFFLINE) {
        win.webContents.session.webRequest.onBeforeRequest(
            { urls: ['http://*/*', 'https://*/*'] },
            (details, callback) => callback({ cancel: true })
        );
    }
    win.loadURL(`${APP_ORIGIN}/index.html`);
    return win;
}

// ── menu ─────────────────────────────────────────────────────────────────────

function buildMenu() {
    const isMac = process.platform === 'darwin';
    const open = (url) => () => shell.openExternal(url);
    const template = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'File',
            submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])
            ]
        },
        {
            role: 'help',
            submenu: [
                { label: 'miniCycle on the Web', click: open(LIVE_SITE) },
                { label: 'Downloads and Product Page', click: open(PRODUCT_SITE) },
                { label: 'sparkinCreations', click: open(SUPPORT_SITE) },
                { type: 'separator' },
                { label: `Desktop shell v${app.getVersion()}`, enabled: false }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── smoke mode ───────────────────────────────────────────────────────────────

function runSmoke(win) {
    const fail = (why) => {
        console.error(`[smoke] FAIL: ${why}`);
        app.exit(1);
    };
    win.webContents.on('console-message', (event) => {
        const { level, message } = event;
        if (level === 'error' || level === 'warning') console.log(`[renderer:${level}] ${message}`);
    });
    win.webContents.on('did-fail-load', (event, code, description) => fail(`did-fail-load ${code} ${description}`));
    win.webContents.on('render-process-gone', (event, details) => fail(`renderer gone: ${details.reason}`));
    win.webContents.once('did-finish-load', () => {
        setTimeout(async () => {
            try {
                const state = await win.webContents.executeJavaScript(`(async () => ({
                    title: document.title,
                    version: String(globalThis.APP_VERSION || ''),
                    desktop: !!(globalThis.miniCycleDesktop && globalThis.miniCycleDesktop.platform),
                    origin: location.origin,
                    online: navigator.onLine,
                    storage: await navigator.storage.estimate().then((e) => ({ quotaMB: Math.round(e.quota / 1048576), usageKB: Math.round(e.usage / 1024) }), () => null),
                    persisted: await navigator.storage.persisted().catch(() => null),
                    liveReachable: await fetch('${LIVE_SITE}/version.js?smoke=' + Date.now(), { cache: 'no-store' }).then((r) => r.ok, () => false),
                    loaderGone: !document.getElementById('app-loader') || getComputedStyle(document.getElementById('app-loader')).display === 'none' || document.getElementById('app-loader').classList.contains('hidden'),
                    tasks: document.querySelectorAll('#taskList .task').length
                }))()`);
                console.log(`[smoke] ${JSON.stringify(state)}`);
                if (!state.desktop) return fail('preload global missing — the app cannot tell it is on desktop');
                if (!state.version) return fail('APP_VERSION not published — version.js did not load');
                if (SMOKE_OFFLINE && state.liveReachable) return fail('offline emulation is not in effect — the live site was reachable');
                const image = await win.webContents.capturePage();
                fs.mkdirSync(path.dirname(SMOKE_PATH), { recursive: true });
                fs.writeFileSync(SMOKE_PATH, image.toPNG());
                console.log(`[smoke] OK — v${state.version} at ${state.origin}${SMOKE_OFFLINE ? ' (all http/https requests cancelled; live site unreachable)' : ''}, screenshot ${SMOKE_PATH}`);
                app.exit(0);
            } catch (error) {
                fail(error && error.message ? error.message : String(error));
            }
        }, SMOKE_SETTLE_MS);
    });
}

// ── lifecycle ────────────────────────────────────────────────────────────────

// Smoke runs use their own profile so they never touch the user's real data
// and never collide with an already-running copy on the single-instance lock
// (the lock is keyed by userData; hit Sep 2026 with the packaged app open).
if (SMOKE_PATH) app.setPath('userData', path.join(app.getPath('temp'), 'minicycle-smoke'));

if (!app.requestSingleInstanceLock()) {
    console.log('[miniCycle] another instance is already running — handing over to it');
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // Windows ties toast notifications to this id (must match appId in electron-builder.yml).
    app.setAppUserModelId('com.sparkincreations.minicycle');

    app.whenReady().then(() => {
        if (!fs.existsSync(path.join(WWW_DIR, 'index.html'))) {
            dialog.showErrorBox('miniCycle', 'The web payload is missing. Run `npm run build:www` in desktop/ first.');
            app.exit(1);
            return;
        }
        protocol.handle(APP_SCHEME, servePayload);
        // Notifications, full screen and the File System Access API ('fileSystem'
        // is what showSaveFilePicker asks for — deny it and .mcyc export silently
        // falls back to the plain download path) need no prompt on desktop; deny
        // everything else (camera, geolocation, …) — the app never asks.
        const GRANTED = new Set(['notifications', 'fullscreen', 'fileSystem']);
        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            callback(GRANTED.has(permission));
        });
        buildMenu();
        mainWindow = createWindow();
        if (SMOKE_PATH) runSmoke(mainWindow);

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
        });
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
}
