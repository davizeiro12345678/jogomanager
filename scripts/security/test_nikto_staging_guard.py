"""Regression guard for the isolated Nikto manual DAST workflow."""
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github" / "workflows" / "security-nikto-active-staging.yml"


class NiktoStagingGuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contents = WORKFLOW.read_text(encoding="utf-8")

    def test_manual_only_and_environment_protected(self):
        self.assertIn("workflow_dispatch:", self.contents)
        self.assertIn("environment: security-staging", self.contents)
        self.assertNotIn("schedule:", self.contents)

    def test_exact_staging_scope(self):
        self.assertIn('target == "https://staging.jogomanager.com/"', self.contents)
        self.assertIn('url.username is None and url.password is None', self.contents)

    def test_real_game_attestation_precedes_active_scanner(self):
        policy = self.contents.index('python3 scripts/security/verify_zap_full_real_staging.py')
        active = self.contents.index('docker run --rm')
        self.assertLess(policy, active)
        self.assertIn("test_verify_zap_full_real_staging.py", self.contents)

    def test_dependencies_pinned_and_scan_bounded(self):
        self.assertIn(
            "ghcr.io/sullo/nikto@sha256:2ea1d2107af52638445807059f8ae2877b9fb8aed7792771dd1dc1d31c5016dd",
            self.contents,
        )
        self.assertIn("actions/checkout@11d5960a326750d5838078e36cf38b85af677262", self.contents)
        self.assertIn("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02", self.contents)
        self.assertIn("-maxtime 10m", self.contents)
        self.assertIn("--cap-drop=ALL", self.contents)

if __name__ == "__main__":
    unittest.main()
