"""Fail-closed gate for ZAP Full Active scanning of the REAL game in staging.

An isolated synthetic demo is a valid ZAP test target, but is not the user's
full app. Independently verify Supabase, Stripe and Worker bindings as well.
"""
import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

class StageNotReady(RuntimeError):
    pass

ALLOWED_ORIGIN = "https://staging.jogomanager.com/"
PROD_SUPABASE_REF = "lguqnwvsfeefxamzeyos"

def validate_real_stage(target: str, headers: dict, data: dict):
    if target != ALLOWED_ORIGIN:
        raise StageNotReady("Refusing any host other than exact HTTPS staging origin")
    lowered = {k.lower(): str(v).lower() for k,v in headers.items()}
    for key, expected in {
        "x-pfm-isolated-stage": "yes",
        "x-pfm-full-game-stage": "yes",
        "x-pfm-synthetic": "false",
    }.items():
        if lowered.get(key) != expected:
            raise StageNotReady("Stage lacks independent full-game attestation: "+key)
    for key, value in {
        "isolated": True, "synthetic_only": False, "mock": False,
        "app_deployed": True, "app": "jogomanager-web-staging",
        "production_access": False,
        "supabase": "staging-isolated",
        "stripe": "test",
        "multiplayer": "isolated",
    }.items():
        if data.get(key) != value:
            raise StageNotReady("Staging verification mismatch: "+key)
    ref = data.get("supabase_project_ref")
    if not isinstance(ref,str) or not ref or ref == PROD_SUPABASE_REF:
        raise StageNotReady("Refusing missing or production Supabase project reference")
    return True

def verify_live_stage(target: str):
    if target != ALLOWED_ORIGIN:
        raise StageNotReady("Invalid requested staging origin")
    req = Request(target+"__security/health", headers={"User-Agent":"PFM-ZAP-Real-Stage-Gate/1.0"})
    try:
        with urlopen(req,timeout=18) as response:
            if response.status != 200 or response.url != target+"__security/health":
                raise StageNotReady("Staging health redirected, denied or unavailable")
            data = json.load(response)
            validate_real_stage(target,dict(response.headers),data)
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        raise StageNotReady("Full-game staging health not verifiably available") from exc
    print("Verified isolated full-game staging target; not merely a synthetic mock.")

if __name__=="__main__":
    try:
        verify_live_stage(sys.argv[1] if len(sys.argv)>1 else "")
    except StageNotReady as error:
        print("REFUSING_ZAP_FULL_GAME_SCAN: "+str(error),file=sys.stderr)
        sys.exit(2)
