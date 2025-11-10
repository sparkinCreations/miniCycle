# Shared Code

⚠️ **IMPORTANT: This folder is currently EMPTY by design.**

## Purpose

This folder is for code shared across **multiple platforms** (web, desktop, mobile).

## When to Add Code Here

**Wait until:**
1. You've started development on a second platform (desktop or mobile)
2. You see actual code duplication between platforms
3. You understand the differences between platforms

**Then extract:**
- Pure data models (Task, Cycle, RecurringTemplate)
- Pure business logic (task cycling, recurring calculations)
- Platform-agnostic utilities (date formatting, ID generation)

## What NOT to Put Here

**Keep in platform-specific folders:**
- DOM manipulation (web-specific)
- Browser APIs (localStorage, service worker)
- Native APIs (Electron, Tauri, React Native)
- UI components (platform-specific rendering)
- Platform-specific features

## Structure

- `models/` - Data models (Task, Cycle, etc.)
- `business-logic/` - Core algorithms and calculations
- `utils/` - Shared utilities
- `types/` - TypeScript type definitions (future)
- `config/` - Shared configuration

## Testing

When you add code to `shared/`, create tests that run on all platforms.
