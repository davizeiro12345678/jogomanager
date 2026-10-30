# jogomanager.com: findings on name servers and DNSSEC (no changes made)

## What I can and cannot do
- I can read the current state: public name servers, the registry's view, DNSSEC and email records.
- I cannot replace the name servers at the registrar. None of my tools can write to it. You change them in Settings → Workspace domains → jogomanager.com → Advanced → Nameservers → Edit, or at name.com if that is where the domain is managed.

## Current state (read on 2026-10-30 17:32 UTC)
- The .com registry lists 6 name servers: 4 from name.com (ns1hwy, ns2fln, ns3fqs, ns4jnz) and malavika/moura.ns.cloudflare.com. Both sets are active together.
- 2 of the 3 public resolvers answer only the Cloudflare pair; 1.1.1.1 still returns all 6.
- DNSSEC: off. The registry holds no DS record and no DNSKEY is published, so there is nothing to disable before migrating.
- Email at the root: MX points to Cloudflare Email Routing (route1/2/3.mx.cloudflare.net).
- Email at notify.jogomanager.com: MX points to Mailgun EU (mxa/mxb.eu.mailgun.org).
- The `_lovable-email` TXT check record is still missing on 2 resolvers. Only 1.1.1.1 sees it.

## Risk
With the name.com and Cloudflare servers mixed, every lookup can get a different answer. Website or email records that exist on only one side will fail intermittently.

## Proposed steps (only after you approve)
1. Export every record from both sides (name.com and Cloudflare): A/CNAME for the site, MX, SPF, DKIM, DMARC, the notify.* records and `_lovable-email`.
2. Confirm the Cloudflare zone contains all of them before cutting over.
3. At the registrar, leave only malavika and moura (remove the 4 name.com servers).
4. Keep DNSSEC off until the switch has spread (24–48 h). Then optionally turn it on in Cloudflare and add the DS record at the registrar.
5. Check the site, email delivery and the `_lovable-email` record again.
