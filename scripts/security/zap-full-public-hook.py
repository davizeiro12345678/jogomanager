"""Owner-authorized production-public-only OWASP ZAP Full Scan hook.

Blocks private URLs from both spider and active scanning. A full authenticated
scan still requires an independent staging environment with synthetic data.
"""
import re

ALLOW = r"(?:$|jogo-de-manager-de-futebol/?(?:\?.*)?$|modo-carreira-de-jogador/?(?:\?.*)?$|robots\.txt(?:\?.*)?$|sitemap\.xml(?:\?.*)?$)"
EXCLUDE_LOCAL = r"^https?://jogomanager\.com/(?!" + ALLOW + r").+"
EXCLUDE_EXTERNAL = r"^https?://(?!jogomanager\.com(?::443)?/).+"

def zap_started(zap, target):
    if target != "https://jogomanager.com/":
        raise RuntimeError("Refusing non-approved ZAP Full Scan target")
    for regex in (EXCLUDE_LOCAL, EXCLUDE_EXTERNAL):
        spider_result = zap.spider.exclude_from_scan(regex)
        active_result = zap.ascan.exclude_from_scan(regex)
        if str(spider_result) != "OK" or str(active_result) != "OK":
            raise RuntimeError("ZAP exclusion was not accepted; refusing scan")
    zap.ascan.set_option_thread_per_host(1)
    zap.ascan.set_option_delay_in_ms(1000)
    zap.ascan.set_option_max_scan_duration_in_mins(5)
    zap.ascan.set_option_max_rule_duration_in_mins(1)
    print("PUBLIC_SCOPE_LOCKED: one thread, 1000ms delay, non-auth routes", flush=True)
    return zap, target
