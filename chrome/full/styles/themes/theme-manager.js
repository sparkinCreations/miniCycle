/**
 * JSON Theme Manager
 *
 * Utility for loading and validating JSON theme definitions.
 * Primarily used for custom theme import/export.
 *
 * Built-in themes (dark, dark-ocean, golden-glow) are now applied
 * CSS-natively via [data-theme] attribute on <html> — see:
 *   styles/themes/themes.css  → theme variable overrides
 *   modules/features/themeManager.js → sets document.documentElement.dataset.theme
 *
 * This module handles:
 * - JSON theme validation
 * - Custom theme import/export (user-created themes)
 * - Theme cache for repeated loads
 *
 * @see styles/themes/themes.css
 * @see docs/guides/THEME_CREATION_GUIDE.md
 * @see docs/future-work/THEME_ARCHITECTURE.md
 */

// ============================================================================
// THEME CACHE
// ============================================================================

const themeCache = new Map();

// ============================================================================
// TOKEN TO CSS VARIABLE MAPPING
// ============================================================================

const TOKEN_TO_CSS = {
  // Backgrounds
  'colors.backgrounds.gradient': '--theme-bg-gradient',
  'colors.backgrounds.solid': '--theme-bg-solid',
  'colors.backgrounds.surface': '--theme-bg-surface',
  'colors.backgrounds.surfaceElevated': '--theme-bg-surface-elevated',

  // Text
  'colors.text.primary': '--theme-text-primary',
  'colors.text.secondary': '--theme-text-secondary',
  'colors.text.onSurface': '--theme-text-on-surface',
  'colors.text.muted': '--theme-text-muted',

  // Semantic
  'colors.semantic.success': '--theme-color-success',
  'colors.semantic.successLight': '--theme-color-success-light',
  'colors.semantic.warning': '--theme-color-warning',
  'colors.semantic.warningLight': '--theme-color-warning-light',
  'colors.semantic.error': '--theme-color-error',
  'colors.semantic.errorLight': '--theme-color-error-light',
  'colors.semantic.info': '--theme-color-info',

  // Header
  'colors.header.bg': '--theme-header-bg',
  'colors.header.text': '--theme-header-text',
  'colors.header.border': '--theme-header-border',

  // Components - Card
  'colors.components.card.bg': '--theme-card-bg',
  'colors.components.card.border': '--theme-card-border',
  'colors.components.card.shadow': '--theme-card-shadow',

  // Components - Input
  'colors.components.input.bg': '--theme-input-bg',
  'colors.components.input.text': '--theme-input-text',
  'colors.components.input.border': '--theme-input-border',
  'colors.components.input.focusBorder': '--theme-input-focus-border',
  'colors.components.input.placeholder': '--theme-input-placeholder',

  // Components - Button
  'colors.components.button.primaryBg': '--theme-button-primary-bg',
  'colors.components.button.primaryText': '--theme-button-primary-text',
  'colors.components.button.primaryHoverBg': '--theme-button-primary-hover-bg',
  'colors.components.button.secondaryBg': '--theme-button-secondary-bg',
  'colors.components.button.secondaryText': '--theme-button-secondary-text',
  'colors.components.button.secondaryHoverBg': '--theme-button-secondary-hover-bg',

  // Components - Modal
  'colors.components.modal.bg': '--theme-modal-bg',
  'colors.components.modal.text': '--theme-modal-text',
  'colors.components.modal.border': '--theme-modal-border',
  'colors.components.modal.overlay': '--theme-modal-overlay',
  'colors.components.modal.headerBg': '--theme-modal-header-bg',
  'colors.components.modal.footerBg': '--theme-modal-footer-bg',

  // Components - Notification
  'colors.components.notification.bg': '--theme-notification-bg',
  'colors.components.notification.text': '--theme-notification-text',

  // Components - Task
  'colors.components.task.bg': '--theme-task-bg',
  'colors.components.task.text': '--theme-task-text',
  'colors.components.task.completedBg': '--theme-task-completed-bg',
  'colors.components.task.completedText': '--theme-task-completed-text',
  'colors.components.task.border': '--theme-task-border',
  'colors.components.task.checkmark': '--theme-task-checkmark',

  // Components - Progress
  'colors.components.progress.trackBg': '--theme-progress-track-bg',
  'colors.components.progress.fillBg': '--theme-progress-fill-bg',
  'colors.components.progress.text': '--theme-progress-text',

  // Components - Stats Panel
  'colors.components.statsPanel.bg': '--theme-stats-bg',
  'colors.components.statsPanel.text': '--theme-stats-text',
  'colors.components.statsPanel.border': '--theme-stats-border'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Flatten nested object to dot notation paths
 * { a: { b: 1 } } → { 'a.b': 1 }
 * @param {Object} obj - Nested object
 * @param {string} prefix - Current path prefix
 * @returns {Object} Flattened object
 */
function flattenTokens(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenTokens(value, path));
    } else {
      result[path] = value;
    }
  }
  return result;
}

/**
 * Validate theme object has required fields
 * @param {Object} theme - Theme object to validate
 * @returns {boolean} True if valid
 */
function validateTheme(theme) {
  if (!theme) return false;
  if (!theme.id || typeof theme.id !== 'string') return false;
  if (!theme.name || typeof theme.name !== 'string') return false;
  if (!/^[a-z][a-z0-9-]*$/.test(theme.id)) {
    console.warn(`Invalid theme ID format: ${theme.id}`);
    return false;
  }
  return true;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Load theme from JSON file
 * @param {string} themeId - Theme identifier
 * @returns {Promise<Object|null>} Theme object or null
 */
async function loadTheme(themeId) {
  // Check cache first
  if (themeCache.has(themeId)) {
    return themeCache.get(themeId);
  }

  try {
    const response = await fetch(`./styles/themes/definitions/${themeId}.json`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const theme = await response.json();

    if (!validateTheme(theme)) {
      throw new Error('Invalid theme structure');
    }

    // Cache for future use
    themeCache.set(themeId, theme);
    return theme;
  } catch (error) {
    console.error(`❌ Failed to load theme: ${themeId}`, error);
    return null;
  }
}

/**
 * Apply theme to document by setting CSS custom properties
 * @param {Object} theme - Theme object with tokens
 * @returns {boolean} True if applied successfully
 */
function applyThemeTokens(theme) {
  if (!theme) {
    console.warn('⚠️ No theme object provided');
    return false;
  }

  if (!theme.tokens) {
    return true;
  }

  const root = document.documentElement;
  const flatTokens = flattenTokens(theme.tokens);
  let appliedCount = 0;

  // Apply each token as CSS variable
  for (const [tokenPath, cssVar] of Object.entries(TOKEN_TO_CSS)) {
    const value = flatTokens[tokenPath];
    if (value !== undefined && value !== null) {
      root.style.setProperty(cssVar, value);
      appliedCount++;
    }
  }

  // Add theme-active class to indicate a custom theme is applied
  // This prevents dark-mode.css from overriding theme variables
  root.classList.add('theme-active');
  if (document.body) {
    document.body.classList.add('theme-active');
  }

  return true;
}

/**
 * Reset all theme CSS variables to defaults
 * (Variables will fall back to :root values in variables.css)
 */
function resetThemeTokens() {
  const root = document.documentElement;

  // Remove all theme CSS variables
  for (const cssVar of Object.values(TOKEN_TO_CSS)) {
    root.style.removeProperty(cssVar);
  }

  // Remove theme-active class so dark-mode.css can apply its variable overrides
  root.classList.remove('theme-active');
  if (document.body) {
    document.body.classList.remove('theme-active');
  }

}

/**
 * Load and apply a theme by ID
 * @param {string} themeId - Theme identifier ('default' resets to defaults)
 * @returns {Promise<boolean>} True if successful
 */
async function setTheme(themeId) {
  if (themeId === 'default') {
    resetThemeTokens();
    return true;
  }

  const theme = await loadTheme(themeId);
  if (!theme) {
    console.warn(`⚠️ Theme not found: ${themeId}, using defaults`);
    resetThemeTokens();
    return false;
  }

  return applyThemeTokens(theme);
}

/**
 * Get list of available built-in themes
 * @returns {Array<{id: string, name: string}>}
 */
function getBuiltInThemes() {
  return [
    { id: 'default', name: 'Default Blue' },
    { id: 'dark', name: 'Dark Mode' },
    { id: 'dark-ocean', name: 'Dark Ocean' },
    { id: 'golden-glow', name: 'Golden Glow' }
  ];
}

/**
 * Export theme as JSON string (for sharing)
 * @param {Object} theme - Theme object
 * @returns {string} JSON string
 */
function exportTheme(theme) {
  return JSON.stringify(theme, null, 2);
}

/**
 * Import theme from JSON string
 * @param {string} jsonString - Theme JSON
 * @returns {Object|null} Theme object or null if invalid
 */
function importTheme(jsonString) {
  try {
    const theme = JSON.parse(jsonString);
    if (!validateTheme(theme)) {
      throw new Error('Invalid theme structure');
    }
    // Add to cache
    themeCache.set(theme.id, theme);
    return theme;
  } catch (error) {
    console.error('❌ Failed to import theme:', error);
    return null;
  }
}

/**
 * Clear theme cache
 */
function clearCache() {
  themeCache.clear();
}

// ============================================================================
// EXPORTS
// ============================================================================

export const JSONThemeManager = {
  loadTheme,
  applyThemeTokens,
  resetThemeTokens,
  setTheme,
  getBuiltInThemes,
  exportTheme,
  importTheme,
  clearCache,
  // Expose for testing/debugging
  TOKEN_TO_CSS,
  flattenTokens,
  validateTheme
};

export {
  loadTheme,
  applyThemeTokens,
  resetThemeTokens,
  setTheme,
  getBuiltInThemes,
  exportTheme,
  importTheme,
  clearCache
};

export default JSONThemeManager;

