# Development Assistant Notes

**Last Updated:** January 17, 2026

These notes describe how the AI assistant should collaborate on this project.

## 1. Bias Toward Architecture, Not Band-Aids
- Prefer structural solutions (DI patterns, import strategy, service worker design) over one-off patches.
- Always ask: "What's the root constraint here?" before suggesting cache clears, v2 files, or hard refreshes.

## 2. DI Wiring Location
- **`modules/boot/featureBoot.js`** is the DI wiring hub (not orchestrator.js).
- `orchestrator.js` is a pure sequence controller - no DI writes, no DOM queries.
- Other modules should receive dependencies via injection, not import them directly.
- When in doubt, propose "import once, pass via deps" as the default pattern.

## 3. Zero Window.* Globals (Achieved Jan 2026)
- The codebase has **zero custom `window.*` globals**.
- Use `appContext.js` grouped APIs for cross-module access.
- Use CustomEvents for HTML-to-module communication.
- Never suggest adding `window.*` globals - use DI instead.

## 4. Handle Caching Issues with Layered Strategies
- First: architectural fixes (versioned URLs where safe, singleton import discipline).
- Second: graceful fallbacks (legacy init paths, user-visible banners with instructions).
- Last resort: hard refresh / "clear cache" guidance—never as the only idea.

## 5. Be Explicit About Tradeoffs
- For each proposed fix, spell out:
  - What it improves.
  - What it risks (UX, complexity, long-term maintenance).
  - Whether it's meant as temporary or long-term.

## 6. Assume Designs Will Be Challenged
- Don't just follow instructions; propose alternatives when something feels off.
- If a path isn't paying off, say so early and suggest a different angle.

## 7. Prefer Compatibility Over Breaking Changes
- When evolving APIs like `appInit`, prioritize:
  - Backwards-compatible shims or fallbacks.
  - Clear migration paths and "sunset" conditions for removing legacy code.
- Avoid suggesting changes that force all users to hard-refresh unless absolutely necessary.

## 8. Use the Existing Codebase as a Guide
- Read existing docs in `docs/` and patterns in `modules/` before proposing new structures.
- Align with existing DI conventions and naming instead of introducing new ones casually.

## 9. Consistent Patterns (Dec 2025)
- **safeAddEventListener** - All 103 modules use DI-injected `safeAddEventListener` for event handling.
- **State-based UI** - Prefer updating AppState and re-rendering from state over direct DOM manipulation.
- **Object.defineProperties** - Always use this for DI setters to preserve lazy getters.

These guidelines are living; the maintainer can adjust them as the architecture evolves.