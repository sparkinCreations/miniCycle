# Games Folder Refactor Plan

**Status:** ✅ Complete (November 14, 2025)
**Priority:** Low
**Actual Effort:** ~2 minutes
**Breaking Changes:** Minor (URL change only) - Mitigated with redirect

---

## 🎯 Overview

Simplify the games folder name from `miniCycleGames/` to `games/` for consistency and clarity.

### The Problem

**Current structure:**
```
web/
├── miniCycleGames/          # ❌ Redundant "miniCycle" prefix
│   ├── miniCycle-taskGame.html
│   ├── miniCycle-taskOrder.html
│   └── miniCycle-taskScramble.html
```

**Issues:**
- Folder name has redundant `miniCycle` prefix (we're already in the miniCycle project)
- Inconsistent with other folders (`pages/`, `legal/`, `docs/`, not `miniCyclePages/`)
- Unnecessarily verbose
- Files inside already have `miniCycle-` prefix, so folder prefix is redundant

---

## ✅ Proposed Structure

```
web/
├── games/                   # ✅ Clean, simple folder name
│   ├── miniCycle-taskGame.html      # Files keep their names
│   ├── miniCycle-taskOrder.html
│   └── miniCycle-taskScramble.html
```

**Benefits:**
- Consistent with other folder naming (`pages/`, `legal/`, `docs/`)
- Shorter, cleaner URLs: `/games/miniCycle-taskOrder.html`
- Less redundant (folder doesn't need `miniCycle` when files already have it)
- Easier to type and reference

---

## 📝 Changes Required

### 1. Folder Rename

```bash
mv miniCycleGames/ games/
```

### 2. Code References Update

**Only 1 active file needs updating:**

**File:** `modules/ui/gamesManager.js`

```javascript
// OLD (Line ~100-150)
window.location.href = "miniCycleGames/miniCycle-taskOrder.html";

// NEW
window.location.href = "games/miniCycle-taskOrder.html";
```

**Backup files** (in `/backup/` and `/archive/`) also have references, but these are historical and don't need updating since they're not used in production.

### 3. URL Redirect (Optional, Recommended)

Add to `_redirects` file for backward compatibility:

```
# Games folder redirect (for old bookmarks/links)
/miniCycleGames/*  /games/:splat  301
```

This ensures any old links or bookmarks continue to work.

---

## 🔄 Implementation Steps

### Step 1: Preparation (5 minutes)

1. **Verify current usage:**
   ```bash
   # Check if any production code references miniCycleGames
   grep -r "miniCycleGames" modules/ miniCycle-scripts.js
   ```

2. **Run baseline tests:**
   ```bash
   npm test  # Verify all 1070 tests passing
   ```

### Step 2: Rename Folder (2 minutes)

```bash
cd /Users/mjaynumberone/Documents/Programs/Code/miniCycle/web
mv miniCycleGames games
```

### Step 3: Update Code Reference (5 minutes)

Update `modules/ui/gamesManager.js`:

```javascript
// Find the line (around line 100-150)
window.location.href = "miniCycleGames/miniCycle-taskOrder.html";

// Replace with
window.location.href = "games/miniCycle-taskOrder.html";
```

### Step 4: Add URL Redirect (5 minutes)

Add to `_redirects` file:

```
# Games folder redirect
/miniCycleGames/*  /games/:splat  301
```

### Step 5: Testing (10-15 minutes)

1. **Manual test games menu:**
   - Open miniCycle
   - Click the games button (achievement unlock)
   - Verify game opens at new URL: `/games/miniCycle-taskOrder.html`

2. **Test redirect (if added):**
   - Visit old URL: `/miniCycleGames/miniCycle-taskOrder.html`
   - Verify redirects to: `/games/miniCycle-taskOrder.html`

3. **Run test suite:**
   ```bash
   npm test  # Verify still 1070/1070 passing
   ```

### Step 6: Documentation (5 minutes)

No documentation updates needed - games folder isn't documented extensively.

Optional: Update FOLDER_STRUCTURE.md if it mentions the games folder.

---

## ⚠️ Risks & Mitigation

### Risk 1: Broken Bookmarks
**Impact:** Low - Users with bookmarked game URLs won't find them
**Likelihood:** Very Low - Games are accessed via app menu, not direct URLs
**Mitigation:**
- Add redirect in `_redirects` (recommended)
- OR: Accept this (games are rarely bookmarked)

### Risk 2: Search Engine Indexed URLs
**Impact:** Very Low - Games aren't publicly indexed
**Likelihood:** Very Low - Games require app authentication/achievement unlock
**Mitigation:** 301 redirect handles this automatically

### Risk 3: Code References
**Impact:** Medium - Game won't open if path is wrong
**Likelihood:** Very Low - Only 1 file references the path
**Mitigation:**
- Update the single reference in gamesManager.js
- Test manually after change

---

## ✅ Success Criteria

- [ ] Folder renamed: `miniCycleGames/` → `games/`
- [ ] Code updated: `gamesManager.js` path corrected
- [ ] Redirect added: `_redirects` file updated (optional)
- [ ] Manual test: Games menu opens game correctly
- [ ] All 1070 tests passing
- [ ] No console errors
- [ ] Old URL redirects (if redirect added)

---

## 📊 Impact Assessment

### Files Changed: 2-3 files
- Folder rename (directory structure)
- `modules/ui/gamesManager.js` (1 line change)
- `_redirects` (1 line addition, optional)

### Lines Changed: 1-2 lines
- 1 line in gamesManager.js
- 1 line in _redirects (optional)

### Time Investment: 30-60 minutes
- Very low-risk, simple refactor
- Mostly manual testing time

### Risk Level: Very Low
- Only 1 active code reference
- Easy to verify
- Simple rollback (just rename folder back)
- Optional redirect provides safety net

---

## 🔗 Related Work

This refactor aligns with other clarity improvements:

1. **Schema 2.6** - `cycles` → `routine` terminology
2. **Folder Structure Refactor** - `modules/cycle/` → `modules/routine/`
3. **This change** - `miniCycleGames/` → `games/`

**Combined message:** Simpler, clearer naming throughout the project.

---

## 💡 Alternative: Do Nothing

**Pros:**
- Zero effort
- No risk
- Everything works

**Cons:**
- Folder name remains verbose
- Inconsistent with other folders
- Missed opportunity for cleanup

**Verdict:** The change is so simple (30-60 min) that the cleanup benefit outweighs the "do nothing" approach.

---

## 🚀 When to Implement

### Good Times:
- ✅ **After Schema 2.6 + Folder Structure Refactor** - Bundle clarity improvements together
- ✅ **During a general cleanup sprint** - Include with other minor improvements
- ✅ **Low-priority downtime** - Easy win when you have 30-60 minutes

### Bad Times:
- ❌ **Right before a major release** - Not worth the risk, even if small
- ❌ **During active feature development** - Don't mix with other work
- ❌ **When rushing** - Simple changes still need testing

**Recommendation:** Bundle with Schema 2.6 / Folder Structure Refactor for a "Complete Clarity Update" release.

---

## 📝 Implementation Checklist

### Pre-Implementation
- [ ] Read this plan
- [ ] Verify gamesManager.js references miniCycleGames
- [ ] Check _redirects file exists
- [ ] Run baseline tests (1070/1070)

### Implementation
- [ ] Rename folder: `mv miniCycleGames games`
- [ ] Update gamesManager.js path
- [ ] Add redirect to _redirects (optional)
- [ ] Test games menu manually
- [ ] Run full test suite

### Verification
- [ ] Games open correctly from menu
- [ ] Old URL redirects (if redirect added)
- [ ] No console errors
- [ ] All 1070 tests passing
- [ ] Git commit with clear message

---

## 📄 Example Git Commit Message

```
refactor: Rename miniCycleGames to games folder

- Simplifies folder naming for consistency
- Updates gamesManager.js reference
- Adds 301 redirect for backward compatibility

Files changed:
- miniCycleGames/ → games/ (folder rename)
- modules/ui/gamesManager.js (path update)
- _redirects (redirect added)

Impact: No breaking changes, old URLs redirect automatically
Tests: All 1070 tests passing ✅
```

---

**Last Updated:** November 14, 2025
**Status:** Ready for implementation
**Estimated Completion:** 30-60 minutes
**Can bundle with:** Schema 2.6, Folder Structure Refactor
