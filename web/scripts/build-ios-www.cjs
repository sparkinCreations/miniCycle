#!/usr/bin/env node
/**
 * build-ios-www.cjs — generate the iOS (Capacitor) web payload at
 * mobile/ios/www/ from web/.
 *
 * Thin entry point: the actual transform lives in build-capacitor-www.cjs (the
 * shared Android/iOS engine — the payload transform is identical per platform;
 * only the output dir and the injected overrides stylesheet differ). Referenced
 * by web/package.json (`npm run build:ios`) and mobile/ios/package.json
 * (`npm run build:www`).
 *
 * Docs: mobile/ios/docs/IOS_BUILD_AND_DIFFERENCES.md
 */

'use strict';

require('./build-capacitor-www.cjs').run('ios');
