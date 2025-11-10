# Mobile Applications

⚠️ **This folder is currently empty - reserved for future mobile apps.**

## Purpose

This will contain native mobile applications:
- `ios/` - iOS app (Swift/SwiftUI or React Native)
- `android/` - Android app (Kotlin or React Native)
- `shared/` - Shared mobile code (if using React Native)

## Technology Options

### Option 1: React Native (Recommended)
**Pros:**
- ✅ Code sharing between iOS/Android
- ✅ Faster development
- ✅ Web developer friendly
- ✅ Large ecosystem

**Cons:**
- ❌ Larger app size
- ❌ Some native features require bridges
- ❌ Performance slightly behind native

### Option 2: Native (Swift + Kotlin)
**Pros:**
- ✅ Best performance
- ✅ Full platform capabilities
- ✅ Native UI/UX
- ✅ Smaller app size

**Cons:**
- ❌ Maintain two codebases
- ❌ Slower development
- ❌ Different expertise needed

### Option 3: Flutter
**Pros:**
- ✅ Single codebase
- ✅ Good performance
- ✅ Rich UI framework

**Cons:**
- ❌ Dart language (new learning curve)
- ❌ Less mature ecosystem

## When to Start

Start mobile development when:
1. Web app is feature-complete and stable
2. User demand for mobile apps exists
3. Mobile-specific features are needed (widgets, shortcuts)
4. PWA limitations become apparent

## Structure

```
mobile/
├── ios/                    # iOS native app
├── android/                # Android native app
├── shared/                 # Shared mobile code (RN)
└── config/                 # Build configurations
```

## Integration with Existing Code

Mobile apps will:
1. Reuse business logic from `shared/` (after extraction)
2. Use web API patterns as reference
3. Add mobile-specific features (widgets, watch app, etc.)
4. Use native data storage (SQLite, Realm, etc.)

## Getting Started (Future)

### React Native

```bash
cd mobile
npx react-native init miniCycle

# Or with Expo:
npx create-expo-app miniCycle
```

### iOS Native

```bash
cd mobile/ios
# Create Xcode project
# Set up Swift/SwiftUI
```

### Android Native

```bash
cd mobile/android
# Create Android Studio project
# Set up Kotlin
```

## Mobile-Specific Features

Examples of what would go here:
- Home screen widgets
- Siri/Google Assistant shortcuts
- Apple Watch / Wear OS apps
- Push notifications
- Face ID / Fingerprint auth
- Camera integration (for QR codes, etc.)
- Haptic feedback
- Share extensions
- Today widgets

## Distribution

### iOS
- App Store submission
- TestFlight beta testing
- App Store Connect setup
- Screenshots and metadata

### Android
- Google Play Store submission
- Internal/Beta testing tracks
- Play Console setup
- Screenshots and metadata

## Questions to Answer Before Starting

1. React Native vs Native vs Flutter?
2. iOS first, Android first, or both simultaneously?
3. Which features justify native apps vs PWA?
4. Data sync strategy?
5. Offline support?
6. App size concerns?
7. Target OS versions?
