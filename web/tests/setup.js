/**
 * Jest Test Setup
 * Minimal but useful setup for medium-sized project testing
 */

// Global test utilities
global.createMockSchemaData = (overrides = {}) => {
    return {
        metadata: {
            version: "2.5",
            lastModified: Date.now()
        },
        settings: {
            theme: 'default',
            darkMode: false,
            unlockedThemes: [],
            ...overrides.settings
        },
        cycles: {},
        userProgress: {
            rewardMilestones: []
        },
        ...overrides
    };
};

// Mock DOM setup for miniCycle
global.setupMiniCycleDOM = () => {
    document.body.innerHTML = `
        <meta id="theme-color-meta" name="theme-color" content="#5680ff">
        <meta id="status-bar-style-meta" name="apple-mobile-web-app-status-bar-style" content="default">
        <button id="darkModeToggle"></button>
        <button id="darkModeToggleThemes"></button>
        <button id="quick-dark-toggle">🌙</button>
        <button id="open-themes-panel" style="display: none;"></button>
        <div id="themes-modal" style="display: none;"></div>
        <button id="close-themes-btn"></button>
        <div id="theme-options-section"></div>
        <div id="theme-option-container"></div>
    `;
};

// Clean up before each test
beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Reset body classes
    document.body.className = '';
    
    // Clear any global state
    delete global.window.AppState;
    delete global.window.showNotification;
    delete global.window.hideMainMenu;
    delete global.window.themeManager;
});

// Mock common browser APIs
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Suppress console logs during tests (optional)
// Uncomment these lines if you want cleaner test output
// global.console = {
//     ...console,
//     log: jest.fn(),
//     warn: jest.fn(),
//     error: jest.fn()
// };