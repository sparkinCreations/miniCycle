/**
 * @module uxRatingsPanel
 * @pattern Simple Instance
 * @description Product UX ratings panel for collecting user feedback
 *
 * Allows users to rate their experience with miniCycle using:
 * - Star ratings (1-5 stars)
 * - Quick feedback tags (easy to use, helpful, etc.)
 * - Optional text feedback
 * - Local storage of ratings history
 * - Optional submission via Web3Forms API
 *
 * Features:
 * - Beautiful star rating UI with hover effects
 * - Quick tag selection for common feedback
 * - Persistent local ratings in AppState
 * - Integration with existing feedback system
 */

import { createDIModule, optional } from '../core/diBase.js';

// ============================================================================
// APPCONTEXT DYNAMIC IMPORT (versioned for cache-busting)
// ============================================================================
let _appContextModule = null;
let ui = () => null;

async function loadAppContext() {
    if (!_appContextModule) {
        const version = typeof window !== 'undefined' ? (window.APP_VERSION || '1.509') : '1.509';
        _appContextModule = await import(`../core/appContext.js?v=${version}`);
        ui = _appContextModule.ui;
        console.log('✅ UXRatingsPanel: appContext loaded with version', version);
    }
    return _appContextModule;
}

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('UXRatingsPanel', {
    AppState: optional(null),
    showNotification: optional(null),
    appInit: optional(null),
    safeAddEventListener: optional(null)
});

const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Set dependencies for UXRatingsPanel
 * @param {Object} dependencies - { AppState, showNotification, etc. }
 */
export function setUXRatingsPanelDependencies(dependencies) {
    di.setDependencies(dependencies);
    console.log('⚙️ UXRatingsPanel dependencies set:', Object.keys(dependencies));
}

// ============================================================================
// RATING CATEGORIES
// ============================================================================

const RATING_TAGS = [
    { key: 'easyToUse', label: 'Easy to Use', icon: '🎯' },
    { key: 'helpful', label: 'Helpful', icon: '💡' },
    { key: 'beautiful', label: 'Beautiful Design', icon: '🎨' },
    { key: 'fast', label: 'Fast & Smooth', icon: '⚡' },
    { key: 'organized', label: 'Keeps Me Organized', icon: '📋' },
    { key: 'motivating', label: 'Motivating', icon: '🚀' }
];

const RATING_PROMPTS = {
    1: "We're sorry to hear that. How can we improve?",
    2: "Thanks for the feedback. What could be better?",
    3: "Thanks! What would make it even better?",
    4: "Great! What do you love about miniCycle?",
    5: "Awesome! We're glad you're enjoying miniCycle!"
};

// ============================================================================
// UX RATINGS PANEL CLASS
// ============================================================================

export class UXRatingsPanel {
    constructor(deps = {}) {
        this._constructorDeps = {
            getElementById: deps.getElementById || ((id) => document.getElementById(id)),
            querySelector: deps.querySelector || ((sel) => document.querySelector(sel))
        };

        this._currentRating = 0;
        this._selectedTags = new Set();

        console.log('✅ UXRatingsPanel initialized');
    }

    get deps() {
        return {
            AppState: _deps.AppState,
            showNotification: _deps.showNotification,
            appInit: _deps.appInit,
            ...this._constructorDeps
        };
    }

    /**
     * Setup event listeners for opening the ratings panel
     */
    setupEventListeners() {
        const safeAdd = _deps.safeAddEventListener || ((el, ev, fn, opts) => {
            el?.removeEventListener(ev, fn, opts);
            el?.addEventListener(ev, fn, opts);
        });

        const attachListener = () => {
            // Main menu button
            const openBtn = document.getElementById('open-ux-ratings-panel');
            if (openBtn) {
                openBtn._clickHandler = () => this.showRatingsPanel();
                safeAdd(openBtn, 'click', openBtn._clickHandler);
                console.log('✅ UX ratings panel event listener attached');
            }

            // Settings button (if exists)
            const settingsBtn = document.getElementById('open-ux-ratings-settings');
            if (settingsBtn) {
                settingsBtn._clickHandler = () => this.showRatingsPanel();
                safeAdd(settingsBtn, 'click', settingsBtn._clickHandler);
            }
        };

        if (document.readyState === 'loading') {
            document._uxRatingsDOMContentLoaded = attachListener;
            document.addEventListener('DOMContentLoaded', attachListener);
        } else {
            attachListener();
        }
    }

    /**
     * Show the ratings panel modal
     */
    async showRatingsPanel() {
        const appInitModule = this.deps.appInit;
        if (appInitModule?.waitForCore) {
            await appInitModule.waitForCore();
        }

        // Reset state
        this._currentRating = 0;
        this._selectedTags = new Set();

        // Load previous rating if exists
        const previousRating = this.getPreviousRating();

        this.createModal(previousRating);
    }

    /**
     * Get previous rating from AppState
     * @returns {Object|null} Previous rating data
     */
    getPreviousRating() {
        const state = this.deps.AppState?.get?.();
        return state?.userProgress?.uxRating || null;
    }

    /**
     * Create the ratings modal
     * @param {Object|null} previousRating - Previous rating data if exists
     */
    createModal(previousRating) {
        // Remove any existing modal
        const existing = this.deps.getElementById('ux-ratings-modal');
        if (existing) existing.remove();

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'ux-ratings-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content ux-ratings-modal">
                <div class="modal-header">
                    <img src="assets/images/logo/taskcycle_logo_blackandwhite_transparent.png" alt="miniCycle Logo" class="modal-logo">
                    <div class="modal-header-text">
                        <h2>Rate Your Experience</h2>
                        <p class="modal-subtitle">Help us improve miniCycle</p>
                    </div>
                </div>

                <div class="modal-body">
                    <!-- Star Rating -->
                    <div class="ux-rating-section">
                        <label class="ux-rating-label">How would you rate miniCycle?</label>
                        <div class="ux-star-rating" role="radiogroup" aria-label="Star rating">
                            ${this.buildStarRating()}
                        </div>
                        <p id="rating-prompt" class="ux-rating-prompt"></p>
                    </div>

                    <!-- Quick Tags -->
                    <div class="ux-rating-section ux-tags-section" style="display: none;">
                        <label class="ux-rating-label">What do you like? (optional)</label>
                        <div class="ux-rating-tags">
                            ${this.buildRatingTags()}
                        </div>
                    </div>

                    <!-- Text Feedback -->
                    <div class="ux-rating-section ux-feedback-section" style="display: none;">
                        <label class="ux-rating-label" for="ux-feedback-text">Additional feedback (optional)</label>
                        <textarea
                            id="ux-feedback-text"
                            class="ux-feedback-textarea"
                            placeholder="Tell us more about your experience..."
                            maxlength="500"
                        ></textarea>
                        <span class="ux-char-count"><span id="ux-char-current">0</span>/500</span>
                    </div>

                    ${previousRating ? this.buildPreviousRatingInfo(previousRating) : ''}
                </div>

                <div class="modal-footer">
                    <button id="submit-ux-rating" class="primary-button" disabled>
                        <i class="fas fa-star"></i> Submit Rating
                    </button>
                    <button id="close-ux-rating" class="secondary-button">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.attachModalListeners(modal);

        // Show with animation
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    /**
     * Build star rating HTML
     * @returns {string} HTML string
     */
    buildStarRating() {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            html += `
                <button
                    type="button"
                    class="ux-star"
                    data-rating="${i}"
                    aria-label="Rate ${i} star${i > 1 ? 's' : ''}"
                    role="radio"
                    aria-checked="false"
                >
                    <i class="far fa-star"></i>
                </button>
            `;
        }
        return html;
    }

    /**
     * Build rating tags HTML
     * @returns {string} HTML string
     */
    buildRatingTags() {
        return RATING_TAGS.map(tag => `
            <button
                type="button"
                class="ux-tag"
                data-tag="${tag.key}"
                aria-pressed="false"
            >
                <span class="ux-tag-icon">${tag.icon}</span>
                <span class="ux-tag-label">${tag.label}</span>
            </button>
        `).join('');
    }

    /**
     * Build previous rating info HTML
     * @param {Object} rating - Previous rating data
     * @returns {string} HTML string
     */
    buildPreviousRatingInfo(rating) {
        const date = new Date(rating.timestamp).toLocaleDateString();
        return `
            <div class="ux-previous-rating">
                <p class="ux-previous-note">
                    <i class="fas fa-history"></i>
                    You previously rated ${rating.stars} star${rating.stars !== 1 ? 's' : ''} on ${date}
                </p>
            </div>
        `;
    }

    /**
     * Attach event listeners to modal
     * @param {HTMLElement} modal - Modal element
     */
    attachModalListeners(modal) {
        const safeAdd = _deps.safeAddEventListener || ((el, ev, fn, opts) => {
            el?.removeEventListener(ev, fn, opts);
            el?.addEventListener(ev, fn, opts);
        });

        // Star rating listeners
        const stars = modal.querySelectorAll('.ux-star');
        stars.forEach(star => {
            star._clickHandler = () => this.handleStarClick(star, stars, modal);
            star._mouseenterHandler = () => this.handleStarHover(star, stars, true);
            star._mouseleaveHandler = () => this.handleStarHover(star, stars, false);

            safeAdd(star, 'click', star._clickHandler);
            safeAdd(star, 'mouseenter', star._mouseenterHandler);
            safeAdd(star, 'mouseleave', star._mouseleaveHandler);
        });

        // Tag listeners
        const tags = modal.querySelectorAll('.ux-tag');
        tags.forEach(tag => {
            tag._clickHandler = () => this.handleTagClick(tag);
            safeAdd(tag, 'click', tag._clickHandler);
        });

        // Text feedback character count
        const textarea = modal.querySelector('#ux-feedback-text');
        const charCount = modal.querySelector('#ux-char-current');
        if (textarea && charCount) {
            textarea._inputHandler = () => {
                charCount.textContent = textarea.value.length;
            };
            safeAdd(textarea, 'input', textarea._inputHandler);
        }

        // Submit button
        const submitBtn = modal.querySelector('#submit-ux-rating');
        if (submitBtn) {
            submitBtn._clickHandler = () => this.submitRating(modal);
            safeAdd(submitBtn, 'click', submitBtn._clickHandler);
        }

        // Close button
        const closeBtn = modal.querySelector('#close-ux-rating');
        if (closeBtn) {
            closeBtn._clickHandler = () => this.closeModal(modal);
            safeAdd(closeBtn, 'click', closeBtn._clickHandler);
        }

        // Overlay click
        modal._overlayClickHandler = (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        };
        safeAdd(modal, 'click', modal._overlayClickHandler);

        // ESC key
        modal._escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
                document.removeEventListener('keydown', modal._escHandler);
            }
        };
        safeAdd(document, 'keydown', modal._escHandler);
    }

    /**
     * Handle star click
     * @param {HTMLElement} clickedStar - Clicked star element
     * @param {NodeList} allStars - All star elements
     * @param {HTMLElement} modal - Modal element
     */
    handleStarClick(clickedStar, allStars, modal) {
        const rating = parseInt(clickedStar.dataset.rating);
        this._currentRating = rating;

        // Update stars visually
        allStars.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            const icon = star.querySelector('i');
            if (starRating <= rating) {
                star.classList.add('selected');
                icon.classList.remove('far');
                icon.classList.add('fas');
            } else {
                star.classList.remove('selected');
                icon.classList.remove('fas');
                icon.classList.add('far');
            }
            star.setAttribute('aria-checked', starRating === rating ? 'true' : 'false');
        });

        // Update prompt
        const promptEl = modal.querySelector('#rating-prompt');
        if (promptEl) {
            promptEl.textContent = RATING_PROMPTS[rating] || '';
            promptEl.classList.add('show');
        }

        // Show additional sections
        const tagsSection = modal.querySelector('.ux-tags-section');
        const feedbackSection = modal.querySelector('.ux-feedback-section');
        if (tagsSection) tagsSection.style.display = 'block';
        if (feedbackSection) feedbackSection.style.display = 'block';

        // Enable submit button
        const submitBtn = modal.querySelector('#submit-ux-rating');
        if (submitBtn) submitBtn.disabled = false;
    }

    /**
     * Handle star hover
     * @param {HTMLElement} hoveredStar - Hovered star element
     * @param {NodeList} allStars - All star elements
     * @param {boolean} isHovering - Whether hovering or not
     */
    handleStarHover(hoveredStar, allStars, isHovering) {
        if (isHovering && this._currentRating === 0) {
            const hoverRating = parseInt(hoveredStar.dataset.rating);
            allStars.forEach(star => {
                const starRating = parseInt(star.dataset.rating);
                if (starRating <= hoverRating) {
                    star.classList.add('hover');
                } else {
                    star.classList.remove('hover');
                }
            });
        } else if (!isHovering && this._currentRating === 0) {
            allStars.forEach(star => star.classList.remove('hover'));
        }
    }

    /**
     * Handle tag click
     * @param {HTMLElement} tag - Tag element
     */
    handleTagClick(tag) {
        const tagKey = tag.dataset.tag;

        if (this._selectedTags.has(tagKey)) {
            this._selectedTags.delete(tagKey);
            tag.classList.remove('selected');
            tag.setAttribute('aria-pressed', 'false');
        } else {
            this._selectedTags.add(tagKey);
            tag.classList.add('selected');
            tag.setAttribute('aria-pressed', 'true');
        }
    }

    /**
     * Submit the rating
     * @param {HTMLElement} modal - Modal element
     */
    async submitRating(modal) {
        if (this._currentRating === 0) return;

        const textarea = modal.querySelector('#ux-feedback-text');
        const feedback = textarea?.value?.trim() || '';

        const ratingData = {
            stars: this._currentRating,
            tags: Array.from(this._selectedTags),
            feedback: feedback,
            timestamp: new Date().toISOString(),
            appVersion: window.APP_VERSION || '1.509'
        };

        // Save to AppState
        await this.saveRating(ratingData);

        // Show success notification
        ui()?.showNotification?.(`Thank you for your ${this._currentRating}-star rating!`, 'success', 3000);

        // Close modal
        this.closeModal(modal);
    }

    /**
     * Save rating to AppState
     * @param {Object} ratingData - Rating data
     */
    async saveRating(ratingData) {
        const AppState = this.deps.AppState;
        if (!AppState) {
            console.warn('⚠️ AppState not available, rating not saved');
            return;
        }

        await AppState.update(state => {
            if (!state.userProgress) {
                state.userProgress = {};
            }

            // Store current rating
            state.userProgress.uxRating = ratingData;

            // Keep history (last 10 ratings)
            if (!state.userProgress.uxRatingHistory) {
                state.userProgress.uxRatingHistory = [];
            }
            state.userProgress.uxRatingHistory.unshift(ratingData);
            if (state.userProgress.uxRatingHistory.length > 10) {
                state.userProgress.uxRatingHistory = state.userProgress.uxRatingHistory.slice(0, 10);
            }
        }, true);

        console.log('✅ UX rating saved:', ratingData);
    }

    /**
     * Close and remove modal
     * @param {HTMLElement} modal - Modal element
     */
    closeModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }

    /**
     * Get current user's rating stats
     * @returns {Object} Rating statistics
     */
    getRatingStats() {
        const state = this.deps.AppState?.get?.();
        const history = state?.userProgress?.uxRatingHistory || [];

        if (history.length === 0) {
            return { averageRating: 0, totalRatings: 0, lastRating: null };
        }

        const sum = history.reduce((acc, r) => acc + r.stars, 0);
        return {
            averageRating: (sum / history.length).toFixed(1),
            totalRatings: history.length,
            lastRating: history[0]
        };
    }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

let uxRatingsPanel = null;

/**
 * Initialize the UX ratings panel
 * @param {Object} dependencies - Dependency injection object
 * @returns {UXRatingsPanel} The initialized instance
 */
export async function initUXRatingsPanel(dependencies = {}) {
    if (uxRatingsPanel) {
        console.warn('⚠️ UXRatingsPanel already initialized');
        return uxRatingsPanel;
    }

    await loadAppContext();

    uxRatingsPanel = new UXRatingsPanel(dependencies);
    uxRatingsPanel.setupEventListeners();

    return uxRatingsPanel;
}

export { uxRatingsPanel };

console.log('✅ UXRatingsPanel module loaded (DI-pure)');
