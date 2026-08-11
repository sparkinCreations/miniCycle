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

            // OFF deliberately (Aug 2026) — this rule flags EVERY `obj[variable]`, which is
            // the codebase's core idiom: cycles keyed by name, tasks and recurringTemplates
            // keyed by id, labels keyed by key, DI deps keyed by name. It fired 623 times
            // across 99 of ~136 modules — 64% of all lint warnings, and roughly two-thirds
            // of every file. A warning that fires nearly everywhere carries no signal: it
            // buries the ~344 warnings that do mean something, and it made the
            // --max-warnings ratchet useless as a "what did this change add?" gate.
            //
            // Audited before switching off, rather than assumed. Splitting the 626 hits
            // measured over modules/ by whether they read or write:
            //   • 526 were READS. A read cannot pollute anything. Zero value.
            //   • 100 were writes. All were internal — own-property clones
            //     (`clone[key] = structuredClone(obj[key])`), boot wiring keyed by manifest
            //     names, dataset keys from constants — or already key-filtered at the trust
            //     boundary (cycleImportManager's `allowedBtnKeys`, preferencesPresets'
            //     VALID_PRESET_KEYS, sanitized task ids).
            //   • The audit did surface one real bug, now fixed in utils/nameUtils.js:
            //     `existingCycles[name]` truthiness inherited from Object.prototype, so a
            //     routine named "constructor"/"toString"/"valueOf" was reported as a
            //     collision and silently renamed. See the isNameTaken() comment there.
            //
            // The actual defense against prototype pollution is key sanitization at the
            // trust boundary, NOT a lint rule on every bracket access: DataValidator
            // ._checkForPrototypePollution() rejects __proto__/constructor/prototype in
            // parsed import data (JSON.parse creates __proto__ as an own property, so
            // Object.keys sees it), and nameUtils.isNameTaken() keeps user-typed names off
            // the raw __proto__ key. Extend THOSE when adding a new input path.
            //
            // If you reach for this rule again, prefer a targeted no-restricted-syntax
            // selector matching writes with unsanitized keys — reads are pure noise here.
            //
            // Knock-on: the --max-warnings ratchet in package.json dropped 970 -> 360.
            // The 16 warnings of headroom over the actual 344 are DELIBERATE. The old
            // ceiling sat 3 above the real count, so an incidental no-unused-vars broke
            // the release gate — that is what kept CI red for four consecutive releases.
            // Keep a small gap when lowering it after a cleanup; do not pin it to the
            // exact current count, and never raise it to absorb new warnings.
            'security/detect-object-injection': 'off',
            'security/detect-non-literal-regexp': 'warn',
            'security/detect-unsafe-regex': 'error',
            'security/detect-buffer-noassert': 'error',
            'security/detect-eval-with-expression': 'error',
            'security/detect-no-csrf-before-method-override': 'error',
            'security/detect-possible-timing-attacks': 'warn',

            // XSS regression aid (input-normalizer audit): flag any
            // `el.innerHTML = `...${x}...`` write for triage. Interpolate ONLY
            // escapeHtml() output, VAR-FREE getLabel(), or static constants into
            // an innerHTML template — never raw user/import text. getLabel() with
            // vars is NOT innerHTML-safe when any var can carry user text:
            // interpolate() does not escape (deliberately — escaping at the
            // source would double-escape at sinks that escape whole messages and
            // render literal entities in textContent/aria sinks), so escape each
            // user-content var before passing it (see taskOptionsCustomizer's
            // `vars: { name: escapeHtml(cycleTitle) }`). `warn` (not `error`)
            // because ~57 pre-existing, reviewed-safe sites predate the rule; the
            // goal is to surface any NEW site for review. If a flagged site is
            // safe, add an eslint-disable-next-line with a short reason. Matches
            // CLAUDE.md §7 ("Always Use textContent for User Data").
            'no-restricted-syntax': ['warn', {
                selector: "AssignmentExpression[left.property.name='innerHTML'][right.type='TemplateLiteral']",
                message: 'Template literal assigned to innerHTML — interpolate only escapeHtml() output, getLabel() whose vars carry no user text (escape such vars first), or static constants — never raw user/import text. If this site is safe, add an eslint-disable-next-line with a reason.'
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
    },
    {
        // service-worker.js declares an ES5-ONLY style contract in its own file
        // banner ("no const/let, arrows, async/await, optional chaining — this
        // file must parse on the oldest supported WebViews"). `var` there is
        // required, not a lapse, so no-var/prefer-const were reporting ~87
        // warnings for code doing exactly what it must. Left on, they also ate
        // the entire --max-warnings headroom: any SW edit that added a couple of
        // `var`s broke CI (v2.394 did — 3 vars + 1 false-positive sink pushed
        // 1074 → 1078). Scoped off here so the ratchet tracks real drift.
        // If the ES5 contract is ever lifted, delete this block.
        files: ['service-worker.js'],
        rules: {
            'no-var': 'off',
            'prefer-const': 'off'
        }
    }
];
