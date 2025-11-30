#!/usr/bin/env node
/**
 * Import Validation Script
 *
 * Validates that all ES module imports follow the no-build system rules:
 * 1. Only miniCycle-scripts.js should have dynamic imports with withV()
 * 2. Other modules should use dependency injection, not static imports
 * 3. Only stable core modules (constants.js, appInit.js) can be statically imported
 *
 * Usage: node scripts/validate-imports.js
 *
 * @version 1.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

// Modules that are safe to statically import (rarely change, core infrastructure)
const SAFE_STATIC_IMPORTS = [
    'constants.js',
    'appInit.js',
    'version.js'
];

// Files that are allowed to have dynamic imports with withV()
const ALLOWED_DYNAMIC_IMPORT_FILES = [
    'miniCycle-scripts.js',
    'index.html',
    'miniCycle.html'
];

// Directories to scan
const SCAN_DIRS = [
    'modules'
];

// Directories to ignore
const IGNORE_DIRS = [
    'node_modules',
    'archive',
    'TTO',
    'blog',
    'examples',
    'other'  // Example plugins, not core functionality
];

/**
 * Recursively find all .js files in a directory
 */
function findJsFiles(dir, files = []) {
    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (!IGNORE_DIRS.includes(entry.name)) {
                findJsFiles(fullPath, files);
            }
        } else if (entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Check if an import path is safe for static import
 */
function isSafeStaticImport(importPath) {
    return SAFE_STATIC_IMPORTS.some(safe => importPath.endsWith(safe));
}

/**
 * Check if a file is allowed to have dynamic imports
 */
function isAllowedDynamicImportFile(filePath) {
    return ALLOWED_DYNAMIC_IMPORT_FILES.some(allowed => filePath.endsWith(allowed));
}

/**
 * Validate a single file
 */
function validateFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(webRoot, filePath);
    const errors = [];
    const warnings = [];

    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmedLine = line.trim();

        // Skip comments
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) return;

        // Check for static imports
        const staticImportMatch = line.match(/^import\s+.*from\s+['"]([^'"]+)['"]/);
        if (staticImportMatch) {
            const importPath = staticImportMatch[1];

            // Only check relative imports (not npm packages)
            if (importPath.startsWith('./') || importPath.startsWith('../')) {
                if (!isSafeStaticImport(importPath)) {
                    errors.push({
                        file: relativePath,
                        line: lineNum,
                        type: 'STATIC_IMPORT',
                        import: importPath,
                        message: `Static import of '${importPath}' should use dependency injection instead`
                    });
                }
            }
        }

        // Check for dynamic imports without withV() in allowed files
        // This is just a warning since the file might handle versioning differently
        const dynamicImportMatch = line.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (dynamicImportMatch) {
            const importPath = dynamicImportMatch[1];

            // If it's a relative import without ?v=, warn
            if ((importPath.startsWith('./') || importPath.startsWith('../')) &&
                !importPath.includes('?v=') &&
                !importPath.includes('withV')) {

                if (!isAllowedDynamicImportFile(filePath)) {
                    warnings.push({
                        file: relativePath,
                        line: lineNum,
                        type: 'UNVERSIONED_DYNAMIC_IMPORT',
                        import: importPath,
                        message: `Dynamic import without version: '${importPath}'`
                    });
                }
            }
        }

        // Check for window.* assignments that might indicate missing exports
        // This is informational only
    });

    return { errors, warnings };
}

/**
 * Main validation function
 */
function validate() {
    console.log('🔍 Validating imports in miniCycle modules...\n');

    const allErrors = [];
    const allWarnings = [];
    let filesChecked = 0;

    for (const scanDir of SCAN_DIRS) {
        const dirPath = path.join(webRoot, scanDir);
        const files = findJsFiles(dirPath);

        for (const file of files) {
            const { errors, warnings } = validateFile(file);
            allErrors.push(...errors);
            allWarnings.push(...warnings);
            filesChecked++;
        }
    }

    console.log(`📁 Checked ${filesChecked} files\n`);

    // Report warnings
    if (allWarnings.length > 0) {
        console.log('⚠️  WARNINGS:\n');
        allWarnings.forEach(w => {
            console.log(`  ${w.file}:${w.line}`);
            console.log(`    ${w.message}`);
            console.log('');
        });
    }

    // Report errors
    if (allErrors.length > 0) {
        console.log('❌ ERRORS:\n');
        allErrors.forEach(e => {
            console.log(`  ${e.file}:${e.line}`);
            console.log(`    ${e.message}`);
            console.log('');
        });

        console.log(`\n❌ Validation FAILED: ${allErrors.length} error(s) found`);
        console.log('\nTo fix static import errors:');
        console.log('1. Remove the static import from the module');
        console.log('2. Add a dependency injection function to receive the dependency');
        console.log('3. Import and inject the dependency from miniCycle-scripts.js');
        console.log('\nSee docs/architecture/NO_BUILD_MODULE_SYSTEM.md for details.');

        process.exit(1);
    } else {
        console.log('✅ All imports validated successfully!');

        if (allWarnings.length > 0) {
            console.log(`   (${allWarnings.length} warning(s) - review recommended)`);
        }

        process.exit(0);
    }
}

// Run validation
validate();
