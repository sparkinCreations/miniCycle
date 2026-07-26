## [2.330] - 2026-07-26
- docs: add drift-review v2 accuracy correction
- fix(state): notify subscribers + warn user on concurrent-modification discard


## [2.329] - 2026-07-25
- docs: add documentation drift review v2 (supersedes review-findings)
- fix(onboarding): crossfade the first-run use-case ticker (no blank flash)
- fix(routine): deleting the last routine opens the create dialog, not onboarding
- chore: remove stale iCloud-duplicate package json (v1.634 snapshot)
- build(chrome): regenerate full extension at v2.328


## [2.328] - 2026-07-24
- feat(onboarding): play welcome splash on create and sample first-run picks
- chore(release): update version to 2.327
- fix(onboarding): suppress redundant "Back in Home View" toast on first-run exit
- feat(onboarding): show Home View welcome on the sample first-run path
- chore: sync package-lock version to match package.json (2.326)


## [2.327] - 2026-07-24
- fix(onboarding): suppress redundant "Back in Home View" toast on first-run exit
- feat(onboarding): show Home View welcome on the sample first-run path
- chore: sync package-lock version to match package.json (2.326)
- chore(release): update version to 2.326
- product: add pre-flight checklists use-case chip
- chore(release): update version to 2.325
- ci: add error-level ESLint gate to Automated Tests workflow
- chore(release): update version to 2.324
- fix: address CodeRabbit review follow-ups from #9
- chore(release): update version to 2.323
- fix(undo): per-cycle IndexedDB write timers to prevent cross-cycle data loss
- fix(a11y): stop the mode selector from clipping text at larger font sizes
- a11y(fonts): move two readable sub-12px labels onto the --font-size-xs token
- feat(a11y): bump base font to 17px on phones + fix inline-override clobber
- fix(gestures): stop focus-view swipes from skipping a panel (double-navigate)
- fix(cache): serve root HTML no-cache instead of the 1-year catch-all
- chore(release): update version to 2.322
- fix(undo): stop Ctrl+Z / Ctrl+Y from firing undo/redo twice
- chore: sync package-lock.json version to 2.321
- chore(release): update version to 2.321


## [2.326] - 2026-07-23
- product: add pre-flight checklists use-case chip


## [2.325] - 2026-07-23
- ci: add error-level ESLint gate to Automated Tests workflow
- chore(release): update version to 2.324
- fix: address CodeRabbit review follow-ups from #9
- chore(release): update version to 2.323
- fix(undo): per-cycle IndexedDB write timers to prevent cross-cycle data loss
- fix(a11y): stop the mode selector from clipping text at larger font sizes
- a11y(fonts): move two readable sub-12px labels onto the --font-size-xs token
- feat(a11y): bump base font to 17px on phones + fix inline-override clobber
- fix(gestures): stop focus-view swipes from skipping a panel (double-navigate)
- fix(cache): serve root HTML no-cache instead of the 1-year catch-all
- chore(release): update version to 2.322
- fix(undo): stop Ctrl+Z / Ctrl+Y from firing undo/redo twice
- chore: sync package-lock.json version to 2.321


## [2.324] - 2026-07-23
- fix: address CodeRabbit review follow-ups from #9


## [2.323] - 2026-07-23
- fix(undo): per-cycle IndexedDB write timers to prevent cross-cycle data loss
- fix(a11y): stop the mode selector from clipping text at larger font sizes
- a11y(fonts): move two readable sub-12px labels onto the --font-size-xs token
- feat(a11y): bump base font to 17px on phones + fix inline-override clobber
- fix(gestures): stop focus-view swipes from skipping a panel (double-navigate)
- fix(cache): serve root HTML no-cache instead of the 1-year catch-all


## [2.322] - 2026-07-22
- fix(undo): stop Ctrl+Z / Ctrl+Y from firing undo/redo twice
- chore: sync package-lock.json version to 2.321
- chore(release): update version to 2.321
- chore(release): update version to 2.320
- chore(release): update version to 2.319
- chore(release): update version to 2.318
- chore(release): update version to 2.317
- chore(release): update version to 2.316
- chore(release): update version to 2.315
- feat(tests): offline messaging — SW serves 'tests require network' page/throw for /tests/ when offline, modal pre-check notification (new label), suite-page run guards
- chore(release): update version to 2.314
- fix(tests): self-healing test environment — version.js via _cb bypass (always-fresh map), busted HTML fetch, SW-vs-deployed mismatch banner on the suite page
- chore(release): update version to 2.313
- fix(tests): dist-compatible test suite — query-forwarding shims (per-buster fresh instances), version.js/map in suite page, map-aware source fetches, import-based export checks, skip-on-bundled for structural greps
- ios: stamp v2.312 build 2 for first archive
- ios: full docs suite — architecture, build/run guide, App Store checklist, changelog
- ios: apply Xcode recommended settings, move dev team to project level
- ios: set Xcode development team for code signing
- chore(release): update version to 2.312
- refactor(sw): reorganize into 8 labeled sections w/ routing map + two-worlds header; delete dead LAZY list; lite ?v= exemption (was permanently network-first); fix precache drift (uxRatings, focusTaskPanel, panelCarousel, focus-task-panel.css)


## [2.315] - 2026-07-21
- feat(tests): offline messaging — SW serves 'tests require network' page/throw for /tests/ when offline, modal pre-check notification (new label), suite-page run guards


## [2.314] - 2026-07-21
- fix(tests): self-healing test environment — version.js via _cb bypass (always-fresh map), busted HTML fetch, SW-vs-deployed mismatch banner on the suite page


## [2.313] - 2026-07-21
- fix(tests): dist-compatible test suite — query-forwarding shims (per-buster fresh instances), version.js/map in suite page, map-aware source fetches, import-based export checks, skip-on-bundled for structural greps
- ios: stamp v2.312 build 2 for first archive
- ios: full docs suite — architecture, build/run guide, App Store checklist, changelog
- ios: apply Xcode recommended settings, move dev team to project level
- ios: set Xcode development team for code signing


## [2.312] - 2026-07-21
- refactor(sw): reorganize into 8 labeled sections w/ routing map + two-worlds header; delete dead LAZY list; lite ?v= exemption (was permanently network-first); fix precache drift (uxRatings, focusTaskPanel, panelCarousel, focus-task-panel.css)


## [2.311] - 2026-07-21
- refactor(constants): execute magic-number audit — BREAKPOINTS, 6 new UI_TIMEOUTS, milestone dedup, game constants; delete 31 dead if/else shells; no-empty lint gate + SW in lint scope


## [2.310] - 2026-07-20
- docs: second sweep — incident marked resolved (entry hashing shipped), FIX_3 guard update, focus-view dot-nav note, source ?v= rationale for contributors
- docs: post-pipeline docs pass — rewrite BUILD_PROCESS, current-state callouts (SW/PWA/version-guide/deployment), Baseline #3, Lighthouse 2026 results; archive 10 completed/superseded plans


## [2.309] - 2026-07-20
- fix(nav): focus-view Task/Routine/Stats labels navigate to their own panel — dot clicks were toggling to whatever was next


## [2.308] - 2026-07-19
- fix(sw): skip controllerchange reload on first install — one boot for new visitors, kills the Lighthouse mid-trace reload CLS artifact


## [2.307] - 2026-07-19
- fix(perf): metric-matched Poppins fallback (size-adjust overrides) — font swap can no longer shift layout


## [2.306] - 2026-07-19
- fix(perf): preload dominant Poppins weights — kills the font-swap CLS regression from early first paint


## [2.305] - 2026-07-19
- perf(build): inline fonts.css too — zero render-blocking stylesheets in dist


## [2.304] - 2026-07-19
- perf(build): inline critical.css into dist HTML — removes the render-blocking fetch gating LCP


## [2.303] - 2026-07-19
- perf(assets): quantize+resize logos (69KB→6KB splash icon), recompress choice-screen bg, delete 20 unreferenced images (~750KB)
- docs(build): record deploy-config discovery + v2.302 as first verified bundled deploy


## [2.302] - 2026-07-19
- fix(deploy): root netlify.toml — pin base/command/publish so the dist build actually runs on Netlify


## [2.301] - 2026-07-19
- feat(build): CSS bundle + /build/* immutable headers; plan doc as-built notes
- feat(build): full entry hashing + module map + stable-path shims — content identity for all app code


## [2.300] - 2026-07-19
- fix(sw): prefer current caches for all script/style — close stale version.js/miniCycle-main.js broad-match gap
- fix(boot): retire vestigial v1327 SW-migration block (every-load cache sweep fought SW kept-fallback pair) + CSP hash sync


## [2.299] - 2026-07-18
- polish(onboarding): use-case line — ticker reveal (slide up through clipped window) + size hierarchy vs tagline
- feat(onboarding): rotating use-case line on choice screen (preflight / nurse rounds / inspections …)


## [2.298] - 2026-07-17
- feat(recovery): error-screen data backup + crash report; restore-from-backup on choice screen (sessionStorage handoff)


## [2.297] - 2026-07-17
- fix(undo): rollback path was fully dead (AppState.set never existed) — restore via update() + repaint on failure
- docs: integrate ADRs + HOW_MINICYCLE_WORKS + incident/bug reports; ADR-010 deploy-time bundling; cross-link incident to pipeline plan
- docs: document esbuild build process + push=deploy rule; fix stale no-build claims


## [2.296] - 2026-07-14
- feat(testing): boot timing gains network/cache accounting + precache completeness (remote warm-run diagnosis)


## [2.295] - 2026-07-14
- polish(testing): boot timing stamp adds capture date/time
- polish(testing): boot timing header stamps app version + cache (trace attribution)
- docs: build pipeline Phase 3 shipped — prod verification + stale-client upgrade results


## [2.294] - 2026-07-14
- deploy: publish bundled dist (branch preview for build pipeline)
- docs+headers: Phase 1 as-built notes; immutable cache rule for hashed chunks (inert until dist flip)
- feat(build): esbuild release pipeline — stable-path entries + hashed chunks, runtime-import rewriter, generated SW precache
- docs: build pipeline Phase 0 baseline captured (prod v2.293) + marks-not-harness measurement rule


## [2.293] - 2026-07-13
- polish(onboarding): choice screen — brand header top-anchored, buttons vertically centered
- fix(onboarding): keep choice screen until a choice is made — non-chooser reload no longer falls through to focus mode


## [2.292] - 2026-07-12
- feat(onboarding): first-run choice-screen finalization — perception metrics, first-step hint, firstRun labels, routing tests
- fix(onboarding): create/sample choices mark onboardingCompleted — stop Home View tour reappearing on refresh
- harden(boot): forward args in invoke-style appInit/migration DI wrappers (kills the arg-swallow bug class)
- feat(onboarding): route first-run choice — create→Home creation modal, sample→picker, learn→focus flow
- polish(onboarding): soft scrim behind choice-screen text for legibility over light photo
- copy(onboarding): choice-screen tagline contrasts against one-and-done to-dos
- copy(onboarding): plainer choice-screen tagline — states the reset differentiator directly
- polish(onboarding): choice screen — real percent-driven progress bar (was timed creep) + wait-gated Lite link
- feat(onboarding): wait-gated Lite link on choice screen — CSS-timed reveal (>10s boot), data-app-loaded suppression gate
- polish(onboarding): choice screen — logo lifted, miniCycle wordmark + descriptor, low-key bottom-right boot status
- polish(onboarding): choice buttons — solid white with brand-blue text, tap inverts to blue
- polish(onboarding): declutter choice screen — one-line tagline, tip demoted to bottom strip
- fix(onboarding): choice screen — tip pill joins flex column (overlap on short viewports)
- feat(onboarding): first-run choice screen shell — three choices, deferred splash dismiss, tips kept, z-leak fix
- docs: choice screen — per-choice landing table + splash visual-kit reuse
- docs: choice screen revised to three buttons (create / sample picker / opt-in onboarding)
- docs: first-run choice screen plan (two buttons, perceived-wait metrics, lite reroute rework)
- docs: record v2.291 old-Android per-module baseline + facade-parse insight


## [2.291] - 2026-07-12
- polish(testing): boot timing output — aligned columns, phase bars, module table


## [2.290] - 2026-07-12
- feat(boot): per-module timing marks + ranked module list in Boot Timing view
- docs: fold revised feedback review into plans (per-module timing task, SW-guard cleanup payoff, corrected defer list)
- docs: add r/website feedback todo + build pipeline plan (supersedes minification plan)


## [2.288] - 2026-07-11
- docs: phase 3 complete — swipe-to-skip in guides and manual
- test(focusTaskPanel): cover swipe gestures and completion metric
- feat(focus-task): phase 3 polish — vertical swipe-to-skip, themed card content, usage metric


## [2.287] - 2026-07-11
- fix(errors): ignore benign ResizeObserver noise + associate bg-image upload label


## [2.286] - 2026-07-11
- docs(manual): add Home vs Focus View and Task card to in-app user manual
- docs: document focus task view + add Home vs Focus View to user manual
- docs(future-work): update focus task view plan status to shipped-ready
- docs(future-work): record returning-user restore fix
- fix(focus-task): wire ensureModuleLoaded before module inits so restored focus sessions load the Task panel
- docs(future-work): mark focus task view phase 2 complete
- test(panels): directional-class coverage + fixture aria-controls parity
- feat(focus-task): wire Task panel into focus view with themed pills (plan phase 2)
- docs(future-work): mark focus task view phase 1 complete
- test(focusTaskPanel): add suite and register in harness
- feat(focus-task): add one-task-at-a-time panel module (plan phase 1)
- docs(future-work): mark focus task view phase 0 complete
- test(panelCarousel): add carousel suite and register in harness
- refactor(panels): generalize task/stats switcher into indexed panel carousel
- docs(future-work): spec mode-honoring behavior for focus task panel (D5)
- docs(future-work): gate Task panel behind onboarding completion (D8)
- docs(future-work): pull tab-label theming into phase 2 via attr() bridge
- docs(future-work): lock focus task view name (Task) and prev/next decision
- docs(future-work): plan for focus-view one-task-at-a-time panel


## [2.285] - 2026-07-09
- docs(future-work): mark boot audit M3 fixed
- fix(menu): stop main-menu document listener leak + focus steal (audit M3)
- fix(onboarding): stop base .cycle-demo text rule clobbering per-element font sizes
- docs(future-work): mark boot audit M2 fixed
- fix(themes): sweep lens labels into boot-injected modals (audit M2)
- docs(future-work): add fix designs for remaining boot audit items


## [2.284] - 2026-07-08
- docs(future-work): mark boot audit retry-machinery findings fixed
- fix(boot): make retry teardown actually work — shared registries + generation guard
- docs(future-work): add July 2026 boot pipeline audit
- test(harness): register uxRatings module and align its results format
- fix(boot): first-time shimmer dismissal used nonexistent DOM_SELECTORS key
- fix(di): repair seven silent-undefined dep wirings found in boot audit


## [2.283] - 2026-07-08
- fix(sw): serve CSS fresh from network when current caches miss, not from kept old caches


## [2.282] - 2026-07-08
- docs(features): document UX ratings and add feedback modal to feature list
- feat(feedback): add optional star rating with quick tags to feedback modal
- refactor: improve _restoreActiveTaskOptions guard - use === true and extract _clearRestoreFlag helper
- fix: gate _restoreActiveTaskOptions on shouldRestoreActiveTaskOptions flag
- Initial plan


## [2.281] - 2026-07-08
- chore(dev): use autoPort in launch.json so worktree previews avoid port clashes
- fix(dark-mode): remap --theme-text-on-surface to light in classic dark mode; pin static-light surfaces to static dark text


## [2.280] - 2026-07-07
- chore(dev): add port-8081 preview launch config for cache-free verification
- fix(dark-mode): make auto-uncheck banner legible in dark mode
- fix(daily-reset): enabling auto-uncheck no longer resets tasks immediately
- docs(future-work): add July 2026 god-module audit to large module splits plan


## [2.279] - 2026-07-06
- feat(product-page): add June 2026 highlights to What's New timeline


## [2.278] - 2026-07-06
- feat(recurring): native time picker replaces hour/minute/24h inputs (hourly minute unchanged)
- fix(a11y): skip link now moves focus to main + Tab trap for main menu


## [2.277] - 2026-07-03
- feat(task-view): self-home docks (card, quick actions, status bubble) + docked-follower reload fix


## [2.276] - 2026-07-02
- fix(completed-dropdown): filter completed tasks in the dropdown on search too (was #taskList-only)


## [2.275] - 2026-07-02
- fix(completed-dropdown): reconcile dropdown on Uncheck All + Delete All (were left showing stale/deleted tasks)
- fix(completed-dropdown): source organize() from AppState task.completed, not the DOM checkbox


## [2.274] - 2026-07-01
- fix(factory-reset): timeout-guard IndexedDB deletes so a repeat reset can't hang before re-init
- fix(ui): expose startGuidedTour on ui api so menu Reset Tours → Start Tour works
- docs(di-plans): mark CORE_DEPS injection (Step 1b) complete — all of Step 1 done
- fix(di): inject depMappings-sourced CORE_DEPS in strict mode (ENFORCE Step 1b)
- docs(di-plans): mark optionalDeps injection (Step 1a) complete in ENFORCE plan
- fix(di): inject optionalDeps in dep build so they survive ENFORCE_REQUIRES
- fix(di): declare 10 used-but-undeclared deps in manifests (optionalDeps)
- tooling: add validate-di-deps static checker (npm run validate:di)
- docs(di-plans): correct stale refs, flag optionalDeps + provideInstance gaps
- fix(build): harden android www rebuild — retry rmrf on ENOTEMPTY + skip version bump/cap-sync when payload build fails


## [2.273] - 2026-06-29
- docs: archive completed error-handling/recurring plans, split out remaining work, add ERROR_RECOVERY guide
- docs(recurring-audit): mark all P1+P2 resolved, P3 deferred
- docs(error-handling): mark Phases 1-2 implemented, note sync-recovery adaptations
- feat(error-handling): salvage corrupted localStorage data before falling back to a reset
- feat(error-handling): track optional-module load failures and surface a one-time degraded-mode notice
- fix(routineSwitcher): track selected routine in a field, not the DOM .selected class (stops delete/rename/etc. targeting the wrong routine after a re-render)
- docs(testing): note runner must stay foregrounded (backgrounded tabs throttle rAF/timers → spurious timeouts)


## [2.267] - 2026-06-28
- fix(testing): drop dead IndexedDB result-store in runner that hung completion before TEST_RESULTS (modal never closed)


## [2.266] - 2026-06-28
- docs(testing): document hermetic separate-origin test runner; remove stale protection-stack docs
- refactor(testing): remove now-dead test-data protection stack (hermetic, phase B)
- feat(testing): serve in-app test runner from a separate origin (hermetic, phase A)
- fix(testing): gate teardown on post-restore cleanup handshake instead of fixed timer


## [2.265] - 2026-06-28
- refactor(render): project completed dropdown from state in renderTasks (render-path unification)


## [2.264] - 2026-06-28
- fix(routine): repair non-boolean deleteWhenComplete mode value on load (review §2.4)
- refactor(clear): extract buildClearedRecord + _buildClearedEntry helpers (review §2.3)
- refactor(recurring): extract shared recreateDueTasks + buildRecurringInstance (review §2.1/§2.2)


## [2.263] - 2026-06-28
- fix(clear): drive To-Do Clear Completed from state, not DOM checkbox (review §1.1)
- fix(undo): keep recurring-watcher recreations out of undo history (review §1.2)
- chore: gitignore chrome/full-*.zip build artifacts
- docs: add Schema 2.5 reference + architecture review findings
- test(di): add provider-name collision guard to diWiring (baseline known dupes)
- test: make Stress memory + ModalRegistry lookup tests robust in production env


## [2.262] - 2026-06-26
- fix: harden in-browser test data protection (parent save suppression + slow-boot recovery)


## [2.261] - 2026-06-26
- fix: dedupe completed-task DOM nodes duplicated after full re-render
- test(e2e): expand journey runner to five real-app user journeys
- docs: fix pre-existing rot — run-browser-tests .js->.cjs + ghost npm scripts
- docs: sync test/CI docs with journey gate, 0-test-fail, Lighthouse gating
- docs(icons): rewrite SVG_ICON_SYSTEM, archive v1
- fix(ci): drop Lighthouse PWA audits removed in LH12
- test: add E2E journey suite, fix 0-test pass-through, honest Lighthouse gating
- chore(lite): bump Lite version 2.091 → 2.092


## [2.260] - 2026-06-24
- feat(icons): complete the Font Awesome → inline-SVG migration (add last 8 icons)
- ci: migrate the Performance/Lighthouse workflow to the repo root (and delete inert copies)
- test(ui): guard undo/redo completed-dropdown reconciliation
- ci: bump checkout + setup-node to v5 (clears the Node 20 deprecation warning)
- fix(lite): drop Cloudflare Font Awesome CDN so all editions match the privacy policy
- test(ci): serve the layout/sw test fixtures from a Node server, not spawned python3
- test(ci): finish wiring headerLayoutManager into the suite so the drift guard passes
- chore(chrome): add full-2.259.zip for the Chrome Web Store
- docs(android): add Play Store release checklist; move Android docs to android/docs/
- ci: run the layout overlap + service-worker offline guards on every push
- docs: fix remaining stale run-browser-tests.js references (renamed to .cjs)
- docs(testing): fix stale runner command (run-browser-tests.cjs via npm test)
- docs: document the layout/SW regression tests and the measured-chrome layout system


## [2.259] - 2026-06-24
- feat(css): tighten mobile layout to give the task list more room
- fix(css): keep the header logo clear of the status bar
- chore: add full-2.258.zip to the chrome directory
- chore: remove outdated Chrome zip files


## [2.257] - 2026-06-23
- fix(layout): make header measurement resilient so --header-total-height always publishes


## [2.256] - 2026-06-23
- fix(sw): precache the drifted stylesheets so offline doesn't flash unstyled


## [2.255] - 2026-06-23
- fix(sw): precache the drifted boot-graph modules so offline boot stops dying
- docs(sw): correct the network-first strategy comments to match the circuit-breaker behavior


## [2.254] - 2026-06-23
- fix(sw): serve app code network-first (not stale-while-revalidate), guarded by a circuit breaker


## [2.252] - 2026-06-23
- fix(layout): band-centre #task-view so the help window clears the nav dots


## [2.251] - 2026-06-23
- feat(layout): keep the stats panel clear of the nav dots (and header)
- feat(release): add --android-run to build + install the debug APK on a device


## [2.250] - 2026-06-23
- feat(lite): guard lite-version navigation in the packaged Chrome extension + rebuild chrome/full
- feat(layout): measure header height so the routine title always clears the mode selector
- feat(android): make the hardware back button close layers in priority order
- refactor: route all lite-version navigation through one guarded helper
- fix(android): don't route to the unbundled lite version in the native build
- docs(stale-cache): add copy-paste console recovery snippet + cross-ref
- docs: document v2.249 build-version truth/self-heal + drag-customize interrupted-drag teardown
- feat(android): use miniCycle blue logo for launcher icon


## [2.249] - 2026-06-23
- fix(version): detect stale build (not just version.js) so the app self-heals and reports the truth
- fix(boot): skip service-worker + test-recovery waits on native (Capacitor)


## [2.248] - 2026-06-23
- fix(taskViewLayout): clear stuck drag chrome when iOS interrupts a drag
- chore(web): add SessionStart hook to install deps for web sessions
- feat(android): native bridges + update-version.sh --android flag
- feat(android): scaffold Capacitor Android app generated from web/
- fix(pdf): update output path for generated PDF to be relative


## [2.244] - 2026-06-17
- test: flesh out 26 load-only stub suites with behavioral tests (~+450 tests)
- test(harness): register 3 orphaned suites + drift guard; fix notificationDialogHost async assertions
- docs(security): document 3-file CSP sync + update-version.sh automation
- chore(tooling): update-version.sh syncs CSP hashes across netlify.toml, .htaccess, nginx
- fix(csp): reconcile .htaccess + nginx script-src hashes with canonical set
- fix(boot): clear loader-tip interval once app loads (timer leak); resync CSP hash + chrome ext
- chore(release): update version to 2.243
- feat(chrome-ext): open full extension in side panel; rename to "miniCycle: Routine Checklist Manager"
- feat(product): add Chrome extension links + collapsible What's New timeline
- chore(promo): add new promotional images for in-app store
- chore(tooling): add capture-store-screenshots.cjs + npm run capture:screenshots
- chore(promo): add 5 in-app store screenshots (main, stats, themes, fitness, dark) at 1280x800
- chore(chrome): reword extension description — 'Stay consistent' instead of 'Build streaks' (theme-specific vocab)
- fix(chrome): rename bundled sample-routines manifest.json -> index.json (Web Store rejects >1 manifest)
- chore(chrome): repackage extension as full-2.242.zip (matches live version); drop misnamed 2.241 zip + iCloud dup
- docs(chrome): add full extension build & web-vs-extension differences guide
- fix(chrome): bundle legal pages into extension so links stay in-app (was bouncing users to minicycle.app)


## [2.242] - 2026-06-15
- Implement code changes to enhance functionality and improve performance
- chore(promo): add Chrome Web Store screenshot (1280x800) + small promo tile (440x280)
- docs(legal): broaden security policy scope to web/PWA/extension/lite + MV3 CSP + Web3Forms note
- docs(legal): broaden Terms 'Service' definition to cover web/PWA/extension/lite versions
- docs(legal): privacy policy covers all versions (web/extension/lite) + Web3Forms feedback disclosure
- fix(chrome): focus existing launcher tab via storage.session instead of broken tabs.query url filter
- fix(chrome): correct .cjs self-references + rebuild clean zip (drop iCloud cruft dirs)
- docs(css): document the two-tier CSS loading strategy + async main.css race fix
- chore(chrome): add packaged extension zip for v2.241


## [2.241] - 2026-06-15
- fix(boot): apply async main.css when already cached — fixes intermittent unstyled render on refresh


## [2.240] - 2026-06-15
- fix(boot): wire module deps in the sequential init stage (fixes eager-capture of getter deps)
- fix(quick-actions): live-refresh recently/frequently used without a manual refresh
- docs(architecture): document quick actions + usage tracking
- feat(quick-actions): track action usage uniformly via a delegated listener
- feat(task-options): double-tap an option to apply it + discoverability hint
- docs(perf): add central action-dispatch / uniform usage-tracking plan
- docs(perf): add minification (deploy-time) plan
- docs(perf): roadmap verification passes — re-tier candidates, steer toward minification
- docs(perf): mark recurring panel deferral done + verified
- docs(perf): add boot performance roadmap (next targets + structural levers)


## [2.239] - 2026-06-14
- feat(boot): defer recurring panel UI to first open (lazy-load ~3.6k lines off boot)
- feat(promo): add chrome store promotional images
- docs(perf): add recurring panel deferral plan


## [2.238] - 2026-06-14
- feat(boot): parallel phase imports + pre-boot version gate + per-phase timing
- feat(promo): add promotional image for enhanced user engagement
- Fix 3 hardening: unregister stale SW in self-heal so wedged machines auto-recover
- feat(settings): add git commands to settings for version management
- chrome-ext: remove obsolete full-2.235.zip (superseded by 2.236)
- chrome-ext: skip IndexedDB probe on extension origin; rebuild full bundle (2.236)
- Fix 3: serve current-version cache for versioned imports; auto-heal stale SW
- feat(chrome): add full-version MV3 extension zip file


## [2.235] - 2026-06-08
- feat(chrome): generate full-version MV3 extension from web/ via build script
- perf(boot): defer non-critical modules, load on-demand via ensureModuleLoaded


## [2.234] - 2026-06-08
- feat(product-page): restructure secondary links for improved layout and responsiveness
- feat(product-page): add Chrome Web Store badge and link for Lite version
- fix(boot): guard AppState Proxy in theme/recurring reads + null on teardown
- feat(product-page): add May 2026 highlights to What's New timeline
- chore(scripts): commit release bump before tag and push branch on --push
- chore(release): update version to 2.232


## [2.232] - 2026-06-03
- fix(sw): serve fresh module on current-cache miss to avoid stale imports
- fix(boot): prevent white-screen on boot retry from torn-down AppState
- chore(release): update version to 2.231 and reflect changes across documentation and files
- fix(labels): correct spelling in firstRunWelcome message


## [2.231] - 2026-05-18
- chore(release): update version to 2.230 and reflect changes across documentation and files


## [2.230] - 2026-05-18
- feat(notifications): enhance action button handling and styling
- chore(lite): bump lite version
- fix(lite): shorter, properly-centered task pills on mobile
- chore(lite): bump lite version to 2.09
- fix(lite): mobile polish — pill centering, focus-mode slide-out, tighter widths/heights


## [2.229] - 2026-05-17
- Improve small-screen mobile UX: banner padding, modal scroll, proportional sizing
- Add chrome promotional image
- Add new assets and styles for miniCycle Lite polish


## [2.227] - 2026-05-10
- fix: update homepage URL in manifest.json
- Add miniCycle Lite static fallback version and related styles/scripts
- chore: update app version to 2.226 across all relevant files and documentation


## [2.225] - 2026-05-06
- chore: update version to 2.224 across all relevant files and documentation


## [2.224] - 2026-05-04
- chore: update version to 2.223 across all relevant files and documentation


## [2.223] - 2026-05-04
- Add first-run routine and welcome banner styles
- feat: update label strings from "Focus Mode" to "Focus View" for consistency and clarity


## [2.222] - 2026-05-03
- feat: enhance guided tour functionality with step filtering and CSS adjustments


## [2.221] - 2026-05-03
- fix: remove priorityColor field from tasks and correct createdAt timestamp
- feat: add manual cycle mode constant and update related dependencies


## [2.220] - 2026-05-03
- feat: update app version to 2.219 and reflect changes across documentation and files


## [2.219] - 2026-05-02
- feat: update app version to 2.218 and reflect changes across documentation and files


## [2.218] - 2026-05-02
- feat: update app version to 2.217 and reflect changes across documentation and files


## [2.217] - 2026-05-02
- Add new images and study routines for calculus and cleaning tasks
- feat: update app version to 2.216 and reflect changes across documentation and files


## [2.216] - 2026-05-01
- chore: update version to 2.215 and reflect changes across documentation and files


## [2.215] - 2026-05-01
- Add minicycle_6_cycle image to product assets feat(focus-mode): redesign exit + action button, integrate vocab themes
- chore: update version to 2.214 and reflect changes across documentation and files


## [2.214] - 2026-04-30
- Add tests for menu section icons, mode radio group, and theme manager
- fix: update terms of service for clarity and consistency in branding


## [2.213] - 2026-04-29
- chore: update app version to 2.212 and reflect changes across documentation and files


## [2.212] - 2026-04-28
- fix: update privacy policy version and enhance clarity on data handling practices


## [2.211] - 2026-04-28
- fix: enhance privacy statements in learn more and product pages


## [2.210] - 2026-04-28
- chore: update app version to 2.209 and adjust related assets


## [2.209] - 2026-04-28
- fix: correct spacing in AM/PM formatting for time display tests
- chore: update version to v2.208 and reflect changes across documentation and files


## [2.208] - 2026-04-27
- chore: close DI gaps, centralize timing constants, polish CSS
- feat: add Daily Reset Manager for per-routine auto-uncheck functionality


## [2.207] - 2026-04-24
- chore: update version to v2.205 and reflect changes across documentation and files


## [2.206] - 2026-04-24

- feat: add per-routine "Auto-uncheck Daily" — soft daily reset that unchecks all tasks at a configurable local time (default midnight) without triggering a cycle completion
- New menu toggle under "Uncheck All" with inline time button + native time picker modal
- Always-visible status banner above the task list when enabled (also a tap-to-edit shortcut)
- Catch-up: fires on next app open or visibility change if the trigger time passed while the app was closed
- Per-routine notification: silent at fire time; shows "Tasks were auto-unchecked at HH:MM" the next time the user views the affected routine
- New module `modules/task/dailyResetManager.js` (DI-pure, self-contained 60s tick + visibility-change catch-up + AppState subscription for per-cycle UI sync)
- `.mcyc` import/export round-trip preserves the user's intent (enabled/hour/minute) and resets transient runtime fields (lastResetDate, pendingNotification) on import
- 16 new label keys in defaultLabels.js (menu/banner/notify/modal categories)
- 19 tests covering helpers, fire/idempotency logic, view-time notification, user actions, and defensive paths

## [2.205] - 2026-04-21
- feat: add export button for mobile preferences modal and archive routine reset checklist PDF
- updated testimonals


## [2.204] - 2026-04-20
- chore: update version to v2.303


## [2.203] - 2026-04-20
- chore: updated screenshots and phone mock-ups
- feat(product-page): rework with personal story, new header, and testimonials


## [2.202] - 2026-04-19
- fix: make notifications fully interactive while modals are open
- modules/utils/notifications.js: switch drag from mouse+touch events to pointer events with setPointerCapture. Fixes drag freezing when cursor moves over the modal backdrop (inert area), since browsers suppress mouse events over inert content. Pointer capture routes all gesture events to the container regardless of hit target.


## [2.201] - 2026-04-19
-  make notifications interactive while modals are open Add NotificationDialogHost module that re-parents #notification-container into the topmost open <dialog> on showModal() and moves it back on close. Native showModal() applies inertness to everything outside the dialog's DOM subtree, which made notifications visible (via popover top layer) but unclickable, undraggable, and unscrollable while any modal was open. Fix notifications.js removal observer that mistook reparenting for teardown — it ran full cleanup (removing the drag listener) whenever the container's parent received a childList removal mutation, including when appendChild moved the container to a new parent. Now observes the document root, defers the teardown check via queueMicrotask, and only cleans up if the container is truly disconnected from the document. - modules/ui/notificationDialogHost.js: new DI module, MutationObserver   + close event + childList removal tracking, stack-based reparenting   for nested modals, cached container reference so orphaned-inside-   detached-dialog edge case recovers cleanly - modules/boot/moduleManifests.js: register in Phase 2 after notifications   and modalManager - modules/utils/notifications.js: fix removal observer to distinguish   reparent from teardown - modules/ui/modalUtils.js: clarify isClickOnNotification is now a   defensive fallback; NotificationDialogHost is the primary path - tests/notificationDialogHost.tests.js: 14 tests (init, single modal,   nested modals, close+remove edge case, destroy) Verified: drag works before, during, and after modal cycles (tested 7 consecutive open/close cycles); nested ephemeral confirmation dialogs follow the topmost; close+remove pattern handled; position preserved.


## [2.198] - 2026-04-19
- feat: Implement features carousel with infinite loop and auto-advance functionality
- style: Update color variables in footer and quick presets for consistency


## [2.197] - 2026-04-13
- feat: Enhance changelog section with timeline and toggle functionality


## [2.191] - 2026-04-06
- feat: Integrate completed tasks dropdown functionality
- feat: update software version to 2.190 in product page and enhance version updater script
- feat: refactor routine switcher modal and improve accessibility; streamline undo/redo handling and enhance animations


## [2.190] - 2026-04-06
- feat: remove sticky positioning from routine search input for improved layout


## [2.189] - 2026-04-06
- feat: implement double-tap/click selection for routines and adjust selection delay; enhance sticky position for search input


## [2.188] - 2026-04-06
- feat: enhance modal touch handling and improve CSS overflow properties


## [2.187] - 2026-04-06
- feat: update app version to 2.186 and adjust related files


## [2.186] - 2026-04-06
- feat: enhance routine selection with double-click handling and improve modal styles
- feat: update app version to 2.185 and adjust related files


## [2.185] - 2026-04-06
- Refactor code structure for improved readability and maintainability
- feat: update app version to 2.184 and adjust related files


## [2.184] - 2026-04-05
- Add SVG Animation Overlay Guide and related assets
- feat: center align hero call-to-action buttons for improved layout
- feat: update hero mockup dimensions and positioning for better layout


## [2.183] - 2026-04-05
- feat: adjust hero mockup and phone positioning for improved layout


## [2.182] - 2026-04-05
- Add new product images and realistic cleaning routine example


## [2.181] - 2026-04-05
- chore: update app version to 2.180 and modify related files


## [2.180] - 2026-04-04
- feat: enhance task editing with auto-resizing textarea and improved styles


## [2.179] - 2026-04-04
- feat: add Nurse Example checklist with task priority and completion tracking
- feat: enhance .mcyc file format and export functionality with priority color support


## [2.178] - 2026-04-03
- chore: update app version to 2.177 and modify related files


## [2.177] - 2026-04-03
- chore: update app version to 2.176 and modify related files


## [2.176] - 2026-04-03
- feat: normalize event data format for click tracking in dashboard and handler
- feat: enhance click tracking with daily breakdown and recent clicks display
- chore: update app version to 2.175 and modify related files


## [2.175] - 2026-04-03
- feat: add initial dashboard HTML structure and styling


## [2.174] - 2026-04-03
- chore: update app version to 2.173 and modify related files


## [2.173] - 2026-04-03
- chore: update app version to 2.172 across all relevant files


## [2.171] - 2026-04-03
- Add daily routine screenshot for Version 2-145


## [2.170] - 2026-04-02
- feat: update product page carousel and changelog functionality


## [2.169] - 2026-04-01
- chore: update version to 2.168 across all relevant files and changelog


## [2.168] - 2026-03-31
- feat: implement animated dialog close utility and enhance modal close animations


## [2.167] - 2026-03-31
- chore: fix license field to reference proprietary LICENSE file
- chore: add root .gitignore for OS files
- chore: remove .DS_Store from git tracking
- chore: add miniCycle Review PDF to the archive
- chore: enhance test output for skipped modules with detailed reasons


## [2.166] - 2026-03-30
- chore: update version to 2.165 and adjust related files


## [2.165] - 2026-03-30
- chore: update version to 2.164 and adjust related files


## [2.164] - 2026-03-30
- chore: update version to 2.163 and adjust related files


## [2.163] - 2026-03-30
- chore: update version to 2.162 and adjust related files


## [2.162] - 2026-03-30
- chore: update version to 2.161 and adjust related files


## [2.161] - 2026-03-30
- chore: update version to 2.160 and adjust related files


## [2.160] - 2026-03-30
- chore: update version to 2.159 and adjust related files


## [2.159] - 2026-03-30
- chore: update version to 2.158 and adjust related files


## [2.158] - 2026-03-30
- chore: update version to 2.157 and adjust related files


## [2.157] - 2026-03-30
- chore: update version to 2.156 and adjust related files


## [2.156] - 2026-03-30
- fix: improve version mismatch detection for test files in service worker


## [2.155] - 2026-03-29
- chore: update version to 2.154 and adjust related files


## [2.154] - 2026-03-29
- fix: enhance backup logic in module test suite to preserve existing IndexedDB backups


## [2.153] - 2026-03-29
- fix: add guard for event target in wireRecurringSettingsClickListener


## [2.150] - 2026-03-29
- Enhance documentation and dependency injection across UI modules


## [2.149] - 2026-03-29
- Add comprehensive test suites for task management modules


## [2.148] - 2026-03-27
- feat: add comprehensive test coverage audit documentation
- feat: update version to 2.147 across documentation and codebase


## [2.147] - 2026-03-27
- feat: update user manual with v3 screenshots, expand README with technical details


## [2.146] - 2026-03-26
- feat: enhance user manual with guided tour and accessibility options
- Refactor code structure for improved readability and maintainability
- Refactor UI module selectors to use DOM_SELECTORS constants


## [2.145] - 2026-03-26
- feat: update hardcoded selectors audit documentation and add remaining violations


## [2.144] - 2026-03-26
- Refactor UI components to use DOM_CLASSES for improved maintainability


## [2.143] - 2026-03-26
- feat: add panel accent color variable to theme definitions and update help window styles


## [2.142] - 2026-03-26
- feat: enhance task options theming with new CSS variables for background, border, and hover effects


## [2.141] - 2026-03-26
- feat: add backup reminder system to prompt users for routine backups and enhance storage management documentation


## [2.140] - 2026-03-26
- feat: implement backup reminder system with modal notifications and download functionality


## [2.139] - 2026-03-26
- feat: enhance modal theming with new variables and update security headers for improved protection
- feat: update version to 5.5; add automatic CSP hash verification and update logic in update-version.sh


## [2.138] - 2026-03-26
- feat: update X-Frame-Options header to SAMEORIGIN for improved security


## [2.137] - 2026-03-26
- feat: add modal theme variables and update styles across components; enhance consistency and maintainability


## [2.136] - 2026-03-26
- feat: refactor toast message label map for cycle completion; move to a constant and remove duplication in HelpWindowManager


## [2.135] - 2026-03-26
- feat: add reset flash color preference; implement color input and update related constants, labels, and animations


## [2.134] - 2026-03-26
- feat: add cycle completion settings; implement options for animation color, toast message, and toggles for animation and toast display


## [2.133] - 2026-03-25
- feat: update notification selectors and improve badge tap hint; enhance styling for search match highlighting in dark mode


## [2.132] - 2026-03-25
- feat: enhance settings modal layout and styling; add scroll area, adjust paddings, and improve close button design


## [2.131] - 2026-03-25
- feat: update version to 2.130; modify changelog, project stats, manifest, HTML, CSS, and service worker for consistency


## [2.130] - 2026-03-25
- feat: update version to 2.129; modify changelog, project stats, manifest, HTML, CSS, and service worker for consistency


## [2.129] - 2026-03-25
- feat: update version to 2.128; modify changelog, project stats, manifest, HTML, CSS, and service worker for consistency


## [2.128] - 2026-03-25
- feat: enhance preferences modal styling with glass effect and improved shadow
- feat: update modal components for improved accessibility and styling


## [2.127] - 2026-03-24
- feat: implement safe cache put method for dynamic and static caches; improve error handling


## [2.126] - 2026-03-24
- feat: enhance service worker caching strategy; implement safe cache put and improve error handling


## [2.125] - 2026-03-24
- - The document includes various structured content relevant to the miniCycle review process.


## [2.124] - 2026-03-24
- feat: implement history modal styles and dark mode support; enhance UI for better user experience


## [2.123] - 2026-03-23
- feat: enhance PWA offline architecture and service worker update strategy; add version freshness checks and improve theme management UI


## [2.122] - 2026-03-23
- feat: update version to 2.121 across all relevant files and changelog


## [2.121] - 2026-03-23
- feat: update version to 2.120 across all relevant files and changelog


## [2.120] - 2026-03-23
- Add dark mode styles for personalization modal and related components


## [2.119] - 2026-03-23
- feat: add new task option categories and enhance UI elements for better organization and clarity


## [2.118] - 2026-03-23
- feat: enhance styling and layout across various components for improved UI consistency


## [2.117] - 2026-03-23
- feat: update version to 2.116 across all relevant files and changelog and no longer network first


## [2.116] - 2026-03-23
- feat: enhance notification behavior and UI, add dynamic copyright year


## [2.115] - 2026-03-23
- Refactor modal handling and notification interactions


## [2.114] - 2026-03-22
- feat: update onboarding and tour messages for clarity and engagement


## [2.113] - 2026-03-21
- feat: update task button icons and guided tour steps


## [2.112] - 2026-03-20
- feat: update notification styles and structure for recurring notifications


## [2.111] - 2026-03-20
- feat: enhance device detection and update cache version to 951


## [2.110] - 2026-03-20
- feat: update version to 2.109 and enhance various components with mobile-friendly dialogs and touch device support


## [2.109] - 2026-03-20
- feat: add edit focus overlay functionality with associated styles and behavior


## [2.108] - 2026-03-20
- feat: add guided tours for history, cleared tasks, and achievements with associated notifications and UI updates


## [2.107] - 2026-03-19
- feat: update version to 2.106 and enhance onboarding with interactive demo and new styles


## [2.106] - 2026-03-19
- feat: enhance onboarding cycle animation with improved SVG design and styling adjustments


## [2.105] - 2026-03-18
- feat: update version to 2.104 and enhance CHANGELOG with new features
- feat: enhance onboarding experience with cycle animation and updated task descriptions


## [2.104] - 2026-03-18
- feat: update licensing terms and add onboarding tour animation with associated styles
- feat: update CHANGELOG for version 2.103 with new reminders and menu guided tour notifications
- feat: add guided tours for settings, routine switcher, recurring list, and recurring settings


## [2.103] - 2026-03-18
- feat: add reminders and menu guided tour notifications with associated UI updates


## [2.102] - 2026-03-17
- feat: enhance modal and notification interactions


## [2.101] - 2026-03-16
- feat: add Guided Tour Manager with UI elements and notifications


## [2.100] - 2026-03-15
- fix(docs): improve guided tour button setup by enhancing settings dialog closure handling
- fix(docs): enhance modal detection in guided tour to improve user experience and prevent data loss
- fix(docs): clarify dialog handling in guided tour implementation and note legacy fallback path
- fix(docs): add implementation note for onDismiss callback in guided tour notification handling
- fix(docs): improve Safari drag-and-drop handling with custom ghost image and cleanup for task options


## [2.099] - 2026-03-15
- fix(docs): enhance drag-and-drop functionality with new DOM classes and selectors for task management


## [2.098] - 2026-03-15
- fix(docs): update modal conflict handling to prevent data loss by ensuring dialogs are closed before starting the tour
- fix(docs): update guided tour button logic to ensure settings dialog closes before starting tour
- fix(docs): prevent data loss by canceling pending tour notifications in startTour()
- fix(docs): enhance guided tour logic to prevent data loss from open dialogs during tour initiation
- fix(docs): clarify welcome notification delay logic for first-time and returning users
- fix(docs): update guided tour initialization logic to improve step persistence and event handling
- fix(docs): enhance guided tour notification handling and improve step navigation logic
- fix(docs): add general target handling in guided tour steps to prevent crashes and improve user experience
- fix(docs): clarify welcome notification delay logic and ensure proper async handling for onboarding completion
- fix(docs): clarify onboarding event dispatch logic and update rationale for guided tour triggers
- fix(docs): update guided tour initialization logic for returning users and refine event listener management
- feat(docs): refine guided tour initialization logic for first-run and returning users
- feat(docs): update guided tour triggers for first-run and returning users
- feat(docs): update guided tour integration points and add settings for retake option
- docs(guided-tour): enhance testing plan and add test cases for guided tour functionality
- fix(docs): clarify tooltip interaction and overlay behavior in guided tour plan
- docs(guided-tour): update guided tour plan with refined steps and tooltip positioning
- feat(docs): add Large Module Splits Plan to address module size and complexity
- feat(docs): add ENFORCE_REQUIRES rollout plan for dependency management feat(data-access): update dataAccess.js to clarify legacy usage and encourage direct AppState access feat(module-manifests): enhance optionalDeps across multiple modules for improved dependency management


## [2.097] - 2026-03-15
- Refactor documentation and codebase for clarity and consistency


## [2.096] - 2026-03-15
- feat(app-state): implement destroy method for AppState to manage teardown and prevent stale references


## [2.095] - 2026-03-15
- feat(app-state): improve AppState teardown and listener management for retries


## [2.094] - 2026-03-15
- feat(changelog): add entry for backup validation enhancements and event listener improvements
- feat(data-sanitizer): strip display-only fields from history events during cycle sanitization


## [2.093] - 2026-03-15
- feat(backup-validation): enhance backup validation before restoring localStorage and improve event listener handling


## [2.092] - 2026-03-15
- feat(routine-switcher): add close button and improve action row layout


## [2.091] - 2026-03-15
- Refactor recurring settings normalization and caching logic


## [2.090] - 2026-03-15
- feat(accessibility): enhance recurring settings panel styles for high contrast mode


## [2.089] - 2026-03-14
- feat(documentation): add Framework Equivalents guide and enhance README with architectural philosophy


## [2.088] - 2026-03-14
- feat(recurring): enhance recurring task settings and UI


## [2.087] - 2026-03-14
- feat(recurring): enhance recurring task functionality and improve label handling


## [2.086] - 2026-03-14
- feat: Update recurring task features and improve accessibility


## [2.085] - 2026-03-14
- feat(recurring-panel): enhance panel mode management and UI interactions


## [2.083] - 2026-03-13
- Refactor recurring module for improved dependency injection and label handling


## [2.082] - 2026-03-13
- feat: enhance recurring task management with improved notification settings and label integration


## [2.081] - 2026-03-13
- docs(guided-tour): update guided tour plan with refined steps and tooltip positioning


## [2.080] - 2026-03-12
- feat: enhance default labels and improve change description handling in undo/redo manager


## [2.079] - 2026-03-12
- feat: enhance recurring settings normalization with default date anchoring for frequency types


## [2.078] - 2026-03-12
- fix: update clearedTasks handling in undo/redo functions to reset to null when no tasks are present


## [2.077] - 2026-03-12
- feat: enhance task management with additional attributes and improved undo/redo descriptions


## [2.076] - 2026-03-12
- fix: update .mcyc file format documentation for new task properties and versioning
- fix: update file input accept types to include application/octet-stream for backup and import functionalities


## [2.075] - 2026-03-11
- Add sample routines and manifest generation script


## [2.074] - 2026-03-11
- Refactor: Remove console.log statements across utility modules


## [2.072] - 2026-03-11
- fix: adjust default pattern opacity from 5% to 4% in preferences modal and preferences manager


## [2.071] - 2026-03-11
- chore: update version to 2.070 across all relevant files; enhance routine switcher modal and adjust default pattern opacity


## [2.070] - 2026-03-11
- feat: enhance routine switcher modal with improved layout and desktop preview functionality; add new constants and styles


## [2.069] - 2026-03-11
- feat: implement two-panel layout for routine switcher modal on desktop; restructure HTML and update styles


## [2.068] - 2026-03-10
- docs: rewrite README with screenshots, updated feature sections, and current stats
- feat: add 'loadMiniCycle' to optional dependencies in pullToRefresh module; enhance UI refresh logic


## [2.067] - 2026-03-10
- Refactor notification timeouts and improve shadow variables across components


## [2.066] - 2026-03-10
- feat: add milestone celebration overlays for 100 cycles and 500 tasks; update related labels and preferences


## [2.065] - 2026-03-09
- feat: update checkmark style options to set 'fitted' as default and adjust preferences modal accordingly


## [2.064] - 2026-03-09
- feat: refactor checkmark style options to use dropdown; update related labels and dependencies


## [2.063] - 2026-03-09
- feat: update preferences modal checkmark style section and improve styling for consistency


## [2.062] - 2026-03-09
- feat: add checkmark style customization to personalization modal (Standard, Fitted, Minimal, Circle)
- fix: iOS checkmark color not responding to color picker (text variation selector \FE0E)


## [2.061] - 2026-03-09
- feat: enhance loading and update mechanisms; add preloadGettingStartedCycle and UI loader functions


## [2.060] - 2026-03-09
- feat: add loadMiniCycle dependency for in-place UI refresh after offline operations


## [2.059] - 2026-03-09
- feat: update app version to 2.058; reflect changes across documentation and codebase


## [2.057] - 2026-03-09
- feat: update app version to 2.056; reflect changes across documentation and codebase


## [2.056] - 2026-03-09
- feat: enhance versioning strategy for module imports; improve offline support and caching behavior


## [2.055] - 2026-03-09
- feat: update app version to 2.054; enhance service worker diagnostics and cache logging


## [2.054] - 2026-03-08
- feat: enhance offline handling in service worker; skip background fetch when offline and generate synthetic version.js


## [2.053] - 2026-03-08
- feat: implement warm cache functionality; verify boot-critical files after online boot to ensure offline availability


## [2.052] - 2026-03-08
- feat: enhance boot error diagnostics; include detailed information for iOS debugging and improve offline fallback handling


## [2.051] - 2026-03-08
- feat: enhance service worker caching strategy; add new boot-critical files and improve fallback handling for offline support


## [2.050] - 2026-03-08
- feat: add synthetic version.js generation for offline support; improve error handling for uncached modules


## [2.049] - 2026-03-08
- feat: enhance service worker boot process; add modal templates and registry to boot-critical files, improve cache management for offline fallback


## [2.048] - 2026-03-08
- feat: update app version to 2.047; reflect changes across documentation and service worker


## [2.047] - 2026-03-07
- feat: update app version to 2.046; enhance service worker and boot retry logic for improved iOS performance


## [2.046] - 2026-03-07
- fix: improve service worker timeout handling for iOS; ensure faster cache fallback


## [2.045] - 2026-03-07
- feat: update app version to 2.044; enhance error handling for offline scenarios and improve cache management


## [2.044] - 2026-03-07
- Add comprehensive developer guides for CSS architecture, event listener management, and module addition
- feat: update task editing labels and notifications


## [2.043] - 2026-03-07
- feat: update app version to 2.042 and reflect changes in relevant files; enhance notifications and task management features


## [2.042] - 2026-03-06
- feat: enhance recurring panel with time picker sections and improved task filtering


## [2.041] - 2026-03-05
- Refactor DOM access to use dependency injection across multiple modules


## [2.040] - 2026-03-05
- feat: enhance routine management with new optional dependencies and update recurring info link


## [2.039] - 2026-03-04
- feat: update app version to 2.038 and reflect changes in relevant files


## [2.038] - 2026-03-04
- feat: update task button icons and labels for clarity and consistency
- feat: enhance user experience with loading tips and recurring task panel hints


## [2.037] - 2026-03-04
- feat: enhance recurring task handling with priority color support


## [2.036] - 2026-03-03
- feat: Update CHANGELOG for version 2.035 with max-height adjustments for task view in focus mode
- feat: Update app version to 2.035 across all relevant files


## [2.035] - 2026-03-02
- feat: Adjust max-height constraints for task view and containers in focus mode for improved layout


## [2.034] - 2026-03-02
- feat: Refine focus mode layout with explicit max-heights for task view and containers


## [2.033] - 2026-03-02
- feat: Remove max-height constraints for task cards and list in focus mode for improved layout


## [2.032] - 2026-03-02
- feat: Remove max-height constraints for task list on desktop and mobile for improved layout


## [2.031] - 2026-03-02
- feat: Adjust task view max-height for improved layout in focus mode and mobile view
- feat: Improve mobile layout and task card behavior to prevent overlap and enhance usability


## [2.030] - 2026-03-02
- feat: Enhance user experience and fix usability issues


## [2.028] - 2026-03-02
- feat: enhance first cycle celebration logic for new users and migrated users


## [2.027] - 2026-02-28
- docs: add guided tour system plan for onboarding new users


## [2.026] - 2026-02-28
- feat: add download functionality for routines; docs: create guided tour plan


## [2.025] - 2026-02-28
- feat(recurring): Enhance recurring tasks functionality and UI


## [2.024] - 2026-02-28
- chore: update version to 2.023 and reflect changes across documentation and files


## [2.023] - 2026-02-27
- chore: update version to 2.022 and reflect changes across documentation and files


## [2.022] - 2026-02-27
- fix: enhance notification display for routine creation cancellation


## [2.021] - 2026-02-27
- feat: enhance mode selector and sync functionality across routines and tasks


## [2.020] - 2026-02-27
- fix: add no-cache headers for pretty URL pages to prevent caching issues
- chore: update version to 2.019 and enhance functionality


## [2.019] - 2026-02-26
- Add Docsify configuration and security guidelines


## [2.018] - 2026-02-26
- fix: enhance accessibility with skip link and focus-visible styles in learn more and product pages
- fix: adjust max-height for task view and its components in focus mode for better visibility


## [2.017] - 2026-02-25
- fix: adjust task view positioning in focus mode for better visibility on smaller screens


## [2.016] - 2026-02-25
- fix: adjust CSS selectors for task card and list container in focus mode for improved layout


## [2.015] - 2026-02-25
- fix: update Content-Security-Policy to include additional script hash for improved security


## [2.014] - 2026-02-25
- feat: add "Check for Updates" button and style adjustments for dark mode


## [2.013] - 2026-02-25
- feat: update CSS file caching strategy with versioning for cache busting and add no-cache headers


## [2.012] - 2026-02-25
- feat: enhance cycle data export and import with history and cleared tasks, improve focus mode layout and transitions


## [2.011] - 2026-02-25
- feat: implement focus mode enhancements with new UI elements and improved button positioning


## [2.010] - 2026-02-25
- chore: update version to 2.009 and reflect changes across relevant files


## [2.009] - 2026-02-25
- feat: enhance history logging with detailed event labels and icons
- fix: remove !important from focus-mode CSS, use proper specificity
- feat: add Focus Mode for distraction-free task management


## [2.008] - 2026-02-25
- chore: update version to 2.007 across relevant files
- feat: add educational tip for routine preview feature and style hint


## [2.006] - 2026-02-24
- feat: enhance task management with history logging and user tips


## [2.005] - 2026-02-24
- chore: update version to 2.004 across relevant files


## [2.004] - 2026-02-24
- docs: Update architecture and developer guides with important fixes and clarifications
- feat: Implement vocabulary theme system and update related documentation


## [2.003] - 2026-02-24
- feat: enhance history tracking with task addition, deletion, and editing events


## [2.002] - 2026-02-24
- chore: update version to 2.001 across relevant files


## [2.1] - 2026-02-24
- chore: update version to 2.1 across all relevant files


## [2.1] - 2026-02-24
- feat: add guidelines for distinguishing between noise and instrumentation console logs


## [1.1040] - 2026-02-24
- fix: correct state snapshot timing to ensure accurate theme unlock detection
- feat: implement theme unlock reconciliation for improved user experience


## [1.1039] - 2026-02-24
- feat: refactor theme management to streamline vocab theme rendering and initialization


## [1.1038] - 2026-02-24
- feat: add apple touch icon and improve event listener management in various modules


## [1.1037] - 2026-02-24
- Refactor code structure for improved readability and maintainability


## [1.1036] - 2026-02-24
- feat: add clear undo history functionality and UI integration


## [1.1035] - 2026-02-24
- feat: enhance achievements manager with vocab theme unlocking and update related UI elements


## [1.1034] - 2026-02-23
- chore: update version to 1.1033 and reflect changes in relevant files


## [1.1033] - 2026-02-23
- feat: update theme manager and add new SVG patterns
- feat: add support for custom theme colors and update related UI components


## [1.1032] - 2026-02-23
- feat: enhance task and cycle labels for improved pluralization and clarity


## [1.1031] - 2026-02-23
- feat: enhance notifications and labels for improved user feedback and consistency


## [1.1030] - 2026-02-23
- refactor: update vocabulary labels and icons for consistency across themes


## [1.1029] - 2026-02-23
- feat: implement vocabulary theme system for dynamic terminology


## [1.1028] - 2026-02-23
- Implement choice modal for import options; enhance import process with user selection for template or progress mode


## [1.1027] - 2026-02-22
- Refactor deleteCompletedTasksImpl to improve UI update handling during task deletion; ensure staggered animations complete before updating DOM-dependent elements.


## [1.1026] - 2026-02-22
- Remove "Always Show Recurring Button" setting and related functionality


## [1.1025] - 2026-02-22
- Refactor quick themes to quick colors for consistency; update achievements and stats panel to handle tasks cleared in badge updates; enhance toggle switch accessibility.


## [1.1024] - 2026-02-22
- Refactor notifications and labels for improved localization and icon usage


## [1.1022] - 2026-02-22
- Refactor overdue task styles for improved accessibility and consistency; update notification durations and implement dynamic quick preset rendering.
- Enhance due date notifications and overdue task styling; implement new labels and accessibility styles for overdue tasks in light and dark modes.


## [1.1021] - 2026-02-22
- Refactor CSS styles to utilize CSS variables for improved theming and consistency across menu, modals, mode selector, quick actions, and recurring components.


## [1.1020] - 2026-02-22
- Refactor styles across components to utilize new color variables for consistency and improved theming


## [1.1019] - 2026-02-22
- Refactor theme styles to enhance UI interactions; add new CSS variables for hover, selected, accent, and error states in dark and golden glow themes.
- Add sharing functionality for routines and app; implement share buttons, notifications, and share manager module


## [1.1018] - 2026-02-22
- Refactor CSS styles to use CSS variables for spacing, colors, and border radii; update header and safe area styles for consistency; enhance dark mode styles; add comprehensive app reviews for miniCycle Lite and full version.


## [1.1017] - 2026-02-22
- Implement task priority color handling and update related styles and notifications


## [1.1014] - 2026-02-22
- Add priority color picker notification and user preference handling for task priority


## [1.1013] - 2026-02-22
- Update notification types for task priority changes and add mute check for non-error notifications


## [1.1012] - 2026-02-22
- Add notifications toggle and related functionality for user preferences


## [1.1011] - 2026-02-22
- Update CHANGELOG.md for version 1.1010 with mobile font-size overrides and style adjustments
- Update application version to 1.1010 and adjust related files


## [1.1010] - 2026-02-22
- Add mobile font-size overrides and adjust styles for better responsiveness


## [1.1009] - 2026-02-21
- Refactor stats panel styles for improved layout and responsiveness on small screens


## [1.1008] - 2026-02-21
- Update application version to 1.1007 in CHANGELOG.md
- Refactor stats panel styles for improved spacing and responsiveness


## [1.1007] - 2026-02-21
- Update application version to 1.1006 across all relevant files


## [1.1004] - 2026-02-21
- Add Lite Version documentation to architecture section
- Add user notification for redirects from full version boot failures
- Update Content Security Policy notes and script hashes in configuration files
- Adjust iPhone header layout for improved branding and button alignment
- Adjust iPhone header total height for improved visual consistency
- Refine iPhone header styles for improved layout and consistency
- Adjust iPhone task view positioning and animation for better usability
- Refine iPhone menu button positioning for vertical centering in header
- Refine iPhone header styles for dynamic height and menu button positioning
- Adjust iPhone menu button positioning to pin it at logo level below Dynamic Island
- Adjust iPhone menu button positioning to align with logo below Dynamic Island
- Align iPhone menu button to the top of the header for improved layout
- Refine iPhone menu button alignment and mode selector positioning for improved layout under Dynamic Island
- Adjust iPhone menu button alignment for improved layout under Dynamic Island
- Update app and lite version numbers in PROJECT_STATS.md to 1.986 and 2.066 for consistency.
- Refine iPhone-specific styles for Dynamic Island support by adjusting menu button alignment and repositioning mobile mode selector for improved layout.
- Refine iPhone-specific safe area calculations for Dynamic Island support by adjusting CSS variables for improved layout.
- Adjust iPhone-specific styles for Dynamic Island support by increasing padding and repositioning mobile mode selector for improved layout.
- Refine iPhone-specific padding adjustments for Dynamic Island support and improve safe area handling in styles.


## [1.980] - 2026-02-21
- Enhance responsive styles by adjusting padding and margins for dynamic areas, and introduce new CSS variables for improved layout on mobile devices.


## [1.978] - 2026-02-21
- Enhance mobile header layout by adjusting padding for improved subtitle clearance and overall visibility on smaller screens.


## [1.977] - 2026-02-21
- Enhance mobile layout by adjusting task view max-height and header clearance, and update header padding for better visibility on smaller screens.


## [1.976] - 2026-02-21
- Enhance complete all button styles by updating background color, text color, dimensions, and font size for improved visibility and user experience.


## [1.975] - 2026-02-21
- Enhance button styles for cycle completion by updating dimensions, colors, and animations for improved visual feedback.


## [1.974] - 2026-02-21
- Enhance responsive styles for stats panel by adjusting dimensions, padding, and font sizes for improved layout on smaller screens.


## [1.973] - 2026-02-21
- Refactor styles and improve accessibility by updating font sizes, adding new color variables, and enhancing ARIA attributes across various components.


## [1.972] - 2026-02-21
- Enhance accessibility and UI by updating ARIA attributes and improving font sizes across various components


## [1.971] - 2026-02-21
- Add theme customizer modal styles and functionality


## [1.970] - 2026-02-20
- Implement keyboard navigation utilities and enhance arrow key navigation across various components for improved accessibility and user experience.


## [1.969] - 2026-02-20
- Enhance notification container behavior by implementing popover management to ensure it appears above dialog modals; update styles to override default popover settings for improved visibility and interaction.


## [1.967] - 2026-02-20
- Enhance undo/redo functionality by implementing a grace period to prevent async render-triggered state updates from clearing the redo stack; update related logic for state management and notifications


## [1.966] - 2026-02-20
- Enhance dark mode navigation by updating styles for navigation dots and improving dot interaction; adjust layout and visual elements for better user experience


## [1.965] - 2026-02-19
- Enhance accessibility by adjusting touch target styles and outline offsets for improved user interaction


## [1.964] - 2026-02-19
- Enhance accessibility by updating Content Security Policy and adding invisible touch target styles for improved user interaction


## [1.963] - 2026-02-19
- Enhance accessibility by adding ARIA labels to collapsible sections and updating focus management for modals; improve focus styles for various input elements


## [1.962] - 2026-02-19
- Enhance accessibility by adding ARIA roles and labels to loading elements; refactor event handler assignments for improved clarity and performance


## [1.961] - 2026-02-19
- Add comprehensive accessibility review ratings and compliance summary
- Refactor testing modal styles and improve accessibility


## [1.960] - 2026-02-19
-  Improve accessibility and update user manual with new screenshots


## [1.959] - 2026-02-18
- Refactor code structure for improved readability and maintainability


## [1.958] - 2026-02-17
- added photos for user manual in assets


## [1.957] - 2026-02-17
- Enhance user manual and styles


## [1.956] - 2026-02-17
- Enhance accessibility and styling across components


## [1.955] - 2026-02-17
- Add security policy page and enhance accessibility styles for high contrast mode


## [1.954] - 2026-02-16
- chore: update version to 1.953 across all relevant files and changelog


## [1.953] - 2026-02-16
- feat: enhance drag-and-drop functionality for iOS native support and improve touch handling
- feat: prevent browser scrolling during drag operations with touch-action styles


## [1.952] - 2026-02-16
- feat: enhance about modal styles and functionality for improved user experience


## [1.951] - 2026-02-16
- chore: update version to 1.950 across all relevant files and changelog


## [1.950] - 2026-02-16
- feat: enhance recurring panel styles for improved visibility and interaction
- feat: unify logo integration across modals and menus with has-corner-logo class


## [1.949] - 2026-02-16
- feat: enhance UI with new color presets and logo integration


## [1.948] - 2026-02-16
- fix: Adjust z-index and position for body background to ensure proper layering of gradient and pattern


## [1.947] - 2026-02-15
- feat: Refactor settings modal styles for improved layout and centralized dialog management


## [1.946] - 2026-02-15
- feat: Update modal dimensions for improved layout consistency across components


## [1.945] - 2026-02-15
- feat: Enhance focus management by adding focusVisible option for improved accessibility


## [1.944] - 2026-02-15
- feat: Implement Help Window and Quick Actions toggles


## [1.943] - 2026-02-15
- Enhance accessibility and keyboard navigation across UI components


## [1.942] - 2026-02-15
- feat: Implement inline editing for task names with improved accessibility


## [1.941] - 2026-02-15
- feat: Enhance accessibility features and keyboard navigation across various components


## [1.940] - 2026-02-15
- Refactor modal handling to utilize native <dialog> elements


## [1.939] - 2026-02-15
- feat: Improve accessibility features across task and stats panels


## [1.938] - 2026-02-14
- feat: Enhance accessibility and cleanup across various modules


## [1.937] - 2026-02-14
- Refactor notifications and labels in ClearedTasksManager, HelpWindowManager, and PullToRefresh


## [1.936] - 2026-02-14
- feat: Complete Code Audit #6 with P0 + P1 fixes and additional P2 improvements


## [1.935] - 2026-02-14
- Refactor code structure for improved readability and maintainability


## [1.934] - 2026-02-14
- docs: update local development URLs in developer documentation
- chore: update version to 1.933 across all relevant files


## [1.933] - 2026-02-13
- chore: update version to 1.932 across all relevant files


## [1.932] - 2026-02-13
- chore: update version to 1.931 across all relevant files and enhance CSP script-src directives


## [1.931] - 2026-02-13
- feat: Enhance cycle import manager with localStorage notifications and improve task option button handling


## [1.930] - 2026-02-13
- added lite version to main menu


## [1.929] - 2026-02-12
- ``` feat: enable service worker caching for offline support and faster loading ```


## [1.928] - 2026-02-11
- task option buttons updated


## [1.927] - 2026-02-11
- fix: address code review findings — DI caching, CSP hardening, APP_VERSION consolidation, and DRY refactors


## [1.926] - 2026-02-11
- feat: add new entries to CHANGELOG for label system updates and notification localization improvements
- Refactor transition properties across multiple CSS components to utilize CSS variables for improved maintainability and consistency. Updated transition durations for various elements in mode-selector, notifications, onboarding, progress-bar, quick-actions, recurring, routine-switcher, settings, stats-panel, storage, task-list, task-options, app-container, header, dark-mode, and helpers stylesheets.


## [1.925] - 2026-02-10
- feat: update label system documentation and integration plan with new key counts and module details
- feat: update notification messages to use label resolver for better localization


## [1.924] - 2026-02-08
- feat: update notifications to use localized labels across various modules


## [1.923] - 2026-02-08
- feat: Update accessibility labels and notifications across various modules


## [1.922] - 2026-02-08
- feat: add pattern opacity control and refactor background handling


## [1.921] - 2026-02-07
- feat(labels): integrate label resolver for dynamic string management and pluralization across the application


## [1.920] - 2026-02-07
- chore: update version to 1.919 across all relevant files and documentation


## [1.919] - 2026-02-06
- feat(labels): implement label resolution system with pluralization and interpolation support
- feat: enhance task management by integrating completed tasks into progress tracking and UI interactions


## [1.918] - 2026-02-05
- fix: address critical issues including XSS vulnerabilities, Unicode handling, and prototype pollution


## [1.917] - 2026-02-05
- feat(audit): enhance accessibility, data integrity, and performance across the application


## [1.916] - 2026-02-02
- feat(docs): update documentation for clarity and add 'Your First Contribution' guide


## [1.915] - 2026-02-02
- chore: update application version to 1.914 across all relevant files
- feat(audit): complete code audit focusing on error handling, performance, and duplication - Enhanced error handling with improved logging and context - Optimized DOM performance by reducing redundant queries and layout thrashing - Introduced DATA_SELECTORS for parameterized data-attribute queries to reduce duplication - Implemented TASK_OPTIONS_FORCE_HIDDEN class for consistent task options visibility management - Updated tests to reflect changes in task options visibility handling


## [1.914] - 2026-02-02
- Refactor initialization functions to use 'init' prefix for consistency


## [1.913] - 2026-02-02
- feat: conduct comprehensive code audit addressing memory leaks, async patterns, dead code, naming consistency, and security improvements


## [1.912] - 2026-02-02
- feat: enhance dependency injection and error handling strategies across modules


## [1.911] - 2026-02-02
- fix: update cycle API method name and add initialization for completed tasks section


## [1.910] - 2026-02-02
- feat(ui): add preferences background image module for upload, compression, and storage


## [1.908] - 2026-02-02
- feat: add default labels registry and modal registry for centralized UI management


## [1.907] - 2026-02-02
- feat: update version to 1.906 and reflect changes across documentation and files


## [1.906] - 2026-02-01
- fix: increase z-index for complete all button to improve visibility
- feat: update version to 1.905 and reflect changes in documentation and styles
- Refactor UI modules to utilize centralized DOM constants


## [1.905] - 2026-02-01
- feat: enforce required dependencies for action execution in Quick Actions Manager
- feat: update version to 1.904 and reflect changes across documentation and files


## [1.904] - 2026-02-01
- feat: add quick actions panel and related styles
- feat: add view switching methods for Quick Actions panel, including arrow buttons, swipe gestures, and state persistence
- feat: add Quick Actions panel design and implementation for desktop and mobile views
- feat: update documentation for .mcyc file import methods and security measures, enhance user manual with double-click functionality and drag-and-drop support


## [1.903] - 2026-02-01
- feat: update version to 1.902 across all relevant files and changelog
- feat: implement Quick Actions Panel (Phase 1) with 5 actions (Stats, Open Routine, Recurring, Reminders, Settings)
- feat: add quickActionsManager DI module with pinned/recent/frequent views, action picker modal, and action tracking
- feat: add responsive desktop panel (2-col/3-col/5-col breakpoints) and mobile menu row for quick actions
- fix: reposition slide arrows to screen edges to avoid panel overlap
- fix: bump task-view and stats-panel z-index to 3 for proper stacking above slide arrows
- fix: correct recurringPanel proxy path in moduleLoader (deps.recurring.panel, not deps.recurring.recurringPanel)


## [1.902] - 2026-02-01
- feat: add error handling for JSON parsing in backup and import processes, and sanitize task options and reminders
- feat: enhance overlay close behavior in RoutineSwitcher to prevent unintended closures


## [1.901] - 2026-02-01
- feat: adjust z-index for preview review modal and add overlay styling


## [1.900] - 2026-02-01
- feat: implement preview review modal for double-click popout in routine switcher


## [1.899] - 2026-02-01
- feat: add guard against reload loop during file import in launchQueue


## [1.898] - 2026-02-01
- feat: add PWA file handling for .mcyc files and implement preview popout on double-click


## [1.897] - 2026-02-01
- chore: update version to 1.896 across all relevant files and documentation
- feat: implement debug mode functions and cleanup for IndexedDB in backup and settings managers


## [1.896] - 2026-02-01
- chore: update version to 1.895 across all relevant files and documentation


## [1.895] - 2026-01-31
- feat: add destructive confirmation option for delete actions in modals and notifications
- feat: update task names and add deleteWhenComplete settings in example routines


## [1.894] - 2026-01-31
- feat: implement shared state mutation helpers for activating and deactivating recurring tasks


## [1.893] - 2026-01-31
- feat: update changelog and project stats for version 1.892
- fix: resolve state bug in recurring task removal by resetting deleteWhenComplete settings


## [1.892] - 2026-01-31
- feat: add comprehensive guide for making code changes and dependency management


## [1.891] - 2026-01-31
- feat: add refreshUIFromState functionality and deleteWhenComplete settings for recurring tasks


## [1.890] - 2026-01-31
- feat: enhance recurring settings with UI refresh and delete options


## [1.889] - 2026-01-31
- docs: update developer profile with recent changes and session history
- style: update button styles and add close button for reminders and recurring panels


## [1.888] - 2026-01-31
- chore: update app version to 1.887 and adjust related styles and scripts


## [1.887] - 2026-01-31
- chore: update version to 1.886 and adjust related documentation and files


## [1.886] - 2026-01-31
- chore: update version to 1.885 and adjust related documentation and files


## [1.885] - 2026-01-30
- fix: update documentation for consistency and accuracy across multiple files
- fix: update achievement detail text to use achievement name if available
- fix: use correct property names for badge detail modal thresholds
- fix: update developer profile with recent insights and iOS PWA safe area adjustments
- fix: document iOS PWA safe area detection and CSS adjustments for Dynamic Island compatibility
- fix: adjust header branding position for iOS PWA safe area compliance


## [1.884] - 2026-01-29
- fix: adjust iOS PWA header positioning and padding for better compatibility with Dynamic Island


## [1.883] - 2026-01-29
- fix: implement iOS PWA safe area detection and adjustments for header and menu


## [1.882] - 2026-01-29
- fix: adjust header positioning and padding for better compatibility with Dynamic Island and status bar


## [1.881] - 2026-01-29
- fix: improve iOS PWA safe area handling for menu and header to ensure proper clearance for Dynamic Island and notch


## [1.880] - 2026-01-29
- fix: adjust header positioning and padding for mobile and PWA safe area compliance


## [1.879] - 2026-01-29
- chore: update app version to 1.878 across all relevant files and documentation
- fix: center header branding vertically and horizontally, update padding for status bar compatibility


## [1.878] - 2026-01-29
- fix: enhance network-first caching strategy for modules with complex interdependencies


## [1.877] - 2026-01-29
- chore: update version to 1.876 and reflect changes across documentation and files reenables service worker caching


## [1.876] - 2026-01-29
- chore: update version to 1.875 and reflect changes across documentation and files


## [1.875] - 2026-01-27
- chore: update version to 1.874 and reflect changes across documentation and files


## [1.874] - 2026-01-27
- fix: add lazy loading for modeManager in taskOptionsCustomizer and improve dependency validation
- chore: update version to 1.873 and reflect changes in documentation and files


## [1.873] - 2026-01-27
- fix: disable audit mode for undeclared dependencies to reduce false positives


## [1.872] - 2026-01-26
- fix: enhance dependency auditing by refining declared dependencies and adding warning suppression


## [1.871] - 2026-01-26
- refactor: update MODULE_LOADER_ARCHITECTURE_FIX.md to reflect current architecture and resolved issues


## [1.870] - 2026-01-26
- feat: add Module Loader Architecture Fix plan to documentation
- Refactor documentation to align with zero-globals and strict DI architecture
- fix: update version to 1.868 in CHANGELOG and enhance project stats
- fix: update version to 1.869 across all relevant files and enhance version handling


## [1.869] - 2026-01-24
- fix: update version to 1.868 across all relevant files and enhance project stats


## [1.868] - 2026-01-24
- fix: update service worker to inline version constants and enhance version update logic
- fix: update version to 1.867 across all relevant files and enhance project stats


## [1.867] - 2026-01-22
- fix: add type check for initCycleImportManager function in loadSubModules
- fix: update version to 1.866 across all relevant files and enhance project stats


## [1.866] - 2026-01-22
- fix: update version to 1.865 across all relevant files and enhance project stats


## [1.865] - 2026-01-22
- fix: refactor cache-busting implementation in coreBoot to use withV function
- fix: update version to 1.864 across all relevant files and enhance project stats


## [1.864] - 2026-01-22
- fix: correct boot attempt variable for cache-busting version suffix in runBootSequence
- fix: update version to 1.863 across all relevant files and enhance project stats


## [1.863] - 2026-01-22
- fix: enhance versioning for cache-busting in coreBoot and orchestrator, update achievementsManager for dynamic milestones
- fix: update version to 1.862 across all relevant files and enhance project stats


## [1.862] - 2026-01-22
- fix: clear nested deps object properties to prevent stale references during retries
- fix: update version to 1.861 across all relevant files and enhance project stats


## [1.861] - 2026-01-22
- fix: dynamically load MILESTONES configuration in achievementsManager, statsPanel, and cycleCompletion to avoid ES module cache issues
- fix: update version to 1.860 across all relevant files and enhance project stats


## [1.860] - 2026-01-22
- fix: dynamically load MILESTONES configuration to avoid ES module cache issues
- fix: update version to 1.859 across all relevant files and enhance project stats


## [1.859] - 2026-01-22
- fix: implement appInit state reset on boot retry to prevent stale references
- fix: update version to 1.858 across all relevant files and enhance project stats


## [1.858] - 2026-01-22
- fix: implement dynamic imports with version cache-busting for various modules
- fix: update version to 1.857 across all relevant files and enhance project stats


## [1.857] - 2026-01-22
- fix: enhance network-first patterns in service worker for critical modules to prevent stale cache issues
- fix: update version to 1.856 across all relevant files and enhance project stats


## [1.856] - 2026-01-22
- fix: update version to 1.855 and clear module loader cache on retry
- fix: update version to 1.854 across all relevant files and enhance project stats


## [1.854] - 2026-01-22
- fix: reduce IndexedDB timeout to 500ms for faster boot and minimal delay in test recovery
- fix: update version to 1.853 across all relevant files and enhance project stats


## [1.853] - 2026-01-21
- fix: enhance dependency container reuse to preserve module state across boot retries
- fix: update version to 1.852 across all relevant files and enhance project stats


## [1.852] - 2026-01-21
- fix: reduce IndexedDB timeout to 1 second for faster fail on reload; reuse dependency container across boot retries
- fix: update version references to 1.851 across all relevant files and enhance project stats


## [1.851] - 2026-01-21
- fix: enhance IndexedDB handling with timeout and availability checks; adjust modal button sizes for mobile
- fix: update version references to 1.850 across all relevant files and enhance project stats


## [1.850] - 2026-01-20
- fix: update developer profile and project stats with new financial context and automated metrics
- fix: update version references to 2.05 across all relevant files
- fix: adjust task-view positioning for extra small and medium screens
- fix: update version references to 2.049 across all relevant files
- fix: adjust task-view positioning for extra small and medium screens
- fix: adjust task-view positioning for extra small and medium screens
- fix: update version references to 2.048 across all relevant files
- fix: enhance iPhone support with safe-area adjustments and refine task-view positioning
- fix: update developer profile with session history and insights from miniCycle Lite
- fix: update version references to 2.047 across all relevant files
- fix: update task-view positioning for better notch/dynamic island support on extra small screens
- fix: update version references to 2.046 across all relevant files
- fix: adjust stats panel vertical positioning for improved alignment
- fix: update version references to 2.045 across all relevant files
- fix: adjust stats panel vertical positioning for improved alignment on small screens
- fix: update version references to 2.044 across all relevant files
- fix: update version references to 2.043 across all relevant files
- fix: adjust stats panel vertical positioning for improved alignment
- fix: update version references to 2.042 across all relevant files
- fix: adjust task-view positioning and dimensions for better notch/dynamic island support on small screens
- fix: update version references to 2.041 across all relevant files
- fix: adjust task-view positioning for notch/dynamic island support on small screens
- fix: update version references to 2.04 across all relevant files
- fix: update redirect path and notification message in lite version
- chore: update app version to 1.849 across all relevant files


## [1.849] - 2026-01-19
- fix: update app name logo reference in HTML
- chore: update version to 2.039 across all relevant files
- fix: adjust header logo and app name sizes for mobile
- fix: adjust task view position for improved centering
- fix: adjust task view position for improved responsiveness
- feat: update version to 2.038 across all relevant files
- fix: adjust task view position for improved alignment
- fix: adjust task view position for improved layout
- feat: update version to 2.037 across all relevant files
- feat: update header logo and app name heights for improved visibility
- feat: update title in miniCycle-lite.html for clarity
- feat: update version to 2.036 across all relevant files
- feat: add miniCycle_name logo and adjust task view position in styles
- feat: update version to 2.035 across all relevant files
- feat: add miniCycle_lite logo and improve bulk operation handling in task management
- feat: update version to 2.034 across all relevant files
- feat: improve confirmation messages for task deletion and clearing
- feat: update version to 2.033 across all relevant files
- feat: update getting started section and enhance quick tips in showEmptyState function
- feat: update version to 2.032 across all relevant files
- feat: add menu icon logo to Try Full Version button and adjust styling
- feat: update version to 2.031 across all relevant files
- feat: improve layout and styling of stats panel and related components
- feat: update version to 2.03 across all relevant files
- feat: add reset statistics functionality and button in miniCycle Lite
- feat: update version to 2.029 across all relevant files
- feat: enhance accessibility with skip link and improve stats display layout
- feat: update version to 2.028 across all relevant files and adjust references
- feat: update statistics display by rearranging tasks cleared and cycles completed
- feat: update version to 2.027 across all relevant files and adjust references
- feat: add badges for tasks cleared milestones in To-Do mode
- feat: add tracking for tasks cleared in To-Do mode and update stats display
- feat: update version to 2.026 across all relevant files and adjust references
- fix: adjust task view position for improved layout
- feat: update version to 2.025 across all relevant files and adjust references
- feat: add mobile web app capabilities meta tags for improved compatibility
- feat: update version to 2.024 across all relevant files and adjust references
- fix: update Content-Security-Policy to include cdnjs.cloudflare.com in connect-src for enhanced security
- feat: update version to 2.023 across all relevant files and adjust references
- fix: update background opacity for high-priority tasks in dark mode for improved visibility
- feat: update version to 2.022 across all relevant files and adjust references
- fix: update background color for high-priority tasks in dark mode for better visibility
- feat: update version to 2.021 across all relevant files and adjust references
- fix: adjust task options button positioning to avoid clipping and improve visibility
- feat: update version to 2.02 across all relevant files and adjust references
- fix: add z-index and position to task hover effect for proper stacking
- feat: update version to 2.019 across all relevant files and adjust references
- fix: add z-index to high-priority task in dark mode for proper stacking
- feat: update version to 2.018 across all relevant files and adjust references
- fix: remove z-index from complete all button to prevent options menu overlap
- feat: update version to 2.017 across all relevant files and adjust references
- fix: adjust z-index for input focus styles in dark mode
- feat: update version to 2.016 across all relevant files and adjust references
- fix: add z-index to input focus styles in dark mode
- feat: update version to 2.015 across all relevant files and adjust references
- fix: add z-index to input focus styles in dark mode
- feat: update version to 2.014 across all relevant files and adjust references
- fix: remove unnecessary !important from z-index in dark mode styles
- feat: update version to 2.013 across all relevant files and adjust references
- feat: adjust progress bar width for improved layout
- feat: update version to 2.012 across all relevant files and adjust references
- feat: adjust max-height for task view on smaller screens for improved performance
- feat: update version to 2.011 across all relevant files and adjust references
- feat: adjust responsive design for help window container on smaller screens
- feat: update version to 2.01 across all relevant files and adjust references
- feat: adjust task view position for better layout on extra small screens
- feat: update version to 2.009 across all relevant files and adjust references
- feat: update Content Security Policy to include cdnjs.cloudflare.com for Font Awesome support
- feat: update version to 2.008 across all relevant files and adjust references
- feat: update button hover states to solid backgrounds for improved visibility
- feat: update version to 2.007 across all relevant files and adjust references
- feat: add localStorage support for celebrated badges and update badge tracking logic
- feat: update version to 2.006 across all relevant files and adjust references
- feat: update button hover states for better emoji visibility in dark mode
- feat: update version to 2.005 across all relevant files and adjust references
- feat: refine high-priority task styling and enhance button contrast for better visibility
- feat: update version to 2.004 across all relevant files and adjust references
- feat: add priority indicator for high-priority tasks with styling and fallback support
- feat: update version to 2.003 across all relevant files and adjust references
- feat: update version to 2.002 across all relevant files and adjust references
- feat: enhance lite version auto-bump to increment by 0.001 with proper formatting
- feat: update version to 2.001 across all relevant files and adjust references
- feat: add support for updating lite CSS files in version updater script
- feat: update version to 2.1 across all relevant files
- feat: update version to 2.0 and adjust copyright year to 2026 across files
- feat: adjust task view position and max-height for improved layout
- feat: update app version to 1.848 and adjust related references across files


## [1.848] - 2026-01-19
- feat: adjust task view position and spacing for improved layout
- feat: adjust positioning and sizing of tasks added count in dark mode
- feat: update app version to 1.847 and adjust related references across files
- feat: adjust position of tasks added count in dark mode


## [1.847] - 2026-01-19
- feat: increase max-height for improved performance on task view and container
- feat: reduce max-height for improved performance on task view and container
- feat: increase max-height for improved performance on task view and container
- feat: adjust max-height for better performance on task view and container
- feat: adjust bottom position of tasks added count in dark mode
- feat: remove mobile responsive centering styles for task list and tasks
- feat: update versioning script to include --lite-only flag for independent lite version updates
- feat: adjust notification position in dark mode for improved visibility
- feat: update app version to 1.846 and adjust related references across files


## [1.846] - 2026-01-19
- feat: add safe area insets for notched devices in body and complete all button styles
- feat: increase minimum height for complete all button and help window for improved usability
- feat: update app version to 1.845 and adjust related references across files


## [1.845] - 2026-01-19
- feat: reposition notifications in dark mode for better visibility
- feat: update app version to 1.844 and adjust related references across files


## [1.844] - 2026-01-19
- feat: reduce minimum height for complete all button and help window in default theme
- feat: update notification system to use mc-toast and remove legacy lite-toast styles
- feat: update app version to 1.843 and adjust related references across files


## [1.843] - 2026-01-19
- feat: adjust padding for complete all button in default theme
- feat: update app version to 1.842 across documentation, manifest, and styles


## [1.842] - 2026-01-19
- feat: update feedback form action to Web3Forms and add hidden fields for access key and subject
- feat: update app version to 1.841 across documentation, manifest, and styles


## [1.841] - 2026-01-19
- feat: adjust button padding in dark mode for improved layout
- feat: update app version to 1.840 across documentation, manifest, and styles
- feat: update button background color in dark mode


## [1.840] - 2026-01-19
- feat: update app version to 1.839 across documentation, manifest, and styles


## [1.839] - 2026-01-19
- feat: implement reload cooldown to prevent perpetual reload loops in service worker
- feat: update app version to 1.838 across documentation, manifest, and styles


## [1.838] - 2026-01-19
- feat: save undo state before changing task priority and completion
- feat: update app version to 1.837 across documentation, manifest, and styles


## [1.837] - 2026-01-19
- feat: implement lite toast notifications and enhance styles for better visibility
- feat: update app version to 1.836 across documentation, manifest, and styles


## [1.836] - 2026-01-19
- feat: enhance task state management and update undo/redo button styles
- feat: update app version to 1.835 across documentation, manifest, and styles


## [1.835] - 2026-01-19
- feat: add feedback modal for user suggestions and bug reports
- feat: update app version to 1.834 across documentation, manifest, and styles
- feat: enhance mouse drag support and adjust styles for improved UI responsiveness


## [1.834] - 2026-01-18
- feat: update app version to 1.833 across documentation, manifest, and styles


## [1.833] - 2026-01-18
- feat: add screen reader support and toast/modal styles for improved accessibility and user notifications
- feat: update app version to 1.832 across documentation, manifest, and styles


## [1.832] - 2026-01-18
- feat: adjust styles for complete all button and quick help toggle for improved usability
- feat: update app version to 1.831 across documentation, manifest, and styles


## [1.831] - 2026-01-18
- feat: enhance layout and styling of stats panel and task container for improved usability
- feat: update app version to 1.830 across documentation, manifest, and styles


## [1.830] - 2026-01-18
- feat: update add task button styles for a more understated appearance and adjust toast position
- feat: update app version to 1.829 across documentation, manifest, and styles


## [1.829] - 2026-01-18
- feat: enhance task view and modal styles for improved usability
- feat: update app version to 1.828 across documentation, manifest, and styles
- feat: replace save function with autoSave in task modal and update button styles for better visibility


## [1.828] - 2026-01-18
- feat: update app version to 1.827 across documentation, manifest, and styles
- feat: implement add task modal system and enhance task management features


## [1.827] - 2026-01-18
- feat: update app version to 1.826 across documentation, manifest, and styles


## [1.826] - 2026-01-18
- feat: update documentation for version 2.1, including new features and improvements
- feat: update app version to 1.825 across documentation, manifest, and styles


## [1.825] - 2026-01-18
- feat: update documentation for version 1.811, including new features and improvements
- feat: update app version to 1.824 across documentation, manifest, and styles


## [1.824] - 2026-01-18
- feat: update preview section background color in preferences manager
- feat: update app version to 1.823 across documentation, manifest, and styles


## [1.823] - 2026-01-18
- feat: update mini-modal button background to a gradient and improve text color for better visibility
- feat: update app version to 1.822 across documentation, manifest, and styles
- feat: update mini-modal button background to use a gradient for improved aesthetics


## [1.822] - 2026-01-18
- feat: update app version to 1.821 across documentation, manifest, and styles


## [1.821] - 2026-01-18
- feat: update personalization button icon for improved visual clarity
- feat: update CHANGELOG for version 1.820 with new features and improvements
- feat: update app version to 1.820 across documentation, manifest, and styles


## [1.820] - 2026-01-18
- feat: reposition and style personalization button for improved accessibility
- feat: update app version to 1.819 across documentation, manifest, and styles


## [1.819] - 2026-01-18
- feat: add personalization button for quick access to color customization
- feat: enhance dark mode button styles for improved aesthetics and visibility
- feat: update app version to 1.818 across documentation, manifest, and styles


## [1.818] - 2026-01-18
- feat: update dark mode button styles for improved visibility


## [1.817] - 2026-01-18
- feat: update app version to 1.816 across documentation, manifest, and styles


## [1.816] - 2026-01-18
- feat: add message display for cleared tasks in help window


## [1.815] - 2026-01-18
- feat: update app version to 1.814 across documentation, manifest, and styles


## [1.814] - 2026-01-18
- feat: update background color for loading screen and adjust iOS status bar color handling
- feat: update app version to 1.813 across documentation, manifest, and styles


## [1.813] - 2026-01-18
- feat: update body background color for iOS black-translucent status bar compatibility
- feat: update app version to 1.812 across documentation, manifest, and styles


## [1.812] - 2026-01-18
- feat: update status bar style to black-translucent and adjust theme color for improved visibility
- feat: update app version to 1.811 across documentation, manifest, and styles
- feat: update status bar style to solid black for improved visibility on iOS


## [1.811] - 2026-01-18
- feat: update app version to 1.810 across documentation, manifest, and styles


## [1.810] - 2026-01-18
- feat: update theme color management for improved status bar visibility and customization
- feat: update app version to 1.809 across documentation, manifest, and styles


## [1.809] - 2026-01-18
- feat: enhance color selection logic in PreferencesManager for improved customization
- feat: update app version to 1.808 across documentation, manifest, and styles


## [1.808] - 2026-01-18
- feat: update status bar style for iOS and ensure app background color is applied
- feat: update app version to 1.807 across documentation, manifest, and styles


## [1.807] - 2026-01-18
- feat: update status bar style to match theme color for improved iOS appearance
- feat: update app version to 1.806 across documentation, manifest, and styles


## [1.806] - 2026-01-18
- feat: initialize theme color on startup and update for default theme
- feat: update app version to 1.805 across documentation, manifest, and styles
- feat: enhance theme color management in PreferencesManager for better responsiveness


## [1.805] - 2026-01-18
- feat: update app version to 1.804 across documentation, manifest, and styles


## [1.804] - 2026-01-18
- feat: add new landscape images and enhance help window layout for better responsiveness
- feat: update app version to 1.803 across documentation, manifest, and styles


## [1.803] - 2026-01-18
- feat: enhance dark mode handling and update background gradient opacity
- feat: update app version to 1.802 across documentation, manifest, and styles
- feat: update CHANGELOG for version 1.802 with new features and app version updates


## [1.802] - 2026-01-18
- feat: add pattern color customization and update background handling in preferences
- feat: update app version to 1.801 across documentation, manifest, and styles


## [1.801] - 2026-01-18
- feat: add background image visibility toggle in preferences
- feat: update app version to 1.800 across documentation, manifest, and styles


## [1.800] - 2026-01-18
- feat: enhance progress bar styling and adjust z-index for stats panel button
- feat: update app version to 1.799 across documentation, manifest, and styles


## [1.799] - 2026-01-18
- feat: update background image hint to clarify automatic compression for images over 2MB
- feat: update app version to 1.798 across documentation, manifest, and styles


## [1.798] - 2026-01-18
- feat: add undo cache size tracking and integrate into routine size calculations
- feat: update app version to 1.797 across documentation, manifest, and styles


## [1.797] - 2026-01-18
- feat: add image validation and compression functionality for background uploads


## [1.796] - 2026-01-18
- feat: update app version to 1.795 across documentation, manifest, and styles
- fix: adjust header padding for improved layout and safe area handling


## [1.795] - 2026-01-18
- feat: update app version to 1.794 across documentation, manifest, and styles


## [1.794] - 2026-01-18
- fix: adjust header padding for improved safe area handling
- feat: update app version to 1.793 across documentation, manifest, and styles


## [1.793] - 2026-01-18
- fix: update background SVG opacity for improved visibility
- feat: update app version to 1.792 across documentation, manifest, and styles


## [1.792] - 2026-01-18
- fix: revert app version to 1.790 and update header styles for improved layout
- feat: update app version to 1.791 across documentation, manifest, and styles
- refactor: remove automated tests tab fix script and related references


## [1.791] - 2026-01-18
- feat: update app version to 1.790 across documentation, manifest, and styles


## [1.790] - 2026-01-18
- refactor: update logging for state synchronization and mode initialization in ModeManager
- feat: update app version to 1.789 across documentation, manifest, and styles


## [1.789] - 2026-01-17
- feat: implement self-hosted Poppins font and update security policies
- feat: update app version to 1.788 across documentation, manifest, and styles


## [1.788] - 2026-01-17
- feat: update loader bar animation to use scale transform for smoother transitions
- feat: update app version to 1.787 across documentation, manifest, and styles


## [1.787] - 2026-01-17
- feat: enhance core readiness check before task loading in appInit


## [1.786] - 2026-01-17
- feat: update app version to 1.785 across documentation, manifest, and styles


## [1.785] - 2026-01-17
- feat: update initialSetup calls to await for proper async handling in migrationManager and appInit
- feat: update app version to 1.784 across documentation, manifest, and styles


## [1.784] - 2026-01-17
- feat: improve recurring indicator alignment and styling for task text
- feat: add recurring indicator styles for mobile alignment
- feat: update app version to 1.783 across documentation, manifest, and styles
- feat: adjust recurring task styles for better alignment and spacing


## [1.783] - 2026-01-17
- feat: update app version to 1.782 across documentation, manifest, and styles


## [1.782] - 2026-01-17
- feat: enhance loading feedback during orchestrator startup
- feat: update app version to 1.781 across documentation, manifest, and styles


## [1.781] - 2026-01-17
- feat: implement app loading state to prevent CLS during boot
- feat: update app version to 1.780 across documentation, manifest, and styles


## [1.780] - 2026-01-17
- feat: refactor display handling for onboarding and completed tasks sections
- feat: add critical CSS for onboarding state to prevent CLS
- feat: update app version to 1.779 across documentation, manifest, and styles


## [1.779] - 2026-01-17
- feat: adjust max-height values in task list and task view to improve layout
- feat: update app version to 1.778 across documentation, manifest, and styles


## [1.778] - 2026-01-17
- feat: adjust max-height of task list to improve layout and prevent CLS
- feat: implement visibility:hidden for task input to reserve space and prevent CLS
- feat: update app version to 1.777 across documentation, manifest, and styles


## [1.777] - 2026-01-17
- feat: reserve space in task list and title to prevent CLS during data loading
- feat: update app version to 1.776 across documentation, manifest, and styles


## [1.776] - 2026-01-17
- feat: update link text from 'Learn More' to 'About miniCycle' for clarity
- feat: update app version to 1.775 across documentation, manifest, and styles


## [1.775] - 2026-01-17
- feat: update font family to Poppins and add fixed header styles
- feat: update app version to 1.774 across documentation, manifest, and styles


## [1.774] - 2026-01-17
- chore: clean up empty code change sections in the changes log
- feat: update app version to 1.773 across documentation, manifest, and styles


## [1.773] - 2026-01-17
- chore: update last updated dates and version references across documentation
- feat: update app version to 1.772 across documentation, manifest, and styles
- refactor: replace document-level event handlers with instance methods in DragDropManager and HelpWindowManager


## [1.772] - 2026-01-17
- feat: expand developer profile with insights on strategic depth, micro-patience, and internal tools
- feat: update app version to 1.771 across documentation, manifest, and styles


## [1.771] - 2026-01-17
- feat: add documentation for Background Pattern system and update index
- feat: update app version to 1.770 across documentation, manifest, and styles


## [1.770] - 2026-01-17
- feat: add media query for delayed arrow visibility on desktop
- feat: update app version to 1.769 across documentation, manifest, and styles


## [1.769] - 2026-01-17
- feat: enhance UI elements with improved background styles and transitions
- feat: update app version to 1.768 across documentation, manifest, and styles


## [1.768] - 2026-01-17
- feat: implement background personalization features including image upload and pattern toggle
- feat: add routine_list image asset for enhanced UI
- feat: update app version to 1.767 across documentation, manifest, and styles


## [1.768] - 2026-01-17
- feat: add background pattern toggle in personalization modal
- feat: add custom background image upload with IndexedDB storage (max 2MB)
- feat: add background image display modes (cover, center, tile)
- feat: add image preview and remove functionality in personalization
- docs: update USER_GUIDE.md with background pattern and image documentation
- docs: update FEATURE_LIST.md with new background personalization features
- docs: update QUICK_REFERENCE.md with background personalization code examples
- docs: update FAQ.md with customization and background image questions
- docs: update STORAGE_MANAGEMENT.md with IndexedDB usage documentation


## [1.767] - 2026-01-17
- feat: update help window styles for improved visibility and aesthetics
- feat: update CHANGELOG for version 1.766 with new features and improvements
- feat: update app version to 1.766 across documentation, manifest, and styles


## [1.766] - 2026-01-17
- feat: add triggerLogoScan functionality and enhance logo effects for task clearing
- feat: increase max-width for mode selector to improve usability
- feat: update version to 1.765 and reflect changes in documentation, manifest, and styles


## [1.765] - 2026-01-17
- feat: enhance theme presets and update milestone progress text for clarity
- feat: update version to 1.764 and reflect changes in documentation, manifest, and styles


## [1.764] - 2026-01-17
- feat: update copyright year to 2026 across all relevant files
- feat: update version to 1.763 and reflect changes in documentation, manifest, and styles
- feat: update title bar styles for mobile to remove background and box shadow


## [1.763] - 2026-01-17
- feat: update version to 1.762 and reflect changes in documentation, manifest, and styles
- feat: adjust mode selector styles for improved accessibility on smaller screens


## [1.762] - 2026-01-17
- feat: update version to 1.761 and reflect changes in documentation, manifest, and styles


## [1.761] - 2026-01-17
- feat: update version to 1.760 and reflect changes in documentation, manifest, and styles


## [1.760] - 2026-01-17
- feat: enhance preferences preview section styling for better visibility and layout
- feat: update version to 1.759 and reflect changes in documentation, manifest, and styles


## [1.759] - 2026-01-17
- feat: implement load and save functionality for collapsed section states in preferences manager
- feat: update version to 1.758 and reflect changes in documentation, manifest, and styles


## [1.758] - 2026-01-17
- feat: increase MAX_DYNAMIC_ENTRIES to 300 and implement debounced cache trimming
- feat: update version to 1.757 and reflect changes in documentation, manifest, and styles


## [1.757] - 2026-01-17
- feat: add waitForServiceWorker function to ensure service worker readiness before module imports
- feat: update version to 1.756 and reflect changes in documentation, manifest, and styles


## [1.756] - 2026-01-17
- feat: remove temporary network-only fetch logic for JS files to improve caching strategy
- feat: update version to 1.755 and reflect changes in documentation, manifest, and styles


## [1.755] - 2026-01-16
- feat: improve task input styling for better layout and responsiveness
- feat: update version to 1.754 and reflect changes in documentation, manifest, and styles


## [1.754] - 2026-01-16
- feat: implement version verification for service worker updates to address caching issues in iOS PWAs
- feat: update version to 1.753 and reflect changes in documentation, manifest, and styles


## [1.753] - 2026-01-16
- feat: implement temporary network-only fetch strategy for JS files to address Safari caching issues
- feat: update version to 1.752 and reflect changes in documentation, manifest, and styles


## [1.752] - 2026-01-16
- feat: temporarily disable modulepreload due to duplicate instance issue with versioned URLs
- feat: update version to 1.751 and reflect changes in documentation, manifest, and styles


## [1.751] - 2026-01-16
- feat: enhance loadDependencies function with error handling and logging for module imports
- feat: update version to 1.750 and reflect changes in documentation, manifest, and styles


## [1.750] - 2026-01-16
- feat: implement dynamic imports with version parameters to resolve Safari memory cache issues
- feat: update version to 1.749 and reflect changes in documentation, manifest, and styles


## [1.749] - 2026-01-16
- feat: update caching headers for JavaScript files to improve Safari compatibility
- feat: update version to 1.748 and reflect changes in documentation, manifest, and styles


## [1.748] - 2026-01-16
- feat: implement Safari cache prevention measures in headers and clean up cache-buster URL
- feat: update version to 1.747 and reflect changes in documentation, manifest, and styles


## [1.747] - 2026-01-16
- feat: implement automatic cache clearing on version change to prevent stale content
- feat: update version to 1.746 and reflect changes in documentation, manifest, and styles


## [1.746] - 2026-01-16
- feat: add automatic cache integrity check to clear stale browser cache


## [1.745] - 2026-01-16
- feat: update version to 1.744 and reflect changes in documentation, manifest, and styles


## [1.744] - 2026-01-16
- feat: add Cache-Control headers for JavaScript modules to ensure revalidation
- feat: update version to 1.743 and reflect changes in documentation, manifest, and styles


## [1.743] - 2026-01-16
- feat: improve error handling for offline module loading in service worker
- feat: update version to 1.742 and reflect changes in documentation, manifest, and styles


## [1.742] - 2026-01-16
- feat: enhance service worker version mismatch detection and logging
- feat: update version to 1.741 and reflect changes in documentation, manifest, and styles


## [1.741] - 2026-01-16
- feat: update constants module import to include versioning for cache busting
- feat: update version to 1.740 and reflect changes in documentation, manifest, and styles


## [1.740] - 2026-01-16
- feat: enhance version mismatch detection and optimize network-first strategy for static imports
- feat: update version to 1.739 and reflect changes in documentation, manifest, and styles


## [1.739] - 2026-01-16
- feat: enhance service worker with version mismatch detection and optimize network-first strategy
- feat: update version to 1.738 and reflect changes in documentation, manifest, and styles


## [1.738] - 2026-01-16
- feat: update version to 1.737 and reflect changes in documentation, manifest, and styles
- feat: update version to 1.736 and reflect changes in documentation, manifest, and styles
- feat: enhance service worker with iOS optimizations and fetch timeout handling


## [1.737] - 2026-01-16
- feat: update version to 1.736 and reflect changes in documentation, manifest, and styles
- feat: enhance service worker with iOS optimizations and fetch timeout handling


## [1.736] - 2026-01-16
- feat: update version to 1.735 and reflect changes in documentation, manifest, and styles


## [1.735] - 2026-01-16
- feat: enhance boot-critical files for improved offline functionality
- feat: update version to 1.734 and reflect changes in documentation, manifest, and styles


## [1.734] - 2026-01-15
- feat: update version to 1.733 and reflect changes in documentation, manifest, and styles


## [1.733] - 2026-01-15
- feat: enhance service worker with additional boot-critical and CSS files for offline support
- feat: update version to 1.732 and enhance related documentation and scripts


## [1.730] - 2026-01-15
- feat: Enhance documentation and metrics tracking
- Update documentation and module statistics for miniCycle version 1.729
- feat: add Contextual Theme System plan and update documentation
- feat: update version to 1.729 and modify changelog for new features
- feat: update version display logic to use globalThis.APP_VERSION for consistency
- Updated App Settings Group Description


## [1.729] - 2026-01-14
- feat: update documentation for version 1.684+, add personalization section, and enhance feature list
- feat: update version to 1.728 and modify changelog for new features


## [1.728] - 2026-01-13
- feat: enhance pull-to-refresh functionality and improve modal styles for better user experience
- feat: update version to 1.727 and modify changelog for new features


## [1.727] - 2026-01-13
- feat: implement collapsible sections in settings UI and enhance styles for better usability
- feat: update version to 1.726 and modify changelog for new features


## [1.726] - 2026-01-13
- feat: update Manual Cycle Mode emoji representation across documentation and UI
- feat: update version to 1.725 and modify changelog for new features
- feat: improve button styles and layout for better user experience


## [1.725] - 2026-01-13
- feat: update version to 1.724 and modify changelog for new features


## [1.724] - 2026-01-13
- feat: update preferences modal for improved responsiveness and rename sections
- feat: enhance task actions menu and reorganize app settings section


## [1.723] - 2026-01-13
- feat: update version to 1.722 and modify changelog for new features


## [1.722] - 2026-01-13
- feat: Add custom preference colors for various components in the default theme
- feat: update version to 1.721 and modify changelog for new features


## [1.721] - 2026-01-12
- feat: add preferences modal for task list color customization
- feat: implement CSS variables for menu styles and add dark mode support
- feat: update version to 1.720 across changelog, manifest, HTML, CSS, and JS files


## [1.720] - 2026-01-12
- feat: add collapsible mode description toggle with persistence
- feat: update version to 1.719 across changelog, manifest, HTML, CSS, and JS files
- feat: add staggered animations for task reset and clear actions


## [1.719] - 2026-01-12
- feat: update version to 1.718 across changelog, manifest, HTML, CSS, and JS files


## [1.718] - 2026-01-12
- feat: reorganize menu layout into sections and add recurring task management features
- feat: update version to 1.717 across changelog, manifest, HTML, CSS, and JS files
- feat: enhance about modal design and update mode descriptions for clarity


## [1.717] - 2026-01-12
- feat: update version to 1.716 across changelog, manifest, HTML, CSS, and JS files


## [1.716] - 2026-01-12
- refactor: simplify undo/redo button handling and remove completed task styles
- feat: update version to 1.715 across changelog, manifest, HTML, CSS, and JS files


## [1.715] - 2026-01-12
- feat: replace Font Awesome with inline SVG icons and update styles for better performance and consistency
- feat: update version to 1.714 across changelog, manifest, HTML, CSS, and JS files


## [1.714] - 2026-01-12
- Refactor icon styles and task button appearance
- feat: update version to 1.713 across changelog, manifest, HTML, CSS, and JS files


## [1.713] - 2026-01-11
- feat: enhance task button styles for better icon alignment and responsiveness
- feat: update version to 1.712 across changelog, manifest, HTML, CSS, and JS files


## [1.712] - 2026-01-11
- feat: Replace Font Awesome icons with inline SVGs for improved performance
- feat: update version to 1.711 across changelog, manifest, HTML, CSS, and JS files


## [1.711] - 2026-01-11
- feat: add iPhone-specific adjustments for task card margin
- feat: update version to 1.710 across changelog, manifest, HTML, CSS, and JS files


## [1.710] - 2026-01-11
- feat: update theme color for consistency and add mobile adjustments for task input
- feat: update version to 1.709 across changelog, manifest, HTML, CSS, and JS files
- feat: update service worker to use network-first for CSS, ensuring fresh styles for iOS PWA


## [1.709] - 2026-01-11
- feat: update version to 1.708 across changelog, manifest, HTML, CSS, and JS files


## [1.708] - 2026-01-11
- feat: update CSS @import statements to include versioning parameters
- feat: add '/styles/' to NETWORK_FIRST_PATTERNS for fresh CSS imports
- feat: update version to 1.707 across changelog, manifest, HTML, and version files


## [1.707] - 2026-01-11
- feat: adjust mobile header breakpoint to 868px and update styles
- feat: update version to 1.706 across changelog, manifest, HTML, and version files


## [1.706] - 2026-01-11
- feat: adjust margin-top for fixed header in responsive layouts
- feat: update version to 1.705 across changelog, manifest, HTML, and version files


## [1.705] - 2026-01-11
- feat: update cache version to 499, adjust header margin, and clean up stats panel preference handling
- feat: update version to 1.704 across changelog, manifest, HTML, and version files


## [1.704] - 2026-01-11
- feat: refactor styles across components, consolidate onboarding and modal styles, and enhance task input layout
- feat: update version to 1.703 across changelog, manifest, HTML, and version files


## [1.703] - 2026-01-10
- feat: update version to 1.702 across changelog, manifest, HTML, and version files


## [1.702] - 2026-01-10
- feat: refine CSS loading strategy and update boot-critical files in service worker
- feat: update version to 1.701 across changelog, manifest, HTML, and version files
- feat: preload critical CSS files and refine network-first strategy in service worker


## [1.701] - 2026-01-10
- feat: update version to 1.700 across changelog, manifest, HTML, and version files


## [1.700] - 2026-01-10
- feat: implement network-first strategy for boot-critical files in service worker
- feat: update version to 1.699 across changelog, manifest, HTML, and service worker


## [1.699] - 2026-01-10
- feat: update changelog for version 1.698 with loader bar width adjustment and cache validation improvements
- feat: update version to 1.698 across manifest, HTML, and version files


## [1.698] - 2026-01-10
- feat: update loader bar width and improve cache response validation in service worker
- feat: update version to 1.696 in manifest, HTML, and version files


## [1.697] - 2026-01-10
- feat: update version to 1.695 and reflect changes in changelog, manifest, HTML, and version files


## [1.695] - 2026-01-10
- feat: enhance service worker with navigation preload and improved caching strategies
- feat: restructure header for cleaner architecture and improve visual polish
- feat: update version to 1.694 and reflect changes in changelog, manifest, HTML, and version files


## [1.694] - 2026-01-10
- feat: update version to 1.693 and reflect changes in changelog, manifest, HTML, and version files


## [1.693] - 2026-01-09
- feat: Add dark mode support and responsive utilities
- feat: integrate CSS variables for theme management and update theme application logic
- feat: add theme management system with multiple themes and CSS variable integration
- feat: enhance theme documentation with Theme Architecture and Theme Creation Guide
- Add CSS Refactor Plan document outlining phased approach for miniCycle styles
- feat: add Service Worker Optimization Plan to improve PWA performance and caching strategy
- feat: update version to 1.692 and reflect changes in changelog, manifest, HTML, and version files


## [1.692] - 2026-01-09
- feat: implement network-first strategy for JS/CSS with offline fallback in service worker
- feat: update version to 1.691 and reflect changes in changelog, manifest, HTML, and version files


## [1.691] - 2026-01-09
- feat: update manifest and service worker for improved file paths and caching strategy


## [1.690] - 2026-01-09
- feat: update version to 1.689 and reflect changes in changelog, manifest, HTML, and version files


## [1.689] - 2026-01-09
- feat: enhance task recreation logic to retain historical records in cleared tasks
- feat: update version to 1.688 and reflect changes in changelog, manifest, and HTML files


## [1.688] - 2026-01-08
- feat: add extra bottom padding to button styles for better spacing with undo buttons
- feat: update schema documentation to reflect new stats panel and cleared tasks tracking
- feat: update version to 1.687 and enhance changelog with new features


## [1.687] - 2026-01-07
- feat: implement Gesture Panel Manager for multi-platform input handling


## [1.686] - 2026-01-07
- feat: Update UI design to use buttons for modals instead of inline sections and document architecture details
- feat: Add implementation tracker for History, Cleared Tasks, and Achievement System
- feat: Rename Archived Tasks to Cleared Tasks and update related documentation
- feat: Update version to 1.685 and enhance changelog with new features


## [1.685] - 2026-01-05
- feat: Add History, Archived Tasks, and Achievement System Plan documentation
- feat: Update schema documentation to version 1.684 with enhanced metadata and structure


## [1.684] - 2026-01-05
- feat: Enhance storage management with estimated tracking and UI updates


## [1.683] - 2026-01-05
- feat: Update version to 1.682 and enhance changelog with new features


## [1.682] - 2026-01-05
- feat: Enhance inline editing for renaming miniCycles and update styles for better user interaction


## [1.681] - 2026-01-05
- feat: Update version to 1.680 and enhance changelog with new features


## [1.680] - 2026-01-05
- feat: Update routine modes with emoji indicators and enhance user interface elements
- feat: Enhance routine management with sorting and filtering controls, update developer profile, and add new assets


## [1.679] - 2026-01-05
- feat: Update version to 1.678 and enhance changelog with new features


## [1.678] - 2026-01-05
- feat(undoRedo): Implement localStorage caching for undo/redo stacks
- feat: Add lazy loading flags for undo/redo tests


## [1.677] - 2026-01-05
- feat: Bump version to 1.676 and implement lazy loading for undo history


## [1.676] - 2026-01-05
- feat: Update developer profile to emphasize craft over revenue and highlight project evolution
- feat: Bump version to 1.675 and enhance interrupted test recovery process


## [1.675] - 2026-01-04
- feat: Update documentation and implement interrupted test recovery


## [1.674] - 2026-01-04
- feat: Enhance routine management and testing framework


## [1.673] - 2026-01-04
- feat: Bump version to 1.672 and update related files


## [1.672] - 2026-01-04
- feat: Implement localStorage backup and restoration for interrupted tests
- feat: Add interactive localStorage viewer and enhance testing modal UI


## [1.671] - 2026-01-04
- feat: add results area resize functionality and save height to AppState


## [1.670] - 2026-01-04
- fix: update initial visibility state for task input during onboarding


## [1.669] - 2026-01-04
- feat: update onboarding placeholder text and enhance task area visibility during onboarding


## [1.668] - 2026-01-04
- chore: update version to 1.667 in manifest, HTML, package, and version files
- feat: implement onboarding placeholder and hide task area during onboarding


## [1.667] - 2026-01-04
- chore: update version to 1.666 in changelog, manifest, HTML, and version files


## [1.666] - 2026-01-04
- feat: remove ModuleLoader toggle from testing modal and update dependencies for notifications
- chore: update version to 1.665 in changelog, manifest, HTML, and version files; adjust backupManager loading in module manifests


## [1.665] - 2026-01-04
- feat: add lazy resolution for backupManager in module dependencies
- feat: add structuredClone polyfill for Safari and implement multi-tab sync in state management


## [1.664] - 2026-01-04
- feat: update backupManager references to use consistent casing in testing modal
- chore: update version to 1.663 in changelog, manifest, HTML, and version files


## [1.663] - 2026-01-04
- feat: implement session and test backup functionality with retention policies
- chore: update version to 1.662 in changelog, manifest, HTML, and version files


## [1.662] - 2026-01-03
- feat: add 'miniCycle_backups' to IndexedDB cleanup for test isolation
- feat: add visibility cleanup for drag state and improve warning handling for missing dependencies


## [1.661] - 2026-01-03
- chore: update version to 1.660 in manifest, HTML, and version files; adjust iframe dimensions in testing modal
- chore: update version to 1.660 in changelog, manifest, HTML, and version files; add timeout handling in module tests


## [1.660] - 2026-01-03
- chore: update version to 1.659 in changelog, manifest, HTML, and version files; add timeout handling in module tests


## [1.659] - 2026-01-03
- chore: update version to 1.658 in changelog, manifest, HTML, and version files; add timeout handling in IndexedDB functions


## [1.658] - 2026-01-03
- feat: implement cache busting for dynamic imports in test files


## [1.657] - 2026-01-03
- chore: update version to 1.656 in changelog, manifest, HTML, and version files


## [1.656] - 2026-01-03
- feat: clear localStorage before tests for a clean environment
- feat: implement dynamic imports for appState module with cache busting


## [1.655] - 2026-01-03
- chore: update version to 1.654 in changelog, manifest, HTML, and version files
- feat: implement dynamic imports with cache busting in test files


## [1.654] - 2026-01-03
- chore: update version to 1.653 in manifest, HTML, package, and version files
- feat: implement cache-busting for dynamic imports in recurring panel tests


## [1.653] - 2026-01-03
- chore: update version to 1.652 in changelog, manifest, HTML, and version files


## [1.652] - 2026-01-03
- fix: update X-Frame-Options header to SAMEORIGIN for improved security
- chore: update version to 1.651 in changelog, manifest, HTML, and version files


## [1.651] - 2026-01-03
- feat: Update testing modal and data analysis functions


## [1.650] - 2026-01-03
- chore: update version to 1.649 in changelog, manifest, HTML, and version files


## [1.649] - 2026-01-02
- refactor: update notification formatting to use new line characters for better readability
- chore: update version to 1.648 in changelog, manifest, HTML, and version files


## [1.648] - 2026-01-02
- feat: add showTaskInput setting and update task input visibility logic
- chore: update version to 1.647 in changelog, manifest, HTML, and version files


## [1.647] - 2026-01-02
- Refactor TaskDOMManager: Extract DOM patching logic to TaskDOMPatch module
- chore: update version to 1.646 in changelog, manifest, HTML, and version files


## [1.646] - 2026-01-02
- refactor: enhance module documentation with detailed features and versioning
- chore: update version to 1.645 in changelog, manifest, HTML, and version files


## [1.645] - 2026-01-02
- refactor: update module documentation and improve clarity across core and feature modules
- chore: update version to 1.644 in changelog, manifest, HTML, and version files


## [1.644] - 2026-01-02
- feat: enhance documentation with examples and type definitions across multiple modules
- chore: update version to 1.643 in changelog, manifest, HTML, and version files


## [1.643] - 2026-01-02
- Refactor module imports and update documentation for modularization changes
- docs: update developer documentation to reflect completion of DI overhaul and module independence
- chore: update version to 1.642 in manifest, HTML, package, and version files
- chore: update changelog for version 1.642 with new features and version refresh


## [1.642] - 2026-01-02
- feat: add syncModeFromToggles functionality to moduleLoader and routineLoader
- chore: update version to 1.641 and refresh related files


## [1.641] - 2026-01-02
- feat: add warning for multiple file imports in cycleImportManager
- chore: update version to 1.640 and refresh related files


## [1.640] - 2026-01-02
- refactor: Enhance module documentation and add type definitions
- docs: update FAQ for version 1.625+ and improve clarity on routines
- chore: update version to 1.639 and refresh changelog


## [1.639] - 2026-01-02
- Implement feature X to enhance user experience and optimize performance
- feat: Add link to try Lite version in product page
- feat: Update sidebar and documentation for folder structure refactor
- Update documentation to reflect changes in module count and test coverage
- chore: update version to 1.638 and refresh changelog


## [1.638] - 2026-01-02
- feat: update .gitignore to ignore subdirectories in docs/archive
- Add miniCycle modularization lessons learned and recurring modules integration guide
- chore: remove SonarCloud analysis workflow file
- feat: configure SonarCloud analysis with project and organization keys, source directory, and exclusions
- chore: update version to 1.637 and refresh changelog


## [1.637] - 2026-01-02
- feat: add simple hash function for stable ID generation and duplicate detection in notifications
- chore: update version to 1.636 and refresh changelog


## [1.636] - 2026-01-02
- feat: enhance notification tests with dependency injection and duplicate check
- chore: fix punctuation in version update for changelog
- chore: update version to 1.635 and refresh changelog


## [1.635] - 2026-01-02
- feat: add Playwright-based test and performance benchmark runners
- chore: add ESLint configuration and scripts for linting
- chore: update version to 1.634 and refresh changelog.


## [1.634] - 2026-01-02
- chore: update version to 1.633 and refresh changelog


## [1.633] - 2026-01-02
- Refactor tests for improved dependency management and validation
- chore: update version to 1.632 and refresh changelog


## [1.632] - 2026-01-02
- feat: add storage refresh button and quota detection improvements
- refactor: enhance boot sequence progress updates and add update check


## [1.631] - 2026-01-02
- chore: update version to 1.630 and refresh changelog


## [1.630] - 2026-01-02
- refactor: update footer links for clarity and consistency
- chore: update version to 1.629 and refresh changelog


## [1.629] - 2026-01-02
- refactor: update service worker log messages for consistency
- chore: update version to 1.628 and refresh changelog


## [1.628] - 2026-01-02
- chore: update version to 1.627 and refresh changelog


## [1.627] - 2026-01-02
- chore: update version to 1.626 and refresh changelog


## [1.626] - 2026-01-02
- Refactor code structure for improved readability and maintainability
- chore: update version to 1.625 and refresh changelog


## [1.625] - 2026-01-02
- changed phot size in what is minicycle
- updated photos


## [1.624] - 2026-01-02
- added many photos
- fix: adjust mobile task card margin for improved spacing
- feat: add copyright authorship statement for potential registration
- chore: update version to 1.623 in manifest, HTML, and version files; enhance changelog fix: adjust mobile task card margin for improved spacing


## [1.623] - 2026-01-01
- fix: adjust mobile task card margin for improved spacing


## [1.622] - 2026-01-01
- chore: update version to 1.621 in manifest, HTML, and version files; enhance changelog


## [1.621] - 2026-01-01
- feat: adjust mobile task card max-height for improved layout
- chore: update version to 1.620 in manifest, HTML, and version files; enhance changelog
- feat: adjust mobile task card max-height for improved layout


## [1.620] - 2025-12-31
- chore: update version to 1.619 in manifest, HTML, and version files; enhance changelog feat: adjust mobile task card max-height for improved layout


## [1.619] - 2025-12-31
- feat: implement desktop-only max-height rules for task cards to improve layout


## [1.618] - 2025-12-31
- chore: update version to 1.617 in manifest, HTML, and version files; enhance changelog


## [1.617] - 2025-12-31
- feat: add extra bottom padding for mobile to improve layout
- chore: update version to 1.616 in manifest, HTML, and version files; enhance changelog


## [1.616] - 2025-12-31
- feat: adjust mobile task card max-height for improved layout on iOS Safari
- chore: update version to 1.615 in manifest, HTML, and version files; enhance changelog


## [1.615] - 2025-12-31
- feat: update mobile task card constraints for iOS Safari compatibility
- chore: update version to 1.614 in manifest, HTML, and version files; enhance changelog


## [1.614] - 2025-12-31
- feat: adjust mobile task card height constraints for improved visibility
- chore: update version to 1.613 in manifest, HTML, and version files; enhance changelog


## [1.613] - 2025-12-31
- feat: adjust mobile task card height constraints for improved layout
- chore: update version to 1.612 in manifest, HTML, and version files; enhance changelog


## [1.612] - 2025-12-31
- feat: enhance task view responsiveness with dynamic height adjustments and visibility classes
- chore: update version to 1.611 in manifest, HTML, and version files; enhance changelog


## [1.611] - 2025-12-31
- feat: enhance task search functionality with dual rendering paths and visibility updates
- chore: update version to 1.610 in manifest, HTML, and version files; enhance changelog


## [1.610] - 2025-12-30
- feat: implement task search functionality with inline filtering and visibility control
- chore: update version to 1.609 in manifest, HTML, and version files; enhance changelog


## [1.609] - 2025-12-30
- feat: update task descriptions for clarity and add new example routine
- chore: update version to 1.608 in manifest, HTML, and version files; enhance changelog


## [1.608] - 2025-12-30
- feat: add quick actions button and empty state UI; enhance routine creation flow
- chore: update version to 1.607 in manifest, HTML, and version files; enhance changelog


## [1.607] - 2025-12-30
- feat: enhance routine switcher UI with visual indicators and improved styling; update documentation and coding standards
- chore: update version to 1.606 across all relevant files


## [1.606] - 2025-12-30
- feat: add visual mode indicators in routine switcher (🔄 Auto, ✅ 🔄 Manual, 📋 To-Do)
- feat: add routine search bar and storage viewer to switcher modal
- feat: add folder icon button in mode selector banner for quick routine access
- feat: refactor drag & drop to state-based architecture for data consistency
- feat: consistent safeAddEventListener usage across all 60 modules
- feat: implement idle-time saves for improved data durability
- fix: click-outside handler now properly excludes routine switcher button
- fix: update versioning logic to prevent matching non-numeric app version in service worker registration
- style: improve routine switcher button styling (gradient, shadows, hover effects)
- style: enhance Open/Cancel/Import buttons with professional styling
- docs: comprehensive documentation update for December 2025 changes


## [1.605] - 2025-12-29
- feat: implement saving indicator and routine search functionality with UI updates


## [1.604] - 2025-12-29
- Refactor code structure for improved readability and maintainability


## [1.603] - 2025-12-29
- feat: update version to 1.602 across all relevant files for consistency


## [1.600] - 2025-12-29
- feat: refactor exports to use named exports only across multiple modules
- feat: implement collapsible changelog section with dynamic loading
- feat: add changelog section to product page with dynamic loading from CHANGELOG.md
- feat: bump version to 1.599; update related files and cache version for consistency


## [1.599] - 2025-12-29
- feat: update versioning system to use centralized version.js for app and cache versions; enhance service worker for cache management
- chore: clean up CHANGELOG.md by removing outdated entries and maintaining current format


# Changelog

All notable changes to miniCycle will be documented in this file.

