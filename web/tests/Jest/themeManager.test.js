
/**
 * ThemeManager Tests
 * Clean, focused testing for medium-sized project
 */

const fs = require('fs');
const path = require('path');

// Import the module by evaluating it (browser module adaptation)
const moduleCode = fs.readFileSync(
    path.join(__dirname, '../../utilities/themeManager.js'), 
    'utf8'
);

// Adapt for Node.js testing
const adaptedCode = moduleCode
    .replace(/export\s+class\s+ThemeManager/g, 'class ThemeManager')
    .replace(/export\s+\{[^}]+\}/g, '');

eval(adaptedCode);

describe('ThemeManager', () => {
    let themeManager;
    
    beforeEach(() => {
        setupMiniCycleDOM();
        themeManager = new ThemeManager();
    });
    
    describe('Initialization', () => {
        test('creates instance with proper structure', () => {
            expect(themeManager).toBeInstanceOf(ThemeManager);
            expect(themeManager.themes).toHaveLength(2);
            expect(themeManager.themeColors).toBeDefined();
        });
        
        test('has correct theme definitions', () => {
            const themes = themeManager.themes;
            expect(themes[0].unlockKey).toBe('dark-ocean');
            expect(themes[1].unlockKey).toBe('golden-glow');
        });
    });
    
    describe('Theme Application', () => {
        beforeEach(() => {
            const mockData = createMockSchemaData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockData));
        });
        
        test('applies default theme correctly', () => {
            themeManager.applyTheme('default');
            
            expect(document.body.classList.contains('theme-dark-ocean')).toBe(false);
            expect(document.body.classList.contains('theme-golden-glow')).toBe(false);
            
            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            expect(savedData.settings.theme).toBe('default');
        });
        
        test('applies dark-ocean theme', () => {
            themeManager.applyTheme('dark-ocean');
            
            expect(document.body.classList.contains('theme-dark-ocean')).toBe(true);
            
            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            expect(savedData.settings.theme).toBe('dark-ocean');
        });
        
        test('applies golden-glow theme', () => {
            themeManager.applyTheme('golden-glow');
            
            expect(document.body.classList.contains('theme-golden-glow')).toBe(true);
            
            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            expect(savedData.settings.theme).toBe('golden-glow');
        });
        
        test('switches between themes correctly', () => {
            themeManager.applyTheme('dark-ocean');
            expect(document.body.classList.contains('theme-dark-ocean')).toBe(true);
            
            themeManager.applyTheme('golden-glow');
            expect(document.body.classList.contains('theme-dark-ocean')).toBe(false);
            expect(document.body.classList.contains('theme-golden-glow')).toBe(true);
        });
    });
    
    describe('Dark Mode', () => {
        test('toggles dark mode on body', () => {
            themeManager.toggleDarkMode(true);
            expect(document.body.classList.contains('dark-mode')).toBe(true);
            
            themeManager.toggleDarkMode(false);
            expect(document.body.classList.contains('dark-mode')).toBe(false);
        });
        
        test('updates quick toggle icon', () => {
            const quickToggle = document.getElementById('quick-dark-toggle');
            
            themeManager.updateQuickToggleIcon(true);
            expect(quickToggle.textContent).toBe('☀️');
            
            themeManager.updateQuickToggleIcon(false);
            expect(quickToggle.textContent).toBe('🌙');
        });
    });
    
    describe('Theme Colors', () => {
        test('updates theme color meta for default theme', () => {
            themeManager.updateThemeColor();
            
            const meta = document.getElementById('theme-color-meta');
            expect(meta.getAttribute('content')).toBe('#5680ff');
        });
        
        test('updates theme color meta for dark mode', () => {
            document.body.classList.add('dark-mode');
            themeManager.updateThemeColor();
            
            const meta = document.getElementById('theme-color-meta');
            expect(meta.getAttribute('content')).toBe('#1c1c1c');
        });
        
        test('updates theme color for dark-ocean theme', () => {
            document.body.classList.add('theme-dark-ocean');
            themeManager.updateThemeColor();
            
            const meta = document.getElementById('theme-color-meta');
            expect(meta.getAttribute('content')).toBe('#0e1d2f');
        });
    });
    
    describe('Theme Unlocking', () => {
        test('unlocks dark ocean theme via localStorage fallback', () => {
            const mockData = createMockSchemaData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockData));
            
            themeManager.unlockDarkOceanTheme();
            
            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            expect(savedData.settings.unlockedThemes).toContain('dark-ocean');
            
            const themeButton = document.getElementById('open-themes-panel');
            expect(themeButton.style.display).toBe('block');
        });
        
        test('handles already unlocked theme', () => {
            const mockData = createMockSchemaData({
                settings: { unlockedThemes: ['dark-ocean'] }
            });
            localStorage.setItem('miniCycleData', JSON.stringify(mockData));
            
            // Should not throw or cause issues
            expect(() => {
                themeManager.unlockDarkOceanTheme();
            }).not.toThrow();
        });
    });
    
    describe('Error Handling', () => {
        test('handles missing localStorage gracefully', () => {
            localStorage.clear();
            
            expect(() => {
                themeManager.applyTheme('dark-ocean');
            }).not.toThrow();
        });
        
        test('handles missing DOM elements gracefully', () => {
            document.getElementById('theme-color-meta').remove();
            
            expect(() => {
                themeManager.updateThemeColor();
            }).not.toThrow();
        });
    });
    
    describe('Global API', () => {
        test('exposes global functions for backward compatibility', () => {
            // Re-eval to set globals
            eval(adaptedCode);
            
            expect(typeof global.window.applyTheme).toBe('function');
            expect(typeof global.window.updateThemeColor).toBe('function');
            expect(typeof global.window.setupDarkModeToggle).toBe('function');
            expect(global.window.themeManager).toBeInstanceOf(ThemeManager);
        });
    });
});