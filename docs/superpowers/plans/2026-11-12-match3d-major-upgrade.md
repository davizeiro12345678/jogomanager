# PR #132 — Match 3D Major Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** elevar visivelmente Match 3D e cutscenes, estabilizar frame pacing/carregamento e avançar física/IA com compatibilidade de replay, incluindo o tratamento reproduzível dos problemas Semrush.

**Architecture:** incrementos sobre R3F/Three/Rapier existentes; simulação sequencial no Worker e autoridade no servidor. Separar apresentação, versões da simulação e verificação de publicação. Este adendo amplia Tasks 8–9 da integração e P0/P1/P6/P7/P8 da expansão de 11/11, preservando os demais pendentes.

**Tech Stack:** TypeScript, React, TanStack Start/Query, R3F, Three.js, Rapier, KTX2, Vitest, node:test, Playwright e scripts gráficos existentes; Node 24.22.0 e lockfile versionado.

**Spec:** `docs/superpowers/specs/2026-11-12-match3d-major-upgrade-design.md`.

## Global Constraints

- PR #132 e histórico publicados preservados; nenhum force push ou substituição da PR.
- Um Canvas proprietário por apresentação; estado autoritativo fora de objetos Three/React.
- Física pura sem RNG novo em `match-physics-extras.ts`; novas semânticas maiores precisam de revisão persistida e opt-in. Replays antigos conservam sua revisão.
- `HdrSanitize` antes de bloom. Recursos compartilhados têm retenção/descarte explícitos; caches são limitados.
- Preservar todos os limites de `docs/critical-performance.md`, inclusive Lighthouse e bundles.
- Zero novos pacotes até demonstrar lacuna da stack instalada e auditar versão exata. Nenhuma migração/credencial/flag de produção por efeito secundário.
- [x] Plano ampliado no pedido do proprietário; tarefas de produto abaixo só ganham [x] com prova específica, nunca pelo tamanho do diff.

## Review Focus

- Download 3D falha, retry sucede e nova cena precisa aparecer sem recarregar a página; Task 2.
- Compilação termina depois de unmount/context loss; não pode promover nem descartar recurso de outro consumidor; Task 4.
- LOD/qualidade muda durante chute/diálogo; identidade, pé no solo e movimento devem continuar coerentes; Tasks 5–8.
- Dois defensores cruzam uma bola rápida no mesmo tick em ordem oposta no elenco; o primeiro contato físico deve vencer na revisão nova; Task 9.
- Sitemap retorna HTML 200 com noindex ou link interno 500; o verificador deve reprovar; Task 3. Detecção de soft error com HTTP 200 exige um contrato de conteúdo por rota e permanece investigação pendente.

## Sequência e estado

Task 1 fornece a comparação. Tasks 2, 3 e a correção delimitada de Task 10 podem avançar em paralelo. Tasks 4–8 entregam o salto visual por camadas. Tasks 9–10 evoluem física/IA somente após seus contratos. Tasks 11–12 fecham stack e evidência. `[~]` significa parcial; nenhum resultado de unit test certifica GPU ou produção.

**Granularidade:** Tasks 2–3 e a correção imediata de Task 10 são pacotes executáveis desta continuação. As demais descrevem frentes de investigação e implementação. Antes de escrever código de cada frente futura, o executor deve produzir um pacote menor com os defeitos/fixtures observados, assinatura e revisão definitivas, limites derivados da baseline, testes com valores esperados e comandos exatos. Esse refinamento continua dentro do pedido autorizado; não adivinhar anatomia, asset ou contrato de física apenas para preencher um plano. Preservar o histórico das decisões no ledger.

### Reconciliação de evidências em 26/11/2026

Os workflows e artefatos abaixo registram resultados dos respectivos SHAs. Repetir a validação exigida no candidato que entrar em revisão de release.

| Escopo | Estado | Evidência |
|---|---|---|
| Estúdio e navegação | Validado em Chrome com WebGL por software | `be8c85f6`, [QA de nove eixos](https://github.com/davizeiro12345678/jogomanager/actions/runs/45724717945). São 29 capturas e troca real entre rig detalhado e leve. |
| Comparação visual de partida e poses | Validado em laboratório no SHA indicado | `679fbb5f`, [Match 3D visual evidence](https://github.com/davizeiro12345678/jogomanager/actions/runs/45735252382). O CI executou a comparação de fixtures e os tetos de cena móvel. |
| Lighthouse e build | Validado no SHA indicado | `679fbb5f`, [Quality gates](https://github.com/davizeiro12345678/jogomanager/actions/runs/45735252389). 15/15 medições móveis entre 99 e 100, TBT máximo de 18 ms, LCP máximo de 1.631 ms e CLS zero. |
| CodSpeed | Instabilidade em `b318f663` e regressão de mediana em `a7c4871` | Em `b318f663`, a primeira rodada reprovou a mediana de decodificação (+19,52%). A segunda reprovou o p99 com picos nos dois pares (44,33/36,49 ms). A terceira passou, com mediana do decoder −6,10% e `encodeReplay` +1,05%. As duas rodadas de `a7c4871` reprovaram por +120,59% e +179,76% na mediana do decoder. O ABBA local com o mesmo replay de 23.040 quadros confirmou a piora em ambos os pares contra o pai direto. [Execuções de `b318f663`](https://github.com/davizeiro12345678/jogomanager/actions/runs/45823494751) e [`a7c4871`](https://github.com/davizeiro12345678/jogomanager/actions/runs/45825326035). |
| Recuperação de texturas e contexto | Validado no SHA indicado | `b318f663` restabelece a transcodificação de KTX2 ao trocar perfil do renderer. O [teste de ciclo de vida](https://github.com/davizeiro12345678/jogomanager/actions/runs/45823495306) verifica uploads e descarte em alternâncias de LOD e recuperação forçada do contexto. |
| GPU e homologação | Pendentes | Falta a campanha térmica em hardware físico e o teste autenticado do Worker web, carteira, carreira e salas reais. |

### Task 1: baseline atual e campanha comparável

**Files:** `src/game/frame-campaign.ts`, `src/game/frame-metrics.ts`, `scripts/frame-campaign-capture.mjs`, `scripts/quality-graphics-sample.mjs`, `scripts/quality-cinematic-evidence.mjs`; evidência em `verification/pr132-upgrade-20261112/`.

**Interfaces:** consumir campanhas existentes; produzir manifestos baseline/candidate com SHA, fixture/lockfile, versões, GPU/backend, viewport/DPR/preset/câmera/clima, amostras e URLs de artefatos.

- [x] Identificar checkout correto, branch remota, SHA inicial e alterações herdadas; checkout isolado em `b0ce05a3`.
- [ ] Validar testes existentes de campanha, hidden tab, mudança de contexto e capacidade; acrescentar caso real faltante antes de mudar instrumentação.
- [ ] Executar baseline de partida e cutscene: três repetições, 30 s warmup + ≥90 s medidos e sessão térmica de 10 min por aparelho.
- [ ] Manifestar e preservar a matriz ortogonal de câmera {TV, close}, fase {live, goal, replay}, luz {dia, noite}, clima {seco, chuva}, preset {baixa, média, alta}; incluir noite+chuva. Doze capturas representativas podem complementar a matriz, sem substituir os cenários obrigatórios existentes. Acrescentar entrada/vestiário/negociação com seus presets próprios.
- [x] Executar `node --test scripts/frame-campaign-capture.test.mjs` e Vitest `src/game/frame-campaign.test.ts src/game/frame-metrics.test.ts`. Os testes passaram no checkout de `7ccbd8ad`. A campanha física está registrada na Task 16.

### Task 2: recuperação real de carregamento de cutscenes

**Files:** `src/components/game/cinematic/cinematic-loading.ts`, `CutsceneStage.tsx`, `cinematic-loading.test.ts` e teste de renderização associado.

**Interfaces:** manter preload deduplicado; produzir uma nova identidade React.lazy por tentativa após rejeição, sem remontar cada frame nem duplicar downloads bem-sucedidos.

- [x] RED: falhar primeiro import, renderizar fallback, tentar novamente e resolver o segundo import; verificar conteúdo real da segunda cena, duas tentativas e nenhuma rejeição reapresentada.
- [x] Implementar reset do boundary/identidade no evento de retry; preservar desmontagem, skip, diálogo e import em voo.
- [x] GREEN: executar testes de loading/stage/controles e TypeScript. Expected: retry restaura 3D sem reload; sucesso em cache não refaz import. Evidência e escopo no ledger; campanha completa de FPS continua pendente.
- [x] Verificar download interrompido e retomada da cutscene no Chrome. O [workflow de recuperação](https://github.com/davizeiro12345678/jogomanager/actions/runs/45820248917) passou em `7ccbd8ad`.
- [ ] Medir primeiro frame e retenção após reaberturas repetidas nas condições da campanha.
- [ ] Commit pequeno com evidência; marcar [~] se o comportamento foi testado mas o navegador/GPU ainda faltar.

### Task 3: gate SEO que reproduz as capturas Semrush

**Files:** `scripts/verify-public-deployment.mjs`, `scripts/verify-public-seo.mjs`, `scripts/verify-public-deployment.test.mjs`, política/inventário público existente e `verification/pr132-upgrade-20261112/seo-live.json`.

**Interfaces:** `verifyPublicSeo({ fetchImpl = fetch, report = console.log, maxPages = 120 } = {})` consome sitemap e URLs públicas reais; produz relatório sanitizado de status final, redirects, canonical, X-Robots-Tag/meta robots e links internos. Teto padrão 120 URLs, 3 requisições simultâneas, 15 s/requisição, 2 MB/resposta e 4 redirects. Não substitui recrawl Semrush nem detecta todo soft error 200.

- [x] RED: fetch injetado com objetos Response reais e sitemap contendo página 500, HTML noindex, canonical divergente, link quebrado e página privada legítima fora do sitemap; verificar saída reprovada e diagnósticos por URL. Complementar com execução HTTP real de integração se a fronteira de rede mudar.
- [x] Implementar auditoria limitada e rejeição dos defeitos sem retirar checagem de SHA/readiness. Timeouts/erros de rede reprovam, não viram sucesso silencioso.
- [x] GREEN: executar node:test; caso saudável completo aprova e endpoints privados não são crawleados por autenticação. 38/38 testes; a sondagem real de produção reprovou corretamente e não constitui correção remota.
- [ ] Preservar intenção de noindex/nofollow; diferenciar robots.txt de bloqueio WAF com URL/UA e evento específico.
- [ ] Pós-release: deploy da revisão aprovada com bindings privados corretos, 12 tabelas respondendo conteúdo válido, sitemap indexável e recrawl Semrush. Configuração/publicação e recrawl não estão concluídos por adicionar este gate.

### Task 4: primeiro frame e shader warmup sem picos

**Files:** `src/components/game/Stadium3D.tsx`, `stadium-loading.ts`, `cinematic/CinematicRuntime.tsx`, loaders/texture policies existentes; criar `src/game/graphics-warmup.ts` + `.test.ts` se necessário.

**Interfaces propostas:** `prepareScenePrograms(renderer, scene, camera, signal): Promise<'ready' | 'cancelled'>`; consumir `compileAsync` da versão instalada quando presente; não adicionar segundo renderer.

- [ ] RED: cancelamento antes/depois da compilação impede callback de promoção; chamadas simultâneas da mesma cena não duplicam trabalho; rejeição pode ser retomada com nova tentativa.
- [ ] Implementar aquecimento somente após luzes/materiais finais disponíveis, cancelamento no unmount/context loss e lotes opcionais fora do frame crítico; fallback suportado explicitamente medido.
- [ ] GREEN: teste do coordenador com fronteira de renderer controlada + integração real em build gráfico. Expected: nenhum recurso de consumidor ativo é descartado.
- [ ] A/B cold/warm: clique→primeiro frame, interação, programas compilados e stalls; reprovar trabalho adiado que só desloca travamento para kickoff/replay.
- [ ] Commit e atualizar ledger com números brutos; não atribuir FPS total à redução de um microbenchmark.

### Task 5: atleta hero, anatomia e materiais

**Files:** `src/game/player-materials.ts`, `rig-materials.ts`, `src/components/game/players/`, `src/game/match-rig-detail.ts`, retrato/PlayerStudio existentes e testes de material/rig/LOD.

**Interfaces:** mesmas identidades e atributos; materiais compartilham mapas imutáveis e retenção; `playerMaterials` e `retainPlayerMaterials` continuam compatíveis.

- [x] Reproduzir a abertura na manga leve nos dois perfis instanciados. O teste cobre a união do ombro e o punho aberto. O fechamento usa o mesmo draw da manga.
- [x] Registrar ajustes implementados de anatomia e material. `#174` integrou a anatomia cinematográfica, `02667b4` preservou acabamentos de chuteiras e `7ccbd8ad` uniu a barra do calção ao próprio tecido. As suítes de material, calção e rig passaram.
- [ ] Completar a comparação pareada de três corpos, tons e cabelos em luz e poses idênticas. Validar textura e retenção ao alternar todos os LODs.
- [ ] Aprovar retrato isolado antes de propagar; implementar hero detail apenas para câmera próxima, mantendo uniforme e silhueta nos demais LODs.
- [ ] GREEN: regressões existentes de anatomia/materiais/streaming/lifecycle e build gráfico; renderizar 22 jogadores nas três qualidades.
- [ ] Gate visual independente com fotos comparáveis e draws/triângulos/VRAM/stalls; rejeitar clipping, perda de identidade ou excesso de custo.

### Task 6: movimento com peso e contato legível

**Files:** `src/game/gait-kinematics.ts`, `athlete-posture.ts`, `src/components/game/players/player-rig-frame.ts`, controladores de rig/bola e testes existentes.

**Interfaces:** usar relógio/cadência compartilhados; offsets de apresentação não escrevem em MatchSim, posse ou Rapier autoritativo.

- [ ] RED: troca de LOD no apoio não muda fase; curva/frenagem não inverte joelho; recepção/chute/defesa respeitam intervalo de contato e valores finitos.
- [ ] Implementar foot locking, transições e antecipação/recuperação por intenção com orçamento de câmera; evitar IK em 22 atletas distantes.
- [x] Validar fase de marcha e relógio de ações do replay. Os testes cobrem valores finitos, reinício legítimo de uma ação e restauração do último quadro. As revisões determinísticas passam nos jobs de 200 partidas.
- [ ] Validar contato pé/solo e pé/bola em toda a matriz de gestos e transições de LOD.
- [ ] Capturar sprint→parada→giro, passe/chute, tackle e defesa nas mesmas seeds/velocidades; revisar deslizamento e conexão pé-bola quadro a quadro.
- [ ] Medir animação/CPU e p95 no elenco completo antes de aceitar.

### Task 7: gramado, iluminação, estádio e torcida

**Incremento concreto encontrado no smoke:** `stadium/textures/turf-detail.ts` enviava placeholders 1×1 à GPU e depois imagens 512×512 para a mesma textura. A correção mantém dimensões finais desde a criação, com normal/roughness neutras e 2 MiB CPU compartilhados iniciais. `stadium/textures/turf-detail.test.ts` cobre geração assíncrona, identidade, retenção e cancelamento; detalhes RED/GREEN e novo smoke no ledger. Este incremento não conclui a direção de arte inteira desta Task.

**Files:** `src/game/pitch-material.ts`, `grass-material.ts`, `match-lighting.ts`, `stadium-background-material.ts`, `src/components/game/stadium/StadiumTurf.tsx`, `StadiumEnvironment.tsx`, `StadiumStructure.tsx`, `StadiumCrowdDecor.tsx` e testes existentes.

**Interfaces:** preservar `createPitchSurfaceMaterial`, material de blades e identidade estável da IBL; assets externos exigem origem/licença/hash e compressão verificável.

- [ ] RED para lifecycle/contratos realmente alterados: mudar gol/replay não recaptura ambiente, trocar clima sim; material descartado não mata mapa retido.
- [ ] Refinar paleta PBR, variação de grama, desgaste/umidade, contato da bola, exposição e iluminação por hora; substituir volumes genéricos do estádio com módulos/atlas instanciáveis.
- [ ] Torcida com cor/profundidade/reação por setores; bandeiras e clima limitados por orçamento e importância visual.
- [x] Validar gramado e iluminação já implementados. Passaram os testes de pista, clima e material, a compilação gráfica e o [contrato de assets do Quality gates](https://github.com/davizeiro12345678/jogomanager/actions/runs/45820249368). `92dc6033` reduz reinicializações de mapas e `02667b4` distingue luz refletida por neve e grama molhada.
- [ ] Comparação de TV e close em dia/noite/chuva em cada preset; manter desenhos de linhas, bola e contraste. Aceite dentro dos tetos da spec, sem elevar orçamento para encobrir regressão.

### Task 8: cinema e governador com continuidade

**Files:** `src/components/game/cinematic/`, `src/game/cinematic-camera-transition.ts`, `quality-governor.ts`, `runtime-scene-budget.ts` e testes respectivos.

**Interfaces:** reaproveitar captura estática/cache já existentes; orçamento efetivo é observável; `QualityGovernor.sample(dt)` conserva histerese e campanhas trocam identidade com preset/DPR.

- [ ] RED: flutuação em torno do orçamento não alterna detalhe a cada frame; reabrir cutscene/context recovery não cresce retenção; skip/falha de voz não bloqueia diálogo.
- [ ] Enquadramento/lentes/luz motivada por set, continuidade entre planos e personagem; lote estático deve incluir descendentes assíncronos sem rebuild em cada fala.
- [ ] Ajustar prioridade do governador: trabalho fora de foco/torcida/grama antes do atleta hero; resolução e postFX por pressão sustentada, recuperação lenta.
- [ ] GREEN: testes de direção/câmera/runtime/budget/governor/loading + browser de abertura/reabertura e troca de preset.
- [ ] A/B independente de cutscenes: preset alta mantém média ≥60 FPS, 1% low ≥50 FPS, p95 ≤20 ms e p99 ≤33,3 ms; 30 FPS e p95 ≤33,3 ms somente quando preset solicitado/efetivo é cinema. Não usar alvo cinema para aprovar partida ou cutscene alta.

### Task 9: física de contato avançada versionada

**Files:** `src/game/match-physics-extras.ts`, `sim-ball-duels.ts`, `sim.ts`, `rapier-ball-authority.ts`, contratos de setup/snapshot/checkpoint/ticket e testes de revisão.

**Interfaces propostas:** `sweptBallPlayerContact` atual permanece para revisões anteriores; projetar helper de entrada temporal com movimento relativo e altura. Revisão nova só após inventário de consumidores e decisão explícita de migração; não mudar default de salas nesta tarefa.

- [ ] RED: dois defensores em ordem de elenco invertida, bola atravessando um corpo entre ticks, contato inicial sobreposto, vertical fora do alcance, adversário expulso, poste e reposição legítima.
- [ ] Resolver primeiro tempo de entrada, depois desempate estável e resposta limitada por massa/velocidade/restituição; preservar RNG e hashes das revisões legadas.
- [x] Validar limites da colisão varrida opt-in da revisão 2, com rejeição de entradas não finitas, altura fora do alcance e contato real antes do rebote. `7ccbd8ad` passou nos testes de contato e no estresse de 200 partidas da revisão 2.
- [ ] Conectar revisão por todas as fronteiras antes de opt-in; um único integrador de bola, reinícios/replays distinguem descontinuidade legítima de teleporte.
- [ ] GREEN: focused physics/authority/checkpoint, 100 cenários de contato, ≥1.000 recuperações e ≥1.000 seeds pareadas na revisão candidata; replays de revisões antigas idênticos.
- [ ] Medir custo CPU/tick, gols/softlocks/contato impossível e vídeo; promover somente com paridade da mesma revisão entre autoridade e apresentação.

### Task 10: IA coletiva e percepção coerente

**Files:** `src/game/sim-ball-duels.ts`, `pressure-support.test.ts`, `ai-ball-interception.ts`, `tactical-ai-v2.ts`, `sim-team-ai.ts` e futuros módulos puros por responsabilidade.

**Interfaces:** manter helpers v2 atuais; correção estreita de expulso só na revisão v2; evolução grande define revisão nova e persiste seu ID em todas as fronteiras.

- [x] RED imediato: usar `MatchSim.sendOff()` e uma disputa legal próxima ao corner; atleta expulso estacionado fora de campo não fornece bônus de pressão v2; apoio ativo ainda funciona e v1 mantém comportamento/draw order.
- [x] Implementar exclusão versionada e GREEN do teste focado + tática/física/replay relacionados. 40 testes em cinco arquivos; IA coletiva futura ainda pendente.
- [x] Validar a previsão de interceptação existente com fadiga, giro e entradas não finitas. A revisão `7ccbd8ad` preserva as trajetórias da função para os cenários testados e reduz o custo de validação.
- [ ] Para revisão futura, RED de ETA com aceleração/fadiga/bola alta, ocupação de setor, cobertura de segunda linha, apoio de terceiro homem e reação sem ler futuro.
- [ ] Implementar percepção em janelas/grade reutilizada e coordenação treinador→setor→atleta com ações limitadas e explicáveis. Sem rede/RNG extra por tick.
- [ ] GREEN e A/B ≥1.000 seeds pareadas home/away: xG, progressão, perdas, compactação, impedimentos, custo p95/tick e hashes. Não usar vitória isolada como prova de IA melhor.

### Task 11: stack e carregamento da aplicação

**Files:** `package.json`, lockfile, `src/lib/game-stylesheet.ts`, startup/lazy loaders, TanStack route loaders/query boundaries e scripts de bundle existentes, apenas quando diagnóstico justificar.

**Interfaces:** manter SSR/cliente com nomes CSS idênticos, catálogo fora do startup, invalidation/query keys por identidade e nenhum vazamento de resposta privada em cache público.

- [x] Auditar as dependências do candidato `7ccbd8ad`. `npm audit --omit=dev` reportou zero avisos. O NPMScan consultou 931 entradas por vulnerabilidade e aprofundou 100 pacotes. `92dc6033` removeu a dependência órfã `r3f-perf` e reconciliou os dois lockfiles.
- [ ] Reproduzir waterfall/long task ou duplicação em build atual; escrever regressão no consumidor antes de alterar fronteira ou dependência.
- [ ] Reusar bundling/lazy/cache/decode existentes; atualizar dependência somente por motivo documentado, com auditoria e migração isoladas.
- [ ] GREEN: lint zero warnings, types, full tests, build e comparação de bundles no mesmo runner. Startup por rota cresce no máximo 2.048 bytes gzip/Brotli; agregado 400.000 bytes por representação e limites absolutos continuam.
- [x] Executar o gate Lighthouse móvel das cinco rotas e três amostras por rota. Os 15 registros de `679fbb5f` e o novo gate de `7ccbd8ad` passaram com os limites originais.
- [ ] Comparar navegação e cache frio/quente no ambiente publicado e repetir o gate no SHA final.
- [x] Preservar leitura v2/v3, formato gravado e valores quantizados. Os testes cobrem independência das posições, regravação com JSON legado e os quadros sem pose visual. A representação com buffer compartilhado passou na compatibilidade e reprovou na mediana. A implementação voltou aos arrays independentes por quadro.

### Task 12: integração, revisão independente e entrega verificável

**Files:** plano/ledger de integração e expansão, relatório desta campanha, workflows existentes e descrição da PR #132.

**Interfaces:** ledger distingue implementação/teste/visual físico/produção; SHA final é o do merge normal com alterações concorrentes, não o SHA local anterior.

- [ ] Commitar arquivos próprios explicitamente; atualizar remota e incorporar concorrência com merge normal, sem rebase de commits publicados nem sobrescrever trabalho de outro executor.
- [ ] Rodar `npm run lint`, `npm exec -- tsc --noEmit --pretty false`, `npm test`, `npm run test:performance-gates`, build, bundles, stress, SQL, WASM, graphics e Lighthouse nos ambientes adequados.
- [ ] Reviewer independente verifica diff desta continuação e interfaces compartilhadas; corrigir Critical/Important com regressão real e suíte verde.
- [ ] Esperar workflows do SHA final concluírem; canceled/skipped/ausente não aprova. Evidência de GPU/SEO remoto ausente continua pendente no relatório.
- [ ] Manter draft até completar gates; release exige decisão do proprietário e validação de SHA/readiness/SEO após publicação. Nenhum segredo no código, log ou relatório.

## Registro de execução

Ver `verification/pr132-upgrade-20261112/progress.md`. A execução inicial trata Tasks 2–3, a correção de textura delimitada de Task 7 e a correção delimitada de Task 10; o restante do salto visual permanece um programa de implementação com gates, sem alegação de entrega total.


## Expansion 25/11/2026 — arquitetura, engine e gráficos (PENDENTE)

### Task 13 — Arquitetura da engine determinística
- [ ] Mapear autoridade server/Worker/browser, contratos de estado, ownership, fixed-step, relógio, RNG e versões de regras.
- [ ] Separar domínio de simulação, apresentação, transporte, persistência e efeitos cosméticos sem alterar resultados canônicos.
- [ ] Auditar replay/checkpoint/restore, snapshots, serialização, rollback, worker lifecycle e paridade Node/browser/WASM.
- [ ] Criar matriz de seeds, fixtures e checkpoints; manter os 21 checkpoints existentes e os stress suites como invariantes.
- [ ] Benchmark ABBA por tick, setup, replay, GC/alocações e p50/p95/p99; CodSpeed deve bloquear regressão material.
- [ ] Proibir Math.random, Date.now e estado global no caminho determinístico; exceções devem ficar fora do core e documentadas.
- [ ] Não mudar ordem de RNG, autoridade, contratos de save/replay ou regras reservadas sem revisão e paridade.

### Task 14 — Evolução massiva da stack gráfica
- [ ] Inventariar Three.js/R3F, WebGL2, WebGPU opcional, shaders, render targets, pós-processamento, KTX2, atlas, LOD e streaming.
- [ ] Definir capability tiers com fallback WebGL2 e perfil software; WebGPU nunca será requisito obrigatório sem matriz de compatibilidade.
- [ ] Melhorar materiais PBR, iluminação, sombras, gramado, estádio, torcida, animação, câmera e transições sem alterar a simulação.
- [ ] Medir draw calls, triângulos, textura/VRAM quando disponível, uploads, shader compile, frame time e memory churn por perfil.
- [x] Versionar e conferir limites de cena por qualidade, resolução dinâmica com histerese e fallback WebGL2. O [inventário móvel de `7ccbd8ad`](https://github.com/davizeiro12345678/jogomanager/actions/runs/45820249314) passou. Os limites de FPS físico seguem na Task 16.
- [ ] Validar recursos, 404, KTX2, licenças, fallback e recuperação de contexto.
- [ ] Comparar visualmente com capturas reais pareadas e benchmarks ABBA; não usar SwiftShader como prova de FPS.

### Task 15 — Chrome e matriz de navegadores
- [x] Rodar Chrome no VPS com o preview local de `7ccbd8ad`. Foram 72 caminhos em dois viewports, 144 respostas HTTP 200, 28 capturas e 17/19 fluxos aprovados. As duas falhas foram o formulário de login do preview sem configuração pública do Supabase.
- [x] Exercitar o Match 3D no VPS nos dois viewports. O relógio foi de minuto 0 a 1 após retomar, a velocidade e a câmera mudaram, os lances abriram, a pausa se manteve após fechar opções e o retorno à seleção funcionou.
- [ ] Executar smoke WebGL2/WebGPU compute e registrar renderer real; SwiftShader é software CPU.
- [ ] Testar partida 3D: câmera, controles, placar, menus, pausa/retomada, chat e estabilidade, sem enviar mensagens nem acionar itens reservados.
- [ ] Repetir em Chromium/Firefox/WebKit CI quando disponível; separar evidência headless/software de hardware real.

### Task 16 — Certificação física
- [ ] Executar protocolo em dois aparelhos autorizados da geração-alvo, com 3 sessões de 10 minutos por dispositivo.
- [ ] Registrar SoC/GPU/RAM, browser, 60 Hz, temperatura, energia, qualidade efetiva, FPS médio/p95/p99 e stalls.
- [ ] Manter gate de FPS e thermal stability bloqueado até evidência física reproduzível.

### Task 17 — Detecção de malware e ELF
- [ ] Benchmark controlado EICAR/fixtures benignas, compactadas, scripts, PE e ELF malformados entre ClamAV, URLhaus, Maldet, Wazuh/Elastic e Tracee.
- [ ] Medir detecção, falso positivo, latência, CPU/RAM, atualização de assinaturas e cobertura por formato.
- [ ] Melhorar identificação ELF por cabeçalho/endianness/class/machine/sections com validação estrutural e testes negativos; nunca executar amostras.

### Task 18 — Modelo local e triagem assistida
- [ ] Comparar Qwen e alternativas por benchmark de classificação, explicabilidade, latência, RAM/VRAM e taxa de falsos positivos.
- [ ] Manter modo observação e revisão humana; modelo não pode autorizar bloqueio/quarentena automaticamente sem política explícita.
