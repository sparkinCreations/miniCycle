# miniCycle — Google Play Store Release Checklist

> What's left to take miniCycle Android from a **sideloaded debug build** to a
> **published Play Store app**. The app itself is done and verified on real
> hardware; everything below is distribution plumbing.
>
> Companion docs: [`ANDROID_BUILD_AND_DIFFERENCES.md`](./ANDROID_BUILD_AND_DIFFERENCES.md) (how the web→native build works),
> `web/scripts/update-version.sh` (the release pipeline).

---

## Where we are now (snapshot)

| Item | Status |
|---|---|
| App builds & runs | ✅ Capacitor 8.4.1, verified on a real device (A509DL, Android 11) |
| `applicationId` | ✅ `com.sparkincreations.minicycle` |
| Version | ✅ `versionName 2.259`, `versionCode 4` (auto-bumped by `update-version.sh`) |
| `minSdk` / `targetSdk` | ✅ 24 / 36 |
| Launcher icon | ✅ adaptive + legacy (blue miniCycle logo) |
| Native UX (back button, status bar, offline) | ✅ done |
| **Release signing** | ❌ `release {}` has `minifyEnabled false`, **no `signingConfigs`** → release builds are unsigned |
| **Keystore** | ❌ none exists |
| **Signed AAB** | ❌ never built (Play requires `.aab`, not the debug `.apk`) |
| **Play Console account** | ❓ unknown / likely not set up |
| **Store listing** | ❌ none |
| **Compliance forms** | ❌ none (privacy policy, data safety, content rating) |

What's on phones today is the **debug APK** — it does **not** auto-update and is **not** acceptable for Play.

---

## Phase 1 — Release signing (the #1 blocker)

### 1a. Generate an upload keystore (one-time)

```bash
keytool -genkeypair -v \
  -keystore minicycle-upload.jks \
  -alias minicycle-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

- [ ] Store `minicycle-upload.jks` **outside the repo** and **back it up securely** (1Password / encrypted vault). **If lost, you can't push updates to the same listing** (unless enrolled in Play App Signing, which lets Google re-key — enroll in it; see 2c).
- [ ] Record the keystore password + key alias + key password in the same vault.

### 1b. Wire signing into Gradle (keep secrets out of git)

Create `mobile/android/android/keystore.properties` (gitignored):

```properties
storeFile=/absolute/path/to/minicycle-upload.jks
storePassword=********
keyAlias=minicycle-upload
keyPassword=********
```

In `mobile/android/android/app/build.gradle`, before `android {`:

```gradle
def keystoreProps = new Properties()
def keystoreFile = rootProject.file("keystore.properties")
if (keystoreFile.exists()) { keystoreProps.load(new FileInputStream(keystoreFile)) }
```

Inside `android {`:

```gradle
signingConfigs {
    release {
        if (keystoreFile.exists()) {
            storeFile file(keystoreProps['storeFile'])
            storePassword keystoreProps['storePassword']
            keyAlias keystoreProps['keyAlias']
            keyPassword keystoreProps['keyPassword']
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        // minifyEnabled true  // optional: enable R8 + test thoroughly first
    }
}
```

- [ ] Add `keystore.properties` and `*.jks` to `.gitignore`.
- [ ] Confirm `signingConfig` is referenced in the `release` buildType.

---

## Phase 2 — Build & upload the signed bundle

### 2a. Build the AAB

```bash
cd web && node scripts/build-android-www.cjs            # fresh payload
cd ../mobile/android && npx cap sync android
cd android && ./gradlew bundleRelease                   # → app/build/outputs/bundle/release/app-release.aab
```

- [ ] Verify it's signed: `jarsigner -verify -verbose app-release.aab` (or check in Play Console on upload).
- [ ] **Consider adding a `--android-bundle` (or `bundleRelease`) path to `update-version.sh`** so signed AABs come from the same pipeline as everything else. (Today the script only does `assembleDebug`.)

### 2b–2c. In Play Console

- [ ] Create the app (name: **miniCycle**, default language, app/not-game, free).
- [ ] **Enroll in Play App Signing** (recommended — Google manages the app signing key; your upload key just signs uploads).
- [ ] Upload the AAB to a test track first (Phase 3).

> **Gotcha:** every upload needs a **higher `versionCode`** than the last. `update-version.sh` already increments it — just don't upload the same code twice.

---

## Phase 3 — Pre-launch testing

- [ ] **Internal testing track** — upload the AAB, add your own Google account as a tester, install via the Play link. This validates signing + the *release* build (R8/minify differences from debug) before the public sees it.
- [ ] Test on a **range of devices** (you've covered low-end via the A509DL; also try a modern phone + a tablet/large screen).
- [ ] Verify: launcher icon, hardware back button, offline behavior, status-bar theming, the layout density on different screen sizes, data persistence across reinstall.
- [ ] Use the Play Console **pre-launch report** (automated device testing) and fix any flagged crashes/accessibility issues.

---

## Phase 4 — Store listing assets

- [ ] **App name** (≤30 chars) + **short description** (≤80) + **full description** (≤4000).
- [ ] **App icon** — 512×512 PNG (reuse `web/assets/images/logo/pwa-icons/icon-512.png`).
- [ ] **Feature graphic** — 1024×500.
- [ ] **Phone screenshots** — min 2 (you can capture from the A509DL: `adb exec-out screencap -p > shot.png`); ideally also tablet screenshots.
- [ ] Category (**Productivity**), contact email (`sparkintechproductions@gmail.com`), website.

---

## Phase 5 — Compliance & policy

> miniCycle's **privacy-first / offline / no-account / no-network** design makes most of this *easy* — lean into it.

- [ ] **Privacy policy** — a public URL is **required**. Should state plainly: data stays on-device (localStorage/IndexedDB), no collection, no transmission, no third parties.
- [ ] **Data safety form** — declare **no data collected / no data shared**. (True for miniCycle — its strongest selling point here.)
- [ ] **Content rating questionnaire** — will come back **Everyone**.
- [ ] **Target audience & content** — select age groups; if not targeting children, say so to avoid Families policy obligations.
- [ ] **Ads declaration** — "No ads."
- [ ] **Permissions** — audit `AndroidManifest.xml`; justify or remove anything not needed (the Capacitor plugins pull in some — local-notifications, filesystem, etc.). Each sensitive permission may need a declaration.
- [ ] Government/financial/health declarations — N/A.

---

## Phase 6 — Release rollout

- [ ] Promote from **Internal → Closed (optional) → Open/Production**.
- [ ] Start production as a **staged rollout** (e.g., 20%) so a bad build can be halted.
- [ ] Write release notes (can reuse `web/CHANGELOG.md` entries).

---

## After launch

- The existing pipeline already handles versioning: `cd web && ./scripts/update-version.sh --auto --android-run --chrome --push --changelog` bumps everything and increments `versionCode`. The **only** addition needed for Play is producing the **signed AAB** (Phase 2a) and uploading it.
- Keep the **keystore backed up** — it's the one irreplaceable artifact.
- Watch the Play Console **vitals** (ANRs, crashes) after each release.

---

## TL;DR — critical path

1. **Generate keystore + wire `signingConfigs`** (Phase 1)
2. **`./gradlew bundleRelease` → signed AAB** (Phase 2)
3. **Play Console: create app, enroll in App Signing, internal-test the signed build** (Phases 2–3)
4. **Privacy policy URL + data-safety form (no data collected) + content rating** (Phase 5)
5. **Listing assets** (Phase 4) → **staged production rollout** (Phase 6)
