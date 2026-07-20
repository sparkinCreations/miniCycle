/**
 * @module uxRatings
 * @pattern Simple Instance
 * @description Optional star rating inside the feedback modal.
 *
 * Enhances the existing #feedback-form (miniCycle.html) with a 1-5 star
 * rating row and quick "what stands out" tags. The star/tag values are
 * written into hidden inputs (name="rating" / name="rating_tags") inside
 * the form, so modalManager's existing FormData submit sends them to
 * Web3Forms with no changes to the submission path.
 *
 * On submit (when a rating is selected) the rating is also persisted
 * locally to state.userProgress.uxRating (+ capped history), and the modal
 * shows a "you previously rated..." note on later visits.
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { DOM_IDS, DOM_SELECTORS, DOM_CLASSES, LIMITS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

const di = createDIModule('UXRatings', {
    AppState: required(),
    appInit: required(),
    safeAddEventListener: required(),
    AppMeta: optional(null),
    // DOM access helpers (testable, avoids direct document.* calls)
    getElementById: optional((id) => document.getElementById(id)),
    querySelectorAll: optional((sel) => document.querySelectorAll(sel)),
});

export const setUXRatingsDependencies = di.setDependencies;

// ============================================================================
// RATING DATA
// ============================================================================

// Emojis stay separate from label text (label-system rule)
const RATING_TAGS = [
    { key: 'easyToUse',  labelKey: 'feedback.tagEasyToUse',  emoji: '🎯' },
    { key: 'helpful',    labelKey: 'feedback.tagHelpful',    emoji: '💡' },
    { key: 'beautiful',  labelKey: 'feedback.tagBeautiful',  emoji: '🎨' },
    { key: 'fast',       labelKey: 'feedback.tagFast',       emoji: '⚡' },
    { key: 'organized',  labelKey: 'feedback.tagOrganized',  emoji: '📋' },
    { key: 'motivating', labelKey: 'feedback.tagMotivating', emoji: '🚀' }
];

// ============================================================================
// UX RATINGS CLASS
// ============================================================================

export class UXRatings {
    constructor() {
        this._rating = 0;
        this._selectedTags = new Set();
        this._starHandlers = new WeakMap();
        this._tagHandlers = new WeakMap();
        this._formSubmitHandler = null;
        this._openObserver = null;
        this._starRowKeyHandler = null;
        this.initialized = false;
    }

    get deps() {
        return di.resolve();
    }

    async init() {
        if (this.initialized) return;
        await this.deps.appInit.waitForCore();

        const section = this.deps.getElementById(DOM_IDS.FEEDBACK_RATING_SECTION);
        if (!section) return; // Feedback modal markup not present

        this._applyLabels();
        this._buildTags();
        this._wireStars();
        this._wireFormHooks();
        this._refreshPreviousRating();

        this.initialized = true;
    }

    // ------------------------------------------------------------------------
    // SETUP
    // ------------------------------------------------------------------------

    _applyLabels() {
        const ratingLabel = this.deps.getElementById(DOM_IDS.FEEDBACK_RATING_LABEL);
        const tagsLabel = this.deps.getElementById(DOM_IDS.FEEDBACK_TAGS_LABEL);
        if (ratingLabel) ratingLabel.textContent = getLabel('feedback.ratingLabel');
        if (tagsLabel) tagsLabel.textContent = getLabel('feedback.tagsLabel');

        this._stars().forEach(star => {
            const n = parseInt(star.dataset.rating, 10);
            star.setAttribute('aria-label', getLabel('feedback.ratingStarAria', { vars: { n } }));
        });
    }

    _buildTags() {
        const row = this.deps.getElementById(DOM_IDS.FEEDBACK_TAGS_ROW);
        if (!row || row.childElementCount > 0) return;

        RATING_TAGS.forEach(tag => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = DOM_SELECTORS.FEEDBACK_TAG.slice(1);
            btn.dataset.tag = tag.key;
            btn.setAttribute('aria-pressed', 'false');

            const emoji = document.createElement('span');
            emoji.className = 'feedback-tag-emoji';
            emoji.setAttribute('aria-hidden', 'true');
            emoji.textContent = tag.emoji;

            const label = document.createElement('span');
            label.textContent = getLabel(tag.labelKey);

            btn.append(emoji, label);
            row.appendChild(btn);

            const handler = () => this._toggleTag(btn, tag.key);
            this._tagHandlers.set(btn, handler);
            this.deps.safeAddEventListener(btn, 'click', handler);
        });
    }

    _wireStars() {
        const stars = this._stars();
        stars.forEach(star => {
            const handlers = {
                click: () => this._selectRating(parseInt(star.dataset.rating, 10)),
                mouseenter: () => this._previewStars(parseInt(star.dataset.rating, 10)),
                mouseleave: () => this._previewStars(0)
            };
            this._starHandlers.set(star, handlers);
            this.deps.safeAddEventListener(star, 'click', handlers.click);
            this.deps.safeAddEventListener(star, 'mouseenter', handlers.mouseenter);
            this.deps.safeAddEventListener(star, 'mouseleave', handlers.mouseleave);
        });

        // Radiogroup arrow-key navigation
        const row = this.deps.getElementById(DOM_IDS.FEEDBACK_STAR_ROW);
        if (row) {
            this._starRowKeyHandler = (e) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                e.preventDefault();
                let next = this._rating || 1;
                if (e.key === 'ArrowRight') next = Math.min(5, (this._rating || 0) + 1);
                if (e.key === 'ArrowLeft') next = Math.max(1, (this._rating || 2) - 1);
                if (e.key === 'Home') next = 1;
                if (e.key === 'End') next = 5;
                this._selectRating(next);
                this._stars()[next - 1]?.focus();
            };
            this.deps.safeAddEventListener(row, 'keydown', this._starRowKeyHandler);
        }
    }

    _wireFormHooks() {
        const form = this.deps.getElementById(DOM_IDS.FEEDBACK_FORM);
        const dialog = this.deps.getElementById(DOM_IDS.FEEDBACK_MODAL);

        // Persist locally on submit. modalManager's handler runs first and only
        // blocks submission when BOTH the rating is empty and the text is short,
        // so whenever a rating is set the submit always proceeds.
        if (form) {
            this._formSubmitHandler = () => {
                if (this._rating > 0) this._saveRating();
            };
            this.deps.safeAddEventListener(form, 'submit', this._formSubmitHandler);
        }

        // Reset the UI when the dialog closes and refresh the previous-rating
        // note when it opens. Observing the [open] attribute (rather than the
        // 'close' event) covers every close path — .close(), ESC, form
        // submission — with a single hook.
        if (dialog) {
            this._openObserver = new MutationObserver(() => {
                if (dialog.open) {
                    this._refreshPreviousRating();
                } else {
                    this._resetUI();
                }
            });
            this._openObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
        }
    }

    // ------------------------------------------------------------------------
    // INTERACTIONS
    // ------------------------------------------------------------------------

    _stars() {
        return Array.from(this.deps.querySelectorAll(DOM_SELECTORS.FEEDBACK_STAR));
    }

    _selectRating(rating) {
        this._rating = rating;
        this._paintStars(rating);

        const prompt = this.deps.getElementById(DOM_IDS.FEEDBACK_RATING_PROMPT);
        if (prompt) prompt.textContent = getLabel(`feedback.ratingPrompt${rating}`);

        const tagsLabel = this.deps.getElementById(DOM_IDS.FEEDBACK_TAGS_LABEL);
        const tagsRow = this.deps.getElementById(DOM_IDS.FEEDBACK_TAGS_ROW);
        tagsLabel?.classList.remove(DOM_CLASSES.HIDDEN);
        tagsRow?.classList.remove(DOM_CLASSES.HIDDEN);

        const value = this.deps.getElementById(DOM_IDS.FEEDBACK_RATING_VALUE);
        if (value) value.value = `${rating}/5`;
    }

    _paintStars(rating, { preview = false } = {}) {
        this._stars().forEach(star => {
            const n = parseInt(star.dataset.rating, 10);
            const icon = star.querySelector('i');
            const active = n <= rating;
            star.classList.toggle(preview ? 'is-hovered' : 'is-selected', active);
            if (!preview) {
                star.classList.remove('is-hovered');
                star.setAttribute('aria-checked', n === rating ? 'true' : 'false');
                icon?.classList.toggle('fas', active);
                icon?.classList.toggle('far', !active);
            }
        });
    }

    _previewStars(rating) {
        if (this._rating > 0) return; // No hover preview once chosen
        this._stars().forEach(star => {
            const n = parseInt(star.dataset.rating, 10);
            star.classList.toggle('is-hovered', rating > 0 && n <= rating);
        });
    }

    _toggleTag(btn, key) {
        if (this._selectedTags.has(key)) {
            this._selectedTags.delete(key);
        } else {
            this._selectedTags.add(key);
        }
        const active = this._selectedTags.has(key);
        btn.classList.toggle('is-selected', active);
        btn.setAttribute('aria-pressed', String(active));

        // Human-readable labels in the Web3Forms email, not internal keys
        const value = this.deps.getElementById(DOM_IDS.FEEDBACK_RATING_TAGS_VALUE);
        if (value) {
            value.value = RATING_TAGS
                .filter(t => this._selectedTags.has(t.key))
                .map(t => getLabel(t.labelKey))
                .join(', ');
        }
    }

    // ------------------------------------------------------------------------
    // PERSISTENCE
    // ------------------------------------------------------------------------

    _saveRating() {
        const entry = {
            stars: this._rating,
            tags: Array.from(this._selectedTags),
            timestamp: new Date().toISOString(),
            appVersion: this.deps.AppMeta?.version || 'dev-local'
        };

        this.deps.AppState.update(state => {
            if (!state.userProgress) state.userProgress = {};
            state.userProgress.uxRating = entry;
            const history = state.userProgress.uxRatingHistory || [];
            history.unshift(entry);
            state.userProgress.uxRatingHistory = history.slice(0, LIMITS.RATING_HISTORY);
        }, true);

        this._refreshPreviousRating();
    }

    _refreshPreviousRating() {
        const note = this.deps.getElementById(DOM_IDS.FEEDBACK_PREVIOUS_RATING);
        if (!note) return;

        const previous = this.deps.AppState.get()?.userProgress?.uxRating;
        if (previous?.stars) {
            note.textContent = getLabel('feedback.previousRating', {
                vars: {
                    stars: previous.stars,
                    date: new Date(previous.timestamp).toLocaleDateString()
                }
            });
            note.classList.remove(DOM_CLASSES.HIDDEN);
        } else {
            note.classList.add(DOM_CLASSES.HIDDEN);
        }
    }

    // ------------------------------------------------------------------------
    // RESET / TEARDOWN
    // ------------------------------------------------------------------------

    _resetUI() {
        this._rating = 0;
        this._selectedTags.clear();
        this._paintStars(0);

        const prompt = this.deps.getElementById(DOM_IDS.FEEDBACK_RATING_PROMPT);
        if (prompt) prompt.textContent = '';

        const tagsLabel = this.deps.getElementById(DOM_IDS.FEEDBACK_TAGS_LABEL);
        const tagsRow = this.deps.getElementById(DOM_IDS.FEEDBACK_TAGS_ROW);
        tagsLabel?.classList.add(DOM_CLASSES.HIDDEN);
        tagsRow?.classList.add(DOM_CLASSES.HIDDEN);
        tagsRow?.querySelectorAll(DOM_SELECTORS.FEEDBACK_TAG).forEach(btn => {
            btn.classList.remove('is-selected');
            btn.setAttribute('aria-pressed', 'false');
        });

        const ratingValue = this.deps.getElementById(DOM_IDS.FEEDBACK_RATING_VALUE);
        const tagsValue = this.deps.getElementById(DOM_IDS.FEEDBACK_RATING_TAGS_VALUE);
        if (ratingValue) ratingValue.value = '';
        if (tagsValue) tagsValue.value = '';
    }

    destroy() {
        this._stars().forEach(star => {
            const handlers = this._starHandlers.get(star);
            if (handlers) {
                star.removeEventListener('click', handlers.click);
                star.removeEventListener('mouseenter', handlers.mouseenter);
                star.removeEventListener('mouseleave', handlers.mouseleave);
            }
        });

        const row = this.deps.getElementById(DOM_IDS.FEEDBACK_STAR_ROW);
        if (row && this._starRowKeyHandler) {
            row.removeEventListener('keydown', this._starRowKeyHandler);
        }

        const tagsRow = this.deps.getElementById(DOM_IDS.FEEDBACK_TAGS_ROW);
        tagsRow?.querySelectorAll(DOM_SELECTORS.FEEDBACK_TAG).forEach(btn => {
            const handler = this._tagHandlers.get(btn);
            if (handler) btn.removeEventListener('click', handler);
        });

        const form = this.deps.getElementById(DOM_IDS.FEEDBACK_FORM);
        if (form && this._formSubmitHandler) {
            form.removeEventListener('submit', this._formSubmitHandler);
        }

        this._openObserver?.disconnect();
        this._openObserver = null;
        this._formSubmitHandler = null;
        this._starRowKeyHandler = null;
        this.initialized = false;
    }
}

// ============================================================================
// SINGLETON + INIT
// ============================================================================

let instance = null;

export async function initUXRatings() {
    if (!instance) {
        instance = new UXRatings();
    }
    await instance.init();
    return instance;
}

export function getUXRatings() {
    return instance;
}
