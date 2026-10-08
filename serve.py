# -*- coding: utf-8 -*-
"""Servidor local del juego SIN caché: siempre sirve la última versión."""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8377
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # silencioso


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Juego en http://localhost:{PORT} (sin caché) — Ctrl+C para apagar")
        httpd.serve_forever()
