#!/usr/bin/env python3
"""One-way public Supabase catalog -> local PostgreSQL mirror. No privileged Supabase keys."""
from __future__ import annotations
import argparse
import csv
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PROJECT_URL = "https://lguqnwvsfeefxamzeyos.supabase.co"
FIELDS = {
    "competitions": ("id", "name", "country", "tier", "club_count", "logo_url", "updated_at"),
    "clubs": ("id", "competition_id", "name", "short_name", "country", "crest_url", "strength", "updated_at"),
    "players": ("id", "club_id", "name", "position", "overall", "updated_at"),
    "stadiums": ("id", "name", "city", "country", "capacity", "updated_at"),
    "kits": ("id", "club_id", "season", "kind", "base_color", "updated_at"),
    "competition_seasons": ("id", "competition_id", "season", "status", "updated_at"),
    "official_teams": ("source_id", "league_source_id", "name", "sport", "updated_at"),
    "official_venues": ("source_id", "name", "city", "country", "capacity", "updated_at"),
    "official_players": ("source_id", "team_source_id", "name", "position", "sport", "updated_at"),
}
KEY_FIELD = {table: ("source_id" if table.startswith("official_") else "id") for table in FIELDS}
MIN_ROWS = {"competitions": 100, "clubs": 1000, "players": 1000,
            "stadiums": 100, "kits": 100, "competition_seasons": 100,
            "official_teams": 1000, "official_venues": 1000, "official_players": 1000}
MAX_ROWS = {"competitions": 20000, "clubs": 200000, "players": 1000000,
            "stadiums": 50000, "kits": 30000, "competition_seasons": 50000,
            "official_teams": 150000, "official_venues": 100000, "official_players": 150000}
PAGE_SIZE = 1000

def publishable_key() -> str:
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
    if os.environ.get("SUPABASE_URL") != PROJECT_URL or not key.startswith("sb_publishable_"):
        raise RuntimeError("Supabase public configuration missing or mismatched")
    if os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        raise RuntimeError("Service-role or secret keys are forbidden for this sync")
    return key

def fetch_rows(kind: str, key: str) -> list[dict]:
    fields = FIELDS[kind]
    key_field = KEY_FIELD[kind]
    rows: list[dict] = []
    seen: set[str] = set()
    offset = 0
    while True:
        query = urllib.parse.urlencode({
            "select": ",".join(fields), "order": key_field + ".asc", "limit": PAGE_SIZE, "offset": offset,
        })
        request = urllib.request.Request(
            f"{PROJECT_URL}/rest/v1/{kind}?{query}", method="GET",
            headers={"apikey": key, "Accept": "application/json", "User-Agent": "JogoManagerMirror/1.0"},
        )
        page = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    if response.status not in (200, 206):
                        raise RuntimeError(f"Unexpected HTTP {response.status} for {kind}")
                    raw = response.read(8 * 1024 * 1024 + 1)
                    if len(raw) > 8 * 1024 * 1024:
                        raise RuntimeError("Page exceeded safety limit")
                    page = json.loads(raw)
                break
            except urllib.error.HTTPError as error:
                if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise RuntimeError(f"Catalog HTTP {error.code} for {kind}") from error
                time.sleep(1.5 * (attempt + 1))
            except (TimeoutError, urllib.error.URLError):
                if attempt == 2:
                    raise
                time.sleep(1.5 * (attempt + 1))
        if not isinstance(page, list) or len(page) > PAGE_SIZE:
            raise RuntimeError(f"Invalid {kind} page")
        for item in page:
            if not isinstance(item, dict) or any(field not in item for field in fields):
                raise RuntimeError(f"Invalid {kind} record")
            item_id = str(item[key_field])
            if not item_id or len(item_id) > 256 or item_id in seen:
                raise RuntimeError(f"Duplicate or invalid {kind} identifier")
            seen.add(item_id)
            rows.append(item)
            if len(rows) > MAX_ROWS[kind]:
                raise RuntimeError(f"{kind} exceeds maximum expected size")
        if len(page) < PAGE_SIZE:
            break
        offset += len(page)
        time.sleep(0.1)
    if len(rows) < MIN_ROWS[kind]:
        raise RuntimeError(f"Unexpectedly small {kind} snapshot: {len(rows)}")
    return rows

def transaction_sql(kind: str, rows: list[dict]) -> str:
    if kind not in FIELDS:
        raise ValueError("Unknown table")
    csv_output = io.StringIO()
    writer = csv.writer(csv_output, quoting=csv.QUOTE_ALL, lineterminator="\n")
    for row in rows:
        writer.writerow([
            str(row[KEY_FIELD[kind]]),
            json.dumps(row, ensure_ascii=False, separators=(",", ":")),
            row.get("updated_at") or "",
        ])
    return f"""BEGIN;
SET LOCAL statement_timeout='180s';
CREATE TEMP TABLE mirror_stage (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz) ON COMMIT DROP;
COPY mirror_stage (id,payload,updated_at) FROM STDIN WITH (FORMAT csv);
{csv_output.getvalue()}\\.
DO $guard$ DECLARE old_count bigint; BEGIN
  SELECT count(*) INTO old_count FROM jm_cache.catalog_entries WHERE kind='{kind}';
  IF old_count > 0 AND (SELECT count(*) FROM mirror_stage) < old_count * 0.8 THEN
    RAISE EXCEPTION 'Refusing catalog shrink: old %, new %', old_count, (SELECT count(*) FROM mirror_stage);
  END IF;
END $guard$;
INSERT INTO jm_cache.catalog_entries AS c (kind,id,payload,source_updated_at,cached_at)
SELECT '{kind}',id,payload,updated_at,clock_timestamp() FROM mirror_stage
ON CONFLICT (kind,id) DO UPDATE
SET payload=EXCLUDED.payload, source_updated_at=EXCLUDED.source_updated_at, cached_at=EXCLUDED.cached_at
WHERE c.payload IS DISTINCT FROM EXCLUDED.payload OR c.source_updated_at IS DISTINCT FROM EXCLUDED.source_updated_at;
DELETE FROM jm_cache.catalog_entries AS c WHERE c.kind='{kind}'
  AND NOT EXISTS (SELECT 1 FROM mirror_stage WHERE id=c.id);
INSERT INTO jm_cache.sync_runs (kind,row_count)
SELECT '{kind}',count(*) FROM mirror_stage;
COMMIT;
"""

def save_rows(kind: str, rows: list[dict]) -> None:
    env = {k: v for k, v in os.environ.items() if k not in
           ("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY")}
    result = subprocess.run(
        ["/usr/bin/psql", "-X", "-v", "ON_ERROR_STOP=1", "-d", "jogomanager_local", "-q"],
        input=transaction_sql(kind, rows), text=True, capture_output=True,
        timeout=240, env=env, check=False,
    )
    if result.returncode:
        raise RuntimeError(f"Local transaction failed for {kind}: {result.stderr[-450:]}")

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tables", nargs="+", choices=FIELDS.keys(), required=True)
    args = parser.parse_args()
    key = publishable_key()
    for kind in args.tables:
        started = time.monotonic()
        rows = fetch_rows(kind, key)
        save_rows(kind, rows)
        print(json.dumps({"table": kind, "rows": len(rows),
                          "seconds": round(time.monotonic() - started, 2), "sync": "success"}), flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"CATALOG_SYNC_ERROR: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
