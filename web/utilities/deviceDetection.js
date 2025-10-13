/**
 * 📱 miniCycle Device Detection Module
 *
 * Handles device capability detection and app version routing
 *
 * Features:
 * - User agent analysis
 * - Hardware capability detection
 * - Network connection assessment
 * - Schema 2.5 compatibility data storage
 * - Automatic lite version routing
 */

import { appInit } from './appInitialization.js';

export class DeviceDetectionManager {
  constructor(dependencies = {}) {
    // Dependency injection for testability
    this.loadMiniCycleData = dependencies.loadMiniCycleData || this.getGlobalFunction('loadMiniCycleData');
    this.showNotification = dependencies.showNotification || this.getGlobalFunction('showNotification');
    // Explicitly handle currentVersion with proper dependency injection
    if (dependencies && typeof dependencies === 'object' && dependencies.hasOwnProperty('currentVersion')) {
      this.currentVersion = dependencies.currentVersion;
    } else {
      this.currentVersion = '1.315';
    }
    // Debug logging (can be removed after fix is confirmed)
    console.log('[DeviceDetection] Constructor: received version =', dependencies.currentVersion, 'set version =', this.currentVersion);
  }

  // Safe global function access
  getGlobalFunction(name) {
    return typeof window !== 'undefined' && typeof window[name] === 'function' 
      ? window[name] 
      : () => console.warn(`Function ${name} not available`);
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
    const manualOverride = localStorage.getItem('miniCycleForceFullVersion');
    if (manualOverride === 'true') {
      console.log('🚀 Manual override detected - user chose full version');

      // ✅ Wait for core systems to be ready (AppState + data)
      await appInit.waitForCore();

      const schemaData = this.loadMiniCycleData();
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
      this.showNotification('✅ Device detection complete - using full version by user choice', 'success', 3000);
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
    
    const hasLowMemory = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
    const hasSlowConnection = navigator.connection && 
      (navigator.connection.effectiveType === 'slow-2g' || 
       navigator.connection.effectiveType === '2g' || 
       navigator.connection.effectiveType === '3g');
    
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
    // ✅ Wait for core systems to be ready (AppState + data)
    await appInit.waitForCore();

    const schemaData = this.loadMiniCycleData();
    if (!schemaData) {
      console.error('❌ Schema 2.5 data required for device detection');
      return;
    }
    
    try {
      const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
      if (!fullSchemaData) {
        console.error('❌ No Schema 2.5 data found in localStorage');
        return;
      }
      
      if (!fullSchemaData.settings) fullSchemaData.settings = {};
      
      fullSchemaData.settings.deviceCompatibility = {
        ...compatibilityData,
        lastDetectionVersion: this.currentVersion,
        detectionDate: new Date().toISOString()
      };
      
      // Ensure metadata exists and update timestamp
      if (!fullSchemaData.metadata) fullSchemaData.metadata = {};
      fullSchemaData.metadata.lastModified = Date.now();
      
      localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
    } catch (error) {
      console.error('❌ Error saving compatibility data:', error);
    }
  }

  redirectToLite() {
    const cacheBuster = `?redirect=auto&v=${this.currentVersion}&t=${Date.now()}`;
    console.log('📱 Redirecting to lite version:', 'miniCycle-lite.html' + cacheBuster);
    
    this.showNotification('📱 Redirecting to optimized lite version...', 'info', 2000);
    setTimeout(() => {
      window.location.href = 'miniCycle-lite.html' + cacheBuster;
    }, 1000);
  }

  // Auto-redetection on version change
  async autoRedetectOnVersionChange() {
    console.log('🔄 Checking version change (Schema 2.5 only)...');

    // ✅ Wait for core systems to be ready (AppState + data)
    await appInit.waitForCore();

    const schemaData = this.loadMiniCycleData();
    if (!schemaData) {
      console.error('❌ Schema 2.5 data required for version detection');
      return;
    }
    
    let lastDetectionVersion = null;
    try {
      const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
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

    // ✅ Wait for core systems to be ready (AppState + data)
    await appInit.waitForCore();

    const schemaData = this.loadMiniCycleData();
    if (!schemaData) {
      console.error('❌ Schema 2.5 data required for compatibility report');
      this.showNotification('❌ Cannot generate report - Schema 2.5 data required', 'error', 3000);
      return null;
    }
    
    let storedDecision = null;
    let lastDetectionVersion = null;
    let detectionData = null;
    
    try {
      const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
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
      statusMessage = '📱 Device configured for lite version';
      statusType = 'info';
    } else if (storedDecision === false) {
      statusMessage = '💻 Device configured for full version';  
      statusType = 'success';
    } else {
      statusMessage = '❓ No device preference stored';
      statusType = 'warning';
    }
    
    this.showNotification(
      `${statusMessage}<br>` +
      `Version: ${deviceInfo.version}<br>` +
      `Schema: ${deviceInfo.schema}<br>` +
      `Last Check: ${deviceInfo.lastDetectionVersion || 'Never'}`,
      statusType,
      8000
    );
  }

  // Test function for manual testing
  async testDeviceDetection() {
    this.showNotification('🧪 Starting manual device detection test (Schema 2.5 only)...', 'info', 2000);

    // ✅ Wait for core systems to be ready (AppState + data)
    await appInit.waitForCore();

    const schemaData = this.loadMiniCycleData();
    if (!schemaData) {
      console.error('❌ Schema 2.5 data required for device detection test');
      this.showNotification('❌ Cannot test - Schema 2.5 data required', 'error', 3000);
      return;
    }
    
    // Clear detection data for fresh test
    this.clearDetectionData();

    // ✅ No need for setTimeout - appInit.waitForCore() already handles timing
    console.log('🔄 Running fresh device detection...');
    await this.runDeviceDetection();
  }

  clearDetectionData() {
    try {
      const fullSchemaData = JSON.parse(localStorage.getItem("miniCycleData"));
      if (fullSchemaData.settings?.deviceCompatibility) {
        delete fullSchemaData.settings.deviceCompatibility;
        fullSchemaData.metadata.lastModified = Date.now();
        localStorage.setItem("miniCycleData", JSON.stringify(fullSchemaData));
        console.log('🧹 Cleared device compatibility from Schema 2.5');
      }
    } catch (error) {
      console.error('❌ Error clearing Schema 2.5 compatibility:', error);
    }
    
    // Also clear legacy keys for cleanup
    localStorage.removeItem('miniCycleForceFullVersion');
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

// Make functions globally accessible
if (typeof window !== 'undefined') {
  window.DeviceDetectionManager = DeviceDetectionManager;
  window.deviceDetectionManager = initializeDeviceDetectionManager();
  window.runDeviceDetection = runDeviceDetection;
  window.autoRedetectOnVersionChange = autoRedetectOnVersionChange;
  window.reportDeviceCompatibility = reportDeviceCompatibility;
  window.testDeviceDetection = testDeviceDetection;
}