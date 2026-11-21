# Production Supabase client configuration — 2026-11-14

On 14 November, anonymous checks found that the browser asset
`/assets/client-D2jVREFI.js` contained the Supabase project ref
`vylshefvsjggyjlhfups`. Its hostname did not resolve from the operator's
Windows device and had no A, AAAA or CNAME answer from the DNS inspector.
At that time the Worker settings identified the production project
`lguqnwvsfeefxamzeyos`; its public Auth settings and sample anonymous catalog
queries returned HTTP 200 with the active publishable key.

After PR #138 was merged and a newer Worker version was uploaded, an uncached
check on 15 November still found that the live homepage loads an entry bundle
which imports the same client asset and that it still references the old
project. The mismatch is consistent with the browser's “Catálogo extra
indisponível” warning and could also affect browser authentication. The
same-day health check at `jogar.jogomanager.com` instead reported ready and
commit `0856c2afc3c71c7d8317e49d8bde3f0634aa0e88`. Its page loaded a
different browser client which embedded the current project ID but did not
embed `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY`; its client
configuration code consequently has no values for those fields in that build.
Browser authentication and catalog access require a separate functional
verification after rebuilding with the correct public configuration.

On 15 November, an uncached public check returned HTTP 503 for `/api/health`
and HTTP 500 for `/tabelas/brasileirao-serie-a` and
`/tabelas/premier-league`. The health checks run sequentially, so their false
values are not three independently established outages. The Worker-binding
changes in this PR passed an isolated synthetic local test; the cause of
the current production errors still requires controlled verification.

A deployment guard checks the expected production project, validates that
the public key is accepted, and inspects the built browser Supabase client
before deployment. Tests cover stale bundles, the wrong project, secret keys
and rejected keys. A generated bundle was checked using fixture values. The
expected project ref may be intentionally changed with
`EXPECTED_PRODUCTION_SUPABASE_REF` when the deployment target changes.

This guard does not change the deployed site. Production still requires
diagnosis, a validated release and a rollback plan.
