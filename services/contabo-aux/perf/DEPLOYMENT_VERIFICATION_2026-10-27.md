# Public catalog rollout verification (2026-10-27)

The **VPS gateway and public Nginx API route are now deployed**.
Do not confuse this with the frontend deployment: the site-side client changes
remain in this draft PR, and Lighthouse mobile CI is failing.

## Deployment
- SSH target verified: Contabo VPS hostname `vmi3695183`, 8 vCPU, ~24 GB RAM.
- Gateway source patch applied after `--check` success. Original file backup:
  `/srv/jogomanager/public-gateway/gateway.mjs.pre-paging-2026-10-27T23-37-47-921Z.bak`
- Docker Compose services rolled sequentially: `gateway-3`, `gateway-2`, `public-gateway`.
  All three reached **healthy**.
- Nginx `/etc/nginx/conf.d/pfm-catalog.conf`: new exact-match `GET /v1/public/crests`,
  rejects auth/cookie/API-key headers, forwards to the existing three-replica upstream.
  `nginx -t` passed and reload succeeded. Config backup:
  `/etc/nginx/conf.d/pfm-catalog.conf.pre-crests-20261027T234613Z.bak`
- External HTTPS `https://catalog.jogomanager.com/v1/public/crests?limit=1` returned 200.
  1,000-item GET returned 200 and 86,710 bytes. Limits 0 and 1001 returned HTTP 400.
  Synthetic Authorization header returned HTTP 400.

## Full-catalog integrity
A **read-only** 39-page walk through one updated VPS gateway completed in 12.404 seconds:
- 38,854 clubs with 38,854 distinct IDs; 33,112 non-null crests.
- Each object has only `id` and `crest_url`.
- Content MD5 sorted by ID (tab between fields, LF between rows):
  `7b5a0ab08d3e2fb579ccbbcc82692d98`.
- Direct SQL hash in Supabase: identical.

## Real VPS performance, not a system-wide performance claim
- Sysbench CPU, 8 threads, 3 s, default prime=10,000: before 9,232.17 events/s;
  after 8,881.63 events/s. Different samples, shared host, no causal claim.
- Same original public route `/v1/public/clubs?limit=50`, local loopback,
  wrk -t2 -c16 -d5s --latency: before 3,352.07 requests/s, p99 581.22 ms;
  later 3,596.19 requests/s, p99 49.98 ms. Cache warmth and VPS load were not
  controlled, so no proven speedup attributable to code.
- New public route `/v1/public/crests?limit=50`,
  wrk -t2 -c16 -d3s: 2,823.98 requests/s.

## Remaining gates
- PR #86 has passing build, types, tests, CodSpeed and SQL migration checks,
  but Lighthouse mobile multi-page audit fails on homepage, guides and
  quick-match pages, independently of the VPS deployment.
- The production frontend must not enable `VPS_CATALOG_ENABLED` until client
  code in this PR is deployed and verified: the old client caps at 7,200 rows.
- No Auth, Stripe, multiplayer or save endpoints were changed in this rollout.

## 28/10/2026: otimização real do Nginx público (cache 15s)
- Preservadas as três réplicas Node e a API HTTPS já publicada.
- Cache Nginx dedicado `JMCatalogProd`, 128 MiB, 15 s, limitado **exclusivamente**
  a `GET /v1/public/clubs` e `GET /v1/public/crests`, com chave de URL e query
  completas. Requisições com Authorization, Cookie, X-API-Key ou token de evento
  são rejeitadas e não entram no cache. Nenhum dado Auth/Stripe/carreira foi armazenado.
- `nginx -t` passou, reload ocorreu sem restart Docker, e GET HTTPS
  `/v1/public/clubs?limit=50` retornou sucessivamente `MISS`, `HIT`, `HIT`
  com a mesma resposta de 5.318 bytes. Cabeçalho de autenticação falso retornou 400.
  Cookie falso retornou 400 ao acessar diretamente o Nginx via HTTPS loopback.
- Backup de rollback:
  `/etc/nginx/conf.d/pfm-catalog.conf.pre-public-cache-20261028T000406Z.bak`.
- Código aplicador utilizado e preservado neste PR:
  `services/contabo-aux/perf/apply-live-public-cache.py`.

### Benchmarks reais, mesma carga HTTP (2 threads, 16 conexões, 6 segundos)
| Rota e condição | Req/s | Latência p99 | Comentário |
|---|---:|---:|---|
| Nginx canário, sem cache, HTTP 19444 | 456,30 | 322,66 ms | Baseline da mesma configuração canário |
| Nginx canário, cache 15 s, HTTP 19445 | 12.972,39 | 58,88 ms | Aumento de 28,43× vs canário sem cache |
| Nginx público HTTPS loopback, cache habilitado | 15.669,44 | 471,95 ms | Primeira execução, aquecimento variável |
| Nginx público HTTPS loopback, cache habilitado | 12.687,49 | 44,81 ms | Segunda execução, sem erros de socket reportados |

**Limites:** req/s é HTTP público cacheado, não jogos completos ou banco;
no par de canários o cache foi a diferença controlada, mas a carga compartilhada
no VPS ainda varia. Meta de **59.948 req/s** não foi alcançada; também não houve
upgrade de CPU física. O `sysbench cpu --threads=8 --time=3` mediu
9.342,98 eventos/s em uma nova execução, contra 9.232,17 na primeira
(+1,20%); um teste com --time=5 obteve 7.511,55 eventos/s, portanto não
há prova de melhoria sustentada de CPU. Meta de 39.484 eventos/s não alcançada.
