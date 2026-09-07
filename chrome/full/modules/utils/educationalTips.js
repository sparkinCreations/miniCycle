/**
 * MiniCycle Educational Tips Module (Schema 2.5)
 *
 * Teaching moments surfaced inside notifications: which tips a user has seen,
 * which they have dismissed, and the DOM for showing and hiding one.
 *
 * Extracted from `utils/notifications.js` (Aug 2026, splits-plan Priority 6).
 * The two lived in one file because a tip is DELIVERED as a notification, but
 * delivery and pedagogy are different jobs — this class tracks what the user
 * has already learned, which has nothing to do with toast rendering.
 *
 * DI: no manifest entry and no `createDIModule` of its own. The constructor
 * takes a GETTER so deps stay live — `MiniCycleNotifications` passes
 * `() => this.deps`, and late-injected deps propagate without re-wiring.
 * `notifications.js` re-exports this class, so the test harness and any
 * existing importer keep working through the facade.
 *
 * @module utils/educationalTips
 * @see {@link file://docs/future-work/LARGE_MODULE_SPLITS_PLAN.md} - why this split
 */

import { DOM_SELECTORS, DOM_CLASSES, DATA_SELECTORS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

/**
 * Attach a listener through the injected duplicate-guard when one is available.
 *
 * notifications.js has a module-scoped twin of this that closes over its own
 * `_deps` proxy. This copy takes deps explicitly instead, because the class
 * already carries a live deps getter — importing the twin would make
 * notifications.js and this module import each other, and a circular ESM edge
 * in a BOOT_CRITICAL module is not worth saving four lines.
 *
 * @param {Object} deps - Live deps (from the class's `this.deps` getter)
 * @param {EventTarget} element
 * @param {string} event
 * @param {Function} handler
 * @param {Object|boolean} [options]
 */
function _safeAddEventListener(deps, element, event, handler, options) {
  const safeAdd = deps?.safeAddEventListener;
  if (typeof safeAdd === 'function') {
    safeAdd(element, event, handler, options);
  } else if (element && typeof element.addEventListener === 'function') {
    element.addEventListener(event, handler, options);
  }
}

/**
 * 🎓 Educational Tips Manager Class
 *
 * @param {Function|Object} getDeps - Getter returning live deps, or a deps
 *   object (wrapped in a getter for backwards compatibility).
 */
export class EducationalTipManager {
  constructor(getDeps) {
    // Store getter function for live deps access
    this._getDeps = typeof getDeps === 'function' ? getDeps : () => getDeps;
    this.dismissedTips = null; // Will be loaded lazily
    // Distinguishes "loaded, and the user has dismissed nothing" from "could not
    // load yet". Without it, an early read cached {} forever and every already-
    // dismissed tip reappeared.
    this._loadedFromSource = false;
  }

  // Getter that always returns current deps
  get deps() {
    return this._getDeps();
  }

  loadDismissedTips() {

    try {
      // Returns null -- NOT {} -- when the source is unavailable. The caller
      // caches the result forever, so an empty object here is indistinguishable
      // from "the user has dismissed nothing" and permanently poisons the cache.
      if (typeof this.deps.loadMiniCycleData !== 'function') {
        console.warn('⚠️ loadMiniCycleData not yet available, will retry on next read');
        return null;
      }

      const schemaData = this.deps.loadMiniCycleData();
      if (!schemaData || !schemaData.settings) {
        console.error('❌ Schema 2.5 data required for loadDismissedTips');
        return null;
      }

      // ✅ DI-pure: Use schemaData directly, no localStorage access
      return schemaData.settings.dismissedEducationalTips || {};
    } catch (e) {
      console.warn('⚠️ Error loading dismissed tips from Schema 2.5:', e);
      return null;
    }
  }

  /**
   * Dismissed-tip map, loaded once the source is actually available.
   *
   * A failed load returns a THROWAWAY empty object rather than caching one: a
   * tip-bearing notification can fire before loadMiniCycleData is wired, and
   * caching {} there made every already-dismissed tip reappear and — via the
   * old wholesale save — erased them from storage on the next dismissal.
   *
   * @returns {Object<string, boolean>}
   */
  getDismissedTips() {
    if (!this._loadedFromSource) {
      const loaded = this.loadDismissedTips();
      if (loaded === null) {
        // Source still unavailable. Hold a local scratch map so a dismissal made
        // right now is not lost, and try again on the next read.
        if (this.dismissedTips === null) this.dismissedTips = {};
      } else {
        // Source arrived. Stored dismissals are the base; anything recorded
        // locally while we were waiting wins over it.
        this.dismissedTips = { ...loaded, ...(this.dismissedTips || {}) };
        this._loadedFromSource = true;
      }
    }
    return this.dismissedTips;
  }

  /**
   * Persist dismissal changes by MERGING a delta into whatever is already
   * stored, rather than replacing the stored map with this instance's copy.
   *
   * The replace-wholesale version could erase real data: if the cache had been
   * populated before the data source was ready, dismissing one tip wrote
   * `{ thatTip: true }` over every dismissal the user had accumulated.
   *
   * @param {Object<string, boolean>} [delta] - tipId → true (dismissed) or
   *   false (un-dismissed). Omitted means "merge in what we already hold",
   *   which is additive and can never delete.
   */
  async saveDismissedTips(delta) {

    try {
      // ✅ DEFENSIVE CHECK: Ensure deps and AppState exist before accessing
      // Node.js 20.x timing differences can cause AppState to be undefined
      const deps = this.deps;
      if (!deps || !deps.AppState) {
        console.warn('⚠️ AppState not available for saveDismissedTips (deps not ready)');
        return;
      }

      // ✅ Use AppState only (DI-pure, no localStorage fallback)
      if (typeof deps.AppState.isReady !== 'function' || !deps.AppState.isReady()) {
        console.warn('⚠️ AppState not ready for saveDismissedTips');
        return;
      }

      // Build the change against the PERSISTED map inside the producer, so a
      // stale or transient local cache can never clobber stored dismissals.
      const changes = delta || this.getDismissedTips();
      await deps.AppState.update(state => {
        if (!state.settings) state.settings = {};
        const merged = { ...(state.settings.dismissedEducationalTips || {}) };
        for (const tipId of Object.keys(changes)) {
          if (changes[tipId]) {
            merged[tipId] = true;
          } else {
            delete merged[tipId];
          }
        }
        state.settings.dismissedEducationalTips = merged;
      }, true);

    } catch (e) {
      console.error('❌ Error saving dismissed tips to Schema 2.5:', e);
    }
  }

  isTipDismissed(tipId) {
    return this.getDismissedTips()[tipId] === true;
  }

  dismissTip(tipId) {
    this.getDismissedTips()[tipId] = true;
    // Pass the specific change: the local map may be a throwaway if the data
    // source was not ready, and only this delta is known to be intentional.
    this.saveDismissedTips({ [tipId]: true });
  }

  showTip(tipId) {
    delete this.getDismissedTips()[tipId];
    this.saveDismissedTips({ [tipId]: false });
  }

  createTip(tipId, tipText, options = {}) {
    const {
      icon = '💡',
      borderColor = 'var(--tip-border-color, rgba(255, 255, 255, 0.3))',
      backgroundColor = 'var(--tip-bg-color, rgba(255, 255, 255, 0.1))',
      className = 'educational-tip'
    } = options;

    const isDismissed = this.isTipDismissed(tipId);
    
    return `
      <div class="${className}" id="tip-${tipId}" data-tip-id="${tipId}" 
           style="display: ${isDismissed ? 'none' : 'block'};">
        <div class="tip-content">
          <span class="tip-icon">${icon}</span>
          <span class="tip-text">${tipText}</span>
          <button class="tip-close" aria-label="${getLabel('notify.dismissTip')}">✕</button>
        </div>
      </div>
      <button class="tip-toggle ${isDismissed ? 'show' : 'hide'}"
              data-tip-id="${tipId}"
              aria-label="${getLabel('notify.showTip')}">
        💡
      </button>
    `;
  }

  initTipListeners(container) {
    // Create bound handlers for this container (stored on container to enable removal)
    if (!container._tipCloseHandler) {
      container._tipCloseHandler = (e) => {
        if (e.target.classList.contains(DOM_CLASSES.TIP_CLOSE)) {
          e.stopPropagation();
          const tipElement = e.target.closest(DOM_SELECTORS.EDUCATIONAL_TIP);
          const tipId = tipElement.dataset.tipId;
          this.hideTip(tipId, container);
        }
      };
    }

    if (!container._tipToggleHandler) {
      container._tipToggleHandler = (e) => {
        if (e.target.classList.contains(DOM_CLASSES.TIP_TOGGLE) || e.target.classList.contains(DOM_CLASSES.TIP_TOGGLE_BTN)) {
          e.stopPropagation();
          const tipId = e.target.dataset.tipId;
          const tipElement = container.querySelector(DATA_SELECTORS.tipById(tipId));

          if (tipElement.style.display === 'none') {
            this.showTipElement(tipId, container);
          } else {
            this.hideTip(tipId, container);
          }
        }
      };
    }

    // Handle tip close buttons
    _safeAddEventListener(this.deps, container, 'click', container._tipCloseHandler);

    // Handle tip toggle buttons
    _safeAddEventListener(this.deps, container, 'click', container._tipToggleHandler);
  }

  hideTip(tipId, container) {
    const tipElement = container.querySelector(DATA_SELECTORS.tipById(tipId));
    const toggleButton = container.querySelector(`${DOM_SELECTORS.TIP_TOGGLE}[data-tip-id="${tipId}"]`);
    
    if (tipElement) {
      tipElement.style.opacity = '0';
      tipElement.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
        tipElement.style.display = 'none';
        if (toggleButton) {
          toggleButton.classList.remove(DOM_CLASSES.HIDE);
          toggleButton.classList.add(DOM_CLASSES.SHOW);
        }
      }, 200);
    }
    
    this.dismissTip(tipId);
  }

  showTipElement(tipId, container) {
    const tipElement = container.querySelector(DATA_SELECTORS.tipById(tipId));
    const toggleButton = container.querySelector(`${DOM_SELECTORS.TIP_TOGGLE}[data-tip-id="${tipId}"]`);
    
    if (tipElement) {
      tipElement.style.display = 'block';
      tipElement.style.opacity = '0';
      tipElement.style.transform = 'translateY(-10px)';
      
      // Force reflow
      tipElement.offsetHeight;
      
      tipElement.style.opacity = '1';
      tipElement.style.transform = 'translateY(0)';
      
      if (toggleButton) {
        toggleButton.classList.remove(DOM_CLASSES.SHOW);
        toggleButton.classList.add(DOM_CLASSES.HIDE);
      }
    }
    
    this.showTip(tipId);
  }
}
