#!/usr/bin/env node
/**
 * build-desktop-www.cjs — generate the desktop (Electron) web payload at
 * desktop/www/ from web/.
 *
 * Thin entry point: the actual transform lives in build-capacitor-www.cjs (the
 * shared Android/iOS/desktop engine — the payload transform is identical per
 * platform; only the output dir and the injected overrides stylesheet differ).
 * Referenced by web/package.json (`npm run build:desktop`), desktop/package.json
 * (`npm run build:www`), and update-version.sh (`--desktop`).
 *
 * Docs: desktop/docs/DESKTOP_BUILD_AND_DIFFERENCES.md
 */

'use strict';

require('./build-capacitor-www.cjs').run('desktop');
