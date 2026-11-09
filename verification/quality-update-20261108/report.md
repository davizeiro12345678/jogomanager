# Atualização de qualidade: implementação e evidências de 8 de novembro de 2026

**A implementação está no [draft PR #128](https://github.com/davizeiro12345678/jogomanager/pull/128), com resultados medidos e limitações ainda abertas.** Os oito workflows da fonte `0a6a04e581571a367cc1c742ead21f984abbbc1b` passaram, incluindo os 12 jobs de Quality gates: **2.203 testes em 371 arquivos**, stress de 200 sementes com replays independentes, replay canônico Supabase, bundles e Lighthouse. A suíte geral executou o merge virtual `ea58b87` da fonte 0a6a04e sobre a base c20036f. O gate específico do construtor comparou diretamente os dois commits e aprovou a mediana de CPU de 0,201074 para 0,1993345 ms, variação de −0,865104%. O PR permanece em draft, sem merge nem publicação.

Na comparação física em alta, a média passou de **77,120 para 82,263 FPS (+6,669%)**, o p95 de 16,9 para 15,5 ms e o 1% low de 11,453 para 14,494 FPS (+26,551%). O pico bruto de 226 draw calls ficou dentro do teto de 260. **O maior stall piorou de 600,9 para 800,8 ms (+33,267%) e o heap final aumentou 3,684%.** A média solicitada de 60 FPS foi alcançada nessa execução. A meta estendida de 1% low ≥50 FPS e a campanha de três repetições em cada uma das duas GPUs continuam pendentes. Os resultados intermediários de 85,463 e 81,743 FPS foram preservados com suas respectivas versões de fonte.

O **CodSpeed remoto, em CPU Simulation, classificou seis casos como melhores, dois como regressões e oito como inalterados**. O agregado exibido de +32,18% não representa o ganho de cada caso, tempo decorrido real ou FPS. O serviço informou regressão de 9,09% em eficiência para snapshotMatch e de 5,05% para newMatchSim. A meta de +89% em todos os benchmarks **não foi cumprida**. Os três protocolos locais permanecem separados: no controle de tempo decorrido com afinidade, apenas dois dos 16 casos ultrapassaram +89%, ambos Rust/WASM na comparação de fonte e artefato descrita adiante.

O relatório registra os artefatos disponíveis em `verification/quality-update-20261108`, incluindo medições concluídas após o checkpoint original de `progress.md`. Os horários dos JSON usam UTC; a sessão de trabalho corresponde a 8 de novembro em São Paulo. Os campos explicitamente marcados como pendentes não são resultados nem autorizações de publicação.

Após a aprovação da fonte 0a6a04e, a inspeção mobile encontrou um rótulo quebrado na navegação de criação. A correção de quatro linhas de CSS passou no build, em oito testes existentes de layout/acessibilidade e na nova captura de interface. O harness agora verifica texto em uma linha e alvos de toque de pelo menos 44 px nas larguras de 390 e 320 px. Essa correção e dois ajustes de captura serão identificados no próximo commit, que terá CI própria: **a aprovação de 0a6a04e não é transferida implicitamente ao novo head**. Os 23 arquivos medidos do renderizador mantêm seus hashes, preservando o escopo da comparação física.

**Convenção de fases:** base → intermediário 1 (85,463 FPS) → etapa IBL/intermediário 2 (81,743 FPS) → ownership de geometria no commit 0a6a04e (82,263 FPS). A palavra `final` nos nomes `final-nvidia-broadcast-1.json`, `comparison-final.json` e no primeiro `cinematic/final.json` é histórica da etapa IBL. O resultado atual usa `final-ownership` no nome. As fases anteriores foram preservadas em `figures/intermediate/` e `figures/ibl-stage/`; a atual está em `figures/ownership-stage/`. Nenhum par isolado conclui a campanha de três repetições em duas GPUs.

## Proveniência, escopo e reprodução

| Item | Identificação |
| --- | --- |
| Checkout candidato | `C:/Users/User/Documents/ChatGPT/DAVI ANDRIAN THOMAZINI/quality-update-20261108` |
| Branch | `codex/massive-quality-20261108` |
| Base congelada | `c20036f33a8f7d8eff15012d276606a3964e4a54`, merge do PR #125 |
| Fonte enviada para revisão | `0a6a04e581571a367cc1c742ead21f984abbbc1b`, [draft PR #128](https://github.com/davizeiro12345678/jogomanager/pull/128) |
| Checkout base | Irmão `quality-baseline-20261108`, detached na mesma revisão |
| Runtime CPU | Node `v24.22.0`, V8 `13.6.233.17-node.57`, Windows x64 `10.0.26300` |
| CPU | Intel Core i5-12500H, 16 processadores lógicos |
| Evidência GPU comparável | Edge headed, WebGL 2, ANGLE NVIDIA GeForce RTX 4060 Laptop GPU / D3D11 |
| Configuração gráfica | Alta, 1280×720, DPR 1, broadcast, dia/seco, seed `graphics-broadcast-v1`, Flamengo × Palmeiras |
| Protocolo nativo | 60 s de aquecimento + 300 s de medição; adaptação desativada, zero interrupções e cobertura de 300.000 ms nos dois arquivos |
| Autorização de entrega | Commit/PR revisável; nenhum merge ou deploy de produção como consequência desta validação |

As autoridades para os limites são `AGENTS.md`, `docs/critical-performance.md`, `src/game/contracts/graphics-profile.ts` e o contrato incorporado ao instrumento gráfico. Os cenários, seeds, resolução, DPR, perfis, limiares, número exigido de repetições e severidades continuam preservados. As comparações CPU arquivam ambiente, hashes de fixture/lockfile e checkpoints determinísticos; algumas medições ocorreram antes do commit, com source-diff identificado nos JSON. O manifesto distingue as fases de fonte e não atribui os renders antigos ao commit ownership apenas porque os arquivos têm rótulo histórico “final”.

O diagnóstico frio/headless Intel de 12,33 FPS usa outra GPU e outro protocolo. Ele fica fora da comparação de ganhos. O smoke funcional candidato, executado frio e com atividade CPU concorrente, também fica fora da comparação de FPS. As capturas e os vídeos têm escopo visual próprio, pois a gravação pode alterar o custo de renderização.

## Implementação e revisão

| Área | Mudança implementada | Evidência e limite |
| --- | --- | --- |
| Carreira e finanças | Normalização e limites de entradas; formações, táticas e banco seguros; proteção de salário de empréstimos e de prêmios/idempotência; recuperação offline e prioridade de outbox | Testes de domínio e suíte geral; resultados do jogo continuam sujeitos à autoridade existente |
| Durabilidade da carreira | Barreira compartilhada de escrita por proprietário/epoch, revisão observável, `useSyncExternalStore` e bloqueio de callbacks antigos | Reprodução em ReactDOM/QueryClient/IndexedDB real em `career-remount-browser.json`; dois P1 originais reavaliados e fechados |
| Caminhos frios da carreira | Recovery carrega somente quando há `pending_save`; reset somente na ação explícita; migração somente quando há snapshot/outbox bruto; lifecycle síncrono/barreira permanecem eager; identidade/epoch/revisão são rechecados após awaits e o gate é liberado em `finally` | Primeiro split com 106 testes; extensão de migração com 116 testes em sete arquivos, dez regressões de atraso/fences; remount real novamente aprovado; terceiro bundle passou |
| Autenticação | Alternativa explícita de OAuth direto para provedores habilitados e allowlisted, no mesmo Supabase | Fonte e renderização revisadas; consentimento/callback externo real ainda não validado; recuperação automática de crédito após redirect do broker não é garantida |
| Cache | Timeout público de 15 s, concorrência física de upstream limitada a 16 por namespace, tratamento de conclusão tardia e respostas privadas com `no-store` nas três políticas de cache | Testes de timeout/capacidade e revisão de fontes; regras remotas do CDN não foram alteradas nem certificadas |
| Leituras públicas | Paralelização de alias/clube sem ampliar a projeção | Preserva separação de informações públicas e privadas; ganho de latência de produção não foi medido |
| Suporte | Interface lazy; validação canônica e ciclo seguro de conta/retry; fila durável, idempotência, leases com fencing e entrega autenticada por HMAC | Contratos locais e revisão servidor/SQL; URL/configuração de webhook ainda pendente; nenhum ticket externo entregue como teste |
| Suporte na troca de conta | Barreira de renderização por `formOwner` impede mostrar campos/ticket da conta anterior durante o reset no efeito; categoria também é limpa | Correção adicional de fonte; vinculá-la à validação final de interface/build, sem atribuir sua cobertura automaticamente a testes anteriores |
| Multiplayer | RPC SQL atômica service-only para criação e seed privada; quotas de 3 salas ativas e 20/h; limpeza limitada dos próprios lobbies vazios; lookup de clubes seguro contra propriedades herdadas | Fixtures/revisão e replay canônico Supabase/contratos passaram na CI; contenção multiconexão não é inferida do status desse job |
| Rota multiplayer | Corpo de `LiveRoom` extraído sem alteração de lógica para feature lazy; cinco imports pesados saem do carregamento da rota | `multiplayer-code-split-parity.json`: SHA-256 do corpo antes/depois idêntico; não é prova de ganho de runtime ou de menor download até o bundle final |
| Chat e armazenamento | Normalização de evasões Unicode; validação de envelope/mirror IndexedDB; limites de sessão/hash/finalização | Testes locais e harness sintético; não é certificação da produção nem implantação de um novo transporte online |
| Migrações | Reparo do journal 0061 e forward 0063/0064/0065; índices para quotas/expiração e contratos adicionais de replay | Execução local PGlite aprovada; nenhuma migration aplicada remotamente |
| Renderizador | Trigonometria radial deduplicada em TS/Rust; transforms de juntas instanciadas e batching de caminhos ancestrais; scratch de normais de cloth; pool exclusivo de rigs dormentes com materiais/atlas retidos | Revisão independente de fonte sem achado acionável; testes focados e WASM recompilado; resultados físicos têm o escopo do único par medido |
| Ciclo de vida 3D | Acquire na fase de commit e guardas StrictMode; pool limitado a 6 rigs dormentes, 16 MiB e 2 ciclos | Instrumentação funcional e da execução longa; retenção de memória é um custo observado, a ser otimizado e reavaliado |
| Ownership de geometria | Fontes corporais privadas e de dono único em `buildRigSkin` são consumidas/transferidas sem clone redundante; aliases conservam clone; cleanup não descarta a geometria transferida; merge genérico preservado | 5/5 hashes de geometria+morph idênticos; 38 testes focados; tráfego de cópia por construção menor, **sem atribuir ao tráfego de cópia um ganho garantido de FPS** |
| Informações públicas | Dados do responsável fornecidos no pedido incluídos nas páginas apropriadas | Não são repetidos neste pacote técnico; não foi inferida certificação ou titularidade |

`review-career-auth-cache.md` preserva os dois achados P1 originais e a explicação de sua resolução. A reprodução real de remount confirmou cache fresco sem `queryFn`, duas falhas controladas de nuvem, duas escritas locais aceitas, rejeição da mutação antiga antes da durabilidade e do callback antigo após ela, resultado retido na rodada 2 e preço final de ingresso 77. `review-online-support.md` não estabeleceu P0/P1/P2 acionável no escopo atribuído. A revisão de fonte é complementar aos gates, sem conceder aprovação de release. O bloqueio de retry por whitespace na interface de suporte foi corrigido no trabalho principal.

## Match 3D físico: quatro snapshots preservados

A medição atual corresponde ao commit **0a6a04e**, com fonte/fixture/lockfile/assets registrados em `graphics/final-ownership-source.json`. O par comparável usa Edge headed, WebGL2/ANGLE NVIDIA RTX 4060 Laptop/D3D11, alta, canvas 1280×720/DPR 1, broadcast, seed fixa, 60 s de aquecimento e 300 s de medição. Os quatro arquivos têm cobertura integral e zero interrupções, sem adaptação nem gravação. Não houve redução de qualidade, LOD, viewport ou teto para obter os resultados.

| Fase | JSON bruto | Comparador | Apresentação |
| --- | --- | --- | --- |
| Base c20036f | `graphics/baseline-nvidia-broadcast-1.json` | Usada como base nos três pares | Captura PNG homônima |
| Intermediário1: transforms/pool | `graphics/candidate-nvidia-broadcast-1.json` | `graphics/comparison.json` | `figures/intermediate/` |
| Intermediário2: IBL estável | `graphics/final-nvidia-broadcast-1.json` | `graphics/comparison-final.json` | `figures/ibl-stage/` |
| Fonte enviada: ownership | `graphics/final-ownership-nvidia-broadcast-1.json` | `graphics/comparison-final-ownership.json` | `figures/ownership-stage/` |

O comparador atual registra `comparable: true`, zero divergências, cobertura de 300.000 ms, `peakDrawBudget.passes: true` e `acceptedExtendedCampaign: false`. A base foi reutilizada para os três comparadores. As candidatas são diferentes versões de fonte, não três repetições independentes da mesma candidata. Ordem/cache de navegador/driver/estado térmico não foram isolados por uma campanha ABBA de GPU.

Na coluna Δ, o sinal representa `(ownership / base − 1) × 100`. FPS/1% low maiores são desejáveis; durações e stalls menores são desejáveis. O heap é a observação final e triângulos são média, não máximos garantidos.

| Métrica | Base | Intermediário1 | Etapa IBL | Ownership 0a6a04e | Δ ownership/base |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frames nos 300 s | 23.136 | 25.639 | 24.523 | 24.679 | — |
| FPS médio | 77,120 | 85,463 | 81,743 | **82,263** | **+6,669%** |
| 1% low global (FPS) | 11,453 | 16,085 | 14,904 | **14,494** | +26,551% |
| Tempo de frame p50 (ms) | 11,300 | 10,800 | 11,200 | 11,100 | −1,770% |
| Tempo de frame p95 (ms) | 16,900 | 14,800 | 15,800 | **15,500** | −8,284% |
| Tempo de frame p99 (ms) | 70,000 | 23,000 | 25,400 | 26,300 | −62,429% |
| Maior frame/stall,ms | 600,900 | 640,000 | 511,300 | **800,800** | **+33,267%** |
| Frames>50 ms | 412 | 176 | 187 | 190 | −53,883% |
| Draw calls médias | 182,738 | 182,662 | 182,771 | 182,833 | +0,052% |
| Pico bruto de draw calls | 272 | 293 | 228 | **226** | −16,912% |
| Triângulos médios | 249.533,384 | 241.443,407 | 244.188,965 | 246.078,955 | −1,384% |
| Heap JS final,MB decimais | 150,808 | 179,418 | 142,680 | **156,365** | **+3,684%** |
| Geometrias no fim | 306 | 388 | 390 | 388 | +26,797% |
| Texturas no fim | 167 | 192 | 191 | 192 | +14,970% |
| Programas no fim | 125 | 124 | 125 | 124 | −0,800% |
| Primeiro frame,ms | 5.056,700 | 4.752,500 | 5.048,600 | 4.413,900 | −12,712% |
| Long tasks,execução inteira | 461 | 179 | 186 | 171 | −62,907% |
| Duração de long tasks,ms | 45.681 | 25.544 | 26.552 | 25.469 | −44,246% |
| Erros JavaScript | 0 | 0 | 0 | 0 | — |

A fonte enviada cumpriu a média solicitada de 60 FPS nessa execução e melhorou a média, os percentis p95/p99 e a contagem de stalls frente à base. **O maior stall piorou para 800,8 ms e o heap final ficou 3,684% maior.** O 1% low de 14,494 FPS continua distante da meta estendida de 50 FPS. Frente à etapa IBL, a média após ownership é cerca de 0,636% maior, mas o 1% low é 2,756% menor, o p99 é 3,543% maior, o máximo é 56,62% maior e os stalls passam de 187 para 190. O benefício determinístico comprovado de ownership é o menor tráfego de cópia por construção, mostrado abaixo; os dados não demonstram melhora da pior cauda. Uma comparação por versão não estabelece significância ou causalidade isolada.

O pico bruto do renderizador e o census têm escopos distintos. A base, com 272 draw calls, e o primeiro intermediário, com 293, excederam o teto de 260 do perfil alta, mesmo quando o inventário de cena cabia. A composição de iluminação por ambiente (IBL) foi estabilizada para evitar recapturas PMREM e passagens extras ligadas a atualizações de gol/replay. A etapa IBL mediu pico de 228 draw calls; a etapa ownership mediu 226. O census final desta última contém 168 draw calls e 215.152 triângulos, com `fitsBudget: true`. O teto não foi elevado. A média de 246.079 triângulos e o inventário abaixo de 850.000 não certificam, sozinhos, todos os picos e cenários.

O primeiro frame é uma observação de inicialização, sem isolamento causal do carregamento. As long tasks incluem o aquecimento e cobrem 360 s; os percentis e stalls principais cobrem 300 s. A execução atual registrou zero erros e zero requisições falhadas. O diagnóstico Intel frio/headless de 12,33 FPS e o smoke funcional sob carga concorrente de CPU ficam fora desses percentuais.

### Memória e reutilização do rig

| Execução | Ativos/dormentes finais | Bytes dormentes | Ciclo | Criados/reutilizados/descartados |
| --- | ---: | ---: | ---: | ---: |
| Intermediário1 | 2/6 | 15.629.100 | 78 | 196/289/188 |
| Etapa IBL | 2/6 | 15.561.504 | 77 | 206/280/198 |
| Ownership 0a6a04e | 2/6 | 15.629.100 | 75 | 207/265/199 |

O pool final retém aproximadamente 14,905 MiB, dentro do limite de 16 MiB e seis entradas dormentes. Ele mantém materiais, atlas e geometrias para reutilização, com leases exclusivos e expiração por ciclo. Os contadores mostram reutilização e descarte, sem demonstrar eliminação de reconstruções ou ausência de vazamento. A base não expõe a mesma métrica de pool, portanto não há comparação direta dessa memória retida.

O smoke funcional anterior usou outro protocolo e terminou com dois rigs ativos, cinco dormentes, cerca de 11,44 MiB, nove criados, 12 reutilizados, dois descartados e zero erros. Sua evidência é de ciclo de vida. Na execução ownership, o heap final de 156,365 MB, as 388 geometrias e as 192 texturas têm escopos distintos dos 14,905 MiB estimados pelo pool; não medem VRAM física nem pico de memória. O próximo estudo deve acompanhar o platô e a desmontagem em ciclos longos, preservando perfil e LOD, antes de afirmar redução garantida de memória residente.
### Refinamento posterior: tráfego de cópia por construção do rig

Fontes: `graphics/rig-ownership-before.json`, `graphics/rig-ownership-after.json`, `graphics/rig-ownership-comparison.json` e `rig-ownership-tests.json`. Após a etapa IBL, a inspeção de fonte identificou geometria privada criada e consumida por `buildRigSkin`, antes clonada e descartada logo em seguida. O refinamento transfere essas geometrias quando possuem referência única, mantém fallback com clone para aliases e preserva o caminho de merge genérico. A evidência abaixo mede **uma construção/cache miss por caso, incluindo as fontes corporais**, sem cronometrar FPS ou inferir redução de heap residente.

| Caso de construção | Clones antes → depois | Bytes copiados antes → depois | Redução do tráfego | Bytes de saída, idênticos |
| --- | ---: | ---: | ---: | ---: |
| athlete, radial 16 | 160 → 112 | 4.274.160 → 2.166.336 | 49,316% | 3.409.380 |
| keeper, radial 16 | 161 → 108 | 4.455.632 → 2.253.712 | 49,419% | 3.647.812 |
| cinematic, radial 16 / merge LOD | 183 → 132 | 4.414.752 → 2.236.632 | 49,337% | 3.513.660 |
| staff jacket, radial 12 / merge LOD | 160 → 112 | 4.064.796 → 2.059.818 | 49,325% | 3.472.122 |
| medium, radial 8 | 144 → 95 | 1.136.152 → 581.216 | 48,843% | 976.944 |

Os cinco pares mantêm os mesmos `geometryAndMorphSha256`, `outputBytes` e `groupCount`; os hashes completos estão nos JSON brutos. Os 38 testes focados e a nova execução de 20 testes com fonte identificada por SHA passaram. Depois, a suíte congelada passou na CI com 2.203 testes. A tentativa mista de duas falhas permanece preservada. O contador de bytes copiados mede tráfego de construção e não estabelece redução equivalente de heap final, VRAM, carregamento ou FPS. A execução atual mediu 82,263 FPS, mas também o pior stall de 800,8 ms; o benefício causal não deve ser ampliado para toda a cauda de latência.

### Estado das metas gráficas

| Requisito | Resultado observado | Estado |
| --- | --- | --- |
| Alta: média ≥45 FPS e p95 ≤28 ms | Ownership: 82,263 FPS / 15,5 ms | Cumprido nesse par temporal |
| Pedido: média ≥60 FPS | Ownership: 82,263 FPS | Cumprido nessa execução |
| Stretch: média ≥69 FPS e p95 ≤20 ms | Ownership: 82,263 /15,5 | Componentes cumpridos nessa execução |
| Stretch: 1% low ≥50 FPS | Ownership: 14,494 FPS | **Não cumprido** |
| Alta: máximo 260 draws | Ownership pico bruto 226; census final 168 | **Cumprido nessa execução**; intermediário 293 preservado |
| Alta: máximo 850.000 triângulos | Ownership média de 246.079; census final 215.152 | Média/inventário abaixo; pico/campanha ainda não certificados |
| Campanha: 3 repetições equivalentes em cada GPU | 1 base +três candidatas diferentes na RTX 4060 | **Pendente**; versões diferentes não são repetições da fonte atual |
| Comparação em GPU Intel | Apenas diagnóstico de outro protocolo | **Pendente no protocolo completo** |

## CodSpeed remoto: resultado instrumentado dos 16 casos

Esta é a comparação remota efetiva da fonte 0a6a04e com a base c20036f, em **CPU Simulation**, separada do Tinybench local e de FPS físico. Fontes primárias: [comentário do bot no PR #128](https://github.com/davizeiro12345678/jogomanager/pull/128#issuecomment-6729775980) e [página pública dos 16 benchmarks](https://app.codspeed.io/davizeiro12345678/jogomanager/branches/codex%2Fmassive-quality-20261108). Cópias: `ci-source-0a6-codspeed-comparison.json`/`.md`, `ci-source-0a6-codspeed-public-table.json` e `ci-source-0a6-codspeed-warnings.json`.

O serviço informa **6 melhorados, 2 regredidos e 8 inalterados**, com agregado exibido **+32,18%**. A regra de agregação não foi reconstruída; esse rótulo não é ganho de cada benchmark, custo total real do jogo ou FPS. “Inalterado” é a classificação do serviço e pode coexistir com pequenos deltas exibidos. Os tempos abaixo são os valores arredondados da interface; os oito percentuais mais precisos vêm do bot quando disponíveis. **Nenhum percentual exato foi recalculado a partir dos tempos arredondados.**

| Caso | BASE exibida | HEAD exibida | Eficiência informada | Classificação |
| --- | ---: | ---: | ---: | --- |
| live match: snapshotMatch ‡ | 968,9 µs | 1.065,8 µs | −9,09% (bot) | Regressão |
| match setup: new MatchSim ‡ | 4,9 ms | 5,1 ms | −5,05% (bot) | Regressão |
| season: generateFixtures | 665,6 µs | 319,7 µs | ×2,1 | Melhora |
| rig geometry: Rust/WASM 64 radial † | 1.378,9 µs | 757,9 µs | +81,95% (bot) | Melhora |
| rig geometry: Rust/WASM 16 radial † | 403 µs | 255,8 µs | +57,56% (bot) | Melhora |
| rig geometry: fallback 64 radial | 1,9 ms | 1,4 ms | +37,91% (bot) | Melhora |
| rig geometry: fallback 16 radial | 608,4 µs | 475,3 µs | +28,02% (bot) | Melhora |
| season: tableFromFixtures | 2,4 ms | 2,4 ms | +2,41% (bot) | Melhora |
| match setup: buildTeamSetup ‡ | 4,6 ms | 4,5 ms | +2% (UI arredondada) | Inalterado |
| season: simulateDivisionTable | 62,9 ms | 62,1 ms | +1% (UI arredondada) | Inalterado |
| replay codec: decodeReplay | 389,7 ms | 392,8 ms | −1% (UI arredondada) | Inalterado |
| live match: WorkerMatchView.apply | 357,5 µs | 359,7 µs | −1% (UI arredondada) | Inalterado |
| match simulation: 300 live ticks | 134,1 ms | 133,3 ms | +1% (UI arredondada) | Inalterado |
| match simulation: 120 coarse steps | 80,9 ms | 80,5 ms | +1% (UI arredondada) | Inalterado |
| replay codec: encodeReplay ‡ | 574,3 ms | 574,1 ms | 0% (UI arredondada) | Inalterado |
| rng: makeRng 10k draws | 1,4 ms | 1,4 ms | 0% (UI arredondada) | Inalterado |

**‡ Limitação do instrumento:** os filtros públicos identificaram snapshotMatch, newMatchSim, buildTeamSetup e encodeReplay como dominados por chamadas de sistema. CPU Simulation exclui custos dessas chamadas por não simulá-las consistentemente; os valores subestimam parte do custo real. SnapshotMatch também não tem flamegraph disponível. Isso não elimina suas duas regressões nem autoriza declarar o custo real menor. Os protocolos de wall time e o gate de CPU do construtor abaixo medem outras grandezas e continuam separados.

**† Rust/WASM:** os artefatos distribuídos são diferentes; os produtores embutidos e Cargo.lock/Toml coincidem, mas a base não foi recompilada nesta campanha. A proveniência detalhada abaixo aplica-se aos ganhos de artefatos, sem atribuição exclusivamente à alteração de fonte. GenerateFixtures aparece com×2,1 no serviço; os outros ganhos listados ficam abaixo de +89%. A meta global de +89% permanece não atingida.
## CPU: todos os 16 casos em três protocolos, sem seleção favorável

Os três conjuntos completos abaixo usam os 16 registros existentes, as mesmas fixtures e dependências e verificações de paridade. São medições locais Tinybench por relógio de parede, **não execução instrumentada CodSpeed CI**, FPS, latência de rede ou loading. O protocolo com afinidade é o principal controle local de wall time; os outros dois permanecem como observações completas. Repetições descrevem a variação observada e não demonstram significância estatística. O Node global 25 não foi utilizado como runtime desta evidência.

**† Proveniência comum a todas as linhas e conclusões Rust/WASM:** a base usa o binário commitado de 90.209 bytes; a candidata usa o binário recompilado de 90.412 bytes. `wasm-artifact-provenance.json` confirma nos dois `producers` as mesmas versões **rustc 1.99.0 (`b940084d7`, 2026-09-28), walrus 0.27.2 e wasm-bindgen 0.2.129 (`165586f85`)**, e confirma hashes iguais de `Cargo.lock` e `Cargo.toml`. A base **não foi recompilada durante esta campanha**; sua invocação/ambiente histórico de build não foi reconstruído independentemente. Portanto os ganhos Rust comparam **revisões de fonte + artefato distribuído**, com metadados de versões coincidentes, sem provar um efeito de fonte isolado por rebuild pareado. Essa ressalva aplica-se às duas linhas Rust em todas as tabelas e às legendas de gráficos, inclusive quando ultrapassam +89%. O protocolo JS mantém Node/dependências/fixtures controlados como descrito.

As fórmulas são:

- `Δ duração (%) = (tempo_candidata / tempo_base − 1) × 100`; negativo significa duração menor.
- `Δ throughput (%) = (tempo_base / tempo_candidata − 1) × 100`; positivo significa mais operações no mesmo tempo.
- +89% de throughput significa 1,89×, equivalente a redução de duração de aproximadamente 47,09%; as duas percentagens não são intercambiáveis.

### Protocolo curto: 3 execuções base + 3 candidatas, 200/50 ms

Fonte: `cpu/comparison.json`; janela por caso 200 ms e aquecimento 50 ms. Os tempos são médias em ms conforme o comparador, com casas adicionais para não arredondar operações curtas a zero.

| Caso existente | Base, ms | Candidata, ms | Δ duração | Δ throughput |
| --- | ---: | ---: | ---: | ---: |
| match setup: buildTeamSetup | 0,169127 | 0,147363 | −12,869% | +14,769% |
| match setup: new MatchSim | 0,328679 | 0,308720 | −6,072% | +6,465% |
| match simulation: 300 live ticks | 5,730666 | 6,331356 | +10,482% | −9,488% |
| match simulation: 120 coarse steps | 3,456402 | 3,775730 | +9,239% | −8,457% |
| live match: snapshotMatch | 0,002569 | 0,002460 | −4,239% | +4,426% |
| live match: WorkerMatchView.apply | 0,013626 | 0,014342 | +5,254% | −4,992% |
| replay codec: encodeReplay | 17,929044 | 17,365716 | −3,142% | +3,244% |
| replay codec: decodeReplay | 11,534450 | 8,532070 | −26,030% | +35,189% |
| season: generateFixtures | 0,024075 | 0,013315 | −44,692% | +80,806% |
| season: tableFromFixtures | 0,038773 | 0,038600 | −0,445% | +0,447% |
| season: simulateDivisionTable | 3,671517 | 3,619908 | −1,406% | +1,426% |
| rng: makeRng 10k draws | 0,083430 | 0,082299 | −1,356% | +1,375% |
| rig geometry: fallback 64 radial | 0,076620 | 0,033962 | −55,675% | +125,607% |
| rig geometry: fallback 16 radial | 0,025063 | 0,012107 | −51,692% | +107,007% |
| rig geometry: Rust/WASM 64 radial † | 0,138847 | 0,037379 | −73,079% | +271,456% |
| rig geometry: Rust/WASM 16 radial † | 0,034784 | 0,011114 | −68,048% | +212,970% |

### Protocolo estendido: ABBA, 2 execuções base + 2 candidatas, 1000/250 ms

Fonte: `cpu-extended/comparison.json`, gerado em `2026-11-09T00:02:39.211Z`. A ordem ABBA e as janelas maiores são outra observação completa; ela não deve ser misturada à série curta nem substituir seletivamente apenas as linhas favoráveis.

| Caso existente | Base, ms | Candidata, ms | Δ duração | Δ throughput |
| --- | ---: | ---: | ---: | ---: |
| match setup: buildTeamSetup | 0,150257 | 0,191683 | +27,570% | −21,612% |
| match setup: new MatchSim | 0,293446 | 0,335278 | +14,255% | −12,477% |
| match simulation: 300 live ticks | 5,445850 | 5,976342 | +9,741% | −8,877% |
| match simulation: 120 coarse steps | 3,668940 | 3,578999 | −2,451% | +2,513% |
| live match: snapshotMatch | 0,002814 | 0,002579 | −8,358% | +9,120% |
| live match: WorkerMatchView.apply | 0,015242 | 0,014260 | −6,442% | +6,885% |
| replay codec: encodeReplay | 18,075455 | 18,426838 | +1,944% | −1,907% |
| replay codec: decodeReplay | 11,945045 | 10,509349 | −12,019% | +13,661% |
| season: generateFixtures | 0,025206 | 0,014352 | −43,061% | +75,625% |
| season: tableFromFixtures | 0,038639 | 0,035935 | −6,998% | +7,524% |
| season: simulateDivisionTable | 3,749316 | 3,545573 | −5,434% | +5,746% |
| rng: makeRng 10k draws | 0,086770 | 0,087460 | +0,795% | −0,788% |
| rig geometry: fallback 64 radial | 0,095517 | 0,042420 | −55,589% | +125,169% |
| rig geometry: fallback 16 radial | 0,023346 | 0,011257 | −51,782% | +107,392% |
| rig geometry: Rust/WASM 64 radial † | 0,148070 | 0,038316 | −74,123% | +286,446% |
| rig geometry: Rust/WASM 16 radial † | 0,035185 | 0,010376 | −70,511% | +239,111% |

Nos protocolos curto e estendido sem afinidade, **4/16 casos** atingem +89% de throughput; são os quatro de geometria. `generateFixtures` melhora +80,806% no curto e +75,625% no estendido, abaixo da meta. A regressão de live ticks aparece nesses dois conjuntos. Setup/construtor, coarse steps, apply e codec variam entre protocolos; a divergência exige investigação, sem conclusão causal a partir de uma amostra curta.

### Protocolo principal controlado: ABBA com afinidade, 2+2 execuções, 1000/250 ms

Fontes: `cpu-affinity/comparison.json` e `cpu-affinity/affinity.json`, comparação gerada em `2026-11-09T00:12:35.378Z`. O shell temporário e seus descendentes herdaram máscara `0x1`, CPU lógica 0; outras aplicações e a configuração do sistema não foram alteradas. O ambiente/hashes/checkpoints permanecem comparáveis, com zero violações. Afinidade restringe migração entre núcleos, mas esta ainda é medição de wall time em um notebook compartilhado, sem prova estatística de representatividade de outro aparelho.

| Caso existente | Base, ms | Candidata, ms | Δ duração | Δ throughput |
| --- | ---: | ---: | ---: | ---: |
| match setup: buildTeamSetup | 0,173637 | 0,205014 | +18,070% | −15,305% |
| match setup: new MatchSim | 0,307521 | 0,360813 | +17,329% | −14,770% |
| match simulation: 300 live ticks | 8,168279 | 7,431023 | −9,026% | +9,921% |
| match simulation: 120 coarse steps | 6,775377 | 5,225018 | −22,882% | +29,672% |
| live match: snapshotMatch | 0,002752 | 0,003063 | +11,323% | −10,171% |
| live match: WorkerMatchView.apply | 0,016147 | 0,018518 | +14,685% | −12,805% |
| replay codec: encodeReplay | 36,103073 | 31,441569 | −12,912% | +14,826% |
| replay codec: decodeReplay | 15,221195 | 15,211067 | −0,067% | +0,067% |
| season: generateFixtures | 0,024454 | 0,013219 | −45,943% | +84,991% |
| season: tableFromFixtures | 0,048540 | 0,036897 | −23,986% | +31,554% |
| season: simulateDivisionTable | 4,329573 | 3,814936 | −11,887% | +13,490% |
| rng: makeRng 10k draws | 0,098379 | 0,093903 | −4,550% | +4,767% |
| rig geometry: fallback 64 radial | 0,126360 | 0,096695 | −23,477% | +30,680% |
| rig geometry: fallback 16 radial | 0,039547 | 0,024803 | −37,283% | +59,445% |
| rig geometry: Rust/WASM 64 radial † | 0,185329 | 0,091491 | −50,633% | +102,566% |
| rig geometry: Rust/WASM 16 radial † | 0,049038 | 0,022634 | −53,843% | +116,653% |

Aqui **2/16 casos** atingem a meta +89%, ambos **Rust/WASM na comparação de fonte + artefato †**. Os dois fallbacks TS mantêm ganhos, mas de +30,680%/+59,445%, abaixo da meta; a conclusão anterior de quatro casos não se confirma de forma uniforme entre protocolos. Fixtures chega a +84,991%, ainda abaixo de 89%. Os custos de setup, construtor, snapshot e apply ficam piores nesta observação. Live/coarse passam a melhorar, mostrando por que não se deve combinar linhas dos protocolos para formar uma tabela artificialmente favorável. O resultado não é “todos os benchmarks +89%”, “CPU geral +89%” ou “jogo 1,89×”.

O binário candidato WASM foi recompilado com as dependências host explícitas em cache e release check; os testes de paridade TS/WASM passaram. Os ganhos Rust/WASM † acima referem-se aos artefatos medidos nessa condição de proveniência, sem demonstrar ganho global de GPU, física, FPS ou causalidade exclusivamente da alteração de fonte. Não houve instalação grande ou modificação global do toolchain para contornar a ausência de linker MSVC no host.

### Gate obrigatório do construtor: CI e controle local

O gate usa **medianas de tempo de CPU por construção**, não médias de wall time. O protocolo mantém a mesma fixture serializada e dependências dentro de cada par, ordem ABBA, 3.000 construções de aquecimento por passagem e 31 lotes de 1.000 construções por passagem: são **62 amostras por revisão e 21 checkpoints determinísticos**. A política reprova regressão material acima de 10% quando confirmada pelo limite inferior do intervalo bootstrap de 99%.

A evidência oficial da CI, `ci-source-0a6-constructor-abba.json`, compara exatamente os checkouts **0a6a04e e c20036f**, em diretórios separados, com Node 24.22.0, Linux e CPU identificada como AMD EPYC 7763. Este job usa as revisões explícitas; o merge virtual ea58b87 pertence à suíte geral descrita adiante. A mediana passou de **0,201074 para 0,1993345 ms (−0,865104%)**, com intervalo de razão candidata/base **[0,9741041509; 0,9967446876]**, `failed: false` e nenhuma violação. O job passou sem alterar o limite de 10%.

| Execução do protocolo de CPU | Mediana base, ms | Mediana candidata, ms | Variação da mediana | Intervalo de razão, 99% | Gate |
| --- | ---: | ---: | ---: | --- | --- |
| CI Linux, AMD EPYC 7763 | 0,201074 | 0,1993345 | −0,865104% | [0,9741041509; 0,9967446876] | Aprovado |
| Local Windows, i5-12500H, afinidade CPU0 | 0,188 | 0,203 | +7,978723% | [1,00000; 1,0855614973] | Aprovado |

O controle local está em `constructor-affinity/match-setup.json` e `affinity.json`. A máscara 0x1 foi verificada nos filhos Node e aplicada apenas ao shell temporário e seus descendentes. O hash da fixture é `1f6caef41d7353c40d208a98474a896a5dbbb62f88c5fd600f22316dae60d056`, também registrado na CI. Os hashes de dependências e ambientes de cada execução ficam em seus relatórios; não se misturam amostras de Windows/Linux para produzir uma média ou intervalo único.

Os três resultados permanecem separados: o gate de **CPU** passou; o Tinybench local mede **wall time** e observa regressões em algumas linhas; o CodSpeed mede **CPU Simulation** e informa −5,05% de eficiência em newMatchSim, com limitação de chamadas de sistema. Passar no gate específico não apaga essas observações nem demonstra a meta de +89% em todos os casos.
## Testes, banco e segurança local

`tests-final.json` registra **2.159 testes aprovados em 367 arquivos, zero falhas e zero testes ignorados/pendentes** na suíte geral inicial após as correções P1. O comando de suíte geral exclui `src/game/sim.stress.test.ts`, pois o stress de 200 sementes/replays tem gate dedicado; esse resultado não é evidência de que o stress passou. Lint desse snapshot: zero erros e zero avisos. TypeScript: saída sem diagnósticos, exit 0 conforme o ledger de execução. O runner de evidência de interface recebeu verificação ESLint adicional após o lint geral.

Essa aprovação de 2.159 testes pertence ao snapshot inicial: **não é aprovação da fonte posterior com ownership/split/imports**. A nova execução geral `tests-final-source.json` terminou com **2.185 aprovados / 2.187 totais, duas falhas, zero pending/todo, `success: false`**. A cópia preservada está em `tests/mixed-inflight/tests-final-source.json` e no log correspondente. As duas falhas são de `src/game/rig-skin.test.ts`: “moves private body buffers and releases merged and surviving surfaces exactly once” e “clones aliased body surfaces without mutating their shared buffers”, com observações de survivor/dispose divergentes.

Segundo a cronologia de execução, esse processo de suíte geral começou antes de uma edição em `rig-skin` e atravessou a mudança. O nova execução direcionada em processo novo, `rig-ownership-fresh-summary.json`, confirmou **20/20** com source SHA-256 `7d8bcdecad2a7d6774250da54ea9a385021a28851d0b8154398899aa57c4db3e` e test SHA-256 `dd34cfb97eca1e35b2e950a836d0766aa6bec097a249ca216813a76ed94f9c85`. Esse resultado é compatível com a hipótese de carregamento/cache antigo na execução que atravessou edição, mas **não apaga suas duas falhas nem substitui uma suíte geral congelada**. A confirmação geral posterior da CI está descrita abaixo. Os testes focados anteriores de IBL/i18n/rig pertencem aos seus respectivos snapshots.

**A suíte congelada foi concluída na CI:** `ci-source-0a6-full-vitest-summary.json` registra **371 arquivos e 2203 testes, todos aprovados**, Node 24.22.0 e duração observada139,90 s. O job fez checkout do merge virtual`ea58b87`, que une source 0a6a04e à base c20036f; a branch isolada não foi executada novamente como outro rerun geral. Essa execução posterior fornece a aprovação geral da fonte integrada, sem remover o snapshot local misto. Não se somam38/20/106/116 testes focados ao total2203, pois há sobreposição.

O stress dedicado executou uma asserção real que terminou 200 partidas com sementes fixadas e reproduziu cada resultado de forma independente; o validador confirmou 200 sementes e replays, sem skipped/missing. Evidência em `ci-source-0a6-success-summaries.json`, [execução Quality gates 42543242306](https://github.com/davizeiro12345678/jogomanager/actions/runs/42543242306). Isso mantém distinto o comando geral que exclui o arquivo stress e o teste de stress realmente executado.

Após o split dos caminhos frios, `career-cold-path-tests.json` registra **106 testes em sete arquivos**, incluindo seis cenários novos de import atrasado. `career-remount-cold-path-browser.json` repete em browser real a retenção da rodada/resultados/outbox e o bloqueio de callbacks antigos, com resultado aprovado. O TypeScript do projeto completo também passou depois dessa alteração, conforme o ledger do trabalho principal. Esses resultados dão cobertura ao split e não transformam a suíte geral anterior reprovada em aprovada.

A extensão seguinte, que carrega migração somente quando há snapshot/outbox bruto a normalizar, passou em **116/116 testes de sete arquivos, dez cenários de import atrasado/fences**, em `career-migration-boundary-tests.json`. `career-remount-migration-boundary-browser.json` repetiu a reprodução real e passou: callbacks antigos continuam rejeitados antes/depois da durabilidade e os dois writes locais/resultado/rodada são preservados mesmo com falhas controladas de nuvem. O projeto completo passou em TypeScript nesse snapshot. A normalização continua aguardada antes da exposição; a barreira síncrona compartilhada não foi deslocada para um import tardio. Esses resultados direcionados foram complementados pela suíte geral de 2.203 testes aprovada na CI.

O replay canônico Supabase e os contratos de acesso também **passaram no job real de CI**, complementando o PGlite local parcial descrito abaixo. Isso valida o escopo executado pelo workflow em ambiente de teste, sem aplicar migrations na produção. Uma prova independente de contenção concorrente distribuída não é inferida apenas desse status de replay/contratos.

`local-database-validation.json` executa os SQL reais 0023/0061/0063/0064/0065 e os três fixtures `career-tombstone-generation-contract.sql`, `support-outbox-contract.sql` e `atomic-match-room-contract.sql`. Todos passaram. Ambiente: **PGlite 0.5.15 / PostgreSQL 18.6 WASM**, banco efêmero, papéis mínimos compatíveis com os contratos. Source digest: `e48cf8f9bd4b6caa6793e7ae44770c61d13d39f8b0f514b0234cd8dae4c400f5`. Isso não é replay completo do histórico canônico Supabase/PostgreSQL 17, nem teste de disputa multiconexão ou implantação remota.

O harness HTTP local completou **500/500 requisições** com concorrência 4, autenticação sintética e módulos reais de input/moderação/sessão. Não efetuou writes de banco, chamadas de webhook ou tráfego contra produção. Limites explícitos: 30 s, payload de transporte 8.192 bytes, abortar por lag de event loop >250 ms ou latência >1.000 ms. Duração observada 545,011 ms; p50 2,8425 ms, p95 6,8418 ms, p99 13,3119 ms, máximo 45,3611 ms e lag máximo 5,3245 ms. Esses tempos são do harness loopback e não medem endpoints reais de produção.

| Cenário sintético | Requisições | Resultado esperado observado |
| --- | ---: | --- |
| Sem autenticação | 80 | 80 × 401 |
| Autoridade/JSON forjado | 80 | 80 × 400 |
| Mensagem de suporte excessiva | 40 | 40 × 400 |
| Evasão de moderação | 100 | 100 × 422 |
| Comando com placar forjado | 80 | 80 × 400 |
| Formato válido de suporte, sem write | 20 | 20 × 202 |
| Burst tático | 100 | 12 × 202 e 88 × 429 |

O harness registra 12 mutações táticas e histórico de 88 tentativas inválidas. Não é pentest da aplicação implantada, certificação de RLS completa, prova de resistência distribuída ou teste de entrega de email/suporte. O source digest dessa execução é `60a534ed4339f20dfa16814c38bd3744f687e4d52af17dfdad8cc55be292e544`.

### Guardas reais do Worker local, antes da autenticação

`worker-boundaries-final.json` testa o pipeline HTTP real Nitro/Cloudflare Worker local. Foram **200/200 POSTs rejeitados antes da autenticação**, todos com status 401 e as três políticas de cache `no-store`. Não houve autenticação bem-sucedida, gravação de conta ou banco, webhook ou carga contra produção.

Os limites foram concorrência de quatro, até 200 requisições em 30 s e interrupção por latência acima de 1.000 ms ou lag do cliente acima de 250 ms. A execução durou 8.770,505 ms, com p50 de 122,8334 ms, p95 de 301,0505 ms, p99 de 554,4255 ms e lag máximo do cliente de 15,0083 ms, sem interrupção por degradação. São tempos do tráfego rejeitado no Worker local, sem usuários autenticados ou trabalho de banco. O escopo difere das 500 requisições do harness sintético; os dois resultados devem ser lidos separadamente.
## Bundles e gates de release

**O build após a correção CSS mobile passou nos orçamentos absolutos, no split cinematográfico e no comparador, com os limites originais.** O snapshot `bundles/passed-mobile-final/` contém `quality-before-final.json`, `quality-final-mobile.json`, os dois relatórios de impacto e o log do build candidato. A comparação de `2026-11-09T01:32:09.966Z` registra `violations: []`. Os limites continuam em +2.048 bytes por startup gzip/Brotli e +400.000 bytes agregados por representação. O maior aumento de startup é +686 bytes gzip no palco cinematográfico.

| Startup por rota, após a correção mobile | Gzip base → candidata, bytes | Δ gzip, bytes | Brotli Q6 base → candidata, bytes | Δ Brotli, bytes |
| --- | ---: | ---: | ---: | ---: |
| Página inicial | 167.579 → 168.119 | +540 | 158.761 → 159.227 | +466 |
| Nova carreira | 430.340 → 429.887 | −453 | 407.645 → 406.972 | −673 |
| Partida rápida | 176.921 → 177.476 | +555 | 167.712 → 168.171 | +459 |
| Lobby multiplayer | 967.014 → 460.934 | −506.080 | 911.003 → 435.790 | −475.213 |
| Match 3D | 578.285 → 573.184 | −5.101 | 548.367 → 543.231 | −5.136 |
| Palco cinematográfico | 539.676 → 540.362 | +686 | 506.833 → 507.443 | +610 |
| Editor | 178.293 → 178.791 | +498 | 168.833 → 169.256 | +423 |
| Worker de simulação | 30.365 → 30.364 | −1 | 29.201 → 29.202 | +1 |

| JavaScript emitido total, incluindo lazy | Base, bytes | Candidata, bytes | Crescimento, bytes |
| --- | ---: | ---: | ---: |
| Raw | 7.341.997 | 7.461.996 | +119.999 |
| Gzip | 2.393.618 | 2.436.040 | +42.422 |
| Brotli Q6 | 2.261.150 | 2.301.343 | +40.193 |

O lobby passa de **944,3 para 450,1 KiB gzip (−52,33%)**, de 889,7 para 425,6 KiB Brotli (−52,16%) e de 2.982,7 para 1.358,3 KiB raw (−54,46%). O corpo pesado de LiveRoom é carregado quando necessário, com lógica preservada por hash. Nova carreira reduz cerca de 0,11% gzip e Match 3D cerca de 0,88% gzip; outras rotas crescem dentro do teto. O total gzip emitido aumenta cerca de 1,77%, pois inclui código lazy. Menor startup do lobby não comprova LCP, FPS ou latência online. Brotli Q6 é uma estimativa offline e depende do CDN para ser a compressão efetivamente transferida.
### Histórico das tentativas de bundles

O primeiro par **intermediário** de builds e comparador passou no mesmo runner: raw 7.167,2→7.184,3 KiB, gzip 2.336,6→2.343,1 KiB e Brotli Q6 2.207,4→2.213,6 KiB; nova carreira startup gzip 420,2→421,5 KiB e Match 3D 564,6→565,8 KiB. Essa evidência histórica está nos logs intermediários. O total emitido inclui chunks lazy e não representa download inicial, LCP, INP ou FPS.

**A primeira tentativa posterior com ownership e split lazy de LiveRoom construiu com sucesso e passou nos orçamentos absolutos/split cinematográfico, mas reprovou a comparação de crescimento de startup.** O snapshot exato foi preservado antes de qualquer regravação em `bundles/over-budget-attempt-1/`, contendo ambos os inventários JSON, `bundle-impact.json`/`.md` e o log do build candidato. A queda da rota multiplayer não compensava estouro em outras rotas.

| Métrica de startup da tentativa reprovada | Base, bytes | Candidata, bytes | Crescimento | Limite de crescimento | Estado |
| --- | ---: | ---: | ---: | ---: | --- |
| Nova carreira gzip | 430.340 | 433.264 | +2.924 | +2.048 | **Falhou** |
| Nova carreira Brotli Q6 | 407.645 | 410.296 | +2.651 | +2.048 | **Falhou** |
| Match 3D gzip | 578.285 | 581.027 | +2.742 | +2.048 | **Falhou** |
| Match 3D Brotli Q6 | 548.367 | 550.871 | +2.504 | +2.048 | **Falhou** |

Nessa tentativa, o lobby multiplayer startup caiu de **944,3 para 480,8 KiB gzip (−49,08%)** e de **889,7 para 455,4 KiB Brotli (−48,81%)**. O raw de startup caiu de 2.982,7 para 1.431,4 KiB (−52,01%). A paridade do corpo extraído foi comprovada por SHA-256; os números são de bytes emitidos para startup dessa rota, **não** ganho de FPS, LCP ou latência online. O JavaScript total emitido aumentou de 7.169,9 para 7.282,5 KiB raw, 2.337,5 para 2.374,9 KiB gzip e 2.208,2 para 2.243,6 KiB Brotli, dentro da tolerância agregada de 400.000 bytes por representação.

O trabalho principal isolou dependências eager para corrigir o excesso. Os limites de 2.048/400.000 bytes continuam inalterados. A compatibilidade do workflow com a base foi ajustada para aceitar ausência do alias legado ou exatamente a linha legada conhecida, rejeitando formas inesperadas; isso não reduz os gates. O `bundle-impact.json`/`.md` na raiz representam a tentativa mais recente e podem ser regenerados; os snapshots das falhas e da terceira aprovação permanecem preservados.

O **segundo rebuild**, após o primeiro split de caminhos frios da carreira, também passou no build/absolutos, mas ainda falhou na comparação por rota. Seu snapshot exato está em `bundles/over-budget-attempt-2/`. Os crescimentos foram nova carreira gzip **+2.744**, Brotli **+2.519**, Match 3D gzip **+2.546** e Brotli **+2.348 bytes**, todos ainda acima de +2.048. A redução de lobby dessa tentativa foi aproximadamente 49,10% gzip / 48,83% Brotli. A terceira alteração usa presença real de snapshot/outbox para carregar migração apenas quando necessária, sem timers nem exposição de carreira não normalizada; seu foco116/remount/TypeScript e o terceiro rebuild/comparador passaram como descrito acima.

| Gate ou condição | Evidência | Estado |
| --- | --- | --- |
| Lint sem erros ou avisos | Lint local final e `lint-evidence-final.log`; job de CI da fonte 0a6a04e | Aprovado nos snapshots registrados |
| TypeScript | Projeto completo sem erros; job de CI da fonte 0a6a04e | Aprovado |
| Suíte geral | 371 arquivos e 2.203 testes, no merge virtual ea58b87 da fonte 0a6a04e sobre c20036f | Aprovada; tentativa local mista preservada como histórico |
| Stress de 200 sementes e replays | Uma asserção executada e validador de 200 sementes/replays na CI | Aprovado, separado do total da suíte geral |
| Construtor no mesmo runner | CI: mediana de CPU −0,865104%, 62 amostras por revisão, 21 checkpoints; controle local separado +7,978723% | Ambos aprovados no limite de regressão material de 10% |
| Meta de +89% em todos os benchmarks | CodSpeed: seis melhorias, duas regressões, oito inalterados | **Não atingida** |
| Paridade dos 16 casos locais | Três protocolos completos, sem violações de paridade | Aprovada no escopo dos protocolos |
| Rust e WASM | Check/build local; CI verificou bindings e paridade do binário gerado e distribuído | Aprovado; proveniência dos ganhos permanece ressalvada |
| Build da aplicação após o CSS mobile | `application-build-candidate-mobile-final.log` | Aprovado localmente |
| Crescimento de startup gzip/Brotli | Última comparação sem violações; maior aumento +686 bytes, teto +2.048 | Aprovado localmente; duas tentativas reprovadas preservadas |
| Crescimento agregado de JavaScript | Raw +119.999, gzip +42.422, Brotli +40.193 bytes; teto +400.000 por representação | Aprovado |
| Budgets absolutos e split cinematográfico | Último build local aprovado; job de bundles da CI 0a6a04e aprovado | Aprovados nos snapshots registrados |
| Contratos gráficos e física | Job de benchmark 3D determinístico e autoridade da bola na CI | Aprovados; não substituem medição física |
| Pico de draw calls em alta | Base 272, intermediário 293, IBL 228, ownership 226; teto 260 | Aprovado na execução ownership |
| Média solicitada de 60 FPS | Ownership: 82,263 FPS em alta | Atingida nessa execução |
| Meta estendida de 1% low ≥50 FPS | Ownership: 14,494 FPS | **Não atingida** |
| Campanha física completa | Uma base e três candidatas diferentes na RTX 4060 | **Pendente:** faltam repetições da mesma fonte nas duas GPUs |
| Compressão e integridade de assets 3D | Job de contrato de assets na CI | Aprovado |
| Lighthouse mobile | Cinco rotas, três execuções por rota, agregação pessimista; asserções aprovadas | Aprovado para 0a6a04e; valores individuais não foram inventados |
| Limites mobile preservados | Performance ≥0,97, TBT ≤200 ms, LCP ≤2.500 ms, CLS ≤0,1, acessibilidade ≥0,90 | Mesmos limites e severidade de erro |
| Lighthouse desktop/shell | Job aprovado; performance ≥45, acessibilidade ≥90, boas práticas ≥85 | Aprovado para 0a6a04e |
| Replay canônico Supabase e acesso | Job de replay e contratos aprovado na CI | Aprovado no escopo executado; sem deploy ou prova independente de contenção distribuída |
| Revisões independentes | P1 de carreira/OAuth resolvidos; online/suporte sem achado acionável | Concluídas nos respectivos escopos |
| Workflows da fonte 0a6a04e | Oito workflows aprovados; 12 jobs de Quality gates, incluindo o agregado crítico | Aprovados, em `ci-source-0a6-final.json` |
| CSS e helpers posteriores a 0a6a04e | Quatro linhas de CSS, dois ajustes de captura; build, oito testes, UI e lint locais aprovados | Nova CI será acompanhada após o commit; a aprovação anterior não é transferida implicitamente |
| Produção | Nenhum merge ou deploy executado | Fora desta entrega; publicação não foi realizada |
### Lighthouse mobile: valores absolutos da candidata

`ci-source-0a6-mobile-lighthouse-metrics.json` preserva as 15 medições da fonte 0a6a04e no merge virtual da CI. A tabela aplica o pior resultado de cada métrica entre as três execuções de cada rota: menor score e maiores TBT, LCP e CLS. As métricas de uma linha podem vir de execuções diferentes. Os valores de LCP abaixo foram arredondados a duas casas; as linhas brutas mantêm sua precisão original.

| Rota | Performance (0–1) | Acessibilidade (0–1) | TBT máximo, ms | LCP máximo, ms | CLS máximo |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 0,98 | 0,97 | 24 | 2.019,18 | 0 |
| `/guias` | 1,00 | 1,00 | 39 | 1.418,26 | 0 |
| `/guia-de-scouting` | 1,00 | 1,00 | 10 | 1.417,63 | 0 |
| `/melhores-formacoes` | 0,99 | 1,00 | 18 | 1.704,12 | 0 |
| `/partida-rapida` | 1,00 | 1,00 | 28,5 | 1.406,78 | 0,00496395 |

Todas as asserções passaram nos limites originais. São auditorias absolutas da candidata em emulação mobile na CI, sem comparação Lighthouse antes/depois e sem inferência de FPS em aparelho físico. A correção CSS posterior será validada pelo novo head; esses números continuam associados a 0a6a04e.
Uma falha, cancelamento, teste ignorado ou evidência obrigatória ausente continua bloqueando o respectivo gate. O sucesso intermediário não certifica a fonte final. O workflow remoto e sua exigência administrativa no branch são verificações distintas; a existência do workflow não prova que a proteção administrativa está configurada.

## Serviços externos e configuração restante

As observações remotas desta sessão são somente leitura e estão detalhadas em `external-services.md`. Nenhum estado externo é inferido a partir da implementação local.

| Serviço | Observação arquivada | Pendência ou limite |
| --- | --- | --- |
| Supabase | `ACTIVE_HEALTHY`; advisors de segurança/desempenho/saúde arquivados | Nenhuma migration remota aplicada; replay/contratos completos e credenciais de provedores diretos precisam do fluxo próprio |
| OAuth/Supabase | Configuração pública observada: email, Google, Azure, Discord e passkeys habilitados | Provedor habilitado não prova credenciais diretas independentes configuradas nem consentimento/callback concluído |
| Resend | 41 templates, todos published, nenhum draft no inventário | Auditoria de ligação de todos os eventos e automações continua distinta; nenhum email real enviado |
| Suporte/webhook | Implementação de fila/assinatura pronta para configuração | URL/configuração externa ainda não fornecida/verificada; entrega externa pendente |
| SentinelX | Lista de integrações vazia | Nenhuma regra de zona Cloudflare alterada pelo conector |
| Lovable | Consulta da API retornou `Unknown tool`; houve inspeção visual separada | Nenhuma alteração por API foi simulada; revisão/entrega depende do canal disponível |
| NPMScan | 962 dependências verificadas quanto a vulnerabilidades; 100 com detalhe adicional | Auditoria ampliada de scripts/licenças/ownership incompleta nas outras 862; resultado do scanner não é reprodução de exploração |
| GitHub | PR #125 mesclado/fechado na base; novo [draft PR #128](https://github.com/davizeiro12345678/jogomanager/pull/128) criado e commit 0a6a04e enviado | Oito workflows da fonte 0a6a04e aprovados, incluindo evidência visual; sem merge ou deploy |

O scanner arquivado apontou `deepmerge@4.3.1` como LOW, sem versão corrigida informada, na cadeia de renderização de email. Isso é um **achado reportado pelo scanner nesta sessão**, sem exploração reproduzida ou correção inventada. Não foi substituída a árvore de dependências de forma incompatível apenas para remover o alerta. Advisors Supabase sobre RLS sem policy, GraphQL e índices exigem análise de acesso/workload; não demonstram por si só vazamento nem justificam remoção cega de índices.

URLs/chaves públicas para a verificação local ficaram apenas em configuração ignorada pelo Git. Nenhum valor de credencial, arquivo de ambiente ignorado ou URL com acesso embutido integra o relatório ou o manifesto. Não houve email real, pagamento, alteração de DNS, publicação de segredo, carga de ataque na produção, merge ou deploy como parte destas evidências.

## Imagens, vídeo, cinema e gráficos científicos

As capturas atuais antes/depois são `graphics/baseline-nvidia-broadcast-1.png` e `graphics/final-ownership-nvidia-broadcast-1.png`. As intermediárias `candidate-nvidia-broadcast-1.png` e `final-nvidia-broadcast-1.png` também foram preservadas. Estão vinculadas às respectivas execuções completas; não foram editadas/combinadas e não provam isoladamente equivalência visual. `candidate-functional-smoke.png` é diagnóstico de outro protocolo.

### Interface pública e correção mobile

`interface/final/interface.json` registra a captura anterior à correção CSS mobile, com desktop de 1365×900 e DPR 1. As seis rotas (`/`, `/contato`, `/sobre`, `/criador`, `/auth`, `/new`) retornaram HTTP 200, sem erros JavaScript ou assets falhados, e têm vídeo local. O escopo é a interface pública, sem login concluído, criação de conta, ticket enviado ou mutação em produção. A inspeção mobile encontrou “Identidade” quebrada no último caractere, embora não houvesse overflow horizontal; esse caso mostrou um limite da verificação anterior.

O conjunto corrigido **`interface/final-mobile/` está concluído**, com as mesmas seis rotas desktop, três verificações mobile, zero erros ou assets falhados e novo vídeo. O CSS amplia o item ativo da navegação de criação. O harness verifica rótulo em uma linha, ausência de overflow e quatro alvos de toque de pelo menos 44 px nas larguras de 390 e 320 px. Os menores itens inativos mediram, respectivamente, 67,80 e 53,80 px de largura, ambos com 50 px de altura. Os oito testes existentes de layout/acessibilidade passaram em `mobile-layout-regression-tests.json`.

O build dessa correção passou em `application-build-candidate-mobile-final.log`. Uma tentativa anterior encontrou o bloqueio local de arquivo EBUSY causado pelo próprio preview; o log `application-build-candidate-mobile-locked-attempt.log` foi preservado, e o trabalho principal encerrou seu Worker e refez o build. A alteração é de quatro linhas de CSS e não modifica os arquivos medidos do renderizador. Sua CI no novo head ainda será acompanhada após o próximo commit.

### Vídeos visuais e falha de captura preservada

| Captura | Metadata | Vídeo local | Estado e escopo |
| --- | --- | --- | --- |
| Cinema base | `cinematic/baseline-video.json` | `cinematic/video/page@98a9a87acea4cbf3a4aae25b1d31d926.webm` | Concluído: 60 s, zero erros; overhead de gravação |
| Cinema ownership | `cinematic/final-video.json` | `cinematic/video/page@2659b3a8e72a7d102c3ee1511fa3ceee.webm` | Concluído: 60 s, zero erros; overhead de gravação |
| Interface anterior à correção mobile | `interface/final/interface.json` | `interface/final/video/page@3f1c7117b165fb9636dde11a0ffe8612.webm` | Concluído para seis rotas públicas; não é fluxo autenticado completo |
| Interface após a correção mobile | `interface/final-mobile/interface.json` | `interface/final-mobile/video/page@834197ad9a69528cd7bc8aee2ded1f6e.webm` | Concluído com novas verificações de rótulos e alvos de toque |
| Broadcast base | `graphics/baseline-video.json` | `graphics/video/page@e574c5358b02cc5c15ae4d04fde8b8f7.webm` | Concluído: 60 s de aquecimento + 300 s medidos; gravação excluída dos percentuais sem vídeo |
| Broadcast ownership | `graphics/final-video.json` | `graphics/video/page@57507cd63a8e9bfc6ab136f9d9b010bc.webm` | Concluído: 60 s de aquecimento + 300 s medidos; gravação excluída dos percentuais sem vídeo |

Os vídeos são arquivos locais de entrega visual e ficam fora do Git quando volumosos. Seus tempos incluem o custo de gravação e não entram nas séries sem vídeo. O primeiro vídeo base de cinema falhou por uma race exclusiva do harness após o host ser desmontado; a metadata e o WebM em `cinematic/failed-capture/` foram preservados como tentativa falha. O helper passou a coletar o snapshot de modo atômico com verificação de host, sem alteração da aplicação. As duas capturas de 60 s acima foram refeitas com sucesso; a falha antiga não é usada como evidência de captura concluída.
`graphics/video/video-manifest.json` registra os hashes e a validação dos dois vídeos completos. O arquivo base tem **58.919.009 bytes e 364,52 s**; o arquivo ownership tem **57.773.125 bytes e 364,24 s**. Ambos usam VP8, resolução de vídeo 1440×1000 e cadência codificada de 25 FPS. Essa cadência do arquivo não é o FPS do jogo; o canvas medido continua em alta, 1280×720 e DPR 1. Os dois capturaram o protocolo completo com cobertura de 300.000 ms, sem interrupções, adaptação ou erros. A primeira e a última sequência de um segundo foram decodificadas com sucesso. Os WebM ficam **somente na entrega local, fora do Git**, e seus tempos com encoder não substituem a comparação sem vídeo de 82,263 FPS.
### Cinema sem gravação: abertura, transições e reabertura

Fontes: `cinematic/baseline.json`/`.png`, `cinematic/final.json`/`.png` da etapa IBL e **`cinematic/final-ownership.json`/`.png` da fonte 0a6a04e**. As três execuções usaram Edge headed, a mesma RTX 4060/D3D11, alta, viewport 1280×720/DPR 1, cena `prematch-locker`, autoplay ligado, narração desligada, **60 segundos de relógio e três ciclos**, sem gravação. O canvas real registrado é **1269×720**, DPR aproximadamente 1, nos três lados. Esse diagnóstico de cinema é distinto do broadcast com canvas 1280×720,60 segundos de aquecimento e 300 segundos de medição.

`weightedFps = soma(frames) / (soma(duração observada das janelas) /1000)` usa todas as janelas, inclusive aberturas/reaberturas frias. Não é média aritmética dos FPS de janelas nem FPS sobre 60 segundos inteiros sem lacunas. Janelas nominalmente de cerca de um segundo podem durar mais sob stalls. **Os resumos não permitem reconstruir p95/p99/1% low globais.**

| Medida do diagnóstico | Base | Etapa IBL | Ownership 0a6a04e |
| --- | ---: | ---: | ---: |
| Ciclos | 3 | 3 | 3 |
| Janelas preservadas | 42 | 45 | 45 |
| Transições observadas | 10 | 11 | 11 |
| Frames nas janelas | 5.003 | 5.453 | 5.555 |
| Tempo somado das janelas,s | 57,6930 | 58,0909 | 57,2310 |
| FPS ponderado pela duração observada | 86,717626 | 93,870124 | **97,062781** |
| Frames>50 ms nas janelas | 22 | 23 | **22** |
| Maior frame entre janelas,ms | 6.813,1 | 5.635,5 | **5.430,8** |
| Maior p95 de uma janela,ms | 6.056,5 | 5.073,2 | 5.430,8 |
| Maior p99 de uma janela,ms | 6.813,1 | 5.635,5 | 5.430,8 |
| Menor1% low de uma janela,FPS | 0,146776 | 0,177447 | 0,184135 |
| Erros JavaScript registrados | 0 | 0 | 0 |

A média ponderada ownership é aproximadamente **11,93% maior** que a base; a contagem de stalls é **igual à base (22)**, e o maior frame ficou cerca de 20,29% menor. Ainda há spike frio de 5,43 segundos. Frente à etapa IBL, o pior p95 por janela ficou maior (5.073,2→5.430,8 ms), mesmo com média ponderada maior. Não selecionar apenas os melhores extremos nem transformar esse p95 de janela em p95 global.

| Extremos por janela | Base: mínimo→máximo | IBL: mínimo→máximo | Ownership: mínimo→máximo |
| --- | ---: | ---: | ---: |
| FPS | 0,494006→144,307325 | 0,589820→144,321688 | 0,550540→144,451086 |
| 1% low,FPS | 0,146776→116,959064 | 0,177447→114,942529 | 0,184135→119,760479 |
| p50,ms | 6,9→58,3 | 6,9→110,5 | 6,8→41,0 |
| p95,ms | 8,1→6.056,5 | 8,0→5.073,2 | 8,0→5.430,8 |
| p99,ms | 8,4→6.813,1 | 8,6→5.635,5 | 8,2→5.430,8 |
| Maior frame de cada janela,ms | 8,7→6.813,1 | 8,7→5.635,5 | 8,4→5.430,8 |
| Draw calls médias da janela | 48,300→223,250 | 50,556→215,847 | 48,300→215,792 |
| Heap amostrado,MB decimais | 49,649→125,798 | 40,029→108,240 | 39,458→99,785 |

Draws médios de janelas não são pico de todos os frames. Limites de heap amostrado não são pico garantido ou VRAM. A diferença de transições e cobertura altera a mistura de planos/exposições; cache de navegador/driver e compilação de shaders não foram isolados.

| Evento `firstFrameMs` por ciclo | Base,ms | IBL,ms | Ownership,ms |
| --- | ---: | ---: | ---: |
| Ciclo 1 | 727,4 | 601,7 | 538,4 |
| Ciclo 2 | 208,5 | 181,8 | 169,2 |
| Ciclo 3 | 155,9 | 158,6 | 156,9 |

Esses marcadores não são equivalentes ao maior frame da janela nem certificam que toda a sequência já esteja pronta/interativa. O terceiro marcador ownership ficou ligeiramente maior que a base. O diagnóstico não é a jornada contínua da carreira, não possui três repetições independentes por revisão e não certifica todas as cutscenes/perfis. Trechos próximos de 144 FPS não eliminam os spikes frios registrados.

As medições sem gravação são independentes dos vídeos de cinema concluídos e da capturas de broadcast concluídas. As métricas de vídeo não foram misturadas aos comparadores de FPS.\r\n\r\nO gerador `scripts/generate-quality-report.py` exportou **oito figuras atuais em PNG e SVG** para `figures/ownership-stage/`, diretamente por Matplotlib 3.11.2 e NumPy 2.5.4 em um ambiente Python 3.12 local ignorado pelo Git, sem modificar ambientes globais. Os dois conjuntos históricos, sete figuras cada, foram preservados em `figures/intermediate/` e `figures/ibl-stage/`. Cada conjunto contém README com hashes SHA-256 das entradas. As legendas CPU atuais marcam as linhas Rust † e a limitação de proveniência; o gráfico adicional de cópias tem escopo próprio de construção, sem claim de heap/FPS.

| Figura | PNG | SVG vetorial |
| --- | --- | --- |
| FPS por intervalo registrado | [PNG atual](figures/ownership-stage/fps-intervalos.png) | [SVG atual](figures/ownership-stage/fps-intervalos.svg) |
| Média e 1% low cumulativos | [PNG atual](figures/ownership-stage/fps-cumulativo.png) | [SVG atual](figures/ownership-stage/fps-cumulativo.svg) |
| Percentis e stall máximo | [PNG atual](figures/ownership-stage/latencia-frames.png) | [SVG atual](figures/ownership-stage/latencia-frames.svg) |
| Stalls, heap, draws e pool | [PNG atual](figures/ownership-stage/recursos-stalls.png) | [SVG atual](figures/ownership-stage/recursos-stalls.svg) |
| CPU: 16 casos, curto 3×3 | [PNG](figures/ownership-stage/cpu-deltas-curto.png) | [SVG](figures/ownership-stage/cpu-deltas-curto.svg) |
| CPU: 16 casos, ABBA estendido | [PNG](figures/ownership-stage/cpu-deltas-estendido.png) | [SVG](figures/ownership-stage/cpu-deltas-estendido.svg) |
| CPU: 16 casos, ABBA com afinidade | [PNG](figures/ownership-stage/cpu-deltas-afinidade.png) | [SVG](figures/ownership-stage/cpu-deltas-afinidade.svg) |
| Ownership: cinco construções/cópias | [PNG](figures/ownership-stage/rig-copias-ownership.png) | [SVG](figures/ownership-stage/rig-copias-ownership.svg) |

O gráfico de taxa por intervalo usa `Δframes / ΔcoveredMs × 1000` em cada intervalo realmente observado, aproximadamente 1 s. O aquecimento é excluído pela cobertura, sem interpolação de frames, descarte de stalls ou média aritmética de FPS para obter a média global. A curva de FPS cumulativo usa `frames / coveredMs × 1000`. O 1% low cumulativo vem diretamente do instrumento; **não se calcula um 1% low global fazendo média de 1% lows de janelas**. p50/p95/p99/máximo vêm da amostra global final. As curvas não são repetições independentes nem intervalos de confiança.

## Mapeamento de artefatos: antes, intermediário e candidato medido

O detalhamento de arquivo/fase/limite está em `artifact-manifest.md`. O mapeamento essencial é:

| Fase | Artefatos exatos existentes | Uso permitido |
| --- | --- | --- |
| Antes, fonte base | Base Git `c20036f…`; `application-build-baseline.log`; `bundle-before.log` | Origem da comparação intermediária; não substitui rebuild final pareado |
| Antes, físico RTX 4060 | `graphics/baseline-nvidia-broadcast-1.json` e `.png` | Baseline do único par 60 s + 300 s |
| Diagnóstico inicial Intel | `graphics/baseline-broadcast-1.json` e `.png` | Diagnóstico de protocolo/GPU diferente; fora dos ganhos |
| Intermediário, funcional | `graphics/candidate-functional-smoke.json` e `.png` | Ciclo de vida/pool/erros; fora da comparação FPS |
| Primeiro intermediário, bundles | `application-build-candidate.log`, `bundle-intermediate.log`, `bundle-comparison-intermediate.log` | Gates de bytes naquele snapshot; não declarar final |
| Tentativa posterior acima do orçamento | `bundles/over-budget-attempt-1/{quality-before-final.json,quality-final.json,bundle-impact.json,bundle-impact.md,application-build-candidate.log}` | Build/absolutos aprovados, crescimento startup reprovado; snapshot preservado antes do próximo rebuild |
| Segunda tentativa acima do orçamento | `bundles/over-budget-attempt-2/{quality-before-final.json,quality-final.json,bundle-impact.json,bundle-impact.md,application-build-candidate.log}` | Após primeiro split frio; quatro crescimentos ainda reprovados e preservados |
| Terceira tentativa de bundles aprovada | `bundles/passed-attempt-3/{quality-before-final.json,quality-final.json,bundle-impact.json,bundle-impact.md,application-build-candidate.log}` | Absolutos/split/comparação passaram sem relaxar limites; inclui totalJS maior e startup do lobby menor |
| Candidato gráfico intermediário medido | `graphics-candidate-final-build.log`; `graphics/candidate-nvidia-broadcast-1.json` e `.png`; `graphics/comparison.json` | Resultado pré correção IBL, com limites explícitos; “final” no nome do log não certifica a fonte posterior |
| CPU curto completo | `cpu/{baseline,candidate}-{1,2,3}.json`; `cpu/comparison.json`/`.md` | Todos os 16 casos do protocolo 200/50 ms |
| CPU estendido completo | `cpu-extended/{baseline,candidate}-{1,2}.json`; `cpu-extended/comparison.json`/`.md` | Todos os 16 casos do protocolo ABBA 1000/250 ms |
| CPU com afinidade completo | `cpu-affinity/{baseline,candidate}-{1,2}.json`; `cpu-affinity/comparison.json`/`.md`; `cpu-affinity/affinity.json` | Todos os 16 casos do protocolo ABBA 1000/250 ms, principal controle local de wall time |
| Construtor controlado | `constructor-affinity/affinity.json`, amostras e `constructor-affinity/match-setup.json` | Gate oficial CPU aprovado; métrica distinta das tabelas Tinybench |
| Etapa IBL/intermediário 2 | `graphics/final-nvidia-broadcast-1.json`, `.png` e `graphics/comparison-final.json` | Concluído: 81,743 FPS, pico 228, cobertura integral; fonte anterior ao ownership |
| Fonte ownership medida | `graphics/final-ownership-source.json`; `graphics/final-ownership-nvidia-broadcast-1.json`/`.png`; `graphics/comparison-final-ownership.json` | Fonte 0a6a04e/fixture/lock/assets identificados, execução completa com 82,263 FPS e pico de 226 draw calls; maior stall de 800,8 ms preservado |
| Validação de fonte final registrada | `tests-final.json`/`.log`, `lint-final.log`, `typecheck-final.log`, `career-remount-browser.json` | Resultado local das verificações descritas, sem substituir stress/CI/GPU |
| Nova cobertura direcionada congelada | `rig-ownership-fresh-summary.json`, `rig-ownership-fresh-tests.json`, `career-cold-path-tests.json`, `career-migration-boundary-tests.json`, dois remounts de split/migração | Rig20/20, foco106/116 e remounts reais aprovados; sobrepõem testes da suíte geralCI com 2.203 testes |
| CI congelada/benchmark remoto | `ci-source-0a6-full-vitest-summary.json`, `ci-source-0a6-success-summaries.json`, `ci-source-0a6-codspeed-{comparison,public-table,warnings}.json` | 371 arquivos e 2.203 testes aprovados no merge virtual ea58b87;12 jobs de Quality gates aprovados; CodSpeed: 6/2/8 e 16 valores próprios |
| Banco/harness | `local-database-validation.json`, `local-security-harness.json` | Contratos locais delimitados |
| Remoto somente leitura | `external-services.md`, `npmscan-baseline.json`, `supabase-{health,security,performance}.json` | Observações pontuais, sem inferir deploy |
| Cinema sem vídeo | `cinematic/baseline.json`/`.png`, `cinematic/final.json`/`.png` | Diagnóstico de 60 s/3 ciclos; média ponderada e extremos por janela, sem percentis globais reconstruídos |
| Interface e vídeos visuais | Ainda não produzidos/consolidados neste checkpoint | **Pendente** |
| Fonte candidata enviada / novo PR | `0a6a04e581571a367cc1c742ead21f984abbbc1b`; [draft PR #128](https://github.com/davizeiro12345678/jogomanager/pull/128) | Commit/push/PR concluídos pelo trabalho principal; CI/medição/evidência final ainda em consolidação |

## Próximas melhorias e condições para fechar a avaliação

1. Investigar as duas regressões do CodSpeed, especialmente snapshotMatch, que não tem flamegraph disponível. Usar perfil de tempo decorrido para os quatro casos dominados por chamadas de sistema, preservando as fixtures, as sementes e a autoridade determinística. O gate do construtor aprovado não substitui a meta de +89% em todos os casos.
2. Investigar a variação dos 300 live ticks entre os protocolos locais. O resultado piora nos dois protocolos sem afinidade e melhora no controle com afinidade. Não combinar linhas de instrumentos ou ambientes distintos para formar uma comparação artificialmente favorável.
3. Repetir a fonte ownership e investigar o maior stall de 800,8 ms. O pico de 226 draw calls cabe no teto de 260, mas a pior cauda ficou mais lenta que a base e que a etapa IBL. Preservar também os resultados intermediários de pico 293 e stall 640 ms.
4. Acompanhar o platô e o esvaziamento do pool em ciclos longos, medindo heap e inventário de recursos separadamente. A redução de aproximadamente 49% no tráfego de cópia por construção não estabelece redução equivalente de memória residente ou VRAM.
5. Completar três repetições pareadas da mesma fonte em cada uma das duas GPUs, com cenário, seed, qualidade, viewport e DPR iguais. Registrar os piores resultados, stalls e 1% low global de cada execução. O diagnóstico Intel frio/headless permanece fora dos percentuais da RTX 4060.
6. Concluir o índice e a revisão de privacidade dos vídeos e capturas locais. Manter os vídeos fora do Git e identificar o overhead de gravação; eles não substituem as medições sem vídeo nem demonstram uma jornada autenticada completa.
7. Arquivar os resultados já aprovados da fonte 0a6a04e, incluindo o merge virtual ea58b87 da suíte geral e os checkouts diretos do gate do construtor. Após o commit do CSS e dos helpers de captura, acompanhar os checks do novo head; não presumir que a CI anterior o aprovou.
8. Validar os fluxos externos ainda dependentes de configuração: webhook de suporte, credenciais próprias dos provedores allowlisted e ligação dos eventos transacionais. O inventário de templates publicados não comprova o disparo por todos os eventos.
9. Consolidar a evidência no draft PR #128, mantendo estes limites visíveis e identificando o commit posterior de CSS, helpers e relatórios. Merge e publicação continuam fora desta entrega autorizada.
Este pacote permite revisar a implementação e seus efeitos observados, mantendo abertas as condições de desempenho, integração e entrega que ainda não foram demonstradas.
