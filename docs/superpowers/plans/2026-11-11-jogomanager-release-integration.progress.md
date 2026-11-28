# SDD ledger — plan: docs/superpowers/plans/2026-11-11-jogomanager-release-integration.md

## Continuação 19/11/2026 — estabilidade e isolamento do 1×1

- O cliente começa a enviar heartbeat após `READY` e reconecta antecipadamente com um ticket atualizado, preservando a sequência de comandos. O teste com dois clientes cobre inatividade de 50 segundos e comandos após o vencimento dos tickets iniciais.
- No servidor, o vencimento do ticket fecha apenas a conexão afetada e permite renovar aquele assento. Se a persistência do checkpoint falhar, a sala continua bloqueando a confirmação do comando.
- O cliente REST do Worker rejeita redirecionamentos em requisições que carregam credencial do Supabase. A validação do projeto de destino continua ativa.
- Evidência local: `npm exec -- vitest run src/game/online services/match-authority`, 24 arquivos e 198 testes aprovados. A revisão direcionada do fluxo apontou riscos de estabilidade, liquidação e isolamento do banco. O aceite completo ainda depende de CI no novo commit, revisão formal e homologação privada.
- Próximos gates do multiplayer: validar emissão de tickets e WSS no preview com credenciais de staging, dois aparelhos, reconexão, recuperação após reinício e liquidação idempotente. Confirmar a visibilidade do estado final após a confirmação no banco antes de expandir para a partida 2×2.
- Em produção, o domínio principal retornou 503 no health e carregou um bundle diferente de `jogar`, que retornou 200. O bundle de `jogar` ainda omitia a URL e a chave publicável do Supabase. Confirmar a associação do domínio no painel Lovable e homologar um build com login funcional antes de mudar o roteamento.
- No VPS, o Nginx, ClamAV e agente Wazuh estavam ativos. O túnel dedicado continuava sem conexões no provedor, e o canário atendia os hosts VPS com oito conexões. A troca de identidade do túnel depende de provisionamento autorizado da credencial, restauração testada e acesso administrativo de recuperação.

## Continuação 12/11/2026 — adendo visual/fluidez/física/IA/SEO

O proprietário solicitou a ampliação do salto visual e a continuação desta PR. O plano complementar está em `docs/superpowers/plans/2026-11-12-match3d-major-upgrade.md`, spec homônima em `specs/`, execução/evidência em `verification/pr132-upgrade-20261112/progress.md`. O lote inicial corrige recuperação de chunk cinematográfico, batching inicial com cenário assíncrono, apoio indevido de atleta expulso na IA v2 e adiciona gate SEO para as falhas reais do sitemap; preserva revisões legadas e gates. O salto visual completo, homologação física, publicação/configuração e novo crawl Semrush continuam explicitamente pendentes. Os checkpoints históricos abaixo não aprovam automaticamente a revisão combinada atual.

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


## 12/11/2026: Cloudflare DO staging realmente criado e moderação com revisão humana

**Implantação efetiva, sem exposição:** o script `jogomanager-match-authority-staging` foi criado na conta Cloudflare `31b4ec9dfe5281c893ccfaaaefcfc88d`, vinculando a namespace SQLite `jogomanager-match-authority-staging_MatchRoomDO` (`bdbb41fa3f1046d3b12c20c9ff87d1ea`). A revisão `18f8b49c-8b02-4623-9911-7841b7f273f4` foi consultada por GET na API; flags `MATCH_AUTHORITY_ENABLED=false`, `MATCH_QUEUE_CRON_ENABLED=false`, `MATCH_AUTHORITY_ENV=staging`, workers.dev, previews e domínios públicos desabilitados. **O script instalado é o bootstrap 404 com armazenamento de marcador, não o motor completo `services/match-authority/worker.ts`.** O código real compilado está na branch e em artifact de CI, aguardando substituição por um fluxo de deploy autorizado. Ver `docs/operations/match-authority-staging-2026-11-12.md`.

**Confiabilidade:** `services/match-authority/supabase.ts` e testes rejeitam qualquer staging ligado ao Supabase de produção. Configurações Wrangler pinam ambiente e não incluem cron de matchmaking até ativação. Observabilidade (Logs/Traces) amostrada preparada. CI de staging valida lint, tipos, cenários autoritativos, configurações de segurança, `wrangler --dry-run` e armazena bundle visível `disabled-match-authority-bundle`. Teste `verify` do run `43324528638` passou e gerou artifact `13993095343`. O job remoto de deploy não pode publicar o motor completo sem segredo `CLOUDFLARE_API_TOKEN` configurado em GitHub Secrets; a conta Cloudflare OAuth não transmite seu token para o GitHub, e o navegador do usuário não estava autenticado. Não criar token em logs, frontend ou commit.

**Moderação:** adicionada `drizzle/migrations/0080_private_moderation_reviews.sql` e teste SQL de RLS/ACL, identidade do denunciante, revisor ativo, aprovação com CAS, apelações independentes e trilha de auditoria. Reaproveita `public.support_tickets`; servidor deriva denunciado da sala, não de campo do navegador. `src/lib/moderation-review.functions.ts` expõe ações autenticadas de triagem, análise e apelação, mais lista privada de casos e decisões visíveis ao acusado. `SupportTicketForm.tsx` solicita associação automática da denúncia ao caso após gravação do ticket. **`MODERATION_REVIEW_ENABLED` é OFF por padrão**, sem moderadores habilitados, e nenhuma penalidade automática permanente é executada. A instalação da migração 0080 ocorreu apenas em PostgreSQL descartável do CI e **não foi aplicada à produção**.

**Continuação necessária, não mascarar como pronta:** secrets e isolamento de banco staging, publicar código completo de DO sem habilitar serviços, testes de duas conexões WSS e recuperação após reinício, admissão de espectadores, ligações de 2x2/torneios ao motor, painel de moderador com notificações, ativação autenticada de recursos, IA de equipe física/gráficos, validação de FPS real. Avaliar integralmente o Quality Gates no SHA exato antes do merge. Não afirmar benchmarking de dispositivos não testados.



## 25/11/2026 — checkpoint de continuidade

### GitHub / CI
- HEAD observado: ac2dd4065e93e48952bf2dbb4968b78ed28d3705; PR #132 convertido para Draft.
- CodeQL PASS; NPM audit de produção PASS; 43 suítes de aceitação PASS; 9-axis QA PASS; inventário automatizado de diff PASS.
- CodSpeed FAIL no HEAD atual. O resultado anterior 16/16 pertence ao HEAD cd919599 e não vale para ac2dd4.
- Quality gate, Lighthouse Mobile, evidência visual e startup diagnostics ainda precisam concluir no HEAD exato. Cancelamento não equivale a aprovação.
- Inventário automatizado cobre 1.154 arquivos e destaca 58 hotspots de revisão; isso não substitui revisão humana integral. A amostra da API de comparação GitHub é limitada.

### VPS / segurança
- UFW ativo, default deny de entrada; políticas INPUT IPv4/IPv6 DROP. Nginx e painéis observados em loopback; Tailscale ativo, 1/3 peers online, sem rotas anunciadas.
- SSH: root/password auth desabilitados, public-key only, forwarding desabilitado. Host keys RSA 3072, ECDSA 256 e Ed25519. RequiredRSASize 1024 permanece como hardening pendente.
- Docker socket root:docker 0660; grupo docker sem membros. jmadmin não está em docker nem video.
- SentinelX possui NOPASSWD ALL e serviço sem sandbox de filesystem; alteração bloqueada até definir substituição por broker/allowlist sem perder recuperação.
- Remote Desktop Commander roda como root e tem acesso amplo ao filesystem; hardening requer matriz de operações e teste de recuperação.
- Tracee usa host PID e capabilities eBPF amplas, mas rede none e rootfs read-only; revisar redução de capabilities sem quebrar coleta.
- Fail2ban/ClamAV têm erros históricos de inicialização/namespace, mas estão ativos. ClamAV 1.5.4, DB 28194 atualizado em 25/11.
- Certificado local de origin self-signed; certificado público válido até 19/02/2027. Revisar validação TLS do túnel Cloudflare.
- Staging atual está em fb07df1, não no HEAD ac2dd4. Não usar como evidência de QA do PR.

### Aplicação / navegador
- GET /api/health 200 e no-store; GET /api/public/football-assets 200, payload aproximado 2,23 MB.
- POST /api/public/sync-football sem segredo retorna 401. Endpoints internos support/email retornam 404 na produção observada; handlers do PR exigem autenticação cron.
- POST Stripe sem parâmetro de ambiente retorna 400 e não executa fulfillment.
- CSP efetiva ainda usa unsafe-inline/unsafe-eval; política estrita nonce está em report-only/opt-in.
- Chrome Stable 158.0.8127.88 configurado em perfil isolado; ANGLE/SwiftShader, WebGL2 e WebGPU compute smoke aprovados (16 resultados). É software renderer, não GPU física.

### Pendências bloqueadoras
- Diagnosticar CodSpeed FAIL no HEAD ac2dd4 e repetir ABBA.
- Completar Lighthouse Mobile e evidência visual sem cancelamento.
- Rebuild staging no SHA atual e executar navegação/formulários/estados de erro e partida 3D com Chrome.
- Decidir plano seguro para SentinelX NOPASSWD ALL; não remover sem substituto e rollback.
- Rever TLS do túnel, hardening de Tracee/Wazuh/Elastic/Coraza e sandbox systemd.
- Executar benchmark antivírus/ELF controlado.
- Manter engine determinística, stack gráfica e certificação física em aberto até prova.

## 25/11/2026 — retomada por evidência do PR #132

**Baseline da rodada:** `be8c85f6acc7b5072baa5e3bd96d6d3820ae9321`. PR em rascunho, 939 commits e 1.170 arquivos na auditoria inicial, com base `d84657717bd45d72d97e4c336a9f5f98ae2161ab`. O inventário automatizado do diff não equivale a revisão humana integral. As referências visuais históricas incluem o relatório Match 3D de 26/10 com comparações de atleta, uniforme, pose e enquadramento.

### Evidência remota da baseline

| Gate | Resultado verificado |
| --- | --- |
| Quality gates | [45724717936](https://github.com/davizeiro12345678/jogomanager/actions/runs/45724717936). Build, tipos, testes, construção, stress de 200 partidas nas duas revisões, replay SQL, Rust/WASM, bundle, contratos 3D, npm de produção e Lighthouse shell passaram. Lighthouse mobile e agregado reprovaram. |
| Lighthouse mobile | `/guias` 96/100/100, LCP 2.633/1.280/1.392 ms. O LCP foi o parágrafo de introdução. Uma amostra violou o mínimo de 97 e teto de 2.500 ms. [Relatórios brutos](https://github.com/davizeiro12345678/jogomanager/actions/runs/45724717936/artifacts/15074027847). |
| CodSpeed | [45724718106](https://github.com/davizeiro12345678/jogomanager/actions/runs/45724718106). As 16 medianas melhoraram ante `main`, com redução de 1,81% a 98,52%. `decodeReplay` teve uma subida isolada de p99 sem repetição. [ABBA bruto](https://github.com/davizeiro12345678/jogomanager/actions/runs/45724718106/artifacts/15073309049). |
| CodeQL | [45724717978](https://github.com/davizeiro12345678/jogomanager/actions/runs/45724717978) concluiu a análise. As threads #41 e #45 do transporte WebSocket seguem sem resolução comprovada. Rever os dois resultados depois de novo scan. |
| Visual e interação | [9-axis](https://github.com/davizeiro12345678/jogomanager/actions/runs/45724717945) gerou 29 capturas e um vídeo, com avisos de runtime, assets e moderação no preview anônimo. [Visual](https://github.com/davizeiro12345678/jogomanager/actions/runs/45724718053) e [lifecycle](https://github.com/davizeiro12345678/jogomanager/actions/runs/45724718077) passaram no ambiente desta execução. |

Os PRs relacionados foram revisados por estado e CI. #171/#174 já entraram na integração. #175 já entrou na `main`. #176/#177 e #172 têm evidência de falha em seus próprios heads. #178 fechou sem merge. A continuação reconciliou pontualmente a configuração do Stripe a partir de #165/#167.

### Implementação da candidata

| Área | Mudança e validação |
| --- | --- |
| Atletas e gramado | Cache de materiais em qualidade baixa reaproveita kits visualmente iguais. Troca de qualidade do gramado acompanha a propriedade real dos mapas de detalhe, inclusive quando albedo e roughness permanecem compartilhados. Regressão reproduzida com dois consumidores R3F. |
| Animação e replay | Recupera o relógio das ações dos formatos que o registram e apresenta o quadro terminal, incluindo o placar. Mantém a leitura de replays antigos. |
| Física | Cinco cenários de integração adicionais para contato varrido, altura, espelhamento, jogador expulso e regra legada. A revisão nova do modelo físico permanece pendente. |
| IA | Evita calcular distância da bola em decisões que não a consultam. ABBA local: −2,53% no legado e −3,65% no v2. 1.000 sementes pareadas, 1.000 recuperações e 3.000 checkpoints idênticos por comparação, inclusive RNG. Coordenação tática expandida segue pendente. |
| Carreira 3D | Se o módulo do estádio falhar ao carregar, usa o campo 2D já empregado pelo produto, mantendo o simulador e o botão de nova tentativa. |
| Lighthouse | Desktop conserva Archivo Black. Mobile usa a alternativa prevista e elimina 18.787 bytes transferidos de fonte em `/guias`. Baseline local pior de 2.659 ms e desempenho .95. Candidata local 2.197/1.492/1.148 ms e .98/1/1 em três medições válidas. Houve crash separado do Chrome local. A campanha oficial de cinco rotas continua obrigatória. |
| Dependências | Removido `r3f-perf` sem consumidor, junto com 20 entradas npm transitivas e sincronização Bun. Elimina a árvore antiga do Drei que exigia React 18/Fiber 8. `npm ci` limpo com 798 pacotes e `npm audit` com zero advisories reportados, incluindo dev. |
| WebSocket | O sinal `connected` só é emitido na transição de autenticação. Repetir o mesmo ready não reenvia o comando da UI. A origem já validada é reutilizada e 31 testes focados passaram. Alertas CodeQL requerem reanálise. |
| Stripe | Acesso estático ao valor público do Vite. O workflow busca a chave pública live no Worker correto, valida o formato antes do build e falha se estiver indisponível. 16 testes focados e contrato de build aprovados localmente. Sandbox e execução real do workflow seguem pendentes. |

### VPS, Supabase e navegação

- VPS `jm-fra-01`: 33 containers inventariados, 25 rodando e 8 parados. Dos rodando, 10 apareceram saudáveis na medição. O Studio Supabase parado estava antes unhealthy e encerrou com código 143. Foram observados 52 listeners TCP, limitados a loopback e Tailscale, e UFW com deny de entrada. SSH root/password/keyboard e forwarding desabilitados. TLS 1.3 com certificado público válido até 19/02/2027.
- A revisão atual encontrou SentinelX sem sudo, executando não-root com `ProtectSystem=strict` e `NoNewPrivileges=true`. O Gateway tem sudo amplo condicionado a senha e uma regra sem senha limitada. Remote Desktop Commander segue root com 39 capabilities no bounding set e filesystem amplo. Revisar perfil mínimo com acesso alternativo antes de alterar.
- Backup local executou com sucesso. Timer externo do Drive desabilitado, sem execução registrada na amostra. Restauração isolada não comprovada. APT cache indicou atualizações de segurança de libdw/libelf. CPU observada chegou a carga de cinco minutos 12,31 em 12 vCPUs, com pressão de 11,72% a 14,85% na amostra. Executar benchmarks pesados fora do VPS de operação.
- Chrome do VPS 158.0.8127.88, perfil temporário, WebGL 2 com ANGLE Vulkan/SwiftShader Subzero e pixel de teste esperado. O VPS não apresentou dispositivo de renderização DRM. Preview local em `fb07df1d18a988c184a348b773b7060f629f96a6`, página inicial HTTP 200 e `/health`/`/healthz` 404. As capturas e a interação deste preview pertencem a esse commit.
- Chrome público validou 34 destinos vinculados à home. Na partida rápida abriu opções, lances e atalhos, mudou câmera e velocidade e acionou pausa/retomada. A arena não inicializou no navegador público com WebGL desabilitado. Já no preview local da branch, com WebGL explicitamente desabilitado, o campo 2D desenhou pixels e o relógio avançou de 0 a 1 minuto a 8×, com zero exceções de página. A amostra mostrou baixo contraste dos jogadores de uniforme preto sobre o gramado 2D. Chat autenticado e a matriz completa de controles e duração continuam abertos.
- Supabase de produção retornou 26 apontamentos de superfície GraphQL anon, 49 authenticated e um aviso do RPC `mutate_player_career`. A migração filtra por `auth.uid()`, exige usuário autenticado e valida slot/revisão. Rever schema, grants e RLS em staging antes de alterar o contrato. O linter não confirma vazamento de linhas. Um alerta de desempenho aponta reavaliação em RLS de `coin_service_spends`.
- No preview Wrangler com SwiftShader e preset baixo, a partida rápida criou canvas WebGL 2, avançou do minuto 0 ao 5 a 8× e registrou zero exceções de página. Em harness isolado com o patch de carreira, duas falhas no download do estádio mantiveram o campo 2D funcional, com posições atualizadas e retry disponível.

### Itens ainda exigidos para release

- Gates do novo SHA, especialmente Lighthouse, CodSpeed, CodeQL e bundle. A proteção de `main` exige PR, threads resolvidas e gate crítico. A regra tem zero aprovações obrigatórias, por isso a revisão independente continua uma ação explícita.
- Completar preview fixado no novo SHA com sessões de teste, permissões, chat/multiplayer, decisões visuais em câmera próxima, matriz de iluminação e GPU física. Nenhum dos navegadores de auditoria fornece certificação física de 60 FPS.
- Rever a assinatura dos backups externos, restaurar em isolamento e planejar redução de privilégios do agente remoto. A homologação de autenticação, pagamentos e escopo dos advisors Supabase segue pendente.
- Manter física e IA avançadas em revisão não promovida até a cobertura de replay/autoridade, A/B de qualidade e orçamento de ticks. Merge e deploy aguardam todas as verificações e reversão homologada.

### Verificações da candidata `92dc60336bbb6e6c8fb36138afc2bd29e22035d4`

- TypeScript e lint dos arquivos alterados passaram. As suítes locais executadas durante a integração somaram 2.920 testes em 462 arquivos, com 47 testes focados repetidos depois de consolidar a candidata. O build de aplicação, build gráfico, orçamentos absolutos do bundle e 41 testes de performance passaram localmente.
- No Chrome local com a árvore da candidata e SwiftShader, o campo da partida rápida renderizou em WebGL 2. A partida avançou de 0′ a 2′ a 8×, a câmera mudou de TV para Tática, pausa/retomada e pausa pelo menu foram verificadas, e os lances abriram com eventos reais. Foi um teste anônimo em 1280×800, com zero exceções de página.
- Studio pareado produziu cinco capturas de base e cinco da candidata. O enquadramento do chute a 75% ainda mostra uma abertura no contorno interno do calção nas duas versões. Dezesseis caminhos KTX2 falharam em ambas, com material de fallback. O caminho de apresentação foi exercitado com SwiftShader.
- No Chrome do VPS, o preview `fb07df1` sorteou um confronto, iniciou a partida, desenhou atletas e estádio, avançou o relógio e a posse, e respondeu a pausa/retomada. Cinco texturas KTX2 retornaram 404 nesse staging. Uma das mesmas texturas respondeu 200 após o redirecionamento público. Câmera e finalização no VPS ficaram sem confirmação devido ao limite de execução.
- [CodeQL](https://github.com/davizeiro12345678/jogomanager/actions/runs/45732153533), [43 suítes de aceitação](https://github.com/davizeiro12345678/jogomanager/actions/runs/45732153378) e [QA nove eixos](https://github.com/davizeiro12345678/jogomanager/actions/runs/45732153375) concluíram com sucesso nessa candidata. O alerta do transporte requer fechamento explícito. A produção continuou `ready` em `d84657717bd45d72d97e4c336a9f5f98ae2161ab`, com autenticação, credenciais de servidor e banco operantes em `/api/health`.
- Permanecem abertos a revisão de contraste do 2D, a gramática de dois títulos de tabela, os ensaios em conta autenticada e hardware físico, a campanha controlada de detecção ELF e a comparação de modelos de triagem. Os resultados da rodada não promovem alterações nesses sistemas.

### Regressões do CI e correção de continuidade

- O [Lighthouse oficial da candidata `92dc603`](https://github.com/davizeiro12345678/jogomanager/actions/runs/45732153239/job/139616532098) aprovou `/guias` nas três amostras, com LCP de aproximadamente 1.278/1.295/1.289 ms e sem transferência de fontes. O gate das cinco rotas ainda reprovou. A home teve uma amostra de 2.548 ms e `/melhores-formacoes` uma de 2.670 ms com performance .95. As outras amostras das duas rotas ficaram abaixo de 1.613 ms. Os relatórios apontaram variação do atraso simulado de renderização. A home já pré-carrega o AVIF de 18,7 KB. A formação não teve atraso de recurso de LCP nem TBT. Os limites e a agregação pessimista permanecem.
- A primeira [execução pareada do CodSpeed em `92dc603`](https://github.com/davizeiro12345678/jogomanager/actions/runs/45732153510/job/139616533109) reprovou apenas a mediana de construção do `MatchSim`, +3,53%. A repetição do mesmo SHA [passou o gate](https://github.com/davizeiro12345678/jogomanager/actions/runs/45732153510/job/139618476410). O cenário foi tratado com margem de desempenho. `physiqueFor` agora avança diretamente as 29 amostras legadas, evitando montar atributos descartados. No ABBA local com Node 24.22.0, mesma árvore de dependências e fixture, a CPU mediana por construção caiu de 0,17031 para 0,11245 ms (−33,97%). Os 21 checkpoints ficaram idênticos e a campanha de 1.000 sementes e 1.000 recuperações manteve o mesmo digest. Confirmar CodSpeed no HEAD de continuidade.
- A comparação do bundle do Editor escolhia a primeira entrada por prefixo e passava a comparar wrapper e conteúdo quando o hash invertia a ordem. O gate agora compara o carregamento completo sem duplicar dependências, além das duas camadas quando presentes. O limite comprimido segue em 2.048 bytes. Quatro regressões RED/GREEN e 45 testes de performance passaram. No mesmo ambiente, o conteúdo caiu de 177.448 para 177.420 bytes gzip e o wrapper de 156.480 para 156.454 bytes. O formato de relatório legado de `main` também foi verificado.
- No preview do VPS, a rota de saúde do produto `/api/health` respondeu 200 e `ready`, com os três checks positivos. `/health` e `/healthz` não são as rotas de saúde do produto.

### Reteste de `a8646e2` e correção de primeira pintura

- O CI consolidou [2.920 testes, build, lint sem avisos e tipos](https://github.com/davizeiro12345678/jogomanager/actions/runs/45733123246/job/139619766200). Os dois stress de 200 partidas, bundle, SQL, WASM, análise CodeQL e QA de nove eixos aprovaram. O PR conserva threads abertas, inclusive duas da análise WebSocket.
- [CodSpeed](https://github.com/davizeiro12345678/jogomanager/actions/runs/45733122897): a primeira rodada aprovou os 16 benchmarks, com construção do `MatchSim` −51,73% e `decodeReplay` +2,16% na mediana. A repetição mediu −54,13% na construção e −20,99% na mediana de decodificação, mas repetiu picos p99 de 43,14/42,56 ms e reprovou. Duas tentativas isoladas de reduzir alocações no decoder foram descartadas depois do ABBA de 23.040 quadros. Uma piorou o p99 e a outra variou na cauda e aumentou a mediana nos dois pares. O gate não foi relaxado.
- [Lighthouse mobile](https://github.com/davizeiro12345678/jogomanager/actions/runs/45733123246/job/139619766153): `/guias` e `/guia-de-scouting` reprovaram com cerca de 2.679 ms e nota .95 em uma amostra de cada rota. Nas capturas lentas, o runtime editorial de cerca de 85 KB terminava de carregar antes do LCP observado. Nas rápidas, o LCP ocorria primeiro. O teste local mudou essa ordem e mediu `/guias` de 1.872 a 1.074–1.090 ms e scouting de 2.263 a 1.079 ms. A implementação adia a importação somente nos dois guias medidos, conserva a descoberta imediata nas demais rotas e libera o runtime quando a aba oculta. As três medições oficiais das cinco rotas seguem obrigatórias.
- O preview anônimo de `a8646e2` respondeu com sucesso nas 71 URLs percorridas a 390 px, sem erros de página, overflow acima de 4 px, botões visíveis sem rótulo detectado ou imagens sem `alt` na varredura. Trinta e quatro páginas já exibiam um H1 na amostra. O ensaio 3D usou Chrome com SwiftShader a 1280×800, verificou o avanço do placar/relógio, câmera tática, pausa/retomada, lances e o relatório de fim via salto. A verificação autenticada e a certificação física continuam abertas.

## 26/11/2026 — continuidade a partir de `679fbb5`

### Campanha oficial e GPU física

- A [campanha visual oficial](https://github.com/davizeiro12345678/jogomanager/actions/runs/45735252382) concluiu com sucesso para `679fbb5f76d488ffae371fc8ccaddacb7bdb2adb` contra `d84657717bd45d72d97e4c336a9f5f98ae2161ab`. O [arquivo de evidência](https://github.com/davizeiro12345678/jogomanager/actions/runs/45735252382/artifacts/15079278159) contém 44 capturas por revisão e seis vídeos pareados. As 291 entradas do ZIP passaram na verificação de integridade. O comparador registrou zero violações no protocolo avaliado.
- A renderização oficial usou ANGLE/SwiftShader. Os picos de submissões desktop mudaram de 158 para 255 no cenário baseline e de 240 para 320 no diretor. O cinema passou de 163.653 para 276.273 triângulos. Os tetos mobile aprovados no artefato não substituem a homologação de desempenho desktop. O executor não tem GPU física exposta. O VPS é KVM, com adaptador VGA virtual e sem nó DRM de renderização. A outra máquina conectada estava offline. A certificação física permanece pendente.

### Integridade e recuperação do backup externo

- Foi possível ler a cópia externa cifrada de 18/11. O tamanho de 15.282.008 bytes coincidiu com o Drive. O envelope age v1 foi reconhecido e o SHA-256 da cópia foi `ae77b2ee6bc3cc52a474a274e5ecc39882fa0c9ce4eafbbe587650eb242547d6`.
- A restauração depende de uma referência protegida à identidade age privada e de um destino limpo, isolado e autorizado. O executor tinha aproximadamente 17 GiB livres frente aos 20 GiB exigidos pelo procedimento semanal/incremental. O timer externo segue desabilitado. O backup local teve execução bem-sucedida em 26/11.

### Física e IA nos caminhos existentes

- Eliminei os arrays temporários das verificações finitas no contato varrido e na previsão de interceptação coletiva. No ABBA local com Node 24.22.0 e 4.096 pares de entradas, as medianas de CPU baixaram 3,97% e 2,58%. Foram 69 testes focados, incluindo 100 casos geométricos.
- Na comparação contra `679fbb5`, as quatro configurações testadas preservaram 1.000 sementes pareadas, 1.000 recuperações e 3.000 checkpoints por comparação, inclusive RNG. A física e a IA mantêm as regras existentes. Uma nova revisão requer versão acordada em `TeamSetup`, validação e seleção de perfil, mensagens e recuperação do Worker, snapshots/checkpoints/replay, partida rápida, sala ao vivo, autoridade canônica, Worker/cooperativo, REST e restrições SQL de sala e liquidação.
- Primeiro caso da física candidata: inverter a ordem de dois defensores a diferentes tempos de entrada e preservar o primeiro contato, com desempate por ID estável. Medir movimento relativo a partir dos endpoints reais por tick e estabelecer como os substeps do Rapier registram trave e altura. Primeiro caso da IA candidata: o atleta em movimento chega antes do atleta mais próximo e parado; a altura da bola e a reserva de setores entram antes do A/B. Preservar os defaults existentes e separar os dois ensaios.

### Contorno do calção no chute

- A barra agora dobra para dentro a partir das mesmas arestas indexadas do painel do calção e usa a mesma influência do fêmur. Substitui duas argolas independentes. O teste estrutural falhou nas três resoluções na base e passou com a geometria corrigida. A suíte focada de geometria, cobertura e movimento aprovou 38 testes.
- Comparação local a 75% da animação `shotPower`, de frente, de perfil e em três quartos, contra `679fbb5`. A linha destacada e a abertura pronunciada desapareceram. Ainda há uma sombra sob a coxa e uma pequena irregularidade no cós. A revisão visual independente confirmou perfil e três quartos. Na amostra de 35 chamadas, os triângulos foram de 289.800 a 287.880 (−0,66%); em 92 chamadas, de 579.834 a 575.994. Sem perda de contexto, com fallback para os mesmos 11 KTX2 em ambas as árvores. Evidência em Chromium/SwiftShader, sem confirmação em GPU física.

### Fluxos autenticados de staging

- A verificação local cobriu 90 testes em nove suítes de multiplayer, coop, chat, Stripe e webhook. Os cenários usaram fixtures com identidades sintéticas, incluindo dois clientes do motor de autoridade. A homologação remota com login real e Stripe em modo de teste precisa do staging isolado.
- `staging.jogomanager.com` exibiu o Worker sintético, sem `/api/health`. `app-staging.jogomanager.com` não respondeu com um build utilizável pelo executor. A branch isolada `staging-release-132` apresentou 82 registros de migração e oito tabelas analisadas com RLS habilitado, mas o painel ainda reportou `MIGRATIONS_FAILED`. Os cinco contratos do gerador do Worker privado passaram localmente. O catálogo do Stripe sandbox retornou 15 produtos ativos e zero objetos live. Essa leitura não comprova checkout, entrega de webhook ou liquidação.
- O DNS de `app-staging.jogomanager.com` não retornou A/AAAA/CNAME. Na conta Cloudflare, `jogomanager-web-staging` ainda não existe. O Worker de autoridade separado está desabilitado e sem vínculos de Supabase. O [workflow de staging](https://github.com/davizeiro12345678/jogomanager/actions/runs/45820229685) validou e executou o bundle desabilitado em loopback. O passo de publicação foi pulado porque a credencial de staging não estava disponível. Na base Supabase separada, sete funções críticas de moderação, fila, liquidação e webhook concedem execução a `service_role` e não aos papéis `anon` e `authenticated`.

### Matriz de iluminação replay/partida

- O build exato de `679fbb5` produziu 72 quadros em Chromium/SwiftShader a 1280×720, DPR 1. Duas câmeras (TV e em campo), dia/noite, seco/chuva, três presets e três fases (partida, gol, replay). As transições foram ancoradas no primeiro gol observado no Worker do navegador, tick 8.102. A matriz não mede FPS.
- No preset alto, parte das primeiras capturas usou fallback de texturas devido ao caminho de entrega KTX2 no executor. Os 47 KTX2 declarados foram recuperados da origem dos assets e tiveram assinatura de formato, tamanho e SHA-256 conferidos. A repetição com os bytes originais em cache local permite separar a avaliação dos materiais da falha de transporte. O replay em câmera de campo, dia e chuva, apresentou desfoque perceptível no preset alto. O plano de foco do replay requer comparação dedicada em cada câmera.
- O relatório consolidado contém 72 PNGs visíveis com hashes distintos e nove cenas de entrada, vestiário e negociação distribuídas pelos três presets. Três combinações de câmera próxima em alta usaram fallback procedural. Na de noite com chuva, a renderização normal mostrou campo e atletas com KTX2 originais no início, antes e depois do gol, com zero erros. As imagens quase pretas do avanço manual coincidiram com FOV não finito na câmera instrumentada.

### Verificações remotas da correção `7ccbd8a`

- [Quality gates](https://github.com/davizeiro12345678/jogomanager/actions/runs/45820249368) passou 13/13, incluindo Lighthouse multi-rota, build, bundle, tipos, testes, revisão SQL e ambos os stress de 200 partidas. [CodeQL](https://github.com/davizeiro12345678/jogomanager/actions/runs/45820249216), QA de nove eixos e as 43 suítes de aceitação concluíram.
- O [CodSpeed pareado](https://github.com/davizeiro12345678/jogomanager/actions/runs/45820249116) primeiro reprovou `decodeReplay` por +18,39% na mediana. Na repetição sem mudança de SHA, todas as 16 medianas foram menores (−4,57% a −98,56%), incluindo `decodeReplay` −15,50%. Os limites continuam iguais. A variação inicial merece acompanhamento em execuções futuras.
- O [ciclo de recursos](https://github.com/davizeiro12345678/jogomanager/actions/runs/45820249052) reprovou dois ensaios do mesmo SHA. Foram 37→38 texturas no quarto ciclo e 36→37 no primeiro. As outras cinco classes tiveram as mesmas contagens. A instrumentação local isolou a diferença em uploads KTX2 de 512×512 que terminam depois da amostra de aquecimento. A evidência não demonstra aumento cumulativo por ciclo.
- Foi preparado em worktree isolada um núcleo de contato candidato que seleciona pela menor fração de entrada relativa, considera altura e desempata por ID estável. O comparativo com v2 falhou em seis dos oito cenários e a candidata passou 47 testes. O núcleo segue fora do jogo e do PR até integrar movimentação por tick, substeps de trave, replay e autoridade.
- Um segundo núcleo isolado de IA estima chegadas dependentes da velocidade, aceleração, fadiga e altura jogável usando apenas o estado percebido. Cinco casos falharam no adaptador v2; 40 testes passaram na candidata. A seleção, cobertura por setor e avaliação A/B ainda precisam ser integradas ao motor versionado.

### Reforço de replay e WebSocket

- O decoder v3 agora monta os quadros diretamente com a forma legada ou com a forma visual. Preserva a ausência de `v` nos quadros antigos, os resultados e o contrato de compartilhamento dos dados visuais, sem tabela ou buffer novo. Dois ABBA locais pareados com 23.040 quadros e 250 amostras por passada mediram −10,49% e −4,96% nas medianas, −12,15% e −1,57% no p99. Os hashes dos resultados coincidiram. Os 25 testes de replay e revisão passaram. O gate remoto permanece obrigatório.
- O cliente autoritativo valida o quadro de handshake uma única vez. Validação de versão, limite de bytes, snapshot e sala precede a rejeição por assento divergente. O cliente bloqueia comandos após o recibo final aceito. Cinco regressões novas falharam na base e os 35 testes de transporte e apresentação passaram na candidata. A execução CodeQL nova precisa reavaliar as threads #41 e #46. Não houve supressão dos alertas.

### Ciclo de texturas após recuperação WebGL

- A fixture controlada usa um KTX2 real e uma ausência deliberada para exercitar transcodificação e fallback. Espera o upload confirmado antes de medir e conserva os limites por recurso, as cinco alternâncias, a perda forçada e as três reentradas. Com o motor da base, o canvas voltou a desenhar após a restauração, porém o ensaio expirou esperando as texturas comprimidas.
- Depois que o último canvas liberou a fila, a primeira aquisição com decoder iniciado agora notifica os materiais montados. A regressão cobre a troca entre donos compatíveis e a remontagem no mesmo tick. O ensaio em Chromium/SwiftShader manteve 35 texturas, três comprimidas em cada alternância de alta e zero comprimidas na baixa. Após a perda forçada e nas três reentradas, registrou 34 texturas, três comprimidas e zero erros. Os 15 testes de textura passaram. Essa validação continua em software.
- A revisão independente reproduziu a troca síncrona para um canvas com perfil de compressão diferente. A mudança de perfil podia descartar o decoder sem reenfileirar a textura. O guard agora observa o estado logo antes da inicialização, depois do descarte por perfil. O caso falhou em `0198e02` e passou com o ajuste, junto com 22 testes focados de texturas e replay.

### Reteste integrado e primeira pintura das formações

- A compactação em `a7c4871` preservou os 2.027.520 valores de posição da fixture, mas elevou a mediana de decodificação +120,59% e +179,76% nas duas rodadas oficiais. O ABBA local repetiu a piora. `d30091f` restaurou os arrays por quadro e preservou o fechamento do ombro e os testes adicionados em `a7c4871`.
- Em `d30091f` passaram 2.945 testes locais, lint, tipos, build, limite de bundle, [WebGL](https://github.com/davizeiro12345678/jogomanager/actions/runs/45826722378) e o [QA anônimo](https://github.com/davizeiro12345678/jogomanager/actions/runs/45826723941). Em duas rodadas do [CodSpeed](https://github.com/davizeiro12345678/jogomanager/actions/runs/45826722693), os 16 benchmarks passaram pelo limite do repositório. O `decodeReplay` melhorou 15,13% e 15,59% na mediana. O `encodeReplay` variou +2,18% na segunda. Os alertas CodeQL #41 e #46 foram encerrados. O #47 segue aberto na transição de autenticação.
- O reteste visual em Chromium/SwiftShader no `d30091f` produziu 12 imagens válidas. Revisitou as três combinações próximas em alta com KTX2 originais e a manga instanciada da comemoração em baixa. A comemoração em baixo detalhe ainda expõe duas pequenas áreas de pele na parte traseira do calção, acima da barra. Uma pose comparável de `679fbb5` apresenta o mesmo tipo de clipping.
- No [Lighthouse inicial de `d30091f`](https://github.com/davizeiro12345678/jogomanager/actions/runs/45826722570), `/melhores-formacoes` teve notas 96/98/96 e LCP 2.621/2.333/2.628 ms. O recurso de hidratação terminava antes da pintura do H1, com TBT e CLS zero. A correção aplica somente à rota a ordem de primeira pintura já usada nos guias. Em 3+3 ensaios locais, o pior LCP caiu de 2.791 para 1.072 ms. A mediana local foi de cerca de 915 para 1.071 ms. As três amostras corrigidas ficaram entre 1.068 e 1.072 ms, todas com nota 100. O gate oficial e seus limites continuam obrigatórios.
- Em outro 3+3 via CDP com CPU limitada em 4×, a mediana observada do H1 caiu de 152 para 136 ms. O runtime iniciou 24–31 ms depois do LCP nas três amostras corrigidas. O H1 do HTML, os destinos dos links e a ausência de exceções de página foram preservados.
- O reteste remoto de Lighthouse no mesmo `d30091f` aprovou os 15 registros e o gate agregado. A falha inicial continua registrada para documentar a variabilidade da ordem de carregamento.
- A candidata isolada da primeira pintura passou as 15 medições locais nas cinco rotas, com os limites do gate, Chromium e preview Wrangler em loopback. O pior LCP geral foi 1.596 ms, com nota mínima 99. Em `/melhores-formacoes`, o pior LCP foi 1.117 ms e as três notas foram 100.
- A [campanha de `d30091f`](https://github.com/davizeiro12345678/jogomanager/actions/runs/45826722494) foi cancelada após atualização concorrente do PR. O [artefato parcial](https://github.com/davizeiro12345678/jogomanager/actions/runs/45826722494/artifacts/15122252186) preservou 44 capturas e seis vídeos da base, 43 capturas e quatro vídeos brutos da candidata. A comparação e os vídeos pareados ficaram pendentes naquela execução. `e6f9bbf` integrou o ajuste da passagem da coxa pela frente do calção, com verificação de cobertura em dois LODs. O recorte posterior na comemoração requer um novo quadro pareado.

## Checkpoint comprovado — 26/11/2026 (PRs #132 e #179)

Este checkpoint substitui estados operacionais antigos, sem apagar o histórico. Não criar outro PR: #132 é a integração para main e #179 é a correção da auditoria destinada à integração. Ambos continuam Draft. Sem merge em main ou deploy.

### Evidências fechadas e critérios restantes

- [x] Confirmar produção: `/api/health` respondeu HTTP 200/ready com release `d84657717bd45d72d97e4c336a9f5f98ae2161ab`. Não certifica o candidato nem resolve a intermitência histórica de 503.
- [x] Validar a política Vite em processo real, no checkout isolado de `a54090bee9fdde44aacd5c7966036ef869b16a66`, bind loopback e sem credenciais de produção: host autorizado 200, host não autorizado 403, localhost 200 (Gateway job `job_01M8C1WQ5400QT7R0K26HWGEAT`, exit 0). Preview externo autenticado ainda pendente.
- [x] CI do SHA acima: npm ci, lint, tipos, Vitest, build, bundle absoluto/comparativo, replay SQL, Rust/WASM, duas suítes de stress de 200 partidas, contrato gráfico e MatchSim passaram no [Quality Gates 45830854917](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854917). Lighthouse mobile e gate agregado ainda não concluídos no momento da observação.
- [x] CodeQL [45830854794](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854794), 43 suítes [45830854544](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854544), nove eixos [45830854594](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854594), inventário independente automatizado [45830854781](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854781) e CodSpeed [45830854573](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830854573) passaram nesse SHA. Não equivale a revisão humana independente nem QA autenticado.
- [x] PR #179: remoção de skip link duplicado no GameShell, foco no conteúdo da carreira e disponibilidade 1x1/2x2 comunicada honestamente (`01fea245`); i18n em pt/en/es (`515e3c3`); comparador por grafo de imports, sem alterar orçamento de 2048 B (`eef1a388`). 35/35 testes locais de gates; [comparação real 45830207865](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830207865) passou no job bundle. O PR #179 ainda reprovou Lighthouse (home 0,92; TBT 320 ms) e CodSpeed [45830207885](https://github.com/davizeiro12345678/jogomanager/actions/runs/45830207885). Não está liberado para integrar.
- [x] VPS: oito patches originais instalados (Kerberos, libpcap, libtiff, runsc); gerenciador de patches ativo, reboot automático desligado; curadoria LMD corrigida com testes e hash da base preservado; On-Access 64→128 MiB no diretório de ingestão; SSH sem senha/root, serviços críticos ativos, zero unidades failed nas amostras. EICAR do daemon aprovado, prevenção acima de 64 MiB ainda não provada.
- [x] Backup local: 5/5 checksums, 1.034 entradas de configuração, restauração isolada do dump JogoManager com duas tabelas, instância encerrada e cópia temporária removida. Timer externo habilitado; nenhum upload confirmado.
- [ ] Backup externo: OAuth do Google Drive e verificação da recuperação criptográfica ausentes; manter gate, não fabricar marcador. Wazuh 4.14.11 pendente de backup restaurável do Indexer e upgrade coordenado dos três serviços centrais antes do agente.
- [ ] Autenticação real (OAuth/passkey/MFA/recuperação), Stripe sandbox/webhook/idempotência, persistência de carreiras, multiplayer 1x1 e 2x2 com dispositivos/assentos reais; staging isolado no SHA exato.
- [ ] UI: CLS auth observado 0,876 e loja 0,162 na produção em Chrome mobile; investigar causa e repetir medidas comparáveis; Lovable removido no código, não confirmado em produção.
- [ ] Match 3D: erro GL_INVALID_VALUE observado duas vezes em campanha anterior e não reproduzido na repetição; GPU stall persiste; simulação completa, benchmark físico, materiais/anatomia, animação, clipping, cutscenes, física e IA precisam de evidência comparável. SwiftShader não certifica FPS físico.
- [ ] Fechar Lighthouse, CodSpeed e QA visual no novo HEAD, revisar threads/alertas restantes (incluindo #47 mencionado anteriormente), validar CSP estrita, backup externo, rollback e revisão independente; só então considerar aprovação. Nenhuma alteração de limites, bypass ou deploy.

**Continuidade:** atualizar estes três arquivos existentes e a descrição dos PRs com evidência, sem marcar tarefas compostas como concluídas apenas por subtarefas. Não incluir IPs, caminhos pessoais, credenciais ou localização de usuário em evidência pública. Qualquer commit de documentação gera um novo SHA; revalidar os gates no novo head.

## Checkpoint P0/P1 — 26/11/2026, 11h06 BRT

- [x] PR #132, SHA `ac28fd521e8224dddc33dc7c9f7765f2a9288ebc`: Quality Gates [45833183094](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183094), CodSpeed [45833183163](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183163), CodeQL, 43 suítes e nove eixos aprovados nesse SHA.
- [x] PR #179, SHA `3872f4cdf71d06a0f6d2ece3c56a34f185195fde`: build, types, testes, bundle e stress aprovados. CodSpeed [45833354299](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833354299) inicialmente reprovou decodeReplay +15,47%; reteste no mesmo gate aprovado, 5,3276685 → 4,43962125 ms (−16,67%); fonte do codec idêntica ao #132 antes da nova correção. Preservar as duas amostras, sem alegar ganho causal.
- [x] P0: contagem incremental de bytes UTF-8 de replay, sem materializar histórico inteiro na estimativa. RED reproduziu buffer monolítico; GREEN confirmou igualdade de bytes com Unicode. No VPS, 23.280 frames e V2/V3 exatamente 187.119.120/176.761.024 bytes; teste integral 37,280 s (timeout original 30 s) → 21,420 s (aprovado). São duas amostras sob carga variável, não benchmark certificado. 94/94 testes em 12 arquivos, TypeScript e diff check aprovados. Gateway job `job_01M8C2SWQ700HE6N53V2TSVGAA`. Novo SHA requer CI próprio.
- [x] Contratos locais: OAuth/recuperação 30/30; passkeys 9/9; política/transporte 24/24; Stripe/webhook 13/13; multiplayer 7/7, incluindo quatro assentos sintéticos e reconexão. Não equivalem a validação autenticada de produção.
- [ ] Lighthouse #179: home 0,96, TBT 210,76 ms; outras duas amostras 1,00. Reteste solicitado, sem alterar metas. Evidência visual 3D dos dois PRs ainda em execução na coleta.
- [ ] Staging: verificada stack Supabase local em rede própria, restrita ao loopback; teste autenticado bloqueado pela ferramenta. Não contornar o bloqueio nem usar produção. OAuth real, MFA, passkeys físicas, persistência RLS, checkout sandbox e webhook ponta a ponta continuam pendentes.
- [ ] Backup externo: timer ativo, configuração OAuth e confirmação de recuperação ausentes; sem upload comprovado. Wazuh 4.14.11 depende de backup restaurável do Indexer. VPS com zero serviços failed; ClamAV preventivo ativo com 128 MiB; scanner de dez horas ainda em execução, não interrompido.
- [ ] Materiais/anatomia/animação/estádio, GPU stall, FPS/temperatura física, física/IA, CSP estrita, revisão independente, merge/deploy: não certificados. Nenhum novo PR e nenhuma mudança de produção.

## Continuação P0/P1 — 26/11/2026

- [x] Conferir resultados históricos do HEAD ac28fd52 (#132): 14 workflows concluídos com sucesso, incluindo [Quality gates](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183094), [CodSpeed](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183163), CodeQL e evidência visual. Não transferir aprovação ao próximo SHA.
- [x] Conferir HEAD a3a85002 (#179): [Quality gates](https://github.com/davizeiro12345678/jogomanager/actions/runs/45835885174) e [evidência visual](https://github.com/davizeiro12345678/jogomanager/actions/runs/45835885003) aprovados. [CodSpeed pareado](https://github.com/davizeiro12345678/jogomanager/actions/runs/45835884910) reprovado em cinco benchmarks (buildTeamSetup +18,30%, snapshotMatch +7,73%, decodeReplay +24,29%, Rust/WASM 64 +68,46%, Rust/WASM 16 +33,46%). Sem alteração de limiares. A diferença de código em relação à base inclui a estimativa de bytes de replay, mas não a implementação dos cinco kernels; causalidade ainda não demonstrada.
- [x] Corrigir três regressões do handshake WSS: ticket expirado antes do open, ready recebido após expiração e open duplicado. RED 3/3; GREEN 63/63 em cinco suítes (cliente, feed, protocolo, bridge e latência), ESLint focal, Prettier e diff check aprovados. A sessão deve renovar o ticket antes de aceitar estado oficial; não modificar autoridade de servidor.
- [ ] Reavaliar alerta CodeQL #47 e threads de revisão (11 abertas no #132 no momento da coleta). A correção acima fortalece o transporte, mas não comprova fechamento do alerta nem revisão independente.
- [ ] Homologação Supabase/Stripe: apenas projeto de produção acessível; não substituir staging independente por produção. Não foram executadas cobranças reais, migrações de produção ou testes com usuários reais.
- [ ] Backup externo: timer ativo, mas OAuth e confirmação criptográfica continuam ausentes. Sem upload comprovado; Wazuh 4.14.11 depende de backup restaurável do Indexer e upgrade coordenado.
- [ ] CodSpeed do #179, CI do próximo SHA, QA autenticado, desempenho em GPU física, materiais/animação e merge/deploy permanecem condicionados aos respectivos gates. Não criar outros PRs.

- [ ] Sincronização #179 com d2a6d4e: conflitos somente nos três planos, ambos os históricos preservados. Teste combinado local 77/78; prova integral do tamanho de replay calculou os bytes esperados, mas excedeu o limite original de 30 s (30.083 ms). Não mudar timeout; registrar falha, repetir em CI e investigar sob carga controlada. O PR permanece draft.


## Continuação P0/P1 — isolamento de evidências (26/11/2026)

- [x] Reproduzir e corrigir a leitura por links simbólicos no coletor graphics-source-snapshot: dois casos RED e três testes GREEN, incluindo caso normal. Restringir caminhos ao checkout, rejeitar symlinks e arquivos não regulares, usar descritor com O_NOFOLLOW e lista Git delimitada por NUL. Teste conectado ao CI cinematográfico. A corrida de troca concorrente de diretórios ancestrais por outro processo local não é certificada; executar em checkout isolado.
- [x] Conferir quatro workflows apontados por persistência de credenciais: cinematic-recovery, 43-acceptance, independent-diff-review e nine-axis já possuem persist-credentials: false no HEAD d2a6d4e. Nenhuma exceção do scanner adicionada.
- [ ] Fechamento dos alertas de scanners e revisão independente: revalidar no novo SHA; threads não resolvidas automaticamente. Alerta #47 não certificado.
- [ ] CodSpeed #179 bd77aadd: gate pareado 45841850637 reprovado em buildTeamSetup (+3,65%), decodeReplay (+17,26%) e fallback de rig 16 radial (+7,89%). Não alterar limiares nem imputar causa sem evidência. Bundle e shell Lighthouse passaram em ambos os PRs na coleta; Lighthouse mobile completo ainda em andamento.
- [ ] VPS: serviços críticos ativos, zero unidades failed, timer externo habilitado mas sem OAuth e comprovação criptográfica. Wazuh 4.14.11 aguarda backup restaurável. Gateway Free, saldo zero e contratação de backups restrita ao titular. Não publicar credenciais ou dados privados.
- [ ] Staging: apenas Supabase de produção listado; dois contextos Stripe de teste disponíveis, sem checkout real executado. Continuam pendentes autenticação, webhook, multiplayer real, GPU física e release. Não criar novos PRs, não publicar main.


## Continuação P0/P1 — inventário imutável de QA (26/11/2026)

- [x] No HEAD 46eee81e do #132, Quality Gates [45842832159](https://github.com/davizeiro12345678/jogomanager/actions/runs/45842832159), CodSpeed [45842832106](https://github.com/davizeiro12345678/jogomanager/actions/runs/45842832106), CodeQL, 43 suítes, nove eixos e diagnóstico de startup aprovados. Evidência visual ainda em execução na coleta; não transportar resultados para novo HEAD.
- [x] Remover leitura direta do checkout nos dois inventários do QA de nove eixos: apenas blobs regulares do SHA informado, com limite de bytes, sem seguir symlinks e sem ler conteúdo local alterado. RED módulo ausente, GREEN 4/4 incluindo dois testes existentes; sintaxe e diff check aprovados. Ensaio no histórico real: 576/576 fontes elegíveis lidas, zero omitidas. Adicionar testes ao CI existente. Revisão independente e confirmação do scanner ainda pendentes.
- [ ] PR #179 em b83a0d16: CodSpeed pareado [45843063830](https://github.com/davizeiro12345678/jogomanager/actions/runs/45843063830) reprovado em decodeReplay (+18,56%, 4,366291 para 5,176627 ms). Manter limites; não declarar regressão causal sem isolar a diferença de código e repetir em ambiente comparável.
- [ ] VPS: zero unidades failed, SSH efetivo RSA mínimo 2048, serviços essenciais ativos. Timer externo ativo mas OAuth e verificação criptográfica ausentes; sem transferência confirmada. Wazuh aguarda backup do Indexer. A varredura longa está executando; não interromper para alterar política de timeout.
- [ ] Gateway: plano Free e saldo zero confirmados; titular precisa contratar Pro/recarga no painel. Ops bundle incluído no Pro, não comprar redundância. Sem pagamento efetuado.
- [ ] Homologação autenticada, Stripe sandbox, multiplayer real, GPU física, revisão dos alertas, CSP efetiva e deploy continuam pendentes. Manter #132 e #179; nenhum novo PR nem alteração em main.

## Homologação retomada em 26/11/2026

- A [campanha visual de ac28fd5](https://github.com/davizeiro12345678/jogomanager/actions/runs/45833183182/artifacts/15126546021) encerrou com 44 capturas e seis vídeos em cada revisão, seis vídeos pareados, zero violações do comparador e um 404 de console em cada revisão. O WebGL2 usou SwiftShader. A [campanha seguinte](https://github.com/davizeiro12345678/jogomanager/actions/runs/45842831710) foi cancelada na captura da base.
- Em 46eee81, as medianas dos 16 benchmarks [CodSpeed](https://github.com/davizeiro12345678/jogomanager/actions/runs/45842832106/artifacts/15129791769) caíram de 4,14% a 98,56% contra main, incluindo 15,47% em decodeReplay. O [check nativo CodeQL](https://github.com/davizeiro12345678/jogomanager/runs/139990070339) registrou 13 alertas no diff, embora o job de análise tenha terminado. O alerta #47 e a revisão independente continuam pendentes.
- No Chrome 158 do VPS, em 390×844, o maior CLS válido observado em produção foi 0,888 no login e 0,162 na loja. O cartão de login centralizado se deslocava quando chegavam os métodos de entrada. O aviso de visitante deslocava a carteira na loja. Na candidata, a borda superior do formulário fica estável no celular e o painel da loja reserva o espaço de identificação. Em três carregamentos frios por rota e revisão com Chromium, CPU a 4× e os mesmos serviços simulados, o CLS máximo caiu de 0,7573 para 0,0468 no login e de 0,1436 para 0,0133 na loja. A versão publicada em produção ainda é d846577.
- No calção instanciado da comemoração, a correção amplia a folga do tecido sobre a coxa. No quadro congelado do gol no tick 8102, os pixels de pele dentro dos dois painéis inferiores passaram de 56 para zero, com 53 chamadas de desenho e 110.260 triângulos em ambas as capturas. Nove biotipos e 33.150 amostras válidas produziram 1.878 interseções antes e zero depois. A homologação em GPU física segue aberta.
- O transporte revalida o vencimento do ticket antes de entregar atualizações passivas e depois de persistir a entrada na partida. O cliente também verifica essa validade antes de exibir um quadro recebido após suspensão da aba. Passaram 219 testes em 26 suítes de transporte. Na evolução de temporada, a escrita por ID preserva propriedades próprias e o JSON final das 80 simulações comparadas coincidiu com a base.
- O staging privado do VPS voltou a responder com saúde ready no build fb07df1. Cadastro, login por senha e abertura de chat com identidade de teste passaram nesse build. Esses resultados cobrem a revisão antiga. Permanecem abertas a homologação autenticada do candidato, a entrega de mensagem entre clientes, as partidas online, o Stripe sandbox, a restauração externa e a decisão de release.
- O estúdio de QA agora prepara as texturas públicas a partir dos manifestos do Git no servidor de teste local. As 15 URLs que retornavam 404 passaram a retornar 200 com assinatura KTX2. Os 47 objetos somaram 4.773.629 bytes. Em 390×844 e 1280×800 também passaram navegação loja → login com retorno ao produto, alternância de visibilidade da senha, recuperação e cadastro em browser com API de teste. O caminho de checkout requer homologação de ponta a ponta no Stripe sandbox.


## Continuação P0/P1/P2 — integridade e diagnóstico das texturas (26/11/2026)

- [x] Reproduzir falha do QA de nove eixos do HEAD 7ec779c5: [run 45846818641](https://github.com/davizeiro12345678/jogomanager/actions/runs/45846818641), HTTP 403 ao baixar KTX2. Sondagem independente do VPS confirmou 302 do domínio principal para football-manager.app e 403 no destino; conector Cloudflare não lista essa zona. Não desativar WAF nem contornar controle de acesso.
- [x] Reforçar preparação de fixtures: validar OID Git, limitar manifesto a 64 KiB e textura a 16 MiB, identificar arquivo/host/status HTTP sem imprimir URL completa e remover temporário após falha. TDD isolado: 4/5 RED e 5/5 GREEN; teste conectado ao workflow existente. A primeira execução RED fez uma solicitação pública incidental; repetição corrigida usou mocks de rede.
- [ ] P0: restaurar entrega autorizada das texturas reais e executar nove eixos no SHA novo. Não substituir por imagens fictícias nem ignorar 403.
- [ ] P0: PR #179 6fa4bf09 [CodSpeed 45844733604](https://github.com/davizeiro12345678/jogomanager/actions/runs/45844733604) falhou em MatchSim (+8,96%); causa ainda não comprovada. Preservar limites e revisar novo SHA.
- [ ] P0/P1: staging autenticado, Stripe sandbox, backup externo restaurável, Wazuh coordenado, CodeQL nativo e GPU física seguem pendentes. P2: confirmar CLS, acessibilidade, textos e carregamentos em candidato publicado de homologação. Sem merge em main ou deploy.


## Continuação P0/P1 — homologação remota dos contratos SQL (26/11/2026)

- [x] Localizar branch Supabase staging-release-132, isolada e with_data=false. Consulta SQL funciona apesar do status histórico MIGRATIONS_FAILED e get_project retornar not found; não alterar ou usar produção.
- [x] Executar contratos do SHA b1619cd no preview remoto com BEGIN/ROLLBACK: atomic-match-room, cooperative-match-roster, authoritative-match-settlement, private-matchmaking-queue, match_contact_revision e room-authority-fencing. Todos passaram.
- [x] RED atomic-ranked-match-allocation: 42501 na tentativa de UPDATE direto em sala websocket; proteção correta. GREEN: fixture usa RPC de liquidação para schema 0077+, exige rejeição do UPDATE direto, preserva verificação antiga para 0075. O contrato corrigido passou no preview remoto. Sete contratos SQL aprovados.
- [x] Verificação após rollback: 0 auth.users, salas, queue, pairs, resultados, ratings e crons ativos; 78 tabelas públicas, todas com RLS. O fencing testa permissões temporárias apenas dentro da transação descartada.
- [ ] CI do novo SHA, replay legado 0075, testes autenticados em browser, clientes reais 1x1/2x2, passkey, Stripe sandbox, deploy e recuperação externa permanecem pendentes. O sucesso SQL não certifica esses fluxos.


## Continuação P1/P2 — integridade de medições (26/11/2026)

- [x] P1: comparador de campanhas rejeita renderizadores software conhecidos (SwiftShader, llvmpipe, WARP, entre outros) e modo headless/vídeo não explicitamente falso. Adiciona p50 e 0,1% low ao resumo sem alterar limiares. Não constitui atestação de hardware físico.
- [x] P2: TTFB quente exclui a primeira tentativa por posição cronológica, mesmo se a resposta inicial falhar; contadores de cabeçalhos usam mapas sem protótipo. Não altera endpoints nem volume de requisições.
- [x] RED reproduzido para ambos; GREEN 7/7 testes de campanhas, autoteste TTFB e sintaxe Node 24.22.1 aprovados em arquivos isolados no VPS. Primeira tentativa sem Node no PATH não é evidência de falha de código. CI completo ainda pendente.
- [ ] P0: QA de nove eixos do SHA 5f12d7dc reprovou na preparação de texturas reais (HTTP 403); não contornar WAF. Staging autenticado, Stripe, GPU física, backup externo, Wazuh, revisão e release permanecem condicionados aos gates existentes. Não abrir novo PR, não publicar main.

### Reteste no VPS e na CI, 26/11

- No Chrome do VPS, o Worker efêmero de 7ec779c abriu o lobby autenticado com os controles de criação/entrada e recebeu a lista de salas. No build 46e7d27 houve cadastro, login e leitura do chat com a identidade de teste. O painel de loja no 7ec779c expôs dois erros no Supabase self-hosted do staging, distintos do preview hospedado com as sete verificações SQL. A consulta do catálogo falhou com 42501 para a coluna pública contents, e a consulta da carteira com 42703 por ausência de colunas da carteira. Um clone sem dados reproduziu os problemas com o esquema e os privilégios das tabelas. A aplicação transacional das migrações Drizzle 0043–0047 permitiu ambas as consultas sob authenticated, preservou RLS e a restrição de stripe_lookup_key. O ROLLBACK restituiu o estado inicial do clone.
- Em [7ec779c](https://github.com/davizeiro12345678/jogomanager/commit/7ec779c5e0977590c9c04d7b9255cee8d23b0765), o check nativo [CodeQL](https://github.com/davizeiro12345678/jogomanager/runs/140004044122) caiu de 13 para 11 anotações no diff. O inventário npm reportou zero advisories nas dependências instaladas. O [CodSpeed](https://github.com/davizeiro12345678/jogomanager/actions/runs/45846818881/artifacts/15130384489) reprovou somente decodeReplay (+5,72% na mediana). O lote preservou os bytes do codec e da fixture. No [ensaio de 5f12d7d](https://github.com/davizeiro12345678/jogomanager/actions/runs/45848100336/artifacts/15132301224) passaram todos os 16 benchmarks, com medianas de −4,40% a −98,84% e decodeReplay a −8,46%. Cada medição vale para sua revisão.
- A CI de 7ec779c também sinalizou dois textos novos da loja fora do catálogo de tradução e recebeu HTTP 403 ao buscar uma textura pública. O painel de identificação da loja agora usa o catálogo local em português, inglês e espanhol, com o fallback de idioma do projeto. Os controles de login, retorno ao produto, visibilidade da senha, recuperação e cadastro passaram no navegador nos três idiomas da loja. A auditoria de materiais usa as 47 texturas originais versionadas em fixtures, compara UUID, tamanho, assinatura e SHA-256 e serve o Studio em loopback. A verificação de disponibilidade do CDN continua independente.
- A captura frontal em repouso do estúdio também confirmou a correção do calção. O recorte de pele caiu de 348 para zero pixels no mesmo quadro, com 17 chamadas de desenho e 2.500 triângulos nas duas revisões.
- A restauração externa segue sem execução. O arquivo age/X25519 de 18/11 corresponde a 15.282.008 bytes. O timer externo está habilitado, sem último disparo na consulta de 26/11. A cópia local terminou com código zero. A recuperação externa precisa da identidade de descriptografia correspondente em destino isolado. A homologação de GPU física permanece pendente.
- Nas dez anotações de mapas de carreira e competições, a candidata passou a materializar registros a partir de entradas próprias e a acumular a classificação do Mundial uma vez por histórico. A comparação produziu 512 resultados idênticos aos da base. No último A/B local, o cálculo do Mundial passou de 0,104 para 0,052 ms. O resultado do novo check nativo do GitHub continua necessário.
- Um experimento de pressão identificou uma incompatibilidade da revisão física 2 entre os raios de alcance do defensor e a separação entre os corpos. Em 120 partidas esse caminho produziu zero retomadas e zero faltas. O perfil candidato, ainda em ensaio, produziu 1.964 retomadas, 559 faltas, 138 amarelos, 21 vermelhos e 149 gols contra 146 da base. A IA de perseguição candidata chegou antes à bola em 114 de 120 cenários pareados, com seis empates. São medidas de cenários definidos e a homologação de balanceamento e desempenho integral segue aberta.
- Após cancelamentos sucessivos durante a captura da base ou da candidata, o workflow visual passa a deixar terminar o par que já começou. O grupo mantém a fila padrão de uma revisão pendente e mantém a comparação com o SHA exato antes de aprovar a entrega.

### Campanha de materiais e testes de sessão de 26/11

- O [QA oficial de 26e4881](https://github.com/davizeiro12345678/jogomanager/actions/runs/45850397360/artifacts/15133147705) conferiu os 47 materiais, entregou 29 imagens e um vídeo, registrou zero críticos e zero falhas de rede. A partida rápida passou em quatro larguras. O relatório ainda registrou 23 avisos de runtime na prévia sem credenciais e um aviso da entrada anônima de moderação. O [CodSpeed do mesmo SHA](https://github.com/davizeiro12345678/jogomanager/actions/runs/45850397748/artifacts/15133576762) mediu 16 medianas menores, de −2,97% a −98,82% contra main, decodeReplay −6,99%. O [CodeQL nativo](https://github.com/davizeiro12345678/jogomanager/runs/140016258437) caiu de 11 para dois alertas no diff.
- Duas sessões reais de Chrome no staging self-hosted criaram uma sala privada, entraram pelo código e confirmaram o estado ready com os dois assentos esperados. O Realtime recusou o canal privado antes da primeira mensagem. A política anterior só admitia o formato de uma mensagem de aplicação e não admitia a leitura de sondagem vazia usada pelo serviço para autorizar a entrada. A política de SELECT candidata exige sala ativa, membro autenticado e igualdade de tópico. No clone, as sondagens de anfitrião e visitante passaram de zero para uma linha; terceiros e salas encerradas continuaram sem leitura. O cliente encerra cada canal uma única vez, inclusive ao receber CLOSED durante o encerramento. As identidades de teste foram removidas.
- O Checkout hospedado da sandbox Onze Interactive concluiu uma compra de teste de R$ 4,90. Uma sessão, um PaymentIntent e uma cobrança foram correlacionados aos três eventos de conclusão. Reabrir a sessão paga não gerou nova cobrança. A entrega ao endpoint do jogo e o crédito idempotente de moedas ainda dependem da configuração de staging.
- Física e IA v3 ficaram preservadas na [branch de experimento](https://github.com/davizeiro12345678/jogomanager/commit/b216ba9499b9f7700f9be37c2bcdd9c0e2c3cec5). Os dois perfis funcionam juntos por opção explícita no Worker local, no replay e na recuperação. O candidato passou 2.980 testes e os dois stress de 200 partidas com respectivos replays. Na medição local de 60 pares por perfil, a mediana da v2 passou de 366,386 para 370,656 ms (+1,17%). O novo perfil não foi promovido à integração.
- O staging self-hosted recebeu a migração de leitura da sondagem na trilha Supabase em 26/11. No Chrome do VPS, duas contas distintas abriram a mesma sala privada, entraram pelo código e alcançaram o estado ready. O anfitrião enviou uma mensagem pelo formulário da sala e o convidado recebeu o texto exato; cada sessão teve uma resposta Realtime OK e zero recusas. Este ensaio completo usou a aplicação fb07df1. A revisão 7ec779c foi validada separadamente para cadastro, login e abertura do lobby. Partida até o apito final e 2×2 precisam de ensaio próprio.
- O botão de moderação de um visitante agora conduz ao login e preserva o retorno a /contato#moderacao. A prévia anônima sem Supabase mostra uma indisponibilidade explícita. No build local configurado, a rota de login apresentou formulário funcional e a volta reabriu a seção, sem expor dados privados de moderação.
- O orçamento oficial de JavaScript inicial da partida falhou em 26e4881. A janela da loja/chat passa a ser carregada na primeira abertura. Em ff8c49b, a medição local do JavaScript inicial foi de 580.180 para 579.176 bytes gzip. A soma de todos os chunks gzip aumentou 3.571 bytes. O comparador do repositório passou e os controles de teclado, fechamento e retorno de foco passaram em Chromium desktop e mobile.
- No preview Supabase isolado, o pacote coins_starter do catálogo custa 490 centavos e concede 200 moedas. Com uma carteira de teste inicialmente zerada, as funções reais do webhook registraram a compra e o evento. Repetir o evento e tentar novamente o crédito com a mesma referência retornou falso nas duas operações. O saldo final foi 200, com uma compra e um evento concluídos. O rollback deixou zero contas, carteiras, compras e eventos da fixture. O transporte entre a sandbox do Stripe e o endpoint de staging continua sem comprovação.
- A repetição de 1.024 casos de desenvolvimento dos atletas, incluindo 512 chaves de saves antigos, preservou os resultados após a correção da escrita em mapa. No handshake, uma mensagem válida podia chegar após o prazo se a aba suspendesse os temporizadores. A recepção agora aceita 4.999 ms e fecha aos 5.000/5.001 ms antes de alterar a partida. A análise nativa do GitHub deve ser consultada no commit entregue.
- A [campanha visual de 16221611](https://github.com/davizeiro12345678/jogomanager/actions/runs/45849662625/artifacts/15135107716) concluiu com 44 imagens e seis vídeos por revisão, seis pares e zero violações. Houve uma mensagem HTTP 404 de console nas duas revisões. O ZIP tem 50.808.293 bytes e SHA-256 ce37c5d8c9528eccfa1bef753399959abd91dee2b2ee8ad4c4b61fc2b1ac6d9e. O renderizador foi SwiftShader.
- No build integrado a ff0f4dac, o orçamento do carregamento real de /match inclui o código de entrada e a página, contando uma vez as dependências compartilhadas. O método anterior podia medir só a entrada, ou deixar de somá-la à página. Com carregamento sob demanda de loja, chat, gestão da equipe e títulos de conquistas, o resultado local foi 578.629 bytes gzip e 548.456 Brotli, contra 578.085 e 548.119 da base. Os limites de +2.048 bytes foram preservados. O SHA ff0f4dac teve as 16 medianas do CodSpeed menores, mas reprovou no p99 de decodeReplay nos dois pares. A execução do commit entregue continua necessária.
- Leitura do VPS de 12h55 a 13h06 de Brasília, 26/11. A aplicação no loopback respondeu 200. Sete serviços centrais tinham zero reinícios e zero OOM. As 48 escutas TCP de loopback e quatro de Tailscale não expunham uma porta TCP direta pública. SSH limitava acesso a chave, com root e senha desativados. O TLS público de jogomanager.com negociou TLS 1.3 com validade até 19/02/2027. Em 24h, cinco unidades de segurança tiveram seis falhas, quatro haviam retomado e a varredura integral seguia ativa após timeout. Studio administrativo parado com saída 143. A cópia local verificou três bancos; o serviço externo foi ignorado por falta do marcador de validação do destino cifrado. O host mostrou apenas vídeo virtual, pressão de CPU de 37,87% em 60 s e steal de 24,7% em uma amostra de dois segundos. As medições nesse host não homologam frame time em hardware físico.

### Carreira de visitante e auditoria de páginas

- No [QA oficial de 18ec496c](https://github.com/davizeiro12345678/jogomanager/actions/runs/45855846210/artifacts/15135408248), as quatro capturas do login sem Supabase mostraram o aviso de indisponibilidade e o retorno ao jogo. Foram 23 avisos de runtime e zero erros críticos. O CodeQL desse SHA apontou um alerta na transição local de confirmação do WebSocket. O CodSpeed pareado reprovou nas medianas de encodeReplay e decodeReplay. O commit c7017148 restaurou a implementação anterior do decoder.
- No VPS, dois navegadores com o frontend 18ec496c e API fb07df1 ocuparam a mesma sala em estado ready e receberam a mensagem privada exata, sem recusa do Realtime. Esse ensaio cobre o cliente novo com a API de staging identificada.
- Em Chromium, a carreira do visitante criada pelos quatro passos de /new terminava uma partida e voltava à central ainda na rodada 1. O candidato corrige a gravação local quando o backend de autenticação está sem configuração. Após recarregar /club, as duas cópias do localStorage e o IndexedDB apontaram rodada 2, um resultado e uma conquista. O snapshot v2 coincidiu com o IndexedDB. A inscrição de autenticação continua obrigatória para gravar em nome de uma conta.
- Em desktop e celular, o painel de gestão abriu pelo teclado, preservou a seleção ao fechar e reabrir e registrou a substituição em 1/5. A auditoria também encontrou queda da política de privacidade e uma rejeição sem tratamento no ranking do perfil quando Supabase está indisponível. Os componentes opcionais passam a limitar a falha à funcionalidade afetada. Os seletores do editor passam a usar seus rótulos visíveis.
- O [contrato SQL de compra](../../../tests/sql/store-fulfillment-idempotency-contract.sql) exercitou os registros de evento e compra, cinco saldos e um tema em transação revertida no preview hospedado. O controle com 400 moedas esperadas falhou na asserção. O banco voltou a zero fixtures.
<!-- audit-verified-20261126-p0p1p2 -->
## Checkpoint auditável — 26/11/2026, após merge do #132

Este registro substitui estados operacionais antigos, sem apagá-los. As validações locais abaixo pertencem ao código corrigido; qualquer commit posterior requer novos checks no SHA exato.

- [x] PR #132 já mesclado na main: merge `c449875f20a1093a31929c114d8274a998eea42e`; referências anteriores a Draft são históricas. PR #179 continua aberto em Draft, sem merge e sem deploy deste conjunto.
- [x] PR #179: corrigida a localização do texto introdutório do multiplayer, do link de autenticação e do retorno ao dashboard, preservando os rótulos honestos 1x1 e 2x2 pendente em português, inglês e espanhol. Implementação inicial em `3ef7fb2ddcebd555711942e2a14b550efab36299`; formatação revisada nesta continuação.
- [x] Checkout de QA isolado no VPS, Node 24.22.1: cinco testes Vitest focados, seis testes Node de bundle, Prettier, ESLint e TypeScript sem erros. Nenhum limite de desempenho foi alterado. O Chrome 158 do VPS executou smoke test headless de um preview anterior; essa observação não certifica o novo HEAD.
- [~] Dezesseis operações de inspeção read-only solicitadas em paralelo no Gateway Pro: 11 aprovaram e cinco falharam por indisponibilidade do executor ou resultado inválido. UFW ativo com entrada deny, zero unidades systemd failed, 33 containers observados, 334 GB disponíveis no filesystem raiz, wazuh-agent retido. Falhas de inspeção não são prova de falha do host.
- [~] Stripe sandbox: 15 produtos ativos e dois endpoints de webhook habilitados, ambos encaminhados a serviços Lovable; integração ponta a ponta com fulfillment/idempotência não certificada. Supabase disponibiliza somente o projeto de produção neste conector.
- [ ] P0: confirmar CI completo, Lighthouse e CodSpeed comparáveis do SHA final; validar checkout/webhook/idempotência, autenticação real, persistência autenticada, backup externo restaurável e rollback em ambiente isolado antes da liberação.
- [ ] P1: validar multiplayer 1x1 e 2x2 com usuários/dispositivos reais, hardening VPS/Wazuh condicionado ao backup, CSP efetiva, CodeQL pendente e gráficos/performance em GPU física.
- [ ] P2: verificar a correção internacionalizada em preview publicado no SHA final e em dispositivos móveis. Não transferir testes visuais do preview anterior.
- [ ] Não efetuar deploy, merge do #179, force-push, cobrança real, migração em produção nem marcar gates como aprovados sem evidências correspondentes.
<!-- /audit-verified-20261126-p0p1p2 -->

<!-- auth-preview-missing-config-20261126 -->
### Continuação da autenticação do preview — 26/11/2026

- [x] **Diagnóstico reproduzido no SHA 7b37970c:** /auth do preview respondeu HTTP 200, mas a interface exibiu o ErrorComponent de raiz. O Chrome CDP capturou: `Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY`; /api/health do mesmo preview retornou HTTP 503 com `failureStage=missing_configuration` e verificações auth/serverCredentials/database falsas. A produção, isoladamente, respondeu HTTP 200/ready. Não confundir compilação Vite e bindings do Worker.
- [x] **Correção de degradação segura no PR #179:** /auth não monta o formulário quando `getConfiguredSupabaseClient()` não encontra configuração; mostra indisponibilidade e navegação pública, sem abrir sessão nem recorrer a credenciais de produção. Teste RED: 1 falha esperada/6 aprovações; GREEN: 7/7, Prettier, ESLint e TypeScript aprovados no checkout isolado. Não é conserto do login real.
- [ ] **P0 homologação:** configurar um projeto Supabase de staging isolado com URL e chave publicável durante o build do Vite, mais os bindings privados apropriados do Worker; executar smoke test com identidades de teste, OAuth/passkey/MFA, saúde da API e fallback seguro. Apenas um projeto Supabase de produção aparece no conector; nenhum segredo foi copiado para staging.
- [ ] **Gates finais:** CI, CodSpeed pareado, Lighthouse, QA visual no novo commit e 1×1/2×2 real permanecem bloqueadores do merge; sem mudanças de produção ou alteração de limiares.
<!-- /auth-preview-missing-config-20261126 -->

### Retomada após o merge do #132 — 26/11/2026

- [x] Conciliar o #179 com a `main` `c2eec81a`, preservando os dois históricos e adotando o comparador de bundle por grafo de hidratação já integrado. Preservar rótulos do multiplayer e navegação acessível corrigida no #179.
- [x] Mostrar retorno e entrada como convidado no estado localizado de autenticação sem configuração. O teste de rota cobre os dois destinos e a ausência do formulário.
- [ ] Aprovar gates desse candidato e homologar OAuth, passkey, cobrança sandbox e persistência. Confirmar recuperação externa, upgrade coordenado do Wazuh e GPU física.


## Checkpoint de acessibilidade e homologação do PR #179 — 26/11/2026

- [x] PR #132 confirmado como merged em main às 18:10:56 UTC, HEAD histórico `06affc34932f5eafc264e517893bcad590c2662d`; não o reabrir. As instruções históricas de não merge acima são registros dos checkpoints anteriores.
- [x] PR #179 permanece aberto em Draft na branch `fix/audit-vps-ui-20261126`. A Home, os estilos de carreira, o Match e as folhas específicas já possuem mudanças extensas nessa branch; não duplicar refatoração.
- [x] P2: corrigida a truncagem visual do nome de treinador no rodapé da sidebar, causada por `max-width: 155px`, `white-space: nowrap` e `text-overflow: ellipsis`. Override localizado em `src/components/game/career-typography-shell.css` preserva nomes longos com zoom de texto, sem mudar o layout do Match 3D. Teste de regressão acrescentado em `career-interface-accessibility.test.ts`. Commits `25867894` e `d1a361eb`; arquivos confirmados pela API GitHub. Execução do teste e validação visual ainda pendentes.
- [ ] P0: CI e CodSpeed do HEAD final, comparações equivalentes; Lighthouse mobile e bundle. Checks anteriores não certificam este HEAD.
- [ ] P0: Stripe Sandbox autenticado, passkeys/Auth, multiplayer físico 1×1 e arquitetura 2×2, backup externo criptografado com restauração isolada.
- [ ] P1: QA visual dos componentes de carreira (320/390/768/1280 px, 200%/400% zoom, teclado, leitor de tela, contraste forçado, movimento reduzido), Textures/Match 3D em GPU física, Wazuh e revisão CodeQL.
- [ ] P1: revisão humana independente, evidências reais de staging no SHA final e rollback testado. Não converter #179 em Ready, não mesclar ou publicar sem gates.


## Checkpoint de CSS, acessibilidade e CI do PR #179 — 26/11/2026, 18h

- [x] P0: corrigido o único erro de lint observado no job 140171155800 (linha em branco no teste de acessibilidade), commit `155677e3`.
- [x] P1: removidas referências cíclicas de `--background` e `--card` no alto contraste da carreira; superfícies explícitas e teste de regressão (`9b0d342b`, `0a865bdc`).
- [x] P2: grade de indicadores da Home com auto-fit, unidades rem, quebra de palavras, separadores adaptáveis e foco em forced-colors (`d9a22887`, `f5b5285b`, `36892364`).
- [x] Evidência de browser isolado no VPS (Gateway job `job_01M8CVM1JG00Z834CRBJAJY2HX`): seis fixtures Chrome antes/depois. Antes: fundos transparentes no alto contraste; depois: rgb(8,15,23) e rgb(16,28,40). Grade a 320px: 3→2 colunas, sem overflow; a 390px com raiz de 32px: 3→1, rótulo 11→24px; a 1280px: 3 colunas, sem overflow. Não é E2E do jogo completo.
- [x] Testes direcionados em arquivos do SHA `368923640c1bcbbc7f826d4efc14e6c41cd8c0e6`: 4/4 Home (node:test) e 15/15 carreira (Vitest 5.0.3), Node 24.22.1. Gateway job `job_01M8CVQ5YT00AYTCXNYB6MCYTA`. A verificação inicial de Prettier sem configuração local falhou; repetição com `.prettierrc` real confirmou ambos os arquivos inalterados (job `job_01M8CVSG2Z0051BGMZ7XT9CME7`).
- [ ] CodSpeed: comparação histórica 8dac85dd vs 33a6c3f mostrou duas regressões simuladas com CPUs diferentes; o gate pareado passou, mas três medianas foram declaradas não certificáveis por ruído >10%. Não declarar ausência de regressão. Revalidar no HEAD final.
- [ ] Lighthouse, CI completo, QA visual e acessibilidade do aplicativo inteiro, GPU física, Stripe Sandbox, passkey e multiplayer 1×1/2×2, backup e rollback continuam gates. Não mesclar apenas por mergeable=true.

## Retomada auditada do PR #179 — 27/11/2026

- [x] O HEAD anterior `4369093d` concluiu 30 checks: 25 success, 1 neutral (CodSpeed), 4 skipped. Nenhuma falha concluída; a campanha de nove eixos permaneceu skipped. O HEAD atualizado exige nova CI completa.
- [x] Auditoria pública isolada no Chrome do VPS, job `job_01M8EJWHES0015RA5NNCRGXH5T`: Home, redirecionamento `/modo-carreira`, multiplayer, loja e dashboard em 390px e 1280px. Foram 10 respostas HTTP 200, sem overflow horizontal ou pageerror; primeiro foco no skip link com outline de 3px. Na inspeção precoce, layouts client-only exibiram landmarks transitórios. Após 5 segundos, multiplayer e dashboard tinham um `main` cada, loja nenhum. Dashboard público ainda exibiu texto duplicado do skip link, já removido no código do #179 e pendente de homologação no preview.
- [x] P2: falta de landmark `main` corrigida na página editorial `jogo-de-manager-de-futebol` e na loja, sem alterar classes CSS. Commits `6f938bb4`, `4f904851`, testes `d8fbdca5`/`eb7acc80`. Prettier e 4/4 testes Vitest no SHA `eb7acc80` aprovados no VPS, job `job_01M8EKCCK7000YN9637VQZKJB4`. A produção pública ainda usa código anterior; screenshots correspondem à produção, não ao PR: `home-390.png` SHA256 `94107ba469a7f90cddb0f8b2a84373a6dad750fad6a00e527ce6b4c64a24cc65`, `multiplayer-390.png` SHA256 `472337e8f1134109cf1829773376cb683dad5c3c8381fd1fdb9d7a7a9e5f071d` (Gateway artifacts com esses nomes).
- [x] Stripe Sandbox `Área restrita de Onze Interactive`: 2 endpoints de webhook enabled, ambos direcionados ao domínio Lovable, nenhum ao endpoint próprio do JogoManager. Sessão anterior de QA R$4,90 consta paid; entrega ao webhook do jogo e crédito idempotente seguem NÃO certificados. Não executar compra real nem modificar produção para suprir a prova.
- [x] Supabase: staging branch `staging-release-132` (ref `skycnsjbcqmsaejaairl`) mantém as duas políticas de dono já otimizadas pelo Drizzle `0088_rls_cached_auth_context.sql`. Em produção `lguqnwvsfeefxamzeyos`, `public.career_save_chain` e o schema de histórico `drizzle` estão ausentes; a política em `coin_service_spends` ainda usa `auth.uid() = user_id`. **Bloqueio de divergência de schema:** aplicar a `0088` isoladamente na produção falharia ao encontrar a tabela ausente. Não aplicar migrations sem sequência e checkpoint verificados.
- [x] A migração Supabase redundante inicialmente adicionada à branch foi **removida** no commit `9f774551`, após localizar `drizzle/migrations/0088_rls_cached_auth_context.sql` já presente na main. O teste de catálogo `tests/sql/coin-service-rls-initplan-contract.sql` passou em staging, sem leitura de dados nem alteração persistente, no commit `17ac80ed`.
- [~] VPS: o timer offsite `jm-backup-offsite-drive.timer` está enabled, e o serviço teve `Result=success`, mas **não houve restauração externa isolada comprovada** nesta continuação. O endpoint público retornou 200. A integração Browser Use externa falhou por falta de créditos; a auditoria foi realizada com Playwright/Chrome já instalado no VPS.
- [ ] P0: reconciliar migrações produção/staging, validar checkout→webhook→fulfillment e idempotência ponta a ponta, restauração externa, 1×1 até final/2×2, autenticação/passkey, CI e CodSpeed equivalentes no HEAD final, rollback. P1: QA visual em preview do HEAD, GPU física, revisão de segurança. **Não marcar Ready nem mergear ainda.**

### Coordenação — regressão de localização do CAPTCHA (27/11/2026 BRT)

- Base integrada `15be6abd`, quatro frentes (01–04), 14 caminhos distintos; 95/95 testes focados, TypeScript e lint aprovados. Gate de performance local: 52/52. O gate de textos fixos falhou com quatro novos candidatos do CAPTCHA.
- RED: dois testes de acessibilidade/localização em inglês e espanhol falharam; GREEN: 14/14 em duas suítes, zero novos candidatos no gate i18n, ESLint, Prettier, TypeScript e diff check aprovados. Reutilizado catálogo de autenticação pt/en/es com fallback inglês. Baseline intacto.
- Preservado o avanço concorrente `62705c14` (inventário independente e documentação), com comparação dos três blobs-base idênticos. Frente 05 ainda não publicou commit próprio na última consulta. Não atribuir resultados históricos ao novo SHA.
- HOLD: staging Supabase MIGRATIONS_FAILED, webhook sandbox 503 segundo handoff, backup externo não comprovado (rclone do usuário sem remotes), revisão independente humana, GPU física, E2E autenticado e screenshots no candidato final ainda abertos. Sem produção, merge main ou redução de gates.
