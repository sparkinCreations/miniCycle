#!/usr/bin/env node
/**
 * build-android-www.cjs — generate the Android (Capacitor) web payload at
 * mobile/android/www/ from web/.
 *
 * Thin entry point: the actual transform lives in build-capacitor-www.cjs (the
 * shared Android/iOS engine — the payload transform is identical per platform;
 * only the output dir and the injected overrides stylesheet differ). This file
 * keeps the stable path referenced by web/package.json (`npm run build:android`),
 * mobile/android/package.json (`npm run build:www`), and update-version.sh.
 *
 * Docs: mobile/android/docs/ANDROID_BUILD_AND_DIFFERENCES.md
 */

'use strict';

require('./build-capacitor-www.cjs').run('android');
