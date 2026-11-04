from pathlib import Path
import datetime,shutil,subprocess,tempfile,os
p=Path("/etc/nginx/conf.d/pfm-catalog.conf")
before=p.read_text()
needle="    listen 443 ssl;"
if before.count(needle)!=1:
  raise RuntimeError("Unexpected Nginx public listener, no changes")
if "listen 443 ssl http2;" in before:
  print("HTTP2_ALREADY_ENABLED")
  raise SystemExit(0)
backup=p.with_name(p.name+".pre-h2-"+datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")+".bak")
shutil.copy2(p,backup)
temp=tempfile.NamedTemporaryFile(mode="w",dir=p.parent,delete=False,prefix=".jm-h2-")
try:
  temp.write(before.replace(needle,"    listen 443 ssl http2;",1))
  temp.close()
  os.chmod(temp.name,0o600)
  os.replace(temp.name,p)
  subprocess.run(["nginx","-t"],check=True)
  subprocess.run(["nginx","-s","reload"],check=True)
  print("CATALOG_HTTPS_HTTP2_ENABLED")
  print("BACKUP="+str(backup))
except BaseException:
  shutil.copy2(backup,p)
  subprocess.run(["nginx","-t"],check=False)
  subprocess.run(["nginx","-s","reload"],check=False)
  raise
