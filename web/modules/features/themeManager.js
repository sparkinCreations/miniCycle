/**
 * Theme Manager Module (DI-Pure)
 *
 * Self-contained theme and dark mode management.
 * Handles theme unlocking (gamification), dark mode toggle, and PWA theme colors.
 *
 * Features:
 * - Theme application (dark-ocean, golden-glow)
 * - Dark mode toggle
 * - Theme unlocking based on milestones
 * - PWA theme-color meta tag management
 * - Graceful degradation without dependencies
 *
 * @module features/themeManager
 * @see {@link file://../../../docs/developer-guides/DATA_SCHEMA_GUIDE.md} - Schema reference
 */

/**
 * @typedef {import('../core/types.js').Settings} Settings
 * @typedef {import('../core/types.js').MiniCycleState} MiniCycleState
 */

/**
 * @typedef {Object} ThemeConfig
 * @property {string} id - Theme identifier (e.g., "DarkOcean")
 * @property {string} class - CSS class name (e.g., "dark-ocean")
 * @property {string} label - Display label with emoji
 * @property {string} unlockKey - Key used for unlock tracking
 */

import { DOM_IDS, DOM_SELECTORS, STORAGE_KEYS } from '../core/constants.js';
import { createDIModule, optional } from '../core/diBase.js';
import { getLabel, getIcon } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP (using diBase.js)
// ============================================================================

const di = createDIModule('ThemeManager', {
    appInit: optional(null),
    AppState: optional(null),
    showNotification: optional(null),
    hideMainMenu: optional(null),
    safeAddEventListener: optional(null),
    getModal: optional(null),
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel)),
    vocabThemeManager: optional(null),
    checkCompleteAllButton: optional(null),
    updateStatsPanel: optional(null),
    updateMainMenuHeader: optional(null),
    updateHelpWindow: optional(null)
});

// Late-binding deps via Proxy
/** @type {{appInit: Object|null, AppState: Object|null, showNotification: Function|null, hideMainMenu: Function|null, safeAddEventListener: Function|null, getModal: Function|null, getElementById: Function, querySelector: Function, querySelectorAll: Function}} */
const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});


/**
 * Set dependencies for ThemeManager
 * Call this after AppState is available
 */
export function setThemeManagerDependencies(deps) {
    di.setDependencies(deps);
    console.log('🎨 ThemeManager dependencies injected');
}

/**
 * Refresh all visible theme-sensitive labels in the UI.
 * Called after the user selects a new vocab theme so the page updates
 * immediately without a reload. Relies on getLabel() returning the newly
 * active theme's labels (AppState is updated before this is called).
 */
function _refreshLiveLensLabels() {
    // Injected helpers (checkCompleteAllButton, updateStatsPanel, updateMainMenuHeader)
    // also call getLabel() internally — run them first so their DOM writes land,
    // then our explicit updates below ensure the key elements are correct too.
    _deps.checkCompleteAllButton?.();
    _deps.updateStatsPanel?.();
    _deps.updateMainMenuHeader?.();
    _deps.updateHelpWindow?.();

    // Task input placeholder ("Add task" → "Add habit" etc.)
    const taskInputEl = document.getElementById(DOM_IDS.TASK_INPUT);
    if (taskInputEl) {
        taskInputEl.placeholder = getLabel('action.addTask');
    }

    // App subtitle ("ROUTINE MANAGER" → "HABIT TRACKER" etc.)
    const appSubtitle = document.getElementById(DOM_IDS.APP_SUBTITLE);
    if (appSubtitle) {
        appSubtitle.textContent = getLabel('nav.appSubtitle');
    }

    // Quick-action "Add Task" button text
    const addTaskText = document.getElementById(DOM_IDS.TOGGLE_TASK_INPUT_TEXT);
    if (addTaskText) {
        addTaskText.textContent = getLabel('action.addTask');
    }

    // Complete-all button text ("Complete Cycle" → "Complete Habits" etc.)
    const completeBtn = document.getElementById(DOM_IDS.COMPLETE_ALL);
    if (completeBtn) {
        const isToDoMode = document.body.classList.contains('todo-mode-mode');
        completeBtn.textContent = isToDoMode
            ? '🧹 ' + getLabel('action.clearCompletedTasks')
            : '🔄 ' + getLabel('action.completeCycle');
    }
}

export class ThemeManager {
    constructor() {
        console.log('🎨 ThemeManager initializing...');

        this.themes = [
            {
                id: "DarkOcean",
                class: "dark-ocean", 
                label: `Dark Ocean Theme ${getIcon('themeOcean')}`,
                unlockKey: "dark-ocean"
            },
            {
                id: "GoldenGlow",
                class: "golden-glow",
                label: `Golden Glow Theme ${getIcon('themeStar')}`,
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
            // Set initial theme color on startup
            this.updateThemeColor();
            console.log('🎨 ThemeManager ready');
        } catch (error) {
            console.warn('⚠️ ThemeManager init warning:', error.message);
        }
    }
    
    // ===== CORE THEME FUNCTIONS =====
    
    /**
     * Apply a theme to the document
     * @param {string} themeName - Theme name ('default', 'dark-ocean', 'golden-glow')
     * @param {boolean} shouldSave - Whether to save to storage (false during initial load)
     */
    async applyTheme(themeName, shouldSave = true) {
        try {
            console.log('🎨 Applying theme...', themeName);

            // Step 1: Remove all theme classes
            const allThemes = ['theme-dark-ocean', 'theme-golden-glow', 'theme-dark'];
            allThemes.forEach(theme => document.body?.classList.remove(theme));

            // Step 2: Add selected theme class if it's not 'default'
            if (themeName && themeName !== 'default') {
                document.body?.classList.add(`theme-${themeName}`);
            }

            // Step 3: Apply theme via CSS [data-theme] attribute (CSS-native, instant)
            const root = document.documentElement;
            if (themeName && themeName !== 'default') {
                root.dataset.theme = themeName;
            } else {
                delete root.dataset.theme;
            }

            // Step 4: Update theme color after applying theme
            this.updateThemeColor();

            // Step 5: Save to Schema 2.5 only (skip during initial load)
            if (shouldSave) {
                this.saveThemeToStorage(themeName);
            }

            // Step 6: Update UI checkboxes
            this.updateThemeToggles(themeName);

            console.log('✅ Theme application completed');
        } catch (error) {
            console.warn('⚠️ Theme application failed:', error.message, '- using defaults');
        }
    }
    
    /**
     * Update theme color meta tags for PWA
     * - Default view: Blue (#4c79ff) for seamless look
     * - Custom appBg color: Use that color
     * - Custom background image: Black
     * - Dark mode: Black
     */
    updateThemeColor() {
        try {
            const body = document.body;
            if (!body) {
                console.warn('⚠️ Document body not available for theme color update');
                return;
            }

            const themeColorMeta = _deps.getElementById(DOM_IDS.THEME_COLOR_META);
            const statusBarMeta = _deps.getElementById(DOM_IDS.STATUS_BAR_STYLE_META);

            const isDarkMode = body.classList.contains('dark-mode');
            const hasCustomBackground = body.classList.contains('has-bg-image');

            let themeColor;
            let statusBarStyle;

            // Determine current theme
            let currentTheme = 'default';
            if (body.classList.contains('theme-dark-ocean')) {
                currentTheme = 'dark-ocean';
            } else if (body.classList.contains('theme-golden-glow')) {
                currentTheme = 'golden-glow';
            }

            // Use black-translucent to show body background-color
            statusBarStyle = 'black-translucent';

            // Check for custom appBg color from preferences
            const customAppBg = getComputedStyle(document.documentElement).getPropertyValue('--pref-app-bg').trim();

            if (customAppBg) {
                // Use custom app background color for status bar
                themeColor = customAppBg;
            } else if (isDarkMode || hasCustomBackground) {
                // Black for dark mode or custom background image
                themeColor = '#000000';
            } else {
                // Default: match the app's blue gradient starting color
                themeColor = '#4c79ff';
            }

            // Update meta tags
            if (themeColorMeta) {
                themeColorMeta.setAttribute('content', themeColor);
            }

            if (statusBarMeta) {
                statusBarMeta.setAttribute('content', statusBarStyle);
            }

            // CRITICAL: Also update body's background-color for iOS black-translucent status bar
            // iOS reads the actual CSS background-color, not just the meta tag
            body.style.backgroundColor = themeColor;

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
            const thisToggle = _deps.getElementById(toggleId);
            if (!thisToggle) {
                console.warn(`⚠️ Dark mode toggle element '${toggleId}' not found`);
                return;
            }

            // ✅ Idempotency guard (per-toggle)
            if (thisToggle.dataset.darkModeSetup) {
                console.log(`✅ Dark mode toggle '${toggleId}' already set up`);
                return;
            }
            thisToggle.dataset.darkModeSetup = 'true';

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
            document.documentElement?.classList.toggle("dark-mode", isDark);

            // Update theme color and quick toggle
            this.updateThemeColor();
            this.updateQuickToggleIcon(isDark);

            // Event handler with safeAddEventListener
            const safeAdd = _deps.safeAddEventListener;
            thisToggle._darkModeChangeHandler = (e) => {
                const enabled = e.target.checked;
                this.toggleDarkMode(enabled, allToggleIds, thisToggle);
            };
            safeAdd(thisToggle, "change", thisToggle._darkModeChangeHandler);

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
            const quickToggle = _deps.getElementById(DOM_IDS.QUICK_DARK_TOGGLE);
            if (!quickToggle) {
                console.warn('⚠️ Quick dark toggle element not found');
                return;
            }

            // ✅ Idempotency guard
            if (quickToggle.dataset.quickToggleSetup) {
                console.log('✅ Quick dark toggle already set up');
                return;
            }
            quickToggle.dataset.quickToggleSetup = 'true';

            console.log('🌙 Setting up quick dark toggle...');
            
            // Get current dark mode state
            const schemaData = this.loadSchemaData();
            const isDark = schemaData ? (schemaData.settings?.darkMode || false) : false;
            
            // Remove existing listeners to prevent duplicates
            const newQuickToggle = quickToggle.cloneNode(true);
            quickToggle.parentNode?.replaceChild(newQuickToggle, quickToggle);
            
            // Set correct initial icon state
            newQuickToggle.textContent = isDark ? getIcon('lightMode') : getIcon('darkMode');
            
            const safeAdd = _deps.safeAddEventListener;
            newQuickToggle._clickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();

                console.log('🌙 Quick dark toggle clicked');

                // Find primary toggle and simulate change
                const primaryToggle = _deps.getElementById(DOM_IDS.DARK_MODE_TOGGLE);
                if (primaryToggle) {
                    console.log('🔄 Triggering primary toggle, current state:', primaryToggle.checked);
                    primaryToggle.checked = !primaryToggle.checked;

                    const changeEvent = new Event("change", { bubbles: true, cancelable: true });
                    primaryToggle.dispatchEvent(changeEvent);

                    console.log('🔄 Primary toggle new state:', primaryToggle.checked);
                } else {
                    console.warn('⚠️ Primary dark mode toggle not found');
                }
            };
            safeAdd(newQuickToggle, "click", newQuickToggle._clickHandler);

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
            document.documentElement?.classList.toggle("dark-mode", enabled);

            console.log('🌙 Dark mode toggle changed:', enabled);
            
            // Save to storage
            this.saveDarkModeToStorage(enabled);
            
            // Sync all other toggles
            allToggleIds.forEach(id => {
                const otherToggle = _deps.getElementById(id);
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
            const currentQuickToggle = _deps.getElementById(DOM_IDS.QUICK_DARK_TOGGLE);
            if (currentQuickToggle) {
                currentQuickToggle.textContent = isDark ? getIcon('lightMode') : getIcon('darkMode');
            }
        } catch (error) {
            console.warn('⚠️ Quick toggle icon update failed:', error.message);
        }
    }
    
    // ===== THEME UNLOCK FUNCTIONS (removed — now handled by VocabThemeManager) =====

    /**
     * @deprecated Dark Ocean and Golden Glow are no longer unlock-gated.
     * Kept as no-ops temporarily so any stale DI wiring doesn't throw.
     */
    async unlockDarkOceanTheme() {
        // No-op — Dark Ocean is now freely available in Quick Colors
    }

    async unlockGoldenGlowTheme() {
        // No-op — Golden Glow is now freely available in Quick Colors
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
     * @deprecated #theme-options-section was removed — color themes live in Personalization.
     * Kept as a no-op so stale call sites in featureBoot/uiBoot don't throw.
     */
    initThemesPanel() {
        // No-op: #theme-options-section no longer exists in the DOM.
        // Vocabulary themes are rendered by renderVocabThemes() on modal open.
    }
    
    /**
     * Refresh theme toggles based on unlocked themes
     */
    refreshThemeToggles() {
        try {
            console.log('🎨 Refreshing theme toggles (Schema 2.5 only)...');
            
            const container = _deps.getElementById(DOM_IDS.THEME_OPTION_CONTAINER);
            if (!container) {
                // Settings panel not open - skip UI refresh (theme is still unlocked in state)
                console.log('ℹ️ Theme panel not visible - skipping toggle refresh');
                return;
            }
            
            container.innerHTML = ""; // Clear current options

            const schemaData = this.loadSchemaData();
            if (!schemaData) {
                console.log('ℹ️ Schema data not yet loaded for refreshThemeToggles — will populate when settings open');
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
                label: `Default Theme ${getIcon('themeDefault')}`,
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
     * Add a theme toggle to the container (radio button style)
     */
    addThemeToggle(container, theme, currentTheme, isUnlocked) {
        try {
            if (!isUnlocked) return;

            const toggleDiv = document.createElement('label');
            toggleDiv.className = 'theme-radio-option';
            toggleDiv.setAttribute('for', `toggle${theme.id}Theme`);

            const isChecked = currentTheme === theme.class || (currentTheme === 'default' && theme.class === 'default');

            toggleDiv.innerHTML = `
                <input
                    type="radio"
                    class="theme-toggle"
                    id="toggle${theme.id}Theme"
                    name="theme-selection"
                    value="${theme.class}"
                    ${isChecked ? 'checked' : ''}
                />
                <span class="theme-radio-label">${theme.label}</span>
            `;

            const radio = toggleDiv.querySelector('input');
            if (radio) {
                const safeAdd = _deps.safeAddEventListener;
                radio._themeChangeHandler = (e) => {
                    if (e.target.checked) {
                        this.applyTheme(theme.class === 'default' ? 'default' : theme.class);
                    }
                };
                safeAdd(radio, 'change', radio._themeChangeHandler);
            }

            container.appendChild(toggleDiv);
        } catch (error) {
            console.warn('⚠️ Theme toggle creation failed:', error.message);
        }
    }
    
    /**
     * Render vocabulary theme options into #vocab-theme-section.
     * Called each time the Themes modal opens so unlock state is always fresh.
     */
    renderVocabThemes() {
        try {
            const vtm = _deps.vocabThemeManager;
            const section = _deps.getElementById(DOM_IDS.VOCAB_THEME_SECTION);
            if (!section || !vtm) return;

            const state = _deps.AppState?.get?.();
            if (!state) return;

            const activeCycleId = state.appState?.activeCycleId;
            const activeCycle = state.data?.cycles?.[activeCycleId];
            const currentThemeId = activeCycle?.theme ?? 'classic';
            const unlocked = new Set(vtm.getUnlockedThemeIds());

            section.innerHTML = '';

            // Section heading
            const heading = document.createElement('p');
            heading.className = 'vocab-theme-heading';
            heading.textContent = getLabel('unlock.vocabThemeSection');
            section.appendChild(heading);

            const themeIds = ['classic', 'habit-tracker', 'fitness', 'scholar', 'cleaning'];
            themeIds.forEach(id => {
                if (!unlocked.has(id)) return; // hide locked themes entirely

                const def = vtm.getThemeDefinition(id);
                if (!def) return;

                const isCurrent = id === currentThemeId;
                const icon = def.icons?.celebrate ?? (id === 'classic' ? '✨' : '');

                const option = document.createElement('label');
                option.className = 'theme-radio-option vocab-theme-option';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'vocab-theme-selection';
                radio.value = id;
                radio.checked = isCurrent;

                const labelSpan = document.createElement('span');
                labelSpan.className = 'theme-radio-label vocab-theme-label';

                const nameEl = document.createElement('span');
                nameEl.className = 'vocab-theme-name';
                nameEl.textContent = icon ? `${icon} ${def.name}` : def.name;
                labelSpan.appendChild(nameEl);

                option.appendChild(radio);
                option.appendChild(labelSpan);

                radio.addEventListener('change', () => {
                    if (radio.checked && activeCycleId) {
                        vtm.setRoutineTheme(activeCycleId, id);
                        _deps.showNotification?.(
                            getLabel('unlock.vocabThemeApplied', { vars: { name: def.name } }),
                            'success', 2000
                        );
                        _refreshLiveLensLabels();
                    }
                });

                section.appendChild(option);
            });

            console.log('✅ Vocab themes rendered in Themes modal');
        } catch (error) {
            console.warn('⚠️ renderVocabThemes failed:', error.message);
        }
    }

    /**
     * Refresh all theme-sensitive labels in the UI to match the active vocab theme.
     *
     * Called in two situations:
     *   1. Boot — from uiBoot.finalizeUI(), so HTML-hardcoded elements ("Add Task",
     *      "Complete Cycle", etc.) show the correct themed text on first load.
     *   2. Theme change — from renderVocabThemes() and routineSwitcher._selectTheme()
     *      so the page updates immediately without a reload.
     *
     * If you add a new HTML element whose text should change with the active vocab
     * theme, add its DOM update to _refreshLiveLensLabels() below.
     */
    refreshThemeLabels() {
        _refreshLiveLensLabels();
    }

    /**
     * Setup themes panel modal
     */
    setupThemesPanel() {
        // ✅ Idempotency guard
        if (this._setupThemesPanelInitialized) {
            console.log('✅ Themes panel already set up');
            return;
        }
        this._setupThemesPanelInitialized = true;

        try {
            console.log('🎨 Setting up themes panel (Schema 2.5 only)...');
            
            const schemaData = this.loadSchemaData();
            if (!schemaData) {
                console.log('ℹ️ Schema data not yet loaded for setupThemesPanel — deferring setup');
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
            const themeButton = _deps.getElementById(DOM_IDS.OPEN_THEMES_PANEL);
            const themesModal = _deps.getModal('themes');
            const themesModalContent = themesModal?.querySelector(DOM_SELECTORS.THEMES_MODAL_CONTENT);
            const closeThemesBtn = _deps.getElementById(DOM_IDS.CLOSE_THEMES_BTN);

            // Themes modal is always accessible (vocabulary themes available from day one)
            if (themeButton) {
                themeButton.style.display = "block";
            }

            // Open modal
            const safeAdd = _deps.safeAddEventListener;
            if (themeButton) {
                themeButton._clickHandler = () => {
                    if (themesModal && !themesModal.open) {
                        themesModal._previousFocus = document.activeElement;
                        themesModal.showModal();
                        this.renderVocabThemes();
                        _deps.hideMainMenu?.();
                    }
                };
                safeAdd(themeButton, "click", themeButton._clickHandler);
            }

            // Close modal on button click
            if (closeThemesBtn) {
                closeThemesBtn._clickHandler = () => {
                    if (themesModal?.open) {
                        themesModal.close();
                        themesModal._previousFocus?.focus({ focusVisible: false });
                    }
                };
                safeAdd(closeThemesBtn, "click", closeThemesBtn._clickHandler);
            }

            // Close modal on click outside (backdrop click)
            if (themesModal) {
                themesModal._backdropClickHandler = (e) => {
                    // Only close if clicking on the backdrop itself, not the content
                    if (e.target === themesModal) {
                        themesModal.close();
                        themesModal._previousFocus?.focus({ focusVisible: false });
                    }
                };
                safeAdd(themesModal, "click", themesModal._backdropClickHandler);

                // Restore focus when dialog closes (including native ESC)
                safeAdd(themesModal, "close", () => {
                    themesModal._previousFocus?.focus({ focusVisible: false });
                });
            }

            // Prevent clicks inside modal content from closing
            if (themesModalContent) {
                themesModalContent._stopPropagation = (e) => {
                    e.stopPropagation();
                };
                safeAdd(themesModalContent, "click", themesModalContent._stopPropagation);
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
            const themeContainer = _deps.querySelector(DOM_SELECTORS.THEME_CONTAINER);
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
            const themeButton = _deps.getElementById(DOM_IDS.OPEN_THEMES_PANEL);
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
            _deps.querySelectorAll(DOM_SELECTORS.THEME_TOGGLE).forEach(cb => {
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
            if (_deps.AppState?.isReady?.()) {
                const state = _deps.AppState.get();
                if (state && Object.keys(state).length > 0) {
                    return state;
                }
                return null;
            }
            // Fallback to direct localStorage if AppState not ready yet
            const data = localStorage.getItem(STORAGE_KEYS.DATA);
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
        await _deps.appInit?.waitForCore();

        // ✅ Use injected AppState only (no window.* fallback)
        if (!_deps.AppState?.isReady?.()) {
            console.error('❌ AppState not injected or not ready for saveSchemaData');
            return;
        }

        try {
            // Replace entire state data (filter dangerous keys to prevent prototype pollution)
            const safeData = Object.fromEntries(
                Object.entries(data).filter(([k]) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype')
            );
            await _deps.AppState.update(state => {
                Object.assign(state, safeData);
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
     * Optional notification function (no window.* fallback)
     */
    get showNotification() {
        return _deps.showNotification || null;
    }
}

// ===== MODULE INITIALIZATION =====

// Create singleton instance
const themeManager = new ThemeManager();

/**
 * Initialize ThemeManager (called by moduleLoader)
 * @param {Object} dependencies - Injected dependencies
 * @returns {ThemeManager} The singleton instance
 */
export async function initThemeManager(dependencies = {}) {
    // Set dependencies
    setThemeManagerDependencies(dependencies);

    // Initialize theme panel (creates containers and populates theme toggles)
    themeManager.initThemesPanel();
    themeManager.setupThemesPanel?.();

    // ✅ Load and apply saved theme from storage on startup
    const schemaData = themeManager.loadSchemaData();
    const savedTheme = schemaData?.settings?.theme;
    if (savedTheme && savedTheme !== 'default') {
        console.log('🎨 Applying saved theme from storage:', savedTheme);
        await themeManager.applyTheme(savedTheme, false); // false = don't save again
    } else {
        // For default theme, still update the theme color (status bar)
        themeManager.updateThemeColor();
    }

    console.log('✅ ThemeManager initialized via initThemeManager');
    return themeManager;
}

// ===== GLOBAL API FUNCTIONS =====

/**
 * Apply a theme
 * @param {string} themeName - Theme to apply
 * @param {boolean} shouldSave - Whether to save (default true)
 * @returns {Promise<void>}
 */
async function applyTheme(themeName, shouldSave = true) {
    return themeManager.applyTheme(themeName, shouldSave);
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
 * Initialize themes panel
 */
function initThemesPanel() {
    return themeManager.initThemesPanel();
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

// Export singleton and wrapper functions
// Note: ThemeManager class and initThemeManager are already exported at declaration
export {
    themeManager,
    applyTheme,
    updateThemeColor,
    setupDarkModeToggle,
    setupQuickDarkToggle,
    initThemesPanel,
    refreshThemeToggles,
    setupThemesPanel,
    setupThemesPanelWithData
};
