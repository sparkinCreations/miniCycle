/**
 * Quick Actions Manager (DI-Pure)
 *
 * Manages a quick actions panel that provides three switchable views:
 * - Quick Actions (user-pinned) — customizable icon slots
 * - Recently Used (auto) — last N unique actions by recency
 * - Frequently Used (auto) — top N actions by use count
 *
 * Desktop: floating panel to the left of task-view
 * Mobile: non-collapsible top row inside the menu
 *
 * @module ui/quickActionsManager
 */

import { createDIModule, required, optional } from '../core/diBase.js';
import { UI_TIMEOUTS, DOM_IDS, DOM_SELECTORS, DOM_CLASSES } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';
import { handleHorizontalArrowNav } from '../utils/keyboardNav.js';
// Uniform usage tracking — one delegated listener records every action-button click
// (direct + the panel's synthetic clicks). See docs/future-work/ACTION_DISPATCH_PLAN.md
import { recordActionUsage, setupActionUsageTracking } from './actionUsage.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const SLOT_COUNT = 5;
const MAX_RECENT = 10;
const FREQUENT_MIN_USES = 3;
const VIEWS = ['pinned', 'recent', 'frequent'];
const VIEW_TITLE_KEYS = {
    pinned: 'nav.quickActions',
    recent: 'quickAction.recentlyUsed',
    frequent: 'quickAction.frequentlyUsed'
};

// ============================================================================
// ACTION REGISTRY (Phase 1: 5 actions)
// ============================================================================

const ACTION_REGISTRY = {
    'stats': {
        labelKey: 'quickAction.stats',
        icon: 'stats',
        section: 'Navigation',
        handler: 'showStatsPanel'
    },
    'open-routine': {
        labelKey: 'quickAction.openRoutine',
        icon: 'folder-open',
        section: 'Routine Actions',
        handler: 'switchMiniCycle'
    },
    'recurring': {
        labelKey: 'quickAction.recurring',
        icon: 'repeat',
        section: 'Task Actions & Features',
        handler: 'openRecurringPanel'
    },
    'reminders': {
        labelKey: 'quickAction.reminders',
        icon: 'bell',
        section: 'Task Actions & Features',
        handler: 'openRemindersModal'
    },
    'settings': {
        labelKey: 'quickAction.settings',
        icon: 'cog',
        section: 'Settings',
        handler: 'openSettings'
    },
    'history': {
        labelKey: 'quickAction.history',
        icon: 'history',
        section: 'Navigation',
        handler: 'openHistory'
    },
    'achievements': {
        labelKey: 'quickAction.achievements',
        icon: 'trophy',
        section: 'Navigation',
        handler: 'openAchievements'
    },
    'complete-all': {
        labelKey: 'quickAction.completeAll',
        icon: 'check-circle',
        section: 'Task Actions & Features',
        handler: 'completeAll'
    },
    'dark-mode': {
        labelKey: 'quickAction.darkMode',
        icon: 'moon',
        section: 'Settings',
        handler: 'toggleDarkMode'
    },
    'personalization': {
        labelKey: 'quickAction.personalization',
        icon: 'paintbrush',
        section: 'Settings',
        handler: 'openPersonalization'
    },
    'themes': {
        labelKey: 'quickAction.themes',
        icon: 'palette',
        section: 'More',
        handler: 'openThemesPanel'
    },
    'help': {
        labelKey: 'quickAction.help',
        icon: 'question-circle',
        section: 'Settings',
        handler: 'openHelp'
    },
    'games': {
        labelKey: 'quickAction.games',
        icon: 'gamepad',
        section: 'More',
        handler: 'openGames',
        unlockKey: 'task-order-game'
    },
    'feedback': {
        labelKey: 'quickAction.feedback',
        icon: 'comment',
        section: 'More',
        handler: 'openFeedback'
    },
    'search': {
        labelKey: 'quickAction.search',
        icon: 'magnifier',
        section: 'Navigation',
        handler: 'openSearch'
    },
    'user-manual': {
        labelKey: 'quickAction.userManual',
        icon: 'book',
        section: 'Navigation',
        handler: 'openUserManual'
    },
    'toggle-input': {
        labelKey: 'quickAction.toggleInput',
        icon: 'pencil',
        section: 'Task Actions & Features',
        handler: 'toggleTaskInput'
    },
    'task-options': {
        labelKey: 'quickAction.taskOptions',
        icon: 'minus-plus',
        section: 'Task Actions & Features',
        handler: 'openTaskOptions'
    },
    'new-routine': {
        labelKey: 'quickAction.newRoutine',
        icon: 'file-plus',
        section: 'Routine Actions',
        handler: 'newRoutine'
    },
    'share-routine': {
        labelKey: 'quickAction.shareRoutine',
        icon: 'share-nodes',
        section: 'Routine Actions',
        handler: 'shareRoutine'
    },
    'export': {
        labelKey: 'quickAction.exportData',
        icon: 'file-export',
        section: 'Routine Actions',
        handler: 'exportData'
    },
    'task-order-game': {
        labelKey: 'quickAction.taskOrderGame',
        icon: 'puzzle-piece',
        section: 'More',
        handler: 'openTaskOrderGame',
        unlockKey: 'task-order-game'
    }
};

// SVG icons for the action registry (inline to avoid dynamic icon imports)
const ACTION_ICONS = {
    'stats': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>',
    'folder-open': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M88.7 223.8L0 375.8V96C0 60.7 28.7 32 64 32H181.5c17 0 33.3 6.7 45.3 18.7l26.5 26.5c12 12 28.3 18.7 45.3 18.7H416c35.3 0 64 28.7 64 64v32H144c-22.8 0-43.8 12.1-55.3 31.8zM534.7 272.8c8.8 15.5 8.2 34.5-1.4 49.4S508.4 352 490.7 352H64c-17.7 0-32-14.3-32-32V379.8L123.3 256H490.7c11.5 0 22.2 6.2 27.9 16.3l16.1 .5z"/></svg>',
    'repeat': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M0 224c0 17.7 14.3 32 32 32s32-14.3 32-32c0-53 43-96 96-96H320v32c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l64-64c12.5-12.5 12.5-32.8 0-45.3l-64-64c-9.2-9.2-22.9-11.9-34.9-6.9S320 19.1 320 32V64H160C71.6 64 0 135.6 0 224zm512 64c0-17.7-14.3-32-32-32s-32 14.3-32 32c0 53-43 96-96 96H192V352c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9l-64 64c-12.5 12.5-12.5 32.8 0 45.3l64 64c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6V448H352c88.4 0 160-71.6 160-160z"/></svg>',
    'bell': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"/></svg>',
    'cog': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>',
    'history': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M75 75L41 41C25.9 25.9 0 36.6 0 57.9V168c0 13.3 10.7 24 24 24H134.1c21.4 0 32.1-25.9 17-41l-30.8-30.8C155 85.5 203 64 256 64c106 0 192 86 192 192s-86 192-192 192c-40.8 0-78.6-12.7-109.7-34.4c-14.5-10.1-34.4-6.6-44.6 7.9s-6.6 34.4 7.9 44.6C151.2 495 201.7 512 256 512c141.4 0 256-114.6 256-256S397.4 0 256 0C185.3 0 121.3 28.7 75 75zm181 53c-13.3 0-24 10.7-24 24V256c0 6.4 2.5 12.5 7 17l72 72c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-65-65V152c0-13.3-10.7-24-24-24z"/></svg>',
    'trophy': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M400 0H176c-26.5 0-48.1 21.8-47.1 48.2c.2 5.3 .4 10.6 .7 15.8H24C10.7 64 0 74.7 0 88c0 92.6 33.5 157 78.5 200.7c44.3 43.1 98.3 64.8 138.1 75.8c23.4 6.5 39.4 26 39.4 45.6c0 20.9-17 37.9-37.9 37.9H192c-17.7 0-32 14.3-32 32s14.3 32 32 32H384c17.7 0 32-14.3 32-32s-14.3-32-32-32H357.9C337 448 320 431 320 410.1c0-19.6 15.9-39.2 39.4-45.6c39.9-11 93.9-32.7 138.2-75.8C542.5 245 576 180.6 576 88c0-13.3-10.7-24-24-24H446.4c.3-5.2 .5-10.5 .7-15.8C448.1 21.8 426.5 0 400 0zM48.9 112h84.4c9.1 90.1 29.2 150.3 51.9 190.6c-24.9-11-50.8-26.5-73.2-48.3c-32-31.1-58-76-63-142.3zM464.1 254.3c-22.4 21.8-48.3 37.3-73.2 48.3c22.7-40.3 42.8-100.5 51.9-190.6h84.4c-5.1 66.3-31.1 111.2-63 142.3z"/></svg>',
    'check-circle': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>',
    'moon': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.2c-6.3-.3-12.6-.4-19-.4z"/></svg>',
    'palette': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M512 256c0 .9 0 1.8 0 2.7c-.4 36.5-33.6 61.3-70.1 61.3H344c-26.5 0-48 21.5-48 48c0 3.4 .4 6.7 1 9.9c2.1 10.2 6.5 20 10.8 29.9c6.1 13.8 12.1 27.5 12.1 42c0 31.8-21.6 60.4-53.4 62c-3.5 .2-7 .3-10.6 .3C114.6 512 0 397.4 0 256S114.6 0 256 0S512 114.6 512 256zM128 288a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm0-96a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM288 96a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm96 96a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>',
    'question-circle': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
    'gamepad': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M192 64C86 64 0 150 0 256S86 448 192 448H448c106 0 192-86 192-192s-86-192-192-192H192zM496 168a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM392 304a40 40 0 1 1 80 0 40 40 0 1 1 -80 0zM168 200c0-13.3 10.7-24 24-24s24 10.7 24 24v32h32c13.3 0 24 10.7 24 24s-10.7 24-24 24H216v32c0 13.3-10.7 24-24 24s-24-10.7-24-24V280H136c-13.3 0-24-10.7-24-24s10.7-24 24-24h32V200z"/></svg>',
    'comment': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M512 240c0 114.9-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6C73.6 471.1 44.7 480 16 480c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4l0 0 0 0 0 0 0 0 .3-.3c.3-.3 .7-.7 1.3-1.4c1.1-1.2 2.8-3.1 4.9-5.7c4.1-5 9.6-12.4 15.2-21.6c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208z"/></svg>',
    'magnifier': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>',
    'share-nodes': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M352 224c53 0 96-43 96-96s-43-96-96-96s-96 43-96 96c0 4 .2 8 .7 11.9l-94.1 47C145.4 170.2 121.9 160 96 160c-53 0-96 43-96 96s43 96 96 96c25.9 0 49.4-10.2 66.6-26.9l94.1 47c-.5 3.9-.7 7.8-.7 11.9c0 53 43 96 96 96s96-43 96-96s-43-96-96-96c-25.9 0-49.4 10.2-66.6 26.9l-94.1-47c.5-3.9 .7-7.8 .7-11.9s-.2-8-.7-11.9l94.1-47C302.6 213.8 326.1 224 352 224z"/></svg>',
    'file-plus': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384v38.6C310.1 219.5 256 287.4 256 368c0 59.1 29.1 111.3 73.7 143.3c-3.2 .5-6.4 .7-9.7 .7H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 128zM288 368a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-80c-8.8 0-16 7.2-16 16v48H368c-8.8 0-16 7.2-16 16s7.2 16 16 16h48v48c0 8.8 7.2 16 16 16s16-7.2 16-16V384h48c8.8 0 16-7.2 16-16s-7.2-16-16-16H448V304c0-8.8-7.2-16-16-16z"/></svg>',
    'file-export': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V288H216c-13.3 0-24 10.7-24 24s10.7 24 24 24H384v48c0 26.5-21.5 48-48 48H112c-26.5 0-48-21.5-48-48V336H48c-26.5 0-48-21.5-48-48V240c0-26.5 21.5-48 48-48H64V64zM384 128H256V0L384 128zM559 226.2c9.4-9.4 9.4-24.6 0-33.9L495 128.4c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l39 39-103 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l103 0-39 39c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l64-64z"/></svg>',
    'puzzle-piece': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M192 104.8c0-9.2-5.8-17.3-13.2-22.8C167.2 73.3 160 61.3 160 48c0-26.5 28.7-48 64-48s64 21.5 64 48c0 13.3-7.2 25.3-18.8 34c-7.4 5.5-13.2 13.6-13.2 22.8c0 12.8 10.4 23.2 23.2 23.2H336c26.5 0 48 21.5 48 48v56.8c0 12.8 10.4 23.2 23.2 23.2c9.2 0 17.3-5.8 22.8-13.2C439.3 183.2 451.3 176 464 176c26.5 0 48 28.7 48 64s-21.5 64-48 64c-13.3 0-25.3-7.2-34-18.8c-5.5-7.4-13.6-13.2-22.8-13.2c-12.8 0-23.2 10.4-23.2 23.2V352c0 26.5-21.5 48-48 48H295.2c-12.8 0-23.2-10.4-23.2-23.2c0-9.2 5.8-17.3 13.2-22.8c11.6-8.7 18.8-20.7 18.8-34c0-26.5-28.7-48-64-48s-64 21.5-64 48c0 13.3 7.2 25.3 18.8 34c7.4 5.5 13.2 13.6 13.2 22.8c0 12.8-10.4 23.2-23.2 23.2H128c-26.5 0-48-21.5-48-48V295.2c0-12.8-10.4-23.2-23.2-23.2c-9.2 0-17.3 5.8-22.8 13.2C25.3 296.8 13.3 304 0 304c-26.5 0-48-28.7-48-64s21.5-64 48-64c13.3 0 25.3 7.2 34 18.8c5.5 7.4 13.6 13.2 22.8 13.2c12.8 0 23.2-10.4 23.2-23.2V128c0-26.5 21.5-48 48-48h64.8c12.8 0 23.2-10.4 23.2-23.2z"/></svg>',
    'book': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></svg>',
    'pencil': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.3 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2 6.2 16.4 6.2 22.6 0s6.2 16.4 0 22.6z"/></svg>',
    'paintbrush': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M20.599 1.5c-.376 0-.743.111-1.055.32l-5.08 3.385a18.747 18.747 0 00-3.471 2.987 10.04 10.04 0 014.815 4.815 18.748 18.748 0 002.987-3.472l3.386-5.079A1.902 1.902 0 0020.599 1.5zm-8.3 14.025a18.76 18.76 0 001.896-1.207 8.026 8.026 0 00-4.513-4.513A18.75 18.75 0 008.475 11.7l-.278.5a5.26 5.26 0 013.601 3.602l.502-.278zM6.75 13.5A3.75 3.75 0 003 17.25a1.5 1.5 0 01-1.601 1.497.75.75 0 00-.7 1.143 5.25 5.25 0 009.8-2.62 3.75 3.75 0 00-3.75-3.75z" clip-rule="evenodd"/></svg>',
    'minus-plus': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="1" y1="9" x2="7" y2="9"/><line x1="9" y1="18" x2="15" y2="6"/><line x1="17" y1="15" x2="23" y2="15"/><line x1="20" y1="12" x2="20" y2="18"/></svg>'
};

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

const di = createDIModule('QuickActionsManager', {
    AppState: required(),
    appInit: optional(null),
    showNotification: required(),
    safeAddEventListener: optional(null),
    showStatsPanel: required(),
    showTaskView: optional(null),
    switchMiniCycle: optional(null),
    recurringPanel: required(),
    hideMainMenu: required(),
    isDebug: optional(() => false),
    getElementById: optional((id) => document.getElementById(id)),
    querySelector: optional((sel) => document.querySelector(sel)),
    getModal: optional(null)
});

const _deps = new Proxy({}, {
    get(_, prop) {
        return di.resolve()[prop];
    }
});

/**
 * Inject dependencies for the QuickActionsManager module.
 * @param {Object} dependencies - Dependencies including AppState, showNotification, etc.
 * @returns {void}
 */
export function setQuickActionsManagerDependencies(dependencies) {
    di.setDependencies(dependencies);
    if (dependencies.isDebug?.()) console.log('⚡ QuickActionsManager dependencies set:', Object.keys(dependencies));
}

// ============================================================================
// QUICK ACTIONS MANAGER CLASS
// ============================================================================

/**
 * Manages the quick actions panel, which surfaces frequently used actions
 * based on usage frequency and recency.
 */
export class QuickActionsManager {
    constructor(dependencies = {}) {
        const resolved = di.resolve(dependencies);
        this.deps = {
            AppState: resolved.AppState,
            showNotification: resolved.showNotification,
            safeAddEventListener: resolved.safeAddEventListener,
            showStatsPanel: resolved.showStatsPanel,
            showTaskView: resolved.showTaskView,
            switchMiniCycle: resolved.switchMiniCycle,
            recurringPanel: resolved.recurringPanel,
            hideMainMenu: resolved.hideMainMenu,
            isDebug: resolved.isDebug,
            getElementById: resolved.getElementById,
            querySelector: resolved.querySelector,
            getModal: resolved.getModal
        };

        this._initialized = false;
        this._pickerOverlay = null;
        this._pendingSlotIndex = null;
        this._longPressTimer = null;
        this._tooltip = null;
        this._swipeStartX = null;
    }

    async init() {
        if (this._initialized) return;

        await _deps.appInit?.waitForCore();

        // Ensure quickActions data exists in settings
        this._ensureData();

        // Render desktop panel
        this._renderPanel(DOM_IDS.QUICK_ACTIONS_SLOTS);

        // Render mobile menu row
        this._renderPanel(DOM_IDS.QUICK_ACTIONS_MENU_SLOTS);

        // Update titles to match active view
        this._updateTitles();

        // Bind events for desktop panel
        this._bindPanelEvents(DOM_IDS.QUICK_ACTIONS_WINDOW);

        // Bind events for mobile menu row
        this._bindPanelEvents(null, DOM_SELECTORS.QUICK_ACTIONS_MENU_ROW);

        // Create picker overlay (shared between desktop and mobile)
        this._createPickerOverlay();

        // Create tooltip element (shared)
        this._createTooltip();

        // Uniform usage tracking: one delegated listener over the action buttons, so
        // accessing a feature from ANYWHERE (not just the panel) counts toward
        // recently/frequently used. Idempotent + app-lifetime.
        setupActionUsageTracking(this.deps.AppState);

        this._initialized = true;
        if (this.deps.isDebug?.()) console.log('⚡ QuickActionsManager initialized');
    }

    // ========================================================================
    // DATA MANAGEMENT
    // ========================================================================

    _ensureData() {
        const state = this.deps.AppState?.get();
        if (!state?.settings?.quickActions) {
            this.deps.AppState?.update(s => {
                if (!s.settings) s.settings = {};
                s.settings.quickActions = {
                    pinned: ['stats', null, null, null, null],
                    counts: {},
                    recent: [],
                    activeView: 'recent'
                };
            });
        }
    }

    _getData() {
        const state = this.deps.AppState?.get();
        return state?.settings?.quickActions || {
            pinned: ['stats', null, null, null, null],
            counts: {},
            recent: [],
            activeView: 'recent'
        };
    }

    _getActiveView() {
        return this._getData().activeView || 'pinned';
    }

    // ========================================================================
    // VIEW CYCLING
    // ========================================================================

    cycleView(direction) {
        const data = this._getData();
        const currentIndex = VIEWS.indexOf(data.activeView || 'pinned');
        let nextIndex;

        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % VIEWS.length;
        } else {
            nextIndex = (currentIndex - 1 + VIEWS.length) % VIEWS.length;
        }

        const nextView = VIEWS[nextIndex];

        this.deps.AppState?.update(s => {
            if (!s.settings?.quickActions) return;
            s.settings.quickActions.activeView = nextView;
        });

        this._renderAllPanels();
        this._showViewTip(nextView);
    }

    /**
     * Show a one-time tip notification for each Quick Actions view.
     * Each view's tip is shown only once, tracked via settings keys.
     */
    _showViewTip(view) {
        const tipKeys = {
            pinned: 'quickActionsTipPinned',
            recent: 'quickActionsTipRecent',
            frequent: 'quickActionsTipFrequent'
        };
        const tipLabelKeys = {
            pinned: 'quickAction.tipPinned',
            recent: 'quickAction.tipRecent',
            frequent: 'quickAction.tipFrequent'
        };

        const stateKey = tipKeys[view];
        if (!stateKey) return;

        const state = this.deps.AppState?.get();
        if (state?.settings?.[stateKey]) return; // Already shown

        // Mark as seen
        this.deps.AppState?.update(s => {
            if (!s.settings) s.settings = {};
            s.settings[stateKey] = true;
        });

        // Show the tip notification
        this.deps.showNotification?.(
            getLabel(tipLabelKeys[view]),
            'info',
            UI_TIMEOUTS.NOTIFICATION_MEDIUM
        );
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    _renderAllPanels() {
        this._renderPanel(DOM_IDS.QUICK_ACTIONS_SLOTS);
        this._renderPanel(DOM_IDS.QUICK_ACTIONS_MENU_SLOTS);
        this._updateTitles();
    }

    _renderPanel(containerId) {
        const container = this.deps.getElementById(containerId);
        if (!container) return;

        const view = this._getActiveView();

        container.replaceChildren();

        switch (view) {
            case 'pinned':
                this._renderPinnedSlots(container);
                break;
            case 'recent':
                this._renderRecentActions(container);
                break;
            case 'frequent':
                this._renderFrequentActions(container);
                break;
        }
    }

    _renderPinnedSlots(container) {
        const data = this._getData();
        const pinned = data.pinned || [];
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < SLOT_COUNT; i++) {
            const actionId = pinned[i];
            let slot;
            if (actionId && ACTION_REGISTRY[actionId]) {
                slot = this._createFilledSlot(actionId, i);
            } else {
                slot = this._createEmptySlot(i);
            }
            slot.setAttribute('tabindex', i === 0 ? '0' : '-1');
            fragment.appendChild(slot);
        }

        container.appendChild(fragment);
    }

    _renderRecentActions(container) {
        const data = this._getData();
        const recent = (data.recent || []).slice(0, SLOT_COUNT);

        if (recent.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'quick-actions-empty-msg';
            msg.textContent = getLabel('empty.noRecentActions');
            container.appendChild(msg);
            return;
        }

        const fragment = document.createDocumentFragment();
        let slotIndex = 0;
        recent.forEach(actionId => {
            if (ACTION_REGISTRY[actionId]) {
                const slot = this._createFilledSlot(actionId, -1, true);
                slot.setAttribute('tabindex', slotIndex === 0 ? '0' : '-1');
                fragment.appendChild(slot);
                slotIndex++;
            }
        });
        container.appendChild(fragment);
    }

    _renderFrequentActions(container) {
        const data = this._getData();
        const counts = data.counts || {};

        // Get actions that meet the minimum use threshold, sorted by count
        const qualifying = Object.entries(counts)
            .filter(([id, count]) => count >= FREQUENT_MIN_USES && ACTION_REGISTRY[id])
            .sort((a, b) => b[1] - a[1])
            .slice(0, SLOT_COUNT);

        if (qualifying.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'quick-actions-empty-msg';
            msg.textContent = getLabel('empty.noFrequentActions');
            container.appendChild(msg);
            return;
        }

        const fragment = document.createDocumentFragment();
        let slotIndex = 0;
        qualifying.forEach(([actionId]) => {
            if (ACTION_REGISTRY[actionId]) {
                const slot = this._createFilledSlot(actionId, -1, true);
                slot.setAttribute('tabindex', slotIndex === 0 ? '0' : '-1');
                fragment.appendChild(slot);
                slotIndex++;
            }
        });
        container.appendChild(fragment);
    }

    _updateTitles() {
        const view = this._getActiveView();
        const titleKey = VIEW_TITLE_KEYS[view] || 'nav.quickActions';
        const title = getLabel(titleKey);
        document.querySelectorAll(DOM_SELECTORS.QUICK_ACTIONS_TITLE).forEach(el => {
            el.textContent = title;
        });
    }

    // ========================================================================
    // SLOT CREATION
    // ========================================================================

    _createFilledSlot(actionId, slotIndex, isAutoView = false) {
        const action = ACTION_REGISTRY[actionId];
        const label = getLabel(action.labelKey);
        const btn = document.createElement('button');
        btn.className = 'quick-actions-slot filled';
        btn.title = label;
        btn.setAttribute('aria-label', label);
        btn.dataset.actionId = actionId;
        btn.dataset.slotIndex = slotIndex;

        // Icon
        const iconSpan = document.createElement('span');
        iconSpan.className = 'slot-icon';
        iconSpan.innerHTML = ACTION_ICONS[action.icon] || '';
        btn.appendChild(iconSpan);

        // Remove badge (only for pinned view)
        if (!isAutoView && slotIndex >= 0) {
            const removeBadge = document.createElement('span');
            removeBadge.className = 'remove-badge';
            removeBadge.setAttribute('role', 'button');
            removeBadge.setAttribute('aria-label', getLabel('quickAction.unpinAria', { vars: { name: label } }));
            removeBadge.textContent = '×';
            removeBadge._clickHandler = (e) => {
                e.stopPropagation();
                this.unpinAction(slotIndex);
            };
            removeBadge.addEventListener('click', removeBadge._clickHandler);
            btn.appendChild(removeBadge);
        }

        // Click handler: execute the action
        btn._clickHandler = () => this.executeAction(actionId);
        btn.addEventListener('click', btn._clickHandler);

        // Long-press for mobile tooltip
        this._addLongPressHandler(btn, actionId, slotIndex, isAutoView);

        return btn;
    }

    _createEmptySlot(slotIndex) {
        const addActionLabel = getLabel('quickAction.addAction');
        const btn = document.createElement('button');
        btn.className = 'quick-actions-slot empty';
        btn.title = addActionLabel;
        btn.setAttribute('aria-label', addActionLabel);
        btn.dataset.slotIndex = slotIndex;
        btn.textContent = '+';

        btn._clickHandler = () => this.showActionPicker(slotIndex);
        btn.addEventListener('click', btn._clickHandler);

        return btn;
    }

    // ========================================================================
    // ACTION EXECUTION
    // ========================================================================

    _isActionAvailable(action) {
        if (!action.unlockKey) return true;
        const state = this.deps.AppState?.get();
        const unlocked = state?.settings?.unlockedFeatures || [];
        return unlocked.includes(action.unlockKey);
    }

    _warnMissingDep(depName, actionId) {
        console.warn(`⚡ QuickActionsManager: '${depName}' is null — action '${actionId}' cannot execute`);
        this.deps.showNotification?.(getLabel('notify.actionUnavailable'), 'warning', UI_TIMEOUTS.NOTIFICATION_LONG);
    }

    executeAction(actionId) {
        const action = ACTION_REGISTRY[actionId];
        if (!action) return;

        try {
            // Usage is recorded by the delegated listener (actionUsage.js) for
            // button-dispatched actions — their btn.click() below bubbles to it. The 3
            // function-dispatched cases (stats/recurring/reminders) record explicitly,
            // since they don't click a button for the listener to catch.
            switch (action.handler) {
                case 'showStatsPanel':
                    if (!this.deps.showStatsPanel) {
                        this._warnMissingDep('showStatsPanel', actionId);
                        break;
                    }
                    recordActionUsage(this.deps.AppState, actionId);
                    this.deps.showStatsPanel();
                    this.deps.hideMainMenu?.();
                    break;
                case 'switchMiniCycle': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const routineBtn = document.getElementById(DOM_IDS.ROUTINE_SWITCHER_BTN);
                            if (routineBtn) {
                                routineBtn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.ROUTINE_SWITCHER_BTN, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openRecurringPanel':
                    if (!this.deps.recurringPanel?.openPanel) {
                        this._warnMissingDep('recurringPanel.openPanel', actionId);
                        break;
                    }
                    recordActionUsage(this.deps.AppState, actionId);
                    setTimeout(() => {
                        try {
                            this.deps.recurringPanel.openPanel();
                            this.deps.hideMainMenu?.();
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                case 'openRemindersModal': {
                    recordActionUsage(this.deps.AppState, actionId);
                    setTimeout(() => {
                        try {
                            const modal = this.deps.getModal?.('reminders') || this.deps.getElementById(DOM_IDS.REMINDERS_MODAL);
                            if (modal && !modal.open) {
                                modal._previousFocus = document.activeElement;
                                modal.showModal();
                            } else if (!modal) {
                                this._warnMissingDep('reminders modal', actionId);
                            }
                            this.deps.hideMainMenu?.();
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openSettings': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const settingsBtn = document.getElementById(DOM_IDS.OPEN_SETTINGS);
                            if (settingsBtn) {
                                settingsBtn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.OPEN_SETTINGS, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openHistory': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.HISTORY_BTN);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.HISTORY_BTN, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openAchievements': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.ACHIEVEMENT_BADGES_BTN);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.ACHIEVEMENT_BADGES_BTN, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'completeAll': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.COMPLETE_ALL);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.COMPLETE_ALL, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'toggleDarkMode': {
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.QUICK_DARK_TOGGLE);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.QUICK_DARK_TOGGLE, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openPersonalization': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.PERSONALIZATION_BTN);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.PERSONALIZATION_BTN, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openHelp': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.TOGGLE_HELP_WINDOW);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.TOGGLE_HELP_WINDOW, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openGames': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.OPEN_GAMES_PANEL);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.OPEN_GAMES_PANEL, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openFeedback': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.OPEN_FEEDBACK_MODAL);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.OPEN_FEEDBACK_MODAL, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openSearch': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.TASK_SEARCH_BTN);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.TASK_SEARCH_BTN, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openUserManual': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.OPEN_USER_MANUAL);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.OPEN_USER_MANUAL, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'toggleTaskInput': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.TOGGLE_TASK_INPUT_BTN);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.TOGGLE_TASK_INPUT_BTN, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'newRoutine': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.NEW_MINI_CYCLE);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.NEW_MINI_CYCLE, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'shareRoutine': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.SHARE_ROUTINE);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.SHARE_ROUTINE, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'exportData': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.EXPORT_MINI_CYCLE);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.EXPORT_MINI_CYCLE, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openTaskOrderGame': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.OPEN_TASK_ORDER_GAME);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.OPEN_TASK_ORDER_GAME, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openTaskOptions': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.OPEN_TASK_OPTIONS_CUSTOMIZER);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.OPEN_TASK_OPTIONS_CUSTOMIZER, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
                case 'openThemesPanel': {
                    this.deps.hideMainMenu?.();
                    setTimeout(() => {
                        try {
                            const btn = document.getElementById(DOM_IDS.OPEN_THEMES_PANEL);
                            if (btn) {
                                btn.click();
                            } else {
                                this._warnMissingDep(DOM_IDS.OPEN_THEMES_PANEL, actionId);
                            }
                        } catch (err) {
                            console.error(`⚡ Quick action '${actionId}' failed:`, err);
                            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
                        }
                    }, 0);
                    break;
                }
            }
        } catch (err) {
            console.error(`⚡ Quick action '${actionId}' failed:`, err);
            this.deps.showNotification?.(getLabel('notify.actionFailed'), 'error', UI_TIMEOUTS.NOTIFICATION_LONG);
        }
    }

    // ========================================================================
    // PINNING / UNPINNING
    // ========================================================================

    pinAction(slotIndex, actionId) {
        this.deps.AppState?.update(s => {
            if (!s.settings?.quickActions) return;
            s.settings.quickActions.pinned[slotIndex] = actionId;
        });

        this._renderAllPanels();
        this._hidePickerOverlay();
    }

    unpinAction(slotIndex) {
        this.deps.AppState?.update(s => {
            if (!s.settings?.quickActions) return;
            s.settings.quickActions.pinned[slotIndex] = null;
        });

        this._renderAllPanels();
    }

    // ========================================================================
    // TRACKING
    // ========================================================================

    trackAction(actionId) {
        // Delegate persistence to the single source of truth (actionUsage.js).
        recordActionUsage(this.deps.AppState, actionId);

        // Re-render if showing recent or frequent view
        const view = this._getActiveView();
        if (view === 'recent' || view === 'frequent') {
            this._renderAllPanels();
        }
    }

    // ========================================================================
    // ACTION PICKER MODAL
    // ========================================================================

    showActionPicker(slotIndex) {
        this._pendingSlotIndex = slotIndex;

        const data = this._getData();
        const pinned = data.pinned || [];

        // Build picker content
        const picker = this._pickerOverlay.querySelector(DOM_SELECTORS.QUICK_ACTIONS_PICKER);
        const grid = picker.querySelector(DOM_SELECTORS.QUICK_ACTIONS_PICKER_GRID);
        grid.replaceChildren();

        // Group actions by section
        const sections = {};
        for (const [id, action] of Object.entries(ACTION_REGISTRY)) {
            if (!this._isActionAvailable(action)) continue;
            if (!sections[action.section]) {
                sections[action.section] = [];
            }
            sections[action.section].push({ id, ...action });
        }

        for (const [sectionName, actions] of Object.entries(sections)) {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'quick-actions-picker-section';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'quick-actions-picker-section-title';
            titleDiv.textContent = sectionName;
            sectionDiv.appendChild(titleDiv);

            const itemsDiv = document.createElement('div');
            itemsDiv.className = 'quick-actions-picker-grid';

            actions.forEach(action => {
                const item = document.createElement('button');
                item.className = 'quick-actions-picker-item';

                // Disable if already pinned
                if (pinned.includes(action.id)) {
                    item.classList.add(DOM_CLASSES.DISABLED);
                    item.setAttribute('aria-disabled', 'true');
                }

                const iconSpan = document.createElement('span');
                iconSpan.className = 'picker-icon';
                iconSpan.innerHTML = ACTION_ICONS[action.icon] || '';
                item.appendChild(iconSpan);

                const labelSpan = document.createElement('span');
                labelSpan.textContent = getLabel(action.labelKey);
                item.appendChild(labelSpan);

                item._clickHandler = () => {
                    if (!pinned.includes(action.id)) {
                        this.pinAction(slotIndex, action.id);
                    }
                };
                item.addEventListener('click', item._clickHandler);

                itemsDiv.appendChild(item);
            });

            sectionDiv.appendChild(itemsDiv);
            grid.appendChild(sectionDiv);
        }

        // Show dialog with focus management
        this._pickerOverlay._previousFocus = document.activeElement;
        if (!this._pickerOverlay.open) {
            this._pickerOverlay.showModal();
        }
    }

    _createPickerOverlay() {
        // Check if already exists
        if (document.getElementById(DOM_IDS.QUICK_ACTIONS_PICKER_OVERLAY)) {
            this._pickerOverlay = document.getElementById(DOM_IDS.QUICK_ACTIONS_PICKER_OVERLAY);
            return;
        }

        const dialog = document.createElement('dialog');
        dialog.id = DOM_IDS.QUICK_ACTIONS_PICKER_OVERLAY;
        dialog.className = 'quick-actions-picker-overlay';
        dialog.setAttribute('data-modal', '');

        const picker = document.createElement('div');
        picker.className = 'quick-actions-picker has-corner-logo';

        const title = document.createElement('h3');
        title.textContent = getLabel('quickAction.pickerTitle');
        picker.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'quick-actions-picker-grid';
        picker.appendChild(grid);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'quick-actions-picker-cancel';
        cancelBtn.textContent = getLabel('button.close');
        cancelBtn.addEventListener('click', () => this._hidePickerOverlay());
        picker.appendChild(cancelBtn);

        dialog.appendChild(picker);

        // Close on backdrop click (click on dialog element itself, outside picker)
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this._hidePickerOverlay();
            }
        });

        // Restore focus when dialog closes (covers native ESC + programmatic close)
        dialog.addEventListener('close', () => {
            dialog._previousFocus?.focus({ focusVisible: false });
        });

        document.body.appendChild(dialog);
        this._pickerOverlay = dialog;
    }

    _hidePickerOverlay() {
        if (this._pickerOverlay?.open) {
            this._pickerOverlay.close();
        }
        this._pendingSlotIndex = null;
    }

    // ========================================================================
    // PANEL EVENTS (arrows, swipe)
    // ========================================================================

    _bindPanelEvents(panelId, panelSelector) {
        const panel = panelId
            ? this.deps.getElementById(panelId)
            : this.deps.querySelector(panelSelector);
        if (!panel) return;

        // Arrow buttons
        const prevBtn = panel.querySelector(DOM_SELECTORS.QUICK_ACTIONS_PREV);
        const nextBtn = panel.querySelector(DOM_SELECTORS.QUICK_ACTIONS_NEXT);

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this._animatedCycleView('prev', panel));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this._animatedCycleView('next', panel));
        }

        // Keyboard arrow navigation between slots
        const slotsContainer = panel.querySelector(DOM_SELECTORS.QUICK_ACTIONS_SLOTS);
        if (slotsContainer) {
            slotsContainer.addEventListener('keydown', (e) => {
                const slot = e.target.closest(DOM_SELECTORS.QUICK_ACTIONS_SLOT);
                if (!slot) return;
                handleHorizontalArrowNav(e, slotsContainer, DOM_SELECTORS.QUICK_ACTIONS_SLOT, {
                    wrap: true, skipHidden: true
                });
            });
        }

        // Swipe gesture on header
        const header = panel.querySelector(DOM_SELECTORS.QUICK_ACTIONS_HEADER);
        if (header) {
            this._setupSwipeGesture(header);
        }
    }

    _animatedCycleView(direction, panel) {
        const isReducedMotion =
            document.body.classList.contains(DOM_CLASSES.REDUCED_MOTION) ||
            document.documentElement.classList.contains(DOM_CLASSES.REDUCED_MOTION);

        if (isReducedMotion) {
            this.cycleView(direction);
            return;
        }

        const slots = panel?.querySelector(DOM_SELECTORS.QUICK_ACTIONS_SLOTS);
        if (!slots) {
            this.cycleView(direction);
            return;
        }

        const offset = direction === 'next' ? -80 : 80;

        // Slide out
        slots.style.transition = 'transform var(--transition-fast) ease-in, opacity var(--transition-fast) ease-in';
        slots.style.transform = `translateX(${offset}px)`;
        slots.style.opacity = '0';

        let fired = false;
        const onEnd = () => {
            if (fired) return;
            fired = true;
            slots.removeEventListener('transitionend', onEnd);
            this.cycleView(direction);
            // Slide in from opposite side
            requestAnimationFrame(() => {
                slots.style.transition = 'none';
                slots.style.transform = `translateX(${-offset}px)`;
                slots.style.opacity = '0';
                requestAnimationFrame(() => {
                    slots.style.transition = 'transform var(--transition-normal) ease-out, opacity var(--transition-normal) ease-out';
                    slots.style.transform = 'translateX(0)';
                    slots.style.opacity = '1';
                });
            });
        };
        slots.addEventListener('transitionend', onEnd, { once: true });
        setTimeout(onEnd, 300);
    }

    _setupSwipeGesture(element) {
        let startX = 0;
        const threshold = 40;
        const maxDrag = 80;

        // Find the slots container that is a sibling of the header
        const getSlotsContainer = () => {
            const panel = element.closest(`${DOM_SELECTORS.QUICK_ACTIONS_PANEL}, ${DOM_SELECTORS.QUICK_ACTIONS_MENU_ROW}`);
            return panel?.querySelector(DOM_SELECTORS.QUICK_ACTIONS_SLOTS);
        };

        const isReducedMotion = () =>
            document.body.classList.contains(DOM_CLASSES.REDUCED_MOTION) ||
            document.documentElement.classList.contains(DOM_CLASSES.REDUCED_MOTION);

        const applyDragOffset = (diff) => {
            if (isReducedMotion()) return;
            const slots = getSlotsContainer();
            if (!slots) return;
            // Clamp and apply rubber-band feel
            const clamped = Math.max(-maxDrag, Math.min(maxDrag, diff));
            const dampened = clamped * 0.5;
            slots.style.transition = 'none';
            slots.style.transform = `translateX(${dampened}px)`;
            slots.style.opacity = String(1 - Math.abs(dampened) / (maxDrag * 1.5));
        };

        const releaseDrag = (diff) => {
            const slots = getSlotsContainer();
            if (!slots) return;

            if (isReducedMotion()) {
                // No animation, just cycle
                if (Math.abs(diff) >= threshold) {
                    this.cycleView(diff > 0 ? 'prev' : 'next');
                }
                return;
            }

            const swiped = Math.abs(diff) >= threshold;
            if (swiped) {
                // Slide out in swipe direction, then cycle and reset
                const direction = diff > 0 ? 1 : -1;
                slots.style.transition = 'transform var(--transition-fast) ease-in, opacity var(--transition-fast) ease-in';
                slots.style.transform = `translateX(${direction * maxDrag}px)`;
                slots.style.opacity = '0';

                let fired = false;
                const onEnd = () => {
                    if (fired) return;
                    fired = true;
                    slots.removeEventListener('transitionend', onEnd);
                    this.cycleView(diff > 0 ? 'prev' : 'next');
                    // After render, slide in from opposite side
                    requestAnimationFrame(() => {
                        slots.style.transition = 'none';
                        slots.style.transform = `translateX(${-direction * maxDrag}px)`;
                        slots.style.opacity = '0';
                        requestAnimationFrame(() => {
                            slots.style.transition = 'transform var(--transition-normal) ease-out, opacity var(--transition-normal) ease-out';
                            slots.style.transform = 'translateX(0)';
                            slots.style.opacity = '1';
                        });
                    });
                };
                slots.addEventListener('transitionend', onEnd, { once: true });
                // Safety fallback in case transitionend doesn't fire
                setTimeout(onEnd, 300);
            } else {
                // Snap back
                slots.style.transition = 'transform var(--transition-fast) ease-out, opacity var(--transition-fast) ease-out';
                slots.style.transform = 'translateX(0)';
                slots.style.opacity = '1';
            }
        };

        // Touch events
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        }, { passive: true });

        element.addEventListener('touchmove', (e) => {
            const diff = e.touches[0].clientX - startX;
            applyDragOffset(diff);
        }, { passive: true });

        element.addEventListener('touchend', (e) => {
            const diff = e.changedTouches[0].clientX - startX;
            releaseDrag(diff);
        }, { passive: true });

        // Desktop: mouse drag on header
        element.addEventListener('mousedown', (e) => {
            this._swipeStartX = e.clientX;
        });

        element.addEventListener('mousemove', (e) => {
            if (this._swipeStartX !== null) {
                const diff = e.clientX - this._swipeStartX;
                applyDragOffset(diff);
            }
        });

        element.addEventListener('mouseup', (e) => {
            if (this._swipeStartX !== null) {
                const diff = e.clientX - this._swipeStartX;
                releaseDrag(diff);
                this._swipeStartX = null;
            }
        });
    }

    // ========================================================================
    // LONG-PRESS (mobile tooltip + remove)
    // ========================================================================

    _addLongPressHandler(element, actionId, slotIndex, isAutoView) {
        let timer = null;

        element.addEventListener('touchstart', (e) => {
            timer = setTimeout(() => {
                this._showTooltip(element, actionId, slotIndex, isAutoView);
            }, 500);
        }, { passive: true });

        element.addEventListener('touchend', () => {
            clearTimeout(timer);
        }, { passive: true });

        element.addEventListener('touchmove', () => {
            clearTimeout(timer);
        }, { passive: true });
    }

    _createTooltip() {
        if (document.getElementById(DOM_IDS.QUICK_ACTIONS_TOOLTIP)) {
            this._tooltip = document.getElementById(DOM_IDS.QUICK_ACTIONS_TOOLTIP);
            return;
        }

        const tooltip = document.createElement('div');
        tooltip.id = DOM_IDS.QUICK_ACTIONS_TOOLTIP;
        tooltip.className = 'quick-actions-tooltip';
        document.body.appendChild(tooltip);
        this._tooltip = tooltip;
    }

    _showTooltip(element, actionId, slotIndex, isAutoView) {
        const action = ACTION_REGISTRY[actionId];
        if (!action || !this._tooltip) return;

        const actionLabel = getLabel(action.labelKey);
        const rect = element.getBoundingClientRect();

        this._tooltip.replaceChildren();

        const label = document.createElement('div');
        label.textContent = actionLabel;
        this._tooltip.appendChild(label);

        // Add remove button for pinned view
        if (!isAutoView && slotIndex >= 0) {
            const removeBtn = document.createElement('button');
            removeBtn.className = DOM_SELECTORS.TOOLTIP_REMOVE;
            removeBtn.setAttribute('aria-label', getLabel('quickAction.unpinAria', { vars: { name: actionLabel } }));
            removeBtn.textContent = getLabel('button.remove');
            removeBtn._clickHandler = () => {
                this.unpinAction(slotIndex);
                this._hideTooltip();
            };
            removeBtn.addEventListener('click', removeBtn._clickHandler);
            this._tooltip.appendChild(removeBtn);
        }

        Object.assign(this._tooltip.style, {
            left: `${rect.left + rect.width / 2}px`,
            top: `${rect.top - 10}px`,
            transform: 'translate(-50%, -100%)'
        });
        this._tooltip.classList.add(DOM_CLASSES.VISIBLE);

        // Auto-hide after 3 seconds
        setTimeout(() => this._hideTooltip(), UI_TIMEOUTS.TOOLTIP_HIDE);

        // Hide on next touch anywhere
        const hideOnTouch = () => {
            this._hideTooltip();
            document.removeEventListener('touchstart', hideOnTouch);
        };
        setTimeout(() => {
            document.addEventListener('touchstart', hideOnTouch, { once: true, passive: true });
        }, 100);
    }

    _hideTooltip() {
        if (this._tooltip) {
            this._tooltip.classList.remove(DOM_CLASSES.VISIBLE);
        }
    }
}

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

let quickActionsManager = null;

/**
 * Initialize the QuickActionsManager singleton.
 * @param {Object} dependencies - Dependencies forwarded to QuickActionsManager constructor
 * @returns {Promise<QuickActionsManager>} The initialized QuickActionsManager instance
 */
export async function initQuickActionsManager(dependencies) {
    quickActionsManager = new QuickActionsManager(dependencies);
    await quickActionsManager.init();
    return quickActionsManager;
}

/**
 * Track an action from outside the module (called by menu handlers)
 * @param {string} actionId - Action ID from ACTION_REGISTRY
 * @returns {void}
 */
export function trackAction(actionId) {
    quickActionsManager?.trackAction(actionId);
}

// Boot log only in debug mode (isDebug not available at module level, logged in init instead)
