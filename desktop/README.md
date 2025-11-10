# Desktop Application

⚠️ **This folder is currently empty - reserved for future desktop app.**

## Purpose

This will contain the desktop application built with:
- **Electron** (recommended) - Cross-platform (Windows, macOS, Linux)
- **Tauri** (alternative) - Smaller bundle size, Rust-based

## When to Start

Start desktop development when:
1. Web app is stable and feature-complete
2. Desktop-specific features are needed (menu bar app, system tray, etc.)
3. Offline-first desktop experience is priority
4. Users request a native desktop experience

## Structure

- `src/` - Desktop-specific code (main process, native integrations)
- `build/` - Build configuration (icons, installers)
- `config/` - Desktop app configuration

## Integration with Web Code

The desktop app will:
1. Reuse `web/modules/` for most logic
2. Use `shared/` for extracted common code
3. Add desktop-specific features in `desktop/src/`

## Getting Started (Future)

### Electron Approach

```bash
# When ready to start:
cd desktop
npm init
npm install electron

# Create main process
# Create renderer process (can reuse web app)
# Package for distribution
```

### Tauri Approach

```bash
# When ready to start:
cd desktop
npm create tauri-app

# Follow Tauri quick start
# Integrate with web app
```

## Desktop-Specific Features

Examples of what would go here:
- System tray icon and menu
- Global keyboard shortcuts
- Native file system access
- Auto-start on login
- Native notifications
- Menu bar integration
- Dock/taskbar integration
- Native context menus

## Distribution

When ready to distribute:
- Code signing (macOS, Windows)
- Auto-updates
- App store submissions (Mac App Store, Microsoft Store)
- Linux package managers

## Questions to Answer Before Starting

1. Which framework? (Electron vs Tauri)
2. Which features justify a desktop app?
3. How will data sync with web version?
4. What's the update strategy?
5. What platforms to support first?
