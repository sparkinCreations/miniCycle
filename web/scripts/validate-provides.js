#!/usr/bin/env node
/**
 * Manifest `provides` gate.
 *
 * A manifest's `provides` list is a CLAIM about what a module hands to the DI
 * graph. Nothing enforced it, and the loader fails soft in both directions:
 *
 *   registerProvides() calls findProvidedValue(instance, name) and, when that
 *   returns undefined, simply SKIPS the name — no throw, no warning. And where
 *   the loader instead calls the method on the instance directly (via
 *   provideInstance), a missing method resolves to undefined at CALL time,
 *   inside a consumer that usually guards with `?.`.
 *
 * That is not theoretical. The v2.347 statsPanel split moved navigatePanels to
 * the statsPanelGestures sub-module and the facade never re-exported it. The
 * manifest still listed it, moduleLoader still wired gesturePanelManager's
 * onNavigate to it, and the call resolved to undefined. gesturePanelManager
 * reads undefined as "carousel not available" and falls back BY DESIGN to its
 * legacy two-panel path — so nothing threw, no test failed, and three-panel
 * swipe stayed broken on mobile until v2.387, found on a phone.
 *
 * Two checks:
 *
 *   UNSUPPLIED  a `provides` name that cannot be found anywhere on the module's
 *               static surface. Ratcheted against KNOWN_UNSUPPLIED below — the
 *               existing entries are real, but each is supplied by a hand-written
 *               route elsewhere (loader depMappings, or featureBoot wiring), so
 *               they are grandfathered rather than churned. NEW ones fail.
 *
 *   DUPLICATE   the same name claimed by two manifests. Gated at ZERO. These are
 *               silent because registerProvides writes into a deps bucket chosen
 *               by the module's `api`, so two claimants in different buckets do
 *               not overwrite each other — they just leave one copy unreachable
 *               and a contract that lies to the next person splitting the module.
 *               (statsPanel claimed three of these until v2.462.)
 *
 * Why an allow-list and not a count: a plain ceiling lets a NEW violation in one
 * module hide behind a FIXED one in another. Names cannot mask each other.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MODULE_MANIFESTS } from '../modules/boot/moduleManifests.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_DIR = path.resolve(__dirname, '../modules/boot');

/**
 * Known-unsupplied `provides` entries, each with the route that ACTUALLY
 * supplies the name. Every one is a manifest claim whose module does not define
 * that identifier — the name reaches consumers only because something else
 * hand-wires it. Removing an entry from a manifest is the real fix; until then
 * this list stops the set from growing.
 *
 * Do not add to this list to make a new failure go away. A new entry means a
 * module claims something it does not supply, which is the exact shape of the
 * v2.347 navigatePanels bug.
 */
const KNOWN_UNSUPPLIED = new Map([
    ['notifications.showNotification',            'featureBoot.js wires deps.utils.showNotification -> notifications.show()'],
    ['pullToRefresh.pullToRefresh',               'module exports a factory + singleton, not a member named pullToRefresh'],
    ['focusMode.activateFocusMode',               'moduleLoader depMappings -> deps.ui.focusMode.activate()'],
    ['historyManager.logHistoryEvent',            'moduleLoader depMappings -> historyManager.logEvent()'],
    ['historyManager.openHistoryModal',           'moduleLoader depMappings -> historyManager.openModal()'],
    ['clearedTasksManager.clearClearedTasks',     'moduleLoader depMappings -> clearedTasksManager alias'],
    ['clearedTasksManager.openClearedTasksModal', 'moduleLoader depMappings -> clearedTasksManager.openModal()'],
    ['achievementsManager.isAchievementUnlocked', 'moduleLoader depMappings -> achievementsManager alias'],
    ['achievementsManager.openAchievementsModal', 'moduleLoader depMappings -> achievementsManager.openModal()'],
]);

/**
 * Does `src` define `name` anywhere findProvidedValue() could reach it?
 *
 * findProvidedValue reads instance[name] — a method, an own property, or a
 * getter — and registerProvides falls back to the raw module exports. So the
 * static surface worth searching is wider than "class methods": it includes
 * exported bindings, re-export lists, keys of returned object literals (several
 * init() functions return `{ core, panel, ... }`), and `this.x =` assignments.
 */
function suppliesName(src, name) {
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
        // class method / object method, incl. async, static, get/set, generator
        new RegExp(`^\\s*(?:async\\s+|static\\s+|get\\s+|set\\s+|\\*\\s*)*${n}\\s*\\(`, 'm'),
        // export function/const/let/var/class
        new RegExp(`export\\s+(?:async\\s+)?(?:function\\s*\\*?|const|let|var|class)\\s+${n}\\b`),
        // export { a, name, b } and export { orig as name }
        new RegExp(`export\\s*\\{[^}]*\\b(?:as\\s+)?${n}\\s*[,}]`, 's'),
        // object-literal key or shorthand: `name:` / `name,` / `name }`
        new RegExp(`^\\s*${n}\\s*(?::|,\\s*$|\\}\\s*;?\\s*$)`, 'm'),
        // instance property assignment
        new RegExp(`this\\.${n}\\s*=`),
    ];
    return patterns.some(re => re.test(src));
}

const unsupplied = [];
const providersByName = new Map();
const unreadable = [];

for (const [moduleName, manifest] of Object.entries(MODULE_MANIFESTS)) {
    if (!manifest?.provides?.length) continue;

    for (const provided of manifest.provides) {
        if (!providersByName.has(provided)) providersByName.set(provided, []);
        providersByName.get(provided).push(moduleName);
    }

    const file = path.resolve(MANIFEST_DIR, manifest.path);
    let src;
    try {
        src = fs.readFileSync(file, 'utf8');
    } catch {
        unreadable.push(`${moduleName} -> ${path.relative(MANIFEST_DIR, file)}`);
        continue;
    }

    for (const provided of manifest.provides) {
        if (!suppliesName(src, provided)) unsupplied.push(`${moduleName}.${provided}`);
    }
}

const duplicates = [...providersByName.entries()].filter(([, owners]) => owners.length > 1);
const introduced = unsupplied.filter(k => !KNOWN_UNSUPPLIED.has(k));
const stale = [...KNOWN_UNSUPPLIED.keys()].filter(k => !unsupplied.includes(k));

console.log(
    `🔎 provides gate: ${providersByName.size} declared name(s); ` +
    `${unsupplied.length} unsupplied (allowed: ${KNOWN_UNSUPPLIED.size}), ${duplicates.length} duplicated`
);

let failed = false;

if (unreadable.length) {
    console.error('');
    console.error('❌ Manifest path(s) could not be read — the check could not run for these:');
    unreadable.forEach(u => console.error(`     ${u}`));
    failed = true;
}

if (introduced.length) {
    console.error('');
    console.error(`❌ ${introduced.length} manifest 'provides' entr(ies) name something the module does not define:`);
    for (const key of introduced) {
        console.error(`     ${key}`);
    }
    console.error('');
    console.error("   registerProvides() SKIPS a name it cannot find, and a direct call on the");
    console.error("   instance resolves to undefined — in both cases silently. If a split just");
    console.error("   moved this to a sub-module, re-export it from the facade as a one-line");
    console.error("   delegate that RETURNS the sub-module's result — dropping the `return` is");
    console.error("   the same bug in slower motion. If the name is an alias the loader maps by hand,");
    console.error("   drop it from `provides` — the manifest should not claim what it cannot hand over.");
    failed = true;
}

if (stale.length) {
    // One-way: an entry that is no longer a violation must leave the list in the
    // same change, or a later regression could quietly reoccupy its slot.
    console.error('');
    console.error('✂️  These are no longer unsupplied — remove them from KNOWN_UNSUPPLIED in');
    console.error('   scripts/validate-provides.js in this same change to lock in the progress:');
    stale.forEach(k => console.error(`     ${k}`));
    failed = true;
}

if (duplicates.length) {
    console.error('');
    console.error(`❌ ${duplicates.length} name(s) claimed by more than one manifest:`);
    for (const [name, owners] of duplicates) {
        console.error(`     ${name}  <-  ${owners.join(', ')}`);
    }
    console.error('');
    console.error('   Only one module may own a DI name. The extra claim registers an');
    console.error('   unreachable second copy (different `api` = different deps bucket) and');
    console.error('   leaves a `provides` contract that misleads the next refactor.');
    failed = true;
}

if (failed) process.exit(1);

console.log('✅ provides gate passed');
