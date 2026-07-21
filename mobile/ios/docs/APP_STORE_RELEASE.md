# miniCycle — App Store Release Checklist

> What's left to take miniCycle iOS from a **working Xcode-run build on your own iPhone** to a
> **published App Store app**. The app itself is done and verified on real hardware;
> everything below is distribution plumbing plus a short QA tail.
>
> Companion docs: [`BUILD_AND_RUN.md`](./BUILD_AND_RUN.md) (how builds are made),
> [`IOS_APP_ARCHITECTURE.md`](./IOS_APP_ARCHITECTURE.md) (how it works),
> [`../../android/docs/PLAY_STORE_RELEASE.md`](../../android/docs/PLAY_STORE_RELEASE.md)
> (the Android sibling of this checklist).

---

## Where we are now (snapshot, 2026-07-21)

| Item | Status |
|---|---|
| App builds & runs | ✅ Capacitor 8.4.1 / SPM, verified on iPhone 17 simulator **and** a real iPhone |
| Bundle id | ✅ `com.sparkincreations.minicycle` |
| Version | ✅ `MARKETING_VERSION` tracks `APP_VERSION`; build number auto-bumped by `update-version.sh --ios` |
| Signing (development) | ✅ team `88Z2VB998G` at project level, automatic signing |
| App icon | ✅ blue miniCycle icon, 1024 opaque |
| Splash screen | ✅ brand-blue + logo, verified |
| Native UX (splash, status bar, offline) | ✅ done |
| **On-device QA pass** | 🔶 partial — app boots & runs; feature-level pass below not yet done |
| **Apple Developer Program** | ❌ not enrolled ($99/yr — required for TestFlight & App Store) |
| **Distribution signing / archive** | ❌ never produced (needs the paid program) |
| **App Store Connect app record** | ❌ none |
| **Store listing** | ❌ none |
| **Privacy nutrition labels** | ❌ none (will be trivial: no data collected) |

What's on your phone today is a **development build** — it expires (7 days on a free Apple ID,
~1 year with the paid program's development profile) and can't be distributed.

---

## Phase 1 — On-device QA pass (free, do anytime)

The features that differ from the web need one systematic pass on the real iPhone:

- [ ] **Reminders / notifications** — enable reminders, verify the iOS permission prompt
      appears, and a notification is delivered (banner + notification center).
- [ ] **`.mcyc` export** — export a routine; verify the iOS share sheet opens and
      "Save to Files" produces a valid file.
- [ ] **`.mcyc` import** — uses the web file picker; verify it opens the iOS document picker
      and imports correctly.
- [ ] **"Load a Sample"** — exercises the bundled-examples fetch (leading-slash URLs under
      the `capacitor://` origin). Verify samples load.
- [ ] **Keyboard behavior** — task input at the bottom of the screen: does the keyboard
      obscure it? Does the view scroll correctly?
- [ ] **Dark mode** — toggle; verify the status-bar text flips light/dark (the bridge's
      MutationObserver).
- [ ] **Rotation / iPad** — decide: lock to portrait on iPhone? (Info.plist orientations.)
      If the App Store listing includes iPad, check the layout on an iPad simulator.
- [ ] **Data persistence** — force-quit and relaunch: state intact (localStorage/IndexedDB
      inside WKWebView persist per-app).
- [ ] **Offline** — airplane mode: everything works (it should — assets are bundled; only the
      feedback form needs network).

Known acceptable gaps (documented, not blockers): "Check for Updates" is a no-op in the app
(updates ship via the App Store); the automated-test tab is hidden.

## Phase 2 — Apple Developer Program (the gate)

- [ ] Enroll at developer.apple.com ($99/yr) with the sparkinCreations Apple ID.
- [ ] After approval, Xcode → Settings → Accounts picks up the new membership; automatic
      signing starts issuing distribution certificates when you archive.

Unlike Android there is **no keystore to guard** — Apple manages signing identities, and a
lost certificate is recoverable. The Apple ID itself is the crown jewel; keep 2FA healthy.

## Phase 3 — First archive & TestFlight

- [ ] Fresh release stamp: `cd web && ./scripts/update-version.sh --auto --ios`.
- [ ] Xcode: destination **Any iOS Device (arm64)** → **Product → Archive**.
- [ ] Organizer → **Distribute App → TestFlight & App Store** → upload.
- [ ] App Store Connect: create the app record (name **miniCycle**, bundle id, SKU).
- [ ] TestFlight: add yourself as an internal tester; install via the TestFlight app.
      This validates the **release** build (vs the debug builds tested so far).
- [ ] Re-run the Phase 1 checklist once on the TestFlight build.

> **Gotcha:** every upload needs a higher build number (`CURRENT_PROJECT_VERSION`).
> `update-version.sh --ios` bumps it — just don't upload the same build twice.

## Phase 4 — Store listing assets

- [ ] **Name** (≤30 chars) + **subtitle** (≤30) + **description** + **keywords** (≤100 chars).
- [ ] **Screenshots** — required: 6.9" (iPhone 17 Pro Max class) and 6.5"; optionally iPad.
      Capture from simulators: `xcrun simctl io <UDID> screenshot shot.png` (the exact
      workflow used in this bring-up). Reuse the Play Store copy/frames where sizes allow.
- [ ] **Category**: Productivity. **Age rating** questionnaire → 4+.
- [ ] Support URL (minicycleapp.com) + marketing URL (minicycle.app).

## Phase 5 — Privacy & compliance

> Same story as Play: miniCycle's offline / no-account / no-tracking design makes this easy.

- [ ] **Privacy policy URL** — required; the existing policy under `web/legal/` (hosted at
      minicycle.app) should already cover it — data stays on-device, no collection.
- [ ] **Privacy nutrition labels** in App Store Connect — declare **Data Not Collected**.
      (True: the only network call is the optional feedback form to web3forms.)
- [ ] **Export compliance** — uses only standard HTTPS: answer "standard encryption, exempt"
      (set `ITSAppUsesNonExemptEncryption = NO` in Info.plist to skip the per-upload prompt).
- [ ] **App Review notes** — mention it's fully offline/local so the reviewer isn't hunting
      for a login.

## Phase 6 — Release

- [ ] Submit for review from App Store Connect (first reviews typically 1–3 days).
- [ ] Choose manual or automatic release after approval.
- [ ] Optional: **phased release** (7-day gradual rollout, can be halted) — the iOS analog of
      Play's staged rollout.
- [ ] Release notes — reuse `web/CHANGELOG.md` entries.

---

## After launch — the update loop

```bash
cd web && ./scripts/update-version.sh --auto --ios --android --chrome --push --changelog
# → Xcode: Archive → upload → App Store Connect: submit
```

The pipeline already keeps versions/build numbers correct; an iOS update is one archive +
one upload on top of the normal release.

---

## Beyond the store (feature backlog, not release blockers)

- **`.mcyc` file association** — register the file type so tapping a `.mcyc` in
  Files/Messages opens miniCycle (Info.plist `CFBundleDocumentTypes` + `UTImportedTypeDeclarations`
  + a Capacitor `appUrlOpen` handler in the bridge). Same gap exists on Android.
- **"Check for Updates" button** — hide it in the app or repoint it at the App Store listing
  (currently a silent no-op).
- **CLI device deploy** — an `--ios-run` analog of `--android-run` (via `xcrun devicectl`)
  if the Xcode-GUI step ever feels slow.

---

## TL;DR — critical path

1. **Phase 1 QA pass** on your iPhone (free, ~30 min)
2. **Enroll in the Developer Program** (Phase 2 — the only money gate)
3. **Archive → TestFlight → re-test** (Phase 3)
4. **Listing assets + Data-Not-Collected privacy labels** (Phases 4–5)
5. **Submit** (Phase 6)
