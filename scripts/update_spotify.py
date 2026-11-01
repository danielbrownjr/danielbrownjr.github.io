#!/usr/bin/env python3
"""Publish a minimal public Spotify snapshot. Credentials only via GitHub Actions secrets."""
import base64
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

OUT = pathlib.Path("data/spotify.json")


def post_form(url, fields, headers=None):
    data = urllib.parse.urlencode(fields).encode("ascii")
    request = urllib.request.Request(url, data=data, headers=headers or {}, method="POST")
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def get_currently_playing(token):
    request = urllib.request.Request(
        "https://api.spotify.com/v1/me/player/currently-playing",
        headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status == 204:
                return None
            return json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 204:
            return None
        raise


def snapshot(data):
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    result = {"schema": 1, "updated_at": timestamp, "is_playing": False, "track": None}
    if not isinstance(data, dict) or not data.get("is_playing"):
        return result
    item = data.get("item")
    if not isinstance(item, dict) or item.get("type") != "track":
        return result
    url = item.get("external_urls", {}).get("spotify", "")
    if not isinstance(url, str) or not url.startswith("https://open.spotify.com/track/"):
        return result
    album = item.get("album") or {}
    images = album.get("images") or []
    image = next((i.get("url") for i in images if isinstance(i, dict) and isinstance(i.get("url"), str)), None)
    if image and not image.startswith(("https://i.scdn.co/", "https://image-cdn-ak.spotifycdn.com/")):
        image = None
    artists = item.get("artists") or []
    names = [a.get("name") for a in artists if isinstance(a, dict) and isinstance(a.get("name"), str)]
    result["is_playing"] = True
    result["track"] = {
        "title": str(item.get("name") or "Unknown track")[:180],
        "artist": ", ".join(names)[:240] or "Unknown artist",
        "album": str(album.get("name") or "")[:180],
        "url": url,
        "image": image,
    }
    return result


def main():
    client_id = os.environ.get("SPOTIFY_CLIENT_ID")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    refresh_token = os.environ.get("SPOTIFY_REFRESH_TOKEN")
    if not all((client_id, client_secret, refresh_token)):
        print("Spotify secrets not configured; skipping snapshot.")
        return 0
    credentials = base64.b64encode((client_id + ":" + client_secret).encode()).decode("ascii")
    try:
        response = post_form(
            "https://accounts.spotify.com/api/token",
            {"grant_type": "refresh_token", "refresh_token": refresh_token},
            {"Authorization": "Basic " + credentials, "Content-Type": "application/x-www-form-urlencoded"},
        )
        access_token = response["access_token"]
        track_data = get_currently_playing(access_token)
        result = snapshot(track_data)
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("Spotify public snapshot updated: " + ("playing" if result["is_playing"] else "idle"))
        return 0
    except (urllib.error.URLError, ValueError, KeyError, OSError) as error:
        print("Spotify update failed (" + type(error).__name__ + "); keeping prior snapshot.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
