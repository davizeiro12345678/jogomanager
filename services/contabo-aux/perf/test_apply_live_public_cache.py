import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location(
    "installer", Path(__file__).with_name("apply-live-public-cache.py")
)
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


def config(cached=False):
    prefix = installer.CACHE_PATH if cached else ""
    routes = []
    for route in ("clubs", "crests"):
        event_guard = '        if ($http_x_pfm_event_token) { return 400; }\n' if route == "clubs" else ""
        cache = ""
        if cached:
            cache = installer.CACHE_CONFIG.replace(
                "$jm_catalog_has_credentials", "$http_authorization $http_cookie $http_x_api_key"
            )
        routes.append(
            f'''    location = /v1/public/{route} {{
        if ($request_method != GET) {{ return 405; }}
        if ($http_authorization) {{ return 400; }}
        if ($http_cookie) {{ return 400; }}
        if ($http_x_api_key) {{ return 400; }}
{event_guard}        proxy_pass http://pfm_catalog_cache_backend;
{cache}    }}
'''
        )
    return prefix + installer.UPSTREAM + "\n}\nserver {\n" + "".join(routes) + "}\n"


class PublicCacheConfigTests(unittest.TestCase):
    def test_install_and_existing_cache_receive_same_guards(self):
        for cached in (False, True):
            with self.subTest(existing_cache=cached):
                result = installer.update_config(config(cached))
                self.assertEqual(result.count(installer.GUARD_MAP), 1)
                self.assertEqual(result.count("if ($jm_catalog_has_credentials)"), 2)
                self.assertEqual(result.count("proxy_cache_bypass $jm_catalog_has_credentials;"), 2)
                self.assertEqual(result.count("proxy_no_cache $jm_catalog_has_credentials;"), 2)
                self.assertNotIn("if ($http_authorization)", result)
                self.assertNotIn("if ($http_x_pfm_event_token)", result)
                self.assertEqual(result.count('proxy_cache_key "$scheme|$request_method|$uri|$args";'), 2)
                self.assertEqual(installer.update_config(result), result)

    def test_fail_closed_for_partial_or_unknown_configuration(self):
        incomplete = config(True).replace("        proxy_cache JMCatalogProd;\n", "", 1)
        with self.assertRaisesRegex(ValueError, "Partial catalog cache"):
            installer.update_config(incomplete)
        unknown_guard = config().replace(installer.UPSTREAM, "# $jm_catalog_has_credentials\n" + installer.UPSTREAM)
        with self.assertRaisesRegex(ValueError, "Unexpected credential guard"):
            installer.update_config(unknown_guard)


if __name__ == "__main__":
    unittest.main()
