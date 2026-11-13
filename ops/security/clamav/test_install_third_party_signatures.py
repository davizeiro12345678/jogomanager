"""Offline safety checks for the pinned ClamAV third-party updater deployment."""
import importlib.util
import unittest
from pathlib import Path

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("clamav_signatures", here / "install-third-party-signatures.py")
clamav = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clamav)

class SignatureDeploymentTests(unittest.TestCase):
    def test_git_blob_hash_known_value(self):
        self.assertEqual(clamav.git_blob_sha(b"hello\n"), "ce013625030ba8dba906f756967f9e9ca394464a")

    def test_updater_is_pinned(self):
        self.assertEqual(clamav.TAG, "8.0.0")
        self.assertEqual(set(clamav.SOURCES), {"clamav-unofficial-sigs.sh","master.conf","os.conf"})
        self.assertTrue(all(len(sha)==40 for path,sha in clamav.SOURCES.values()))

    def test_exactly_three_extra_sources_enabled(self):
        conf = clamav.USER_CONF
        for setting in ("ditekshen_enabled", "twinclams_enabled", "linuxmalwaredetect_enabled"):
            self.assertIn(setting + '="yes"', conf)
        for setting in ("sanesecurity_enabled", "interserver_enabled", "malwareexpert_enabled", "malwarepatrol_enabled", "securiteinfo_enabled"):
            self.assertIn(setting + '="no"', conf)

    def test_no_remote_management_false_positives(self):
        self.assertNotIn("declare -a ditekshen_dbs=", clamav.USER_CONF)
        self.assertNotIn("indicator_rmm.ldb|MEDIUM", clamav.USER_CONF)
        patched = clamav.patched_master(
            b"indicator_rmm.ldb|MEDIUM # detects remote monitoring and management tooling"
        )
        self.assertIn(b"# indicator_rmm.ldb|MEDIUM", patched)
        self.assertNotIn(b"\nindicator_rmm.ldb|MEDIUM", patched)

    def test_no_autodelete_or_self_upgrade(self):
        conf = clamav.USER_CONF
        for item in ('remove_disabled_databases="no"', 'allow_upgrades="no"', 'enable_yararules="no"', 'user_configuration_complete="yes"'):
            self.assertIn(item, conf)
        self.assertNotIn("--remove", clamav.UPDATER.as_posix())

if __name__ == "__main__":
    unittest.main()
