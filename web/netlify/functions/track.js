// track.js — Netlify Function for anonymous CTA click counting
// Uses Netlify Blobs to persist counts across deploys
// No personal data is collected — only event name, count, and timestamps

import { getStore } from "@netlify/blobs";

var MAX_TIMESTAMPS = 500; // Keep last 500 clicks per event to prevent unbounded growth

export default async function handler(request) {
    // CORS headers
    var headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
    }

    var store = getStore("click-counts");

    // GET — return all counts (for you to check)
    if (request.method === "GET") {
        var url = new URL(request.url);
        var secret = url.searchParams.get("secret");

        // Simple secret to prevent public access to counts
        if (secret !== process.env.TRACK_SECRET) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
                status: 401,
                headers,
            });
        }

        var blobs = await store.list();
        var events = {};
        for (var i = 0; i < blobs.blobs.length; i++) {
            var blob = blobs.blobs[i];
            var raw = await store.get(blob.key);
            try {
                var parsed = JSON.parse(raw);
                events[blob.key] = parsed;
            } catch {
                // Legacy format (plain number) — migrate
                events[blob.key] = { total: parseInt(raw, 10) || 0, clicks: [] };
            }
        }

        return new Response(JSON.stringify({ events: events }), { status: 200, headers });
    }

    // POST — increment a counter
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

        // Read current data, add timestamp, increment count
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

        // Trim to last MAX_TIMESTAMPS to prevent unbounded growth
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
