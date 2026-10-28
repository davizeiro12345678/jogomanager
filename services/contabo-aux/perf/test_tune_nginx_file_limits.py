import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location(
    "tuner", Path(__file__).with_name("tune-nginx-file-limits.py")
)
tuner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tuner)


class NginxFileLimitTests(unittest.TestCase):
    def test_adds_limit_once_and_keeps_existing_larger_limit(self):
        original = "user www-data;\nworker_processes auto;\nevents { worker_connections 4096; }\n"
        result = tuner.update_config(original)
        self.assertIn("worker_rlimit_nofile 65535;", result)
        self.assertEqual(tuner.update_config(result), result)
        higher = original.replace("worker_processes auto;", "worker_processes auto;\nworker_rlimit_nofile 131072;")
        self.assertEqual(tuner.update_config(higher), higher)

    def test_fails_closed_on_unexpected_existing_configuration(self):
        with self.assertRaisesRegex(ValueError, "manual review"):
            tuner.update_config("worker_processes auto;\nworker_rlimit_nofile 1024;\n")
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            tuner.update_config("worker_processes 4;\n")


if __name__ == "__main__":
    unittest.main()
