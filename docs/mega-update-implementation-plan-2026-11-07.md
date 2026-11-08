# Documento de implementação — ampliação do plano mestre do JogoManager PR #125

**Data de consolidação:** 2026-11-07
**PR:** [#125](https://github.com/davizeiro12345678/jogomanager/pull/125)
**Checkout solicitado nesta rodada:** `codex/career-tutorial-css-20261107` / baseline documental `b72a2fd423e9cc6f39185b6099543095f6f117d5`; última verificação CI antes deste adendo em `b8df3cb1aa905ddc93e39f694cf53f15ea2fcc56` (commit documental, sem mudança de código)
**Plano mestre relacionado:** [`docs/mega-update-execution-plan-2026-11-07.md`](mega-update-execution-plan-2026-11-07.md)
**Índice histórico:** [`docs/prior-static-audits-summary-2026-11-07.md`](prior-static-audits-summary-2026-11-07.md)
**Natureza:** síntese técnica de resultados estruturados; não é execução de testes, auditoria dinâmica, release approval ou validação de produção.

## 1. Decisão executiva

O plano mestre continua válido como direção, mas precisa ser ampliado com uma sequência de lotes que trate primeiro autoridade, integridade de saves, fonte de schema, idempotência e gates de release. As 25 revisões atuais não revelam uma única regressão isolada: elas mostram um conjunto de fronteiras incompletas que se reforçam mutuamente.

Os bloqueadores mais importantes são: a partida ao vivo ainda é decidida localmente durante a sessão; `leave` e `finish` podem disputar a sala sem lease/recibo durável; o `forfeit` pode ficar fora do hash de comando no contrato autoritativo; escalações inválidas ainda alcançam o `MatchSim`; o webhook de pagamento faz processamento longo antes do `2xx` e tem estado `processing` ambíguo; há divergência de tooling/replay entre árvores de migrations, embora `AGENTS.md:36` indique `drizzle/migrations` para o backend conectado; e o CI/release ainda não permite certificar o SHA por causa de Lighthouse/evidence.

A prioridade seguinte é proteger carreira, chat, notifications, finanças e contratos sem quebrar saves. O código tem mitigação parcial em vários pontos, mas “há um helper”, “há um teste estático” ou “há uma migration versionada” não equivale a uma jornada comprovada. O plano deve aceitar somente evidência ligada ao SHA exato, ao fixture utilizado e ao ambiente declarado.

### 1.1 Regra de evidência

Cada achado consolidado recebe uma ou mais classificações:

- **[CÓDIGO]** — fato observável no checkout atual, com path/linha fornecido pelos resultados estruturados.
- **[HISTÓRICO]** — conclusão do índice de auditorias anteriores ou do plano anterior; não é automaticamente estado atual.
- **[OFICIAL]** — orientação de fonte oficial já registrada nos resultados, usada como critério de desenho/aceitação, não como prova de que o projeto cumpre o critério.
- **[HIPÓTESE]** — decisão de produto, estado externo ou comportamento que não pode ser inferido com segurança do código.
- **[PENDENTE]** — evidência que ainda precisa ser coletada; inclui CI, browser, staging, banco, provedor, produção, dispositivo físico ou revisão humana.

Quando um item tem `[CÓDIGO]` e `[PENDENTE]`, isso significa que o risco estático foi localizado, mas a reprodução ou aceitação ainda não foi executada.

### 1.2 Limite temporal e de SHA

O plano mestre registra `8df72c0...` como branch/SHA inspecionado e atribui a esse commit mudanças de configuração, bundle e Lighthouse. A solicitação desta rodada, porém, pede registrar o PR no checkout `b72a2fd423e9cc6f39185b6099543095f6f117d5`. Portanto:

1. `8df72c0` é tratado como **contexto histórico/documentado** do plano, não como estado atual do checkout.
2. `b72a2fd` é o baseline de trabalho desta síntese e não deve receber resultados de CI, browser ou produção que pertençam a outro SHA.
3. O CI do run `42426452442` associado a `b72a2fd` concluiu a maioria dos gates: build/types/tests, stress de 200 partidas, bundle de startup, replay Supabase, contratos 3D, auditoria de dependências e importer passaram; **Lighthouse mobile e `Critical performance release gate` falharam**, e `evidence` seguia pendente na última consulta. Não transferir esses resultados para um SHA documental posterior.
4. Não há, nesta síntese, afirmação de que testes, ataques, benchmarks, perfil de backlinks, disavow, requests de produção ou deploys tenham sido executados.

### 1.3 Reexecução no head documental `b8df3cb`

O push documental disparou CI automaticamente no SHA `b8df3cb` (run `42428747855`); esse commit não mudou o código de aplicação em relação ao seu pai. O run **Quality gates terminou em `failure`**, não em estado inconclusivo: o build/types/tests, stress, bundle, replay Supabase, contratos 3D, dependências e importer passaram; uma de três medições móveis da home marcou score 87/100 e TBT 459,1 ms, contra os limites score ≥0,97 e TBT ≤200 ms. LCP de 2.062,4 ms e CLS 0 ficaram dentro dos budgets.

O job `Critical performance release gate` propagou corretamente `lighthouse-mobile: failure`. O check visual é outra execução (`42428747827`): ainda estava `in_progress` no passo de captura do baseline na observação de 00:24 UTC, com timeout configurado de 60 minutos. A saída do observador `gh pr checks --watch` mostrava a reprovação crítica enquanto esse fluxo separado continuava ativo; minha conclusão anterior que tratou a saída parcial como conclusão de todos os workflows foi incorreta. Não há fundamento para alterar o agregador nem afrouxar budgets. Ver [métricas, evidências, URLs de origem e procedimento correto de status](ci-diagnosis-b8df3cb-2026-11-07.md).

## 2. O que já foi feito versus o que não está implementado

### 2.1 Mudanças documentadas como feitas em commits anteriores

O plano mestre registra como implementadas no commit histórico `8df72c0` as seguintes mudanças de código/configuração:

- separação e validação dos nomes públicos/server-side em `.env.example`, com rejeição de duplicatas/ausências e proteção para que `service_role` não vá para o bundle público;
- correção do seletor do bundle para não confundir chunks auxiliares `match-*` com a entrada real do Match 3D;
- permissão de acréscimo máximo de 400.000 bytes por representação agregada do JavaScript — raw, gzip-9 e Brotli-Q6 — sem aplicar essa tolerância às closures de startup;
- ajuste documentado do piso de Lighthouse mobile de 0,98 para 0,97, mantendo LCP, CLS, TBT, três execuções e agregação pessimista como gates independentes.

Esses itens devem ser descritos como **alterações atribuídas ao commit pelo plano**, não como checks aprovados nesta rodada. O CI de `b72a2fd` reprovou Lighthouse mobile e o gate crítico, com `evidence` pendente; a aceitação não foi atingida e exige correção, artefatos completos e nova execução verde no SHA candidato, sem lockfile divergente.

O plano também registra verificações locais e resultados de CI associados aos commits anteriores, incluindo lint, typecheck, testes, build, bundle, stress de 200 partidas, replay de migrations e gates 3D. Esses registros permanecem históricos. Não foram reexecutados para este documento e não devem ser apresentados como prova atual.

### 2.2 Mitigações observáveis no código atual

As revisões atuais confirmam algumas melhorias locais que devem ser preservadas e não reimplementadas como se estivessem ausentes:

- o foco de headings na carreira está restrito a `:focus:not(:focus-visible)` em `career-screens.css:241-260`, e a busca usa indicador no wrapper via `:focus-within` em `career-create.css:309-320`;
- o painel `CareerWorldPanel` já está integrado em `src/pages/carreira.tsx:204-210`, embora suas abas ainda não cumpram todo o padrão de teclado/ARIA;
- o tutorial evoluiu para 7 capítulos e 19 lições em `src/game/career-tutorial.ts:47-219`, embora a maior parte ainda não tenha evidência canônica de ação real;
- o chat persistente já deriva o remetente no servidor e possui moderação preliminar; o chat de sala continua em condição diferente e mais frágil;
- o inventário público, sitemap e política local de indexação já compartilham `src/lib/public-page-inventory.ts`, reduzindo o P0 histórico de divergência entre lista de URLs e `X-Robots-Tag`;
- o importer Cloudflare atual deixou de aceitar o segredo por query e marca status/importações/erros como `no-store` em `cloudflare/sportsdb-importer/auth.mjs` e `http.mjs`;
- há contrato estático para sessão autoritativa em `src/game/online/`, schemas Zod de mensagens e HMAC/CSPRNG de ticket, mas não há ligação comprovada desse contrato ao runtime efetivo da página;
- há orçamento adaptativo, LOD/instancing, fallback WebGL2, lifecycle WebGL e tratamento inicial de `device.lost`, mas não há evidência visual/hardware que feche o ciclo.

Essas mitigações reduzem o escopo dos patches. O princípio é corrigir lacunas, não duplicar correções históricas nem reescrever subsistemas que já têm ownership definido.

### 2.3 Não implementado, incompleto ou não comprovado

Permanece aberto, no mínimo:

- servidor único e autoritativo por sala com intents, snapshots, lease, reaper, recibo assinado e recuperação após restart;
- correção da race `leave`/`finish`, idempotência de `create`, `join`, `start`, `leave` e `finish`, e inclusão do `forfeit` no hash antes do recibo;
- gate único de elegibilidade de escalação antes de UI, save, `MatchSim`, fallback local e worker;
- outbox/lease/retry para webhook Stripe, tratamento seguro de evento já `processing` e confirmação da assinatura real da RPC de fulfillment;
- fonte canônica de migrations, replay descartável e matriz efetiva de RLS/grants/`SECURITY DEFINER`;
- reconciliação de quota/importer, parsing completo de `Retry-After`, leases de fase e distinção entre cota do provedor, teto configurado e margem local;
- canais de sala privados, membership server-side, block cross-device, tombstone/snapshot de denúncia, reviewer, appeal e punição gradual;
- estados de hidratação da carreira, retry de cloud, distinção entre ausência real de save e falha de leitura, e proteção contra substituir um save durante carregamento;
- semântica fechada de ofertas, expiração, troca de clube, empréstimo, ledger financeiro único, preview/confirm/undo e compatibilidade de save;
- tutorial com evidência `verified` distinta de `reviewed`, tarefa real, persistência account-scoped e sem recompensa até contrato server-side aprovado;
- forced-colors/reduced-motion completos na criação, cascade sem ambiguidade e hover de tabela deduplicado;
- elegibilidade/rebuild/disposal do `StaticBatch`, RNG cosmético determinístico, captura real e política WebGPU/WebGL explícita;
- máquina de transição de cutscene com fade opaco, cancelamento por geração, seed cosmética e análise de flashes;
- paridade i18n dos 98 identificadores, revisão humana e SEO internacional por URL/hreflang;
- perfil de backlinks, propriedade Search Console, DNS/TLS/Cloudflare e qualquer decisão de disavow;
- lockfile próprio para `services/match-aux`, reconciliação sem push automático e SBOM;
- evidência atual do CI/release e artefatos visuais limpos no SHA `b72a2fd`.

## 3. Backlog deduplicado e priorizado

A tabela abaixo cruza achados atuais e históricos. Itens que apareceram em mais de uma auditoria foram fundidos; o histórico é citado apenas para explicar a evolução, nunca para duplicar o trabalho.

| ID consolidado | Achado deduplicado e evidência principal | Classificação | Prioridade | Lote/fase | Resultado esperado |
|---|---|---|---|---|---|
| M-01 | A linha de base do plano usa `8df72c0`, enquanto o checkout solicitado é `b72a2fd`; checks e artefatos não podem ser transferidos entre SHAs. | [HISTÓRICO] [CÓDIGO] [PENDENTE] | P0 | L0/F0, L6/F6 | Manifesto de SHA, lockfile, ambiente e artefatos; CI atual ainda bloqueia aprovação. |
| M-02 | Divergência de tooling/replay: `AGENTS.md:36` define `drizzle/migrations` para o backend conectado e diz que `supabase/migrations` é histórico de outro backend; alguns scripts/bootstrap ainda tocam as duas árvores e há escrita em `schema_migrations`. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P0 | L0/F0, L6/F6 | Manter Drizzle como trilha canônica do backend conectado; alinhar CI/bootstrap e provar replay/ACL/RLS em DB descartável, sem aplicar a árvore Supabase histórica. |
| M-03 | Sessão multiplayer autoritativa existe como contrato/teste, mas a página continua usando CRUD/Realtime e simulação local para conduzir a partida. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P0 | L1/F1 | Runtime intent → snapshot → recibo, sem score/seed/resultado vindo do cliente. |
| M-04 | `leave` pode ler `live`, perder a corrida para `finish` em `settling`, atualizar zero linhas e apagar o segredo; não há lease/reaper/receipt durável. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P0 | L1/F1 | CAS/lease/fencing, recuperação após queda e uma única transição terminal por sala. |
| M-05 | `forfeit` finaliza antes de entrar no hash em `authoritative-match-session.ts:145-159`; o recibo é assinado depois em `:193-210`. | [CÓDIGO] [PENDENTE] | P0 | L1/F1 | `forfeit` participa do `commandHash`, com teste de replay e receipt estável. |
| M-06 | Escalação persistida ou trocada manualmente pode levar lesionado/suspenso ao `TeamSetup`; worker e `MatchSim` não têm gate único estrito. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P0 | L3/F3 | Admission fail-closed em save, UI, local fallback e worker, sem consumir RNG para reparar input válido. |
| M-07 | Webhook Stripe verifica assinatura localmente, mas processa fulfillment antes do ACK; `processing` pode ser tratado como sucesso transitório e o teste histórico aceita duas chamadas de fulfillment em replay. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P0 | L1/F1, L6/F6 | Outbox/lease/retry, receipt único e confirmação da assinatura efetiva da RPC. |
| M-08 | `LOVABLE_SEND_URL` aceita HTTPS genérico; recipient/reply-to não são validados antes da escolha do provedor e os módulos têm apenas comentário server-only. | [CÓDIGO] [HISTÓRICO] [OFICIAL] [PENDENTE] | P0 | L1/F1 | Allowlist de destino, bloqueio SSRF/redirect, fronteira server-only e logs redigidos. |
| M-09 | Quatro superfícies API-Football divergem: rota direta, rota leaseada, fila Edge e sessão de ingestão. Retry-After HTTP-date não é interpretado em todos os caminhos. | [CÓDIGO] [HISTÓRICO] [HIPÓTESE] [PENDENTE] | P1 | L0/F0, L6/F6 | Matriz de autoridade/quota, retry uniforme, leases reconciliados e sem alegar cota contratual sem fonte. |
| M-10 | Importer Cloudflare atual removeu segredo por query e protege status, mas ainda serve API pública sem projeção/paginação/rate limit de entrada; CORS wildcard cobre superfícies administrativas e a raiz não fixa cache. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P1 | L1/F1, L6/F6 | Rotas/métodos/CORS/cache/headers publicados com política explícita e inspeção read-only da conta. |
| M-11 | Chat de sala é Broadcast efêmero sem `private:true` comprovado; `from` vem do cliente; bloqueio é local; reports/mensagens podem perder evidência; não há fila humana/appeal. | [CÓDIGO] [HISTÓRICO] [OFICIAL] [PENDENTE] | P1 | L2/F2 | Membership/RLS, sender server-side, tombstone, moderação auditável e resync. |
| M-12 | Firebase tem opt-in e RLS de subscriptions, mas há divergência documental entre `/sw.js` e `/firebase-messaging-sw.js`, lifecycle de token/logout incompleto e sender sem timeout/retry. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P1 | L2/F2, L6/F6 | Configuração same-project, worker definido, token account/device-scoped e envio server-side comprovável em staging. |
| M-13 | RLS/grants/definers têm bons controles locais, mas o estado efetivo não foi consultado; funções e anonymous sign-in não estão cobertos integralmente. | [CÓDIGO] [HISTÓRICO] [OFICIAL] [PENDENTE] | P0 | L0/F0, L6/F6 | Matriz owner/non-owner/anon/authenticated/service_role em DB descartável e evidência separada para hospedado. |
| M-14 | `useCareer` e `useAthlete` misturam hidratação, ausência e falha; `/new` não espera `isLoading`, podendo permitir criação/substituição durante leitura tardia. | [CÓDIGO] [PENDENTE] | P0 | L3/F3 | Loading/empty/offline/error/retry distintos; replace explícito e snapshot antes de reset. |
| M-15 | Ofertas do treinador atravessam season end; ofertas futuras não são rejeitadas; venda/dispensa deixam referências; carreira de jogador não modela prazo/retorno de empréstimo. | [CÓDIGO] [PLANO] [HIPÓTESE] [PENDENTE] | P1 | L3/F3 | Máquina de estados única, semântica de validade aprovada, limpeza determinística e migração compatível. |
| M-16 | Copa/fechamento alteram agregados sem `FinanceEvent`; só parte das ações tem preview/confirm; save cloud substitui JSON inteiro sem merge financeiro por evento. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P1 | L3/F3, L6/F6 | Ledger único, idempotency key, CAS/revisão, preview/undo e conflito explícito. |
| M-17 | Tutorial atual tem 19 lições, mas somente alguns IDs recebem reconhecimento automático; `learned` e `practiced` são unidos em localStorage e não constituem prova de ação. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P1 | L3/F3 | `verified` separado de `reviewed`, eventos canônicos, foco/contexto e nenhuma recompensa sem autorizador server-side. |
| M-18 | Foco histórico foi corrigido, mas permanecem cascade implícita, hover duplicado, portrait sobrescrito em 601–850px, forced-colors ausente em `career-create` e reduced-motion repetido. | [CÓDIGO] [HISTÓRICO] [OFICIAL] [PENDENTE] | P1 | L3/F3 | Contrato de cascade, foco/forced-colors/reduced-motion, matriz 320–1180px e verificações estáticas. |
| M-19 | Dados, simulador, career engine/world, cutscene, CSS e rotas têm fronteiras de extração, mas parte dos “monólitos” históricos já foi dividida e números antigos não reproduzem o SHA atual. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P2 | L3/F3, L4/F4, L5/F5 | ABI/exports/ownership inventariados; extração incremental com reexport e paridade, sem refatoração mecânica. |
| M-20 | `StaticBatch` filtra por UUID/material/flags, mas não detecta transform/material mutado depois do settle; testes são mockados. | [CÓDIGO] [HISTÓRICO] [OFICIAL] [PENDENTE] | P1 | L4/F4 | Elegibilidade revisionada, rebuild/dispose idempotente, fontes não ocultadas indevidamente e harness real de context loss. |
| M-21 | Weather/Dust usam `Math.random`; pools adaptam count/visibilidade sem reduzir sempre a capacidade; normal KTX2 e paridade WebGPU não estão certificados. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P1 | L4/F4 | RNG cosmético por fixture, pools reusáveis, asset/fallback verificados e WebGPU explicitamente suportado ou roteado para WebGL2. |
| M-22 | Cutscene tem cleanup parcial e clear escuro, mas não há máquina fade-out/swap/fade-in, seed cosmética nem prova contra frame branco. | [CÓDIGO] [HISTÓRICO] [OFICIAL] [PENDENTE] | P1 | L4/F4 | TransitionController interrompível, geração/AbortController, reduced motion e vídeo analisado. |
| M-23 | Budgets de bundle/performance existem, mas total JS, startup, WASM e seleção de entradas não têm uma única leitura. No run `42428747855`/`b8df3cb`, 1 de 3 runs da home falhou: score 87, TBT 459,1 ms; logs apontam tarefas longas na página e `hydrate-app`, ainda sem call stack conclusivo. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P0 para release / P1 para remediação | L0/F0, L4/F4, L6/F6 | Capturar trace e atribuir o outlier; corrigir causa isolada sem enfraquecer budgets; repetir 3 runs por rota e publicar manifesto/artefatos do SHA. Ver [diagnóstico](ci-diagnosis-b8df3cb-2026-11-07.md). |
| M-24 | Catálogo anuncia 98 locales, mas há 24 JSONs de 14–211 chaves; `common.loading`/`nav.play` podem aparecer como chave e metadata força pt-BR. | [CÓDIGO] [PLANO] [PENDENTE] | P1 | L5/F5 | Manifesto, checker de paridade, fallback visível, revisão nativa e rollout aprovado por locale. |
| M-25 | Inventário de 34 URLs corrigiu a divergência histórica, mas preview, hreflang/SSR localizado e variantes internacionais permanecem abertos. | [CÓDIGO] [HISTÓRICO] [OFICIAL] [PENDENTE] | P1 | L5/F5 | Política de host, canonical/hreflang/sitemap derivados de conteúdo aprovado. |
| M-26 | Não há dataset de backlinks, Search Console, DNS/NS/TLS ou perfil remoto; nenhum domínio pode ser classificado como tóxico e nenhum disavow pode ser preparado. | [HISTÓRICO] [OFICIAL] [PENDENTE] | P2 bloqueado | L5/F5, L6/F6 | Somente após fonte, janela de 90 dias, revisão manual e aprovação Google; default atual é `não disavow`. |
| M-27 | `services/match-aux` não tem lockfile; workflow usa `npm install`; `entities` aparece em versões diferentes; reconciliação tem `contents:write`; advisory low histórico de `deepmerge` permanece. | [CÓDIGO] [HISTÓRICO] [OFICIAL] [PENDENTE] | P1 | L0/F0, L6/F6 | Lockfile próprio, job read-only, SBOM e exceção documentada sem chamar audit clean. |
| M-28 | Crescimento histórico de `api_football_data`/jobs não é fotografia atual; instrumentação `0060` está em Drizzle e fora da cadeia Supabase; retenção continua sem política. | [CÓDIGO] [HISTÓRICO] [PENDENTE] | P1 | L0/F0, L6/F6 | Snapshots read-only bounded, paridade de migration, planos/índices e retenção somente após reconciliação. |

## 4. Priorização P0/P1/P2 e dependências

### P0 — não liberar e não ampliar superfície de confiança

P0 não significa que toda correção precisa ser implementada no mesmo commit; significa que não pode haver promoção de release ou expansão de autoridade enquanto o item estiver sem gate.

1. **Integridade de sala e multiplayer:** M-02, M-03, M-04 e M-05. Dependem da trilha Drizzle prescrita para o backend conectado, do contrato de sessão, de receipt idempotente, lease/fencing e testes de concorrência/restart.
2. **Entrada de partida:** M-06. Depende de contrato único `isMatchEligible`, decisão para saves legados inválidos e paridade entre UI, fallback e worker.
3. **Pagamentos e transporte de email:** M-07 e M-08. Dependem de contrato de RPC/migration confirmado em ambiente descartável, outbox/lease e allowlist de destino.
4. **RLS/migrations:** M-02 e M-13. Dependem de alinhar CI/replay com `drizzle/migrations`, conforme `AGENTS.md:36`, e executar replay somente em DB descartável autorizado; a árvore `supabase/migrations` não deve ser aplicada a esse backend.
5. **Release/performance:** M-01 e M-23. No run `42428747855` de `b8df3cb`, Lighthouse mobile e o gate crítico falharam por score/TBT na home; o check `evidence` separado ainda estava em andamento. Dependem de trace, correção medida, artefatos completos e CI verde no SHA candidato. Ausência/timeout/skip nunca vira warning.
6. **Carreira/save:** M-14. Depende de fixtures de auth/cloud/offline, snapshot antes de reset e contrato de owner/account scope.

**Critério P0 comum:** nenhuma mudança deve permitir perda de save, dupla concessão/fulfillment, resultado definido pelo cliente, segredo destruído em corrida ou release publicado sem CI verificável.

### P1 — implementar em lotes imediatamente após os bloqueadores

M-09 a M-12 tratam bordas e presença; M-15 a M-18 tratam jornada de carreira, acessibilidade e economia; M-20 a M-25 tratam 3D, cutscenes, performance e internacionalização/SEO; M-27/M-28 endurecem supply chain e observabilidade. P1 pode ser desenvolvido incrementalmente em branches/flags, mas não deve ser apresentado como concluído sem seus gates.

### P2 — estrutural, bloqueado por decisão ou sem fonte

M-19 é refatoração de risco controlado e só entra quando o contrato público estiver inventariado. M-26 depende de fontes externas, propriedade, revisão humana e aprovação específica; enquanto isso, não há análise de toxicidade nem disavow.

## 5. Lotes de implementação incrementais

Cada lote deve resultar em commits pequenos, reversíveis e ligados ao SHA. A ordem abaixo amplia as Fases 0–6 do plano mestre.

### Lote 0 — baseline, schema, dependências e gates de admissão

**Fases relacionadas:** Fase 0 e pré-requisitos da Fase 6.
**IDs:** M-01, M-02, M-09, M-13, M-23, M-27, M-28.

**Passos:**

1. Fixar `b72a2fd` como baseline, gerar manifesto de commit/Node/lockfiles/rotas/ambiente e separar explicitamente evidência histórica de evidência corrente.
2. Seguir `AGENTS.md:36`: usar `drizzle/migrations` como trilha forward do backend conectado e tratar a árvore recuperada em `supabase/migrations` como pertencente a outro backend. Reconciliar scripts de CI/bootstrap que ainda as mencionem; não rerodar o histórico Supabase nem editar metadata para mascarar estado.
3. Preparar replay em Postgres local descartável a partir das migrations Drizzle: RLS/grants do backend efetivo, funções definer/invoker, tabelas de migração, seeds privados e contratos de multiplayer. Nenhuma migration deve ser aplicada a produção nesta frente.
4. Gerar lockfile isolado para `services/match-aux`, trocar `npm install` por instalação congelada depois de revisar o diff e tornar reconciliação de locks read-only em pull request. Gerar SBOM root e auxiliar; registrar o advisory `deepmerge` low como exceção acompanhada, não como zero advisories.
5. Alinhar budgets de bundle: total JS por representação, closure de startup por entrada, WASM separado e manifesto de entradas. Artefato ausente, baseline ausente ou lock divergente deve falhar.
6. Definir matriz de quota/importer: caminho direto, leaseado, fila e RPC de ingestão. Separar `provider_quota`, `configured_ceiling` e `safety_margin`; implementar parser de `Retry-After` numérico e HTTP-date em fixtures locais antes de qualquer request autorizado.
7. Preparar snapshots bounded de crescimento, índices e fila; registrar que históricos de outubro/novembro não são fotografia atual e que `0060` fora da cadeia Supabase ainda é bloqueio.

**Dependências:** nenhuma dependência de runtime novo; é pré-requisito para migrations, pagamentos e autoridade multiplayer.
**Aceitação verificável posterior:** replay descartável reproduz apenas a trilha Drizzle do backend conectado; os jobs não marcam migrations do outro backend como aplicadas; npm/Bun não alteram locks em instalação congelada; SBOM valida; bundle reporta todas as superfícies; CI do SHA atual publica todos os artefatos e falha fechado para ausência.
**Rollback:** somente reverter commits de tooling/documentação; não apagar histórico de migration nem alterar banco hospedado.

### Lote 1 — autoridade server-side, salas e fronteiras de transporte

**Fases relacionadas:** Fase 1 e parte de Fase 6.
**IDs:** M-03, M-04, M-05, M-07, M-08, M-10.

**Passos:**

1. Escolher um coordenador único por `roomId` — Durable Object/WebSocket ou serviço de sessão aprovado — e deixar Supabase Realtime apenas como presença/invalidação.
2. Emitir ticket curto ligado a usuário, assento, sala e expiração; aceitar somente intents Zod versionados com `clientSeq`; excluir score, seed, winner, reward e estado final dos comandos.
3. Corrigir `authoritative-match-session.ts` para validar fase antes do dispatch, anexar `forfeit` ao hash antes de finalizar, persistir checkpoint/receipt e fazer retries retornarem o mesmo resultado.
4. Reescrever create/join/start/leave/finish como operações com `operation_id`, CAS, row count e lease/fencing. O segredo somente pode ser removido depois de resultado durável. Criar reaper idempotente para `settling` órfão.
5. Separar ingestão Stripe do fulfillment: verificar corpo bruto/assinatura/ambiente, persistir outbox mínimo, responder dentro do orçamento e processar com lease. Evento duplicado deve retornar receipt já existente; `processing` abandonado precisa de recuperação.
6. Colocar email em módulo server-only real, validar recipient/reply-to antes do provedor, aplicar allowlist exata a `LOVABLE_SEND_URL`, rejeitar IP privado/metadata/redirect e redigir logs.
7. No Worker Cloudflare, fechar métodos, CORS, cache, projeção, paginação, teto e rate limit de entrada. A inspeção da conta, se autorizada depois, será read-only e não lerá valores de secrets.

**Dependências:** Lote 0 para schema/replay; aprovação de arquitetura e segurança; fixtures sintéticas.
**Aceitação verificável posterior:** matriz de corridas `leave×finish`, `finish×finish`, `reaper×finish`, restart em cinco pontos, 200 seeds, um receipt por sala, zero score de browser, `forfeit` no hash, webhook com outbox idempotente e SSRF negativo.
**Rollback:** feature flag mantém o fluxo anterior somente como apresentação sem autoridade adicional; nunca reativar aceitação de score enviado pelo browser. Para pagamentos, desligar o consumidor de outbox sem apagar eventos.

### Lote 2 — presença, chat, moderação e notifications

**Fases relacionadas:** Fase 2 e parte de Fase 6.
**IDs:** M-11, M-12, M-13.

**Passos:**

1. Separar chat global/DM persistente de `RoomChat` efêmero. Criar membership canônica e canais privados; usar Postgres Changes para duráveis e Broadcast apenas para presença/apresentação.
2. Derivar sender/membership do JWT/RPC; rejeitar `sender_id`, `from`, `roomId` ou status enviados pelo cliente. Persistir `client_message_id` e idempotência.
3. Persistir blocks por conta, aplicar bloqueio nos dois sentidos e excluir push. Denúncias devem manter tombstone/snapshot mínimo, rule version, reviewer, appeal e audit trail; banimento permanente requer humano.
4. Definir lifecycle FCM: worker dedicado, configuração same-project, token por conta/dispositivo, logout/troca de conta, rotação, stale window e remoção condicional. O sender server-side deve usar timeout/retry/Retry-After e paginação.
5. Validar RLS/Realtime em banco descartável para anon, authenticated, membro, não membro, bloqueado e membership revogada; nenhuma decisão de sala deve depender de Broadcast.

**Dependências:** Lote 0 para RLS/schema; Lote 1 para identidade de sala e fronteira server-side; decisão de produto sobre consentimento de push e retenção de reports.
**Aceitação verificável posterior:** participante assina e publica; não membro falha; reconnect converge por cursor; block funciona cross-device; report sobrevive à remoção lógica; retry de moderação não duplica; FCM entrega apenas em staging isolado ao dispositivo correto.
**Rollback:** desativar RoomChat novo e manter somente fluxo persistente autorizado; desligar push por feature flag sem apagar subscriptions ou evidências.

### Lote 3 — carreira, saves, economia, tutorial e acessibilidade

**Fases relacionadas:** Fase 3.
**IDs:** M-06, M-14, M-15, M-16, M-17, M-18, M-19 parcialmente.

**Passos:**

1. Expor em `useCareer` estados distintos `loading`, `empty`, `ready`, `offline`, `error`, além de `retry`; em `/new`, bloquear início/reset durante hidratação. Se houver save, exigir replace explícito, confirmação e snapshot.
2. Criar `isMatchEligible` puro e compartilhado para onze titulares, goleiro, clube, IDs únicos, `injuryWeeks === 0` e `suspended === false`. Validar UI, save repair, `match.ts`, local fallback e worker. Save legado inválido deve ser reparado deterministicamente ou bloqueado com mensagem acionável.
3. Definir validade de ofertas: season/round/window, inclusividade de `expiresRound`, alvo elegível, limpeza em season end/venda/dispensa/troca de clube e regra de empréstimo. A decisão de produto deve anteceder a migração.
4. Unificar `FinanceTransaction/FinanceEvent`, idempotency key, cursor e `cashAfter`. Migrar copa/season end e ações diretas para o aplicador único. Preview deve revalidar revision; undo cloud deve ser nova revisão, não destruição de concorrência.
5. Transformar tutorial em coordenador contextual: `verified` separado de `reviewed`, eventos canônicos por ação real, foco no alvo, retorno ao trigger, reduced motion e persistência account/career-scoped. Recompensa permanece desativada até contrato server-side aprovado.
6. Consolidar CSS da carreira: documentar contrato de cascade, eliminar hover duplicado, corrigir override do portrait, adicionar forced-colors mínimo em criação, manter `:focus-visible` e reduced-motion compartilhados. Não declarar redução de bytes apenas por separar arquivos.
7. Só depois de paridade e gates, extrair módulos por owner com reexports. Dados de ligas e contratos neutros vêm antes de engine/world, CSS, rotas ou cutscenes.

**Dependências:** Lote 0 para save/migration; decisões de produto sobre ofertas, empréstimo, overdraft, tutorial e locales; fixtures de auth/offline/cloud.
**Aceitação verificável posterior:** jornadas create/retomar/replace, offline/error/retry, lineup fail-closed, transições de oferta, ledger/replay, tutorial real, teclado/tabs/dialog, forced-colors, reduced motion, 200% zoom e viewport 320–1180px.
**Rollback:** feature flags por fluxo; preservar schema antigo e adaptador de leitura; migrations forward com defaults; snapshot antes de reset; nunca remover campos históricos sem migrador e teste de round-trip.

### Lote 4 — estádio, performance 3D e cutscenes

**Fases relacionadas:** Fase 4.
**IDs:** M-19 parcialmente, M-20, M-21, M-22, M-23.

**Passos:**

1. Extrair `Quality` para contrato neutro sem quebrar reexports; manter `Stadium3D` como owner do renderer e `StadiumScene` como compositor.
2. Tornar StaticBatch revisionado: elegibilidade deve considerar transform, material, callbacks, instancing/skinning, renderOrder/layers e ancestrais dinâmicos. Separar prepare/commit/dispose; esconder fonte somente após commit válido; cleanup deve ser idempotente.
3. Trocar `Math.random` de weather/dust/flash por RNG cosmético derivado de fixture/seed/beat e separado da simulação autoritativa. Pools devem reutilizar capacidade e aplicar histerese.
4. Validar KTX2 real em alta por status/tipo/hash/decode/fallback e explicitar WebGPU: portar shaders necessários ou retornar conscientemente a WebGL2.
5. Criar `TransitionController` com stable/fade-out/swap/fade-in/cancelled, matte opaco e geração de montagem; `prefers-reduced-motion` deve zerar movimento, não apenas CSS.
6. Capturar baseline e candidato com mesmo SHA/fixture/câmera/DPR/backend/GPU. Registrar p50/p95/p99, 1% low, draws, triângulos, heap, textura, long tasks, first frame e context/device loss. Software renderer não certifica FPS físico.

**Dependências:** Lote 0 para budgets e artefatos; fixtures 3D reais; browser/hardware autorizado; nenhuma promessa de VRAM física a partir de proxy de payload.
**Aceitação verificável posterior:** não congelar mesh dinâmica; rebuild/dispose sem crescimento; WebGL loss/restoration recupera; WebGPU loss segue política; mesmos seeds produzem mesma cosmética; sem frame branco; budgets e paridade visual aprovados.
**Rollback:** fallback WebGL2/estádio anterior atrás de flag; desligar batching/qualidade nova se censo, imagem, lifecycle ou p95 falhar; não descartar recursos compartilhados.

### Lote 5 — i18n, SEO internacional e fontes externas bloqueadas

**Fases relacionadas:** Fase 5.
**IDs:** M-24, M-25, M-26.

**Passos:**

1. Criar manifest dos 98 identificadores com pack, direção, fallback e status `draft/reviewed/approved`; checker deve detectar chaves faltantes/desconhecidas, duplicatas, vazios, placeholders, hardcoded e fallback.
2. Corrigir primeiro `common.loading`/`nav.play`, metadata, pluralização e formatos. Não usar fallback como prova de tradução completa.
3. Só criar URLs localizadas depois de aprovar conteúdo: SSR, `html lang/dir`, title, description, canonical, hreflang recíproco, `x-default` e sitemap somente de variantes aprovadas.
4. Para DataForSEO, se houver decisão editorial futura, usar apenas rota server-side com segredo/timeout/cache/orçamento/flag; não chamar API nesta frente. Para Ubersuggest, aceitar somente CSV manual autorizado; não fazer scraping ou automação de sessão.
5. Para backlinks, escolher primeiro a fonte: Search Console URL-prefix ou export autorizado. Exigir duas datas/90 dias, revisão manual e gate Google. Sem isso, o resultado é `não disavow` e não há arquivo para upload.

**Dependências:** revisão linguística nativa, decisão de URLs/locales, fonte de backlinks, orçamento e aprovação explícita para qualquer provedor pago.
**Aceitação verificável posterior:** 100% do escopo aprovado coberto, placeholders preservados, revisão humana registrada, SSR localizado correto, sitemap/canonical/hreflang coerentes e relatório de backlinks datado.
**Rollback:** manter locale não aprovado fora do sitemap/noindex conforme política; remover apenas a variante/flag, sem alterar o conteúdo de outros locales. Não fazer rollback destrutivo de SEO removendo canonical sem decisão.

### Lote 6 — release, observabilidade e aprovação

**Fases relacionadas:** Fase 6, transversal a todos os lotes.
**IDs:** todos, com foco M-01, M-02, M-07, M-09, M-13, M-23, M-27, M-28.

**Passos:**

1. Executar CI do SHA exato com Node/lockfile declarados; publicar logs e artefatos mínimos, sem transformar “job não executado” em sucesso.
2. Separar evidência de código, teste, browser, staging e produção. Cada screenshot/vídeo/JSON deve registrar SHA, fixture, browser, viewport, DPR, backend/GPU, reduced motion e método.
3. Fazer observabilidade read-only de DB/Cloudflare/Firebase somente depois de autorização específica; não ler valores de secrets. Conferir bindings, routes, cron, WAF, cache, RLS e migrations sem mutação.
4. Habilitar features online por flag, com canário e kill switch; monitorar 5xx, duplicações, conflitos de save, fraude, latência, reconnect e regressões de performance.
5. Manter PR em draft enquanto qualquer P0/gate obrigatório estiver vermelho ou pendente. Aprovação final requer revisão de engenharia, produto, segurança, acessibilidade e operação conforme o lote.

**Aceitação verificável posterior:** todos os jobs obrigatórios verdes no SHA, evidências completas, sem produção alterada nesta fase, rollback exercitado em ambiente autorizado e aprovação registrada.
**Rollback:** desligar feature flag, congelar novos writers, reprocessar outbox por receipt/idempotency key, restaurar aplicação anterior sem apagar saves/receipts; migrations não são “desfeitas” por SQL destrutivo sem plano separado.

## 6. Mapeamento das 15 auditorias históricas aos lotes e fases

Links relativos apontam para o índice completo em [`prior-static-audits-summary-2026-11-07.md`](prior-static-audits-summary-2026-11-07.md). O mapeamento é de cobertura de trabalho, não de que a auditoria histórica tenha sido concluída pelos lotes.

| # | Auditoria histórica | Lote/fase principal | Dependências e tratamento atual |
|---:|---|---|---|
| 1 | `career-css-audit` — CSS da carreira | L3 / Fase 3 | Foco histórico de headings/busca foi parcialmente corrigido; cascade, hover duplicado, forced-colors, reduced-motion e portrait continuam gates. |
| 2 | `career-static-audit` — telas/experiência da carreira | L3 / Fase 3 | `PlayerObjectives` parece corrigido no SHA atual; abas `CareerWorldPanel`, `MatchReport`, loading/retry e semântica de tabela continuam abertos. |
| 3 | `stadium3d-static-audit` — Stadium3D/renderização | L4 / Fase 4 | Owner/fallback existem; StaticBatch e lifecycle real precisam de harness e evidência visual. |
| 4 | `static-audit-other-monoliths` — monólitos e ciclos | L3/L4/L5 / Fases 3–5 | Números históricos não são baseline atual; começar por ABI, dados e tipos neutros, não por extração mecânica. |
| 5 | `jogomanager-import-limits-audit` — importer e limites | L0/L6 / Fases 0 e 6 | Reconciliar quatro caminhos, quota real versus teto local, leases e Retry-After; nenhum limite contratual foi inferido. |
| 6 | `firebase-static-audit` — Firebase/FCM | L2/L6 / Fases 2 e 6 | Código opt-in existe; worker, VAPID, lifecycle e sender dependem de homologação isolada. |
| 7 | `supabase-growth-performance` — crescimento/performance | L0/L6 / Fases 0 e 6 | Fotografia histórica não é estado atual; `0060` precisa de autoridade/replay, snapshots bounded e retenção. |
| 8 | `jogomanager-backend-rls-audit` — backend/RLS | L0/L1/L2/L6 / Fases 0–2 e 6 | Melhorias locais no importer/webhook existem; matriz efetiva de RLS/grants e runtime ainda pendente. |
| 9 | `dependency-lock-audit` — dependências/lockfiles | L0/L6 / Fases 0 e 6 | Corrigir serviço auxiliar, reconciliação automática, SBOM e advisory sem afirmar audit clean. |
| 10 | `audit-cdn-cloudflare-headers` — CDN/Cloudflare/headers | L1/L6 / Fases 1 e 6 | Query secret histórico foi removido; publicação, WAF, rate limit, CORS e cache de conta continuam não verificados. |
| 11 | `jogomanager-seo-static` — SEO técnico | L5 / Fase 5 | Inventário compartilhado mitigou P0 histórico; preview/noindex, SSR locale e hreflang ainda abertos. |
| 12 | `email-webhooks-data-audit` — email/webhooks/dados | L1/L6 / Fases 1 e 6 | Resend/Stripe têm controles locais parciais; fulfillment/outbox, SSRF e barreira server-only permanecem. |
| 13 | `career-tutorial-audit` — tutorial | L3 / Fase 3 | Contagem evoluiu para 19 lições; evidência real, `verified/reviewed`, carreira de jogador e recompensa continuam pendentes. |
| 14 | `audit-tests-visual-release-gates` — testes/evidência/release | L0/L4/L6 / Fases 0, 4 e 6 | Infraestrutura de gates existe; resultado desta rodada depende do CI do `b72a2fd` e evidência limpa. |
| 15 | `backlinks-domain-security-static` — backlinks/domínio | L5/L6 / Fases 5 e 6 | Não há fonte/dataset; sem perfil, toxicidade ou disavow. DNS/Cloudflare/Search Console precisam de canal autorizado read-only. |

## 7. Matriz de cobertura dos 25 IDs atuais

Todos os IDs recebidos estão incluídos abaixo. “Estado” descreve implementação observável ou bloqueio de evidência; não é selo de aprovação.

| ID atual | Auditoria/tema coberto | Prioridade | Lote/fase | Estado sintetizado |
|---|---|---:|---|---|
| `career-css` | 1, 2 | P1 | L3/F3 | Foco histórico mitigado; cascade, forced-colors, reduced-motion, hover e breakpoint pendentes. |
| `career-ux` | 2 | P0 | L3/F3 | Risco de corrida de hidratação/save; retry, estados cloud, tabs e dialog pendentes. |
| `tutorial` | 13 | P1 | L3/F3 | 19 lições existem; evidência canônica e separação reviewed/verified pendentes. |
| `contracts` | 2, 13 | P1 | L3/F3 | Oferta futura/expirada, limpeza e empréstimo ainda sem contrato único. |
| `finance` | 7, 13 | P1 | L3/F3/L6 | Há liquidação semanal idempotente; ledger não cobre todas as receitas/despesas e cloud não faz merge por evento. |
| `tactics-availability` | 2, 3 | P0 | L3/F3 | Filtros parciais existem; admission gate antes do MatchSim ainda ausente. |
| `career-events` | 2, 13 | P1 | L3/F3 | Filtro de clube/tempo e deduplicação semanal incompletos; contrato de evento único não existe. |
| `monolith-modules` | 3, 4, 13 | P2 | L3/L4/L5 | Extração deve ser incremental; ciclos type-only/runtime são risco arquitetural, não bug comprovado. |
| `match-authority` | 8, 14 | P0 | L1/F1 | Contrato/teste existe, runtime de sala não está conectado. |
| `room-lifecycle` | 8, 14 | P0 | L1/F1 | Race leave/finish, ausência de lease/reaper/receipt persistido. |
| `chat-moderation` | 8, 12 | P1 | L2/F2 | Chat persistente tem base server-side; sala, reports, block cross-device e appeal abertos. |
| `importer-quota` | 5, 7, 10 | P1 | L0/L6 | Quatro caminhos e tetos divergentes; cota real e migrations aplicadas não verificadas. |
| `firebase-activation` | 6, 12 | P1 | L2/L6 | Opt-in/config pública existem; worker, token lifecycle, gateway e projeto efetivo não comprovados. |
| `supabase-rls-migrations` | 7, 8 | P0 | L0/L6 | Controles locais positivos, autoridade de schema e ACL efetiva bloqueadas. |
| `db-performance` | 7 | P1 | L0/L6 | Instrumentação read-only existe em Drizzle; paridade operacional, snapshots e retenção pendentes. |
| `cloudflare-edge` | 8, 10, 12 | P1 | L1/L6 | Query secret removida/no-store parcial; superfície pública, CORS, rate limit e deploy efetivo pendentes. |
| `email-payments` | 8, 12 | P0 | L1/L6 | Assinatura/transportes parciais; SSRF, outbox Stripe e RPC efetiva pendentes. |
| `dependencies` | 9, 14 | P1 | L0/L6 | Root lock materializado; aux sem lock, workflow com escrita e advisory histórico pendentes. |
| `stadium-lifecycle` | 3, 4 | P1 | L4/F4 | Fallback/context loss parcial; StaticBatch não prova imutabilidade e harness real ausente. |
| `stadium-art` | 3 | P1 | L4/F4 | LOD/instancing existem; RNG climático, normal KTX2, pools adaptativos e paridade WebGPU pendentes. |
| `cutscenes` | 3, 4, 14 | P1 | L4/F4 | Cleanup/clear parcial; fade/cancelamento/seed visual/captura pendentes. |
| `performance-bundle` | 9, 14 | P0 gate / P1 fix | L0/L4/L6 | Budgets existem; manifesto, WASM, Lighthouse e CI do SHA atual ainda precisam de evidência. |
| `i18n` | 11 | P1 | L5/F5 | 98 IDs versus 24 packs; chaves cruas, fallback e revisão humana pendentes. |
| `seo-tools` | 11, 15 | P1 | L5/F5 | Inventário de 34 URLs melhorou o estado local; host preview, hreflang e ferramentas pagas não implementados. |
| `backlinks-domain` | 15 | P2 bloqueado | L5/L6 | Sem fonte/dataset; não classificar toxicidade e não gerar disavow. |

## 8. Achados críticos inesperados e recomendação segura

Os itens abaixo são especialmente relevantes porque podem causar perda de integridade, confiança ou disponibilidade. São achados estáticos; não são resultados de ataque nem de teste dinâmico.

| Criticidade | Evidência | Risco | Recomendação segura |
|---|---|---|---|
| Crítica | `src/game/online/authoritative-match-session.ts:145-147` finaliza `forfeit` antes de `:157-158` anexar comando; receipt em `:193-210`. | Um recibo autoritativo conectado sem correção pode assinar hash que não representa o abandono. | Corrigir a ordem em uma mudança isolada; adicionar fixture de `forfeit`, replay e digest antes de conectar ao runtime. Não publicar o novo autoritativo até o gate passar. |
| Crítica | `src/lib/multiplayer.functions.ts:162-183` e `:222-261`: `leave` usa leitura stale e apaga segredo após UPDATE sem conferir row count; `finish` pode já estar em `settling`. | Corrida pode remover seed antes de replay/receipt, deixando sala inconsistente ou irreconciliável. | Exigir CAS/lease_token/row count na mesma decisão; preservar segredo até receipt durável; testar ambas as ordens e restart. |
| Crítica | `src/pages/match.tsx:212-236`, `src/game/sim.ts:451-495`, `src/game/match.worker.ts:227-261`. | Titular lesionado/suspenso pode chegar ao MatchSim e atuar; worker aceita setup sem gate único. | Criar helper puro e repetir validação no boundary do worker; bloquear ou reparar save legado deterministicamente, sem preencher aleatoriamente. |
| Crítica | `src/routes/api/public/payments/webhook.ts:244-279` processa antes do ACK; migration `20261018130949...:35-60` trata `processing`; teste histórico `-webhook.test.ts:174-204` admite duas chamadas de fulfillment em replay. | Timeout/retry pode duplicar trabalho de domínio ou prender evento em processamento. | Introduzir outbox + lease + receipt; confirmar assinatura da RPC efetiva em DB descartável e fazer duplicata retornar resultado já persistido. Não tocar Stripe real nesta frente. |
| Alta | `src/lib/fulfillment.server.ts:154-165` envia dez argumentos, enquanto migrations/arquivos registrados descrevem variante de oito. | Webhook validado pode falhar em runtime por contrato de RPC divergente. | Bloquear ativação até comparar tipos, migration canônica e assinatura instalada em ambiente descartável/autorizado. |
| Alta | `supabase/migrations/20261023204305_reconcile_security_contracts_with_mfa.sql:333-516` escreve diretamente em `supabase_migrations.schema_migrations`; CI mistura Supabase e Drizzle. | Replay pode declarar migration como aplicada sem DDL correspondente ou duplicar histórico. | Escolher fonte canônica; allowlist explícita para qualquer reparação histórica; nunca corrigir produção por edição manual de metadata nesta rodada. |
| Alta | `src/game/career-season-end.ts:208-268` preserva ofertas; `src/game/career-jobs.ts:19-35,98-111` não rejeita oferta futura; `player-career/types.ts:68-76` não modela prazo/retorno de empréstimo. | Oferta antiga pode reaparecer, bloquear emissão nova ou produzir decisão fora da janela. | Definir semântica de validade e empréstimo antes de migrar; aplicar predicado compartilhado, limpeza determinística e fixtures de save antigo. |
| Alta | `src/game/career-cups.ts:27-94` e `career-season-end.ts:41-55` alteram agregados sem evento financeiro; `useCareer.ts:210-225` grava estado inteiro. | Ledger não reconcilia caixa, replay e concorrência; receita/despesa pode ficar sem trilha. | Centralizar aplicador/ledger e migrar com adaptador; revalidar revision e rejeitar conflito, sem somar evento no retry. |
| Alta | `cloudflare/sportsdb-importer/index.js:686-770` usa `SELECT *`/`.all()` sem teto/paginação; `http.mjs:1-5` mantém wildcard CORS. | Custo/disponibilidade e exposição acima do necessário, ainda que o catálogo seja público. | Projeção allowlisted, limite/cursor, rate limit de entrada, CORS separado por rota e inspeção read-only de publicação. |
| Alta | `src/lib/email-templates/send-email-url.ts:2-16` valida só HTTPS/userinfo/fragment; `send-email.ts:87-103` passa URL ao SDK. | SSRF ou bearer enviado a destino não aprovado se configuração/chamada for comprometida. | Allowlist exata de host/porta/path, rejeitar IP privado/metadata/redirect, validar recipients antes da seleção do provedor e manter server-only no build. |
| Alta | `src/components/game/CareerTutorialDialog.tsx:28-56,154-184`; `GameShell.tsx:517`. | Marcações locais e união `learned+practiced` podem ocultar o próximo gate; não servem como prova de recompensa. | Separar `verified`/`reviewed`, eventos por ação real e manter qualquer benefício desativado até contrato server-side idempotente. |
| Alta | `src/components/game/stadium/StaticBatch.tsx:44-63`; `src/game/static-stadium-batch.ts:29-40,94-126`. | Mesh dinâmica pode ser ocultada após bake e congelar pose/material; testes atuais não fecham runtime. | Elegibilidade por revision/digest, commit tardio, rebuild/dispose idempotente e harness de churn/context loss antes de elevar qualidade. |
| Média | `src/i18n/bootstrap-messages.ts:39,85,98-100`, `NarrationSettings.tsx:51-53`, `game-page-metadata.ts:5-7`. | UI pode renderizar `common.loading` ou `nav.play` literalmente e misturar idiomas. | Checker de chaves/fallback e correção dos IDs antes de declarar locale aprovado ou publicar SEO internacional. |
| Média | `src/lib/firebase-push.ts:71-75`, `public/firebase-messaging-sw.js:19-34`, `public/sw.js:269-307`, `src/lib/logout.ts:7-19`. | Worker/documentação e lifecycle de token podem deixar inscrição órfã ou destino de conta anterior. | Definir worker responsável, reset account/device-scoped, rotação/stale e homologação isolada; não chamar ativação de produção por existência de código. |

## 9. Gates transversais de aprovação

### 9.1 Gate de código e CI

- O SHA candidato é o `b72a2fd` solicitado ou um descendente explicitamente identificado.
- `package-lock`, lock auxiliar, Node e configuração de build são os mesmos usados no CI; qualquer drift bloqueia.
- No run `42428747855` do SHA documental `b8df3cb`, build/types/tests, stress, bundle, replay Supabase, contratos 3D, auditoria de dependências e importer passaram, mas Lighthouse mobile e `Critical performance release gate` falharam por 1/3 execuções da home com score 87/TBT 459,1 ms. O job visual `evidence` era uma execução independente e ainda estava ativa no último status; detalhes e método de consulta estão no [diagnóstico](ci-diagnosis-b8df3cb-2026-11-07.md). Reexecutar todos os jobs após a correção no SHA candidato; ausência, cancelamento, timeout ou artifact missing falham fechado.
- O comparador mantém budgets absolutos por rota e zero crescimento de startup; +400.000 bytes é tolerância por representação agregada do JS, não autorização para a closure de startup nem para WASM não contabilizado.
- O resultado não pode ser chamado de “release aprovado” apenas porque o workflow está definido no YAML.

### 9.2 Gate de servidor, segurança e operações

- Não aceitar score, seed, winner, reward ou estado final enviado pelo browser.
- Toda operação repetível tem chave idempotente, owner/account scope, revisão/base revision e resultado estável em retry.
- Migrations, RLS, grants e RPCs são validados em banco descartável antes de qualquer promoção; o estado hospedado só pode ser descrito após evidência autorizada.
- Nenhum segredo aparece em bundle, URL, screenshot, log, fixture, relatório ou resposta pública.
- Para Cloudflare, Firebase, Supabase, Stripe, Resend, API-Football ou DataForSEO, distinguir código local de configuração/deploy efetivo.

### 9.3 Gate de save e compatibilidade

- `migrateCareer` e adaptadores aceitam saves antigos sem novos campos, com defaults determinísticos e sem apagar memórias históricas legítimas.
- Carreiras, tutoriais, snapshots e outbox são owner/account/career-scoped; troca de conta não mostra o save anterior.
- Antes de reset/replace/undo, existe snapshot ou confirmação explícita compatível com a operação; `undo` cloud é nova revisão forward e falha se outra revisão avançou.
- Lineup legado inválido, oferta antiga, ledger truncado e campos de empréstimo ausentes têm política documentada: reparar deterministically, marcar como inválido ou bloquear com mensagem; nunca inventar entidade, prazo ou dinheiro.
- Local/offline/cloud convergem sem reintroduzir oferta, evento financeiro, tutorial verified, receipt ou resultado já encerrado.
- Migração é forward e versionada. Não executar `DROP`, `TRUNCATE`, delete de evidência ou edição manual de histórico em produção como “rollback”.

### 9.4 Gate de acessibilidade

- Tab/Shift+Tab atravessam shell, busca, chips, seleções, ações, wizard e modal; foco retorna a heading/trigger lógico sem ocultar controle.
- Tabs usam `tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, roving tabindex e setas/Home/End quando aplicável.
- Dialog de MatchReport/tutorial tem foco inicial, contenção, Escape, restauração e status de processamento.
- Tabela recolhível, filtros, contagem, estado vazio e overflow têm nomes/relacionamentos válidos; `aria-controls` não aponta para nó inexistente.
- `forced-colors: active`, zoom 200%, viewport 320/375/600/640/850/1180px, text-size aumentado e `prefers-reduced-motion` são critérios de aceitação. Foco e estado não dependem apenas de cor, sombra, gradiente ou animação.
- Testes de string ou busca estática não substituem jornada DOM/browser com teclado e tecnologia assistiva.

### 9.5 Gate de evidência visual e 3D

Toda captura/vídeo precisa registrar SHA, fixture/seed, rota/cena, browser, viewport, DPR, backend WebGL/WebGPU, GPU/hardware, qualidade, clima, `prefers-reduced-motion` e data. A captura deve ser limpa, sem overlay de inspector, e comparar o mesmo roteiro antes/depois.

Para 3D, distinguir software/SwiftShader de hardware físico; não afirmar FPS/VRAM física a partir de `renderer.info`, heap JS ou bytes comprimidos. O relatório deve incluir lifecycle, context/device loss, first frame, draws, triângulos, p95/p99, long tasks e censo de recursos. Diferença visual deve ser revisada por imagem/vídeo, não inferida só de teste unitário.

## 10. Rollback, flags e compatibilidade operacional

1. **Feature flags:** multiplayer autoritativo, chat privado, FCM, tutorial verified, novo ledger, batching, cutscene transition e locale SEO entram desligados por padrão. A implementação anterior permanece disponível até o canário cumprir os gates.
2. **Rollback de aplicação:** desligar a flag, parar novos writers, consultar receipts/outbox e preservar resultados já duráveis. Reprocessar somente por chave idempotente; nunca reexecutar compra, prêmio, match ou evento por ausência de resposta HTTP.
3. **Rollback de save:** usar adaptador/migrador reversível no sentido lógico; preservar snapshots e campos desconhecidos. Não apagar save antigo para aplicar UI nova.
4. **Rollback de schema:** migrations de produção são forward-only; qualquer correção deve ser uma migration compensatória aprovada. A edição de `schema_migrations` só pode aparecer como exceção allowlisted em DB descartável, nunca como procedimento de emergência sem aprovação.
5. **Rollback de 3D:** voltar a WebGL2, StaticBatch desativado ou preset anterior se houver tela preta, perda de contexto não recuperada, crescimento residente, mudança visual não revisada ou budget excedido.
6. **Rollback de SEO/i18n:** retirar variante não aprovada do sitemap/noindex conforme política e preservar canonical das páginas aprovadas. Não gerar páginas artificiais para locales sem conteúdo.
7. **Critérios para acionar rollback:** fraude/resultado divergente, duplicação de receipt/fulfillment, conflito ou perda de save, aumento de 5xx, sala `settling` fora do SLA, segredo/PII em log, quebra de keyboard/foco, tela preta/flash branco, TBT/LCP/CLS fora do gate ou locale exibindo chave crua em superfície aprovada.

## 11. Decisões que exigem aprovação antes da implementação

Estas questões não devem ser “resolvidas” por inferência do código:

- confirmar que CI/bootstrap respeitam `drizzle/migrations` como trilha do backend conectado, conforme `AGENTS.md:36`, e definir isolamento dos arquivos históricos em `supabase/migrations`; qualquer exceção exige evidência autorizada do deployment;
- coordenador de sala: Durable Object/WebSocket ou serviço aprovado, região, TTL, lease e retenção;
- semântica inclusiva/exclusiva de `expiresRound`, oferta futura e empréstimo permanente/temporário;
- política de dívida/overdraft e moeda/contabilidade da carreira de jogador versus treinador;
- escopo de recompensa do tutorial, caso exista; até decisão server-side, permanece desativada;
- catálogo Cloudflare público versus endpoints administrativos privados e CORS correspondente;
- push como consentimento separado de analytics, retenção stale e comportamento de troca/logout de conta;
- locales com conteúdo realmente aprovado, URLs localizadas e `x-default`;
- necessidade editorial, orçamento e retenção para DataForSEO;
- fonte de backlinks, janela de 90 dias, autoridade do Search Console e limiar para revisão de disavow;
- perfil de hardware para certificação 3D e combinações WebGPU suportadas.

## 12. Limites e proibições desta entrega

- Durante as 25 revisões documentais não foram chamados serviços pagos nem APIs de produto/produção (keywords, email, Stripe, Firebase, API-Football, Cloudflare, Supabase hospedado ou Search Console). Depois dessa fase, em 2026-11-08, foram consultados metadados do projeto Supabase e executados oito `SELECT`s somente agregados/de catálogo para tamanho, tabelas, índices, colunas e disponibilidade de histórico; nenhum payload/linha de usuário foi lido e não houve DDL/DML, migration, `ANALYZE`, `VACUUM` ou deleção. Os valores exatos estão em artefato local fora do repositório e não são incluídos no PR por serem metadados operacionais.
- Nenhum segredo, `.env`, token, service-role key, API key ou valor de configuração privado foi lido, impresso ou incluído.
- Não foi feito teste ofensivo contra `jogomanager.com`, produção, banco hospedado, Worker ou provedor. DAST, fuzz e carga só podem ocorrer em staging/preview isolado com autorização explícita, dados sintéticos, egress allowlist e limites aprovados.
- As 25 revisões foram estáticas/documentais: não executaram testes, ataques, benchmarks, browser journeys, captura visual, stress, replay de migrations, auditoria de dependências ou validação de produção. Separadamente, o CI automático do run `42428747855` no SHA documental `b8df3cb` executou os gates: build/types/tests, stress, bundle, replay e demais contratos críticos passaram; Lighthouse mobile e o agregador crítico falharam pelo outlier da home. O fluxo visual do run `42428747827` ainda estava em `in_progress` na etapa de captura do baseline; ver [diagnóstico](ci-diagnosis-b8df3cb-2026-11-07.md). Isso não certifica o SHA documental posterior nem uma execução dinâmica feita pelas 25 revisões.
- Não foi produzido perfil de backlinks, classificação de toxicidade, lista de domínios, arquivo ou upload de disavow. Nenhum disavow deve ocorrer sem fonte escolhida, dados datados, revisão manual, evidência suficiente de links artificiais e aprovação do proprietário/revisor conforme a política do Google.
- Não se deve afirmar ativação de FCM, publicação Cloudflare, aplicação de migration, entrega de email, fulfillment Stripe, capacidade de quota, estado de DNS/TLS, performance física ou aprovação de release com base somente no código versionado.

## 13. Fontes oficiais já registradas nos resultados

Estas fontes são referências de desenho e aceitação; não substituem evidência do projeto:

- A lista de URLs e atribuições por fonte está no [adendo com oito frentes de pesquisa oficial e 75 referências](research-plan-addendum-2026-11-07.md).
- **Acessibilidade/CSS:** W3C WCAG 2.2 para `focus-visible`, keyboard, status messages e flashes; WAI-ARIA APG para tabs e dialog; W3C CSS Cascade 5 e Media Queries 5; MDN para `forced-colors` e `prefers-reduced-motion`.
- **Servidor/salas/realtime:** Cloudflare Durable Objects/WebSockets; Supabase RLS, Realtime authorization/Postgres Changes; OWASP WebSocket Security para autenticação, autorização, rate limit e replay.
- **Pagamentos/email/SSRF:** documentação oficial Stripe Webhooks, Resend Webhooks e OWASP SSRF.
- **Firebase:** documentação oficial de configuração Web, recebimento de mensagens, lifecycle de tokens e HTTP v1.
- **Quotas:** documentação API-Sports `/status`/limites e RFC 9110 para `Retry-After`.
- **3D:** React Three Fiber pitfalls/scaling, Three.js optimization, MDN WebGL context loss e `GPUDevice.lost`.
- **Bundle/CI:** Vite code splitting, Lighthouse CI assertions/aggregation, Web Vitals, npm `ci`/SBOM e GitHub Actions secure use.
- **SEO/backlinks:** Google Search Central para canonical/hreflang e Search Console disavow; Cloudflare DNS/cache/secrets/limits.
- **Locale:** MDN `Intl.NumberFormat`, `DateTimeFormat` e `PluralRules`.

## 14. Próximo passo recomendado

O próximo trabalho deve começar com um trace da home, não com aumento de budget nem refatoração ampla: reproduzir o outlier score 87/TBT 459,1 ms sob as mesmas condições; comparar o run com `hydrate-app` 432 ms a uma das execuções de TBT 22,5 ms; identificar call stacks, tarefas sem atribuição e o trabalho real do primeiro paint; então testar uma única correção e repetir as três amostras móveis. O detalhamento está em [ci-diagnosis-b8df3cb](ci-diagnosis-b8df3cb-2026-11-07.md). Em paralelo, preparar Lote 0 com o baseline de código `b72a2fd` (head documental medido `b8df3cb`), a reconciliação Drizzle e os fixtures de authority/room/save. Não liberar nem enfraquecer agregação/budgets; consultar o check `evidence` à parte e manter o PR em draft até o SHA candidato ter todos os gates e artifacts exigidos concluídos e aprovados.

**Conclusão:** os resultados sustentam uma implementação incremental, fail-closed para confiança e saves, com feature flags e rollback. Eles não sustentam declaração de release, produção segura, backlinks analisados, disavow, testes executados ou performance física certificada.


## 15. Checkpoint pós-integração — 2026-11-08

Este quadro atualiza o status das fases sem substituir critérios de aceitação ou autorização de produção. O plano mestre contém a sequência operacional e a [auditoria de cobertura i18n](i18n-coverage-and-hardcoded-audit-2026-11-08.md) contém o método e a lista de arquivos candidatos.

| Frente | Verificado neste checkpoint | Ainda não concluído |
|---|---|---|
| Worker/bundle | Artifact real 89.997 B; teto crítico 90.000 B mantido e `bundle:check` passou. | Repetir no build integrado final; a margem atual é só 3 B. |
| Elegibilidade de partida | Validação síncrona preservada antes da fila; regressões de titulares, goleiro, disponibilidade, IDs/clube e carreira. | Reexecutar a suíte integrada final após todas as mudanças. |
| Stripe | SDK/locks alinhados a 23.1.0, header `2026-10-28.endive` mockado e tipagem limpa. | Sem chamada financeira nem rollout; preservar essa separação. |
| Chat/RLS | Policies de broadcast privado, membership host/guest e vínculo do tópico; contrato passou em Postgres descartável local. | Replay canônico local/CI ainda é gate obrigatório; não aplicar ao projeto Supabase hospedado. |
| Firebase/FCM | Token isolado por owner; troca/logout revoga com cleanup compartilhado; 10 testes recentes, lint e TypeScript passaram. | Sem ativação ou envio real; confirmar credenciais, consentimento e rollout separadamente. |
| i18n | 98 packs × 238 keys, checker estrutural verde e JSON carregado/cacheado sob demanda. | 3.009 candidatos de texto literal em 184 TSX fora do catálogo; packs automáticos continuam em draft/reviewRequired e precisam revisão nativa/layout. |

O gate integrado final e a revisão independente do diff estão/estavam em execução na data deste checkpoint; não usar essa execução iniciada antes do último patch de concorrência FCM como aprovação final. O multiplayer ainda não é totalmente server-authoritative, não houve teste ativo contra produção, e DataForSEO/Ubersuggest/backlinks permanecem sem fonte autorizada/dataset. Não criar outro PR, não fazer merge ou deploy enquanto os gates críticos e o status de draft não forem resolvidos explicitamente.


## Checkpoint de integração — validação local pós-correção 3D (2026-11-08)

O candidato de trabalho está baseado no SHA remoto `2312d6d`; os resultados abaixo são locais e não equivalem à aprovação do PR. O branch do Three.js que renderiza materiais transparentes `DoubleSide` em dois passes também define `needsUpdate`, invalidando a revisão do StaticBatch. A grade alpha-tested passou a usar `forceSinglePass: true`, mantendo `DoubleSide`; a malha instanciada de flashes permanece marcada como dinâmica. Nenhum limite de draws foi alterado.

Com o inspetor oficial, após remoção da instrumentação temporária, o pico medido foi **74/75 draws em baixa** e **106/110 em média**. A comparação local pré-fix em média foi **183/110**, redução de **77 draws (42,08%)**. O lote principal final reportou 150 meshes elegíveis, 144 fontes e 19 grupos gerados. Chromium/SwiftShader é evidência sintética; não certifica GPU/FPS de aparelho. Ver o diagnóstico do CI para manter separado o histórico remoto de 112/114 draws e aguardar nova execução no SHA candidato.

Também passou novamente o contrato de policies Realtime em PostgreSQL local descartável com fixtures sintéticas, sem conexão Supabase hospedada. Testes focados de batching (12), TypeScript, lint, build do harness e inspetor low/medium passaram. **Pendente:** suíte completa, performance/stress, build principal + bundle absoluto, demais contratos/replay CI, revisão independente final e CI remoto verde. Não houve commit/push/merge/deploy nesta continuidade.
