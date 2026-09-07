/**
 * 📱 miniCycle Device Detection Module (DI-Pure)
 *
 * Handles device capability detection and app version routing
 *
 * Features:
 * - User agent analysis
 * - Hardware capability detection
 * - Network connection assessment
 * - Schema 2.5 compatibility data storage
 * - Automatic lite version routing
 *
 * Note: window.screen, window.location, navigator.* are browser APIs,
 * not dependencies - they cannot be injected.
 *
 * @module deviceDetection
 */

import { STORAGE_KEYS, UI_TIMEOUTS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { isNativeApp } from '../platform/capacitorBridge.js';
import { goToLiteVersion } from './liteVersion.js';
import { createDIModule, required, optional } from '../core/diBase.js';

// ✅ appInit now injected via DI (no static import - enables versioning)

const di = createDIModule('DeviceDetection', {
    loadMiniCycleData: optional(() => { console.warn('loadMiniCycleData not available'); return null; }),
    showNotification: optional((msg) => console.warn('showNotification not available:', msg)),
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

  // Main detection function
  async runDeviceDetection() {
    const userAgent = navigator.userAgent;

    // Check manual override first
    if (await this.checkManualOverride(userAgent)) {
      return;
    }

    // Perform detection and routing
    await this.performDetectionAndRouting(userAgent);
  }

  async checkManualOverride(userAgent) {
    const manualOverride = localStorage.getItem(STORAGE_KEYS.FORCE_FULL_VERSION);
    if (manualOverride === 'true') {

      // ✅ Wait for core systems to be ready (AppState + data) - DI-pure
      const appInitModule = this.deps.appInit;
      if (appInitModule?.waitForCore) {
        await appInitModule.waitForCore();
      }

      const schemaData = this.deps.loadMiniCycleData();
      if (!schemaData) {
        console.error('❌ Schema 2.5 data required for device detection');
        return false;
      }

      await this.saveCompatibilityData({
        shouldUseLite: false,
        reason: 'manual_override',
        userAgent: userAgent
      });

      this.deps.showNotification('✅ ' + getLabel('notify.deviceDetectionComplete'), 'success', UI_TIMEOUTS.NOTIFICATION_LONG);
      return true;
    }
    return false;
  }

  shouldRedirectToLite() {
    const userAgent = navigator.userAgent.toLowerCase();

    // Device capability checks
    const isOldDevice =
      /android [1-4]\./i.test(userAgent) ||
      /chrome\/[1-4][0-9]\./i.test(userAgent) ||
      /firefox\/[1-4][0-9]\./i.test(userAgent) ||
      /safari\/[1-7]\./i.test(userAgent) ||
      /msie|trident/i.test(userAgent);

    // ✅ Ensure boolean return values (Safari doesn't support these APIs)
    const hasLowMemory = Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    const hasSlowConnection = Boolean(navigator.connection &&
      (navigator.connection.effectiveType === 'slow-2g' ||
       navigator.connection.effectiveType === '2g' ||
       navigator.connection.effectiveType === '3g'));

    return isOldDevice || hasLowMemory || hasSlowConnection;
  }

  async performDetectionAndRouting(userAgent) {
    const shouldUseLite = this.shouldRedirectToLite();
    const reason = shouldUseLite ? 'device_compatibility' : 'device_capable';

    const compatibilityData = {
      shouldUseLite: shouldUseLite,
      reason: reason,
      userAgent: userAgent,
      deviceInfo: {
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        connectionType: navigator.connection?.effectiveType || 'unknown',
        screenWidth: window.screen.width,
        screenHeight: window.screen.height
      }
    };

    await this.saveCompatibilityData(compatibilityData);

    if (shouldUseLite) {
      this.redirectToLite();
    }
  }

  async saveCompatibilityData(compatibilityData) {
    // ✅ Wait for core systems to be ready (AppState + data) - DI-pure
    const appInitModule = this.deps.appInit;
    if (appInitModule?.waitForCore) {
      await appInitModule.waitForCore();
    }

    // ✅ Use AppState only (no localStorage fallback) - DI-pure
    const AppState = this.deps.AppState;
    if (!AppState?.isReady?.()) {
      console.error('❌ AppState not ready for saveCompatibilityData');
      return;
    }

    try {
      await AppState.update(state => {
        if (!state.settings) state.settings = {};

        state.settings.deviceCompatibility = {
          ...compatibilityData,
          lastDetectionVersion: this.currentVersion,
          detectionDate: new Date().toISOString()
        };
      }, true);

    } catch (error) {
      console.error('❌ Error saving compatibility data:', error);
    }
  }

  redirectToLite() {
    // Suppress the whole flow on native — no "redirecting" notification, no nav.
    // The WebView always runs the full app; goToLiteVersion() is the nav backstop.
    if (isNativeApp()) {
      console.warn('[miniCycle] lite auto-redirect suppressed (native build)');
      return;
    }

    this.deps.showNotification('📱 ' + getLabel('notify.redirectingToLite'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);
    setTimeout(() => {
      goToLiteVersion({
        params: { redirect: 'auto', v: this.currentVersion, t: Date.now() },
        reason: 'device auto-redirect'
      });
    }, 1000);
  }

  // Auto-redetection on version change
  async autoRedetectOnVersionChange() {

    // ✅ Wait for core systems to be ready (AppState + data) - DI-pure
    const appInitModule = this.deps.appInit;
    if (appInitModule?.waitForCore) {
      await appInitModule.waitForCore();
    }

    const schemaData = this.deps.loadMiniCycleData();
    if (!schemaData) {
      console.error('❌ Schema 2.5 data required for version detection');
      return;
    }
    
    let lastDetectionVersion = null;
    try {
      const fullSchemaData = JSON.parse(localStorage.getItem(STORAGE_KEYS.DATA));
      lastDetectionVersion = fullSchemaData.settings?.deviceCompatibility?.lastDetectionVersion;
    } catch (error) {
      console.warn('⚠️ Error reading detection version from Schema 2.5:', error);
    }
    
    // If version changed or first time, re-run detection
    if (lastDetectionVersion !== this.currentVersion) {

      // ✅ No need for setTimeout - appInit.waitForCore() already handles timing
      await this.runDeviceDetection();
    }
  }

  // Generate compatibility report
  async reportDeviceCompatibility() {

    // ✅ Wait for core systems to be ready (AppState + data) - DI-pure
    const appInitModule = this.deps.appInit;
    if (appInitModule?.waitForCore) {
      await appInitModule.waitForCore();
    }

    const schemaData = this.deps.loadMiniCycleData();
    if (!schemaData) {
      console.error('❌ Schema 2.5 data required for compatibility report');
      this.deps.showNotification('❌ ' + getLabel('notify.reportRequiresSchema'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
      return null;
    }
    
    let storedDecision = null;
    let lastDetectionVersion = null;
    let detectionData = null;
    
    try {
      const fullSchemaData = JSON.parse(localStorage.getItem(STORAGE_KEYS.DATA));
      const compatibility = fullSchemaData.settings?.deviceCompatibility;
      if (compatibility) {
        storedDecision = compatibility.shouldUseLite;
        lastDetectionVersion = compatibility.lastDetectionVersion;
        detectionData = compatibility;
      }
    } catch (error) {
      console.error('❌ Error reading device compatibility from Schema 2.5:', error);
    }
    
    const deviceInfo = {
      userAgent: navigator.userAgent,
      version: this.currentVersion,
      lastDetectionVersion: lastDetectionVersion,
      storedDecision: storedDecision,
      currentUrl: window.location.href,
      timestamp: new Date().toISOString(),
      schema: '2.5',
      detectionData: detectionData
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
      `${getLabel('notify.deviceStatusLastCheck', { vars: { lastCheck: deviceInfo.lastDetectionVersion || 'Never' } })}`,
      statusType,
      UI_TIMEOUTS.NOTIFICATION_PERSISTENT
    );
  }

  // Test function for manual testing
  async testDeviceDetection() {
    this.deps.showNotification('🧪 ' + getLabel('notify.startingDetectionTest'), 'info', UI_TIMEOUTS.NOTIFICATION_SHORT);

    // ✅ Wait for core systems to be ready (AppState + data) - DI-pure
    const appInitModule = this.deps.appInit;
    if (appInitModule?.waitForCore) {
      await appInitModule.waitForCore();
    }

    const schemaData = this.deps.loadMiniCycleData();
    if (!schemaData) {
      console.error('❌ Schema 2.5 data required for device detection test');
      this.deps.showNotification('❌ ' + getLabel('notify.detectionTestFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
      return;
    }

    // Clear detection data for fresh test
    this.clearDetectionData();

    // ✅ No need for setTimeout - appInit.waitForCore() already handles timing
    await this.runDeviceDetection();
  }

  async clearDetectionData() {
    // ✅ Use AppState only (no localStorage fallback) - DI-pure
    const AppState = this.deps.AppState;
    if (AppState?.isReady?.()) {
      try {
        await AppState.update(state => {
          if (state?.settings?.deviceCompatibility) {
            delete state.settings.deviceCompatibility;
          }
        }, true);
      } catch (error) {
        console.error('❌ Error clearing Schema 2.5 compatibility:', error);
      }
    }

    // Also clear legacy keys for cleanup
    localStorage.removeItem(STORAGE_KEYS.FORCE_FULL_VERSION);
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

function runDeviceDetection() {
  return initializeDeviceDetectionManager().runDeviceDetection();
}

function autoRedetectOnVersionChange() {
  return initializeDeviceDetectionManager().autoRedetectOnVersionChange();
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
  runDeviceDetection,
  autoRedetectOnVersionChange,
  reportDeviceCompatibility,
  testDeviceDetection,
  isTouchDevice,
  isTouchCapable
};