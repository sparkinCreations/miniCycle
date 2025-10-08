/**
 * GlobalUtils Tests
 * Clean, focused testing for medium-sized project
 */

const fs = require('fs');
const path = require('path');

// Import the module by evaluating it (browser module adaptation)
const moduleCode = fs.readFileSync(
    path.join(__dirname, '../utilities/globalUtils.js'),
    'utf8'
);

// Adapt for Node.js testing
const adaptedCode = moduleCode
    .replace(/export\s+class\s+GlobalUtils/g, 'class GlobalUtils')
    .replace(/export\s+default\s+GlobalUtils/g, '');

eval(adaptedCode);

describe('GlobalUtils', () => {
    let testElement;

    beforeEach(() => {
        // Create test DOM elements
        document.body.innerHTML = `
            <div id="test-element">Test Content</div>
            <div id="test-element-2">Test Content 2</div>
            <div class="test-class">Class Element 1</div>
            <div class="test-class">Class Element 2</div>
            <div class="test-class">Class Element 3</div>
        `;
        testElement = document.getElementById('test-element');
    });

    describe('Module Information', () => {
        test('getModuleInfo returns correct structure', () => {
            const info = GlobalUtils.getModuleInfo();

            expect(info).toHaveProperty('version');
            expect(info).toHaveProperty('name', 'GlobalUtils');
            expect(info).toHaveProperty('functionsCount');
            expect(info).toHaveProperty('loadedAt');
            expect(typeof info.functionsCount).toBe('number');
        });

        test('exports to window object', () => {
            expect(global.window.GlobalUtils).toBe(GlobalUtils);
        });
    });

    describe('Element Selection', () => {
        test('safeGetElementById finds existing element', () => {
            const element = GlobalUtils.safeGetElementById('test-element', false);

            expect(element).toBe(testElement);
            expect(element.id).toBe('test-element');
        });

        test('safeGetElementById returns null for missing element', () => {
            const element = GlobalUtils.safeGetElementById('nonexistent', false);

            expect(element).toBeNull();
        });

        test('safeGetElementById warns when element not found', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            GlobalUtils.safeGetElementById('nonexistent', true);

            expect(consoleSpy).toHaveBeenCalledWith('⚠ Element not found: #nonexistent');
            consoleSpy.mockRestore();
        });

        test('safeQuerySelectorAll finds multiple elements', () => {
            const elements = GlobalUtils.safeQuerySelectorAll('.test-class', false);

            expect(elements.length).toBe(3);
        });

        test('safeQuerySelectorAll returns empty NodeList for missing selector', () => {
            const elements = GlobalUtils.safeQuerySelectorAll('.nonexistent', false);

            expect(elements.length).toBe(0);
        });
    });

    describe('Event Listeners', () => {
        test('safeAddEventListener adds event listener', () => {
            const handler = jest.fn();

            GlobalUtils.safeAddEventListener(testElement, 'click', handler);
            testElement.click();

            expect(handler).toHaveBeenCalledTimes(1);
        });

        test('safeAddEventListener handles null element', () => {
            expect(() => {
                GlobalUtils.safeAddEventListener(null, 'click', jest.fn());
            }).not.toThrow();
        });

        test('safeAddEventListener removes old listener before adding new one', () => {
            const handler = jest.fn();

            GlobalUtils.safeAddEventListener(testElement, 'click', handler);
            GlobalUtils.safeAddEventListener(testElement, 'click', handler);
            testElement.click();

            // Should only fire once, not twice
            expect(handler).toHaveBeenCalledTimes(1);
        });

        test('safeAddEventListenerById adds listener by element ID', () => {
            const handler = jest.fn();

            GlobalUtils.safeAddEventListenerById('test-element', 'click', handler);
            testElement.click();

            expect(handler).toHaveBeenCalledTimes(1);
        });

        test('safeAddEventListenerById warns for missing element', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            GlobalUtils.safeAddEventListenerById('nonexistent', 'click', jest.fn());

            expect(consoleSpy).toHaveBeenCalledWith('⚠ Cannot attach event listener: #nonexistent not found.');
            consoleSpy.mockRestore();
        });

        test('safeAddEventListenerBySelector adds to multiple elements', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const handler = jest.fn();

            GlobalUtils.safeAddEventListenerBySelector('.test-class', 'click', handler);

            document.querySelectorAll('.test-class').forEach(el => el.click());

            expect(handler).toHaveBeenCalledTimes(3);
            expect(consoleSpy).toHaveBeenCalledWith(
                '✅ Attached click listeners to 3 elements matching ".test-class"'
            );
            consoleSpy.mockRestore();
        });

        test('safeRemoveEventListener removes event listener', () => {
            const handler = jest.fn();

            GlobalUtils.safeAddEventListener(testElement, 'click', handler);
            testElement.click();

            GlobalUtils.safeRemoveEventListener(testElement, 'click', handler);
            testElement.click();

            expect(handler).toHaveBeenCalledTimes(1);
        });

        test('safeRemoveEventListenerById removes by ID', () => {
            const handler = jest.fn();

            GlobalUtils.safeAddEventListenerById('test-element', 'click', handler);
            testElement.click();

            GlobalUtils.safeRemoveEventListenerById('test-element', 'click', handler);
            testElement.click();

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('Content Manipulation', () => {
        test('safeSetInnerHTML sets HTML with element', () => {
            const result = GlobalUtils.safeSetInnerHTML(testElement, '<span>New HTML</span>');

            expect(result).toBe(true);
            expect(testElement.innerHTML).toBe('<span>New HTML</span>');
        });

        test('safeSetInnerHTML sets HTML with element ID', () => {
            const result = GlobalUtils.safeSetInnerHTML('test-element', '<span>ID HTML</span>');

            expect(result).toBe(true);
            expect(testElement.innerHTML).toBe('<span>ID HTML</span>');
        });

        test('safeSetInnerHTML returns false for missing element', () => {
            const result = GlobalUtils.safeSetInnerHTML('nonexistent', '<span>Test</span>');

            expect(result).toBe(false);
        });

        test('safeSetTextContent sets text with element', () => {
            const result = GlobalUtils.safeSetTextContent(testElement, 'New Text');

            expect(result).toBe(true);
            expect(testElement.textContent).toBe('New Text');
        });

        test('safeSetTextContent sets text with element ID', () => {
            const result = GlobalUtils.safeSetTextContent('test-element', 'ID Text');

            expect(result).toBe(true);
            expect(testElement.textContent).toBe('ID Text');
        });

        test('safeSetTextContent returns false for missing element', () => {
            const result = GlobalUtils.safeSetTextContent('nonexistent', 'Test');

            expect(result).toBe(false);
        });
    });

    describe('CSS Class Manipulation', () => {
        test('safeToggleClass toggles class with element', () => {
            const result1 = GlobalUtils.safeToggleClass(testElement, 'active');
            expect(result1).toBe(true);
            expect(testElement.classList.contains('active')).toBe(true);

            const result2 = GlobalUtils.safeToggleClass(testElement, 'active');
            expect(result2).toBe(false);
            expect(testElement.classList.contains('active')).toBe(false);
        });

        test('safeToggleClass with force parameter', () => {
            GlobalUtils.safeToggleClass(testElement, 'forced', true);
            expect(testElement.classList.contains('forced')).toBe(true);

            GlobalUtils.safeToggleClass(testElement, 'forced', true);
            expect(testElement.classList.contains('forced')).toBe(true);

            GlobalUtils.safeToggleClass(testElement, 'forced', false);
            expect(testElement.classList.contains('forced')).toBe(false);
        });

        test('safeToggleClass works with element ID', () => {
            const result = GlobalUtils.safeToggleClass('test-element', 'active');

            expect(result).toBe(true);
            expect(testElement.classList.contains('active')).toBe(true);
        });

        test('safeAddClass adds class', () => {
            const result = GlobalUtils.safeAddClass(testElement, 'new-class');

            expect(result).toBe(true);
            expect(testElement.classList.contains('new-class')).toBe(true);
        });

        test('safeAddClass works with element ID', () => {
            const result = GlobalUtils.safeAddClass('test-element', 'id-class');

            expect(result).toBe(true);
            expect(testElement.classList.contains('id-class')).toBe(true);
        });

        test('safeRemoveClass removes class', () => {
            testElement.classList.add('remove-me');

            const result = GlobalUtils.safeRemoveClass(testElement, 'remove-me');

            expect(result).toBe(true);
            expect(testElement.classList.contains('remove-me')).toBe(false);
        });

        test('safeRemoveClass works with element ID', () => {
            testElement.classList.add('remove-id');

            const result = GlobalUtils.safeRemoveClass('test-element', 'remove-id');

            expect(result).toBe(true);
            expect(testElement.classList.contains('remove-id')).toBe(false);
        });
    });

    describe('Performance Utilities', () => {
        test('debounce delays function execution', (done) => {
            const func = jest.fn();
            const debouncedFunc = GlobalUtils.debounce(func, 50);

            debouncedFunc();
            expect(func).not.toHaveBeenCalled();

            setTimeout(() => {
                expect(func).toHaveBeenCalledTimes(1);
                done();
            }, 60);
        });

        test('debounce resets timer on subsequent calls', (done) => {
            const func = jest.fn();
            const debouncedFunc = GlobalUtils.debounce(func, 50);

            debouncedFunc();
            setTimeout(() => debouncedFunc(), 30);

            setTimeout(() => {
                expect(func).not.toHaveBeenCalled();
            }, 60);

            setTimeout(() => {
                expect(func).toHaveBeenCalledTimes(1);
                done();
            }, 100);
        });

        test('debounce with immediate executes immediately', () => {
            const func = jest.fn();
            const debouncedFunc = GlobalUtils.debounce(func, 50, true);

            debouncedFunc();
            expect(func).toHaveBeenCalledTimes(1);
        });

        test('throttle limits function calls', (done) => {
            const func = jest.fn();
            const throttledFunc = GlobalUtils.throttle(func, 50);

            throttledFunc();
            throttledFunc();
            throttledFunc();

            expect(func).toHaveBeenCalledTimes(1);

            setTimeout(() => {
                throttledFunc();
                expect(func).toHaveBeenCalledTimes(2);
                done();
            }, 60);
        });
    });

    describe('Utility Functions', () => {
        test('isElementInViewport detects visible elements', () => {
            // Mock getBoundingClientRect
            testElement.getBoundingClientRect = jest.fn(() => ({
                top: 100,
                left: 100,
                bottom: 200,
                right: 200
            }));

            global.window.innerHeight = 600;
            global.window.innerWidth = 800;

            const isVisible = GlobalUtils.isElementInViewport(testElement);
            expect(isVisible).toBe(true);
        });

        test('isElementInViewport detects elements outside viewport', () => {
            testElement.getBoundingClientRect = jest.fn(() => ({
                top: -100,
                left: 100,
                bottom: -50,
                right: 200
            }));

            const isVisible = GlobalUtils.isElementInViewport(testElement);
            expect(isVisible).toBe(false);
        });

        test('isElementInViewport handles null element', () => {
            const isVisible = GlobalUtils.isElementInViewport(null);
            expect(isVisible).toBe(false);
        });

        test('generateId creates unique IDs', () => {
            const id1 = GlobalUtils.generateId();
            const id2 = GlobalUtils.generateId();

            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^id-\d+-[a-z0-9]+$/);
        });

        test('generateId respects custom prefix', () => {
            const id = GlobalUtils.generateId('custom');

            expect(id).toMatch(/^custom-\d+-[a-z0-9]+$/);
        });
    });

    describe('Global API', () => {
        test('exposes all functions globally', () => {
            const expectedGlobals = [
                'safeAddEventListener',
                'safeAddEventListenerById',
                'safeAddEventListenerBySelector',
                'safeRemoveEventListener',
                'safeRemoveEventListenerById',
                'safeGetElementById',
                'safeQuerySelectorAll',
                'safeSetInnerHTML',
                'safeSetTextContent',
                'safeToggleClass',
                'safeAddClass',
                'safeRemoveClass',
                'debounce',
                'throttle',
                'isElementInViewport',
                'generateId'
            ];

            expectedGlobals.forEach(funcName => {
                expect(typeof global.window[funcName]).toBe('function');
            });
        });
    });
});
