#!/usr/bin/env python3
from concurrent.futures import ThreadPoolExecutor
import json, time, urllib.request
BASE="http://127.0.0.1:8080/v1/public/clubs?limit=1000&page="
def get_page(n):
    t=time.monotonic()
    with urllib.request.urlopen(BASE+str(n), timeout=12) as resp:
        assert resp.status==200, resp.status
        rows=json.load(resp)
        cache=resp.headers.get("X-Catalog-Cache", "UNKNOWN")
    assert len(rows)<=1000
    return n,rows,cache,(time.monotonic()-t)*1000
def scan(name):
    allrows=[]
    stats={"HIT":0,"MISS":0}
    start=time.monotonic()
    with ThreadPoolExecutor(max_workers=6) as ex:
        for batch_start in range(0, 128, 6):
            answers=list(ex.map(get_page,range(batch_start,min(batch_start+6,128))))
            short=False
            for page, rows, cache, ms in answers:
                stats[cache]=stats.get(cache,0)+1
                allrows.extend(rows)
                if len(rows)<1000:
                    short=True
                    break
            if short: break
    ids=[r["id"] for r in allrows]
    assert len(ids) == len(set(ids)), "duplicate club IDs"
    print(json.dumps({"run":name,"count":len(ids),"unique":len(set(ids)),
                       "elapsed_seconds":round(time.monotonic()-start,3),
                       "cached_pages":stats["HIT"],"upstream_pages":stats["MISS"],
                       "expected_from_sql":38854}))
scan("cold")
scan("warm")