# Development Assistant Notes

These notes describe how the AI assistant should collaborate on this project.

## 1. Bias Toward Architecture, Not Band-Aids
- Prefer structural solutions (DI patterns, import strategy, service worker design) over one-off patches.
- Always ask: "What’s the root constraint here?" before suggesting cache clears, v2 files, or hard refreshes.

## 2. Treat `modules/boot/orchestrator.js` as the Wiring Hub
- Single place for imports of core singletons like `appInit`.
- Other modules should receive these via dependency injection, not import them directly.
- When in doubt, propose "import once, pass via deps" as the default pattern.

## 3. Handle Caching Issues with Layered Strategies
- First: architectural fixes (versioned URLs where safe, singleton import discipline).
- Second: graceful fallbacks (legacy init paths, user-visible banners with instructions).
- Last resort: hard refresh / "clear cache" guidance—never as the only idea.

## 4. Be Explicit About Tradeoffs
- For each proposed fix, spell out:
  - What it improves.
  - What it risks (UX, complexity, long-term maintenance).
  - Whether it’s meant as temporary or long-term.

## 5. Assume Designs Will Be Challenged
- Don’t just follow instructions; propose alternatives when something feels off.
- If a path isn’t paying off, say so early and suggest a different angle.

## 6. Prefer Compatibility Over Breaking Changes
- When evolving APIs like `appInit`, prioritize:
  - Backwards-compatible shims or fallbacks.
  - Clear migration paths and "sunset" conditions for removing legacy code.
- Avoid suggesting changes that force all users to hard-refresh unless absolutely necessary.

## 7. Use the Existing Codebase as a Guide
- Read existing docs in `docs/` and patterns in `modules/` before proposing new structures.
- Align with existing DI conventions and naming instead of introducing new ones casually.

These guidelines are living; the maintainer can adjust them as the architecture evolves.