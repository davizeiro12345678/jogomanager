"""Install or upgrade the anonymous Nginx catalog cache, with rollback."""

from pathlib import Path
import datetime
import os
import shutil
import subprocess
import tempfile


CONFIG = Path("/etc/nginx/conf.d/pfm-catalog.conf")
UPSTREAM = "upstream pfm_catalog_cache_backend {"
CACHE_PATH = (
    "proxy_cache_path /var/cache/nginx/jm-catalog-prod levels=1:2 "
    "keys_zone=JMCatalogProd:32m max_size=128m inactive=3m use_temp_path=off;\n\n"
)
GUARD_MAP = '''# Match all non-empty credential values, including Nginx false string "0".
map "$http_authorization|$http_cookie|$http_x_api_key|$http_x_pfm_event_token" $jm_catalog_has_credentials {
    "|||" 0;
    default 1;
}

'''
CACHE_CONFIG = '''        # Anonymous public catalog only. Full query string isolates pages.
        proxy_cache JMCatalogProd;
        proxy_cache_key "$scheme|$request_method|$uri|$args";
        proxy_ignore_headers Cache-Control Expires;
        proxy_cache_valid 200 15s;
        proxy_cache_lock on;
        proxy_cache_lock_timeout 5s;
        proxy_cache_bypass $jm_catalog_has_credentials;
        proxy_no_cache $jm_catalog_has_credentials;
        add_header X-JM-Catalog-Cache $upstream_cache_status always;
'''


def require(condition, message):
    if not condition:
        raise ValueError(message)


def update_config(text):
    """Return a complete config, refusing ambiguous or partial installations."""
    require(text.count(UPSTREAM) == 1, "Unexpected upstream config")
    already_cached = "JMCatalogProd" in text
    if not already_cached:
        text = text.replace(UPSTREAM, CACHE_PATH + UPSTREAM, 1)
    if GUARD_MAP not in text:
        require("$jm_catalog_has_credentials" not in text, "Unexpected credential guard")
        text = text.replace(UPSTREAM, GUARD_MAP + UPSTREAM, 1)
    require(text.count(GUARD_MAP) == 1, "Duplicate credential guard")

    for route in ("clubs", "crests"):
        location = f"    location = /v1/public/{route} {{"
        require(text.count(location) == 1, "Missing exact route: " + route)
        start = text.index(location)
        end = text.index("\n    }", start) + 6
        segment = text[start:end]
        proxy = "        proxy_pass http://pfm_catalog_cache_backend;"
        require(segment.count(proxy) == 1, "Unexpected proxy_pass: " + route)
        method = "        if ($request_method != GET) { return 405; }\n"
        require(segment.count(method) == 1, "Unexpected method guard: " + route)

        # The old guard could omit the event token and treats "0" as false.
        for field in ("authorization", "cookie", "x_api_key", "x_pfm_event_token"):
            guard = f"        if ($http_{field}) {{ return 400; }}\n"
            require(segment.count(guard) <= 1, "Duplicate old credential guard")
            segment = segment.replace(guard, "")
        guard = "        if ($jm_catalog_has_credentials) { return 400; }\n"
        require(segment.count(guard) <= 1, "Duplicate credential guard")
        if guard not in segment:
            segment = segment.replace(method, method + guard, 1)

        cache_directive = "        proxy_cache JMCatalogProd;"
        if not already_cached:
            require("proxy_cache " not in segment, "Unexpected existing route cache")
            segment = segment.replace(proxy, proxy + "\n" + CACHE_CONFIG.rstrip(), 1)
        else:
            require(segment.count(cache_directive) == 1, "Partial catalog cache")
            for directive in ("proxy_cache_bypass", "proxy_no_cache"):
                old = f"        {directive} $http_authorization $http_cookie $http_x_api_key;"
                new = f"        {directive} $jm_catalog_has_credentials;"
                require(segment.count(old) + segment.count(new) == 1, "Unexpected " + directive)
                segment = segment.replace(old, new)
        text = text[:start] + segment + text[end:]
    return text


def main():
    old = CONFIG.read_text()
    new = update_config(old)
    if old == new:
        print("ALREADY_INSTALLED_AND_PROTECTED")
        return
    directory = Path("/var/cache/nginx/jm-catalog-prod")
    directory.mkdir(parents=True, exist_ok=True)
    shutil.chown(directory, user="www-data", group="www-data")
    directory.chmod(0o750)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = CONFIG.with_name(CONFIG.name + ".pre-public-cache-" + stamp + ".bak")
    shutil.copy2(CONFIG, backup)
    info = CONFIG.stat()
    fd, name = tempfile.mkstemp(dir=CONFIG.parent, prefix=".jm-cache-")
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(new)
        os.chmod(name, info.st_mode & 0o7777)
        os.chown(name, info.st_uid, info.st_gid)
        require(CONFIG.read_text() == old, "Config changed concurrently; aborted")
        os.replace(name, CONFIG)
        subprocess.run(["nginx", "-t"], check=True)
        subprocess.run(["nginx", "-s", "reload"], check=True)
        print("PUBLIC_ONLY_NGINX_CACHE_PROTECTED")
        print("BACKUP=" + str(backup))
    except BaseException:
        # Never overwrite someone else's concurrent change when rolling back.
        if CONFIG.read_text() == new:
            shutil.copy2(backup, CONFIG)
            subprocess.run(["nginx", "-t"], check=False)
            subprocess.run(["nginx", "-s", "reload"], check=False)
        raise
    finally:
        if os.path.exists(name):
            os.unlink(name)


if __name__ == "__main__":
    main()
