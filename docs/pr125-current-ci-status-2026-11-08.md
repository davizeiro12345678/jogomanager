# PR #125 — status de CI e validação da candidata reconciliada (8 nov. 2026)

## Escopo

Snapshot local antes do push, sem acesso a banco remoto. A candidata está baseada diretamente no head remoto `a173a98f349cc54df712e26b84b32aa27c437665` da branch `codex/career-tutorial-css-20261107`; os sete commits que faltavam à worktree anterior foram integrados em uma worktree separada por patch de três vias e os novos arquivos intencionais foram copiados. O PR continua aberto/draft; ainda não houve commit, push, merge ou deploy desta candidata. A branch-base do PR é `main`, SHA `786f35d8f088` no fetch de 2026-11-08.

## Estado remoto

Na consulta mais recente, o PR estava aberto e em draft. `gh pr checks 125` reportou 22 checks `SUCCESS`, 2 `FAILURE`, 2 `SKIPPED` e nenhum pendente; os únicos blockers observados são `Lighthouse mobile multi-page audit` e seu dependente `Critical performance release gate`. O run de Quality correspondente é [42507187636](https://github.com/davizeiro12345678/jogomanager/actions/runs/42507187636); `trace` passou no run [42507187391](https://github.com/davizeiro12345678/jogomanager/actions/runs/42507187391).

O head remoto `a173a98` ainda tinha a policy temporariamente relaxada: três repetições com agregação pessimista, score mínimo `0,90`, TBT máximo `400 ms`, LCP máximo `2.700 ms`, CLS máximo `0,1` e acessibilidade mínima `0,90`. Esta candidata restaura os limites estritos originais: score `0,97`, TBT `200 ms`, LCP `2.500 ms`, CLS `0,1` e acessibilidade `0,90`. Nenhum resultado remoto anterior valida esses limites na candidata; um novo CI precisa rodar depois do push.

## Lighthouse — run 42507187636

O artifact `lighthouse-results` contém três repetições em cinco rotas. Métricas abaixo: **Performance / TBT ms / LCP ms / CLS**.

| Rota | Repetição 1 | Repetição 2 | Repetição 3 | Resultado |
| --- | --- | --- | --- | --- |
| `/` | 86 / 474,5 / 2.036,1 / 0 | 99 / 41 / 1.933,5 / 0 | 98 / 10,5 / 1.993,7 / 0 | Falha pessimista até sob o limite relaxado; também excede score/TBT estritos. |
| `/guia-de-scouting` | 100 / 10 / 1.536,6 / 0 | 100 / 12,5 / 1.240,7 / 0 | 100 / 11,5 / 1.500,5 / 0 | Passa nas amostras. |
| `/guias` | 100 / 8,5 / 926 / 0 | 100 / 9 / 924,7 / 0 | 100 / 10 / 1.388,6 / 0 | Passa nas amostras. |
| `/melhores-formacoes` | 100 / 8 / 1.380,2 / 0 | 100 / 10 / 1.385,7 / 0 | 100 / 10,5 / 1.531,7 / 0 | Passa nas amostras. |
| `/partida-rapida` | 99 / 108 / 1.240,4 / 0 | 100 / 45 / 1.540,9 / 0 | 100 / 53,5 / 1.395,8 / 0 | Passa nas amostras. |

Na repetição falha da home, o artifact registra sete long tasks. As maiores são associadas a `hydrate-app-ydh6J2UC.js` (`472 ms`, início em aproximadamente `3,83 s`), ao documento (`347 ms`), a tarefas não atribuídas (`245 ms`, `185 ms` e `79 ms`), ao documento (`74 ms`) e a `browser-react-Bc96TmvK.js` (`155 ms`). A auditoria `long-tasks` classifica a tarefa de 472 ms como `other`, não como `scriptEvaluation`. Separadamente, `bootup-time` estima aproximadamente `457 ms` de scripting para aquele recurso e `333 ms` para `browser-react`; esses números não trazem call stack e não provam que sejam a causa da long task. O LCP de `2.036,1 ms` e CLS zero passam também os limites estritos, mas o TBT não.

O artifact remoto identifica `hydrate-app-ydh6J2UC.js` com `290.586` bytes de recurso (`88.570` transferidos) e `browser-react-Bc96TmvK.js` com `38.388` (`14.184` transferidos). O `.output` local da worktree, porém, contém `hydrate-app-BtvlCxV5.js` com `371.245` bytes e um hash diferente; não está demonstrado que esse output seja o mesmo build do run remoto. Portanto, esses chunks locais não são usados para atribuir causalidade ao artifact remoto.

O artifact suporta uma conclusão limitada: **há um outlier real de TBT/hidratação na home sob o laboratório Lighthouse**, enquanto as outras rotas/repetições medidas passam. A evidência disponível não identifica uma função/módulo causal; não se declara resolução nem melhora de runtime antes de uma mudança causal e nova medição no mesmo harness. O artifact é sintético e não certifica dispositivos físicos nem RUM.

## Validações locais na candidata reconciliada

Os seguintes gates foram executados na candidata baseada em `a173a98`:

- `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test` (2.005 testes) e `npm run test:performance-gates` (31/31): passaram.
- `npm run build` e `npm run bundle:check`: passaram; `bundle:check` terminou com código 0 e verificou os budgets por rota/startup.
- Stress no formato do CI (`npm run test:stress` com reporter JSON + `verify-stress-report.mjs`): passou, com uma asserção executada, 200 sementes e replays determinísticos independentes; execução de 195,1 s.
- `npm run graphics:build` e os dois testes explícitos do job graphics-contract: passaram (8/8 testes). O build informa chunks individuais acima de 500 kB; isso é um aviso do bundle gráfico, enquanto `bundle:check` passou. `verify-game-assets.mjs` executou, mas reportou que não há `public/game-assets`; nenhum asset 3D concreto foi certificado.
- CI auxiliares: i18n 11/11; importer D1/rate-limit/worker-security 36/36; snapshot de banco/deployment público/fontes 31/31; Edge/import/paridade 30/30; proveniência/startup de migration 5/5. `verify-migration-history.mjs` passou (47 originais registrados, 12 envelopes transacionais, 1 pré-requisito de extensão, 25 incrementais e 35 arquivos preservados).
- `tests/sql/career-tombstone-generation-contract.sql` e `tests/sql/realtime-room-chat-policy-contract.sql`, junto às migrations 0061/0062 e assertion de grants/RLS, passaram em PostgreSQL 16 temporário isolado. Não houve acesso a banco Supabase remoto. O replay canônico completo do job CI não foi repetido: Supabase CLI e Docker não estão disponíveis neste sandbox.
- `npm audit --omit=dev --audit-level=high` não encontrou severidade alta/crítica (exit 0), mas reportou quatro ocorrências baixas na cadeia `deepmerge` → `html-to-text` → `@react-email/render` → `@react-email/components`; o advisory indica que não há correção disponível.
- O dry-run Cloudflare não foi concluído. A chamada direta `cloudflare:check` exige primeiro o artefato `.cloudflare/production/server/index.mjs`; a verificação de presença encontrou `SUPABASE_URL`, mas não `SUPABASE_PUBLISHABLE_KEY`. Não se usou `SUPABASE_KEY` como substituto, não se imprimiu valor de segredo e nenhum deploy foi feito.
- O benchmark MatchSim ABBA contra `main@786f35d` passou: 62 amostras por revisão, 21 checkpoints determinísticos, CPU média de `0,124208 ms` na base e `0,121063 ms` na candidata (`−2,53%`); intervalo bootstrap de 99% da razão `0,9486–0,9984`, `failed=false`, `violations=[]`. É evidência do construtor MatchSim, não do TBT/Lighthouse.

Um experimento de atrasar `HomeDetails` até viewport/interação foi revertido: o teste no browser observou o HTML SSR inicial, mas o conteúdo desaparecia após a hidratação até o gate ativar. Não foi mantido por regressão de disponibilidade/UX e não há ganho de TBT demonstrado. A otimização lazy de metadata da FAQ permanece e preserva o SSR/SEO.

## Itens ainda bloqueantes ou não concluídos

1. O outlier Lighthouse da home continua sem correção causal comprovada; a candidata restaura os budgets estritos e precisa de CI nova. O run remoto conhecido falha até sob a policy relaxada.
2. O benchmark MatchSim ABBA passou localmente contra `main@786f35d`; após o staging seletivo, publicar somente no branch existente do PR por push normal (sem force-push) e revisar a nova execução CI; não fazer merge enquanto qualquer gate estiver falhando.
3. O rate limit do provider permanece `450/min` e `75.000/24h`; o rate limiter público D1 por IP é um limite distinto de `120/min`. Não elevar para `1.100/min` e `445.000/dia` sem contrato/capacidade autorizados. Nenhum deploy foi feito.
4. Os 98 packs i18n continuam drafts estruturais, sem aprovação semântica para runtime.
5. Autoridade multiplayer real, DAST em staging autorizado, vídeo contínuo, SEO/backlinks/disavow com fonte/dataset autorizado e demais fases do plano permanecem incompletos ou condicionados. Não houve ataque ativo, alteração de produção ou disavow.

## Fontes

- PR e checks: [PR #125](https://github.com/davizeiro12345678/jogomanager/pull/125), run [42507187636](https://github.com/davizeiro12345678/jogomanager/actions/runs/42507187636), trace [42507187391](https://github.com/davizeiro12345678/jogomanager/actions/runs/42507187391).
- Artifact Lighthouse: arquivo `lighthouse-results` associado ao run `42507187636`; extraído para `/tmp/pr125-lhci-current-artifact/` no ambiente de investigação, fora do repositório.
