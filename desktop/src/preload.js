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
 * Keep this surface tiny. It exposes facts (platform, shell version) and ONE
 * function group, `backups`: the daily backup file the app writes silently to
 * Documents/miniCycle Backups (web/modules/storage/backupFolder.js). That is the
 * one job no web API can do — Chromium cannot write a file without a dialog —
 * and main.js confines it to that folder (backupFiles.js). File save/open,
 * notifications and external links stay plain web APIs that main.js routes
 * natively. A function added here is a function the web app has to guard on
 * every other platform, so add one only when a web API genuinely cannot do the
 * job.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// main.js passes the shell version in as an argv flag because a sandboxed
// preload cannot read package.json.
const VERSION_FLAG = '--minicycle-shell-version=';
const shellVersion = (process.argv.find((arg) => arg.startsWith(VERSION_FLAG)) || '').slice(VERSION_FLAG.length);

// The daily backup files (see header). Every call resolves in main.js, which
// accepts only daily-backup file names inside its own folder.
const backups = Object.freeze({
    folder: () => ipcRenderer.invoke('minicycle:backups:folder'),
    write: (name, text) => ipcRenderer.invoke('minicycle:backups:write', name, text),
    list: () => ipcRenderer.invoke('minicycle:backups:list'),
    read: (name) => ipcRenderer.invoke('minicycle:backups:read', name),
    remove: (name) => ipcRenderer.invoke('minicycle:backups:remove', name)
});

contextBridge.exposeInMainWorld('miniCycleDesktop', Object.freeze({
    platform: process.platform,          // 'darwin' | 'win32' | 'linux'
    shellVersion: shellVersion || null,  // desktop/package.json version
    backups
}));
