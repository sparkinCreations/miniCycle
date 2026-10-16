# App Lock Plan (Face ID / Touch ID / fingerprint, optional, per device)

**Status:** Planned, not scheduled — decided Oct 16, 2026 that it is "might not be worth it"
right now; written up so the decision and the design are not lost.
**Priority:** Low. iOS 18 already lets a user long-press the app icon and choose
*Require Face ID*, which covers miniCycle like any app; this plan adds the same thing
where the OS has none (Android, macOS) and puts a switch for it inside Settings.
**Breaking changes:** No (one new `settings` flag, additive).
**Last Updated:** October 2026.

---

## What exists today

Nothing. As of v2.618 the web code, both phone projects, the desktop shell and the
Capacitor plugin list contain no biometrics, no lock screen and no passcode. What a user
may "already have" on an iPhone is the **iOS 18 system feature** (long-press the icon →
*Require Face ID*): iOS covers the app with its own lock, the app never knows, and there
is nothing in miniCycle to toggle. That stays as it is whatever happens below.

## What this is, and is not

A **lock screen**, not encryption. With the setting on, the app covers itself with an
overlay on cold start and on return from the background, and asks the OS to verify the
owner: Face ID or Touch ID on iPhone, fingerprint or face on Android, Touch ID on a Mac,
with the device passcode or credential as the fallback so nobody is ever locked out of
their own routines. The data underneath is unchanged — the OS already protects the app's
storage with the device passcode. What this adds is protection when the device is
unlocked and in someone else's hands, which is the realistic case.

It does **not** protect the daily backup files in the device folder
(`storage/backupFolder.js`): those are plain files by design and the privacy policy says so.

## Behaviour (all platforms)

| Moment | Behaviour |
|---|---|
| Cold start, setting on | Overlay up before anything else paints (see *Order*), prompt immediately. |
| Return from background | Prompt only if the app was hidden longer than `UI_TIMEOUTS.APP_LOCK_GRACE` (~30 s), so switching to Messages and back does not prompt every time. |
| Going to background | Blank the view under the overlay before the OS takes the app-switcher thumbnail (`visibilitychange` → hidden fires early enough on iOS and Android). |
| Prompt cancelled / failed | Overlay stays, with one *Unlock* button that prompts again. Nothing behind it is reachable, including the first-run screen when there are no routines. |
| Biometrics removed from the device later | The native call reports "not enrolled"; the prompt uses the passcode / device-credential policy instead. |
| Turning the setting ON | Prompt once first, so the user proves the unlock works before the gate exists. |
| Turning it OFF | Prompt first (otherwise anyone holding the unlocked phone could switch it off). |
| Platform without a verifier | The toggle is not rendered (web; Windows and Linux desktop; a phone with nothing enrolled shows the toggle disabled with a one-line note). |

The setting is `settings.appLockEnabled` (boolean, default false). It is deliberately
**not** in the `.mcyc` file and not restored from a backup: a lock is a property of the
device the user is holding, not of the data.

## Architecture

One web-side module, three native verifiers behind the existing bridges.

```
modules/ui/appLock.js          — overlay, grace timer, visibility handling, the setting, labels
modules/platform/capacitorBridge.js  — verifyOwnerNative({ reason })  → { handled, ok, reason }
modules/platform/desktopBridge.js    — verifyOwnerDesktop({ reason }) → same shape (Mac only)
mobile/ios/.../AppLockPlugin.swift   — LocalAuthentication (LAContext.evaluatePolicy)
mobile/android/.../AppLockPlugin.java — androidx.biometric BiometricPrompt
desktop/src/main.js                  — ipcMain.handle('minicycle:applock:verify') → systemPreferences.promptTouchID
```

**Bridge contract** (same on all three): `{ supported: boolean, kind: 'face'|'touch'|'fingerprint'|'biometric'|'passcode'|null }`
from `appLockCapability()`, and `{ handled: boolean, ok?: boolean, reason?: 'cancelled'|'failed'|'unavailable' }`
from `verifyOwner({ reason })`. `handled:false` means "no verifier on this platform" and
the module hides the toggle — the same convention `saveFileAsNative` already uses.

**Native plugins follow the SaveAs pattern:** app-local, registered in `MainActivity.java`
(`registerPlugin(AppLockPlugin.class)`) and in the iOS app target; no third-party
dependency. `isPluginAvailable('AppLock')` false on the web, so the bridge returns
`handled:false` there. iOS needs `NSFaceIDUsageDescription` in Info.plist; Android needs
`USE_BIOMETRIC` in the manifest and the `androidx.biometric` artifact.

**Policies.** iOS: `deviceOwnerAuthentication` (biometrics with passcode fallback), not
`…WithBiometrics`, so removal of Face ID never locks the user out. Android:
`BIOMETRIC_STRONG | DEVICE_CREDENTIAL`. Mac: `promptTouchID` has no passcode fallback —
on failure the overlay offers the OS login password route by re-prompting; if the Mac has
no Touch ID, `canPromptTouchID()` is false and the toggle is hidden.

## Order — the overlay must beat first paint

`appLock` reads `settings.appLockEnabled` from storage **before** AppState is ready, the
way `utils/debugMode.js` reads the debug flag early, and mounts the overlay in Phase 1
(`coreBoot`), not Phase 3. The first-run screen, `#app-loader` and `#app-container` all sit
under it. The prompt itself can wait for Phase 3; the cover cannot. A journey pins this:
with the flag set, no task text is in the DOM's visible tree until the stubbed verifier
resolves.

## Settings UI

Behaviour section, one toggle. Label is platform-variant through the resolver's
`{ touch, pointer }` / `{ browser, app }` machinery plus the capability `kind`:
*Require Face ID to open miniCycle* / *Require Touch ID …* / *Require fingerprint or face
to open miniCycle* / *Require your device passcode …*. A `settings-note` under it says what
it is: "A lock screen for this device. Your routines are not encrypted by it, and the daily
backup files in your device folder stay readable."

## Tests

- `tests/appLock.tests.js`: fake bridge (`supported`, `kind`, scripted `verifyOwner`
  results). Covers: toggle hidden when unsupported; enabling prompts first and leaves the
  flag off on cancel; disabling prompts first; overlay on start; grace period honoured;
  cancel keeps the overlay with Unlock; blank-on-hide; "not enrolled" falls through to
  the passcode policy; the flag never lands in an `.mcyc` or a backup file.
- Journey (`run-journey-tests.cjs`): init script stubs the bridge with a resolvable
  promise; asserts nothing behind the overlay is visible until it resolves, and that a
  hidden→visible flip inside the grace period does not re-prompt.
- Device checks at release: iPhone (Face ID), A509DL (fingerprint), the Mac (Touch ID).

## Effort

| Piece | Estimate |
|---|---|
| `appLock.js` + overlay CSS + setting + labels + unit tests + journey | 1 day |
| iOS plugin + plist + device check | ½ day |
| Android plugin + manifest + device check | ½ day |
| macOS IPC + preload + check | ¼ day |
| Docs, privacy policy line ("a lock screen, not encryption"), accessibility statement (the overlay is a dialog: focus trap, named button) | ¼ day |

Roughly **two and a half days** for all three native apps. The web stays without a toggle:
a browser has its own lock story, WebAuthn does not work inside the phones' web views, and
a PIN inside a web page would give a false sense of security.

## Open questions

- Should the lock also cover the Lite version? (No: Lite is frozen and runs on devices
  without biometrics.)
- Grace period: 30 s is a guess; measure against how often the recurring-task watcher
  brings the app forward on Android.
- Whether a user who has *Require Face ID* set at the iOS level should see the in-app
  toggle at all. The app cannot detect the OS setting, so the toggle shows on every
  capable iPhone; the note should say the OS feature exists.
