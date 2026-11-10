/**
 * 📱 miniCycle Device Detection Module (DI-Pure)
 *
 * Offers the Lite version on a device where the full app is measurably slow,
 * and answers touch-input questions for the UI.
 *
 * The Lite offer (Nov 2026; replaced an automatic redirect):
 * - Judged by how long the full app takes to boot HERE (performance.now() at
 *   the end of UI boot), not by user-agent sniffing or connection type. A
 *   browser too old to run the app never gets this far: the feature gate in
 *   miniCycle.html sends it to Lite before boot. And connection speed says
 *   nothing about a cached PWA, which boots from the service worker.
 * - A boot right after an update (it downloads the new build) and a boot in a
 *   hidden tab (throttled timers) are not counted.
 * - After LIMITS.SLOW_BOOTS_BEFORE_LITE_OFFER slow boots in a row (one on a
 *   device with 2 or fewer cores), the user is ASKED, once: Lite keeps its own
 *   separate list, so moving there silently showed an empty app. The answer is
 *   kept in settings.deviceCompatibility and never asked again; choosing
 *   "Try Full Version" in Lite (STORAGE_KEYS.FORCE_FULL_VERSION) counts as no.
 * - Never on the native or desktop shells, which always run the full app.
 *
 * Note: window.screen, window.location, navigator.* are browser APIs,
 * not dependencies - they cannot be injected.
 *
 * @module deviceDetection
 */

import { STORAGE_KEYS, UI_TIMEOUTS, SCHEMA, BOOT_TIMEOUTS, LIMITS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { isNativeApp } from '../platform/capacitorBridge.js';
import { isDesktopApp } from '../platform/desktopBridge.js';
import { goToLiteVersion } from './liteVersion.js';
import { createDIModule, required, optional } from '../core/diBase.js';

// ✅ appInit now injected via DI (no static import - enables versioning)

const di = createDIModule('DeviceDetection', {
    showNotification: optional((msg) => console.warn('showNotification not available:', msg)),
    showConfirmationModal: required(),
    AppState: required(),
    appInit: required(),
    AppMeta: optional(null)
});

/**
 * Set dependencies for DeviceDetectionManager (e.g., AppState, appInit)
 * @param {Object} dependencies - Dependencies to inject
 * @returns {void}
 */
export const setDeviceDetectionDependencies = di.setDependencies;

/**
 * Detects device type, platform, and capabilities for adaptive UI behavior
 */
export class DeviceDetectionManager {
  constructor(dependencies = {}) {
    // Store constructor-provided version (can be overridden by DI-injected AppMeta)
    this._constructorVersion = dependencies.AppMeta?.version;
  }

  /**
   * Getter for dependencies - resolves from DI container
   */
  get deps() {
    return di.resolve();
  }

  /**
   * Get current version from deps or constructor
   */
  get currentVersion() {
    return di.resolve().AppMeta?.version || this._constructorVersion;
  }

  /**
   * The stored device record (settings.deviceCompatibility), or {}.
   * @returns {Object}
   */
  getRecord() {
    return this.deps.AppState.get()?.settings?.deviceCompatibility || {};
  }

  /**
   * Replace the stored device record. Immediate save: a boot that ends right
   * after this must not count the same slow boot twice.
   * @param {Object} record
   * @returns {Promise<void>}
   */
  async saveRecord(record) {
    try {
      await this.deps.AppState.update(state => {
        if (!state.settings) state.settings = {};
        state.settings.deviceCompatibility = record;
      }, true);
    } catch (error) {
      console.error('❌ Error saving device record:', error);
    }
  }

  /** @returns {boolean} 2 or fewer logical cores, when the browser says */
  hasFewCores() {
    return Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  }

  /** @returns {number|null} ms from navigation start to now, or null without the API */
  measureBootMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? Math.round(performance.now())
      : null;
  }

  /**
   * Whether the user has already answered, or chose the full version from Lite.
   * @param {Object} record
   * @returns {boolean}
   */
  hasDecided(record) {
    if (record.liteOffer === 'accepted' || record.liteOffer === 'declined') return true;
    try {
      return localStorage.getItem(STORAGE_KEYS.FORCE_FULL_VERSION) === 'true';
    } catch {
      return false; // storage blocked: treat as undecided
    }
  }

  /**
   * Count this boot towards the Lite offer, and offer it when the streak is
   * reached. Called once per boot, at the end of UI boot (uiBoot.finalizeUI).
   * Writes only when something changed: on a fast boot of a known version,
   * nothing.
   * @param {Object} [measure] - Test seam: { bootMs, hidden, fewCores }
   * @returns {Promise<{counted: boolean, slow: boolean, streak: number, offered: boolean}|null>}
   *   What this boot did, or null when nothing was assessed
   */
  async assessBootPerformance(measure = {}) {
    if (isNativeApp() || isDesktopApp()) return null;
    await this.deps.appInit.waitForCore();
    // First run: no state yet, and the boot was the first-run screen's anyway.
    if (!this.deps.AppState.isReady()) return null;

    const record = this.getRecord();
    if (this.hasDecided(record)) return null;

    const version = this.currentVersion;
    const bootMs = 'bootMs' in measure ? measure.bootMs : this.measureBootMs();
    const hidden = 'hidden' in measure ? measure.hidden : document.hidden;
    const fewCores = 'fewCores' in measure ? measure.fewCores : this.hasFewCores();

    const firstBootOfVersion = record.lastBootVersion !== version;
    const counted = !firstBootOfVersion && !hidden && typeof bootMs === 'number';
    const slow = counted && bootMs >= BOOT_TIMEOUTS.SLOW_BOOT_LITE_OFFER;
    const previous = Number.isInteger(record.slowBootStreak) ? record.slowBootStreak : 0;
    let streak = previous;
    if (counted) streak = slow ? previous + 1 : 0;

    const needed = fewCores ? 1 : LIMITS.SLOW_BOOTS_BEFORE_LITE_OFFER;
    const offered = slow && streak >= needed;

    if (firstBootOfVersion || streak !== previous) {
      // A fresh record: the redirect-era fields (shouldUseLite, userAgent,
      // connectionType, …) are not carried over — nothing reads them now.
      const next = { lastBootVersion: version, slowBootStreak: streak };
      const lastSlowBootMs = slow ? bootMs : record.lastSlowBootMs;
      if (lastSlowBootMs) next.lastSlowBootMs = lastSlowBootMs;
      await this.saveRecord(next);
    }
    if (offered) this.offerLite(bootMs);
    return { counted, slow, streak, offered };
  }

  /**
   * Ask whether to switch to Lite, and keep the answer either way.
   * @param {number} bootMs - The slow boot that prompted the offer
   */
  offerLite(bootMs) {
    if (isNativeApp() || isDesktopApp()) return;
    const seconds = Math.max(1, Math.round(bootMs / 1000));
    this.deps.showConfirmationModal({
      title: getLabel('modal.liteOfferTitle'),
      message: getLabel('modal.liteOfferMessage', { vars: { seconds } }),
      confirmText: getLabel('modal.liteVersionConfirm'),
      cancelText: getLabel('modal.liteOfferKeepFull'),
      callback: async (confirmed) => {
        await this.saveRecord({
          ...this.getRecord(),
          liteOffer: confirmed ? 'accepted' : 'declined',
          decidedAt: new Date().toISOString()
        });
        if (confirmed) {
          goToLiteVersion({
            params: { redirect: 'offer', v: this.currentVersion, t: Date.now() },
            reason: 'slow boots, user accepted the Lite offer'
          });
        }
      }
    });
  }

  // Generate compatibility report
  async reportDeviceCompatibility() {

    // ✅ Wait for core systems to be ready (AppState + data) - DI-pure
    const appInitModule = this.deps.appInit;
    await appInitModule.waitForCore();

    if (!this.deps.AppState.isReady()) {
      console.error('❌ State data required for compatibility report');
      this.deps.showNotification(getLabel('notify.reportRequiresSchema'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
      return null;
    }
    
    const record = this.getRecord();
    // true = chose Lite, false = chose the full version (here or from Lite), null = not asked
    let storedDecision = null;
    if (record.liteOffer === 'accepted') storedDecision = true;
    else if (this.hasDecided(record)) storedDecision = false;

    const deviceInfo = {
      userAgent: navigator.userAgent,
      version: this.currentVersion,
      lastDetectionVersion: record.lastBootVersion || null,
      slowBootStreak: Number.isInteger(record.slowBootStreak) ? record.slowBootStreak : 0,
      storedDecision: storedDecision,
      currentUrl: window.location.href,
      timestamp: new Date().toISOString(),
      schema: SCHEMA.CURRENT,
      detectionData: record
    };
    
    this.displayCompatibilityReport(deviceInfo, storedDecision);
    
    return deviceInfo;
  }

  displayCompatibilityReport(deviceInfo, storedDecision) {
    let statusMessage = '';
    let statusType = 'info';

    if (storedDecision === true) {
      statusMessage = '📱 ' + getLabel('notify.deviceConfiguredLite');
      statusType = 'info';
    } else if (storedDecision === false) {
      statusMessage = '💻 ' + getLabel('notify.deviceConfiguredFull');
      statusType = 'success';
    } else {
      statusMessage = '❓ ' + getLabel('notify.noDevicePreference');
      statusType = 'warning';
    }

    this.deps.showNotification(
      `${statusMessage}\n` +
      `${getLabel('notify.deviceStatusVersion', { vars: { version: deviceInfo.version } })}\n` +
      `${getLabel('notify.deviceStatusSchema', { vars: { schema: deviceInfo.schema } })}\n` +
      `${getLabel('notify.deviceStatusLastCheck', { vars: { lastCheck: deviceInfo.lastDetectionVersion || getLabel('notify.deviceNeverChecked') } })}\n` +
      getLabel('notify.deviceStatusSlowBoots', { vars: { count: deviceInfo.slowBootStreak } }),
      statusType,
      UI_TIMEOUTS.NOTIFICATION_PERSISTENT
    );
  }

  // Manual test (testing modal / module test page): forget any answer and show
  // the offer now, as if the streak had just been reached.
  async testDeviceDetection() {
    this.deps.showNotification(getLabel('notify.startingDetectionTest'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT, { icon: 'flask' });
    await this.deps.appInit.waitForCore();
    if (!this.deps.AppState.isReady()) {
      console.error('❌ State data required for device detection test');
      this.deps.showNotification(getLabel('notify.detectionTestFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
      return;
    }
    await this.clearDetectionData();
    this.offerLite(this.measureBootMs() ?? BOOT_TIMEOUTS.SLOW_BOOT_LITE_OFFER);
  }

  async clearDetectionData() {
    // ✅ Use AppState only (no localStorage fallback) - DI-pure
    const AppState = this.deps.AppState;
    if (AppState.isReady()) {
      try {
        await AppState.update(state => {
          if (state?.settings?.deviceCompatibility) {
            delete state.settings.deviceCompatibility;
          }
        }, true);
      } catch (error) {
        console.error('❌ Error clearing stored compatibility:', error);
      }
    }

    // Also forget "Try Full Version" from Lite, so the offer can be asked again
    try {
      localStorage.removeItem(STORAGE_KEYS.FORCE_FULL_VERSION);
    } catch {
      // storage blocked: nothing stored to forget
    }
  }
}

// Global compatibility wrapper functions
let deviceDetectionManager = null;

// Initialize global instance
function initializeDeviceDetectionManager() {
  if (!deviceDetectionManager) {
    deviceDetectionManager = new DeviceDetectionManager();
  }
  return deviceDetectionManager;
}

function assessBootPerformance() {
  return initializeDeviceDetectionManager().assessBootPerformance();
}

function reportDeviceCompatibility() {
  return initializeDeviceDetectionManager().reportDeviceCompatibility();
}

function testDeviceDetection() {
  return initializeDeviceDetectionManager().testDeviceDetection();
}

/**
 * Detect if the current device is a touch device
 * Used by taskDOM and drag/drop systems for input method detection
 * @returns {boolean} True if device supports touch input as primary method
 */
function isTouchDevice() {
  const hasTouchEvents = "ontouchstart" in window;
  const touchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints;
  const isFinePointer = window.matchMedia("(pointer: fine)").matches;

  // Fine pointer (mouse/trackpad) means NOT primarily touch
  if (isFinePointer) return false;

  return hasTouchEvents || touchPoints > 0;
}

/**
 * Detect whether the device can accept touch input AT ALL — a strictly weaker
 * question than isTouchDevice().
 *
 * isTouchDevice() asks "is touch the PRIMARY input?" and answers false the moment
 * a fine pointer exists, which is correct for its callers (drag layout, tap-vs-click
 * wording). But it makes a touchscreen laptop indistinguishable from a mouse-only
 * desktop, and those machines get used in tablet mode where the trackpad is not
 * reachable. `any-pointer: coarse` is the right signal: it is true when a coarse
 * pointer is available, regardless of which one is primary.
 *
 * Do NOT swap isTouchDevice() for this — its consumers depend on the stricter
 * meaning, and widening it would (for one) disable the drag layout on laptops
 * that handle it fine.
 *
 * @returns {boolean} True if a coarse (touch) pointer is available
 */
function isTouchCapable() {
  const coarseAvailable = window.matchMedia?.("(any-pointer: coarse)")?.matches ?? false;
  const hasTouchEvents = "ontouchstart" in window;
  const touchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints;

  return coarseAvailable || hasTouchEvents || touchPoints > 0;
}

// DI-pure module (no window.* fallbacks for dependencies)

// ES6 exports (DeviceDetectionManager class already exported at line 19)
export {
  deviceDetectionManager,
  initializeDeviceDetectionManager,
  assessBootPerformance,
  reportDeviceCompatibility,
  testDeviceDetection,
  isTouchDevice,
  isTouchCapable
};