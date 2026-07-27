// track.js — Netlify Function for anonymous CTA click + pageview counting
// Uses Netlify Blobs to persist counts across deploys
//
// PRIVACY CONTRACT — see web/legal/privacy.html "Anonymous Counter on Landing Pages".
// This endpoint stores ONLY: event name, running total, and pre-bucketed time
// aggregates. It must never record or return referrer URLs, IP addresses,
// geolocation, device/user-agent info, cookies, or any identifier that links one
// event to another. Events are not attributable to a visitor or a session, by
// design. Do not add fields here that would break that promise without first
// revising the privacy policy.
//
// Storage shape per event key:
//   {
//     total:    number,             // lifetime count, never truncated
//     daily:    { "YYYY-MM-DD": n } // per-day counts, pruned to MAX_DAILY_DAYS
//     hours:    number[24],         // lifetime hour-of-day histogram
//     weekdays: number[7],          // lifetime weekday histogram (0 = Sunday)
//     recent:   string[]            // last MAX_RECENT ISO timestamps, feed only
//   }
// Aggregates are bucketed in TRACK_TIMEZONE so "today" and "by hour" match the
// dashboard owner's wall clock rather than UTC.

import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

var MAX_DAILY_DAYS = 400;    // ~13 months of daily buckets (~5 KB per event)
var MAX_RECENT = 50;         // bounded ring for the "Recent Clicks" feed
var MAX_WRITE_ATTEMPTS = 5;  // compare-and-swap retries on a contended key

var STORES = {
    click: "click-counts",
    view: "page-views",
};

// ─── Timezone-aware bucketing ─────────────────────────────────

var WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function buildFormatter(timeZone) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
        weekday: "short",
    });
}

var TIMEZONE = process.env.TRACK_TIMEZONE || "UTC";
var formatter;
try {
    formatter = buildFormatter(TIMEZONE);
} catch {
    // Invalid TRACK_TIMEZONE — fall back to UTC rather than crashing the function.
    TIMEZONE = "UTC";
    formatter = buildFormatter(TIMEZONE);
}

// Returns { dateKey, hour, weekday } for a Date, in TRACK_TIMEZONE.
function zonedParts(date) {
    var parts = formatter.formatToParts(date);
    var map = {};
    for (var i = 0; i < parts.length; i++) {
        map[parts[i].type] = parts[i].value;
    }
    // hour12:false yields "24" for midnight in some ICU builds.
    var hour = parseInt(map.hour, 10) % 24;
    return {
        dateKey: map.year + "-" + map.month + "-" + map.day,
        hour: Number.isFinite(hour) ? hour : 0,
        weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
    };
}

// ─── Record shape ─────────────────────────────────────────────

function emptyRecord() {
    return {
        total: 0,
        daily: {},
        hours: new Array(24).fill(0),
        weekdays: new Array(7).fill(0),
        recent: [],
    };
}

function intArray(value, length) {
    var out = new Array(length).fill(0);
    if (!Array.isArray(value)) return out;
    for (var i = 0; i < length; i++) {
        var n = Number(value[i]);
        out[i] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
    return out;
}

// Accepts every historical shape and returns the current one:
//   1. plain number            (original counter)
//   2. { total, clicks[] }     (raw-timestamp era — aggregated here, then dropped)
//   3. { total, daily, ... }   (current)
function normalizeRecord(parsed) {
    if (typeof parsed === "number") {
        var fromNumber = emptyRecord();
        fromNumber.total = parsed > 0 ? Math.floor(parsed) : 0;
        return fromNumber;
    }
    if (!parsed || typeof parsed !== "object") return emptyRecord();

    var record = emptyRecord();
    record.total = Number(parsed.total) > 0 ? Math.floor(Number(parsed.total)) : 0;

    if (parsed.daily && typeof parsed.daily === "object") {
        for (var key of Object.keys(parsed.daily)) {
            var n = Number(parsed.daily[key]);
            if (Number.isFinite(n) && n > 0) record.daily[key] = Math.floor(n);
        }
    }
    record.hours = intArray(parsed.hours, 24);
    record.weekdays = intArray(parsed.weekdays, 7);

    if (Array.isArray(parsed.recent)) {
        record.recent = parsed.recent.filter(function (t) {
            return typeof t === "string";
        });
    }

    // Legacy `clicks[]` — fold the raw timestamps into aggregates once, then let
    // them go. Only runs while a key still carries the old shape.
    if (Array.isArray(parsed.clicks) && parsed.clicks.length > 0 && !parsed.daily) {
        for (var ts of parsed.clicks) {
            var date = new Date(ts);
            if (Number.isNaN(date.getTime())) continue;
            var p = zonedParts(date);
            record.daily[p.dateKey] = (record.daily[p.dateKey] || 0) + 1;
            record.hours[p.hour]++;
            record.weekdays[p.weekday]++;
        }
        if (record.recent.length === 0) {
            record.recent = parsed.clicks.slice(-MAX_RECENT);
        }
    }

    return record;
}

function parseRecord(raw) {
    if (raw == null) return emptyRecord();
    try {
        return normalizeRecord(JSON.parse(raw));
    } catch {
        // Non-JSON body — the very first counter format was a bare integer string.
        var n = parseInt(raw, 10);
        var record = emptyRecord();
        record.total = Number.isFinite(n) && n > 0 ? n : 0;
        return record;
    }
}

function pruneDaily(daily) {
    var keys = Object.keys(daily);
    if (keys.length <= MAX_DAILY_DAYS) return daily;
    // ISO-like keys sort lexically; keep the newest MAX_DAILY_DAYS.
    keys.sort();
    var out = {};
    for (var key of keys.slice(-MAX_DAILY_DAYS)) out[key] = daily[key];
    return out;
}

function applyHit(record, date) {
    var p = zonedParts(date);
    record.total += 1;
    record.daily[p.dateKey] = (record.daily[p.dateKey] || 0) + 1;
    record.hours[p.hour]++;
    record.weekdays[p.weekday]++;
    record.recent.push(date.toISOString());
    if (record.recent.length > MAX_RECENT) {
        record.recent = record.recent.slice(-MAX_RECENT);
    }
    record.daily = pruneDaily(record.daily);
    return record;
}

// ─── Storage ──────────────────────────────────────────────────

// Reads every key in a store concurrently. The previous implementation awaited
// each get() inside a for-loop, so latency grew linearly with the event count.
async function loadStore(name) {
    var store = getStore(name);
    var listing = await store.list();
    var entries = await Promise.all(
        listing.blobs.map(async function (blob) {
            var raw = await store.get(blob.key);
            return [blob.key, parseRecord(raw)];
        })
    );
    var out = {};
    for (var [key, record] of entries) out[key] = record;
    return out;
}

// Increments a counter using a compare-and-swap loop. A plain read-modify-write
// loses increments when two hits land on the same key concurrently.
async function recordHit(storeName, key, date) {
    var store = getStore(storeName);

    for (var attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
        var existing = await store.getWithMetadata(key, { consistency: "strong" });
        var record = existing ? parseRecord(existing.data) : emptyRecord();
        applyHit(record, date);

        var options = existing
            ? { onlyIfMatch: existing.etag }
            : { onlyIfNew: true };

        var result = await store.set(key, JSON.stringify(record), options);
        if (result.modified) return true;
        // Lost the race — re-read and reapply against the winner's value.
    }
    return false;
}

// ─── Auth ─────────────────────────────────────────────────────

function secretMatches(provided) {
    var expected = process.env.TRACK_SECRET;
    if (!expected || typeof provided !== "string" || provided.length === 0) {
        return false;
    }
    var a = Buffer.from(provided, "utf8");
    var b = Buffer.from(expected, "utf8");
    // timingSafeEqual requires equal lengths; comparing lengths first leaks only
    // the secret's length, which is standard and acceptable.
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

// The secret travels in the Authorization header, never the query string —
// query strings land in hosting access logs and browser history.
function extractSecret(request) {
    var header = request.headers.get("authorization") || "";
    var match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match ? match[1].trim() : "";
}

// ─── Handler ──────────────────────────────────────────────────

// The POST endpoint is called cross-origin from the marketing pages, so it stays
// open. The GET endpoint is same-origin (dashboard) and deliberately sends no
// Access-Control-Allow-Origin, which blocks cross-origin reads outright.
var WRITE_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
};

var READ_HEADERS = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
};

function json(body, status, headers) {
    return new Response(JSON.stringify(body), { status: status, headers: headers });
}

export default async function handler(request) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: WRITE_HEADERS });
    }

    // GET — return aggregated counts for the dashboard.
    if (request.method === "GET") {
        if (!secretMatches(extractSecret(request))) {
            return json({ error: "unauthorized" }, 401, READ_HEADERS);
        }

        var [events, pageviews] = await Promise.all([
            loadStore(STORES.click),
            loadStore(STORES.view),
        ]);

        return json(
            {
                events: events,
                pageviews: pageviews,
                timezone: TIMEZONE,
                generatedAt: new Date().toISOString(),
            },
            200,
            READ_HEADERS
        );
    }

    // POST — increment a counter (click by default; type:"view" routes to pageviews).
    if (request.method === "POST") {
        var body;
        try {
            body = await request.json();
        } catch {
            return json({ error: "invalid json" }, 400, WRITE_HEADERS);
        }

        var event = body.event;
        if (!event || typeof event !== "string" || event.length > 100) {
            return json({ error: "invalid event" }, 400, WRITE_HEADERS);
        }

        // Sanitize: only allow alphanumeric, hyphens, underscores
        var sanitized = event.replace(/[^a-zA-Z0-9_-]/g, "");
        if (!sanitized) {
            return json({ error: "invalid event" }, 400, WRITE_HEADERS);
        }

        var type = body.type === "view" ? "view" : "click";
        var written = await recordHit(STORES[type], sanitized, new Date());

        if (!written) {
            // Exhausted CAS retries under sustained contention. Tracking is
            // non-critical, so report it without failing the caller's page.
            return json({ ok: false, reason: "contended" }, 200, WRITE_HEADERS);
        }

        return json({ ok: true }, 200, WRITE_HEADERS);
    }

    return json({ error: "method not allowed" }, 405, WRITE_HEADERS);
}

export var config = {
    path: "/.netlify/functions/track",
};
