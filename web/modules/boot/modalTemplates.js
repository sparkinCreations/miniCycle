/**
 * Modal Templates
 * HTML for large dialog modals, extracted from miniCycle.html for maintainability.
 * Injected into the DOM at boot by orchestrator.js before Phase 3 (UI initialization).
 *
 * @module boot/modalTemplates
 */

import { getLabel } from '../labels/labelResolver.js';
import { DOM_IDS } from '../core/constants.js';

/** @type {string} HTML template for the recurring tasks panel modal */
export const RECURRING_PANEL_HTML = `<!-- Recurring Panel Modal w/ Overlay -->
<dialog id="recurring-panel-overlay" class="modal-overlay" aria-labelledby="recurring-panel-title" aria-modal="true">
  <div id="recurring-panel" class="modal-panel has-corner-logo">
    <h2 id="recurring-panel-title" data-label-key="recurring.title">${getLabel('recurring.title')}</h2>
    <div class="recurring-panel-body">
    <div class="recurring-panel-left">
    <div id="recurring-toggle-actions" class="hidden">
      <button id="toggle-check-all" class="toggle-check-btn">${getLabel('recurring.checkAll')}</button>
    </div>
    <div class="recurring-scroll-area">
      <p class="recurring-panel-hint">${getLabel('recurring.panelHint')}</p>
      <ul id="recurring-task-list" role="listbox" aria-label="${getLabel('recurring.ariaTaskList')}"></ul>
      <div id="recurring-empty-state" class="recurring-empty-state hidden">
        <p>${getLabel('recurring.emptyState')}</p>
      </div>
    </div>
    <div id="recurring-summary-preview" class="hidden">
      <div class="summary-box">
        <p id="recurring-preview-text"></p>
        <button id="change-recurring-settings" class="change-recurring-btn">${getLabel('recurring.changeSettings')}</button>
      </div>
    </div>
    </div>
    <div class="recurring-panel-right">
    <h3 class="recurring-settings-title hidden">${getLabel('recurring.settingsTitle')}</h3>
    <div id="recurring-settings-panel" class="hidden" aria-live="polite">
      <label for="recur-specific-dates">
        <input type="checkbox" id="recur-specific-dates" name="recur-specific-dates" aria-describedby="specific-dates-desc">
        ${getLabel('recurring.specificDates')}
      </label>
      <div id="specific-dates-desc" class="visually-hidden">
        ${getLabel('recurring.specificDatesDesc')}
      </div>
      
      <div id="specific-dates-panel" class="hidden">
        <div id="specific-date-list">
          <!-- First date picker inserted by JS -->
        </div>
        <button id="add-specific-date" type="button"><span class="plus-icon">+</span> ${getLabel('recurring.addAnotherDate')}</button>
      </div>
      
      <div id="specific-date-time-options" class="hidden">
        <label>
          <input type="checkbox" id="specific-date-specific-time" name="specific-date-specific-time">
          ${getLabel('recurring.specificTime')}
        </label>
      
        <div id="specific-date-time-container" class="hidden">
          <div class="time-picker-wrapper">
            <label for="specific-date-time" class="visually-hidden">${getLabel('recurring.ariaTimeOfDay')}</label>
            <input type="time" id="specific-date-time" name="specific-date-time" class="recurring-time-input">
          </div>
        </div>
      </div>
      <label style="display: flex; align-items: center; margin: 10px 0;">
        <input type="checkbox" id="recur-indefinitely" name="recur-indefinitely" style="margin-right: 8px;" checked>
        ${getLabel('recurring.indefinitely')}
      </label>

      <div id="recur-limited-container" class="hidden" style="margin-left: 24px;" role="group" aria-label="${getLabel('recurring.ariaDurationType')}">
        <label style="display: block; margin: 6px 0;">
          <input type="radio" name="recur-duration-type" id="recur-count-radio" value="count" checked>
          ${getLabel('recurring.specificCount')}
        </label>
        <div id="recur-count-container" class="hidden" style="margin-left: 24px;">
          <label for="recur-count-input" style="display: block; margin: 8px 0;">${getLabel('recurring.occurrences')}</label>
          <input type="number" id="recur-count-input" name="recur-count-input" min="1" value="1" style="width: 80px; padding: 4px;">
        </div>

        <label style="display: block; margin: 6px 0;">
          <input type="radio" name="recur-duration-type" id="recur-until-radio" value="until">
          ${getLabel('recurring.untilDate')}
        </label>
        <div id="recur-until-container" class="hidden" style="margin-left: 24px;">
          <label for="recur-until-date" style="display: block; margin: 8px 0;">${getLabel('recurring.endDate')}</label>
          <input type="date" id="recur-until-date" name="recur-until-date" style="padding: 4px;">
        </div>
      </div>

      <div id="recur-frequency-container">
        <label for="recur-frequency">${getLabel('recurring.repeat')}</label>
        <select id="recur-frequency">
          <option value="hourly">${getLabel('freq.hourly')}</option>
          <option value="daily" selected>${getLabel('freq.daily')}</option>
          <option value="weekly">${getLabel('freq.weekly')}</option>
          <option value="biweekly">${getLabel('freq.biweekly')}</option>
          <option value="monthly">${getLabel('freq.monthly')}</option>
          <option value="yearly">${getLabel('freq.yearly')}</option>
        </select>
      </div>
      <!-- Time Picker Section — surfaced outside advanced options for discoverability -->
      <div id="time-picker-section">
        <!-- Daily time (default visible since daily is default frequency) -->
        <div id="daily-time-section" class="frequency-time-section">
          <label><input type="checkbox" id="daily-specific-time" name="daily-specific-time"> ${getLabel('recurring.specificTimeOfDay')}</label>
          <div id="daily-time-container" class="hidden">
            <div class="time-picker-wrapper">
              <label for="daily-time" class="visually-hidden">${getLabel('recurring.ariaTimeOfDay')}</label>
              <input type="time" id="daily-time" name="daily-time" class="recurring-time-input">
            </div>
          </div>
        </div>

        <!-- Hourly time -->
        <div id="hourly-time-section" class="frequency-time-section hidden">
          <label><input type="checkbox" id="hourly-specific-time" name="hourly-specific-time"> ${getLabel('recurring.specificMinute')}</label>
          <div id="hourly-minute-container" class="hidden">
            <div class="time-picker-stack">
              <div class="time-picker-wrapper">
                <div class="time-picker-group">
                  <label for="hourly-minute" class="visually-hidden">${getLabel('recurring.ariaMinute')}</label>
                  <input type="number" id="hourly-minute" name="hourly-minute" placeholder="${getLabel('recurring.placeholderMinute')}">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Weekly time -->
        <div id="weekly-time-section" class="frequency-time-section hidden">
          <label><input type="checkbox" id="weekly-specific-time" name="weekly-specific-time"> ${getLabel('recurring.specificTime')}</label>
          <div id="weekly-time-container" class="hidden">
            <div class="time-picker-wrapper">
              <label for="weekly-time" class="visually-hidden">${getLabel('recurring.ariaTimeOfDay')}</label>
              <input type="time" id="weekly-time" name="weekly-time" class="recurring-time-input">
            </div>
          </div>
        </div>

        <!-- Biweekly time -->
        <div id="biweekly-time-section" class="frequency-time-section hidden">
          <label><input type="checkbox" id="biweekly-specific-time" name="biweekly-specific-time"> ${getLabel('recurring.specificTime')}</label>
          <div id="biweekly-time-container" class="hidden">
            <div class="time-picker-wrapper">
              <label for="biweekly-time" class="visually-hidden">${getLabel('recurring.ariaTimeOfDay')}</label>
              <input type="time" id="biweekly-time" name="biweekly-time" class="recurring-time-input">
            </div>
          </div>
        </div>

        <!-- Monthly time -->
        <div id="monthly-time-section" class="frequency-time-section hidden">
          <label><input type="checkbox" id="monthly-specific-time" name="monthly-specific-time"> ${getLabel('recurring.specificTime')}</label>
          <div id="monthly-time-container" class="hidden">
            <div class="time-picker-wrapper">
              <label for="monthly-time" class="visually-hidden">${getLabel('recurring.ariaTimeOfDay')}</label>
              <input type="time" id="monthly-time" name="monthly-time" class="recurring-time-input">
            </div>
          </div>
        </div>

        <!-- Yearly time -->
        <div id="yearly-time-section" class="frequency-time-section hidden">
          <label><input type="checkbox" id="yearly-specific-time" name="yearly-specific-time" aria-controls="yearly-time-container"> ${getLabel('recurring.specificTime')}</label>
          <div id="yearly-time-container" class="hidden" aria-live="polite">
            <div class="time-picker-wrapper">
              <label for="yearly-time" class="visually-hidden">${getLabel('recurring.ariaTimeOfDay')}</label>
              <input type="time" id="yearly-time" name="yearly-time" class="recurring-time-input">
            </div>
          </div>
        </div>
      </div>

      <button id="toggle-advanced-settings" type="button" class="toggle-advanced-btn">
        ${getLabel('recurring.showAdvanced')}
      </button>

      <!-- Dynamic Frequency Options (advanced — days, months, patterns only; time moved above) -->
      <div id="frequency-dynamic-options">

        <!-- Hourly options (empty — minute picker moved to time-picker-section) -->
        <div id="hourly-options" class="frequency-options hidden">
        </div>

        <!-- Daily options (empty — time picker moved to time-picker-section) -->
        <div id="daily-options" class="frequency-options">
        </div>

        <!-- Weekly options (days only — time moved) -->
        <div id="weekly-options" class="frequency-options hidden">
          <label><input type="checkbox" id="weekly-specific-days" name="weekly-specific-days"> ${getLabel('recurring.chooseSpecificDaysOfWeek')}</label>
          <div id="weekly-day-container" class="hidden">
            <p class="section-label">${getLabel('recurring.selectDays')}</p>
            <div class="weekly-days" role="group" aria-label="${getLabel('recurring.ariaSelectDays')}">
              <div class="weekly-day-box" data-day="Sun" role="checkbox" tabindex="0" aria-checked="false">${getLabel('recurring.daySun')}</div>
              <div class="weekly-day-box" data-day="Mon" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayMon')}</div>
              <div class="weekly-day-box" data-day="Tue" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayTue')}</div>
              <div class="weekly-day-box" data-day="Wed" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayWed')}</div>
              <div class="weekly-day-box" data-day="Thu" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayThu')}</div>
              <div class="weekly-day-box" data-day="Fri" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayFri')}</div>
              <div class="weekly-day-box" data-day="Sat" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.daySat')}</div>
            </div>
          </div>
        </div>

        <!-- Biweekly options (days only — time moved) -->
        <div id="biweekly-options" class="frequency-options hidden">
          <label><input type="checkbox" id="biweekly-specific-days" name="biweekly-specific-days"> ${getLabel('recurring.chooseSpecificDaysOfWeek')}</label>
          <div id="biweekly-day-container" class="hidden">
            <p class="section-label">${getLabel('recurring.week1')}</p>
            <div class="biweekly-days" role="group" aria-label="${getLabel('recurring.ariaWeek1Days')}">
              <div class="biweekly-day-box" data-day="Sun" data-week="1" role="checkbox" tabindex="0" aria-checked="false">${getLabel('recurring.daySun')}</div>
              <div class="biweekly-day-box" data-day="Mon" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayMon')}</div>
              <div class="biweekly-day-box" data-day="Tue" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayTue')}</div>
              <div class="biweekly-day-box" data-day="Wed" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayWed')}</div>
              <div class="biweekly-day-box" data-day="Thu" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayThu')}</div>
              <div class="biweekly-day-box" data-day="Fri" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayFri')}</div>
              <div class="biweekly-day-box" data-day="Sat" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.daySat')}</div>
            </div>
            <p class="section-label" style="margin-top: 16px;">${getLabel('recurring.week2')}</p>
            <div class="biweekly-days" role="group" aria-label="${getLabel('recurring.ariaWeek2Days')}">
              <div class="biweekly-day-box" data-day="Sun" data-week="2" role="checkbox" tabindex="0" aria-checked="false">${getLabel('recurring.daySun')}</div>
              <div class="biweekly-day-box" data-day="Mon" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayMon')}</div>
              <div class="biweekly-day-box" data-day="Tue" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayTue')}</div>
              <div class="biweekly-day-box" data-day="Wed" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayWed')}</div>
              <div class="biweekly-day-box" data-day="Thu" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayThu')}</div>
              <div class="biweekly-day-box" data-day="Fri" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.dayFri')}</div>
              <div class="biweekly-day-box" data-day="Sat" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">${getLabel('recurring.daySat')}</div>
            </div>
          </div>
        </div>

        <!-- Monthly options (days/patterns only — time moved) -->
        <div id="monthly-options" class="frequency-options hidden">
          <label><input type="checkbox" id="monthly-specific-days" name="monthly-specific-days"> ${getLabel('recurring.chooseSpecificDaysOfMonth')}</label>
          <div id="monthly-day-container" class="hidden">
            <p class="section-label">${getLabel('recurring.selectDays1to31')}</p>
            <div class="monthly-days" role="group" aria-label="${getLabel('recurring.ariaSelectDaysOfMonth')}">
              <!-- Dynamically filled with JS (1 to 31) -->
            </div>
            <label style="margin-top: 10px;">
              <input type="checkbox" id="monthly-last-day" name="monthly-last-day"> ${getLabel('recurring.lastDayOfMonth')}
            </label>
          </div>

          <label><input type="checkbox" id="monthly-week-of-month" name="monthly-week-of-month"> ${getLabel('recurring.useWeekOfMonthPattern')}</label>
          <div id="monthly-week-container" class="hidden">
            <p class="section-label">${getLabel('recurring.selectPattern')}</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px;">
              <select id="monthly-week-ordinal" style="flex: 1; min-width: 100px;">
                <option value="1">${getLabel('recurring.ordinal1st')}</option>
                <option value="2">${getLabel('recurring.ordinal2nd')}</option>
                <option value="3">${getLabel('recurring.ordinal3rd')}</option>
                <option value="4">${getLabel('recurring.ordinal4th')}</option>
                <option value="last">${getLabel('recurring.ordinalLast')}</option>
              </select>
              <select id="monthly-week-day" style="flex: 1; min-width: 100px;">
                <option value="Sun">${getLabel('recurring.daySunday')}</option>
                <option value="Mon">${getLabel('recurring.dayMonday')}</option>
                <option value="Tue">${getLabel('recurring.dayTuesday')}</option>
                <option value="Wed">${getLabel('recurring.dayWednesday')}</option>
                <option value="Thu">${getLabel('recurring.dayThursday')}</option>
                <option value="Fri">${getLabel('recurring.dayFriday')}</option>
                <option value="Sat">${getLabel('recurring.daySaturday')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Yearly options (months/days only — time moved) -->
      <div id="yearly-options" class="frequency-options hidden" aria-labelledby="yearly-options-heading">
        <h4 id="yearly-options-heading" class="visually-hidden">${getLabel('recurring.ariaYearlyOptions')}</h4>

        <label>
          <input type="checkbox" id="yearly-specific-months" name="yearly-specific-months" aria-describedby="yearly-month-container">
          ${getLabel('recurring.chooseSpecificMonths')}
        </label>

        <div id="yearly-month-container" class="hidden" aria-live="polite">
          <p class="section-label">${getLabel('recurring.selectMonths')}</p>
          <div class="yearly-months" aria-label="${getLabel('recurring.ariaYearlyMonthOptions')}" role="group">
            <!-- These will be dynamically generated -->
          </div>
        </div>

        <label id="yearly-specific-days-label" class="hidden">
          <input type="checkbox" id="yearly-specific-days" name="yearly-specific-days" aria-describedby="yearly-day-container">
          ${getLabel('recurring.chooseSpecificDaysOfMonth')}
        </label>

        <label id="yearly-apply-all-label" class="apply-all-label hidden">
          <input type="checkbox" id="yearly-apply-days-to-all" name="yearly-apply-days-to-all" aria-describedby="yearly-apply-description">
          ${getLabel('recurring.applyDaysToAllMonths')}
        </label>
        <p id="yearly-apply-description" class="visually-hidden">${getLabel('recurring.applyDaysToAllMonthsDesc')}</p>

        <div id="yearly-day-container" class="hidden" aria-live="polite">
          <p class="section-label">${getLabel('recurring.selectMonthForDays')}</p>

          <select id="yearly-month-select" aria-label="${getLabel('recurring.ariaMonthForDays')}">
            <option value="1">${getLabel('recurring.monthJanuary')}</option>
            <option value="2">${getLabel('recurring.monthFebruary')}</option>
            <option value="3">${getLabel('recurring.monthMarch')}</option>
            <option value="4">${getLabel('recurring.monthApril')}</option>
            <option value="5">${getLabel('recurring.monthMay')}</option>
            <option value="6">${getLabel('recurring.monthJune')}</option>
            <option value="7">${getLabel('recurring.monthJuly')}</option>
            <option value="8">${getLabel('recurring.monthAugust')}</option>
            <option value="9">${getLabel('recurring.monthSeptember')}</option>
            <option value="10">${getLabel('recurring.monthOctober')}</option>
            <option value="11">${getLabel('recurring.monthNovember')}</option>
            <option value="12">${getLabel('recurring.monthDecember')}</option>
          </select>

          <p id="yearly-days-for-month-label" class="section-label"></p>

          <div class="yearly-days" aria-label="${getLabel('recurring.ariaSpecificDaysOfMonth')}" role="group">
            <!-- Dynamically filled -->
          </div>
        </div>
      </div>

      <div id="set-default-recurring-container">
        <label>
          <input type="checkbox" id="set-default-recurring" name="set-default-recurring">
          ${getLabel('recurring.setAsDefault')}
        </label>
      </div>

      <!-- Recurring Summary Preview -->
    <div id="recurring-summary" class="recurring-summary hidden" aria-live="polite">
     
      <!-- This will be filled in dynamically -->
    </div>
      <div id="recur-settings-actions" class="recur-settings-actions">
        <button id="cancel-recurring-settings" class="cancel-btn" type="button">${getLabel('button.cancel')}</button>
        <button id="apply-recurring-settings" class="apply-btn">${getLabel('button.apply')}</button>
      </div>
      </div>
      </div>
      </div>
      <!-- Add Task Section -->
      <div id="add-recurring-task-section">
        <button id="add-recurring-task-btn" class="add-recurring-task-btn" title="${getLabel('recurring.addTaskTitle')}" data-label-key="recurring.addToRecurring">
          ${getLabel('recurring.addToRecurring')}
        </button>
        <div id="available-tasks-list" class="available-tasks-list hidden">
          <p class="available-tasks-header">${getLabel('recurring.selectTasksHeader')} <button id="select-all-add-recurring" class="select-all-add-recurring-btn">${getLabel('recurring.selectAll')}</button></p>
          <ul id="non-recurring-tasks" aria-label="${getLabel('recurring.ariaAvailableTasks')}"></ul>
          <p id="no-available-tasks" class="no-available-tasks hidden">${getLabel('recurring.noAvailableTasks')}</p>
          <button id="confirm-add-recurring" class="confirm-add-recurring-btn hidden">${getLabel('recurring.addToRecurringShort')}</button>
        </div>
      </div>
      <button id="close-recurring-panel" class="close-recurring-panel">${getLabel('button.close')}</button>
    </div>
  </div>
</dialog>
`;

/** @type {string} HTML template for the preferences/personalization modal */
export const PREFERENCES_MODAL_HTML = `<!-- Preferences Modal -->
<dialog class="preferences-modal" data-modal id="preferences-modal" aria-labelledby="preferences-modal-title" aria-modal="true">
    <div class="preferences-modal-content has-corner-logo">
        <h2 id="preferences-modal-title">${getLabel('prefs.title')}</h2>

        <!-- Theme Notice -->
        <div class="preferences-theme-notice" id="preferences-theme-notice">
            ${getLabel('prefs.themeNotice')}
            <button id="preferences-open-themes" class="preferences-theme-btn">${getLabel('prefs.openThemes')}</button>
        </div>

        <!-- Scrollable Content Area -->
        <div class="preferences-scroll-area">

            <!-- Live Preview Section -->
            <div class="preferences-preview-section" data-section="live-preview">
                <div class="preferences-preview-label preferences-section-header collapsible"
                     role="button" tabindex="0" data-toggle="live-preview"
                     aria-expanded="true" aria-controls="preferences-preview"
                     aria-label="${getLabel('prefs.ariaToggleLivePreview')}">
                    <span>${getLabel('prefs.livePreview')}</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-preview-container" id="preferences-preview">
                    <div class="preview-app-bg">
                        <div class="preview-title">${getLabel('prefs.previewRoutineTitle')}</div>
                        <div class="preview-task-list">
                            <div class="preview-task">
                                <span class="preview-checkbox checked"></span>
                                <span class="preview-task-text">${getLabel('prefs.previewSampleTask1')}</span>
                            </div>
                            <div class="preview-task">
                                <span class="preview-checkbox"></span>
                                <span class="preview-task-text">${getLabel('prefs.previewSampleTask2')}</span>
                            </div>
                        </div>
                        <div class="preview-progress-bar">
                            <div class="preview-progress-fill"></div>
                        </div>
                        <div class="preview-buttons-row">
                            <div class="preview-button preview-complete-btn">${getLabel('prefs.previewComplete')}</div>
                            <div class="preview-button preview-clear-btn">${getLabel('prefs.previewClear')}</div>
                        </div>
                        <div class="preview-stats-panel">
                            <svg class="preview-doughnut" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(200,200,200,0.3)" stroke-width="12"/>
                                <circle class="preview-doughnut-fill" cx="50" cy="50" r="40" fill="none" stroke-width="12" stroke-linecap="round" transform="rotate(-90 50 50)" stroke-dasharray="155 96"/>
                            </svg>
                            <div class="preview-stats-info">
                                <div class="preview-stats-label">${getLabel('prefs.previewStatsLabel')}</div>
                                <div class="preview-stats-bar">
                                    <div class="preview-stats-bar-fill"></div>
                                </div>
                            </div>
                        </div>
                        <div class="preview-panels-row">
                            <div class="preview-panel preview-quick-actions" title="${getLabel('prefs.showQuickActions')}">&#x26A1; ${getLabel('prefs.previewQuick')}</div>
                            <div class="preview-panel preview-help-window" title="${getLabel('prefs.showHelpWindow')}">&#x2753; ${getLabel('prefs.previewHelp')}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="preferences-sections-column">

            <!-- Quick Presets Section -->
            <div class="preferences-section collapsed" data-section="quick-themes">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="quick-themes" aria-expanded="false" aria-label="${getLabel('prefs.ariaToggleQuickColors')}" aria-controls="pref-section-quick-themes">
                    <span class="preferences-section-icon">&#x1F3A8;</span>
                    <span>${getLabel('prefs.quickThemes')}</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content preferences-quick-presets-grid" id="pref-section-quick-themes">
                    <!-- Populated dynamically by preferencesPresets.renderQuickPresets() -->
                </div>
            </div>

            <!-- Saved Presets Section -->
            <div class="preferences-section preferences-presets-section collapsed" data-section="saved-presets">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="saved-presets" aria-expanded="false" aria-label="${getLabel('prefs.ariaToggleSavedPresets')}" aria-controls="pref-section-saved-presets">
                    <span class="preferences-section-icon">&#x1F4BE;</span>
                    <span>${getLabel('prefs.savedPresets')}</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-saved-presets">
                    <div class="preferences-presets-actions">
                        <button id="pref-import-preset" class="preferences-import-btn" title="${getLabel('prefs.importPresetTitle')}">${getLabel('prefs.import')}</button>
                        <button id="pref-save-preset" class="preferences-save-btn" title="${getLabel('prefs.saveCurrentTitle')}">${getLabel('prefs.saveCurrent')}</button>
                    </div>
                    <div class="preferences-presets-list" id="preferences-presets-list">
                        <div class="preferences-no-presets" id="preferences-no-presets">${getLabel('prefs.noSavedPresets')}</div>
                    </div>
                </div>
            </div>

            <!-- Layout Section -->
            <div class="preferences-section collapsed" data-section="desktop-layout">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="desktop-layout" aria-expanded="false" aria-label="${getLabel('prefs.ariaToggleLayout')}" aria-controls="pref-section-desktop-layout">
                    <span class="preferences-section-icon">&#x1F5A5;</span>
                    <span>${getLabel('prefs.layout')}</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-desktop-layout">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x2753;</span>
                        <label for="toggle-help-window">${getLabel('prefs.showHelpWindow')}</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-help-window" name="toggle-help-window" checked>
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x26A1;</span>
                        <label for="toggle-quick-actions">${getLabel('prefs.showQuickActions')}</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-quick-actions" name="toggle-quick-actions" checked>
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F524;</span>
                        <label for="pref-panel-text">${getLabel('prefs.panelText')}</label>
                        <input type="color" id="pref-panel-text" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-panel-text" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                </div>
            </div>

            <!-- Collapsible Color Sections -->

            <!-- App Background Section -->
            <div class="preferences-section collapsed" data-section="app-bg">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="app-bg" aria-expanded="false" aria-label="${getLabel('prefs.ariaToggleAppBg')}" aria-controls="pref-section-app-bg">
                    <span class="preferences-section-icon">&#x1F4F1;</span>
                    <span>${getLabel('prefs.appBackground')}</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-app-bg">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F3A8;</span>
                        <label for="pref-app-bg">${getLabel('prefs.appBackground')}</label>
                        <input type="color" id="pref-app-bg" value="#4c79ff" />
                        <button class="preferences-reset-btn" data-target="pref-app-bg" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4D0;</span>
                        <label for="toggle-bg-pattern">${getLabel('prefs.backgroundPattern')}</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-bg-pattern" name="toggle-bg-pattern" checked>
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F3A8;</span>
                        <label for="pref-pattern-color">${getLabel('prefs.patternColor')}</label>
                        <input type="color" id="pref-pattern-color" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-pattern-color" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4A7;</span>
                        <label for="pref-pattern-opacity">${getLabel('prefs.patternOpacity')}</label>
                        <input type="range" id="pref-pattern-opacity" min="1" max="25" value="4" step="1" aria-valuetext="Opacity: 4%" />
                        <span class="pref-range-value" id="pref-pattern-opacity-value">4%</span>
                        <button class="preferences-reset-btn" data-target="pref-pattern-opacity" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <!-- Background Image Upload -->
                    <div class="preferences-bg-image-section">
                        <div class="preferences-color-row">
                            <span class="pref-color-icon">&#x1F5BC;</span>
                            <label for="bg-image-upload">${getLabel('prefs.backgroundImage')}</label>
                            <input type="file" id="bg-image-upload" accept="image/*" style="display: none;" aria-label="${getLabel('prefs.backgroundImage')}">
                            <button class="preferences-upload-btn" id="bg-image-upload-btn">${getLabel('prefs.upload')}</button>
                            <button class="preferences-remove-btn" id="bg-image-remove-btn" style="display: none;">${getLabel('prefs.removeImage')}</button>
                        </div>
                        <div class="preferences-bg-image-options" id="bg-image-options" style="display: none;">
                            <div class="preferences-color-row">
                                <span class="pref-color-icon">&#x1F441;</span>
                                <label for="toggle-bg-image-visible">${getLabel('prefs.showImage')}</label>
                                <span class="toggle-switch pref-toggle">
                                    <input type="checkbox" id="toggle-bg-image-visible" name="toggle-bg-image-visible" checked>
                                    <span class="toggle-slider"></span>
                                </span>
                            </div>
                            <div class="preferences-color-row">
                                <span class="pref-color-icon">&#x2B55;</span>
                                <label for="bg-image-mode">${getLabel('prefs.displayMode')}</label>
                                <select id="bg-image-mode" class="preferences-select">
                                    <option value="cover">${getLabel('prefs.stretchToFill')}</option>
                                    <option value="center">${getLabel('prefs.centered')}</option>
                                    <option value="tile">${getLabel('prefs.tiled')}</option>
                                </select>
                            </div>
                            <div class="bg-image-preview-container">
                                <img id="bg-image-preview" class="bg-image-preview" alt="${getLabel('prefs.altBackgroundPreview')}">
                            </div>
                        </div>
                        <div class="preferences-bg-image-hint">${getLabel('prefs.imageHint')}</div>
                    </div>
                </div>
            </div>

            <!-- Routine List Section -->
            <div class="preferences-section collapsed" data-section="routine-list">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="routine-list" aria-expanded="false" aria-label="${getLabel('prefs.ariaToggleRoutineList')}" aria-controls="pref-section-routine-list">
                    <span class="preferences-section-icon">&#x1F4CB;</span>
                    <span>${getLabel('prefs.routineList')}</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-routine-list">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4CB;</span>
                        <label for="pref-task-list-bg">${getLabel('prefs.listBackground')}</label>
                        <input type="color" id="pref-task-list-bg" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-task-list-bg" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F532;</span>
                        <label for="toggle-solid-list-bg">${getLabel('prefs.solidColor')}</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-solid-list-bg" name="toggle-solid-list-bg">
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F516;</span>
                        <label for="pref-title-bg">${getLabel('prefs.titleBackground')}</label>
                        <input type="color" id="pref-title-bg" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-title-bg" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F524;</span>
                        <label for="pref-title-text">${getLabel('prefs.titleText')}</label>
                        <input type="color" id="pref-title-text" value="#2b2b2b" />
                        <button class="preferences-reset-btn" data-target="pref-title-text" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                </div>
            </div>

            <!-- Tasks Section -->
            <div class="preferences-section collapsed" data-section="tasks">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="tasks" aria-expanded="false" aria-label="${getLabel('prefs.ariaToggleTasks')}" aria-controls="pref-section-tasks">
                    <span class="preferences-section-icon">&#x2705;</span>
                    <span data-label-key="prefs.tasksCheckboxes">${getLabel('prefs.tasksCheckboxes')}</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-tasks">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4DD;</span>
                        <label for="pref-task-bg" data-label-key="prefs.taskBackground">${getLabel('prefs.taskBackground')}</label>
                        <input type="color" id="pref-task-bg" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-task-bg" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4AC;</span>
                        <label for="pref-task-text" data-label-key="prefs.taskText">${getLabel('prefs.taskText')}</label>
                        <input type="color" id="pref-task-text" value="#333333" />
                        <button class="preferences-reset-btn" data-target="pref-task-text" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x2611;&#xFE0F;</span>
                        <label for="pref-checkbox-bg">${getLabel('prefs.checkboxFill')}</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-checkbox-fill" name="toggle-checkbox-fill" aria-label="${getLabel('accessibility.toggleCheckboxFill')}" checked>
                            <span class="toggle-slider"></span>
                        </span>
                        <input type="color" id="pref-checkbox-bg" value="#5db567" />
                        <button class="preferences-reset-btn" data-target="pref-checkbox-bg" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">⬜</span>
                        <label for="pref-checkbox-incomplete-bg">${getLabel('prefs.checkboxEmpty')}</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-checkbox-incomplete" name="toggle-checkbox-incomplete" aria-label="${getLabel('accessibility.toggleCheckboxEmpty')}" checked>
                            <span class="toggle-slider"></span>
                        </span>
                        <input type="color" id="pref-checkbox-incomplete-bg" value="#c8c8c8" />
                        <button class="preferences-reset-btn" data-target="pref-checkbox-incomplete-bg" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x2714;&#xFE0F;</span>
                        <label for="pref-checkmark">${getLabel('prefs.checkmark')}</label>
                        <input type="color" id="pref-checkmark" value="#124609" />
                        <button class="preferences-reset-btn" data-target="pref-checkmark" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x2714;</span>
                        <label for="checkmark-style-options">${getLabel('prefs.checkmarkStyleTitle')}</label>
                        <select id="checkmark-style-options" class="preferences-select">
                            <option value="fitted">${getLabel('prefs.checkmarkFitted')}</option>
                            <option value="minimal">${getLabel('prefs.checkmarkMinimal')}</option>
                            <option value="standard">${getLabel('prefs.checkmarkLarger')}</option>
                            <option value="circle">${getLabel('prefs.checkmarkNoCheckmark')}</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Buttons & Progress Section -->
            <div class="preferences-section collapsed" data-section="buttons">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="buttons" aria-expanded="false" aria-label="${getLabel('prefs.ariaToggleButtons')}" aria-controls="pref-section-buttons">
                    <span class="preferences-section-icon">&#x1F532;</span>
                    <span>${getLabel('prefs.buttonsProgress')}</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-buttons">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F504;</span>
                        <label for="pref-complete-btn" data-label-key="prefs.completeCycle">${getLabel('prefs.completeCycle')}</label>
                        <input type="color" id="pref-complete-btn" value="#08c352" />
                        <button class="preferences-reset-btn" data-target="pref-complete-btn" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F5D1;&#xFE0F;</span>
                        <label for="pref-clear-btn">${getLabel('prefs.clearCompleted')}</label>
                        <input type="color" id="pref-clear-btn" value="#3b82f6" />
                        <button class="preferences-reset-btn" data-target="pref-clear-btn" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4CA;</span>
                        <label for="pref-progress-bar">${getLabel('prefs.progressBar')}</label>
                        <input type="color" id="pref-progress-bar" value="#82db8c" />
                        <button class="preferences-reset-btn" data-target="pref-progress-bar" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                </div>
            </div>

            <!-- Cycle Completion Section -->
            <div class="preferences-section collapsed" data-section="cycle-animation">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="cycle-animation" aria-expanded="false" aria-label="${getLabel('prefs.ariaToggleCycleAnimation')}" aria-controls="pref-section-cycle-animation">
                    <span class="preferences-section-icon">&#x1F389;</span>
                    <span>${getLabel('prefs.cycleAnimation')}</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-cycle-animation">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4A5;</span>
                        <label for="pref-reset-flash-color">${getLabel('prefs.resetFlashColor')}</label>
                        <input type="color" id="pref-reset-flash-color" value="#4caf50" />
                        <button class="preferences-reset-btn" data-target="pref-reset-flash-color" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F3A8;</span>
                        <label for="pref-celebration-color">${getLabel('prefs.animationColor')}</label>
                        <input type="color" id="pref-celebration-color" value="#4caf4f" />
                        <button class="preferences-reset-btn" data-target="pref-celebration-color" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4AC;</span>
                        <label for="pref-toast-select">${getLabel('prefs.toastMessage')}</label>
                        <select id="pref-toast-select" class="preferences-select">
                            <option value="default">${getLabel('prefs.toastDefault')}</option>
                            <option value="greatJob">${getLabel('prefs.toastGreatJob')}</option>
                            <option value="nailed">${getLabel('prefs.toastNailed')}</option>
                            <option value="finished">${getLabel('prefs.toastFinished')}</option>
                        </select>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F6AB;</span>
                        <label for="toggle-completion-animation">${getLabel('prefs.disableAnimation')}</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-completion-animation">
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F6AB;</span>
                        <label for="toggle-completion-toast">${getLabel('prefs.disableToast')}</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-completion-toast">
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Stats Panel Section -->
            <div class="preferences-section collapsed" data-section="stats">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="stats" aria-expanded="false" aria-label="${getLabel('prefs.ariaToggleStats')}" aria-controls="pref-section-stats">
                    <span class="preferences-section-icon">&#x1F4CA;</span>
                    <span>${getLabel('prefs.statsPanel')}</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-stats">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F5BC;&#xFE0F;</span>
                        <label for="pref-stats-bg">${getLabel('prefs.background')}</label>
                        <input type="color" id="pref-stats-bg" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-stats-bg" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F532;</span>
                        <label for="toggle-solid-stats-bg">${getLabel('prefs.solidColor')}</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-solid-stats-bg" name="toggle-solid-stats-bg">
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4DD;</span>
                        <label for="pref-stats-text">${getLabel('prefs.textColor')}</label>
                        <input type="color" id="pref-stats-text" value="#333333" />
                        <button class="preferences-reset-btn" data-target="pref-stats-text" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4CA;</span>
                        <label for="pref-stats-progress">${getLabel('prefs.statsProgress')}</label>
                        <input type="color" id="pref-stats-progress" value="#4c79ff" />
                        <button class="preferences-reset-btn" data-target="pref-stats-progress" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F369;</span>
                        <label for="pref-stats-doughnut">${getLabel('prefs.statsDoughnut')}</label>
                        <input type="color" id="pref-stats-doughnut" value="#4caf50" />
                        <button class="preferences-reset-btn" data-target="pref-stats-doughnut" title="${getLabel('prefs.resetDefault')}">${getLabel('button.reset')}</button>
                    </div>
                </div>
            </div>

            </div><!-- End sections column -->

        </div><!-- End scroll area -->

        <!-- Footer Actions -->
        <div class="preferences-footer">
            <button id="preferences-undo" class="preferences-undo-btn" title="${getLabel('prefs.undoTitle')}" disabled>
                <span>&#x21A9;</span> ${getLabel('prefs.undoButton')}
            </button>
            <button id="preferences-reset-all" class="preferences-reset-all-btn">${getLabel('prefs.resetAll')}</button>
        </div>

        <button id="close-preferences-btn" class="close-btn">${getLabel('button.close')}</button>
    </div>
</dialog>
`;

/** @type {string} HTML template for the settings modal */
export const SETTINGS_MODAL_HTML = `            <!-- Settings Modal -->
        <dialog id="settings-modal" class="settings-modal" data-modal aria-labelledby="settings-modal-title" aria-modal="true">
            <div class="settings-modal-content has-corner-logo">
                <h2 id="settings-modal-title">&#x2699;&#xFE0F; ${getLabel('settings.title')}</h2>
                <div class="settings-scroll-area">

                <!-- Display Section -->
                <div class="settings-section collapsible collapsed" data-section="display">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="display" aria-expanded="false" aria-label="${getLabel('settings.ariaToggleDisplay')}" aria-controls="settings-section-display">
                        <span class="settings-section-icon">&#x1F5A5;</span>
                        <span>${getLabel('settings.display')}</span>
                        <span class="settings-section-toggle">▼</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-display">
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-completed-dropdown" name="toggle-completed-dropdown">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>${getLabel('settings.showCompleted')}</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="darkModeToggle" name="darkModeToggle">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>${getLabel('settings.darkMode')}</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="settings-toggle-help-window" name="settings-toggle-help-window" checked>
                                <span class="toggle-slider"></span>
                            </span>
                            <span>${getLabel('settings.showHelpWindow')}</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="settings-toggle-quick-actions" name="settings-toggle-quick-actions" checked>
                                <span class="toggle-slider"></span>
                            </span>
                            <span>${getLabel('settings.showQuickActions')}</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="settings-toggle-one-section" name="settings-toggle-one-section" checked>
                                <span class="toggle-slider"></span>
                            </span>
                            <span>${getLabel('settings.oneSectionAtATime')}</span>
                        </label>
                        <button id="open-task-options-customizer" class="settings-btn"><span class="icon-text">+/-</span> ${getLabel('settings.addRemoveTaskButtons')}</button>
                    </div>
                </div>

                <!-- Accessibility Section -->
                <div class="settings-section collapsible collapsed" data-section="accessibility">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="accessibility" aria-expanded="false" aria-label="${getLabel('settings.ariaToggleAccessibility')}" aria-controls="settings-section-accessibility">
                        <span class="settings-section-icon">&#x267F;</span>
                        <span data-label-key="settings.accessibility">${getLabel('settings.accessibility')}</span>
                        <span class="settings-section-toggle">&#9660;</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-accessibility">
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-move-arrows" name="toggle-move-arrows">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>${getLabel('settings.showMoveArrows')}</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-three-dots" name="toggle-three-dots">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>${getLabel('settings.showThreeDots')}</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-reduced-motion" name="toggle-reduced-motion">
                                <span class="toggle-slider"></span>
                            </span>
                            <span data-label-key="settings.reducedMotion">${getLabel('settings.reducedMotion')}</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-high-contrast" name="toggle-high-contrast">
                                <span class="toggle-slider"></span>
                            </span>
                            <span data-label-key="settings.highContrast">${getLabel('settings.highContrast')}</span>
                        </label>
                        <div class="settings-option settings-option-vertical">
                            <label for="font-size-select" data-label-key="settings.fontSize">${getLabel('settings.fontSize')}</label>
                            <select id="font-size-select" class="settings-select">
                                <option value="14" data-label-key="settings.fontSizeSmall">${getLabel('settings.fontSizeSmall')}</option>
                                <option value="16" selected data-label-key="settings.fontSizeDefault">${getLabel('settings.fontSizeDefault')}</option>
                                <option value="18" data-label-key="settings.fontSizeLarge">${getLabel('settings.fontSizeLarge')}</option>
                                <option value="20" data-label-key="settings.fontSizeExtraLarge">${getLabel('settings.fontSizeExtraLarge')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Behavior Section -->
                <div class="settings-section collapsible collapsed" data-section="behavior">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="behavior" aria-expanded="false" aria-label="${getLabel('settings.ariaToggleBehavior')}" aria-controls="settings-section-behavior">
                        <span class="settings-section-icon">&#x1F39B;</span>
                        <span>${getLabel('settings.behavior')}</span>
                        <span class="settings-section-toggle">▼</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-behavior">
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-scroll-to-new-task" name="toggle-scroll-to-new-task" checked>
                                <span class="toggle-slider"></span>
                            </span>
                            <span data-label-key="settings.scrollToNew">${getLabel('settings.scrollToNew')}</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-scroll-on-load" name="toggle-scroll-on-load">
                                <span class="toggle-slider"></span>
                            </span>
                            <span data-label-key="settings.scrollToLast">${getLabel('settings.scrollToLast')}</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-notifications" name="toggle-notifications" checked>
                                <span class="toggle-slider"></span>
                            </span>
                            <span>${getLabel('settings.enableNotifications')}</span>
                        </label>
                    </div>
                </div>

                <!-- Data Management Section -->
                <div class="settings-section collapsible collapsed" data-section="data">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="data" aria-expanded="false" aria-label="${getLabel('settings.ariaToggleData')}" aria-controls="settings-section-data">
                        <span class="settings-section-icon">&#x1F4BE;</span>
                        <span>${getLabel('settings.dataManagement')}</span>
                        <span class="settings-section-toggle">▼</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-data">
                        <button id="backup-mini-cycles" class="settings-btn settings-btn-primary"><i class="fas fa-download"></i> <span data-label-key="settings.backupAll">${getLabel('settings.backupAll')}</span></button>
                        <button id="restore-mini-cycles" class="settings-btn settings-btn-primary"><i class="fas fa-upload"></i> <span data-label-key="settings.restoreAll">${getLabel('settings.restoreAll')}</span></button>
                    </div>
                </div>

                <!-- Reset Options Section -->
                <div class="settings-section collapsible collapsed" data-section="reset">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="reset" aria-expanded="false" aria-label="${getLabel('settings.ariaToggleReset')}" aria-controls="settings-section-reset">
                        <span class="settings-section-icon">&#x1F504;</span>
                        <span>${getLabel('settings.resetOptions')}</span>
                        <span class="settings-section-toggle">▼</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-reset">
                        <button id="${DOM_IDS.RESET_ONBOARDING}" class="settings-btn settings-btn-ghost"><i class="fas fa-redo"></i> ${getLabel('settings.resetOnboarding')}</button>
                        <button id="retake-guided-tour" class="settings-btn settings-btn-ghost"><i class="fas fa-route"></i> ${getLabel('tour.retakeTour')}</button>
                        <button id="reset-notification-position" class="settings-btn settings-btn-ghost"><i class="fas fa-bell"></i> ${getLabel('settings.resetNotifPosition')}</button>
                        <button id="reset-task-view-layout" class="settings-btn settings-btn-ghost"><i class="fas fa-arrows-alt"></i> ${getLabel('settings.resetTaskViewLayout')}</button>
                        <button id="reset-recurring-default" class="settings-btn settings-btn-ghost"><i class="fas fa-sync"></i> ${getLabel('settings.resetRecurringDefault')}</button>
                        <button id="reset-achievement-progress" class="settings-btn settings-btn-ghost"><i class="fas fa-trophy"></i> ${getLabel('settings.resetAchievements')}</button>
                        <button id="clear-undo-history" class="settings-btn settings-btn-ghost"><i class="fas fa-history"></i> ${getLabel('settings.clearUndoHistory')}</button>
                    </div>
                </div>

                <!-- Advanced Section -->
                <div class="settings-section collapsible collapsed" data-section="advanced">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="advanced" aria-expanded="false" aria-label="${getLabel('settings.ariaToggleAdvanced')}" aria-controls="settings-section-advanced">
                        <span class="settings-section-icon">&#x1F527;</span>
                        <span>${getLabel('settings.advanced')}</span>
                        <span class="settings-section-toggle">▼</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-advanced">
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-debug-mode" name="toggle-debug-mode">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>${getLabel('settings.debugMode')}</span>
                        </label>
                        <button id="open-testing-modal" class="settings-btn"><i class="fas fa-flask"></i> ${getLabel('settings.diagnostics')}</button>
                        <button id="check-for-updates" class="settings-btn"><i class="fas fa-sync-alt"></i> ${getLabel('settings.checkUpdates')}</button>
                        <button id="try-lite-version" class="settings-btn"><i class="fas fa-mobile-alt"></i> ${getLabel('settings.tryLite')}</button>
                        <button id="factory-reset" class="settings-btn factory-reset-btn"><i class="fas fa-exclamation-triangle"></i> ${getLabel('settings.factoryReset')}</button>
                    </div>
                </div>

                <!-- Version -->
                <div class="settings-footer">
                    <div class="settings-version" id="settings-version-display">v...</div>
                </div>
                </div><!-- end .settings-scroll-area -->
                <button id="close-settings" class="settings-btn close-btn">${getLabel('button.close')}</button>
            </div>
        </dialog>
`;
