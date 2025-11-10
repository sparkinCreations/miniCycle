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

## Structure

- `src/` - Desktop-specific code (main process, native integrations)
- `build/` - Build configuration (icons, installers)
- `config/` - Desktop app configuration

## Integration with Web Code

The desktop app will:
1. Reuse `web/modules/` for most logic
2. Use `shared/` for extracted common code
3. Add desktop-specific features in `desktop/src/`

## Desktop-specific features:
- System tray icon
- Global keyboard shortcuts
- Native file system access
- Auto-start on login
- Native notifications
