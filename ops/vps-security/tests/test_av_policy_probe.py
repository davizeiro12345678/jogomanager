import importlib.util
import unittest
import json
import io
from contextlib import redirect_stdout
from unittest.mock import patch
from pathlib import Path

p=str(Path(__file__).resolve().parents[1] / "jm-av-policy-probe.py")
spec=importlib.util.spec_from_file_location("jm_av_policy_probe",p)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def elastic(mode="prevent",on_write=True,blocklist=True):
    return {"inputs":[{"policy":{"linux":{
        "malware":{"mode":mode,"on_write_scan":on_write,"blocklist":blocklist},
        "behavior_protection":{"supported":False},
        "memory_protection":{"supported":False},
    }}}]}

BASE_CLAMD="ScanArchive true\nAlgorithmicDetection true\nPhishingSignatures true\nBytecode true\nDetectPUA false\n"
BASE_ACCESS="OnAccessPrevention yes\nOnAccessIncludePath /var/lib/jm-security-ingest\n"

class AntivirusPolicyTests(unittest.TestCase):
    def test_elastic_basic_with_prevent_and_write_scan_is_healthy(self):
        r=module.summarize_elastic(elastic())
        self.assertEqual(r["jm_state"],"ok")
        self.assertEqual(r["malware_mode"],"prevent")
        self.assertFalse(r["behavior_supported"])
        self.assertFalse(r["memory_supported"])
        self.assertNotIn("token",str(r).lower())

    def test_elastic_prevention_drift_is_detected(self):
        r=module.summarize_elastic(elastic(mode="detect",on_write=False))
        self.assertEqual(r["jm_state"],"degraded")
        self.assertFalse(r["on_write_scan"])

    def test_clamav_core_and_ingest_prevention_healthy_without_pua(self):
        r=module.summarize_clamav(BASE_CLAMD,BASE_ACCESS)
        self.assertEqual(r["jm_state"],"ok")
        self.assertFalse(r["pua_detection"])
        self.assertEqual(r["onaccess_scope"],"ingest_only")

    def test_clamav_prevention_disabled_is_detected(self):
        r=module.summarize_clamav(BASE_CLAMD,BASE_ACCESS.replace("yes","no"))
        self.assertEqual(r["jm_state"],"degraded")

    def test_extra_ingest_paths_are_drift(self):
        for path in ("/", "/home", "/var/lib/jm-security-ingest/subdir"):
            r=module.summarize_clamav(BASE_CLAMD,BASE_ACCESS+"OnAccessIncludePath "+path+"\n")
            self.assertEqual(r["jm_state"],"degraded")
            self.assertNotEqual(r["onaccess_scope"],"ingest_only")

    def test_monitor_emits_one_sanitized_json_event_per_engine(self):
        events=[module.summarize_clamav(BASE_CLAMD,BASE_ACCESS),module.summarize_elastic(elastic())]
        stdout=io.StringIO()
        with patch.object(module,"snapshots",return_value=events),redirect_stdout(stdout):
            self.assertEqual(module.main(),0)
        self.assertEqual([json.loads(line) for line in stdout.getvalue().splitlines()],events)

if __name__=="__main__":unittest.main()
