# Spotify Now Playing for DB://LAB

The Live Workbench has a Spotify instrument. It is **off by default** until the owner authorizes it.

## Architecture and privacy

- GitHub Actions calls Spotify using secrets. The credentials and tokens are **never** sent to the browser or written to a repository file.
- Every scheduled run creates a short-lived `data/spotify.json` inside the GitHub Actions workspace and deploys the site as a GitHub Pages **artifact**. The JSON is **never committed to Git history**.
- The website only receives a track title, artist, album, cover URL, Spotify track URL, playing flag, and snapshot timestamp. No device information, account ID, playback history, or secret is published.
- **Your current music is public** while it is playing. Anyone can visit or archive the page, so do not connect this feature if you want private listening. The static site does not retain a historical feed.
- If updates are delayed more than 12 minutes, the browser stops labeling the last track as playing. GitHub Actions cron timing is best-effort, not guaranteed every five minutes.
- The widget shows a safe, unconnected standby state until the setup below is completed.

## One-time setup

1. In [Spotify for Developers](https://developer.spotify.com/dashboard), create or use an app you control. For Development Mode, the owner needs Spotify Premium under the current Spotify rules. Add **exactly** this redirect URI to the app: `http://127.0.0.1:8765/callback`.
2. On your own computer, open a shell in a local checkout of the site. Set these as **local environment variables** (do not put them into Git, a chat, a screenshot, or a shared shell history):

   ```sh
   export SPOTIFY_CLIENT_ID="your-app-client-id"
   export SPOTIFY_CLIENT_SECRET="your-app-client-secret"
   python3 scripts/authorize_spotify.py
   ```

   The script opens Spotify's consent screen for the read-only `user-read-currently-playing` scope. After logging in, it prints a refresh token once. Keep it private. If your existing Spotify app has consent for the same scope, you may reuse its credentials instead.
3. In this repository, open **Settings → Secrets and variables → Actions → New repository secret**. Add:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REFRESH_TOKEN`

   Never paste token values into a public issue, pull request, source file, or this document. Refresh tokens may be rotated or revoked by Spotify. Update the secret if Spotify invalidates the old token.
4. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**. This switch is required because we deliberately do **not** commit track snapshots. Confirm the production site still deploys from the workflow.
5. Open **Actions → Publish DB Lab (Spotify) → Run workflow** to verify the initial deployment. You can then visit the <https://danielbrownjr.github.io/#live-workbench> page. With Spotify playing a track, the widget should show it after the workflow completes; when idle it should say standby.
6. If the workflow fails, inspect its status in Actions. The script intentionally avoids printing credentials and does not overwrite a valid snapshot on Spotify API failure.

### Disable the feature

Remove the three repository secrets or remove its scheduled workflow. Once a new Pages artifact is deployed without a snapshot, the widget returns to standby. Revoke the application's access in Spotify Account → Apps if you want to revoke access entirely.

## Local tests

```sh
python3 -m unittest discover -s tests -p 'test_spotify.py'
node --check resources/js/spotify.js
python3 -m py_compile scripts/update_spotify.py scripts/authorize_spotify.py
```

The test suite only uses synthetic Spotify responses and does not need real credentials.
