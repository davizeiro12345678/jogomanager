"""Copy verified public KTX2 textures into the anonymous Studio preview."""

import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import NamedTemporaryFile
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, build_opener
from uuid import UUID

ORIGIN = "https://jogomanager.com"
ASSET_HOSTS = {"jogomanager.com", "football-manager.app"}
KTX2 = b"\xabKTX 20\xbb\r\n\x1a\n"
# QA textures total under 5 MiB in the current catalogue. Bound each
# untrusted manifest and response before allocating or contacting the CDN.
MAX_MANIFEST_BYTES = 64 * 1024
MAX_TEXTURE_BYTES = 16 * 1024 * 1024


class PublicAssetRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url = urlsplit(newurl)
        if (
            url.scheme != "https"
            or url.netloc not in ASSET_HOSTS
            or url.path != urlsplit(req.full_url).path
            or url.query
            or url.fragment
        ):
            raise ValueError("Unexpected redirect for a public Studio texture")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def prepare_texture(entry):
    mode, kind, oid, manifest = entry.split()
    valid_name = re.fullmatch(r"[a-z0-9_-]+\.ktx2\.asset\.json", manifest)
    if (
        mode != "100644"
        or kind != "blob"
        or not re.fullmatch(r"[0-9a-f]{40}", oid)
        or not valid_name
    ):
        raise ValueError("Invalid committed Studio texture manifest")
    blob_size = int(subprocess.check_output(["git", "cat-file", "-s", oid]))
    if not 0 < blob_size <= MAX_MANIFEST_BYTES:
        raise ValueError(f"Invalid committed manifest size for {manifest}")
    data = json.loads(subprocess.check_output(["git", "cat-file", "blob", oid]))
    filename = manifest.removesuffix(".asset.json")
    path = f"/__l5e/assets-v1/{UUID(data['asset_id'])}/{filename}"
    size = data["size"]
    if data["url"] != path or type(size) is not int or not len(KTX2) <= size <= MAX_TEXTURE_BYTES:
        raise ValueError(f"Invalid URL or size for {manifest}")

    # This client has no cookie jar, auth handlers or incoming browser headers.
    opener = build_opener(PublicAssetRedirect())
    for attempt in range(3):
        try:
            with opener.open(ORIGIN + path, timeout=30) as response:
                payload = response.read(size + 1)
            break
        except (URLError, TimeoutError) as error:
            if attempt == 2 or (isinstance(error, HTTPError) and 400 <= error.code < 500):
                if isinstance(error, HTTPError):
                    host = urlsplit(error.url).hostname or "unknown"
                    raise RuntimeError(
                        f"Public Studio texture {filename}: HTTP {error.code} from {host}"
                    ) from None
                raise
            sleep(attempt + 1)
    if not payload.startswith(KTX2) or len(payload) != size:
        raise ValueError(f"KTX2 signature or size mismatch for {filename}")
    target = Path.cwd() / "dist-benchmark" / path.lstrip("/")
    if target.resolve() != target:
        raise ValueError("Studio texture destination contains a symbolic link")
    target.parent.mkdir(parents=True, exist_ok=True)
    temp_path = None
    try:
        with NamedTemporaryFile(dir=target.parent, delete=False) as temp:
            temp_path = Path(temp.name)
            temp.write(payload)
        temp_path.replace(target)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
    return len(payload)


if __name__ == "__main__":
    entries = subprocess.check_output(
        ["git", "ls-tree", "HEAD:src/assets/textures"], text=True
    ).splitlines()
    manifests = [entry for entry in entries if entry.endswith(".ktx2.asset.json")]
    if not manifests:
        raise ValueError("No committed Studio texture manifests")
    with ThreadPoolExecutor(max_workers=6) as pool:
        sizes = list(pool.map(prepare_texture, manifests))
    print(f"Verified {len(sizes)} public KTX2 textures ({sum(sizes)} bytes).")
