"use strict";
(() => {
  const panel = document.getElementById("spotify-now-playing");
  if (!panel) return;
  const state = document.getElementById("spotify-state");
  const title = document.getElementById("spotify-title");
  const artist = document.getElementById("spotify-artist");
  const album = document.getElementById("spotify-album");
  const cover = document.getElementById("spotify-cover");
  const art = document.getElementById("spotify-art");
  const link = document.getElementById("spotify-track-link");
  const caption = document.getElementById("spotify-caption");
  const staleAfterMs = 12 * 60 * 1000;
  const setText = (el, value) => { el.textContent = value; };

  function reset(message, detail) {
    panel.dataset.state = "idle";
    setText(state, "STANDBY");
    setText(title, message);
    setText(artist, detail);
    setText(album, "");
    setText(caption, "Spotify status is refreshed by GitHub Actions, not streamed live.");
    art.hidden = true;
    art.removeAttribute("src");
    cover.textContent = "♫";
    cover.append(art);
    link.hidden = true;
    link.removeAttribute("href");
  }

  function safeTrackLink(url) {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && u.hostname === "open.spotify.com" && /^\/track\/[A-Za-z0-9]+$/.test(u.pathname);
    } catch {
      return false;
    }
  }

  function safeImage(url) {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && ["i.scdn.co", "image-cdn-ak.spotifycdn.com"].includes(u.hostname);
    } catch {
      return false;
    }
  }

  async function load() {
    try {
      const response = await fetch("data/spotify.json?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" });
      if (!response.ok) throw new Error("Spotify snapshot unavailable");
      const data = await response.json();
      if (!data || data.schema !== 1 || typeof data.updated_at !== "string") throw new Error("Invalid status");
      const captured = Date.parse(data.updated_at);
      if (!Number.isFinite(captured) || captured > Date.now() + 60000 || Date.now() - captured > staleAfterMs) {
        reset("Signal out of range", "Last Spotify update is unavailable or too old.");
        setText(caption, "No stale playback information will be presented as live.");
        return;
      }
      const updated = new Date(captured).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      if (!data.is_playing || !data.track || typeof data.track.title !== "string" || !safeTrackLink(data.track.url)) {
        reset("Nothing on the turntable", "Daniel isn't currently playing a track, or Spotify has no report.");
        setText(caption, "Last checked " + updated + " · Playback status is approximate.");
        return;
      }
      panel.dataset.state = "playing";
      setText(state, "NOW PLAYING");
      setText(title, data.track.title.slice(0, 180));
      setText(artist, String(data.track.artist || "Unknown artist").slice(0, 240));
      setText(album, String(data.track.album || "").slice(0, 180));
      cover.textContent = "♫";
      if (safeImage(data.track.image)) {
        art.src = data.track.image;
        art.alt = "Album artwork";
        art.hidden = false;
        cover.append(art);
      }
      link.href = data.track.url;
      link.hidden = false;
      setText(caption, "Spotify reported playback at " + updated + ". May lag by several minutes.");
    } catch {
      reset("Waiting for Spotify", "Listening status hasn't been connected yet, or can't be fetched.");
      setText(caption, "To connect, follow the Spotify setup instructions in the site repository.");
    }
  }
  reset("Checking the signal…", "Reading the latest Spotify snapshot.");
  load();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  window.setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
