"""OWASP ZAP authenticated synthetic staging only: never a production scan."""
import re
STAGE_URL="https://staging.jogomanager.com/"
DENY_EXTERNAL=r"^https?://(?!staging\.jogomanager\.com(?::443)?/).+"
def zap_started(zap,target):
    if target != STAGE_URL:
        raise RuntimeError("Staging-only auth hook refuses other target")
    for o in (zap.spider.exclude_from_scan(DENY_EXTERNAL),zap.ascan.exclude_from_scan(DENY_EXTERNAL)):
        if str(o)!="OK":
            raise RuntimeError("ZAP external URL exclusion failed")
    result=zap.replacer.add_rule(
        "Synthetic Stage Cookie - no real credentials",
        "true","REQ_HEADER","false","Cookie",
        "pfm_stage_session=synthetic-only",
        url=r"^https://staging\.jogomanager\.com(?:/|$)"
    )
    if str(result)!="OK":
        raise RuntimeError("ZAP synthetic auth header not registered")
    zap.ascan.set_option_thread_per_host(1)
    zap.ascan.set_option_delay_in_ms(800)
    zap.ascan.set_option_max_scan_duration_in_mins(5)
    zap.ascan.set_option_max_rule_duration_in_mins(1)
    print("SYNTHETIC_STAGE_AUTH_INSTALLED: no Supabase/Stripe/production keys",flush=True)
    return zap,target
