"""The full authenticated game scan MUST NOT target the synthetic staging worker."""
import unittest

from verify_zap_full_real_staging import validate_real_stage, StageNotReady

REAL = {
    "isolated": True,
    "synthetic_only": False,
    "mock": False,
    "app_deployed": True,
    "app": "jogomanager-web-staging",
    "production_access": False,
    "supabase": "staging-isolated",
    "supabase_project_ref": "test-db-ref-isolated",
    "stripe": "test",
    "multiplayer": "isolated",
}

HEADERS = {
    "x-pfm-isolated-stage": "yes",
    "x-pfm-full-game-stage": "yes",
    "x-pfm-synthetic": "false",
}

class StageReadiness(unittest.TestCase):
    def test_valid_isolated_app_staging_is_accepted(self):
        validate_real_stage("https://staging.jogomanager.com/", HEADERS, REAL)

    def test_rejects_published_mock_harness(self):
        values={**REAL, "mock":True, "synthetic_only":True, "app_deployed":False,
                "supabase":"not-connected","stripe":"not-connected","multiplayer":"not-connected"}
        with self.assertRaises(StageNotReady):
            validate_real_stage("https://staging.jogomanager.com/", HEADERS, values)

    def test_rejects_production_backend_references(self):
        for k,v in [("supabase_project_ref","lguqnwvsfeefxamzeyos"),
                    ("stripe","live"),("production_access",True),
                    ("multiplayer","production"),("isolated",False)]:
            with self.subTest(field=k), self.assertRaises(StageNotReady):
                validate_real_stage("https://staging.jogomanager.com/", HEADERS,{**REAL,k:v})

    def test_rejects_imposter_hosts_and_unexpected_input(self):
        for url in ["https://jogomanager.com/","http://staging.jogomanager.com/",
                    "https://staging.jogomanager.com.attacker.test/",
                    "https://staging.jogomanager.com/admin"]:
            with self.subTest(url=url),self.assertRaises(StageNotReady):
                validate_real_stage(url,HEADERS,REAL)

    def test_requires_unambiguous_staging_headers(self):
        for k,value in [
            ("x-pfm-isolated-stage", "no"),
            ("x-pfm-full-game-stage", ""),
            ("x-pfm-synthetic", "true"),
        ]:
            with self.subTest(field=k),self.assertRaises(StageNotReady):
                validate_real_stage("https://staging.jogomanager.com/",{**HEADERS,k:value},REAL)

if __name__=="__main__":
    unittest.main()
