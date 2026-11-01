#!/usr/bin/env python3
"""One-time local Spotify OAuth setup. Never run this in CI or commit printed secrets."""
import base64
import http.server
import os
import secrets
import urllib.parse
import urllib.request
import webbrowser
import json

HOST = "127.0.0.1"
PORT = 8765
REDIRECT = f"http://{HOST}:{PORT}/callback"
SCOPE = "user-read-currently-playing"


def main():
    client_id = os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip()
    if not (client_id and client_secret):
        raise SystemExit("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your local shell first.")
    state = secrets.token_urlsafe(24)
    query = urllib.parse.urlencode({
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": REDIRECT,
        "scope": SCOPE,
        "state": state,
        "show_dialog": "true"
    })
    url = "https://accounts.spotify.com/authorize?" + query
    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            parts = urllib.parse.urlsplit(self.path)
            if parts.path != "/callback":
                self.send_error(404)
                return
            values = urllib.parse.parse_qs(parts.query)
            if values.get("state", [""])[0] != state:
                result["error"] = "OAuth state mismatch"
                self.send_error(403)
                return
            if "error" in values:
                result["error"] = values["error"][0]
            elif "code" in values:
                result["code"] = values["code"][0]
            else:
                result["error"] = "Missing authorization code"
            body = b"Authorization received. You can close this tab and return to your terminal."
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format, *args):
            pass

    print("Opening Spotify authorization. If it doesn't open, visit:\n" + url)
    print("Waiting for redirect on " + REDIRECT)
    with http.server.HTTPServer((HOST, PORT), Handler) as server:
        server.timeout = 180
        webbrowser.open(url)
        server.handle_request()

    if "code" not in result:
        raise SystemExit("Authorization failed or timed out: " + result.get("error", "No callback received"))
    auth = base64.b64encode((client_id + ":" + client_secret).encode()).decode()
    form = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": result["code"],
        "redirect_uri": REDIRECT
    }).encode()
    request = urllib.request.Request("https://accounts.spotify.com/api/token", data=form, headers={
        "Authorization": "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded"
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        tokens = json.load(response)
    token = tokens.get("refresh_token")
    if not token:
        raise SystemExit("Spotify did not return a refresh token. Revoke app access and retry.")
    print("\nSAVE THE FOLLOWING VALUE IN GITHUB ACTIONS SECRET SPOTIFY_REFRESH_TOKEN.")
    print("DO NOT paste it into issues, PRs, chat, or repository files.")
    print("\n" + token + "\n")


if __name__ == "__main__":
    main()
