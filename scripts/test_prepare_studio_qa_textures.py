"""Network-free regression tests for the Studio texture preparation contract."""
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location(
    "studio_textures", Path(__file__).with_name("prepare-studio-qa-textures.py")
)
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)
OID = "a" * 40
MANIFEST = "boot_normal.ktx2.asset.json"
ENTRY = f"100644 blob {OID} {MANIFEST}"
PATH = "/__l5e/assets-v1/3e1371c0-3ef9-4a6c-82ce-927e39ad5b0e/boot_normal.ktx2"
PAYLOAD = studio.KTX2 + b"fixture"


class StudioTexturesTests(unittest.TestCase):
    def manifest(self, size=len(PAYLOAD), blob_size=None):
        data = json.dumps({
            "asset_id": "3e1371c0-3ef9-4a6c-82ce-927e39ad5b0e",
            "size": size,
            "url": PATH,
        }).encode()
        return patch.object(
            studio.subprocess, "check_output",
            side_effect=lambda args: str(blob_size if blob_size is not None else len(data)).encode()
            if "-s" in args else data,
        )

    def test_oversized_texture_is_rejected_before_network(self):
        with self.manifest(size=16 * 1024 * 1024 + 1), patch.object(studio, "build_opener") as opener:
            with self.assertRaisesRegex(ValueError, "Invalid URL or size"):
                studio.prepare_texture(ENTRY)
            opener.assert_not_called()

    def test_oversized_manifest_rejected_before_blob_read(self):
        with self.manifest(blob_size=65537) as git, patch.object(studio, "build_opener") as opener:
            with self.assertRaisesRegex(ValueError, "manifest size"):
                studio.prepare_texture(ENTRY)
            self.assertEqual(git.call_count, 1)
            opener.assert_not_called()

    def test_invalid_oid_never_reaches_git(self):
        with self.manifest() as git, patch.object(studio, "build_opener") as opener:
            opener.side_effect = AssertionError("unexpected network initialization")
            with self.assertRaisesRegex(ValueError, "Invalid committed"):
                studio.prepare_texture(ENTRY.replace(OID, "--help"))
            git.assert_not_called()

    def test_403_identifies_asset_and_host_without_retry(self):
        opener = Mock()
        opener.open.side_effect = HTTPError("https://football-manager.app" + PATH, 403, "Forbidden", {}, None)
        with self.manifest(), patch.object(studio, "build_opener", return_value=opener):
            with self.assertRaisesRegex(RuntimeError, "boot_normal.ktx2: HTTP 403 from football-manager.app"):
                studio.prepare_texture(ENTRY)
            self.assertEqual(opener.open.call_count, 1)

    def test_valid_texture_is_written_exactly(self):
        opener = Mock()
        opener.open.return_value.__enter__ = Mock(return_value=Mock(read=Mock(return_value=PAYLOAD)))
        opener.open.return_value.__exit__ = Mock(return_value=False)
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                with self.manifest(), patch.object(studio, "build_opener", return_value=opener):
                    self.assertEqual(studio.prepare_texture(ENTRY), len(PAYLOAD))
                self.assertEqual((Path("dist-benchmark") / PATH.lstrip("/")).read_bytes(), PAYLOAD)
            finally:
                os.chdir(previous)


if __name__ == "__main__":
    unittest.main()
