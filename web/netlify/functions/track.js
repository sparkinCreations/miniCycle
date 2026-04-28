// track.js — Netlify Function for anonymous CTA click + pageview counting
// Uses Netlify Blobs to persist counts across deploys
// No personal data is collected — only event name, count, and timestamps

import { getStore } from "@netlify/blobs";

var MAX_TIMESTAMPS = 5000; // Keep last N timestamps per event to bound blob size (~125 KB max)

var STORES = {
    click: "click-counts",
    view: "page-views",
};

async function loadStore(name) {
    var store = getStore(name);
    var blobs = await store.list();
    var out = {};
    for (var i = 0; i < blobs.blobs.length; i++) {
        var blob = blobs.blobs[i];
        var raw = await store.get(blob.key);
        try {
            var parsed = JSON.parse(raw);
            if (typeof parsed === "object" && parsed !== null && parsed.total !== undefined) {
                out[blob.key] = parsed;
            } else {
                out[blob.key] = { total: parseInt(parsed, 10) || 0, clicks: [] };
            }
        } catch {
            out[blob.key] = { total: parseInt(raw, 10) || 0, clicks: [] };
        }
    }
    return out;
}

export default async function handler(request) {
    var headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
    }

    // GET — return click counts and pageview counts
    if (request.method === "GET") {
        var url = new URL(request.url);
        var secret = url.searchParams.get("secret");

        if (secret !== process.env.TRACK_SECRET) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
                status: 401,
                headers,
            });
        }

        var events = await loadStore(STORES.click);
        var pageviews = await loadStore(STORES.view);

        return new Response(
            JSON.stringify({ events: events, pageviews: pageviews }),
            { status: 200, headers }
        );
    }

    // POST — increment a counter (click by default; type:"view" routes to pageviews)
    if (request.method === "POST") {
        var body;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ error: "invalid json" }), {
                status: 400,
                headers,
            });
        }

        var event = body.event;
        if (!event || typeof event !== "string" || event.length > 100) {
            return new Response(JSON.stringify({ error: "invalid event" }), {
                status: 400,
                headers,
            });
        }

        // Sanitize: only allow alphanumeric, hyphens, underscores
        var sanitized = event.replace(/[^a-zA-Z0-9_-]/g, "");
        if (!sanitized) {
            return new Response(JSON.stringify({ error: "invalid event" }), {
                status: 400,
                headers,
            });
        }

        var type = body.type === "view" ? "view" : "click";
        var store = getStore(STORES[type]);

        var current = await store.get(sanitized);
        var data;
        try {
            data = current ? JSON.parse(current) : { total: 0, clicks: [] };
        } catch {
            // Legacy format (plain number) — migrate
            data = { total: parseInt(current, 10) || 0, clicks: [] };
        }

        data.total += 1;
        data.clicks.push(new Date().toISOString());

        if (data.clicks.length > MAX_TIMESTAMPS) {
            data.clicks = data.clicks.slice(-MAX_TIMESTAMPS);
        }

        await store.set(sanitized, JSON.stringify(data));

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers,
    });
}

export var config = {
    path: "/.netlify/functions/track",
};
