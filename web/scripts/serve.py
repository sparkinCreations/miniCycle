#!/usr/bin/env python3
"""
miniCycle Development Server
============================
HTTP server with cache-busting headers for development.

This server sends cache headers that tell the browser to always check
for fresh files, eliminating the need for hard refreshes during development.

Usage:
    python3 serve.py [port]

Default port: 8080

Features:
- No-cache headers for all requests
- Clean console output
- Compatible with service worker development
- Works with update-version.sh workflow
"""

import http.server
import socketserver
import sys
from datetime import datetime

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with cache-busting headers for development."""

    # The production routes from _redirects (Nov 2026): the site root is the
    # product page and the app lives at /app. Netlify serves /app/ by the same
    # rule (it matches both spellings), so mirror that; the page fixes the slash.
    ROUTES = {'/': '/pages/product.html', '/app': '/miniCycle.html', '/app/': '/miniCycle.html'}

    def translate_path(self, path):
        clean = path.split('?', 1)[0].split('#', 1)[0]
        return super().translate_path(self.ROUTES.get(clean, path))

    def end_headers(self):
        """Add cache control headers to every response."""
        # Tell browser not to cache anything
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')

        # Allow CORS for service worker (if needed)
        self.send_header('Access-Control-Allow-Origin', '*')

        super().end_headers()

    def log_message(self, format, *args):
        """Override to provide cleaner log format."""
        timestamp = datetime.now().strftime('%H:%M:%S')
        # Only log non-favicon requests to reduce noise
        if 'favicon' not in args[0]:
            print(f"[{timestamp}] {args[0]}")

def main():
    """Start the development server."""
    # Get port from command line or use default
    PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

    # Suppress default "Serving HTTP on..." messages
    socketserver.TCPServer.allow_reuse_address = True

    try:
        with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
            print("=" * 60)
            print("🚀 miniCycle Development Server")
            print("=" * 60)
            print(f"📍 URL:      http://localhost:{PORT}")
            print(f"📁 Directory: .")
            print(f"🔧 Cache:    Disabled (no-cache headers)")
            print("=" * 60)
            print("✅ Server running - Press Ctrl+C to stop")
            print("💡 Changes will reflect on normal refresh (no hard refresh needed)")
            print()

            httpd.serve_forever()

    except KeyboardInterrupt:
        print("\n" + "=" * 60)
        print("🛑 Server stopped")
        print("=" * 60)
        sys.exit(0)

    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Error: Port {PORT} is already in use")
            print(f"💡 Try a different port: python3 serve.py 8081")
        else:
            print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
