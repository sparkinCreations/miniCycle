// Startup Manager - restores last active miniCycle session (Schema 2.5)
// DI-pure: no window.* usage; all dependencies injected.

let _deps = {
  // Functions / factories
  AppState: null,              // function: () => AppState instance
  loadMiniCycleData: null,     // function: () => schema25Data
  loadMiniCycle: null,         // function: (name) => void
  refreshUIFromState: null,    // function: () => void (optional)
  showNotification: null,      // function: (msg, type, duration) => void
  AppMeta: null                // object: { version }
};

export function setStartupManagerDependencies(dependencies) {
  const descriptors = {};
  for (const [key, value] of Object.entries(dependencies)) {
    descriptors[key] = { value, writable: true, configurable: true };
  }
  Object.defineProperties(_deps, descriptors);
}

export class StartupManager {
  constructor() {
    this.deps = _deps;
  }

  get appState() {
    return typeof this.deps.AppState === 'function'
      ? this.deps.AppState()
      : this.deps.AppState || null;
  }

  _safeNotify(message, type = 'info', duration) {
    if (typeof this.deps.showNotification === 'function') {
      this.deps.showNotification(message, type, duration);
    }
  }

  _getSchemaData() {
    if (typeof this.deps.loadMiniCycleData === 'function') {
      try {
        return this.deps.loadMiniCycleData() || null;
      } catch (err) {
        console.error('StartupManager: loadMiniCycleData failed', err);
        return null;
      }
    }

    const state = this.appState;
    if (state && typeof state.get === 'function') {
      const snapshot = state.get();
      return snapshot?.miniCycleData || null;
    }

    return null;
  }

  _getLastActiveCycleName(schemaData) {
    if (!schemaData || !schemaData.settings || !schemaData.settings.appState) return null;
    const active = schemaData.settings.appState.activeCycle;
    return typeof active === 'string' && active.trim() ? active.trim() : null;
  }

  _getCycleByName(schemaData, cycleName) {
    if (!schemaData || !schemaData.data || !Array.isArray(schemaData.data.cycles)) return null;
    return schemaData.data.cycles.find(cycle => cycle && cycle.name === cycleName) || null;
  }

  async restoreLastSession() {
    const state = this.appState;
    if (!state || typeof state.isReady !== 'function') {
      console.warn('StartupManager: AppState not available; skipping restore');
      return;
    }

    try {
      const ready = await state.isReady();
      if (!ready) {
        console.warn('StartupManager: AppState not ready; skipping restore');
        return;
      }
    } catch (err) {
      console.error('StartupManager: error waiting for AppState readiness', err);
      return;
    }

    const schemaData = this._getSchemaData();
    if (!schemaData) {
      console.info('StartupManager: No schema data available; nothing to restore');
      return;
    }

    const cycleName = this._getLastActiveCycleName(schemaData);
    if (!cycleName) {
      console.info('StartupManager: No active cycle recorded; nothing to restore');
      return;
    }

    const cycle = this._getCycleByName(schemaData, cycleName);
    if (!cycle) {
      console.warn('StartupManager: Active cycle not found in data; skipping restore', { cycleName });
      return;
    }

    if (!Array.isArray(cycle.tasks)) {
      console.warn('StartupManager: Active cycle has no tasks array; skipping restore', { cycleName });
      return;
    }

    if (typeof this.deps.loadMiniCycle !== 'function') {
      console.warn('StartupManager: loadMiniCycle dependency missing; cannot restore');
      return;
    }

    try {
      console.log('StartupManager: Restoring last session for cycle:', cycleName);
      this.deps.loadMiniCycle(cycleName);

      if (typeof this.deps.refreshUIFromState === 'function') {
        this.deps.refreshUIFromState();
      }

      this._safeNotify(`Restored last session: "${cycleName}"`, 'info', 2500);
    } catch (err) {
      console.error('StartupManager: Error restoring last session', err);
      this._safeNotify('Could not restore last session. Your data is still saved.', 'error', 4000);
    }
  }
}
