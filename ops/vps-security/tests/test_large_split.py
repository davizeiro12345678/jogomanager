import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = str(Path(__file__).resolve().parents[1] / "jm-security-large-split.py")
spec = importlib.util.spec_from_file_location("jm_security_large_split", MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class CoverageTests(unittest.TestCase):
    def test_exact_cover_and_safe_fallback(self):
        with tempfile.TemporaryDirectory() as temp:
            d=Path(temp)
            (d/"elf").write_bytes(b"\x7fELF" + b"xxx")
            (d/"model.gguf").write_bytes(b"GGUF" + b"yyyy")
            (d/"weights.safetensors").write_bytes((2).to_bytes(8, "little") + b"{}" + b"data")
            (d/"archive.zip").write_bytes(b"PK\x03\x04" + b"zip")
            (d/"uncertain").write_bytes(b"uncertain")
            (d/"symlink").symlink_to(d/"elf")
            files=[d/name for name in ("elf","model.gguf","weights.safetensors","archive.zip","uncertain","symlink")]
            original=d/"original.txt"
            original.write_bytes(b"".join(str(p).encode()+b"\n" for p in files))
            daemon=d/"shared.txt";deep=d/"deep.txt"
            stats=module.split(original,daemon,deep)
            first=daemon.read_bytes().splitlines();second=deep.read_bytes().splitlines()
            self.assertEqual(stats, {"shared_daemon":3,"deep_fallback":3,"total":6})
            self.assertEqual(first+second, [str(p).encode() for p in files[:3]]+[str(p).encode() for p in files[3:]])
            self.assertTrue(all(not x.endswith(b"archive.zip") for x in first))
            self.assertTrue(all(not x.endswith(b"symlink") for x in first))
            self.assertEqual(daemon.stat().st_mode & 0o777,0o600)
            self.assertEqual(deep.stat().st_mode & 0o777,0o600)

    def test_relative_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            d=Path(temp);f=d/"files";f.write_text("relative/path\n")
            with self.assertRaises(ValueError):module.split(f,d/"shared",d/"deep")

if __name__ == "__main__":unittest.main()
