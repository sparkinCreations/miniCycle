# miniCycle - Multi-Platform Project Reorganization

**Updated for multi-platform development (Web, Desktop, iPhone)**
**Keeps `web/` folder - perfect for your use case!**

-----

## 🎯 Design Philosophy

Your project is evolving to support multiple platforms:

- ✅ **Web** (current) - PWA with offline support
- 🔜 **Desktop** (planned) - Electron/Tauri native app
- 🔜 **iPhone** (planned) - Native iOS or Capacitor

The structure should **clearly separate** platforms while **maximizing code reuse**.

-----

## 📊 Current Structure

```
miniCycle/
│
├── README.md
├── LICENSE
├── .gitignore
├── .github/workflows/test.yml
│
└── web/                                    # Everything in one folder
    │
    ├── 🌐 PUBLIC PAGES
    ├── product.html
    ├── blog.html
    ├── privacy.html
    ├── terms.html
    ├── user-manual.html
    ├── learn_more.html
    ├── sitemap.xml
    ├── robots.txt
    │
    ├── 🚀 APP FILES
    ├── miniCycle.html
    ├── miniCycle-lite.html
    ├── miniCycle-scripts.js (3,674 lines)
    ├── miniCycle-styles.css
    ├── user-manual-styles.css
    ├── version.js
    ├── manifest.json
    ├── service-worker.js
    ├── update-version.sh
    ├── package.json
    ├── package-lock.json
    │
    ├── 📁 blog/
    │   ├── scripts/
    │   ├── posts/
    │   ├── docs/
    │   └── package.json
    │
    ├── 📁 utilities/ (33 modules)
    ├── 📁 docs/ (30+ files, flat)
    ├── 📁 tests/ (30 test files in root)
    ├── 📁 data/
    └── 📁 assets/
```

-----

## 🎯 Proposed Multi-Platform Structure

```
miniCycle/
│
├── 📄 README.md                            # Main project overview
├── 📄 LICENSE                              # MIT License
├── 📄 CHANGELOG.md                         # 🆕 Version history (all platforms)
├── 📄 CONTRIBUTING.md                      # 🆕 Contribution guidelines
├── 📄 .gitignore                           # Git ignore rules
│
├── 📁 .github/                             # GitHub configuration
│   ├── workflows/
│   │   ├── test-web.yml                   # Web app tests
│   │   ├── test-desktop.yml               # 🆕 Desktop tests (future)
│   │   └── test-mobile.yml                # 🆕 Mobile tests (future)
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
│
├── 📁 public/                              # 🆕 PUBLIC WEBSITE (marketing, blog, legal)
│   │
│   ├── 📄 index.html                       # 🆕 Landing/marketing page
│   ├── 📄 product.html                     # Product page
│   ├── 📄 privacy.html                     # Privacy policy
│   ├── 📄 terms.html                       # Terms of service
│   ├── 📄 user-manual.html                 # User manual (public-facing)
│   ├── 📄 learn_more.html                  # Learn more page
│   ├── 📄 sitemap.xml                      # SEO sitemap
│   ├── 📄 robots.txt                       # SEO robots
│   │
│   ├── 📁 blog/                            # Blog system
│   │   ├── 📄 index.html                   # ← Renamed from blog.html
│   │   │
│   │   ├── scripts/
│   │   │   ├── index.js
│   │   │   └── prefs.js
│   │   │
│   │   ├── posts/                          # Blog posts (HTML)
│   │   │   ├── 2025-10-02-welcome-to-minicycle-blog.html
│   │   │   └── [...more posts]
│   │   │
│   │   ├── docs/                           # Blog documentation
│   │   │   ├── post_template.html
│   │   │   └── README.md                   # 🆕
│   │   │
│   │   ├── package.json                    # Blog build config
│   │   ├── package-lock.json
│   │   └── README.md                       # 🆕 Blog setup guide
│   │
│   ├── 📁 styles/                          # 🆕 Public website styles
│   │   ├── product.css
│   │   ├── blog.css
│   │   ├── user-manual.css                 # ← Moved from user-manual-styles.css
│   │   ├── shared.css                      # 🆕 Shared styles
│   │   └── themes.css                      # 🆕 Theme variables
│   │
│   └── 📁 assets/                          # Public website assets
│       ├── images/
│       │   ├── hero-image.png
│       │   ├── logo.svg
│       │   ├── screenshots/
│       │   └── blog/
│       └── icons/
│           ├── favicon.ico
│           └── social-preview.png
│
├── 📁 web/                                 # 🌐 WEB APPLICATION (PWA)
│   │
│   ├── 📄 miniCycle.html                   # Main app entry
│   ├── 📄 miniCycle-lite.html             # ES5 legacy version
│   ├── 📄 miniCycle-scripts.js            # Main app code (3,674 lines)
│   ├── 📄 miniCycle-styles.css            # App styles
│   ├── 📄 version.js                      # Version info
│   ├── 📄 manifest.json                   # PWA manifest
│   ├── 📄 service-worker.js               # Service worker
│   ├── 📄 package.json                    # Web app dependencies
│   ├── 📄 package-lock.json
│   ├── 📄 README.md                       # 🆕 Web app guide
│   │
│   ├── 📁 modules/                         # ← Renamed from utilities/
│   │   │
│   │   ├── 📁 core/                        # 🆕 Core system modules
│   │   │   ├── appState.js                # State management
│   │   │   ├── appInit.js                 # ← Renamed from appInitialization.js
│   │   │   └── eventBus.js                # 🆕 (optional future)
│   │   │
│   │   ├── 📁 task/                        # Task management system
│   │   │   ├── index.js                   # 🆕 Public API exports
│   │   │   ├── taskCore.js                # CRUD operations
│   │   │   ├── taskDOM.js                 # Coordination
│   │   │   ├── taskRenderer.js            # DOM creation
│   │   │   ├── taskEvents.js              # Event handling
│   │   │   ├── taskValidation.js          # Validation
│   │   │   ├── taskUtils.js               # Utilities
│   │   │   └── dragDropManager.js         # Drag & drop
│   │   │
│   │   ├── 📁 cycle/                       # Cycle management system
│   │   │   ├── index.js                   # 🆕 Public API
│   │   │   ├── cycleCore.js               # CRUD
│   │   │   ├── cycleLoader.js             # Loading
│   │   │   ├── cycleSwitcher.js           # Switching
│   │   │   ├── modeManager.js             # Modes
│   │   │   └── migrationManager.js        # Migrations
│   │   │
│   │   ├── 📁 recurring/                   # 🆕 Recurring tasks system
│   │   │   ├── index.js                   # 🆕 Public API
│   │   │   ├── recurringCore.js           # Business logic
│   │   │   ├── recurringPanel.js          # UI
│   │   │   ├── recurringIntegration.js    # Integration
│   │   │   └── recurringWatch.js          # 🆕 Watch function (extract from core)
│   │   │
│   │   ├── 📁 ui/                          # UI coordination
│   │   │   ├── modalManager.js
│   │   │   ├── menuManager.js
│   │   │   ├── settingsManager.js
│   │   │   ├── onboardingManager.js
│   │   │   ├── undoRedoManager.js
│   │   │   └── gamesManager.js
│   │   │
│   │   ├── 📁 features/                    # 🆕 Optional/pluggable features
│   │   │   ├── dueDates.js
│   │   │   ├── reminders.js
│   │   │   ├── themes.js
│   │   │   └── stats.js
│   │   │
│   │   └── 📁 utils/                       # Shared utilities
│   │       ├── globalUtils.js
│   │       ├── notifications.js
│   │       ├── deviceDetection.js
│   │       └── storage.js
│   │
│   ├── 📁 assets/                          # Web app assets
│   │   ├── icons/
│   │   │   ├── icon-192.png
│   │   │   ├── icon-512.png
│   │   │   └── favicon.ico
│   │   ├── images/
│   │   │   └── onboarding/
│   │   └── fonts/                          # (if needed)
│   │
│   └── 📁 data/                            # Sample app data
│       ├── README.md                      # 🆕 Data documentation
│       ├── example-routine-schema25.mcyc
│       └── templates/                     # 🆕 Template cycles
│           ├── morning-routine.mcyc
│           └── workout-plan.mcyc
│
├── 📁 desktop/                             # 🆕 DESKTOP APPLICATION (future)
│   │
│   ├── 📄 README.md                        # Desktop app guide
│   ├── 📄 main.js                          # Electron/Tauri entry point
│   ├── 📄 preload.js                       # Electron preload script
│   ├── 📄 package.json                     # Desktop dependencies
│   ├── 📄 package-lock.json
│   │
│   ├── 📁 src/                             # Desktop-specific code
│   │   ├── menu.js                        # Native menu bar
│   │   ├── tray.js                        # System tray
│   │   ├── shortcuts.js                   # Global keyboard shortcuts
│   │   ├── notifications.js               # Native notifications
│   │   ├── window-manager.js              # Window management
│   │   └── auto-updater.js                # App updates
│   │
│   ├── 📁 build/                           # Build configuration
│   │   ├── icon.icns                      # macOS icon
│   │   ├── icon.ico                       # Windows icon
│   │   ├── icon.png                       # Linux icon
│   │   ├── entitlements.plist             # macOS entitlements
│   │   └── notarize.js                    # macOS notarization
│   │
│   └── 📁 config/                          # Build configs
│       ├── electron-builder.json          # Electron builder config
│       └── tauri.conf.json               # Tauri config (alternative)
│
├── 📁 mobile/                              # 🆕 MOBILE APPS (future)
│   │
│   ├── 📄 README.md                        # Mobile development guide
│   │
│   ├── 📁 ios/                             # iOS native app
│   │   ├── App/
│   │   │   ├── AppDelegate.swift
│   │   │   ├── SceneDelegate.swift
│   │   │   ├── ContentView.swift
│   │   │   └── miniCycleApp.swift
│   │   ├── Podfile                        # CocoaPods dependencies
│   │   ├── Info.plist
│   │   ├── Assets.xcassets/
│   │   └── miniCycle.xcodeproj/
│   │
│   ├── 📁 android/                         # 🆕 Android app (optional)
│   │   ├── app/
│   │   │   ├── src/
│   │   │   └── build.gradle
│   │   ├── gradle/
│   │   └── build.gradle
│   │
│   ├── 📁 shared/                          # Shared mobile code
│   │   ├── components/                    # Reusable UI components
│   │   ├── screens/                       # App screens
│   │   ├── navigation/                    # Navigation logic
│   │   └── hooks/                         # Custom hooks
│   │
│   └── 📁 config/                          # Mobile build configs
│       ├── capacitor.config.ts            # Capacitor config (if used)
│       └── expo.json                      # Expo config (if used)
│
├── 📁 shared/                              # 🆕 SHARED CODE (all platforms)
│   │
│   ├── 📄 README.md                        # Shared code guide
│   │
│   ├── 📁 models/                          # Data models
│   │   ├── Task.js                        # Task model
│   │   ├── Cycle.js                       # Cycle model
│   │   ├── AppState.js                    # State model
│   │   ├── Schema.js                      # Schema definition
│   │   └── index.js                       # Export all models
│   │
│   ├── 📁 business-logic/                  # Core business logic
│   │   ├── recurring-engine.js            # Recurring task scheduling
│   │   ├── cycle-manager.js               # Cycle lifecycle
│   │   ├── task-manager.js                # Task operations
│   │   ├── validation-engine.js           # Validation rules
│   │   └── migration-engine.js            # Schema migrations
│   │
│   ├── 📁 utils/                           # Shared utilities
│   │   ├── date-formatter.js              # Date formatting
│   │   ├── validation.js                  # Input validation
│   │   ├── storage-adapter.js             # Storage abstraction
│   │   ├── helpers.js                     # General helpers
│   │   └── constants.js                   # App constants
│   │
│   ├── 📁 types/                           # 🆕 TypeScript types (optional)
│   │   ├── index.d.ts                     # Type definitions
│   │   ├── Task.d.ts
│   │   ├── Cycle.d.ts
│   │   └── AppState.d.ts
│   │
│   └── 📁 config/                          # Shared configuration
│       ├── themes.js                      # Theme definitions
│       ├── badges.js                      # Badge/achievement config
│       └── defaults.js                    # Default settings
│
├── 📁 docs/                                # 📚 DOCUMENTATION (all platforms)
│   │
│   ├── 📄 README.md                        # 🆕 Documentation hub/navigation
│   │
│   ├── 📁 getting-started/                 # For new users & developers
│   │   ├── WHAT_IS_MINICYCLE.md           # Product overview
│   │   ├── QUICK_START.md                 # 🆕 5-minute setup
│   │   ├── USER_GUIDE.md                  # 🆕 End-user guide
│   │   └── DEVELOPER_ONBOARDING.md        # Developer setup
│   │
│   ├── 📁 architecture/                    # System design
│   │   ├── OVERVIEW.md                    # 🆕 High-level architecture
│   │   ├── MULTI_PLATFORM.md              # 🆕 Multi-platform strategy
│   │   ├── MODULE_STRUCTURE.md            # Module organization
│   │   ├── INITIALIZATION.md              # AppInit system
│   │   ├── STATE_MANAGEMENT.md            # 🆕 State patterns
│   │   ├── DATA_SCHEMA.md                 # Schema 2.5
│   │   ├── SHARED_CODE.md                 # 🆕 Code sharing patterns
│   │   └── DESIGN_PATTERNS.md             # 🆕 DI, Resilient Constructor
│   │
│   ├── 📁 features/                        # Feature-specific docs
│   │   ├── recurring-tasks/
│   │   │   ├── README.md
│   │   │   ├── USER_GUIDE.md
│   │   │   ├── TECHNICAL.md
│   │   │   └── WATCH_FUNCTION.md
│   │   ├── drag-drop/
│   │   │   ├── ARCHITECTURE.md
│   │   │   ├── CROSS_PLATFORM.md
│   │   │   └── SAFARI_FIXES.md
│   │   ├── themes/
│   │   │   └── THEME_SYSTEM.md
│   │   └── modes/
│   │       └── CYCLE_MODES.md
│   │
│   ├── 📁 platforms/                       # 🆕 Platform-specific guides
│   │   ├── web/
│   │   │   ├── DEVELOPMENT.md             # Web development guide
│   │   │   ├── PWA.md                     # PWA features
│   │   │   └── DEPLOYMENT.md              # Web deployment
│   │   ├── desktop/
│   │   │   ├── DEVELOPMENT.md             # Desktop development
│   │   │   ├── DISTRIBUTION.md            # App signing & distribution
│   │   │   └── NATIVE_APIS.md             # Native API usage
│   │   └── mobile/
│   │       ├── IOS_DEVELOPMENT.md         # iOS development
│   │       ├── ANDROID_DEVELOPMENT.md     # Android development
│   │       └── APP_STORE.md               # App store submission
│   │
│   ├── 📁 api/                             # API reference
│   │   ├── README.md
│   │   ├── TASK_API.md
│   │   ├── CYCLE_API.md
│   │   ├── STATE_API.md
│   │   └── SHARED_API.md                  # 🆕 Shared code APIs
│   │
│   ├── 📁 guides/                          # How-to guides
│   │   ├── TESTING.md
│   │   ├── VERSION_UPDATE.md
│   │   ├── SERVICE_WORKER.md
│   │   ├── FILE_FORMAT.md
│   │   ├── CODE_SHARING.md                # 🆕 How to share code
│   │   ├── PLATFORM_SPECIFIC.md           # 🆕 Platform-specific code
│   │   └── TROUBLESHOOTING.md             # 🆕
│   │
│   ├── 📁 decisions/                       # Architecture Decision Records
│   │   ├── README.md
│   │   ├── 001-vanilla-javascript.md      # 🆕 Why vanilla JS
│   │   ├── 002-browser-testing.md         # 🆕 Why Playwright
│   │   ├── 003-multi-platform.md          # 🆕 Multi-platform approach
│   │   ├── 004-coupling-analysis.md       # Coupling audit
│   │   └── 005-shared-code.md             # 🆕 Code sharing strategy
│   │
│   └── 📁 history/                         # Historical documentation
│       ├── MODULARIZATION_JOURNEY.md
│       ├── OCTOBER_2025_IMPROVEMENTS.md
│       └── DECOUPLING_PLAN.md             # (Rejected plan - for reference)
│
├── 📁 tests/                               # 🧪 TEST SUITE (all platforms)
│   │
│   ├── 📄 README.md                        # Testing overview
│   ├── 📄 test-config.js                   # 🆕 Shared test config
│   │
│   ├── 📁 web/                             # Web-specific tests
│   │   ├── module-test-suite.html         # Manual test UI
│   │   ├── MODULE_TEMPLATE.tests.js
│   │   │
│   │   ├── unit/                          # 🆕 Web unit tests
│   │   │   ├── core/
│   │   │   │   ├── appState.test.js
│   │   │   │   └── appInit.test.js
│   │   │   ├── task/
│   │   │   │   ├── taskCore.test.js
│   │   │   │   ├── taskDOM.test.js
│   │   │   │   └── [...7 task tests]
│   │   │   ├── cycle/
│   │   │   │   └── [...cycle tests]
│   │   │   ├── recurring/
│   │   │   │   └── [...recurring tests]
│   │   │   └── ui/
│   │   │       └── [...UI tests]
│   │   │
│   │   ├── integration/                   # 🆕 Web integration tests
│   │   │   ├── task-cycle.test.js
│   │   │   └── recurring-integration.test.js
│   │   │
│   │   └── automated/                     # Playwright automation
│   │       ├── README.md
│   │       ├── run-browser-tests.js
│   │       └── config.js
│   │
│   ├── 📁 desktop/                         # 🆕 Desktop tests (future)
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   │
│   ├── 📁 mobile/                          # 🆕 Mobile tests (future)
│   │   ├── ios/
│   │   ├── android/
│   │   └── shared/
│   │
│   ├── 📁 shared/                          # 🆕 Shared code tests
│   │   ├── models/
│   │   │   ├── Task.test.js
│   │   │   └── Cycle.test.js
│   │   ├── business-logic/
│   │   │   ├── recurring-engine.test.js
│   │   │   └── cycle-manager.test.js
│   │   └── utils/
│   │       └── validation.test.js
│   │
│   ├── 📁 e2e/                             # 🆕 Cross-platform E2E
│   │   ├── README.md
│   │   └── user-flows.test.js
│   │
│   └── 📁 fixtures/                        # 🆕 Test data
│       ├── sample-state.json
│       ├── sample-cycles.json
│       └── sample-tasks.json
│
└── 📁 scripts/                             # 🛠️ BUILD & UTILITY SCRIPTS
    │
    ├── 📄 README.md                        # 🆕 Scripts documentation
    │
    ├── update-version.sh                  # Version management
    ├── build-web.sh                       # 🆕 Build web app
    ├── build-desktop.sh                   # 🆕 Build desktop app
    ├── build-mobile.sh                    # 🆕 Build mobile apps
    ├── build-all.sh                       # 🆕 Build all platforms
    │
    ├── deploy-web.sh                      # 🆕 Deploy web app
    ├── deploy-desktop.sh                  # 🆕 Publish desktop app
    ├── deploy-mobile.sh                   # 🆕 Submit to app stores
    │
    ├── sync-shared-code.sh                # 🆕 Sync shared code
    ├── validate-structure.js              # 🆕 Check structure compliance
    ├── generate-icons.sh                  # 🆕 Generate app icons
    └── test-all-platforms.sh              # 🆕 Run all tests
```

-----

## 🎯 Key Design Principles

### **1. Platform Separation**

```
web/          → Browser-based PWA
desktop/      → Native desktop app (Electron/Tauri)
mobile/       → Native mobile apps (iOS/Android)
public/       → Marketing website
```

### **2. Code Reuse via shared/**

```
shared/
├── models/           → Data structures (all platforms)
├── business-logic/   → Core features (all platforms)
└── utils/            → Helpers (all platforms)
```

**Example:**

```javascript
// In web/modules/recurring/recurringCore.js
import { RecurringEngine } from '../../../shared/business-logic/recurring-engine.js';

// In desktop/src/recurring-manager.js
import { RecurringEngine } from '../shared/business-logic/recurring-engine.js';

// Same logic, different platforms! ✨
```

### **3. Clear Documentation Structure**

```
docs/
├── getting-started/     → Onboarding
├── architecture/        → System design
├── platforms/           → Platform-specific guides
├── features/            → Feature docs
└── guides/              → How-tos
```

### **4. Test Organization by Platform**

```
tests/
├── web/              → Web tests (958 tests ✅)
├── desktop/          → Desktop tests (future)
├── mobile/           → Mobile tests (future)
├── shared/           → Shared code tests
└── e2e/              → Cross-platform tests
```

-----

## 📋 Migration Plan

### **Phase 1: Create Structure (10 minutes)**

```bash
cd miniCycle

# Create public/ for marketing
mkdir -p public/blog/{scripts,posts,docs}
mkdir -p public/styles
mkdir -p public/assets/{images,icons}

# Prepare for future platforms
mkdir -p desktop/{src,build,config}
mkdir -p mobile/{ios,android,shared,config}
mkdir -p shared/{models,business-logic,utils,types,config}

# Reorganize docs
mkdir -p docs/{getting-started,architecture,features,platforms,api,guides,decisions,history}
mkdir -p docs/platforms/{web,desktop,mobile}

# Reorganize tests
mkdir -p tests/{web,desktop,mobile,shared,e2e,fixtures}
mkdir -p tests/web/{unit,integration,automated}
mkdir -p tests/web/unit/{core,task,cycle,recurring,ui}

# Create scripts folder
mkdir scripts
```

### **Phase 2: Move Public/Marketing Files (10 minutes)**

```bash
# Marketing pages
git mv web/product.html public/
git mv web/privacy.html public/
git mv web/terms.html public/
git mv web/user-manual.html public/
git mv web/learn_more.html public/
git mv web/sitemap.xml public/
git mv web/robots.txt public/

# Blog
git mv web/blog.html public/blog/index.html
git mv web/blog/scripts public/blog/
git mv web/blog/posts public/blog/
git mv web/blog/docs public/blog/
git mv web/blog/package.json public/blog/
git mv web/blog/package-lock.json public/blog/ 2>/dev/null || true

# Styles
git mv web/user-manual-styles.css public/styles/user-manual.css

echo "✅ Public files moved"
```

### **Phase 3: Reorganize web/ Folder (5 minutes)**

```bash
cd web

# Rename utilities → modules (clearer for multi-platform)
git mv utilities modules

# Group recurring modules
mkdir -p modules/recurring
git mv modules/recurringCore.js modules/recurring/
git mv modules/recurringPanel.js modules/recurring/
git mv modules/recurringIntegration.js modules/recurring/

# Create core/ folder
mkdir -p modules/core
git mv modules/appState.js modules/core/
git mv modules/appInitialization.js modules/core/appInit.js

# Create features/ folder (optional)
mkdir -p modules/features
git mv modules/dueDates.js modules/features/ 2>/dev/null || true
git mv modules/reminders.js modules/features/ 2>/dev/null || true
git mv modules/themeManager.js modules/features/themes.js 2>/dev/null || true
git mv modules/statsPanel.js modules/features/stats.js 2>/dev/null || true

# Create utils/ folder
mkdir -p modules/utils
git mv modules/globalUtils.js modules/utils/
git mv modules/notifications.js modules/utils/
git mv modules/deviceDetection.js modules/utils/

echo "✅ Web modules reorganized"
```

### **Phase 4: Reorganize Documentation (15 minutes)**

```bash
cd ../docs

# Getting started
git mv WHAT_IS_MINICYCLE.md getting-started/
git mv DEVELOPER_DOCUMENTATION.md getting-started/DEVELOPER_ONBOARDING.md

# Architecture
git mv FINAL-MODULE-STRUCTURE.md architecture/MODULE_STRUCTURE.md
git mv APPINIT_EXPLAINED.md architecture/INITIALIZATION.md
git mv SCHEMA_2_5.md architecture/DATA_SCHEMA.md

# Features
mkdir -p features/recurring-tasks features/drag-drop features/themes features/modes
git mv minicycle-recurring-guide.md features/recurring-tasks/TECHNICAL.md
git mv RECURRING_WATCH_FUNCTION.md features/recurring-tasks/
git mv DRAG_DROP_ARCHITECTURE.md features/drag-drop/ARCHITECTURE.md
git mv DRAG_DROP_LONG_PRESS.md features/drag-drop/CROSS_PLATFORM.md
git mv SAFARI_DRAGDROP_FIX.md features/drag-drop/SAFARI_FIXES.md

# Guides
git mv TESTING_QUICK_REFERENCE.md guides/TESTING.md
git mv UPDATE-VERSION-GUIDE.md guides/VERSION_UPDATE.md
git mv SERVICE_WORKER_UPDATE_STRATEGY.md guides/SERVICE_WORKER.md
git mv MCYC_FILE_FORMAT.md guides/FILE_FORMAT.md

# Decisions
git mv COUPLING_AUDIT_REPORT.md decisions/004-coupling-analysis.md
git mv DECOUPLING_OPTIMIZATION_PLAN.md decisions/005-decoupling-rejected.md 2>/dev/null || true

# History
git mv minicycle_modularization_guide_v4.md history/
git mv minicycle_modularization_lessons_learned.md history/MODULARIZATION_JOURNEY.md
git mv OCTOBER_2025_IMPROVEMENTS.md history/
git mv REMAINING_EXTRACTIONS_ANALYSIS.md history/

echo "✅ Documentation reorganized"
```

### **Phase 5: Reorganize Tests (10 minutes)**

```bash
cd ../tests

# Move to web/ folder
mkdir -p web/unit/{core,task,cycle,recurring,ui}
mkdir -p web/integration
mkdir -p web/automated

# Move test files
git mv appState.test.js web/unit/core/ 2>/dev/null || true
git mv appInit.test.js web/unit/core/ 2>/dev/null || true

git mv taskCore.test.js web/unit/task/
git mv taskDOM.test.js web/unit/task/
git mv taskValidation.test.js web/unit/task/
git mv taskRenderer.test.js web/unit/task/
git mv taskEvents.test.js web/unit/task/
git mv taskUtils.test.js web/unit/task/
git mv dragDropManager.test.js web/unit/task/

git mv cycleLoader.test.js web/unit/cycle/ 2>/dev/null || true
git mv modeManager.test.js web/unit/cycle/ 2>/dev/null || true
git mv cycleSwitcher.test.js web/unit/cycle/ 2>/dev/null || true
git mv migrationManager.test.js web/unit/cycle/ 2>/dev/null || true

git mv recurringCore.test.js web/unit/recurring/
git mv recurringPanel.test.js web/unit/recurring/
git mv recurringIntegration.test.js web/unit/recurring/

git mv modalManager.test.js web/unit/ui/ 2>/dev/null || true
git mv menuManager.test.js web/unit/ui/ 2>/dev/null || true
git mv settingsManager.test.js web/unit/ui/ 2>/dev/null || true
git mv onboardingManager.test.js web/unit/ui/ 2>/dev/null || true
git mv undoRedoManager.test.js web/unit/ui/ 2>/dev/null || true
git mv gamesManager.test.js web/unit/ui/ 2>/dev/null || true

# Move automated tests
mv automated web/ 2>/dev/null || true

# Keep test suite HTML in web/
git mv module-test-suite.html web/
git mv MODULE_TEMPLATE.tests.js web/

# Move remaining test files
mv *.test.js web/unit/ 2>/dev/null || true

echo "✅ Tests reorganized"
```

### **Phase 6: Move Build Scripts (2 minutes)**

```bash
cd ..

# Move version update script
git mv web/update-version.sh scripts/

# Create placeholder scripts
touch scripts/{build-web.sh,build-desktop.sh,build-mobile.sh}
touch scripts/{deploy-web.sh,deploy-desktop.sh,deploy-mobile.sh}
touch scripts/sync-shared-code.sh

chmod +x scripts/*.sh

echo "✅ Scripts organized"
```

### **Phase 7: Update References (20 minutes)**

This is the most important phase - update file paths in:

**1. In `web/miniCycle.html`:**

```html
<!-- Update module imports if needed -->
<script type="module" src="miniCycle-scripts.js?v=1.339"></script>
```

**2. In `web/miniCycle-scripts.js`:**

```javascript
// Update import paths from utilities/ → modules/
import { AppState } from './modules/core/appState.js';
import { TaskCore } from './modules/task/taskCore.js';
// ... etc
```

**3. In `public/` pages:**

```html
<!-- Update links to app -->
<a href="../web/miniCycle.html">Launch App</a>

<!-- Or if serving from root -->
<a href="/app">Launch App</a>
```

**4. In `.github/workflows/test-web.yml`:**

```yaml
# Update test paths
- name: Run tests
  working-directory: ./tests/web
  run: npm test
```

**5. In `public/robots.txt`:**

```
User-agent: *
Allow: /

# Disallow internal folders
Disallow: /web/modules/
Disallow: /web/data/
Disallow: /desktop/
Disallow: /mobile/
Disallow: /shared/
Disallow: /tests/
Disallow: /docs/

# Allow public pages
Allow: /public/
Allow: /web/miniCycle.html
```

**6. In `public/sitemap.xml`:**

```xml
<url>
  <loc>https://minicycle.app/</loc>
  <priority>1.0</priority>
</url>
<url>
  <loc>https://minicycle.app/product</loc>
  <priority>0.9</priority>
</url>
<url>
  <loc>https://minicycle.app/app</loc>
  <priority>0.9</priority>
</url>
```

-----

## 🎯 Benefits of This Structure

### **For Current Development:**

✅ Clear separation between marketing and app
✅ Easy to find web-specific code
✅ Documentation well-organized
✅ Tests organized by platform

### **For Future Platforms:**

✅ Ready for desktop development
✅ Ready for iPhone development
✅ Shared code folder prepared
✅ Each platform independent

### **For Code Sharing:**

```javascript
// Example: Recurring engine used by all platforms

// In shared/business-logic/recurring-engine.js
export class RecurringEngine {
  shouldTaskRecurNow(task, currentTime) {
    // Complex scheduling logic
    // Used by web, desktop, AND mobile!
  }
}

// Web uses it:
// web/modules/recurring/recurringCore.js
import { RecurringEngine } from '../../../shared/business-logic/recurring-engine.js';

// Desktop will use it:
// desktop/src/task-scheduler.js
import { RecurringEngine } from '../shared/business-logic/recurring-engine.js';

// Mobile will use it:
// mobile/shared/TaskScheduler.swift (via bridge)
```

-----

## 🚦 What to Do Now

### **Recommended: Incremental Approach**

**Week 1: Public separation**

- Move marketing/blog to `public/`
- Test that all pages still work
- Update links

**Week 2: Web reorganization**

- Rename `utilities/` → `modules/`
- Reorganize `docs/`
- Update imports

**Week 3: Test reorganization**

- Move tests to platform folders
- Update test runner
- Verify 100% still passing

**Week 4: Prepare for future**

- Create `desktop/` structure
- Create `mobile/` structure
- Create `shared/` structure
- Document code sharing strategy

-----

## ⚠️ Important Notes

### **Server Configuration**

You may need to configure your web server:

**Option 1: Keep flat URLs (easiest)**

```
https://minicycle.app/product.html
https://minicycle.app/miniCycle.html
```

Serve everything from root, no config needed.

**Option 2: Clean URLs (recommended)**

```nginx
# Nginx config
location /app {
    alias /path/to/web/miniCycle.html;
}

location /blog {
    alias /path/to/public/blog;
    index index.html;
}

location / {
    root /path/to/public;
    try_files $uri $uri.html $uri/ =404;
}
```

### **Git Best Practices**

```bash
# Always use git mv to preserve history
git mv old-path new-path

# Commit after each phase
git commit -m "Phase 1: Create folder structure"
git commit -m "Phase 2: Move public files"
# ... etc

# This way you can rollback if needed
git reset --hard HEAD~1  # Undo last commit if something breaks
```

### **Testing After Migration**

```bash
# After each phase, test:

# 1. Web app works
open http://localhost:8080/web/miniCycle.html

# 2. All tests pass
cd tests/web
npm test

# 3. Links work
# Click through public/ pages

# 4. Build works
npm run build  # if you have a build step
```

-----

## 📊 Summary

### **What Changed:**

```
Before:
web/ (everything mixed)

After:
public/     Marketing, blog, legal
web/        Web app (kept name!)
desktop/    Future desktop app
mobile/     Future mobile apps
shared/     Reusable code
docs/       Organized documentation
tests/      Organized by platform
scripts/    Build automation
```

### **What Stayed the Same:**

✅ `web/` folder name (perfect for multi-platform!)
✅ Main files: `miniCycle.html`, `miniCycle-scripts.js`
✅ Your 33 modules (just organized better)
✅ 100% test coverage (just reorganized)

-----

## 🎉 Result

**Same great app, ready for multi-platform expansion!**

Your structure now:

- ✅ Clearly separates platforms
- ✅ Prepares for code reuse
- ✅ Makes finding files easy
- ✅ Scales for desktop & iPhone
- ✅ Maintains backward compatibility

**Total migration time: ~2-3 hours**
**Risk level: Low** (tests will catch issues)
**Benefit: Huge** (ready for multi-platform!)

-----

Would you like me to:

1. Create automated migration scripts?
1. Generate platform-specific setup guides?
1. Show code sharing examples?
1. Create the docs/README.md navigation file?
1. Help with server configuration for clean URLs?