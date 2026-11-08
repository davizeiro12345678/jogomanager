from pathlib import Path
import datetime, os, shutil, subprocess, tempfile
p=Path("/etc/nginx/conf.d/pfm-catalog.conf")
txt=p.read_text()
if "JMCatalogProd" in txt:
    print("ALREADY_INSTALLED")
    raise SystemExit(0)
header="upstream pfm_catalog_cache_backend {"
if txt.count(header)!=1: raise SystemExit("Unexpected upstream config")
for route in ("clubs","crests"):
    name=f"    location = /v1/public/{route} {{"
    if txt.count(name)!=1: raise SystemExit("Missing exact route: "+route)
txt=txt.replace(header,
    'proxy_cache_path /var/cache/nginx/jm-catalog-prod levels=1:2 keys_zone=JMCatalogProd:32m max_size=128m inactive=3m use_temp_path=off;\n\n'+header,1)
for route in ("clubs","crests"):
    start=txt.index(f"    location = /v1/public/{route} {{")
    end=txt.index("\n    }",start)+6
    segment=txt[start:end]
    needle="        proxy_pass http://pfm_catalog_cache_backend;"
    if segment.count(needle)!=1: raise SystemExit("Unexpected proxy_pass")
    security='''        if ($http_authorization) { return 400; }
        if ($http_cookie) { return 400; }
        if ($http_x_api_key) { return 400; }
        if ($http_x_pfm_event_token) { return 400; }
'''
    if "if ($http_authorization)" not in segment:
        segment=segment.replace(needle,security+needle)
    cache='''        # Anonymous public catalog only. Full query string isolates pages.
        proxy_cache JMCatalogProd;
        proxy_cache_key "$scheme|$request_method|$uri|$args";
        proxy_ignore_headers Cache-Control Expires;
        proxy_cache_valid 200 15s;
        proxy_cache_lock on;
        proxy_cache_lock_timeout 5s;
        proxy_cache_bypass $http_authorization $http_cookie $http_x_api_key;
        proxy_no_cache $http_authorization $http_cookie $http_x_api_key;
        add_header X-JM-Catalog-Cache $upstream_cache_status always;
'''
    segment=segment.replace(needle,needle+"\n"+cache.rstrip())
    old=txt[start:end]
    txt=txt.replace(old,segment,1)
directory=Path("/var/cache/nginx/jm-catalog-prod")
directory.mkdir(parents=True,exist_ok=True)
shutil.chown(directory,user="www-data",group="www-data")
directory.chmod(0o750)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup=p.with_name(p.name+".pre-public-cache-"+stamp+".bak")
shutil.copy2(p,backup)
f=tempfile.NamedTemporaryFile(mode="w",dir=p.parent,prefix=".jm-cache-",delete=False)
try:
    f.write(txt);f.close()
    os.chmod(f.name,0o600)
    os.replace(f.name,p)
    subprocess.run(["nginx","-t"],check=True)
    subprocess.run(["nginx","-s","reload"],check=True)
    print("PUBLIC_ONLY_NGINX_CACHE_ENABLED")
    print("BACKUP="+str(backup))
except BaseException:
    shutil.copy2(backup,p)
    subprocess.run(["nginx","-t"],check=False)
    subprocess.run(["nginx","-s","reload"],check=False)
    raise
