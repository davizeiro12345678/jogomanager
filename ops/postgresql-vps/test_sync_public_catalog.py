"""Safety tests for one-way public-only Supabase catalog snapshots."""
import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import patch

module_path = Path(__file__).with_name("sync_public_catalog.py")
spec = importlib.util.spec_from_file_location("jm_public_catalog", module_path)
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)

class PublicCatalogSafetyTests(unittest.TestCase):
    def test_only_known_public_catalog_tables(self):
        self.assertEqual(set(mirror.FIELDS), {"competitions", "clubs", "players"})

    def test_private_tables_are_refused(self):
        with self.assertRaises(ValueError):
            mirror.transaction_sql("match_rooms", [])

    def test_refuse_service_role_secrets(self):
        with patch.dict(os.environ, {
            "SUPABASE_URL": mirror.PROJECT_URL,
            "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_test",
            "SUPABASE_SECRET_KEY": "must-not-use",
        }):
            with self.assertRaises(RuntimeError):
                mirror.publishable_key()

    def test_refuse_other_projects(self):
        with patch.dict(os.environ, {
            "SUPABASE_URL": "https://wrong.example",
            "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_test",
        }, clear=True):
            with self.assertRaises(RuntimeError):
                mirror.publishable_key()

    def test_transactional_copy_and_shrink_guard(self):
        sql = mirror.transaction_sql("competitions", [
            {"id": "sample", "name": 'A "quoted" league',
             "updated_at": "2026-11-12T00:00:00Z"}
        ])
        self.assertIn("BEGIN;", sql)
        self.assertIn("COMMIT;", sql)
        self.assertIn("COPY mirror_stage", sql)
        self.assertIn("ON CONFLICT (kind,id)", sql)
        self.assertIn("Refusing catalog shrink", sql)
        self.assertIn("A ", sql)
        self.assertIn("\\.", sql)

if __name__ == "__main__":
    unittest.main()
