/**
 * Modal Templates
 * HTML for large dialog modals, extracted from miniCycle.html for maintainability.
 * Injected into the DOM at boot by orchestrator.js before Phase 3 (UI initialization).
 *
 * @module boot/modalTemplates
 */

import { getLabel } from '../labels/labelResolver.js';

export const RECURRING_PANEL_HTML = `<!-- Recurring Panel Modal w/ Overlay -->
<dialog id="recurring-panel-overlay" class="modal-overlay" aria-labelledby="recurring-panel-title" aria-modal="true">
  <div id="recurring-panel" class="modal-panel has-corner-logo">
    <h2 id="recurring-panel-title">Recurring Tasks</h2>
    <div id="recurring-toggle-actions" class="hidden">
      <button id="toggle-check-all" class="toggle-check-btn">Check All</button>
    </div>
    <div class="recurring-scroll-area">
      <p class="recurring-panel-hint">Tap a recurring task to see its schedule or change settings</p>
      <ul id="recurring-task-list" role="listbox" aria-label="List of recurring tasks"></ul>
      <div id="recurring-empty-state" class="recurring-empty-state hidden">
        <p>No recurring tasks yet.</p>
      </div>
    </div>
    <!-- Add Task Section -->
    <div id="add-recurring-task-section">
      <button id="add-recurring-task-btn" class="add-recurring-task-btn" title="Add a task from this routine to make it recurring">
        Add Task to Recurring
      </button>
      <div id="available-tasks-list" class="available-tasks-list hidden">
        <p class="available-tasks-header">Select tasks to make recurring: <button id="select-all-add-recurring" class="select-all-add-recurring-btn">Select All</button></p>
        <ul id="non-recurring-tasks" aria-label="Available tasks to make recurring"></ul>
        <p id="no-available-tasks" class="no-available-tasks hidden">All tasks are already recurring, or no tasks exist in this routine.</p>
        <button id="confirm-add-recurring" class="confirm-add-recurring-btn hidden">Add to Recurring</button>
      </div>
    </div>
    <div id="recurring-summary-preview" class="hidden">
      <div class="summary-box">
        <p id="recurring-preview-text"></p>
        <button id="change-recurring-settings" class="change-recurring-btn">Change Recurring Settings</button>
      </div>
    </div>
    <div id="recurring-settings-panel" class="hidden" aria-live="polite">
      <label for="recur-specific-dates">
        <input type="checkbox" id="recur-specific-dates" name="recur-specific-dates" aria-describedby="specific-dates-desc">
        Specific date(s)
      </label>
      <div id="specific-dates-desc" class="visually-hidden">
        Allows you to pick specific calendar dates for the task to recur.
      </div>
      
      <div id="specific-dates-panel" class="hidden">
        <div id="specific-date-list">
          <!-- First date picker inserted by JS -->
        </div>
        <button id="add-specific-date" type="button"><span class="plus-icon">+</span> Add Another Date</button>
      </div>
      
      <div id="specific-date-time-options" class="hidden">
        <label>
          <input type="checkbox" id="specific-date-specific-time" name="specific-date-specific-time">
          Choose specific time
        </label>
      
        <div id="specific-date-time-container" class="hidden">
          <div class="time-picker-wrapper">
            <div class="time-picker-stack">
              <div class="time-picker-group">
                <label for="specific-date-hour" class="visually-hidden">Hour</label>
                <input type="number" id="specific-date-hour" name="specific-date-hour" min="1" max="12" placeholder="Hours"> :
                <label for="specific-date-minute" class="visually-hidden">Minute</label>
                <input type="number" id="specific-date-minute" name="specific-date-minute" min="0" max="59" placeholder="Minutes">
      
                <select id="specific-date-meridiem" aria-label="AM or PM">
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
      
              <label class="time-format-toggle">
                <input type="checkbox" id="specific-date-military" name="specific-date-military">
                Check box to use 24-hour format
              </label>
            </div>
          </div>
        </div>
      </div>
      <label style="display: flex; align-items: center; margin: 10px 0;">
        <input type="checkbox" id="recur-indefinitely" name="recur-indefinitely" style="margin-right: 8px;" checked>
        Recur indefinitely
      </label>

      <div id="recur-limited-container" class="hidden" style="margin-left: 24px;" role="group" aria-label="Duration type">
        <label style="display: block; margin: 6px 0;">
          <input type="radio" name="recur-duration-type" id="recur-count-radio" value="count" checked>
          Specific number of times
        </label>
        <div id="recur-count-container" class="hidden" style="margin-left: 24px;">
          <label for="recur-count-input" style="display: block; margin: 8px 0;">Number of occurrences:</label>
          <input type="number" id="recur-count-input" name="recur-count-input" min="1" value="1" style="width: 80px; padding: 4px;">
        </div>

        <label style="display: block; margin: 6px 0;">
          <input type="radio" name="recur-duration-type" id="recur-until-radio" value="until">
          Until specific date
        </label>
        <div id="recur-until-container" class="hidden" style="margin-left: 24px;">
          <label for="recur-until-date" style="display: block; margin: 8px 0;">End date:</label>
          <input type="date" id="recur-until-date" name="recur-until-date" style="padding: 4px;">
        </div>
      </div>

      <div id="recur-frequency-container">
        <label for="recur-frequency">Repeat:</label>
        <select id="recur-frequency">
          <option value="hourly">Hourly</option>
          <option value="daily" selected>Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      <!-- Time Picker Section — surfaced outside advanced options for discoverability -->
      <div id="time-picker-section">
        <!-- Daily time (default visible since daily is default frequency) -->
        <div id="daily-time-section" class="frequency-time-section">
          <label><input type="checkbox" id="daily-specific-time" name="daily-specific-time"> ${getLabel('recurring.specificTimeOfDay')}</label>
          <div id="daily-time-container" class="hidden">
            <div class="time-picker-wrapper">
              <div class="time-picker-stack">
                <div class="time-picker-group">
                  <label for="daily-hour" class="visually-hidden">${getLabel('recurring.ariaHour')}</label>
                  <input type="number" id="daily-hour" name="daily-hour" min="1" max="12" placeholder="${getLabel('recurring.placeholderHours')}">
                  :
                  <label for="daily-minute" class="visually-hidden">${getLabel('recurring.ariaMinute')}</label>
                  <input type="number" id="daily-minute" name="daily-minute" min="0" max="59" placeholder="${getLabel('recurring.placeholderMinutes')}">
                  <select id="daily-meridiem" aria-label="${getLabel('recurring.ariaAmPm')}">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                <label class="time-format-toggle">
                  <input type="checkbox" id="daily-military" name="daily-military"> ${getLabel('recurring.use24HourFormat')}
                </label>
              </div>
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
                  <input type="number" id="hourly-minute" name="hourly-minute" min="0" max="59" placeholder="${getLabel('recurring.placeholderMinute')}">
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
              <div class="time-picker-stack">
                <div class="time-picker-group">
                  <label for="weekly-hour" class="visually-hidden">${getLabel('recurring.ariaHour')}</label>
                  <input type="number" id="weekly-hour" name="weekly-hour" min="1" max="12" placeholder="${getLabel('recurring.placeholderHours')}">
                  :
                  <label for="weekly-minute" class="visually-hidden">${getLabel('recurring.ariaMinute')}</label>
                  <input type="number" id="weekly-minute" name="weekly-minute" min="0" max="59" placeholder="${getLabel('recurring.placeholderMinutes')}">
                  <select id="weekly-meridiem" aria-label="${getLabel('recurring.ariaAmPm')}">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                <label class="time-format-toggle">
                  <input type="checkbox" id="weekly-military" name="weekly-military"> ${getLabel('recurring.use24HourFormat')}
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Biweekly time -->
        <div id="biweekly-time-section" class="frequency-time-section hidden">
          <label><input type="checkbox" id="biweekly-specific-time" name="biweekly-specific-time"> ${getLabel('recurring.specificTime')}</label>
          <div id="biweekly-time-container" class="hidden">
            <div class="time-picker-wrapper">
              <div class="time-picker-stack">
                <div class="time-picker-group">
                  <label for="biweekly-hour" class="visually-hidden">${getLabel('recurring.ariaHour')}</label>
                  <input type="number" id="biweekly-hour" name="biweekly-hour" min="1" max="12" placeholder="${getLabel('recurring.placeholderHours')}">
                  :
                  <label for="biweekly-minute" class="visually-hidden">${getLabel('recurring.ariaMinute')}</label>
                  <input type="number" id="biweekly-minute" name="biweekly-minute" min="0" max="59" placeholder="${getLabel('recurring.placeholderMinutes')}">
                  <select id="biweekly-meridiem" aria-label="${getLabel('recurring.ariaAmPm')}">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                <label class="time-format-toggle">
                  <input type="checkbox" id="biweekly-military" name="biweekly-military"> ${getLabel('recurring.use24HourFormat')}
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Monthly time -->
        <div id="monthly-time-section" class="frequency-time-section hidden">
          <label><input type="checkbox" id="monthly-specific-time" name="monthly-specific-time"> ${getLabel('recurring.specificTime')}</label>
          <div id="monthly-time-container" class="hidden">
            <div class="time-picker-wrapper">
              <div class="time-picker-stack">
                <div class="time-picker-group">
                  <label for="monthly-hour" class="visually-hidden">${getLabel('recurring.ariaHour')}</label>
                  <input type="number" id="monthly-hour" name="monthly-hour" min="1" max="12" placeholder="${getLabel('recurring.placeholderHours')}">
                  :
                  <label for="monthly-minute" class="visually-hidden">${getLabel('recurring.ariaMinute')}</label>
                  <input type="number" id="monthly-minute" name="monthly-minute" min="0" max="59" placeholder="${getLabel('recurring.placeholderMinutes')}">
                  <select id="monthly-meridiem" aria-label="${getLabel('recurring.ariaAmPm')}">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                <label class="time-format-toggle">
                  <input type="checkbox" id="monthly-military" name="monthly-military"> ${getLabel('recurring.use24HourFormat')}
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Yearly time -->
        <div id="yearly-time-section" class="frequency-time-section hidden">
          <label><input type="checkbox" id="yearly-specific-time" name="yearly-specific-time" aria-controls="yearly-time-container"> ${getLabel('recurring.specificTime')}</label>
          <div id="yearly-time-container" class="hidden" aria-live="polite">
            <div class="time-picker-stack">
              <div class="time-picker-wrapper">
                <div class="time-picker-group" role="group" aria-label="Time of day">
                  <label for="yearly-hour" class="visually-hidden">${getLabel('recurring.ariaHour')}</label>
                  <input type="number" id="yearly-hour" name="yearly-hour" min="1" max="12" placeholder="${getLabel('recurring.placeholderHours')}">
                  :
                  <label for="yearly-minute" class="visually-hidden">${getLabel('recurring.ariaMinute')}</label>
                  <input type="number" id="yearly-minute" name="yearly-minute" min="0" max="59" placeholder="${getLabel('recurring.placeholderMinutes')}">
                  <select id="yearly-meridiem" aria-label="${getLabel('recurring.ariaAmPm')}">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                <label class="time-format-toggle">
                  <input type="checkbox" id="yearly-military" name="yearly-military" aria-label="Use 24-hour time format"> ${getLabel('recurring.use24HourFormat')}
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button id="toggle-advanced-settings" type="button" class="toggle-advanced-btn">
        Show Advanced Options
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
          <label><input type="checkbox" id="weekly-specific-days" name="weekly-specific-days"> Choose specific day(s) of the week</label>
          <div id="weekly-day-container" class="hidden">
            <p class="section-label">Select days:</p>
            <div class="weekly-days" role="group" aria-label="Select days">
              <div class="weekly-day-box" data-day="Sun" role="checkbox" tabindex="0" aria-checked="false">Sun</div>
              <div class="weekly-day-box" data-day="Mon" role="checkbox" tabindex="-1" aria-checked="false">Mon</div>
              <div class="weekly-day-box" data-day="Tue" role="checkbox" tabindex="-1" aria-checked="false">Tue</div>
              <div class="weekly-day-box" data-day="Wed" role="checkbox" tabindex="-1" aria-checked="false">Wed</div>
              <div class="weekly-day-box" data-day="Thu" role="checkbox" tabindex="-1" aria-checked="false">Thu</div>
              <div class="weekly-day-box" data-day="Fri" role="checkbox" tabindex="-1" aria-checked="false">Fri</div>
              <div class="weekly-day-box" data-day="Sat" role="checkbox" tabindex="-1" aria-checked="false">Sat</div>
            </div>
          </div>
        </div>

        <!-- Biweekly options (days only — time moved) -->
        <div id="biweekly-options" class="frequency-options hidden">
          <label><input type="checkbox" id="biweekly-specific-days" name="biweekly-specific-days"> Choose specific day(s) of the week</label>
          <div id="biweekly-day-container" class="hidden">
            <p class="section-label">Week 1:</p>
            <div class="biweekly-days" role="group" aria-label="Week 1 days">
              <div class="biweekly-day-box" data-day="Sun" data-week="1" role="checkbox" tabindex="0" aria-checked="false">Sun</div>
              <div class="biweekly-day-box" data-day="Mon" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">Mon</div>
              <div class="biweekly-day-box" data-day="Tue" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">Tue</div>
              <div class="biweekly-day-box" data-day="Wed" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">Wed</div>
              <div class="biweekly-day-box" data-day="Thu" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">Thu</div>
              <div class="biweekly-day-box" data-day="Fri" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">Fri</div>
              <div class="biweekly-day-box" data-day="Sat" data-week="1" role="checkbox" tabindex="-1" aria-checked="false">Sat</div>
            </div>
            <p class="section-label" style="margin-top: 16px;">Week 2:</p>
            <div class="biweekly-days" role="group" aria-label="Week 2 days">
              <div class="biweekly-day-box" data-day="Sun" data-week="2" role="checkbox" tabindex="0" aria-checked="false">Sun</div>
              <div class="biweekly-day-box" data-day="Mon" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">Mon</div>
              <div class="biweekly-day-box" data-day="Tue" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">Tue</div>
              <div class="biweekly-day-box" data-day="Wed" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">Wed</div>
              <div class="biweekly-day-box" data-day="Thu" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">Thu</div>
              <div class="biweekly-day-box" data-day="Fri" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">Fri</div>
              <div class="biweekly-day-box" data-day="Sat" data-week="2" role="checkbox" tabindex="-1" aria-checked="false">Sat</div>
            </div>
          </div>
        </div>

        <!-- Monthly options (days/patterns only — time moved) -->
        <div id="monthly-options" class="frequency-options hidden">
          <label><input type="checkbox" id="monthly-specific-days" name="monthly-specific-days"> Choose specific day(s) of the month</label>
          <div id="monthly-day-container" class="hidden">
            <p class="section-label">Select days (1-31):</p>
            <div class="monthly-days" role="group" aria-label="Select days of the month">
              <!-- Dynamically filled with JS (1 to 31) -->
            </div>
            <label style="margin-top: 10px;">
              <input type="checkbox" id="monthly-last-day" name="monthly-last-day"> Last day of month
            </label>
          </div>

          <label><input type="checkbox" id="monthly-week-of-month" name="monthly-week-of-month"> Use week of month pattern</label>
          <div id="monthly-week-container" class="hidden">
            <p class="section-label">Select pattern:</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px;">
              <select id="monthly-week-ordinal" style="flex: 1; min-width: 100px;">
                <option value="1">1st</option>
                <option value="2">2nd</option>
                <option value="3">3rd</option>
                <option value="4">4th</option>
                <option value="last">Last</option>
              </select>
              <select id="monthly-week-day" style="flex: 1; min-width: 100px;">
                <option value="Sun">Sunday</option>
                <option value="Mon">Monday</option>
                <option value="Tue">Tuesday</option>
                <option value="Wed">Wednesday</option>
                <option value="Thu">Thursday</option>
                <option value="Fri">Friday</option>
                <option value="Sat">Saturday</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Yearly options (months/days only — time moved) -->
      <div id="yearly-options" class="frequency-options hidden" aria-labelledby="yearly-options-heading">
        <h4 id="yearly-options-heading" class="visually-hidden">Yearly recurrence options</h4>

        <label>
          <input type="checkbox" id="yearly-specific-months" name="yearly-specific-months" aria-describedby="yearly-month-container">
          Choose specific month(s)
        </label>

        <div id="yearly-month-container" class="hidden" aria-live="polite">
          <p class="section-label">Select months:</p>
          <div class="yearly-months" aria-label="Yearly month options" role="group">
            <!-- These will be dynamically generated -->
          </div>
        </div>

        <label id="yearly-specific-days-label" class="hidden">
          <input type="checkbox" id="yearly-specific-days" name="yearly-specific-days" aria-describedby="yearly-day-container">
          Choose specific day(s) of the month
        </label>

        <div id="yearly-day-container" class="hidden" aria-live="polite">
          <p class="section-label">Select days:</p>

          <select id="yearly-month-select" aria-label="Month to assign specific days to">
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>

          <label id="yearly-apply-all-label" class="apply-all-label">
            <input type="checkbox" id="yearly-apply-days-to-all" name="yearly-apply-days-to-all" aria-describedby="yearly-apply-description">
            Apply selected days to all selected months
          </label>
          <p id="yearly-apply-description" class="visually-hidden">When checked, all selected days will apply to every selected month.</p>

          <div class="yearly-days" aria-label="Specific days of selected month" role="group">
            <!-- Dynamically filled -->
          </div>
        </div>
      </div>

      <div id="set-default-recurring-container">
        <label>
          <input type="checkbox" id="set-default-recurring" name="set-default-recurring">
          Set these recurring settings as default
        </label>
      </div>

      <!-- Recurring Summary Preview -->
    <div id="recurring-summary" class="recurring-summary hidden" aria-live="polite">
     
      <!-- This will be filled in dynamically -->
    </div>
      <div id="recur-settings-actions" class="settings-actions">
        <button id="apply-recurring-settings" class="apply-btn">Apply</button>
        <button id="cancel-recurring-settings" class="cancel-btn" type="button">Cancel</button>
      </div>
      </div>
      <button id="close-recurring-panel" class="close-recurring-panel">Close</button>
    </div>
  </div>
</dialog>
`;

export const PREFERENCES_MODAL_HTML = `<!-- Preferences Modal -->
<dialog class="preferences-modal" data-modal id="preferences-modal" aria-labelledby="preferences-modal-title" aria-modal="true">
    <div class="preferences-modal-content has-corner-logo">
        <h2 id="preferences-modal-title">Personalization</h2>

        <!-- Theme Notice -->
        <div class="preferences-theme-notice" id="preferences-theme-notice">
            Custom colors only apply in the Default theme.
            <button id="preferences-open-themes" class="preferences-theme-btn">Open Themes</button>
        </div>

        <!-- Scrollable Content Area -->
        <div class="preferences-scroll-area">

            <!-- Live Preview Section -->
            <div class="preferences-preview-section" data-section="live-preview">
                <div class="preferences-preview-label preferences-section-header collapsible"
                     role="button" tabindex="0" data-toggle="live-preview"
                     aria-expanded="true" aria-controls="preferences-preview"
                     aria-label="Toggle Live Preview section">
                    <span>Live Preview</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-preview-container" id="preferences-preview">
                    <div class="preview-app-bg">
                        <div class="preview-title">My Routine</div>
                        <div class="preview-task-list">
                            <div class="preview-task">
                                <span class="preview-checkbox checked"></span>
                                <span class="preview-task-text">Sample task 1</span>
                            </div>
                            <div class="preview-task">
                                <span class="preview-checkbox"></span>
                                <span class="preview-task-text">Sample task 2</span>
                            </div>
                        </div>
                        <div class="preview-progress-bar">
                            <div class="preview-progress-fill"></div>
                        </div>
                        <div class="preview-buttons-row">
                            <div class="preview-button preview-complete-btn">Complete</div>
                            <div class="preview-button preview-clear-btn">Clear</div>
                        </div>
                        <div class="preview-stats-panel">
                            <svg class="preview-doughnut" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(200,200,200,0.3)" stroke-width="12"/>
                                <circle class="preview-doughnut-fill" cx="50" cy="50" r="40" fill="none" stroke-width="12" stroke-linecap="round" transform="rotate(-90 50 50)" stroke-dasharray="155 96"/>
                            </svg>
                            <div class="preview-stats-info">
                                <div class="preview-stats-label">5 of 8 Tasks</div>
                                <div class="preview-stats-bar">
                                    <div class="preview-stats-bar-fill"></div>
                                </div>
                            </div>
                        </div>
                        <div class="preview-panels-row">
                            <div class="preview-panel preview-quick-actions" title="Quick Actions">&#x26A1; Quick</div>
                            <div class="preview-panel preview-help-window" title="Help Window">&#x2753; Help</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="preferences-sections-column">

            <!-- Quick Presets Section -->
            <div class="preferences-section collapsed" data-section="quick-themes">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="quick-themes" aria-expanded="false" aria-label="Toggle Quick Colors section" aria-controls="pref-section-quick-themes">
                    <span class="preferences-section-icon">&#x1F3A8;</span>
                    <span>Quick Colors</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content preferences-quick-presets-grid" id="pref-section-quick-themes">
                    <!-- Populated dynamically by preferencesPresets.renderQuickPresets() -->
                </div>
            </div>

            <!-- Saved Presets Section -->
            <div class="preferences-presets-section">
                <div class="preferences-presets-header">
                    <div class="preferences-presets-title">
                        <span class="preferences-section-icon">&#x1F4BE;</span>
                        <span>Saved Presets</span>
                    </div>
                    <div class="preferences-presets-actions">
                        <button id="pref-import-preset" class="preferences-import-btn" title="Import preset from code">Import</button>
                        <button id="pref-save-preset" class="preferences-save-btn" title="Save current colors as a preset">Save Current</button>
                    </div>
                </div>
                <div class="preferences-presets-list" id="preferences-presets-list">
                    <div class="preferences-no-presets" id="preferences-no-presets">No saved presets yet</div>
                </div>
            </div>

            <!-- Layout Section -->
            <div class="preferences-section collapsed" data-section="desktop-layout">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="desktop-layout" aria-expanded="false" aria-label="Toggle Layout section" aria-controls="pref-section-desktop-layout">
                    <span class="preferences-section-icon">&#x1F5A5;</span>
                    <span>Layout</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-desktop-layout">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x2753;</span>
                        <label for="toggle-help-window">Help Window</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-help-window" name="toggle-help-window" checked>
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x26A1;</span>
                        <label for="toggle-quick-actions">Quick Actions</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-quick-actions" name="toggle-quick-actions" checked>
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F524;</span>
                        <label for="pref-panel-text">Panel Text</label>
                        <input type="color" id="pref-panel-text" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-panel-text" title="Reset to default">Reset</button>
                    </div>
                </div>
            </div>

            <!-- Collapsible Color Sections -->

            <!-- App Background Section -->
            <div class="preferences-section collapsed" data-section="app-bg">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="app-bg" aria-expanded="false" aria-label="Toggle App Background section" aria-controls="pref-section-app-bg">
                    <span class="preferences-section-icon">&#x1F4F1;</span>
                    <span>App Background</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-app-bg">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F3A8;</span>
                        <label for="pref-app-bg">App Background</label>
                        <input type="color" id="pref-app-bg" value="#4c79ff" />
                        <button class="preferences-reset-btn" data-target="pref-app-bg" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4D0;</span>
                        <label for="toggle-bg-pattern">Background Pattern</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-bg-pattern" name="toggle-bg-pattern" checked>
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F3A8;</span>
                        <label for="pref-pattern-color">Pattern Color</label>
                        <input type="color" id="pref-pattern-color" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-pattern-color" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4A7;</span>
                        <label for="pref-pattern-opacity">Pattern Opacity</label>
                        <input type="range" id="pref-pattern-opacity" min="1" max="25" value="7" step="1" aria-valuetext="Opacity: 7%" />
                        <span class="pref-range-value" id="pref-pattern-opacity-value">7%</span>
                        <button class="preferences-reset-btn" data-target="pref-pattern-opacity" title="Reset to default">Reset</button>
                    </div>
                    <!-- Background Image Upload -->
                    <div class="preferences-bg-image-section">
                        <div class="preferences-color-row">
                            <span class="pref-color-icon">&#x1F5BC;</span>
                            <label>Background Image</label>
                            <input type="file" id="bg-image-upload" accept="image/*" style="display: none;">
                            <button class="preferences-upload-btn" id="bg-image-upload-btn">Upload</button>
                            <button class="preferences-remove-btn" id="bg-image-remove-btn" style="display: none;">Remove</button>
                        </div>
                        <div class="preferences-bg-image-options" id="bg-image-options" style="display: none;">
                            <div class="preferences-color-row">
                                <span class="pref-color-icon">&#x1F441;</span>
                                <label for="toggle-bg-image-visible">Show Image</label>
                                <span class="toggle-switch pref-toggle">
                                    <input type="checkbox" id="toggle-bg-image-visible" name="toggle-bg-image-visible" checked>
                                    <span class="toggle-slider"></span>
                                </span>
                            </div>
                            <div class="preferences-color-row">
                                <span class="pref-color-icon">&#x2B55;</span>
                                <label for="bg-image-mode">Display Mode</label>
                                <select id="bg-image-mode" class="preferences-select">
                                    <option value="cover">Stretch to Fill</option>
                                    <option value="center">Centered</option>
                                    <option value="tile">Tiled</option>
                                </select>
                            </div>
                            <div class="bg-image-preview-container">
                                <img id="bg-image-preview" class="bg-image-preview" alt="Background preview">
                            </div>
                        </div>
                        <div class="preferences-bg-image-hint">Images over 2MB are compressed automatically.</div>
                    </div>
                </div>
            </div>

            <!-- Routine List Section -->
            <div class="preferences-section collapsed" data-section="routine-list">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="routine-list" aria-expanded="false" aria-label="Toggle Routine List section" aria-controls="pref-section-routine-list">
                    <span class="preferences-section-icon">&#x1F4CB;</span>
                    <span>Routine List</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-routine-list">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4CB;</span>
                        <label for="pref-task-list-bg">List Background</label>
                        <input type="color" id="pref-task-list-bg" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-task-list-bg" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F532;</span>
                        <label for="toggle-solid-list-bg">Solid Color</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-solid-list-bg" name="toggle-solid-list-bg">
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F516;</span>
                        <label for="pref-title-bg">Title Background</label>
                        <input type="color" id="pref-title-bg" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-title-bg" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F524;</span>
                        <label for="pref-title-text">Title Text</label>
                        <input type="color" id="pref-title-text" value="#2b2b2b" />
                        <button class="preferences-reset-btn" data-target="pref-title-text" title="Reset to default">Reset</button>
                    </div>
                </div>
            </div>

            <!-- Tasks Section -->
            <div class="preferences-section collapsed" data-section="tasks">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="tasks" aria-expanded="false" aria-label="Toggle Tasks section" aria-controls="pref-section-tasks">
                    <span class="preferences-section-icon">&#x2705;</span>
                    <span>Tasks & Checkboxes</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-tasks">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4DD;</span>
                        <label for="pref-task-bg">Task Background</label>
                        <input type="color" id="pref-task-bg" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-task-bg" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4AC;</span>
                        <label for="pref-task-text">Task Text</label>
                        <input type="color" id="pref-task-text" value="#333333" />
                        <button class="preferences-reset-btn" data-target="pref-task-text" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x2611;&#xFE0F;</span>
                        <label for="pref-checkbox-bg">Checkbox Fill</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-checkbox-fill" name="toggle-checkbox-fill" checked>
                            <span class="toggle-slider"></span>
                        </span>
                        <input type="color" id="pref-checkbox-bg" value="#5db567" />
                        <button class="preferences-reset-btn" data-target="pref-checkbox-bg" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">⬜</span>
                        <label for="pref-checkbox-incomplete-bg">Checkbox Empty</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-checkbox-incomplete" name="toggle-checkbox-incomplete" checked>
                            <span class="toggle-slider"></span>
                        </span>
                        <input type="color" id="pref-checkbox-incomplete-bg" value="#c8c8c8" />
                        <button class="preferences-reset-btn" data-target="pref-checkbox-incomplete-bg" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x2714;&#xFE0F;</span>
                        <label for="pref-checkmark">Checkmark</label>
                        <input type="color" id="pref-checkmark" value="#124609" />
                        <button class="preferences-reset-btn" data-target="pref-checkmark" title="Reset to default">Reset</button>
                    </div>
                </div>
            </div>

            <!-- Buttons & Progress Section -->
            <div class="preferences-section collapsed" data-section="buttons">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="buttons" aria-expanded="false" aria-label="Toggle Task Buttons section" aria-controls="pref-section-buttons">
                    <span class="preferences-section-icon">&#x1F518;</span>
                    <span>Task Buttons & Progress</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-buttons">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F504;</span>
                        <label for="pref-complete-btn">Complete Cycle</label>
                        <input type="color" id="pref-complete-btn" value="#08c352" />
                        <button class="preferences-reset-btn" data-target="pref-complete-btn" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F5D1;&#xFE0F;</span>
                        <label for="pref-clear-btn">Clear Completed</label>
                        <input type="color" id="pref-clear-btn" value="#3b82f6" />
                        <button class="preferences-reset-btn" data-target="pref-clear-btn" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4CA;</span>
                        <label for="pref-progress-bar">Progress Bar</label>
                        <input type="color" id="pref-progress-bar" value="#82db8c" />
                        <button class="preferences-reset-btn" data-target="pref-progress-bar" title="Reset to default">Reset</button>
                    </div>
                </div>
            </div>

            <!-- Stats Panel Section -->
            <div class="preferences-section collapsed" data-section="stats">
                <div class="preferences-section-header collapsible" role="button" tabindex="0" data-toggle="stats" aria-expanded="false" aria-label="Toggle Stats Panel section" aria-controls="pref-section-stats">
                    <span class="preferences-section-icon">&#x1F4CA;</span>
                    <span>Stats Panel</span>
                    <span class="preferences-section-toggle">&#x25BC;</span>
                </div>
                <div class="preferences-section-content" id="pref-section-stats">
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F5BC;&#xFE0F;</span>
                        <label for="pref-stats-bg">Background</label>
                        <input type="color" id="pref-stats-bg" value="#ffffff" />
                        <button class="preferences-reset-btn" data-target="pref-stats-bg" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F532;</span>
                        <label for="toggle-solid-stats-bg">Solid Color</label>
                        <span class="toggle-switch pref-toggle">
                            <input type="checkbox" id="toggle-solid-stats-bg" name="toggle-solid-stats-bg">
                            <span class="toggle-slider"></span>
                        </span>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4DD;</span>
                        <label for="pref-stats-text">Text Color</label>
                        <input type="color" id="pref-stats-text" value="#333333" />
                        <button class="preferences-reset-btn" data-target="pref-stats-text" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F4CA;</span>
                        <label for="pref-stats-progress">Progress Bar</label>
                        <input type="color" id="pref-stats-progress" value="#4c79ff" />
                        <button class="preferences-reset-btn" data-target="pref-stats-progress" title="Reset to default">Reset</button>
                    </div>
                    <div class="preferences-color-row">
                        <span class="pref-color-icon">&#x1F369;</span>
                        <label for="pref-stats-doughnut">Doughnut Chart</label>
                        <input type="color" id="pref-stats-doughnut" value="#4caf50" />
                        <button class="preferences-reset-btn" data-target="pref-stats-doughnut" title="Reset to default">Reset</button>
                    </div>
                </div>
            </div>

            </div><!-- End sections column -->

        </div><!-- End scroll area -->

        <!-- Footer Actions -->
        <div class="preferences-footer">
            <button id="preferences-undo" class="preferences-undo-btn" title="Undo last color change" disabled>
                <span>&#x21A9;</span> Undo
            </button>
            <button id="preferences-reset-all" class="preferences-reset-all-btn">Reset All</button>
        </div>

        <button id="close-preferences-btn" class="close-btn">Close</button>
    </div>
</dialog>
`;

export const SETTINGS_MODAL_HTML = `            <!-- Settings Modal -->
        <dialog id="settings-modal" class="settings-modal" data-modal aria-labelledby="settings-modal-title" aria-modal="true">
            <div class="settings-modal-content has-corner-logo">
                <h2 id="settings-modal-title">Settings</h2>

                <!-- Display Section -->
                <div class="settings-section collapsible collapsed" data-section="display">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="display" aria-expanded="false" aria-label="Toggle Display settings" aria-controls="settings-section-display">
                        <span>Display</span>
                        <span class="settings-section-toggle">▼</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-display">
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-completed-dropdown" name="toggle-completed-dropdown">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Show Completed in Dropdown</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="darkModeToggle" name="darkModeToggle">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Dark Mode</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="settings-toggle-help-window" name="settings-toggle-help-window" checked>
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Show Help Window</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="settings-toggle-quick-actions" name="settings-toggle-quick-actions" checked>
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Show Quick Actions</span>
                        </label>
                        <button id="open-task-options-customizer" class="settings-btn"><span class="icon-text">+/-</span> Add or Remove Task Buttons</button>
                    </div>
                </div>

                <!-- Accessibility Section -->
                <div class="settings-section collapsible collapsed" data-section="accessibility">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="accessibility" aria-expanded="false" aria-label="Toggle Accessibility settings" aria-controls="settings-section-accessibility">
                        <span>Accessibility</span>
                        <span class="settings-section-toggle">&#9660;</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-accessibility">
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-move-arrows" name="toggle-move-arrows">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Show Move Arrows</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-three-dots" name="toggle-three-dots">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Show Three Dots Menu</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-reduced-motion" name="toggle-reduced-motion">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Reduced Motion</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-high-contrast" name="toggle-high-contrast">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>High Contrast</span>
                        </label>
                        <div class="settings-option settings-option-vertical">
                            <label for="font-size-select">Font Size</label>
                            <select id="font-size-select" class="settings-select">
                                <option value="14">Small</option>
                                <option value="16" selected>Default</option>
                                <option value="18">Large</option>
                                <option value="20">Extra Large</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Behavior Section -->
                <div class="settings-section collapsible collapsed" data-section="behavior">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="behavior" aria-expanded="false" aria-label="Toggle Behavior settings" aria-controls="settings-section-behavior">
                        <span>Behavior</span>
                        <span class="settings-section-toggle">▼</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-behavior">
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-scroll-to-new-task" name="toggle-scroll-to-new-task" checked>
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Scroll to New Task</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-scroll-on-load" name="toggle-scroll-on-load">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Scroll to Last Task on Load</span>
                        </label>
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-notifications" name="toggle-notifications" checked>
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Enable Notifications</span>
                        </label>
                    </div>
                </div>

                <!-- Data Management Section -->
                <div class="settings-section collapsible collapsed" data-section="data">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="data" aria-expanded="false" aria-label="Toggle Data Management settings" aria-controls="settings-section-data">
                        <span>Data Management</span>
                        <span class="settings-section-toggle">▼</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-data">
                        <button id="backup-mini-cycles" class="settings-btn settings-btn-primary"><i class="fas fa-download"></i> Backup All Routines</button>
                        <button id="restore-mini-cycles" class="settings-btn settings-btn-primary"><i class="fas fa-upload"></i> Restore All Routines</button>
                    </div>
                </div>

                <!-- Reset Options Section -->
                <div class="settings-section collapsible collapsed" data-section="reset">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="reset" aria-expanded="false" aria-label="Toggle Reset Options settings" aria-controls="settings-section-reset">
                        <span>Reset Options</span>
                        <span class="settings-section-toggle">▼</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-reset">
                        <button id="reset-onboarding" class="settings-btn settings-btn-ghost"><i class="fas fa-redo"></i> Reset Onboarding</button>
                        <button id="reset-notification-position" class="settings-btn settings-btn-ghost"><i class="fas fa-bell"></i> Reset Notification Position</button>
                        <button id="reset-recurring-default" class="settings-btn settings-btn-ghost"><i class="fas fa-sync"></i> Reset Recurring Default</button>
                        <button id="reset-achievement-progress" class="settings-btn settings-btn-ghost"><i class="fas fa-trophy"></i> Reset Achievements</button>
                        <button id="clear-undo-history" class="settings-btn settings-btn-ghost"><i class="fas fa-history"></i> Clear Undo History</button>
                    </div>
                </div>

                <!-- Advanced Section -->
                <div class="settings-section collapsible collapsed" data-section="advanced">
                    <div class="settings-section-header" role="button" tabindex="0" data-toggle="advanced" aria-expanded="false" aria-label="Toggle Advanced settings" aria-controls="settings-section-advanced">
                        <span>Advanced</span>
                        <span class="settings-section-toggle">▼</span>
                    </div>
                    <div class="settings-section-content" id="settings-section-advanced">
                        <label class="settings-option">
                            <span class="toggle-switch">
                                <input type="checkbox" id="toggle-debug-mode" name="toggle-debug-mode">
                                <span class="toggle-slider"></span>
                            </span>
                            <span>Debug Mode</span>
                        </label>
                        <button id="open-testing-modal" class="settings-btn"><i class="fas fa-flask"></i> App Diagnostics</button>
                        <button id="check-for-updates" class="settings-btn"><i class="fas fa-sync-alt"></i> Check for Updates</button>
                        <button id="try-lite-version" class="settings-btn"><i class="fas fa-mobile-alt"></i> Try Lite Version</button>
                        <button id="factory-reset" class="settings-btn factory-reset-btn"><i class="fas fa-exclamation-triangle"></i> Factory Reset</button>
                    </div>
                </div>

                <!-- Version & Close -->
                <div class="settings-footer">
                    <div class="settings-version" id="settings-version-display">v...</div>
                    <button id="close-settings" class="settings-btn close-btn">Close</button>
                </div>
            </div>
        </dialog>
`;
