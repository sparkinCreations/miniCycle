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

import { STORAGE_KEYS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ✅ appInit now injected via DI (no static import - enables versioning)

// Module-level deps for late injection (DI-pure, no window.* fallbacks)
let _deps = {
    loadMiniCycleData: null,
    showNotification: null,
    AppState: null,
    appInit: null,
    AppMeta: null
};

/**
 * Set dependencies for DeviceDetectionManager
 * @param {Object} dependencies - { loadMiniCycleData, showNotification, AppState, appInit, AppMeta }
 */
export function setDeviceDetectionDependencies(dependencies) {
    _deps = { ..._deps, ...dependencies };
    console.log('📱 DeviceDetection dependencies set:', Object.keys(dependencies));
}

export class DeviceDetectionManager {
  constructor(dependencies = {}) {
    // Store constructor-provided version (can be overridden by _deps.AppMeta)
    this._constructorVersion = dependencies.AppMeta?.version;
    console.log('[DeviceDetection] Constructor: set version =', this._constructorVersion);
  }

  /**
   * Getter for dependencies - always reads from current module-level _deps
   */
  get deps() {
    return {
      loadMiniCycleData: _deps.loadMiniCycleData || (() => { console.warn('loadMiniCycleData not available'); return null; }),
      showNotification: _deps.showNotification || ((msg) => console.warn('showNotification not available:', msg)),
      AppState: _deps.AppState,
      appInit: _deps.appInit  // DI-pure (no fallback)
    };
  }

  /**
   * Get current version from deps or constructor
   */
  get currentVersion() {
    return _deps.AppMeta?.version || this._constructorVersion;
  }

  // Main detection function
  async runDeviceDetection() {
    const userAgent = navigator.userAgent;

    console.log('🔍 Running device detection (Schema 2.5 only)...', userAgent);

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
      console.log('🚀 Manual override detected - user chose full version');

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

      console.log('✅ Manual override saved to Schema 2.5');
      this.deps.showNotification('✅ ' + getLabel('notify.deviceDetectionComplete'), 'success', 3000);
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

    console.log('✅ Device detection saved to Schema 2.5:', compatibilityData);

    if (shouldUseLite) {
      this.redirectToLite();
    } else {
      console.log('💻 Device is capable - staying on full version');
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

      console.log('✅ Device compatibility data saved via AppState');
    } catch (error) {
      console.error('❌ Error saving compatibility data:', error);
    }
  }

  redirectToLite() {
    const cacheBuster = `?redirect=auto&v=${this.currentVersion}&t=${Date.now()}`;
    console.log('📱 Redirecting to lite version:', 'lite/miniCycle-lite.html' + cacheBuster);

    this.deps.showNotification('📱 ' + getLabel('notify.redirectingToLite'), 'info', 2000);
    setTimeout(() => {
      window.location.href = 'lite/miniCycle-lite.html' + cacheBuster;
    }, 1000);
  }

  // Auto-redetection on version change
  async autoRedetectOnVersionChange() {
    console.log('🔄 Checking version change (Schema 2.5 only)...');

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
      console.log('🔄 Version changed or first run - running device detection');
      console.log('   Previous version:', lastDetectionVersion || 'None');
      console.log('   Current version:', this.currentVersion);

      // ✅ No need for setTimeout - appInit.waitForCore() already handles timing
      await this.runDeviceDetection();
    } else {
      console.log('✅ Device detection up-to-date for version', this.currentVersion);
    }
  }

  // Generate compatibility report
  async reportDeviceCompatibility() {
    console.log('📊 Generating device compatibility report (Schema 2.5 only)...');

    // ✅ Wait for core systems to be ready (AppState + data) - DI-pure
    const appInitModule = this.deps.appInit;
    if (appInitModule?.waitForCore) {
      await appInitModule.waitForCore();
    }

    const schemaData = this.deps.loadMiniCycleData();
    if (!schemaData) {
      console.error('❌ Schema 2.5 data required for compatibility report');
      this.deps.showNotification('❌ ' + getLabel('notify.reportRequiresSchema'), 'error', 3000);
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
    
    console.log('📊 Device Compatibility Report (Schema 2.5):', deviceInfo);
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
      `Version: ${deviceInfo.version}\n` +
      `Schema: ${deviceInfo.schema}\n` +
      `Last Check: ${deviceInfo.lastDetectionVersion || 'Never'}`,
      statusType,
      8000
    );
  }

  // Test function for manual testing
  async testDeviceDetection() {
    this.deps.showNotification('🧪 ' + getLabel('notify.startingDetectionTest'), 'info', 2000);

    // ✅ Wait for core systems to be ready (AppState + data) - DI-pure
    const appInitModule = this.deps.appInit;
    if (appInitModule?.waitForCore) {
      await appInitModule.waitForCore();
    }

    const schemaData = this.deps.loadMiniCycleData();
    if (!schemaData) {
      console.error('❌ Schema 2.5 data required for device detection test');
      this.deps.showNotification('❌ ' + getLabel('notify.detectionTestFailed'), 'error', 3000);
      return;
    }

    // Clear detection data for fresh test
    this.clearDetectionData();

    // ✅ No need for setTimeout - appInit.waitForCore() already handles timing
    console.log('🔄 Running fresh device detection...');
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
            console.log('🧹 Cleared device compatibility from Schema 2.5');
          }
        }, true);
      } catch (error) {
        console.error('❌ Error clearing Schema 2.5 compatibility:', error);
      }
    }

    // Also clear legacy keys for cleanup
    localStorage.removeItem(STORAGE_KEYS.FORCE_FULL_VERSION);
    console.log('🧹 Cleared device detection cache');
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

  console.log(`touch detected: hasTouchEvents=${hasTouchEvents}, maxTouchPoints=${touchPoints}, isFinePointer=${isFinePointer}`);

  // Fine pointer (mouse/trackpad) means NOT primarily touch
  if (isFinePointer) return false;

  return hasTouchEvents || touchPoints > 0;
}

// DI-pure module (no window.* fallbacks for dependencies)
console.log('📱 DeviceDetection module loaded (DI-pure, no window.* exports)');

// ES6 exports (DeviceDetectionManager class already exported at line 19)
export {
  deviceDetectionManager,
  initializeDeviceDetectionManager,
  runDeviceDetection,
  autoRedetectOnVersionChange,
  reportDeviceCompatibility,
  testDeviceDetection,
  isTouchDevice
};