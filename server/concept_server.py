#!/usr/bin/env python3
"""Minimal concept-description server — serves ValIntent.json and other concept files."""

import http.server
import os

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Map URL paths to JSON files in the same directory
ROUTES = {
    "/test": "ValIntent.json",
}


class ConceptHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        filename = ROUTES.get(self.path)
        if filename is None:
            self.send_error(404, f"No route for {self.path}")
            return

        filepath = os.path.join(BASE_DIR, filename)
        if not os.path.exists(filepath):
            self.send_error(404, f"File not found: {filename}")
            return

        with open(filepath, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        print(f"[concept-server] {format % args}")


if __name__ == "__main__":
    server = http.server.HTTPServer(("", PORT), ConceptHandler)
    print(f"Concept server running on http://localhost:{PORT}")
    print(f"Routes: { {k: v for k, v in ROUTES.items()} }")
    server.serve_forever()
