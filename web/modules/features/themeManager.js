/**
 * Theme Manager Module
 *
 * 🎯 Pattern: Simple Instance
 * ✅ Self-contained theme and dark mode management
 * ✅ Works immediately with graceful degradation
 * ✅ Handles theme unlocking, dark mode, and theme application
 * ✅ Manages theme color meta tags for PWA integration
 *
 * Usage:
 *   import './modules/features/themeManager.js';
 *
 *   // Available globally:
 *   applyTheme('dark-ocean');
 *   setupDarkModeToggle('darkModeToggle');
 *   setupQuickDarkToggle();
 *   unlockDarkOceanTheme();
 *   unlockGoldenGlowTheme();
 *   updateThemeColor();
 *
 * Dependencies: None (graceful fallbacks)
 * Storage: Uses localStorage for Schema 2.5 data
 * DOM: Handles missing elements gracefully
 *
 * @module themeManager
 * @version 1.379
 * @requires AppInit (for initialization coordination)
 */

import { appInit } from '../core/appInit.js';

export class ThemeManager {
    constructor() {
        console.log('🎨 ThemeManager initializing...');
        
        this.themes = [
            {
                id: "DarkOcean",
                class: "dark-ocean", 
                label: "Dark Ocean Theme 🌊",
                unlockKey: "dark-ocean"
            },
            {
                id: "GoldenGlow",
                class: "golden-glow",
                label: "Golden Glow Theme 🌟",
                unlockKey: "golden-glow"
            }
        ];
        
        this.themeColors = {
            light: {
                default: '#5680ff',
                'dark-ocean': '#0e1d2f',
                'golden-glow': '#ffe066'
            },
            dark: {
                default: '#1c1c1c',
                'dark-ocean': '#0e1d2f', 
                'golden-glow': '#4a3d00'
            }
        };
        
        // Initialize immediately
        this.init();
    }
    
    init() {
        try {
            console.log('🎨 ThemeManager ready');
        } catch (error) {
            console.warn('⚠️ ThemeManager init warning:', error.message);
        }
    }
    
    // ===== CORE THEME FUNCTIONS =====
    
    /**
     * Apply a theme to the document
     * @param {string} themeName - Theme name ('default', 'dark-ocean', 'golden-glow')
     */
    applyTheme(themeName) {
        try {
            console.log('🎨 Applying theme (Schema 2.5 only)...', themeName);
            
            // Step 1: Remove all theme classes
            const allThemes = ['theme-dark-ocean', 'theme-golden-glow'];
            allThemes.forEach(theme => document.body?.classList.remove(theme));
          
            // Step 2: Add selected theme class if it's not 'default'
            if (themeName && themeName !== 'default') {
                document.body?.classList.add(`theme-${themeName}`);
            }

            // Step 3: Update theme color after applying theme
            this.updateThemeColor();
          
            // Step 4: Save to Schema 2.5 only
            this.saveThemeToStorage(themeName);
          
            // Step 5: Update UI checkboxes
            this.updateThemeToggles(themeName);
            
            console.log('✅ Theme application completed');
        } catch (error) {
            console.warn('⚠️ Theme application failed:', error.message, '- using defaults');
        }
    }
    
    /**
     * Update theme color meta tags for PWA
     */
    updateThemeColor() {
        try {
            const body = document.body;
            if (!body) {
                console.warn('⚠️ Document body not available for theme color update');
                return;
            }
            
            const themeColorMeta = document.getElementById('theme-color-meta');
            const statusBarMeta = document.getElementById('status-bar-style-meta');
            
            let themeColor = '#5680ff'; // Default
            let statusBarStyle = 'default';
            
            // Determine current theme
            let currentTheme = 'default';
            if (body.classList.contains('theme-dark-ocean')) {
                currentTheme = 'dark-ocean';
            } else if (body.classList.contains('theme-golden-glow')) {
                currentTheme = 'golden-glow';
            }
            
            // Apply colors based on dark mode + theme
            const isDarkMode = body.classList.contains('dark-mode');
            const colorSet = isDarkMode ? this.themeColors.dark : this.themeColors.light;
            
            themeColor = colorSet[currentTheme] || colorSet.default;
            statusBarStyle = isDarkMode ? 'black-translucent' : 'default';
            
            // Update meta tags
            if (themeColorMeta) {
                themeColorMeta.setAttribute('content', themeColor);
            }
            
            if (statusBarMeta) {
                statusBarMeta.setAttribute('content', statusBarStyle);
            }
            
            console.log(`🎨 Theme color updated to: ${themeColor}, Status bar: ${statusBarStyle}`);
        } catch (error) {
            console.warn('⚠️ Theme color update failed:', error.message);
        }
    }
    
    // ===== DARK MODE FUNCTIONS =====
    
    /**
     * Setup dark mode toggle with syncing across multiple toggles
     * @param {string} toggleId - Primary toggle element ID
     * @param {string[]} allToggleIds - All toggle IDs to sync
     */
    setupDarkModeToggle(toggleId, allToggleIds = []) {
        try {
            const thisToggle = document.getElementById(toggleId);
            if (!thisToggle) {
                console.warn(`⚠️ Dark mode toggle element '${toggleId}' not found`);
                return;
            }

            console.log('🌙 Setting up dark mode toggle (Schema 2.5 only)...');
            
            const schemaData = this.loadSchemaData();
            if (!schemaData) {
                console.warn('⚠️ Schema 2.5 data not available for dark mode setup');
                return;
            }
            
            const isDark = schemaData.settings?.darkMode || false;
            
            console.log('📊 Loading dark mode state from Schema 2.5:', isDark);

            // Set initial state
            thisToggle.checked = isDark;
            document.body?.classList.toggle("dark-mode", isDark);

            // Update theme color and quick toggle
            this.updateThemeColor();
            this.updateQuickToggleIcon(isDark);

            // Event handler
            thisToggle.addEventListener("change", (e) => {
                const enabled = e.target.checked;
                this.toggleDarkMode(enabled, allToggleIds, thisToggle);
            });
            
            console.log('✅ Dark mode toggle setup completed');
        } catch (error) {
            console.warn('⚠️ Dark mode toggle setup failed:', error.message);
        }
    }
    
    /**
     * Setup quick dark mode toggle button
     */
    setupQuickDarkToggle() {
        try {
            const quickToggle = document.getElementById("quick-dark-toggle");
            if (!quickToggle) {
                console.warn('⚠️ Quick dark toggle element not found');
                return;
            }
            
            console.log('🌙 Setting up quick dark toggle...');
            
            // Get current dark mode state
            const schemaData = this.loadSchemaData();
            const isDark = schemaData ? (schemaData.settings?.darkMode || false) : false;
            
            // Remove existing listeners to prevent duplicates
            const newQuickToggle = quickToggle.cloneNode(true);
            quickToggle.parentNode?.replaceChild(newQuickToggle, quickToggle);
            
            // Set correct initial icon state
            newQuickToggle.textContent = isDark ? "☀️" : "🌙";
            
            newQuickToggle.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('🌙 Quick dark toggle clicked');
                
                // Find primary toggle and simulate change
                const primaryToggle = document.getElementById("darkModeToggle");
                if (primaryToggle) {
                    console.log('🔄 Triggering primary toggle, current state:', primaryToggle.checked);
                    primaryToggle.checked = !primaryToggle.checked;
                    
                    const changeEvent = new Event("change", { bubbles: true, cancelable: true });
                    primaryToggle.dispatchEvent(changeEvent);
                    
                    console.log('🔄 Primary toggle new state:', primaryToggle.checked);
                } else {
                    console.warn('⚠️ Primary dark mode toggle not found');
                }
            });
            
            console.log('✅ Quick dark toggle setup completed');
        } catch (error) {
            console.warn('⚠️ Quick dark toggle setup failed:', error.message);
        }
    }
    
    /**
     * Toggle dark mode state
     */
    toggleDarkMode(enabled, allToggleIds = [], excludeToggle = null) {
        try {
            document.body?.classList.toggle("dark-mode", enabled);
            
            console.log('🌙 Dark mode toggle changed:', enabled);
            
            // Save to storage
            this.saveDarkModeToStorage(enabled);
            
            // Sync all other toggles
            allToggleIds.forEach(id => {
                const otherToggle = document.getElementById(id);
                if (otherToggle && otherToggle !== excludeToggle) {
                    otherToggle.checked = enabled;
                }
            });

            // Update quick toggle icon
            this.updateQuickToggleIcon(enabled);

            // Update theme color after dark mode change
            this.updateThemeColor();
        } catch (error) {
            console.warn('⚠️ Dark mode toggle failed:', error.message);
        }
    }
    
    /**
     * Update quick toggle icon
     */
    updateQuickToggleIcon(isDark) {
        try {
            const currentQuickToggle = document.getElementById("quick-dark-toggle");
            if (currentQuickToggle) {
                currentQuickToggle.textContent = isDark ? "☀️" : "🌙";
            }
        } catch (error) {
            console.warn('⚠️ Quick toggle icon update failed:', error.message);
        }
    }
    
    // ===== THEME UNLOCK FUNCTIONS =====
    
    /**
     * Unlock Dark Ocean theme
     */
    async unlockDarkOceanTheme() {
        try {
            console.log("🌊 Unlocking Dark Ocean theme (state-based)...");

            // ✅ Wait for core systems to be ready (AppState + data)
            await appInit.waitForCore();

            const currentState = window.AppState.get();
            if (!currentState) {
                console.warn('⚠️ No state data for unlockDarkOceanTheme - using fallback');
                this.unlockThemeFallback('dark-ocean', 'Dark Ocean');
                return;
            }
            
            if (!currentState.settings.unlockedThemes.includes("dark-ocean")) {
                window.AppState.update(state => {
                    state.settings.unlockedThemes.push("dark-ocean");
                    state.userProgress.rewardMilestones.push("dark-ocean-5");
                }, true);
                
                console.log("🎨 Dark Ocean theme unlocked (state-based)!");
                this.refreshThemeToggles();
                
                // Show theme options
                this.showThemeContainer();
                this.showThemeButton();
                
                this.showNotification?.('🎉 New theme unlocked: Dark Ocean! Check the menu to activate it.', 'success', 5000);
            } else {
                console.log('ℹ️ Dark Ocean theme already unlocked');
            }
            
            this.refreshThemeToggles();
        } catch (error) {
            console.warn('⚠️ Dark Ocean theme unlock failed:', error.message);
            this.unlockThemeFallback('dark-ocean', 'Dark Ocean');
        }
    }
    
    /**
     * Unlock Golden Glow theme
     */
    async unlockGoldenGlowTheme() {
        try {
            console.log("🌟 Unlocking Golden Glow theme (state-based)...");

            // ✅ Wait for core systems to be ready (AppState + data)
            await appInit.waitForCore();

            const currentState = window.AppState.get();
            if (!currentState) {
                console.warn('⚠️ No state data for unlockGoldenGlowTheme - using fallback');
                this.unlockThemeFallback('golden-glow', 'Golden Glow');
                return;
            }
            
            if (!currentState.settings.unlockedThemes.includes("golden-glow")) {
                window.AppState.update(state => {
                    state.settings.unlockedThemes.push("golden-glow");
                    state.userProgress.rewardMilestones.push("golden-glow-50");
                }, true);
                
                console.log("🎨 Golden Glow theme unlocked (state-based)!");
                this.refreshThemeToggles();

                // Show theme options
                this.showThemeContainer();
                this.showThemeButton();

                this.showNotification?.("🌟 New theme unlocked: Golden Glow! Check the themes menu to activate it.", "success", 5000);
            } else {
                console.log('ℹ️ Golden Glow theme already unlocked');
            }
            
            this.refreshThemeToggles();
        } catch (error) {
            console.warn('⚠️ Golden Glow theme unlock failed:', error.message);
            this.unlockThemeFallback('golden-glow', 'Golden Glow');
        }
    }
    
    /**
     * Fallback theme unlock when AppState is not available
     */
    unlockThemeFallback(themeKey, themeName) {
        try {
            console.log(`🎨 Using fallback unlock for ${themeName} theme...`);
            
            const schemaData = this.loadSchemaData();
            if (schemaData && !schemaData.settings.unlockedThemes.includes(themeKey)) {
                schemaData.settings.unlockedThemes.push(themeKey);
                this.saveSchemaData(schemaData);
                
                this.refreshThemeToggles();
                this.showThemeContainer();
                this.showThemeButton();
                
                console.log(`🎨 ${themeName} theme unlocked (fallback)!`);
            }
        } catch (error) {
            console.warn(`⚠️ ${themeName} theme fallback unlock failed:`, error.message);
        }
    }
    
    // ===== THEME PANEL FUNCTIONS =====
    
    /**
     * Initialize themes panel 
     */
    initializeThemesPanel() {
        try {
            console.log("🌈 Initializing Theme Panel");

            const existingContainer = document.querySelector('.theme-container');
            if (existingContainer) {
                console.log('ℹ️ Theme container already exists');
                return;
            }

            const themeContainer = document.createElement('div');
            themeContainer.className = 'theme-container';
            themeContainer.id = 'theme-container';

            const themeOptionContainer = document.createElement('div');
            themeOptionContainer.className = 'theme-option-container';
            themeOptionContainer.id = 'theme-option-container';

            themeContainer.appendChild(themeOptionContainer);

            // Inject into modal
            const themeSection = document.getElementById("theme-options-section");
            if (themeSection) {
                themeSection.appendChild(themeContainer);
                this.refreshThemeToggles();
                console.log('✅ Theme panel initialized');
            } else {
                console.warn('⚠️ Theme options section not found');
            }
        } catch (error) {
            console.warn('⚠️ Theme panel initialization failed:', error.message);
        }
    }
    
    /**
     * Refresh theme toggles based on unlocked themes
     */
    refreshThemeToggles() {
        try {
            console.log('🎨 Refreshing theme toggles (Schema 2.5 only)...');
            
            const container = document.getElementById("theme-option-container");
            if (!container) {
                console.warn('⚠️ Theme option container not found');
                return;
            }
            
            container.innerHTML = ""; // Clear current options

            const schemaData = this.loadSchemaData();
            if (!schemaData) {
                console.warn('⚠️ Schema 2.5 data not available for refreshThemeToggles');
                return;
            }

            const unlockedThemes = schemaData.settings?.unlockedThemes || [];
            const currentTheme = schemaData.settings?.theme || 'default';
            
            console.log('📊 Theme data from Schema 2.5:', {
                unlockedThemes,
                currentTheme,
                unlockedCount: unlockedThemes.length
            });

            // Add default theme option
            this.addThemeToggle(container, {
                id: "Default",
                class: "default",
                label: "Default Theme ⭐",
                unlockKey: "default"
            }, currentTheme, true); // Always unlocked
            
            // Add unlocked themes
            this.themes.forEach(theme => {
                const isUnlocked = unlockedThemes.includes(theme.unlockKey);
                if (isUnlocked) {
                    this.addThemeToggle(container, theme, currentTheme, true);
                }
            });
            
            console.log('✅ Theme toggles refreshed');
        } catch (error) {
            console.warn('⚠️ Theme toggles refresh failed:', error.message);
        }
    }
    
    /**
     * Add a theme toggle to the container
     */
    addThemeToggle(container, theme, currentTheme, isUnlocked) {
        try {
            if (!isUnlocked) return;
            
            const toggleDiv = document.createElement('div');
            toggleDiv.className = 'checkbox-container';
            
            const isChecked = currentTheme === theme.class || (currentTheme === 'default' && theme.class === 'default');
            
            toggleDiv.innerHTML = `
                <label class="custom-checkbox" for="toggle${theme.id}Theme">
                    <input 
                        type="checkbox" 
                        class="theme-toggle" 
                        id="toggle${theme.id}Theme" 
                        ${isChecked ? 'checked' : ''}
                    />
                    <span class="checkmark" aria-hidden="true"></span>
                    <span>${theme.label}</span>
                </label>
            `;
            
            const checkbox = toggleDiv.querySelector('input');
            checkbox?.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.applyTheme(theme.class === 'default' ? 'default' : theme.class);
                }
            });
            
            container.appendChild(toggleDiv);
        } catch (error) {
            console.warn('⚠️ Theme toggle creation failed:', error.message);
        }
    }
    
    /**
     * Setup themes panel modal
     */
    setupThemesPanel() {
        try {
            console.log('🎨 Setting up themes panel (Schema 2.5 only)...');
            
            const schemaData = this.loadSchemaData();
            if (!schemaData) {
                console.warn('⚠️ Schema 2.5 data not yet available for setupThemesPanel - deferring setup');
                setTimeout(() => {
                    const retryData = this.loadSchemaData();
                    if (retryData) {
                        console.log('🎨 Retrying setupThemesPanel with loaded data...');
                        this.setupThemesPanelWithData(retryData);
                    } else {
                        console.warn('⚠️ Schema 2.5 data still not available for setupThemesPanel');
                    }
                }, 1000);
                return;
            }

            this.setupThemesPanelWithData(schemaData);
        } catch (error) {
            console.warn('⚠️ Themes panel setup failed:', error.message);
        }
    }
    
    /**
     * Setup themes panel with data
     */
    setupThemesPanelWithData(schemaData) {
        try {
            const { settings } = schemaData;
            const unlockedThemes = settings?.unlockedThemes || [];
            const hasUnlockedThemes = unlockedThemes.length > 0;
            
            const themeButton = document.getElementById("open-themes-panel");
            const themesModal = document.getElementById("themes-modal");
            const closeThemesBtn = document.getElementById("close-themes-btn");
          
            // Show the button if any theme is unlocked
            if (hasUnlockedThemes && themeButton) {
                themeButton.style.display = "block";
            }
          
            // Open modal
            if (themeButton) {
                themeButton.addEventListener("click", () => {
                    if (themesModal) {
                        themesModal.style.display = "flex";
                        if (window.hideMainMenu) {
                            window.hideMainMenu();
                        }
                    }
                });
            }
          
            // Close modal
            if (closeThemesBtn) {
                closeThemesBtn.addEventListener("click", () => {
                    if (themesModal) {
                        themesModal.style.display = "none";
                    }
                });
            }
          
            // Setup dark mode toggle inside themes modal
            this.setupDarkModeToggle("darkModeToggleThemes", ["darkModeToggle", "darkModeToggleThemes"]);
            
            console.log('✅ Themes panel setup completed (Schema 2.5)');
        } catch (error) {
            console.warn('⚠️ Themes panel setup with data failed:', error.message);
        }
    }
    
    // ===== UTILITY FUNCTIONS =====
    
    /**
     * Show theme container
     */
    showThemeContainer() {
        try {
            const themeContainer = document.querySelector('.theme-container');
            if (themeContainer) {
                themeContainer.classList.remove('hidden');
            }
        } catch (error) {
            console.warn('⚠️ Show theme container failed:', error.message);
        }
    }
    
    /**
     * Show theme button
     */
    showThemeButton() {
        try {
            const themeButton = document.getElementById("open-themes-panel");
            if (themeButton) {
                themeButton.style.display = "block";
            }
        } catch (error) {
            console.warn('⚠️ Show theme button failed:', error.message);
        }
    }
    
    /**
     * Update theme checkboxes
     */
    updateThemeToggles(themeName) {
        try {
            document.querySelectorAll('.theme-toggle').forEach(cb => {
                const expectedId = `toggle${this.capitalize(themeName || 'default')}Theme`;
                cb.checked = cb.id === expectedId;
            });
        } catch (error) {
            console.warn('⚠️ Theme toggles update failed:', error.message);
        }
    }
    
    /**
     * Capitalize theme name for checkbox IDs
     */
    capitalize(str) {
        return str
            ? str.charAt(0).toUpperCase() + str.slice(1).replace(/-./g, s => s.charAt(1).toUpperCase())
            : '';
    }
    
    // ===== STORAGE FUNCTIONS =====
    
    /**
     * Load Schema 2.5 data from localStorage
     */
    loadSchemaData() {
        try {
            const data = localStorage.getItem("miniCycleData");
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('⚠️ Schema data load failed:', error.message);
            return null;
        }
    }
    
    /**
     * Save Schema 2.5 data via AppState
     * @deprecated Use AppState.update() directly instead
     */
    async saveSchemaData(data) {
        // ✅ Wait for core systems to be ready before saving
        await appInit.waitForCore();

        // ✅ Use AppState only (no localStorage fallback)
        if (!window.AppState?.isReady?.()) {
            console.error('❌ AppState not ready for saveSchemaData after waitForCore - this should not happen');
            return;
        }

        try {
            // Replace entire state data
            await window.AppState.update(state => {
                Object.assign(state, data);
            }, true);
        } catch (error) {
            console.warn('⚠️ Schema data save failed:', error.message);
        }
    }
    
    /**
     * Save theme to storage
     */
    saveThemeToStorage(themeName) {
        try {
            const schemaData = this.loadSchemaData();
            if (!schemaData) {
                console.warn('⚠️ Schema 2.5 data required for saveThemeToStorage');
                return;
            }
            
            schemaData.settings = schemaData.settings || {};
            schemaData.settings.theme = themeName || 'default';
            this.saveSchemaData(schemaData);
            
            console.log("✅ Theme saved to Schema 2.5:", themeName);
        } catch (error) {
            console.warn('⚠️ Theme save failed:', error.message);
        }
    }
    
    /**
     * Save dark mode to storage
     */
    saveDarkModeToStorage(enabled) {
        try {
            const schemaData = this.loadSchemaData();
            if (!schemaData) {
                console.warn('⚠️ Schema 2.5 data required for saveDarkModeToStorage');
                return;
            }
            
            schemaData.settings = schemaData.settings || {};
            schemaData.settings.darkMode = enabled;
            this.saveSchemaData(schemaData);
            
            console.log("✅ Dark mode saved to Schema 2.5:", enabled);
        } catch (error) {
            console.warn('⚠️ Dark mode save failed:', error.message);
        }
    }
    
    // ===== GRACEFUL FALLBACK PROPERTIES =====
    
    /**
     * Optional notification function (graceful fallback)
     */
    get showNotification() {
        return window.showNotification || null;
    }
}

// ===== MODULE INITIALIZATION =====

// Create singleton instance
const themeManager = new ThemeManager();

// ===== GLOBAL API FUNCTIONS =====

/**
 * Apply a theme
 * @param {string} themeName - Theme to apply
 */
function applyTheme(themeName) {
    return themeManager.applyTheme(themeName);
}

/**
 * Update theme color meta tags
 */
function updateThemeColor() {
    return themeManager.updateThemeColor();
}

/**
 * Setup dark mode toggle
 * @param {string} toggleId - Toggle element ID
 * @param {string[]} allToggleIds - All toggles to sync
 */
function setupDarkModeToggle(toggleId, allToggleIds = []) {
    return themeManager.setupDarkModeToggle(toggleId, allToggleIds);
}

/**
 * Setup quick dark mode toggle
 */
function setupQuickDarkToggle() {
    return themeManager.setupQuickDarkToggle();
}

/**
 * Unlock Dark Ocean theme
 */
function unlockDarkOceanTheme() {
    return themeManager.unlockDarkOceanTheme();
}

/**
 * Unlock Golden Glow theme
 */
function unlockGoldenGlowTheme() {
    return themeManager.unlockGoldenGlowTheme();
}

/**
 * Initialize themes panel
 */
function initializeThemesPanel() {
    return themeManager.initializeThemesPanel();
}

/**
 * Refresh theme toggles
 */
function refreshThemeToggles() {
    return themeManager.refreshThemeToggles();
}

/**
 * Setup themes panel
 */
function setupThemesPanel() {
    return themeManager.setupThemesPanel();
}

/**
 * Setup themes panel with data
 * @param {object} schemaData - Schema 2.5 data
 */
function setupThemesPanelWithData(schemaData) {
    return themeManager.setupThemesPanelWithData(schemaData);
}

// ===== MODULE EXPORTS (Phase 2 - No window.* pollution) =====

console.log('🎨 ThemeManager module loaded (Phase 2 - no window.* exports)');

// Export class, singleton, and wrapper functions
export default ThemeManager;
export {
    themeManager,
    applyTheme,
    updateThemeColor,
    setupDarkModeToggle,
    setupQuickDarkToggle,
    unlockDarkOceanTheme,
    unlockGoldenGlowTheme,
    initializeThemesPanel,
    refreshThemeToggles,
    setupThemesPanel,
    setupThemesPanelWithData
};
