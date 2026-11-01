import importlib.util
import pathlib
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "update_spotify.py"
spec = importlib.util.spec_from_file_location("spotify_snapshot", SOURCE)
spotify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(spotify)


class SpotifySnapshotTests(unittest.TestCase):
    def test_idle_has_no_track(self):
        state = spotify.snapshot(None)
        self.assertFalse(state["is_playing"])
        self.assertIsNone(state["track"])
        self.assertEqual(state["schema"], 1)

    def test_paused_does_not_publish_last_track(self):
        state = spotify.snapshot({"is_playing": False, "item": {"name": "Private"}})
        self.assertFalse(state["is_playing"])
        self.assertIsNone(state["track"])

    def test_valid_track_maps_only_public_metadata(self):
        source = {"is_playing": True, "device": {"id": "private"}, "item": {
            "type": "track", "name": "An Example", "external_urls": {"spotify": "https://open.spotify.com/track/123ABC"},
            "artists": [{"name": "Sample Artist"}],
            "album": {"name": "An Album", "images": [{"url": "https://i.scdn.co/image/test"}]},
            "available_markets": ["US"],
        }}
        state = spotify.snapshot(source)
        self.assertTrue(state["is_playing"])
        self.assertEqual(state["track"]["artist"], "Sample Artist")
        self.assertNotIn("device", str(state))
        self.assertNotIn("available_markets", str(state))
        self.assertEqual(len(state["track"]), 5)

    def test_nontrack_media_is_not_published(self):
        state = spotify.snapshot({"is_playing": True, "item": {"type": "episode", "name": "Episode"}})
        self.assertFalse(state["is_playing"])

    def test_nonspotify_urls_are_rejected(self):
        state = spotify.snapshot({"is_playing": True, "item": {
            "type": "track", "external_urls": {"spotify": "https://example.com/sneaky"}}})
        self.assertFalse(state["is_playing"])


if __name__ == "__main__":
    unittest.main()
