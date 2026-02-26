// docsify-config.js — Docsify configuration (extracted for CSP compliance)
window.$docsify = {
    name: 'miniCycle',
    repo: '',

    // Load sidebar (use root _sidebar.md only, not subdirectories)
    loadSidebar: true,
    alias: {
        '/.*/_sidebar.md': '/_sidebar.md'
    },

    // Auto header with sidebar
    subMaxLevel: 3,

    // Enable search
    search: {
        maxAge: 86400000,
        paths: 'auto',
        placeholder: 'Search documentation...',
        noData: 'No results found.',
        depth: 3,
        hideOtherSidebarContent: false
    },

    // Pagination
    pagination: {
        previousText: 'Previous',
        nextText: 'Next',
        crossChapter: true,
        crossChapterText: true
    },

    // Copy code button
    copyCode: {
        buttonText: 'Copy',
        errorText: 'Error',
        successText: 'Copied!'
    },

    // Dark mode configuration
    darklightTheme: {
        siteFont: 'PT Sans',
        defaultTheme: 'light',
        codeFontFamily: 'Roboto Mono, Monaco, courier, monospace',
        bodyFontSize: '15px',
        dark: {
            accent: '#74c0fc',
            toogleBackground: '#ffffff',
            background: '#1e1e1e',
            textColor: '#e0e0e0',
            codeTextColor: '#ffffff',
            codeBackgroundColor: '#2d2d2d',
            borderColor: '#3d3d3d',
            blockQuoteColor: '#858585',
            highlightColor: '#4c79ff',
            sidebarSublink: '#b4b4b4',
            codeTypeColor: '#ffffff',
            coverBackground: 'linear-gradient(to left bottom, #2d2d2d 0%, #1e1e1e 100%)'
        },
        light: {
            accent: '#4c79ff',
            toogleBackground: '#1e1e1e',
            background: '#ffffff',
            textColor: '#34495e',
            codeTextColor: '#525252',
            codeBackgroundColor: '#f8f8f8',
            borderColor: '#e0e0e0',
            blockQuoteColor: '#858585',
            highlightColor: '#4c79ff',
            sidebarSublink: '#505d6b',
            codeTypeColor: '#091a28',
            coverBackground: 'linear-gradient(to left bottom, #4c79ff 0%, #74c0fc 100%)'
        }
    },

    // Custom footer
    plugins: [
        function(hook) {
            hook.beforeEach(function(html) {
                return html + '\n\n---\n\n*Last updated: {docsify-updated}*';
            });
        }
    ],

    // Theme color
    themeColor: '#4c79ff',

    // Cover page disabled (using README as home)
    coverpage: false,

    // Execute script tags
    executeScript: true,

    // Fallback language for code blocks
    fallbackLanguages: ['javascript', 'bash', 'json'],

    // Emoji support
    emoji: true
};
