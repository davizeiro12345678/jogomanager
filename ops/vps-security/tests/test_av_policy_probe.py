import importlib.util
import unittest
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

if __name__=="__main__":unittest.main()
