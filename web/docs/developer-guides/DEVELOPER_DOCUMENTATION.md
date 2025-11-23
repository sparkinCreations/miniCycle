# miniCycle - Developer Documentation Hub

**Version**: 1.373
**Service Worker**: v82
**Last Updated**: November 23, 2025
**Modularization Status**: ✅ COMPLETE (74.8% reduction achieved!)
**Test Status**: ✅ 1011/1011 tests passing (100%) - All platforms
**Target Audience**: Developers, Contributors, Technical Partners

---

## Welcome!

Welcome to the miniCycle developer documentation. This hub provides quick access to all developer guides. Each guide is focused on a specific topic to make finding information easier.

---

## Quick Navigation

### Getting Started
- **[Getting Started Guide](GETTING_STARTED.md)** - Get running in 2 minutes, understand the cycling philosophy

### Architecture & Concepts
- **[Architecture Overview](ARCHITECTURE_OVERVIEW.md)** - System structure, core concepts, and real code examples
- **[Module System Guide](MODULE_SYSTEM_GUIDE.md)** - The 4 module patterns and when to use each
- **[AppInit System](APPINIT_SYSTEM.md)** - 2-phase initialization to prevent race conditions
- **[Data Schema Guide](DATA_SCHEMA_GUIDE.md)** - Schema 2.5 structure and data flow

### Development
- **[API Reference](API_REFERENCE.md)** - Global functions and module APIs
- **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Making changes, version management, deployment
- **[Testing Guide](TESTING_GUIDE.md)** - Running tests, writing tests, CI/CD
- **[Security Guide](SECURITY_GUIDE.md)** - XSS prevention, security patterns, event flow

---

## Documentation Structure

### Core Guides (Start Here)

1. **[GETTING_STARTED.md](GETTING_STARTED.md)**
   - Quick start for developers (2 minutes)
   - Mobile device testing over WiFi
   - Your first code change
   - The "Cycling" philosophy explained

2. **[ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md)**
   - Current stats and modularization status
   - Technology stack
   - Project structure (simplified)
   - 6 core concepts with real code examples:
     - Task Cycling System
     - Centralized State Management (AppState)
     - Recurring Tasks System
     - Undo/Redo System
     - Task Options Customizer
     - Mode Manager

3. **[MODULE_SYSTEM_GUIDE.md](MODULE_SYSTEM_GUIDE.md)**
   - The 4 module patterns:
     - Static Utilities (Pure Functions)
     - Simple Instance (Self-Contained)
     - Resilient Constructor (Graceful Degradation)
     - Strict Injection (Fail Fast)
   - Pattern selection guide
   - Real code examples from the codebase

### Essential Systems

4. **[APPINIT_SYSTEM.md](APPINIT_SYSTEM.md)**
   - 2-phase initialization system
   - Preventing race conditions
   - 3 usage patterns with examples
   - Plugin system & hooks
   - Debug commands
   - Testing integration

5. **[DATA_SCHEMA_GUIDE.md](DATA_SCHEMA_GUIDE.md)**
   - Complete Schema 2.5 structure
   - How data flows through the app
   - Real example: Adding a task
   - Task options, recurring templates, user progress

6. **[API_REFERENCE.md](API_REFERENCE.md)**
   - Global functions (task, cycle, state, UI, undo/redo)
   - Module APIs (notifications, stats, recurring, themes, modes)
   - Quick reference with examples

### Practical Development

7. **[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md)**
   - Making changes (JavaScript, modules, styles)
   - Testing your changes
   - Version management (update-version.sh)
   - Deployment process
   - Common tasks & how-tos:
     - Add new task type
     - Add new theme
     - Add keyboard shortcut
   - Troubleshooting common issues

8. **[TESTING_GUIDE.md](TESTING_GUIDE.md)**
   - Manual testing (browser-based)
   - Automated testing (Playwright)
   - GitHub Actions CI/CD
   - Creating new tests
   - Test patterns and best practices
   - Test coverage (1011 tests, 100% passing)

9. **[SECURITY_GUIDE.md](SECURITY_GUIDE.md)**
   - XSS (Cross-Site Scripting) prevention
   - Input sanitization patterns
   - Safe vs unsafe patterns
   - Security checklist for new features
   - Verified secure modules
   - Event flow & UI state patterns
   - Reporting security issues

---

## Key Statistics (November 2025)

| Metric | Value | Notes |
|--------|-------|-------|
| **Main Script** | 3,674 lines | Down from 15,677 (74.8% reduction) ✅ |
| **Modules** | 33 modules | All major systems modularized! |
| **Schema Version** | 2.5 | Auto-migration from older versions |
| **App Version** | 1.373 | Stable production release |
| **Service Worker** | v82 | PWA cache version |
| **Browser Support** | Modern + ES5 | Dual-version system |
| **Test Coverage** | 100% ✅ | 1011/1011 tests passing |
| **Test Modules** | 33 modules | Comprehensive coverage |
| **Platforms Tested** | Mac, iPad, iPhone | Cross-platform validated |

---

## Quick Reference

### Essential Commands

```bash
# Development
python3 -m http.server 8080          # Start local server
npm start                             # Alternative server start

# Testing
npm test                              # Run all 1011 tests (automated)
npm run test:watch                    # Watch mode
npm run test:coverage                 # Coverage report

# Version Management
./update-version.sh                   # Update app & SW versions

# Access Points
http://localhost:8080/miniCycle.html  # Full version
http://localhost:8080/lite/miniCycle-lite.html  # ES5 version
http://localhost:8080/tests/module-test-suite.html  # Tests
```

### Key Concepts at a Glance

1. **Task Cycling** - Tasks reset instead of being deleted
2. **AppState** - Centralized state with 600ms debounced saves
3. **Recurring Tasks** - Template-based, checked every 30 seconds
4. **Undo/Redo** - Per-cycle history with IndexedDB persistence (20 snapshots each)
5. **Module Patterns** - 4 patterns: Static, Simple Instance, Resilient, Strict Injection
6. **Schema 2.5** - Current data format with automatic migration
7. **AppInit** - 2-phase initialization prevents race conditions

---

## Recent Major Updates

**v1.373 (November 23, 2025):**
- ✅ Mode Manager - Enhanced UI refresh without page reload
- ✅ Task Options Customizer - Real-time saving, reopen after reload
- ✅ Testing - Dark mode toggle and module filtering
- ✅ Performance - Debounced task button refresh (150ms)

**v1.372 (November 22, 2025):**
- ✅ Mode Manager - In-place UI refresh, mode restoration via sessionStorage
- ✅ Task Options Customizer - Mobile tap preview, enhanced reminders integration

**v1.370 (November 18, 2025):**
- ✅ Delete When Complete - New button option for auto-removing tasks

**v1.357 (November 15, 2025):**
- ✅ Task Options Customizer - Per-cycle button visibility customization
- ✅ Schema 2.5 enhancements - taskOptionButtons per cycle
- ✅ Test suite - 1011 tests across 33 modules

---

## Related Documentation

### Architecture Docs
- **[UNDO_REDO_ARCHITECTURE.md](../architecture/UNDO_REDO_ARCHITECTURE.md)** - Complete undo/redo system
- **[MODE_MANAGER_ARCHITECTURE.md](../architecture/MODE_MANAGER_ARCHITECTURE.md)** - Three operating modes
- **[EVENT_FLOW_PATTERNS.md](../architecture/EVENT_FLOW_PATTERNS.md)** - Event coordination patterns
- **[DRAG_DROP_ARCHITECTURE.md](../architecture/DRAG_DROP_ARCHITECTURE.md)** - Drag & drop system

### Feature Docs
- **[TASK_OPTIONS_CUSTOMIZER.md](../features/TASK_OPTIONS_CUSTOMIZER.md)** - Per-cycle button customization

### Other
- **[CLAUDE.md](../CLAUDE.md)** - AI assistant architecture overview
- **[FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md)** - Complete organization documentation
- **[DEPLOYMENT.md](../deployment/DEPLOYMENT.md)** - Deployment guide

---

## Contributing

### Before Making Changes

1. Read **[Getting Started](GETTING_STARTED.md)** - Understand the basics
2. Review **[Architecture Overview](ARCHITECTURE_OVERVIEW.md)** - Know the system
3. Check **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Follow best practices
4. Run **[Tests](TESTING_GUIDE.md)** - Ensure nothing breaks

### Security

- Read **[Security Guide](SECURITY_GUIDE.md)** before handling user input
- Always use `textContent` over `innerHTML`
- Sanitize and validate all user-generated content
- Report security issues privately to security@sparkincreations.com

---

## Support & Community

- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Email security@sparkincreations.com for vulnerabilities
- **Documentation**: This hub and linked guides

---

## License & Maintenance

**Maintained By**: sparkinCreations
**License**: [See LICENSE file](../../LICENSE)
**Repository**: [GitHub](https://github.com/sparkincreations/miniCycle)

---

## Quick Links

**Live URLs:**
- Official: [minicycleapp.com](https://minicycleapp.com)
- Full App: [minicycle.app/miniCycle.html](https://minicycle.app/miniCycle.html)
- Lite Version: [minicycle.app/lite/miniCycle-lite.html](https://minicycle.app/lite/miniCycle-lite.html)
- Tests: [minicycle.app/tests/module-test-suite.html](https://minicycle.app/tests/module-test-suite.html)

**Documentation:**
- Developer Guides: `/docs/developer-guides/` (you are here!)
- Architecture Docs: `/docs/architecture/`
- Feature Docs: `/docs/features/`
- User Manual: `/legal/user-manual.html`

---

**Questions?** Start with [Getting Started](GETTING_STARTED.md) or browse the guides above!
