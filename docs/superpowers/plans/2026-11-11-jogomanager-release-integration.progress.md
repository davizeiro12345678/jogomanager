# SDD ledger — plan: docs/superpowers/plans/2026-11-11-jogomanager-release-integration.md

## Checkpoint 2026-11-11 — refreshed after production and CI inspection

- Integration branch: `integration/release-2026-11-11`
- Exact branch SHA at this checkpoint: `9ac3af9f7338b15d83530df6ee61a3a88bedf1e7`
- Main SHA last read: `8183b73828df7cbbc185fab4b665dbc35f0eaf29`
- PR #132: open, Draft, base `main`, head `integration/release-2026-11-11`; not merged and not deployed.
- Design: `docs/superpowers/specs/2026-11-11-jogomanager-release-integration-design.md`
- Plan: `docs/superpowers/plans/2026-11-11-jogomanager-release-integration.md`
- This ledger is the portable continuation record. Refresh branch SHA and CI run IDs before resuming.

### PR ancestry

- PR #127: closed and merged into the integration branch (merge commit `4aedd98b88d67be9d7150902455a0aecdf3bebda`).
- PR #128: open/draft against `main`; head `32ac4219bf5dc4a357593a381f5e918876a741d0` is an ancestor of integration. Do not cherry-pick it again.
- PR #129: open/draft, retargeted to integration; selected importer, Custom450 migration 0067, SQL contract, bounded worker changes and bundle baseline work are ported. Exact-head validation and staged importer acceptance remain.
- PR #130: open/draft, retargeted to integration; direct Supabase OAuth, allowlist-only fallback, tests and career-country module are present. Existing-account continuity, callback, recovery/MFA and browser validation remain.
- PR #131: open/draft, retargeted to integration; read-only gateway and paginated catalog changes are present. VPS/Tunnel/DNS activation remains blocked pending host integrity and clean rebuild evidence.

### Repository governance

- One active repository ruleset exists, but it does not include `required_status_checks`.
- The branch-protection administration endpoint returns HTTP 403 to this GitHub integration; no ruleset write action is available. A repository administrator must add required checks and scope enforcement to `refs/heads/main`.
- Do not merge PR #132 until the administrator requirement is satisfied and exact-head checks pass.

### Latest exact-head CI set observed

| Workflow | Run ID | State at observation |
|---|---:|---|
| Auxiliary match worker | 43089449464 | queued |
| Match 3D lifecycle/context recovery | 43089449441 | in progress |
| Match 3D mobile draw inventory | 43089449348 | in progress |
| Match 3D visual evidence | 43089449332 | pending |
| Match 3D startup CPU diagnostic | 43089449462 | pending |
| CodSpeed | 43089449360 | pending |
| Quality gates | 43089449768 | pending |
| Public environment/MCP safety | 43089449304 | success |

A previous exact-head run set was canceled when the branch advanced. A prior auxiliary-worker run failed on a Prettier assertion in `src/game/quick-match-catalog.test.ts`; that formatting has since been corrected. Do not assume the current run set is green—inspect the latest runs for the current SHA before reporting results.

### Production evidence

- `public.api_football_data` autovacuum thresholds are applied and read back: vacuum/analyze scale factor 0.5%, threshold 20,000. Autovacuum completed at 2026-11-11 19:26:01 UTC and autoanalyze at 19:25:51 UTC; latest sample showed zero estimated dead tuples and zero modifications since analyze.
- The injury-count materialized-view refresh is **not fixed**. The latest observed run took 36.024 seconds at 2026-11-11 19:00 UTC. No `api_football_injury_league_cover_idx` or replacement currently exists. A concurrent covering-index build exceeded the SQL API's 120-second timeout and the incomplete index was removed. The planner still uses the valid but non-covering `api_football_injury_league_time_idx`. Staging plan comparison and an operator session with a longer timeout are required.
- PostgreSQL collation mismatch remains: recorded `153.120`, actual `153.121`. Exact inventory: 251 ordinary indexes (2,172.20 MiB) plus the partitioned `realtime.messages_replay_index` parent and six child indexes. No REINDEX or collation refresh has been run; this is a maintenance-window operation.
- API-Football importer changes and migrations 0067–0070 are in the branch. Elimination of production 546/503 errors is not proven until a representative staged batch and post-deploy telemetry pass.
- No physical-device high-quality 60 FPS evidence exists. CI/headless screenshots are not accepted as physical GPU proof.
- Cloudflare production deployment has not been triggered. VPS gateway/Tunnel remains disabled. No active attack test was run against production.

## Completed in this workflow

- [x] Read Superpowers using-superpowers, brainstorming, writing-plans, executing-plans, TDD, systematic-debugging and verification-before-completion skills.
- [x] Reviewed current repository branch, main, PR #127–#131, Quality workflow, bundle workflow, Supabase production telemetry and Postgres maintenance evidence.
- [x] Confirmed #127 merged to integration (merge commit `4aedd98b88d67be9d7150902455a0aecdf3bebda`).
- [x] Confirmed #128 head is already an ancestor of integration; no duplicate cherry-pick required.
- [x] Saved release design spec.
- [x] Saved Superpowers implementation plan with task-by-task checkboxes, exact files, interfaces, tests and acceptance criteria.
- [x] Saved this cross-account progress ledger.

## In progress / not complete

- [~] PR #129 reconciliation: selected importer, Custom450 migration 0067, SQL contract, bounded worker changes and bundle baseline resolver changes exist. Full diff reconciliation, exact-head tests and staged importer acceptance remain.
- [~] PR #130 reconciliation: direct Supabase OAuth, fallback provider discovery and career-country module exist. Real existing-account continuity, callback, recovery/MFA and browser tests remain.
- [~] PR #131 reconciliation: read-only gateway assets and client pagination exist. Full tests and clean-host staging remain; VPS/Tunnel/DNS activation is prohibited until host integrity is proven.
- [~] Quick-match generic club filter/tests exist; exact-head focused and full CI results still needed.
- [~] Bundle baseline workflow has been repaired in several commits; exact-head baseline/candidate artifact comparison remains pending.
- [~] Frame campaign instrumentation and rendered-frame bridge exist; physical-device high-quality 60 FPS evidence is absent.
- [~] Multiplayer queue/finalization hardening and tests exist; operational authoritative transport, durable result writes and multi-room stress remain.
- [~] Chat admission/moderation groundwork from #127 is present; end-to-end idempotency, Unicode abuse and moderation audit tests remain.
- [x] Production API-Football autovacuum thresholds are applied and verified; this does not yet fix the materialized-view refresh.
- [ ] Repair invalid injury covering index in an approved maintenance window.
- [ ] Rebuild collation-dependent indexes in an approved maintenance window, then refresh the database collation version.
- [ ] Configure main branch protection and required checks through a repository admin; current GitHub integration receives HTTP 403 for branch-protection administration.
- [ ] Implement/verify persistent competitions, rankings, DAU/retention instrumentation, beta cohort and public changelog.
- [~] Draft PR #132 exists against main; complete independent review, exact-head CI and evidence before marking ready.
- [ ] No main merge or production deploy has occurred in this workflow.

## Draft PR checkpoint

- PR #132: https://github.com/davizeiro12345678/jogomanager/pull/132
- State: open, draft, base `main`, head `integration/release-2026-11-11`.
- Head SHA: `ec499d621de33ee148184b7411a7197054eedbef`.
- PR #132 is a staging/review container only; not approved for merge or deployment.

## Latest CI checkpoint

Latest PR #132 run set observed on SHA `ec499d621de33ee148184b7411a7197054eedbef`:

| Workflow | Run ID | State |
|---|---:|---|
| Match 3D lifecycle and context recovery | 43088763738 | in progress |
| CodSpeed | 43088763694 | in progress |
| Public environment and MCP safety | 43088763902 | success |
| Match 3D startup CPU diagnostic | 43088763706 | in progress |
| Auxiliary match worker | 43088763652 | in progress |
| Match 3D mobile draw inventory | 43088763656 | in progress |
| Quality gates | 43088763599 | pending |
| Match 3D visual evidence | 43088763788 | in progress |

A prior run set on parent SHA `1496e779fdf4d3deb2b462eba54429a68722f5a1` was canceled after the branch advanced; its successful safety job is not a substitute for current Quality Gates. Inspect the newest runs for the latest branch head. Do not claim tests pass until the exact-head runs finish successfully.

## Production evidence checkpoint

- Autovacuum options on `public.api_football_data`: `autovacuum_vacuum_scale_factor=0.005`, `autovacuum_vacuum_threshold=20000`, `autovacuum_analyze_scale_factor=0.005`, `autovacuum_analyze_threshold=20000`.
- Latest read-only stats after autovacuum: approximately 10.3M live tuples, 0 estimated dead tuples, 0 modifications since analyze; last autovacuum and autoanalyze completed.
- Injury view refresh remained approximately 30–36 seconds before the covering-index repair; `api_football_injury_league_cover_idx` was invalid, not ready and zero bytes.
- Collation recorded version `153.120`; actual version `153.121`.
- Collation inventory: 251 ordinary indexes, approximately 2.17 GB, plus partitioned Realtime index. Do not run without maintenance approval and provider coordination.

## Next action when resuming

1. Refresh the integration branch head SHA and list the latest workflow runs.
2. Inspect the current auxiliary-worker and Quality Gates logs; fix the first real failure with Superpowers systematic-debugging and TDD.
3. Continue Task 1 in the plan: compare PR #129 full diff against integration and port only missing changes; do not cherry-pick whole PRs.
4. Then Task 2: reconcile PR #130 auth/career-country changes and prove same-user/same-career OAuth continuity.
5. Keep Tasks 6–7 (production index/collation operations), VPS activation, branch protection admin, main merge and Cloudflare deploy behind their explicit gates.

## Rulings

- Ruling: use the existing integration branch and preserve its ancestry — PR #127 is merged and PR #128 is already an ancestor; replaying either would duplicate changes and risk migrations.
- Ruling: keep VPS gateway disabled — the previous host has an unresolved root-compromise history and no current proof of clean rebuild, backup restore and credential rotation; cost if wrong is exposing the production catalog host.
- Ruling: do not automatically repair collation or the injury index — the operations affect a multi-GB index footprint and need backup, storage/WAL/replica capacity and maintenance monitoring; cost if wrong is production query degradation or index inconsistency.
- Ruling: do not declare 60 FPS from CI/headless evidence — GPU/browser emulation does not represent physical devices; cost if wrong is a false performance claim and regressions on actual player hardware.

## Handoff update — PR #132

- Draft PR #132 was created/confirmed at `https://github.com/davizeiro12345678/jogomanager/pull/132`.
- It targets `main`, remains Draft, and has no merge or deploy authorization.
- The PR description records the Custom450 worker budget (8 default lanes, max 12, 120 requests/window and 9 fetches/s) and documents the remaining PostgreSQL repair constraints. Verify those values against the exact importer code and tests before release.
- The exact-head PR checks are still running; the only completed latest job observed was Public environment and MCP safety (success). No full Quality Gates result yet.


## Exact continuation checkpoint — 2026-11-11, branch SHA 88bc31045b92d0a25822e8dfbec9067e805fec85

This section supersedes older SHA/run-ID snapshots above. Resume from this checkpoint after refreshing the branch and workflows again.

- Current branch: `integration/release-2026-11-11`.
- Current branch SHA: `88bc31045b92d0a25822e8dfbec9067e805fec85`.
- Main SHA: `8183b73828df7cbbc185fab4b665dbc35f0eaf29`.
- PR #132: open Draft to main; one consolidated review container; no merge/deploy authorization.
- PR #127 merged; #128 head is already in branch ancestry; #129–#131 remain open/draft and are superseded by #132 once full diff review and CI complete.
- Repository ruleset `wadweew` is active but has no `required_status_checks`; `main.protected=false`. The connected GitHub integration cannot perform ruleset/branch-protection administration (HTTP 403). Repository administrator action is required.
- Exact-head runs:
  - Quality gates — `43089675217` — queued.
  - Match 3D startup CPU diagnostic — `43089675003` — pending.
  - Match 3D visual evidence — `43089674894` — in progress.
  - Public environment and MCP safety — `43089674888` — success.
  - Match 3D mobile draw inventory — `43089674777` — in progress.
  - Match 3D lifecycle and context recovery — `43089674727` — in progress.
  - Auxiliary match worker — `43089674724` — in progress.
  - CodSpeed — `43089674703` — pending.
- PostgreSQL read-only state: `api_football_data` has 10,303,707 estimated live tuples, 0 dead, 0 modified since analyze; autovacuum thresholds are 0.5% + 20,000 and last autovacuum/autoanalyze completed at 19:26 UTC. Injury covering index is absent; time index is valid/ready at ~1,976 kB. Injury refresh: 28 calls, mean 30,666.29 ms, max 36,022.63 ms. Collation remains 153.120 recorded vs 153.121 actual; inventory 251 ordinary indexes (~2,172.20 MiB) plus a partitioned Realtime parent and six children.
- API-Football code defaults to 8 lanes, max 12 scheduled lanes, 120 requests/window and 9 fetches/second; staged 546/503 acceptance is outstanding.
- Current position: Phase 1 integration/CI stabilization. The next task is to inspect exact-head CI and fix the first genuine failure; then resume Task 1 (full PR #129 diff reconciliation), followed by Task 2 (#130 same-user/same-career OAuth verification).
- No main merge, Cloudflare deploy, VPS/Tunnel/DNS activation, production index maintenance or collation rebuild has occurred.



## Continuação: expansão multiplayer/IA/física 2026-11-11

Plano: `docs/superpowers/plans/2026-11-11-multiplayer-ai-graphics-contact-expansion.md` (parte da PR #132).

- **Implementado parcialmente no branch:** novo `contactPhysicsRevision: 2` opt-in no contrato/snapshot/checkpoint e na ponte do Worker; limites de contato em domínios e divididas; remoção do teleport de recuperação e salto de goleiro na nova revisão; de-penetração gradativa; seleção de nova revisão na apresentação multiplayer e no motor online. Contratos legados continuam sem flag. A revisão de regras de futebol existente 1/2 é preservada.
- **Implementado parcialmente:** recepção de comandos de sala errada rejeitada antes de admitir a conexão ou alterar liveness; teste de regressão adicionado.
- **Adicionado, não executado localmente:** `src/game/contact-physics-revision.test.ts` (distância de recuperação, dividida, contrato e checkpoint), e cobertura de sala errada em `authoritative-match-session.test.ts`.
- **NÃO concluído:** servidor WebSocket/DO em produção, anti-cheat completo, moderação IA + recursos, novos modos, IA futebolística avançada, revisão gráfica, métricas e CI exato. A PR segue Draft; não mesclar.
- **Observação de compatibilidade:** a nova revisão foi optada pelo construtor canônico de novas sessões online; antes do deploy, verificar persistência da revisão por sala para sessões que atravessam versões do servidor, paridade com replay e rollback seguro.
- **Próximos gates:** Quality Gates de SHA mais recente, Prettier/TS/Vitest focado e integração, replay determinístico 1.000 seeds, métricas de deslocamento e homologação em hardware.

### Segundo lote de implementação — 2026-11-11
- `sim-ball-duels.ts`: v2 só transfere bola na dividida quando corpo **e bola** estão no raio de alcance. Novo caso `contact-missed-ball` em `contact-physics-revision.test.ts`.
- `ai-ball-interception.ts` e teste: perseguição preditiva de bola solta com velocidade, stamina, tempo de reação/curva, sem RNG nem alterar a física. `sim-team-ai.ts` opta apenas em `contactPhysicsRevision=2`.
- `moderation.ts` + teste: URL/e-mail mascarados com alfabetos mistos não escapam das regras de link/contato; mantém termos futebolísticos normais.
- Não houve execução local de Vitest, TypeScript, Prettier, testes visuais ou de stress: os GitHub Actions do SHA anterior estavam em fila. Confirmar o **SHA final deste lote** antes de atribuir qualquer conclusão. Não declarar multiplayer/IA/suporte/gráficos completos.


## Checkpoint de implementação — 2026-11-11, após expansão PR #132

**SHA observado antes de registrar:** `68e53b836a73ad6e5c9fbe49e52232517a1a3866`; atualizar a referência novamente ao continuar. PR segue Draft, sem merge nem deploy.

### Código acrescentado na própria PR

- `src/game/online/authoritative-socket-bridge.server.ts`: socket server-only com verificação criptográfica de ticket injetável, comandos em 4 KiB, ACK/NACK, snapshots do estado do servidor, finalização única, tempo de inatividade e backpressure. Não existe ligação a uma rota WebSocket Cloudflare; **não é multiplayer real implantado**.
- `src/game/online/matchmaking-policy.ts` + testes: seleção determinística casual e ranqueada, limiar de rating crescente, região, bloqueio e proteção contra partidas repetidas. Persistência de fila e MMR ainda ausentes.
- `src/features/multiplayer/RoomChat.tsx`: chat privado reutilizável no lobby e no campo 3D; ocultação local do adversário, canal de denúncia e entrega pelo mesmo RPC/Realtime existente, sem duplicar moderação ou outbox.
- `src/features/multiplayer/LiveRoom.tsx`: chat durante a partida, controle alta/média/baixa e aviso de que prévia local não é placar oficial; render usa revisão física vinculada à sala no banco.
- `src/lib/support-report-context.ts` + teste, `src/pages/contato.tsx`, `src/components/support/SupportTicketForm.tsx`: abertura de denúncia por contexto seguro `reportRoom=<uuid>`, formulário e categoria preenchidos sem dados de outra conta; corrigido fallback SSR/hidratação.
- `src/game/match-physics-extras.ts` e `src/game/sim-ball-duels.ts`: novo teste geométrico de alcance de goleiro na revisão 2 para reduzir defesas impossíveis; testes unitários acrescentados; validar realismo estatístico antes de produção.
- `drizzle/migrations/0072_match_contact_physics_revision.sql`, `meta/_journal.json`, `src/integrations/supabase/types.ts`: modelo por sala no banco, default 2 apenas para salas futuras e 1 para legadas, CHECK e trigger impedindo escrita de usuário comum.
- `src/lib/multiplayer.functions.ts`: replay/settlement pelo modelo persistido, sem escolher worker auxiliar não versionado para revisão 2.
- `tests/sql/match_contact_revision_contract.sql` + `scripts/verify-local-database.mjs`: contrato de migração, teste de papel `authenticated` e runner de PostgreSQL em memória.
- `docs/operations/multiplayer-physics-rollout-2026-11-11.md`: runbook de staging, validação, ameaças, gates e rollback.

### Validação real

- A integração GitHub retornou `queued` nos workflows observados de Quality Gates, CodSpeed, Match 3D, API-Football, segurança pública e Worker, sem resultados finais no SHA mais recente observado.
- **Nenhum** teste Vitest/TypeScript/Prettier/benchmark de GPU ou migração PostgreSQL foi executado nesta sessão; os testes escritos não são prova de aprovação.
- **Ainda não implementado:** Durable Object e WebSocket autenticado integrados, snapshots oficiais em `LiveRoom`, fila transacional ranqueada, MMR persistido, torneios/cooperativo, IA tática hierárquica, gráfica 3D completa, gestão/recursos de moderação e teste físico de 60 FPS.
- **Ainda não autorizado:** deploy Cloudflare, migração 0072 em produção, atualização da branch `main`, mudança de RLS ou alterações no VPS anteriormente comprometido.

### Prioridade operacional imediata

1. Confirmar o novo SHA e o primeiro resultado efetivo de CI. Corrigir os erros de lint/Prettier/TS/Vitest, se presentes.
2. Validar migration 0072 + função de trigger no PostgreSQL de staging; confirmar salas antigas, autorizações e assinaturas de partidas.
3. Conectar DO + ticket HMAC, snapshots e reconciliação em ambiente isolado e autorização do operador; sem isso, novos modos não são confiáveis.
4. Homologar cenários de futebol com 1.000 seeds, hardware GPU real, custos de frames e evolução de IA.
5. Registrar evidências, atualizar flags e exigir aprovação humana de release para desmarcar Draft.

**Atenção:** o objetivo do usuário foi implementar todo o plano, mas esta etapa concluiu apenas partes do código. Preservar os gates sem forçar merge ou afirmar que o multiplayer real está disponível.


## Continuação de validação real e infraestrutura inicial — 2026-11-11

**A investigação atual inspecionou os workflows de GitHub Actions, não apenas o código.**

### Evidências de falhas CI encontradas (SHAs anteriores)

- Quality gates `43098755846`: o hardcoded audit detectou 11 strings não traduzidas introduzidas em `RoomChat` e `LiveRoom`; corrigido reutilizando dicionários PT/EN/ES sem enfraquecer o audit/baseline.
- O ESLint/Prettier bloqueou imports/trechos de física, interface, matchmaking e chat; vários reparos feitos. O job auxiliar `43104177324` detectou os 5 erros restantes; corrigidos posteriormente.
- Supabase migration replay `43104177618`: a tabela antiga `football_import_private.quota_seconds` não existia no banco canônico descartável; adicionada criação condicional em 0067 sem apagar dados reais. Depois, o teste Custom450 presumiu que toda instalação tinha o plano máximo: o fixture agora configura 450000/1200 **dentro de uma transação que faz ROLLBACK**, preservando planos inferiores em produção.
- Bundle comparator `43104177618`: antes da otimização, startup de Worker subiu 3.376 bytes gzip/3.197 bytes Brotli contra limite de 2.048 bytes. Não afrouxamos os limites. `match.worker.ts` passou a carregar `MatchSim` sob demanda, e `live-match.ts` deixou de importar esse motor como valor. O resultado de compressão exato precisa ser confirmado no CI novo.
- O primeiro build gráfico após o lazy split falhou porque `import type` continha marcadores redundantes `type`; import corrigido.
- Foram registrados como **sucesso no SHA anterior**, não no HEAD final: CodSpeed, regressão API-Football, testes de ambiente/MCP, teste determinístico revision-2 de 200 jogos, contratos 3D, Lighthouse shell e Rust/WASM. Estes resultados não substituem a validação do novo commit.

### Código desenvolvido neste lote

- Assinatura HMAC reutilizada do `ticket-signing.ts`: novo emissor `src/game/online/seat-ticket-issuer.server.ts` valida usuário, sala, assento, seed gerenciada, estado `live`, prazo de 90 s e segredo forte; sem retornar segredo de partida ou chaves da plataforma.
- `src/lib/multiplayer-tickets.functions.ts`: endpoint autenticado pelo middleware Supabase; o segredo `MATCH_TICKET_SIGNING_SECRET` deve estar no servidor, ausente no navegador. Se não configurado, a função falha fechada.
- `src/game/online/secure-socket-bridge.server.ts`: composição obrigatória do transporte com verificação HMAC/expiração, além da proteção contra room hopping já presente.
- Testes novos de emissão, assinatura, expiração, adulteração de assento, impostor, configuração inválida e startup lazy do Worker.
- Nenhuma rota de Durable Object WebSocket é ativada: esse componente ainda necessita do dono durável de sala, armazenamento de checkpoint, cron de tick e roteamento validado.

### Bloqueadores que permanecem

- Quality gates do **commit final após este registro** e todos os testes exatos devem terminar com sucesso, especialmente SQL 0072, TypeScript, Vitest, worker e bundle.
- Persistência completa da sessão de autoridade, reconexão após reinício do DO, snapshots oficiais no cliente, MMR/sala ranqueada transacional, torneios e coop seguem não implementados.
- Exigem staging: memória/CPU de sala, privacidade/moderação contextual, 100 conexões, 1000 seeds, anti-replay e qualidade gráfica física de 60 FPS; não declarar estes critérios alcançados sem resultados.
- Não rodar deploy Cloudflare nem migrações produção, não mesclar PR #132 enquanto estiver Draft sem aprovação dos gates.


## Checkpoint 12/11/2026: novos modos seguros e métricas de rede

**Base certificada antes deste lote:** commit `b99a4eac913d9c4c2ee629475700fe18c44d6183`; Quality gates run `43285517886` concluiu com 13/13 jobs aprovados, além dos workflows específicos de frontend, jogo 3D, API-Football, CodSpeed e segurança. Essa aprovação **não certifica os novos commits**; os testes devem ser consultados novamente no HEAD.

### Código novo deste lote na PR #132

| Parte | Arquivos | Entrega verificável | Bloqueio de liberação |
|---|---|---|---|
| Espectadores | `src/game/online/delayed-spectator-feed.server.ts` e `.test.ts` | Buffer público de snapshots, atraso de 10–300 segundos, rejeição de frame de outra sala/seed, relógio monotônico e memória limitada | Acesso autorizado aos espectadores, ingresso WSS read-only, persistência do delay e limite de público no DO ainda não implementados |
| Cooperativo 2×2 | `src/game/online/cooperative-command-policy.server.ts` e `.test.ts` | Quatro IDs distintos, capitão por equipe, troca autorizada de capitão, votação conjunta com 30s para desistir e bloqueio de comandos de outra equipe | Persistência de escalações, integração do 2×2 à sessão/WS, interface de permissão e conflitos ainda não implementados |
| Torneios | `src/game/online/verified-tournament-bracket.server.ts` e `.test.ts` | Chave eliminatória de 2–32 competidores, byes determinísticos, sala vinculada, assinatura de recibo validada por callback obrigatório e resultados idempotentes | Armazenamento transacional, inscrição autenticada, chave pública, verificação HMAC ligada ao settlement e tiebreakers para empates ainda pendentes |
| Latência online | `src/game/online/authority-latency-metrics.ts` e `.test.ts`, `authoritative-socket-client.ts` e teste de integração | Medição de input→ACK/NACK com p50/p95/p99, limites de amostras, deduplicação e descarte de dados pessoais | Benchmarks com dois aparelhos, regiões e perda de pacotes ainda não realizados |

**Princípio de segurança:** os três modos são bibliotecas server-only, NÃO endpoints públicos. Nunca aceitar `userId`, score, seed, resultado ou horário do navegador como autoridade. As interfaces existentes continuam ocultando recursos não implantados. Este trabalho não altera FPS ou IA tática automaticamente, nem publica multiplayer 2×2/torneios/espectadores sem o DO.

### Gates que permanecem pendentes

1. **P2/P8, staging Cloudflare:** a conta Cloudflare foi consultada, e `jogomanager-match-authority-staging` ainda não existe. O workflow tem `verify` e `deploy-disabled-staging`, mas o GitHub Actions não dispõe de `CLOUDFLARE_API_TOKEN` nesse contexto. Apenas o proprietário pode fornecer um token de deploy de privilégios mínimos pela interface de Secrets, sem expor seu valor. Implantar primeiramente com `MATCH_AUTHORITY_ENABLED=false`, `MATCH_QUEUE_CRON_ENABLED=false`, `workers_dev=false` e sem rotas públicas.
2. **P3 novos modos:** persistir e integrar espectador/torneio/2×2 ao controlador autoritativo; conectar os tickets aos assentos corretos, sem dar `forfeit` e `set_tactics` a espectadores.
3. **P5 moderação:** triagem humana, recursos, notificações e calibração de falsos positivos ainda exigem testes de ponta a ponta.
4. **P1/P6/P7 física, IA e gráficos:** executar A/B com sementes idênticas e avaliações físicas GPU/CPU, reduzir teleporte na apresentação R3F e atingir critérios reais de desempenho nos dispositivos alvo. Código existente de IA tática v2 não demonstra por si só superioridade de jogo.
5. **P0/P8 evidência:** revalidar lint, TypeScript, Vitest, SQL, bundle, stress, Lighthouse e WebGL visual no SHA final. Fazer smoke test WSS com dois clientes e rollback antes de qualquer liberação ranqueada.
6. **Publicação:** manter PR #132 Draft sem merge ou deploy geral até ter revisão de diff, staging isolado e rollback homologados. Não aplicar novas migrações nem secrets em produção sem comprovação da arquitetura.

**Legenda de status:** código salvo no GitHub = implementado parcialmente [~]; somente testes e staging comprovados = entregue [x]; integração não realizada = pendente [ ].
