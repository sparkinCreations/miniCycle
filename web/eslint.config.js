import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
    {
        ignores: [
            'node_modules/**',
            'blog/**',
            'examples/**',
            'tests/**',
            'scripts/**',
            'modules/testing/**',
            '*.min.js'
        ]
    },
    {
        files: ['modules/**/*.js', '*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                MessageChannel: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                performance: 'readonly',
                navigator: 'readonly',
                location: 'readonly',
                history: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                FormData: 'readonly',
                Blob: 'readonly',
                File: 'readonly',
                FileReader: 'readonly',
                Event: 'readonly',
                CustomEvent: 'readonly',
                KeyboardEvent: 'readonly',
                MutationObserver: 'readonly',
                IntersectionObserver: 'readonly',
                ResizeObserver: 'readonly',
                HTMLElement: 'readonly',
                HTMLDialogElement: 'readonly',
                Element: 'readonly',
                Node: 'readonly',
                NodeList: 'readonly',
                Audio: 'readonly',
                Image: 'readonly',
                Notification: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                prompt: 'readonly',
                getComputedStyle: 'readonly',
                matchMedia: 'readonly',
                CSS: 'readonly',
                Proxy: 'readonly',
                Map: 'readonly',
                Set: 'readonly',
                WeakMap: 'readonly',
                WeakSet: 'readonly',
                Symbol: 'readonly',
                Promise: 'readonly',
                queueMicrotask: 'readonly',
                structuredClone: 'readonly',
                crypto: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
                // Service Worker / Cache API
                self: 'readonly',
                caches: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                Cache: 'readonly',
                CacheStorage: 'readonly',
                ServiceWorker: 'readonly',
                ServiceWorkerRegistration: 'readonly',
                // Idle callback
                requestIdleCallback: 'readonly',
                cancelIdleCallback: 'readonly',
                // IndexedDB
                indexedDB: 'readonly',
                IDBKeyRange: 'readonly',
                // Web APIs
                DOMParser: 'readonly',
                XMLSerializer: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                AbortController: 'readonly',
                AbortSignal: 'readonly',
                // Touch events
                Touch: 'readonly',
                TouchEvent: 'readonly',
                TouchList: 'readonly',
                // Screen
                screen: 'readonly',
                visualViewport: 'readonly'
            }
        },
        plugins: {
            security,
            sonarjs
        },
        rules: {
            // Security plugin rules
            'security/detect-object-injection': 'warn',
            'security/detect-non-literal-regexp': 'warn',
            'security/detect-unsafe-regex': 'error',
            'security/detect-buffer-noassert': 'error',
            'security/detect-eval-with-expression': 'error',
            'security/detect-no-csrf-before-method-override': 'error',
            'security/detect-possible-timing-attacks': 'warn',

            // XSS regression aid (input-normalizer audit): flag any
            // `el.innerHTML = `...${x}...`` write for triage. Interpolate ONLY
            // escapeHtml() output, getLabel(), or static constants into an
            // innerHTML template — never raw user/import text. `warn` (not
            // `error`) because ~57 pre-existing, reviewed-safe sites predate the
            // rule; the goal is to surface any NEW site for review. If a flagged
            // site is safe, add an eslint-disable-next-line with a short reason.
            'no-restricted-syntax': ['warn', {
                selector: "AssignmentExpression[left.property.name='innerHTML'][right.type='TemplateLiteral']",
                message: 'Template literal assigned to innerHTML — interpolate only escapeHtml() output, getLabel(), or static constants, never raw user/import text. If this site is safe, add an eslint-disable-next-line with a reason.'
            }],

            // SonarJS rules (code quality)
            'sonarjs/no-identical-functions': 'warn',
            'sonarjs/no-duplicated-branches': 'warn',
            'sonarjs/no-collapsible-if': 'warn',
            'sonarjs/prefer-single-boolean-return': 'warn',
            'sonarjs/no-redundant-boolean': 'warn',
            'sonarjs/no-unused-collection': 'warn',
            'sonarjs/no-gratuitous-expressions': 'warn',
            'sonarjs/no-nested-template-literals': 'off', // Common in this codebase
            'sonarjs/cognitive-complexity': ['warn', 25], // Flag very complex functions

            // Basic JS rules
            // Empty catch blocks must carry an intent comment (a comment makes
            // the block non-empty to ESLint) — same regression-gate philosophy
            // as the Lighthouse CI CLS gate. See magic-number-audit.md.
            'no-empty': ['error', { allowEmptyCatch: false }],
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'no-console': 'off', // Console logging is used throughout
            'prefer-const': 'warn',
            'no-var': 'warn',
            'eqeqeq': ['warn', 'smart']
        }
    }
];
