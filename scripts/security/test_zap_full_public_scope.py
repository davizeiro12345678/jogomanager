"""Regression tests for the production public-only full-ZAP scan scope."""
import pathlib
import re
import runpy
import unittest

POLICY = runpy.run_path(str(pathlib.Path(__file__).with_name("zap-full-public-hook.py")))
LOCAL = re.compile(POLICY["EXCLUDE_LOCAL"])
EXTERNAL = re.compile(POLICY["EXCLUDE_EXTERNAL"])

class TestPublicOnlyZAPFullScope(unittest.TestCase):
    def test_only_safe_public_routes_allowed(self):
        urls = [
            "https://jogomanager.com/",
            "https://jogomanager.com/jogo-de-manager-de-futebol",
            "https://jogomanager.com/modo-carreira-de-jogador",
            "https://jogomanager.com/robots.txt",
            "https://jogomanager.com/sitemap.xml",
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertIsNone(LOCAL.search(url))
                self.assertIsNone(EXTERNAL.search(url))

    def test_private_and_state_changing_paths_denied(self):
        for path in (
            "auth",
            "api/auth/login",
            "api/payments",
            "serverfn",
            "_serverfn/api",
            "dashboard",
            "checkout",
            "multiplayer",
            "mcp",
            "admin",
            "new",
            ".env",
            "jogo-de-manager-de-futebol?redirect=/api/admin",
        ):
            url = "https://jogomanager.com/" + path
            with self.subTest(url=url):
                self.assertIsNotNone(LOCAL.search(url))

    def test_third_party_hosts_denied(self):
        for url in (
            "https://evil.example/",
            "https://www.jogomanager.com/",
            "https://jogomanager.com.attacker.example/",
            "http://evil.example/api",
        ):
            with self.subTest(url=url):
                self.assertIsNotNone(EXTERNAL.search(url))

if __name__ == "__main__":
    unittest.main()
