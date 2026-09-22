# miniCycle Desktop (macOS, Windows, Linux)

An [Electron](https://www.electronjs.org/) shell wrapping the **byte-identical** miniCycle web
app (`web/`), bundled for offline. Same pattern as the Android and iOS apps: the web payload
(`desktop/www/`) is **generated** from `web/` by `web/scripts/build-desktop-www.cjs` — a thin
shim over the shared engine `build-capacitor-www.cjs` — so it never drifts from the actively
developed app. Nothing in `www/` is hand-edited and it is not committed.

> **Docs**
> - [`docs/DESKTOP_BUILD_AND_DIFFERENCES.md`](./docs/DESKTOP_BUILD_AND_DIFFERENCES.md) — every
>   web-vs-desktop difference, the payload transform, the app:// origin, releases, signing.

## Quick start

```bash
cd desktop
npm install        # first time only (downloads Electron)
npm start          # generate www/ from web/ and open the app
npm run smoke      # boot headless, write dist/smoke.png, exit 0/1
npm run smoke:offline  # same with the network cut — the release gate
npm run dist       # macOS (dmg + zip), Windows (NSIS x64), Linux (AppImage + deb) → dist/
```

If you launch from inside VS Code's extension host, prefix Electron commands with
`env -u ELECTRON_RUN_AS_NODE` — with that variable set, Electron runs as plain Node and the
main process dies on `protocol` being undefined.

## Release

Desktop is a snapshot cut on demand from `web/`, like the other packaged builds:

```bash
cd web
./scripts/update-version.sh --auto --push --changelog --desktop          # payload + version sync
./scripts/update-version.sh --auto --push --changelog --desktop-dist     # …plus smoke boot + all installers
```

`--desktop` regenerates `www/` and sets `desktop/package.json`'s version to `APP_VERSION.0`
(electron-builder needs semver; the app's version has two parts). `--desktop-dist` then
smoke-boots the shell and, only if that passes, builds the installers into `desktop/dist/`.

## Layout

```
desktop/
├── src/main.js            # main process: app:// payload server, window, menu, smoke mode
├── src/preload.js         # exposes globalThis.miniCycleDesktop (platform, shellVersion)
├── electron-builder.yml   # appId, targets, artifact names, (no) signing
├── build/icon.png         # 512px source; electron-builder derives .icns/.ico
├── package.json           # version = APP_VERSION.0 (synced by update-version.sh)
├── www/                   # GENERATED payload (gitignored)
└── dist/                  # installers + smoke.png (gitignored)
```

## What v1 is, and is not

- **Is:** one window, native menu, native save/open dialogs for `.mcyc` files, OS notifications
  for reminders, external links in the default browser, "Check for Updates" pointing at
  minicycleapp.com, single-instance.
- **Is not (yet):** system tray, global shortcut, auto-start on login, `.mcyc` file association,
  auto-updater, code signing / notarization. Linux artifacts are built but have not been run
  on a real distro yet.
