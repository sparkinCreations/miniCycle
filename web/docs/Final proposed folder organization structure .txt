# miniCycle - Finalized Multi-Platform Structure

**Ready for: Web (current), Desktop (future), Mobile (future)**  
**Status: `shared/` folders created but EMPTY (fill as you build)**

-----

## 📊 Complete Folder Structure

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
├── 📁 public/                              # 🌐 PUBLIC WEBSITE (marketing, blog, legal)
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
│   ├── 📄 README.md                       # 🆕 Web app development guide
│   │
│   ├── 📁 modules/                         # ← Renamed from utilities/
│   │   │
│   │   ├── 📁 core/                        # 🆕 Core system modules
│   │   │   ├── appState.js                # State management
│   │   │   ├── appInit.js                 # ← Renamed from appInitialization.js
│   │   │   └── README.md                  # 🆕 Core modules guide
│   │   │
│   │   ├── 📁 task/                        # Task management system
│   │   │   ├── taskCore.js                # CRUD operations
│   │   │   ├── taskDOM.js                 # Coordination
│   │   │   ├── taskRenderer.js            # DOM creation
│   │   │   ├── taskEvents.js              # Event handling
│   │   │   ├── taskValidation.js          # Validation
│   │   │   ├── taskUtils.js               # Utilities
│   │   │   ├── dragDropManager.js         # Drag & drop
│   │   │   └── README.md                  # 🆕 Task system guide
│   │   │
│   │   ├── 📁 cycle/                       # Cycle management system
│   │   │   ├── cycleCore.js               # CRUD
│   │   │   ├── cycleLoader.js             # Loading
│   │   │   ├── cycleSwitcher.js           # Switching
│   │   │   ├── modeManager.js             # Modes
│   │   │   ├── migrationManager.js        # Migrations
│   │   │   └── README.md                  # 🆕 Cycle system guide
│   │   │
│   │   ├── 📁 recurring/                   # 🆕 Recurring tasks system
│   │   │   ├── recurringCore.js           # Business logic
│   │   │   ├── recurringPanel.js          # UI
│   │   │   ├── recurringIntegration.js    # Integration
│   │   │   └── README.md                  # 🆕 Recurring system guide
│   │   │
│   │   ├── 📁 ui/                          # UI coordination
│   │   │   ├── modalManager.js
│   │   │   ├── menuManager.js
│   │   │   ├── settingsManager.js
│   │   │   ├── onboardingManager.js
│   │   │   ├── undoRedoManager.js
│   │   │   ├── gamesManager.js
│   │   │   └── README.md                  # 🆕 UI modules guide
│   │   │
│   │   ├── 📁 features/                    # 🆕 Optional/pluggable features
│   │   │   ├── dueDates.js
│   │   │   ├── reminders.js
│   │   │   ├── themes.js
│   │   │   ├── stats.js
│   │   │   └── README.md                  # 🆕 Features guide
│   │   │
│   │   └── 📁 utils/                       # Shared utilities
│   │       ├── globalUtils.js
│   │       ├── notifications.js
│   │       ├── deviceDetection.js
│   │       ├── storage.js
│   │       └── README.md                  # 🆕 Utils guide
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
├── 📁 desktop/                             # 🆕 DESKTOP APPLICATION (future - structure ready)
│   │
│   ├── 📄 README.md                        # Desktop app development guide
│   │
│   ├── 📁 src/                             # Desktop-specific code (empty for now)
│   │   └── README.md                      # What goes here
│   │
│   ├── 📁 build/                           # Build configuration (empty for now)
│   │   └── README.md                      # Build assets guide
│   │
│   └── 📁 config/                          # Build configs (empty for now)
│       └── README.md                      # Configuration guide
│
├── 📁 mobile/                              # 🆕 MOBILE APPS (future - structure ready)
│   │
│   ├── 📄 README.md                        # Mobile development guide
│   │
│   ├── 📁 ios/                             # iOS app (empty for now)
│   │   └── README.md                      # iOS development guide
│   │
│   ├── 📁 android/                         # Android app (empty for now)
│   │   └── README.md                      # Android development guide
│   │
│   ├── 📁 shared/                          # Shared mobile code (empty for now)
│   │   └── README.md                      # Mobile shared code guide
│   │
│   └── 📁 config/                          # Mobile build configs (empty for now)
│       └── README.md                      # Mobile config guide
│
├── 📁 shared/                              # 🆕 SHARED CODE (structure ready, EMPTY for now)
│   │
│   ├── 📄 README.md                        # ⚠️ IMPORTANT: Read before adding code here!
│   │
│   ├── 📁 models/                          # 🔜 Data models (fill when desktop starts)
│   │   └── README.md                      # What models go here
│   │
│   ├── 📁 business-logic/                  # 🔜 Core business logic (fill when desktop starts)
│   │   └── README.md                      # What logic goes here
│   │
│   ├── 📁 utils/                           # 🔜 Shared utilities (fill when desktop starts)
│   │   └── README.md                      # What utils go here
│   │
│   ├── 📁 types/                           # 🔜 TypeScript types (optional future)
│   │   └── README.md                      # Type definitions guide
│   │
│   └── 📁 config/                          # 🔜 Shared configuration (fill when desktop starts)
│       └── README.md                      # Shared config guide
│
├── 📁 docs/                                # 📚 DOCUMENTATION (organized by topic)
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
│   │   │   ├── DEVELOPMENT.md             # Desktop development (future)
│   │   │   ├── DISTRIBUTION.md            # App signing & distribution
│   │   │   └── NATIVE_APIS.md             # Native API usage
│   │   └── mobile/
│   │       ├── IOS_DEVELOPMENT.md         # iOS development (future)
│   │       ├── ANDROID_DEVELOPMENT.md     # Android development (future)
│   │       └── APP_STORE.md               # App store submission
│   │
│   ├── 📁 api/                             # API reference
│   │   ├── README.md
│   │   ├── TASK_API.md
│   │   ├── CYCLE_API.md
│   │   ├── STATE_API.md
│   │   └── SHARED_API.md                  # 🆕 Shared code APIs (future)
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
│   │   └── 005-shared-code-strategy.md    # 🆕 When to use shared/
│   │
│   └── 📁 history/                         # Historical documentation
│       ├── MODULARIZATION_JOURNEY.md
│       ├── OCTOBER_2025_IMPROVEMENTS.md
│       └── DECOUPLING_PLAN.md             # (Rejected plan - for reference)
│
├── 📁 tests/                               # 🧪 TEST SUITE (organized by platform)
│   │
│   ├── 📄 README.md                        # Testing overview & guidelines
│   ├── 📄 test-config.js                   # 🆕 Shared test configuration
│   │
│   ├── 📁 web/                             # Web-specific tests
│   │   ├── 📄 README.md                    # Web testing guide
│   │   ├── module-test-suite.html         # Manual test UI
│   │   ├── MODULE_TEMPLATE.tests.js       # Test template
│   │   │
│   │   ├── unit/                          # 🆕 Web unit tests
│   │   │   ├── core/
│   │   │   │   ├── appState.test.js
│   │   │   │   └── appInit.test.js
│   │   │   ├── task/
│   │   │   │   ├── taskCore.test.js
│   │   │   │   ├── taskDOM.test.js
│   │   │   │   ├── taskRenderer.test.js
│   │   │   │   ├── taskEvents.test.js
│   │   │   │   ├── taskValidation.test.js
│   │   │   │   ├── taskUtils.test.js
│   │   │   │   └── dragDropManager.test.js
│   │   │   ├── cycle/
│   │   │   │   ├── cycleCore.test.js
│   │   │   │   ├── cycleLoader.test.js
│   │   │   │   ├── cycleSwitcher.test.js
│   │   │   │   ├── modeManager.test.js
│   │   │   │   └── migrationManager.test.js
│   │   │   ├── recurring/
│   │   │   │   ├── recurringCore.test.js
│   │   │   │   ├── recurringPanel.test.js
│   │   │   │   └── recurringIntegration.test.js
│   │   │   ├── ui/
│   │   │   │   ├── modalManager.test.js
│   │   │   │   ├── menuManager.test.js
│   │   │   │   ├── settingsManager.test.js
│   │   │   │   ├── onboardingManager.test.js
│   │   │   │   ├── undoRedoManager.test.js
│   │   │   │   └── gamesManager.test.js
│   │   │   └── features/
│   │   │       ├── dueDates.test.js
│   │   │       ├── reminders.test.js
│   │   │       └── themes.test.js
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
│   ├── 📁 desktop/                         # 🆕 Desktop tests (empty - future)
│   │   ├── 📄 README.md                    # Desktop testing guide
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   │
│   ├── 📁 mobile/                          # 🆕 Mobile tests (empty - future)
│   │   ├── 📄 README.md                    # Mobile testing guide
│   │   ├── ios/
│   │   ├── android/
│   │   └── shared/
│   │
│   ├── 📁 shared/                          # 🆕 Shared code tests (empty - future)
│   │   ├── 📄 README.md                    # Shared code testing guide
│   │   ├── models/
│   │   ├── business-logic/
│   │   └── utils/
│   │
│   ├── 📁 e2e/                             # 🆕 Cross-platform E2E (empty - future)
│   │   ├── README.md
│   │   └── user-flows.test.js
│   │
│   └── 📁 fixtures/                        # 🆕 Test data
│       ├── README.md                      # Test data guide
│       ├── sample-state.json
│       ├── sample-cycles.json
│       └── sample-tasks.json
│
└── 📁 scripts/                             # 🛠️ BUILD & UTILITY SCRIPTS
    │
    ├── 📄 README.md                        # 🆕 Scripts documentation
    │
    ├── update-version.sh                  # Version management
    ├── build-web.sh                       # 🆕 Build web app (placeholder)
    ├── build-desktop.sh                   # 🆕 Build desktop app (future)
    ├── build-mobile.sh                    # 🆕 Build mobile apps (future)
    ├── build-all.sh                       # 🆕 Build all platforms (future)
    │
    ├── deploy-web.sh                      # 🆕 Deploy web app (placeholder)
    ├── deploy-desktop.sh                  # 🆕 Publish desktop app (future)
    ├── deploy-mobile.sh                   # 🆕 Submit to app stores (future)
    │
    ├── sync-shared-code.sh                # 🆕 Sync shared code (future)
    ├── validate-structure.js              # 🆕 Check structure compliance
    ├── generate-icons.sh                  # 🆕 Generate app icons (future)
    └── test-all-platforms.sh              # 🆕 Run all tests
```

-----

## 🎯 Key Points

### **✅ What’s Ready Now**

1. **Structure is complete** - All folders created
1. **Web app stays in `web/`** - Clear separation
1. **Marketing in `public/`** - Different purpose
1. **Documentation organized** - Easy to navigate
1. **Tests organized by platform** - Clear structure

### **🔜 What’s Empty (By Design)**

1. **`shared/` folders** - Will fill when desktop starts
1. **`desktop/` code** - Structure ready, no code yet
1. **`mobile/` code** - Structure ready, no code yet
1. **Future test folders** - Structure ready

### **📋 README.md Files to Create**

Each empty folder needs a README.md explaining:

- What code belongs here
- When to add code here
- Examples of what to add

**I’ll create these README.md files separately if you’d like!**

-----

## 🚀 Migration Checklist

### **Phase 1: Create Structure ✅**

```bash
# All folders created
# All READMEs need to be written
```

### **Phase 2: Move Public Files**

```bash
git mv web/product.html public/
git mv web/blog.html public/blog/index.html
git mv web/privacy.html public/
git mv web/terms.html public/
git mv web/user-manual.html public/
git mv web/learn_more.html public/
git mv web/sitemap.xml public/
git mv web/robots.txt public/
git mv web/blog public/blog/
git mv web/user-manual-styles.css public/styles/user-manual.css
```

### **Phase 3: Reorganize Web**

```bash
cd web
git mv utilities modules
git mv modules/appInitialization.js modules/core/appInit.js
git mv modules/appState.js modules/core/
# ... organize into subfolders
```

### **Phase 4: Reorganize Docs**

```bash
cd docs
# Move files into appropriate folders
# (see migration plan)
```

### **Phase 5: Reorganize Tests**

```bash
cd tests
mkdir -p web/unit/{core,task,cycle,recurring,ui,features}
# Move test files to appropriate folders
```

### **Phase 6: Update Imports**

```bash
# Find and replace in all files:
# './utilities/' → './modules/'
# Run tests after each change
```

### **Phase 7: Create READMEs**

```bash
# Write README.md for each major folder
# Explain purpose and guidelines
```

-----

## 📝 Important Guidelines

### **For `shared/` Folder**

**⚠️ DO NOT add code here yet!**

Wait until:

1. You start desktop development
1. You see actual duplication
1. You understand platform differences

**Then extract strategically:**

- Pure data models (Task, Cycle)
- Pure business logic (calculations, algorithms)
- Platform-agnostic utilities

**Keep in `web/modules/`:**

- DOM manipulation
- Browser APIs (localStorage, etc.)
- Web-specific features

### **For `desktop/` and `mobile/`**

These are **placeholders** for now:

- Structure is ready
- READMEs explain what goes here
- No code until you start those platforms

-----

## 🎉 Benefits

### **Immediate**

✅ Clear separation of concerns
✅ Marketing vs app clearly divided
✅ Documentation organized
✅ Tests organized by platform
✅ No more “where does this go?”

### **Future**

✅ Desktop: Just start coding in `desktop/`
✅ iPhone: Just start coding in `mobile/ios/`
✅ Code sharing: Extract to `shared/` when ready
✅ No future reorganizations needed

-----

## 📚 Next Steps

1. **Run the migration** (follow phases above)
1. **Write README.md files** (I can help!)
1. **Update imports** (find/replace `utilities` → `modules`)
1. **Test everything** (make sure all 958 tests pass)
1. **Continue building web** (knowing structure is ready)

-----

Would you like me to:

1. ✅ Generate the README.md files for empty folders?
1. ✅ Create a migration script?
1. ✅ Write the import update script?
1. ✅ Create guidelines for when to use `shared/`?