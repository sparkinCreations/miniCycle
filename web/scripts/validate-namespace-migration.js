#!/usr/bin/env node

/**
 * Namespace Migration Validator
 *
 * Scans miniCycle-scripts.js for remaining direct global calls that should
 * be migrated to the namespace API (window.miniCycle.*).
 *
 * Usage:
 *   node scripts/validate-namespace-migration.js
 *
 * Exit codes:
 *   0 - No violations found (Step 0 complete!)
 *   1 - Violations found (migration in progress)
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Read main script
const scriptPath = path.join(__dirname, '../miniCycle-scripts.js');

if (!fs.existsSync(scriptPath)) {
  console.error(`${colors.red}❌ Error: miniCycle-scripts.js not found at ${scriptPath}${colors.reset}`);
  process.exit(1);
}

const mainScript = fs.readFileSync(scriptPath, 'utf8');
const lines = mainScript.split('\n');

// Intentional wrapper functions (allowlist)
// These are backward-compatibility wrappers that delegate to the namespace
const intentionalWrappers = [
  'function addTask(',
  'function validateAndSanitizeTaskInput(',
  'function loadMiniCycleData(',
  'function saveTaskToSchema25(',
  'function updateProgressBar(',
  'function updateRecurringButtonVisibility(',
  'function captureStateSnapshot(',
  'function refreshTaskListUI(',
  'function showPromptModal(',
  'function closeAllModals(',
  // Also accept fallback patterns
  '|| loadMiniCycleData',
  '|| updateProgressBar',
  '|| window.updateRecurringButtonVisibility',
  '|| window.captureStateSnapshot',
  // Early boot calls (before namespace ready)
  '// ✅ Dark Mode Toggle Setup',
  '// ✅ Theme Loading',
  // Dependency injection callbacks
  'loadMiniCycleData: () => window.loadMiniCycleData'
];

// Build ignored line ranges from region markers
const ignoredRanges = [];
let inIgnoreBlock = false;
let blockStart = -1;

lines.forEach((line, index) => {
  if (line.includes('namespace-migration-ignore-start')) {
    inIgnoreBlock = true;
    blockStart = index;
  } else if (line.includes('namespace-migration-ignore-end')) {
    if (inIgnoreBlock && blockStart >= 0) {
      ignoredRanges.push({ start: blockStart, end: index });
    }
    inIgnoreBlock = false;
    blockStart = -1;
  }
});

// Patterns to detect deprecated direct global calls
// Format: [pattern, namespace path, category]
const deprecatedPatterns = [
  // Tasks (28)
  [/\baddTask\(/g, 'miniCycle.tasks.add()', 'Tasks'],
  [/\beditTask\(/g, 'miniCycle.tasks.edit()', 'Tasks'],
  [/\bdeleteTask\(/g, 'miniCycle.tasks.delete()', 'Tasks'],
  [/\bvalidateAndSanitizeTaskInput\(/g, 'miniCycle.tasks.validate()', 'Tasks'],
  [/\brenderTasks\(/g, 'miniCycle.tasks.render()', 'Tasks'],
  [/\brefreshTaskListUI\(/g, 'miniCycle.tasks.refresh()', 'Tasks'],
  [/\btoggleTaskCompletion\(/g, 'miniCycle.tasks.toggle()', 'Tasks'],
  [/\btoggleHighPriority\(/g, 'miniCycle.tasks.priority.toggle()', 'Tasks'],
  [/\bsetTaskPriority\(/g, 'miniCycle.tasks.priority.set()', 'Tasks'],
  [/\bsetTaskRecurring\(/g, 'miniCycle.tasks.recurring.set()', 'Tasks'],
  [/\bupdateRecurringButtonVisibility\(/g, 'miniCycle.tasks.recurring.update()', 'Tasks'],

  // Cycles (19)
  [/\bcreateNewMiniCycle\(/g, 'miniCycle.cycles.create()', 'Cycles'],
  [/\bswitchMiniCycle\(/g, 'miniCycle.cycles.switch()', 'Cycles'],
  [/\bdeleteMiniCycle\(/g, 'miniCycle.cycles.delete()', 'Cycles'],
  [/\bresetCurrentMiniCycle\(/g, 'miniCycle.cycles.reset()', 'Cycles'],
  [/\brenameMiniCycle\(/g, 'miniCycle.cycles.rename()', 'Cycles'],
  [/\blistMiniCycles\(/g, 'miniCycle.cycles.list()', 'Cycles'],
  [/\bimportMiniCycle\(/g, 'miniCycle.cycles.import()', 'Cycles'],
  [/\bexportMiniCycle\(/g, 'miniCycle.cycles.export()', 'Cycles'],

  // UI - Notifications (5)
  [/\bshowNotification\(/g, 'miniCycle.ui.notifications.show()', 'Notifications'],
  [/\bshowNotificationWithTip\(/g, 'miniCycle.ui.notifications.showWithTip()', 'Notifications'],
  [/\bhideNotification\(/g, 'miniCycle.ui.notifications.hide()', 'Notifications'],
  [/\bclearAllNotifications\(/g, 'miniCycle.ui.notifications.clearAll()', 'Notifications'],

  // UI - Modals (8)
  [/\bshowConfirmModal\(/g, 'miniCycle.ui.modals.confirm()', 'Modals'],
  [/\bshowPromptModal\(/g, 'miniCycle.ui.modals.prompt()', 'Modals'],
  [/\bcloseAllModals\(/g, 'miniCycle.ui.modals.closeAll()', 'Modals'],
  [/\bshowModal\(/g, 'miniCycle.ui.modals.show()', 'Modals'],
  [/\bhideModal\(/g, 'miniCycle.ui.modals.hide()', 'Modals'],

  // UI - Loaders (6)
  [/\bshowLoader\(/g, 'miniCycle.ui.loader.show()', 'Loaders'],
  [/\bhideLoader\(/g, 'miniCycle.ui.loader.hide()', 'Loaders'],
  [/\bwithLoader\(/g, 'miniCycle.ui.loader.with()', 'Loaders'],
  [/\bupdateProgressBar\(/g, 'miniCycle.ui.progress.update()', 'Progress'],
  [/\bshowProgressBar\(/g, 'miniCycle.ui.progress.show()', 'Progress'],
  [/\bhideProgressBar\(/g, 'miniCycle.ui.progress.hide()', 'Progress'],

  // UI - Menu (3)
  [/\btoggleMainMenu\(/g, 'miniCycle.ui.menu.toggle()', 'Menu'],
  [/\bhideMainMenu\(/g, 'miniCycle.ui.menu.hide()', 'Menu'],
  [/\bshowMainMenu\(/g, 'miniCycle.ui.menu.show()', 'Menu'],

  // Utils - DOM (12)
  [/\baddManagedListener\(/g, 'miniCycle.utils.dom.addListener()', 'Utils-DOM'],
  [/\bremoveManagedListener\(/g, 'miniCycle.utils.dom.removeListener()', 'Utils-DOM'],
  [/\bsafeAddEventListener\(/g, 'miniCycle.utils.dom.addListener()', 'Utils-DOM'],
  [/\bsafeQuerySelector\(/g, 'miniCycle.utils.dom.query()', 'Utils-DOM'],
  [/\bsafeQuerySelectorAll\(/g, 'miniCycle.utils.dom.queryAll()', 'Utils-DOM'],

  // Utils - Storage (4)
  [/\bsafeLocalStorageGet\(/g, 'miniCycle.utils.storage.get()', 'Utils-Storage'],
  [/\bsafeLocalStorageSet\(/g, 'miniCycle.utils.storage.set()', 'Utils-Storage'],
  [/\bsafeLocalStorageRemove\(/g, 'miniCycle.utils.storage.remove()', 'Utils-Storage'],

  // Utils - JSON (2)
  [/\bsafeJSONParse\(/g, 'miniCycle.utils.json.parse()', 'Utils-JSON'],
  [/\bsafeJSONStringify\(/g, 'miniCycle.utils.json.stringify()', 'Utils-JSON'],

  // Utils - Sanitization (2)
  [/\bsanitizeInput\(/g, 'miniCycle.utils.sanitize()', 'Utils-Sanitize'],
  [/\bescapeHTML\(/g, 'miniCycle.utils.escape()', 'Utils-Sanitize'],

  // Utils - IDs (2)
  [/\bgenerateId\(/g, 'miniCycle.utils.generateId()', 'Utils-IDs'],
  [/\bgenerateHashId\(/g, 'miniCycle.utils.generateHashId()', 'Utils-IDs'],

  // Utils - Functions (2)
  [/\bdebounce\(/g, 'miniCycle.utils.debounce()', 'Utils-Functions'],
  [/\bthrottle\(/g, 'miniCycle.utils.throttle()', 'Utils-Functions'],

  // State (3)
  [/\bloadMiniCycleData\(/g, 'miniCycle.state.load()', 'State'],
  [/\bsaveTaskToSchema25\(/g, 'miniCycle.state.save()', 'State'],

  // History (3)
  [/\bperformStateBasedUndo\(/g, 'miniCycle.history.undo()', 'History'],
  [/\bperformStateBasedRedo\(/g, 'miniCycle.history.redo()', 'History'],
  [/\bcaptureStateSnapshot\(/g, 'miniCycle.history.capture()', 'History']
];

// Excluded patterns (allowed to stay as globals)
const excludedPatterns = [
  /window\.miniCycle\./,  // Already using namespace
  /\/\/.*$/,              // Comments
  /\/\*[\s\S]*?\*\//,     // Block comments
  /'[^']*'/,              // Strings
  /"[^"]*"/,              // Strings
  /`[^`]*`/               // Template strings
];

// Check if a line should be excluded
function isExcluded(line) {
  return excludedPatterns.some(pattern => pattern.test(line));
}

// Check if a line is in an ignored range
function isInIgnoredRange(lineIndex) {
  return ignoredRanges.some(range => lineIndex >= range.start && lineIndex <= range.end);
}

// Check if a line contains an intentional wrapper
function isIntentionalWrapper(line, lineIndex) {
  // Direct pattern match
  if (intentionalWrappers.some(wrapper => line.includes(wrapper))) {
    return true;
  }

  // Context-based checks: look at nearby lines for markers
  const checkRange = 10; // Check 10 lines before (increased range)
  for (let i = Math.max(0, lineIndex - checkRange); i < lineIndex; i++) {
    const contextLine = lines[i];
    if (contextLine.includes('// ✅ Dark Mode Toggle Setup') ||
        contextLine.includes('// ✅ Theme Loading') ||
        contextLine.includes('// Defensive data loading')) {
      return true;
    }
  }

  // DI callback pattern: window.loadMiniCycleData ? window.loadMiniCycleData()
  if (line.includes('window.loadMiniCycleData ? window.loadMiniCycleData()')) {
    return true;
  }

  return false;
}

// Scan for violations
let violations = [];
let expectedLeftovers = [];
let totalCount = 0;
let expectedCount = 0;
const categoryStats = {};
const expectedStats = {};

deprecatedPatterns.forEach(([pattern, namespacePath, category]) => {
  const matches = [];
  const expectedMatches = [];

  lines.forEach((line, index) => {
    // Skip excluded lines
    if (isExcluded(line)) return;

    const lineMatches = line.match(pattern);
    if (lineMatches) {
      const matchData = {
        line: index + 1,
        content: line.trim(),
        count: lineMatches.length
      };

      // Check if this is an expected leftover
      if (isInIgnoredRange(index) || isIntentionalWrapper(line, index)) {
        expectedMatches.push(matchData);
      } else {
        matches.push(matchData);
      }
    }
  });

  // Track unexpected violations
  if (matches.length > 0) {
    const count = matches.reduce((sum, m) => sum + m.count, 0);
    violations.push({
      pattern: pattern.source,
      namespacePath,
      category,
      count,
      matches
    });

    totalCount += count;

    if (!categoryStats[category]) {
      categoryStats[category] = 0;
    }
    categoryStats[category] += count;
  }

  // Track expected leftovers
  if (expectedMatches.length > 0) {
    const count = expectedMatches.reduce((sum, m) => sum + m.count, 0);
    expectedLeftovers.push({
      pattern: pattern.source,
      namespacePath,
      category,
      count,
      matches: expectedMatches
    });

    expectedCount += count;

    if (!expectedStats[category]) {
      expectedStats[category] = 0;
    }
    expectedStats[category] += count;
  }
});

// Print results
console.log('\n' + colors.bold + '🔍 Namespace Migration Validator' + colors.reset);
console.log('━'.repeat(60) + '\n');

// Check if migration is complete (no unexpected violations)
if (violations.length === 0) {
  console.log(colors.green + colors.bold + '✅ Step 0 Complete!' + colors.reset);
  console.log(colors.green + 'No unexpected global calls found in miniCycle-scripts.js' + colors.reset);
  console.log(colors.green + 'All migrated code is using the namespace API.' + colors.reset);

  if (expectedCount > 0) {
    console.log('\n' + colors.cyan + `ℹ️  ${expectedCount} expected leftovers (intentional wrappers/fallbacks)` + colors.reset);
    console.log(colors.cyan + 'Expected Leftovers by Category:' + colors.reset);
    Object.keys(expectedStats).sort().forEach(category => {
      console.log(`  ${colors.cyan}${category}:${colors.reset} ${expectedStats[category]} occurrences`);
    });
  }

  console.log('\n' + colors.cyan + '🎉 Ready to proceed to Phase 2 Step 1!' + colors.reset + '\n');
  process.exit(0);
}

// Print unexpected violations
console.log(colors.red + `❌ Found ${totalCount} unexpected global calls remaining\n` + colors.reset);

console.log(colors.bold + 'Unexpected Violations by Category:' + colors.reset);
Object.keys(categoryStats).sort().forEach(category => {
  console.log(`  ${colors.red}${category}:${colors.reset} ${categoryStats[category]} calls`);
});

console.log('\n' + colors.bold + 'Detailed Violations:' + colors.reset + '\n');

violations.forEach(({ pattern, namespacePath, category, count, matches }) => {
  console.log(colors.red + `❌ ${pattern}` + colors.reset);
  console.log(`   ${colors.cyan}Replace with:${colors.reset} window.${namespacePath}`);
  console.log(`   ${colors.yellow}Found ${count} occurrence(s)${colors.reset}`);

  // Show first 3 matches with line numbers
  matches.slice(0, 3).forEach(({ line, content }) => {
    console.log(`   ${colors.blue}Line ${line}:${colors.reset} ${content.substring(0, 80)}...`);
  });

  if (matches.length > 3) {
    console.log(`   ${colors.yellow}... and ${matches.length - 3} more${colors.reset}`);
  }

  console.log('');
});

// Show expected leftovers summary
if (expectedCount > 0) {
  console.log('━'.repeat(60));
  console.log(colors.cyan + `\nℹ️  Expected Leftovers: ${expectedCount} occurrences (intentional)\n` + colors.reset);
  console.log(colors.bold + 'Expected Leftovers by Category:' + colors.reset);
  Object.keys(expectedStats).sort().forEach(category => {
    console.log(`  ${colors.cyan}${category}:${colors.reset} ${expectedStats[category]} occurrences`);
  });
}

// Summary
console.log('━'.repeat(60));
console.log(colors.bold + '\nSummary:' + colors.reset);
console.log(`  Unexpected violations: ${colors.red}${totalCount}${colors.reset}`);
console.log(`  Expected leftovers: ${colors.cyan}${expectedCount}${colors.reset}`);
const totalOccurrences = 163; // Original count
const migrated = totalOccurrences - totalCount - expectedCount;
console.log(`  Migrated occurrences: ${colors.green}${migrated}/${totalOccurrences}${colors.reset}`);
console.log(`  Progress: ${colors.yellow}${Math.round((migrated / totalOccurrences) * 100)}%${colors.reset} complete`);
console.log('\n' + colors.cyan + '📖 See docs/future-work/NAMESPACE_STEP0_PROGRESS.md for tracking' + colors.reset);
console.log(colors.cyan + '📖 See docs/future-work/NAMESPACE_ARCHITECTURE.md for full guide' + colors.reset);
console.log('');

process.exit(1);
