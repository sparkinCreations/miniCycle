/**
 * ==========================================
 * 🛠️ GLOBAL UTILITIES MODULE
 * ==========================================
 * 
 * Core utility functions used throughout the miniCycle application.
 * These are foundational utilities that need to be available globally
 * without import overhead for frequently called functions.
 * 
 * @version 1.351
 * @author miniCycle Development Team
 */

export class GlobalUtils {
    /**
     * Adds an event listener safely by removing any existing listener first.
     * This prevents duplicate event bindings and ensures only one listener is active at a time.
     *
     * @param {HTMLElement} element - The element to attach the event listener to.
     * @param {string} event - The event type (e.g., "click", "input").
     * @param {Function} handler - The function that handles the event.
     */
    static safeAddEventListener(element, event, handler) {
        if (!element) return; // Prevent errors if element is null
        element.removeEventListener(event, handler); // Clear old one
        element.addEventListener(event, handler); // Add fresh
    }

    /**
     * Safely adds an event listener to an element by its ID.
     * Includes error checking and warning if element is not found.
     *
     * @param {string} id - The ID of the element to attach the event listener to.
     * @param {string} event - The event type (e.g., "click", "input").
     * @param {Function} handler - The function that handles the event.
     */
    static safeAddEventListenerById(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            GlobalUtils.safeAddEventListener(element, event, handler);
        } else {
            console.warn(`⚠ Cannot attach event listener: #${id} not found.`);
        }
    }

    /**
     * Safely adds an event listener to elements by CSS selector.
     * Applies the listener to all matching elements.
     *
     * @param {string} selector - CSS selector for elements to attach listeners to.
     * @param {string} event - The event type (e.g., "click", "input").
     * @param {Function} handler - The function that handles the event.
     */
    static safeAddEventListenerBySelector(selector, event, handler) {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) {
            console.warn(`⚠ Cannot attach event listener: No elements found for selector "${selector}".`);
            return;
        }
        
        elements.forEach(element => {
            GlobalUtils.safeAddEventListener(element, event, handler);
        });
        
        console.log(`✅ Attached ${event} listeners to ${elements.length} elements matching "${selector}"`);
    }

    /**
     * Safely removes an event listener from an element.
     * Includes null checking to prevent errors.
     *
     * @param {HTMLElement} element - The element to remove the event listener from.
     * @param {string} event - The event type.
     * @param {Function} handler - The function that was handling the event.
     */
    static safeRemoveEventListener(element, event, handler) {
        if (!element) return;
        element.removeEventListener(event, handler);
    }

    /**
     * Safely removes an event listener from an element by its ID.
     *
     * @param {string} id - The ID of the element.
     * @param {string} event - The event type.
     * @param {Function} handler - The function that was handling the event.
     */
    static safeRemoveEventListenerById(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            GlobalUtils.safeRemoveEventListener(element, event, handler);
        }
    }

    /**
     * Safely gets an element by ID with error handling.
     *
     * @param {string} id - The ID of the element to get.
     * @param {boolean} warnIfNotFound - Whether to log a warning if element is not found.
     * @returns {HTMLElement|null} The element or null if not found.
     */
    static safeGetElementById(id, warnIfNotFound = true) {
        const element = document.getElementById(id);
        if (!element && warnIfNotFound) {
            console.warn(`⚠ Element not found: #${id}`);
        }
        return element;
    }

    /**
     * Safely gets elements by CSS selector with error handling.
     *
     * @param {string} selector - The CSS selector.
     * @param {boolean} warnIfNotFound - Whether to log a warning if no elements are found.
     * @returns {NodeList} The elements or empty NodeList if none found.
     */
    static safeQuerySelectorAll(selector, warnIfNotFound = true) {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0 && warnIfNotFound) {
            console.warn(`⚠ No elements found for selector: "${selector}"`);
        }
        return elements;
    }

    /**
     * Safely sets inner HTML with null checking.
     *
     * @param {HTMLElement|string} elementOrId - Element or element ID.
     * @param {string} html - HTML content to set.
     * @returns {boolean} Success status.
     */
    static safeSetInnerHTML(elementOrId, html) {
        const element = typeof elementOrId === 'string' 
            ? GlobalUtils.safeGetElementById(elementOrId)
            : elementOrId;
            
        if (!element) return false;
        
        element.innerHTML = html;
        return true;
    }

    /**
     * Safely sets text content with null checking.
     *
     * @param {HTMLElement|string} elementOrId - Element or element ID.
     * @param {string} text - Text content to set.
     * @returns {boolean} Success status.
     */
    static safeSetTextContent(elementOrId, text) {
        const element = typeof elementOrId === 'string' 
            ? GlobalUtils.safeGetElementById(elementOrId)
            : elementOrId;
            
        if (!element) return false;
        
        element.textContent = text;
        return true;
    }

    /**
     * Safely toggles a CSS class on an element.
     *
     * @param {HTMLElement|string} elementOrId - Element or element ID.
     * @param {string} className - CSS class name to toggle.
     * @param {boolean} force - Optional force parameter for classList.toggle.
     * @returns {boolean} Whether the class is present after toggling.
     */
    static safeToggleClass(elementOrId, className, force = undefined) {
        const element = typeof elementOrId === 'string' 
            ? GlobalUtils.safeGetElementById(elementOrId)
            : elementOrId;
            
        if (!element) return false;
        
        return element.classList.toggle(className, force);
    }

    /**
     * Safely adds a CSS class to an element.
     *
     * @param {HTMLElement|string} elementOrId - Element or element ID.
     * @param {string} className - CSS class name to add.
     * @returns {boolean} Success status.
     */
    static safeAddClass(elementOrId, className) {
        const element = typeof elementOrId === 'string' 
            ? GlobalUtils.safeGetElementById(elementOrId)
            : elementOrId;
            
        if (!element) return false;
        
        element.classList.add(className);
        return true;
    }

    /**
     * Safely removes a CSS class from an element.
     *
     * @param {HTMLElement|string} elementOrId - Element or element ID.
     * @param {string} className - CSS class name to remove.
     * @returns {boolean} Success status.
     */
    static safeRemoveClass(elementOrId, className) {
        const element = typeof elementOrId === 'string' 
            ? GlobalUtils.safeGetElementById(elementOrId)
            : elementOrId;
            
        if (!element) return false;
        
        element.classList.remove(className);
        return true;
    }

    /**
     * Debounce function to limit how often a function can be called.
     *
     * @param {Function} func - Function to debounce.
     * @param {number} wait - Wait time in milliseconds.
     * @param {boolean} immediate - Whether to execute immediately on first call.
     * @returns {Function} Debounced function.
     */
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    /**
     * Throttle function to limit how often a function can be called.
     *
     * @param {Function} func - Function to throttle.
     * @param {number} limit - Time limit in milliseconds.
     * @returns {Function} Throttled function.
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Check if an element is visible in the viewport.
     *
     * @param {HTMLElement} element - Element to check.
     * @returns {boolean} Whether the element is visible.
     */
    static isElementInViewport(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Generate a unique ID string.
     *
     * @param {string} prefix - Optional prefix for the ID.
     * @returns {string} Unique ID.
     */
    static generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate a normalized notification ID from a message.
     * Used for deduplication of notification messages.
     *
     * @param {string} message - The notification message (may contain HTML).
     * @returns {string} Normalized text identifier.
     */
    static generateNotificationId(message) {
        return message
            .replace(/<br\s*\/?>/gi, '\n')   // Convert <br> to newline
            .replace(/<[^>]*>/g, '')         // Remove all HTML tags
            .replace(/\s+/g, ' ')            // Collapse whitespace
            .trim()
            .toLowerCase();                  // Normalize case
    }

    /**
     * Generate a hash-based ID from a message for notification tracking.
     * Creates a unique identifier based on message content.
     *
     * @param {string} message - The notification message.
     * @returns {string} Hash-based identifier (e.g., "note-12345").
     */
    static generateHashId(message) {
        const text = GlobalUtils.generateNotificationId(message);
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (hash << 5) - hash + text.charCodeAt(i);
            hash |= 0; // Force 32-bit int
        }
        return `note-${Math.abs(hash)}`;
    }

    /**
     * Sanitize user input to prevent XSS attacks and limit length.
     * Removes HTML tags and trims whitespace, then enforces character limit.
     *
     * @param {string} input - The user input to sanitize.
     * @param {number} maxLength - Maximum allowed length (default: 100 characters).
     * @returns {string} Sanitized and trimmed text.
     */
    static sanitizeInput(input, maxLength = 100) {
        if (typeof input !== "string") return "";
        const temp = document.createElement("div");
        temp.textContent = input; // Set as raw text (sanitized)
        return temp.textContent.trim().substring(0, maxLength);
    }

    /**
     * Escape HTML special characters to prevent XSS attacks.
     * Converts <, >, &, ", and ' to their HTML entity equivalents.
     * Use this when inserting user-provided content into innerHTML.
     *
     * @param {string} text - The text to escape.
     * @returns {string} HTML-safe escaped text.
     */
    static escapeHtml(text) {
        if (typeof text !== "string") return "";

        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };

        return text.replace(/[&<>"'\/]/g, char => escapeMap[char]);
    }

    /**
     * Safely set innerHTML with HTML escaping for user content.
     * Use this instead of directly setting innerHTML with user-provided data.
     *
     * @param {HTMLElement|string} elementOrId - Element or element ID.
     * @param {string} content - Content to set (will be HTML-escaped).
     * @param {boolean} allowHtml - If true, skips escaping (use only for trusted content).
     * @returns {boolean} Success status.
     */
    static safeSetInnerHTMLWithEscape(elementOrId, content, allowHtml = false) {
        const element = typeof elementOrId === 'string'
            ? GlobalUtils.safeGetElementById(elementOrId)
            : elementOrId;

        if (!element) return false;

        if (allowHtml) {
            // Only use for trusted content (admin messages, static UI)
            element.innerHTML = content;
        } else {
            // Escape user content to prevent XSS
            element.innerHTML = GlobalUtils.escapeHtml(content);
        }

        return true;
    }

    /**
     * Get module version and statistics.
     *
     * @returns {Object} Module information.
     */
    static getModuleInfo() {
        return {
            version: '1.351',
            name: 'GlobalUtils',
            functionsCount: Object.getOwnPropertyNames(GlobalUtils).filter(prop => typeof GlobalUtils[prop] === 'function').length - 1, // -1 for constructor
            loadedAt: new Date().toISOString()
        };
    }
}

// ===========================================
// 🌐 GLOBAL FUNCTION REGISTRATION
// ===========================================

// Make core functions globally accessible for backward compatibility
window.safeAddEventListener = GlobalUtils.safeAddEventListener;
window.safeAddEventListenerById = GlobalUtils.safeAddEventListenerById;
window.safeAddEventListenerBySelector = GlobalUtils.safeAddEventListenerBySelector;
window.safeRemoveEventListener = GlobalUtils.safeRemoveEventListener;
window.safeRemoveEventListenerById = GlobalUtils.safeRemoveEventListenerById;
window.safeGetElementById = GlobalUtils.safeGetElementById;
window.safeQuerySelectorAll = GlobalUtils.safeQuerySelectorAll;
window.safeSetInnerHTML = GlobalUtils.safeSetInnerHTML;
window.safeSetTextContent = GlobalUtils.safeSetTextContent;
window.safeToggleClass = GlobalUtils.safeToggleClass;
window.safeAddClass = GlobalUtils.safeAddClass;
window.safeRemoveClass = GlobalUtils.safeRemoveClass;

// Make utility functions globally accessible
window.debounce = GlobalUtils.debounce;
window.throttle = GlobalUtils.throttle;
window.isElementInViewport = GlobalUtils.isElementInViewport;
window.generateId = GlobalUtils.generateId;
window.sanitizeInput = GlobalUtils.sanitizeInput;
window.escapeHtml = GlobalUtils.escapeHtml;
window.safeSetInnerHTMLWithEscape = GlobalUtils.safeSetInnerHTMLWithEscape;

// Make notification utility functions globally accessible
window.generateNotificationId = GlobalUtils.generateNotificationId;
window.generateHashId = GlobalUtils.generateHashId;

// Make the class itself globally accessible
window.GlobalUtils = GlobalUtils;

console.log('🛠️ GlobalUtils module loaded - all utilities available globally');

export default GlobalUtils;

/*
===========================================
USAGE INSTRUCTIONS
===========================================

BASIC EVENT LISTENER FUNCTIONS:

1. Safe Event Listener (most common):
   safeAddEventListener(element, 'click', handleClick);
   
2. Safe Event Listener by ID:
   safeAddEventListenerById('my-button', 'click', handleClick);
   
3. Safe Event Listener by Selector (multiple elements):
   safeAddEventListenerBySelector('.btn', 'click', handleClick);

4. Remove Event Listeners:
   safeRemoveEventListener(element, 'click', handleClick);
   safeRemoveEventListenerById('my-button', 'click', handleClick);

ELEMENT SELECTION FUNCTIONS:

5. Safe Element Getting:
   const element = safeGetElementById('my-element'); // with warning
   const element = safeGetElementById('my-element', false); // no warning
   
6. Safe Query Selector:
   const elements = safeQuerySelectorAll('.my-class');

CONTENT MANIPULATION FUNCTIONS:

7. Safe HTML Setting:
   safeSetInnerHTML('my-div', '<p>New content</p>');
   safeSetInnerHTML(element, '<p>New content</p>');
   
8. Safe Text Setting:
   safeSetTextContent('my-div', 'New text');
   safeSetTextContent(element, 'New text');

CSS CLASS MANIPULATION FUNCTIONS:

9. Safe Class Toggle:
   safeToggleClass('my-element', 'active');
   safeToggleClass(element, 'active', true); // force add
   
10. Safe Class Add/Remove:
    safeAddClass('my-element', 'new-class');
    safeRemoveClass('my-element', 'old-class');

PERFORMANCE FUNCTIONS:

11. Debounce (wait for pause in calls):
    const debouncedFunction = debounce(myFunction, 300);
    
12. Throttle (limit call frequency):
    const throttledFunction = throttle(myFunction, 100);

UTILITY FUNCTIONS:

13. Check Element Visibility:
    if (isElementInViewport(element)) { // do something }
    
14. Generate Unique ID:
    const uniqueId = generateId(); // id-1234567890-abc123def
    const prefixedId = generateId('task'); // task-1234567890-abc123def

15. Sanitize User Input:
    const cleanText = sanitizeInput(userInput); // max 100 chars
    const cleanText = sanitizeInput(userInput, 200); // custom max length

MODULE INFORMATION:

16. Get Module Info:
    const info = GlobalUtils.getModuleInfo();
    console.log(info); // { version, name, functionsCount, loadedAt }

===========================================
MIGRATION FROM OLD CODE:
===========================================

OLD WAY:
function safeAddEventListener(element, event, handler) {
    if (!element) return;
    element.removeEventListener(event, handler);
    element.addEventListener(event, handler);
}

NEW WAY:
// Import the module in your main script:
import './modules/utils/globalUtils.js';

// Use exactly the same function calls - no changes needed!
safeAddEventListener(element, 'click', handler);
safeAddEventListenerById('button-id', 'click', handler);

===========================================
BEST PRACTICES:
===========================================

DO:
- Use safeAddEventListenerById() for single elements with known IDs
- Use safeAddEventListenerBySelector() for multiple similar elements
- Use debounce() for search inputs and resize events
- Use throttle() for scroll events and frequent DOM updates
- Check return values from safe functions when success matters

DON'T:
- Use regular addEventListener() without null checking
- Forget to remove event listeners when not using safe functions
- Use getElementById() without null checking
- Skip the 'safe' prefix - these functions prevent common errors

===========================================
TROUBLESHOOTING:
===========================================

Problem: "Function not found"
Solution: Make sure to import './modules/utils/globalUtils.js' in your main script

Problem: "Element not found" warnings
Solution: This is expected - the functions warn you about missing elements

Problem: Event listeners not working
Solution: Check the console for element not found warnings

Problem: Want to use class methods instead
Solution: Use GlobalUtils.safeAddEventListener() instead of the global function

===========================================
*/