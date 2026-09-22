/**
 * preload.js — the only bridge between the Electron shell and the web app.
 *
 * Runs in the renderer before the page, isolated from it (contextIsolation) and
 * sandboxed (no Node in here beyond what Electron exposes to a sandboxed
 * preload). It publishes ONE frozen object, `globalThis.miniCycleDesktop`,
 * which web/modules/platform/desktopBridge.js reads to learn it is running on
 * desktop — the same shape of contract capacitorBridge.js has with the
 * Capacitor runtime's `Capacitor` global.
 *
 * Keep this surface tiny. v1 exposes facts only (platform, shell version) and
 * no functions: file save/open, notifications and external links are plain web
 * APIs that Chromium already provides, and main.js routes them natively. A
 * function added here is a function the web app has to guard on every other
 * platform, so add one only when a web API genuinely cannot do the job.
 */

'use strict';

const { contextBridge } = require('electron');

// main.js passes the shell version in as an argv flag because a sandboxed
// preload cannot read package.json.
const VERSION_FLAG = '--minicycle-shell-version=';
const shellVersion = (process.argv.find((arg) => arg.startsWith(VERSION_FLAG)) || '').slice(VERSION_FLAG.length);

contextBridge.exposeInMainWorld('miniCycleDesktop', Object.freeze({
    platform: process.platform,          // 'darwin' | 'win32' | 'linux'
    shellVersion: shellVersion || null   // desktop/package.json version
}));
