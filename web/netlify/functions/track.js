// track.js — Netlify Function for anonymous CTA click counting
// Uses Netlify Blobs to persist counts across deploys
// No personal data is collected — only event name + count

import { getStore } from "@netlify/blobs";

export default async function handler(request, context) {
    // CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
    }

    const store = getStore("click-counts");

    // GET — return all counts (for you to check)
    if (request.method === "GET") {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret");

        // Simple secret to prevent public access to counts
        if (secret !== process.env.TRACK_SECRET) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
                status: 401,
                headers,
            });
        }

        const { blobs } = await store.list();
        const counts = {};
        for (const blob of blobs) {
            const value = await store.get(blob.key);
            counts[blob.key] = parseInt(value, 10) || 0;
        }

        return new Response(JSON.stringify({ counts }), { status: 200, headers });
    }

    // POST — increment a counter
    if (request.method === "POST") {
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ error: "invalid json" }), {
                status: 400,
                headers,
            });
        }

        const event = body.event;
        if (!event || typeof event !== "string" || event.length > 100) {
            return new Response(JSON.stringify({ error: "invalid event" }), {
                status: 400,
                headers,
            });
        }

        // Sanitize: only allow alphanumeric, hyphens, underscores
        const sanitized = event.replace(/[^a-zA-Z0-9_-]/g, "");
        if (!sanitized) {
            return new Response(JSON.stringify({ error: "invalid event" }), {
                status: 400,
                headers,
            });
        }

        // Read current count, increment, write back
        const current = await store.get(sanitized);
        const count = (parseInt(current, 10) || 0) + 1;
        await store.set(sanitized, count.toString());

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers,
    });
}

export const config = {
    path: "/.netlify/functions/track",
};
