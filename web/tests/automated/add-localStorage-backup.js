#!/usr/bin/env node

/**
 * Script to add localStorage backup/restore pattern to test files
 *
 * This ensures tests don't wipe out real user data when running individually.
 *
 * Usage: node add-localStorage-backup.js
 */

const fs = require('fs');
const path = require('path');

const TEST_FILES_TO_FIX = [
    'dueDates.tests.js',
    'menuManager.tests.js',
    'modeManager.tests.js',
    'reminders.tests.js',
    'settingsManager.tests.js',
    'taskCore.tests.js',
    'undoRedoManager.tests.js',
    'MODULE_TEMPLATE.tests.js'
];

const BACKUP_CODE = `
    // 🔒 SAVE REAL APP DATA ONCE before all tests run (only when running individually)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
        console.log('🔒 Saved original localStorage for individual TEST_NAME test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual TEST_NAME test completed - original localStorage restored');
        }
    }
`;

const RESTORE_CALL = `
    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();
`;

function addLocalStorageBackup(filePath) {
    const fileName = path.basename(filePath);
    const testName = fileName.replace('.tests.js', '');

    console.log(`\n📝 Processing ${fileName}...`);

    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if already has backup code
    if (content.includes('savedRealData')) {
        console.log(`  ✅ Already has localStorage backup - skipping`);
        return;
    }

    // Step 1: Find the main export function and add isPartOfSuite parameter
    const exportMatch = content.match(/export\s+(async\s+)?function\s+(\w+)\s*\((resultsDiv)([^)]*)\)/);

    if (!exportMatch) {
        console.log(`  ❌ Could not find main export function - skipping`);
        return;
    }

    const funcName = exportMatch[2];
    const existingParams = exportMatch[4];

    // Check if already has isPartOfSuite
    if (!existingParams.includes('isPartOfSuite')) {
        const oldSignature = `export ${exportMatch[1] || ''}function ${funcName}(resultsDiv${existingParams})`;
        const newSignature = `export ${exportMatch[1] || ''}function ${funcName}(resultsDiv${existingParams}, isPartOfSuite = false)`;
        content = content.replace(oldSignature, newSignature);
        console.log(`  ✓ Added isPartOfSuite parameter`);
    }

    // Step 2: Find where to insert backup code (after the passed/total declaration)
    // Try pattern 1: let passed = { count: 0 }, total = { count: 0 };
    let insertAfterMatch = content.match(/(let passed = \{ count: 0 \},\s*total = \{ count: 0 \};)/);

    // Try pattern 2: let passed = { count: 0 }; let total = { count: 0 };
    if (!insertAfterMatch) {
        insertAfterMatch = content.match(/(let passed = \{ count: 0 \}[^;]*;\s*let total = \{ count: 0 \}[^;]*;)/);
    }

    if (!insertAfterMatch) {
        console.log(`  ❌ Could not find insertion point - skipping`);
        return;
    }

    const backupCodeWithName = BACKUP_CODE.replace(/TEST_NAME/g, testName);
    const insertionPoint = insertAfterMatch.index + insertAfterMatch[0].length;

    content = content.slice(0, insertionPoint) + backupCodeWithName + content.slice(insertionPoint);
    console.log(`  ✓ Added backup/restore code`);

    // Step 3: Add restore call before the final return statement
    // Find the last return statement in the function
    const returnMatches = [...content.matchAll(/return \{ passed:.*?total:.*?\};/g)];

    if (returnMatches.length === 0) {
        console.log(`  ❌ Could not find return statement - skipping restore call`);
        return;
    }

    const lastReturn = returnMatches[returnMatches.length - 1];
    const restoreInsertPoint = lastReturn.index;

    content = content.slice(0, restoreInsertPoint) + RESTORE_CALL + '\n' + content.slice(restoreInsertPoint);
    console.log(`  ✓ Added restore call before return`);

    // Write the updated content
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ Successfully updated ${fileName}`);
}

function main() {
    console.log('🔧 Adding localStorage backup to test files...\n');
    console.log('This script adds backup/restore pattern to protect user data during tests.\n');

    const testsDir = path.join(__dirname, '..');
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const fileName of TEST_FILES_TO_FIX) {
        const filePath = path.join(testsDir, fileName);

        if (!fs.existsSync(filePath)) {
            console.log(`\n⚠️  ${fileName} not found - skipping`);
            skippedCount++;
            continue;
        }

        try {
            addLocalStorageBackup(filePath);
            processedCount++;
        } catch (error) {
            console.log(`\n❌ Error processing ${fileName}:`, error.message);
            errorCount++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Processed: ${processedCount} files`);
    console.log(`   ⏭️  Skipped: ${skippedCount} files`);
    console.log(`   ❌ Errors: ${errorCount} files`);
    console.log('='.repeat(60));

    if (errorCount === 0) {
        console.log('\n✅ All test files now have localStorage backup protection!');
        console.log('\n💡 Next steps:');
        console.log('   1. Review the changes: git diff tests/');
        console.log('   2. Run tests to verify: node tests/automated/run-browser-tests.js');
        console.log('   3. Commit changes: git add tests/ && git commit -m "fix: Add localStorage backup to all test files"');
    }
}

main();
