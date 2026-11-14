# SDD ledger — plan: docs/superpowers/plans/2026-11-12-match3d-major-upgrade.md

## Checkpoint final local — substitui estados pendentes abaixo

- Código combinado com a remota `aa5e1fbd`, incluindo a correção de textura: **422 arquivos / 2.620 testes aprovados**, zero falhas, `npm test` exit 0 (326,06 s), Node 24.22.0.
- Lint completo zero erros/avisos; `tsc --noEmit --pretty false`, build gráfico, build da aplicação e `bundle:check` finais: exit 0. SEO node:test 38/38 e scripts de desempenho 38/38.
- Testes stress de 200 seeds, replay SQL, matriz Lighthouse, comparador de bundle baseline/candidate e campanhas físicas completas dependem dos workflows/gates de release. Não são aprovados pela suíte padrão, que exclui os dois arquivos stress conforme o script do projeto.
- Revisão independente dos lotes: zero Critical/Important. Os dois Minor de batching e demais limitações/rulings permanecem registrados abaixo.
- A base remota `aa5e1fbd` ainda tinha falhas nos runs `Quality gates 43331681903` e `Match 3D lifecycle/context recovery 43331681847`; o novo SHA deve ser avaliado integralmente, sem aproveitar sucesso de uma revisão anterior.
- Planejamento ampliado e correções prontos para envio à PR #132 existente, mantendo Draft. Sem merge em main, deploy ou escrita em produção.

## Task 7 — correção adicional de alocação de textura

- `stadium/textures/turf-detail.ts` agora cria as duas texturas neutras em 512×512; geração assíncrona troca dados sem alterar identidade/dimensões após upload. Custo inicial compartilhado: 2 MiB CPU para placeholders; não há alocação por atleta/frame.
- RED real: largura inicial 1 em vez de 512. GREEN: sete testes em três arquivos, cobrindo neutralidade, dados finais, identidade, ownership/cancelamento, retorno da lane e paridade TS/WASM.
- Revisão independente somente deste delta: zero Critical/Important/Minor; reviewer repetiu quatro testes de lifecycle/paridade com sucesso. ESLint focado e types completos aprovados.
- Novo build gráfico e smoke `graphics-high-v1` na mesma Iris Xe/ANGLE: 60 s completos, zero erros e **zero avisos GL_INVALID_VALUE**; permaneceram depreciação de Clock e aviso de precisão de shader do driver. Captura `match-texture-fixed.jpg`, dados e console em `texture-browser-diagnostic.json`.
- Diagnóstico observado: **30,62 FPS** em alta, com suíte/build/lint em execução concorrente. Não é baseline/candidate controlado, nem 30 s warmup + três janelas de 90 s, e não aprova o gate de 60 FPS. O resultado adverso foi preservado, sem recategorizar alta como cinema.
- Ruling: antecipar a alocação neutra ao tamanho final respeita o contrato Three/WebGL2 e preserva compartilhamento — custo se errado: 2 MiB CPU iniciais adicionais até substituição pelo mapa final e upload inicial maior; medir primeiro frame no protocolo final.
- Integração local: `d483f30f` contém o lote inicial; merge normal `030685e5` incorporou a remota `aa5e1fbd` e preservou moderação/localização concorrentes. Não houve reescrita de histórico.
- Nova suíte completa, lint/types e build executados após esse merge e a correção de textura; aguardar o resultado final abaixo antes de atribuir aprovação ao código combinado.

## Checkpoint local anterior à correção adicional de textura

- `npm test` repetido: **421 arquivos e 2.618 testes aprovados**, zero falhas, exit 0 (319,89 s).
- `npm run lint`: exit 0, zero erros/avisos. `npm run build` e `npm run bundle:check`: exit 0. O relatório de bundle absoluto não é comparação baseline/candidate.
- `tsc --noEmit --pretty false`: exit 0. Gate de scripts de desempenho 38/38; testes SEO 38/38.
- Browser: cutscene aberta/reaberta com um Canvas e zero erros de console; no cenário de partida `graphics-high-v1`, renderização visível com favicon 404, depreciação de Clock, aviso de precisão do driver e **dois avisos GL_INVALID_VALUE de upload de textura**. Não declarar gate visual limpo.
- Investigação adicional localizou normal/roughness de gramado iniciadas em 1×1 e substituídas por 512×512 após upload, incompatível com storage imutável do WebGL2. Correção/testes e nova validação estão em andamento; estes resultados não aprovam automaticamente essa mudança posterior.

## Identidade e autorização

- Continuação solicitada em 12/11/2026 na PR #132, com ampliação do plano para gráficos, carregamento, FPS, cutscenes, física/IA/stack e Semrush.
- Checkout isolado: `pr132-visual-upgrade-20261112`, base inicial `b0ce05a3d3b0dc8bd673e1450fb73d789d4ab149`. Branch remota de destino: `integration/release-2026-11-11`.
- As cópias anteriores estavam em branches antigas e sujas; seus arquivos não foram alterados. A remota avançou durante o trabalho; integração por merge normal e verificação do SHA combinado são obrigatórias.
- Não houve merge em main, deploy, DDL, ativação de flags ou alteração de serviços/credenciais nesta continuação.

## Pre-flight e decisões

- Interface: retry de cutscene → lazy identity/GraphicsBoundary. Decisão: recriar somente na tentativa explícita; o preload saudável permanece deduplicado.
- Interface: batching → descendentes assíncronos. Decisão: abandonar ownership de zero batches e observar hierarquia; sucesso positivo mantém ownership e descarte existentes.
- Interface: pressão → revisão tática do defensor. Decisão: filtrar expulso apenas em `tacticalAiRevision === 2`; caminho legado e RNG preservados.
- Interface: deploy verifier → auditoria SEO. Decisão: executar após SHA/readiness/acesso anônimo; origem fixa e leitura limitada, sem autenticação.
- Ruling: manter a stack instalada e adiar mudanças maiores de física/IA para nova revisão explícita — evita quebra de replays/autoridade; custo se errado: atraso de uma evolução que poderia caber na revisão atual, preferível a reinterpretar partidas persistidas.
- Ruling: evoluções amplas do plano são frentes de descoberta e precisam de pacotes executáveis menores antes do código — evita inventar contratos/fixtures; custo se errado: mais documentação para uma mudança simples.
- Ruling: não esconder as tabelas 500 como HTTP 200 vazio nem remover páginas públicas válidas do sitemap — a configuração publicada precisa ser reparada e validada; custo se errado: indisponibilidade permanece visível até o release correto.

## Trabalho implementado neste lote

### Task 2 — parcial: recuperação e batching de startup

- `cinematic-loading.ts` cria lazy owner por tentativa; `CutsceneStage.tsx` substitui owner e remonta o boundary após retry.
- Regressão renderiza React real por streaming; primeira tentativa rejeitada, segunda rende a cena recuperada. Mutação reutilizando owner rejeitado reproduziu o defeito, seguida de restauração e GREEN.
- `CinematicSetBatch.tsx` libera zero-batch inicial e agrupa objetos que chegam posteriormente, sem serializar materiais novamente em frames sem alteração nem solicitar invalidações contínuas.
- Regressões usam grupos/meshes/geometrias reais; RED mostrava meshes atrasados ainda visíveis individualmente, GREEN confirma incorporação ao batch.
- Validação do implementador: 55 testes / 8 arquivos, ESLint zero avisos, types e Prettier aprovados, Node 24.22.0.
- Limite: inserções após um batch positivo já formado não foram resolvidas por este lote.

### Task 3 — parcial: gate de SEO público

- Novo `scripts/verify-public-seo.mjs`; CLI de `verify-public-deployment.mjs` preserva checks anteriores e adiciona sitemap/indexabilidade/links.
- Limites: 120 páginas por padrão, 3 simultâneas, 15 s por request, 2 MB por corpo, 4 redirects; leitura anônima, sem seguir API/checkout/callback ou origem externa.
- RED 15 casos, GREEN 38/38 node:test. Executor e reviewer repetiram os 38 casos sem falhas.
- `seo-live.json`: 34 entradas no sitemap, 12 tabelas HTTP500, seis páginas públicas com noindex; 13 links públicos adicionais sem erro; health HTTP503, commit null e dependências de servidor indisponíveis.
- Os 14 links do relatório histórico e o bloqueio Semrush não foram certificados como resolvidos. Precisam de URLs do crawl, evento específico quando aplicável e recrawl após release/configuração.

### Task 10 — parcial: apoio defensivo válido

- `sim-ball-duels.ts`: expulso não fortalece a disputa defensiva da IA v2; revisão omitida conserva comportamento.
- `pressure-support.test.ts`: quatro cenários MatchSim reais com `sendOff()` junto ao corner, apoio ativo, legado/draw order e revisão de cada time.
- RED 2 falhas / 2 aprovados; GREEN 40 testes em cinco arquivos; lint/Prettier aprovados.

### Gates herdados de estilo e plataforma

- Primeiro lint completo reproduziu 33 erros Prettier em quatro arquivos herdados; corrigidos por formatação, sem alteração semântica. A remota depois publicou a mesma correção; preservar sua autoria no merge.
- Primeira suíte completa: 419 arquivos aprovados e um falhado, 2.615 testes aprovados / um falhado. Único caso: `multiplayer-security.test.ts` dependia de LF literal e falhava no checkout CRLF do Windows.
- Ruling: aceitar LF ou CRLF no guard existente, mantendo a mesma verificação de ordem entre live room/fallback offline — custo se errado: guard textual continua menos forte que um teste comportamental; não removemos sua proteção.
- Grupo final focado com esse ajuste: quatro arquivos, 21 testes aprovados. Suíte completa repetida após o ajuste; registrar resultado final abaixo quando terminar.

## Revisão independente

- Builder check de spec/plano: três Important corrigidos (60 FPS também nas cutscenes alta; frentes futuras explicitamente ainda por refinar; matriz ortogonal com noite+chuva) e duas precisões de documentação corrigidas (API/testes reais de SEO e soft error 200 explicitamente pendente).
- Revisão de código independente sobre esta continuação: zero Critical/Important; não representa revisão dos 872 arquivos herdados da PR.
- Final: minor (deferred): zero-batch não emite snapshot `onReady` com contagens zero; ausência de metadado fica ambígua para diagnóstico, sem bloquear apresentação.
- Final: minor (deferred): comparar hierarquia a cada frame ativo enquanto zero-batch tem custo; medir sets complexos não agrupáveis antes de adicionar observação mais complexa.
- Final: Ruling: inserções após batch positivo ficam no plano — limitação anterior fora da correção de startup; custo se errado: geometria nova continua em draws separados.
- Final: Ruling: FPS, estabilidade térmica e salto visual final continuam pendentes — diff/unit tests não demonstram esses resultados; custo se errado: certificação demora, sem alegação enganosa.
- Final: Ruling: configuração das 12 tabelas, publicação e recrawl são validações remotas separadas — este lote só detecta os defeitos; custo se errado: Semrush permanece vermelho até correção operacional real.
- Final: Ruling: revisão delimita somente esta continuação — o restante da PR precisa de revisão/gates de release; custo se errado: defeitos herdados permanecem possíveis.

## Verificação do executor

- Ambiente de teste: Node 24.22.0. `npm ci --ignore-scripts --no-audit --no-fund`: exit 0, 826 pacotes; scripts de lifecycle não executados na instalação. Builds e testes exercitam os binários instalados separadamente.
- `tsc --noEmit --pretty false`: exit 0.
- `node --test scripts/verify-public-deployment.test.mjs`: 38/38 aprovados.
- `npm run test:performance-gates`: 38/38 aprovados.
- `npm run graphics:build`: exit 0; aviso de chunks grandes preservado.
- Browser local: cutscene abriu com um Canvas, diálogo/respostas funcionais e zero erros de console observados. Renderer reportado: WebGL2, ANGLE/Intel Iris Xe/D3D11, canvas 1025×703. Captura `cinematic-smoke.png`. Isto é smoke visual, não campanha de FPS.
- Lint completo final, suíte completa final e build da aplicação: resultados serão acrescentados no checkpoint final.

## Próxima execução

1. Atualizar SHA remoto e integrar alterações concorrentes sem sobrescrever histórico.
2. Conferir gates do SHA final; não atribuir resultados locais antigos a código novo.
3. Refinar Task 1/4–8 em incrementos visuais medidos, começando com primeiro frame/shaders e retrato isolado do atleta.
4. Homologar física/IA futura com nova revisão, snapshots/tickets/checkpoints/servidor e A/B pareado; não elevar globalmente substeps já existentes para fingir realismo.
5. Manter PR draft enquanto restarem GPU, staging, SQL, stress, Lighthouse e release; somente release aprovado pode restaurar produção/configuração e motivar novo crawl Semrush.
