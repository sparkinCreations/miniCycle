# Building & Running the iOS App

Every way to produce and run an iOS build, from the daily dev loop to a release-stamped
archive — plus the troubleshooting table for this machine's known gotchas.

> Companions: [`IOS_APP_ARCHITECTURE.md`](./IOS_APP_ARCHITECTURE.md) (how it's put together),
> [`APP_STORE_RELEASE.md`](./APP_STORE_RELEASE.md) (distribution checklist).

---

## 0. Prerequisites (already satisfied on this Mac)

- **Full Xcode** (26.6 verified) — the Command Line Tools alone cannot compile.
- **No CocoaPods** — the project is SPM-based; Xcode resolves packages on open.
- **Signing team** — set at the project level (`DEVELOPMENT_TEAM`, targets inherit).
- **iOS platform runtime** — installed (was a one-time 8.5 GB download; see §5).

> **`xcode-select` note:** this machine's developer directory points at the Command Line
> Tools, not Xcode. The Xcode **GUI** doesn't care. For **command-line** `xcodebuild`/`simctl`,
> either prefix every call with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`
> (what the examples below do) or fix it once:
> `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

---

## 1. The daily dev loop (web change → phone)

```bash
cd mobile/ios
npm run sync        # regenerate www/ from web/  +  cap sync into the Xcode project
npm run open        # open App.xcodeproj in Xcode (or it's already open)
# Xcode: pick "MJ iPhone" or a simulator in the device dropdown → ▶ Run
```

That's it. `npm run sync` is the step people forget — **Xcode builds whatever is in
`App/public/`, which only changes when you sync.** Editing `web/` does nothing to the app
until you sync.

First run on a new device: the phone asks to trust the computer, then iOS blocks launch until
you trust the developer profile (Settings → General → VPN & Device Management → Trust).

## 2. Release builds (version-stamped)

App-code releases go through the release script — the iOS stage is part of the same pipeline
as web/Chrome/Android:

```bash
cd web
./scripts/update-version.sh --auto --ios                       # iOS only
./scripts/update-version.sh --auto --ios --android --chrome --push --changelog   # everything
```

The `--ios` stage: rebuilds `www/` → sets `MARKETING_VERSION` to the new version → bumps the
build number (`CURRENT_PROJECT_VERSION`) → `cap sync ios`. All gated on the payload build
succeeding, so a broken build can't get stamped with a new version.

Then archive in Xcode: **Product → Archive → Distribute App** (needs the paid Developer
Program for TestFlight/App Store — see [`APP_STORE_RELEASE.md`](./APP_STORE_RELEASE.md)).

## 3. Command-line builds (no Xcode GUI)

Simulator build (no signing needed):

```bash
cd mobile/ios/ios/App
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
xcodebuild -project App.xcodeproj -scheme App \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Install + launch + screenshot on a simulator (IDs from `xcrun simctl list devices available`):

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcrun simctl boot <SIM-UDID> && xcrun simctl bootstatus <SIM-UDID>
xcrun simctl install <SIM-UDID> <DerivedData>/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch <SIM-UDID> com.sparkincreations.minicycle
xcrun simctl io <SIM-UDID> screenshot shot.png
xcrun simctl shutdown <SIM-UDID>
```

There is deliberately **no CLI device-deploy path yet** (the Android `--android-run`
equivalent) — device installs go through Xcode's Run button for now.

## 4. Payload-only rebuild

```bash
cd web && npm run build:ios      # just regenerates mobile/ios/www/ — no Xcode needed
```

Works without Xcode entirely (Node stdlib only). Useful for inspecting the transform output.

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `xcodebuild: error: tool 'xcodebuild' requires Xcode` | `xcode-select` points at the CLT | `DEVELOPER_DIR=…` prefix, or `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` |
| `Failed to load … IDESimulatorFoundation` / "required plug-in failed to load" | Stale Xcode support frameworks after an Xcode upgrade | `DEVELOPER_DIR=… xcodebuild -runFirstLaunch` (fixed this 2026-07-21) |
| `Unable to find a destination … iOS X.Y is not installed` | iOS platform runtime never downloaded | `DEVELOPER_DIR=… xcodebuild -downloadPlatform iOS` (~8.5 GB; done 2026-07-21) |
| "Signing for 'App' requires a development team" | Target not inheriting the project-level team | Target → Signing & Capabilities → team; or accept Xcode's "Inherit Development Team" recommended setting (done) |
| App runs but shows OLD web code | Forgot `npm run sync` | `cd mobile/ios && npm run sync`, rebuild |
| Package resolution fails on first open | SPM needs network to fetch Capacitor packages | Wait / File → Packages → Resolve Package Versions |
| A `pod: command not found` from any tool | Something assuming CocoaPods | This project is SPM-only — don't install CocoaPods; re-check what invoked `pod` |
| Simulator screenshot/install from CLI errors | Simulator not booted | `xcrun simctl boot <UDID>` + `bootstatus` first |

## 6. Do / Don't

- **Do** run `npm run sync` after every web change you want in the app, and after adding any
  Capacitor plugin.
- **Do** keep `MARKETING_VERSION` moving only via `update-version.sh --ios`.
- **Don't** hand-edit `www/`, `App/public/`, or `CapApp-SPM/Package.swift` — all regenerated.
- **Don't** add a Podfile.
- **Don't** commit anything the two `.gitignore`s exclude (payload, DerivedData, derived configs).
